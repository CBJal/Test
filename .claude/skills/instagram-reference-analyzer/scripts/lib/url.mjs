// Instagram URL parsing and normalization.
// Supports: /p/<code>/, /reel/<code>/, /reels/<code>/, with or without leading
// username segment, with or without tracking query params, www or bare host.

const POST_TYPES = { p: "post", reel: "reel", reels: "reel", tv: "igtv" };

/**
 * @param {string} rawUrl
 * @returns {{ ok: true, shortcode: string, postType: string, canonicalUrl: string }
 *          | { ok: false, reason: string }}
 */
export function parseInstagramUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return { ok: false, reason: "not_a_url" };
  }

  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "instagram.com") {
    return { ok: false, reason: "not_instagram_host" };
  }

  // Path segments, ignoring empty ones from leading/trailing slashes.
  const segments = u.pathname.split("/").filter(Boolean);

  // Find the first segment that is a known post-type keyword, so that
  // both "/p/<code>/" and "/<username>/p/<code>/" resolve correctly.
  const typeIndex = segments.findIndex((s) => s in POST_TYPES);
  if (typeIndex === -1 || !segments[typeIndex + 1]) {
    return { ok: false, reason: "unsupported_path" };
  }

  const typeKeyword = segments[typeIndex];
  const shortcode = segments[typeIndex + 1].replace(/[^A-Za-z0-9_-]/g, "");
  if (!shortcode) {
    return { ok: false, reason: "unsupported_path" };
  }

  const postType = POST_TYPES[typeKeyword];
  // Canonical form Apify/most scrapers expect: always /p/ or /reel/, no query, trailing slash.
  const canonicalUrl = `https://www.instagram.com/${typeKeyword}/${shortcode}/`;

  return { ok: true, shortcode, postType, canonicalUrl };
}

export function isSupportedInstagramUrl(rawUrl) {
  return parseInstagramUrl(rawUrl).ok;
}
