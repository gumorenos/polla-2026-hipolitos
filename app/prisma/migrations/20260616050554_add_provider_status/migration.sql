-- CreateTable
CREATE TABLE "provider_status" (
    "provider" TEXT NOT NULL PRIMARY KEY,
    "cooldownUntil" DATETIME NOT NULL,
    "lastStatus" INTEGER,
    "lastErrorMessage" TEXT,
    "updatedAt" DATETIME NOT NULL
);
