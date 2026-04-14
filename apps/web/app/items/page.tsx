import Link from "next/link";

export const dynamic = "force-dynamic";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Layers3,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import { processItemAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PollPendingItems } from "@/components/poll-pending-items";
import { listItems, type ItemStatus, type TrawlItem } from "@/lib/trawl-api";
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
import { cn } from "@trawl/ui/lib/utils";

const PAGE_SIZE = 25;
const filters: Array<{ label: string; value?: ItemStatus }> = [
  { label: "All", value: undefined },
  { label: "Pending", value: "pending" },
  { label: "Processed", value: "processed" },
  { label: "Failed", value: "failed" },
  { label: "Archived", value: "archived" },
];

type ItemsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseOffset(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function isItemStatus(value: string | undefined): value is ItemStatus {
  return value === "pending" || value === "processed" || value === "failed" || value === "archived";
}

function buildItemsPath(status?: ItemStatus, offset = 0): string {
  const searchParams = new URLSearchParams();

  if (status) {
    searchParams.set("status", status);
  }

  if (offset > 0) {
    searchParams.set("offset", String(offset));
  }

  const query = searchParams.toString();
  return query ? `/items?${query}` : "/items";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function statusBadgeVariant(status: ItemStatus): "secondary" | "destructive" | "outline" | "default" {
  switch (status) {
    case "processed":
      return "default";
    case "failed":
      return "destructive";
    case "archived":
      return "outline";
    case "pending":
    default:
      return "secondary";
  }
}

function summaryCopy(item: TrawlItem): string {
  if (item.summary) {
    return item.summary;
  }

  if (item.status === "failed" && item.error_details) {
    return item.error_details;
  }

  if (item.status === "pending") {
    return "Captured and waiting for deliberate processing.";
  }

  return "No summary stored yet.";
}

function statusCount(items: TrawlItem[], status: ItemStatus): number {
  return items.filter((item) => item.status === status).length;
}

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const params = await searchParams;
  const rawStatus = getParam(params.status);
  const status = isItemStatus(rawStatus) ? rawStatus : undefined;
  const offset = parseOffset(getParam(params.offset));
  const queued = getParam(params.queued);
  const error = getParam(params.error);

  let items: TrawlItem[] = [];
  let total = 0;
  let hasMore = false;
  let loadError: string | null = null;

  try {
    const response = await listItems({
      status,
      limit: PAGE_SIZE,
      offset,
    });

    items = response.items;
    total = response.pagination.total;
    hasMore = response.pagination.has_more;
  } catch (caughtError) {
    loadError = caughtError instanceof Error ? caughtError.message : "Could not load inbox items.";
  }

  const basePath = buildItemsPath(status, offset);
  const hasPending = items.some((item) => item.status === "pending");

  return (
    <AppShell
      current="items"
      eyebrow="Inbox"
      title="Choose what should be processed, not what happened to be saved."
      description="The inbox is the operational queue: scan captures, filter by status, and manually trigger enrichment when an item is worth promoting downstream."
      actions={
        <>
          <Button asChild>
            <Link href="/capture">Capture more links</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={buildItemsPath(status, offset)}>Refresh</Link>
          </Button>
        </>
      }
    >
      <PollPendingItems enabled={hasPending} />

      <section className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
        <div className="grid gap-6">
          <Card className="border border-border/70 bg-background/92">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Newest first across everything ever captured.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {filters.map((filter) => {
                const active = filter.value === status || (!filter.value && !status);
                const href = buildItemsPath(filter.value);

                return (
                  <Button key={filter.label} variant={active ? "default" : "outline"} asChild>
                    <Link href={href}>{filter.label}</Link>
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-background/92">
            <CardHeader>
              <CardTitle>Visible slice</CardTitle>
              <CardDescription>This page polls while pending items are visible.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/35 px-4 py-3">
                <span>Total matching items</span>
                <span className="font-semibold text-foreground">{total}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/35 px-4 py-3">
                <span>Pending on page</span>
                <span className="font-semibold text-foreground">{statusCount(items, "pending")}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/35 px-4 py-3">
                <span>Failed on page</span>
                <span className="font-semibold text-foreground">{statusCount(items, "failed")}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/35 px-4 py-3">
                <span>Processed on page</span>
                <span className="font-semibold text-foreground">{statusCount(items, "processed")}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-border/70 bg-background/92">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Manual processing</Badge>
              <Badge variant="secondary">Polling every 5 seconds when needed</Badge>
            </div>
            <CardTitle className="text-2xl">Captured items</CardTitle>
            <CardDescription>
              Processing runs asynchronously. Open the original link any time, or queue the item when you want Trawl to fetch and enrich it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {queued ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                Processing queued. This page will refresh automatically while pending items are visible.
              </div>
            ) : null}

            {error || loadError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error ?? loadError}
              </div>
            ) : null}

            {items.length === 0 && !loadError ? (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
                No items in this view yet.
              </div>
            ) : null}

            <div className="space-y-3">
              {items.map((item) => {
                const canProcess = item.status === "pending" || item.status === "failed";

                return (
                  <article
                    key={item.id}
                    className="rounded-[24px] border border-border/70 bg-muted/25 p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                            <Badge variant="outline">{item.source}</Badge>
                            <Badge variant="outline">{hostLabel(item.url)}</Badge>
                            {item.obsidian_note_id ? (
                              <Badge variant="secondary">linked to Obsidian</Badge>
                            ) : null}
                          </div>
                          <div className="space-y-1">
                            <h2 className="text-lg font-semibold leading-snug">
                              {item.title || item.url}
                            </h2>
                            <p className="break-all font-mono text-xs text-muted-foreground">
                              {item.url}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 md:justify-end">
                          <Button variant="outline" asChild>
                            <Link href={item.url} target="_blank">
                              Open
                              <ArrowUpRight className="size-4" />
                            </Link>
                          </Button>

                          {canProcess ? (
                            <form action={processItemAction}>
                              <input type="hidden" name="item_id" value={item.id} />
                              <input type="hidden" name="redirect_to" value={basePath} />
                              <Button type="submit">
                                {item.status === "failed" ? "Retry processing" : "Process"}
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      </div>

                      <p className="text-sm leading-7 text-muted-foreground">{summaryCopy(item)}</p>

                      <div className="flex flex-wrap gap-2">
                        {item.tags.length > 0 ? (
                          item.tags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline">No tags yet</Badge>
                        )}
                      </div>

                      <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-border/70 bg-background/80 px-3 py-3">
                          <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                            <Layers3 className="size-3.5" />
                            Captured first
                          </div>
                          <div>{formatDate(item.captured_at)}</div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 px-3 py-3">
                          <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                            <Clock3 className="size-3.5" />
                            Last seen
                          </div>
                          <div>{formatDate(item.last_seen_at)}</div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 px-3 py-3">
                          <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                            <CheckCircle2 className="size-3.5" />
                            Processed
                          </div>
                          <div>{formatDate(item.processed_at)}</div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 px-3 py-3">
                          <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                            <TriangleAlert className="size-3.5" />
                            Note link
                          </div>
                          <div className="truncate">{item.obsidian_note_id ?? "Not linked yet"}</div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-6">
            <p className="text-sm text-muted-foreground">
              Showing {items.length === 0 ? 0 : offset + 1}-{offset + items.length} of {total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link
                  href={offset > 0 ? buildItemsPath(status, Math.max(0, offset - PAGE_SIZE)) : basePath}
                  aria-disabled={offset === 0}
                  className={cn(offset === 0 && "pointer-events-none opacity-50")}
                >
                  Previous
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link
                  href={hasMore ? buildItemsPath(status, offset + PAGE_SIZE) : basePath}
                  aria-disabled={!hasMore}
                  className={cn(!hasMore && "pointer-events-none opacity-50")}
                >
                  Next
                  <RefreshCw className="size-4" />
                </Link>
              </Button>
            </div>
          </CardFooter>
        </Card>
      </section>
    </AppShell>
  );
}
