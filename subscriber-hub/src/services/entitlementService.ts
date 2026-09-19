import { prisma } from "../db";

export interface EntitlementResult {
  entitled: boolean;
  reason: string;
  subscriptionType?: string;
  renewalDate?: Date;
}

/**
 * The single source of truth for "can this subscriber access this paper
 * right now?" Both the WordPress plugin (web paywall) and the Tecnavia
 * SSO connector (e-reader) call this via the /api/entitlements endpoint,
 * so the access rule only lives in one place.
 */
export async function checkEntitlement(
  subscriberEmail: string,
  paperSlug: string
): Promise<EntitlementResult> {
  const paper = await prisma.paper.findUnique({ where: { slug: paperSlug } });
  if (!paper) {
    return { entitled: false, reason: "Unknown paper" };
  }

  const subscriber = await prisma.subscriber.findUnique({
    where: { email: subscriberEmail },
    include: {
      subscriptions: {
        where: { paperId: paper.id },
        orderBy: { renewalDate: "desc" },
        take: 1,
      },
    },
  });

  if (!subscriber || subscriber.subscriptions.length === 0) {
    return { entitled: false, reason: "No subscription found for this paper" };
  }

  const subscription = subscriber.subscriptions[0];

  if (subscription.status === "ACTIVE") {
    return {
      entitled: true,
      reason: "Active subscription",
      subscriptionType: subscription.type,
      renewalDate: subscription.renewalDate,
    };
  }

  if (subscription.status === "LAPSED") {
    // Business decision: give a short grace period after a failed payment
    // before cutting off access. Adjust GRACE_PERIOD_DAYS as needed.
    const GRACE_PERIOD_DAYS = 5;
    const graceDeadline = new Date(subscription.renewalDate);
    graceDeadline.setDate(graceDeadline.getDate() + GRACE_PERIOD_DAYS);

    if (new Date() <= graceDeadline) {
      return {
        entitled: true,
        reason: "Within grace period after payment lapse",
        subscriptionType: subscription.type,
        renewalDate: subscription.renewalDate,
      };
    }
    return { entitled: false, reason: "Subscription lapsed past grace period" };
  }

  return {
    entitled: false,
    reason: `Subscription status is ${subscription.status}`,
  };
}
