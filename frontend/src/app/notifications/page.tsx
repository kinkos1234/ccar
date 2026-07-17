"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/utils/api";
import { isAuthenticated } from "@/utils/jwt";

type Notification = {
  id: number;
  carId: number | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  car?: { id: number; corporation: string; openIssue: string | null } | null;
};

const TYPE_COLORS: Record<string, string> = {
  RISK_ALERT: "bg-red-500/15 text-red-300 border-red-500/30",
  RISK_LEVEL_UP: "bg-red-500/15 text-red-300 border-red-500/30",
  OVERDUE: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  DUE_DATE_APPROACHING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  ASSIGNED: "bg-[#111167]/30 text-[#9999cc] border-[#111167]/40",
};

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/notifications?limit=100${filter === "unread" ? "&unreadOnly=true" : ""}`);
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    load();
  }, [filter]);

  const markRead = async (id: number) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {
      // ignore
    }
  };

  const markAll = async () => {
    try {
      await apiFetch("/api/notifications/read-all", { method: "PATCH" });
      await load();
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
      <div className="max-w-full mx-auto px-2 lg:px-4">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium px-4 py-2 transition-colors"
          >
            {t("backButton")}
          </button>
          <h1 className="text-lg font-semibold text-zinc-100">{t("pageTitle")}</h1>
        </div>

        <div className="bg-[#111113] border border-zinc-800/60 rounded-lg">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                  filter === "all" ? "bg-[#111167] text-white" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
                }`}
              >
                {t("filterAll")}
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                  filter === "unread" ? "bg-[#111167] text-white" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
                }`}
              >
                {t("filterUnread")}
              </button>
            </div>
            <button
              onClick={markAll}
              className="text-[12px] text-[#9999cc] hover:text-white transition-colors"
            >
              {t("markAllRead")}
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-zinc-500">{t("loading")}</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">{t("empty")}</div>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id} className="border-b border-zinc-800/40 last:border-b-0">
                  <div
                    className={`px-6 py-4 flex items-start gap-4 transition-colors cursor-pointer ${
                      n.isRead ? "hover:bg-zinc-900/60" : "bg-[#111167]/10 hover:bg-[#111167]/20"
                    }`}
                    onClick={async () => {
                      if (!n.isRead) await markRead(n.id);
                      if (n.carId) router.push(`/car/${n.carId}`);
                    }}
                  >
                    <div className="flex-shrink-0 pt-1">
                      {!n.isRead ? (
                        <span className="block w-2 h-2 rounded-full bg-[#9999cc]" />
                      ) : (
                        <span className="block w-2 h-2 rounded-full bg-zinc-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                            TYPE_COLORS[n.type] || "bg-zinc-800/60 text-zinc-400 border-zinc-700"
                          }`}
                        >
                          {t(`types.${n.type}`, { default: n.type })}
                        </span>
                        <span className="text-[14px] font-semibold text-zinc-100">{n.title}</span>
                      </div>
                      <div className="text-[13px] text-zinc-400 mt-1">{n.message}</div>
                      <div className="text-[11px] text-zinc-500 mt-2">
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
