// Kafka Producer 서비스
const { Kafka, logLevel } = require('kafkajs');

class KafkaService {
  constructor() {
    this.kafka = null;
    this.producer = null;
    this.isEnabled = process.env.KAFKA_ENABLED === 'true';
    this.isConnected = false;
    
    if (this.isEnabled) {
      this.initialize();
    }
  }

  initialize() {
    try {
      const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
      const clientId = process.env.KAFKA_CLIENT_ID || 'car-system';

      this.kafka = new Kafka({
        clientId,
        brokers,
        logLevel: logLevel.ERROR,
        retry: {
          retries: 3,
          initialRetryTime: 100,
          maxRetryTime: 30000,
        },
      });

      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
        transactionTimeout: 30000,
      });

      console.log('✅ Kafka 서비스가 초기화되었습니다.');
    } catch (error) {
      console.error('❌ Kafka 초기화 오류:', error);
      this.isEnabled = false;
    }
  }

  async connect() {
    if (!this.isEnabled || this.isConnected) return;

    try {
      await this.producer.connect();
      this.isConnected = true;
      console.log('✅ Kafka Producer 연결 성공');
    } catch (error) {
      console.error('❌ Kafka Producer 연결 실패:', error);
      this.isEnabled = false;
    }
  }

  async disconnect() {
    if (!this.isConnected) return;

    try {
      await this.producer.disconnect();
      this.isConnected = false;
      console.log('✅ Kafka Producer 연결 해제');
    } catch (error) {
      console.error('❌ Kafka Producer 연결 해제 실패:', error);
    }
  }

  /**
   * 이벤트를 Kafka에 전송
   * @param {string} topic - Kafka 토픽
   * @param {object} event - 이벤트 객체
   */
  async sendEvent(topic, event) {
    // Kafka가 비활성화되어 있으면 콘솔에만 로깅
    if (!this.isEnabled) {
      console.log('📝 [Kafka 비활성화] 이벤트:', JSON.stringify(event, null, 2));
      return;
    }

    // 연결되어 있지 않으면 연결 시도
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: event.eventId || Date.now().toString(),
            value: JSON.stringify(event),
            timestamp: event.timestamp || Date.now().toString(),
          },
        ],
      });

      console.log(`📤 Kafka 이벤트 전송 성공: ${event.eventType}`);
    } catch (error) {
      console.error('❌ Kafka 이벤트 전송 실패:', error);
      // 실패해도 애플리케이션은 계속 동작하도록 함
      // 필요 시 로컬 로그 파일에 백업
      console.log('📝 [Kafka 전송 실패] 백업 로그:', JSON.stringify(event));
    }
  }

  /**
   * 여러 이벤트를 배치로 전송
   * @param {string} topic - Kafka 토픽
   * @param {array} events - 이벤트 배열
   */
  async sendBatchEvents(topic, events) {
    if (!this.isEnabled) {
      console.log(`📝 [Kafka 비활성화] ${events.length}개 이벤트 배치 로깅`);
      return;
    }

    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const messages = events.map(event => ({
        key: event.eventId || Date.now().toString(),
        value: JSON.stringify(event),
        timestamp: event.timestamp || Date.now().toString(),
      }));

      await this.producer.send({
        topic,
        messages,
      });

      console.log(`📤 Kafka 배치 이벤트 전송 성공: ${events.length}개`);
    } catch (error) {
      console.error('❌ Kafka 배치 이벤트 전송 실패:', error);
      console.log('📝 [Kafka 전송 실패] 백업 로그:', JSON.stringify(events));
    }
  }
}

// 싱글톤 인스턴스 생성
const kafkaService = new KafkaService();

module.exports = kafkaService;
