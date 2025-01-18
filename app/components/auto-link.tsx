import { ReactNode } from "react";

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
  const delimiter =
    /((?:https?:\/\/)?(?:(?:[a-z0-9]?(?:[a-z0-9\-]{1,61}[a-z0-9])?\.[^\.|\s])+[a-z\.]*[a-z]+|(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3})(?::\d{1,5})*[a-z0-9.,_\/~#&=;%+?\-\\(\\)]*)/gi;

  return (
    <>
      {text.split(delimiter).map((word) => {
        const match = word.match(delimiter);
        if (match) {
          const url = match[0];
          return (
            <a
              target="_blank"
              rel="noreferrer"
              href={url.startsWith("http") ? url : `http://${url}`}
              className="underline"
            >
              {url}
            </a>
          );
        }
        return word;
      })}
      {children}
    </>
  );
}
