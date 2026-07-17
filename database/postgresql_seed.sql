-- ========================================
-- CAR 시스템 PostgreSQL 초기 데이터 (Seed Data)
-- ========================================

-- ========================================
-- 1. 기본 사용자 생성 (ADMIN)
-- ========================================

INSERT INTO "User" (
    "loginId", 
    password, 
    role, 
    name, 
    department, 
    email, 
    "weeklyReportEmail",
    "preferredLanguage",
    timezone
) VALUES 
    ('admin', 'admin123', 'ADMIN', '시스템 관리자', 'IT', 'admin@company.com', true, 'ko', 'Asia/Seoul'),
    ('manager', 'manager123', 'MANAGER', '팀장', '영업팀', 'manager@company.com', true, 'ko', 'Asia/Seoul'),
    ('staff', 'staff123', 'STAFF', '직원', '영업팀', 'staff@company.com', false, 'ko', 'Asia/Seoul')
ON CONFLICT ("loginId") DO NOTHING;

-- ========================================
-- 2. 관리자 이메일 추가
-- ========================================

INSERT INTO "managementEmail" (email) VALUES 
    ('admin@company.com'),
    ('manager@company.com')
ON CONFLICT (email) DO NOTHING;

-- ========================================
-- 3. 법인 설정 (한국, 미국, 유럽)
-- ========================================

INSERT INTO "CorporationSettings" (
    corporation,
    "defaultLanguage",
    timezone,
    "enforceLanguage",
    "allowedLanguages"
) VALUES 
    ('CMKR', 'ko', 'Asia/Seoul', false, 'ko,en'),
    ('SSUS', 'en', 'America/New_York', false, 'en,es-mx'),
    ('SSEU', 'en', 'Europe/London', false, 'en,de,fr')
ON CONFLICT (corporation) DO NOTHING;

-- ========================================
-- 완료 메시지
-- ========================================

SELECT 
    '초기 데이터 입력 완료' as message,
    (SELECT COUNT(*) FROM "User") as user_count,
    (SELECT COUNT(*) FROM "managementEmail") as email_count,
    (SELECT COUNT(*) FROM "CorporationSettings") as corporation_count;
