/**
 * ========================================
 * 통합 Topic 방식 적용된 app.js
 * ========================================
 * 
 * 사용 방법:
 * 1. src/app.js를 백업
 * 2. 이 파일을 src/app.js로 교체
 * 3. 패키지 설치 및 서버 재시작
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

// ✨ 이벤트 로거 import
const EventLogger = require('@company/event-logger');

const app = express();

// CORS 설정
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// ========================================
// ✨ 통합 Topic 이벤트 로거 적용
// ========================================
// 🎯 모든 앱이 'system-user-events' Topic 사용
// 📝 메시지 내용의 시스템 구분자로 필터링:
//    - applicationName: 'car-system'
//    - environment: 'production'
//    - applicationId: 'car-system-production'
// ========================================

if (process.env.KAFKA_ENABLED === 'true') {
  try {
    const eventLogger = EventLogger.middleware({
      transport: 'kafka',
      kafka: {
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        topic: 'system-user-events',  // 🎯 통합 Topic (모든 앱 공통)
        clientId: 'car-system',
      },
      application: {
        name: 'car-system',       // 🏷️ 시스템 구분자
        version: '2.4.2',
        environment: process.env.NODE_ENV || 'development',
      },
      filters: {
        excludePaths: ['/health', '/metrics', '/favicon.ico'],
        sampling: {
          enabled: process.env.NODE_ENV === 'production',
          rate: parseFloat(process.env.SAMPLING_RATE || '1.0'),
          excludeErrors: false,  // 에러는 항상 로깅
        },
      },
      masking: {
        enabled: true,
        fields: ['password', 'token', 'secret', 'apiKey', 'authorization'],
      },
    });
    
    app.use(eventLogger);
    console.log('✅ 통합 Topic 이벤트 로거 활성화: system-user-events');
  } catch (error) {
    console.error('❌ 이벤트 로거 초기화 실패:', error);
  }
} else {
  console.log('⚠️  Kafka 이벤트 로거 비활성화 (KAFKA_ENABLED=false)');
}

// 라우터 연결
app.use('/api/car', require('./routes/car.route'));
app.use('/api/auth', require('./routes/auth.route'));
app.use('/api/customer', require('./routes/customer.route'));
app.use('/api/report', require('./routes/report.route'));
app.use('/api/ai', require('./routes/ai.route'));

// 헬스체크
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
