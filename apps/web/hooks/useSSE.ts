"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { getStreamURL } from "@/lib/api";

interface UseSSEOptions {
  country: string;
  category: string;
  mode: string;
  onUpdate?: (data: Record<string, unknown>) => void;
}

export function useSSE({ country, category, mode, onUpdate }: UseSSEOptions) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<number | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const connect = useCallback(() => {
    // Close existing connection
    if (sourceRef.current) {
      sourceRef.current.close();
    }

    const url = getStreamURL(country, category, mode);
    const source = new EventSource(url);
    sourceRef.current = source;

    source.addEventListener("connected", () => {
      setConnected(true);
    });

    source.addEventListener("update", (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastEvent(Date.now());
        onUpdateRef.current?.(data);
      } catch (e) {
        // Ignore parse errors
      }
    });

    source.addEventListener("heartbeat", () => {
      setLastEvent(Date.now());
    });

    source.onerror = () => {
      setConnected(false);
      // Auto-reconnect after 5s
      setTimeout(() => {
        if (sourceRef.current === source) {
          connect();
        }
      }, 5000);
    };
  }, [country, category, mode]);

  useEffect(() => {
    connect();
    return () => {
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
    };
  }, [connect]);

  return { connected, lastEvent };
}
