import { execFile } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { env } from "./env";
import { randomToken, sha256 } from "./crypto";

const run = promisify(execFile);

export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 300;

export function audioPath(storageKey: string) {
  if (!/^[\w-]+\/[\w-]+\.mp3$/.test(storageKey)) throw new Error("Bad storage key");
  return path.resolve(env.audioDir, storageKey);
}

/** Validate an uploaded file is real audio, then transcode to telephony-friendly mono MP3. */
export async function ingestAudio(tenantId: string, buf: Buffer, originalName: string) {
  if (buf.length > MAX_AUDIO_BYTES) throw new Error("File is larger than 20 MB");
  const ext = path.extname(originalName).toLowerCase();
  if (![".mp3", ".wav", ".m4a", ".ogg", ".aac"].includes(ext)) throw new Error("Only MP3, WAV, M4A, OGG or AAC files are allowed");
  const tmpDir = path.resolve(env.audioDir, "_tmp");
  await mkdir(tmpDir, { recursive: true });
  const id = randomToken(12).replace(/[^\w]/g, "x");
  const src = path.join(tmpDir, `${id}${ext}`);
  await writeFile(src, buf);
  try {
    let probe: { format?: { duration?: string }; streams?: { codec_type?: string; codec_name?: string }[] };
    try {
      const { stdout } = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", src], { timeout: 30000 });
      probe = JSON.parse(stdout);
    } catch {
      throw new Error("File could not be read as audio");
    }
    const a = probe.streams?.find((s) => s.codec_type === "audio");
    if (!a || probe.streams?.some((s) => s.codec_type === "video" && s.codec_name !== "mjpeg" && s.codec_name !== "png"))
      throw new Error("File must contain a single audio track");
    const dur = Number(probe.format?.duration ?? 0);
    if (!dur || dur < 1) throw new Error("Audio is shorter than 1 second");
    if (dur > MAX_AUDIO_SECONDS) throw new Error("Audio is longer than 5 minutes");
    const dir = path.resolve(env.audioDir, tenantId.replace(/[^\w-]/g, ""));
    await mkdir(dir, { recursive: true });
    const storageKey = `${tenantId.replace(/[^\w-]/g, "")}/${id}.mp3`;
    const out = audioPath(storageKey);
    await run("ffmpeg", ["-y", "-v", "error", "-i", src, "-vn", "-map_metadata", "-1", "-ac", "1", "-ar", "16000", "-b:a", "48k", out], { timeout: 120000 });
    const outBuf = await readFile(out);
    const st = await stat(out);
    return { storageKey, sha256: sha256(buf), sizeBytes: st.size, durationSeconds: Math.round(dur * 10) / 10, codec: `mp3 (from ${a.codec_name})`, bytes: outBuf.length };
  } finally {
    await rm(src, { force: true });
  }
}
