import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireStaffAuth } from "../middleware/auth";

export const subscribersRouter = Router();

const createSubscriberSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  billingAddressLine1: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingZip: z.string().optional(),
  deliveryAddressLine1: z.string().optional(),
  deliveryCity: z.string().optional(),
  deliveryState: z.string().optional(),
  deliveryZip: z.string().optional(),
});

// Create a subscriber (self-serve signup or CS-created account)
subscribersRouter.post("/", async (req, res) => {
  const parsed = createSubscriberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const existing = await prisma.subscriber.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) {
    return res.status(409).json({ error: "A subscriber with this email already exists" });
  }

  const subscriber = await prisma.subscriber.create({ data: parsed.data });
  res.status(201).json(subscriber);
});

// A subscriber viewing/managing their own account (self-serve portal)
subscribersRouter.get("/me/:id", async (req, res) => {
  const subscriber = await prisma.subscriber.findUnique({
    where: { id: req.params.id },
    include: { subscriptions: { include: { paper: true } } },
  });
  if (!subscriber) return res.status(404).json({ error: "Not found" });
  res.json(subscriber);
});

// Staff: look up a subscriber by id (used by the CS/admin dashboard's
// detail page). Deliberately separate from /me/:id above, which is
// unauthenticated and meant only for the self-serve portal.
subscribersRouter.get("/:id", requireStaffAuth, async (req, res) => {
  const subscriber = await prisma.subscriber.findUnique({
    where: { id: req.params.id },
    include: { subscriptions: { include: { paper: true } } },
  });
  if (!subscriber) return res.status(404).json({ error: "Not found" });
  res.json(subscriber);
});

// Staff search - the core lookup tool for Customer Service.
// Matches on name, email, or phone.
subscribersRouter.get("/", requireStaffAuth, async (req, res) => {
  const q = (req.query.q as string) || "";
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 25);

  const subscribers = await prisma.subscriber.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : undefined,
    include: { subscriptions: { include: { paper: true } } },
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { lastName: "asc" },
  });

  res.json(subscribers);
});

// Staff: adjust a subscriber's account (address, contact info)
subscribersRouter.patch("/:id", requireStaffAuth, async (req, res) => {
  const subscriber = await prisma.subscriber.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(subscriber);
});
