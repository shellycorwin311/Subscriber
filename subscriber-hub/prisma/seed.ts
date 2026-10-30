import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Bootstrap the first admin account. POST /api/auth/staff requires an
  // existing admin to call it, so the very first one has to be created
  // directly - after that, admins can create further staff accounts
  // through the API.
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com";
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || "change-me-immediately";

  const passwordHash = await bcrypt.hash(bootstrapPassword, 10);
  await prisma.staffUser.upsert({
    where: { email: bootstrapEmail },
    update: {},
    create: { email: bootstrapEmail, passwordHash, role: "ADMIN" },
  });
  console.log(
    `Bootstrap admin ready: ${bootstrapEmail} / ${bootstrapPassword} (change this password immediately after first login - there's no self-service password change endpoint yet)`
  );

  // Replace these with your 3 actual paper names/slugs.
  const papers = await Promise.all([
    prisma.paper.upsert({
      where: { slug: "daily-gazette" },
      update: {},
      create: {
        name: "The Daily Gazette",
        slug: "daily-gazette",
        coverPriceCents: 200, // $2.00 cover price
        wholesalePriceCents: 100, // $1.00 credited per unsold return
      },
    }),
    prisma.paper.upsert({
      where: { slug: "morning-tribune" },
      update: {},
      create: {
        name: "The Morning Tribune",
        slug: "morning-tribune",
        coverPriceCents: 250,
        wholesalePriceCents: 125,
      },
    }),
    prisma.paper.upsert({
      where: { slug: "weekly-courier" },
      update: {},
      create: {
        name: "The Weekly Courier",
        slug: "weekly-courier",
        coverPriceCents: 300,
        wholesalePriceCents: 150,
      },
    }),
  ]);

  const subscriber = await prisma.subscriber.upsert({
    where: { email: "test.subscriber@example.com" },
    update: {},
    create: {
      firstName: "Test",
      lastName: "Subscriber",
      email: "test.subscriber@example.com",
      deliveryAddressLine1: "123 Main St",
      deliveryCity: "Denver",
      deliveryState: "CO",
      deliveryZip: "80202",
    },
  });

  await prisma.subscription.upsert({
    where: { id: "seed-subscription-1" },
    update: {},
    create: {
      id: "seed-subscription-1",
      subscriberId: subscriber.id,
      paperId: papers[0].id,
      type: "PRINT_DIGITAL",
      tier: "monthly",
      status: "ACTIVE",
      startDate: new Date(),
      renewalDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  // Sample dealer account for testing single-copy/rack sales
  const dealer = await prisma.dealer.upsert({
    where: { id: "seed-dealer-1" },
    update: {},
    create: {
      id: "seed-dealer-1",
      name: "Corner Market Newsstand",
      contactName: "Sam Rivera",
      addressLine1: "500 5th Ave",
      city: "Denver",
      state: "CO",
      zip: "80202",
      creditTerms: "Net 30",
    },
  });

  for (const day of ["MON", "WED", "FRI"] as const) {
    await prisma.dealerStandingOrder.upsert({
      where: {
        dealerId_paperId_dayOfWeek: { dealerId: dealer.id, paperId: papers[0].id, dayOfWeek: day },
      },
      update: {},
      create: { dealerId: dealer.id, paperId: papers[0].id, dayOfWeek: day, quantity: 25 },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
