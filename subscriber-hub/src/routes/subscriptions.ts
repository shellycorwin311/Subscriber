import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";

export const subscriptionsRouter = Router();

const createSubscriptionSchema = z.object({
  subscriberId: z.string(),
  paperId: z.string(),
  type: z.enum(["PRINT", "DIGITAL", "PRINT_DIGITAL"]),
  tier: z.string(),
  startDate: z.coerce.date(),
  renewalDate: z.coerce.date(),
});

// Create a new subscription for a subscriber (sign-up flow step 2, after
// the Authorize.net payment profile has been created/charged).
subscriptionsRouter.post("/", async (req, res) => {
  const parsed = createSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const subscription = await prisma.subscription.create({
    data: { ...parsed.data, status: "PENDING" },
  });
  res.status(201).json(subscription);
});

// Pause delivery (vacation hold) - self-serve or CS-initiated
subscriptionsRouter.post("/:id/pause", async (req, res) => {
  const subscription = await prisma.subscription.update({
    where: { id: req.params.id },
    data: { status: "PAUSED", pausedAt: new Date() },
  });
  res.json(subscription);
});

// Resume a paused subscription
subscriptionsRouter.post("/:id/resume", async (req, res) => {
  const subscription = await prisma.subscription.update({
    where: { id: req.params.id },
    data: { status: "ACTIVE", pausedAt: null },
  });
  res.json(subscription);
});

// Cancel outright
subscriptionsRouter.post("/:id/cancel", async (req, res) => {
  const subscription = await prisma.subscription.update({
    where: { id: req.params.id },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
  res.json(subscription);
});

// Mark a subscription active - called once Authorize.net confirms the
// first successful charge (from the payments webhook handler).
subscriptionsRouter.post("/:id/activate", async (req, res) => {
  const subscription = await prisma.subscription.update({
    where: { id: req.params.id },
    data: { status: "ACTIVE" },
  });
  res.json(subscription);
});
