CREATE TABLE "team_alias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamCode" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "confidence" REAL,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdByUserId" TEXT,
    CONSTRAINT "team_alias_teamCode_fkey" FOREIGN KEY ("teamCode") REFERENCES "team" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "provider_team_outcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "marketType" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "samplePayload" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suggestedTeamCode" TEXT,
    "confidence" REAL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unmatched',
    CONSTRAINT "provider_team_outcome_suggestedTeamCode_fkey" FOREIGN KEY ("suggestedTeamCode") REFERENCES "team" ("code") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "team_alias_provider_normalizedAlias_key" ON "team_alias"("provider", "normalizedAlias");
CREATE INDEX "team_alias_teamCode_idx" ON "team_alias"("teamCode");
CREATE UNIQUE INDEX "provider_team_outcome_provider_marketType_normalizedName_key" ON "provider_team_outcome"("provider", "marketType", "normalizedName");
CREATE INDEX "provider_team_outcome_status_lastSeenAt_idx" ON "provider_team_outcome"("status", "lastSeenAt");
CREATE INDEX "provider_team_outcome_suggestedTeamCode_idx" ON "provider_team_outcome"("suggestedTeamCode");
