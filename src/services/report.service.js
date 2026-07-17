require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 최신 주간 보고서 1건 조회 (필터 적용)
 */
async function getLatest(filter = {}) {
  const report = await prisma.weeklyReport.findFirst({
    orderBy: { weekStart: 'desc' },
  });
  if (!report) return null;

  let data = report.data;
  if (filter.corp) data = { [filter.corp]: data[filter.corp] };
  if (filter.customer) data = Object.fromEntries(Object.entries(data).filter(([k]) => k === filter.customer));

  return { ...report, data };
}

/**
 * 주간 보고서 목록 조회 (최신순)
 */
async function getWeeklyReports() {
  try {
    const reports = await prisma.weeklyReport.findMany({
      select: {
        id: true,
        title: true,
        weekStart: true,
        data: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const { convertBigIntToString } = require('../utils/bigint');
    return convertBigIntToString(reports);
  } catch (error) {
    console.error('❌ 주간 보고서 목록 조회 실패:', error);
    throw error;
  }
}

/**
 * 주간 보고서 단일 조회
 */
async function getWeeklyReportById(id) {
  try {
    const report = await prisma.weeklyReport.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        weekStart: true,
        data: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!report) return null;

    const { convertBigIntToString } = require('../utils/bigint');
    return convertBigIntToString(report);
  } catch (error) {
    console.error('❌ 주간 보고서 조회 실패:', error);
    throw error;
  }
}

module.exports = { getLatest, getWeeklyReports, getWeeklyReportById };
