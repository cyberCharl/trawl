import Link from "next/link";

export const dynamic = "force-dynamic";

import { ArrowUpRight, BookOpen, RefreshCw, Zap } from "lucide-react";

import { processItemAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PollPendingItems } from "@/components/poll-pending-items";
import { listItems, type ItemStatus, type TrawlItem } from "@/lib/trawl-api";
import { Badge } from "@trawl/ui/components/badge";
import { Button } from "@trawl/ui/components/button";
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
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
}

function isItemStatus(value: string | undefined): value is ItemStatus {
  return (
    value === "pending" ||
    value === "processed" ||
    value === "failed" ||
    value === "archived"
  );
}

function buildItemsPath(status?: ItemStatus, offset = 0): string {
  const searchParams = new URLSearchParams();
  if (status) searchParams.set("status", status);
  if (offset > 0) searchParams.set("offset", String(offset));
  const query = searchParams.toString();
  return query ? `/items?${query}` : "/items";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function statusDotClass(status: ItemStatus): string {
  switch (status) {
    case "processed":
      return "bg-emerald-500";
    case "failed":
      return "bg-destructive";
    case "archived":
      return "bg-muted-foreground/40";
    case "pending":
    default:
      return "bg-primary";
  }
}

function statusLabel(status: ItemStatus): string {
  switch (status) {
    case "processed":
      return "processed";
    case "failed":
      return "failed";
    case "archived":
      return "archived";
    case "pending":
    default:
      return "pending";
  }
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
    const response = await listItems({ status, limit: PAGE_SIZE, offset });
    items = response.items;
    total = response.pagination.total;
    hasMore = response.pagination.has_more;
  } catch (caughtError) {
    loadError =
      caughtError instanceof Error ? caughtError.message : "Could not load inbox items.";
  }

  const basePath = buildItemsPath(status, offset);
  const hasPending = items.some((item) => item.status === "pending");

  return (
    <AppShell
      current="items"
      eyebrow="Browse and process"
      title="Inbox"
      actions={
        <>
          <Button asChild>
            <Link href="/capture">Capture links</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={buildItemsPath(status, offset)}>Refresh</Link>
          </Button>
        </>
      }
    >
      <PollPendingItems enabled={hasPending} />

      {/* Notifications */}
      {queued ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          Processing queued. Page will refresh automatically while pending items are visible.
        </div>
      ) : null}

      {error || loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error ?? loadError}
        </div>
      ) : null}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          {filters.map((filter) => {
            const active = filter.value === status || (!filter.value && !status);
            return (
              <Link
                key={filter.label}
                href={buildItemsPath(filter.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[11px] tracking-[0.15em] uppercase transition-colors",
                  active
                    ? "bg-primary/12 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-4">
          {hasPending ? (
            <span className="flex items-center gap-1.5 text-[11px] text-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              polling
            </span>
          ) : null}
          <span className="text-[11px] text-muted-foreground">{total} items</span>
        </div>
      </div>

      {/* Item list */}
      <div className="rounded-2xl border border-border/50 overflow-hidden bg-card/30">
        {items.length === 0 && !loadError ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            No items in this view.
          </div>
        ) : null}

        <div className="divide-y divide-border/40">
          {items.map((item) => {
            const canProcess = item.status === "pending" || item.status === "failed";

            return (
              <article
                key={item.id}
                className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/20"
              >
                {/* Status dot */}
                <div
                  className={cn(
                    "mt-[7px] size-2 shrink-0 rounded-full",
                    statusDotClass(item.status),
                  )}
                  title={statusLabel(item.status)}
                />

                {/* Main content */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="text-sm font-medium leading-snug">
                      {item.title || item.url}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {hostLabel(item.url)}
                    </span>
                    {item.obsidian_note_id ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider text-primary uppercase">
                        <BookOpen className="size-2.5" />
                        linked
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{item.url}</p>
                  {item.summary ? (
                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {item.summary}
                    </p>
                  ) : null}
                  {!item.summary && item.status === "failed" && item.error_details ? (
                    <p className="line-clamp-2 text-xs leading-5 text-destructive">
                      {item.error_details}
                    </p>
                  ) : null}
                  {item.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="h-4 px-1.5 text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Capture date */}
                <div className="hidden w-32 shrink-0 pt-0.5 text-right text-[11px] text-muted-foreground lg:block">
                  {formatDate(item.captured_at)}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" className="size-7" asChild>
                    <Link href={item.url} target="_blank" title="Open URL">
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>

                  {canProcess ? (
                    <form action={processItemAction}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="redirect_to" value={basePath} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        type="submit"
                        title={item.status === "failed" ? "Retry processing" : "Process"}
                      >
                        {item.status === "failed" ? (
                          <RefreshCw className="size-3.5" />
                        ) : (
                          <Zap className="size-3.5" />
                        )}
                      </Button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
        <p className="text-[11px] text-muted-foreground">
          {items.length === 0
            ? "0 items"
            : `${offset + 1}–${offset + items.length} of ${total}`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link
              href={
                offset > 0
                  ? buildItemsPath(status, Math.max(0, offset - PAGE_SIZE))
                  : basePath
              }
              aria-disabled={offset === 0}
              className={cn(offset === 0 && "pointer-events-none opacity-40")}
            >
              ← Prev
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link
              href={hasMore ? buildItemsPath(status, offset + PAGE_SIZE) : basePath}
              aria-disabled={!hasMore}
              className={cn(!hasMore && "pointer-events-none opacity-40")}
            >
              Next →
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
