// Apify extraction provider.
//
// Calls an Apify Actor's run-sync-get-dataset-items endpoint (one HTTP call
// runs the actor and returns its output — no separate poll-for-completion
// step needed) and normalizes whatever it returns into this pipeline's
// common shape:
//
//   {
//     postType: "post" | "carousel" | "reel",
//     caption: string | null,
//     owner: { username: string | null, fullName: string | null },
//     stats: { likes: number|null, comments: number|null, timestamp: string|null },
//     media: [ { kind: "image" | "video_thumbnail", remoteUrl: string, isVideo: boolean } ],
//     raw: <the actor's raw dataset item, kept for debugging / metadata.json>
//   }
//
// IMPORTANT — verify before first real run:
// This file could not be validated against Apify's live documentation from
// the sandbox that built it (apify.com and api.apify.com are both blocked
// by that sandbox's network egress policy — see the skill README's
// "Known limitations" section). The actor ID and the field names checked
// below (`childPosts`, `images`, `sidecarChildren`, `displayUrl`,
// `videoUrl`, ...) reflect the publicly documented shape of Apify's
// official `apify/instagram-scraper` actor as of this writing, but Apify
// actors change their output shape without much notice. The parsing below
// is deliberately defensive (it tries several known field names and
// surfaces the raw item on failure) so a schema drift shows up as a clear
// "couldn't find any media fields" error with the raw JSON attached,
// rather than a silent wrong answer.

import { ProviderError } from "./index.mjs";

const DEFAULT_ACTOR_ID = "apify/instagram-scraper";
const RUN_TIMEOUT_MS = 90_000; // actor runs (esp. carousels) can take a while
const MAX_RETRIES = 2; // total attempts = 1 + MAX_RETRIES, never unbounded
const RETRY_BASE_DELAY_MS = 2_000;

function actorRestId(actorId) {
  // Apify's REST API addresses actors as "owner~name", not "owner/name".
  return actorId.replace("/", "~");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{ canonicalUrl: string, shortcode: string, postType: string }} parsedUrl
 * @returns {Promise<object>} common extraction result (see header comment)
 */
export async function extractWithApify(parsedUrl) {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new ProviderError(
      "missing_credentials",
      "APIFY_API_TOKEN is not set. Get a token from the Apify Console " +
        "(Settings -> Integrations) and export it, e.g.\n" +
        "  export APIFY_API_TOKEN=apify_api_xxx\n" +
        "See the skill README for details."
    );
  }

  const actorId = process.env.APIFY_ACTOR_ID || DEFAULT_ACTOR_ID;
  const endpoint = `https://api.apify.com/v2/actors/${actorRestId(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

  const input = {
    directUrls: [parsedUrl.canonicalUrl],
    resultsType: "details",
    resultsLimit: 1,
    addParentData: false,
  };

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(delay);
    }

    let response;
    try {
      response = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        RUN_TIMEOUT_MS
      );
    } catch (err) {
      lastError = err;
      const isTimeout = err.name === "AbortError";
      // Only retry on timeout/network errors, never on a definitive answer.
      if (attempt < MAX_RETRIES) continue;
      throw new ProviderError(
        isTimeout ? "timeout" : "extraction_failed",
        isTimeout
          ? `Apify actor run timed out after ${RUN_TIMEOUT_MS / 1000}s (${MAX_RETRIES + 1} attempts).`
          : `Network error calling Apify: ${err.message}`
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new ProviderError(
        "missing_credentials",
        "Apify rejected the API token (401/403). Check APIFY_API_TOKEN is valid " +
          "and has access to the actor " + actorId + "."
      );
    }

    if (response.status === 429) {
      // Rate limited: this is the one case worth a bounded retry with backoff,
      // never a hammering loop.
      lastError = new Error("rate limited (429)");
      if (attempt < MAX_RETRIES) continue;
      throw new ProviderError(
        "rate_limited",
        "Apify rate-limited this request (429) after " + (MAX_RETRIES + 1) + " attempts. Wait and try again later."
      );
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new ProviderError(
        "extraction_failed",
        `Apify returned HTTP ${response.status}. Body: ${bodyText.slice(0, 500)}`
      );
    }

    let items;
    try {
      items = await response.json();
    } catch {
      throw new ProviderError("extraction_failed", "Apify response was not valid JSON.");
    }

    return normalizeApifyResult(items, parsedUrl);
  }

  // Unreachable in practice (loop always returns or throws), kept for safety.
  throw new ProviderError("extraction_failed", `Unknown failure: ${lastError?.message}`);
}

function normalizeApifyResult(items, parsedUrl) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ProviderError(
      "extraction_failed",
      "Apify returned zero dataset items for this URL."
    );
  }

  const item = items[0];

  // Apify's Instagram scrapers surface unavailable posts as a dataset item
  // carrying an error description rather than an HTTP error.
  const errText = String(item.error || item.errorDescription || "").toLowerCase();
  if (errText) {
    if (/private/.test(errText)) {
      throw new ProviderError("private_or_unavailable", item.error || item.errorDescription);
    }
    if (/not found|unavailable|deleted|does not exist/.test(errText)) {
      throw new ProviderError("deleted", item.error || item.errorDescription);
    }
    throw new ProviderError("extraction_failed", item.error || item.errorDescription);
  }

  const isVideoItem = /video/i.test(item.type || "") || Boolean(item.videoUrl);

  // Carousel children can show up under a few different field names
  // depending on the actor/version. Check the known ones in priority order.
  const childArrays = [item.childPosts, item.sidecarChildren, item.images]
    .filter((arr) => Array.isArray(arr) && arr.length > 0);
  const children = childArrays[0];

  const media = [];
  if (children) {
    for (const child of children) {
      if (typeof child === "string") {
        media.push({ kind: "image", remoteUrl: child, isVideo: false });
      } else if (child && typeof child === "object") {
        const childIsVideo = /video/i.test(child.type || "") || Boolean(child.videoUrl);
        const remoteUrl = child.displayUrl || child.thumbnailUrl || child.url;
        if (remoteUrl) {
          media.push({
            kind: childIsVideo ? "video_thumbnail" : "image",
            remoteUrl,
            isVideo: childIsVideo,
          });
        }
      }
    }
  } else {
    const remoteUrl = item.displayUrl || item.thumbnailUrl || item.url;
    if (remoteUrl) {
      media.push({ kind: isVideoItem ? "video_thumbnail" : "image", remoteUrl, isVideo: isVideoItem });
    }
  }

  if (media.length === 0) {
    throw new ProviderError(
      "extraction_failed",
      "Apify returned a dataset item but no recognizable media field " +
        "(checked childPosts/sidecarChildren/images/displayUrl/thumbnailUrl/url). " +
        "The actor's output schema may have changed — see raw item: " +
        JSON.stringify(item).slice(0, 1000)
    );
  }

  const postType = children ? "carousel" : parsedUrl.postType === "reel" ? "reel" : "post";

  return {
    postType,
    caption: item.caption ?? null,
    owner: {
      username: item.ownerUsername ?? null,
      fullName: item.ownerFullName ?? null,
    },
    stats: {
      likes: item.likesCount ?? null,
      comments: item.commentsCount ?? null,
      timestamp: item.timestamp ?? null,
    },
    media,
    raw: item,
  };
}
