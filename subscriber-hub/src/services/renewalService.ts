import { prisma } from "../db";

/**
 * Finds subscriptions renewing within the given window so a reminder email/
 * text can be sent. Intended to be called from a daily scheduled job
 * (cron, a hosted scheduler, etc.) - wiring up the actual job runner and
 * email/SMS provider is a follow-up step once the hub itself is running.
 */
export async function findUpcomingRenewals(daysAhead = 7) {
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + daysAhead);

  return prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      renewalDate: { lte: windowEnd, gte: new Date() },
    },
    include: { subscriber: true, paper: true },
  });
}

/**
 * Finds active subscriptions whose renewal date has passed without a
 * successful payment recorded, and flips them to LAPSED. This is what the
 * daily job runs after the Authorize.net billing attempt for a subscription
 * has failed (or hasn't been confirmed).
 */
export async function markOverdueSubscriptionsLapsed() {
  const now = new Date();

  const overdue = await prisma.subscription.findMany({
    where: { status: "ACTIVE", renewalDate: { lt: now } },
  });

  const updated = await prisma.$transaction(
    overdue.map((sub) =>
      prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "LAPSED" },
      })
    )
  );

  return updated;
}
