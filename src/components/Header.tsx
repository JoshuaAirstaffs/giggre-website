"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 border-b border-hairline bg-mist/80 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center">
          <Image
            src="/assets/giggre_logo.png"
            alt="Giggre"
            width={120}
            height={57}
            className="h-8 w-auto"
            priority
          />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="#download"
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            Get the app
          </a>
        </div>
      </div>
    </motion.header>
  );
}
