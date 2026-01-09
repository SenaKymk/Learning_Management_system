import { Router } from "express";
import { prisma } from "../../config/prisma";
import { authenticate, requireRole } from "../../middleware/auth";

const router = Router();

router.get("/me", authenticate, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, role: true }
  });

  if (!user) {
    return res.status(404).json({ ok: false, error: "User not found" });
  }

  return res.json(user);
});

router.get("/", authenticate, requireRole("ADMIN"), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, createdAt: true }
  });

  return res.json(users);
});

export default router;
