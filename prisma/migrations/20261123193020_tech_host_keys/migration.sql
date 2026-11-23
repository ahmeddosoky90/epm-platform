-- AlterTable
ALTER TABLE "public"."TechConnection" ADD COLUMN     "hostKeySha256" TEXT,
ADD COLUMN     "ignoreCert" BOOLEAN NOT NULL DEFAULT false;
