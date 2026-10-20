import type { ReactNode } from "react";
import { CheckCircle2Icon } from "lucide-react";

import { FeedbackState } from "@/components/feedback/feedback-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SuccessState({
  title,
  description,
  action,
  layout = "panel",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  layout?: "panel" | "alert";
}) {
  if (layout === "alert") {
    return (
      <Alert variant="success">
        <CheckCircle2Icon />
        <AlertTitle>{title}</AlertTitle>
        {description ? <AlertDescription>{description}</AlertDescription> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </Alert>
    );
  }

  return (
    <FeedbackState
      role="status"
      icon={<CheckCircle2Icon className="text-status-success-fg" />}
      title={title}
      description={description}
      actions={action}
    />
  );
}
