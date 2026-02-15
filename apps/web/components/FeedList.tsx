"use client";

import { AnimatePresence } from "framer-motion";
import type { FeedItem } from "@/types";
import FeedCard from "./FeedCard";

interface Props {
  items: FeedItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  loading: boolean;
}

export default function FeedList({
  items,
  selectedId,
  onSelect,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="flex flex-col">
        {/* Lead skeleton */}
        <div className="pb-5 mb-5 border-b border-[var(--color-border)] animate-pulse">
          <div className="w-full aspect-[16/9] bg-[var(--color-bg-tertiary)] mb-3" />
          <div className="h-3 bg-[var(--color-bg-tertiary)] w-20 mb-3" />
          <div className="h-8 bg-[var(--color-bg-tertiary)] w-3/4 mb-2" />
          <div className="h-4 bg-[var(--color-bg-tertiary)] w-full mb-1" />
          <div className="h-4 bg-[var(--color-bg-tertiary)] w-2/3" />
        </div>
        {/* Standard skeletons */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="py-4 border-b border-[var(--color-border)] animate-pulse">
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-[var(--color-bg-tertiary)] w-16" />
                <div className="h-5 bg-[var(--color-bg-tertiary)] w-3/4" />
                <div className="h-4 bg-[var(--color-bg-tertiary)] w-full" />
              </div>
              <div className="w-[150px] h-[100px] bg-[var(--color-bg-tertiary)]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <h3 className="headline-md mb-2">No Stories Yet</h3>
        <p className="text-[14px] text-[var(--color-text-secondary)]">
          Try a different edition or section.
        </p>
      </div>
    );
  }

  const leadItem = items[0];
  const restItems = items.slice(1);
  // Right column compact items (first 4 after lead)
  const sideItems = restItems.slice(0, 4);
  // Remaining items below
  const remainingItems = restItems.slice(4);

  return (
    <div>
      {/* NYT-style grid: Lead left, compact list right */}
      <div className="flex gap-0">
        {/* Lead story - left column */}
        <div className="flex-1 pr-5 border-r border-[var(--color-border)]">
          <AnimatePresence mode="popLayout">
            <FeedCard
              key={leadItem.id}
              item={leadItem}
              index={0}
              isSelected={selectedId === leadItem.id}
              onClick={() => onSelect(leadItem.id)}
              variant="lead"
            />
          </AnimatePresence>
        </div>

        {/* Right column - compact headlines */}
        {sideItems.length > 0 && (
          <div className="w-[280px] pl-5 flex-shrink-0">
            <AnimatePresence mode="popLayout">
              {sideItems.map((item, index) => (
                <FeedCard
                  key={item.id}
                  item={item}
                  index={index + 1}
                  isSelected={selectedId === item.id}
                  onClick={() => onSelect(item.id)}
                  variant="compact"
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Remaining stories - standard list with rule */}
      {remainingItems.length > 0 && (
        <>
          <hr className="rule-strong mt-2 mb-0" />
          <AnimatePresence mode="popLayout">
            {remainingItems.map((item, index) => (
              <FeedCard
                key={item.id}
                item={item}
                index={index + 5}
                isSelected={selectedId === item.id}
                onClick={() => onSelect(item.id)}
                variant="standard"
              />
            ))}
          </AnimatePresence>
        </>
      )}

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-[var(--color-border)] text-[12px] text-center text-[var(--color-text-tertiary)]">
        {items.length} stories
      </div>
    </div>
  );
}
