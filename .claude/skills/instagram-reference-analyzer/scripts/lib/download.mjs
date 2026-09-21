import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DOWNLOAD_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extensionFromContentType(contentType) {
  if (!contentType) return ".jpg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  return ".jpg";
}

/**
 * Downloads each media item to outDir as slide_01.jpg, slide_02.jpg, ...
 * Never throws on an individual slide failure — each slide either
 * downloads or is recorded as failed, so a partial carousel still returns
 * whatever it could retrieve instead of aborting the whole post.
 *
 * @param {Array<{kind: string, remoteUrl: string, isVideo: boolean}>} media
 * @param {string} outDir
 * @returns {Promise<{ downloaded: Array<{index:number, kind:string, remoteUrl:string, localPath:string}>, failed: Array<{index:number, remoteUrl:string, reason:string}> }>}
 */
export async function downloadMedia(media, outDir) {
  await mkdir(outDir, { recursive: true });

  const downloaded = [];
  const failed = [];

  for (let i = 0; i < media.length; i++) {
    const item = media[i];
    const index = i + 1;
    let lastReason = "unknown error";
    let success = false;

    for (let attempt = 0; attempt <= MAX_RETRIES && !success; attempt++) {
      if (attempt > 0) await sleep(1000 * attempt);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
      try {
        const res = await fetch(item.remoteUrl, { signal: controller.signal });
        if (!res.ok) {
          lastReason = `HTTP ${res.status}`;
          continue;
        }
        const contentType = res.headers.get("content-type") || "";
        const buffer = Buffer.from(await res.arrayBuffer());
        const filename = `slide_${String(index).padStart(2, "0")}${extensionFromContentType(contentType)}`;
        const localPath = path.join(outDir, filename);
        await writeFile(localPath, buffer);
        downloaded.push({ index, kind: item.kind, remoteUrl: item.remoteUrl, localPath });
        success = true;
      } catch (err) {
        lastReason = err.name === "AbortError" ? "timeout" : err.message;
      } finally {
        clearTimeout(timer);
      }
    }

    if (!success) {
      failed.push({ index, remoteUrl: item.remoteUrl, reason: lastReason });
    }
  }

  return { downloaded, failed };
}
