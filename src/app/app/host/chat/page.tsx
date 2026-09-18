"use client";

import { Suspense } from "react";
import ChatPage from "@/components/ChatPage";

export default function HostChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPage />
    </Suspense>
  );
}
