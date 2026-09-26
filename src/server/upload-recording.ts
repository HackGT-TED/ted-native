import { createClient } from "@supabase/supabase-js";

const BUCKET = "recordings";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + 64 * 1024;
const AUDIO_TYPES: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
};

function error(message: string, status: number, code?: string) {
  return Response.json({ error: message, ...(code ? { code } : {}) }, { status });
}

function storageFailure(cause: {
  message?: string; status?: number; statusCode?: string; code?: string;
} | null): Response {
  const storageStatus = Number(cause?.statusCode) || cause?.status;
  const message = cause?.message ?? '';
  let code = 'STORAGE_UNAVAILABLE';
  let status = 502;
  let description = 'Recording storage is unavailable. Please try again.';

  if (cause?.code === 'NoSuchBucket' || /bucket.*(?:not found|does not exist)/i.test(message)) {
    code = 'STORAGE_BUCKET_UNAVAILABLE';
    status = 503;
    description = 'Recording storage has not been set up or is inaccessible.';
  } else if (cause?.code === 'InvalidJWT' || storageStatus === 401) {
    code = 'STORAGE_SESSION_EXPIRED';
    status = 401;
    description = 'Your session expired. Please sign in again.';
  } else if (cause?.code === 'AccessDenied' || storageStatus === 403 || /row.level security|permission denied/i.test(message)) {
    code = 'STORAGE_ACCESS_DENIED';
    status = 403;
    description = 'Your account does not have permission to upload recordings.';
  } else if (cause?.code === 'EntityTooLarge' || storageStatus === 413) {
    code = 'STORAGE_FILE_TOO_LARGE';
    status = 413;
    description = 'This recording exceeds the storage upload limit. Try a shorter take.';
  } else if (cause?.code === 'InvalidMimeType' || /mime.*(?:not supported|not allowed|invalid)/i.test(message)) {
    code = 'STORAGE_AUDIO_TYPE_REJECTED';
    status = 415;
    description = 'Recording storage does not accept this audio format.';
  }
  // Log a safe classification, never tokens, recording content, or raw errors.
  console.error('[recording-upload]', { code, storageStatus, description });
  return error(description, status, code);
}

// Bound the actual stream as well as Content-Length: chunked uploads may omit it.
async function readFormData(request: Request): Promise<FormData | Response> {
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) {
    return error("Recordings must be 25 MB or smaller.", 413);
  }
  if (!request.body) return error("A recording is required.", 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return error("Recordings must be 25 MB or smaller.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  // React Native also declares Response.formData() using its upload-only type.
  // API routes run on the server, where parsing returns standard Web FormData.
  return new Response(bytes, {
    headers: { "Content-Type": request.headers.get("content-type")! },
  }).formData() as unknown as Promise<FormData>;
}

export async function POST(request: Request): Promise<Response> {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return error("Sign in to upload recordings.", 401);

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return error("Recording storage is not configured.", 503);

  try {
    // A new client per request prevents sessions leaking between users. Storage
    // uses the caller's JWT and RLS; no service-role key or admin bypass is used.
    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: `Bearer ${token}` },
        fetch: (input, init) =>
          fetch(input, { ...init, signal: request.signal }),
      },
    });
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user)
      return error("Your session expired. Please sign in again.", 401);

    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("multipart/form-data;")
    ) {
      return error("Send the recording as multipart/form-data.", 415);
    }
    let form: FormData | Response;
    try {
      form = await readFormData(request);
    } catch {
      return error("The upload body could not be read.", 400);
    }
    if (form instanceof Response) return form;

    const audio = form.get("audio");
    const title = form.get("title");
    const duration = form.get("durationMs");
    if (!audio || typeof audio === "string" || audio.size === 0) {
      return error("A non-empty audio file is required.", 400);
    }
    if (audio.size > MAX_AUDIO_BYTES)
      return error("Recordings must be 25 MB or smaller.", 413);
    const contentType = audio.type.split(";")[0].trim().toLowerCase();
    const extension = AUDIO_TYPES[contentType];
    if (!extension)
      return error("Upload an M4A, WebM, or Ogg audio recording.", 415);
    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 80
    ) {
      return error("A title between 1 and 80 characters is required.", 400);
    }
    if (
      typeof duration !== "string" ||
      !/^\d+$/.test(duration) ||
      !Number.isSafeInteger(Number(duration)) ||
      Number(duration) <= 0
    ) {
      return error("durationMs must be a positive integer.", 400);
    }

    const creationSessionId = form.get('creationSessionId');
    if (creationSessionId !== null && (typeof creationSessionId !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(creationSessionId))) {
      return error('Invalid story project identity.', 400);
    }
    const durationMs = Number(duration);
    const id = form.get('id') ?? crypto.randomUUID();
    const recordedAt = form.get('recordedAt') ?? new Date().toISOString();
    const position = form.get('position') ?? String(Date.now());
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(id)
      || typeof recordedAt !== 'string' || !Number.isFinite(Date.parse(recordedAt))
      || typeof position !== 'string' || !/^\d+$/.test(position) || !Number.isSafeInteger(Number(position))) {
      return error('Invalid recording identity, timestamp, or position.', 400);
    }
    const path = `${auth.user.id}/${id}.${extension}`;
    const { data, error: storageError } = await supabase.storage
      .from(BUCKET)
      .upload(path, await audio.arrayBuffer(), {
        contentType,
        upsert: false,
        metadata: { title: title.trim(), durationMs, recordedAt, position: Number(position), segmentId: id },
      });
    // Immutable deterministic paths make retries safe after a lost response or
    // metadata failure. Never replace the original audio on a retry.
    const duplicate = storageError && (storageError.statusCode === '409' || storageError.message === 'The resource already exists');
    if ((storageError && !duplicate) || (!data && !duplicate)) return storageFailure(storageError);
    const { error: metadataError } = await supabase.from('recording_segments').upsert({
      id, user_id: auth.user.id, creation_session_id: creationSessionId, storage_path: path,
      title: title.trim(), recorded_at: new Date(recordedAt).toISOString(),
      duration_ms: durationMs, position: Number(position),
    }, { onConflict: 'user_id,id', ignoreDuplicates: true });
    if (metadataError) return error('Your audio is stored, but the timeline could not sync. Please retry.', 502);

    return Response.json(
      {
        id,
        bucket: BUCKET,
        path,
        title: title.trim(),
        durationMs,
        contentType,
        size: audio.size,
      },
      { status: 201 },
    );
  } catch {
    return error("Recording storage is unavailable. Please try again.", 502);
  }
}
