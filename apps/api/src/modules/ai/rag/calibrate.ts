/** Recommends RAG_MIN_SCORE from labelled retrieval scores. Pure and honest: it reports overlap instead of hiding it, and never writes configuration. */
export type Recommendation = { recommended: number | null; separable: boolean; answerableMin: number | null; unanswerableMax: number | null; note: string };

export function recommendMinScore(answerable: number[], unanswerable: number[]): Recommendation {
  if (!answerable.length || !unanswerable.length) return { recommended: null, separable: false, answerableMin: null, unanswerableMax: null, note: "need both answerable and unanswerable samples" };
  const aMin = Math.min(...answerable);
  const uMax = Math.max(...unanswerable);
  if (aMin > uMax) return { recommended: Math.round(((aMin + uMax) / 2) * 100) / 100, separable: true, answerableMin: aMin, unanswerableMax: uMax, note: "classes are separable: midpoint of the gap" };
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  return { recommended: Math.round(((med(answerable) + med(unanswerable)) / 2) * 100) / 100, separable: false, answerableMin: aMin, unanswerableMax: uMax, note: "classes overlap: the value is the midpoint of the medians; expect some wrong refusals or some weak answers" };
}
