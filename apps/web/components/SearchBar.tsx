"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { SearchSuggestion } from "@/types";
import { getSearchSuggestions } from "@/lib/api";

interface SearchBarProps {
  onSelectArticle: (id: number) => void;
}

export default function SearchBar({ onSelectArticle }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [focused, setFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced suggestion fetch
  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const data = await getSearchSuggestions(q.trim());
        if (!controller.signal.aborted) {
          setSuggestions(data.suggestions);
          setOpen(data.suggestions.length > 0);
          setActiveIdx(-1);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    fetchSuggestions(val);
  };

  const selectItem = (item: SearchSuggestion) => {
    onSelectArticle(item.id);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIdx >= 0 && activeIdx < suggestions.length) {
          selectItem(suggestions[activeIdx]);
        }
        break;
      case "Escape":
        setOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Highlight matching text in suggestion title
  const highlightMatch = (title: string, q: string) => {
    if (!q.trim()) return title;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = title.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="font-bold text-[var(--color-text-primary)]">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const categoryLabel = (cat: string) =>
    cat.charAt(0).toUpperCase() + cat.slice(1).replace("-", " ");

  return (
    <div ref={containerRef} className="relative w-full max-w-[320px]">
      {/* Input */}
      <div
        className="flex items-center gap-2 border transition-colors"
        style={{
          borderColor: focused ? "var(--color-text-primary)" : "var(--color-border)",
          background: "var(--color-bg-primary)",
        }}
      >
        {/* Search icon */}
        <div className="pl-2.5 flex items-center text-[var(--color-text-tertiary)]">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7" cy="7" r="5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setFocused(true);
            if (suggestions.length > 0) setOpen(true);
          }}
          placeholder="Search news..."
          className="flex-1 py-1.5 pr-2.5 text-[12px] bg-transparent outline-none placeholder:text-[var(--color-text-tertiary)]"
          aria-label="Search news"
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
          autoComplete="off"
        />
        {/* Loading spinner or clear button */}
        {query && (
          loading ? (
            <div className="pr-2.5">
              <svg className="animate-spin w-3 h-3 text-[var(--color-text-tertiary)]" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="30 12" />
              </svg>
            </div>
          ) : (
            <button
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                setOpen(false);
                inputRef.current?.focus();
              }}
              className="pr-2.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Clear search"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
              </svg>
            </button>
          )
        )}
      </div>

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-0.5 bg-white border border-[var(--color-border)] shadow-lg z-50 max-h-[400px] overflow-y-auto"
          role="listbox"
        >
          {suggestions.map((item, idx) => (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => selectItem(item)}
              onMouseEnter={() => setActiveIdx(idx)}
              role="option"
              aria-selected={idx === activeIdx}
              className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors border-b last:border-b-0"
              style={{
                borderColor: "rgba(0,0,0,0.06)",
                background: idx === activeIdx ? "var(--color-bg-secondary)" : "transparent",
              }}
            >
              {/* Thumbnail or type icon */}
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt=""
                  className="w-10 h-10 object-cover shrink-0 mt-0.5"
                  style={{ background: "var(--color-bg-secondary)" }}
                />
              ) : (
                <div className="w-10 h-10 shrink-0 flex items-center justify-center mt-0.5" style={{ background: "var(--color-bg-secondary)" }}>
                  {item.type === "cluster" ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.3" strokeLinecap="round">
                      <rect x="2" y="2" width="5" height="5" rx="0.5" />
                      <rect x="9" y="2" width="5" height="5" rx="0.5" />
                      <rect x="5.5" y="9" width="5" height="5" rx="0.5" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.3" strokeLinecap="round">
                      <rect x="2" y="2" width="12" height="12" rx="1" />
                      <path d="M5 6h6M5 8.5h4" />
                    </svg>
                  )}
                </div>
              )}

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="text-[12px] leading-[1.4] line-clamp-2" style={{ color: "var(--color-text-primary)" }}>
                  {highlightMatch(item.title, query)}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[var(--color-text-tertiary)]">
                  <span className="uppercase font-medium tracking-wider">
                    {categoryLabel(item.category)}
                  </span>
                  {item.source && (
                    <>
                      <span className="opacity-40">|</span>
                      <span>{item.source}</span>
                    </>
                  )}
                  {item.type === "cluster" && (
                    <>
                      <span className="opacity-40">|</span>
                      <span className="font-medium">Story cluster</span>
                    </>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div className="shrink-0 mt-1 text-[var(--color-text-tertiary)]">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 1.5L6.5 5L3 8.5" />
                </svg>
              </div>
            </button>
          ))}

          {/* Keyboard hint */}
          <div className="px-3 py-1.5 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] flex items-center gap-3 text-[10px] text-[var(--color-text-tertiary)]">
            <span><kbd className="font-mono px-1 py-0.5 border border-[var(--color-border)] bg-white rounded text-[9px]">&uarr;&darr;</kbd> navigate</span>
            <span><kbd className="font-mono px-1 py-0.5 border border-[var(--color-border)] bg-white rounded text-[9px]">&crarr;</kbd> select</span>
            <span><kbd className="font-mono px-1 py-0.5 border border-[var(--color-border)] bg-white rounded text-[9px]">esc</kbd> close</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {open && suggestions.length === 0 && query.trim().length >= 2 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-0.5 bg-white border border-[var(--color-border)] shadow-lg z-50">
          <div className="px-3 py-4 text-center text-[12px] text-[var(--color-text-tertiary)]">
            No results for &ldquo;{query.trim()}&rdquo;
          </div>
        </div>
      )}
    </div>
  );
}
