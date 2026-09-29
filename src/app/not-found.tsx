import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f6] px-6 text-[#172019]">
      <div className="max-w-md text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          404
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
          This page does not exist
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The link may be out of date, or the project it pointed to may have
          been removed.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex rounded-lg bg-[#172019] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#29382f]"
        >
          Back to projects
        </Link>
      </div>
    </main>
  );
}
