"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/utils/api";

type Notification = {
  id: number;
  userId: number;
  carId: number | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  car?: { id: number; corporation: string; openIssue: string | null } | null;
};

const POLL_INTERVAL_MS = 60_000;

export default function NotificationBell() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadCount = async () => {
    try {
      const res = await apiFetch("/api/notifications/unread-count");
      setUnread(res?.count ?? 0);
    } catch {
      // silently fail
    }
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/notifications?limit=10");
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCount();
    const id = setInterval(loadCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (open) loadList();
  }, [open]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleClick = async (n: Notification) => {
    try {
      if (!n.isRead) {
        await apiFetch(`/api/notifications/${n.id}/read`, { method: "PATCH" });
        loadCount();
      }
    } catch {
      // ignore
    }
    setOpen(false);
    if (n.carId) router.push(`/car/${n.carId}`);
  };

  const handleMarkAll = async () => {
    try {
      await apiFetch("/api/notifications/read-all", { method: "PATCH" });
      await Promise.all([loadCount(), loadList()]);
    } catch {
      // ignore
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
        aria-label={t("ariaLabel")}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-[#111113] border border-zinc-800/80 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
            <h3 className="text-[14px] font-semibold text-zinc-100">{t("title")}</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-[11px] text-[#9999cc] hover:text-white transition-colors"
                >
                  {t("markAllRead")}
                </button>
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/notifications");
                }}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {t("viewAll")}
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-zinc-500 text-[13px]">{t("loading")}</div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-[13px]">{t("empty")}</div>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className={`w-full text-left px-4 py-3 border-b border-zinc-800/40 transition-colors ${
                        n.isRead ? "hover:bg-zinc-900/60" : "bg-[#111167]/10 hover:bg-[#111167]/20"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#9999cc] flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-zinc-100 truncate">{n.title}</div>
                          <div className="text-[12px] text-zinc-400 mt-0.5 line-clamp-2">{n.message}</div>
                          <div className="text-[11px] text-zinc-500 mt-1">
                            {new Date(n.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
