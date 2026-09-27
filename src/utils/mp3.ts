import { Mp3Encoder } from '@breezystack/lamejs';

// 48 kbps is clear for 16 kHz speech and about 360 KB a minute.
const KBPS = 48;

/**
 * Encodes 16-bit little-endian mono PCM to MP3 as it arrives, so a long take is
 * encoded a buffer at a time instead of in one blocking pass when it ends.
 */
export function createMp3Writer(sampleRate: number) {
  const encoder = new Mp3Encoder(1, sampleRate, KBPS);
  const parts: Uint8Array[] = [];
  let size = 0;
  const keep = (part: ArrayLike<number> & { buffer: ArrayBufferLike; byteOffset: number; length: number }) => {
    if (!part.length) return;
    parts.push(new Uint8Array(part.buffer, part.byteOffset, part.length));
    size += part.length;
  };
  return {
    write(pcm: ArrayBuffer) {
      keep(encoder.encodeBuffer(new Int16Array(pcm)));
    },
    /** Flushes the encoder and returns the whole MP3 file. */
    finish(): Uint8Array {
      keep(encoder.flush());
      const file = new Uint8Array(size);
      let offset = 0;
      for (const part of parts) {
        file.set(part, offset);
        offset += part.length;
      }
      return file;
    },
  };
}
