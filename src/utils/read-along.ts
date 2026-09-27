/** A display token from the script. `key` is the normalized form used for matching. */
export type ScriptWord = { text: string; key: string };

/** Script positions are "next expected word" indices; the current word is `position - 1`. */
export type Alignment = { position: number; relocated: boolean };

// How far ahead a spoken word may land when the reader skips words or the recognizer drops them.
const MAX_SKIP = 6;
// Consecutive unmatched words before searching the whole script for where the reader went.
const RELOCATE_AFTER = 3;
const RELOCATE_WINDOW = 3;
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'had', 'has', 'have', 'he',
  'her', 'his', 'i', 'in', 'is', 'it', 'its', 'me', 'my', 'no', 'not', 'of', 'on', 'or', 'said', 'she',
  'so', 'that', 'the', 'their', 'them', 'then', 'there', 'they', 'this', 'to', 'up', 'was', 'we',
  'were', 'what', 'when', 'with', 'you', 'your',
]);
const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

/** Lowercase, strip accents and punctuation, and spell out small numbers so "3" matches "three". */
export function normalizeWord(word: string): string {
  const key = word.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return /^\d+$/.test(key) && Number(key) <= 20 ? NUMBERS[Number(key)] : key;
}

/** Splits a script into words, attaching stray punctuation (em dashes, quotes) to a neighbor. */
export function tokenizeScript(script: string): ScriptWord[] {
  const words: ScriptWord[] = [];
  let pending = '';
  for (const text of script.split(/\s+/).filter(Boolean)) {
    const key = normalizeWord(text);
    if (!key) {
      if (words.length) words[words.length - 1].text += ` ${text}`;
      else pending += `${text} `;
      continue;
    }
    words.push({ text: pending + text, key });
    pending = '';
  }
  return words;
}

function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return previous[b.length];
}

/** Short words must match exactly; longer ones tolerate about one error per four letters. */
export function wordsMatch(spoken: string, expected: string): boolean {
  if (spoken === expected) return true;
  if (Math.min(spoken.length, expected.length) <= 3) return false;
  return 1 - distance(spoken, expected) / Math.max(spoken.length, expected.length) >= 0.75;
}

const distinctive = (key: string) => key.length >= 4 && !STOPWORDS.has(key);

/** Finds the occurrence of the phrase nearest to `near`, or -1. Returns the index after the phrase. */
function locate(words: ScriptWord[], phrase: string[], near: number): number {
  let best = -1;
  for (let start = 0; start + phrase.length <= words.length; start++) {
    if (!phrase.every((key, i) => wordsMatch(key, words[start + i].key))) continue;
    const end = start + phrase.length;
    if (best === -1 || Math.abs(end - near) < Math.abs(best - near)) best = end;
  }
  return best;
}

/**
 * Advances through the script with the recognized words, starting at `start`.
 * Filler words and misrecognitions are ignored; small skips are followed; a
 * run of misses triggers a whole-script search so rereading or jumping recovers.
 */
export function alignSpokenWords(words: ScriptWord[], spoken: string[], start: number): Alignment {
  const keys = spoken.map(normalizeWord).filter(Boolean);
  let position = Math.max(0, Math.min(start, words.length));
  let misses = 0;
  let relocated = false;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    let match = -1;
    for (let j = position; j < Math.min(words.length, position + MAX_SKIP + 1); j++) {
      if (!wordsMatch(key, words[j].key)) continue;
      // Skipping ahead on a common word ("the", "and") is usually a false match,
      // so a skip needs a distinctive word or the next spoken word to agree.
      const confirmed = j - position <= 1 || distinctive(key)
        || (i + 1 < keys.length && j + 1 < words.length && wordsMatch(keys[i + 1], words[j + 1].key));
      if (confirmed) { match = j; break; }
    }
    if (match !== -1) {
      position = match + 1;
      misses = 0;
      continue;
    }
    // Repeating the word just read ("the... the dog") is not a miss.
    if (position > 0 && wordsMatch(key, words[position - 1].key)) continue;
    misses++;
    if (misses >= RELOCATE_AFTER && i + 1 >= RELOCATE_WINDOW) {
      const found = locate(words, keys.slice(i + 1 - RELOCATE_WINDOW, i + 1), position);
      if (found !== -1 && found !== position) {
        position = found;
        relocated = true;
      }
      misses = 0;
    }
  }
  return { position, relocated };
}

/** Rare words (names, long words) to pass to Deepgram as keyterms so they are recognized. */
export function scriptKeyterms(script: string, limit = 50): string[] {
  const seen = new Map<string, string>();
  for (const text of script.split(/\s+/)) {
    const word = text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    const key = normalizeWord(word);
    if (!key || seen.has(key) || STOPWORDS.has(key)) continue;
    if (/^\p{Lu}/u.test(word) && word.length > 2 || word.length >= 8) seen.set(key, word);
  }
  return [...seen.values()].slice(0, limit);
}
