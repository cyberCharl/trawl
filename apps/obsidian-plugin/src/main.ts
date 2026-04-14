import { Notice, Plugin, type TFile } from "obsidian";

import { TrawlInboxModal } from "./inbox-modal";
import {
  buildNotePath,
  buildNoteTemplateVariables,
  ensureFolderExists,
  findFileByFrontmatterId,
  renderNoteTemplate,
} from "./note-sync";
import { DEFAULT_SETTINGS, type TrawlPluginSettings, TrawlSettingTab } from "./settings";
import { TrawlClient, type TrawlItem } from "./trawl-client";

export default class TrawlPlugin extends Plugin {
  settings: TrawlPluginSettings = DEFAULT_SETTINGS;
  client = new TrawlClient(() => ({
    apiUrl: this.settings.apiUrl,
    apiKey: this.settings.apiKey,
  }));

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "open-trawl-inbox",
      name: "Open Trawl inbox",
      callback: () => {
        this.openInbox();
      },
    });

    this.addCommand({
      id: "test-trawl-connection",
      name: "Test Trawl API connection",
      callback: async () => {
        try {
          const result = await this.client.health();
          new Notice(`Trawl connection OK: ${result.status}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          new Notice(`Trawl connection failed: ${message}`);
        }
      },
    });

    const statusBarItem = this.addStatusBarItem();
    statusBarItem.setText("Trawl");
    statusBarItem.addClass("mod-clickable");
    statusBarItem.onclick = () => {
      this.openInbox();
    };
    statusBarItem.setAttribute("aria-label", "Open Trawl inbox");

    this.addSettingTab(new TrawlSettingTab(this.app, this));
  }

  onunload(): void {
    // Obsidian disposes registered commands, status items, and setting tabs automatically.
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<TrawlPluginSettings> | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...stored,
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  openInbox(): void {
    new TrawlInboxModal(this).open();
  }

  async createOrOpenNoteForItem(item: TrawlItem): Promise<{
    file: TFile;
    item: TrawlItem;
    created: boolean;
  }> {
    if (item.status !== "processed" && !item.obsidian_note_id) {
      throw new Error("Only processed items can be promoted into Obsidian notes.");
    }

    const noteId = item.obsidian_note_id?.trim() || `trawl-${item.id}`;
    let file = await findFileByFrontmatterId(this.app, noteId);
    let created = false;

    if (!file) {
      if (item.status !== "processed") {
        throw new Error("Linked note could not be found and the item is not processed yet.");
      }

      await ensureFolderExists(this.app, this.settings.noteDestinationFolder);

      const notePath = buildNotePath(this.app, this.settings.noteDestinationFolder, item, noteId);
      const templateVariables = buildNoteTemplateVariables(item, noteId);
      const noteContent = renderNoteTemplate(this.settings.noteTemplate, templateVariables);

      file = await this.app.vault.create(notePath, noteContent);
      created = true;
    }

    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.id = noteId;
      frontmatter.trawl_id = item.id;
      frontmatter.source_url = item.url;
      frontmatter.captured_at = item.captured_at;

      if (item.processed_at) {
        frontmatter.processed_at = item.processed_at;
      }
    });

    const updatedItem = (await this.client.updateItem(item.id, {
      obsidian_note_id: noteId,
    })).item;

    await this.app.workspace.getLeaf(true).openFile(file);

    return {
      file,
      item: updatedItem,
      created,
    };
  }
}
