import { Modal, Notice, Setting } from "obsidian";

import type TrawlPlugin from "./main";
import type { ItemStatus, TrawlItem } from "./trawl-client";

const PAGE_SIZE = 25;
const FILTER_OPTIONS: Array<{ label: string; value: ItemStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Processed", value: "processed" },
  { label: "Failed", value: "failed" },
  { label: "Archived", value: "archived" },
];

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

function displayTitle(item: TrawlItem): string {
  return item.title?.trim() || item.url;
}

function summaryText(item: TrawlItem): string {
  if (item.summary?.trim()) {
    return item.summary;
  }

  if (item.status === "failed" && item.error_details?.trim()) {
    return item.error_details;
  }

  if (item.status === "pending") {
    return "Captured and waiting for deliberate processing.";
  }

  return "No summary available yet.";
}

function canProcess(status: ItemStatus): boolean {
  return status === "pending" || status === "failed";
}

function canPromote(item: TrawlItem): boolean {
  return item.status === "processed" || item.obsidian_note_id !== null;
}

export class TrawlInboxModal extends Modal {
  private currentFilter: ItemStatus | "all";
  private isRendering = false;
  private rerenderRequested = false;
  private pollingIntervalId: number | null = null;

  constructor(private readonly plugin: TrawlPlugin) {
    super(plugin.app);
    this.currentFilter = plugin.settings.defaultStatusFilter;
  }

  onOpen(): void {
    this.modalEl.addClass("trawl-inbox-modal");
    this.queueRender();
  }

  onClose(): void {
    this.stopPolling();
    this.contentEl.empty();
  }

  private queueRender(): void {
    if (this.isRendering) {
      this.rerenderRequested = true;
      return;
    }

    void this.render();
  }

  private startPolling(): void {
    if (this.pollingIntervalId !== null) {
      return;
    }

    const intervalMs = Math.max(1, this.plugin.settings.pollingIntervalSeconds) * 1000;

    this.pollingIntervalId = window.setInterval(() => {
      this.queueRender();
    }, intervalMs);
  }

  private stopPolling(): void {
    if (this.pollingIntervalId === null) {
      return;
    }

    window.clearInterval(this.pollingIntervalId);
    this.pollingIntervalId = null;
  }

  private syncPolling(shouldPoll: boolean): void {
    if (shouldPoll) {
      this.startPolling();
      return;
    }

    this.stopPolling();
  }

  private getFilter(): ItemStatus | undefined {
    return this.currentFilter === "all" ? undefined : this.currentFilter;
  }

  private async render(): Promise<void> {
    this.isRendering = true;

    try {
      const { contentEl } = this;
      contentEl.empty();

      contentEl.createEl("h2", { text: "Trawl Inbox" });
      contentEl.createEl("p", {
        text: "Browse captured items from Trawl, queue deliberate processing, and promote processed items into vault notes.",
      });

      if (!this.plugin.settings.apiUrl.trim() || !this.plugin.settings.apiKey.trim()) {
        this.stopPolling();
        contentEl.createEl("p", {
          text: "Configure the API URL and API key in the plugin settings before opening the inbox.",
        });
        return;
      }

      const controlsEl = contentEl.createDiv();

      new Setting(controlsEl)
        .setName("View")
        .setDesc(
          `Auto-refresh runs every ${this.plugin.settings.pollingIntervalSeconds}s while pending items are visible.`,
        )
        .addDropdown((dropdown) => {
          for (const option of FILTER_OPTIONS) {
            dropdown.addOption(option.value, option.label);
          }

          dropdown.setValue(this.currentFilter).onChange((value) => {
            this.currentFilter = value as ItemStatus | "all";
            this.queueRender();
          });
        })
        .addButton((button) => {
          button.setButtonText("Reload").setCta().onClick(() => {
            this.queueRender();
          });
        });

      const loadingEl = contentEl.createEl("p", { text: "Loading items…" });
      const response = await this.plugin.client.listItems({
        status: this.getFilter(),
        limit: PAGE_SIZE,
      });

      loadingEl.remove();

      const hasPendingItems = response.items.some((item) => item.status === "pending");
      this.syncPolling(hasPendingItems);

      contentEl.createEl("p", {
        text: `Showing ${response.items.length} item(s) from a total of ${response.pagination.total}.`,
      });

      if (response.items.length === 0) {
        contentEl.createEl("p", {
          text: "No items matched the current filter.",
        });
        return;
      }

      const listEl = contentEl.createDiv({ cls: "trawl-inbox-list" });

      for (const item of response.items) {
        const cardEl = listEl.createDiv({ cls: "trawl-inbox-card" });
        cardEl.createEl("h3", { text: displayTitle(item) });

        const metaEl = cardEl.createDiv({ cls: "trawl-inbox-card__meta" });
        metaEl.createSpan({ text: `status: ${item.status}` });
        metaEl.createSpan({ text: `captured: ${formatDate(item.captured_at)}` });
        metaEl.createSpan({ text: `last seen: ${formatDate(item.last_seen_at)}` });
        metaEl.createSpan({ text: `processed: ${formatDate(item.processed_at)}` });
        metaEl.createSpan({ text: `note id: ${item.obsidian_note_id ?? "—"}` });

        cardEl.createEl("p", { text: item.url });
        cardEl.createEl("p", { text: summaryText(item) });

        if (item.tags.length > 0) {
          cardEl.createEl("p", { text: `tags: ${item.tags.join(", ")}` });
        }

        const actionsEl = cardEl.createDiv();
        new Setting(actionsEl)
          .setName(item.obsidian_note_id ? "Linked to Obsidian" : "Actions")
          .setDesc(
            item.obsidian_note_id
              ? `Existing note id: ${item.obsidian_note_id}`
              : item.status === "processed"
                ? "Create a source note from the configured template."
                : "Open the source or queue processing.",
          )
          .addButton((button) => {
            button.setButtonText("Open link").onClick(() => {
              window.open(item.url, "_blank", "noopener,noreferrer");
            });
          })
          .addButton((button) => {
            if (!canProcess(item.status)) {
              button.setDisabled(true).setButtonText("Processed");
              return;
            }

            button
              .setButtonText(item.status === "failed" ? "Retry" : "Process")
              .setCta()
              .onClick(async () => {
                try {
                  await this.plugin.client.processItem(item.id);
                  new Notice(`Queued ${displayTitle(item)} for processing.`);
                  this.queueRender();
                } catch (error) {
                  const message = error instanceof Error ? error.message : String(error);
                  new Notice(`Could not queue item: ${message}`);
                }
              });
          })
          .addButton((button) => {
            if (!canPromote(item)) {
              button.setDisabled(true).setButtonText("Create note");
              return;
            }

            button
              .setButtonText(item.obsidian_note_id ? "Open note" : "Create note")
              .onClick(async () => {
                try {
                  const result = await this.plugin.createOrOpenNoteForItem(item);
                  new Notice(
                    result.created
                      ? `Created note for ${displayTitle(result.item)}.`
                      : `Opened linked note for ${displayTitle(result.item)}.`,
                  );
                  this.queueRender();
                } catch (error) {
                  const message = error instanceof Error ? error.message : String(error);
                  new Notice(`Could not create or open note: ${message}`);
                }
              });
          });
      }
    } catch (error) {
      this.stopPolling();
      this.contentEl.createEl("p", {
        text: `Could not load Trawl items: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      this.isRendering = false;

      if (this.rerenderRequested) {
        this.rerenderRequested = false;
        this.queueRender();
      }
    }
  }
}
