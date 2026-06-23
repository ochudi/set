"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Hero. Plain by design: no glow, no grain, no oversized wordmark. The type
 * scale and spacing carry it. A short staggered fade in on load, held after,
 * fully static under reduced motion. Opacity and transform only, so nothing
 * reflows.
 */
export function Hero() {
  const reduce = useReducedMotion();

  const items = [
    { initial: { opacity: 0, y: 12 }, delay: 0 },
    { initial: { opacity: 0, y: 12 }, delay: 0.07 },
    { initial: { opacity: 0, y: 10 }, delay: 0.14 },
    { initial: { opacity: 0, y: 10 }, delay: 0.21 },
  ];

  const animate = reduce ? undefined : { opacity: 1, y: 0 };
  const initialFor = (i: number) => (reduce ? false : items[i].initial);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-start gap-6 px-6 py-28 sm:py-36">
      <motion.span
        initial={initialFor(0)}
        animate={animate}
        transition={{ duration: 0.4, ease: EASE, delay: items[0].delay }}
        className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 font-mono text-xs tracking-tight text-muted-foreground"
      >
        <span className="size-1.5 rounded-full bg-brand" aria-hidden />
        PAU Alumni Association
      </motion.span>

      <motion.h1
        initial={initialFor(1)}
        animate={animate}
        transition={{ duration: 0.5, ease: EASE, delay: items[1].delay }}
        className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl"
      >
        Your set, in one place.
      </motion.h1>

      <motion.p
        initial={initialFor(2)}
        animate={animate}
        transition={{ duration: 0.45, ease: EASE, delay: items[2].delay }}
        className="max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg"
      >
        Set is the members-only home of the PAU Alumni Association. Find
        classmates, show up for reunions, and back the causes your community is
        raising for.
      </motion.p>

      <motion.div
        initial={initialFor(3)}
        animate={animate}
        transition={{ duration: 0.45, ease: EASE, delay: items[3].delay }}
        className="mt-2"
      >
        <Button
          asChild
          size="lg"
          className="h-11 px-6 text-base transition-transform duration-200 hover:-translate-y-0.5"
        >
          <Link href="/login">Sign in</Link>
        </Button>
      </motion.div>
    </section>
  );
}
