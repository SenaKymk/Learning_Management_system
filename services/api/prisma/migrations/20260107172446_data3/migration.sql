-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "prerequisiteId" TEXT;

-- CreateIndex
CREATE INDEX "Course_prerequisiteId_idx" ON "Course"("prerequisiteId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
