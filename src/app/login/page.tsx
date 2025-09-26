"use client";

import { useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  // Show loading state while session is being determined
  if (status === "loading") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render login form if already authenticated
  if (status === "authenticated") {
    return null;
  }

  return (
    <>
      <Header />
      <div className="min-h-[70vh] flex items-center justify-center px-6 py-10 pt-24">
        <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-black text-center">
          <h1 className="text-2xl font-semibold mb-4">Login</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Sign in to Boundly using your Google account.
          </p>
          <div className="grid gap-3">
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-900"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
