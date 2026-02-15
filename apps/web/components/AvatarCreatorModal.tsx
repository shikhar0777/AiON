"use client";

import { useState, useEffect } from "react";
import type { HeyGenAvatar } from "@/types";
import { getHeyGenAvatars } from "@/lib/api";

interface AvatarCreatorModalProps {
  open: boolean;
  onClose: () => void;
}

const GENDER_STYLES: Record<string, { bg: string; ring: string; text: string; gradient: string }> = {
  female: {
    bg: "bg-gradient-to-br from-[#faf5ff] to-[#f3e8ff]",
    ring: "ring-[#a855f7]",
    text: "text-[#7c3aed]",
    gradient: "from-[#7c3aed] to-[#a855f7]",
  },
  male: {
    bg: "bg-gradient-to-br from-[#eff6ff] to-[#dbeafe]",
    ring: "ring-[#3b82f6]",
    text: "text-[#1d4ed8]",
    gradient: "from-[#1d4ed8] to-[#3b82f6]",
  },
  default: {
    bg: "bg-gradient-to-br from-[#f5f5f5] to-[#e5e5e5]",
    ring: "ring-[#525252]",
    text: "text-[#525252]",
    gradient: "from-[#525252] to-[#737373]",
  },
};

export default function AvatarCreatorModal({ open, onClose }: AvatarCreatorModalProps) {
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "male" | "female">("all");

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);

    if (avatars.length === 0) {
      setLoading(true);
      getHeyGenAvatars()
        .then((data) => {
          setAvatars(data.avatars);
          setIsDemo(data.demo);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open]);

  if (!open) return null;

  const filtered = filter === "all"
    ? avatars
    : avatars.filter((a) => a.gender === filter);

  const selectedAvatar = avatars.find((a) => a.avatar_id === selectedId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative bg-white w-full max-w-[680px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        style={{ borderRadius: 0 }}
      >
        {/* Header — dark */}
        <div className="bg-black text-white px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 flex items-center justify-center rounded-full">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
                </svg>
              </div>
              <div>
                <h2 className="text-[16px] font-bold tracking-tight">Choose Your Avatar</h2>
                <p className="text-[11px] text-white/50 mt-0.5">
                  Select a digital persona powered by HeyGen
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer rounded-full"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 mt-4">
            {(["all", "male", "female"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  filter === f
                    ? "bg-white text-black"
                    : "bg-white/10 text-white/60 hover:bg-white/15 hover:text-white/80"
                }`}
              >
                {f === "all" ? `All (${avatars.length})` : `${f} (${avatars.filter((a) => a.gender === f).length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Demo banner */}
        {isDemo && (
          <div className="px-6 py-2 bg-[#fffbeb] border-b border-[#fde68a] text-[11px] text-[#92400e] flex items-center gap-2 shrink-0">
            <span className="font-bold uppercase tracking-wider text-[9px] px-1.5 py-0.5 bg-[#f59e0b] text-white">
              DEMO
            </span>
            Showing demo avatars. Configure HeyGen API key for full library.
          </div>
        )}

        {/* Avatar Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square bg-[var(--color-bg-tertiary)] mb-2" />
                  <div className="h-3 bg-[var(--color-bg-tertiary)] w-3/4 mb-1" />
                  <div className="h-2.5 bg-[var(--color-bg-tertiary)] w-1/2" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-[var(--color-bg-secondary)] flex items-center justify-center rounded-full mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
                </svg>
              </div>
              <p className="text-[13px] text-[var(--color-text-secondary)] font-medium">No avatars found</p>
              <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                {filter !== "all" ? "Try selecting a different filter" : "Avatars are currently unavailable"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filtered.map((avatar) => {
                const isSelected = selectedId === avatar.avatar_id;
                const style = GENDER_STYLES[avatar.gender] || GENDER_STYLES.default;

                return (
                  <button
                    key={avatar.avatar_id}
                    onClick={() => setSelectedId(avatar.avatar_id)}
                    className={`relative group text-left transition-all duration-200 cursor-pointer overflow-hidden ${
                      isSelected
                        ? `ring-2 ${style.ring} shadow-lg scale-[1.02]`
                        : "hover:shadow-md hover:scale-[1.01] border border-[var(--color-border)]"
                    }`}
                  >
                    {/* Avatar image or placeholder */}
                    {avatar.preview_image_url ? (
                      <div className="aspect-square overflow-hidden bg-[var(--color-bg-secondary)]">
                        <img
                          src={avatar.preview_image_url}
                          alt={avatar.avatar_name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                      </div>
                    ) : (
                      <div className={`aspect-square flex items-center justify-center ${style.bg} relative overflow-hidden`}>
                        {/* Decorative circles */}
                        <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10" />
                        <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/8" />
                        <span className={`text-[36px] font-bold ${style.text} relative z-[1] drop-shadow-sm`}>
                          {avatar.avatar_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Info bar */}
                    <div className="px-2.5 py-2 bg-white">
                      <div className="text-[12px] font-semibold text-[var(--color-text-primary)] truncate leading-tight">
                        {avatar.avatar_name}
                      </div>
                      {avatar.gender && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${style.gradient}`} />
                          <span className="text-[10px] text-[var(--color-text-tertiary)] capitalize">
                            {avatar.gender}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Selected check overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-black/10 pointer-events-none" />
                    )}
                    {isSelected && (
                      <div className={`absolute top-2 right-2 w-6 h-6 bg-gradient-to-br ${style.gradient} text-white flex items-center justify-center shadow-md`}
                        style={{ borderRadius: "50%" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.5 6l2.5 2.5 4.5-5" />
                        </svg>
                      </div>
                    )}

                    {/* Hover overlay */}
                    {!isSelected && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with selection preview */}
        <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          {/* Selected avatar preview */}
          {selectedAvatar && (
            <div className="px-6 py-3 flex items-center gap-3 border-b border-[var(--color-border)] bg-white">
              <div className="w-10 h-10 overflow-hidden bg-[var(--color-bg-secondary)] shrink-0 rounded-full border border-[var(--color-border)]">
                {selectedAvatar.preview_image_url ? (
                  <img src={selectedAvatar.preview_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${(GENDER_STYLES[selectedAvatar.gender] || GENDER_STYLES.default).bg}`}>
                    <span className={`text-[16px] font-bold ${(GENDER_STYLES[selectedAvatar.gender] || GENDER_STYLES.default).text}`}>
                      {selectedAvatar.avatar_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
                  {selectedAvatar.avatar_name}
                </div>
                <div className="text-[10px] text-[var(--color-text-tertiary)]">
                  Selected avatar
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between px-6 py-3">
            <button
              onClick={onClose}
              className="px-5 py-2 text-[12px] font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={onClose}
              disabled={!selectedId}
              className={`px-6 py-2 text-[12px] font-semibold transition-all ${
                selectedId
                  ? "bg-black text-white hover:bg-[#333] cursor-pointer shadow-sm"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] cursor-not-allowed"
              }`}
            >
              Select Avatar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
