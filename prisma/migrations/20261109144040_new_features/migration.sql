-- AlterTable
ALTER TABLE "User" ADD COLUMN     "is2FAEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3),
ADD COLUMN     "twoFactorSecret" TEXT;
