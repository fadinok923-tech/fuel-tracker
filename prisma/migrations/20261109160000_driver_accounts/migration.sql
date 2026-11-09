-- Driver accounts can use unique usernames without requiring an email address.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Link each driver login to at most one driver profile.
ALTER TABLE "Driver" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");
ALTER TABLE "Driver"
  ADD CONSTRAINT "Driver_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve access for previously seeded driver users and link matching profiles.
UPDATE "User"
SET "username" = lower(split_part("email", '@', 1))
WHERE "role" = 'DRIVER' AND "username" IS NULL AND "email" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "User" AS other
    WHERE lower(other."username") = lower(split_part("User"."email", '@', 1))
      AND other."id" <> "User"."id"
  );

UPDATE "Driver" AS d
SET "userId" = u."id"
FROM "User" AS u
WHERE d."userId" IS NULL AND u."role" = 'DRIVER' AND u."deletedAt" IS NULL
  AND lower(d."name") = lower(u."name");
