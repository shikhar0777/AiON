"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { FXRatesResponse, SpendInsightsResponse, PaymentVolumeResponse, FeedItem } from "@/types";
import { getVisaFXRates, getVisaSpendInsights, getVisaPaymentVolume, getVisaStatus, getFeed } from "@/lib/api";
import { timeAgo, truncate } from "@/lib/utils";

// ── TradingView Ticker Tape ─────────────────────────────────────
function TickerTape() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.async = true;
    script.type = "text/javascript";
    script.textContent = JSON.stringify({
      symbols: [
        { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
        { proName: "FOREXCOM:NSXUSD", title: "Nasdaq" },
        { proName: "INDEX:DXY", title: "US Dollar" },
        { proName: "BITSTAMP:BTCUSD", title: "Bitcoin" },
        { proName: "BITSTAMP:ETHUSD", title: "Ethereum" },
        { proName: "COMEX:GC1!", title: "Gold" },
        { proName: "NYMEX:CL1!", title: "Crude Oil" },
      ],
      showSymbolLogo: false,
      isTransparent: true,
      displayMode: "compact",
      colorTheme: "light",
      locale: "en",
    });

    containerRef.current.appendChild(script);
  }, []);

  return (
    <div ref={containerRef} className="tradingview-widget-container overflow-hidden" />
  );
}

// ── TradingView Market Overview widget ──────────────────────────
function MarketOverview() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
    script.async = true;
    script.type = "text/javascript";
    script.textContent = JSON.stringify({
      colorTheme: "light",
      dateRange: "1D",
      showChart: true,
      locale: "en",
      largeChartUrl: "",
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: false,
      width: "100%",
      height: 500,
      plotLineColorGrowing: "rgba(17, 17, 17, 1)",
      plotLineColorFalling: "rgba(17, 17, 17, 0.4)",
      gridLineColor: "rgba(240, 240, 240, 1)",
      scaleFontColor: "rgba(120, 120, 120, 1)",
      belowLineFillColorGrowing: "rgba(17, 17, 17, 0.04)",
      belowLineFillColorFalling: "rgba(17, 17, 17, 0.02)",
      belowLineFillColorGrowingBottom: "rgba(255, 255, 255, 0)",
      belowLineFillColorFallingBottom: "rgba(255, 255, 255, 0)",
      symbolActiveColor: "rgba(240, 240, 240, 1)",
      tabs: [
        {
          title: "Indices",
          symbols: [
            { s: "FOREXCOM:SPXUSD", d: "S&P 500" },
            { s: "FOREXCOM:NSXUSD", d: "Nasdaq" },
            { s: "FOREXCOM:DJI", d: "Dow Jones" },
            { s: "INDEX:NKY", d: "Nikkei 225" },
            { s: "INDEX:DEU40", d: "DAX" },
            { s: "FOREXCOM:UKXGBP", d: "FTSE 100" },
          ],
        },
        {
          title: "Crypto",
          symbols: [
            { s: "BITSTAMP:BTCUSD", d: "Bitcoin" },
            { s: "BITSTAMP:ETHUSD", d: "Ethereum" },
            { s: "BINANCE:SOLUSDT", d: "Solana" },
            { s: "BINANCE:XRPUSDT", d: "XRP" },
          ],
        },
        {
          title: "Commodities",
          symbols: [
            { s: "TVC:GOLD", d: "Gold" },
            { s: "TVC:SILVER", d: "Silver" },
            { s: "TVC:USOIL", d: "WTI Crude Oil" },
            { s: "TVC:UKOIL", d: "Brent Crude" },
            { s: "TVC:PLATINUM", d: "Platinum" },
            { s: "TVC:COPPER", d: "Copper" },
          ],
        },
        {
          title: "Forex",
          symbols: [
            { s: "FX:EURUSD", d: "EUR/USD" },
            { s: "FX:GBPUSD", d: "GBP/USD" },
            { s: "FX:USDJPY", d: "USD/JPY" },
            { s: "INDEX:DXY", d: "US Dollar Index" },
          ],
        },
      ],
    });

    containerRef.current.appendChild(script);
  }, []);

  return (
    <div ref={containerRef} className="tradingview-widget-container overflow-hidden" />
  );
}

// ── Directional Arrow ───────────────────────────────────────────
function Arrow({ value }: { value: number }) {
  if (value > 0) return <span className="text-green-700">&#9650; +{value.toFixed(1)}%</span>;
  if (value < 0) return <span className="text-red-700">&#9660; {value.toFixed(1)}%</span>;
  return <span className="text-[var(--color-text-tertiary)]">&#8212; 0.0%</span>;
}

// ── Demo Badge ──────────────────────────────────────────────────
function DemoBadge({ demo }: { demo: boolean }) {
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
      style={{
        background: demo ? "var(--color-bg-secondary)" : "#e8f5e9",
        color: demo ? "var(--color-text-secondary)" : "#2e7d32",
      }}
    >
      {demo ? "Demo Data" : "Visa Sandbox"}
    </span>
  );
}

// ── FX Rates Tab ────────────────────────────────────────────────
function FXRatesTab({ data }: { data: FXRatesResponse }) {
  const baseAmount = 100;
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {data.source} Foreign Exchange Rates
        </span>
        <DemoBadge demo={data.demo} />
      </div>
      <table className="w-full text-[13px]" style={{ fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr className="text-left text-[11px] text-[var(--color-text-tertiary)] uppercase tracking-wider border-b border-[var(--color-border)]">
            <th className="pb-2 font-medium">Currency</th>
            <th className="pb-2 font-medium text-right">Rate</th>
            <th className="pb-2 font-medium text-right">{data.source} {baseAmount}</th>
          </tr>
        </thead>
        <tbody>
          {data.rates.map((r) => (
            <tr key={r.currency} className="border-b border-[var(--color-border)]" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              <td className="py-2">
                <span className="font-semibold">{r.currency}</span>
                <span className="text-[var(--color-text-tertiary)] ml-1.5">{r.name}</span>
              </td>
              <td className="py-2 text-right">{r.rate < 1 ? r.rate.toFixed(4) : r.rate.toFixed(2)}</td>
              <td className="py-2 text-right font-medium">
                {(baseAmount * r.rate) < 1
                  ? (baseAmount * r.rate).toFixed(4)
                  : (baseAmount * r.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Spend Insights Tab ──────────────────────────────────────────
function SpendInsightsTab({ data }: { data: SpendInsightsResponse }) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Consumer Spending — {data.country}
        </span>
        <DemoBadge demo={data.demo} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {data.insights.map((ins) => (
          <div
            key={ins.category}
            className="border border-[var(--color-border)] p-3"
          >
            <div className="text-[13px] font-semibold mb-2">{ins.category}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
              <div className="text-[var(--color-text-tertiary)]">Sales MoM</div>
              <div className="text-right"><Arrow value={ins.sales_mom} /></div>
              <div className="text-[var(--color-text-tertiary)]">Sales YoY</div>
              <div className="text-right"><Arrow value={ins.sales_yoy} /></div>
              <div className="text-[var(--color-text-tertiary)]">Txn MoM</div>
              <div className="text-right"><Arrow value={ins.txn_mom} /></div>
              <div className="text-[var(--color-text-tertiary)]">Txn YoY</div>
              <div className="text-right"><Arrow value={ins.txn_yoy} /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Payment Volume Tab ──────────────────────────────────────────
function PaymentVolumeTab({ data }: { data: PaymentVolumeResponse }) {
  const maxVol = Math.max(...data.months.map((m) => m.volume_trillions));
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Global Payment Volume
        </span>
        <DemoBadge demo={data.demo} />
      </div>
      <div className="space-y-2">
        {data.months.map((m) => {
          const pct = (m.volume_trillions / maxVol) * 100;
          return (
            <div key={m.month} className="flex items-center gap-3 text-[13px]" style={{ fontVariantNumeric: "tabular-nums" }}>
              <span className="w-[72px] shrink-0 text-[var(--color-text-secondary)]">{m.month}</span>
              <div className="flex-1 h-6 bg-[var(--color-bg-secondary)] relative">
                <div
                  className="h-full bg-black transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-[80px] text-right font-medium">${m.volume_trillions.toFixed(2)}T</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Loading / Error states ──────────────────────────────────────
function TabLoading() {
  return (
    <div className="px-5 py-12 text-center text-[13px] text-[var(--color-text-tertiary)]">
      Loading Visa data&hellip;
    </div>
  );
}

function TabError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-[13px] text-red-700 mb-2">{message}</p>
      <button onClick={onRetry} className="text-[12px] underline">
        Retry
      </button>
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────
type Tab = "overview" | "fx" | "spending" | "volume";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "fx", label: "Visa FX" },
  { id: "spending", label: "Spending" },
  { id: "volume", label: "Volume" },
];

// Category visual config for trending section
const TRENDING_CATEGORY_STYLES: Record<string, { gradient: string; icon: string }> = {
  technology: { gradient: "from-blue-900 to-blue-700", icon: "M4 3h8v10H4zM6 1v2M10 1v2" },
  politics:   { gradient: "from-emerald-900 to-emerald-700", icon: "M8 1v14M4 5h8M3 9h10" },
  sports:     { gradient: "from-purple-900 to-purple-700", icon: "M8 2L3 7h3v5h4V7h3L8 2z" },
  world:      { gradient: "from-slate-800 to-slate-600", icon: "M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM1.5 8h13" },
  science:    { gradient: "from-indigo-900 to-indigo-700", icon: "M8 2a3 3 0 100 6 3 3 0 000-6zM5 12a5 5 0 0110 0" },
  health:     { gradient: "from-teal-900 to-teal-700", icon: "M8 3v10M3 8h10" },
  entertainment: { gradient: "from-pink-900 to-pink-700", icon: "M8 2a6 6 0 100 12A6 6 0 008 2zM8 5v3l2 2" },
  ai:         { gradient: "from-amber-900 to-amber-700", icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5" },
};

interface LiveChannel {
  id: string;
  name: string;
  channelId: string;
}

const LIVE_CHANNELS: LiveChannel[] = [
  { id: "aljazeera", name: "Al Jazeera", channelId: "UCNye-wNBqNL5ZzHSJj3l8Bg" },
  { id: "dw", name: "DW News", channelId: "UCknLrEdhRCp1aegoMqRaCZg" },
  { id: "france24", name: "France 24", channelId: "UCQfwfsi5VrQ8yKZ-UWmAEFg" },
  { id: "skynews", name: "Sky News", channelId: "UCoMdktPbSTixAyNGwb-UYkQ" },
];

function getLiveStreamEmbedUrl(channelId: string): string {
  const params = new URLSearchParams({
    channel: channelId,
    autoplay: "1",
    mute: "1",
    rel: "0",
    modestbranding: "1",
  });
  return `https://www.youtube-nocookie.com/embed/live_stream?${params.toString()}`;
}

function formatCategoryLabel(category: string): string {
  return category
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// ── Main Component ──────────────────────────────────────────────
export default function MarketDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [visaConfigured, setVisaConfigured] = useState(false);

  // Lazy-loaded data per tab
  const [fxData, setFxData] = useState<FXRatesResponse | null>(null);
  const [spendData, setSpendData] = useState<SpendInsightsResponse | null>(null);
  const [volumeData, setVolumeData] = useState<PaymentVolumeResponse | null>(null);

  const [loading, setLoading] = useState<Tab | null>(null);
  const [error, setError] = useState<{ tab: Tab; message: string } | null>(null);
  const [marketNews, setMarketNews] = useState<FeedItem[]>([]);
  const [marketNewsLoading, setMarketNewsLoading] = useState(true);
  const [categoryNews, setCategoryNews] = useState<Record<string, FeedItem[]>>({});
  const [categoryNewsLoading, setCategoryNewsLoading] = useState(true);
  const [liveChannelId, setLiveChannelId] = useState(LIVE_CHANNELS[0].id);

  // Check Visa status once
  useEffect(() => {
    getVisaStatus().then((s) => setVisaConfigured(s.configured)).catch(() => {});
  }, []);

  const loadTab = useCallback(async (t: Tab) => {
    if (t === "overview") return;
    if (t === "fx" && fxData) return;
    if (t === "spending" && spendData) return;
    if (t === "volume" && volumeData) return;

    setLoading(t);
    setError(null);
    try {
      if (t === "fx") setFxData(await getVisaFXRates());
      else if (t === "spending") setSpendData(await getVisaSpendInsights());
      else if (t === "volume") setVolumeData(await getVisaPaymentVolume());
    } catch (e) {
      setError({ tab: t, message: e instanceof Error ? e.message : "Failed to load data" });
    } finally {
      setLoading(null);
    }
  }, [fxData, spendData, volumeData]);

  const loadMarketNews = useCallback(async (silent = false) => {
    if (!silent) setMarketNewsLoading(true);
    try {
      const [business, economy, finance] = await Promise.all([
        getFeed("", "business", "latest", 0, 8),
        getFeed("", "economy", "latest", 0, 8),
        getFeed("", "finance", "latest", 0, 8),
      ]);

      const seen = new Set<string>();
      const merged = [...business.items, ...economy.items, ...finance.items]
        .filter((item) => {
          const key = `${item.url}|${item.title}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => {
          const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
          const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 14);

      setMarketNews(merged);
    } catch {
      // Keep previous news set if refresh fails
    } finally {
      if (!silent) setMarketNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarketNews();
  }, [loadMarketNews]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadMarketNews(true);
    }, 120000);
    return () => clearInterval(interval);
  }, [loadMarketNews]);

  // Fetch trending stories for multiple categories
  const loadCategoryNews = useCallback(async () => {
    setCategoryNewsLoading(true);
    const cats = ["technology", "politics", "sports", "world", "science", "health", "entertainment", "ai"];
    try {
      const results = await Promise.allSettled(
        cats.map((cat) => getFeed("", cat, "trending", 0, 3))
      );
      const newData: Record<string, FeedItem[]> = {};
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value.items.length > 0) {
          newData[cats[i]] = r.value.items;
        }
      });
      setCategoryNews(newData);
    } catch {
      // keep existing
    } finally {
      setCategoryNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategoryNews();
  }, [loadCategoryNews]);

  const handleTabClick = (t: Tab) => {
    setTab(t);
    loadTab(t);
  };

  const handleRetry = () => {
    if (error) {
      // Clear cached data so loadTab refetches
      if (error.tab === "fx") setFxData(null);
      if (error.tab === "spending") setSpendData(null);
      if (error.tab === "volume") setVolumeData(null);
      setError(null);
    }
    // Need to trigger loadTab after state clears
    setTimeout(() => loadTab(tab), 0);
  };

  const categoryEntries = Object.entries(categoryNews);
  const activeLiveChannel = LIVE_CHANNELS.find((c) => c.id === liveChannelId) ?? LIVE_CHANNELS[0];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[var(--color-border)] shrink-0 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-[15px]" style={{ fontFamily: "var(--font-headline)" }}>
            Markets
          </h3>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
            Live data &middot; Select a headline to read AI analysis
          </p>
        </div>
        {tab !== "overview" && (
          <DemoBadge demo={!visaConfigured} />
        )}
      </div>

      {/* Ticker tape */}
      <div className="border-b border-[var(--color-border)] shrink-0 overflow-hidden">
        <TickerTape />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[var(--color-border)] shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTabClick(t.id)}
            className="px-4 py-2 text-[12px] font-medium transition-colors relative"
            style={{
              color: tab === t.id ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
            }}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-black" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "overview" && <MarketOverview />}

        {tab === "fx" && (
          loading === "fx" ? <TabLoading /> :
          error?.tab === "fx" ? <TabError message={error.message} onRetry={handleRetry} /> :
          fxData ? <FXRatesTab data={fxData} /> : <TabLoading />
        )}

        {tab === "spending" && (
          loading === "spending" ? <TabLoading /> :
          error?.tab === "spending" ? <TabError message={error.message} onRetry={handleRetry} /> :
          spendData ? <SpendInsightsTab data={spendData} /> : <TabLoading />
        )}

        {tab === "volume" && (
          loading === "volume" ? <TabLoading /> :
          error?.tab === "volume" ? <TabError message={error.message} onRetry={handleRetry} /> :
          volumeData ? <PaymentVolumeTab data={volumeData} /> : <TabLoading />
        )}

        {/* Fill lower area with market headlines */}
        <div className="border-t border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Latest Market News
            </h4>
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              Business · Economy · Finance
            </span>
          </div>

          {marketNewsLoading && marketNews.length === 0 && (
            <div className="text-[12px] text-[var(--color-text-tertiary)] py-3">
              Loading headlines...
            </div>
          )}

          {!marketNewsLoading && marketNews.length === 0 && (
            <div className="text-[12px] text-[var(--color-text-tertiary)] py-3">
              Headlines are updating. Check back in a moment.
            </div>
          )}

          {marketNews.length > 0 && (
            <div className="space-y-3">
              <a
                href={marketNews[0].url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block border border-[var(--color-border)] bg-white overflow-hidden"
              >
                <div className="relative aspect-[16/9] bg-[var(--color-bg-secondary)] overflow-hidden">
                  {marketNews[0].image_url ? (
                    <img
                      src={marketNews[0].image_url}
                      alt={marketNews[0].title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#f5f5f5] to-[#e7e7e7]" />
                  )}
                  <div className="absolute left-2 top-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-white/90 text-[var(--color-text-primary)]">
                    {formatCategoryLabel(marketNews[0].category)}
                  </div>
                </div>
                <div className="p-3">
                  <div className="headline-sm text-[17px] leading-snug text-[var(--color-text-primary)] group-hover:underline underline-offset-2">
                    {truncate(marketNews[0].title, 140)}
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    {marketNews[0].source} · {timeAgo(marketNews[0].published_at)}
                  </div>
                </div>
              </a>

              <div className="space-y-2">
                {marketNews.slice(1, 10).map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2.5 border border-[var(--color-border)] bg-white"
                  >
                    <div className="w-[96px] h-[68px] shrink-0 bg-[var(--color-bg-secondary)] overflow-hidden">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#f5f5f5] to-[#e8e8e8]" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                        {formatCategoryLabel(item.category)}
                      </div>
                      <div className="text-[13px] leading-snug text-[var(--color-text-primary)] group-hover:underline underline-offset-2">
                        {truncate(item.title, 100)}
                      </div>
                      <div className="mt-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                        {item.source} · {timeAgo(item.published_at)}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Trending Across Categories */}
        <div className="border-t border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Trending Across Categories
            </h4>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[var(--color-text-tertiary)]">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                <path d="M2 12l4-4 3 3 5-7" />
              </svg>
              Top Stories
            </span>
          </div>

          {categoryNewsLoading && categoryEntries.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-[140px] bg-[var(--color-bg-tertiary)]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {categoryEntries.map(([cat, items]) => {
                const style = TRENDING_CATEGORY_STYLES[cat] || { gradient: "from-gray-800 to-gray-600", icon: "" };
                const lead = items[0];
                const rest = items.slice(1);

                return (
                  <div key={cat} className="border border-[var(--color-border)] overflow-hidden bg-white">
                    {/* Category hero card */}
                    <a
                      href={lead.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block relative"
                    >
                      {lead.image_url ? (
                        <div className="relative h-[140px] overflow-hidden">
                          <img
                            src={lead.image_url}
                            alt={lead.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-white/80 px-1.5 py-0.5 bg-white/15 backdrop-blur-sm">
                                {formatCategoryLabel(cat)}
                              </span>
                              {lead.cluster_size > 1 && (
                                <span className="text-[10px] text-white/60">
                                  {lead.cluster_size} sources
                                </span>
                              )}
                            </div>
                            <h3 className="text-[14px] leading-snug font-semibold text-white group-hover:underline underline-offset-2">
                              {truncate(lead.title, 120)}
                            </h3>
                            <div className="mt-1 text-[10px] text-white/50">
                              {lead.source} &middot; {timeAgo(lead.published_at)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={`relative h-[120px] bg-gradient-to-br ${style.gradient}`}>
                          {/* Pattern overlay */}
                          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='0.5'%3E%3Cpath d='M0 38.59l2.83-2.83 1.41 1.41L1.41 40H0v-1.41zM0 20l20-20h2.83L0 22.83V20zm0-4L24-4h2.83L0 22.83V16z'/%3E%3C/g%3E%3C/svg%3E\")" }} />
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-white/80 px-1.5 py-0.5 bg-white/15">
                                {formatCategoryLabel(cat)}
                              </span>
                            </div>
                            <h3 className="text-[14px] leading-snug font-semibold text-white group-hover:underline underline-offset-2">
                              {truncate(lead.title, 120)}
                            </h3>
                            <div className="mt-1 text-[10px] text-white/50">
                              {lead.source} &middot; {timeAgo(lead.published_at)}
                            </div>
                          </div>
                        </div>
                      )}
                    </a>

                    {/* Related stories underneath */}
                    {rest.length > 0 && (
                      <div className="divide-y divide-[var(--color-border)]">
                        {rest.map((item) => (
                          <a
                            key={item.id}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex gap-2.5 px-3 py-2.5 hover:bg-[var(--color-bg-secondary)] transition-colors"
                          >
                            {item.image_url && (
                              <div className="w-[60px] h-[44px] shrink-0 overflow-hidden bg-[var(--color-bg-tertiary)]">
                                <img
                                  src={item.image_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-[12px] leading-snug text-[var(--color-text-primary)] group-hover:underline underline-offset-2 line-clamp-2">
                                {truncate(item.title, 90)}
                              </div>
                              <div className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                                {item.source} &middot; {timeAgo(item.published_at)}
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live News TV */}
        <div className="border-t border-[var(--color-border)] bg-[#0a0a0a]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
              </span>
              <h4 className="text-[12px] font-bold uppercase tracking-wider text-white">
                Live News
              </h4>
            </div>
            <span className="text-[10px] text-white/40 font-medium">
              {activeLiveChannel.name}
            </span>
          </div>

          {/* Video player */}
          <div className="mx-5 aspect-video border border-white/10 overflow-hidden bg-black">
            <iframe
              title={`${activeLiveChannel.name} live stream`}
              src={getLiveStreamEmbedUrl(activeLiveChannel.channelId)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            />
          </div>

          {/* Channel selector */}
          <div className="px-5 py-3 flex flex-wrap gap-1.5">
            {LIVE_CHANNELS.map((channel) => (
              <button
                key={channel.id}
                onClick={() => setLiveChannelId(channel.id)}
                className={`px-3 py-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                  channel.id === activeLiveChannel.id
                    ? "bg-white text-black"
                    : "bg-white/8 text-white/50 hover:bg-white/15 hover:text-white/80"
                }`}
              >
                {channel.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
