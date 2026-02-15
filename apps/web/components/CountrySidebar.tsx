"use client";

import { useState } from "react";
import type { CountryMeta } from "@/types";

const FLAG_EMOJI: Record<string, string> = {
  NP: "\u{1F1F3}\u{1F1F5}", IN: "\u{1F1EE}\u{1F1F3}", PK: "\u{1F1F5}\u{1F1F0}", BD: "\u{1F1E7}\u{1F1E9}", LK: "\u{1F1F1}\u{1F1F0}",
  CN: "\u{1F1E8}\u{1F1F3}", JP: "\u{1F1EF}\u{1F1F5}", KR: "\u{1F1F0}\u{1F1F7}", TW: "\u{1F1F9}\u{1F1FC}", HK: "\u{1F1ED}\u{1F1F0}",
  SG: "\u{1F1F8}\u{1F1EC}", TH: "\u{1F1F9}\u{1F1ED}", MY: "\u{1F1F2}\u{1F1FE}", ID: "\u{1F1EE}\u{1F1E9}", PH: "\u{1F1F5}\u{1F1ED}", VN: "\u{1F1FB}\u{1F1F3}",
  AE: "\u{1F1E6}\u{1F1EA}", SA: "\u{1F1F8}\u{1F1E6}", IL: "\u{1F1EE}\u{1F1F1}", TR: "\u{1F1F9}\u{1F1F7}", QA: "\u{1F1F6}\u{1F1E6}",
  US: "\u{1F1FA}\u{1F1F8}", CA: "\u{1F1E8}\u{1F1E6}", MX: "\u{1F1F2}\u{1F1FD}",
  BR: "\u{1F1E7}\u{1F1F7}", AR: "\u{1F1E6}\u{1F1F7}", CO: "\u{1F1E8}\u{1F1F4}", CL: "\u{1F1E8}\u{1F1F1}",
  GB: "\u{1F1EC}\u{1F1E7}", DE: "\u{1F1E9}\u{1F1EA}", FR: "\u{1F1EB}\u{1F1F7}", IT: "\u{1F1EE}\u{1F1F9}", ES: "\u{1F1EA}\u{1F1F8}",
  NL: "\u{1F1F3}\u{1F1F1}", SE: "\u{1F1F8}\u{1F1EA}", NO: "\u{1F1F3}\u{1F1F4}", PL: "\u{1F1F5}\u{1F1F1}", CH: "\u{1F1E8}\u{1F1ED}",
  IE: "\u{1F1EE}\u{1F1EA}", PT: "\u{1F1F5}\u{1F1F9}", BE: "\u{1F1E7}\u{1F1EA}",
  AU: "\u{1F1E6}\u{1F1FA}", NZ: "\u{1F1F3}\u{1F1FF}",
  ZA: "\u{1F1FF}\u{1F1E6}", NG: "\u{1F1F3}\u{1F1EC}", KE: "\u{1F1F0}\u{1F1EA}", EG: "\u{1F1EA}\u{1F1EC}", GH: "\u{1F1EC}\u{1F1ED}",
};

const REGIONS = [
  { name: "South Asia", codes: ["NP", "IN", "PK", "BD", "LK"] },
  { name: "East Asia", codes: ["CN", "JP", "KR", "TW", "HK"] },
  { name: "SE Asia", codes: ["SG", "TH", "MY", "ID", "PH", "VN"] },
  { name: "N. America", codes: ["US", "CA", "MX"] },
  { name: "S. America", codes: ["BR", "AR", "CO", "CL"] },
  { name: "Europe", codes: ["GB", "DE", "FR", "IT", "ES", "NL", "SE", "NO", "PL", "CH", "IE", "PT", "BE"] },
  { name: "Middle East", codes: ["AE", "SA", "IL", "TR", "QA"] },
  { name: "Africa", codes: ["ZA", "NG", "KE", "EG", "GH"] },
  { name: "Oceania", codes: ["AU", "NZ"] },
];

function getRegionForCountry(code: string): string {
  return REGIONS.find((r) => r.codes.includes(code))?.name || REGIONS[0].name;
}

interface Props {
  countries: CountryMeta[];
  selectedCountry: string;
  onCountryChange: (code: string) => void;
}

export default function CountrySidebar({ countries, selectedCountry, onCountryChange }: Props) {
  const [activeRegion, setActiveRegion] = useState(() => getRegionForCountry(selectedCountry));

  const regionData = REGIONS.find((r) => r.name === activeRegion) || REGIONS[0];
  const regionCountries = regionData.codes
    .map((code) => countries.find((c) => c.code === code))
    .filter(Boolean) as CountryMeta[];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Region
        </span>
      </div>

      {/* Continent tabs — vertical */}
      <div className="px-1.5 py-2 border-b border-[var(--color-border)] flex flex-col gap-0.5">
        {REGIONS.map((region) => {
          const hasSelected = region.codes.includes(selectedCountry);
          return (
            <button
              key={region.name}
              onClick={() => setActiveRegion(region.name)}
              className={`text-left px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                activeRegion === region.name
                  ? "bg-[var(--color-bg-inverse)] text-white"
                  : hasSelected
                    ? "text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)]"
                    : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
              }`}
            >
              {region.name}
            </button>
          );
        })}
      </div>

      {/* Countries for active region */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-1.5 py-1.5 flex flex-col gap-0.5">
          {regionCountries.map((c) => (
            <button
              key={c.code}
              onClick={() => onCountryChange(c.code)}
              className={`text-left px-2 py-1.5 text-[12px] transition-colors ${
                c.code === selectedCountry
                  ? "bg-[var(--color-bg-inverse)] text-white font-medium"
                  : "text-[var(--color-text-secondary)] hover:bg-white hover:text-[var(--color-text-primary)]"
              }`}
            >
              <span className="mr-1.5">{FLAG_EMOJI[c.code] || ""}</span>
              {c.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
