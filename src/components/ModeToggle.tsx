"use client";

import { motion } from "framer-motion";
import { Mode, modeCopy } from "@/lib/content";

export default function ModeToggle({
  mode,
  onChange,
  className = "",
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  className?: string;
}) {
  const options: Mode[] = ["worker", "host"];

  return (
    <div className={`inline-flex flex-col items-start gap-3 ${className}`}>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="inline-flex items-center gap-2 rounded-full border border-hairline bg-paper px-3 py-1 font-[var(--font-mono)] text-xs text-muted"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="absolute h-full w-full rounded-full opacity-75"
            style={{
              background: modeCopy[mode].accentStart,
              animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite",
            }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: modeCopy[mode].accentStart }}
          />
        </span>
        {modeCopy[mode].eyebrow}
      </motion.span>

      <div
        className="relative inline-flex rounded-full border border-hairline bg-paper p-1"
        role="tablist"
        aria-label="Choose your role"
      >
        {options.map((opt) => {
          const active = mode === opt;
          return (
            <button
              key={opt}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(opt)}
              className="relative z-10 rounded-full px-4 py-2 text-sm font-medium transition-colors sm:px-5"
              style={{ color: active ? "#fff" : "var(--muted)" }}
            >
              {active && (
                <motion.span
                  layoutId="mode-pill"
                  className="absolute inset-0 -z-10 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${modeCopy[opt].accentStart}, ${modeCopy[opt].accentEnd})`,
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative">{modeCopy[opt].label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
