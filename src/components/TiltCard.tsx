import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface TiltCardProps {
  /** Maximum tilt angle in degrees */
  tiltLimit?: number;
  /** Scale factor on hover */
  scale?: number;
  /** Perspective distance in pixels */
  perspective?: number;
  /** Tilt direction: "gravitate" follows cursor, "evade" tilts away */
  effect?: "gravitate" | "evade";
  /** Show a teal spotlight that follows the cursor on hover */
  spotlight?: boolean;
  /** Additional class name (applied to outer wrapper) */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Card content */
  children?: React.ReactNode;
}

/**
 * 3-D tilt wrapper themed for LitDeX (teal spotlight, theme-matched border glow).
 * Auto-disables on touch / small viewports for performance and accessibility.
 */
export function TiltCard({
  tiltLimit = 8,
  scale = 1.02,
  perspective = 1200,
  effect = "evade",
  spotlight = true,
  className,
  style,
  children,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState(
    `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`
  );
  const [spotlightPos, setSpotlightPos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [isTouch, setIsTouch] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Honour reduced-motion only — keep tilt on mobile but lighter.
  useEffect(() => {
    const check = () => {
      if (typeof window === "undefined") return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      setEnabled(!reduce);
      setIsTouch(coarse);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const dir = effect === "evade" ? -1 : 1;
  // Lighter tilt on touch to avoid jitter / battery cost.
  const effectiveLimit = isTouch ? Math.min(tiltLimit, 4) : tiltLimit;
  const effectiveScale = isTouch ? Math.min(scale, 1.01) : scale;

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      const el = cardRef.current;
      if (!el) return;
      const clientX = e.clientX;
      const clientY = e.clientY;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const px = (clientX - rect.left) / rect.width;
        const py = (clientY - rect.top) / rect.height;
        const xRot = (py - 0.5) * (effectiveLimit * 2) * dir;
        const yRot = (px - 0.5) * -(effectiveLimit * 2) * dir;
        setTransform(
          `perspective(${perspective}px) rotateX(${xRot}deg) rotateY(${yRot}deg) scale3d(${effectiveScale}, ${effectiveScale}, ${effectiveScale})`
        );
        if (spotlight) setSpotlightPos({ x: px * 100, y: py * 100 });
      });
    },
    [enabled, effectiveLimit, effectiveScale, perspective, dir, spotlight]
  );

  const handlePointerEnter = useCallback(() => {
    if (enabled) setIsHovered(true);
  }, [enabled]);

  const handlePointerLeave = useCallback(() => {
    setTransform(
      `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`
    );
    setIsHovered(false);
  }, [perspective]);

  return (
    <div
      ref={cardRef}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={cn("will-change-transform relative", className)}
      style={{
        transform: enabled ? transform : undefined,
        transition: "transform 0.2s ease-out",
        transformStyle: "preserve-3d",
        ...style,
      }}
    >
      {children}
      {enabled && spotlight && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-200"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(380px circle at ${spotlightPos.x}% ${spotlightPos.y}%, hsl(var(--primary) / 0.18), transparent 60%)`,
            mixBlendMode: "screen",
          }}
        />
      )}
    </div>
  );
}
