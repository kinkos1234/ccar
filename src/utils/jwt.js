const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'car_system_2024!@#_super_secret_key';

function sign(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d', ...options });
}

function verify(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = { sign, verify }; 