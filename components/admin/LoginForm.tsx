"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Lock } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/admin");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
    } catch {
      setError("Network error, please retry");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-10 shadow-[0_30px_80px_-32px_rgba(19,19,22,0.25)]"
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink-soft">
            <Lock className="h-4.5 w-4.5" strokeWidth={1.5} aria-hidden />
          </span>
          <div>
            <h1 className="text-sm font-semibold uppercase tracking-[0.35em] text-ink">
              Records
            </h1>
            <p className="mt-1 text-xs text-ink-muted">Admin access</p>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-ink-muted">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
            className="h-11 w-full rounded-xl border border-line bg-canvas px-4 text-sm text-ink outline-none transition-colors focus:border-line-strong focus:bg-surface"
          />
        </label>

        {error && (
          <p role="alert" className="mt-3 text-xs text-ink-soft">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Signing in" : "Sign in"}
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
      </motion.form>
    </div>
  );
}
