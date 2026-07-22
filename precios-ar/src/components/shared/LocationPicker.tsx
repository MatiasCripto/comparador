"use client";

import { useEffect, useState, useCallback } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROVINCES } from "@/lib/location";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setUserLocationCookie(province: string, city: string) {
  const d = new Date();
  d.setTime(d.getTime() + 365 * 86400000);
  document.cookie = `user_province=${encodeURIComponent(province)}; expires=${d.toUTCString()}; path=/`;
  document.cookie = `user_city=${encodeURIComponent(city)}; expires=${d.toUTCString()}; path=/`;
  localStorage.setItem("user_province", province);
  localStorage.setItem("user_city", city);
}

export function getUserLocationFromCookie(): { province: string | null; city: string | null } {
  return {
    province: getCookie("user_province"),
    city: getCookie("user_city"),
  };
}

/** Hook that manages location picker state */
export function useLocationPicker() {
  const [open, setOpen] = useState(false);
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [savedProvince, setSavedProvince] = useState<string | null>(null);

  // Check if location is already set
  useEffect(() => {
    const existing = getCookie("user_province");
    setSavedProvince(existing);
    setProvince(existing || "");
    if (!existing) {
      setOpen(true);
    }
  }, []);

  const save = useCallback(() => {
    if (!province) return;
    setUserLocationCookie(province, city);
    setSavedProvince(province);
    setOpen(false);
  }, [province, city]);

  const change = useCallback(() => {
    setOpen(true);
  }, []);

  return {
    open,
    province,
    city,
    savedProvince,
    setProvince,
    setCity,
    save,
    change,
    setOpen,
  };
}

/** Dialog for picking province/city */
export function LocationDialog({
  open,
  province,
  city,
  setProvince,
  setCity,
  save,
  setOpen,
}: {
  open: boolean;
  province: string;
  city: string;
  setProvince: (v: string) => void;
  setCity: (v: string) => void;
  save: () => void;
  setOpen: (v: boolean) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            Tu ubicación
          </DialogTitle>
          <DialogDescription>
            Seleccioná tu provincia para ver tiendas cercanas y envíos disponibles en tu zona.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">
              Provincia
            </label>
            <Select value={province} onValueChange={(v) => setProvince(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccioná una provincia..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {PROVINCES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">
              Ciudad o localidad <span className="text-gray-300">(opcional)</span>
            </label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ej: Nordelta"
              className="h-9 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={!province} className="w-full sm:w-auto">
            Guardar ubicación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small badge showing current province */
export function LocationBadge({
  province,
  onChange,
}: {
  province: string | null;
  onChange: () => void;
}) {
  if (!province) return null;

  return (
    <button
      onClick={onChange}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
      title="Cambiar ubicación"
    >
      <MapPin className="h-3 w-3" />
      <span>{province}</span>
    </button>
  );
}
