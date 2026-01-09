import { Router, type Response } from "express";
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../config/prisma";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  studentNumber: z.string().min(1)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

function sendValidationError(res: Response, error: z.ZodError) {
  res.status(400).json({
    ok: false,
    error: "Invalid request",
    details: error.flatten()
  });
}

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  const { email, password, firstName, lastName, studentNumber } = parsed.data;
  const normalizedStudentNumber = studentNumber?.trim();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        studentNumber: normalizedStudentNumber ? normalizedStudentNumber : null,
        role: "STUDENT"
      }
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res.status(409).json({ ok: false, error: "Email already exists" });
    }
    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    return res.status(401).json({ ok: false, error: "Invalid credentials" });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ ok: false, error: "Invalid credentials" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ ok: false, error: "JWT secret not configured" });
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, secret);
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      studentNumber: user.studentNumber ?? undefined,
      role: user.role
    }
  });
});

export default router;
