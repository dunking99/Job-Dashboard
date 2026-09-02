import { wordCount } from "./utils";

/**
 * Structural analysis of a practice answer, with no AI involved.
 *
 * This runs first for two reasons: practice stays useful with no API key, and
 * the model is never asked to do things it is bad at and a regex is good at —
 * counting words, spotting filler, checking a number is present.
 */
export function analyseAnswerStructure(answer: string) {
  const lower = answer.toLowerCase();
  const words = wordCount(answer);

  const hasResult =
    /\b(result|outcome|led to|meant that|as a result|which (?:cut|reduced|increased|raised|saved)|ended up|in the end)\b/.test(
      lower
    );
  const hasAction =
    /\b(i |we )(?:built|ran|wrote|set up|organised|organized|analysed|analyzed|designed|led|created|introduced|rebuilt|coordinated|proposed|rewrote|restructured)/.test(
      lower
    );
  const hasSituation =
    /\b(the (?:problem|issue|situation|challenge|backlog|team|office|context)|at the time|when i|during my|we had)\b/.test(
      lower
    );
  const hasTask =
    /\b(i was (?:asked|responsible|tasked)|my (?:job|role|responsibility)|needed to|had to|was expected to)\b/.test(
      lower
    );
  const hasNumber = /\d|£|%/.test(answer);

  const fillers = (
    lower.match(/\b(basically|obviously|kind of|sort of|you know|literally|just|really|actually)\b/g) ?? []
  ).length;

  return {
    words,
    hasSituation,
    hasTask,
    hasAction,
    hasResult,
    hasNumber,
    fillers,
    lengthVerdict: words < 90 ? "short" : words > 380 ? "long" : "about right",
  };
}
