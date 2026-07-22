"use client";

import { useState, useCallback } from "react";
import { Bell, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROVINCES } from "@/lib/location";

type Status = "idle" | "loading" | "success" | "error";

export default function AlertModal({
  productName,
  defaultProvince,
}: {
  productName: string;
  defaultProvince?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [province, setProvince] = useState(defaultProvince ?? "");
  const [followWithoutTarget, setFollowWithoutTarget] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setStatus("loading");
      setErrorMsg("");

      if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
        setStatus("error");
        setErrorMsg("Ingresá un email válido");
        return;
      }

      try {
        const res = await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_email: email.trim(),
            canonical_name: productName,
            target_price: targetPrice ? parseFloat(targetPrice) : undefined,
            province: province || undefined,
            follow_without_target: followWithoutTarget,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Error al crear la alerta");
        }

        setStatus("success");
      } catch (err) {
        setStatus("error");
        setErrorMsg(
          err instanceof Error ? err.message : "Error al crear la alerta"
        );
      }
    },
    [email, productName, targetPrice, province, followWithoutTarget]
  );

  if (status === "success") {
    return (
      <DialogContent>
        <DialogHeader>
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <DialogTitle className="text-center">¡Alerta creada!</DialogTitle>
            <DialogDescription className="text-center">
              Te vamos a notificar en {email} cuando haya novedades sobre{" "}
              <strong>{productName}</strong>.
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="default" className="w-full" />}>
            Cerrar
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-600" />
          Crear alerta de precio
        </DialogTitle>
        <DialogDescription>
          Recibí notificaciones cuando cambie el precio de{" "}
          <strong>{productName}</strong>.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="alert-email">Tu email</Label>
          <Input
            id="alert-email"
            type="email"
            placeholder="ejemplo@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 text-sm"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="alert-price">Avisame cuando baje de $</Label>
          <Input
            id="alert-price"
            type="number"
            placeholder="Opcional"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            className="h-10 text-sm"
            min={0}
          />
        </div>

        <div className="space-y-2">
          <Label>Provincia (opcional)</Label>
          <Select value={province} onValueChange={(v) => setProvince(v ?? "")}>
            <SelectTrigger className="h-10 text-sm">
              <SelectValue placeholder="Todas las provincias" />
            </SelectTrigger>
            <SelectContent>
              {PROVINCES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={followWithoutTarget}
            onChange={(e) => setFollowWithoutTarget(e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600 leading-tight">
            Seguir este producto aunque no tenga precio objetivo (recibí
            actualizaciones diarias)
          </span>
        </label>

        {status === "error" && errorMsg && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        <DialogFooter className="-mx-0 -mb-0 px-0 border-t pt-4">
          <div className="flex gap-2 w-full">
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                />
              }
            >
              Cancelar
            </DialogClose>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={status === "loading"}
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear alerta"
              )}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
