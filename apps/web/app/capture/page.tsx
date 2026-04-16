import Link from "next/link"

export const dynamic = "force-dynamic"

import { bulkCaptureAction } from "@/app/actions"
import { AppShell } from "@/components/app-shell"
import { Button } from "@trawl/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trawl/ui/components/card"

type CapturePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function parseNumberParam(value: string | undefined): number {
  if (!value) return 0
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

export default async function CapturePage({ searchParams }: CapturePageProps) {
  const params = await searchParams
  const created = parseNumberParam(getParam(params.created))
  const duplicates = parseNumberParam(getParam(params.duplicates))
  const invalid = parseNumberParam(getParam(params.invalid))
  const error = getParam(params.error)
  const publicApiBaseUrl =
    process.env.TRAWL_PUBLIC_API_URL ?? process.env.TRAWL_API_URL ?? "http://localhost:3100"

  return (
    <AppShell
      current="capture"
      eyebrow="Fast ingest"
      title="Drop links before they disappear."
      description="Save URLs now, process later on purpose. Obsidian stays the system of record."
      actions={
        <>
          <Button asChild>
            <Link href="/items">Open inbox</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`${publicApiBaseUrl}/health`} target="_blank">
              API health
            </Link>
          </Button>
        </>
      }
    >
      <Card className="border-border/60 bg-card">
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">
            Paste one URL per line
          </CardTitle>
          <CardDescription>
            Use this when clearing tabs, ending a research session, or draining
            a reading list before it evaporates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {!error && created + duplicates + invalid > 0 ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              Captured {created} new item{created === 1 ? "" : "s"}, matched{" "}
              {duplicates} duplicate
              {duplicates === 1 ? "" : "s"}, skipped {invalid} invalid line
              {invalid === 1 ? "" : "s"}.
            </div>
          ) : null}

          <form action={bulkCaptureAction} className="space-y-5">
            <input type="hidden" name="redirect_to" value="/capture" />
            <label className="block space-y-2">
              <span className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
                URLs
              </span>
              <textarea
                name="urls"
                rows={20}
                placeholder={[
                  "https://example.com/article-one",
                  "https://arxiv.org/abs/1234.5678",
                  "https://notes.example.org/post/two",
                ].join("\n")}
                className="min-h-120 w-full rounded-xl border border-border/70 bg-background px-4 py-4 text-sm leading-7 shadow-inner transition outline-none placeholder:text-muted-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <Button type="submit" size="lg">
                Save to Trawl
              </Button>
              <p className="text-sm text-muted-foreground">
                <Link
                  href="/items"
                  className="text-primary underline underline-offset-4 hover:no-underline"
                >
                  Go to inbox →
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  )
}
