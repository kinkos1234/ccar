require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwtUtil = require('../utils/jwt');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const prisma = new PrismaClient();
const router = express.Router();

// 기본 Database 연결 (emp_m 테이블용 - DATABASE_URL 사용)
const empPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// DataMart Database 연결 (직원 검색용 - DM_DATABASE_URL 사용)
const dmPool = new Pool({
  connectionString: process.env.DM_DATABASE_URL,
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  // email은 loginId로 사용
  const user = await prisma.user.findUnique({ where: { loginId: email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // 비밀번호 검증: BCrypt 해시인지 평문인지 확인
  let isPasswordValid = false;
  let storedPassword = user.password;
  
  // Java Spring Security의 {bcrypt} 접두사 처리
  if (storedPassword.startsWith('{bcrypt}')) {
    storedPassword = storedPassword.substring(8); // '{bcrypt}' 제거
  }
  
  // BCrypt 해시는 '$2a$', '$2b$', '$2y$'로 시작
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
    // BCrypt로 암호화된 비밀번호 비교
    isPasswordValid = await bcrypt.compare(password, storedPassword);
  } else {
    // 평문 비밀번호 비교 (레거시 사용자 지원)
    isPasswordValid = (storedPassword === password);
    
    // 평문 로그인 성공 시 BCrypt로 자동 마이그레이션
    if (isPasswordValid) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });
    }
  }
  
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // INACTIVE 사용자 로그인 차단
  if (user.role === 'INACTIVE') {
    return res.status(403).json({ error: '비활성 계정입니다. 관리자에게 문의하세요.' });
  }

  const token = jwtUtil.sign({ id: user.id, loginId: user.loginId, name: user.name, role: user.role });
  res.json({ token, user: { id: user.id, loginId: user.loginId, name: user.name, role: user.role } });
});

// 🆕 로그아웃 API (Kafka 이벤트 로깅용)
router.post('/logout', requireAuth, async (req, res) => {
  // 실제 로그아웃 처리는 클라이언트에서 토큰 제거
  // 이 API는 Kafka 이벤트 로깅을 위한 것
  res.json({ 
    message: '로그아웃되었습니다.',
    user: req.user 
  });
});

// 사용자 목록 조회 (ADMIN만 접근 가능)
router.get('/users', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        loginId: true,
        name: true,
        role: true,
        department: true,
        email: true,
        weeklyReportEmail: true,
        preferredLanguage: true,
        timezone: true,
        createdAt: true,
        updatedAt: true
        // password는 제외
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    res.status(500).json({ error: '사용자 목록 조회에 실패했습니다.' });
  }
});

// 특정 사용자 조회 (ADMIN만 접근 가능)
router.get('/users/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        loginId: true,
        name: true,
        role: true,
        department: true,
        email: true,
        weeklyReportEmail: true,
        preferredLanguage: true,
        timezone: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('사용자 조회 오류:', error);
    res.status(500).json({ error: '사용자 조회에 실패했습니다.' });
  }
});

// 사용자 생성 (ADMIN만 접근 가능)
router.post('/users', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { loginId, password, name, role, department, email, weeklyReportEmail, preferredLanguage, timezone, isPasswordEncrypted } = req.body;
    
    // 필수 필드 검증
    if (!loginId || !password || !name || !role) {
      return res.status(400).json({ error: '로그인 ID, 비밀번호, 이름, 역할은 필수입니다.' });
    }
    
    // 역할 검증
    if (!['ADMIN', 'MANAGER', 'STAFF', 'INACTIVE'].includes(role)) {
      return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
    }
    
    // 언어 코드 검증 (선택사항)
    const validLanguages = ['ko', 'en', 'zh', 'vi', 'hi', 'es-mx'];
    if (preferredLanguage && !validLanguages.includes(preferredLanguage)) {
      return res.status(400).json({ error: '유효하지 않은 언어 코드입니다.' });
    }
    
    // 중복 loginId 검사
    const existingUser = await prisma.user.findUnique({
      where: { loginId }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: '이미 존재하는 로그인 ID입니다.' });
    }
    
    // 비밀번호 처리: emp_m에서 가져온 경우 이미 BCrypt로 암호화됨, 아니면 새로 암호화
    let hashedPassword = password;
    if (!isPasswordEncrypted) {
      hashedPassword = await bcrypt.hash(password, 10);
    }
    
    const user = await prisma.user.create({
      data: { 
        loginId, 
        password: hashedPassword, 
        name, 
        role, 
        department: department || '',
        email: email || null,
        weeklyReportEmail: weeklyReportEmail || false,
        preferredLanguage: preferredLanguage || 'ko',
        timezone: timezone || 'Asia/Seoul'
      },
      select: {
        id: true,
        loginId: true,
        name: true,
        role: true,
        department: true,
        email: true,
        weeklyReportEmail: true,
        preferredLanguage: true,
        timezone: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    res.status(201).json(user);
  } catch (error) {
    console.error('사용자 생성 오류:', error);
    res.status(500).json({ error: '사용자 생성에 실패했습니다.' });
  }
});

// 사용자 수정 (ADMIN만 접근 가능)
router.put('/users/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { loginId, password, name, role, department, email, weeklyReportEmail, preferredLanguage, timezone } = req.body;
    
    // 필수 필드 검증
    if (!loginId || !name || !role) {
      return res.status(400).json({ error: '로그인 ID, 이름, 역할은 필수입니다.' });
    }
    
    // 역할 검증
    if (!['ADMIN', 'MANAGER', 'STAFF', 'INACTIVE'].includes(role)) {
      return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
    }
    
    // 언어 코드 검증 (선택사항)
    const validLanguages = ['ko', 'en', 'zh', 'vi', 'hi', 'es-mx'];
    if (preferredLanguage && !validLanguages.includes(preferredLanguage)) {
      return res.status(400).json({ error: '유효하지 않은 언어 코드입니다.' });
    }
    
    // 사용자 존재 확인
    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingUser) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    // 다른 사용자가 같은 loginId를 사용하는지 확인
    const duplicateUser = await prisma.user.findFirst({
      where: {
        loginId,
        id: { not: parseInt(id) }
      }
    });
    
    if (duplicateUser) {
      return res.status(400).json({ error: '이미 존재하는 로그인 ID입니다.' });
    }
    
    // 업데이트 데이터 준비
    const updateData = { 
      loginId, 
      name, 
      role, 
      department: department || '',
      email: email || null,
      weeklyReportEmail: weeklyReportEmail !== undefined ? weeklyReportEmail : false
    };
    
    // 언어 설정 업데이트 (제공된 경우에만)
    if (preferredLanguage !== undefined) {
      updateData.preferredLanguage = preferredLanguage;
    }
    if (timezone !== undefined) {
      updateData.timezone = timezone;
    }
    
    // 비밀번호가 제공된 경우 BCrypt로 암호화하여 저장
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        loginId: true,
        name: true,
        role: true,
        department: true,
        email: true,
        weeklyReportEmail: true,
        preferredLanguage: true,
        timezone: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    res.json(user);
  } catch (error) {
    console.error('사용자 수정 오류:', error);
    res.status(500).json({ error: '사용자 수정에 실패했습니다.' });
  }
});

// 사용자 삭제 (ADMIN만 접근 가능)
router.delete('/users/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    
    // 사용자 존재 확인
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    // 본인 계정 삭제 방지
    if (userId === req.user.id) {
      return res.status(400).json({ error: '본인 계정은 삭제할 수 없습니다.' });
    }
    
    await prisma.user.delete({
      where: { id: userId }
    });
    
    res.json({ message: '사용자가 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    res.status(500).json({ error: '사용자 삭제에 실패했습니다.' });
  }
});

// 🆕 현재 사용자 프로필 조회 (모든 인증된 사용자)
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        loginId: true,
        name: true,
        role: true,
        department: true,
        email: true,
        weeklyReportEmail: true,
        preferredLanguage: true,
        timezone: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('프로필 조회 오류:', error);
    res.status(500).json({ error: '프로필 조회에 실패했습니다.' });
  }
});

// 🆕 현재 사용자 언어 설정 변경 (모든 인증된 사용자)
router.put('/profile/language', requireAuth, async (req, res) => {
  try {
    const { preferredLanguage, timezone } = req.body;
    
    // 언어 코드 검증
    const validLanguages = ['ko', 'en', 'zh', 'vi', 'hi', 'es-mx'];
    if (preferredLanguage && !validLanguages.includes(preferredLanguage)) {
      return res.status(400).json({ error: '유효하지 않은 언어 코드입니다.' });
    }
    
    const updateData = {};
    if (preferredLanguage !== undefined) {
      updateData.preferredLanguage = preferredLanguage;
    }
    if (timezone !== undefined) {
      updateData.timezone = timezone;
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: '변경할 언어 설정이 없습니다.' });
    }
    
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        preferredLanguage: true,
        timezone: true
      }
    });
    
    res.json({ 
      message: '언어 설정이 성공적으로 변경되었습니다.',
      user 
    });
  } catch (error) {
    console.error('언어 설정 변경 오류:', error);
    res.status(500).json({ error: '언어 설정 변경에 실패했습니다.' });
  }
});

// 🆕 법인 설정 목록 조회 (ADMIN만 접근 가능)
router.get('/corporations', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const corporations = await prisma.corporationSettings.findMany({
      orderBy: { corporation: 'asc' }
    });
    res.json(corporations);
  } catch (error) {
    console.error('법인 설정 조회 오류:', error);
    res.status(500).json({ error: '법인 설정 조회에 실패했습니다.' });
  }
});

// 🆕 법인 설정 생성/수정 (ADMIN만 접근 가능)
router.put('/corporations/:corporation', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { corporation } = req.params;
    const { defaultLanguage, timezone, enforceLanguage, allowedLanguages } = req.body;
    
    // 언어 코드 검증
    const validLanguages = ['ko', 'en', 'zh', 'vi', 'hi', 'es-mx'];
    if (defaultLanguage && !validLanguages.includes(defaultLanguage)) {
      return res.status(400).json({ error: '유효하지 않은 기본 언어 코드입니다.' });
    }
    
    const corporationSetting = await prisma.corporationSettings.upsert({
      where: { corporation },
      update: {
        defaultLanguage: defaultLanguage || 'ko',
        timezone: timezone || 'Asia/Seoul',
        enforceLanguage: enforceLanguage !== undefined ? enforceLanguage : false,
        allowedLanguages: allowedLanguages || 'ko,en'
      },
      create: {
        corporation,
        defaultLanguage: defaultLanguage || 'ko',
        timezone: timezone || 'Asia/Seoul',
        enforceLanguage: enforceLanguage !== undefined ? enforceLanguage : false,
        allowedLanguages: allowedLanguages || 'ko,en'
      }
    });
    
    res.json({
      message: '법인 설정이 성공적으로 저장되었습니다.',
      corporationSetting
    });
  } catch (error) {
    console.error('법인 설정 저장 오류:', error);
    res.status(500).json({ error: '법인 설정 저장에 실패했습니다.' });
  }
});

// 🆕 지원 언어 목록 조회 (모든 인증된 사용자)
router.get('/languages', requireAuth, async (req, res) => {
  try {
    const languages = [
      { code: 'ko', name: '한국어', nativeName: '한국어' },
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'zh', name: 'Chinese', nativeName: '中文' },
      { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
      { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
      { code: 'es-mx', name: 'Spanish (Mexico)', nativeName: 'Español (México)' }
    ];
    res.json(languages);
  } catch (error) {
    console.error('언어 목록 조회 오류:', error);
    res.status(500).json({ error: '언어 목록 조회에 실패했습니다.' });
  }
});

// 🆕 emp_m 테이블에서 사용자 정보 조회 (ADMIN만 접근 가능)
// DM_DATABASE_URL의 DataMart 데이터베이스 사용
// 테이블 구조: emp_id(PK), emp_nm, pw, cmpy_cd, cmpy_nm, dept_cd, dept_nm, emp_no, moblep_no, email
router.get('/dxme/employees', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const result = await dmPool.query(`
      SELECT 
        emp_id as "empNo",
        emp_nm as "empName", 
        email,
        dept_nm as "deptName",
        cmpy_nm as "companyName"
      FROM me.emp_m
      WHERE emp_id IS NOT NULL 
        AND emp_nm IS NOT NULL
        AND (emp_status_cd IS NULL OR emp_status_cd != 'RETIRED')
      ORDER BY emp_nm
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('직원 목록 조회 오류:', error);
    res.status(500).json({ error: '직원 목록 조회에 실패했습니다.' });
  }
});

// 🆕 emp_m에서 특정 직원 검색 (ADMIN만 접근 가능)
// DM_DATABASE_URL의 DataMart 데이터베이스 사용
router.get('/dxme/employees/search', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim() === '') {
      return res.json([]);
    }
    
    const result = await dmPool.query(`
      SELECT 
        emp_id as "empNo",
        emp_nm as "empName",
        pw as "password",
        email,
        dept_nm as "deptName",
        cmpy_nm as "companyName"
      FROM me.emp_m
      WHERE emp_id IS NOT NULL 
        AND emp_nm IS NOT NULL
        AND (emp_status_cd IS NULL OR emp_status_cd != 'RETIRED')
        AND (
          emp_id ILIKE $1
          OR emp_nm ILIKE $1
          OR email ILIKE $1
          OR dept_nm ILIKE $1
          OR cmpy_nm ILIKE $1
        )
      ORDER BY emp_nm
      LIMIT 50
    `, [`%${query}%`]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('직원 검색 오류:', error);
    res.status(500).json({ error: '직원 검색에 실패했습니다.' });
  }
});

// ERP 사용자 일괄 동기화 (ADMIN만 접근 가능)
// DataMart emp_m → User 테이블로 INACTIVE 기본 등록
router.post('/erp-sync', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    // DataMart에서 전체 직원 조회
    const result = await dmPool.query(`
      SELECT
        emp_id, emp_nm, pw, email, dept_nm, cmpy_nm, emp_status_cd
      FROM me.emp_m
      WHERE emp_id IS NOT NULL
        AND emp_nm IS NOT NULL
      ORDER BY emp_nm
    `);

    const employees = result.rows;
    let created = 0;
    let skipped = 0;
    let updated = 0;
    const errors = [];

    for (const emp of employees) {
      try {
        // loginId: 이메일이 있으면 이메일, 없으면 emp_id
        const loginId = (emp.email && emp.email.trim() && emp.email.trim() !== '-')
          ? emp.email.trim()
          : emp.emp_id;

        // 이미 등록된 사용자 확인 (erpId 기준)
        const existingByErpId = await prisma.user.findUnique({
          where: { erpId: emp.emp_id }
        });

        if (existingByErpId) {
          // erpId로 이미 연결된 사용자 → 이름/부서/이메일만 업데이트
          await prisma.user.update({
            where: { id: existingByErpId.id },
            data: {
              name: emp.emp_nm || existingByErpId.name,
              department: emp.dept_nm || existingByErpId.department,
              email: (emp.email && emp.email.trim() && emp.email.trim() !== '-') ? emp.email.trim() : existingByErpId.email,
            }
          });
          updated++;
          continue;
        }

        // loginId 중복 확인
        const existingByLoginId = await prisma.user.findUnique({
          where: { loginId }
        });

        if (existingByLoginId) {
          // loginId가 이미 있으면 erpId만 연결
          if (!existingByLoginId.erpId) {
            await prisma.user.update({
              where: { id: existingByLoginId.id },
              data: { erpId: emp.emp_id }
            });
            updated++;
          } else {
            skipped++;
          }
          continue;
        }

        // 비밀번호 처리: ERP에 있으면 그대로 (BCrypt), 없으면 기본값 생성
        let password = emp.pw || '';
        let needsHash = false;
        if (!password || password.trim() === '') {
          password = 'changeme2026!';
          needsHash = true;
        }
        // {bcrypt} 접두사 처리
        if (password.startsWith('{bcrypt}')) {
          password = password.substring(8);
        }
        // BCrypt가 아닌 경우 해시
        if (needsHash || (!password.startsWith('$2a$') && !password.startsWith('$2b$') && !password.startsWith('$2y$'))) {
          password = await bcrypt.hash(password, 10);
        }

        await prisma.user.create({
          data: {
            loginId,
            password,
            name: emp.emp_nm,
            role: 'INACTIVE',
            department: emp.dept_nm || emp.cmpy_nm || '',
            email: (emp.email && emp.email.trim() && emp.email.trim() !== '-') ? emp.email.trim() : null,
            erpId: emp.emp_id,
            weeklyReportEmail: false,
            preferredLanguage: 'ko',
            timezone: 'Asia/Seoul'
          }
        });
        created++;
      } catch (empError) {
        errors.push({ empId: emp.emp_id, name: emp.emp_nm, error: empError.message });
      }
    }

    res.json({
      message: 'ERP 동기화 완료',
      total: employees.length,
      created,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('ERP 동기화 오류:', error);
    res.status(500).json({ error: 'ERP 동기화에 실패했습니다.' });
  }
});

// 내부담당자 사용자 검색 (인증된 사용자 모두 접근 가능)
router.get('/users/search', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    const where = {
      role: { not: 'INACTIVE' }
    };
    if (q && q.trim()) {
      where.OR = [
        { name: { contains: q.trim(), mode: 'insensitive' } },
        { department: { contains: q.trim(), mode: 'insensitive' } },
        { loginId: { contains: q.trim(), mode: 'insensitive' } }
      ];
    }
    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, department: true, email: true },
      orderBy: { name: 'asc' },
      take: 50
    });
    res.json(users);
  } catch (error) {
    console.error('사용자 검색 오류:', error);
    res.status(500).json({ error: '사용자 검색에 실패했습니다.' });
  }
});

// 내부담당자 매핑 현황 조회 (ADMIN만 접근 가능)
router.get('/internal-contacts/stats', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const totalCars = await prisma.cAR.count();
    const mappedCars = await prisma.carInternalContact.groupBy({
      by: ['carId'],
      _count: true
    });
    const totalMappings = await prisma.carInternalContact.count();

    res.json({
      totalCars,
      carsWithMapping: mappedCars.length,
      carsWithoutMapping: totalCars - mappedCars.length,
      totalMappings
    });
  } catch (error) {
    console.error('내부담당자 매핑 현황 조회 오류:', error);
    res.status(500).json({ error: '내부담당자 매핑 현황 조회에 실패했습니다.' });
  }
});

module.exports = router;