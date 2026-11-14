BEGIN;

ALTER TABLE "Project" ADD COLUMN "teamId" INTEGER;

CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskAssignment" (
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("taskId", "userId")
);

CREATE TABLE "_TeamMembers" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_TeamMembers_AB_pkey" PRIMARY KEY ("A", "B")
);

DO $$
DECLARE
    project_record RECORD;
    new_team_id INTEGER;
BEGIN
    FOR project_record IN
        SELECT "id", "name", "description", "ownerId", "createdAt", "updatedAt"
        FROM "Project"
    LOOP
        INSERT INTO "Team" ("name", "description", "ownerId", "createdAt", "updatedAt")
        VALUES (project_record."name", project_record."description", project_record."ownerId", project_record."createdAt", project_record."updatedAt")
        RETURNING "id" INTO new_team_id;

        UPDATE "Project" SET "teamId" = new_team_id WHERE "id" = project_record."id";

        IF project_record."ownerId" IS NOT NULL THEN
            INSERT INTO "_TeamMembers" ("A", "B") VALUES (new_team_id, project_record."ownerId")
            ON CONFLICT DO NOTHING;
        END IF;

        INSERT INTO "_TeamMembers" ("A", "B")
        SELECT new_team_id, "B" FROM "_ProjectToUser" WHERE "A" = project_record."id"
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

INSERT INTO "TaskAssignment" ("taskId", "userId", "createdAt")
SELECT "id", "assigneeId", "createdAt"
FROM "Task"
WHERE "assigneeId" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX "Team_ownerId_idx" ON "Team"("ownerId");
CREATE INDEX "Team_name_idx" ON "Team"("name");
CREATE INDEX "TaskAssignment_userId_idx" ON "TaskAssignment"("userId");
CREATE INDEX "_TeamMembers_B_index" ON "_TeamMembers"("B");
CREATE INDEX "Project_teamId_idx" ON "Project"("teamId");

ALTER TABLE "Project"
ADD CONSTRAINT "Project_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Team"
ADD CONSTRAINT "Team_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaskAssignment"
ADD CONSTRAINT "TaskAssignment_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskAssignment"
ADD CONSTRAINT "TaskAssignment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_TeamMembers"
ADD CONSTRAINT "_TeamMembers_A_fkey"
FOREIGN KEY ("A") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_TeamMembers"
ADD CONSTRAINT "_TeamMembers_B_fkey"
FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task" DROP CONSTRAINT "Task_assigneeId_fkey";
DROP INDEX "Task_assigneeId_idx";
ALTER TABLE "Task" DROP COLUMN "assigneeId";
DROP TABLE "_ProjectToUser";

COMMIT;
