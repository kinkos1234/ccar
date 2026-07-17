const customerService = require('../services/customer.service');
const { convertBigIntToString } = require('../utils/bigint');

exports.getList = async (req, res, next) => {
  try {
    const result = await customerService.getList(req.query);
    const convertedResult = convertBigIntToString(result);
    res.json(convertedResult);
  } catch (e) {
    next(e);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const customer = await customerService.getById(req.params.id);
    if (!customer) return res.status(404).json({ error: '고객 정보 없음' });
    const convertedCustomer = convertBigIntToString(customer);
    res.json(convertedCustomer);
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const customer = await customerService.create(req.body);
    const convertedCustomer = convertBigIntToString(customer);
    res.status(201).json(convertedCustomer);
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const customer = await customerService.update(req.params.id, req.body);
    const convertedCustomer = convertBigIntToString(customer);
    res.json(convertedCustomer);
  } catch (e) {
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await customerService.remove(req.params.id);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}; 