"use client";

import { useEffect, useMemo, useRef } from "react";

const SESSION_KEY = "off_enqueued";

function getSent(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markSent(ids: string[]) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify([...new Set([...getSent(), ...ids])])
    );
  } catch {
    /* sin sessionStorage: ignorar */
  }
}

/**
 * Encola productos para enriquecer con Open Food Facts (fire-and-forget).
 * No bloquea al usuario; la cola la drena off-enrich-worker.mjs por cron.
 */
export default function OffEnqueuer({ productIds }: { productIds: string[] }) {
  const idsRef = useRef(productIds);
  idsRef.current = productIds;
  const key = useMemo(() => [...productIds].sort().join(","), [productIds]);

  useEffect(() => {
    const ids = idsRef.current;
    if (!ids.length) return;
    const sent = getSent();
    const pending = ids.filter((id) => !sent.has(id));
    if (!pending.length) return;
    fetch("/api/off/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_ids: pending }),
    }).catch(() => {
      /* best-effort: si falla, se reintenta en la próxima visita */
    });
    markSent(pending);
  }, [key]);

  return null;
}
