import { ChatMessage, ContentBlock, ToolCall } from '../types';

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

/**
 * Parses raw JSONL rows from an omp session transcript into structured ChatMessages
 * with backwards compatibility, full tool results matching, and chronological blocks.
 */
export function parseSessionTranscript(rawRows: unknown[]): ChatMessage[] {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return [];
  }

  const chatMessages: ChatMessage[] = [];
  let currentAssistant: ChatMessage | null = null;

  for (const item of rawRows) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;

    let msgObj: Record<string, unknown> = row;
    const rowType = typeof row.type === 'string' ? row.type : '';

    if (rowType === 'message' && row.message && typeof row.message === 'object') {
      msgObj = row.message as Record<string, unknown>;
    } else if (rowType !== 'message' && typeof row.role !== 'string') {
      // Non-message metadata line (e.g. title, session, credential_pin), skip
      continue;
    }

    const role = (typeof msgObj.role === 'string' ? msgObj.role : 'assistant') as string;
    const content = msgObj.content;
    const rawId = String(row.id || msgObj.id || 'msg_' + chatMessages.length);
    const ts = String(row.timestamp || msgObj.timestamp || new Date().toISOString());

    if (role === 'user') {
      currentAssistant = null;
      let text = '';
      const files: string[] = [];

      if (Array.isArray(content)) {
        for (const p of content) {
          if (!p || typeof p !== 'object') continue;
          const part = p as Record<string, unknown>;
          if (part.type === 'text' && typeof part.text === 'string') {
            text += part.text;
          } else if (part.type === 'image') {
            files.push('[Resim]');
          }
        }
      } else if (typeof content === 'string') {
        text = content;
      }

      if (text.trim() || files.length > 0) {
        chatMessages.push({
          id: rawId,
          role: 'user',
          text,
          timestamp: ts,
          files: files.length > 0 ? files : undefined,
        });
      }
    } else if (role === 'assistant') {
      if (!currentAssistant) {
        currentAssistant = {
          id: rawId,
          role: 'assistant',
          text: '',
          thinking: '',
          timestamp: ts,
          toolCalls: [],
          blocks: [],
        };
        chatMessages.push(currentAssistant);
      }

      const blockTimestamp = ts ? new Date(ts).getTime() : Date.now();

      if (Array.isArray(content)) {
        for (const p of content) {
          if (!p || typeof p !== 'object') continue;
          const part = p as Record<string, unknown>;
          const pType = typeof part.type === 'string' ? part.type : '';

          if (pType === 'thinking' && typeof part.thinking === 'string') {
            currentAssistant.thinking = (currentAssistant.thinking || '') + part.thinking;
            currentAssistant.blocks!.push({
              id: 'blk_th_' + currentAssistant.blocks!.length,
              type: 'thinking',
              content: part.thinking,
              timestamp: blockTimestamp,
            });
          } else if (pType === 'text' && typeof part.text === 'string') {
            currentAssistant.text = (currentAssistant.text || '') + part.text;
            currentAssistant.blocks!.push({
              id: 'blk_tx_' + currentAssistant.blocks!.length,
              type: 'text',
              content: part.text,
              timestamp: blockTimestamp,
            });
          } else if (pType === 'toolCall') {
            const callId = String(part.id || 'tc_' + Math.random().toString(36).slice(2));
            const toolName = String(part.name || 'tool');
            const intent = typeof part.intent === 'string' ? part.intent : undefined;
            const args = (part.arguments as Record<string, unknown> | string) || undefined;

            const tc: ToolCall = {
              id: callId,
              tool: toolName,
              intent,
              args,
              status: 'running',
              timestamp: blockTimestamp,
            };

            currentAssistant.toolCalls!.push(tc);
            currentAssistant.blocks!.push({
              id: 'blk_tl_' + callId,
              type: 'tool',
              call: tc,
              timestamp: blockTimestamp,
            });
          }
        }
      } else if (typeof content === 'string') {
        currentAssistant.text = (currentAssistant.text || '') + content;
        currentAssistant.blocks!.push({
          id: 'blk_tx_' + currentAssistant.blocks!.length,
          type: 'text',
          content,
          timestamp: blockTimestamp,
        });
      }
    } else if (role === 'toolResult') {
      const toolCallId = String(msgObj.toolCallId || '');
      let resText = '';

      if (Array.isArray(content)) {
        for (const p of content) {
          if (p && typeof p === 'object' && 'text' in (p as Record<string, unknown>)) {
            resText += String((p as Record<string, unknown>).text || '');
          }
        }
      } else if (typeof content === 'string') {
        resText = content;
      }

      const isError = Boolean(msgObj.isError);

      if (currentAssistant && toolCallId) {
        if (currentAssistant.toolCalls) {
          for (const tc of currentAssistant.toolCalls) {
            if (tc.id === toolCallId) {
              tc.result = resText;
              tc.status = isError ? 'denied' : 'completed';
              tc.isError = isError;
            }
          }
        }
        if (currentAssistant.blocks) {
          for (const b of currentAssistant.blocks) {
            if (b.type === 'tool' && b.call.id === toolCallId) {
              b.call.result = resText;
              b.call.status = isError ? 'denied' : 'completed';
              b.call.isError = isError;
            }
          }
        }
      }
    } else if (role === 'system') {
      currentAssistant = null;
      let text = '';
      if (typeof content === 'string') text = content;
      else if (Array.isArray(content)) {
        for (const p of content) {
          if (p && typeof p === 'object' && 'text' in (p as Record<string, unknown>)) {
            text += String((p as Record<string, unknown>).text || '');
          }
        }
      }
      if (text.trim()) {
        chatMessages.push({
          id: rawId,
          role: 'system',
          text,
          timestamp: ts,
        });
      }
    }
  }

  return chatMessages;
}
