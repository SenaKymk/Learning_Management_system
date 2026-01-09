import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../../config/prisma";

type AnswerKeyResult = {
  ok: true;
  answers: string[];
  total: number;
  warnings: string[];
  debugImage?: string;
};

type GradeResult = {
  ok: true;
  studentNumber: string;
  answers: string[];
  correct: number;
  total: number;
  score: number;
  userId: string | null;
  warnings: string[];
  debugImage?: string;
};

type OmrInput = {
  courseId: string;
  objectKey: string;
};

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!
  }
});

const storageRoot = path.resolve(process.cwd(), "storage", "omr");
const answerKeyDir = path.join(storageRoot, "answer-keys");
const debugDir = path.join(storageRoot, "debug");

async function ensureStorage() {
  await fs.mkdir(answerKeyDir, { recursive: true });
  await fs.mkdir(debugDir, { recursive: true });
}

async function downloadObject(objectKey: string) {
  const bucket = getEnv("MINIO_BUCKET");
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey
  });
  const response = await s3.send(command);
  const chunks: Buffer[] = [];
  const body = response.Body;
  if (!body || typeof body === "string") {
    throw new Error("Invalid object body");
  }
  for await (const chunk of body as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function writeTempImage(buffer: Buffer) {
  const fileName = `${randomUUID()}.jpg`;
  const filePath = path.join(storageRoot, fileName);
  await fs.mkdir(storageRoot, { recursive: true });
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function runPython(mode: "answer" | "grade", imagePath: string) {
  const python = process.env.OMR_PYTHON ?? "python";
  const layoutPath = path.resolve(process.cwd(), "src", "modules", "omr", "layout.json");
  const scriptPath = path.resolve(process.cwd(), "src", "modules", "omr", "omr.py");

  return new Promise<any>((resolve, reject) => {
    const child = spawn(python, [scriptPath, "--mode", mode, "--image", imagePath, "--layout", layoutPath], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || "OMR process failed"));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function processAnswerKeyFromBuffer(courseId: string, buffer: Buffer): Promise<AnswerKeyResult> {
  await ensureStorage();
  const imagePath = await writeTempImage(buffer);
  const result = await runPython("answer", imagePath);
  const answerKeyPath = path.join(answerKeyDir, `${courseId}.json`);
  await fs.writeFile(answerKeyPath, JSON.stringify(result.answers ?? [], null, 2));

  const debugImage = result.debugImage
    ? path.join(debugDir, path.basename(result.debugImage))
    : undefined;

  return {
    ok: true,
    answers: result.answers ?? [],
    total: result.total ?? 0,
    warnings: result.warnings ?? [],
    debugImage
  };
}

async function processStudentSheetFromBuffer(courseId: string, buffer: Buffer): Promise<GradeResult> {
  await ensureStorage();
  const answerKeyPath = path.join(answerKeyDir, `${courseId}.json`);
  const answerKey = JSON.parse(await fs.readFile(answerKeyPath, "utf8")) as string[];

  const imagePath = await writeTempImage(buffer);
  const result = await runPython("grade", imagePath);

  const studentNumber = result.studentNumber ?? "";
  const answers: string[] = result.answers ?? [];
  const total = answerKey.length || 20;
  let correct = 0;
  answers.slice(0, total).forEach((answer, index) => {
    if (answer && answer === answerKey[index]) {
      correct += 1;
    }
  });
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  let userId: string | null = null;
  if (studentNumber) {
    const user = await prisma.user.findFirst({
      where: { studentNumber }
    });
    if (user) {
      userId = user.id;
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: user.id,
            courseId
          }
        }
      });
      if (!enrollment || enrollment.status !== "ENROLLED") {
        return {
          ok: true,
          studentNumber,
          answers,
          correct,
          total,
          score,
          userId: null,
          warnings: ["Student not enrolled"],
          debugImage: result.debugImage
        };
      }

      await prisma.examResult.upsert({
        where: {
          userId_courseId: {
            userId: user.id,
            courseId
          }
        },
        update: {
          calculatedScore: score,
          rawData: result,
          source: "OMR"
        },
        create: {
          userId: user.id,
          courseId,
          calculatedScore: score,
          rawData: result,
          source: "OMR"
        }
      });
    }
  }

  return {
    ok: true,
    studentNumber,
    answers,
    correct,
    total,
    score,
    userId,
    warnings: result.warnings ?? [],
    debugImage: result.debugImage
  };
}

export async function processAnswerKey(input: OmrInput): Promise<AnswerKeyResult> {
  const buffer = await downloadObject(input.objectKey);
  return processAnswerKeyFromBuffer(input.courseId, buffer);
}

export async function processStudentSheet(input: OmrInput): Promise<GradeResult> {
  const buffer = await downloadObject(input.objectKey);
  return processStudentSheetFromBuffer(input.courseId, buffer);
}

export async function processSampleAnswerKey(courseId: string): Promise<AnswerKeyResult> {
  await ensureStorage();
  const answers = [
    "A", "C", "B", "D", "E",
    "B", "A", "C", "D", "E",
    "C", "B", "A", "D", "E",
    "A", "B", "C", "D", "E"
  ];
  const answerKeyPath = path.join(answerKeyDir, `${courseId}.json`);
  await fs.writeFile(answerKeyPath, JSON.stringify(answers, null, 2));

  return {
    ok: true,
    answers,
    total: answers.length,
    warnings: []
  };
}

export async function processSampleStudentSheet(courseId: string): Promise<GradeResult> {
  await ensureStorage();
  const answerKeyPath = path.join(answerKeyDir, `${courseId}.json`);
  const answerKey = JSON.parse(await fs.readFile(answerKeyPath, "utf8")) as string[];

  const studentNumber = "22290684";
  const answers = [...answerKey];
  const wrongIndices = [2, 6, 9, 14, 18];
  wrongIndices.forEach((index) => {
    const current = answers[index];
    const options = ["A", "B", "C", "D", "E"].filter((opt) => opt !== current);
    answers[index] = options[0];
  });
  const total = answerKey.length || 20;
  let correct = 0;
  answers.slice(0, total).forEach((answer, index) => {
    if (answer && answer === answerKey[index]) {
      correct += 1;
    }
  });
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  let userId: string | null = null;
  const user = await prisma.user.findFirst({
    where: { studentNumber }
  });
  if (user) {
    userId = user.id;
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId
        }
      }
    });
    if (enrollment && enrollment.status === "ENROLLED") {
      await prisma.examResult.upsert({
        where: {
          userId_courseId: {
            userId: user.id,
            courseId
          }
        },
        update: {
          calculatedScore: score,
          rawData: { studentNumber, answers, correct, total },
          source: "OMR"
        },
        create: {
          userId: user.id,
          courseId,
          calculatedScore: score,
          rawData: { studentNumber, answers, correct, total },
          source: "OMR"
        }
      });
    } else {
      userId = null;
    }
  }

  return {
    ok: true,
    studentNumber,
    answers,
    correct,
    total,
    score,
    userId,
    warnings: userId ? [] : ["Student not found or not enrolled"]
  };
}

export async function exportOmrResults(courseId: string) {
  const results = await prisma.examResult.findMany({
    where: {
      courseId,
      source: "OMR"
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

  return results.map((result) => ({
    id: result.id,
    userId: result.userId,
    courseId: result.courseId,
    studentNumber: result.user.studentNumber ?? null,
    name: `${result.user.firstName} ${result.user.lastName}`.trim(),
    calculatedScore: result.calculatedScore ?? null,
    rawData: result.rawData ?? null
  }));
}
