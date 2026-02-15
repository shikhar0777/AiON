"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { StoryIntelligence, ExplainResponse } from "@/types";
import { getStory, getExplanation, translateTexts } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { LANGUAGES } from "./Header";
import ChatSection from "./ChatSection";
import MarketDashboard from "./MarketDashboard";

interface Props {
  articleId: number | null;
  onClose: () => void;
  language: string;
}

type AITab = "summary" | "analysis" | "chat" | "deep-explain";

interface TranslatedContent {
  title: string;
  summary: string;
  keyPoints: string[];
  whyTrending: string;
  explanation: string;
  explainKeyPoints: string[];
  sourceHeadlines: string[];
  sourceAngles: string[];
  timelineEvents: string[];
  explainTimelineEvents: string[];
  relatedTitles: string[];
  tags: string[];
  entityValues: string[];
}

export default function StoryPanel({ articleId, onClose, language }: Props) {
  const [story, setStory] = useState<StoryIntelligence | null>(null);
  const [explain, setExplain] = useState<ExplainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AITab>("summary");
  const [showAllAngles, setShowAllAngles] = useState(false);
  const [translated, setTranslated] = useState<TranslatedContent | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translatedLang, setTranslatedLang] = useState("en");

  useEffect(() => {
    if (!articleId) {
      setStory(null);
      setExplain(null);
      setTranslated(null);
      setActiveTab("summary");
      return;
    }

    setLoading(true);
    setExplain(null);
    setTranslated(null);
    setShowAllAngles(false);
    setActiveTab("summary");
    getStory(articleId)
      .then(setStory)
      .catch(() => setStory(null))
      .finally(() => setLoading(false));
  }, [articleId]);

  // Auto-trigger Deep Explain when story loads
  useEffect(() => {
    if (story?.cluster?.cluster_id && !explain && !explainLoading) {
      setExplainLoading(true);
      getExplanation(story.cluster.cluster_id)
        .then(setExplain)
        .catch(() => {})
        .finally(() => setExplainLoading(false));
    }
  }, [story?.cluster?.cluster_id]);

  // Translate ALL content when language changes
  useEffect(() => {
    if (!story || language === "en") {
      setTranslated(null);
      setTranslatedLang("en");
      return;
    }
    if (translatedLang === language && translated) return;

    const langName = LANGUAGES.find((l) => l.code === language)?.name || language;

    // Collect ALL translatable text into a single batch
    const batch: string[] = [];
    const idx = { i: 0 };
    const mark = () => idx.i++;
    const push = (s: string) => { batch.push(s); return mark(); };

    // Core fields
    const titleIdx = push(story.article.title);
    const summaryIdx = push(story.ai_summary || "");
    const kpStart = idx.i;
    (story.key_points || []).forEach((p) => push(p));
    const kpEnd = idx.i;
    const whyTrendingIdx = push(story.why_trending || "");

    // Source angles
    const anglesHStart = idx.i;
    story.source_angles.forEach((a) => push(a.headline));
    const anglesHEnd = idx.i;
    const anglesAStart = idx.i;
    story.source_angles.forEach((a) => push(a.angle || ""));
    const anglesAEnd = idx.i;

    // Story timeline
    const tlStart = idx.i;
    (story.timeline || []).forEach((e) => push(e.event));
    const tlEnd = idx.i;

    // Related article titles
    const relStart = idx.i;
    story.related_articles.slice(0, 5).forEach((r) => push(r.title));
    const relEnd = idx.i;

    // Tags
    const tagsStart = idx.i;
    (story.cluster?.tags_json || []).forEach((t) => push(t));
    const tagsEnd = idx.i;

    // Entity values (flatten all entity arrays)
    const entStart = idx.i;
    const allEntityValues: string[] = [];
    if (story.entities) {
      Object.values(story.entities).forEach((vals) => {
        (vals as string[]).forEach((v) => { allEntityValues.push(v); push(v); });
      });
    }
    const entEnd = idx.i;

    // Deep explain content
    const explainIdx = push(explain?.explanation || "");
    const ekpStart = idx.i;
    (explain?.key_points || []).forEach((p) => push(p));
    const ekpEnd = idx.i;
    const etlStart = idx.i;
    (explain?.timeline || []).forEach((e) => push(e.event));
    const etlEnd = idx.i;

    setTranslating(true);
    translateTexts(batch, langName)
      .then((resp) => {
        const r = resp.translations;
        setTranslated({
          title: r[titleIdx] || story.article.title,
          summary: r[summaryIdx] || story.ai_summary || "",
          keyPoints: r.slice(kpStart, kpEnd),
          whyTrending: r[whyTrendingIdx] || "",
          sourceHeadlines: r.slice(anglesHStart, anglesHEnd),
          sourceAngles: r.slice(anglesAStart, anglesAEnd),
          timelineEvents: r.slice(tlStart, tlEnd),
          relatedTitles: r.slice(relStart, relEnd),
          tags: r.slice(tagsStart, tagsEnd),
          entityValues: r.slice(entStart, entEnd),
          explanation: r[explainIdx] || "",
          explainKeyPoints: r.slice(ekpStart, ekpEnd),
          explainTimelineEvents: r.slice(etlStart, etlEnd),
        });
        setTranslatedLang(language);
      })
      .catch(() => {})
      .finally(() => setTranslating(false));
  }, [language, story, explain]);

  // Helper to get display text (translated or original)
  const useTranslated = language !== "en" && translated;
  const t = {
    title: (useTranslated && translated.title) || story?.article.title || "",
    summary: (useTranslated && translated.summary) || story?.ai_summary || "",
    keyPoints: (useTranslated && translated.keyPoints?.length) ? translated.keyPoints : (story?.key_points || []),
    whyTrending: (useTranslated && translated.whyTrending) || story?.why_trending || "",
    explanation: (useTranslated && translated.explanation) || explain?.explanation || "",
    explainKeyPoints: (useTranslated && translated.explainKeyPoints?.length) ? translated.explainKeyPoints : (explain?.key_points || []),
    sourceHeadlines: (useTranslated && translated.sourceHeadlines?.length) ? translated.sourceHeadlines : (story?.source_angles.map((a) => a.headline) || []),
    sourceAngles: (useTranslated && translated.sourceAngles?.length) ? translated.sourceAngles : (story?.source_angles.map((a) => a.angle) || []),
    timelineEvents: (useTranslated && translated.timelineEvents?.length) ? translated.timelineEvents : (story?.timeline?.map((e) => e.event) || []),
    explainTimelineEvents: (useTranslated && translated.explainTimelineEvents?.length) ? translated.explainTimelineEvents : (explain?.timeline?.map((e) => e.event) || []),
    relatedTitles: (useTranslated && translated.relatedTitles?.length) ? translated.relatedTitles : (story?.related_articles.slice(0, 5).map((r) => r.title) || []),
    tags: (useTranslated && translated.tags?.length) ? translated.tags : (story?.cluster?.tags_json || []),
    entityValues: (useTranslated && translated.entityValues) || null,
  };

  const isTranslated = language !== "en" && translated && !translating;
  const langName = LANGUAGES.find((l) => l.code === language)?.name || "";

  /* ── Empty state — show market dashboard ─────────────────── */
  if (!articleId) {
    return <MarketDashboard />;
  }

  /* ── Loading state ───────────────────────────────────────── */
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-6 h-6 border-2 border-[var(--color-text-primary)] border-t-transparent rounded-full mx-auto mb-3"
          />
          <span className="text-[13px] text-[var(--color-text-tertiary)]">Loading story...</span>
        </div>
      </div>
    );
  }

  /* ── Error state ─────────────────────────────────────────── */
  if (!story) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-secondary)] text-sm p-6 text-center">
        Failed to load story details.
        <br />
        <button onClick={onClose} className="underline underline-offset-2 mt-2 text-[var(--color-text-primary)]">
          Go back
        </button>
      </div>
    );
  }

  /* ── Story content ───────────────────────────────────────── */
  return (
    <motion.div
      key={articleId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="h-full flex flex-col"
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-[var(--color-border)] bg-white sticky top-0 z-10 shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Close
        </button>
        <a
          href={story.article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] text-[var(--color-text-secondary)] underline underline-offset-2 hover:text-[var(--color-text-primary)]"
        >
          Read original &rarr;
        </a>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        {/* Hero image */}
        {story.article.image_url && (
          <div className="relative w-full aspect-[16/9] overflow-hidden bg-[var(--color-bg-tertiary)]">
            <img
              src={story.article.image_url}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}

        {/* Translation indicator */}
        {translating && (
          <div className="flex items-center gap-2 px-5 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-3 h-3 border-[1.5px] border-[var(--color-text-primary)] border-t-transparent rounded-full"
            />
            <span className="text-[11px] text-[var(--color-text-secondary)]">
              Translating to {langName}...
            </span>
          </div>
        )}
        {isTranslated && (
          <div className="flex items-center gap-2 px-5 py-1.5 bg-[#eef2ff] border-b border-[#c7d2fe]">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#4f46e5" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6.5" />
              <path d="M1.5 8h13M8 1.5c-2 2.5-2 10.5 0 13M8 1.5c2 2.5 2 10.5 0 13" />
            </svg>
            <span className="text-[11px] text-[#4338ca] font-medium">
              Translated to {langName}
            </span>
          </div>
        )}

        {/* Article header */}
        <div className="px-5 pt-5 pb-4">
          <div className="kicker mb-2">{story.article.source}</div>
          <h2
            className="font-bold mb-3 leading-snug"
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(22px, 3vw, 30px)",
              letterSpacing: "-0.015em",
            }}
          >
            {t.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--color-text-tertiary)]">
            {story.article.published_at && (
              <span>{timeAgo(story.article.published_at)}</span>
            )}
            {story.cluster && (
              <>
                <span>&middot;</span>
                <span>{story.cluster.article_count} articles</span>
                <span>&middot;</span>
                <span>{story.cluster.sources.length} sources</span>
              </>
            )}
          </div>

          {/* Tags */}
          {t.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {t.tags.map((tag, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <hr className="rule-strong mx-5" />

        {/* ── AI Tabs ── */}
        <div className="ai-tabs mx-5 mt-0">
          <button
            className={`ai-tab ${activeTab === "summary" ? "active" : ""}`}
            onClick={() => setActiveTab("summary")}
          >
            <span className="provider-dot claude" />
            Summary
          </button>
          <button
            className={`ai-tab ${activeTab === "analysis" ? "active" : ""}`}
            onClick={() => setActiveTab("analysis")}
          >
            <span className="provider-dot openai" />
            Analysis
          </button>
          <button
            className={`ai-tab ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            <span className="provider-dot claude" />
            Ask AI
          </button>
          <button
            className={`ai-tab ${activeTab === "deep-explain" ? "active" : ""}`}
            onClick={() => setActiveTab("deep-explain")}
          >
            <span className="provider-dot perplexity" />
            Deep Explain
          </button>
        </div>

        {/* ── Tab content ── */}
        <div className="px-5 py-5">
          <AnimatePresence mode="wait">
            {/* SUMMARY (Claude) */}
            {activeTab === "summary" && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.12 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="provider-badge claude">Claude</span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">AI-generated summary</span>
                </div>

                {t.summary ? (
                  <p className="body-serif mb-5">{t.summary}</p>
                ) : (
                  <p className="text-[14px] text-[var(--color-text-tertiary)] italic">
                    Summary not yet available for this article.
                  </p>
                )}

                {t.keyPoints.length > 0 && (
                  <div className="mt-5">
                    <h4 className="kicker mb-3">Key Points</h4>
                    <div className="space-y-2.5">
                      {t.keyPoints.map((point, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex gap-2.5"
                        >
                          <span className="w-5 h-5 flex items-center justify-center bg-[var(--color-bg-inverse)] text-white text-[10px] font-bold rounded-full shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                            {point}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {story.entities && Object.keys(story.entities).length > 0 && (
                  <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
                    <h4 className="kicker mb-3">Entities</h4>
                    <div className="space-y-3">
                      {(() => {
                        let globalIdx = 0;
                        return Object.entries(story.entities!).map(([type, items]) => (
                          <div key={type}>
                            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] font-semibold">
                              {type}
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(items as string[]).map((item, i) => {
                                const displayVal = t.entityValues ? (t.entityValues[globalIdx] || item) : item;
                                globalIdx++;
                                return (
                                  <span
                                    key={`${type}-${i}`}
                                    className="text-[11px] px-2 py-0.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                                  >
                                    {displayVal}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ANALYSIS (OpenAI) */}
            {activeTab === "analysis" && (
              <motion.div
                key="analysis"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.12 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="provider-badge openai">GPT-4o</span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">Trending analysis</span>
                </div>

                {t.whyTrending ? (
                  <div className="mb-5 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                    <h4 className="kicker mb-2">Why This Is Trending</h4>
                    <p
                      className="text-[14px] text-[var(--color-text-primary)] italic leading-relaxed"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      &ldquo;{t.whyTrending}&rdquo;
                    </p>
                  </div>
                ) : (
                  <p className="text-[14px] text-[var(--color-text-tertiary)] italic mb-5">
                    Trending analysis not yet available.
                  </p>
                )}

                {story.source_angles.length > 0 && (
                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="kicker">
                        {story.source_angles.length} Source Angles
                      </h4>
                      {story.source_angles.length > 3 && (
                        <button
                          onClick={() => setShowAllAngles(!showAllAngles)}
                          className="text-[11px] text-[var(--color-text-secondary)] underline underline-offset-2 hover:text-[var(--color-text-primary)]"
                        >
                          {showAllAngles ? "Less" : "All"}
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {(showAllAngles ? story.source_angles : story.source_angles.slice(0, 3)).map(
                        (angle, i) => (
                          <div key={i} className="pl-3 border-l-2 border-[var(--color-border)]">
                            <div className="kicker mb-0.5">{angle.source}</div>
                            <div className="headline-sm text-[14px]">{t.sourceHeadlines[i] || angle.headline}</div>
                            {(t.sourceAngles[i] || angle.angle) && (
                              <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">
                                {t.sourceAngles[i] || angle.angle}
                              </p>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {story.cluster && (
                  <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wider mb-0.5">
                          Score
                        </div>
                        <div className="text-[24px] font-bold" style={{ fontFamily: "var(--font-headline)" }}>
                          {story.cluster.score.toFixed(1)}
                        </div>
                      </div>
                      <div className="flex-1 h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-[var(--color-bg-inverse)] rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(story.cluster.score * 10, 100)}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* CHAT (Claude) */}
            {activeTab === "chat" && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.12 }}
              >
                <ChatSection articleId={articleId} storyTitle={story.article.title} language={language} />
              </motion.div>
            )}

            {/* DEEP EXPLAIN (Perplexity) */}
            {activeTab === "deep-explain" && (
              <motion.div
                key="deep-explain"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.12 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="provider-badge perplexity">Perplexity</span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">Deep research</span>
                </div>

                {explainLoading && (
                  <div className="flex items-center gap-3 py-6">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="w-4 h-4 border-2 border-[var(--color-text-primary)] border-t-transparent rounded-full"
                    />
                    <span className="text-[13px] text-[var(--color-text-secondary)]">
                      Researching this story...
                    </span>
                  </div>
                )}

                {!explainLoading && !explain && !story.cluster?.cluster_id && (
                  <p className="text-[13px] text-[var(--color-text-tertiary)] italic">
                    Deep analysis is not available for unclustered articles.
                  </p>
                )}

                {!explainLoading && !explain && story.cluster?.cluster_id && (
                  <p className="text-[13px] text-[var(--color-text-tertiary)] italic">
                    Could not load analysis. Try refreshing.
                  </p>
                )}

                {explain && (
                  <div className="space-y-5">
                    <div className="body-serif whitespace-pre-line text-[14px]">
                      {t.explanation}
                    </div>

                    {t.explainKeyPoints.length > 0 && (
                      <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                        <h4 className="kicker mb-2">Key Takeaways</h4>
                        <ul className="space-y-2">
                          {t.explainKeyPoints.map((point, i) => (
                            <li key={i} className="flex gap-2 text-[13px] text-[var(--color-text-secondary)]">
                              <span className="w-4 h-4 flex items-center justify-center bg-[var(--color-bg-inverse)] text-white text-[9px] font-bold rounded-full shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <span className="leading-relaxed">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {explain.timeline.length > 0 && (
                      <div>
                        <h4 className="kicker mb-3">Timeline</h4>
                        <div className="space-y-0">
                          {explain.timeline.map((event, i) => (
                            <div key={i} className="flex gap-2.5 relative pb-5 last:pb-0">
                              {i < explain.timeline.length - 1 && (
                                <div className="timeline-line" />
                              )}
                              <div className="timeline-dot" style={{ width: 12, height: 12, borderWidth: 2 }} />
                              <div className="pt-0">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                                  {event.time}
                                </div>
                                <div className="text-[13px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                                  {t.explainTimelineEvents[i] || event.event}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {explain.sources.length > 0 && (
                      <div className="pt-4 border-t border-[var(--color-border)]">
                        <h4 className="kicker mb-2">Sources</h4>
                        <div className="space-y-1">
                          {explain.sources.map((src, i) => (
                            <a
                              key={i}
                              href={src.startsWith("http") ? src : undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                            >
                              <span className="text-[var(--color-text-tertiary)] text-[10px]">[{i + 1}]</span>
                              <span className="underline underline-offset-2 truncate">{src}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Related Articles */}
        {story.related_articles.length > 0 && (
          <div className="px-5 pb-4">
            <hr className="rule mb-4" />
            <h4 className="kicker mb-3">More on This Story</h4>
            {story.related_articles.slice(0, 5).map((rel, i) => (
              <a
                key={rel.id}
                href={rel.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block py-2.5 border-b border-[var(--color-border)] last:border-b-0 group nyt-hover"
              >
                <div className="headline-sm nyt-headline text-[13px]">{t.relatedTitles[i] || rel.title}</div>
                <div className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                  {rel.source} &middot; {timeAgo(rel.published_at)}
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-5 border-t border-[var(--color-border)] mt-2">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] text-[var(--color-text-tertiary)]">Powered by</span>
            <span className="provider-badge claude">Claude</span>
            <span className="provider-badge openai">GPT-4o</span>
            <span className="provider-badge perplexity">Perplexity</span>
          </div>
          <p className="text-[10px] text-[var(--color-text-tertiary)]">
            AI-generated content may contain inaccuracies.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
