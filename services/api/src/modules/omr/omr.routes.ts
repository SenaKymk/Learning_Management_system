import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../../middleware/auth";
import {
  exportOmrResults,
  processAnswerKey,
  processSampleAnswerKey,
  processSampleStudentSheet,
  processStudentSheet
} from "./omr.service";

const router = Router();

const answerKeySchema = z.object({
  courseId: z.string().min(1),
  objectKey: z.string().min(1)
});

const gradeSchema = z.object({
  courseId: z.string().min(1),
  objectKey: z.string().min(1)
});

const sampleSchema = z.object({
  courseId: z.string().min(1)
});

router.post("/answer-key", authenticate, requireRole("ADMIN"), async (req, res) => {
  const parsed = answerKeySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid payload" });
  }

  try {
    const result = await processAnswerKey(parsed.data);
    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OMR failed";
    return res.status(500).json({ ok: false, error: message });
  }
});

router.post("/sample/answer-key", authenticate, requireRole("ADMIN"), async (req, res) => {
  const parsed = sampleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid payload" });
  }

  try {
    const result = await processSampleAnswerKey(parsed.data.courseId);
    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OMR failed";
    return res.status(500).json({ ok: false, error: message });
  }
});

router.post("/grade", authenticate, requireRole("ADMIN"), async (req, res) => {
  const parsed = gradeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid payload" });
  }

  try {
    const result = await processStudentSheet(parsed.data);
    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OMR failed";
    return res.status(500).json({ ok: false, error: message });
  }
});

router.post("/sample/grade", authenticate, requireRole("ADMIN"), async (req, res) => {
  const parsed = sampleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid payload" });
  }

  try {
    const result = await processSampleStudentSheet(parsed.data.courseId);
    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OMR failed";
    return res.status(500).json({ ok: false, error: message });
  }
});

router.post("/export", authenticate, requireRole("ADMIN"), async (req, res) => {
  const parsed = sampleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid payload" });
  }

  try {
    const result = await exportOmrResults(parsed.data.courseId);
    return res.json({ ok: true, results: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OMR failed";
    return res.status(500).json({ ok: false, error: message });
  }
});

export default router;
