"use client";

import { useEffect, useRef } from "react";
import { MotionConfig, animate, motion, useInView, useReducedMotion, type Variants } from "motion/react";

/** Shared easing: a soft "ease-out-quint" that feels calm rather than bouncy. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Respects the visitor's OS "reduce motion" setting for every motion component below. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ ease: EASE }}>{children}</MotionConfig>;
}

/** Fades and lifts its children into view the first time they scroll on screen. */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

const staggerParent: Variants = {
  hidden: {},
  show: (gap: number = 0.08) => ({ transition: { staggerChildren: gap, delayChildren: 0.05 } }),
};

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

/** Animates its <StaggerItem> children in sequence, on mount (`onMount`) or when scrolled into view. */
export function Stagger({
  children,
  className,
  gap = 0.08,
  onMount = false,
}: {
  children: React.ReactNode;
  className?: string;
  gap?: number;
  onMount?: boolean;
}) {
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      custom={gap}
      initial="hidden"
      {...(onMount ? { animate: "show" } : { whileInView: "show", viewport: { once: true, amount: 0.1 } })}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerChild}>
      {children}
    </motion.div>
  );
}

/** A circle and checkmark that draw themselves, for order success screens. */
export function SuccessMark({ tone = "success" }: { tone?: "success" | "warning" }) {
  const color = tone === "success" ? "text-success" : "text-warning";
  return (
    <motion.svg
      viewBox="0 0 52 52"
      className={`size-14 ${color}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial="hidden"
      animate="show"
      aria-hidden
    >
      <motion.circle
        cx="26"
        cy="26"
        r="24"
        style={{ fill: "color-mix(in srgb, currentColor 8%, transparent)" }}
        variants={{ hidden: { pathLength: 0, opacity: 0 }, show: { pathLength: 1, opacity: 1 } }}
        transition={{ duration: 0.6, ease: EASE }}
      />
      {tone === "success" ? (
        <motion.path
          d="M15 27l7 7 15-16"
          variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1 } }}
          transition={{ duration: 0.4, delay: 0.45, ease: EASE }}
        />
      ) : (
        <motion.path
          d="M26 14v13l8 5"
          variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1 } }}
          transition={{ duration: 0.4, delay: 0.45, ease: EASE }}
        />
      )}
    </motion.svg>
  );
}

/** Counts up to `value` once visible. */
export function CountUp({ value, format = "int" }: { value: number; format?: "int" | "bdt" }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const fmt = (n: number) =>
    format === "bdt" ? "৳" + Math.round(n).toLocaleString("en-IN") : Math.round(n).toLocaleString("en-IN");

  useEffect(() => {
    if (!inView || !ref.current || reduce) return;
    const el = ref.current;
    const controls = animate(0, value, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (n) => {
        el.textContent = fmt(n);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, reduce]);

  return (
    <span ref={ref} className="tabular-nums">
      {fmt(value)}
    </span>
  );
}
