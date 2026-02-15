"use client";

import { useRef } from "react";
import type { CategoryMeta } from "@/types";

interface Props {
  categories: CategoryMeta[];
  selected: string;
  onSelect: (id: string) => void;
  mode: "trending" | "latest";
  onModeChange: (mode: "trending" | "latest") => void;
}

export default function CategoryChips({
  categories,
  selected,
  onSelect,
  mode,
  onModeChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="border-b border-[var(--color-border)]">
      <div className="max-w-[1280px] mx-auto px-5">
        <div className="flex items-center gap-0">
          {/* Mode toggle */}
          <div className="flex items-center border-r border-[var(--color-border)] mr-2">
            {(["trending", "latest"] as const).map((m) => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                className={`section-nav-item text-[12px] ${mode === m ? "active" : ""}`}
              >
                {m === "trending" ? "Trending" : "Latest"}
              </button>
            ))}
          </div>

          {/* Scrollable section nav */}
          <div
            ref={scrollRef}
            className="flex items-center gap-0 overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className={`section-nav-item ${selected === cat.id ? "active" : ""}`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
