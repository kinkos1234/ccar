require('dotenv').config();
const app = require('./app');
const kafkaLogger = require('./utils/kafka-logger');

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CAR 시스템 v${process.env.APP_VERSION || '2.4.3'} 백엔드 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`🌐 네트워크 접근: http://0.0.0.0:${PORT}`);
  console.log(`📋 리포트 생성: n8n 워크플로우 (${process.env.N8N_BASE_URL || 'N8N_BASE_URL 미설정'})`);
  console.log('🎯 서버 초기화 완료!\n');
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n${signal} 신호를 받았습니다. 서버를 종료합니다...`);

  // 1. HTTP 서버 종료
  server.close(() => {
    console.log('✅ HTTP 서버 종료 완료');
  });

  // 2. Kafka 연결 종료
  await kafkaLogger.disconnect();

  process.exit(0);
}

// 프로세스 종료 시그널 처리
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
