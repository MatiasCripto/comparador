"use client";

import { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [inputText, setInputText] = useState("");

  const handleSelect = useCallback(
    (product: SelectedProduct) => {
      onAddProduct(product);
      setInputText("");
    },
    [onAddProduct]
  );

  const handleFreeText = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    handleSelect({
      product_id: "",
      canonical_name: trimmed,
      raw_name: null,
      brand: null,
      category: null,
      subcategory: null,
      unit: null,
      quantity: null,
      isFallback: true,
    });
  }, [inputText, handleSelect]);

  const existingIds = existingItems
    .filter((p) => !p.isFallback)
    .map((p) => p.product_id);

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <ProductAutocomplete
          onSelect={handleSelect}
          storeCategory={storeCategory}
          placeholder="Buscá un producto (ej: leche, arroz, pan...)"
          disabled={disabled}
          existingProductIds={existingIds}
          onInputChange={setInputText}
        />
      </div>
      <Button
        onClick={handleFreeText}
        disabled={!/\S/.test(inputText) || disabled}
        className="h-10"
      >
        <Plus className="h-4 w-4 mr-1" />
        Agregar
      </Button>
    </div>
  );
}
