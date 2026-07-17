"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/utils/api";

type ActivityLog = {
  id: number;
  carId: number;
  userId: number | null;
  activityType: string;
  changedField: string | null;
  oldValue: string | null;
  newValue: string | null;
  summary: string | null;
  createdAt: string;
  user?: {
    id: number;
    name: string;
    department?: string;
    role?: string;
  } | null;
};

function formatRelative(iso: string): string {
  const now = new Date();
  const then = new Date(iso);
  const diffSec = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  return then.toISOString().slice(0, 10);
}

function iconFor(activityType: string) {
  const common = "w-4 h-4";
  switch (activityType) {
    case "CREATED":
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      );
    case "ASSIGNED":
    case "UNASSIGNED":
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
      );
    case "FIELD_UPDATED":
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
        </svg>
      );
    default:
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      );
  }
}

export default function CarActivityTimeline({ carId }: { carId: number | string }) {
  const t = useTranslations("car.timeline");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!carId) return;
    setLoading(true);
    apiFetch(`/api/car/${carId}/activities`)
      .then((res) => {
        setLogs(Array.isArray(res?.data) ? res.data : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [carId]);

  if (loading) {
    return <div className="text-zinc-500 text-[13px] py-4">{t("loading")}</div>;
  }
  if (error) {
    return <div className="text-red-400 text-[13px] py-4">{t("loadFailed")}: {error}</div>;
  }
  if (logs.length === 0) {
    return <div className="text-zinc-500 text-[13px] py-4 text-center">{t("empty")}</div>;
  }

  return (
    <ol className="relative border-l border-zinc-800 ml-2 space-y-4 py-2">
      {logs.map((log) => (
        <li key={log.id} className="ml-4">
          <span className="absolute -left-[9px] flex items-center justify-center w-4 h-4 bg-zinc-800 rounded-full text-[#9999cc]">
            {iconFor(log.activityType)}
          </span>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-zinc-200">
              {log.user?.name || t("systemUser")}
            </span>
            {log.user?.department && (
              <span className="text-[11px] text-zinc-500">{log.user.department}</span>
            )}
            <span className="text-[11px] text-zinc-500">· {formatRelative(log.createdAt)}</span>
          </div>
          <div className="text-[13px] text-zinc-300 mt-0.5">
            {log.summary || t(`types.${log.activityType}`, { default: log.activityType })}
          </div>
          {log.activityType === "FIELD_UPDATED" && log.changedField && (
            <div className="mt-1 text-[12px] text-zinc-500">
              <span className="text-zinc-400 line-through">{log.oldValue || "-"}</span>
              <span className="mx-2">→</span>
              <span className="text-zinc-200">{log.newValue || "-"}</span>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
