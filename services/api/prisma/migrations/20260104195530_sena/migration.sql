-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'User'
      AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;
