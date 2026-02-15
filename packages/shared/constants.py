"""Shared constants for AiON."""

# ── Countries (40+, including Nepal) ─────────────────────────────
COUNTRIES = {
    # South Asia
    "NP": "Nepal",
    "IN": "India",
    "PK": "Pakistan",
    "BD": "Bangladesh",
    "LK": "Sri Lanka",
    # East Asia
    "CN": "China",
    "JP": "Japan",
    "KR": "South Korea",
    "TW": "Taiwan",
    "HK": "Hong Kong",
    # Southeast Asia
    "SG": "Singapore",
    "TH": "Thailand",
    "MY": "Malaysia",
    "ID": "Indonesia",
    "PH": "Philippines",
    "VN": "Vietnam",
    # Middle East
    "AE": "United Arab Emirates",
    "SA": "Saudi Arabia",
    "IL": "Israel",
    "TR": "Turkey",
    "QA": "Qatar",
    # North America
    "US": "United States",
    "CA": "Canada",
    "MX": "Mexico",
    # South America
    "BR": "Brazil",
    "AR": "Argentina",
    "CO": "Colombia",
    "CL": "Chile",
    # Europe
    "GB": "United Kingdom",
    "DE": "Germany",
    "FR": "France",
    "IT": "Italy",
    "ES": "Spain",
    "NL": "Netherlands",
    "SE": "Sweden",
    "NO": "Norway",
    "PL": "Poland",
    "CH": "Switzerland",
    "IE": "Ireland",
    "PT": "Portugal",
    "BE": "Belgium",
    # Oceania
    "AU": "Australia",
    "NZ": "New Zealand",
    # Africa
    "ZA": "South Africa",
    "NG": "Nigeria",
    "KE": "Kenya",
    "EG": "Egypt",
    "GH": "Ghana",
}

# ── Categories (35 total) ────────────────────────────────────────
CATEGORIES = [
    # Core news
    "general",
    "world",
    "politics",
    "economy",
    "business",
    "finance",
    # Tech & Science
    "technology",
    "science",
    "space",
    "cybersecurity",
    "startups",
    "crypto",
    "gaming",
    "ai",
    # Society
    "health",
    "education",
    "environment",
    "crime",
    "legal",
    "religion",
    # Lifestyle
    "sports",
    "entertainment",
    "lifestyle",
    "food",
    "travel",
    "fashion",
    "art",
    "automotive",
    # Industry
    "energy",
    "real-estate",
    "defense",
    "agriculture",
    "aviation",
    # Media
    "media",
    "opinion",
    "weather",
]

CATEGORY_LABELS = {
    "general": "General",
    "world": "World",
    "politics": "Politics",
    "economy": "Economy",
    "business": "Business",
    "finance": "Finance",
    "technology": "Technology",
    "science": "Science",
    "space": "Space",
    "cybersecurity": "Cybersecurity",
    "startups": "Startups",
    "crypto": "Crypto",
    "gaming": "Gaming",
    "ai": "AI",
    "health": "Health",
    "education": "Education",
    "environment": "Environment",
    "crime": "Crime",
    "legal": "Legal",
    "religion": "Religion",
    "sports": "Sports",
    "entertainment": "Entertainment",
    "lifestyle": "Lifestyle",
    "food": "Food",
    "travel": "Travel",
    "fashion": "Fashion",
    "art": "Art",
    "automotive": "Automotive",
    "energy": "Energy",
    "real-estate": "Real Estate",
    "defense": "Defense",
    "agriculture": "Agriculture",
    "aviation": "Aviation",
    "media": "Media",
    "opinion": "Opinion",
    "weather": "Weather",
}

# Guardian maps categories to sections
GUARDIAN_SECTION_MAP = {
    "general": "news",
    "world": "world",
    "politics": "politics",
    "economy": "business",
    "business": "business",
    "finance": "business",
    "technology": "technology",
    "science": "science",
    "space": "science",
    "cybersecurity": "technology",
    "startups": "technology",
    "crypto": "technology",
    "gaming": "technology",
    "ai": "technology",
    "health": "society",
    "education": "education",
    "environment": "environment",
    "crime": "uk-news",
    "legal": "law",
    "religion": "world",
    "sports": "sport",
    "entertainment": "culture",
    "lifestyle": "lifeandstyle",
    "food": "food",
    "travel": "travel",
    "fashion": "fashion",
    "art": "artanddesign",
    "automotive": "technology",
    "energy": "environment",
    "real-estate": "money",
    "defense": "world",
    "agriculture": "environment",
    "aviation": "business",
    "media": "media",
    "opinion": "commentisfree",
    "weather": "news",
}

# Cache TTLs in seconds
CACHE_TTL_FEED = 120          # 2 min for feed results
CACHE_TTL_STORY = 300         # 5 min for individual story
CACHE_TTL_CLUSTER = 180       # 3 min for cluster data
CACHE_TTL_EXPLAIN = 600       # 10 min for AI explanations
CACHE_TTL_META = 3600         # 1 hour for metadata

# Circuit breaker
CIRCUIT_BREAKER_THRESHOLD = 3      # failures before opening
CIRCUIT_BREAKER_COOLDOWN = 60      # seconds to wait before half-open
CIRCUIT_BREAKER_HALF_OPEN_MAX = 1  # requests to allow in half-open

# Trending score weights
TRENDING_W_SOURCES = 3.0    # weight for unique source count
TRENDING_W_RECENCY = 2.0    # weight for recency boost
TRENDING_W_VELOCITY = 1.5   # weight for velocity

# Dedup
DEDUP_TIME_WINDOW_HOURS = 24
DEDUP_SIMILARITY_THRESHOLD = 0.75

# Embedding-based clustering
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 256
EMBEDDING_SIMILARITY_THRESHOLD = 0.82
EMBEDDING_BATCH_SIZE = 50
