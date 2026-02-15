"use client";

import type { CountryMeta } from "@/types";

const FLAG_EMOJI: Record<string, string> = {
  // South Asia
  NP: "🇳🇵", IN: "🇮🇳", PK: "🇵🇰", BD: "🇧🇩", LK: "🇱🇰",
  // East Asia
  CN: "🇨🇳", JP: "🇯🇵", KR: "🇰🇷", TW: "🇹🇼", HK: "🇭🇰",
  // Southeast Asia
  SG: "🇸🇬", TH: "🇹🇭", MY: "🇲🇾", ID: "🇮🇩", PH: "🇵🇭", VN: "🇻🇳",
  // Middle East
  AE: "🇦🇪", SA: "🇸🇦", IL: "🇮🇱", TR: "🇹🇷", QA: "🇶🇦",
  // North America
  US: "🇺🇸", CA: "🇨🇦", MX: "🇲🇽",
  // South America
  BR: "🇧🇷", AR: "🇦🇷", CO: "🇨🇴", CL: "🇨🇱",
  // Europe
  GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷", IT: "🇮🇹", ES: "🇪🇸",
  NL: "🇳🇱", SE: "🇸🇪", NO: "🇳🇴", PL: "🇵🇱", CH: "🇨🇭",
  IE: "🇮🇪", PT: "🇵🇹", BE: "🇧🇪",
  // Oceania
  AU: "🇦🇺", NZ: "🇳🇿",
  // Africa
  ZA: "🇿🇦", NG: "🇳🇬", KE: "🇰🇪", EG: "🇪🇬", GH: "🇬🇭",
};

interface Props {
  countries: CountryMeta[];
  selected: string;
  onSelect: (code: string) => void;
}

export default function CountrySelector({ countries, selected, onSelect }: Props) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider shrink-0">
        Edition
      </label>
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full bg-transparent border-b border-[var(--color-border)] py-1.5 text-sm font-medium cursor-pointer outline-none hover:border-black focus:border-black transition-colors"
      >
        {countries.map((c) => (
          <option key={c.code} value={c.code} className="bg-white text-black">
            {FLAG_EMOJI[c.code] || "🌍"} {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
