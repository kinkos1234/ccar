const reportService = require('../services/report.service');
const { convertBigIntToString } = require('../utils/bigint');

exports.getLatest = async (req, res, next) => {
  try {
    const report = await reportService.getLatest(req.query);
    if (!report) return res.status(404).json({ error: '주간 보고서 없음' });
    const convertedReport = convertBigIntToString(report);
    res.json(convertedReport);
  } catch (e) {
    next(e);
  }
};

exports.getWeeklyReports = async (req, res, next) => {
  try {
    const reports = await reportService.getWeeklyReports();
    const convertedReports = convertBigIntToString(reports);
    res.json(convertedReports);
  } catch (e) {
    next(e);
  }
};

exports.getWeeklyReportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const report = await reportService.getWeeklyReportById(parseInt(id));
    if (!report) {
      return res.status(404).json({ error: '보고서를 찾을 수 없습니다.' });
    }
    const convertedReport = convertBigIntToString(report);
    res.json(convertedReport);
  } catch (e) {
    next(e);
  }
};
