const { Kafka } = require('kafkajs');
const { randomUUID } = require('crypto');

let kafka = null;
let producer = null;
let isConnected = false;
let reconnectTimer = null;
let isReconnecting = false;

async function initKafka() {
  if (kafka) return;
  
  kafka = new Kafka({
    clientId: 'car-system',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  });
  
  producer = kafka.producer();
  
  await connectWithRetry();
}

async function connectWithRetry() {
  if (isReconnecting) return;
  
  try {
    await producer.connect();
    isConnected = true;
    isReconnecting = false;
    
    // 재연결 타이머가 있으면 중단
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    console.log('✅ Kafka Producer 연결 성공');
  } catch (error) {
    isConnected = false;
    console.error('❌ Kafka 연결 실패:', error.message);
    
    // 5초 후 재연결 시도
    if (!isReconnecting) {
      isReconnecting = true;
      console.log('🔄 5초 후 Kafka 재연결 시도...');
      
      reconnectTimer = setTimeout(async () => {
        isReconnecting = false;
        await connectWithRetry();
      }, 5000);
    }
  }
}

async function logEvent(eventData) {
  // Kafka가 초기화되지 않았으면 초기화 시도
  if (!kafka) {
    await initKafka();
  }
  
  // 연결되지 않았으면 이벤트를 로그만 출력하고 스킵
  if (!isConnected) {
    console.log('⚠️  Kafka 미연결 - 이벤트 스킵 (재연결 시도 중...)');
    return;
  }
  
  const event = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    applicationName: 'car-system',
    applicationVersion: '2.4.3',
    environment: process.env.NODE_ENV || 'development',
    applicationId: `car-system-${process.env.NODE_ENV || 'development'}`,
    ...eventData,
  };
  
  try {
    await producer.send({
      topic: 'system-user-events',
      messages: [{
        key: event.eventId,
        value: JSON.stringify(event),
      }],
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('📤 [Kafka] 메시지 전송 완료!');
    console.log('='.repeat(80));
    console.log(`🎯 Event ID: ${event.eventId}`);
    console.log(`📝 Event Type: ${eventData.eventType}`);
    console.log(`👤 User: ${eventData.userName || eventData.userId || 'N/A'}`);
    console.log(`⚡ ${eventData.method} ${eventData.path} - ${eventData.statusCode}`);
    console.log(`⏱️  Duration: ${eventData.duration}ms`);
    console.log('📦 Full Event:');
    console.log(JSON.stringify(event, null, 2));
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('❌ Kafka 전송 실패:', error.message);
    
    // 전송 실패 시 연결 상태 갱신 및 재연결 시도
    isConnected = false;
    if (!isReconnecting) {
      await connectWithRetry();
    }
  }
}

function createMiddleware() {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    // originalUrl 사용 (전체 경로)
    const fullPath = req.originalUrl.split('?')[0];
    console.log(`\n🌐 [REQUEST] ${req.method} ${fullPath}`);
    
    // 📦 응답 데이터 캡처를 위한 준비
    const originalJson = res.json.bind(res);
    let responseData = null;
    
    res.json = function(data) {
      responseData = data;
      return originalJson(data);
    };
    
    // 응답 후 로깅
    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      
      // 🔧 제외 경로 (헬스체크, 메트릭 등)
      const excludePaths = ['/health', '/metrics', '/favicon.ico'];
      if (excludePaths.some(p => fullPath.includes(p))) {
        return;
      }
      
      // 🎯 로깅 대상 필터링: 로그인/로그아웃, CRUD만
      if (!shouldLogEvent(req, fullPath)) {
        console.log(`⏭️  [SKIP] 이벤트 스킵: ${req.method} ${fullPath}`);
        return;
      }
      
      // 🎯 사용자 정보 결정 (우선순위: req.user > 응답 데이터)
      let userId = req.user?.loginId || null;
      let userName = req.user?.name || null;
      
      // 로그인 API의 경우 응답 데이터에서 사용자 정보 추출
      if (fullPath.includes('/auth/login') && responseData?.user) {
        userId = responseData.user.loginId;
        userName = responseData.user.name;
      }
      
      const eventData = {
        eventType: determineEventType(req, fullPath),
        method: req.method,
        path: fullPath,
        query: req.query,
        statusCode: res.statusCode,
        duration,
        userId,
        userName,
        ipAddress: req.ip || null,
      };
      
      await logEvent(eventData);
    });
    
    next();
  };
}

/**
 * 🎯 Kafka로 로깅할 이벤트인지 판단
 * 로그인/로그아웃, CRUD 작업만 true 반환
 */
function shouldLogEvent(req, fullPath) {
  const { method } = req;
  const path = fullPath || req.originalUrl.split('?')[0];
  
  // 1. 로그인/로그아웃 (항상 로깅)
  if (path.includes('/auth/login') || path.includes('/auth/logout')) {
    return true;
  }
  
  // 2. CRUD 작업 (/api/리소스 경로)
  const isApiPath = path.startsWith('/api/');
  
  if (!isApiPath) {
    return false;
  }
  
  // 3. GET 요청 필터링 (조회 작업)
  // 환경변수로 GET 로깅 제어 가능
  const logGetRequests = process.env.KAFKA_LOG_GET_REQUESTS === 'true';
  
  if (method === 'GET' && !logGetRequests) {
    // GET 요청은 기본적으로 스킵 (너무 많은 이벤트 방지)
    return false;
  }
  
  // 4. POST, PUT, DELETE (생성, 수정, 삭제) - 항상 로깅
  const isCrudWrite = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  
  if (isCrudWrite) {
    // 제외할 API 경로
    const excludeApiPaths = [
      '/api/internal',  // 내부 API
      '/api/status',    // 상태 체크
      '/api/ping',      // 핑
    ];
    
    if (excludeApiPaths.some(p => path.includes(p))) {
      return false;
    }
    
    return true;
  }
  
  // 5. GET 요청이고 logGetRequests=true인 경우
  if (method === 'GET' && logGetRequests) {
    return true;
  }
  
  return false;
}

function determineEventType(req, fullPath) {
  const path = fullPath || req.originalUrl.split('?')[0];
  
  if (path.includes('/auth/login')) return 'USER_LOGIN';
  if (path.includes('/auth/logout')) return 'USER_LOGOUT';
  
  const resource = path.match(/\/api\/([^\/]+)/)?.[1]?.toUpperCase();
  const action = {
    'GET': 'READ',
    'POST': 'CREATE',
    'PUT': 'UPDATE',
    'DELETE': 'DELETE',
  }[req.method];
  
  return resource && action ? `${resource}_${action}` : 'HTTP_REQUEST';
}

async function disconnect() {
  // 재연결 타이머 정리
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // Producer 연결 해제
  if (producer && isConnected) {
    try {
      await producer.disconnect();
      isConnected = false;
      console.log('✅ Kafka Producer 연결 해제');
    } catch (error) {
      console.error('❌ Kafka 연결 해제 실패:', error.message);
    }
  }
}

module.exports = {
  initKafka,
  logEvent,
  createMiddleware,
  disconnect,
};
