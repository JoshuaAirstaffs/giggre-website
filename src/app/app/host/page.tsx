import type { Metadata } from "next";
import { verifySession } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Host home — Giggre",
};

export default async function HostHomePage() {
  await verifySession();

  return null;
}
