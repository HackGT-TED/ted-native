import { createClient } from "@supabase/supabase-js";

const GRANT_URL = "https://api.deepgram.com/v1/auth/grant";
// The token only has to be valid while the WebSocket opens; the socket stays up after it expires.
const TTL_SECONDS = 30;

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Exchanges a signed-in Supabase session for a short-lived Deepgram token so the
 * long-lived DEEPGRAM_API_KEY stays on the server and never ships in the app bundle.
 */
export async function POST(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return error("Sign in to use read-along.", 401);

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const deepgramKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!url || !key || !deepgramKey) return error("Read-along is not configured.", 503);

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return error("Your session expired. Please sign in again.", 401);

    const response = await fetch(GRANT_URL, {
      method: "POST",
      headers: { Authorization: `Token ${deepgramKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl_seconds: TTL_SECONDS }),
      signal: request.signal,
    });
    if (!response.ok) {
      // 401/403 here means the key is wrong or lacks Member permissions. Never log the key.
      console.error("[deepgram-token]", { status: response.status });
      return error("Speech recognition is unavailable. Please try again.", 502);
    }
    const grant = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!grant.access_token) return error("Speech recognition is unavailable. Please try again.", 502);
    return Response.json(
      { token: grant.access_token, expiresIn: grant.expires_in ?? TTL_SECONDS },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return error("Speech recognition is unavailable. Please try again.", 502);
  }
}
