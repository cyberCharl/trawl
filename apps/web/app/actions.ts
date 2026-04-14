"use server";

import { redirect } from "next/navigation";

import { batchCapture, triggerProcessing } from "@/lib/trawl-api";

function redirectWithParams(path: string, params: Record<string, string | number | null | undefined>): never {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  redirect(query ? `${path}?${query}` : path);
}

export async function bulkCaptureAction(formData: FormData): Promise<void> {
  const rawUrls = String(formData.get("urls") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? "/capture");
  const urls = rawUrls
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    redirectWithParams(redirectTo, {
      error: "Paste at least one valid URL to capture.",
    });
  }

  try {
    const response = await batchCapture({
      urls,
      source: "web",
    });

    redirectWithParams(redirectTo, {
      created: response.summary.created,
      duplicates: response.summary.duplicates,
      invalid: response.summary.invalid,
    });
  } catch (error) {
    redirectWithParams(redirectTo, {
      error: error instanceof Error ? error.message : "Capture failed.",
    });
  }
}

export async function processItemAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("item_id") ?? "").trim();
  const redirectTo = String(formData.get("redirect_to") ?? "/items");

  if (!itemId) {
    redirectWithParams(redirectTo, {
      error: "Missing item id.",
    });
  }

  try {
    await triggerProcessing(itemId);

    redirectWithParams(redirectTo, {
      queued: 1,
    });
  } catch (error) {
    redirectWithParams(redirectTo, {
      error: error instanceof Error ? error.message : "Could not queue item for processing.",
    });
  }
}
