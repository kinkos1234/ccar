"use client";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function ReportDetailRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations('report.redirect');

  useEffect(() => {
    // /admin/report/[id]로 리다이렉트
    router.replace(`/admin/report/${params.id}`);
  }, [router, params.id]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#111167] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div>{t('message')}</div>
      </div>
    </div>
  );
}
