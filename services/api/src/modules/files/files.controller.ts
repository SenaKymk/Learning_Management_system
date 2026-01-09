import type { Request, Response } from "express";
import { z } from "zod";
import { getPresignedGetUrl, uploadFile } from "./files.service";

const presignParamsSchema = z.object({
  objectKey: z.string().min(1)
});

function sendValidationError(res: Response, error: z.ZodError) {
  res.status(400).json({
    ok: false,
    error: "Invalid request",
    details: error.flatten()
  });
}

export async function handleUpload(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: "File is required" });
  }

  try {
    const result = await uploadFile(req.file);
    return res.status(201).json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: "Upload failed" });
  }
}

export async function handlePresign(req: Request, res: Response) {
  const parsed = presignParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const url = await getPresignedGetUrl(parsed.data.objectKey);
    return res.json({ ok: true, url });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: "Presign failed" });
  }
}
