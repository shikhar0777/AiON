"use client";

import type { FeedItem } from "@/types";
import { timeAgo, truncate } from "@/lib/utils";

interface LatestWorldMarqueeProps {
  items: FeedItem[];
  loading: boolean;
  onSelectStory: (articleId: number) => void;
}

export default function LatestWorldMarquee({
  items,
  loading,
  onSelectStory,
}: LatestWorldMarqueeProps) {
  const visibleItems = items.slice(0, 15);
  const loopItems = [...visibleItems, ...visibleItems];

  return (
    <section className="border-b border-[var(--color-border)] bg-white">
      <div className="max-w-[1280px] mx-auto px-5 py-2.5 flex items-center gap-3">
        <div className="shrink-0 pr-3 border-r border-[var(--color-border)]">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
            World Latest
          </span>
        </div>

        <div className="world-marquee-mask w-full overflow-hidden">
          {visibleItems.length === 0 ? (
            <div className="text-[12px] text-[var(--color-text-tertiary)] py-1">
              {loading ? "Loading world headlines..." : "World headlines are updating..."}
            </div>
          ) : (
            <div
              className="world-marquee-track flex flex-nowrap items-center gap-6 whitespace-nowrap"
              style={{ animationDuration: `${Math.max(42, visibleItems.length * 5)}s` }}
            >
              {loopItems.map((item, idx) => (
                <button
                  key={`${item.id}-${idx}`}
                  onClick={() => onSelectStory(item.id)}
                  className="world-marquee-item inline-flex shrink-0 items-baseline gap-2 whitespace-nowrap border-0 bg-transparent p-0"
                  title={item.title}
                >
                  <span className="world-marquee-title">{truncate(item.title, 120)}</span>
                  <span className="world-marquee-meta">
                    {timeAgo(item.published_at)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
