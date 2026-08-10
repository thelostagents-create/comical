import { Filter } from "bad-words";

const filter = new Filter();

export function containsBlockedLanguage(text: string): boolean {
  return filter.isProfane(text);
}
