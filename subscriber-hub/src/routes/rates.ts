import { Router } from "express";
import { prisma } from "../db";
import { requireStaffAuth } from "../middleware/auth";

export const ratesRouter = Router();

// Staff: list rates. Optional ?paperId=...  &includeInactive=true
ratesRouter.get("/", requireStaffAuth, async (req, res) => {
  const paperId = typeof req.query.paperId === "string" ? req.query.paperId : undefined;
  const includeInactive = req.query.includeInactive === "true";
  const rates = await prisma.rate.findMany({
    where: {
      ...(paperId ? { paperId } : {}),
      ...(includeInactive ? {} : { active: true }),
    },
    include: { paper: true },
    orderBy: [{ product: "asc" }, { deliveryMethod: "asc" }, { lengthCount: "asc" }, { description: "asc" }, { step: "asc" }],
  });
  res.json(rates);
});

// Staff: edit a rate
ratesRouter.patch("/:id", requireStaffAuth, async (req, res) => {
  const b = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (typeof b.description === "string" && b.description.trim()) data.description = b.description.trim();
  if (typeof b.onlineDescription === "string") data.onlineDescription = b.onlineDescription.trim() || null;
  for (const k of ["priceCents", "fullRateCents"]) {
    if (b[k] !== undefined) {
      const n = Number(b[k]);
      if (!Number.isInteger(n) || n < 0) return res.status(400).json({ error: `${k} must be a whole number of cents, 0 or more` });
      data[k] = n;
    }
  }
  for (const k of ["active", "isOldRate", "showOnline", "easyPay", "isGift"]) {
    if (typeof b[k] === "boolean") data[k] = b[k];
  }
  try {
    const rate = await prisma.rate.update({ where: { id: req.params.id }, data, include: { paper: true } });
    res.json(rate);
  } catch {
    res.status(404).json({ error: "Rate not found" });
  }
});