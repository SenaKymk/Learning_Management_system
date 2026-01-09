import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();

const profileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  studentNumber: z.string().min(1).optional()
});

function sendValidationError(res: Response, error: z.ZodError) {
  return res.status(400).json({
    ok: false,
    error: "Invalid request",
    details: error.flatten()
  });
}

router.get("/me", authenticate, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      studentNumber: true,
      role: true
    }
  });

  if (!user) {
    return res.status(404).json({ ok: false, error: "User not found" });
  }

  return res.json(user);
});

router.patch("/me", authenticate, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  const { firstName, lastName, studentNumber } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { role: true }
  });

  if (!user) {
    return res.status(404).json({ ok: false, error: "User not found" });
  }

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      firstName,
      lastName,
      studentNumber: user.role === "STUDENT" ? studentNumber : null
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      studentNumber: true,
      role: true
    }
  });

  return res.json(updated);
});

router.get("/my-grades", authenticate, requireRole("STUDENT"), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const grades = await prisma.grade.findMany({
    where: { userId: req.user.id },
    include: {
      course: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  const result = grades.map((grade) => ({
    id: grade.id,
    courseId: grade.course.id,
    courseTitle: grade.course.title,
    score: grade.score,
    source: grade.source
  }));

  return res.json(result);
});

export default router;
