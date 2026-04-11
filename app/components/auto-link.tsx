import type { ReactNode } from "react";

const URL_DELIMITER =
  /((?:https?:\/\/)?(?:(?:[a-z0-9]?(?:[a-z0-9\-]{1,61}[a-z0-9])?\.[^\.|\s])+[a-z\.]*[a-z]+|(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3})(?::\d{1,5})*[a-z0-9.,_\/~#&=;%+?\-\\(\\)]*)/gi;

/**
 * Normalizes a regex-matched URL token into link URL + trailing text.
 * Rules:
 * - sentence punctuation at the end stays outside links
 * - unbalanced closing parens at the end stay outside links
 */
function normalizeMatchedUrl(rawUrl: string): {
  url: string;
  trailingText: string;
} {
  const trailingPunctuation = rawUrl.match(/[.,!?;:]+$/)?.[0] ?? "";
  const withoutTrailingPunctuation = trailingPunctuation
    ? rawUrl.slice(0, -trailingPunctuation.length)
    : rawUrl;

  const openCount = (withoutTrailingPunctuation.match(/\(/g) ?? []).length;
  const closeCount = (withoutTrailingPunctuation.match(/\)/g) ?? []).length;
  const excessTrailingCloseParens = Math.max(0, closeCount - openCount);

  const trailingCloseParensCount =
    withoutTrailingPunctuation.match(/\)+$/)?.[0].length ?? 0;
  const removableCloseParens = Math.min(
    trailingCloseParensCount,
    excessTrailingCloseParens,
  );

  const url = removableCloseParens
    ? withoutTrailingPunctuation.slice(0, -removableCloseParens)
    : withoutTrailingPunctuation;
  const trailingCloseParens = ")".repeat(removableCloseParens);

  return {
    url,
    trailingText: `${trailingCloseParens}${trailingPunctuation}`,
  };
}

function toHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function isValidUrlMatch(url: string): boolean {
  if (/^https?:\/\//i.test(url)) return true;
  return /^[a-z0-9]/i.test(url);
}

export type AutoLinkPart =
  | { type: "text"; value: string }
  | { type: "link"; url: string };

/**
 * Parses a plain-text string and returns an array of parts, where each part
 * is either a plain-text segment or a detected URL.
 */
export function parseAutoLinks(text: string): AutoLinkPart[] {
  const matcher = new RegExp(URL_DELIMITER.source, URL_DELIMITER.flags);
  const parts: AutoLinkPart[] = [];
  let lastIndex = 0;

  const pushText = (value: string) => {
    if (!value) return;

    const lastPart = parts[parts.length - 1];
    if (lastPart?.type === "text") {
      lastPart.value += value;
      return;
    }

    parts.push({ type: "text", value });
  };

  for (const match of text.matchAll(matcher)) {
    const rawUrl = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      pushText(text.slice(lastIndex, start));
    }

    const { url, trailingText } = normalizeMatchedUrl(rawUrl);
    if (isValidUrlMatch(url)) {
      parts.push({ type: "link", url });

      if (trailingText) {
        pushText(trailingText);
      }
    } else {
      pushText(rawUrl);
    }

    lastIndex = start + rawUrl.length;
  }

  if (lastIndex < text.length) {
    pushText(text.slice(lastIndex));
  }

  return parts;
}

/**
 * This function converts plain text with links into text
 * where the links have been replaced with an anchor tag.
 * Grabbed this from here: https://www.30secondsofcode.org/react/s/auto-link/
 * @param { text }
 * @returns A string of text where the detected links were replaced with anchor tags.
 */
export function AutoLink({
  text,
  children,
}: {
  text: string;
  children?: ReactNode;
}) {
  return (
    <>
      {parseAutoLinks(text).map((part, index) => {
        if (part.type === "link") {
          const { url } = part;
          return (
            <a
              key={`link-${index}-${url}`}
              target="_blank"
              rel="noopener noreferrer"
              href={toHref(url)}
              className="underline"
            >
              {url}
            </a>
          );
        }
        return <span key={`text-${index}-${part.value}`}>{part.value}</span>;
      })}
      {children}
    </>
  );
}
