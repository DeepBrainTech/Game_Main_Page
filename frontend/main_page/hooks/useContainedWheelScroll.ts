"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

export function useContainedWheelScroll(ref: RefObject<HTMLElement>, enabled: boolean) {
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || element.scrollHeight <= element.clientHeight + 1) return;

      event.preventDefault();
      event.stopPropagation();

      const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 16;
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? lineHeight
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? element.clientHeight : 1;
      element.scrollTop += event.deltaY * unit;
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [ref, enabled]);
}
