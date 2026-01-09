import { Router, type Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate, requireRole } from "../../middleware/auth";

const router = Router();

const examSchema = z.object({
  title: z.string().min(1)
});

const questionSchema = z
  .object({
    text: z.string().min(1),
    choices: z.array(z.string().min(1)).min(2),
    correctIndex: z.number().int().nonnegative(),
    points: z.number().int().positive().optional()
  })
  .superRefine((data, ctx) => {
    if (data.correctIndex >= data.choices.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "correctIndex is out of range",
        path: ["correctIndex"]
      });
    }
  });

const attemptSchema = z.object({
  answers: z.array(z.number().int().nonnegative())
});

function sendValidationError(res: Response, error: z.ZodError) {
  res.status(400).json({
    ok: false,
    error: "Invalid request",
    details: error.flatten()
  });
}

router.post(
  "/courses/:courseId/exams",
  authenticate,
  requireRole("ADMIN", "INSTRUCTOR"),
  async (req, res) => {
    const parsed = examSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    try {
      const exam = await prisma.exam.create({
        data: {
          title: parsed.data.title,
          courseId: req.params.courseId
        }
      });

      return res.status(201).json(exam);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2003"
      ) {
        return res.status(404).json({ ok: false, error: "Course not found" });
      }
      return res.status(500).json({ ok: false, error: "Internal Server Error" });
    }
  }
);

router.post(
  "/exams/:examId/questions",
  authenticate,
  requireRole("ADMIN", "INSTRUCTOR"),
  async (req, res) => {
    const parsed = questionSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    try {
      const question = await prisma.question.create({
        data: {
          examId: req.params.examId,
          text: parsed.data.text,
          choices: parsed.data.choices,
          correctIndex: parsed.data.correctIndex,
          points: parsed.data.points ?? 1
        }
      });

      return res.status(201).json(question);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2003"
      ) {
        return res.status(404).json({ ok: false, error: "Exam not found" });
      }
      return res.status(500).json({ ok: false, error: "Internal Server Error" });
    }
  }
);

router.get("/exams/:examId", async (req, res) => {
  const exam = await prisma.exam.findUnique({
    where: { id: req.params.examId },
    include: {
      questions: {
        select: {
          id: true,
          text: true,
          choices: true,
          points: true
        }
      }
    }
  });

  if (!exam) {
    return res.status(404).json({ ok: false, error: "Exam not found" });
  }

  return res.json(exam);
});

router.post("/exams/:examId/attempts", authenticate, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const parsed = attemptSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  const exam = await prisma.exam.findUnique({
    where: { id: req.params.examId },
    include: {
      questions: {
        select: {
          id: true,
          correctIndex: true,
          points: true
        }
      }
    }
  });

  if (!exam) {
    return res.status(404).json({ ok: false, error: "Exam not found" });
  }

  const answers = parsed.data.answers;
  let score = 0;
  let maxScore = 0;

  exam.questions.forEach((question, index) => {
    maxScore += question.points;
    if (answers[index] === question.correctIndex) {
      score += question.points;
    }
  });

  const attempt = await prisma.attempt.create({
    data: {
      examId: exam.id,
      userId: req.user.id,
      answers,
      score
    }
  });

  return res.status(201).json({
    id: attempt.id,
    score,
    maxScore
  });
});

export default router;
