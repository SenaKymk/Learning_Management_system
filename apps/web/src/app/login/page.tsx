"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiRequestError, getToken, login } from "../../modules/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) {
      router.replace("/courses");
    }
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.replace("/courses");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.isNetwork) {
          setError("Backend unreachable");
        } else if (err.status === 401) {
          setError("Invalid credentials");
        } else {
          setError(err.message || "Login failed");
        }
      } else {
        setError("Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-300">
          Sign in to manage courses and exams.
        </p>
        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
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
            />
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-300">
          New here?{" "}
          <a href="/register" className="text-primary-200 hover:underline">
            Create a student account
          </a>
        </p>
      </div>
    </div>
  );
}
