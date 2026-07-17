// 이벤트 유틸리티
const { v4: uuidv4 } = require('uuid');

// 이벤트 타입 정의
const EventTypes = {
  // 인증
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  
  // CAR CRUD
  CAR_CREATED: 'CAR_CREATED',
  CAR_UPDATED: 'CAR_UPDATED',
  CAR_DELETED: 'CAR_DELETED',
  CAR_VIEWED: 'CAR_VIEWED',
  CAR_LIST_VIEWED: 'CAR_LIST_VIEWED',
  
  // Customer CRUD
  CUSTOMER_CREATED: 'CUSTOMER_CREATED',
  CUSTOMER_UPDATED: 'CUSTOMER_UPDATED',
  CUSTOMER_DELETED: 'CUSTOMER_DELETED',
  CUSTOMER_VIEWED: 'CUSTOMER_VIEWED',
  
  // Report
  REPORT_GENERATED: 'REPORT_GENERATED',
  REPORT_VIEWED: 'REPORT_VIEWED',
  
  // AI
  AI_ANALYSIS_REQUESTED: 'AI_ANALYSIS_REQUESTED',
  AI_ANALYSIS_COMPLETED: 'AI_ANALYSIS_COMPLETED',
  
  // User Management
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
};

// 리소스 타입
const ResourceTypes = {
  CAR: 'CAR',
  CUSTOMER: 'CUSTOMER',
  REPORT: 'REPORT',
  USER: 'USER',
  AUTH: 'AUTH',
  AI: 'AI',
};

// 액션 타입
const ActionTypes = {
  CREATE: 'CREATE',
  READ: 'READ',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  GENERATE: 'GENERATE',
  ANALYZE: 'ANALYZE',
};

/**
 * 이벤트 객체 생성
 * @param {object} params - 이벤트 파라미터
 * @returns {object} 표준화된 이벤트 객체
 */
function createEvent({
  eventType,
  userId,
  userName,
  userRole,
  ipAddress,
  userAgent,
  resource,
  resourceId,
  action,
  status = 'SUCCESS',
  metadata = {},
  changes = null,
  error = null,
}) {
  return {
    eventId: uuidv4(),
    eventType,
    timestamp: new Date().toISOString(),
    userId,
    userName,
    userRole,
    ipAddress,
    userAgent,
    resource,
    resourceId: resourceId ? String(resourceId) : null,
    action,
    status,
    metadata,
    changes,
    error: error ? {
      message: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    } : null,
  };
}

/**
 * Request 객체에서 사용자 정보 추출
 * @param {object} req - Express Request 객체
 * @returns {object} 사용자 정보
 */
function extractUserInfo(req) {
  const user = req.user || {};
  const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';

  return {
    userId: user.id || null,
    userName: user.name || 'anonymous',
    userRole: user.role || 'GUEST',
    ipAddress,
    userAgent,
  };
}

/**
 * 민감한 정보 마스킹
 * @param {object} data - 마스킹할 데이터
 * @returns {object} 마스킹된 데이터
 */
function maskSensitiveData(data) {
  if (!data || typeof data !== 'object') return data;

  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken'];
  const masked = { ...data };

  Object.keys(masked).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      masked[key] = '***MASKED***';
    } else if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskSensitiveData(masked[key]);
    }
  });

  return masked;
}

/**
 * 변경 사항 추출 (before/after)
 * @param {object} before - 변경 전 데이터
 * @param {object} after - 변경 후 데이터
 * @returns {object} 변경 사항
 */
function extractChanges(before, after) {
  if (!before && !after) return null;

  return {
    before: before ? maskSensitiveData(before) : null,
    after: after ? maskSensitiveData(after) : null,
  };
}

/**
 * HTTP 메서드를 액션 타입으로 변환
 * @param {string} method - HTTP 메서드
 * @returns {string} 액션 타입
 */
function methodToAction(method) {
  const map = {
    'POST': ActionTypes.CREATE,
    'GET': ActionTypes.READ,
    'PUT': ActionTypes.UPDATE,
    'PATCH': ActionTypes.UPDATE,
    'DELETE': ActionTypes.DELETE,
  };
  
  return map[method.toUpperCase()] || ActionTypes.READ;
}

/**
 * 경로에서 리소스 타입 추출
 * @param {string} path - API 경로
 * @returns {string} 리소스 타입
 */
function pathToResource(path) {
  if (path.includes('/car')) return ResourceTypes.CAR;
  if (path.includes('/customer')) return ResourceTypes.CUSTOMER;
  if (path.includes('/report')) return ResourceTypes.REPORT;
  if (path.includes('/user')) return ResourceTypes.USER;
  if (path.includes('/auth')) return ResourceTypes.AUTH;
  if (path.includes('/ai')) return ResourceTypes.AI;
  
  return 'UNKNOWN';
}

module.exports = {
  EventTypes,
  ResourceTypes,
  ActionTypes,
  createEvent,
  extractUserInfo,
  maskSensitiveData,
  extractChanges,
  methodToAction,
  pathToResource,
};
