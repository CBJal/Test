---
name: instagram-reference-analyzer
description: Analyze a public Instagram post, carousel, or reel as a content/design reference. Use whenever the user gives an instagram.com/p/, /reel/, or /reels/ URL and asks to analyze, break down, review, or use it as inspiration/reference (including for the ASPRVANO brand). Downloads the actual slide images and visually inspects them — never analyzes from the URL/caption alone.
---

# Instagram Reference Analyzer

## What this does

Given a public Instagram post/carousel/reel URL, this skill:

1. Parses and validates the URL.
2. Runs `scripts/extract.mjs` to pull the real media (all carousel slides, not just the first) through a swappable extraction provider (Apify by default) and download it to a temp folder.
3. Reads the downloaded images with your vision capability — actually looks at them, not just the caption/metadata.
4. Produces the structured report below.
5. Cleans up the temp folder.

Never produce the report from the URL, the caption alone, or general knowledge about the account. If step 2 didn't put real image files on disk, you have not seen the post — say so (see Error handling) instead of describing it anyway.

## Workflow

### 1. Parse & detect

Recognize these forms (tracking params ignored, optional leading username segment allowed):
`instagram.com/p/<code>/`, `instagram.com/reel/<code>/`, `instagram.com/reels/<code>/`, with or without `www.`.

If the URL doesn't match, use the "Unsupported URL" error message below — don't guess.

### 2. Extract media

Run the extraction script into the session's scratchpad directory (never `/tmp` directly — see environment instructions):

```bash
node .claude/skills/instagram-reference-analyzer/scripts/extract.mjs "<the url>" \
  --out-dir "<scratchpad_dir>/instagram_reference/<shortcode>"
```

It prints one JSON object and exits 0 (success, possibly partial) or 1 (failure). Parse it:

- `ok: true` → `slidePaths` lists the downloaded image files, in slide order. `warnings` may note partial retrieval or video-thumbnail-only limitations — carry those into the report.
- `ok: false` → `errorType` tells you which message template to use (see Error handling). Do not retry more than the script already did internally; do not loop.

If `APIFY_API_TOKEN` isn't set, the script fails fast with `errorType: "missing_credentials"` — tell the user what to set (see README.md in this skill folder) rather than attempting a workaround.

### 3. Look at the images

Read every file in `slidePaths`, in order, with your file-reading/vision capability. This is the step that makes the analysis real — do it for every slide, not just slide 1, even for a 10-slide carousel.

### 4. Write the report

Use the exact section structure in "Output format" below. Every section must be grounded in what you actually saw in the images (or read in `post_metadata.json` for caption/stats) — not invented. For any visual property you can't pin down exactly (a font family, an exact hex code), say so explicitly rather than asserting it as fact — e.g. "looks like a modern grotesk such as Söhne or General Sans" rather than naming one font as certain, and "approx. #1A1A1A (visually estimated, not colorpicked)" for color.

Keep it usable for making content, not just describing the reference — every section should give the user something they could act on, not just adjectives.

### 5. Clean up

```bash
node .claude/skills/instagram-reference-analyzer/scripts/cleanup.mjs "<the --out-dir you used>"
```

Do this after finishing the analysis, unless the user asks to keep the files. Never retain someone else's Instagram media beyond the session.

## Output format

```text
INSTAGRAM REFERENCE ANALYSIS

URL:
Post type:
Number of slides:

━━━━━━━━━━━━━━━━━━
1. QUICK SUMMARY
━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━
2. VISUAL ANALYSIS
━━━━━━━━━━━━━━━━━━

Covers, across the whole set: visual identity, consistency, color system, typography
system, composition, spacing/grid, image treatment, hierarchy, visual rhythm,
storytelling progression.

━━━━━━━━━━━━━━━━━━
3. SLIDE-BY-SLIDE ANALYSIS
━━━━━━━━━━━━━━━━━━

Slide 1
Purpose:
Hook:
Layout:
Typography:
Imagery:
Color:
Visual emphasis:
Information density:
Transition to next slide:

Slide 2
...(repeat for every retrieved slide)

━━━━━━━━━━━━━━━━━━
4. CONTENT MECHANIC
━━━━━━━━━━━━━━━━━━

Hook: (what it is + the psychological mechanism — curiosity, contradiction,
aspiration, fear, authority, relatability, etc.)
Framework: (the actual structure observed — don't force it into
Hook -> Problem -> Insight -> Examples -> Reframe -> CTA if that's not what's there)
Story progression:
Copy style: (sentence length, tone, vocabulary, pacing, use of numbers/contrast)
CTA:

━━━━━━━━━━━━━━━━━━
5. DESIGN SYSTEM
━━━━━━━━━━━━━━━━━━

Typography: (primary/secondary font characteristics, weight hierarchy, case usage)
Colors: (dominant, accent, background, text — approximate hex where visually
inferable, marked as approximate)
Layout: (margins, alignment, grid, image/text relationship, whitespace)
Imagery: (photography style, subject treatment, lighting, crop, overlay, texture)
Composition: (focal point, hierarchy, balance, contrast, rhythm)

━━━━━━━━━━━━━━━━━━
6. WHY IT WORKS
━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━
7. ASPRVANO ADAPTATION
━━━━━━━━━━━━━━━━━━

(Include this section by default; user can ask to skip it. See "ASPRVANO mode" below.)

━━━━━━━━━━━━━━━━━━
8. ORIGINAL POST CONCEPT
━━━━━━━━━━━━━━━━━━

Title:
Hook:
Slide structure:
Visual direction:
CTA:
```

## ASPRVANO mode

ASPRVANO is a premium Instagram brand about growth, discipline, success, mindset,
wealth, productivity, entrepreneurship, self-improvement, and modern philosophy.
Its identity: luxury minimalism, bold typography, cinematic imagery, refined black
aesthetic, premium editorial design — sophisticated, timeless, highly shareable.

Section 7 must answer, specifically:

1. What can ASPRVANO learn from this reference?
2. Which structural techniques are worth adapting?
3. Which visual techniques could fit the ASPRVANO identity?
4. What should NOT be copied?
5. How could the underlying concept become an original ASPRVANO post?
6. An original carousel structure (slide-by-slide, not the reference's structure).
7. Original headline/copy directions.
8. Visual direction stated in ASPRVANO's own terms (black/editorial/cinematic), not
   the reference's palette or type.

**Inspiration, not copying**: never reproduce the reference's exact copy lines, exact
layout, or distinctive original artwork/photography. Section 7 and 8 describe patterns
and mechanisms to adapt, and must read as clearly original to ASPRVANO — if a
suggestion is close enough to the source that it would look like a copy, say so and
propose a more differentiated alternative instead.

## Error handling

Use these exact messages (adapt only by inserting the URL/count where shown), and stop —
don't attempt the rest of the pipeline or invent an analysis:

- **Unsupported URL** (`errorType: "unsupported_url"`): explain the supported formats,
  using the script's message (it lists them).
- **Private post** (`errorType: "private_or_unavailable"`): "This post appears to be
  private or inaccessible. I can't retrieve its media."
- **Deleted post** (`errorType: "deleted"`): "This Instagram post is no longer
  accessible."
- **Missing credentials** (`errorType: "missing_credentials"`): explain that the
  extraction provider isn't configured, and point at this skill's README for setup —
  don't ask the user for their Instagram password or attempt a login-based workaround.
- **Rate limited** (`errorType: "rate_limited"`): tell the user the provider rate-limited
  the request and suggest trying again later; do not immediately retry yourself.
- **General extraction failure** (`errorType: "extraction_failed"`): "Media retrieval
  failed, so visual analysis could not be completed." Include the underlying reason
  from the script's `message` field for debugging, but don't produce a report anyway.
- **Partial carousel** (`ok: true` with `warnings`): proceed, but state plainly at the
  top of the report exactly how many of the expected slides were retrieved and
  analyzed (e.g. "4 of 7 slides retrieved — slides 5-7 could not be downloaded and are
  not covered below").

## Security & scope

- Only retrieves content already publicly reachable through the configured provider's
  legitimate API — never attempts to log into Instagram, bypass a private account, or
  ask the user for Instagram credentials.
- The provider API token (`APIFY_API_TOKEN` etc.) is read from an environment variable
  only; never print it, log it, or write it into `post_metadata.json` or the report.
- Downloaded media is temporary: always written under a path containing
  `instagram_reference`, and cleaned up after analysis (step 5) unless the user asks
  to keep it.
- Timeouts and bounded retries are built into the script — you never need to loop or
  retry extraction yourself.

## Architecture (for maintainers)

```
scripts/extract.mjs          CLI entry point: URL -> downloaded images + metadata JSON
scripts/lib/url.mjs           Instagram URL parsing/normalization (provider-agnostic)
scripts/lib/download.mjs      Generic media downloader (provider-agnostic)
scripts/lib/providers/        One file per extraction provider, common interface
  index.mjs                   Provider registry (INSTAGRAM_PROVIDER env var selects one)
  apify.mjs                   Default provider: calls an Apify actor over REST
scripts/cleanup.mjs           Removes a temp media directory this skill created
```

Nothing outside `scripts/lib/providers/apify.mjs` knows Apify exists. To add
Bright Data or another provider: add `scripts/lib/providers/brightdata.mjs`
exporting a function with the same signature (`parsedUrl -> extraction result`,
see the header comment in `apify.mjs` for the exact shape), register it in
`providers/index.mjs`, and set `INSTAGRAM_PROVIDER=brightdata`. Nothing else in
the pipeline changes.

See `README.md` in this folder for setup, environment variables, example usage,
troubleshooting, and known limitations.
