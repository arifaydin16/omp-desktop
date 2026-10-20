/**
 * Splits raw model output into omp's internal English thinking process
 * and the actual Turkish response.
 */
export interface SplitResult {
  thinking: string;
  response: string;
}

export function splitThinkingAndResponse(text: string): SplitResult {
  if (!text) {
    return { thinking: '', response: '' };
  }

  // Clean any transient Working... phrases
  const cleaned = text.replace(/^\s*Working(?:\.\.\.|…)?\s*\n?/gi, '').trim();
  if (!cleaned) {
    return { thinking: '', response: '' };
  }

  // 1. Double newline split (natural paragraph boundary)
  if (cleaned.includes('\n\n')) {
    const blocks = cleaned
      .split(/\n\n+/)
      .map((b) => b.trim())
      .filter(Boolean);

    if (blocks.length > 1) {
      return {
        thinking: blocks.slice(0, -1).join('\n\n'),
        response: blocks[blocks.length - 1],
      };
    }
  }

  // 2. Line by line analysis: Detect transition from English reasoning to Turkish answer
  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return { thinking: '', response: cleaned };
  }

  const turkishChars = /[çğıöşüÇĞİÖŞÜ]/;
  const commonTrWords =
    /\b(anlaşıldı|anladım|merhaba|tabii|tabi|evet|hayır|tamam|hangi|selam|görev|modül|dosya|proje|şöyle|şunlar|kod|hata|çözüm|nasıl|neden|için|başlayalım)\b/i;

  const thinkingLines: string[] = [];
  const responseLines: string[] = [];
  let foundResponse = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hasTrChar = turkishChars.test(line);
    const hasTrWord = commonTrWords.test(line);

    // If Turkish content starts after English thought lines
    if ((hasTrChar || hasTrWord) && !foundResponse && i > 0) {
      foundResponse = true;
    }

    if (foundResponse) {
      responseLines.push(line);
    } else {
      thinkingLines.push(line);
    }
  }

  if (foundResponse && thinkingLines.length > 0) {
    return {
      thinking: thinkingLines.join('\n\n'),
      response: responseLines.join('\n'),
    };
  }

  return { thinking: '', response: cleaned };
}
