import type { MailMessage } from "./types";

type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "action"; label: string; url: string }
  | { kind: "note"; text: string };

export function paragraph(text: string): Block {
  return { kind: "paragraph", text };
}

export function action(label: string, url: string): Block {
  return { kind: "action", label, url };
}

export function note(text: string): Block {
  return { kind: "note", text };
}

export type MailBody = Omit<MailMessage, "to">;

export function compose(subject: string, blocks: Block[]): MailBody {
  for (const block of blocks) {
    if (block.kind === "action") assertWebUrl(block.url);
  }

  return {
    subject,
    text: renderText(blocks),
    html: renderHtml(subject, blocks),
  };
}

// Cypress finds mailed links by scanning `text` for absolute URLs, so an
// action has to leave its URL bare on its own line (see cypress/support/mail).
function renderText(blocks: Block[]): string {
  const lines = blocks.map((block) =>
    block.kind === "action" ? block.url : block.text,
  );
  return lines.join("\n\n");
}

const NOTE_STYLE = "color: #666; font-size: 13px;";

function renderHtml(subject: string, blocks: Block[]): string {
  // Hidden first line most clients show next to the subject in the inbox list.
  const preheader =
    blocks.find((block) => block.kind === "paragraph")?.text ?? subject;
  const body = blocks.map(renderBlock).join("\n      ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin: 0; padding: 24px;">
    <span style="display: none; max-height: 0; overflow: hidden;">${escapeHtml(preheader)}</span>
    <div style="font-family: sans-serif; line-height: 1.5; max-width: 32rem;">
      ${body}
    </div>
  </body>
</html>`;
}

function renderBlock(block: Block): string {
  switch (block.kind) {
    case "paragraph":
      return `<p>${escapeHtml(block.text)}</p>`;
    case "note":
      return `<p style="${NOTE_STYLE}">${escapeHtml(block.text)}</p>`;
    case "action":
      return [
        `<p><a href="${escapeHtml(block.url)}">${escapeHtml(block.label)}</a></p>`,
        `<p style="${NOTE_STYLE}">If the link doesn't work, copy and paste this address into your browser:<br>${escapeHtml(block.url)}</p>`,
      ].join("\n      ");
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Every link we mail is app-generated today, but a template is one feature
// request away from interpolating something a user typed. Refuse anything that
// isn't a plain web URL rather than trusting the escaper to catch `javascript:`.
function assertWebUrl(url: string): void {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    throw new Error(`Mail action link must be an absolute URL, got "${url}"`);
  }
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error(`Mail action link must be http(s), got "${url}"`);
  }
}
