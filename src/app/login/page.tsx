"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-black text-center">
        <h1 className="text-2xl font-semibold mb-4">Login</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Sign in to Boundly using your GitHub account.
        </p>
        <div className="grid gap-3">
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="inline-flex items-center justify-center rounded-lg border px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            Sign in with Google
          </button>

          <div className="my-4 text-xs text-gray-500">or</div>

          <form
            className="text-left grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(true);
              setError(null);
              try {
                if (mode === "register") {
                  const resp = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password }),
                  });
                  if (!resp.ok) {
                    const j = await resp.json().catch(() => ({}));
                    throw new Error(j.error || `Registration failed (${resp.status})`);
                  }
                }
                const r = await signIn("credentials", {
                  email,
                  password,
                  redirect: false,
                });
                if (r?.error) throw new Error(r.error);
                router.replace("/");
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Something went wrong");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                required
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 disabled:opacity-60"
              disabled={submitting}
            >
              {mode === "register" ? (submitting ? "Creating…" : "Create account") : submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <button
            type="button"
            className="text-xs text-blue-600 hover:underline justify-self-start"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Create an account" : "Have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
