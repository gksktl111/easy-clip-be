-- Short-lived random state IDs only; no OAuth credentials or user data.
CREATE TABLE "OAuthStateNonce" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OAuthStateNonce_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OAuthStateNonce_expiresAt_idx" ON "OAuthStateNonce"("expiresAt");
