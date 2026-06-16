-- CreateTable
CREATE TABLE "winner_prediction_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oldTeamCode" TEXT,
    "newTeamCode" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "authorizedById" TEXT,
    "changedById" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visibleToParticipants" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "winner_prediction_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "winner_prediction_history_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "league" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reminder_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL DEFAULT 'match_prediction_deadline',
    "channel" TEXT NOT NULL DEFAULT 'email',
    "scheduledFor" DATETIME NOT NULL,
    "sentAt" DATETIME,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reminder_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reminder_log_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "league" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reminder_log_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "username" TEXT,
    "displayUsername" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "canCreateLeagues" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "whatsapp" TEXT,
    "isSuperadmin" BOOLEAN NOT NULL DEFAULT false,
    "themeMode" TEXT NOT NULL DEFAULT 'black',
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailRemindersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderMinutesBeforeDeadline" INTEGER NOT NULL DEFAULT 30,
    "reminderEmail" TEXT,
    "reminderEmailConfirmedAt" DATETIME
);
INSERT INTO "new_user" ("canCreateLeagues", "createdAt", "displayName", "displayUsername", "email", "emailVerified", "id", "image", "isSuperadmin", "name", "status", "updatedAt", "username", "whatsapp") SELECT "canCreateLeagues", "createdAt", "displayName", "displayUsername", "email", "emailVerified", "id", "image", "isSuperadmin", "name", "status", "updatedAt", "username", "whatsapp" FROM "user";
DROP TABLE "user";
ALTER TABLE "new_user" RENAME TO "user";
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");
CREATE TABLE "new_winner_prediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "pointsEarned" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "correctionAllowed" BOOLEAN NOT NULL DEFAULT false,
    "correctionAllowedUntil" DATETIME,
    "correctionReason" TEXT,
    "correctionAuthorizedById" TEXT,
    CONSTRAINT "winner_prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "winner_prediction_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "league" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "winner_prediction_teamCode_fkey" FOREIGN KEY ("teamCode") REFERENCES "team" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_winner_prediction" ("createdAt", "id", "leagueId", "pointsEarned", "teamCode", "updatedAt", "userId") SELECT "createdAt", "id", "leagueId", "pointsEarned", "teamCode", "updatedAt", "userId" FROM "winner_prediction";
DROP TABLE "winner_prediction";
ALTER TABLE "new_winner_prediction" RENAME TO "winner_prediction";
CREATE UNIQUE INDEX "winner_prediction_userId_leagueId_key" ON "winner_prediction"("userId", "leagueId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "reminder_log_userId_idx" ON "reminder_log"("userId");

-- CreateIndex
CREATE INDEX "reminder_log_matchId_idx" ON "reminder_log"("matchId");

-- CreateIndex
CREATE INDEX "reminder_log_leagueId_idx" ON "reminder_log"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_log_userId_leagueId_matchId_reminderType_channel_key" ON "reminder_log"("userId", "leagueId", "matchId", "reminderType", "channel");
