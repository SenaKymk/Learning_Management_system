"use client";

import { useEffect, useState } from "react";
import AuthGuard from "../../components/AuthGuard";
import { fetchMyGrades, getUserRole, type GradeEntry, type UserRole } from "../../modules/api";

export default function ResultsPage() {
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentRole = getUserRole();
    setRole(currentRole);

    if (currentRole === "STUDENT") {
      fetchMyGrades()
        .then((data) => setGrades(data))
        .catch((err) => {
          const message = err instanceof Error ? err.message : "Failed to load grades";
          setError(message);
        });
    }
  }, []);

  return (
    <AuthGuard>
      <div className="grid gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-white">My Results</h1>
          <p className="mt-2 text-slate-300">Your latest exam performance.</p>
        </div>
        {role !== "STUDENT" ? (
          <div className="card p-5">
            <p className="text-sm text-slate-300">Results are available for students only.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {error ? <p className="text-rose-300">{error}</p> : null}
            {grades.length === 0 ? (
              <p className="text-slate-400">No grades available yet.</p>
            ) : null}
            {grades.map((result) => (
              <div key={result.id} className="card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">{result.courseTitle}</p>
                    <h2 className="text-lg font-semibold text-white">Course Grade</h2>
                    <p className="text-xs text-slate-400">Source: {result.source}</p>
                  </div>
                  <span className="badge">{result.score ?? "Not graded yet"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
