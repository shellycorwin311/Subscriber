import { Router } from "express";
import { prisma } from "../db";
import { requireStaffAuth } from "../middleware/auth";

export const deliveryRoutesRouter = Router();

// Staff: assign a print subscription to a route
deliveryRoutesRouter.post("/", requireStaffAuth, async (req, res) => {
  const { paperId, subscriptionId, name, sequence } = req.body;
  const route = await prisma.deliveryRoute.create({
    data: { paperId, subscriptionId, name, sequence },
  });
  res.status(201).json(route);
});

// Export a route's stops as CSV, sorted by sequence, for handing to carriers
deliveryRoutesRouter.get("/:paperId/export", requireStaffAuth, async (req, res) => {
  const routes = await prisma.deliveryRoute.findMany({
    where: { paperId: req.params.paperId },
    include: {
      subscription: { include: { subscriber: true } },
    },
    orderBy: [{ name: "asc" }, { sequence: "asc" }],
  });

  const header = "Route,Sequence,Name,Address,City,State,Zip\n";
  const rows = routes
    .map((r) => {
      const s = r.subscription.subscriber;
      return [
        r.name,
        r.sequence,
        `${s.firstName} ${s.lastName}`,
        s.deliveryAddressLine1 ?? "",
        s.deliveryCity ?? "",
        s.deliveryState ?? "",
        s.deliveryZip ?? "",
      ]
        .map((field) => `"${String(field).replace(/"/g, '""')}"`)
        .join(",");
    })
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="routes.csv"`);
  res.send(header + rows);
});
