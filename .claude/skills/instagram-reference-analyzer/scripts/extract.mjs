#!/usr/bin/env node
// Instagram Reference Analyzer — media extraction CLI.
//
// Usage:
//   node extract.mjs <instagram_url> [--out-dir <dir>]
//
// Prints one JSON object to stdout and exits 0 on success (including
// partial success — see `warnings`), or exits 1 and prints a JSON object
// with `ok: false` and a classified `errorType` on failure. Never prints
// prose to stdout so callers (the skill's instructions) can parse it
// directly; diagnostics go to stderr.
//
// This script's only job is: URL in -> images on disk + metadata out.
// It knows nothing about vision analysis, report formatting, or ASPRVANO —
// that all happens afterward, when Claude reads the downloaded images.

import { parseInstagramUrl } from "./lib/url.mjs";
import { getProvider, ProviderError } from "./lib/providers/index.mjs";
import { downloadMedia } from "./lib/download.mjs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const SUPPORTED_FORMATS_MESSAGE =
  "Supported URL formats: https://www.instagram.com/p/<code>/, " +
  "https://instagram.com/p/<code>/, https://www.instagram.com/reel/<code>/, " +
  "https://www.instagram.com/reels/<code>/ (optionally prefixed with a username, " +
  "e.g. /username/p/<code>/). Tracking query parameters are ignored.";

function printResultAndExit(result) {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
}

async function main() {
  const [, , rawUrl, ...rest] = process.argv;
  if (!rawUrl) {
    printResultAndExit({
      ok: false,
      errorType: "unsupported_url",
      message: "No URL given. " + SUPPORTED_FORMATS_MESSAGE,
    });
    return;
  }

  let outDir = null;
  const outDirFlagIndex = rest.indexOf("--out-dir");
  if (outDirFlagIndex !== -1) outDir = rest[outDirFlagIndex + 1];
  if (!outDir) {
    outDir = path.join(
      process.env.TMPDIR || "/tmp",
      "instagram_reference",
      `run_${Date.now()}`
    );
  }

  const parsed = parseInstagramUrl(rawUrl);
  if (!parsed.ok) {
    printResultAndExit({
      ok: false,
      errorType: "unsupported_url",
      message: `Could not parse "${rawUrl}" as an Instagram post/reel URL. ` + SUPPORTED_FORMATS_MESSAGE,
    });
    return;
  }

  let extraction;
  try {
    const provider = getProvider();
    extraction = await provider(parsed);
  } catch (err) {
    if (err instanceof ProviderError) {
      printResultAndExit({ ok: false, errorType: err.type, message: err.message });
    } else {
      printResultAndExit({
        ok: false,
        errorType: "extraction_failed",
        message: `Unexpected error during extraction: ${err.stack || err.message}`,
      });
    }
    return;
  }

  const { downloaded, failed } = await downloadMedia(extraction.media, outDir);

  if (downloaded.length === 0) {
    printResultAndExit({
      ok: false,
      errorType: "extraction_failed",
      message:
        "Media URLs were extracted but every download attempt failed " +
        `(${failed.length} attempted). First failure: ${failed[0]?.reason}.`,
    });
    return;
  }

  const metadata = {
    sourceUrl: parsed.canonicalUrl,
    shortcode: parsed.shortcode,
    postType: extraction.postType,
    caption: extraction.caption,
    owner: extraction.owner,
    stats: extraction.stats,
    slideCountExpected: extraction.media.length,
    slideCountRetrieved: downloaded.length,
    slides: downloaded.map((d) => ({
      index: d.index,
      file: path.basename(d.localPath),
      kind: d.kind, // "image" | "video_thumbnail"
    })),
    failedSlides: failed,
  };

  await writeFile(
    path.join(outDir, "post_metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  const warnings = [];
  if (failed.length > 0) {
    warnings.push(
      `${failed.length} of ${extraction.media.length} slide(s) could not be downloaded and are excluded from analysis.`
    );
  }
  if (extraction.media.some((m) => m.isVideo)) {
    warnings.push(
      "This post contains video. Only the video thumbnail frame was retrieved for vision " +
        "analysis — motion, audio, and on-screen text that only appears mid-video are not visible."
    );
  }

  printResultAndExit({
    ok: true,
    outDir,
    postType: extraction.postType,
    slideCountExpected: extraction.media.length,
    slideCountRetrieved: downloaded.length,
    slidePaths: downloaded.map((d) => d.localPath),
    metadataPath: path.join(outDir, "post_metadata.json"),
    warnings,
  });
}

main().catch((err) => {
  printResultAndExit({
    ok: false,
    errorType: "extraction_failed",
    message: `Unhandled error: ${err.stack || err.message}`,
  });
});
