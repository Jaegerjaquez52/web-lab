/*
  Warnings:

  - You are about to drop the column `name` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `File` table. All the data in the column will be lost.
  - Added the required column `filename` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimetype` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalName` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `path` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uploadedBy` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'MODERATOR');

-- AlterTable
ALTER TABLE "File" DROP COLUMN "name",
DROP COLUMN "url",
ADD COLUMN     "filename" TEXT NOT NULL,
ADD COLUMN     "mimetype" TEXT NOT NULL,
ADD COLUMN     "originalName" TEXT NOT NULL,
ADD COLUMN     "path" TEXT NOT NULL,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "uploadedBy" INTEGER NOT NULL,
ALTER COLUMN "taskId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "_ProjectToUser" ADD CONSTRAINT "_ProjectToUser_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ProjectToUser_AB_unique";

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "File_uploadedBy_idx" ON "File"("uploadedBy");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
