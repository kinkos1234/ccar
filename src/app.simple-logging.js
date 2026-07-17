/**
 * ========================================
 * 간단 버전: Console 로깅만 적용
 * Kafka 없이도 작동
 * ========================================
 * 
 * 테스트용으로 사용하기 좋습니다.
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

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
// ✨ 간단한 이벤트 로거 (Kafka 불필요)
// ========================================
const createSimpleMiddleware = require('../packages/event-logger/src/index.simple');

app.use(createSimpleMiddleware({
  applicationName: 'car-system',
  applicationVersion: '2.4.2',
  environment: process.env.NODE_ENV || 'development',
  excludePaths: ['/health', '/metrics'],
}));

console.log('✅ 간단 이벤트 로거 활성화 (Console 출력)');

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
