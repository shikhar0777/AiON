"""GDELT provider implementation (free, no API key required)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

from apps.api.providers.base import NewsProvider
from packages.shared.schemas import ArticleCreate

logger = logging.getLogger(__name__)

# GDELT DOC 2.0 API - free, no key needed
GDELT_BASE = "https://api.gdeltproject.org/api/v2/doc/doc"

# GDELT keyword-based category queries (reliable for all categories)
GDELT_CATEGORY_KEYWORDS = {
    "general": "",
    "world": "(international OR global OR diplomacy OR United Nations OR geopolitics)",
    "politics": "(politics OR election OR government OR congress OR parliament OR policy)",
    "economy": "(economy OR GDP OR inflation OR recession OR trade OR economic)",
    "business": "(business OR company OR corporate OR merger OR acquisition OR CEO)",
    "finance": "(stock market OR investment OR banking OR Wall Street OR IPO OR bonds)",
    "technology": "(technology OR AI OR software OR startup OR cyber OR tech OR digital)",
    "science": "(science OR research OR discovery OR climate OR physics OR biology)",
    "space": "(space OR NASA OR SpaceX OR satellite OR Mars OR astronaut OR rocket)",
    "cybersecurity": "(cybersecurity OR hacking OR data breach OR ransomware OR malware)",
    "startups": "(startup OR venture capital OR funding OR unicorn OR entrepreneur)",
    "crypto": "(cryptocurrency OR bitcoin OR ethereum OR blockchain OR DeFi OR NFT)",
    "gaming": "(video game OR gaming OR esports OR PlayStation OR Xbox OR Nintendo)",
    "ai": "(artificial intelligence OR machine learning OR ChatGPT OR LLM OR neural network)",
    "health": "(health OR medical OR hospital OR disease OR vaccine OR WHO OR doctor)",
    "education": "(education OR university OR school OR students OR teacher OR campus)",
    "environment": "(climate change OR environment OR renewable OR pollution OR sustainability)",
    "crime": "(crime OR murder OR robbery OR arrest OR police OR investigation OR shooting)",
    "legal": "(court OR lawsuit OR judge OR verdict OR legal OR Supreme Court OR trial)",
    "religion": "(religion OR church OR mosque OR temple OR Pope OR faith OR spiritual)",
    "sports": "(sports OR football OR soccer OR basketball OR tennis OR olympics OR cricket)",
    "entertainment": "(entertainment OR movie OR music OR celebrity OR film OR TV show OR concert)",
    "lifestyle": "(lifestyle OR wellness OR self-care OR mindfulness OR home OR family)",
    "food": "(food OR restaurant OR recipe OR cooking OR chef OR cuisine OR vegan)",
    "travel": "(travel OR tourism OR airline OR hotel OR vacation OR destination)",
    "fashion": "(fashion OR designer OR runway OR clothing OR style OR luxury brand)",
    "art": "(art OR museum OR exhibition OR gallery OR painting OR sculpture OR theater)",
    "automotive": "(car OR automotive OR electric vehicle OR Tesla OR EV OR self-driving)",
    "energy": "(energy OR oil OR gas OR solar OR wind power OR nuclear OR OPEC)",
    "real-estate": "(real estate OR housing OR mortgage OR property OR rent OR construction)",
    "defense": "(military OR defense OR army OR navy OR weapons OR NATO OR Pentagon)",
    "agriculture": "(agriculture OR farming OR crop OR harvest OR food supply OR livestock)",
    "aviation": "(aviation OR airline OR Boeing OR Airbus OR airport OR FAA OR pilot)",
    "media": "(media OR journalism OR press OR newspaper OR broadcasting OR reporter)",
    "opinion": "(opinion OR editorial OR commentary OR analysis OR debate OR column)",
    "weather": "(weather OR storm OR hurricane OR tornado OR flood OR drought OR forecast)",
}

# GDELT uses FIPS country codes (expanded for all supported countries)
GDELT_COUNTRY_MAP = {
    # South Asia
    "NP": "NP",
    "IN": "IN",
    "PK": "PK",
    "BD": "BG",
    "LK": "CE",
    # East Asia
    "CN": "CH",
    "JP": "JA",
    "KR": "KS",
    "TW": "TW",
    "HK": "HK",
    # Southeast Asia
    "SG": "SN",
    "TH": "TH",
    "MY": "MY",
    "ID": "ID",
    "PH": "RP",
    "VN": "VM",
    # Middle East
    "AE": "AE",
    "SA": "SA",
    "IL": "IS",
    "TR": "TU",
    "QA": "QA",
    # North America
    "US": "US",
    "CA": "CA",
    "MX": "MX",
    # South America
    "BR": "BR",
    "AR": "AR",
    "CO": "CO",
    "CL": "CI",
    # Europe
    "GB": "UK",
    "DE": "GM",
    "FR": "FR",
    "IT": "IT",
    "ES": "SP",
    "NL": "NL",
    "SE": "SW",
    "NO": "NO",
    "PL": "PL",
    "CH": "SZ",
    "IE": "EI",
    "PT": "PO",
    "BE": "BE",
    # Oceania
    "AU": "AS",
    "NZ": "NZ",
    # Africa
    "ZA": "SF",
    "NG": "NI",
    "KE": "KE",
    "EG": "EG",
    "GH": "GH",
}


class GDELTProvider(NewsProvider):
    name = "gdelt"

    def is_configured(self) -> bool:
        return True  # GDELT is free

    async def fetch_top_headlines(
        self,
        country: str = "US",
        category: str = "general",
        page_size: int = 20,
    ) -> list[ArticleCreate]:
        fips = GDELT_COUNTRY_MAP.get(country.upper(), "US")
        keywords = GDELT_CATEGORY_KEYWORDS.get(category, "")

        query_parts = [f"sourcecountry:{fips}"]
        if keywords:
            query_parts.append(keywords)

        params = {
            "query": " ".join(query_parts),
            "mode": "ArtList",
            "maxrecords": str(min(page_size, 75)),
            "format": "json",
            "sort": "DateDesc",
            "timespan": "24h",
        }

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(GDELT_BASE, params=params)
                resp.raise_for_status()
                data = resp.json()

            articles = []
            for item in data.get("articles", []):
                if not item.get("title"):
                    continue
                pub_at = None
                if item.get("seendate"):
                    try:
                        pub_at = datetime.strptime(
                            item["seendate"], "%Y%m%dT%H%M%SZ"
                        ).replace(tzinfo=timezone.utc)
                    except (ValueError, TypeError):
                        pub_at = datetime.now(timezone.utc)

                articles.append(
                    ArticleCreate(
                        provider=self.name,
                        source=item.get("domain", "Unknown"),
                        title=item["title"],
                        url=item.get("url", ""),
                        published_at=pub_at,
                        country=country.upper(),
                        category=category,
                        raw_snippet=item.get("title", ""),  # GDELT often lacks snippets
                        image_url=item.get("socialimage"),
                        language=item.get("language", "en")[:20],
                    )
                )
            logger.info(f"GDELT: fetched {len(articles)} articles for {country}/{category}")
            return articles

        except httpx.HTTPStatusError as e:
            logger.error(f"GDELT HTTP error: {e.response.status_code}")
            raise
        except Exception as e:
            logger.error(f"GDELT error: {e}")
            raise

    async def fetch_search(
        self,
        query: str,
        page_size: int = 20,
    ) -> list[ArticleCreate]:
        params = {
            "query": query,
            "mode": "ArtList",
            "maxrecords": str(min(page_size, 75)),
            "format": "json",
            "sort": "DateDesc",
            "timespan": "7d",
        }

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(GDELT_BASE, params=params)
                resp.raise_for_status()
                data = resp.json()

            articles = []
            for item in data.get("articles", []):
                if not item.get("title"):
                    continue
                pub_at = None
                if item.get("seendate"):
                    try:
                        pub_at = datetime.strptime(
                            item["seendate"], "%Y%m%dT%H%M%SZ"
                        ).replace(tzinfo=timezone.utc)
                    except (ValueError, TypeError):
                        pass

                articles.append(
                    ArticleCreate(
                        provider=self.name,
                        source=item.get("domain", "Unknown"),
                        title=item["title"],
                        url=item.get("url", ""),
                        published_at=pub_at,
                        raw_snippet=item.get("title", ""),
                        image_url=item.get("socialimage"),
                    )
                )
            return articles

        except Exception as e:
            logger.error(f"GDELT search error: {e}")
            raise
