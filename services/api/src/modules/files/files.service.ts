import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import path from "path";

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
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
});


export async function uploadFile(file: Express.Multer.File) {
  const bucket = getEnv("MINIO_BUCKET");
  const ext = path.extname(file.originalname || "");
  const objectKey = `${randomUUID()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentLength: file.size
    })
  );

  return {
    objectKey,
    bucket,
    mimeType: file.mimetype,
    size: file.size
  };
}

export async function getPresignedGetUrl(objectKey: string) {
  const bucket = getEnv("MINIO_BUCKET");
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey
  });

  return getSignedUrl(s3, command, { expiresIn: 900 });
}
