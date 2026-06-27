CREATE TABLE "provider_credential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "encryptedApiKey" TEXT,
    "maskedApiKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastStatus" TEXT,
    "lastCheckedAt" DATETIME,
    "lastError" TEXT,
    "lastRequestsRemaining" INTEGER,
    "lastRequestsUsed" INTEGER,
    "lastRequestCost" INTEGER,
    "lastResetAt" DATETIME,
    "lastResetInSeconds" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "updatedByUserId" TEXT
);

CREATE UNIQUE INDEX "provider_credential_provider_key" ON "provider_credential"("provider");
