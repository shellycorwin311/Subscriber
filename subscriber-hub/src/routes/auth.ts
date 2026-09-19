import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db";
import { requireStaffAuth, StaffAuthedRequest } from "../middleware/auth";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/login
// Staff members (CS/admin) log in here to get a JWT for the internal tool.
authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  const staff = await prisma.staffUser.findUnique({ where: { email } });
  if (!staff) {
    // Same error for "no such user" and "wrong password" so we don't leak
    // which emails have staff accounts.
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const passwordMatches = await bcrypt.compare(password, staff.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign(
    { id: staff.id, role: staff.role },
    process.env.JWT_SECRET as string,
    { expiresIn: "12h" }
  );

  res.json({
    token,
    staff: { id: staff.id, email: staff.email, role: staff.role },
  });
});

// GET /api/auth/me
// Lets the CS/admin tool confirm the current token is valid and see who's logged in.
authRouter.get("/me", requireStaffAuth, async (req: StaffAuthedRequest, res) => {
  const staff = await prisma.staffUser.findUnique({
    where: { id: req.staff!.id },
    select: { id: true, email: true, role: true, createdAt: true },
  });
  if (!staff) return res.status(404).json({ error: "Staff account not found" });
  res.json(staff);
});

const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "CUSTOMER_SERVICE", "CIRCULATION"]).default("CUSTOMER_SERVICE"),
});

// POST /api/auth/staff
// Creates a new staff account. Restricted to existing ADMINs so CS reps
// can't grant themselves or coworkers accounts.
authRouter.post("/staff", requireStaffAuth, async (req: StaffAuthedRequest, res) => {
  if (req.staff?.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can create staff accounts" });
  }

  const parsed = createStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const existing = await prisma.staffUser.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return res.status(409).json({ error: "A staff account with this email already exists" });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const staff = await prisma.staffUser.create({
    data: { email: parsed.data.email, passwordHash, role: parsed.data.role },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  res.status(201).json(staff);
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// POST /api/auth/change-password
// Lets a logged-in staff member change their own password - this is what
// closes the "bootstrap admin default password" gap: log in with it once,
// then immediately hit this endpoint.
authRouter.post(
  "/change-password",
  requireStaffAuth,
  async (req: StaffAuthedRequest, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const staff = await prisma.staffUser.findUnique({ where: { id: req.staff!.id } });
    if (!staff) return res.status(404).json({ error: "Staff account not found" });

    const currentMatches = await bcrypt.compare(
      parsed.data.currentPassword,
      staff.passwordHash
    );
    if (!currentMatches) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.staffUser.update({
      where: { id: staff.id },
      data: { passwordHash },
    });

    res.json({ success: true });
  }
);
