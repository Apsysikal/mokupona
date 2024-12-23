const newLine = "\n";

export interface CSVReturnObject {
  // Mime type, always "text/csv"
  mimeType: "text/csv";

  // The size of the content string in characters/bytes
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
    size: data.length,
    data,
  };
}

function sanitizeCSVValue(value: string) {
  const valuesToSanitize = [",", "\n"];
  let needsSanitization = false;

  valuesToSanitize.forEach((sanitizeValue) => {
    if (value.includes(sanitizeValue)) {
      needsSanitization = true;
    }
  });

  if (needsSanitization) return '"' + value + '"';
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
