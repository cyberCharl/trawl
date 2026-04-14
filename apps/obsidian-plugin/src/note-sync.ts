import {
  App,
  normalizePath,
  TFile,
  TFolder,
  type FrontMatterCache,
} from "obsidian";

import type { TrawlItem } from "./trawl-client";

export type NoteTemplateVariables = {
  title: string;
  url: string;
  summary: string;
  tags: string;
  captured_at: string;
  processed_at: string;
  trawl_id: string;
  obsidian_note_id: string;
};

function quoteYamlString(value: string): string {
  return JSON.stringify(value);
}

function sanitizeFileSegment(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|#^[\]]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fallbackTitleFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.split("/").filter(Boolean).at(-1);

    return sanitizeFileSegment(pathname ?? parsedUrl.hostname) || "trawl-item";
  } catch {
    return "trawl-item";
  }
}

function getFrontmatterId(frontmatter: FrontMatterCache | undefined): string | null {
  const value = frontmatter?.id;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function getFrontmatterIdFromFile(app: App, file: TFile): Promise<string | null> {
  const cachedId = getFrontmatterId(app.metadataCache.getFileCache(file)?.frontmatter);

  if (cachedId) {
    return cachedId;
  }

  const content = await app.vault.cachedRead(file);
  const match = content.match(/^---\n([\s\S]*?)\n---/);

  if (!match) {
    return null;
  }

  const idMatch = match[1]?.match(/^id:\s*["']?(.+?)["']?\s*$/m);
  return idMatch?.[1]?.trim() ?? null;
}

export function buildNoteTemplateVariables(item: TrawlItem, obsidianNoteId: string): NoteTemplateVariables {
  return {
    title: item.title?.trim() || fallbackTitleFromUrl(item.url),
    url: item.url,
    summary: item.summary?.trim() || "",
    tags: item.tags.map((tag) => quoteYamlString(tag)).join(", "),
    captured_at: item.captured_at,
    processed_at: item.processed_at ?? "",
    trawl_id: item.id,
    obsidian_note_id: obsidianNoteId,
  };
}

export function renderNoteTemplate(
  template: string,
  variables: NoteTemplateVariables,
): string {
  return template.replace(/{{\s*([a-z_]+)\s*}}/gi, (match, variableName: string) => {
    const key = variableName as keyof NoteTemplateVariables;
    return key in variables ? variables[key] : match;
  });
}

export async function findFileByFrontmatterId(app: App, noteId: string): Promise<TFile | null> {
  for (const file of app.vault.getMarkdownFiles()) {
    if ((await getFrontmatterIdFromFile(app, file)) === noteId) {
      return file;
    }
  }

  return null;
}

export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
  const normalizedPath = normalizePath(folderPath.trim());

  if (!normalizedPath) {
    return;
  }

  const parts = normalizedPath.split("/").filter(Boolean);
  let currentPath = "";

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(currentPath);

    if (existing instanceof TFolder) {
      continue;
    }

    if (!existing) {
      await app.vault.createFolder(currentPath);
    }
  }
}

export function buildNotePath(app: App, folderPath: string, item: TrawlItem, noteId: string): string {
  const normalizedFolder = normalizePath(folderPath.trim());
  const titleSegment = sanitizeFileSegment(item.title?.trim() || fallbackTitleFromUrl(item.url));
  const idSegment = sanitizeFileSegment(noteId).slice(0, 32) || item.id.slice(0, 8);
  const baseName = sanitizeFileSegment(`${titleSegment} ${idSegment}`) || `trawl-${item.id}`;

  let candidatePath = normalizePath(normalizedFolder ? `${normalizedFolder}/${baseName}.md` : `${baseName}.md`);
  let suffix = 2;

  while (app.vault.getAbstractFileByPath(candidatePath)) {
    candidatePath = normalizePath(
      normalizedFolder
        ? `${normalizedFolder}/${baseName}-${suffix}.md`
        : `${baseName}-${suffix}.md`,
    );
    suffix += 1;
  }

  return candidatePath;
}
