-- AlterTable
ALTER TABLE "AttemptItem" ADD COLUMN     "answer_order" JSONB,
ADD COLUMN     "correct_index" INTEGER,
ADD COLUMN     "selected_index" INTEGER;
