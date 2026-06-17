const MOJIBAKE_CHARS = /[ÃÐÑ]/g;
const REPLACEMENT_CHAR = /\uFFFD/g;
const CYRILLIC_CHARS = /[\u0400-\u04FF]/g;

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function getReadableNameScore(value: string): number {
  return (
    countMatches(value, CYRILLIC_CHARS) * 2 -
    countMatches(value, MOJIBAKE_CHARS) * 2 -
    countMatches(value, REPLACEMENT_CHAR) * 5
  );
}

export function normalizeFileNameEncoding(fileName: string): string {
  if (!fileName) return fileName;

  const decoded = Buffer.from(fileName, 'latin1').toString('utf8');
  const originalScore = getReadableNameScore(fileName);
  const decodedScore = getReadableNameScore(decoded);

  if (
    decoded !== fileName &&
    decodedScore > originalScore &&
    countMatches(decoded, REPLACEMENT_CHAR) === 0
  ) {
    return decoded.normalize('NFC');
  }

  return fileName.normalize('NFC');
}

function getAsciiFileNameFallback(fileName: string): string {
  const fallback = fileName
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_')
    .trim();

  return fallback || 'file';
}

function encodeRFC5987Value(value: string): string {
  return encodeURIComponent(value)
    .replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16)}`)
    .replace(/\*/g, '%2A');
}

export function buildInlineContentDisposition(fileName: string): string {
  const normalizedName = normalizeFileNameEncoding(fileName);
  return `inline; filename="${getAsciiFileNameFallback(
    normalizedName,
  )}"; filename*=UTF-8''${encodeRFC5987Value(normalizedName)}`;
}
