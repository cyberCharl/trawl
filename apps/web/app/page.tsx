import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Database,
  LayoutPanelTop,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge } from "@trawl/ui/components/badge";
import { Button } from "@trawl/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@trawl/ui/components/card";
import { Input } from "@trawl/ui/components/input";

const workspaces = [
  {
    name: "apps/web",
    description:
      "Next.js app-router frontend with shadcn/ui wired through the shared package.",
    icon: LayoutPanelTop,
    detail: "Build screens quickly without coupling them to the API runtime.",
  },
  {
    name: "packages/ui",
    description:
      "Shared shadcn component library, theme tokens, and Tailwind entrypoint for the monorepo.",
    icon: Sparkles,
    detail: "Add new components from the repo root and reuse them everywhere.",
  },
  {
    name: "apps/api",
    description:
      "Existing Bun + Hono service moved into its own app workspace with the current capture pipeline intact.",
    icon: Database,
    detail: "Backend work can continue independently while the UI evolves.",
  },
] as const;

const highlights = [
  "Shared UI package with shadcn presets and components.json in place",
  "Turbo-managed workspace scripts for dev, lint, build, and typecheck",
  "Future `shadcn add ... -c apps/web` commands now target packages/ui correctly",
] as const;

const quickStart = [
  "bun install",
  "cp apps/api/.env.example apps/api/.env",
  "bun run dev",
  "bunx --bun shadcn@latest add dialog -c apps/web",
] as const;

export default function Page() {
  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_40%),linear-gradient(to_bottom,_transparent,_rgba(15,23,42,0.04))]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 md:px-10 md:py-14">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border border-border/60 bg-background/85 backdrop-blur">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline">Monorepo migration complete</Badge>
                <Badge variant="secondary">shadcn/ui enabled</Badge>
              </div>
              <CardTitle className="max-w-3xl text-4xl leading-tight sm:text-5xl">
                Trawl now has a dedicated Next.js frontend and a shared shadcn/ui package.
              </CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7">
                The repo has been reworked so the Bun API, the Next.js app, and the
                reusable UI layer can move independently without fighting the project
                structure.
              </CardDescription>
              <CardAction className="hidden lg:block">
                <div className="rounded-full border border-border/70 px-4 py-2 text-xs text-muted-foreground">
                  Press <span className="font-semibold text-foreground">d</span> to toggle theme
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="#workspace">
                    Explore the new structure
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="https://ui.shadcn.com/docs/components-json" target="_blank">
                    shadcn docs
                  </Link>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Frontend
                  </p>
                  <p className="mt-2 text-lg font-semibold">Next.js 16</p>
                  <p className="mt-1 text-sm text-muted-foreground">App router + Turbopack</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    UI system
                  </p>
                  <p className="mt-2 text-lg font-semibold">Shared shadcn package</p>
                  <p className="mt-1 text-sm text-muted-foreground">Reusable components in packages/ui</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Backend
                  </p>
                  <p className="mt-2 text-lg font-semibold">Bun + Hono API</p>
                  <p className="mt-1 text-sm text-muted-foreground">Capture pipeline preserved in apps/api</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-background/80 backdrop-blur">
            <CardHeader>
              <Badge className="w-fit">Starter UI surface</Badge>
              <CardTitle className="text-2xl">A clean base for search, capture, and retrieval flows</CardTitle>
              <CardDescription>
                The shared package already includes core shadcn primitives so we can start
                building the actual product UI immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
                <Input className="pl-10" placeholder="Search captures, summaries, tags, and related notes..." />
              </div>

              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Recent result preview</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A future search result card can combine metadata, tags, summaries,
                      and graph signals in one place.
                    </p>
                  </div>
                  <BrainCircuit className="mt-1 size-5 text-primary" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">summary</Badge>
                  <Badge variant="outline">semantic match</Badge>
                  <Badge variant="outline">auto-tagged</Badge>
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-between gap-4 text-sm text-muted-foreground">
              <span>Use the shared package for cards, forms, dialogs, tables, and navigation.</span>
              <ShieldCheck className="size-4 shrink-0 text-primary" />
            </CardFooter>
          </Card>
        </section>

        <section id="workspace" className="grid gap-4 md:grid-cols-3">
          {workspaces.map(({ name, description, icon: Icon, detail }) => (
            <Card key={name} className="border border-border/60 bg-background/85">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline">{name}</Badge>
                  <Icon className="size-4 text-primary" />
                </div>
                <CardTitle>{name}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{detail}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border border-border/60 bg-background/85">
            <CardHeader>
              <CardTitle>What changed</CardTitle>
              <CardDescription>
                The original single-package repo did not match the monorepo layout expected
                by the shadcn preset, which is why init was looking for
                <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">packages/ui/components.json</code>
                and failing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {highlights.map((item) => (
                  <li key={item} className="flex gap-3">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-background/85">
            <CardHeader>
              <CardTitle>Next steps</CardTitle>
              <CardDescription>
                The repo is ready for iterative UI work and future shadcn component adds.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {quickStart.map((command) => (
                  <div
                    key={command}
                    className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 font-mono text-sm"
                  >
                    {command}
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                From here we can start replacing placeholder UI with real search, capture,
                inbox, and graph views on top of the shared design system.
              </p>
            </CardFooter>
          </Card>
        </section>
      </div>
    </main>
  );
}
