"use client";

import { useEffect, useState } from "react";
import AuthGuard from "../../../components/AuthGuard";
import {
  fetchCourses,
  fetchCourseStudents,
  getUserRole,
  type UserRole
} from "../../../modules/api";

type Row = {
  id: string;
  student: string;
  course: string;
  score: number | null;
  source: string | null;
};

export default function AdminResultsPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentRole = getUserRole();
    setRole(currentRole);

    if (currentRole !== "ADMIN") {
      return;
    }

    const load = async () => {
      try {
        const courses = await fetchCourses();
        const allRows: Row[] = [];

        for (const course of courses) {
          const students = await fetchCourseStudents(course.id, "ENROLLED");
          students.forEach((student) => {
            allRows.push({
              id: `${course.id}-${student.userId}`,
              student: `${student.firstName} ${student.lastName}`,
              course: course.title,
              score: student.score ?? null,
              source: student.source ?? null
            });
          });
        }

        setRows(allRows);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load results";
        setError(message);
      }
    };

    load();
  }, []);

  return (
    <AuthGuard>
      <div className="grid gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-white">Results Overview</h1>
          <p className="mt-2 text-slate-300">Admin view for real grades.</p>
        </div>
        {role !== "ADMIN" ? (
          <div className="card p-6">
            <p className="text-sm text-slate-300">You do not have access to this page.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {error ? <p className="p-4 text-rose-300">{error}</p> : null}
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead className="bg-white/5 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className="border-t border-white/10">
                    <td className="px-4 py-3 text-slate-400" colSpan={4}>
                      No grades available yet.
                    </td>
                  </tr>
                ) : null}
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="px-4 py-3">{row.student}</td>
                    <td className="px-4 py-3">{row.course}</td>
                    <td className="px-4 py-3">{row.source ?? "-"}</td>
                    <td className="px-4 py-3">{row.score ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
