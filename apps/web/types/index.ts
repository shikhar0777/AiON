// ── Shared types for the frontend ────────────────────────────────

export interface CountryMeta {
  code: string;
  name: string;
}

export interface CategoryMeta {
  id: string;
  label: string;
}

export interface FeedItem {
  id: number;
  title: string;
  source: string;
  url: string;
  published_at: string | null;
  country: string;
  category: string;
  image_url: string | null;
  cluster_id: number | null;
  cluster_size: number;
  score: number;
  ai_summary: string | null;
  why_trending: string | null;
}

export interface FeedResponse {
  items: FeedItem[];
  total: number;
  cursor: string | null;
  updated_at: string;
  sources_used: string[];
  cached: boolean;
}

export interface ArticleRead {
  id: number;
  provider: string;
  source: string;
  title: string;
  url: string;
  published_at: string | null;
  country: string;
  language: string;
  category: string;
  raw_snippet: string | null;
  image_url: string | null;
  cluster_id: number | null;
  hash: string;
  fetched_at: string;
}

export interface ClusterRead {
  cluster_id: number;
  canonical_title: string;
  canonical_url: string | null;
  top_country: string;
  top_category: string;
  tags_json: string[];
  ai_summary: string | null;
  ai_key_points_json: string[];
  ai_entities_json: Record<string, string[]> | null;
  why_trending: string | null;
  score: number;
  last_updated: string;
  article_count: number;
  sources: string[];
  top_image_url: string | null;
}

export interface StoryIntelligence {
  article: ArticleRead;
  cluster: ClusterRead | null;
  ai_summary: string | null;
  key_points: string[];
  entities: Record<string, string[]> | null;
  why_trending: string | null;
  related_articles: ArticleRead[];
  source_angles: { source: string; headline: string; angle: string }[];
  timeline: { time: string; event: string }[];
}

export interface ExplainResponse {
  explanation: string;
  sources: string[];
  timeline: { time: string; event: string }[];
  key_points: string[];
  ai_provider: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  answer: string;
  ai_provider: string;
}

export interface ProviderStatus {
  name: string;
  status: string;
  configured: boolean;
  failures: number;
  last_error: string | null;
  cooldown_until: string | null;
}

export interface SSEEvent {
  event: string;
  channel: string;
  data: Record<string, unknown>;
}

// ── Auth ──────────────────────────────────────────────────────
export interface User {
  id: number;
  email: string;
  display_name: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ── User Preferences ─────────────────────────────────────────
export interface UserPreferences {
  categories: string[];
  countries: string[];
  notification_interval: number;
}

// ── Notifications ────────────────────────────────────────────
export interface NotificationItem {
  id: number;
  article_id: number | null;
  cluster_id: number | null;
  title: string;
  body: string | null;
  category: string | null;
  country: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  unread_count: number;
}

// ── Search ──────────────────────────────────────────────────
export interface SearchSuggestion {
  type: "article" | "cluster";
  id: number;
  title: string;
  source?: string;
  category: string;
  image_url?: string | null;
  score: number;
}

export interface SearchSuggestResponse {
  query: string;
  suggestions: SearchSuggestion[];
}

export interface SearchResult {
  id: number;
  title: string;
  source: string;
  url: string;
  published_at: string | null;
  country: string;
  category: string;
  image_url: string | null;
  cluster_id: number | null;
  relevance_score: number;
  cluster: {
    cluster_id: number;
    canonical_title: string;
    ai_summary: string | null;
    score: number;
  } | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
}

// ── HeyGen ──────────────────────────────────────────────────
export interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  preview_image_url: string;
  gender: string;
}

// ── Visa API ────────────────────────────────────────────────
export interface FXRate {
  currency: string;
  name: string;
  rate: number;
  inverse: number;
}

export interface FXRatesResponse {
  source: string;
  rates: FXRate[];
  demo: boolean;
}

export interface SpendInsight {
  category: string;
  sales_mom: number;
  sales_yoy: number;
  txn_mom: number;
  txn_yoy: number;
}

export interface SpendInsightsResponse {
  country: string;
  insights: SpendInsight[];
  demo: boolean;
}

export interface PaymentVolumeMonth {
  month: string;
  volume_trillions: number;
}

export interface PaymentVolumeResponse {
  months: PaymentVolumeMonth[];
  demo: boolean;
}
