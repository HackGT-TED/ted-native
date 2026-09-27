/** A display token from the script. `key` is the normalized form used for matching. */
export type ScriptWord = { text: string; key: string };

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

// Speech recognition can't tell these apart, so a reader saying "to" may be
// transcribed as "two". Since tracking waits for the exact next word, a missed
// homophone would stall the highlight, so each group counts as one word.
const HOMOPHONES = [
  ['to', 'two', 'too'], ['for', 'four', 'fore'], ['one', 'won'], ['eight', 'ate'], ['there', 'their', 'theyre'],
  ['your', 'youre'], ['no', 'know'], ['new', 'knew'], ['right', 'write'], ['hear', 'here'],
  ['night', 'knight'], ['bear', 'bare'], ['by', 'buy', 'bye'], ['see', 'sea'], ['son', 'sun'], ['blue', 'blew'],
  ['red', 'read'], ['tail', 'tale'], ['wood', 'would'], ['hole', 'whole'], ['which', 'witch'], ['meet', 'meat'],
  ['pair', 'pear'], ['piece', 'peace'], ['dear', 'deer'], ['hair', 'hare'], ['flour', 'flower'], ['eye', 'i'],
  ['weather', 'whether'], ['road', 'rode'], ['plain', 'plane'], ['sail', 'sale'], ['week', 'weak'], ['oh', 'owe'],
].reduce((map, group) => { for (const word of group) map.set(word, group[0]); return map; }, new Map<string, string>());
const sound = (key: string) => HOMOPHONES.get(key) ?? key;

/**
 * Words up to four letters must match exactly (or as homophones), so "pear" never
 * passes for "bear"; longer ones tolerate about one recognition error per four letters.
 */
export function wordsMatch(spoken: string, expected: string): boolean {
  if (sound(spoken) === sound(expected)) return true;
  if (Math.min(spoken.length, expected.length) <= 4) return false;
  return 1 - distance(spoken, expected) / Math.max(spoken.length, expected.length) >= 0.75;
}

/**
 * Advances through the script with the recognized words, starting at `start`
 * (the index of the next expected word). The position only moves when the
 * expected word is heard: wrong words, filler, and backtracking are ignored, so
 * saying "three" where the script says "to" never jumps ahead to a later "three".
 * The one exception is reading on past a misheard word, which is followed.
 */
export function alignSpokenWords(words: ScriptWord[], spoken: string[], start: number): number {
  const keys = spoken.map(normalizeWord).filter(Boolean);
  let position = Math.max(0, Math.min(start, words.length));
  for (let i = 0; i < keys.length && position < words.length; i++) {
    const expected = words[position].key;
    if (wordsMatch(keys[i], expected)) {
      position++;
    } else if (i + 1 < keys.length && wordsMatch(keys[i] + keys[i + 1], expected)) {
      // The recognizer split one word in two ("ted ward" for "Tedward").
      position++;
      i++;
    } else if (position + 1 < words.length && wordsMatch(keys[i], expected + words[position + 1].key)) {
      // The recognizer joined two words into one ("everyone" for "every one").
      position += 2;
    } else {
      // The expected word was misheard (or misread) but the reader carried on: once the
      // following words are heard in order, move past it instead of stalling. A single
      // wrong word never qualifies, and backtracking says earlier words, not these.
      const run = carriedOn(words, keys, position + 1, i);
      if (run) {
        position += 1 + run;
        i += run - 1;
      }
    }
  }
  return position;
}

const distinctive = (key: string) => key.length >= 4 && !STOPWORDS.has(key);

/**
 * How many words starting at `from` were heard in order from `keys[i]`: 2 when one
 * of them is distinctive, 3 for common pairs like "of the", otherwise 0.
 */
function carriedOn(words: ScriptWord[], keys: string[], from: number, i: number): number {
  const heard = (n: number) => from + n <= words.length && i + n <= keys.length
    && Array.from({ length: n }, (_, k) => wordsMatch(keys[i + k], words[from + k].key)).every(Boolean);
  if (heard(2) && (distinctive(words[from].key) || distinctive(words[from + 1].key))) return 2;
  return heard(3) ? 3 : 0;
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
