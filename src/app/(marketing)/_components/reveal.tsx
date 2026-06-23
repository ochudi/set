"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

// Set easing per CLAUDE.md motion: cubic-bezier(0.22, 1, 0.36, 1).
const EASE = [0.22, 1, 0.36, 1] as const;

type RevealProps = HTMLMotionProps<"div"> & {
  /** Stagger order. Each step adds ~70ms of delay. */
  index?: number;
  /** Entrance rise distance in px (8 to 16 per motion direction). */
  rise?: number;
  /** Base delay in seconds before the stagger offset. */
  delay?: number;
  /** Entrance duration in seconds. Hero may use up to ~0.5s. */
  duration?: number;
};

/**
 * Fade + small rise entrance, once on load. Reduced-motion users get the
 * fully styled element with no transform or opacity animation, and no layout
 * shift either way (we animate opacity/transform only).
 */
export function Reveal({
  index = 0,
  rise = 12,
  delay = 0,
  duration = 0.45,
  children,
  ...props
}: RevealProps) {
  const reduce = useReducedMotion();

  // Reduced-motion: render the fully styled element with no entrance animation.
  // Either way we touch only opacity/transform, so there is no layout shift.
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: rise }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={
        reduce
          ? undefined
          : { duration, ease: EASE, delay: delay + index * 0.07 }
      }
      {...props}
    >
      {children}
    </motion.div>
  );
}
