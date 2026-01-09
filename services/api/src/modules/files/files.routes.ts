import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/auth";
import { handleUpload, handlePresign } from "./files.controller";

const router = Router();

// memory storage (MinIO için doğru)
const upload = multer({
  storage: multer.memoryStorage(),
});

router.post(
  "/upload",
  authenticate,
  upload.single("file"),
  handleUpload
);

router.get(
  "/presign/:objectKey",
  authenticate,
  handlePresign
);

export default router;

