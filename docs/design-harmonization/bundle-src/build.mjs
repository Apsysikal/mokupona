// Builds the mokupona design-system bundle.
//
// Each card in ./cards/ is a body fragment whose first line is a JSON meta
// comment. This script inlines base.css (plus any per-card <style-extra>) and
// writes a standalone document into ../ds-bundle/, carrying the
// `<!-- @dsCard group="…" title="…" -->` marker the Claude Design pane indexes.
// It also regenerates ../ds-bundle/index.html, the browsable gallery.
//
//   node docs/design-harmonization/bundle-src/build.mjs

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cardsDir = join(here, "cards");
const outDir = join(here, "..", "ds-bundle");

// Display order of the groups in the pane and in the index.
const GROUP_ORDER = [
  "Overview",
  "Foundations",
  "Primitives",
  "Forms",
  "Navigation",
  "Content blocks",
  "Events",
  "Admin",
  "Account & auth",
];

const GROUP_BLURB = {
  Overview: "Where to start, and how the bundle maps back onto the repo.",
  Foundations: "Tokens, ramps and effects everything else is assembled from.",
  Primitives: "app/components/ui — the unstyled-to-styled base layer.",
  Forms: "Field wrappers, the public signup form, and the admin form builder.",
  Navigation: "Site chrome: nav bars, tabs, in-page nav, footer, links.",
  "Content blocks": "The CMS block views the marketing pages are composed of.",
  Events: "Dinner cards, fact rows and the dinner detail layout.",
  Admin: "Page headers, list rows, empty states and the admin form shell.",
  "Account & auth": "The auth shell, its messaging states and the account page.",
};

// Cards authored by hand before this generator existed. They stay hand-written —
// the generator only needs to know they exist so index.html can link them.
const MANUAL_CARDS = [
  { group: "Foundations", title: "Color tokens", file: "tokens-colors.html", sources: ["app/tailwind.css"], note: "Surfaces, the one hairline, text tiers as foreground opacities, accent and semantics." },
  { group: "Foundations", title: "Type ramp", file: "type-ramp.html", sources: ["app/tailwind.css"], note: "Native body ramp plus the display ladder, and the one font-light display weight." },
  { group: "Foundations", title: "Spacing, radius & layout", file: "spacing-radius.html", sources: ["app/tailwind.css"], note: "The three radius tiers, the no-fractions rule, density presets and prose widths." },
  { group: "Foundations", title: "Headings — one voice, two densities", file: "headings.html", sources: ["app/components/section.tsx"], note: "One heading voice at two densities, shared by the public site and the admin." },
  { group: "Primitives", title: "Button", file: "buttons.html", sources: ["app/components/ui/button.tsx"], note: "Six variants, five whole-step sizes, one focus recipe." },
  { group: "Primitives", title: "Badge, Pill & Chip", file: "badges-pills.html", sources: ["app/components/ui/badge.tsx", "app/components/section.tsx"], note: "Badge variants, the pill boolean, and the unified chip." },
  { group: "Primitives", title: "Eyebrow / kicker", file: "eyebrows.html", sources: ["app/components/section.tsx"], note: "Tracked and kicker variants across four tones." },
  { group: "Primitives", title: "Card tiers", file: "cards.html", sources: ["app/components/ui/card.tsx"], note: "The 16px card at two densities, interactive and empty." },
  { group: "Primitives", title: "Form fields", file: "form-fields.html", sources: ["app/components/ui/input.tsx", "app/components/forms.tsx"], note: "The input/textarea/select/checkbox family and the file-upload zone." },
];

const escapeHtml = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function parseCard(raw, filename) {
  const match = raw.match(/^<!--\s*meta\s*(\{[\s\S]*?\})\s*-->\n/);
  if (!match) throw new Error(`${filename}: missing leading <!--meta {…}--> line`);

  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (cause) {
    throw new Error(`${filename}: meta is not valid JSON — ${cause.message}`);
  }

  for (const key of ["group", "title", "file", "sources"]) {
    if (!meta[key]) throw new Error(`${filename}: meta.${key} is required`);
  }
  if (!GROUP_ORDER.includes(meta.group)) {
    throw new Error(`${filename}: unknown group "${meta.group}"`);
  }

  let body = raw.slice(match[0].length);
  let extraStyle = "";
  const styleMatch = body.match(/<style-extra>([\s\S]*?)<\/style-extra>\n?/);
  if (styleMatch) {
    extraStyle = styleMatch[1].trim();
    body = body.replace(styleMatch[0], "");
  }

  return { meta, body: body.trim(), extraStyle };
}

function renderCard({ meta, body, extraStyle }, baseCss) {
  const sources = meta.sources
    .map((path) => `<code>${escapeHtml(path)}</code>`)
    .join(" · ");

  // The marker lives inside an HTML comment, which is raw text — entities would
  // not be decoded by the pane's parser, so the values go in verbatim.
  const marker = (value) => value.replace(/["<>]|--/g, " ").trim();

  return `<!-- @dsCard group="${marker(meta.group)}" title="${marker(meta.title)}" -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>mokupona — ${escapeHtml(meta.title)}</title>
    <style>
${baseCss}
${extraStyle ? `\n/* ${meta.file} */\n${extraStyle}\n` : ""}    </style>
  </head>
  <body>
    <p class="doc-eyebrow">${escapeHtml(meta.group)}</p>
    <h1 class="doc-title">${escapeHtml(meta.title)}</h1>
    <p class="doc-note">${meta.note ?? ""}</p>
    <p class="doc-source">${sources}</p>

${body}
  </body>
</html>
`;
}

function renderIndex(cards, baseCss) {
  const groups = GROUP_ORDER.filter((group) =>
    cards.some((card) => card.meta.group === group && card.meta.file !== "index.html"),
  );

  const nav = groups
    .map((group) => `<a class="chip" href="#${slug(group)}">${escapeHtml(group)}</a>`)
    .join("\n        ");

  const sections = groups
    .map((group) => {
      const rows = cards
        .filter((card) => card.meta.group === group && card.meta.file !== "index.html")
        .map(
          (card) => `          <a class="ui-card ui-card-interactive entry" href="${card.meta.file}">
            <span class="t-base fw-semibold">${escapeHtml(card.meta.title)}</span>
            <span class="t-sm fg-65">${card.meta.note ?? ""}</span>
            <span class="entry-src">${card.meta.sources.map((path) => escapeHtml(path)).join("<br />")}</span>
          </a>`,
        )
        .join("\n");

      return `      <section id="${slug(group)}">
        <h2>${escapeHtml(group)}</h2>
        <p class="doc-note mb-3">${escapeHtml(GROUP_BLURB[group] ?? "")}</p>
        <div class="grid cols-2 gap-3">
${rows}
        </div>
      </section>`;
    })
    .join("\n");

  const count = cards.filter((card) => card.meta.file !== "index.html").length;

  return `<!-- @dsCard group="Overview" title="Index" -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>mokupona — design system index</title>
    <style>
${baseCss}

/* index.html */
.entry {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  text-decoration: none;
  transition: border-color 150ms;
}
.entry-src {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: rgb(var(--foreground) / 0.4);
  margin-top: 4px;
}
@media (max-width: 720px) {
  .grid.cols-2 { grid-template-columns: minmax(0, 1fr); }
}
    </style>
  </head>
  <body>
    <p class="doc-eyebrow">moku pona</p>
    <h1 class="doc-title">Design system</h1>
    <p class="doc-note">
      Every component that ships in the mokupona app, extracted from the code and
      grouped the way the codebase is. ${count} cards. Each card names the source
      files it was pulled from, so a card and its implementation stay findable
      from one another.
    </p>

    <section>
      <h2>Groups</h2>
      <div class="flex wrap gap-2">
        ${nav}
      </div>
    </section>

${sections}
  </body>
</html>
`;
}

const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const baseCss = (await readFile(join(here, "base.css"), "utf8")).trimEnd();

const filenames = (await readdir(cardsDir)).filter((name) => name.endsWith(".html")).sort();
const cards = [];

for (const filename of filenames) {
  const raw = await readFile(join(cardsDir, filename), "utf8");
  cards.push(parseCard(raw, filename));
}

const seen = new Set();
for (const card of cards) {
  if (seen.has(card.meta.file)) throw new Error(`duplicate output file ${card.meta.file}`);
  seen.add(card.meta.file);
}

cards.sort(
  (a, b) =>
    GROUP_ORDER.indexOf(a.meta.group) - GROUP_ORDER.indexOf(b.meta.group) ||
    a.meta.title.localeCompare(b.meta.title),
);

for (const card of cards) {
  await writeFile(join(outDir, card.meta.file), renderCard(card, baseCss));
}

const allForIndex = [...cards, ...MANUAL_CARDS.map((meta) => ({ meta }))].sort(
  (a, b) =>
    GROUP_ORDER.indexOf(a.meta.group) - GROUP_ORDER.indexOf(b.meta.group) ||
    a.meta.title.localeCompare(b.meta.title),
);

await writeFile(join(outDir, "index.html"), renderIndex(allForIndex, baseCss));

console.log(`built ${cards.length} cards + index.html into ds-bundle/`);
for (const group of GROUP_ORDER) {
  const inGroup = cards.filter((card) => card.meta.group === group);
  if (inGroup.length) console.log(`  ${group}: ${inGroup.map((card) => card.meta.file).join(", ")}`);
}
