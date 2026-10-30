import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireStaffAuth } from "../middleware/auth";

export const pressRunsRouter = Router();

// Staff: list press runs, optionally filtered by paper
pressRunsRouter.get("/", requireStaffAuth, async (req, res) => {
  const paperId = req.query.paperId as string | undefined;
  const pressRuns = await prisma.pressRun.findMany({
    where: paperId ? { paperId } : undefined,
    include: { paper: true },
    orderBy: { runDate: "desc" },
  });
  res.json(pressRuns);
});

const createPressRunSchema = z.object({
  paperId: z.string(),
  runDate: z.coerce.date(),
  bundleSize: z.number().int().positive(),
});

// Staff: create a press run (paper + date + bundle size) - required before
// deliveries can be recorded for that paper/date.
pressRunsRouter.post("/", requireStaffAuth, async (req, res) => {
  const parsed = createPressRunSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const pressRun = await prisma.pressRun.create({ data: parsed.data, include: { paper: true } });
    res.status(201).json(pressRun);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A press run already exists for this paper and date" });
    }
    throw err;
  }
});

// Staff: press order totals for a paper on a given date - Dealer, Vending,
// Service Copies (all from RackDelivery, grouped by dealer type), and Mail
// (print subscribers with deliveryMethod=MAIL). Internet (digital-only
// subscribers) is included separately, excluded from the print subtotal.
pressRunsRouter.get("/:id/press-order", requireStaffAuth, async (req, res) => {
  const pressRun = await prisma.pressRun.findUnique({
    where: { id: req.params.id },
    include: { paper: true },
  });
  if (!pressRun) return res.status(404).json({ error: "Press run not found" });

  const dayStart = new Date(pressRun.runDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(pressRun.runDate);
  dayEnd.setHours(23, 59, 59, 999);

  const deliveries = await prisma.rackDelivery.findMany({
    where: {
      paperId: pressRun.paperId,
      deliveryDate: { gte: dayStart, lte: dayEnd },
    },
    include: { dealer: true },
  });

  let dealerTotal = 0;
  let vendingTotal = 0;
  let serviceTotal = 0;
  for (const d of deliveries) {
    if (d.dealer.dealerType === "DEALER") dealerTotal += d.quantityDelivered;
    else if (d.dealer.dealerType === "VENDING") vendingTotal += d.quantityDelivered;
    else if (d.dealer.dealerType === "SERVICE") serviceTotal += d.quantityDelivered;
  }

  const mailCount = await prisma.subscription.count({
    where: {
      paperId: pressRun.paperId,
      status: "ACTIVE",
      deliveryMethod: "MAIL",
      type: { in: ["PRINT", "PRINT_DIGITAL"] },
    },
  });

  const internetCount = await prisma.subscription.count({
    where: {
      paperId: pressRun.paperId,
      status: "ACTIVE",
      type: "DIGITAL",
    },
  });

  const printSubtotal = dealerTotal + vendingTotal + serviceTotal + mailCount;

  res.json({
    paper: { id: pressRun.paper.id, name: pressRun.paper.name },
    runDate: pressRun.runDate,
    dealer: dealerTotal,
    vending: vendingTotal,
    serviceCopies: serviceTotal,
    mail: mailCount,
    printSubtotal,
    internetSubscribers: internetCount,
  });
});