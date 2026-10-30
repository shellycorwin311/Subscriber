import { Router } from "express";
import { prisma } from "../db";
import { requireStaffAuth } from "../middleware/auth";

export const statementsRouter = Router();

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

type ChargeLine = { date: string; dayOfWeek: string; quantity: number; priceCents: number };
type PaymentLine = { date: string; amountCents: number; referenceNumber: string | null };
type WeekBucket = {
  weekEnding: string;
  charges: ChargeLine[];
  returns: ChargeLine[];
  payments: PaymentLine[];
};

type StatementResult = {
  dealer: { id: string; name: string; dealerNumber: string | null };
  paper: { id: string; name: string };
  month: string;
  weeks: WeekBucket[];
  totalChargesCents: number;
  totalReturnsCents: number;
  totalPaymentsCents: number;
  netOwedCents: number;
};

async function buildStatement(dealerId: string, paperId: string, month: string): Promise<StatementResult | null> {
  const [year, monthNum] = month.split("-").map(Number);
  const monthStart = new Date(year, monthNum - 1, 1);
  const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);

  const dealer = await prisma.dealer.findUnique({ where: { id: dealerId } });
  const paper = await prisma.paper.findUnique({ where: { id: paperId } });
  if (!dealer || !paper) return null;

  const deliveries = await prisma.rackDelivery.findMany({
    where: { dealerId, paperId, deliveryDate: { gte: monthStart, lte: monthEnd } },
    orderBy: { deliveryDate: "asc" },
  });

  const payments = await prisma.dealerPayment.findMany({
    where: { dealerId, paymentDate: { gte: monthStart, lte: monthEnd } },
    orderBy: { paymentDate: "asc" },
  });

  const weeksMap = new Map<string, WeekBucket>();

  function bucketFor(date: Date): WeekBucket {
    const key = endOfWeek(date).toISOString().slice(0, 10);
    const existing = weeksMap.get(key);
    if (existing) return existing;
    const fresh: WeekBucket = { weekEnding: key, charges: [], returns: [], payments: [] };
    weeksMap.set(key, fresh);
    return fresh;
  }

  let totalCharges = 0;
  let totalReturns = 0;
  let totalPayments = 0;

  for (const d of deliveries) {
    const bucket = bucketFor(d.deliveryDate);
    const dayOfWeek = DAY_NAMES[d.deliveryDate.getDay()];
    const price = d.priceCentsApplied ?? 0;
    if (d.quantityDelivered > 0) {
      bucket.charges.push({
        date: d.deliveryDate.toISOString().slice(0, 10),
        dayOfWeek,
        quantity: d.quantityDelivered,
        priceCents: price,
      });
      totalCharges += d.quantityDelivered * price;
    }
    if (d.quantityReturned) {
      bucket.returns.push({
        date: d.deliveryDate.toISOString().slice(0, 10),
        dayOfWeek,
        quantity: d.quantityReturned,
        priceCents: price,
      });
      totalReturns += d.quantityReturned * price;
    }
  }

  for (const p of payments) {
    const bucket = bucketFor(p.paymentDate);
    bucket.payments.push({
      date: p.paymentDate.toISOString().slice(0, 10),
      amountCents: p.amountCents,
      referenceNumber: p.referenceNumber,
    });
    totalPayments += p.amountCents;
  }

  const weeks = [...weeksMap.values()].sort((a, b) => a.weekEnding.localeCompare(b.weekEnding));

  return {
    dealer: { id: dealer.id, name: dealer.name, dealerNumber: dealer.dealerNumber },
    paper: { id: paper.id, name: paper.name },
    month,
    weeks,
    totalChargesCents: totalCharges,
    totalReturnsCents: totalReturns,
    totalPaymentsCents: totalPayments,
    netOwedCents: totalCharges - totalReturns - totalPayments,
  };
}

// Staff: generate a monthly statement for one dealer, one paper.
statementsRouter.get("/", requireStaffAuth, async (req, res) => {
  const dealerId = req.query.dealerId as string;
  const paperId = req.query.paperId as string;
  const month = req.query.month as string;

  if (!dealerId || !paperId || !month) {
    return res.status(400).json({ error: "dealerId, paperId, and month are required" });
  }

  const statement = await buildStatement(dealerId, paperId, month);
  if (!statement) return res.status(404).json({ error: "Dealer or paper not found" });
  res.json(statement);
});

// Staff: generate statements for every dealer/paper combination that had
// any delivery or payment activity in the given month - used for batch
// review/printing and the all-dealers summary.
statementsRouter.get("/batch", requireStaffAuth, async (req, res) => {
  const month = req.query.month as string;
  if (!month) return res.status(400).json({ error: "month is required" });

  const [year, monthNum] = month.split("-").map(Number);
  const monthStart = new Date(year, monthNum - 1, 1);
  const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);

  const deliveries = await prisma.rackDelivery.findMany({
    where: { deliveryDate: { gte: monthStart, lte: monthEnd } },
    select: { dealerId: true, paperId: true },
    distinct: ["dealerId", "paperId"],
  });
  const payments = await prisma.dealerPayment.findMany({
    where: { paymentDate: { gte: monthStart, lte: monthEnd } },
    select: { dealerId: true },
    distinct: ["dealerId"],
  });

  // Pair every dealer that had a payment with every paper they carry, so a
  // payment-only month still produces a statement.
  const paymentDealerIds = payments.map((p) => p.dealerId);
  const standingOrdersForPaidDealers = paymentDealerIds.length
    ? await prisma.dealerStandingOrder.findMany({
        where: { dealerId: { in: paymentDealerIds } },
        select: { dealerId: true, paperId: true },
        distinct: ["dealerId", "paperId"],
      })
    : [];

  const pairSet = new Map<string, { dealerId: string; paperId: string }>();
  for (const d of deliveries) pairSet.set(`${d.dealerId}:${d.paperId}`, d);
  for (const s of standingOrdersForPaidDealers) pairSet.set(`${s.dealerId}:${s.paperId}`, s);

  const statements: StatementResult[] = [];
  for (const { dealerId, paperId } of pairSet.values()) {
    const statement = await buildStatement(dealerId, paperId, month);
    if (statement) statements.push(statement);
  }

  statements.sort((a, b) => a.dealer.name.localeCompare(b.dealer.name));

  res.json({ month, statements });
});