import type { ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@trawl/ui/components/badge";
import { Button } from "@trawl/ui/components/button";
import { cn } from "@trawl/ui/lib/utils";

type AppShellProps = {
  current: "capture" | "items";
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const navItems = [
  { href: "/capture", label: "Bulk capture", key: "capture" },
  { href: "/items", label: "Inbox", key: "items" },
] as const;

export function AppShell({
  current,
  title,
  description,
  eyebrow = "Operational UI",
  actions,
  children,
}: AppShellProps) {
  return (
    <main className="min-h-svh bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(241,245,249,0.96))] text-foreground dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.98))]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6 md:px-10 md:py-10">
        <header className="overflow-hidden rounded-[28px] border border-border/70 bg-background/90 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:shadow-[0_18px_70px_rgba(2,6,23,0.45)]">
          <div className="flex flex-col gap-6 px-6 py-6 md:px-8 md:py-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Trawl</Badge>
                  <Badge variant="secondary">Staging layer upstream of Obsidian</Badge>
                </div>
                <div className="space-y-2">
                  <p className="font-mono text-xs tracking-[0.24em] text-muted-foreground uppercase">
                    {eyebrow}
                  </p>
                  <h1 className="max-w-3xl text-3xl leading-tight font-semibold md:text-4xl">
                    {title}
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                    {description}
                  </p>
                </div>
              </div>

              <nav className="flex flex-wrap gap-2">
                {navItems.map((item) => {
                  const active = item.key === current;

                  return (
                    <Button key={item.href} variant={active ? "default" : "outline"} asChild>
                      <Link href={item.href} className={cn(active && "shadow-sm")}>
                        {item.label}
                      </Link>
                    </Button>
                  );
                })}
              </nav>
            </div>

            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
