import { Router } from "express";
import { requireServiceApiKey } from "../middleware/auth";
import { checkEntitlement } from "../services/entitlementService";

export const entitlementsRouter = Router();

// GET /api/entitlements?email=jane@example.com&paper=daily-gazette
//
// This is the one endpoint the WordPress paywall plugin and the Tecnavia
// SSO connector both call. Neither needs to know anything about
// subscription tiers, grace periods, or billing status - just this
// yes/no answer.
entitlementsRouter.get("/", requireServiceApiKey, async (req, res) => {
  const email = req.query.email as string;
  const paper = req.query.paper as string;

  if (!email || !paper) {
    return res.status(400).json({ error: "email and paper query params are required" });
  }

  const result = await checkEntitlement(email, paper);
  res.json(result);
});
