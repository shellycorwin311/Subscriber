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
