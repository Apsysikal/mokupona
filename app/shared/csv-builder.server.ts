const newLine = "\n";

const UTF8_BOM = "\uFEFF";

export interface CSVReturnObject {
  mimeType: "text/csv; charset=utf-8";

  size: number;

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
    size: Buffer.byteLength(data, "utf8"),
    data,
  };
}

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
