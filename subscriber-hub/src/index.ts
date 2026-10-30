import "dotenv/config";
import express from "express";
import cors from "cors";

import { authRouter } from "./routes/auth";
import { papersRouter } from "./routes/papers";
import { subscribersRouter } from "./routes/subscribers";
import { subscriptionsRouter } from "./routes/subscriptions";
import { entitlementsRouter } from "./routes/entitlements";
import { paymentsRouter } from "./routes/payments";
import { deliveryRoutesRouter } from "./routes/deliveryRoutes";
import { dealersRouter } from "./routes/dealers";
import { trucksRouter } from "./routes/trucks";
import { rackRoutesRouter } from "./routes/rackRoutes";
import { pressRunsRouter } from "./routes/pressRuns";
import { statementsRouter } from "./routes/statements";
import { reportsRouter } from "./routes/reports";
import { ratesRouter } from "./routes/rates";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/papers", papersRouter);
app.use("/api/subscribers", subscribersRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/entitlements", entitlementsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/delivery-routes", deliveryRoutesRouter);
app.use("/api/dealers", dealersRouter);
app.use("/api/trucks", trucksRouter);
app.use("/api/rack-routes", rackRoutesRouter);
app.use("/api/press-runs", pressRunsRouter);
app.use("/api/statements", statementsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/rates", ratesRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Subscriber Hub API listening on port ${port}`);
});