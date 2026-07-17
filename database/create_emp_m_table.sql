-- =====================================================
-- emp_m 테이블 생성 스크립트
-- 데이터베이스: me_car_system (db.ccar.internal:5432)
-- 목적: 새 사용자 등록 시 직원 정보 조회
-- =====================================================

-- 테이블 생성
CREATE TABLE IF NOT EXISTS emp_m (
    emp_no  VARCHAR(50) PRIMARY KEY,    -- 사번 (PK)
    emp_nm  VARCHAR(100) NOT NULL,      -- 이름
    email   VARCHAR(255),               -- 이메일
    dept_nm VARCHAR(100)                -- 부서명
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_emp_m_name ON emp_m(emp_nm);
CREATE INDEX IF NOT EXISTS idx_emp_m_email ON emp_m(email);

-- 샘플 데이터 (테스트용)
INSERT INTO emp_m (emp_no, emp_nm, email, dept_nm) VALUES
    ('EMP001', '홍길동', 'hong@ccar.example.com', '개발팀'),
    ('EMP002', '김철수', 'kim@ccar.example.com', '기획팀'),
    ('EMP003', '이영희', 'lee@ccar.example.com', '영업팀'),
    ('EMP004', '박민수', 'park@ccar.example.com', '개발팀'),
    ('EMP005', '최지은', 'choi@ccar.example.com', '인사팀'),
    ('EMP006', '정현우', 'jung@ccar.example.com', '마케팅팀'),
    ('EMP007', '강서연', 'kang@ccar.example.com', '재무팀'),
    ('EMP008', '윤태호', 'yoon@ccar.example.com', '개발팀'),
    ('EMP009', '임수진', 'lim@ccar.example.com', '기획팀'),
    ('EMP010', '한지민', 'han@ccar.example.com', '영업팀')
ON CONFLICT (emp_no) DO NOTHING;

-- 확인 쿼리
SELECT * FROM emp_m ORDER BY emp_nm;
