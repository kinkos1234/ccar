// 이벤트 로깅 미들웨어
const kafkaService = require('../services/kafka.service');
const {
  createEvent,
  extractUserInfo,
  methodToAction,
  pathToResource,
  EventTypes,
} = require('../utils/event');

/**
 * 이벤트 로깅 미들웨어
 * 모든 API 요청에 대해 이벤트를 생성하고 Kafka로 전송
 */
function eventLoggerMiddleware(req, res, next) {
  // 응답 완료 시 이벤트 로깅
  const originalSend = res.send;
  const startTime = Date.now();

  res.send = function (data) {
    // 헬스체크와 같은 경로는 제외
    const skipPaths = ['/health', '/favicon.ico'];
    if (skipPaths.some(path => req.path.includes(path))) {
      return originalSend.call(this, data);
    }

    // 사용자 정보 추출
    const userInfo = extractUserInfo(req);
    
    // 리소스와 액션 추출
    const resource = pathToResource(req.path);
    const action = methodToAction(req.method);
    
    // 리소스 ID 추출 (경로에서)
    const resourceId = extractResourceId(req.path);
    
    // 이벤트 타입 결정
    const eventType = determineEventType(req.method, req.path);
    
    // 응답 상태
    const status = res.statusCode < 400 ? 'SUCCESS' : 'ERROR';
    
    // 메타데이터
    const metadata = {
      method: req.method,
      path: req.path,
      query: req.query,
      statusCode: res.statusCode,
      duration: Date.now() - startTime,
      requestSize: req.get('content-length') || 0,
    };

    // 에러 정보 (있는 경우)
    let error = null;
    if (status === 'ERROR') {
      try {
        const responseData = typeof data === 'string' ? JSON.parse(data) : data;
        error = {
          message: responseData.error || 'Unknown error',
          code: res.statusCode,
        };
      } catch (e) {
        error = {
          message: 'Unknown error',
          code: res.statusCode,
        };
      }
    }

    // 이벤트 생성
    const event = createEvent({
      eventType,
      ...userInfo,
      resource,
      resourceId,
      action,
      status,
      metadata,
      error,
    });

    // Kafka로 이벤트 전송 (비동기, 응답에 영향 없음)
    const topic = process.env.KAFKA_TOPIC_USER_EVENTS || 'car-system-user-events';
    kafkaService.sendEvent(topic, event).catch(err => {
      console.error('이벤트 로깅 실패:', err);
    });

    return originalSend.call(this, data);
  };

  next();
}

/**
 * 경로에서 리소스 ID 추출
 * @param {string} path - API 경로
 * @returns {string|null} 리소스 ID
 */
function extractResourceId(path) {
  // /api/car/123 형태에서 123 추출
  const match = path.match(/\/(\d+)(?:\/|$)/);
  return match ? match[1] : null;
}

/**
 * HTTP 메서드와 경로를 기반으로 이벤트 타입 결정
 * @param {string} method - HTTP 메서드
 * @param {string} path - API 경로
 * @returns {string} 이벤트 타입
 */
function determineEventType(method, path) {
  // 인증
  if (path.includes('/auth/login')) return EventTypes.USER_LOGIN;
  if (path.includes('/auth/logout')) return EventTypes.USER_LOGOUT;
  
  // CAR
  if (path.includes('/car')) {
    if (method === 'POST') return EventTypes.CAR_CREATED;
    if (method === 'PUT' || method === 'PATCH') return EventTypes.CAR_UPDATED;
    if (method === 'DELETE') return EventTypes.CAR_DELETED;
    if (method === 'GET' && path.match(/\/\d+$/)) return EventTypes.CAR_VIEWED;
    if (method === 'GET') return EventTypes.CAR_LIST_VIEWED;
  }
  
  // Customer
  if (path.includes('/customer')) {
    if (method === 'POST') return EventTypes.CUSTOMER_CREATED;
    if (method === 'PUT' || method === 'PATCH') return EventTypes.CUSTOMER_UPDATED;
    if (method === 'DELETE') return EventTypes.CUSTOMER_DELETED;
    if (method === 'GET') return EventTypes.CUSTOMER_VIEWED;
  }
  
  // Report
  if (path.includes('/report')) {
    if (method === 'POST') return EventTypes.REPORT_GENERATED;
    if (method === 'GET') return EventTypes.REPORT_VIEWED;
  }
  
  // AI
  if (path.includes('/ai')) {
    if (method === 'POST') return EventTypes.AI_ANALYSIS_REQUESTED;
  }
  
  // User
  if (path.includes('/user')) {
    if (method === 'POST') return EventTypes.USER_CREATED;
    if (method === 'PUT' || method === 'PATCH') return EventTypes.USER_UPDATED;
    if (method === 'DELETE') return EventTypes.USER_DELETED;
  }
  
  return 'UNKNOWN_EVENT';
}

/**
 * 수동 이벤트 로깅 헬퍼 함수
 * 컨트롤러에서 직접 호출할 수 있음
 */
async function logEvent(eventData) {
  const topic = process.env.KAFKA_TOPIC_USER_EVENTS || 'car-system-user-events';
  
  const event = createEvent(eventData);
  
  try {
    await kafkaService.sendEvent(topic, event);
  } catch (error) {
    console.error('수동 이벤트 로깅 실패:', error);
  }
}

module.exports = {
  eventLoggerMiddleware,
  logEvent,
};
