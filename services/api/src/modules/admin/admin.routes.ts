import { Router } from "express";
import { prisma } from "../../config/prisma";
import { authenticate, requireRole } from "../../middleware/auth";

const router = Router();

router.get("/metrics", authenticate, requireRole("ADMIN"), async (_req, res) => {
  const [totalCourses, totalStudents, totalEnrolled, gradeAvg] = await prisma.$transaction([
    prisma.course.count(),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.enrollment.count({ where: { status: "ENROLLED" } }),
    prisma.grade.aggregate({ _avg: { score: true } })
  ]);

  return res.json({
    totalCourses,
    totalStudents,
    totalEnrolledStudents: totalEnrolled,
    averageGrade: gradeAvg._avg.score
  });
});

export default router;
