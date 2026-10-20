export interface AgentRunOptions {
  prompt: string;
  model: string;
  smolModel: string;
  slowModel: string;
  planModel: string;
  thinkingLevel: string;
  approvalMode: string;
  autoApprove: boolean;
  goalMode: boolean;
  planYolo: boolean;
  prewalk: boolean;
  advisor: boolean;
  profile: string;
  cwd: string;
  sessionId: string;
  files: string[];
}

export interface SessionSummary {
  id: string;
  path: string;
  title: string;
  project: string;
  cwd: string;
  model: string;
  updatedAt: string;
  msgCount: number;
}

export interface SessionDetail {
  summary: SessionSummary;
  messages: Record<string, unknown>[];
}

export interface ModelEntry {
  id: string;
  provider: string;
  kind: string;
  selector: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
  reasoning: boolean;
  thinking: string[];
  input: string[];
  cost?: Record<string, unknown>;
}

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  channel: string;
  message: string;
  lastChecked: string;
  checking: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  thinking?: string;
  timestamp: string;
  files?: string[];
  command?: string;
  exitCode?: number;
  toolCalls?: ToolCall[];
  workingStatus?: string;
}

export interface ToolCall {
  id: string;
  tool: string;
  args?: Record<string, unknown> | string;
  result?: string;
  status: 'pending' | 'running' | 'completed' | 'denied';
}

export interface SkillItem {
  name: string;
  description: string;
  filePath: string;
  baseDir: string;
  isCustom: boolean;
}
