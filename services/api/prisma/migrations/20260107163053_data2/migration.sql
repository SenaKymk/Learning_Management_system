-- CreateEnum
CREATE TYPE "ExamResultSource" AS ENUM ('OMR', 'MCQ');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('PDF', 'MANUAL');

-- AlterTable
ALTER TABLE "ExamResult" ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "source" "ExamResultSource";

-- CreateTable
CREATE TABLE "QuestionBank" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "moduleId" TEXT,
    "text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "answer" INTEGER NOT NULL,
    "source" "QuestionSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionBank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionBank_courseId_idx" ON "QuestionBank"("courseId");

-- CreateIndex
CREATE INDEX "QuestionBank_moduleId_idx" ON "QuestionBank"("moduleId");

-- AddForeignKey
ALTER TABLE "QuestionBank" ADD CONSTRAINT "QuestionBank_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBank" ADD CONSTRAINT "QuestionBank_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;
