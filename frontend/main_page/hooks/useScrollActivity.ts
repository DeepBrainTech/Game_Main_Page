"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useScrollActivity(enabled: boolean, idleDelay = 700) {
  const [isScrolling, setIsScrolling] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsScrolling(false);
    return () => {
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [enabled]);

  const handleScroll = useCallback(() => {
    if (!enabled) return;
    setIsScrolling(true);
    if (idleTimerRef.current !== null) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setIsScrolling(false);
      idleTimerRef.current = null;
    }, idleDelay);
  }, [enabled, idleDelay]);

  return { isScrolling: enabled && isScrolling, handleScroll };
}
