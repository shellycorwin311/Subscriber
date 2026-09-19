import { Router } from "express";
import { prisma } from "../db";
import { requireStaffAuth } from "../middleware/auth";

export const papersRouter = Router();

// Public-ish list (used by the self-serve portal's "choose your paper(s)" step)
papersRouter.get("/", async (_req, res) => {
  const papers = await prisma.paper.findMany({ orderBy: { name: "asc" } });
  res.json(papers);
});

// Staff-only: create a new paper title
papersRouter.post("/", requireStaffAuth, async (req, res) => {
  const { name, slug } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ error: "name and slug are required" });
  }
  const paper = await prisma.paper.create({ data: { name, slug } });
  res.status(201).json(paper);
});
