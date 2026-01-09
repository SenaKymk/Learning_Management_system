"use client";

import { useEffect, useState } from "react";
import AuthGuard from "../../components/AuthGuard";
import { fetchAdminMetrics, getUserRole, type AdminMetrics, type UserRole } from "../../modules/api";

export default function AdminDashboardPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentRole = getUserRole();
    setRole(currentRole);

    if (currentRole !== "ADMIN") {
      return;
    }

    fetchAdminMetrics()
      .then((data) => setMetrics(data))
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to load metrics";
        setError(message);
      });
  }, []);

  return (
    <AuthGuard>
      <div className="grid gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-white">Admin Dashboard</h1>
          <p className="mt-2 text-slate-300">Live course and enrollment metrics.</p>
        </div>
        {role !== "ADMIN" ? (
          <div className="card p-6">
            <p className="text-sm text-slate-300">You do not have access to this page.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {error ? <p className="text-rose-300">{error}</p> : null}
            <div className="card card-accent p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-primary-200">Courses</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {metrics ? metrics.totalCourses : "-"}
              </p>
            </div>
            <div className="card card-accent p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-primary-200">Students</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {metrics ? metrics.totalStudents : "-"}
              </p>
            </div>
            <div className="card card-accent p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-primary-200">Enrolled</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {metrics ? metrics.totalEnrolledStudents : "-"}
              </p>
            </div>
            <div className="card card-accent p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-primary-200">Average grade</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {metrics?.averageGrade !== null && metrics ? metrics.averageGrade.toFixed(1) : "-"}
              </p>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
