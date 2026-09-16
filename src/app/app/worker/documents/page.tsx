"use client";

import ComingSoonPage from "@/components/ComingSoonPage";
// The full Documents page (upload + verification flow, mirroring the
// mobile app) already exists at src/components/DocumentsPage.tsx — kept
// here, not deleted, but intentionally not wired in yet. Swap the import
// below back in once the page is ready to ship.
// import DocumentsPage from "@/components/DocumentsPage";

export default function WorkerDocumentsPage() {
  return <ComingSoonPage title="Documents" description="Upload your ID and supporting documents to get verified" />;
  // return <DocumentsPage />;
}
