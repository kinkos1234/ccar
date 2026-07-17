const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS 설정: 다양한 호스트에서의 접근 허용
app.use(cors({
  origin: true, // 모든 origin 허용 (개발 환경)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ========================================
// ✨ Kafka 이벤트 로거 (간단 버전)
// ========================================
if (process.env.KAFKA_ENABLED === 'true') {
  try {
    const kafkaLogger = require('./utils/kafka-logger');
    
    // Kafka 초기화
    kafkaLogger.initKafka().catch(err => {
      console.error('Kafka 초기화 실패:', err);
    });
    
    // 미들웨어 등록
    app.use(kafkaLogger.createMiddleware());
    
    console.log('✅ Kafka 이벤트 로거 활성화: system-user-events');
    console.log(`📊 애플리케이션: car-system`);
    console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📝 로깅 대상: 로그인/로그아웃 + CUD 작업 (GET 제외)`);
  } catch (error) {
    console.error('❌ Kafka 로거 로드 실패:', error.message);
  }
} else {
  console.log('⚠️  Kafka 이벤트 로거 비활성화');
}

// 라우터 연결
app.use('/api/car', require('./routes/car.route'));
app.use('/api/auth', require('./routes/auth.route'));
app.use('/api/customer', require('./routes/customer.route'));
app.use('/api/report', require('./routes/report.route'));
app.use('/api/n8n', require('./routes/n8n.route'));
app.use('/api/notifications', require('./routes/notification.route'));

// ========================================
// 🔔 Notification scheduler (node-cron)
// ========================================
if (process.env.NOTIFICATION_SCHEDULER_ENABLED !== 'false') {
  try {
    require('./services/scheduler.service').start();
  } catch (error) {
    console.error('❌ Notification scheduler 시작 실패:', error.message);
  }
} else {
  console.log('⚠️  Notification scheduler 비활성화');
}

// 기본 헬스체크
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app; 