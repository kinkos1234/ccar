/**
 * CAR 상태 계산 통합 유틸리티
 * 백엔드와 동일한 로직으로 일관성 보장
 */

export type CarStatus = 'CLOSED' | 'IN_PROGRESS' | 'DELAYED';

export interface CarItem {
  id: number;
  eventType: 'ONE_TIME' | 'CONTINUOUS';
  completionDate?: number | bigint | string | null;
  dueDate?: number | bigint | string | null;
  [key: string]: unknown;
}

/**
 * CAR 상태 계산 (백엔드 calcStatus와 동일한 로직)
 */
export function calculateCarStatus(car: CarItem): CarStatus {
  try {
    // ONE_TIME 이벤트는 항상 CLOSED
    if (car.eventType === "ONE_TIME") {
      return "CLOSED";
    } 
    
    // CONTINUOUS 이벤트 처리
    if (car.eventType === "CONTINUOUS") {
      // 완료일이 있으면 CLOSED (null, 빈값, "-" 문자열, 0 제외)
      if (car.completionDate && 
          car.completionDate !== null && 
          car.completionDate !== '' && 
          car.completionDate !== '-' &&
          car.completionDate !== 0) {
        return "CLOSED";
      }
      
      // 완료일이 없는 경우 (DELAYED 또는 IN_PROGRESS 판단)
      if (car.dueDate) {
        // BigInt 타입을 Number로 변환 처리
        let dueDateValue: number;
        if (typeof car.dueDate === 'bigint') {
          dueDateValue = Number(car.dueDate);
        } else if (typeof car.dueDate === 'string') {
          dueDateValue = parseInt(car.dueDate);
        } else {
          dueDateValue = car.dueDate;
        }
        
        // Unix timestamp를 Date 객체로 변환
        const dueDate = new Date(dueDateValue);
        const today = new Date();
        
        // 시간 부분을 제거하고 날짜만 비교 (자정 기준)
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        // 기한일이 오늘보다 이전이면 DELAYED (오늘 제외)
        if (dueDateOnly < todayOnly) {
          return "DELAYED";
        }
      }
      
      // 완료되지 않고 기한도 지나지 않은 경우 IN_PROGRESS
      return "IN_PROGRESS";
    }
    
    // 그 외의 경우 IN_PROGRESS
    return "IN_PROGRESS";
  } catch (err) {
    console.error('상태 계산 오류:', err, car);
    console.error('CAR 데이터:', { 
      id: car.id, 
      eventType: car.eventType, 
      dueDate: car.dueDate, 
      dueDateType: typeof car.dueDate,
      completionDate: car.completionDate 
    });
    return "IN_PROGRESS";
  }
}

/**
 * CAR 배열에 상태를 추가하는 헬퍼 함수
 */
export function addStatusToCars<T extends CarItem>(cars: T[]): (T & { status: CarStatus })[] {
  return cars.map(car => ({
    ...car,
    status: calculateCarStatus(car)
  }));
}

/**
 * 상태별로 CAR 개수를 집계하는 함수
 */
export function getStatusCounts(cars: CarItem[]) {
  const counts = {
    CLOSED: 0,
    IN_PROGRESS: 0,
    DELAYED: 0
  };
  
  cars.forEach(car => {
    const status = calculateCarStatus(car);
    counts[status]++;
  });
  
  return counts;
} 