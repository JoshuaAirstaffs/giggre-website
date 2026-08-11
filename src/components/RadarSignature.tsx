"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, animate, useMotionValue } from "framer-motion";
import type { MotionValue } from "framer-motion";
import { Mode, modeCopy } from "@/lib/content";

const SIZE = 440;
const CENTER = SIZE / 2;
const MAX_R = 190;
const RINGS = [0.35, 0.62, 0.88, 1];
const SWEEP_WIDTH = 40;

function toXY(angleDeg: number, radiusFrac: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + Math.cos(rad) * radiusFrac * MAX_R,
    y: CENTER + Math.sin(rad) * radiusFrac * MAX_R,
  };
}

function useSweepOpacity(rotate: MotionValue<number>, angle: number, restingOpacity: number) {
  const opacity = useMotionValue(restingOpacity);
  const wasActive = useRef(false);

  useEffect(() => {
    const unsubscribe = rotate.on("change", (latest) => {
      const rel = ((angle - latest) % 360 + 360) % 360;
      const active = rel <= SWEEP_WIDTH;
      if (active !== wasActive.current) {
        wasActive.current = active;
        animate(opacity, active ? 1 : restingOpacity, {
          duration: active ? 0.4 : 0.9,
          ease: active ? "easeOut" : "easeIn",
        });
      }
    });
    return unsubscribe;
  }, [rotate, angle, opacity, restingOpacity]);

  return opacity;
}

function RadarPinDot({
  pin,
  rotate,
  fill,
}: {
  pin: { angle: number; radius: number };
  rotate: MotionValue<number>;
  fill: string;
}) {
  const opacity = useSweepOpacity(rotate, pin.angle, 0);
  const { x, y } = toXY(pin.angle, pin.radius);

  return (
    <motion.g style={{ opacity }}>
      <circle cx={x} cy={y} r={5} fill={fill} />
      <circle cx={x} cy={y} r={9} fill="none" stroke={fill} strokeWidth={1} opacity={0.4} />
    </motion.g>
  );
}

function RadarPinLabel({
  pin,
  rotate,
  accentText,
}: {
  pin: { label: string; meta: string; angle: number; radius: number };
  rotate: MotionValue<number>;
  accentText: string;
}) {
  const opacity = useSweepOpacity(rotate, pin.angle, 0);

  const { x, y } = toXY(pin.angle, pin.radius);
  const leftPct = (x / SIZE) * 100;
  const topPct = (y / SIZE) * 100;
  const flip = leftPct > 55;

  return (
    <motion.div
      initial={{ y: 4 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute w-max rounded-lg border border-hairline bg-paper px-2.5 py-1.5 text-xs shadow-sm"
      style={{
        opacity,
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: `translate(${flip ? "-100%" : "0%"}, -50%) translateX(${
          flip ? "-10px" : "10px"
        })`,
      }}
    >
      <div className="font-medium text-ink">{pin.label}</div>
      <div className="font-[var(--font-mono)] text-[11px]" style={{ color: accentText }}>
        {pin.meta}
      </div>
    </motion.div>
  );
}

export default function RadarSignature({ mode }: { mode: Mode }) {
  const data = modeCopy[mode];
  const rotate = useMotionValue(0);

  useEffect(() => {
    const controls = animate(rotate, 360, {
      duration: 6,
      repeat: Infinity,
      ease: "linear",
    });
    return () => controls.stop();
  }, [rotate]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[440px]">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-full w-full"
        role="img"
        aria-label={
          mode === "worker"
            ? "Radar showing nearby gigs a worker could take"
            : "Radar showing nearby verified workers a host could hire"
        }
      >
        <defs>
          <radialGradient id="sweepFade" cx="0%" cy="0%" r="100%">
            <stop offset="0%" stopColor={data.accentStart} stopOpacity="0.5" />
            <stop offset="100%" stopColor={data.accentStart} stopOpacity="0" />
          </radialGradient>
        </defs>

        {RINGS.map((r, i) => (
          <circle
            key={i}
            cx={CENTER}
            cy={CENTER}
            r={r * MAX_R}
            fill="none"
            stroke="var(--hairline)"
            strokeWidth={1}
          />
        ))}

        <motion.g
          style={{
            rotate,
            transformBox: "view-box",
            transformOrigin: `${CENTER}px ${CENTER}px`,
          }}
        >
          <path
            d={`M ${CENTER} ${CENTER} L ${CENTER + MAX_R} ${CENTER} A ${MAX_R} ${MAX_R} 0 0 1 ${
              CENTER + MAX_R * Math.cos((40 * Math.PI) / 180)
            } ${CENTER + MAX_R * Math.sin((40 * Math.PI) / 180)} Z`}
            fill="url(#sweepFade)"
          />
        </motion.g>

        <circle cx={CENTER} cy={CENTER} r={7} fill={data.accentStart} />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={13}
          fill="none"
          stroke={data.accentStart}
          strokeWidth={1.5}
          opacity={0.5}
        />

        <AnimatePresence mode="wait">
          <g key={mode}>
            {data.radarPins.map((pin) => (
              <RadarPinDot key={pin.label} pin={pin} rotate={rotate} fill={data.accentEnd} />
            ))}
          </g>
        </AnimatePresence>
      </svg>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none absolute inset-0"
        >
          {data.radarPins.map((pin) => (
            <RadarPinLabel key={pin.label} pin={pin} rotate={rotate} accentText={data.accentText} />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
