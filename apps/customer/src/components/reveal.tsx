"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const HIDDEN_BY_DIRECTION = {
  up: "translate-y-8 opacity-0",
  left: "-translate-x-10 opacity-0",
  right: "translate-x-10 opacity-0",
};

/**
 * Slides + fades its children in once they scroll into view. `up` also fires
 * immediately on mount (no observer needed) so above-the-fold content — the
 * hero — animates in on load rather than waiting for a scroll that may never
 * come.
 */
export function Reveal({
  children,
  direction = "up",
  delay = 0,
  immediate = false,
  className,
}: {
  children: ReactNode;
  direction?: "up" | "left" | "right";
  delay?: number;
  immediate?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (immediate) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [immediate]);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
      className={cn(
        "transition-all duration-700 ease-out",
        visible ? "translate-x-0 translate-y-0 opacity-100" : HIDDEN_BY_DIRECTION[direction],
        className,
      )}
    >
      {children}
    </div>
  );
}
