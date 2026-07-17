-- ========================================
-- CAR 시스템 PostgreSQL 마이그레이션 스크립트
-- SQLite → PostgreSQL 변환
-- ========================================

-- ========================================
-- ENUM 타입 생성
-- ========================================

CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'STAFF');

CREATE TYPE "EventType" AS ENUM ('ONE_TIME', 'CONTINUOUS');

CREATE TYPE "ReceptionChannel" AS ENUM ('EMAIL', 'CALL', 'VISIT', 'OTHER');

-- ========================================
-- 1. User 테이블
-- ========================================

CREATE TABLE "User" (
    id SERIAL PRIMARY KEY,
    "loginId" VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role "Role" NOT NULL,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    "weeklyReportEmail" BOOLEAN DEFAULT false,
    
    -- 글로벌화 지원 필드
    "preferredLanguage" VARCHAR(10) DEFAULT 'ko',
    timezone VARCHAR(50) DEFAULT 'Asia/Seoul',
    
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User 인덱스
CREATE INDEX idx_user_loginid ON "User"("loginId");
CREATE INDEX idx_user_role ON "User"(role);

-- ========================================
-- 2. CAR 테이블
-- ========================================

CREATE TABLE "CAR" (
    id SERIAL PRIMARY KEY,
    corporation VARCHAR(255) NOT NULL,
    
    "eventType" "EventType" NOT NULL,
    "issueDate" BIGINT NOT NULL,
    "dueDate" BIGINT,
    importance DECIMAL(10, 2) NOT NULL,
    
    "internalContact" TEXT,
    "receptionChannel" VARCHAR(50),
    "mainCategory" VARCHAR(255),
    "openIssue" TEXT,
    "followUpPlan" TEXT,
    "completionDate" BIGINT,
    
    "internalScore" DECIMAL(5, 2),
    "customerScore" DECIMAL(5, 2),
    "subjectiveScore" DECIMAL(5, 2),
    score DECIMAL(5, 2),
    
    "sentimentScore" DECIMAL(5, 2),
    "aiKeywords" TEXT,
    
    -- Risk Mitigation 필드
    "riskMitigation" BOOLEAN DEFAULT false,
    "riskDescription" TEXT,
    "riskLevel" VARCHAR(20) DEFAULT 'MEDIUM',
    
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    "createdBy" INTEGER NOT NULL,
    
    CONSTRAINT fk_car_user FOREIGN KEY ("createdBy") REFERENCES "User"(id) ON DELETE CASCADE
);

-- CAR 인덱스
CREATE INDEX idx_car_corporation ON "CAR"(corporation);
CREATE INDEX idx_car_eventtype ON "CAR"("eventType");
CREATE INDEX idx_car_issuedate ON "CAR"("issueDate");
CREATE INDEX idx_car_createdby ON "CAR"("createdBy");
CREATE INDEX idx_car_importance ON "CAR"(importance);
CREATE INDEX idx_car_riskmitigation ON "CAR"("riskMitigation");

-- ========================================
-- 3. ScoreHistory 테이블
-- ========================================

CREATE TABLE "ScoreHistory" (
    id SERIAL PRIMARY KEY,
    "carId" INTEGER NOT NULL,
    "scoreType" VARCHAR(50) NOT NULL,
    value DECIMAL(5, 2) NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_scorehistory_car FOREIGN KEY ("carId") REFERENCES "CAR"(id) ON DELETE CASCADE
);

-- ScoreHistory 인덱스
CREATE INDEX idx_scorehistory_carid ON "ScoreHistory"("carId");
CREATE INDEX idx_scorehistory_createdat ON "ScoreHistory"("createdAt");

-- ========================================
-- 4. WeeklyReport 테이블
-- ========================================

CREATE TABLE "WeeklyReport" (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    "weekStart" TIMESTAMP NOT NULL,
    data JSONB NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WeeklyReport 인덱스
CREATE INDEX idx_weeklyreport_weekstart ON "WeeklyReport"("weekStart");
CREATE INDEX idx_weeklyreport_createdat ON "WeeklyReport"("createdAt");

-- ========================================
-- 5. managementEmail 테이블
-- ========================================

CREATE TABLE "managementEmail" (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL
);

-- ========================================
-- 6. CustomerContact 테이블
-- ========================================

CREATE TABLE "CustomerContact" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "group" VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    department VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    memo TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CustomerContact 인덱스
CREATE INDEX idx_customercontact_name ON "CustomerContact"(name);
CREATE INDEX idx_customercontact_group ON "CustomerContact"("group");
CREATE INDEX idx_customercontact_company ON "CustomerContact"(company);

-- ========================================
-- 7. CarCustomerContact 테이블 (조인 테이블)
-- ========================================

CREATE TABLE "CarCustomerContact" (
    "carId" INTEGER NOT NULL,
    "customerContactId" INTEGER NOT NULL,
    
    PRIMARY KEY ("carId", "customerContactId"),
    
    CONSTRAINT fk_carcustomercontact_car FOREIGN KEY ("carId") REFERENCES "CAR"(id) ON DELETE CASCADE,
    CONSTRAINT fk_carcustomercontact_customer FOREIGN KEY ("customerContactId") REFERENCES "CustomerContact"(id) ON DELETE CASCADE
);

-- CarCustomerContact 인덱스
CREATE INDEX idx_carcustomercontact_carid ON "CarCustomerContact"("carId");
CREATE INDEX idx_carcustomercontact_customerid ON "CarCustomerContact"("customerContactId");

-- ========================================
-- 8. CorporationSettings 테이블 (법인별 다국어 설정)
-- ========================================

CREATE TABLE "CorporationSettings" (
    id SERIAL PRIMARY KEY,
    corporation VARCHAR(255) UNIQUE NOT NULL,
    "defaultLanguage" VARCHAR(10) DEFAULT 'ko',
    timezone VARCHAR(50) DEFAULT 'Asia/Seoul',
    "enforceLanguage" BOOLEAN DEFAULT false,
    "allowedLanguages" VARCHAR(255) DEFAULT 'ko,en',
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CorporationSettings 인덱스
CREATE INDEX idx_corporationsettings_corporation ON "CorporationSettings"(corporation);

-- ========================================
-- 트리거 생성 (자동 updatedAt 업데이트)
-- ========================================

-- updatedAt 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- User 테이블 트리거
CREATE TRIGGER update_user_updated_at
BEFORE UPDATE ON "User"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- CAR 테이블 트리거
CREATE TRIGGER update_car_updated_at
BEFORE UPDATE ON "CAR"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- WeeklyReport 테이블 트리거
CREATE TRIGGER update_weeklyreport_updated_at
BEFORE UPDATE ON "WeeklyReport"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- CorporationSettings 테이블 트리거
CREATE TRIGGER update_corporationsettings_updated_at
BEFORE UPDATE ON "CorporationSettings"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 스키마 정보 확인 뷰
-- ========================================

CREATE OR REPLACE VIEW schema_info AS
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ========================================
-- 완료 메시지
-- ========================================

COMMENT ON SCHEMA public IS 'CAR 시스템 PostgreSQL 스키마 (SQLite 마이그레이션 완료)';
