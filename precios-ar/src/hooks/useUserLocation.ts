"use client";

import { useEffect, useState } from "react";
import {
  setUserLocationCookie,
  getUserLocationFromCookie,
} from "@/components/shared/LocationPicker";
import { PROVINCES } from "@/lib/location";

export interface UserLocation {
  provincia: string;
  ciudad: string | null;
  countryCode: string;
}

// ISO 3166-2:AR -> nombre en PROVINCES (src/lib/location.ts)
const ISO_TO_PROVINCE: Record<string, string> = {
  "AR-C": "CABA",
  "AR-B": "Buenos Aires",
  "AR-K": "Catamarca",
  "AR-H": "Chaco",
  "AR-U": "Chubut",
  "AR-X": "Córdoba",
  "AR-W": "Corrientes",
  "AR-E": "Entre Ríos",
  "AR-P": "Formosa",
  "AR-Y": "Jujuy",
  "AR-L": "La Pampa",
  "AR-F": "La Rioja",
  "AR-M": "Mendoza",
  "AR-N": "Misiones",
  "AR-Q": "Neuquén",
  "AR-R": "Río Negro",
  "AR-A": "Salta",
  "AR-J": "San Juan",
  "AR-D": "San Luis",
  "AR-Z": "Santa Cruz",
  "AR-S": "Santa Fe",
  "AR-G": "Santiago del Estero",
  "AR-V": "Tierra del Fuego",
  "AR-T": "Tucumán",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function matchProvince(
  subdivision: string | null | undefined,
  code: string | null | undefined
): string | null {
  if (code && ISO_TO_PROVINCE[code]) return ISO_TO_PROVINCE[code];
  if (!subdivision) return null;
  const n = normalize(subdivision);
  if (n.includes("ciudad autonoma")) return "CABA";
  for (const p of PROVINCES) {
    const np = normalize(p);
    if (n === np || (np && n.includes(np))) return p;
  }
  return null;
}

function getBrowserPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("geolocation no disponible"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 5000, maximumAge: 600000 }
    );
  });
}

async function reverseGeocode(lat?: number, lng?: number): Promise<any> {
  const params = new URLSearchParams({ localityLanguage: "es" });
  if (lat != null && lng != null) {
    params.set("latitude", String(lat));
    params.set("longitude", String(lng));
  }
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Detecta la ubicación del usuario (provincia + ciudad) vía BigDataCloud.
 * GPS primero, IP como fallback. Solo guarda la cookie si el país es AR.
 * Devuelve null si no se pudo detectar o el usuario no está en Argentina.
 */
export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      const existing = getUserLocationFromCookie();
      if (existing.province) {
        if (!cancelled) {
          setLocation({
            provincia: existing.province,
            ciudad: existing.city,
            countryCode: "AR",
          });
          setLoading(false);
        }
        return;
      }

      let result: UserLocation | null = null;
      try {
        let geo: { lat: number; lng: number } | null = null;
        try {
          geo = await getBrowserPosition();
        } catch {
          geo = null;
        }
        const data = await reverseGeocode(geo?.lat, geo?.lng);
        const {
          city,
          principalSubdivision,
          principalSubdivisionCode,
          countryCode,
        } = data ?? {};
        if (countryCode === "AR") {
          const provincia = matchProvince(
            principalSubdivision,
            principalSubdivisionCode
          );
          if (provincia) {
            result = {
              provincia,
              ciudad: city ?? null,
              countryCode,
            };
            setUserLocationCookie(provincia, city ?? "");
          }
        }
      } catch (err) {
        console.error("[useUserLocation] No se pudo detectar ubicación:", err);
      }

      if (!cancelled) {
        setLocation(result);
        setLoading(false);
      }
    }

    detect();
    return () => {
      cancelled = true;
    };
  }, []);

  return { location, loading };
}
