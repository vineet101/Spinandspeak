import type { IssueTag } from "@spin-and-speak/domain";

export const ISSUE_LABELS: Record<IssueTag, string> = {
  too_many_fillers: "filler words",
  long_pauses: "long pauses",
  too_many_restarts: "restarts and repetitions",
  low_continuity: "keeping the speech going",
  low_volume: "voice projection",
  monotone_delivery: "vocal variety",
  rushed_delivery: "rushing",
  weak_opening: "opening strongly",
  weak_ending: "ending clearly",
  poor_time_management: "time management",
  ideas_not_developed: "developing ideas",
  dropped_word_endings: "clear word endings"
};

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
