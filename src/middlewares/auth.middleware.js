const { verify } = require('../utils/jwt');

function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 필요' });
  }
  const token = auth.split(' ')[1];
  const user = verify(token);
  if (!user) {
    return res.status(401).json({ error: '유효하지 않은 토큰' });
  }
  req.user = user;
  next();
}

// 인증 필수 미들웨어 (별칭)
function requireAuth(req, res, next) {
  return authMiddleware(req, res, next);
}

// 역할 기반 권한 체크 미들웨어
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }
    
    next();
  };
}

module.exports = { 
  authMiddleware, 
  requireAuth, 
  requireRole 
}; 