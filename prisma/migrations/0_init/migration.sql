-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('ONE_TIME', 'CONTINUOUS');

-- CreateEnum
CREATE TYPE "ReceptionChannel" AS ENUM ('EMAIL', 'CALL', 'VISIT', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "loginId" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "department" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "weeklyReportEmail" BOOLEAN DEFAULT false,
    "preferredLanguage" VARCHAR(10) DEFAULT 'ko',
    "timezone" VARCHAR(50) DEFAULT 'Asia/Seoul',
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CAR" (
    "id" SERIAL NOT NULL,
    "corporation" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "issueDate" BIGINT NOT NULL,
    "dueDate" BIGINT,
    "importance" DECIMAL(10,2) NOT NULL,
    "internalContact" TEXT,
    "receptionChannel" TEXT,
    "mainCategory" TEXT,
    "openIssue" TEXT,
    "followUpPlan" TEXT,
    "completionDate" BIGINT,
    "internalScore" DECIMAL(5,2),
    "customerScore" DECIMAL(5,2),
    "subjectiveScore" DECIMAL(5,2),
    "score" DECIMAL(5,2),
    "sentimentScore" DECIMAL(5,2),
    "aiKeywords" TEXT,
    "riskMitigation" BOOLEAN DEFAULT false,
    "riskDescription" TEXT,
    "riskLevel" TEXT DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,

    CONSTRAINT "CAR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreHistory" (
    "id" SERIAL NOT NULL,
    "carId" INTEGER NOT NULL,
    "scoreType" VARCHAR(50) NOT NULL,
    "value" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "weekStart" TIMESTAMP(6) NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managementEmail" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,

    CONSTRAINT "managementEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "company" TEXT,
    "department" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT,

    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarCustomerContact" (
    "carId" INTEGER NOT NULL,
    "customerContactId" INTEGER NOT NULL,

    CONSTRAINT "CarCustomerContact_pkey" PRIMARY KEY ("carId","customerContactId")
);

-- CreateTable
CREATE TABLE "CorporationSettings" (
    "id" SERIAL NOT NULL,
    "corporation" TEXT NOT NULL,
    "defaultLanguage" TEXT DEFAULT 'ko',
    "timezone" TEXT DEFAULT 'Asia/Seoul',
    "enforceLanguage" BOOLEAN DEFAULT false,
    "allowedLanguages" TEXT DEFAULT 'ko,en',
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorporationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");

-- CreateIndex
CREATE INDEX "idx_user_loginid" ON "User"("loginId");

-- CreateIndex
CREATE INDEX "idx_user_role" ON "User"("role");

-- CreateIndex
CREATE INDEX "idx_car_corporation" ON "CAR"("corporation");

-- CreateIndex
CREATE INDEX "idx_car_createdby" ON "CAR"("createdBy");

-- CreateIndex
CREATE INDEX "idx_car_eventtype" ON "CAR"("eventType");

-- CreateIndex
CREATE INDEX "idx_car_importance" ON "CAR"("importance");

-- CreateIndex
CREATE INDEX "idx_car_issuedate" ON "CAR"("issueDate");

-- CreateIndex
CREATE INDEX "idx_car_riskmitigation" ON "CAR"("riskMitigation");

-- CreateIndex
CREATE INDEX "idx_scorehistory_carid" ON "ScoreHistory"("carId");

-- CreateIndex
CREATE INDEX "idx_scorehistory_createdat" ON "ScoreHistory"("createdAt");

-- CreateIndex
CREATE INDEX "idx_weeklyreport_createdat" ON "WeeklyReport"("createdAt");

-- CreateIndex
CREATE INDEX "idx_weeklyreport_weekstart" ON "WeeklyReport"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "managementEmail_email_key" ON "managementEmail"("email");

-- CreateIndex
CREATE INDEX "idx_carcustomercontact_carid" ON "CarCustomerContact"("carId");

-- CreateIndex
CREATE INDEX "idx_carcustomercontact_customerid" ON "CarCustomerContact"("customerContactId");

-- CreateIndex
CREATE UNIQUE INDEX "CorporationSettings_corporation_key" ON "CorporationSettings"("corporation");

-- CreateIndex
CREATE INDEX "idx_corporationsettings_corporation" ON "CorporationSettings"("corporation");

-- AddForeignKey
ALTER TABLE "CAR" ADD CONSTRAINT "fk_car_user" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ScoreHistory" ADD CONSTRAINT "fk_scorehistory_car" FOREIGN KEY ("carId") REFERENCES "CAR"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CarCustomerContact" ADD CONSTRAINT "fk_carcustomercontact_car" FOREIGN KEY ("carId") REFERENCES "CAR"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CarCustomerContact" ADD CONSTRAINT "fk_carcustomercontact_customer" FOREIGN KEY ("customerContactId") REFERENCES "CustomerContact"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

