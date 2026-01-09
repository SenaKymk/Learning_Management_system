"use client";

import { useEffect, useState } from "react";
import AuthGuard from "../../components/AuthGuard";
import { getProfile, updateProfile, type UserProfile } from "../../modules/api";

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getProfile();
        setProfile(data);
        setFirstName(data.firstName ?? "");
        setLastName(data.lastName ?? "");
        setStudentNumber(data.studentNumber ?? "");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load profile";
        setError(message);
      }
    };

    load();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) {
      return;
    }

    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const updated = await updateProfile({
        firstName,
        lastName,
        studentNumber: profile.role === "STUDENT" ? studentNumber : undefined
      });
      setProfile(updated);
      setSuccess("Profile updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <div className="mx-auto grid max-w-xl gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-white">Profile</h1>
          <p className="mt-2 text-slate-300">Manage your personal information.</p>
        </div>
        <div className="card p-6">
          {!profile ? <p className="text-slate-400">Loading...</p> : null}
          {profile ? (
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm text-slate-200">
                Email
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-slate-400"
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-200">
                First name
                <input
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-white"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-200">
                Last name
                <input
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-white"
                  required
                />
              </label>
              {profile.role === "STUDENT" ? (
                <label className="grid gap-2 text-sm text-slate-200">
                  Student number
                  <input
                    type="text"
                    value={studentNumber}
                    onChange={(event) => setStudentNumber(event.target.value)}
                    className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-white"
                    required
                  />
                </label>
              ) : null}
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
              <button type="submit" className="btn" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </AuthGuard>
  );
}
