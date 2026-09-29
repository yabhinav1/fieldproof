"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f6] px-6 text-[#172019]">
      <div role="alert" className="max-w-md text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Something went wrong
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
          This page could not be shown
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your evidence is safe. Try again, and if the problem stays, go back
          to your projects.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-lg bg-[#172019] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#29382f]"
          >
            Try again
          </button>

          <Link
            href="/"
            className="rounded-lg border border-black/[0.1] bg-white px-5 py-2.5 text-sm font-medium transition hover:border-black/[0.2]"
          >
            Back to projects
          </Link>
        </div>
      </div>
    </main>
  );
}
