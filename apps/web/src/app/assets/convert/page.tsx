import type { Metadata } from "next";
import { Suspense } from "react";

import { ConvertWizard } from "@/components/assets/convert-wizard";

export const metadata: Metadata = { title: "Convert project · INFRAOS", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ConvertWizard />
    </Suspense>
  );
}
