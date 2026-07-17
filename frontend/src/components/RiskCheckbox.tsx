"use client";
import { useTranslations } from "next-intl";

interface RiskCheckboxProps {
  riskMitigation: boolean;
  riskDescription?: string;
  riskLevel?: string;
  onRiskMitigationChange: (value: boolean) => void;
  onRiskDescriptionChange?: (value: string) => void;
  onRiskLevelChange?: (value: string) => void;
  className?: string;
}

export default function RiskCheckbox({
  riskMitigation,
  riskDescription = '',
  riskLevel = 'MEDIUM',
  onRiskMitigationChange,
  onRiskDescriptionChange,
  onRiskLevelChange,
  className = ''
}: RiskCheckboxProps) {
  const t = useTranslations('risk');

  const riskLevelOptions = [
    { value: 'LOW', label: t('level.low') },
    { value: 'MEDIUM', label: t('level.medium') },
    { value: 'HIGH', label: t('level.high') },
    { value: 'CRITICAL', label: t('level.critical') }
  ];

  return (
    <div className={`bg-red-950/20 border border-red-900/30 rounded-lg p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-red-400/90 mb-3 flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
        {t('management.title')}
      </h3>

      <div className="flex items-center gap-2.5 mb-4">
        <input
          type="checkbox"
          id="riskMitigation"
          checked={riskMitigation}
          onChange={(e) => onRiskMitigationChange(e.target.checked)}
          className="w-4 h-4 text-red-600 bg-zinc-900 border-zinc-600 rounded focus:ring-red-500/40 focus:ring-2 cursor-pointer"
        />
        <label
          htmlFor="riskMitigation"
          className="text-[13px] font-medium text-zinc-300 cursor-pointer"
        >
          {t('mitigation')}
        </label>
      </div>

      {riskMitigation && onRiskLevelChange && (
        <div className="mb-4">
          <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">
            {t('level.label')}
          </label>
          <select
            value={riskLevel}
            onChange={(e) => onRiskLevelChange(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 focus:outline-none focus:border-[#111167] transition-colors"
          >
            {riskLevelOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {riskMitigation && onRiskDescriptionChange && (
        <div>
          <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">
            {t('description')}
          </label>
          <textarea
            value={riskDescription}
            onChange={(e) => onRiskDescriptionChange(e.target.value)}
            placeholder={t('descriptionPlaceholder')}
            rows={3}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] resize-none transition-colors"
          />
          <p className="text-[11px] text-zinc-500 mt-1">
            {t('descriptionHint')}
          </p>
        </div>
      )}

      {!riskMitigation && (
        <p className="text-[13px] text-zinc-500">
          {t('noRiskMessage')}
        </p>
      )}
    </div>
  );
}
