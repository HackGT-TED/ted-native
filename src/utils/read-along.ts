/**
 * A display token from the script. `key` is the normalized form used for matching;
 * `paragraph` is the index of the paragraph it belongs to (blank lines separate them).
 */
export type ScriptWord = { text: string; key: string; paragraph: number };

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

/**
 * Splits a script into words, keeping paragraphs (separated by blank lines) and
 * attaching stray punctuation (em dashes, quotes) to a neighboring word.
 */
export function tokenizeScript(script: string): ScriptWord[] {
  const words: ScriptWord[] = [];
  let paragraph = -1;
  for (const block of script.split(/\n\s*\n/)) {
    const tokens = block.split(/\s+/).filter(Boolean);
    if (!tokens.some(normalizeWord)) continue;
    paragraph++;
    let pending = '';
    for (const text of tokens) {
      const key = normalizeWord(text);
      const previous = words[words.length - 1];
      if (!key) {
        if (previous?.paragraph === paragraph) previous.text += ` ${text}`;
        else pending += `${text} `;
        continue;
      }
      words.push({ text: pending + text, key, paragraph });
      pending = '';
    }
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

const VOWELS = /[aeiouy]/;

/** "gray"/"grey", "colour"/"color": spellings that differ in a single vowel. */
function vowelVariant(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let differences = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (!VOWELS.test(a[i]) || !VOWELS.test(b[i]) || ++differences > 1) return false;
  }
  return differences === 1;
}

/**
 * Short words must match exactly, as homophones, or as one-vowel spelling variants
 * ("gray"/"grey"), so "pear" never passes for "bear"; words of five or more letters
 * tolerate about one recognition error per four letters.
 */
export function wordsMatch(spoken: string, expected: string): boolean {
  if (sound(spoken) === sound(expected)) return true;
  if (Math.min(spoken.length, expected.length) >= 4 && vowelVariant(spoken, expected)) return true;
  if (Math.min(spoken.length, expected.length) <= 4) return false;
  return 1 - distance(spoken, expected) / Math.max(spoken.length, expected.length) >= 0.75;
}

/**
 * `position` is the index of the next expected word. `unmatched` holds the words
 * heard since the last one that moved the position, so a recovery can still use
 * them when the rest of the phrase arrives in Deepgram's next result.
 */
export type Alignment = { position: number; unmatched: string[] };

// How many script words past the expected one to look for the reader carrying on.
const MAX_GAP = 3;

/**
 * Advances through the script with the recognized words, starting at `start`
 * (the index of the next expected word). A wrong word, filler, or backtracking never
 * moves the position, so saying "three" where the script says "to" doesn't jump to a
 * later "three". But when the reader carries on and the next few words match, the
 * position follows them past words that were misheard, misread, or skipped.
 */
export function alignSpokenWords(words: ScriptWord[], spoken: string[], start: number): Alignment {
  const keys = spoken.map(normalizeWord).filter(Boolean);
  let position = Math.max(0, Math.min(start, words.length));
  let lastMove = 0;
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
      const recovery = carriedOn(words, keys, position, i);
      if (!recovery) continue;
      position = recovery.position;
      i += recovery.heard - 1;
    }
    lastMove = i + 1;
  }
  return { position, unmatched: keys.slice(lastMove) };
}

const distinctive = (key: string | undefined) => !!key && key.length >= 4 && !STOPWORDS.has(key);

/**
 * Whether the words from `keys[i]` match the script a little past `position`: two in a
 * row right after the expected word when one of them is distinctive, otherwise three
 * (common pairs like "of the" appear everywhere). Backtracking says earlier words, so
 * it can't qualify, and a single wrong word never does.
 */
function carriedOn(words: ScriptWord[], keys: string[], position: number, i: number) {
  const heard = (from: number, n: number) => from + n <= words.length && i + n <= keys.length
    && Array.from({ length: n }, (_, k) => wordsMatch(keys[i + k], words[from + k].key)).every(Boolean);
  for (let gap = 1; gap <= MAX_GAP; gap++) {
    const from = position + gap;
    const needed = gap === 1 && (distinctive(words[from]?.key) || distinctive(words[from + 1]?.key)) ? 2 : 3;
    if (heard(from, needed)) return { position: from + needed, heard: needed };
  }
  return null;
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
