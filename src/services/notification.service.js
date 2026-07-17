const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const N8N_NOTIFICATION_WEBHOOK_URL = process.env.N8N_NOTIFICATION_WEBHOOK_URL || '';
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || '';

const NOTIFICATION_TYPES = {
  RISK_ALERT: 'RISK_ALERT',
  DUE_DATE_APPROACHING: 'DUE_DATE_APPROACHING',
  OVERDUE: 'OVERDUE',
  ASSIGNED: 'ASSIGNED',
  RISK_LEVEL_UP: 'RISK_LEVEL_UP',
};

const RISK_LEVEL_ORDER = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

function msToDate(ms) {
  if (ms == null) return null;
  const n = typeof ms === 'bigint' ? Number(ms) : Number(ms);
  if (!Number.isFinite(n)) return null;
  return new Date(n);
}

function daysBetween(a, b) {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY);
}

async function createNotification({ userId, carId, type, title, message, sendEmail = true }) {
  const notification = await prisma.notification.create({
    data: {
      userId: Number(userId),
      carId: carId ? Number(carId) : null,
      type,
      title,
      message,
    },
    include: {
      user: { select: { id: true, name: true, email: true, notificationEmail: true, preferredLanguage: true } },
      car: { select: { id: true, corporation: true, openIssue: true } },
    },
  });

  if (sendEmail && notification.user?.notificationEmail && notification.user?.email) {
    sendEmailViaN8n(notification).catch((e) => {
      console.error('[notification] n8n email dispatch failed:', e.message);
    });
  }
  return notification;
}

async function sendEmailViaN8n(notification) {
  if (!N8N_NOTIFICATION_WEBHOOK_URL) {
    console.warn('[notification] N8N_NOTIFICATION_WEBHOOK_URL not configured — skipping email');
    return;
  }
  const payload = {
    notificationId: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    recipient: {
      userId: notification.user.id,
      name: notification.user.name,
      email: notification.user.email,
      language: notification.user.preferredLanguage || 'ko',
    },
    car: notification.car
      ? {
          id: notification.car.id,
          corporation: notification.car.corporation,
          openIssue: notification.car.openIssue,
          url: `${process.env.APP_BASE_URL || ''}/car/${notification.car.id}`,
        }
      : null,
    createdAt: notification.createdAt,
  };

  const res = await fetch(N8N_NOTIFICATION_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-Webhook-Secret': N8N_WEBHOOK_SECRET,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`n8n webhook returned ${res.status}`);
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { emailSent: true, emailSentAt: new Date() },
  });
}

async function notifyAssigned(carId, actorUserId, assignedUserIds = []) {
  if (!Array.isArray(assignedUserIds) || assignedUserIds.length === 0) return [];
  const car = await prisma.cAR.findUnique({
    where: { id: Number(carId) },
    select: { id: true, corporation: true, openIssue: true, dueDate: true },
  });
  if (!car) return [];

  const recipients = assignedUserIds.filter((uid) => Number(uid) !== Number(actorUserId));
  const results = [];
  for (const uid of recipients) {
    results.push(
      await createNotification({
        userId: uid,
        carId: car.id,
        type: NOTIFICATION_TYPES.ASSIGNED,
        title: '새 안건 담당자로 지정되었습니다',
        message: `${car.corporation} / ${car.openIssue || '(제목 없음)'}`,
      })
    );
  }
  return results;
}

async function notifyCarChanges(car, prev, next, { actorUserId, prevInternalUserIds = [], nextInternalUserIds = [] } = {}) {
  const notifications = [];

  const newAssignees = nextInternalUserIds.filter((uid) => !prevInternalUserIds.includes(Number(uid)));
  if (newAssignees.length > 0) {
    notifications.push(...(await notifyAssigned(car.id, actorUserId, newAssignees)));
  }

  const prevLevel = RISK_LEVEL_ORDER[prev?.riskLevel] || 0;
  const nextLevel = RISK_LEVEL_ORDER[next?.riskLevel] || 0;
  if (nextLevel > prevLevel && next?.riskLevel && (next.riskLevel === 'HIGH' || next.riskLevel === 'CRITICAL')) {
    const recipients = await getCarRecipients(car.id, actorUserId);
    for (const uid of recipients) {
      notifications.push(
        await createNotification({
          userId: uid,
          carId: car.id,
          type: NOTIFICATION_TYPES.RISK_LEVEL_UP,
          title: `리스크 레벨이 ${next.riskLevel}로 상향되었습니다`,
          message: `${car.corporation} / ${car.openIssue || '(제목 없음)'}`,
        })
      );
    }
  }

  return notifications;
}

async function getCarRecipients(carId, excludeUserId) {
  const contacts = await prisma.carInternalContact.findMany({
    where: { carId: Number(carId) },
    select: { userId: true },
  });
  return contacts.map((c) => c.userId).filter((uid) => Number(uid) !== Number(excludeUserId));
}

async function runDueDateScan({ today = new Date() } = {}) {
  const cars = await prisma.cAR.findMany({
    where: {
      completionDate: null,
      dueDate: { not: null },
    },
    select: {
      id: true,
      corporation: true,
      openIssue: true,
      dueDate: true,
      createdBy: true,
      carInternalContacts: { select: { userId: true } },
    },
  });

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const results = [];

  for (const car of cars) {
    const due = msToDate(car.dueDate);
    if (!due) continue;
    const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diff = daysBetween(todayStart, dueStart);

    let type = null;
    let title = null;
    if (diff < 0) {
      type = NOTIFICATION_TYPES.OVERDUE;
      title = `기한 초과: ${Math.abs(diff)}일 경과`;
    } else if (diff === 0) {
      type = NOTIFICATION_TYPES.DUE_DATE_APPROACHING;
      title = '오늘이 기한일입니다';
    } else if (diff === 1) {
      type = NOTIFICATION_TYPES.DUE_DATE_APPROACHING;
      title = '기한일 1일 전입니다';
    } else if (diff === 3) {
      type = NOTIFICATION_TYPES.DUE_DATE_APPROACHING;
      title = '기한일 3일 전입니다';
    } else {
      continue;
    }

    let recipients = car.carInternalContacts.map((c) => c.userId);
    if (recipients.length === 0 && car.createdBy) {
      recipients = [car.createdBy];
    }
    for (const uid of recipients) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: uid,
          carId: car.id,
          type,
          createdAt: { gte: todayStart },
        },
      });
      if (existing) continue;

      const message = `${car.corporation} / ${car.openIssue || '(제목 없음)'} (기한: ${due.toISOString().slice(0, 10)})`;
      results.push(
        await createNotification({
          userId: uid,
          carId: car.id,
          type,
          title,
          message,
        })
      );
    }
  }
  return results;
}

async function listForUser(userId, { limit = 50, unreadOnly = false } = {}) {
  return prisma.notification.findMany({
    where: {
      userId: Number(userId),
      ...(unreadOnly ? { isRead: false } : {}),
    },
    include: {
      car: { select: { id: true, corporation: true, openIssue: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: Number(limit),
  });
}

async function countUnread(userId) {
  return prisma.notification.count({
    where: { userId: Number(userId), isRead: false },
  });
}

async function markRead(id, userId) {
  return prisma.notification.updateMany({
    where: { id: Number(id), userId: Number(userId) },
    data: { isRead: true, readAt: new Date() },
  });
}

async function markAllRead(userId) {
  return prisma.notification.updateMany({
    where: { userId: Number(userId), isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

module.exports = {
  NOTIFICATION_TYPES,
  createNotification,
  notifyAssigned,
  notifyCarChanges,
  runDueDateScan,
  listForUser,
  countUnread,
  markRead,
  markAllRead,
};
