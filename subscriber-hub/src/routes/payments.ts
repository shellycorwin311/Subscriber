import { Router } from "express";
import { prisma } from "../db";
import { requireStaffAuth } from "../middleware/auth";

export const paymentsRouter = Router();

/**
 * Authorize.net webhook receiver.
 *
 * Authorize.net's webhook service posts events like
 * net.authorize.payment.authcapture.created and
 * net.authorize.customer.subscription.suspended here.
 *
 * TODO before going live:
 *  - verify the X-ANET-Signature header (HMAC-SHA512 using your signature
 *    key) before trusting the payload
 *  - map Authorize.net's event payload fields to the fields used below
 *    (this is a structural placeholder, not the real payload shape)
 */
paymentsRouter.post("/webhook/authorize-net", async (req, res) => {
  const event = req.body;

  // Placeholder dispatch - fill in once you're in the Authorize.net sandbox
  // and can see real payload shapes.
  switch (event?.eventType) {
    case "net.authorize.payment.authcapture.created": {
      await prisma.payment.create({
        data: {
          subscriberId: event.subscriberId,
          subscriptionId: event.subscriptionId ?? null,
          amountCents: Math.round(Number(event.amount) * 100),
          status: "SUCCEEDED",
          authorizeNetTransactionId: event.transactionId,
          processedAt: new Date(),
        },
      });
      break;
    }
    case "net.authorize.payment.authcapture.declined": {
      await prisma.payment.create({
        data: {
          subscriberId: event.subscriberId,
          subscriptionId: event.subscriptionId ?? null,
          amountCents: Math.round(Number(event.amount) * 100),
          status: "FAILED",
          authorizeNetTransactionId: event.transactionId,
          processedAt: new Date(),
        },
      });
      break;
    }
    default:
      // Log and ignore event types we don't act on yet.
      console.log("Unhandled Authorize.net event:", event?.eventType);
  }

  res.status(200).send("OK");
});

// Billing history for the self-serve portal (and, for now, the CS tool).
// TODO: once the self-serve portal has real subscriber login, this should
// also accept subscriber-level auth scoped to their own id - right now
// it's locked to staff only to avoid exposing billing history to anyone
// who guesses a subscriber id.
paymentsRouter.get("/subscriber/:subscriberId", requireStaffAuth, async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { subscriberId: req.params.subscriberId },
    orderBy: { createdAt: "desc" },
  });
  res.json(payments);
});
