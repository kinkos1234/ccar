import { SortDirection, getSortIconPath } from '@/utils/sort';

interface SortIconProps {
  direction: SortDirection;
  columnName?: string;
}

export default function SortIcon({ direction, columnName }: SortIconProps) {
  const { path, color } = getSortIconPath(direction);
  
  const getAriaLabel = () => {
    const column = columnName || '열';
    switch (direction) {
      case 'asc':
        return `${column} 오름차순 정렬됨`;
      case 'desc':
        return `${column} 내림차순 정렬됨`;
      default:
        return `${column} 정렬 안됨`;
    }
  };
  
  return (
    <svg 
      className={`w-4 h-4 ${color}`} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
      aria-label={getAriaLabel()}
      role="img"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth="2" 
        d={path} 
      />
    </svg>
  );
} 