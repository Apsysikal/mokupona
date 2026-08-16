export function contentDispositionAttachment(filename: string) {
  const asciiFallback = filename.replace(/[^\w.-]+/g, "-");

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeRFC5987(filename)}`;
}

function encodeRFC5987(value: string) {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
