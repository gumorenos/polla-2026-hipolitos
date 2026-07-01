-- AlterTable
ALTER TABLE "match_pool" ADD COLUMN "hiddenAt" DATETIME;
ALTER TABLE "match_pool" ADD COLUMN "hiddenByUserId" TEXT;
ALTER TABLE "match_pool" ADD COLUMN "hideReason" TEXT;

-- CreateIndex
CREATE INDEX "match_pool_hiddenAt_idx" ON "match_pool"("hiddenAt");
