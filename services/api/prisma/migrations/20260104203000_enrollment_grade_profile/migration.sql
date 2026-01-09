-- Update EnrollmentStatus enum: APPROVED -> ENROLLED
ALTER TYPE "EnrollmentStatus" RENAME TO "EnrollmentStatus_old";
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING', 'ENROLLED', 'REJECTED');
ALTER TABLE "Enrollment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Enrollment" ALTER COLUMN "status" TYPE "EnrollmentStatus" USING (
  CASE
    WHEN "status"::text = 'APPROVED' THEN 'ENROLLED'
    ELSE "status"::text
  END
)::"EnrollmentStatus";
ALTER TABLE "Enrollment" ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "EnrollmentStatus_old";

-- Remove score from Enrollment
ALTER TABLE "Enrollment" DROP COLUMN IF EXISTS "score";

-- Add updatedAt to User
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create Grade table
CREATE TABLE "Grade" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "score" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Grade_userId_courseId_key" ON "Grade"("userId", "courseId");
CREATE INDEX "Grade_courseId_idx" ON "Grade"("courseId");
CREATE INDEX "Grade_userId_idx" ON "Grade"("userId");

ALTER TABLE "Grade" ADD CONSTRAINT "Grade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
