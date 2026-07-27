"use client";

import ProductAutocomplete from "@/components/shared/ProductAutocomplete";
import type { SelectedProduct } from "@/types/search";

export default function ProductSearchInput({
  storeCategory,
  onAddProduct,
  existingItems,
  disabled,
}: {
  storeCategory: string;
  onAddProduct: (product: SelectedProduct) => void;
  existingItems: SelectedProduct[];
  disabled: boolean;
}) {
  const existingIds = existingItems
    .filter((p) => !p.isFallback)
    .map((p) => p.product_id);

  return (
    <ProductAutocomplete
      onSelect={onAddProduct}
      storeCategory={storeCategory}
      placeholder="Buscá un producto (ej: leche, arroz, pan...)"
      disabled={disabled}
      existingProductIds={existingIds}
    />
  );
}
