"use client";

import { useEffect, useState } from "react";
import { Handshake } from "lucide-react";
import { loadSkillIcons } from "@/lib/gsin-task-types";

interface SkillIconProps {
  skillName?: string;
  size?: number;
  // Tints the icon via Iconify's own `color` query param (it renders the SVG
  // server-side with that fill, same effect as the app's ColorFilter tint) —
  // defaults to inheriting the surrounding text color like a normal icon.
  color?: string;
  className?: string;
}

// Mirrors SkillIcon in skill_icon.dart: the skill's admin-configured GSIN
// icon (see loadSkillIcons), or a generic handshake icon when none is set
// or it fails to load.
export default function SkillIcon({ skillName, size = 16, color, className }: SkillIconProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!skillName?.trim()) return;
    let cancelled = false;
    loadSkillIcons().then((icons) => {
      if (!cancelled) setUrl(icons.get(skillName.trim().toLowerCase()) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [skillName]);

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external Iconify SVG, not a static asset next/image can optimize
      <img
        src={color ? `${url}?color=${encodeURIComponent(color)}` : url}
        width={size}
        height={size}
        alt=""
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }
  return <Handshake size={size} className={className} />;
}
