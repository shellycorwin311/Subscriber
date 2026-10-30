import { Router } from "express";
import { prisma } from "../db";
import { requireStaffAuth } from "../middleware/auth";

export const reportsRouter = Router();

// Active subscriber count per paper, split by type - the core circulation
// number needed for ad sales and audits.
reportsRouter.get("/circulation", requireStaffAuth, async (_req, res) => {
  const papers = await prisma.paper.findMany();

  const results = await Promise.all(
    papers.map(async (paper) => {
      const [print, digital, printDigital] = await Promise.all([
        prisma.subscription.count({
          where: { paperId: paper.id, status: "ACTIVE", type: "PRINT" },
        }),
        prisma.subscription.count({
          where: { paperId: paper.id, status: "ACTIVE", type: "DIGITAL" },
        }),
        prisma.subscription.count({
          where: { paperId: paper.id, status: "ACTIVE", type: "PRINT_DIGITAL" },
        }),
      ]);
      return {
        paper: paper.name,
        print,
        digital,
        printAndDigital: printDigital,
        total: print + digital + printDigital,
      };
    })
  );

  res.json(results);
});

// Revenue over a date range (for churn/finance reporting)
reportsRouter.get("/revenue", requireStaffAuth, async (req, res) => {
  const from = req.query.from ? new Date(req.query.from as string) : new Date(0);
  const to = req.query.to ? new Date(req.query.to as string) : new Date();

  const payments = await prisma.payment.findMany({
    where: { status: "SUCCEEDED", processedAt: { gte: from, lte: to } },
  });

  const totalCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
  res.json({ from, to, totalRevenue: totalCents / 100, paymentCount: payments.length });
});

// Churn: subscriptions canceled or lapsed in a date range
reportsRouter.get("/churn", requireStaffAuth, async (req, res) => {
  const from = req.query.from ? new Date(req.query.from as string) : new Date(0);
  const to = req.query.to ? new Date(req.query.to as string) : new Date();

  const canceled = await prisma.subscription.count({
    where: { status: "CANCELED", canceledAt: { gte: from, lte: to } },
  });

  res.json({ from, to, canceledCount: canceled });
});

// Single-copy rack sales / sell-through, per paper, over a date range:
// total copies delivered to dealers, sold, returned unsold, and the total
// credit issued for those returns. Only counts reconciled deliveries,
// since sold/returned/credit aren't known until a delivery is reconciled.
reportsRouter.get("/rack-sales", requireStaffAuth, async (req, res) => {
  const from = req.query.from ? new Date(req.query.from as string) : new Date(0);
  const to = req.query.to ? new Date(req.query.to as string) : new Date();

  const papers = await prisma.paper.findMany();

  const results = await Promise.all(
    papers.map(async (paper) => {
      const deliveries = await prisma.rackDelivery.findMany({
        where: {
          paperId: paper.id,
          status: "RECONCILED",
          deliveryDate: { gte: from, lte: to },
        },
      });

      const delivered = deliveries.reduce((sum, d) => sum + d.quantityDelivered, 0);
      const sold = deliveries.reduce((sum, d) => sum + (d.quantitySold ?? 0), 0);
      const returned = deliveries.reduce((sum, d) => sum + (d.quantityReturned ?? 0), 0);
      const creditCents = deliveries.reduce((sum, d) => sum + (d.creditCents ?? 0), 0);
      const sellThroughRate = delivered > 0 ? sold / delivered : 0;

      return {
        paper: paper.name,
        delivered,
        sold,
        returned,
        creditIssued: creditCents / 100,
        sellThroughRate,
      };
    })
  );

  res.json({ from, to, results });
});
