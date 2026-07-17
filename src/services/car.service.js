require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const activityLogService = require('./activityLog.service');
const notificationService = require('./notification.service');

async function getList({ corp, customerGroup, dept, status, importance, sort, order, page = 1, limit = 10, eventType, issueDateStart, issueDateEnd, search, startMonth, endMonth, manager, risk, riskLevel }) {
  // 🔧 파라미터 타입 변환
  page = Number(page) || 1;
  limit = Number(limit) || 10;
  
  let where = {};
  
  // 회사(법인) 필터
  if (corp) where.corporation = corp;
  
  // 고객사 그룹 필터 (복수 선택 지원)
  if (customerGroup && customerGroup !== '전체') {
    // 배열이 아닌 경우 배열로 변환
    const groups = Array.isArray(customerGroup) ? customerGroup : [customerGroup];
    if (groups.length > 0 && groups[0] !== '전체') {
      where.carCustomerContacts = {
        some: {
          CustomerContact: {
            group: {
              in: groups
            }
          }
        }
      };
    }
  }
  
  // 부서 필터 추가
  if (dept) {
    const deptCondition = {
      some: {
        CustomerContact: {
          department: dept
        }
      }
    };
    
    // 기존 carCustomerContacts 조건과 병합
    if (where.carCustomerContacts) {
      where.carCustomerContacts = {
        some: {
          AND: [
            where.carCustomerContacts.some,
            deptCondition.some
          ]
        }
      };
    } else {
      where.carCustomerContacts = deptCondition;
    }
  }
  
  // 담당자 검색 필터 (쉼표로 구분된 복수 검색)
  if (manager && manager.trim()) {
    const managerKeywords = manager.split(',').map(s => s.trim()).filter(Boolean);
    if (managerKeywords.length > 0) {
      const managerConditions = managerKeywords.map(keyword => ({
        OR: [
          { internalContact: { contains: keyword } },
          { 
            carCustomerContacts: { 
              some: { 
                CustomerContact: { 
                  name: { contains: keyword } 
                } 
              } 
            } 
          }
        ]
      }));
      
      where.AND = [...(where.AND || []), ...managerConditions];
    }
  }
  
  // 검색 필터 (내부담당자 + 고객담당자)
  if (search && search.trim()) {
    const searchTerms = search.split(',').map(s => s.trim()).filter(Boolean);
    if (searchTerms.length > 0) {
      const searchConditions = searchTerms.map(term => ({
        OR: [
          { internalContact: { contains: term } },
          { carCustomerContacts: { some: { CustomerContact: { name: { contains: term } } } } }
        ]
      }));
      where.AND = [...(where.AND || []), ...searchConditions];
    }
  }
  
  // 중요도 필터
  if (importance) where.importance = Number(importance);
  
  // 이벤트 타입 필터
  if (eventType) where.eventType = eventType;
  
  // 🆕 Risk Mitigation 필터 (2025-10-01 추가)
  if (risk !== undefined && risk !== null && risk !== 'all') {
    if (risk === 'true' || risk === true) {
      where.riskMitigation = true;
    } else if (risk === 'false' || risk === false) {
      where.riskMitigation = false;
    }
  }
  
  // 🆕 Risk Level 필터 (2025-10-01 추가)
  if (riskLevel && riskLevel !== 'all') {
    where.riskLevel = riskLevel;
  }
  
  // 발행일 범위 필터 (월 기준으로 처리)
  if (issueDateStart || issueDateEnd) {
    where.issueDate = {};
    if (issueDateStart) {
      // 시작월의 첫 날 00:00:00
      const startDate = new Date(issueDateStart);
      where.issueDate.gte = startDate.getTime();
    }
    if (issueDateEnd) {
      // 종료월의 마지막 날 23:59:59
      const endDate = new Date(issueDateEnd);
      endDate.setMonth(endDate.getMonth() + 1); // 다음 달로 이동
      endDate.setDate(0); // 전 달의 마지막 날로 설정
      endDate.setHours(23, 59, 59, 999); // 그 날의 마지막 시각으로 설정
      where.issueDate.lte = endDate.getTime();
    }
  }
  
  // 기간 필터 (월 기준)
  if (startMonth || endMonth) {
    where.issueDate = where.issueDate || {};
    if (startMonth) {
      const startDate = new Date(startMonth);
      where.issueDate.gte = startDate.getTime();
    }
    if (endMonth) {
      const endDate = new Date(endMonth);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      where.issueDate.lte = endDate.getTime();
    }
  }
  
  const skip = (page - 1) * limit;

  // 🚀 성능 최적화: 카운트 쿼리와 데이터 쿼리 병렬 실행
  const [total, items] = await Promise.all([
    prisma.cAR.count({ where }),
    prisma.cAR.findMany({
      where,
      orderBy: sort ? { [sort]: order === 'desc' ? 'desc' : 'asc' } : { id: 'desc' },
      skip,
      take: limit,
      include: {
        // 🎯 선택적 include: 필요한 데이터만 로드
        carCustomerContacts: {
          select: {
            CustomerContact: {
              select: {
                id: true,
                name: true,
                group: true,
                department: true,
                phone: true
              }
            }
          }
        },
        creator: {
          select: {
            id: true,
            loginId: true,
            role: true,
            name: true
          }
        }
      },
    })
  ]);
  
  let resultItems = items.map(car => ({
    ...car,
    customerContacts: car.carCustomerContacts.map(ccc => ccc.CustomerContact),
    status: calcStatus(car),
  }));
  
  // 상태 필터링 (메모리에서 처리)
  if (status && status !== '전체') {
    resultItems = resultItems.filter(car => car.status === status);
  }
  
  // 상태 필터링 후 실제 개수로 total 재계산
  const filteredTotal = resultItems.length;
  
  // 페이징 적용 (상태 필터링 후)
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedItems = resultItems.slice(startIndex, endIndex);
  
  return { 
    total: filteredTotal, 
    page, 
    limit, 
    items: paginatedItems 
  };
}

async function getById(id) {
  const car = await prisma.cAR.findUnique({
    where: { id: Number(id) },
    include: {
      carCustomerContacts: {
        include: { CustomerContact: true }
      },
      carInternalContacts: {
        include: { user: { select: { id: true, name: true, email: true, department: true } } }
      },
      creator: true
    }
  });

  if (!car) return null;

  // dateScore 계산
  let dateScore = null;
  if (car.eventType === 'CONTINUOUS' && car.dueDate && car.completionDate) {
    dateScore = calcDateScore(car.dueDate, car.completionDate);
  }

  return {
    ...car,
    customerContacts: car.carCustomerContacts.map(ccc => ccc.CustomerContact),
    internalContactUsers: car.carInternalContacts.map(cic => cic.user),
    status: calcStatus(car),
    dateScore: dateScore,
  };
}

// score 계산 유틸 함수 (문서 기준)
function calcDateScore(dueDate, completionDate) {
  if (!dueDate || !completionDate) return 0;
  // BigInt를 Number로 변환 (timestamp)
  const dueDateNum = typeof dueDate === 'bigint' ? Number(dueDate) : dueDate;
  const completionDateNum = typeof completionDate === 'bigint' ? Number(completionDate) : completionDate;
  const due = new Date(dueDateNum);
  const comp = new Date(completionDateNum);
  const diff = Math.floor((comp - due) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 5;
  if (diff === 1) return 3;
  if (diff <= 3) return 2;
  if (diff <= 7) return 0;
  if (diff <= 30) return -3;
  return -5;
}

function calcScore(car) {
  if (car.eventType === 'ONE_TIME') {
    return car.subjectiveScore != null ? Number(car.subjectiveScore) : 0;
  } else if (car.eventType === 'CONTINUOUS') {
    if (!car.completionDate) return 0;
    const dateScore = calcDateScore(car.dueDate, car.completionDate);
    const internalScore = car.internalScore != null ? Number(car.internalScore) : 0;
    const customerScore = car.customerScore != null ? Number(car.customerScore) : 0;
    const importance = car.importance != null ? Number(car.importance) : 1;
    return (dateScore + internalScore + customerScore) * importance;
  }
  return 0;
}

// [실무 확장형] sentimentScore 산출을 위한 긍정/부정 단어 리스트(30개 이상, VOC/CRM/품질/고객만족 등)
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
  // 1. 감정분석점수(0~100)
  const text = [car.openIssue, car.followUpPlan].filter(Boolean).join(' ');
  const sentiment = analyzeSentiment(text);
  // 2. score 정규화(0~100)
  const normScore = normalizeScore(score);
  // 3. importance(0~1→0~100)
  const normImportance = car.importance != null ? car.importance * 100 : 0;
  // 4. dateScore 정규화
  let dateScoreVal = 0;
  if (car.eventType === 'CONTINUOUS' && car.completionDate) {
    dateScoreVal = calcDateScore(car.dueDate, car.completionDate);
  }
  const normDateScore = normalizeDateScore(dateScoreVal);
  // 5. 가중합(0.4,0.3,0.2,0.1)
  let sentimentScore = null;
  if (sentiment != null) {
    sentimentScore = 0.4 * sentiment + 0.3 * normScore + 0.2 * normImportance + 0.1 * normDateScore;
    if (sentimentScore > 100) sentimentScore = 100;
    if (sentimentScore < 0) sentimentScore = 0;
  }
  return sentimentScore;
}

function toNullIfEmpty(v) {
  return v === "" || v === undefined ? null : v;
}

function toTimestampOrNull(v) {
  if (!v || v === "" || v === undefined) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(v + 'T00:00:00.000Z').getTime();
  }
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return new Date(v).getTime();
  }
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  return null;
}

async function create(data) {
  const { customerContactIds = [], internalContactUserIds = [], actorUserId, ...carData } = data;
  const transformed = {
    ...carData,
    issueDate: toTimestampOrNull(carData.issueDate),
    dueDate: toTimestampOrNull(carData.dueDate),
    completionDate: toTimestampOrNull(carData.completionDate),
    internalScore: toNullIfEmpty(carData.internalScore),
    customerScore: toNullIfEmpty(carData.customerScore),
    subjectiveScore: toNullIfEmpty(carData.subjectiveScore),
  };
  
  const score = calcScore(transformed);
  const sentimentScore = calcSentimentScore(transformed, score);
  
  const car = await prisma.cAR.create({
    data: {
      ...transformed,
      score,
      sentimentScore,
      carCustomerContacts: {
        create: customerContactIds.map(id => ({ customerContactId: id }))
      },
      carInternalContacts: internalContactUserIds.length > 0 ? {
        create: internalContactUserIds.map(uid => ({ userId: uid }))
      } : undefined
    },
    include: {
      carCustomerContacts: { include: { CustomerContact: true } },
      carInternalContacts: { include: { user: { select: { id: true, name: true, email: true, department: true } } } }
    }
  });
  try {
    await activityLogService.logCreated(car.id, actorUserId);
    if (internalContactUserIds.length > 0) {
      await activityLogService.logContactsChanged(car.id, actorUserId, [], internalContactUserIds);
      await notificationService.notifyAssigned(car.id, actorUserId, internalContactUserIds);
    }
  } catch (e) {
    console.error('[activityLog/notification] create hook failed:', e.message);
  }

  return {
    ...car,
    customerContacts: car.carCustomerContacts.map(ccc => ccc.CustomerContact),
    internalContactUsers: car.carInternalContacts.map(cic => cic.user)
  };
}

async function update(id, data) {
  // 프론트엔드에서 customerContactIds, internalContactUserIds 배열 형태로 보내는 것을 처리
  const customerContactIds = data.customerContactIds?.map(id => Number(id)).filter(Boolean) || [];
  const internalContactUserIds = data.internalContactUserIds?.map(id => Number(id)).filter(Boolean) || [];
  const actorUserId = data.actorUserId;
  const carData = { ...data };
  delete carData.customerContactIds;
  delete carData.customerContacts;
  delete carData.internalContactUserIds;
  delete carData.internalContactUsers;
  delete carData.actorUserId;
  
  const transformed = {
    ...carData,
    issueDate: toTimestampOrNull(carData.issueDate),
    dueDate: toTimestampOrNull(carData.dueDate),
    completionDate: toTimestampOrNull(carData.completionDate),
    internalScore: toNullIfEmpty(carData.internalScore),
    customerScore: toNullIfEmpty(carData.customerScore),
    subjectiveScore: toNullIfEmpty(carData.subjectiveScore),
  };
  
  try {
    const prev = await prisma.cAR.findUnique({
      where: { id: Number(id) },
      include: { carCustomerContacts: true, carInternalContacts: true }
    });

    if (!prev) {
      throw new Error(`CAR with id ${id} not found`);
    }
    const prevInternalUserIds = prev.carInternalContacts.map(c => c.userId);
    
    const score = calcScore({ ...prev, ...transformed });
    const sentimentScore = calcSentimentScore({ ...prev, ...transformed }, score);
    
    // 기존 관계 삭제
    await prisma.carCustomerContact.deleteMany({ where: { carId: Number(id) } });
    await prisma.carInternalContact.deleteMany({ where: { carId: Number(id) } });
    
    // CAR 업데이트
    const car = await prisma.cAR.update({
      where: { id: Number(id) },
      data: {
        ...transformed,
        score,
        sentimentScore,
        carCustomerContacts: {
          create: customerContactIds.map(cid => ({ customerContactId: cid }))
        },
        carInternalContacts: internalContactUserIds.length > 0 ? {
          create: internalContactUserIds.map(uid => ({ userId: uid }))
        } : undefined
      },
      include: {
        carCustomerContacts: { include: { CustomerContact: true } },
        carInternalContacts: { include: { user: { select: { id: true, name: true, email: true, department: true } } } }
      }
    });

    try {
      await activityLogService.logUpdated(car.id, actorUserId, prev, transformed);
      await activityLogService.logContactsChanged(car.id, actorUserId, prevInternalUserIds, internalContactUserIds);
      await notificationService.notifyCarChanges(car, prev, transformed, {
        actorUserId,
        prevInternalUserIds,
        nextInternalUserIds: internalContactUserIds,
      });
    } catch (e) {
      console.error('[activityLog/notification] update hook failed:', e.message);
    }

    return {
      ...car,
      customerContacts: car.carCustomerContacts.map(ccc => ccc.CustomerContact),
      internalContactUsers: car.carInternalContacts.map(cic => cic.user)
    };
  } catch (error) {
    console.error('CAR 업데이트 서비스 오류:', error.message);
    throw error;
  }
}

async function remove(id) {
  try {
    const carId = Number(id);
    
    // 트랜잭션으로 연관 데이터 순차 삭제
    return await prisma.$transaction(async (tx) => {
      // 1. ScoreHistory 삭제
      await tx.scoreHistory.deleteMany({
        where: { carId: carId }
      });
      
      // 2. CarCustomerContact, CarInternalContact 관계 삭제
      await tx.carCustomerContact.deleteMany({
        where: { carId: carId }
      });
      await tx.carInternalContact.deleteMany({
        where: { carId: carId }
      });
      
      // 3. CAR 삭제
      return await tx.cAR.delete({
        where: { id: carId }
      });
    });
  } catch (error) {
    console.error('CAR 삭제 서비스 오류:', error.message);
    throw error;
  }
}

// [필터 옵션] 전체 CAR 데이터에서 유니크 값 추출
async function getFilterOptions() {
  // 모든 CAR 데이터에서 주요 필드 유니크 값 추출
  const cars = await prisma.cAR.findMany({
    select: {
      corporation: true,
      mainCategory: true,
      eventType: true,
      riskMitigation: true,  // 🆕 Risk Mitigation 필드 추가
      riskLevel: true,       // 🆕 Risk Level 필드 추가
    },
  });
  // 고객사명(그룹) 유니크 추출
  const contacts = await prisma.customerContact.findMany({
    select: { group: true },
  });
  // 유니크 값 추출 유틸
  const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));
  
  // 🆕 Risk Mitigation 옵션 생성
  const riskMitigationOptions = [
    { label: "전체", value: "all" },
    { label: "리스크 있음", value: "true" }, 
    { label: "리스크 없음", value: "false" }
  ];
  
  return {
    corporations: unique(cars.map(c => c.corporation)),
    mainCategories: unique(cars.map(c => c.mainCategory)),
    eventTypes: unique(cars.map(c => c.eventType)),
    customers: unique(contacts.map(c => c.group)),
    // 🆕 Risk 관련 필터 옵션 추가
    riskMitigation: riskMitigationOptions,
    riskLevels: ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
  };
}

// [가상 필드] status 계산 함수
function calcStatus(car) {
  try {
    // ONE_TIME 이벤트는 항상 CLOSED
    if (car.eventType === "ONE_TIME") {
      return "CLOSED";
    } 
    
    // CONTINUOUS 이벤트 처리
    if (car.eventType === "CONTINUOUS") {
      // 완료일이 있으면 CLOSED (null, 빈값, "-" 문자열 제외)
      if (car.completionDate && 
          car.completionDate !== null && 
          car.completionDate !== '' && 
          car.completionDate !== '-' &&
          car.completionDate !== 0) {
        return "CLOSED";
      }
      
      // 완료일이 없는 경우 (DELAYED 또는 IN_PROGRESS 판단)
      if (car.dueDate) {
        // BigInt 타입을 Number로 변환 처리
        let dueDateValue;
        if (typeof car.dueDate === 'bigint') {
          dueDateValue = Number(car.dueDate);
        } else if (typeof car.dueDate === 'string') {
          dueDateValue = parseInt(car.dueDate);
        } else {
          dueDateValue = car.dueDate;
        }
        
        // Unix timestamp를 Date 객체로 변환
        const dueDate = new Date(dueDateValue);
        const today = new Date();
        
        // 시간 부분을 제거하고 날짜만 비교 (자정 기준)
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        // 기한일이 오늘보다 이전이면 DELAYED (오늘 제외)
        if (dueDateOnly < todayOnly) {
          return "DELAYED";
        }
      }
      
      // 완료되지 않고 기한도 지나지 않은 경우 IN_PROGRESS
      return "IN_PROGRESS";
    }
    
    // 그 외의 경우 IN_PROGRESS
    return "IN_PROGRESS";
  } catch (err) {
    console.error('상태 계산 오류:', err, car);
    console.error('CAR 데이터:', { 
      id: car.id, 
      eventType: car.eventType, 
      dueDate: car.dueDate, 
      dueDateType: typeof car.dueDate,
      completionDate: car.completionDate 
    });
    return "IN_PROGRESS";
  }
}

// [누적 기간 반영 Score 계산] - BarChart용
function calculateAccumulatedScores(cars, targetDate) {
  const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
  const monthlyScores = new Map();

  cars.forEach(car => {
    const score = Number(car.score) || 0;
    const eventType = car.eventType;
    
    let startDate;
    let duration; // 개월 수

    if (eventType === 'ONE_TIME') {
      // ONE_TIME: issueDate로부터 6개월간
      startDate = new Date(Number(car.issueDate));
      duration = 6;
    } else if (eventType === 'CONTINUOUS') {
      // CONTINUOUS: completionDate로부터 12개월간
      if (!car.completionDate) return; // completionDate가 없으면 스킵
      startDate = new Date(Number(car.completionDate));
      duration = 12;
    } else {
      return; // 알 수 없는 eventType
    }

    // 유효하지 않은 날짜 체크
    if (isNaN(startDate.getTime())) return;

    // 해당 이벤트가 targetDate 월에 영향을 주는지 확인
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + duration, 0);
    
    // targetDate가 startDate ~ endDate 범위에 있는지 확인
    if (endOfMonth >= startDate && targetDate <= endDate) {
      const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyScores.has(monthKey)) {
        monthlyScores.set(monthKey, 0);
      }
      monthlyScores.set(monthKey, monthlyScores.get(monthKey) + score);
    }
  });

  return monthlyScores;
}

// [그룹별 누적 Score 집계] - 법인/고객사/담당자별
async function getAccumulatedScoresByGroup(groupType, targetYear, targetMonth, filters = {}) {
  try {
    const targetDate = new Date(targetYear, targetMonth - 1, 1);
    
    let whereClause = {};
    
    // 회사 필터
    if (filters.corp && filters.corp !== '전체') {
      whereClause.corporation = filters.corp;
    }
    
    // 고객사 그룹 복수 선택 필터
    if (filters.customerGroups && filters.customerGroups.length > 0) {
      whereClause.carCustomerContacts = {
        some: {
          CustomerContact: {
            group: {
              in: filters.customerGroups
            }
          }
        }
      };
    }
    
    // 부서 필터
    if (filters.dept && filters.dept !== '전체') {
      whereClause.carCustomerContacts = {
        some: {
          CustomerContact: {
            department: filters.dept
          }
        }
      };
    }
    
    // 담당자 검색 필터 (내부담당자 + 고객담당자)
    if (filters.manager && filters.manager.trim()) {
      const searchTerms = filters.manager.split(',').map(s => s.trim()).filter(Boolean);
      if (searchTerms.length > 0) {
        const searchConditions = searchTerms.map(term => ({
          OR: [
            { internalContact: { contains: term } },
            { carCustomerContacts: { some: { CustomerContact: { name: { contains: term } } } } }
          ]
        }));
        whereClause.AND = [...(whereClause.AND || []), ...searchConditions];
      }
    }
    
    // 날짜 범위 필터 (월 단위)
    if (filters.startMonth || filters.endMonth) {
      const dateFilters = {};
      if (filters.startMonth) {
        const startDate = new Date(`${filters.startMonth}-01`);
        dateFilters.gte = startDate.getTime().toString();
      }
      if (filters.endMonth) {
        const endDate = new Date(`${filters.endMonth}-01`);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0); // 해당 월의 마지막 일
        dateFilters.lte = endDate.getTime().toString();
      }
      whereClause.issueDate = dateFilters;
    }
    
    const cars = await prisma.cAR.findMany({
      where: whereClause,
      include: {
        carCustomerContacts: {
          include: { CustomerContact: true } 
        },
        creator: true
      }
    });

    // 상태 필터링 (메모리에서 처리)
    let filteredCars = cars;
    if (filters.status && filters.status !== '전체') {
      filteredCars = cars.filter(car => {
        const status = calcStatus(car);
        return status === filters.status;
      });
    }

    // 그룹별 통계 집계
    const groupStats = new Map();
    
    filteredCars.forEach(car => {
      const monthlyScores = calculateAccumulatedScores([car], targetDate);
      const monthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      const accumulatedScore = monthlyScores.get(monthKey) || 0;
      
      let groupKeys = [];

      if (groupType === 'company') {
        groupKeys = [car.corporation || 'Unknown'];
      } else if (groupType === 'customer') {
        const customerContacts = car.carCustomerContacts || [];
        if (customerContacts.length > 0) {
          customerContacts.forEach(cc => {
            if (cc.CustomerContact && cc.CustomerContact.group) {
              groupKeys.push(cc.CustomerContact.group);
            }
          });
        }
        if (groupKeys.length === 0) {
          groupKeys = ['Unknown'];
        }
      } else if (groupType === 'manager') {
        const customerContacts = car.carCustomerContacts || [];
        if (customerContacts.length > 0) {
          customerContacts.forEach(cc => {
            if (cc.CustomerContact && cc.CustomerContact.name) {
              groupKeys.push(cc.CustomerContact.name);
            }
          });
        }
        if (groupKeys.length === 0) {
          groupKeys = ['Unknown'];
        }
      }

      groupKeys.forEach(groupKey => {
        if (!groupStats.has(groupKey)) {
          groupStats.set(groupKey, {
            name: groupKey,
            accumulatedScore: 0,
            sentimentScore: 0,
            sentimentCount: 0,
            eventCount: 0
          });
        }
        
        const group = groupStats.get(groupKey);
        group.accumulatedScore += accumulatedScore;
        
        // sentiment 점수가 있는 경우만 평균 계산에 포함
        const carSentimentScore = Number(car.sentimentScore) || 0;
        if (carSentimentScore > 0) {
          group.sentimentScore += carSentimentScore;
          group.sentimentCount += 1;
        }
        
        // ✅ 모든 이벤트를 카운트 (0점도 유효한 데이터)
        group.eventCount += 1;
      });
    });

    // ✅ 결과 정렬 및 반환 (0점 그룹도 포함)
    const result = Array.from(groupStats.values())
      .filter(group => group.eventCount > 0) // 이벤트가 있는 그룹만 포함
      .sort((a, b) => b.accumulatedScore - a.accumulatedScore)
      .map(group => ({
        name: group.name,
        accumulatedScore: Math.round(group.accumulatedScore * 100) / 100,
        sentimentScore: group.sentimentCount > 0 
          ? Math.round((group.sentimentScore / group.sentimentCount) * 100) / 100 
          : 0,
        eventCount: group.eventCount
      }));

    return result;
  } catch (error) {
    console.error('getAccumulatedScoresByGroup 오류:', error);
    throw error;
  }
}

// [월별 누적 추이 데이터 계산] - Line Chart용 (그룹별 상세 데이터 반환)
async function getMonthlyTrend(groupType, months, filters = {}) {
  try {
    // 필터 조건 구성 (getAccumulatedScoresByGroup과 동일)
    const where = {};
    if (filters.corp) where.corporation = filters.corp;
    
    if (filters.customerGroup) {
      const groups = Array.isArray(filters.customerGroup) ? filters.customerGroup : [filters.customerGroup];
      if (groups.length > 0) {
        where.carCustomerContacts = {
          some: {
            CustomerContact: {
              group: { in: groups }
            }
          }
        };
      }
    }
    
    if (filters.dept) {
      const deptCondition = {
        some: {
          CustomerContact: {
            department: filters.dept
          }
        }
      };
      
      if (where.carCustomerContacts) {
        where.carCustomerContacts = {
          some: {
            AND: [
              where.carCustomerContacts.some,
              deptCondition.some
            ]
          }
        };
      } else {
        where.carCustomerContacts = deptCondition;
      }
    }
    
    // 담당자 검색 필터 (내부담당자 + 고객담당자)
    if (filters.manager && filters.manager.trim()) {
      const searchTerms = filters.manager.split(',').map(s => s.trim()).filter(Boolean);
      if (searchTerms.length > 0) {
        const searchConditions = searchTerms.map(term => ({
          OR: [
            { internalContact: { contains: term } },
            { carCustomerContacts: { some: { CustomerContact: { name: { contains: term } } } } }
          ]
        }));
        where.AND = [...(where.AND || []), ...searchConditions];
      }
    }
    
    // 상태 필터는 조회 후 메모리에서 처리 (동적 계산이므로)

    // CAR 데이터 조회 (필터 적용)
    let cars = await prisma.cAR.findMany({
      where,
      include: {
        carCustomerContacts: { 
          include: { CustomerContact: true } 
        },
        creator: true
      }
    });

    // 상태 필터링 (메모리에서 처리)
    if (filters.status && filters.status !== '전체') {
      cars = cars.filter(car => {
        const status = calcStatus(car);
        return status === filters.status;
      });
    }

    const monthlyData = [];

    // 각 월별로 그룹별 상세 데이터 계산
    for (const monthInfo of months) {
      const { year, month, label } = monthInfo;
      const targetDate = new Date(year, month - 1, 1); // 해당 월의 1일
      
      // 그룹별 통계 맵
      const groupStats = new Map();

      // 1단계: 모든 그룹을 먼저 수집 (점수 0으로 초기화)
      if (groupType === 'customer') {
        const allCustomerGroups = await prisma.customerContact.findMany({
          select: { group: true },
          distinct: ['group']
        });
        allCustomerGroups.forEach(contact => {
          if (contact.group && !groupStats.has(contact.group)) {
            groupStats.set(contact.group, {
              name: contact.group,
              accumulatedScore: 0,
              sentimentScore: 0,
              sentimentCount: 0,
              eventCount: 0
            });
          }
        });
      } else if (groupType === 'manager') {
        const allManagers = await prisma.customerContact.findMany({
          select: { name: true },
          distinct: ['name']
        });
        allManagers.forEach(contact => {
          if (contact.name && !groupStats.has(contact.name)) {
            groupStats.set(contact.name, {
              name: contact.name,
              accumulatedScore: 0,
              sentimentScore: 0,
              sentimentCount: 0,
              eventCount: 0
            });
          }
        });
      } else if (groupType === 'company') {
        // 법인의 경우 CAR 데이터에서 corporation 수집
        const allCorporations = new Set();
        cars.forEach(car => {
          const corp = car.corporation || 'Unknown';
          allCorporations.add(corp);
        });
        allCorporations.forEach(corp => {
          if (!groupStats.has(corp)) {
            groupStats.set(corp, {
              name: corp,
              accumulatedScore: 0,
              sentimentScore: 0,
              sentimentCount: 0,
              eventCount: 0
            });
          }
        });
      }

      // 2단계: CAR 데이터로 누적 점수 계산 (BarChart와 동일한 로직)
      cars.forEach(car => {
        const monthlyScores = calculateAccumulatedScores([car], targetDate);
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const accumulatedScore = monthlyScores.get(monthKey) || 0;
        
        let groupKeys = [];

        if (groupType === 'company') {
          groupKeys = [car.corporation || 'Unknown'];
        } else if (groupType === 'customer') {
          const customerContacts = car.carCustomerContacts || [];
          if (customerContacts.length > 0) {
            customerContacts.forEach(cc => {
              if (cc.CustomerContact && cc.CustomerContact.group) {
                groupKeys.push(cc.CustomerContact.group);
              }
            });
          }
          if (groupKeys.length === 0) {
            groupKeys = ['Unknown']; // 고객사 정보가 없는 경우
          }
        } else if (groupType === 'manager') {
          const customerContacts = car.carCustomerContacts || [];
          if (customerContacts.length > 0) {
            customerContacts.forEach(cc => {
              if (cc.CustomerContact && cc.CustomerContact.name) {
                groupKeys.push(cc.CustomerContact.name);
              }
            });
          }
          if (groupKeys.length === 0) {
            groupKeys = ['Unknown']; // 담당자 정보가 없는 경우
          }
        }

        groupKeys.forEach(groupKey => {
          if (!groupStats.has(groupKey)) {
            groupStats.set(groupKey, {
              name: groupKey,
              accumulatedScore: 0,
              sentimentScore: 0,
              sentimentCount: 0,
              eventCount: 0
            });
          }
          
          const group = groupStats.get(groupKey);
          group.accumulatedScore += accumulatedScore;
          
          // ✅ sentiment 점수가 있는 경우만 평균 계산에 포함
          const carSentimentScore = Number(car.sentimentScore) || 0;
          if (carSentimentScore > 0) {
            group.sentimentScore += carSentimentScore;
            group.sentimentCount += 1;
          }
          
          if (accumulatedScore > 0) {
            group.eventCount += 1;
          }
        });
      });

      // 3단계: 그룹별 상세 데이터 생성 (상위 10개 그룹만)
      const groupArray = Array.from(groupStats.values())
        .filter(group => group.accumulatedScore > 0 || group.eventCount > 0)
        .sort((a, b) => b.accumulatedScore - a.accumulatedScore)
        .slice(0, 10); // 상위 10개 그룹만 (차트 가독성을 위해)

      monthlyData.push({
        month: label,
        year: year,
        monthKey: month,
        monthKeyYear: `${year}-${String(month).padStart(2, '0')}`,
        groups: groupArray.map(group => ({
          name: group.name,
          score: Math.round(group.accumulatedScore * 100) / 100,
          sentimentScore: group.sentimentCount > 0 
            ? Math.round((group.sentimentScore / group.sentimentCount) * 100) / 100 
            : 0,
          eventCount: group.eventCount
        }))
      });
    }

    return monthlyData;
  } catch (error) {
    console.error('getMonthlyTrend 오류:', error);
    throw error;
  }
}

// 전체 상태 통계 조회
async function getStatusStats() {
  const allCars = await prisma.cAR.findMany({
    include: {
      carCustomerContacts: {
        include: { CustomerContact: true }
      },
      creator: true
    }
  });

  // 상태별 카운트 계산
  const stats = {
    CLOSED: 0,
    IN_PROGRESS: 0,
    DELAYED: 0,
    total: allCars.length
  };

  allCars.forEach(car => {
    const status = calcStatus(car);
    stats[status]++;
  });

  return stats;
}

// 🆕 Risk Analytics API (2025-10-01 추가)
async function getRiskAnalytics(filters = {}) {
  // 기본 필터링 조건 구성
  let where = { riskMitigation: true }; // Risk 이벤트만 대상
  
  // 추가 필터링 적용
  if (filters.corp) where.corporation = filters.corp;
  if (filters.eventType) where.eventType = filters.eventType;
  if (filters.riskLevel) where.riskLevel = filters.riskLevel;
  
  // Risk 이벤트들 조회
  const riskEvents = await prisma.cAR.findMany({
    where,
    include: {
      carCustomerContacts: {
        include: { CustomerContact: true }
      }
    }
  });
  
  // 상태 계산 및 통계 생성
  const eventsWithStatus = riskEvents.map(car => ({
    ...car,
    status: calcStatus(car),
    customerContacts: car.carCustomerContacts.map(ccc => ccc.CustomerContact)
  }));
  
  // 기본 통계
  const totalRiskEvents = eventsWithStatus.length;
  const completedRiskEvents = eventsWithStatus.filter(e => e.status === 'CLOSED').length;
  const completionRate = totalRiskEvents > 0 ? (completedRiskEvents / totalRiskEvents) * 100 : 0;
  const avgScore = eventsWithStatus.length > 0 
    ? eventsWithStatus.reduce((sum, e) => sum + (e.score || 0), 0) / eventsWithStatus.length 
    : 0;
  
  // 카테고리별 통계
  const byCategory = {};
  eventsWithStatus.forEach(event => {
    const category = event.mainCategory || '미분류';
    if (!byCategory[category]) {
      byCategory[category] = { riskCount: 0, completedCount: 0 };
    }
    byCategory[category].riskCount++;
    if (event.status === 'CLOSED') {
      byCategory[category].completedCount++;
    }
  });
  
  const categoriesWithRate = Object.entries(byCategory).map(([category, data]) => ({
    mainCategory: category,
    riskCount: data.riskCount,
    completionRate: data.riskCount > 0 ? (data.completedCount / data.riskCount) * 100 : 0
  }));
  
  // 고객사별 통계
  const byCustomer = {};
  eventsWithStatus.forEach(event => {
    const customers = event.customerContacts.map(c => c.group).filter(Boolean);
    customers.forEach(customer => {
      if (!byCustomer[customer]) {
        byCustomer[customer] = { riskCount: 0, totalScore: 0, events: [] };
      }
      byCustomer[customer].riskCount++;
      byCustomer[customer].totalScore += (event.score || 0);
      byCustomer[customer].events.push(event);
    });
  });
  
  const customersWithAvg = Object.entries(byCustomer).map(([customer, data]) => ({
    customer,
    riskCount: data.riskCount,
    avgScore: data.riskCount > 0 ? data.totalScore / data.riskCount : 0
  }));
  
  return {
    summary: {
      totalRiskEvents,
      completedRiskEvents,
      completionRate: Math.round(completionRate * 100) / 100, // 소수점 2자리
      avgScore: Math.round(avgScore * 100) / 100
    },
    byCategory: categoriesWithRate,
    byCustomer: customersWithAvg
  };
}

module.exports = {
  getList,
  getById,
  create,
  update,
  remove,
  // 필터 옵션 추가
  getFilterOptions,
  calcStatus,
  calculateAccumulatedScores,
  getAccumulatedScoresByGroup,
  getMonthlyTrend,
  getStatusStats,
  // 🆕 Risk Analytics 추가
  getRiskAnalytics
}; 