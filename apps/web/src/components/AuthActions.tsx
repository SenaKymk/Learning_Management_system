"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearToken, getToken, getUserRole, setUserRole, type UserRole } from "../modules/api";
import { useI18n } from "../modules/i18n";

export default function AuthActions() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    // Sync role after login/logout or route changes.
    const token = getToken();
    if (!token) {
      setRole(null);
      return;
    }
    setRole(getUserRole());
  }, [pathname]);

  const handleLogout = () => {
    clearToken();
    setUserRole(null);
    setRole(null);
    router.replace("/login");
  };

  if (!role) {
    return (
      <Link href="/login" className="btn-secondary">
        {t("login")}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="badge">{role}</span>
      <button type="button" onClick={handleLogout} className="btn-secondary">
        {t("logout")}
      </button>
    </div>
  );
}
