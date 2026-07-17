require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// CAR 삭제 권한 미들웨어
async function canDeleteCar(req, res, next) {
  const user = req.user;
  const carId = Number(req.params.id);
  if (user.role === 'ADMIN' || user.role === 'MANAGER') {
    return next();
  }
  // STAFF: 본인 작성만 삭제 가능
  const car = await prisma.cAR.findUnique({ where: { id: carId } });
  if (!car) return res.status(404).json({ error: 'CAR not found' });
  if (car.createdBy !== user.id) {
    return res.status(403).json({ error: '본인 작성 CAR만 삭제 가능' });
  }
  next();
}

// 고객정보 삭제 권한 미들웨어 (ADMIN만)
function customerDeleteOnlyAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: '고객 정보 삭제는 ADMIN만 가능' });
  }
  next();
}

module.exports = { canDeleteCar, customerDeleteOnlyAdmin }; 