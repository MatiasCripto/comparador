"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";
import type { AutocompleteSuggestion } from "@/types/database";
import type { SelectedProduct } from "@/types/search";

interface ProductAutocompleteProps {
  onSelect: (product: SelectedProduct) => void;
  storeCategory?: string;
  placeholder?: string;
  disabled?: boolean;
  /** IDs de productos ya agregados para excluir del dropdown */
  existingProductIds?: string[];
  /** Callback para que el padre pueda leer el texto actual del input */
  onInputChange?: (value: string) => void;
}

export default function ProductAutocomplete({
  onSelect,
  storeCategory,
  placeholder = "Buscá un producto...",
  disabled = false,
  existingProductIds = [],
  onInputChange,
}: ProductAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ q });
      if (storeCategory) params.set("store_category", storeCategory);
      const res = await fetch(`/api/lista/suggest?${params.toString()}`);
      const data = await res.json();
      const filtered = (data.suggestions ?? []).filter(
        (s: AutocompleteSuggestion) => !existingProductIds.includes(s.product_id)
      );
      setSuggestions(filtered);
      setShowDropdown(filtered.length > 0);
      setSelectedIndex(-1);
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, [storeCategory, existingProductIds]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(query.trim()), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const suggestionToProduct = useCallback(
    (s: AutocompleteSuggestion): SelectedProduct => ({
      product_id: s.product_id,
      canonical_name: s.canonical_name,
      raw_name: s.raw_name,
      brand: s.brand,
      category: s.category,
      subcategory: s.subcategory,
      unit: s.unit,
      quantity: s.quantity,
    }),
    []
  );

  const selectSuggestion = useCallback(
    (s: AutocompleteSuggestion) => {
      onSelect(suggestionToProduct(s));
      setQuery("");
      setSuggestions([]);
      setShowDropdown(false);
      onInputChange?.("");
      inputRef.current?.focus();
    },
    [onSelect, suggestionToProduct, onInputChange]
  );

  const submitAsFallback = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    onSelect({
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
    setQuery("");
    setSuggestions([]);
    setShowDropdown(false);
    onInputChange?.("");
    inputRef.current?.focus();
  }, [query, onSelect, onInputChange]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    onInputChange?.(value);
  }, [onInputChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectSuggestion(suggestions[selectedIndex]);
        } else if (suggestions.length > 0) {
          selectSuggestion(suggestions[0]);
        } else {
          submitAsFallback();
        }
      } else if (e.key === "Escape") {
        setShowDropdown(false);
      }
    },
    [suggestions, selectedIndex, selectSuggestion, submitAsFallback]
  );

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder}
          className="h-10 text-sm pl-9"
          disabled={disabled}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg max-h-72 overflow-y-auto"
        >
          {suggestions.map((s, i) => (
            <button
              key={s.product_id || `${s.canonical_name}-${i}`}
              onClick={() => selectSuggestion(s)}
              className={`w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between gap-3 border-b last:border-b-0 ${
                i === selectedIndex ? "bg-blue-50" : "hover:bg-blue-50"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {s.canonical_name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {[s.brand, s.store_name].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.unit && s.quantity && (
                  <span className="text-xs text-gray-400">
                    {s.quantity}{s.unit}
                  </span>
                )}
                <span className="text-sm font-semibold text-green-700">
                  {formatPrice(s.price)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
