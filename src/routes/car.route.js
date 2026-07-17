const express = require('express');
const { authMiddleware: auth } = require('../middlewares/auth.middleware');
const carCtrl = require('../controllers/car.controller');
const { canDeleteCar } = require('../middlewares/role.middleware');
const router = express.Router();
const carService = require('../services/car.service');

// 필터 옵션 전체 조회 (드롭다운용) - 반드시 /:id보다 위에 선언
router.get('/filters', auth, carCtrl.getFilterOptions);

// 전체 상태 통계 API
router.get('/status-stats', auth, carCtrl.getStatusStats);

// 🆕 Risk Analytics API (2025-10-01 추가)
router.get('/risk-analytics', auth, carCtrl.getRiskAnalytics);

// 누적 Score 조회 (BarChart용) - 실제 백엔드 서비스 연결
router.get('/accumulated-scores', auth, async (req, res) => {
  try {
    const { 
      groupType = 'company',
      targetYear,
      targetMonth,
      corp,
      customerGroup,
      dept,
      status
    } = req.query;

    // 기본값 설정 (현재 년/월)
    const now = new Date();
    const year = parseInt(targetYear) || now.getFullYear();
    const month = parseInt(targetMonth) || (now.getMonth() + 1);

    // 필터 구성
    const filters = {};
    if (corp && corp !== '전체') filters.corp = corp;
    if (customerGroup) {
      const groups = Array.isArray(customerGroup) ? customerGroup : [customerGroup];
      filters.customerGroup = groups;
    }
    if (dept && dept !== '전체') filters.dept = dept;
    if (status && status !== '전체') filters.status = status;

    // 백엔드 서비스 호출
    const carService = require('../services/car.service');
    const accumulatedData = await carService.getAccumulatedScoresByGroup(groupType, year, month, filters);

    res.json({ 
      success: true, 
      data: accumulatedData
    });
  } catch (error) {
    console.error('누적 Score 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '누적 Score 조회에 실패했습니다.',
      error: error.message 
    });
  }
});

// 월별 추이 조회 (LineChart용) - 실제 백엔드 서비스 연결
router.get('/monthly-trend', auth, async (req, res) => {
  try {
    const { 
      groupType = 'company', 
      startYear, 
      startMonth, 
      endYear, 
      endMonth,
      corp,
      customerGroup,
      dept,
      status
    } = req.query;

    // 기본값 설정 (최근 6개월)
    const now = new Date();
    const defaultEndYear = now.getFullYear();
    const defaultEndMonth = now.getMonth() + 1;
    const startDate = new Date(defaultEndYear, defaultEndMonth - 7, 1);
    const defaultStartYear = startDate.getFullYear();
    const defaultStartMonth = startDate.getMonth() + 1;

         // 월 범위 생성
     const months = [];
     const start = new Date(
       parseInt(startYear) || defaultStartYear, 
       (parseInt(startMonth) || defaultStartMonth) - 1, 
       1
     );
     const end = new Date(
       parseInt(endYear) || defaultEndYear, 
       (parseInt(endMonth) || defaultEndMonth) - 1, 
       1
     );

    let current = new Date(start);
    while (current <= end) {
      months.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1,
        label: `${current.getFullYear()}년 ${current.getMonth() + 1}월`
      });
      current.setMonth(current.getMonth() + 1);
    }

    // 필터 구성
    const filters = {};
    if (corp && corp !== '전체') filters.corp = corp;
    if (customerGroup) {
      const groups = Array.isArray(customerGroup) ? customerGroup : [customerGroup];
      filters.customerGroup = groups;
    }
    if (dept && dept !== '전체') filters.dept = dept;
    if (status && status !== '전체') filters.status = status;

    // 백엔드 서비스 호출
    const carService = require('../services/car.service');
    const monthlyData = await carService.getMonthlyTrend(groupType, months, filters);

    res.json({ 
      success: true, 
      data: monthlyData
    });
  } catch (error) {
    console.error('월별 추이 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '월별 추이 조회에 실패했습니다.',
      error: error.message 
    });
  }
});

router.get('/', auth, carCtrl.getList);
router.get('/:id', auth, carCtrl.getById);
router.get('/:id/activities', auth, carCtrl.getActivities);
router.post('/', auth, carCtrl.create);
router.put('/:id', auth, carCtrl.update);
router.delete('/:id', auth, canDeleteCar, carCtrl.remove);


module.exports = router;