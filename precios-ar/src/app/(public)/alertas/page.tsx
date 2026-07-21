"use client";

import { useState, useCallback } from "react";
import { Bell, BellOff, Trash2, Mail, Clock, Store, MapPin, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/shared/Header";
import { formatPrice, formatRelativeTime } from "@/lib/utils";
import type { PriceAlert, Notification } from "@/types/database";

export default function AlertasPage() {
  const [email, setEmail] = useState("");
  const [loadedEmail, setLoadedEmail] = useState("");
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadAlerts = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) {
      setError("Ingresá un email válido");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [alertsRes, notifsRes] = await Promise.all([
        fetch(`/api/alerts?email=${encodeURIComponent(trimmed)}`),
        fetch(`/api/notifications?email=${encodeURIComponent(trimmed)}`),
      ]);

      if (!alertsRes.ok) {
        const data = await alertsRes.json().catch(() => ({}));
        throw new Error(data.error || "Error al cargar alertas");
      }

      const alertsData = await alertsRes.json();
      let notifsData: Notification[] = [];
      if (notifsRes.ok) {
        notifsData = await notifsRes.json();
      }

      setAlerts(alertsData);
      setNotifications(notifsData);
      setLoadedEmail(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar alertas");
    } finally {
      setLoading(false);
    }
  }, [email]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError("Error al eliminar la alerta");
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleMarkRead = useCallback(async (id: string) => {
    setReadingId(id);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Error al marcar como leída");
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      setError("Error al marcar notificación");
    } finally {
      setReadingId(null);
    }
  }, []);

  const hasData = loadedEmail && (alerts.length > 0 || notifications.length > 0);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-xl">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              Mis alertas
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Ingresá tu email para ver tus alertas de precio y notificaciones
            </p>
          </div>

          {/* Email input */}
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 text-sm flex-1"
              onKeyDown={(e) => e.key === "Enter" && loadAlerts()}
            />
            <Button
              onClick={loadAlerts}
              disabled={loading}
              className="h-10"
            >
              {loading ? "Cargando..." : "Buscar"}
            </Button>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {loadedEmail && !alerts.length && !notifications.length && !loading && (
            <div className="text-center py-12">
              <BellOff className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                No tenés alertas activas para{" "}
                <strong className="text-gray-700">{loadedEmail}</strong>
              </p>
            </div>
          )}

          {/* Notifications */}
          {notifications.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Mail className="h-4 w-4 text-orange-500" />
                Notificaciones sin leer ({notifications.length})
              </h2>
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="rounded-lg border border-orange-100 bg-orange-50/50 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {notif.canonical_name}
                        </p>
                        {notif.cheapest_store && (
                          <p className="text-xs text-gray-600 flex items-center gap-1">
                            <Store className="h-3 w-3" />
                            {notif.cheapest_store}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {notif.cheapest_price != null && (
                            <span className="flex items-center gap-1 text-green-700 font-medium">
                              <Tag className="h-3 w-3" />
                              {formatPrice(notif.cheapest_price)}
                            </span>
                          )}
                          {notif.target_price != null && (
                            <span>
                              Objetivo: {formatPrice(notif.target_price)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatRelativeTime(notif.created_at)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-7 text-xs text-blue-600"
                        onClick={() => handleMarkRead(notif.id)}
                        disabled={readingId === notif.id}
                      >
                        {readingId === notif.id
                          ? "..."
                          : "Leída"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Separator />
            </div>
          )}

          {/* Active alerts */}
          {alerts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-500" />
                Alertas activas ({alerts.length})
              </h2>
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-lg border p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {alert.canonical_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                          {alert.target_price != null && (
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              Bajar de {formatPrice(alert.target_price)}
                            </span>
                          )}
                          {alert.province && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {alert.province}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Creada {formatRelativeTime(alert.created_at)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-7 text-xs text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(alert.id)}
                        disabled={deletingId === alert.id}
                      >
                        {deletingId === alert.id ? (
                          "..."
                        ) : (
                          <Trash2 className="h-3 w-3 mr-1" />
                        )}
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t py-8 px-4 mt-auto">
        <div className="container mx-auto text-center space-y-2">
          <p className="text-sm text-gray-500">
            PreciosAR — Precios actualizados cada 6 horas
          </p>
          <div className="flex justify-center gap-4 text-xs text-gray-400">
            <a href="/" className="hover:text-gray-900">
              Inicio
            </a>
            <a href="/buscar" className="hover:text-gray-900">
              Buscar
            </a>
            <a href="/alertas" className="hover:text-gray-900">
              Mis alertas
            </a>
          </div>
          <p className="text-xs text-gray-400">
            Los precios pueden variar. Verificá siempre en la tienda.
          </p>
        </div>
      </footer>
    </div>
  );
}
