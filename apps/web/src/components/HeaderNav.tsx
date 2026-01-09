"use client";

import Link from "next/link";
import AuthActions from "./AuthActions";
import { useI18n } from "../modules/i18n";

export default function HeaderNav() {
  const { locale, setLocale, t } = useI18n();

  return (
    <nav className="flex items-center gap-3 text-sm text-slate-300">
      <Link href="/courses" className="hover:text-primary-100">
        {t("courses")}
      </Link>
      <Link href="/seb" className="hover:text-primary-100">
        SEB Check
      </Link>
      <Link href="/profile" className="hover:text-primary-100">
        Profile
      </Link>
      <div className="flex items-center gap-1 rounded-full border border-primary-400/40 bg-primary-500/10 p-1">
        <button
          type="button"
          onClick={() => setLocale("en")}
          className={locale === "en" ? "px-2 py-1 text-xs text-white" : "px-2 py-1 text-xs text-slate-300"}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => setLocale("tr")}
          className={locale === "tr" ? "px-2 py-1 text-xs text-white" : "px-2 py-1 text-xs text-slate-300"}
        >
          TR
        </button>
      </div>
      <AuthActions />
    </nav>
  );
}
