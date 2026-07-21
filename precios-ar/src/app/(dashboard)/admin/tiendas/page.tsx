"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Store,
  Plus,
  ExternalLink,
  Eye,
  RotateCcw,
  Pencil,
  Loader2,
  SearchX,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
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
import type { Store as StoreType, ScrapingLog } from "@/types/database";

type StoreWithCount = StoreType & { product_count: number };

const CATEGORIES = [
  "Supermercado",
  "Pinturería",
  "Corralón",
  "Cerámica",
  "Ferretería",
  "Electrodoméstico",
  "Farmacia",
  "Otro",
];

const PROVINCES = [
  "CABA",
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isRecentlyScraped(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 12 * 3600000;
}

// --- Toggle Switch ---
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-blue-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// --- Store Edit Dialog ---
type ScrapingConfig = {
  product_selector?: string;
  name_selector?: string;
  price_selector?: string;
  pagination?: boolean;
  pagination_selector?: string;
};

function StoreEditDialog({
  open,
  onOpenChange,
  store,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: StoreWithCount | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [scrapingEnabled, setScrapingEnabled] = useState(true);
  const [scrapingConfig, setScrapingConfig] = useState<ScrapingConfig>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(store?.name ?? "");
      setUrl(store?.url ?? "");
      setCategory(store?.category ?? "");
      setProvince(store?.province ?? "");
      setCity(store?.city ?? "");
      setScrapingEnabled(store?.scraping_enabled ?? true);
      const config = (store?.scraping_config ?? {}) as ScrapingConfig;
      setScrapingConfig(config);
      setError("");
    }
  }, [open, store]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError("El nombre es requerido");
      return;
    }
    if (!url.trim() || !url.startsWith("https://")) {
      setError("La URL debe empezar con https://");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        url: url.trim(),
        category: category || null,
        province: province || null,
        city: city || null,
        scraping_enabled: scrapingEnabled,
        scraping_config: Object.keys(scrapingConfig).length > 0 ? scrapingConfig : null,
      };

      const res = store
        ? await fetch("/api/admin/stores", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: store.id, ...payload }),
          })
        : await fetch("/api/admin/stores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al guardar");
      }

      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }, [name, url, category, province, city, scrapingEnabled, scrapingConfig, store, onOpenChange, onSaved]);

  const isEdit = !!store;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar tienda" : "Nueva tienda"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualizá los datos de la tienda"
              : "Agregá una nueva tienda para scrapear"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="store-name">Nombre</Label>
              <Input
                id="store-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Coto Digital"
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="store-url">URL</Label>
              <Input
                id="store-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.coto.com.ar"
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Provincia</Label>
              <Select value={province} onValueChange={(v) => setProvince(v ?? "")}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Seleccionar..." />
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

            <div className="space-y-2 col-span-2">
              <Label htmlFor="store-city">Ciudad</Label>
              <Input
                id="store-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ej: Córdoba"
                className="h-10 text-sm"
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label className="cursor-pointer">Scraping habilitado</Label>
            <Toggle checked={scrapingEnabled} onChange={setScrapingEnabled} />
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">Configuración de scraping</p>

            <div className="space-y-2">
              <Label htmlFor="sc-product">Selector de producto</Label>
              <Input
                id="sc-product"
                value={scrapingConfig.product_selector ?? ""}
                onChange={(e) =>
                  setScrapingConfig((prev) => ({
                    ...prev,
                    product_selector: e.target.value,
                  }))
                }
                placeholder=".product-item"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sc-name">Selector de nombre</Label>
              <Input
                id="sc-name"
                value={scrapingConfig.name_selector ?? ""}
                onChange={(e) =>
                  setScrapingConfig((prev) => ({
                    ...prev,
                    name_selector: e.target.value,
                  }))
                }
                placeholder=".product-name"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sc-price">Selector de precio</Label>
              <Input
                id="sc-price"
                value={scrapingConfig.price_selector ?? ""}
                onChange={(e) =>
                  setScrapingConfig((prev) => ({
                    ...prev,
                    price_selector: e.target.value,
                  }))
                }
                placeholder=".price"
                className="h-9 text-sm"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="cursor-pointer">Paginación</Label>
              <Toggle
                checked={scrapingConfig.pagination ?? false}
                onChange={(checked) =>
                  setScrapingConfig((prev) => ({
                    ...prev,
                    pagination: checked,
                  }))
                }
              />
            </div>

            {scrapingConfig.pagination && (
              <div className="space-y-2">
                <Label htmlFor="sc-pagination">Selector de paginación</Label>
                <Input
                  id="sc-pagination"
                  value={scrapingConfig.pagination_selector ?? ""}
                  onChange={(e) =>
                    setScrapingConfig((prev) => ({
                      ...prev,
                      pagination_selector: e.target.value,
                    }))
                  }
                  placeholder=".next-page"
                  className="h-9 text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 mx-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Guardando...
              </>
            ) : isEdit ? (
              "Guardar cambios"
            ) : (
              "Crear tienda"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Logs Dialog ---
function LogsDialog({
  open,
  onOpenChange,
  store,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: StoreWithCount | null;
}) {
  const [logs, setLogs] = useState<ScrapingLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && store) {
      setLoading(true);
      fetch(`/api/admin/stores/logs?id=${store.id}`)
        .then((r) => r.json())
        .then((data) => setLogs(data ?? []))
        .catch(() => setLogs([]))
        .finally(() => setLoading(false));
    }
  }, [open, store]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Logs de scraping</DialogTitle>
          <DialogDescription>
            {store?.name ?? "Tienda"} — Últimos 20 registros
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">
            No hay logs de scraping para esta tienda
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead>Actualizados</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDate(log.scraped_at)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.status === "success" ? "default" : "destructive"
                        }
                        className="text-[10px]"
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.products_found ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.products_updated ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate text-red-600">
                      {log.error_message ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cerrar
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Store Logs API (sibling endpoint for convenience) ---
// We also need to add the logs endpoint. Let me create it inline by
// reading from the page. Actually, the logs endpoint will be added
// as a separate route at /api/admin/stores/logs.

// --- Main Page ---
export default function AdminTiendasPage() {
  const [stores, setStores] = useState<StoreWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreWithCount | null>(null);

  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [logsStore, setLogsStore] = useState<StoreWithCount | null>(null);

  const [scrapingStoreId, setScrapingStoreId] = useState<string | null>(null);

  const loadStores = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stores");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al cargar tiendas");
      }
      const data = await res.json();
      setStores(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar tiendas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const handleToggleScraping = useCallback(
    async (store: StoreWithCount) => {
      const newValue = !store.scraping_enabled;

      // Optimistic update
      setStores((prev) =>
        prev.map((s) =>
          s.id === store.id ? { ...s, scraping_enabled: newValue } : s
        )
      );

      try {
        const res = await fetch("/api/admin/stores", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: store.id, scraping_enabled: newValue }),
        });

        if (!res.ok) {
          // Revert on error
          setStores((prev) =>
            prev.map((s) =>
              s.id === store.id ? { ...s, scraping_enabled: !newValue } : s
            )
          );
        }
      } catch {
        setStores((prev) =>
          prev.map((s) =>
            s.id === store.id ? { ...s, scraping_enabled: !newValue } : s
          )
        );
      }
    },
    []
  );

  const handleTriggerScraping = useCallback(async (storeId: string) => {
    setScrapingStoreId(storeId);
    try {
      await fetch("/api/admin/trigger-scraping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId }),
      });
    } catch {
      // Silently fail — user can see the result when logs refresh
    } finally {
      setScrapingStoreId(null);
    }
  }, []);

  const openNewStore = useCallback(() => {
    setEditingStore(null);
    setEditDialogOpen(true);
  }, []);

  const openEditStore = useCallback((store: StoreWithCount) => {
    setEditingStore(store);
    setEditDialogOpen(true);
  }, []);

  const openLogs = useCallback((store: StoreWithCount) => {
    setLogsStore(store);
    setLogsDialogOpen(true);
  }, []);

  const activeStores = stores.filter((s) => s.scraping_enabled).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-[10px]">P</span>
            </div>
            <span className="font-bold text-sm">
              Precios<span className="text-blue-600">AR</span>
            </span>
          </div>

          <div className="h-4 w-px bg-gray-200" />

          <h1 className="text-sm font-medium text-gray-900">Admin Tiendas</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Store className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Tiendas</h2>
            <Badge variant="secondary" className="text-xs font-normal">
              {stores.length} total · {activeStores} activas
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={loadStores}
              disabled={loading}
            >
              <RefreshCw
                className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`}
              />
              Recargar
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={openNewStore}
            >
              <Plus className="h-3 w-3 mr-1" />
              Nueva tienda
            </Button>
          </div>
        </div>

        {/* Table */}
        {loading && stores.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-600">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={loadStores}
            >
              Reintentar
            </Button>
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-16">
            <SearchX className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-4">
              No hay tiendas configuradas
            </p>
            <Button size="sm" onClick={openNewStore}>
              <Plus className="h-3 w-3 mr-1" />
              Agregar primera tienda
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Provincia</TableHead>
                  <TableHead>Scraping</TableHead>
                  <TableHead>Último scraping</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium text-sm">
                      {store.name}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 max-w-[180px] truncate">
                      <a
                        href={store.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 flex items-center gap-1"
                      >
                        {store.url.replace("https://", "")}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell>
                      {store.category ? (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {store.category}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {store.province ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Toggle
                        checked={store.scraping_enabled}
                        onChange={() => handleToggleScraping(store)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(store.last_scraped_at)}
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {store.product_count}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          isRecentlyScraped(store.last_scraped_at)
                            ? "default"
                            : "secondary"
                        }
                        className={`text-[10px] ${
                          isRecentlyScraped(store.last_scraped_at)
                            ? "bg-green-100 text-green-700 hover:bg-green-100"
                            : "text-gray-500"
                        }`}
                      >
                        {isRecentlyScraped(store.last_scraped_at)
                          ? "Activo"
                          : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Editar"
                          onClick={() => openEditStore(store)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Ver logs"
                          onClick={() => openLogs(store)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Forzar scraping"
                          onClick={() => handleTriggerScraping(store.id)}
                          disabled={scrapingStoreId === store.id}
                        >
                          {scrapingStoreId === store.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Dialogs */}
      <StoreEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        store={editingStore}
        onSaved={loadStores}
      />

      <LogsDialog
        open={logsDialogOpen}
        onOpenChange={setLogsDialogOpen}
        store={logsStore}
      />
    </div>
  );
}
