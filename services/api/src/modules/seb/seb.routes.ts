import { Router } from "express";
import { authenticate } from "../../middleware/auth";

const router = Router();

router.post("/check", authenticate, (req, res) => {
  const header = req.get("x-seb-token") ?? req.get("x-safe-exam-browser");

  if (!header) {
    return res.status(403).json({ ok: false, error: "SEB header missing" });
  }

  return res.json({ ok: true });
});

router.get("/check", authenticate, (req, res) => {
  const requestHash =
    req.get("x-safeexambrowser-requesthash") ??
    req.get("x-safe-exam-browser-requesthash") ??
    req.get("x-safeexambrowser-request-hash");
  const userAgent = req.get("user-agent") ?? "";
  const isSebUserAgent = /SafeExamBrowser/i.test(userAgent);

  if ((!requestHash || requestHash.trim().length < 16) && !isSebUserAgent) {
    return res.status(403).json({ ok: false, error: "SEB request hash missing" });
  }

  return res.json({ ok: true });
});

router.get("/", (_req, res) => {
  res.json({ module: "seb" });
});

export default router;
