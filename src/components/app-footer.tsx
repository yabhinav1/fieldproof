import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="border-t border-black/[0.07] bg-[#f7f8f6]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <span>
          FieldProof · Field evidence · Verification · Impact reporting
        </span>

        <nav aria-label="Footer" className="flex items-center gap-5">
          <Link href="/" className="hover:text-[#172019]">
            Projects
          </Link>

          <Link href="/credits" className="hover:text-[#172019]">
            Photo credits
          </Link>

          <a
            href="https://github.com/yabhinav1/fieldproof"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#172019]"
          >
            Source on GitHub ↗
          </a>
        </nav>
      </div>
    </footer>
  );
}
