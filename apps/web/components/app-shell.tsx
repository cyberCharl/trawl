import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@trawl/ui/lib/utils";

type AppShellProps = {
  current: "capture" | "items";
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const navItems = [
  { href: "/capture", label: "Capture", key: "capture" },
  { href: "/items", label: "Inbox", key: "items" },
] as const;

export function AppShell({
  current,
  title,
  description,
  eyebrow,
  actions,
  children,
}: AppShellProps) {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 md:px-10 md:py-10">
        <header className="space-y-7">
          {/* Top bar: wordmark · nav · actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-7">
              <span className="text-[11px] font-semibold tracking-[0.35em] text-primary">
                TRAWL
              </span>
              <nav className="flex items-center">
                {navItems.map((item) => {
                  const active = item.key === current;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "relative px-3.5 py-2 text-[11px] tracking-[0.18em] uppercase transition-colors",
                        active
                          ? "text-foreground after:absolute after:inset-x-3.5 after:bottom-0 after:h-[2px] after:rounded-full after:bg-primary after:content-['']"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Title block */}
          <div className="space-y-2">
            {eyebrow ? (
              <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-3xl leading-snug font-semibold text-foreground md:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
