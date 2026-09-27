import { supabase } from '../lib/supabase';

const LISTEN_URL = 'wss://api.deepgram.com/v1/listen';

/** Fetches a 30-second Deepgram token from the Expo API route for the signed-in user. */
export async function fetchDeepgramToken(signal?: AbortSignal): Promise<string> {
  const url = process.env.EXPO_PUBLIC_DEEPGRAM_TOKEN_URL?.trim() || '/api/deepgram-token';
  if (!supabase) throw new Error('Read-along isn’t available yet.');
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sign in to use read-along.');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    signal,
  });
  const body = await response.json().catch(() => null) as { token?: string; error?: string } | null;
  if (!response.ok || !body?.token) throw new Error(body?.error || 'Speech recognition is unavailable.');
  return body.token;
}

/** Streaming options tuned for following a reader word by word. */
export function listenUrl(sampleRate: number, keyterms: string[]): string {
  const params = new URLSearchParams({
    model: 'nova-3',
    language: 'en',
    encoding: 'linear16',
    sample_rate: String(sampleRate),
    channels: '1',
    // Interim results arrive while a word is still being spoken; finals only at pauses.
    interim_results: 'true',
    // Raw lowercase words match the script more reliably than formatted text.
    punctuate: 'false',
    smart_format: 'false',
  });
  for (const term of keyterms) params.append('keyterm', term);
  return `${LISTEN_URL}?${params}`;
}

export type DeepgramResult = {
  type: 'Results';
  is_final: boolean;
  speech_final: boolean;
  channel: { alternatives: { transcript: string; words: { word: string; start: number; end: number; confidence: number }[] }[] };
};
