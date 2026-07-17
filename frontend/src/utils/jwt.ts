export function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function isTokenValid(token: string): boolean {
  try {
    const payload = parseJwt(token);
    if (!payload) return false;
    
    // exp 값이 있는지 확인 (exp는 초 단위)
    if (payload.exp) {
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp > currentTime;
    }
    
    // exp가 없으면 유효하다고 가정 (하지만 이는 안전하지 않음)
    return true;
  } catch {
    return false;
  }
}

export function getCurrentUser() {
  if (typeof window === 'undefined') return null;
  
  const token = sessionStorage.getItem('token');
  if (!token) return null;
  
  // 토큰 유효성 검사
  if (!isTokenValid(token)) {
    // 만료된 토큰이면 세션 스토리지에서 제거
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    return null;
  }
  
  const payload = parseJwt(token);
  return payload;
}

export function clearAuthData() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  
  const token = sessionStorage.getItem('token');
  if (!token) return false;
  
  return isTokenValid(token);
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  const token = sessionStorage.getItem('token');
  if (!token) return null;
  
  // 토큰 유효성 검사
  if (!isTokenValid(token)) {
    clearAuthData();
    return null;
  }
  
  return token;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  
  return {
    'Authorization': `Bearer ${token}`
  };
} 