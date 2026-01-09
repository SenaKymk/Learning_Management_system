"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AuthGuard from "../../components/AuthGuard";
import {
  cloneCourse,
  createCourse,
  fetchCourses,
  getUserRole,
  type Course,
  type UserRole
} from "../../modules/api";
import { useI18n } from "../../modules/i18n";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [cloneMode, setCloneMode] = useState(false);
  const [cloneCourseId, setCloneCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const { t } = useI18n();

  const loadCourses = async () => {
    try {
      const data = await fetchCourses();
      setCourses(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load courses";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setRole(getUserRole());
    loadCourses();
  }, []);

  const handleCreateCourse = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);
    setSaving(true);

    try {
      if (cloneMode) {
        if (!cloneCourseId) {
          setFormMessage("Select a course to clone.");
          return;
        }
        await cloneCourse(cloneCourseId);
      } else {
        await createCourse(title, description || undefined);
      }
      setTitle("");
      setDescription("");
      setShowForm(false);
      setFormMessage("Course created successfully");
      await loadCourses();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create course";
      setFormMessage(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-white">{t("courses")}</h1>
            <p className="mt-2 text-slate-300">
              Browse active courses and review materials.
            </p>
          </div>
          {role === "ADMIN" ? (
            <button type="button" className="btn" onClick={() => setShowForm((prev) => !prev)}>
              {showForm ? "Close" : "+ New Course"}
            </button>
          ) : null}
        </div>

        {role === "ADMIN" && showForm ? (
          <div className="card p-6">
            <form className="grid gap-4" onSubmit={handleCreateCourse}>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={cloneMode}
                  onChange={(event) => setCloneMode(event.target.checked)}
                />
                Clone existing course
              </label>
              {cloneMode ? (
                <label className="grid gap-2 text-sm text-slate-200">
                  Source course
                  <select
                    value={cloneCourseId}
                    onChange={(event) => setCloneCourseId(event.target.value)}
                    className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-white"
                  >
                    <option value="">Select a course</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label className="grid gap-2 text-sm text-slate-200">
                    Title
                    <input
                      type="text"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-white"
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    Description
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      className="min-h-[120px] rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-white"
                    />
                  </label>
                </>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? "Working..." : cloneMode ? "Clone course" : "Create course"}
                </button>
                {formMessage ? <span className="text-sm text-slate-300">{formMessage}</span> : null}
              </div>
            </form>
          </div>
        ) : null}

        {loading ? <p className="text-slate-400">Loading...</p> : null}
        {error ? <p className="text-rose-300">{error}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <Link key={course.id} href={`/courses/${course.id}`} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{course.title}</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    {course.description ?? "No description provided"}
                  </p>
                </div>
                <span className="badge">
                  {course.materialKey ? "Material linked" : "No material"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AuthGuard>
  );
}
