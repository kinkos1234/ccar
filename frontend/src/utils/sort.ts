/**
 * 한글 - 영문 가나다순 정렬 및 테이블 정렬 유틸리티
 */

export type SortDirection = 'asc' | 'desc' | null;

export interface TableSortConfig {
  column: string;
  direction: SortDirection;
}

/**
 * 문자열이 한글인지 확인
 */
function isKorean(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 0xAC00 && code <= 0xD7AF) || // 완성형 한글
         (code >= 0x1100 && code <= 0x11FF) || // 자음
         (code >= 0x3130 && code <= 0x318F) || // 호환 자음
         (code >= 0xA960 && code <= 0xA97F) || // 확장 자음
         (code >= 0xD7B0 && code <= 0xD7FF);   // 확장 한글
}

/**
 * 고객 담당자 배열을 이름 기준으로 한글 → 영문 순서로 정렬
 * @param contacts 고객 담당자 배열
 * @returns 정렬된 고객 담당자 배열
 */
export function sortContactsByName<T extends { id: number; name: string }>(contacts: T[]): T[] {
  return [...contacts].sort((a, b) => {
    const nameA = a.name.trim();
    const nameB = b.name.trim();
    
    const isKoreanA = isKorean(nameA.charAt(0));
    const isKoreanB = isKorean(nameB.charAt(0));
    
    // 한글이 영문보다 우선순위
    if (isKoreanA && !isKoreanB) return -1;
    if (!isKoreanA && isKoreanB) return 1;
    
    // 같은 언어끼리는 사전순 정렬
    return nameA.localeCompare(nameB, 'ko-KR', { 
      numeric: true, 
      caseFirst: 'upper' 
    });
  });
}

/**
 * 배열을 특정 속성 기준으로 한글 → 영문 순서로 정렬
 * @param items 정렬할 배열
 * @param key 정렬 기준이 되는 속성명
 * @returns 정렬된 배열
 */
export function sortByProperty<T>(items: T[], key: keyof T): T[] {
  return [...items].sort((a, b) => {
    const valueA = String(a[key]).trim();
    const valueB = String(b[key]).trim();
    
    const isKoreanA = isKorean(valueA.charAt(0));
    const isKoreanB = isKorean(valueB.charAt(0));
    
    // 한글이 영문보다 우선순위
    if (isKoreanA && !isKoreanB) return -1;
    if (!isKoreanA && isKoreanB) return 1;
    
    // 같은 언어끼리는 사전순 정렬
    return valueA.localeCompare(valueB, 'ko-KR', { 
      numeric: true, 
      caseFirst: 'upper' 
    });
  });
}

/**
 * 테이블 데이터를 특정 컬럼 기준으로 정렬
 * @param items 정렬할 배열
 * @param column 정렬할 컬럼명
 * @param direction 정렬 방향
 * @returns 정렬된 배열
 */
export function sortTableData<T extends Record<string, unknown>>(
  items: T[], 
  column: string, 
  direction: SortDirection
): T[] {
  if (!direction || !column) return items;

  return [...items].sort((a, b) => {
    const valueA = a[column];
    const valueB = b[column];

    // null/undefined 처리
    if (valueA == null && valueB == null) return 0;
    if (valueA == null) return direction === 'asc' ? 1 : -1;
    if (valueB == null) return direction === 'asc' ? -1 : 1;

    // 숫자 타입 처리
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    }

    // 날짜 타입 처리 (YYYY-MM-DD 형식)
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}/;
      if (dateRegex.test(valueA) && dateRegex.test(valueB)) {
        const dateA = new Date(valueA).getTime();
        const dateB = new Date(valueB).getTime();
        return direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
    }

    // 문자열 타입 처리 (한글-영문 고려)
    const strA = String(valueA).trim();
    const strB = String(valueB).trim();
    
    const isKoreanA = isKorean(strA.charAt(0));
    const isKoreanB = isKorean(strB.charAt(0));
    
    // 기본 비교
    let comparison = 0;
    if (isKoreanA && !isKoreanB) {
      comparison = -1;
    } else if (!isKoreanA && isKoreanB) {
      comparison = 1;
    } else {
      comparison = strA.localeCompare(strB, 'ko-KR', { 
        numeric: true, 
        caseFirst: 'upper' 
      });
    }

    return direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * 정렬 방향 토글 함수
 * @param currentDirection 현재 정렬 방향
 * @returns 다음 정렬 방향
 */
export function toggleSortDirection(currentDirection: SortDirection): SortDirection {
  if (currentDirection === null) return 'asc';
  if (currentDirection === 'asc') return 'desc';
  return null; // desc -> null (정렬 해제)
}

/**
 * 정렬 아이콘 SVG 경로 반환
 */
export function getSortIconPath(direction: SortDirection): { path: string; color: string } {
  if (direction === 'asc') {
    return {
      path: "M5 15l7-7 7 7",
      color: "text-blue-400"
    };
  }
  
  if (direction === 'desc') {
    return {
      path: "M19 9l-7 7-7-7",
      color: "text-blue-400"
    };
  }
  
  return {
    path: "M8 9l4-4 4 4m0 6l-4 4-4-4",
    color: "text-gray-600"
  };
} 