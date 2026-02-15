"use client";

import { motion } from "framer-motion";
import type { FeedItem } from "@/types";
import { timeAgo, truncate } from "@/lib/utils";

interface Props {
  item: FeedItem;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  variant?: "lead" | "standard" | "compact";
}

export default function FeedCard({
  item,
  index,
  isSelected,
  onClick,
  variant = "standard",
}: Props) {
  if (variant === "lead") {
    return (
      <motion.article
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        onClick={onClick}
        className={`cursor-pointer group nyt-hover pb-5 mb-5 border-b border-[var(--color-border)] ${
          isSelected ? "bg-[var(--color-bg-secondary)] -mx-2 px-2" : ""
        }`}
      >
        {/* Lead image */}
        {item.image_url && (
          <div className="w-full aspect-[16/9] overflow-hidden bg-[var(--color-bg-tertiary)] mb-3">
            <img
              src={item.image_url}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}

        {/* Kicker */}
        <div className="kicker mb-2">{item.source}</div>

        {/* Headline */}
        <h2 className="headline-xl nyt-headline mb-2">
          {truncate(item.title, 160)}
        </h2>

        {/* Summary */}
        {item.ai_summary && (
          <p className="body-serif line-clamp-3 mb-2">
            {item.ai_summary}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 mt-2 text-[12px] text-[var(--color-text-tertiary)]">
          <span>{timeAgo(item.published_at)}</span>
          {item.cluster_size > 1 && (
            <span>{item.cluster_size} sources</span>
          )}
        </div>
      </motion.article>
    );
  }

  if (variant === "compact") {
    return (
      <motion.article
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.02, duration: 0.2 }}
        onClick={onClick}
        className={`cursor-pointer group nyt-hover py-3 border-b border-[var(--color-border)] ${
          isSelected ? "bg-[var(--color-bg-secondary)] -mx-2 px-2" : ""
        }`}
      >
        <h3 className="headline-sm nyt-headline mb-1">
          {truncate(item.title, 100)}
        </h3>
        <div className="text-[12px] text-[var(--color-text-tertiary)]">
          {timeAgo(item.published_at)}
        </div>
      </motion.article>
    );
  }

  // Standard variant
  return (
    <motion.article
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.02, duration: 0.2 }}
      onClick={onClick}
      className={`cursor-pointer group nyt-hover py-4 border-b border-[var(--color-border)] ${
        isSelected ? "bg-[var(--color-bg-secondary)] -mx-2 px-2" : ""
      }`}
    >
      <div className="flex gap-4">
        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="kicker mb-1.5">{item.source}</div>

          <h3 className="headline-md nyt-headline mb-1.5">
            {truncate(item.title, 120)}
          </h3>

          {item.ai_summary && (
            <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed line-clamp-2" style={{ fontFamily: "var(--font-body)" }}>
              {item.ai_summary}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-[12px] text-[var(--color-text-tertiary)]">
            <span>{timeAgo(item.published_at)}</span>
            {item.cluster_size > 1 && (
              <span>{item.cluster_size} sources</span>
            )}
            {item.score > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-12 h-[2px] bg-[var(--color-bg-tertiary)] overflow-hidden">
                  <motion.div
                    className="h-full bg-[var(--color-text-primary)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(item.score * 10, 100)}%` }}
                    transition={{ delay: index * 0.02 + 0.2, duration: 0.4 }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Thumbnail */}
        {item.image_url && (
          <div className="flex-shrink-0 w-[150px] h-[100px] overflow-hidden bg-[var(--color-bg-tertiary)]">
            <img
              src={item.image_url}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
      </div>
    </motion.article>
  );
}
