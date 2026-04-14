"use client";

import { useEffect, useMemo, useState } from "react";

export function CountUpStat({
  target,
  suffix = "",
  decimals = 0,
  durationMs = 1200,
}: {
  target: number;
  suffix?: string;
  decimals?: number;
  durationMs?: number;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    let startTime = 0;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / durationMs, 1);
      const next = target * progress;
      setValue(next);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [durationMs, target]);

  const formatted = useMemo(() => {
    return value.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }, [value, decimals]);

  return <h3 className="program__count">{formatted}{suffix}</h3>;
}

