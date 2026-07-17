const { PrismaClient } = require('@prisma/client');
const { convertBigIntToString } = require('../utils/bigint');

const prisma = new PrismaClient();

// ─── 고객사 데이터 스키마 검증 ───

const REQUIRED_CUSTOMER_FIELDS = ['evidence', 'summary', 'topIssues', 'aiRecommendation', 'parsedStrategy'];
const REQUIRED_SUMMARY_FIELDS = ['totalEvents', 'recentEvents', 'openEvents', 'avgSentiment', 'scoreSum'];
const REQUIRED_STRATEGY_FIELDS = ['전략명', '대상', '요약', '조치', '예상 효과'];

/**
 * 고객사 데이터 1건을 검증하고 누락 필드를 폴백 처리
 * @returns {{ data: object, quality: object }} 정규화된 데이터 + 품질 점수
 */
function validateAndNormalize(customerName, raw) {
  const issues = [];       // 검증 경고 목록
  let fieldScore = 0;      // 필드 존재 점수
  const maxFieldScore = REQUIRED_CUSTOMER_FIELDS.length
    + REQUIRED_SUMMARY_FIELDS.length
    + REQUIRED_STRATEGY_FIELDS.length
    + 1; // topIssues 항목 존재 여부

  // 1) 최상위 필드 검증 + 폴백
  const data = { customerName };

  // evidence
  if (typeof raw.evidence === 'string' && raw.evidence.trim().length > 0) {
    data.evidence = raw.evidence.trim();
    fieldScore++;
  } else {
    data.evidence = `고객사 ${customerName}에 대한 분석 데이터가 충분하지 않아 상세 요약을 생성하지 못했습니다.`;
    issues.push('evidence 누락 - 폴백 적용');
  }

  // summary
  if (raw.summary && typeof raw.summary === 'object') {
    data.summary = {};
    for (const field of REQUIRED_SUMMARY_FIELDS) {
      const val = raw.summary[field];
      if (typeof val === 'number' && !isNaN(val)) {
        data.summary[field] = field === 'avgSentiment' ? Math.round(val * 10) / 10 : val;
        fieldScore++;
      } else if (typeof val === 'string' && !isNaN(Number(val))) {
        data.summary[field] = field === 'avgSentiment' ? Math.round(Number(val) * 10) / 10 : Number(val);
        fieldScore++;
        issues.push(`summary.${field} 문자열→숫자 변환`);
      } else {
        data.summary[field] = 0;
        issues.push(`summary.${field} 누락 - 0으로 폴백`);
      }
    }
    fieldScore++; // summary 객체 자체 존재
  } else {
    data.summary = {
      totalEvents: 0, recentEvents: 0, openEvents: 0,
      avgSentiment: 0, scoreSum: 0
    };
    issues.push('summary 전체 누락 - 폴백 적용');
  }

  // topIssues
  if (Array.isArray(raw.topIssues) && raw.topIssues.length > 0) {
    data.topIssues = raw.topIssues.slice(0, 5).map(issue => ({
      title: typeof issue.title === 'string' ? issue.title.trim() : '제목 없음',
      plan: typeof issue.plan === 'string' ? issue.plan.trim() : '계획 없음',
      score: typeof issue.score === 'number' ? issue.score : 0
    }));
    fieldScore += 2; // topIssues 배열 + 항목 존재
  } else {
    data.topIssues = [];
    issues.push('topIssues 누락 - 빈 배열로 폴백');
  }

  // aiRecommendation
  if (typeof raw.aiRecommendation === 'string' && raw.aiRecommendation.trim().length > 0) {
    data.aiRecommendation = raw.aiRecommendation.trim();
    fieldScore++;
  } else {
    data.aiRecommendation = `고객사 ${customerName}에 대한 전략 제언을 생성하지 못했습니다. 데이터를 확인해 주세요.`;
    issues.push('aiRecommendation 누락 - 폴백 적용');
  }

  // parsedStrategy
  if (raw.parsedStrategy && typeof raw.parsedStrategy === 'object') {
    data.parsedStrategy = {};
    for (const field of REQUIRED_STRATEGY_FIELDS) {
      if (typeof raw.parsedStrategy[field] === 'string' && raw.parsedStrategy[field].trim().length > 0) {
        data.parsedStrategy[field] = raw.parsedStrategy[field].trim();
        fieldScore++;
      } else {
        data.parsedStrategy[field] = '-';
        issues.push(`parsedStrategy.${field} 누락 - '-'로 폴백`);
      }
    }
    fieldScore++; // parsedStrategy 객체 자체 존재
  } else {
    data.parsedStrategy = {
      '전략명': '분석 데이터 부족',
      '대상': customerName,
      '요약': 'AI 분석 결과가 불완전합니다.',
      '조치': '원본 데이터 확인 및 재생성 필요',
      '예상 효과': '-'
    };
    issues.push('parsedStrategy 전체 누락 - 폴백 적용');
  }

  // 품질 점수 계산 (0~100)
  const qualityScore = Math.round((fieldScore / maxFieldScore) * 100);

  // evidence 내용 품질 체크
  const evidenceLength = data.evidence.length;
  let contentQuality = 'good';
  if (evidenceLength < 100) contentQuality = 'poor';
  else if (evidenceLength < 300) contentQuality = 'fair';

  return {
    data,
    quality: {
      score: qualityScore,
      contentQuality,
      evidenceLength,
      topIssueCount: data.topIssues.length,
      issues,
      hasFallback: issues.length > 0
    }
  };
}

/**
 * 전체 보고서 데이터(고객사 묶음)를 검증 + 정규화
 */
function validateReportData(rawData) {
  const customerNames = Object.keys(rawData);
  if (customerNames.length === 0) {
    return { valid: false, error: '고객사 데이터가 비어 있습니다.', data: null, qualityReport: null };
  }

  const normalizedData = {};
  const qualityDetails = {};
  let totalScore = 0;
  let totalFallbacks = 0;

  for (const name of customerNames) {
    const { data, quality } = validateAndNormalize(name, rawData[name]);
    normalizedData[name] = data;
    qualityDetails[name] = quality;
    totalScore += quality.score;
    if (quality.hasFallback) totalFallbacks++;
  }

  const avgScore = Math.round(totalScore / customerNames.length);

  return {
    valid: true,
    data: normalizedData,
    qualityReport: {
      avgScore,
      totalCustomers: customerNames.length,
      customersWithFallback: totalFallbacks,
      grade: avgScore >= 90 ? 'A' : avgScore >= 70 ? 'B' : avgScore >= 50 ? 'C' : 'D',
      details: qualityDetails
    }
  };
}

// ─── API 핸들러 ───

/**
 * POST /api/n8n/report/save
 * n8n이 생성한 보고서 데이터를 검증 + 정규화 후 WeeklyReport 테이블에 저장
 */
exports.saveReport = async (req, res, next) => {
  try {
    const { title, weekStart, data } = req.body;

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: 'data 필드는 필수이며 객체(고객사명: 분석결과)여야 합니다.'
      });
    }

    // 검증 + 정규화 + 폴백 처리
    const result = validateReportData(data);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // 제목 자동 생성 (title이 없는 경우)
    const reportTitle = title || generateReportTitle();

    const report = await prisma.weeklyReport.create({
      data: {
        title: reportTitle,
        weekStart: weekStart ? new Date(weekStart) : getWeekStart(),
        data: result.data,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    const converted = convertBigIntToString(report);

    // 품질 로그
    const qr = result.qualityReport;
    console.log(`✅ [n8n] 보고서 저장 완료 - ID: ${report.id}, 제목: ${reportTitle}`);
    console.log(`📊 [n8n] 품질 등급: ${qr.grade} (${qr.avgScore}점), 고객사: ${qr.totalCustomers}개, 폴백: ${qr.customersWithFallback}개`);

    if (qr.customersWithFallback > 0) {
      for (const [name, detail] of Object.entries(qr.details)) {
        if (detail.hasFallback) {
          console.log(`  ⚠️  ${name}: ${detail.issues.join(', ')}`);
        }
      }
    }

    res.status(201).json({
      success: true,
      reportId: converted.id,
      title: converted.title,
      quality: {
        grade: qr.grade,
        score: qr.avgScore,
        totalCustomers: qr.totalCustomers,
        customersWithFallback: qr.customersWithFallback
      }
    });
  } catch (e) {
    console.error('❌ [n8n] 보고서 저장 실패:', e.message);
    next(e);
  }
};

/**
 * GET /api/n8n/health
 * n8n에서 CAR 시스템 가용성 확인
 */
exports.health = async (req, res) => {
  try {
    // DB 연결 확인
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ok',
      version: process.env.APP_VERSION || '2.4.3',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(503).json({
      status: 'error',
      version: process.env.APP_VERSION || '2.4.3',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 보고서 제목 자동 생성: 주간 요약 보고서_AI분석_YYMMDD-##
 */
function generateReportTitle() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `주간 요약 보고서_AI분석_${year}${month}${day}-01`;
}

/**
 * 현재 주의 시작일(월요일) 계산
 */
function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}
