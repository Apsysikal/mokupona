const newLine = "\n";

export interface CSVReturnObject {
  // Mime type, always "text/csv"
  mimeType: "text/csv";

  // The size of the content string in UTF-8 bytes (Content-Length safe)
  size: number;

  // The concatenated string of values
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

  const data = nestedArrayToCSVString(sanitizedArray, separator);
  return {
    mimeType: "text/csv",
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
  return [...array, newLine].join(separator);
}

function nestedArrayToCSVString(array: string[][], separator = ","): string {
  let text = "";

  array.forEach((nestedArray) => {
    text += arrayToCSVString(nestedArray, separator);
  });

  return text;
}
