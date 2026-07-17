const express = require('express');
const { n8nAuthMiddleware } = require('../middlewares/n8n.auth.middleware');
const n8nCtrl = require('../controllers/n8n.controller');
const router = express.Router();

// 모든 n8n 라우트에 웹훅 시크릿 인증 적용
router.use(n8nAuthMiddleware);

// 보고서 저장 (n8n 워크플로우에서 HTTP Request로 호출)
router.post('/report/save', n8nCtrl.saveReport);

// 헬스체크 (n8n에서 CAR 시스템 가용성 확인)
router.get('/health', n8nCtrl.health);

module.exports = router;
