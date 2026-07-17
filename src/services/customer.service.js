require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getList(filter = {}) {
  // 필터: customer, department 등
  const where = {};
  if (filter.customer) where.company = filter.customer;
  if (filter.department) where.department = filter.department;
  return prisma.customerContact.findMany({ where });
}

async function getById(id) {
  return prisma.customerContact.findUnique({ where: { id: Number(id) } });
}

async function create(data) {
  return prisma.customerContact.create({ data });
}

async function update(id, data) {
  return prisma.customerContact.update({ where: { id: Number(id) }, data });
}

async function remove(id) {
  return prisma.customerContact.delete({ where: { id: Number(id) } });
}

module.exports = { getList, getById, create, update, remove }; 