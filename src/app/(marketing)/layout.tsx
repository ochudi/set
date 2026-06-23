import Link from "next/link";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { getSetting } from "@/lib/dal";

export default async function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [orgName, contactEmail, foundingYear] = await Promise.all([
    getSetting("org_name"),
    getSetting("org_contact_email"),
    getSetting("org_founding_year"),
  ]);

  const name = orgName ?? "PAU Alumni Association";
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-sans text-lg font-semibold italic tracking-tight"
          >
            Set.
          </Link>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {name}
            {foundingYear ? ` · serving alumni since ${foundingYear}` : ""}
          </p>
          <nav className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            {contactEmail ? (
              <a
                href={`mailto:${contactEmail}`}
                className="hover:text-foreground"
              >
                Contact
              </a>
            ) : (
              <span>Contact the alumni committee</span>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}
