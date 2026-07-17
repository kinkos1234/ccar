// 데모 시드 — 로컬 실행용 더미 데이터 (계정·법인·고객·VOC).
// 원본 CSV 임포터(prisma/seed.js)와 달리 외부 파일 의존 없이 즉시 실행 가능.
//   node scripts/seed-demo.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const CORPORATIONS = ['CMKR', 'CMMPL', 'CMVN', 'CMSJ', 'CMMX', 'CMCZ'];
const DAY = 24 * 60 * 60 * 1000;

function calcDateScore(dueDate, completionDate) {
  if (!dueDate || !completionDate) return 0;
  const diff = Math.floor((completionDate - dueDate) / DAY);
  if (diff <= 0) return 5;
  if (diff === 1) return 3;
  if (diff <= 3) return 2;
  if (diff <= 7) return 0;
  if (diff <= 30) return -3;
  return -5;
}

async function main() {
  // 1. 사용자 (bcrypt 해시)
  const users = [
    { loginId: 'admin', password: 'admin123', role: 'ADMIN', name: '시스템 관리자', department: 'IT', email: 'admin@ccar.example.com', weeklyReportEmail: true },
    { loginId: 'manager', password: 'manager123', role: 'MANAGER', name: '팀장', department: '영업팀', email: 'manager@ccar.example.com', weeklyReportEmail: true },
    { loginId: 'staff', password: 'staff123', role: 'STAFF', name: '직원', department: '영업팀', email: 'staff@ccar.example.com' },
  ];
  for (const u of users) {
    const { password, ...rest } = u;
    await prisma.user.upsert({
      where: { loginId: u.loginId },
      update: {},
      create: { ...rest, password: await bcrypt.hash(password, 10) },
    });
  }

  // 2. 법인 설정
  for (const corporation of CORPORATIONS) {
    await prisma.corporationSettings.upsert({
      where: { corporation },
      update: {},
      create: { corporation, defaultLanguage: corporation === 'CMKR' ? 'ko' : 'en' },
    });
  }

  // 3. 보고 메일 수신자
  for (const email of ['admin@ccar.example.com', 'manager@ccar.example.com']) {
    await prisma.managementEmail.upsert({ where: { email }, update: {}, create: { email } });
  }

  // 4. 고객 담당자
  const customerRows = [
    { name: '홍길동', group: 'A그룹', company: '한빛물산', department: '구매팀', phone: '010-0000-0001', email: 'hong@hanbit.example.com' },
    { name: '김민수', group: 'A그룹', company: '한빛물산', department: '품질팀', phone: '010-0000-0002', email: 'kim@hanbit.example.com' },
    { name: '이서연', group: 'B그룹', company: '누리테크', department: '개발팀', phone: '010-0000-0003', email: 'lee@nuri.example.com' },
    { name: '박지훈', group: 'B그룹', company: '누리테크', department: '운영팀', phone: '010-0000-0004', email: 'park@nuri.example.com' },
    { name: 'Carlos Diaz', group: 'C그룹', company: 'Andes Trading', department: 'Procurement', phone: '+52-55-0000-0005', email: 'carlos@andes.example.com' },
    { name: 'Nguyen Anh', group: 'C그룹', company: 'Mekong Supply', department: 'QA', phone: '+84-90-000-0006', email: 'anh@mekong.example.com' },
  ];
  const customers = [];
  for (const c of customerRows) {
    let row = await prisma.customerContact.findFirst({ where: { name: c.name, phone: c.phone } });
    if (!row) row = await prisma.customerContact.create({ data: c });
    customers.push(row);
  }

  // 5. VOC (CAR) — 최근 8주에 분산, 완료/진행 혼합
  const admin = await prisma.user.findUnique({ where: { loginId: 'admin' } });
  const now = Date.now();
  const carRows = [
    { corporation: 'CMKR', eventType: 'CONTINUOUS', ago: 55, dueIn: 7, doneIn: 5, importance: 3, internalScore: 2, customerScore: 1, channel: 'EMAIL', mainCategory: '납기', openIssue: '납품 일정 지연 문의 — 3주 연속 지연에 대한 개선 요구', followUpPlan: '생산 라인 우선순위 재조정 및 주간 진행 공유' },
    { corporation: 'CMKR', eventType: 'CONTINUOUS', ago: 48, dueIn: 14, doneIn: 16, importance: 2, internalScore: 1, customerScore: 2, channel: 'CALL', mainCategory: '품질', openIssue: '납품 로트 표면 결함 반복 발생', followUpPlan: '공정 검사 기준 강화, 결함 로트 전수 재검' },
    { corporation: 'CMKR', eventType: 'ONE_TIME', ago: 40, subjectiveScore: 4, importance: 1, channel: 'VISIT', mainCategory: '서비스', openIssue: '정기 방문 미팅 — 신규 라인 증설 계획 공유', followUpPlan: '증설 일정에 맞춘 공급 계획 제출' },
    { corporation: 'CMKR', eventType: 'CONTINUOUS', ago: 30, dueIn: 10, importance: 3, channel: 'EMAIL', mainCategory: '납기', openIssue: '긴급 발주분 리드타임 단축 요청', followUpPlan: '안전재고 활용 검토 중', risk: true, riskLevel: 'HIGH', riskDescription: '경쟁사 전환 검토 언급' },
    { corporation: 'CMMPL', eventType: 'CONTINUOUS', ago: 35, dueIn: 7, doneIn: 3, importance: 2, internalScore: 2, customerScore: 2, channel: 'EMAIL', mainCategory: '품질', openIssue: 'Packaging damage during transit', followUpPlan: 'Switch to reinforced packaging spec' },
    { corporation: 'CMMPL', eventType: 'ONE_TIME', ago: 21, subjectiveScore: 3, importance: 1, channel: 'OTHER', mainCategory: '가격', openIssue: 'Annual price review request', followUpPlan: 'Cost breakdown to be shared next quarter' },
    { corporation: 'CMVN', eventType: 'CONTINUOUS', ago: 28, dueIn: 5, doneIn: 9, importance: 2, internalScore: 0, customerScore: 1, channel: 'CALL', mainCategory: '납기', openIssue: 'Customs clearance delay on inbound materials', followUpPlan: 'Broker escalation path agreed' },
    { corporation: 'CMVN', eventType: 'CONTINUOUS', ago: 14, dueIn: 10, importance: 3, channel: 'EMAIL', mainCategory: '품질', openIssue: 'Dimensional tolerance drift on recent lots', followUpPlan: 'Joint measurement session scheduled', risk: true, riskLevel: 'MEDIUM', riskDescription: 'Repeat claim within 60 days' },
    { corporation: 'CMSJ', eventType: 'ONE_TIME', ago: 18, subjectiveScore: 5, importance: 2, channel: 'VISIT', mainCategory: '서비스', openIssue: '경영진 정기 리뷰 — 협력 만족도 상위 평가', followUpPlan: '차년도 물량 확대 논의' },
    { corporation: 'CMMX', eventType: 'CONTINUOUS', ago: 12, dueIn: 7, doneIn: 6, importance: 1, internalScore: 1, customerScore: 0, channel: 'EMAIL', mainCategory: '납기', openIssue: 'Partial shipment request for urgent order', followUpPlan: 'Split delivery arranged' },
    { corporation: 'CMMX', eventType: 'CONTINUOUS', ago: 7, dueIn: 14, importance: 2, channel: 'CALL', mainCategory: '품질', openIssue: 'Labeling mismatch on two pallets', followUpPlan: 'Relabeling + root cause under review' },
    { corporation: 'CMCZ', eventType: 'ONE_TIME', ago: 5, subjectiveScore: 2, importance: 1, channel: 'EMAIL', mainCategory: '기타', openIssue: 'ESG compliance questionnaire request', followUpPlan: 'Document package in preparation' },
  ];

  const existing = await prisma.cAR.count();
  if (existing > 0) {
    console.log(`CAR ${existing}건 존재 — VOC 데모 데이터 생성 스킵`);
  } else {
    let i = 0;
    for (const r of carRows) {
      const issueDate = now - r.ago * DAY;
      const dueDate = r.dueIn ? issueDate + r.dueIn * DAY : null;
      const completionDate = r.doneIn ? issueDate + r.doneIn * DAY : null;
      let score = null;
      if (r.eventType === 'ONE_TIME') {
        score = r.subjectiveScore ?? 0;
      } else if (completionDate) {
        score = (calcDateScore(dueDate, completionDate) + (r.internalScore ?? 0) + (r.customerScore ?? 0)) * r.importance;
      }
      const car = await prisma.cAR.create({
        data: {
          corporation: r.corporation,
          eventType: r.eventType,
          issueDate: BigInt(issueDate),
          dueDate: dueDate ? BigInt(dueDate) : null,
          completionDate: completionDate ? BigInt(completionDate) : null,
          importance: r.importance,
          internalScore: r.internalScore ?? null,
          customerScore: r.customerScore ?? null,
          subjectiveScore: r.subjectiveScore ?? null,
          score,
          receptionChannel: r.channel,
          mainCategory: r.mainCategory,
          openIssue: r.openIssue,
          followUpPlan: r.followUpPlan,
          riskMitigation: r.risk ?? false,
          riskLevel: r.riskLevel ?? 'MEDIUM',
          riskDescription: r.riskDescription ?? null,
          createdBy: admin.id,
          carCustomerContacts: { create: [{ customerContactId: customers[i % customers.length].id }] },
        },
      });
      i += 1;
      console.log(`CAR #${car.id} (${r.corporation}/${r.eventType}) 생성`);
    }
  }

  console.log('✅ 데모 시드 완료 — 계정: admin/admin123, manager/manager123, staff/staff123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
