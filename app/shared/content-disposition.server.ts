// RFC 6266: `filename` must stay ASCII-safe (old user agents choke on
// anything else), while `filename*` (RFC 5987) carries the full UTF-8 name —
// modern browsers prefer it, so "Grüße-signups.csv" saves under its real
// name instead of the dash-stripped fallback.
export function contentDispositionAttachment(filename: string) {
  const asciiFallback = filename.replace(/[^\w.-]+/g, "-");

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeRFC5987(filename)}`;
}

// encodeURIComponent leaves !'()* unencoded, but RFC 5987's attr-char set
// does not include '()* — encode them too.
function encodeRFC5987(value: string) {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
