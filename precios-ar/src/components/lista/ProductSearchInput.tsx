"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Plus, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import type { AutocompleteSuggestion } from "@/types/database";

export default function ProductSearchInput({
  storeCategory,
  onAddProduct,
  existingItems,
  disabled,
}: {
  storeCategory: string;
  onAddProduct: (name: string) => void;
  existingItems: string[];
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
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
      const res = await fetch(
        `/api/lista/suggest?q=${encodeURIComponent(q)}&store_category=${encodeURIComponent(storeCategory)}`
      );
      const data = await res.json();
      const filtered = (data.suggestions ?? []).filter(
        (s: AutocompleteSuggestion) => !existingItems.includes(s.canonical_name)
      );
      setSuggestions(filtered);
      setShowDropdown(filtered.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [storeCategory, existingItems]);

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
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const addSuggestion = (suggestion: AutocompleteSuggestion) => {
    onAddProduct(suggestion.canonical_name);
    setQuery("");
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const addCurrentText = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    onAddProduct(trimmed);
    setQuery("");
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (suggestions.length > 0) {
                  addSuggestion(suggestions[0]);
                } else {
                  addCurrentText();
                }
              }
              if (e.key === "Escape") setShowDropdown(false);
            }}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true);
            }}
            placeholder="Buscá un producto (ej: leche, arroz, pan...)"
            className="h-10 text-sm pl-9"
            disabled={disabled}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
          )}
        </div>
        <Button
          onClick={addCurrentText}
          disabled={!query.trim() || disabled}
          className="h-10"
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar
        </Button>
      </div>

      {/* Autocomplete dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg max-h-72 overflow-y-auto"
        >
          {suggestions.map((s, i) => (
            <button
              key={`${s.canonical_name}-${i}`}
              onClick={() => addSuggestion(s)}
              className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-center justify-between gap-3 border-b last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {s.canonical_name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {s.store_name}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-green-700">
                  {formatPrice(s.price)}
                </span>
                <Plus className="h-3.5 w-3.5 text-blue-500" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
