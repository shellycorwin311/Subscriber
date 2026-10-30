import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireStaffAuth } from "../middleware/auth";

export const trucksRouter = Router();

// Staff: list all trucks
trucksRouter.get("/", requireStaffAuth, async (req, res) => {
  const trucks = await prisma.truck.findMany({ orderBy: { truckNumber: "asc" } });
  res.json(trucks);
});

// Staff: get one truck's detail, including pay periods
trucksRouter.get("/:id", requireStaffAuth, async (req, res) => {
  const truck = await prisma.truck.findUnique({
    where: { id: req.params.id },
    include: { payPeriods: { orderBy: { periodStart: "desc" } } },
  });
  if (!truck) return res.status(404).json({ error: "Not found" });
  res.json(truck);
});

const createTruckSchema = z.object({
  truckNumber: z.string().min(1),
  driverName: z.string().optional(),
  phone: z.string().optional(),
  driverType: z.enum(["EMPLOYEE", "CONTRACTOR"]).default("EMPLOYEE"),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  payPerDropCents: z.number().int().nonnegative().optional(),
});

// Staff: add a truck/driver
trucksRouter.post("/", requireStaffAuth, async (req, res) => {
  const parsed = createTruckSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const truck = await prisma.truck.create({ data: parsed.data });
  res.status(201).json(truck);
});

// Staff: edit a truck/driver
trucksRouter.patch("/:id", requireStaffAuth, async (req, res) => {
  const truck = await prisma.truck.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(truck);
});

const generatePayPeriodSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  fuelMileageCents: z.number().int().nonnegative().default(0),
  postOfficeDropsCents: z.number().int().nonnegative().default(0),
  advertisingDeliveryCents: z.number().int().nonnegative().default(0),
});

// Staff: generate a bi-weekly pay period for a truck - counts rack
// deliveries to dealers on this truck's routes within the date range,
// at $1.50/drop, plus manually entered fuel/post office/advertising amounts.
trucksRouter.post("/:id/pay-periods", requireStaffAuth, async (req, res) => {
  const parsed = generatePayPeriodSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const truck = await prisma.truck.findUnique({
    where: { id: req.params.id },
    include: { rackRoutes: { include: { stops: true } } },
  });
  if (!truck) return res.status(404).json({ error: "Truck not found" });

  const dealerIds = truck.rackRoutes.flatMap((route) => route.stops.map((s) => s.dealerId));

  const { periodStart, periodEnd, fuelMileageCents, postOfficeDropsCents, advertisingDeliveryCents } =
    parsed.data;

  const dropCount = await prisma.rackDelivery.count({
    where: {
      dealerId: { in: dealerIds },
      deliveryDate: { gte: periodStart, lte: periodEnd },
    },
  });

  const PAY_PER_DROP_CENTS = 150; // $1.50 per drop, contractor rate
  const dropPayCents = dropCount * PAY_PER_DROP_CENTS;
  const totalCents = dropPayCents + fuelMileageCents + postOfficeDropsCents + advertisingDeliveryCents;

  const payPeriod = await prisma.driverPayPeriod.create({
    data: {
      truckId: truck.id,
      periodStart,
      periodEnd,
      dropCount,
      dropPayCents,
      fuelMileageCents,
      postOfficeDropsCents,
      advertisingDeliveryCents,
      totalCents,
    },
  });

  res.status(201).json(payPeriod);
});

const updatePayPeriodStatusSchema = z.object({
  status: z.enum(["OPEN", "INVOICED", "PAID"]),
});

// Staff: update a pay period's status (mark invoiced / paid)
trucksRouter.patch("/pay-periods/:payPeriodId", requireStaffAuth, async (req, res) => {
  const parsed = updatePayPeriodStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const payPeriod = await prisma.driverPayPeriod.update({
    where: { id: req.params.payPeriodId },
    data: { status: parsed.data.status },
  });
  res.json(payPeriod);
});