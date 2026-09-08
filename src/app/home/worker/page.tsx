import type { Metadata } from "next";
import { verifySession } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Worker home — Giggre",
};

export default async function WorkerHomePage() {
  await verifySession();

  return null;
}
