'use client';

import { useEffect, useRef, useState } from 'react';

type RiskMap = Record<string, number>;

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

export function useSmoothedRisks(targetRisks: RiskMap, durationMs = 420): RiskMap {
  const [smoothedRisks, setSmoothedRisks] = useState<RiskMap>(targetRisks);
  const currentRef = useRef<RiskMap>(targetRisks);

  useEffect(() => {
    const from = currentRef.current;
    const to = targetRisks;
    const keys = Array.from(new Set([...Object.keys(from), ...Object.keys(to)]));

    if (keys.length === 0) {
      let emptyRafId = 0;
      emptyRafId = requestAnimationFrame(() => {
        setSmoothedRisks({});
        currentRef.current = {};
      });
      return () => cancelAnimationFrame(emptyRafId);
    }

    const started = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const rawProgress = Math.min((now - started) / durationMs, 1);
      const eased = easeOutCubic(rawProgress);
      const next: RiskMap = {};

      keys.forEach((key) => {
        const start = from[key] ?? 0;
        const end = to[key] ?? 0;
        next[key] = start + (end - start) * eased;
      });

      setSmoothedRisks(next);
      currentRef.current = next;

      if (rawProgress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [targetRisks, durationMs]);

  return smoothedRisks;
}
