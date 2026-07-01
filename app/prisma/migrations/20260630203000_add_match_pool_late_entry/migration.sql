ALTER TABLE "league" ADD COLUMN "matchPoolLateEntryEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "league" ADD COLUMN "matchPoolLateEntryMinutes" INTEGER NOT NULL DEFAULT 45;
