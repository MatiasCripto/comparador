import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "recién";
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return "hace 1 minuto";
  if (minutes < 60) return `hace ${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "hace 1 hora";
  if (hours < 24) return `hace ${hours} horas`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

export function formatSearchUrl(
  q: string,
  filters?: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
  }
  const qs = params.toString();
  return `/buscar${qs ? `?${qs}` : ""}`;
}

/**
 * Parsea un precio desde cualquier formato (ARG, US, inglés, entero).
 * Retorna el valor float correcto (ej: "28.267,64" → 28267.64).
 */
export function parsePrice(value: string | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return isNaN(value) ? 0 : value;

  let str = String(value).trim().replace(/[^0-9,.\-]/g, "");
  if (!str) return 0;

  const dots = (str.match(/\./g) || []).length;
  const commas = (str.match(/,/g) || []).length;

  if (dots === 0 && commas === 0) {
    return parseFloat(str);
  }

  if (commas >= 1 && dots === 0) {
    str = str.replace(",", ".");
    str = str.replace(/\.(?=.*\.)/g, "");
  } else if (dots >= 1 && commas === 0) {
    const lastDot = str.lastIndexOf(".");
    const afterDot = str.slice(lastDot + 1);
    if (afterDot.length === 2 && /^\d+$/.test(afterDot)) {
      if (dots > 1) {
        str = str.slice(0, lastDot).replace(/\./g, "") + "." + afterDot;
      }
    } else {
      str = str.replace(/\./g, "");
    }
  } else {
    const lastDot = str.lastIndexOf(".");
    const lastComma = str.lastIndexOf(",");
    if (lastComma > lastDot) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  }

  const result = parseFloat(str);
  return isNaN(result) ? 0 : result;
}
