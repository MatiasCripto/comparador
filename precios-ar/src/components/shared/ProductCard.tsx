import { Store, MapPin, ExternalLink, Clock, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import AlertModal from "./AlertModal";
import type { LatestPrice } from "@/types/database";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "recién actualizado";
  if (hours === 1) return "actualizado hace 1 hora";
  if (hours < 24) return `actualizado hace ${hours} horas`;
  const days = Math.floor(hours / 24);
  return `actualizado hace ${days} días`;
}

export default function ProductCard({
  product,
  isBestPrice,
}: {
  product: LatestPrice;
  isBestPrice?: boolean;
}) {
  return (
    <Dialog>
      <div
      className={`rounded-xl border bg-white p-4 transition-shadow hover:shadow-md ${
        isBestPrice ? "ring-2 ring-green-500" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate">
              {product.canonical_name}
            </h3>
            {isBestPrice && (
              <Badge className="shrink-0 bg-green-600 text-white text-[10px] px-1.5 py-0">
                Mejor precio
              </Badge>
            )}
          </div>

          {product.brand && (
            <p className="text-sm text-gray-500">{product.brand}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Store className="h-3 w-3" />
              {product.store_name}
            </span>
            {(product.province || product.city) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {[product.city, product.province].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        </div>

        {/* Price & Actions */}
        <div className="text-right shrink-0 space-y-2">
          <p className="text-2xl font-bold text-gray-900">
            {formatPrice(product.price)}
          </p>
          <p className="text-xs text-gray-500">
            <Clock className="h-3 w-3 inline mr-0.5" />
            {timeAgo(product.scraped_at)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
        {product.product_url && (
          <a
            href={product.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-xs h-8 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Ver en tienda
          </a>
        )}
        <DialogTrigger render={<Button variant="ghost" size="sm" className="text-xs h-8 text-blue-600" />}>
          <Bell className="h-3 w-3 mr-1" />
          Crear alerta
        </DialogTrigger>
      </div>
      </div>

      <AlertModal
        productName={product.canonical_name}
        defaultProvince={product.province}
      />
    </Dialog>
  );
}
