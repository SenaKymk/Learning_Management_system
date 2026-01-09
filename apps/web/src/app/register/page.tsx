"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getToken, registerUser } from "../../modules/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) {
      router.replace("/courses");
    }
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await registerUser({
        email,
        password,
        firstName,
        lastName,
        studentNumber
      });
      setSuccess("Registration complete. You can sign in now.");
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setStudentNumber("");
      setTimeout(() => router.replace("/login"), 800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold text-white">Create student account</h1>
        <p className="mt-2 text-sm text-slate-300">
          Fill in your details to request access.
        </p>
        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
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
          <label className="grid gap-2 text-sm text-slate-200">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-white"
              required
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-200">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-white"
              required
              minLength={6}
            />
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
