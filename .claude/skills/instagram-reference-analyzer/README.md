# Instagram Reference Analyzer

A Claude Code skill: give it a public Instagram post/carousel/reel URL, it
downloads the actual slide images and hands them to Claude's vision
capability, and returns a structured design + content breakdown (with an
optional ASPRVANO-brand adaptation section).

See `SKILL.md` for the workflow Claude follows and the exact report format.
This file covers setup, provider reasoning, testing, and known limitations.

## Environment inspection (done before building this)

Before writing any code, the environment was checked for a shortcut that
would make a custom build unnecessary:

- No `.claude/skills/` directory existed in this repo — no prior skill
  infrastructure to extend.
- No Apify MCP server, Bright Data MCP server, or any Instagram-specific
  MCP tool is connected to this session (checked via tool search across the
  full connected/deferred tool list).
- No `APIFY_*`, `BRIGHTDATA_*`, or `INSTAGRAM_*` environment variables were
  already set.
- A generic `WebFetch` tool exists but isn't a fit: it summarizes a page
  through a text model, it doesn't retrieve carousel image bytes, and
  Instagram post pages require JS execution to populate content anyway.
- The `apify` npm package that had been added to this repo's
  `package.json` in an earlier, unrelated step is the actor-**authoring**
  SDK (for writing an actor that runs *on* Apify's platform) — not the
  right tool here. This skill instead talks to Apify's REST API directly
  with `fetch` (Node 22 has it built in), so it has **zero npm
  dependencies** and isn't coupled to that package at all.

Conclusion: nothing existing solves this, so a new skill was the right call.

## Provider selection

| | Apify | Bright Data | Local/open-source scraper |
|---|---|---|---|
| Carousel support | Yes (documented output includes carousel children) | Yes (Instagram Posts API) | Depends entirely on the library; Instagram's markup/GraphQL endpoints change often |
| Reliability when IG changes | Actor maintainers patch it; not your problem | Same | You own the breakage |
| API/MCP compatible | Plain REST (`run-sync-get-dataset-items`), no SDK required | Plain REST | N/A |
| Auth | Single API token | Account + zone setup, generally heavier onboarding | None, but higher breakage risk offsets that |
| Cost | Pay-per-run/result, has a free tier | Usually higher minimum spend, enterprise-oriented | Free, but highest maintenance cost |
| Maintenance burden (for us) | Low — it's someone else's actor | Low | High — we'd own scraper logic no mature service provides |

**Chosen: Apify**, as the initial provider, per the instruction to prefer a
mature service over a from-scratch scraper. It has the lowest integration
cost (one HTTP POST, no SDK), a free tier suitable for testing, and
several actively maintained actors purpose-built for exactly this
(single post / carousel / reel by URL). Bright Data is a reasonable
alternative if Apify's actor breaks or its pricing stops working for your
volume — see "Adding another provider" below for how cheap that switch is
by design.

**Default actor**: `apify/instagram-scraper` (published by Apify itself,
not a third party) via
`POST https://api.apify.com/v2/actors/apify~instagram-scraper/run-sync-get-dataset-items?token=...`
with `{ directUrls: [url], resultsType: "details", resultsLimit: 1 }`.

**Important caveat, stated plainly**: this repo's build sandbox has
`apify.com` blocked by its network egress policy (see "Known limitations"),
so the actor's input/output schema documented in
`scripts/lib/providers/apify.mjs` could not be confirmed against Apify's
live docs while writing this. The parsing code was written defensively
(it checks several known field-name variants for carousel children and
surfaces the raw API response on failure) specifically because of this
gap. **Before relying on this in production, run it once against a real
post and confirm the output matches** — see "Testing" below for exactly
what was and wasn't verified.

## Setup

1. Get an Apify API token: Apify Console → Settings → Integrations →
   Personal API token. Apify has a free tier that covers light testing.
2. Set it as an environment variable (don't commit it):
   ```bash
   export APIFY_API_TOKEN=apify_api_xxxxxxxx
   ```
   or copy `.env.example` to `.env` in this skill folder and fill it in,
   if your setup loads `.env` files automatically.
3. No `npm install` needed — the scripts use only Node's built-in `fetch`
   and `fs`. Requires Node 18+ (uses global `fetch`); this repo's sandbox
   runs Node 22.

## Example usage

In conversation:

> Analyze this Instagram post: https://www.instagram.com/p/CzX1abcXYZ9/

Claude (per `SKILL.md`) runs:

```bash
node .claude/skills/instagram-reference-analyzer/scripts/extract.mjs \
  "https://www.instagram.com/p/CzX1abcXYZ9/" \
  --out-dir "<scratchpad_dir>/instagram_reference/CzX1abcXYZ9"
```

which prints:

```json
{
  "ok": true,
  "outDir": ".../instagram_reference/CzX1abcXYZ9",
  "postType": "carousel",
  "slideCountExpected": 6,
  "slideCountRetrieved": 6,
  "slidePaths": [".../slide_01.jpg", ".../slide_02.jpg", "..."],
  "metadataPath": ".../post_metadata.json",
  "warnings": []
}
```

Claude then reads each file in `slidePaths` and writes the report described
in `SKILL.md`, then runs `cleanup.mjs` on `outDir`.

## Testing performed

What **was** verified, in this sandbox, without network access to
Instagram or Apify:

- URL parsing/normalization: all supported and unsupported forms
  (`/p/`, `/reel/`, `/reels/`, with username prefix, with tracking query
  params, non-Instagram host, malformed URL) — correct in every case.
- `unsupported_url` error path — correct message and JSON shape, exit
  code 1.
- `missing_credentials` error path when `APIFY_API_TOKEN` is unset —
  correct message, exit code 1, no network call attempted.
- `cleanup.mjs` — deletes a real scratch directory, and **refuses** to
  delete a path that doesn't look like one it created (tested against
  this repo's root as a guard-rail check).

What was attempted but blocked by this sandbox's network policy:

- A real Apify actor run against a live Instagram URL, with a real token
  (no token was available — none was requested from the user for this
  build pass). `apify.com` and `api.apify.com` are both denied by the
  environment's egress proxy at the `curl`/shell level (confirmed via
  `curl -sS https://api.apify.com/...` → `403` from the proxy's CONNECT
  handler).
- **Caveat on that finding**: Node's built-in `fetch` (what `extract.mjs`
  actually uses) does *not* honor the `HTTPS_PROXY` environment variable
  by default and was observed reaching `api.apify.com` and
  `www.instagram.com` directly, bypassing the proxy that blocks `curl`.
  A request with a deliberately invalid token got a real `401/403` back
  from Apify's API itself — so the HTTP plumbing (request shape, endpoint,
  error classification) works end-to-end. What's still unverified is the
  **actual dataset item shape for a real successful run**, since that
  needs a valid token. This asymmetry (script can reach the network, shell
  commands can't) is worth knowing about on its own terms — it means this
  environment's egress policy is not uniformly enforced across tools, which
  the person operating this environment may want to know regardless of this
  skill.
- No live end-to-end run (URL → images → vision analysis → report) has
  been completed. **Do the first real run yourself, with your own
  `APIFY_API_TOKEN`, against a post you're allowed to test with, before
  trusting this for anything important.**

## Troubleshooting

- **`missing_credentials`**: `APIFY_API_TOKEN` isn't set, or Apify
  rejected it. Re-check the token in Apify Console.
- **`extraction_failed` mentioning "no recognizable media field"**: the
  actor's output schema doesn't match what `apify.mjs` expects (see the
  caveat above — this is the most likely real-world failure mode on
  first use). The error includes the raw dataset item JSON; check it
  against the actor's current documented output in Apify Console and
  update the field names checked in `normalizeApifyResult()` in
  `scripts/lib/providers/apify.mjs`.
- **`extraction_failed` with an HTTP status from Apify**: check the
  actor ID is correct and accessible with your token
  (`APIFY_ACTOR_ID` env var to override the default).
- **`rate_limited`**: wait before retrying; the script already retries
  429s twice with backoff before giving up.
- **Partial carousel (`warnings` non-empty)**: some slide URLs expired or
  failed to download (Instagram CDN URLs are often short-lived). Re-run
  extraction soon after getting the dataset, or re-run the whole analysis.
- **Video posts/reels only show a thumbnail**: expected — this pipeline
  extracts images for vision analysis, not video frames. The report will
  note this limitation explicitly.

## Adding another provider

1. Create `scripts/lib/providers/<name>.mjs` exporting a function with the
   signature documented at the top of `apify.mjs`
   (`parsedUrl -> { postType, caption, owner, stats, media, raw }`).
2. Register it in `scripts/lib/providers/index.mjs`'s `PROVIDERS` map.
3. Set `INSTAGRAM_PROVIDER=<name>`.

Nothing in `extract.mjs`, `download.mjs`, `url.mjs`, or `SKILL.md` needs to
change — they only depend on the common shape, never on Apify specifically.

## Known limitations / self-review

Read before treating this as production-ready:

1. **Unverified against a real successful Apify run** (see Testing above)
   — the single biggest open risk. The defensive parsing means a schema
   mismatch fails loudly with the raw JSON attached rather than silently
   producing a wrong report, but it hasn't been proven correct on real data.
2. **Actor output schemas drift.** Apify actors (including Apify's own)
   change field names/shapes over time without much notice. There's no
   automated check that would catch this before a run fails.
3. **Video/reel analysis is thumbnail-only.** No frame extraction, no
   audio, no transcript. A reel with most of its content mid-video will
   be under-analyzed, and the report says so, but it's a real gap if the
   user's actual goal is reel analysis specifically.
4. **CDN URL lifetime.** Instagram media URLs returned by scraping actors
   are often time-limited signed URLs. If there's a delay between the
   Apify run and the download step, some slides can fail — this shows up
   as a partial-retrieval warning, but isn't preventable from this side.
5. **Cost isn't zero at scale.** Apify's free tier is fine for occasional
   use; frequent/bulk analysis should have its cost checked against actual
   Apify pricing for the chosen actor before relying on this heavily.
6. **No caching/dedup.** Re-analyzing the same URL re-runs the actor and
   re-downloads everything. Fine for the stated use case (analyze a
   reference, once), but worth knowing if usage patterns change.
7. **Legal/ToS.** Scraping Instagram content, even public content, sits in
   a gray area relative to Instagram's terms of service. This skill only
   retrieves already-public content through a third-party provider's
   legitimate product and never bypasses authentication — but that's a
   different thing from being unambiguously permitted by Instagram's ToS.
   Worth the user's own judgment call on usage volume/context, not
   something this README can resolve.
8. **The ASPRVANO section's "don't copy" guardrail is instruction-based,
   not code-enforced.** Nothing programmatically checks that Claude's
   suggested headlines/visuals are sufficiently differentiated from the
   source; it relies on the model following `SKILL.md`'s instruction to
   self-flag anything too close.
