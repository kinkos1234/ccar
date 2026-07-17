const express = require('express');
const { authMiddleware: auth } = require('../middlewares/auth.middleware');
const reportCtrl = require('../controllers/report.controller');
const router = express.Router();

// 최신 보고서 조회
router.get('/weekly/latest', auth, reportCtrl.getLatest);

// 주간 보고서 목록 조회
router.get('/weekly-reports', auth, reportCtrl.getWeeklyReports);

// 주간 보고서 단일 조회
router.get('/weekly-reports/:id', auth, reportCtrl.getWeeklyReportById);

module.exports = router;
