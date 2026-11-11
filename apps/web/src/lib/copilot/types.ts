import type {
  CopilotAnswerDto,
  CopilotClaimDto,
  CopilotEvidenceSummaryDto,
  CopilotPageType,
  CopilotSourceDto,
  CopilotStepDto,
  CopilotTurnDto,
  CopilotTurnStatus,
  QuickFactsDto,
} from "@infraos/shared-types";

export type {
  CopilotAnswerDto,
  CopilotClaimDto,
  CopilotEvidenceSummaryDto,
  CopilotPageType,
  CopilotSourceDto,
  CopilotStepDto,
  CopilotTurnDto,
  CopilotTurnStatus,
  QuickFactsDto,
};

export type CopilotPageContext = {
  type: CopilotPageType;
  recordId?: string;
  route: string;
  projectIdHint?: string;
};

export type CopilotSuggestionDto = {
  id: string;
  labelKey: string;
  prompt: string;
};

export type CopilotThreadSummaryDto = {
  threadId: string;
  title: string;
  lastAt: string;
  turnsCount: number;
};

export type CreateCopilotTurnPayload = {
  message: string;
  threadId?: string;
  pageContext?: {
    type: CopilotPageType;
    recordId?: string;
    route: string;
  };
};

export type FeedbackRating = "HELPFUL" | "NOT_HELPFUL";
export type FeedbackReason = "WRONG" | "MISSING_SOURCE" | "OUTDATED" | "UNCLEAR" | "OTHER";

export type SubmitCopilotFeedbackPayload = {
  rating: FeedbackRating;
  reason?: FeedbackReason;
  comment?: string;
};

