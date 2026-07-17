const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TRACKED_FIELDS = {
  corporation: '법인',
  eventType: '이벤트 유형',
  issueDate: '발생일',
  dueDate: '기한일',
  completionDate: '완료일',
  importance: '중요도',
  mainCategory: '분류',
  openIssue: 'Open Issue',
  followUpPlan: '대응 계획',
  internalScore: '내부 점수',
  customerScore: '고객 점수',
  subjectiveScore: '주관 점수',
  riskMitigation: '리스크 해소',
  riskLevel: '리스크 레벨',
  riskDescription: '리스크 설명',
  receptionChannel: '접수 채널',
  internalContact: '담당자',
};

const BIGINT_DATE_FIELDS = new Set(['issueDate', 'dueDate', 'completionDate']);

function formatValue(field, value) {
  if (value === null || value === undefined || value === '') return '(없음)';
  if (BIGINT_DATE_FIELDS.has(field)) {
    try {
      const ms = typeof value === 'bigint' ? Number(value) : Number(value);
      if (!Number.isFinite(ms)) return String(value);
      return new Date(ms).toISOString().slice(0, 10);
    } catch {
      return String(value);
    }
  }
  if (typeof value === 'boolean') return value ? 'Y' : 'N';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function normalizeForCompare(field, value) {
  if (value === undefined) return null;
  if (value === '') return null;
  if (BIGINT_DATE_FIELDS.has(field) && value !== null) {
    return typeof value === 'bigint' ? Number(value) : Number(value);
  }
  if (value && typeof value === 'object' && 'toString' in value) {
    return value.toString();
  }
  return value;
}

function diffCar(prev, next) {
  const changes = [];
  for (const field of Object.keys(TRACKED_FIELDS)) {
    if (!(field in next)) continue;
    const oldV = normalizeForCompare(field, prev?.[field]);
    const newV = normalizeForCompare(field, next[field]);
    if (oldV === newV) continue;
    if (oldV == null && newV == null) continue;
    if (String(oldV) === String(newV)) continue;
    changes.push({
      field,
      oldValue: formatValue(field, prev?.[field]),
      newValue: formatValue(field, next[field]),
    });
  }
  return changes;
}

async function logCreated(carId, userId) {
  return prisma.carActivityLog.create({
    data: {
      carId: Number(carId),
      userId: userId ? Number(userId) : null,
      activityType: 'CREATED',
      summary: '안건이 생성되었습니다.',
    },
  });
}

async function logUpdated(carId, userId, prev, next) {
  const changes = diffCar(prev, next);
  if (changes.length === 0) return [];
  const created = await Promise.all(
    changes.map(({ field, oldValue, newValue }) =>
      prisma.carActivityLog.create({
        data: {
          carId: Number(carId),
          userId: userId ? Number(userId) : null,
          activityType: 'FIELD_UPDATED',
          changedField: field,
          oldValue,
          newValue,
          summary: `${TRACKED_FIELDS[field]}: ${oldValue} → ${newValue}`,
        },
      })
    )
  );
  return created;
}

async function logContactsChanged(carId, userId, prevUserIds = [], nextUserIds = []) {
  const prevSet = new Set(prevUserIds.map(Number));
  const nextSet = new Set(nextUserIds.map(Number));
  const added = [...nextSet].filter((x) => !prevSet.has(x));
  const removed = [...prevSet].filter((x) => !nextSet.has(x));
  if (added.length === 0 && removed.length === 0) return [];

  const allIds = [...new Set([...added, ...removed])];
  const users = await prisma.user.findMany({
    where: { id: { in: allIds } },
    select: { id: true, name: true },
  });
  const nameOf = (id) => users.find((u) => u.id === id)?.name || `#${id}`;

  const logs = [];
  if (added.length > 0) {
    logs.push(
      await prisma.carActivityLog.create({
        data: {
          carId: Number(carId),
          userId: userId ? Number(userId) : null,
          activityType: 'ASSIGNED',
          summary: `담당자 할당: ${added.map(nameOf).join(', ')}`,
        },
      })
    );
  }
  if (removed.length > 0) {
    logs.push(
      await prisma.carActivityLog.create({
        data: {
          carId: Number(carId),
          userId: userId ? Number(userId) : null,
          activityType: 'UNASSIGNED',
          summary: `담당자 해제: ${removed.map(nameOf).join(', ')}`,
        },
      })
    );
  }
  return logs;
}

async function listByCarId(carId, { limit = 100 } = {}) {
  return prisma.carActivityLog.findMany({
    where: { carId: Number(carId) },
    include: {
      user: { select: { id: true, name: true, department: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: Number(limit),
  });
}

module.exports = {
  logCreated,
  logUpdated,
  logContactsChanged,
  listByCarId,
  diffCar,
  TRACKED_FIELDS,
};
