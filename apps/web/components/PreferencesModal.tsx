"use client";

import { useEffect, useState } from "react";
import type { UserPreferences, CategoryMeta, CountryMeta } from "@/types";
import { getPreferences, updatePreferences } from "@/lib/api";

const INTERVAL_OPTIONS = [
  { value: 5, label: "5 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
];

const REGIONS: { name: string; codes: string[] }[] = [
  { name: "South Asia", codes: ["NP", "IN", "PK", "BD", "LK"] },
  { name: "East Asia", codes: ["CN", "JP", "KR", "TW", "HK"] },
  { name: "Southeast Asia", codes: ["SG", "TH", "MY", "ID", "PH", "VN"] },
  { name: "Middle East", codes: ["AE", "SA", "IL", "TR", "QA"] },
  { name: "Americas", codes: ["US", "CA", "MX", "BR", "AR", "CO", "CL"] },
  { name: "Europe", codes: ["GB", "DE", "FR", "IT", "ES", "NL", "SE", "NO", "PL", "CH", "IE", "PT", "BE"] },
  { name: "Oceania", codes: ["AU", "NZ"] },
  { name: "Africa", codes: ["ZA", "NG", "KE", "EG", "GH"] },
];

interface PreferencesModalProps {
  open: boolean;
  onClose: () => void;
  categories: CategoryMeta[];
  countries: CountryMeta[];
  onSaved: (prefs: UserPreferences) => void;
}

export default function PreferencesModal({
  open,
  onClose,
  categories,
  countries,
  onSaved,
}: PreferencesModalProps) {
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [interval, setInterval] = useState(15);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getPreferences()
      .then((p) => {
        setSelectedCats(p.categories || []);
        setSelectedCountries(p.countries || []);
        setInterval(p.notification_interval || 15);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const toggleCat = (id: string) => {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleCountry = (code: string) => {
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updatePreferences({
        categories: selectedCats,
        countries: selectedCountries,
        notification_interval: interval,
      });
      onSaved(result);
      onClose();
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  const getCountryName = (code: string) =>
    countries.find((c) => c.code === code)?.name || code;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-[560px] mx-4 bg-white border border-[var(--color-border)] shadow-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)] shrink-0">
          <h2 className="headline-sm">Notification Preferences</h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--color-text-tertiary)] text-[13px]">
            Loading preferences...
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            {/* Notification interval */}
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
                Check Interval
              </h3>
              <div className="flex gap-2">
                {INTERVAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setInterval(opt.value)}
                    className={`px-4 py-2 text-[12px] font-medium border transition-colors ${
                      interval === opt.value
                        ? "bg-[var(--color-bg-inverse)] text-white border-[var(--color-bg-inverse)]"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-primary)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Categories ({selectedCats.length})
                </h3>
                <button
                  onClick={() =>
                    setSelectedCats(
                      selectedCats.length === categories.length
                        ? []
                        : categories.map((c) => c.id)
                    )
                  }
                  className="text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                >
                  {selectedCats.length === categories.length ? "Clear all" : "Select all"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => toggleCat(cat.id)}
                    className={`px-3 py-1.5 text-[11px] font-medium border transition-colors ${
                      selectedCats.includes(cat.id)
                        ? "bg-[var(--color-bg-inverse)] text-white border-[var(--color-bg-inverse)]"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-primary)]"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Countries */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Countries ({selectedCountries.length})
                </h3>
                <button
                  onClick={() => setSelectedCountries([])}
                  className="text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                >
                  Clear
                </button>
              </div>
              <p className="text-[11px] text-[var(--color-text-tertiary)] mb-3">
                Leave empty to get notifications from all countries
              </p>
              <div className="space-y-3">
                {REGIONS.map((region) => (
                  <div key={region.name}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                      {region.name}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {region.codes.map((code) => (
                        <button
                          key={code}
                          onClick={() => toggleCountry(code)}
                          className={`px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                            selectedCountries.includes(code)
                              ? "bg-[var(--color-bg-inverse)] text-white border-[var(--color-bg-inverse)]"
                              : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-primary)]"
                          }`}
                        >
                          {getCountryName(code)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="px-5 py-3 border-t border-[var(--color-border)] shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 btn-primary text-[13px] uppercase tracking-wider disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
