const carService = require('../services/car.service');
const { convertBigIntToString } = require('../utils/bigint');

exports.getList = async (req, res, next) => {
  try {
    const result = await carService.getList(req.query);
    const convertedResult = convertBigIntToString(result);
    res.json(convertedResult);
  } catch (e) {
    next(e);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const car = await carService.getById(req.params.id);
    if (!car) return res.status(404).json({ error: 'CAR not found' });
    const convertedCar = convertBigIntToString(car);
    res.json(convertedCar);
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    // createdBy는 req.user.id로 강제 지정
    const data = { ...req.body, createdBy: req.user.id, actorUserId: req.user.id };
    const car = await carService.create(data);
    const convertedCar = convertBigIntToString(car);
    res.status(201).json(convertedCar);
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const data = { ...req.body, actorUserId: req.user.id };
    const car = await carService.update(req.params.id, data);
    const convertedCar = convertBigIntToString(car);
    res.json(convertedCar);
  } catch (e) {
    console.error('CAR 업데이트 오류:', e.message);
    res.status(500).json({
      error: 'CAR 업데이트 실패',
      message: e.message
    });
  }
};

exports.getActivities = async (req, res, next) => {
  try {
    const activityLogService = require('../services/activityLog.service');
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const list = await activityLogService.listByCarId(req.params.id, { limit });
    res.json({ success: true, data: convertBigIntToString(list) });
  } catch (e) {
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await carService.remove(req.params.id);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

exports.getFilterOptions = async (req, res, next) => {
  try {
    const options = await carService.getFilterOptions();
    const convertedOptions = convertBigIntToString(options);
    res.json(convertedOptions);
  } catch (e) {
    next(e);
  }
};

// 전체 상태 통계 조회
exports.getStatusStats = async (req, res) => {
  try {
    const stats = await carService.getStatusStats();
    res.json(stats);
  } catch (error) {
    console.error('전체 상태 통계 조회 실패:', error);
    res.status(500).json({ error: '전체 상태 통계 조회에 실패했습니다.' });
  }
};

// 🆕 Risk Analytics API (2025-10-01 추가)
exports.getRiskAnalytics = async (req, res) => {
  try {
    const filters = {};
    const { corp, eventType, riskLevel } = req.query;
    
    if (corp && corp !== '전체') filters.corp = corp;
    if (eventType && eventType !== '전체') filters.eventType = eventType;
    if (riskLevel && riskLevel !== '전체') filters.riskLevel = riskLevel;
    
    const analytics = await carService.getRiskAnalytics(filters);
    const convertedAnalytics = convertBigIntToString(analytics);
    res.json(convertedAnalytics);
  } catch (error) {
    console.error('Risk Analytics 조회 실패:', error);
    res.status(500).json({ error: 'Risk Analytics 조회에 실패했습니다.' });
  }
}; 