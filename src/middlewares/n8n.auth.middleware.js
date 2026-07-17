/**
 * n8n 웹훅 인증 미들웨어
 * n8n → CAR 시스템 API 호출 시 X-N8N-Webhook-Secret 헤더로 인증
 */
function n8nAuthMiddleware(req, res, next) {
  const secret = req.headers['x-n8n-webhook-secret'];
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!expectedSecret) {
    console.error('❌ N8N_WEBHOOK_SECRET 환경변수가 설정되지 않았습니다.');
    return res.status(500).json({ error: 'n8n 인증 설정 오류' });
  }

  if (!secret || secret !== expectedSecret) {
    return res.status(401).json({ error: 'n8n 인증 실패: 유효하지 않은 시크릿' });
  }

  next();
}

module.exports = { n8nAuthMiddleware };
