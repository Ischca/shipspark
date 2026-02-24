import { escapeXml, truncateText } from "./utils";

const SPARKLES_PATH =
  "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z";

const SHARED_DEFS = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#090d1a"/>
      <stop offset="50%" stop-color="#0f1a2e"/>
      <stop offset="100%" stop-color="#152642"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.65" cy="0.35" r="0.55">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#090d1a" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <line x1="0" y1="40" x2="40" y2="40" stroke="#22d3ee" stroke-opacity="0.03" stroke-width="0.5"/>
      <line x1="40" y1="0" x2="40" y2="40" stroke="#22d3ee" stroke-opacity="0.03" stroke-width="0.5"/>
    </pattern>
  </defs>`;

const SPARKLE_PARTICLES = `
  <g fill="#22d3ee">
    <circle cx="120" cy="80" r="2" opacity="0.20"/>
    <circle cx="950" cy="70" r="2.5" opacity="0.15"/>
    <circle cx="1080" cy="160" r="1.8" opacity="0.12"/>
    <circle cx="180" cy="520" r="1.5" opacity="0.18"/>
    <circle cx="1050" cy="490" r="2" opacity="0.14"/>
    <circle cx="700" cy="55" r="1.2" opacity="0.16"/>
    <circle cx="400" cy="555" r="1.5" opacity="0.10"/>
    <circle cx="850" cy="530" r="1.8" opacity="0.12"/>
  </g>`;

/* ------------------------------------------------------------------ */
/*  Site-level OG  (1200 x 630)                                       */
/*  Left-aligned hero layout with headline + hashtag flow             */
/* ------------------------------------------------------------------ */

export const buildSiteOgSvg = (): string => `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  ${SHARED_DEFS}
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  ${SPARKLE_PARTICLES}

  <!-- Ambient glow behind headline -->
  <ellipse cx="350" cy="290" rx="420" ry="280" fill="#22d3ee" fill-opacity="0.03"/>

  <!-- Brand: sparkle icon + ShipSpark -->
  <g transform="translate(90, 68) scale(1.4)" fill="none"
     stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="${SPARKLES_PATH}"/>
  </g>
  <text x="128" y="89"
        font-family="Sora, sans-serif" font-weight="700" font-size="24"
        fill="#ffffff" opacity="0.9">
    ShipSpark
  </text>
  <text x="128" y="109"
        font-family="Sora, sans-serif" font-weight="400" font-size="13"
        fill="#22d3ee" opacity="0.50" letter-spacing="0.06em">
    indie launch board
  </text>

  <!-- Headline line 1 -->
  <text x="100" y="255"
        font-family="Sora, sans-serif" font-weight="800" font-size="64"
        fill="#ffffff" letter-spacing="-0.03em">
    Post on X.
  </text>

  <!-- Headline line 2 (cyan accent) -->
  <text x="100" y="335"
        font-family="Sora, sans-serif" font-weight="800" font-size="64"
        fill="#22d3ee" letter-spacing="-0.03em">
    Get listed automatically.
  </text>

  <!-- Hashtag pill: #ShipSpark -->
  <rect x="100" y="378" width="178" height="38" rx="19"
        fill="#22d3ee" fill-opacity="0.10" stroke="#22d3ee" stroke-opacity="0.25" stroke-width="1"/>
  <text x="189" y="403" text-anchor="middle"
        font-family="Sora, sans-serif" font-weight="600" font-size="15"
        fill="#22d3ee">
    #ShipSpark
  </text>

  <!-- Hashtag pill: #ss_your_product -->
  <rect x="294" y="378" width="228" height="38" rx="19"
        fill="#22d3ee" fill-opacity="0.06" stroke="#22d3ee" stroke-opacity="0.15" stroke-width="1"/>
  <text x="408" y="403" text-anchor="middle"
        font-family="Sora, sans-serif" font-weight="600" font-size="15"
        fill="#22d3ee" opacity="0.6">
    #ss_your_product
  </text>

  <!-- Flow arrow + label -->
  <text x="544" y="403"
        font-family="Sora, sans-serif" font-weight="400" font-size="20"
        fill="#ffffff" opacity="0.30">
    \u2192
  </text>
  <text x="576" y="403"
        font-family="Sora, sans-serif" font-weight="500" font-size="15"
        fill="#ffffff" opacity="0.40">
    upvote &amp; discover
  </text>

  <!-- Bottom line -->
  <line x1="100" y1="545" x2="1100" y2="545"
        stroke="#22d3ee" stroke-opacity="0.06" stroke-width="1"/>

  <!-- URL -->
  <text x="100" y="590"
        font-family="Sora, sans-serif" font-weight="400" font-size="18"
        fill="#ffffff" opacity="0.30" letter-spacing="0.06em">
    shipspark.net
  </text>
</svg>`;

/* ------------------------------------------------------------------ */
/*  Product-level OG  (1200 x 630)                                    */
/*  "LISTED ON SHIPSPARK" badge + product info                        */
/* ------------------------------------------------------------------ */

export type ProductOgParams = {
  name: string;
  tagline: string | null;
  handle: string;
};

export const buildProductOgSvg = ({ name, tagline, handle }: ProductOgParams): string => {
  const displayName = escapeXml(truncateText(name, 36));
  const displayTagline = tagline ? escapeXml(truncateText(tagline, 80)) : "";
  const displayHandle = escapeXml(`@${handle}`);

  const nameFontSize = name.length > 24 ? 48 : 60;
  const nameY = tagline ? 300 : 330;
  const taglineY = nameY + (nameFontSize === 48 ? 55 : 65);
  const handleY = taglineY + (displayTagline ? 55 : 10);

  const barTop = nameY - 45;
  const barHeight = handleY - barTop + 5;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  ${SHARED_DEFS}
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  ${SPARKLE_PARTICLES}

  <!-- ===== Top brand bar ===== -->
  <rect x="0" y="0" width="1200" height="120" fill="#090d1a" fill-opacity="0.5"/>
  <line x1="0" y1="120" x2="1200" y2="120"
        stroke="#22d3ee" stroke-opacity="0.12" stroke-width="1"/>

  <!-- Brand: sparkle icon + ShipSpark + subtitle -->
  <g transform="translate(90, 38) scale(1.4)" fill="none"
     stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="${SPARKLES_PATH}"/>
  </g>
  <text x="128" y="59"
        font-family="Sora, sans-serif" font-weight="700" font-size="24"
        fill="#ffffff" opacity="0.9">
    ShipSpark
  </text>
  <text x="128" y="79"
        font-family="Sora, sans-serif" font-weight="400" font-size="13"
        fill="#22d3ee" opacity="0.50" letter-spacing="0.06em">
    indie launch board
  </text>

  <!-- "LISTED" pill (right side of header) -->
  <rect x="950" y="42" width="150" height="36" rx="18"
        fill="#22d3ee" fill-opacity="0.10" stroke="#22d3ee" stroke-opacity="0.25" stroke-width="1"/>
  <text x="1025" y="66" text-anchor="middle"
        font-family="Sora, sans-serif" font-weight="700" font-size="13"
        fill="#22d3ee" letter-spacing="0.08em">
    ✔  LISTED
  </text>

  <!-- ===== Product info (main area) ===== -->
  <!-- Left accent bar -->
  <rect x="80" y="${barTop}" width="4" height="${barHeight}" rx="2"
        fill="#22d3ee" opacity="0.35"/>

  <!-- Product name -->
  <text x="100" y="${nameY}"
        font-family="Sora, sans-serif" font-weight="800" font-size="${nameFontSize}"
        fill="#ffffff" letter-spacing="-0.03em">
    ${displayName}
  </text>

  ${displayTagline ? `
  <!-- Tagline -->
  <text x="100" y="${taglineY}"
        font-family="Sora, sans-serif" font-weight="400" font-size="24"
        fill="#ffffff" opacity="0.60" letter-spacing="0.005em">
    ${displayTagline}
  </text>` : ""}

  <!-- Handle -->
  <text x="100" y="${handleY}"
        font-family="Sora, sans-serif" font-weight="600" font-size="22"
        fill="#22d3ee">
    ${displayHandle}
  </text>

  <!-- ===== Bottom bar ===== -->
  <line x1="100" y1="545" x2="1100" y2="545"
        stroke="#22d3ee" stroke-opacity="0.08" stroke-width="1"/>

  <!-- URL (bottom left) -->
  <text x="100" y="590"
        font-family="Sora, sans-serif" font-weight="400" font-size="18"
        fill="#ffffff" opacity="0.30" letter-spacing="0.06em">
    shipspark.net
  </text>
</svg>`;
};
