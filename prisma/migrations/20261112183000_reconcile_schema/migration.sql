-- Reconcile the deployed schema with prisma/schema.prisma without dropping data.
ALTER TABLE "Project"
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "ownerId" INTEGER;

UPDATE "Project"
SET "updatedAt" = "createdAt"
WHERE "updatedAt" IS NULL;

ALTER TABLE "Project"
ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "Notification"
ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'NORMAL';

CREATE TABLE IF NOT EXISTS "ActivityLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RealtimeEvent" (
    "id" SERIAL NOT NULL,
    "room" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RealtimeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Project_ownerId_idx" ON "Project"("ownerId");
CREATE INDEX IF NOT EXISTS "Project_name_idx" ON "Project"("name");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "File_taskId_idx" ON "File"("taskId");
CREATE INDEX IF NOT EXISTS "Comment_taskId_idx" ON "Comment"("taskId");
CREATE INDEX IF NOT EXISTS "Comment_userId_idx" ON "Comment"("userId");
CREATE INDEX IF NOT EXISTS "Notification_userId_priority_idx" ON "Notification"("userId", "priority");
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_entity_entityId_idx" ON "ActivityLog"("entity", "entityId");
CREATE INDEX IF NOT EXISTS "RealtimeEvent_room_id_idx" ON "RealtimeEvent"("room", "id");
DROP INDEX IF EXISTS "User_email_idx";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_ownerId_fkey') THEN
        ALTER TABLE "Project"
        ADD CONSTRAINT "Project_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityLog_userId_fkey') THEN
        ALTER TABLE "ActivityLog"
        ADD CONSTRAINT "ActivityLog_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
