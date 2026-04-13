"use client";

import { useEffect, useState } from "react";

export type DisplayMode = "mobile" | "web" | "kiosk";

export function useDisplayMode(): DisplayMode {
  const [mode, setMode] = useState<DisplayMode>("web");

  useEffect(() => {
    const evaluateMode = () => {
      const width = window.innerWidth;
      const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

      if (width < 760) {
        setMode("mobile");
        return;
      }

      if (width >= 1500 || (isCoarsePointer && width >= 1200)) {
        setMode("kiosk");
        return;
      }

      setMode("web");
    };

    evaluateMode();
    window.addEventListener("resize", evaluateMode);
    return () => window.removeEventListener("resize", evaluateMode);
  }, []);

  return mode;
}
