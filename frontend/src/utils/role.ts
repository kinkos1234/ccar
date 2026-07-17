// 권한 분기 유틸 함수 모듈
// User 타입을 이 파일 내에서 직접 정의
export type User = {
  id: number;
  name: string;
  role: "ADMIN" | "MANAGER" | "STAFF";
};

export function canEditCar(user: User | null, car: { createdBy?: number } | null) {
  if (!user || !car) return false;
  return user.role === "ADMIN" || user.role === "MANAGER" || user.id === car.createdBy;
}

export function canDeleteCar(user: User | null, car: { createdBy?: number } | null) {
  // 삭제 권한은 수정과 동일 기준(추후 분리 가능)
  return canEditCar(user, car);
}

export function canEditCustomer(user: User | null) {
  if (!user) return false;
  return user.role === "ADMIN" || user.role === "MANAGER";
}

export function canDeleteCustomer(user: User | null) {
  // 고객 삭제는 ADMIN만
  if (!user) return false;
  return user.role === "ADMIN";
} 