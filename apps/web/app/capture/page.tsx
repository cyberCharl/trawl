import Link from "next/link";

export const dynamic = "force-dynamic";

import { bulkCaptureAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@trawl/ui/components/badge";
import { Button } from "@trawl/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@trawl/ui/components/card";

type CapturePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseNumberParam(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default async function CapturePage({ searchParams }: CapturePageProps) {
  const params = await searchParams;
  const created = parseNumberParam(getParam(params.created));
  const duplicates = parseNumberParam(getParam(params.duplicates));
  const invalid = parseNumberParam(getParam(params.invalid));
  const error = getParam(params.error);
  const apiBaseUrl = process.env.TRAWL_API_URL ?? "http://localhost:3100";

  return (
    <AppShell
      current="capture"
      eyebrow="Fast ingest"
      title="Drop links into Trawl before they disappear."
      description="Capture stays cheap: save URLs now, process later on purpose, and keep Obsidian as the system of record."
      actions={
        <>
          <Button asChild>
            <Link href="/items">Open inbox</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`${apiBaseUrl}/health`} target="_blank">
              API health
            </Link>
          </Button>
        </>
      }
    >
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="border border-border/70 bg-background/92">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Phase 2</Badge>
              <Badge variant="secondary">Bulk capture</Badge>
            </div>
            <CardTitle className="text-2xl md:text-3xl">Paste one URL per line</CardTitle>
            <CardDescription>
              Use this when clearing tabs, moving items out of a reading list, or ending a
              research session without losing momentum.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {!error && created + duplicates + invalid > 0 ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                Captured {created} new item{created === 1 ? "" : "s"}, matched {duplicates} duplicate
                {duplicates === 1 ? "" : "s"}, and skipped {invalid} invalid line
                {invalid === 1 ? "" : "s"}.
              </div>
            ) : null}

            <form action={bulkCaptureAction} className="space-y-4">
              <input type="hidden" name="redirect_to" value="/capture" />
              <label className="block space-y-2">
                <span className="text-sm font-medium">URLs</span>
                <textarea
                  name="urls"
                  rows={16}
                  placeholder={[
                    "https://example.com/article-one",
                    "https://arxiv.org/abs/1234.5678",
                    "https://notes.example.org/post/two",
                  ].join("\n")}
                  className="min-h-[24rem] w-full rounded-[24px] border border-border/70 bg-muted/35 px-4 py-4 font-mono text-sm leading-7 shadow-inner outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" size="lg">
                  Save to Trawl
                </Button>
                <p className="text-sm text-muted-foreground">
                  Capture stores the URL, timestamps, and light metadata only.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border border-border/70 bg-background/92">
            <CardHeader>
              <CardTitle>Workflow rules</CardTitle>
              <CardDescription>These screens follow the system definition directly.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                <li>• Capture is fast and capture-only.</li>
                <li>• Duplicate URLs stay as the same item.</li>
                <li>• <span className="font-medium text-foreground">captured_at</span> keeps the first-seen timestamp.</li>
                <li>• <span className="font-medium text-foreground">last_seen_at</span> updates on repeat capture.</li>
                <li>• Processing must be triggered intentionally from the inbox.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-background/92">
            <CardHeader>
              <CardTitle>Next move</CardTitle>
              <CardDescription>
                After capture, move to the inbox to choose what deserves enrichment.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-2xl border border-border/70 bg-muted/35 px-4 py-4">
                <p className="font-medium">Inbox</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Filter pending, failed, processed, and archived items.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/35 px-4 py-4">
                <p className="font-medium">Manual processing</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Queue fetch, extract, summary, and tagging only when you choose.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <Link href="/items">Go to inbox</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
