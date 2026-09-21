// Provider registry. The rest of the pipeline only depends on this module's
// getProvider() function and the common result shape documented in
// apify.mjs's header comment — never on a specific provider's SDK or REST
// shape. Swapping/adding a provider means adding one file here and one
// line in PROVIDERS; nothing else in the pipeline changes.

import { extractWithApify } from "./apify.mjs";

const PROVIDERS = {
  apify: extractWithApify,
  // brightdata: extractWithBrightData,   // not implemented yet, see README
  // local: extractWithLocalScraper,      // not implemented yet, see README
};

export function getProvider(name = process.env.INSTAGRAM_PROVIDER || "apify") {
  const provider = PROVIDERS[name];
  if (!provider) {
    const known = Object.keys(PROVIDERS).join(", ");
    throw new ProviderError(
      "unknown_provider",
      `Unknown extraction provider "${name}". Known providers: ${known}.`
    );
  }
  return provider;
}

export class ProviderError extends Error {
  /**
   * @param {"missing_credentials"|"private_or_unavailable"|"deleted"|"rate_limited"|"timeout"|"extraction_failed"|"unknown_provider"} type
   * @param {string} message
   */
  constructor(type, message) {
    super(message);
    this.name = "ProviderError";
    this.type = type;
  }
}
