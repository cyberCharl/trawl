"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type PollPendingItemsProps = {
  enabled: boolean;
  intervalMs?: number;
};

export function PollPendingItems({
  enabled,
  intervalMs = 5000,
}: PollPendingItemsProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs, router]);

  return null;
}
