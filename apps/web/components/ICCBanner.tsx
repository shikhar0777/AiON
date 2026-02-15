"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { FeedItem } from "@/types";
import { getFeed } from "@/lib/api";

// ── Category styles ─────────────────────────────────────────────
const CATEGORY_THEMES: Record<string, { bg: string; accent: string; icon: string }> = {
  sports:        { bg: "linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 40%, #0d1b2a 100%)", accent: "#8b5cf6", icon: "M8 2L3 7h3v5h4V7h3L8 2z" },
  technology:    { bg: "linear-gradient(135deg, #0a1628 0%, #0c2d48 40%, #051937 100%)", accent: "#06b6d4", icon: "M4 3h8v10H4zM6 1v2M10 1v2M7 13v2M9 13v2" },
  business:      { bg: "linear-gradient(135deg, #1a0a0a 0%, #2d1a1a 40%, #1a0d0d 100%)", accent: "#f59e0b", icon: "M2 14V6l6-4 6 4v8M6 14v-4h4v4" },
  politics:      { bg: "linear-gradient(135deg, #0a1a0a 0%, #1a2d1a 40%, #0d1a0d 100%)", accent: "#10b981", icon: "M8 1v14M4 5h8M3 9h10" },
  entertainment: { bg: "linear-gradient(135deg, #1a0a1a 0%, #2d1a2d 40%, #1a0d1a 100%)", accent: "#ec4899", icon: "M8 2a6 6 0 100 12A6 6 0 008 2zM8 5v3l2 2" },
  health:        { bg: "linear-gradient(135deg, #0a1a1a 0%, #1a2d2d 40%, #0d1a1a 100%)", accent: "#14b8a6", icon: "M8 3v10M3 8h10" },
  science:       { bg: "linear-gradient(135deg, #0f0a1e 0%, #1e1a3e 40%, #120d28 100%)", accent: "#a78bfa", icon: "M8 2a3 3 0 100 6 3 3 0 000-6zM5 12a5 5 0 0110 0" },
  world:         { bg: "linear-gradient(135deg, #0a0f1e 0%, #1a2540 40%, #0d1525 100%)", accent: "#60a5fa", icon: "M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM1.5 8h13M8 1.5c-2 2.5-2 10.5 0 13M8 1.5c2 2.5 2 10.5 0 13" },
};

const DEFAULT_THEME = { bg: "linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 40%, #0d1b2a 100%)", accent: "#8b5cf6", icon: "" };

// Trending categories to rotate through
const TRENDING_CATEGORIES = ["sports", "technology", "business", "politics", "entertainment", "health", "science", "world"];

interface BannerSlide {
  type: "icc" | "trending";
  category?: string;
  item?: FeedItem;
}

// ── ICC Slide ───────────────────────────────────────────────────
function ICCSlide() {
  return (
    <div className="max-w-[1280px] mx-auto px-5 py-4 flex items-center justify-between relative z-[1]">
      <div>
        <p className="text-[11px] text-purple-300 font-medium tracking-wider uppercase mb-1">
          News &amp; Updates
        </p>
        <h2 className="text-white leading-tight">
          <span className="text-[22px] md:text-[28px] font-bold">ICC Men&apos;s</span>
          <br />
          <span className="text-[22px] md:text-[28px] font-bold">T20 World Cup </span>
          <span className="text-[22px] md:text-[28px] font-bold text-purple-400">2026</span>
        </h2>
      </div>
      <div className="hidden sm:flex items-center gap-6 md:gap-10">
        <div className="text-right">
          <p className="text-[10px] text-white/50 font-semibold tracking-widest uppercase mb-1">Hosts</p>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-purple-400 shrink-0">
              <path d="M8 1.5c-2.5 0-5 2-5 5C3 10 8 14.5 8 14.5s5-4.5 5-8.5c0-3-2.5-5-5-5z" stroke="currentColor" strokeWidth="1.3" fill="none" />
              <circle cx="8" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
            <span className="text-white text-[14px] md:text-[16px] font-semibold">India &amp; Sri Lanka</span>
          </div>
        </div>
        <div className="w-px h-10 bg-white/15" />
        <div className="text-right">
          <p className="text-[10px] text-white/50 font-semibold tracking-widest uppercase mb-1">Format</p>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-purple-400 shrink-0">
              <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <circle cx="10" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <path d="M1.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <path d="M10 9c2.5 0 4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
            <span className="text-white text-[14px] md:text-[16px] font-semibold">20 Teams</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Trending News Slide ─────────────────────────────────────────
function TrendingSlide({ item, category, accent }: { item: FeedItem; category: string; accent: string }) {
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  return (
    <div className="max-w-[1280px] mx-auto px-5 py-4 flex items-center gap-5 relative z-[1] min-h-[100px]">
      {/* Thumbnail */}
      {item.image_url && (
        <div className="hidden sm:block w-[90px] h-[68px] shrink-0 overflow-hidden rounded-sm">
          <img src={item.image_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[11px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-sm"
            style={{ background: accent + "30", color: accent }}
          >
            Trending in {label}
          </span>
        </div>
        <h2 className="text-white text-[22px] md:text-[28px] font-bold leading-tight line-clamp-2">
          {item.title}
        </h2>
      </div>

      {/* Score badge */}
      {item.cluster_size > 1 && (
        <div className="hidden md:flex flex-col items-center shrink-0">
          <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">Sources</span>
          <span className="text-white text-[24px] font-bold" style={{ color: accent }}>{item.cluster_size}</span>
        </div>
      )}
    </div>
  );
}

// ── Main Banner ─────────────────────────────────────────────────
interface ICCBannerProps {
  onSelectStory?: (id: number) => void;
}

export default function ICCBanner({ onSelectStory }: ICCBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [slides, setSlides] = useState<BannerSlide[]>([{ type: "icc" }]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [fade, setFade] = useState(true);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Fetch trending news for each category
  useEffect(() => {
    let cancelled = false;

    async function loadTrending() {
      const trendingSlides: BannerSlide[] = [];

      // Fetch top trending item from each category in parallel
      const results = await Promise.allSettled(
        TRENDING_CATEGORIES.map((cat) => getFeed("", cat, "trending", 0, 1))
      );

      results.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value.items.length > 0) {
          trendingSlides.push({
            type: "trending",
            category: TRENDING_CATEGORIES[i],
            item: result.value.items[0],
          });
        }
      });

      if (!cancelled && trendingSlides.length > 0) {
        setSlides([{ type: "icc" }, ...trendingSlides]);
      }
    }

    loadTrending();
    return () => { cancelled = true; };
  }, []);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (paused || slides.length <= 1) return;

    timerRef.current = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setActiveIdx((prev) => (prev + 1) % slides.length);
        setFade(true);
      }, 300);
    }, 5000);

    return () => clearInterval(timerRef.current);
  }, [slides.length, paused]);

  const goTo = (idx: number) => {
    setFade(false);
    setTimeout(() => {
      setActiveIdx(idx);
      setFade(true);
    }, 200);
  };

  if (dismissed) return null;

  const current = slides[activeIdx];
  const theme = current.type === "icc"
    ? DEFAULT_THEME
    : CATEGORY_THEMES[current.category || ""] || DEFAULT_THEME;

  const handleClick = () => {
    if (current.type === "trending" && current.item && onSelectStory) {
      onSelectStory(current.item.id);
    }
  };

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ background: theme.bg, minHeight: 100 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 200'%3E%3Cellipse cx='600' cy='300' rx='700' ry='250' fill='none' stroke='%23ffffff' stroke-width='0.5' opacity='0.3'/%3E%3Cellipse cx='600' cy='300' rx='500' ry='180' fill='none' stroke='%23ffffff' stroke-width='0.3' opacity='0.2'/%3E%3C/svg%3E")`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 80% 50%, ${theme.accent}20 0%, transparent 60%)` }}
      />

      {/* Close button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-3 z-10 text-white/40 hover:text-white/80 transition-colors cursor-pointer"
        aria-label="Dismiss banner"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>

      {/* Slide content with fade */}
      <div
        onClick={handleClick}
        className={`transition-opacity duration-300 ${fade ? "opacity-100" : "opacity-0"} ${current.type === "trending" ? "cursor-pointer" : ""}`}
      >
        {current.type === "icc" ? (
          <ICCSlide />
        ) : current.item ? (
          <TrendingSlide item={current.item} category={current.category || ""} accent={theme.accent} />
        ) : null}
      </div>

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="transition-all duration-300 rounded-full cursor-pointer"
              style={{
                width: i === activeIdx ? 16 : 6,
                height: 6,
                background: i === activeIdx ? theme.accent : "rgba(255,255,255,0.3)",
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}, ${theme.accent}80, ${theme.accent}, transparent)` }}
      />
    </div>
  );
}
