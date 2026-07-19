const newLine = "\n";

// Excel ignores the HTTP charset and assumes a legacy codepage unless the
// file starts with a UTF-8 byte-order mark — without it, umlauts and other
// non-ASCII characters render as mojibake ("Jürgen" -> "JÃ¼rgen").
const UTF8_BOM = "\uFEFF";

export interface CSVReturnObject {
  // Mime type, always UTF-8 CSV
  mimeType: "text/csv; charset=utf-8";

  // The size of the content string in UTF-8 bytes (Content-Length safe)
  size: number;

  // The concatenated string of values, BOM included
  data: string;
}

export function buildCSVObject(
  header: string[],
  values: string[][],
  separator = ",",
): CSVReturnObject {
  const combinedArray = [[...header], ...values];
  const sanitizedArray = combinedArray.map((valueArray) => {
    return valueArray.map((value) => sanitizeCSVValue(value));
  });

  const data = UTF8_BOM + nestedArrayToCSVString(sanitizedArray, separator);
  return {
    mimeType: "text/csv; charset=utf-8",
    // string length counts UTF-16 code units, which undercounts multi-byte
    // characters and truncates downloads when used as Content-Length
    size: Buffer.byteLength(data, "utf8"),
    data,
  };
}

// RFC 4180: a field containing separators, quotes, or line breaks is wrapped
// in double quotes, and embedded double quotes are doubled.
function sanitizeCSVValue(value: string) {
  const needsSanitization = [",", "\n", "\r", '"'].some((character) =>
    value.includes(character),
  );

  if (needsSanitization) return '"' + value.replaceAll('"', '""') + '"';
  return value;
}

function arrayToCSVString(array: string[], separator = ","): string {
  return array.join(separator) + newLine;
}

function nestedArrayToCSVString(array: string[][], separator = ","): string {
  let text = "";

  array.forEach((nestedArray) => {
    text += arrayToCSVString(nestedArray, separator);
  });

  return text;
}
