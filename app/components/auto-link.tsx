import type { ReactNode } from "react";

const URL_DELIMITER =
  /((?:https?:\/\/)?(?:(?:[a-z0-9]?(?:[a-z0-9\-]{1,61}[a-z0-9])?\.[^\.|\s])+[a-z\.]*[a-z]+|(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3})(?::\d{1,5})*[a-z0-9.,_\/~#&=;%+?\-\\(\\)]*)/gi;

/**
 * Strips unbalanced trailing closing parentheses from a URL string.
 * For example, "https://example.com)" becomes "https://example.com",
 * while "https://en.wikipedia.org/wiki/Tokyo_(Japan)" is left unchanged.
 */
function stripTrailingUnbalancedParens(url: string): string {
  const openCount = (url.match(/\(/g) ?? []).length;
  const closeCount = (url.match(/\)/g) ?? []).length;
  const excess = closeCount - openCount;
  if (excess <= 0) return url;
  return url.replace(new RegExp(`\\){${excess}}$`), "");
}

export type AutoLinkPart =
  | { type: "text"; value: string }
  | { type: "link"; url: string };

/**
 * Parses a plain-text string and returns an array of parts, where each part
 * is either a plain-text segment or a detected URL.
 */
export function parseAutoLinks(text: string): AutoLinkPart[] {
  return text.split(URL_DELIMITER).flatMap((word): AutoLinkPart[] => {
    const match = word.match(URL_DELIMITER);
    if (match) {
      const url = stripTrailingUnbalancedParens(match[0]);
      const trailing = match[0].slice(url.length);
      return [
        { type: "link", url },
        ...(trailing ? [{ type: "text" as const, value: trailing }] : []),
      ];
    }
    return word ? [{ type: "text", value: word }] : [];
  });
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
              rel="noreferrer"
              href={url.startsWith("http") ? url : `http://${url}`}
              className="underline"
            >
              {url}
            </a>
          );
        }
        return (
          <span key={`text-${index}-${part.value}`}>{part.value}</span>
        );
      })}
      {children}
    </>
  );
}
