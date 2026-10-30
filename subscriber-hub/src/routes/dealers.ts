import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireStaffAuth } from "../middleware/auth";

export const dealersRouter = Router();

const createDealerSchema = z.object({
  dealerNumber: z.string().optional(),
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  creditTerms: z.string().optional(),
  dealerType: z.enum(["DEALER", "RACK", "VENDING"]).default("DEALER"),
});
// Staff: create a dealer/vendor account
dealersRouter.post("/", requireStaffAuth, async (req, res) => {
  const parsed = createDealerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const dealer = await prisma.dealer.create({ data: parsed.data });
  res.status(201).json(dealer);
});

// Staff: search dealers by name, dealer number, or zip
dealersRouter.get("/", requireStaffAuth, async (req, res) => {
  const q = (req.query.q as string) || "";
  const dealers = await prisma.dealer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { dealerNumber: { contains: q, mode: "insensitive" } },
            { zip: { contains: q } },
          ],
        }
      : undefined,
    include: { standingOrders: { include: { paper: true } } },
    orderBy: { name: "asc" },
  });
  res.json(dealers);
});

// Staff: dealer detail, including standing orders and recent deliveries
dealersRouter.get("/:id", requireStaffAuth, async (req, res) => {
  const dealer = await prisma.dealer.findUnique({
    where: { id: req.params.id },
    include: {
      standingOrders: { include: { paper: true } },
      deliveries: {
        include: { paper: true },
        orderBy: { deliveryDate: "desc" },
        take: 25,
      },
      pricing: { include: { paper: true } },
      payments: { orderBy: { paymentDate: "desc" } },
    },
  });

  // Staff: find a dealer's delivery for a specific paper/date - used by the
// returns entry screen, so staff can look up by dealer number and date
// rather than needing the delivery's internal ID.
dealersRouter.get("/:id/deliveries/by-date", requireStaffAuth, async (req, res) => {
  const paperId = req.query.paperId as string;
  const dateStr = req.query.date as string;
  if (!paperId || !dateStr) {
    return res.status(400).json({ error: "paperId and date are required" });
  }

  const dayStart = new Date(dateStr);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dateStr);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const delivery = await prisma.rackDelivery.findFirst({
    where: {
      dealerId: req.params.id,
      paperId,
      deliveryDate: { gte: dayStart, lte: dayEnd },
    },
    include: { paper: true },
  });

  if (!delivery) return res.status(404).json({ error: "No delivery found for this dealer/paper/date" });
  res.json(delivery);
});
  if (!dealer) return res.status(404).json({ error: "Not found" });
  res.json(dealer);
});

// Staff: edit a dealer account
dealersRouter.patch("/:id", requireStaffAuth, async (req, res) => {
  const dealer = await prisma.dealer.update({
    where: { id: req.params.id },
    data: req.body,
    include: { standingOrders: { include: { paper: true } } },
  });
  res.json(dealer);
});

const standingOrderSchema = z.object({
  paperId: z.string(),
  dayOfWeek: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]),
  quantity: z.number().int().positive(),
});

// Staff: set (create or update) a dealer's standing order for a paper on a
// specific issue day - e.g. Daily Gazette on Monday, 15 copies.
dealersRouter.put("/:id/standing-orders", requireStaffAuth, async (req, res) => {
  const parsed = standingOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const order = await prisma.dealerStandingOrder.upsert({
    where: {
      dealerId_paperId_dayOfWeek: {
        dealerId: req.params.id,
        paperId: parsed.data.paperId,
        dayOfWeek: parsed.data.dayOfWeek,
      },
    },
    update: { quantity: parsed.data.quantity, active: true },
    create: {
      dealerId: req.params.id,
      paperId: parsed.data.paperId,
      dayOfWeek: parsed.data.dayOfWeek,
      quantity: parsed.data.quantity,
    },
    include: { paper: true },
  });
  res.json(order);
});

// Staff: remove a standing order day entirely (dealer no longer gets that
// paper on that day)
dealersRouter.delete("/standing-orders/:standingOrderId", requireStaffAuth, async (req, res) => {
  await prisma.dealerStandingOrder.delete({ where: { id: req.params.standingOrderId } });
  res.status(204).send();
});

const createDeliverySchema = z.object({
  paperId: z.string(),
  deliveryDate: z.coerce.date(),
  quantityDelivered: z.number().int().nonnegative(),
});

// Staff: record a rack delivery (copies dropped at a dealer). Requires a
// press run to already exist for this paper/date - copies can't be
// delivered on a day nothing was printed for. Looks up this dealer's
// negotiated price (falling back to the standard rack rate) for the
// paper/day and snapshots it onto the delivery for later reconciliation.
dealersRouter.post("/:id/deliveries", requireStaffAuth, async (req, res) => {
  const parsed = createDeliverySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const pressRun = await prisma.pressRun.findUnique({
    where: {
      paperId_runDate: {
        paperId: parsed.data.paperId,
        runDate: parsed.data.deliveryDate,
      },
    },
  });
  if (!pressRun) {
    return res.status(400).json({
      error: "No press run exists for this paper on this date. Create a press run first.",
    });
  }

  const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
  const dayOfWeek = DAY_NAMES[parsed.data.deliveryDate.getDay()];

  const dealerPrice = await prisma.dealerPricing.findFirst({
    where: { dealerId: req.params.id, paperId: parsed.data.paperId, dayOfWeek },
  });
  const rackPrice = dealerPrice
    ? null
    : await prisma.dealerPricing.findFirst({
        where: { dealerId: null, paperId: parsed.data.paperId, dayOfWeek },
      });
  const priceCentsApplied = dealerPrice?.priceCents ?? rackPrice?.priceCents ?? null;

  const delivery = await prisma.rackDelivery.create({
    data: {
      dealerId: req.params.id,
      paperId: parsed.data.paperId,
      deliveryDate: parsed.data.deliveryDate,
      quantityDelivered: parsed.data.quantityDelivered,
      priceCentsApplied,
    },
    include: { paper: true },
  });
  res.status(201).json(delivery);
});

const reconcileSchema = z.object({
  quantitySold: z.number().int().nonnegative(),
  quantityReturned: z.number().int().nonnegative(),
});

// Staff: reconcile a delivery - dealer reports sold vs. returned, credit is
// computed from the price that was actually applied at delivery time
// (this dealer's negotiated rate, or the standard rack rate).
dealersRouter.post("/deliveries/:deliveryId/reconcile", requireStaffAuth, async (req, res) => {
  const parsed = reconcileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const delivery = await prisma.rackDelivery.findUnique({
    where: { id: req.params.deliveryId },
    include: { paper: true },
  });
  if (!delivery) return res.status(404).json({ error: "Delivery not found" });

  const { quantitySold, quantityReturned } = parsed.data;
  if (quantitySold + quantityReturned > delivery.quantityDelivered) {
    return res.status(400).json({
      error: "Sold + returned can't exceed the quantity delivered",
    });
  }

  const priceCents = delivery.priceCentsApplied ?? delivery.paper.wholesalePriceCents ?? 0;
  const creditCents = quantityReturned * priceCents;

  const updated = await prisma.rackDelivery.update({
    where: { id: delivery.id },
    data: {
      quantitySold,
      quantityReturned,
      creditCents,
      status: "RECONCILED",
      reconciledAt: new Date(),
    },
    include: { paper: true, dealer: true },
  });

  res.json(updated);
});


const setPricingSchema = z.object({
  paperId: z.string(),
  dayOfWeek: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]),
  priceCents: z.number().int().nonnegative(),
});

// Staff: set (create or update) a dealer's negotiated wholesale price for a
// paper on a specific issue day.
dealersRouter.put("/:id/pricing", requireStaffAuth, async (req, res) => {
  const parsed = setPricingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const existing = await prisma.dealerPricing.findFirst({
    where: {
      dealerId: req.params.id,
      paperId: parsed.data.paperId,
      dayOfWeek: parsed.data.dayOfWeek,
    },
  });

  const pricing = existing
    ? await prisma.dealerPricing.update({
        where: { id: existing.id },
        data: { priceCents: parsed.data.priceCents },
        include: { paper: true },
      })
    : await prisma.dealerPricing.create({
        data: {
          dealerId: req.params.id,
          paperId: parsed.data.paperId,
          dayOfWeek: parsed.data.dayOfWeek,
          priceCents: parsed.data.priceCents,
        },
        include: { paper: true },
      });

  res.json(pricing);
});

// Staff: remove a dealer's negotiated price for a paper/day (falls back to
// standard rack pricing if one exists)
dealersRouter.delete("/pricing/:pricingId", requireStaffAuth, async (req, res) => {
  await prisma.dealerPricing.delete({ where: { id: req.params.pricingId } });
  res.status(204).send();
});

const recordPaymentSchema = z.object({
  paymentDate: z.coerce.date(),
  amountCents: z.number().int().positive(),
  referenceNumber: z.string().optional(),
  paymentMethod: z.enum(["CHECK", "CARD", "ACH"]).default("CHECK"),
});

// Staff: record a payment received from a dealer (check, cash, etc.)
dealersRouter.post("/:id/payments", requireStaffAuth, async (req, res) => {
  const parsed = recordPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const payment = await prisma.dealerPayment.create({
    data: {
      dealerId: req.params.id,
      paymentDate: parsed.data.paymentDate,
      amountCents: parsed.data.amountCents,
      referenceNumber: parsed.data.referenceNumber,
      paymentMethod: parsed.data.paymentMethod,
    },
  });
  res.status(201).json(payment);
});