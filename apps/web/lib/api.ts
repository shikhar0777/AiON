// ── API client for backend communication ────────────────────────

import type {
  AuthResponse,
  CategoryMeta,
  ChatMessage,
  ChatResponse,
  CountryMeta,
  ExplainResponse,
  FeedResponse,
  FXRatesResponse,
  HeyGenAvatar,
  NotificationsResponse,
  PaymentVolumeResponse,
  SearchResponse,
  SearchSuggestResponse,
  SpendInsightsResponse,
  StoryIntelligence,
  ClusterRead,
  User,
  UserPreferences,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJSON<T>(path: string, retries = 2): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError!;
}

export async function getCountries(): Promise<CountryMeta[]> {
  return fetchJSON("/api/meta/countries");
}

export async function getCategories(): Promise<CategoryMeta[]> {
  return fetchJSON("/api/meta/categories");
}

export async function getFeed(
  country: string,
  category: string,
  mode: "trending" | "latest",
  cursor = 0,
  limit = 30
): Promise<FeedResponse> {
  const params = new URLSearchParams({
    category,
    mode,
    cursor: String(cursor),
    limit: String(limit),
  });
  if (country) params.set("country", country);
  return fetchJSON(`/api/feed?${params.toString()}`);
}

export async function getStory(articleId: number): Promise<StoryIntelligence> {
  return fetchJSON(`/api/story/${articleId}`);
}

export async function getCluster(clusterId: number): Promise<ClusterRead> {
  return fetchJSON(`/api/cluster/${clusterId}`);
}

export async function getExplanation(
  clusterId: number
): Promise<ExplainResponse> {
  return fetchJSON(`/api/explain?cluster_id=${clusterId}`);
}

export async function sendChatMessage(
  articleId: number,
  question: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      article_id: articleId,
      question,
      history,
    }),
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function sendGeneralChat(
  question: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/api/general-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function translateTexts(
  texts: string[],
  targetLanguage: string
): Promise<{ translations: string[]; target_language: string; ai_provider: string }> {
  const res = await fetch(`${API_URL}/api/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, target_language: targetLanguage }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function getStreamURL(
  country: string,
  category: string,
  mode: string
): string {
  const params = new URLSearchParams({ category, mode });
  if (country) params.set("country", country);
  return `${API_URL}/api/stream?${params.toString()}`;
}

export async function getHealthProviders(): Promise<{
  providers: Array<{
    name: string;
    status: string;
    configured: boolean;
    failures: number;
  }>;
}> {
  return fetchJSON("/health/providers");
}

// ── Auth helpers ─────────────────────────────────────────────
function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("np_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJSONAuth<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options.headers,
    },
    signal: options.signal || AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error: ${res.status}`);
  }
  return res.json();
}

export async function register(email: string, displayName: string, password: string): Promise<AuthResponse> {
  return fetchJSONAuth("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, display_name: displayName, password }),
  });
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return fetchJSONAuth("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe(): Promise<User> {
  return fetchJSONAuth("/api/auth/me");
}

export async function getPreferences(): Promise<UserPreferences> {
  return fetchJSONAuth("/api/preferences");
}

export async function updatePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
  return fetchJSONAuth("/api/preferences", {
    method: "PUT",
    body: JSON.stringify(prefs),
  });
}

export async function getNotifications(unread = false, limit = 20): Promise<NotificationsResponse> {
  return fetchJSONAuth(`/api/notifications?unread=${unread}&limit=${limit}`);
}

export async function markNotificationRead(id: number): Promise<void> {
  await fetchJSONAuth(`/api/notifications/${id}/read`, { method: "POST" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetchJSONAuth("/api/notifications/read-all", { method: "POST" });
}

// ── Search ──────────────────────────────────────────────────
export async function getSearchSuggestions(q: string): Promise<SearchSuggestResponse> {
  return fetchJSON(`/api/search/suggest?q=${encodeURIComponent(q)}`);
}

export async function searchArticles(
  q: string,
  category = "",
  country = "",
  limit = 30,
  offset = 0,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q, limit: String(limit), offset: String(offset) });
  if (category) params.set("category", category);
  if (country) params.set("country", country);
  return fetchJSON(`/api/search?${params.toString()}`);
}

// ── Visa API ────────────────────────────────────────────────
export async function getVisaFXRates(source = "USD"): Promise<FXRatesResponse> {
  return fetchJSON(`/api/visa/fx-rates?source=${source}`);
}

export async function getVisaSpendInsights(country = "US"): Promise<SpendInsightsResponse> {
  return fetchJSON(`/api/visa/spend-insights?country=${country}`);
}

export async function getVisaPaymentVolume(): Promise<PaymentVolumeResponse> {
  return fetchJSON("/api/visa/payment-volume");
}

export async function getVisaStatus(): Promise<{ configured: boolean }> {
  return fetchJSON("/api/visa/status");
}

// ── HeyGen API ───────────────────────────────────────────────
export async function getHeyGenAvatars(): Promise<{ avatars: HeyGenAvatar[]; demo: boolean }> {
  return fetchJSONAuth("/api/heygen/avatars");
}

export async function uploadHeyGenAvatar(file: File): Promise<{ avatar_id: string; preview_image_url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const token = typeof window !== "undefined" ? localStorage.getItem("np_token") : null;
  const res = await fetch(`${API_URL}/api/heygen/avatars/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}
