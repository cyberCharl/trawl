import { App, Notice, PluginSettingTab, Setting } from "obsidian";

import type TrawlPlugin from "./main";
import type { ItemStatus } from "./trawl-client";

export type TrawlPluginSettings = {
  apiUrl: string;
  apiKey: string;
  noteDestinationFolder: string;
  noteTemplate: string;
  defaultStatusFilter: ItemStatus | "all";
  pollingIntervalSeconds: number;
};

export const DEFAULT_SETTINGS: TrawlPluginSettings = {
  apiUrl: "http://localhost:3100",
  apiKey: "",
  noteDestinationFolder: "Sources/Trawl",
  noteTemplate: [
    "---",
    'id: "{{obsidian_note_id}}"',
    'trawl_id: "{{trawl_id}}"',
    'title: "{{title}}"',
    'source_url: "{{url}}"',
    "tags: [{{tags}}]",
    'captured_at: "{{captured_at}}"',
    'processed_at: "{{processed_at}}"',
    "---",
    "",
    "# {{title}}",
    "",
    "{{summary}}",
    "",
    "Source: {{url}}",
  ].join("\n"),
  defaultStatusFilter: "pending",
  pollingIntervalSeconds: 5,
};

export class TrawlSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: TrawlPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Trawl" });
    containerEl.createEl("p", {
      text: "Connect Obsidian to the Trawl API and prepare note-creation defaults.",
    });

    new Setting(containerEl)
      .setName("Trawl API URL")
      .setDesc("Base URL for the Bun + Hono API, usually a Tailscale or local address.")
      .addText((text) => {
        text
          .setPlaceholder("http://localhost:3100")
          .setValue(this.plugin.settings.apiUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiUrl = value.trim();
            await this.plugin.saveSettings();
          });

        text.inputEl.style.width = "24rem";
      });

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Bearer token used for authenticated /items requests.")
      .addText((text) => {
        text
          .setPlaceholder("change-me")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          });

        text.inputEl.type = "password";
        text.inputEl.style.width = "24rem";
      })
      .addButton((button) => {
        button.setButtonText("Test connection").onClick(async () => {
          try {
            const result = await this.plugin.client.health();
            new Notice(`Trawl connection OK: ${result.status}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            new Notice(`Trawl connection failed: ${message}`);
          }
        });
      });

    new Setting(containerEl)
      .setName("Note destination folder")
      .setDesc("Vault folder for future source-note creation.")
      .addText((text) => {
        text
          .setPlaceholder("Sources/Trawl")
          .setValue(this.plugin.settings.noteDestinationFolder)
          .onChange(async (value) => {
            this.plugin.settings.noteDestinationFolder = value.trim();
            await this.plugin.saveSettings();
          });

        text.inputEl.style.width = "24rem";
      });

    new Setting(containerEl)
      .setName("Default inbox filter")
      .setDesc("Status filter used when opening the Trawl inbox modal.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("all", "All")
          .addOption("pending", "Pending")
          .addOption("processed", "Processed")
          .addOption("failed", "Failed")
          .addOption("archived", "Archived")
          .setValue(this.plugin.settings.defaultStatusFilter)
          .onChange(async (value) => {
            this.plugin.settings.defaultStatusFilter = value as TrawlPluginSettings["defaultStatusFilter"];
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Polling interval")
      .setDesc("Reserved for the next modal iteration that polls processing status.")
      .addText((text) => {
        text
          .setPlaceholder("5")
          .setValue(String(this.plugin.settings.pollingIntervalSeconds))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            this.plugin.settings.pollingIntervalSeconds = Number.isNaN(parsed)
              ? DEFAULT_SETTINGS.pollingIntervalSeconds
              : Math.max(1, parsed);
            await this.plugin.saveSettings();
          });

        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.style.width = "8rem";
      });

    new Setting(containerEl)
      .setName("Note template")
      .setDesc(
        "Template used for created source notes. Supports {{title}}, {{url}}, {{summary}}, {{tags}}, {{captured_at}}, {{processed_at}}, {{trawl_id}}, and {{obsidian_note_id}}.",
      )
      .addTextArea((text) => {
        text.setValue(this.plugin.settings.noteTemplate).onChange(async (value) => {
          this.plugin.settings.noteTemplate = value;
          await this.plugin.saveSettings();
        });

        text.inputEl.rows = 16;
        text.inputEl.cols = 56;
        text.inputEl.style.width = "100%";
        text.inputEl.style.fontFamily = "var(--font-monospace)";
      });
  }
}
