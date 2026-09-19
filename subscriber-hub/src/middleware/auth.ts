import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface StaffAuthedRequest extends Request {
  staff?: { id: string; role: string };
}

/**
 * Protects internal CS/admin routes. Staff members log in and receive a JWT;
 * this middleware verifies it and attaches the staff identity to the request.
 */
export function requireStaffAuth(
  req: StaffAuthedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing staff authorization token" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
      role: string;
    };
    req.staff = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired staff token" });
  }
}

/**
 * Protects service-to-service endpoints (the entitlement check that the
 * WordPress plugin and Tecnavia SSO connector call). These aren't logged-in
 * humans, so we use a shared API key instead of a JWT.
 */
export function requireServiceApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const key = req.headers["x-api-key"];
  if (!key || key !== process.env.ENTITLEMENT_API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }
  next();
}
