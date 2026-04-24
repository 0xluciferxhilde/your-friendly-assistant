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

  // Disable on touch / small viewports / reduced-motion preference.
  useEffect(() => {
    const check = () => {
      if (typeof window === "undefined") return;
      const small = window.matchMedia("(max-width: 768px)").matches;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setEnabled(!(small || coarse || reduce));
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const dir = effect === "evade" ? -1 : 1;

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const xRot = (py - 0.5) * (tiltLimit * 2) * dir;
      const yRot = (px - 0.5) * -(tiltLimit * 2) * dir;
      setTransform(
        `perspective(${perspective}px) rotateX(${xRot}deg) rotateY(${yRot}deg) scale3d(${scale}, ${scale}, ${scale})`
      );
      if (spotlight) setSpotlightPos({ x: px * 100, y: py * 100 });
    },
    [enabled, tiltLimit, scale, perspective, dir, spotlight]
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
