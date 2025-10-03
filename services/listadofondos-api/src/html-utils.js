const BREAK_TAG_REGEX = /<(?:br|BR)\s*\/?>(\s*)/g;
const BLOCK_CLOSE_REGEX = /<\/(?:p|div|li|tr|h[1-6])>/gi;
const TAG_REGEX = /<[^>]+>/g;

export function decodeHtml(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&euro;/gi, "€")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, dec) =>
      String.fromCharCode(parseInt(dec, 10)),
    );
}

export function stripHtml(html) {
  if (!html) return "";
  return decodeHtml(String(html).replace(TAG_REGEX, " "));
}

export function htmlToPlainText(html) {
  if (!html) return "";
  const withBreaks = String(html)
    .replace(BREAK_TAG_REGEX, "\n$1")
    .replace(BLOCK_CLOSE_REGEX, "\n");
  const withoutTags = withBreaks.replace(TAG_REGEX, " ");
  return decodeHtml(withoutTags)
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
