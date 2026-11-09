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
SET "username" = CASE
  WHEN (
    SELECT COUNT(*)
    FROM "User" AS same_prefix
    WHERE same_prefix."role" = 'DRIVER'
      AND same_prefix."username" IS NULL
      AND same_prefix."email" IS NOT NULL
      AND lower(split_part(same_prefix."email", '@', 1)) = lower(split_part("User"."email", '@', 1))
  ) > 1
  THEN lower(split_part("email", '@', 1)) || '-' || left("id", 6)
  ELSE lower(split_part("email", '@', 1))
END
WHERE "role" = 'DRIVER' AND "username" IS NULL AND "email" IS NOT NULL;

UPDATE "Driver" AS d
SET "userId" = u."id"
FROM "User" AS u
WHERE d."userId" IS NULL AND u."role" = 'DRIVER' AND u."deletedAt" IS NULL
  AND lower(d."name") = lower(u."name");
