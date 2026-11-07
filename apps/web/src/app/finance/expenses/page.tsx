import type { Metadata } from "next";
import { Suspense } from "react";

import { ExpenseRegister } from "@/components/finance/expense-register";

export const metadata: Metadata = {
  title: "Expense register · INFRAOS",
  robots: { index: false, follow: false },
};

export default function ExpenseRegisterPage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ExpenseRegister />
    </Suspense>
  );
}
