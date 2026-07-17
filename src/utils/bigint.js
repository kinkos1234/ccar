// BigInt를 안전하게 JSON 직렬화 가능한 형태로 변환하는 유틸리티

function convertBigIntToString(obj) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  // Date 객체 처리 추가
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Prisma Decimal (decimal.js) 객체 처리
  if (typeof obj === 'object' && typeof obj.toNumber === 'function' && typeof obj.toFixed === 'function') {
    return obj.toNumber();
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToString(item));
  }

  if (typeof obj === 'object') {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToString(value);
    }
    return converted;
  }

  return obj;
}

module.exports = {
  convertBigIntToString
}; 