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

    const durationMs = Number(duration);
    const path = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;
    const { data, error: storageError } = await supabase.storage
      .from(BUCKET)
      .upload(path, await audio.arrayBuffer(), {
        contentType,
        upsert: false,
        metadata: { title: title.trim(), durationMs },
      });
    if (storageError || !data) return storageFailure(storageError);

    return Response.json(
      {
        id: data.id,
        bucket: BUCKET,
        path: data.path,
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
