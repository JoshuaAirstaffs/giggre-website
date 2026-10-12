"use client";

import { useAppSelector } from "@/store/hooks";

export default function RoleHeading() {
  const { authUser, profile } = useAppSelector((root) => root.user);
  const name = profile?.name ?? authUser?.displayName ?? "";
  const firstName = name.trim().split(" ")[0];

  return (
    <>
      <h1 className="text-center font-[var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {firstName ? `How do you want to continue, ${firstName}?` : "How do you want to continue?"}
      </h1>
      <p className="mt-3 text-center text-muted">
        You can switch anytime — this just sets up your view for now.
      </p>
    </>
  );
}
