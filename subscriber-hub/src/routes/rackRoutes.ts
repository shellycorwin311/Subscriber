import { Router } from "express";
import { prisma } from "../db";
import { requireStaffAuth } from "../middleware/auth";

export const rackRoutesRouter = Router();

// Staff: create a rack route for a paper
rackRoutesRouter.post("/", requireStaffAuth, async (req, res) => {
  const { paperId, name } = req.body;
  const route = await prisma.rackRoute.create({ data: { paperId, name } });
  res.status(201).json(route);
});

// Staff: list rack routes for a paper
rackRoutesRouter.get("/", requireStaffAuth, async (req, res) => {
  const paperId = req.query.paperId as string | undefined;
  const routes = await prisma.rackRoute.findMany({
    where: paperId ? { paperId } : undefined,
    include: { stops: { include: { dealer: true }, orderBy: { sequence: "asc" } },  truck: true, },
    orderBy: { name: "asc" },
  });
  res.json(routes);
});

// Staff: assign a dealer to a rack route at a given stop sequence
rackRoutesRouter.post("/:routeId/stops", requireStaffAuth, async (req, res) => {
  const { dealerId, sequence } = req.body;
  const stop = await prisma.rackRouteStop.create({
    data: { rackRouteId: req.params.routeId, dealerId, sequence },
    include: { dealer: true },
  });
  res.status(201).json(stop);
});

// Export a rack route's dealer stops as CSV, sorted by sequence, plus each
// dealer's standing order quantity for that route's paper - what a driver
// needs to know how many copies to drop at each stop.
rackRoutesRouter.get("/:routeId/export", requireStaffAuth, async (req, res) => {
  const route = await prisma.rackRoute.findUnique({
    where: { id: req.params.routeId },
    include: {
      stops: {
        include: { dealer: true },
        orderBy: { sequence: "asc" },
      },
    },
  });
  if (!route) return res.status(404).json({ error: "Rack route not found" });

  const standingOrders = await prisma.dealerStandingOrder.findMany({
    where: { paperId: route.paperId, dealerId: { in: route.stops.map((s) => s.dealerId) } },
  });
  const quantityByDealer = new Map(standingOrders.map((o) => [o.dealerId, o.quantity]));

  const header = "Sequence,Dealer,Address,City,State,Zip,StandingOrderQty\n";
  const rows = route.stops
    .map((stop) => {
      const d = stop.dealer;
      return [
        stop.sequence,
        d.name,
        d.addressLine1 ?? "",
        d.city ?? "",
        d.state ?? "",
        d.zip ?? "",
        quantityByDealer.get(d.id) ?? 0,
      ]
        .map((field) => `"${String(field).replace(/"/g, '""')}"`)
        .join(",");
    })
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="rack-route.csv"`);
  res.send(header + rows);
});

// Staff: assign (or unassign) a truck to a rack route
rackRoutesRouter.patch("/:routeId/truck", requireStaffAuth, async (req, res) => {
  const { truckId } = req.body;
  const route = await prisma.rackRoute.update({
    where: { id: req.params.routeId },
    data: { truckId: truckId || null },
    include: { stops: { include: { dealer: true }, orderBy: { sequence: "asc" } }, truck: true },
  });
  res.json(route);
});
