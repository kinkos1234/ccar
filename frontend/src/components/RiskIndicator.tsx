"use client";
import { useTranslations } from "next-intl";

interface RiskIndicatorProps {
  riskMitigation: boolean;
  riskLevel?: string | null;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function RiskIndicator({ 
  riskMitigation, 
  riskLevel = 'MEDIUM', 
  showLabel = false, 
  size = 'md' 
}: RiskIndicatorProps) {
  const t = useTranslations('risk');

  // 리스크가 없으면 표시하지 않음
  if (!riskMitigation) {
    return showLabel ? <span className="text-zinc-500 text-[13px]">-</span> : null;
  }

  // 크기별 스타일
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3', 
    lg: 'w-4 h-4'
  };

  // 리스크 레벨별 색상
  const getRiskColor = (level: string | null) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-600'; // 매우 위험 - 진한 빨강
      case 'HIGH':
        return 'bg-red-500'; // 위험 - 빨강
      case 'MEDIUM':
        return 'bg-yellow-500'; // 중간 - 노랑
      case 'LOW':
        return 'bg-orange-400'; // 낮음 - 오렌지
      default:
        return 'bg-red-500'; // 기본 빨강
    }
  };

  const getRiskLabel = (level: string | null) => {
    switch (level) {
      case 'CRITICAL':
        return t('level.critical');
      case 'HIGH':
        return t('level.high');
      case 'MEDIUM':
        return t('level.medium');
      case 'LOW':
        return t('level.low');
      default:
        return t('level.unknown');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div 
        className={`${sizeClasses[size]} ${getRiskColor(riskLevel)} rounded-full flex-shrink-0`}
        title={`${t('mitigation')}: ${getRiskLabel(riskLevel)}`}
      />
      {showLabel && (
        <span className={`text-${getRiskColor(riskLevel).replace('bg-', '').replace('-500', '-400').replace('-600', '-500')} font-medium text-sm`}>
          {getRiskLabel(riskLevel)}
        </span>
      )}
    </div>
  );
}
