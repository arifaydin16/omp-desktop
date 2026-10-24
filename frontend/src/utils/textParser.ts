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

  // 1. Check for XML-style thinking tags: <think>...</think> or <thinking>...</thinking>
  const thinkTagMatch = cleaned.match(/^<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/i);
  if (thinkTagMatch) {
    const thinking = thinkTagMatch[1].trim();
    const response = cleaned.slice(thinkTagMatch[0].length).trim();
    return { thinking, response };
  }

  // 1b. In-progress / streaming unclosed <think> tag at start
  const openThinkMatch = cleaned.match(/^<think(?:ing)?>([\s\S]*)$/i);
  if (openThinkMatch) {
    return {
      thinking: openThinkMatch[1].trim(),
      response: '',
    };
  }

  // 2. Explicit "Thinking Process:" block before response
  const explicitThinkingMatch = cleaned.match(
    /^(?:Thinking Process|Thought Process|Reasoning Process|Thinking):\s*\n([\s\S]*?)(?:\n\n(?:Response|Answer|Final Answer):\s*\n|\n---\n)([\s\S]*)$/i
  );
  if (explicitThinkingMatch) {
    return {
      thinking: explicitThinkingMatch[1].trim(),
      response: explicitThinkingMatch[2].trim(),
    };
  }

  // Otherwise: the entire text is the genuine response! Never chop off markdown paragraphs!
  return { thinking: '', response: cleaned };
}
