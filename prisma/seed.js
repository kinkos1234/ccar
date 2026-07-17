// [필수] 아래 패키지 설치 필요:
// npm install @prisma/client prisma csv-parse

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')
const { parse } = require('csv-parse/sync')

const prisma = new PrismaClient()

function parseDate(str) {
  if (!str || !str.trim()) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.getTime();
}

// 점수 계산 함수 (서비스 로직 복사)
function calcDateScore(dueDate, completionDate) {
  if (!dueDate || !completionDate) return 0;
  // BigInt를 Number로 변환
  const dueDateNum = typeof dueDate === 'bigint' ? Number(dueDate) : dueDate;
  const completionDateNum = typeof completionDate === 'bigint' ? Number(completionDate) : completionDate;
  const diff = Math.floor((completionDateNum - dueDateNum) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 5;
  if (diff === 1) return 3;
  if (diff <= 3) return 2;
  if (diff <= 7) return 0;
  if (diff <= 30) return -3;
  return -5;
}
function calcScore(car) {
  if (car.eventType === 'ONE_TIME') {
    return car.subjectiveScore != null ? car.subjectiveScore : 0;
  } else if (car.eventType === 'CONTINUOUS') {
    if (!car.completionDate) return 0;
    const dateScore = calcDateScore(car.dueDate, car.completionDate);
    const internalScore = car.internalScore != null ? car.internalScore : 0;
    const customerScore = car.customerScore != null ? car.customerScore : 0;
    const importance = car.importance != null ? car.importance : 1;
    return (dateScore + internalScore + customerScore) * importance;
  }
  return 0;
}
const POSITIVE_WORDS = [
  '좋다', '만족', '해결', '완료', '성공', '긍정', '향상', '개선', '신속', '안정',
  '친절', '감사', '추천', '신뢰', '정상', '빠르다', '정확', '유익', '도움', '협조',
  '적극', '안전', '청결', '편리', '효율', '믿음', '기쁨', '감동', '쾌적', '원활',
  '정리', '수월', '적합', '적시', '유연', '성실', '정직', '책임', '존중', '배려'
];
const NEGATIVE_WORDS = [
  '불만', '지연', '실패', '문제', '부정', '악화', '지속', '미해결', '오류', '불편',
  '불친절', '불신', '불량', '지체', '누락', '파손', '불가', '불안', '불확실', '불성실',
  '불합리', '불공정', '불쾌', '불만족', '불이행', '불통', '불평', '불충분', '불완전',
  '불일치', '불허', '불법', '불합격', '불응', '불가피', '불가항력', '불가결', '불가분',
  '불가사리', '불가사의', '불가촉', '불가피성'
];
function analyzeSentiment(text) {
  if (!text || typeof text !== 'string') return null;
  let pos = 0, neg = 0;
  for (const w of POSITIVE_WORDS) if (text.includes(w)) pos++;
  for (const w of NEGATIVE_WORDS) if (text.includes(w)) neg++;
  let score = 50 + (pos - neg) * 25;
  if (score > 100) score = 100;
  if (score < 0) score = 0;
  return score;
}
// 점수 정규화 함수 제거 - 원본 값 사용으로 변경
function normalizeScore(score, min = -20, max = 20) {
  // 원본 점수 값을 그대로 반환 (정규화하지 않음)
  if (score == null) return 0;
  return score;
}
function normalizeDateScore(dateScore) {
  if (dateScore == null) return 0;
  if (dateScore < -5) dateScore = -5;
  if (dateScore > 5) dateScore = 5;
  return ((dateScore + 5) / 10) * 100;
}
function calcSentimentScore(car, score) {
  const text = [car.openIssue, car.followUpPlan].filter(Boolean).join(' ');
  const sentiment = analyzeSentiment(text);
  const normScore = normalizeScore(score);
  const normImportance = car.importance != null ? car.importance * 100 : 0;
  let dateScoreVal = 0;
  if (car.eventType === 'CONTINUOUS' && car.completionDate) {
    dateScoreVal = calcDateScore(car.dueDate, car.completionDate);
  }
  const normDateScore = normalizeDateScore(dateScoreVal);
  let sentimentScore = null;
  if (sentiment != null) {
    sentimentScore = 0.4 * sentiment + 0.3 * normScore + 0.2 * normImportance + 0.1 * normDateScore;
    if (sentimentScore > 100) sentimentScore = 100;
    if (sentimentScore < 0) sentimentScore = 0;
  }
  return sentimentScore;
}

function getField(row, key) {
  // 모든 key를 소문자+트림해서 매칭
  const found = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
  return found ? row[found] : undefined;
}

async function main() {
  // Prisma 연결 테스트
  console.log('Prisma 연결 테스트 시작...');
  try {
    await prisma.$connect();
    console.log('Prisma 연결 성공!');
  } catch (e) {
    console.error('Prisma 연결 실패:', e);
    return;
  }

  // 1. ADMIN 계정 upsert (id=1, loginId='admin')
  let adminUser = await prisma.user.findUnique({ where: { loginId: 'admin' } })
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        id: 1,
        loginId: 'admin',
        password: 'comad',
        role: 'ADMIN',
        name: '김정현',
        department: '기술영업',
        email: 'admin@ccar.example.com',
        weeklyReportEmail: true,
      },
    })
    console.log('ADMIN 사용자 생성 완료');
  } else {
    console.log('ADMIN 사용자 이미 존재');
  }

  // CSV 파일 경로
  const csvPath = path.join(__dirname, '../UPLOAD_TEMPLATE_UTF8.csv')
  const csvData = fs.readFileSync(csvPath, 'utf-8')
  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
  })

  // 파싱 결과 로그
  console.log('CSV row count:', records.length);
  console.log('First row:', records[0]);
  console.log('All keys:', Object.keys(records[0] || {}));

  // 1. CustomerContact 시딩 (중복 방지)
  const contactMap = new Map();
  for (const row of records) {
    if (!getField(row, 'customer_contact') || !getField(row, 'customer') || !getField(row, 'customer_department')) continue;
    const contacts = getField(row, 'customer_contact').split(',').map(c => c.trim());
    for (const name of contacts) {
      const key = `${name}|${getField(row, 'customer')}|${getField(row, 'customer_department')}`;
      if (!contactMap.has(key)) {
        contactMap.set(key, {
          name,
          group: getField(row, 'customer'),
          company: null, // 신규 company는 공란
          department: getField(row, 'customer_department'),
          phone: '',
          memo: '',
        });
      }
    }
  }
  console.log('고객 담당자 유니크 건수:', contactMap.size);
  
  // 실제 DB에 삽입
  const contactIdMap = new Map();
  for (const [key, data] of contactMap.entries()) {
    // upsert 대신 createMany로 일괄 삽입(중복 없음 보장)
    const contact = await prisma.customerContact.create({ data });
    contactIdMap.set(key, contact.id);
  }
  console.log('고객 담당자 DB 삽입 완료:', contactIdMap.size);

  // 2. CAR 시딩 (N:M 담당자 연결) - 중복 방지 추가
  let carInsertCount = 0;
  for (const row of records) {
    if (!getField(row, 'customer_contact') || !getField(row, 'customer') || !getField(row, 'customer_department')) continue;
    
    // 중복 체크: openIssue + issueDate + corporation 기준
    const openIssue = getField(row, 'open_issue') || '';
    const issueDate = parseDate(getField(row, 'issue_date')) ? BigInt(parseDate(getField(row, 'issue_date'))) : null;
    const corporation = getField(row, 'corporation') || '';
    
    const existingCar = await prisma.cAR.findFirst({
      where: {
        openIssue,
        issueDate,
        corporation
      }
    });
    
    if (existingCar) {
      console.log(`⚠️ 중복 데이터 스킵: "${openIssue.substring(0, 30)}..."`);
      continue;
    }
    
    const contacts = getField(row, 'customer_contact').split(',').map(c => c.trim());
    // CAR 1건 생성
    // 점수 계산 로직 (서비스와 동일하게)
    const carData = {
      corporation: getField(row, 'corporation') || '',
      eventType: (getField(row, 'event_type') || 'one_time') === 'one_time' ? 'ONE_TIME' : 'CONTINUOUS',
      issueDate: parseDate(getField(row, 'issue_date')) ? BigInt(parseDate(getField(row, 'issue_date'))) : null,
      dueDate: parseDate(getField(row, 'due_date')) ? BigInt(parseDate(getField(row, 'due_date'))) : null,
      importance: getField(row, 'importance') ? parseFloat(getField(row, 'importance')) : 1,
      internalContact: getField(row, 'internal_contact') || '',
      receptionChannel: getField(row, 'reception_channel') || '',
      mainCategory: getField(row, 'main_category') || '',
      openIssue: getField(row, 'open_issue') || '',
      followUpPlan: getField(row, 'follow_up_plan') || '',
      completionDate: parseDate(getField(row, 'completion_date')) ? BigInt(parseDate(getField(row, 'completion_date'))) : null,
      internalScore: getField(row, 'internal_score') ? parseFloat(getField(row, 'internal_score')) : null,
      customerScore: getField(row, 'customer_score') ? parseFloat(getField(row, 'customer_score')) : null,
      subjectiveScore: getField(row, 'subjective_score') ? parseFloat(getField(row, 'subjective_score')) : null,
      aiKeywords: '',
      createdBy: adminUser.id,
    };
    // 점수 계산 (서비스 로직과 동일)
    const score = calcScore(carData);
    const sentimentScore = calcSentimentScore(carData, score);
    const car = await prisma.cAR.create({
      data: {
        ...carData,
        score,
        sentimentScore,
      },
    });
    carInsertCount++;
    
    // 담당자 모두 연결 (CarCustomerContact)
    for (const name of contacts) {
      const key = `${name}|${getField(row, 'customer')}|${getField(row, 'customer_department')}`;
      const customerContactId = contactIdMap.get(key);
      if (customerContactId) {
        await prisma.carCustomerContact.create({
          data: {
            carId: car.id,
            customerContactId,
          },
        });
      }
    }
  }

  console.log('실제 CAR 삽입 건수:', carInsertCount);
  console.log('시드 데이터 삽입 완료')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 