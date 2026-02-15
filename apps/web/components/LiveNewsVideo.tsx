"use client";

import { useMemo, useState } from "react";
import type { FeedItem } from "@/types";
import { timeAgo, truncate } from "@/lib/utils";

interface Props {
  items: FeedItem[];
  onSelectStory?: (id: number) => void;
}

interface LiveChannel {
  id: string;
  name: string;
  region: string;
  channelId: string;
}

const LIVE_CHANNELS: LiveChannel[] = [
  {
    id: "aljazeera",
    name: "Al Jazeera English",
    region: "Global",
    channelId: "UCNye-wNBqNL5ZzHSJj3l8Bg",
  },
  {
    id: "dw",
    name: "DW News",
    region: "Europe",
    channelId: "UCknLrEdhRCp1aegoMqRaCZg",
  },
  {
    id: "france24",
    name: "France 24 English",
    region: "Europe",
    channelId: "UCQfwfsi5VrQ8yKZ-UWmAEFg",
  },
  {
    id: "skynews",
    name: "Sky News",
    region: "UK",
    channelId: "UCoMdktPbSTixAyNGwb-UYkQ",
  },
];

function buildLiveEmbedURL(channelId: string) {
  const params = new URLSearchParams({
    channel: channelId,
    autoplay: "1",
    mute: "1",
    modestbranding: "1",
    rel: "0",
  });
  return `https://www.youtube-nocookie.com/embed/live_stream?${params.toString()}`;
}

export default function LiveNewsVideo({ items, onSelectStory }: Props) {
  const [channelId, setChannelId] = useState(LIVE_CHANNELS[0].id);

  const activeChannel = useMemo(
    () => LIVE_CHANNELS.find((channel) => channel.id === channelId) || LIVE_CHANNELS[0],
    [channelId]
  );

  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <div className="max-w-[1280px] mx-auto px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[12px] uppercase tracking-[0.18em] font-semibold text-[var(--color-text-secondary)]">
              Live News Video
            </h2>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-red-700">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              Live
            </span>
          </div>
          <a
            href={`https://www.youtube.com/channel/${activeChannel.channelId}/live`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] underline underline-offset-2"
          >
            Open in YouTube
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="space-y-3">
            <div className="aspect-video w-full overflow-hidden border border-[var(--color-border)] bg-black">
              <iframe
                title={`${activeChannel.name} live stream`}
                src={buildLiveEmbedURL(activeChannel.channelId)}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {LIVE_CHANNELS.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setChannelId(channel.id)}
                  className="px-2.5 py-1.5 text-[11px] border transition-colors"
                  style={{
                    borderColor:
                      channel.id === activeChannel.id ? "var(--color-text-primary)" : "var(--color-border)",
                    color:
                      channel.id === activeChannel.id
                        ? "var(--color-text-primary)"
                        : "var(--color-text-secondary)",
                    background: channel.id === activeChannel.id ? "white" : "transparent",
                  }}
                >
                  {channel.name}
                  <span className="ml-1 text-[var(--color-text-tertiary)]">· {channel.region}</span>
                </button>
              ))}
            </div>
          </div>

          <aside className="bg-white border border-[var(--color-border)]">
            <div className="px-3 py-2.5 border-b border-[var(--color-border)]">
              <h3 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[var(--color-text-tertiary)]">
                World Latest
              </h3>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {items.length === 0 && (
                <div className="p-3 text-[12px] text-[var(--color-text-tertiary)]">
                  Loading headlines...
                </div>
              )}

              {items.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectStory?.(item.id)}
                  className="w-full text-left px-3 py-2.5 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
                >
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] mb-1">
                    {item.source} · {timeAgo(item.published_at)}
                  </div>
                  <div className="text-[13px] leading-snug text-[var(--color-text-primary)]">
                    {truncate(item.title, 110)}
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
