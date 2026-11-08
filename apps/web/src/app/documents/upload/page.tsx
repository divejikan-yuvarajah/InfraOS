import type { Metadata } from "next";
import { Suspense } from "react";

import { UploadWizardPage } from "@/components/documents/upload-wizard";

export const metadata: Metadata = { title: "Upload documents · INFRAOS", robots: { index: false, follow: false } };

export default function UploadDocumentsPage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <UploadWizardPage />
    </Suspense>
  );
}
