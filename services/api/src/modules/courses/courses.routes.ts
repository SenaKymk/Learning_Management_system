import { Router, type Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate, requireRole } from "../../middleware/auth";

declare module "@prisma/client" {
  interface CourseSelect {
    materialKey?: boolean;
  }
  interface CourseCreateInput {
    materialKey?: string | null;
  }
  interface CourseUncheckedCreateInput {
    materialKey?: string | null;
  }
  interface CourseUpdateInput {
    materialKey?: string | null;
  }
  interface CourseUncheckedUpdateInput {
    materialKey?: string | null;
  }
}

const router = Router();

/* =======================
   SCHEMAS
======================= */

const courseSelect: Prisma.CourseSelect = {
  id: true,
  title: true,
  description: true,
  materialKey: true,
  availableFrom: true,
  availableUntil: true,
  prerequisiteId: true,
  createdAt: true
};

const courseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  availableFrom: z.string().datetime().optional().nullable(),
  availableUntil: z.string().datetime().optional().nullable()
});

const moduleSchema = z.object({
  title: z.string().min(1),
  order: z.number().int().nonnegative()
});

const contentSchema = z
  .object({
    title: z.string().min(1),
    type: z.enum(["TEXT", "LINK", "FILE", "PDF", "VIDEO"]),
    text: z.string().min(1).optional(),
    url: z.string().url().optional(),
    objectKey: z.string().min(1).optional()
  })
  .superRefine((data, ctx) => {
    if (data.type === "TEXT" && !data.text) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "text is required for TEXT content",
        path: ["text"]
      });
    }
    if ((data.type === "LINK" || data.type === "VIDEO") && !data.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "url is required for LINK or VIDEO content",
        path: ["url"]
      });
    }
    if ((data.type === "FILE" || data.type === "PDF") && !data.objectKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "objectKey is required for FILE or PDF content",
        path: ["objectKey"]
      });
    }
  });

const materialSchema = z.object({
  materialKey: z.string().min(1).nullable()
});

const enrollmentIdSchema = z.object({
  id: z.string().min(1)
});

const enrollmentStatusSchema = z.enum(["PENDING", "ENROLLED", "REJECTED"]);

const gradeSchema = z.object({
  userId: z.string().min(1),
  score: z.number().min(0).max(100),
  source: z.enum(["MANUAL", "OMR", "EXAM"]).optional()
});

const examResultSchema = z.object({
  userId: z.string().min(1),
  calculatedScore: z.number().min(0).optional(),
  rawData: z.unknown().optional()
});

const questionSchema = z
  .object({
    text: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    answer: z.number().int().nonnegative(),
    source: z.enum(["PDF", "MANUAL"]),
    moduleId: z.string().min(1).optional()
  })
  .superRefine((data, ctx) => {
    if (data.answer >= data.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "answer is out of range",
        path: ["answer"]
      });
    }
  });

const submitExamSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      answer: z.number().int().nonnegative()
    })
  )
});

const randomLimitSchema = z
  .string()
  .optional()
  .transform((value) => (value ? Number(value) : 10))
  .refine((value) => Number.isFinite(value), { message: "limit must be a number" })
  .refine((value) => value >= 1 && value <= 50, { message: "limit must be between 1 and 50" });

function sendValidationError(res: Response, error: z.ZodError) {
  return res.status(400).json({
    ok: false,
    error: "Invalid request",
    details: error.flatten()
  });
}

/* =======================
   COURSES
======================= */

router.post(
  "/courses",
  authenticate,
  requireRole("ADMIN", "INSTRUCTOR"),
  async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const parsed = courseSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    const course = await prisma.course.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        availableFrom: parsed.data.availableFrom
          ? new Date(parsed.data.availableFrom)
          : null,
        availableUntil: parsed.data.availableUntil
          ? new Date(parsed.data.availableUntil)
          : null,
        createdById: req.user.id
      },
      select: courseSelect
    });

    return res.status(201).json(course);
  }
);

router.get("/courses", async (_req, res) => {
  const courses = await prisma.course.findMany({
    select: courseSelect
  });

  return res.json(courses);
});

router.get("/courses/:id", async (req, res) => {
  const course = await prisma.course.findUnique({
    where: { id: req.params.id },
    include: {
      prerequisite: {
        select: {
          id: true,
          title: true
        }
      },
      modules: {
        orderBy: { order: "asc" },
        include: {
          contents: {
            orderBy: { createdAt: "asc" }
          }
        }
      }
    }
  });

  if (!course) {
    return res.status(404).json({ ok: false, error: "Course not found" });
  }

  return res.json(course);
});

/* =======================
   ENROLLMENTS
======================= */

router.get(
  "/courses/:id/enroll",
  authenticate,
  requireRole("STUDENT"),
  async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.id,
          courseId: req.params.id
        }
      },
      select: {
        id: true,
        status: true
      }
    });

    if (!enrollment) {
      return res.json({ status: "NOT_ENROLLED" });
    }

    return res.json({ id: enrollment.id, status: enrollment.status });
  }
);

router.post(
  "/courses/:id/enroll",
  authenticate,
  requireRole("STUDENT"),
  async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      select: { availableFrom: true, availableUntil: true, prerequisiteId: true }
    });

    if (!course) {
      return res.status(404).json({ ok: false, error: "Course not found" });
    }

    const now = new Date();
    if (course.availableFrom && now < course.availableFrom) {
      return res.status(403).json({ ok: false, error: "Course not yet available" });
    }
    if (course.availableUntil && now > course.availableUntil) {
      return res.status(403).json({ ok: false, error: "Course expired" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true }
    });

    if (!user || user.role !== "STUDENT") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    if (course.prerequisiteId) {
      const prereqEnrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: req.user.id,
            courseId: course.prerequisiteId
          }
        },
        select: { status: true }
      });

      if (!prereqEnrollment || prereqEnrollment.status !== "ENROLLED") {
        return res.status(403).json({
          ok: false,
          error: "On kosul ders (MAT101) alinmadan MAT 201'e kayit olunamaz."
        });
      }
    }

    const existing = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.id,
          courseId: req.params.id
        }
      },
      select: {
        id: true,
        status: true
      }
    });

    if (existing) {
      if (existing.status === "REJECTED") {
        const updated = await prisma.enrollment.update({
          where: { id: existing.id },
          data: { status: "PENDING" },
          select: { id: true, status: true }
        });
        return res.status(200).json(updated);
      }
      return res.status(409).json({ ok: false, error: "Already requested" });
    }

    try {
      const enrollment = await prisma.enrollment.create({
        data: {
          userId: req.user.id,
          courseId: req.params.id,
          status: "PENDING"
        },
        select: {
          id: true,
          status: true
        }
      });

      const warning = course.prerequisiteId
        ? "Prerequisite exists for this course. Enrollment is allowed but completion is recommended."
        : null;
      return res.status(201).json({ ...enrollment, warning });
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

router.get(
  "/courses/:id/students",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const statusParam = req.query.status;
    let statusFilter: z.infer<typeof enrollmentStatusSchema> | undefined;

    if (statusParam !== undefined) {
      const parsedStatus = enrollmentStatusSchema.safeParse(statusParam);
      if (!parsedStatus.success) {
        return res.status(400).json({ ok: false, error: "Invalid status" });
      }
      statusFilter = parsedStatus.data;
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        courseId: req.params.id,
        ...(statusFilter ? { status: statusFilter } : {})
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentNumber: true
          }
        }
      }
    });

    const grades = await prisma.grade.findMany({
      where: { courseId: req.params.id },
      select: { userId: true, score: true, source: true }
    });

    const gradeMap = new Map(
      grades.map((grade) => [
        grade.userId,
        { score: grade.score, source: grade.source }
      ])
    );

    const students = enrollments.map((enrollment) => ({
      id: enrollment.id,
      userId: enrollment.user.id,
      firstName: enrollment.user.firstName,
      lastName: enrollment.user.lastName,
      studentNumber: enrollment.user.studentNumber,
      status: enrollment.status,
      score: gradeMap.get(enrollment.user.id)?.score ?? null,
      source: gradeMap.get(enrollment.user.id)?.source ?? null
    }));

    return res.json(students);
  }
);

router.patch(
  "/enrollments/:id/approve",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = enrollmentIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    try {
      const enrollment = await prisma.enrollment.update({
        where: { id: parsed.data.id },
        data: { status: "ENROLLED" },
        select: {
          id: true,
          status: true
        }
      });

      return res.json(enrollment);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return res.status(404).json({ ok: false, error: "Enrollment not found" });
      }
      return res.status(500).json({ ok: false, error: "Internal Server Error" });
    }
  }
);

router.patch(
  "/enrollments/:id/reject",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = enrollmentIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    try {
      const enrollment = await prisma.enrollment.update({
        where: { id: parsed.data.id },
        data: { status: "REJECTED" },
        select: {
          id: true,
          status: true
        }
      });

      return res.json(enrollment);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return res.status(404).json({ ok: false, error: "Enrollment not found" });
      }
      return res.status(500).json({ ok: false, error: "Internal Server Error" });
    }
  }
);

router.post(
  "/courses/:id/grades",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = gradeSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    const { userId, score } = parsed.data;
    const source = parsed.data.source ?? "MANUAL";

    const student = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!student || student.role !== "STUDENT") {
      return res.status(400).json({ ok: false, error: "Invalid student" });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: req.params.id
        }
      },
      select: { status: true }
    });

    if (!enrollment || enrollment.status !== "ENROLLED") {
      return res.status(400).json({ ok: false, error: "Student not enrolled" });
    }

    const grade = await prisma.grade.upsert({
      where: {
        userId_courseId: {
          userId,
          courseId: req.params.id
        }
      },
      update: { score, source },
      create: {
        userId,
        courseId: req.params.id,
        score,
        source
      },
      select: {
        id: true,
        userId: true,
        courseId: true,
        score: true,
        source: true
      }
    });

    return res.json(grade);
  }
);

/* =======================
   EXAM RESULTS
======================= */

router.get(
  "/courses/:id/exam-results",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const results = await prisma.examResult.findMany({
      where: { courseId: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentNumber: true
          }
        }
      }
    });

    const payload = results.map((result) => ({
      id: result.id,
      userId: result.userId,
      courseId: result.courseId,
      calculatedScore: result.calculatedScore,
      user: result.user
    }));

    return res.json(payload);
  }
);

router.get(
  "/courses/:id/exam-results/me",
  authenticate,
  requireRole("STUDENT"),
  async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const result = await prisma.examResult.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.id,
          courseId: req.params.id
        }
      },
      select: {
        id: true,
        calculatedScore: true
      }
    });

    return res.json({
      id: result?.id ?? null,
      calculatedScore: result?.calculatedScore ?? null
    });
  }
);

router.post(
  "/courses/:id/exam-results",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = examResultSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    const { userId, calculatedScore, rawData } = parsed.data;

    const student = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!student || student.role !== "STUDENT") {
      return res.status(400).json({ ok: false, error: "Invalid student" });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: req.params.id
        }
      },
      select: { status: true }
    });

    if (!enrollment || enrollment.status !== "ENROLLED") {
      return res.status(400).json({ ok: false, error: "Student not enrolled" });
    }

    const updateData: Prisma.ExamResultUpdateInput = {};
    if (calculatedScore !== undefined) {
      updateData.calculatedScore = calculatedScore;
    }
    if (rawData !== undefined) {
      updateData.rawData = rawData as Prisma.InputJsonValue;
    }

    const result = await prisma.examResult.upsert({
      where: {
        userId_courseId: {
          userId,
          courseId: req.params.id
        }
      },
      update: updateData,
      create: {
        userId,
        courseId: req.params.id,
        calculatedScore: calculatedScore ?? null,
        rawData: rawData !== undefined ? (rawData as Prisma.InputJsonValue) : null
      },
      select: {
        id: true,
        userId: true,
        courseId: true,
        calculatedScore: true
      }
    });

    return res.status(201).json(result);
  }
);

/* =======================
   COURSE MATERIAL (MinIO)
======================= */

async function setCourseMaterial(req: Parameters<Router["patch"]>[1], res: Response) {
  const parsed = materialSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: {
        materialKey: parsed.data.materialKey
      },
      select: courseSelect
    });

    return res.json(course);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return res.status(404).json({ ok: false, error: "Course not found" });
    }
    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
}

router.patch(
  "/courses/:id/material",
  authenticate,
  requireRole("ADMIN", "INSTRUCTOR"),
  setCourseMaterial
);

/* =======================
   MODULES
======================= */

router.post(
  "/courses/:id/modules",
  authenticate,
  requireRole("ADMIN", "INSTRUCTOR"),
  async (req, res) => {
    const parsed = moduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    try {
      const moduleRecord = await prisma.module.create({
        data: {
          title: parsed.data.title,
          order: parsed.data.order,
          courseId: req.params.id
        }
      });

      return res.status(201).json(moduleRecord);
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

router.get(
  "/courses/:id/modules",
  authenticate,
  async (req, res) => {
    const modules = await prisma.module.findMany({
      where: { courseId: req.params.id },
      orderBy: { order: "asc" },
      include: {
        contents: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    return res.json(modules);
  }
);

router.patch(
  "/modules/reorder",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const reorderSchema = z.object({
      courseId: z.string().min(1),
      modules: z
        .array(
          z.object({
            id: z.string().min(1),
            order: z.number().int().nonnegative()
          })
        )
        .min(1)
    });

    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    const { courseId, modules } = parsed.data;
    const ids = modules.map((item) => item.id);
    const uniqueOrders = new Set(modules.map((item) => item.order));
    if (uniqueOrders.size !== modules.length) {
      return res.status(400).json({ ok: false, error: "Duplicate module order values" });
    }

    const existing = await prisma.module.findMany({
      where: { id: { in: ids } },
      select: { id: true, courseId: true }
    });

    if (existing.length !== modules.length) {
      return res.status(400).json({ ok: false, error: "Invalid module list" });
    }

    const invalidCourse = existing.some((item) => item.courseId !== courseId);
    if (invalidCourse) {
      return res.status(400).json({ ok: false, error: "Modules do not belong to course" });
    }

    await prisma.$transaction(
      modules.map((item) =>
        prisma.module.update({
          where: { id: item.id },
          data: { order: item.order }
        })
      )
    );

    return res.json({ ok: true });
  }
);

router.post(
  "/courses/:id/clone",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const source = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: { contents: true }
        },
        questionBank: true
      }
    });

    if (!source) {
      return res.status(404).json({ ok: false, error: "Course not found" });
    }

    const cloned = await prisma.course.create({
      data: {
        title: `${source.title} Copy`,
        description: source.description,
        materialKey: source.materialKey,
        availableFrom: source.availableFrom,
        availableUntil: source.availableUntil,
        createdById: req.user.id
      }
    });

    const moduleMap = new Map<string, string>();
    for (const module of source.modules) {
      const createdModule = await prisma.module.create({
        data: {
          title: module.title,
          order: module.order,
          courseId: cloned.id,
          contents: {
            create: module.contents.map((content) => ({
              title: content.title,
              type: content.type,
              text: content.text,
              url: content.url,
              objectKey: content.objectKey
            }))
          }
        },
        select: { id: true }
      });
      moduleMap.set(module.id, createdModule.id);
    }

    if (source.questionBank.length > 0) {
      await prisma.questionBank.createMany({
        data: source.questionBank.map((question) => ({
          courseId: cloned.id,
          moduleId: question.moduleId ? moduleMap.get(question.moduleId) ?? null : null,
          text: question.text,
          options: question.options as Prisma.InputJsonValue,
          answer: question.answer,
          source: question.source
        }))
      });
    }

    return res.status(201).json({
      id: cloned.id,
      title: cloned.title
    });
  }
);

/* =======================
   CONTENTS
======================= */

router.post(
  "/modules/:moduleId/contents",
  authenticate,
  requireRole("ADMIN", "INSTRUCTOR"),
  async (req, res) => {
    const parsed = contentSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    try {
      const content = await prisma.content.create({
        data: {
          title: parsed.data.title,
          type: parsed.data.type,
          text: parsed.data.text,
          url: parsed.data.url,
          objectKey: parsed.data.objectKey,
          moduleId: req.params.moduleId
        }
      });

      return res.status(201).json(content);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2003"
      ) {
        return res.status(404).json({ ok: false, error: "Module not found" });
      }
      return res.status(500).json({ ok: false, error: "Internal Server Error" });
    }
  }
);

/* =======================
   QUESTION BANK
======================= */

router.post(
  "/courses/:id/questions",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = questionSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    const moduleId = parsed.data.moduleId ?? null;
    if (moduleId) {
      const module = await prisma.module.findUnique({
        where: { id: moduleId },
        select: { courseId: true }
      });
      if (!module || module.courseId !== req.params.id) {
        return res.status(400).json({ ok: false, error: "Invalid module" });
      }
    }

    try {
      const question = await prisma.questionBank.create({
        data: {
          courseId: req.params.id,
          moduleId,
          text: parsed.data.text,
          options: parsed.data.options,
          answer: parsed.data.answer,
          source: parsed.data.source
        }
      });

      return res.status(201).json(question);
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

router.get(
  "/courses/:id/questions",
  authenticate,
  async (req, res) => {
    const questions = await prisma.questionBank.findMany({
      where: { courseId: req.params.id },
      orderBy: { createdAt: "asc" }
    });

    if (req.user?.role === "ADMIN") {
      return res.json(questions);
    }

    const sanitized = questions.map((question) => ({
      id: question.id,
      courseId: question.courseId,
      moduleId: question.moduleId,
      text: question.text,
      options: question.options,
      source: question.source,
      createdAt: question.createdAt
    }));

    return res.json(sanitized);
  }
);

router.get(
  "/courses/:id/questions/random",
  authenticate,
  async (req, res) => {
    const parsed = randomLimitSchema.safeParse(req.query.limit);
    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    const questions = await prisma.questionBank.findMany({
      where: { courseId: req.params.id }
    });

    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, parsed.data);

    if (req.user?.role === "ADMIN") {
      return res.json(selected);
    }

    const sanitized = selected.map((question) => ({
      id: question.id,
      courseId: question.courseId,
      moduleId: question.moduleId,
      text: question.text,
      options: question.options,
      source: question.source,
      createdAt: question.createdAt
    }));

    return res.json(sanitized);
  }
);

router.post(
  "/courses/:id/exams/submit",
  authenticate,
  requireRole("STUDENT"),
  async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const parsed = submitExamSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    const answers = parsed.data.answers;
    const questionIds = answers.map((item) => item.questionId);

    const questions = await prisma.questionBank.findMany({
      where: { id: { in: questionIds }, courseId: req.params.id }
    });

    if (questions.length !== questionIds.length) {
      return res.status(400).json({ ok: false, error: "Invalid questions" });
    }

    const answerMap = new Map(answers.map((item) => [item.questionId, item.answer]));
    let correct = 0;
    questions.forEach((question) => {
      if (answerMap.get(question.id) === question.answer) {
        correct += 1;
      }
    });

    const score = correct;
    const total = questions.length;
    const percentScore = total > 0 ? Math.round((score / total) * 100) : 0;

    const [result] = await prisma.$transaction([
      prisma.examResult.upsert({
        where: {
          userId_courseId: {
            userId: req.user.id,
            courseId: req.params.id
          }
        },
        update: {
          score,
          calculatedScore: percentScore,
          source: "MCQ",
          rawData: {
            answers
          } as Prisma.InputJsonValue
        },
        create: {
          userId: req.user.id,
          courseId: req.params.id,
          score,
          calculatedScore: percentScore,
          source: "MCQ",
          rawData: {
            answers
          } as Prisma.InputJsonValue
        },
        select: {
          id: true,
          userId: true,
          courseId: true,
          score: true
        }
      }),
      prisma.grade.upsert({
        where: {
          userId_courseId: {
            userId: req.user.id,
            courseId: req.params.id
          }
        },
        update: {
          score: percentScore,
          source: "EXAM"
        },
        create: {
          userId: req.user.id,
          courseId: req.params.id,
          score: percentScore,
          source: "EXAM"
        }
      })
    ]);

    return res.status(201).json({
      id: result.id,
      score,
      total
    });
  }
);

export default router;
