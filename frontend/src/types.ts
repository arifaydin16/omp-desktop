export interface AgentRunOptions {
  instanceId?: string;
  prompt: string;
  model: string;
  smolModel: string;
  slowModel: string;
  planModel: string;
  thinkingLevel: string;
  approvalMode: string;
  autoApprove: boolean;
  goalMode: boolean;
  loopMode: boolean;
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
  totalCost?: number;
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

export type ContentBlock =
  | {
      id: string;
      type: 'thinking';
      content: string;
      timestamp: number;
    }
  | {
      id: string;
      type: 'text';
      content: string;
      timestamp: number;
    }
  | {
      id: string;
      type: 'tool';
      call: ToolCall;
      timestamp: number;
    };

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
  blocks?: ContentBlock[];
  workingStatus?: string;
  cost?: number;
  isAdvisor?: boolean;
  cliResult?: {
    command: string;
    output: string;
    exitCode: number;
    error?: string;
  };
}

export interface ToolCall {
  id: string;
  tool: string;
  intent?: string;
  args?: Record<string, unknown> | string;
  result?: string;
  status: 'pending' | 'running' | 'completed' | 'denied';
  isError?: boolean;
  details?: Record<string, unknown>;
  timestamp?: number;
}
export interface SkillItem {
  name: string;
  description: string;
  filePath: string;
  baseDir: string;
  isCustom: boolean;
}

export interface WorkspaceFileItem {
  name: string;
  relPath: string;
  fullPath: string;
  isDir: boolean;
}

export interface UsageLimit {
  id: string;
  label: string;
  window: {
    id: string;
    label: string;
    durationMs: number;
    resetsAt: number;
  };
  amount: {
    unit: string;
    remainingFraction: number;
    usedFraction: number;
    remaining: number;
    used: number;
    limit: number;
  };
  status: 'ok' | 'warning' | 'error' | string;
}

export interface UsageReport {
  provider: string;
  fetchedAt: number;
  limits: UsageLimit[];
  metadata?: {
    email?: string;
    projectId?: string;
    endpoint?: string;
  };
}

export interface UsageCapacity {
  window: string;
  durationMs: number;
  accounts: number;
  usedAccounts: number;
  remainingAccounts: number;
}

export interface UsageData {
  generatedAt?: number;
  reports?: UsageReport[];
  capacity?: Record<string, UsageCapacity[]>;
  rawText?: string;
}

export interface AuthCredentialItem {
  provider: string;
  type: string; // 'oauth' | 'api_key'
  key?: string;
  email?: string;
  expires?: number;
  projectId?: string;
  authorizedAt?: number;
}

export interface LoginEvent {
  type: 'started' | 'url' | 'waiting' | 'prompt' | 'success' | 'error' | 'cancelled';
  provider?: string;
  url?: string;
  launchUrl?: string;
  message?: string;
}

export interface LoginProviderDef {
  id: string;
  index: number;
  name: string;
  type: 'oauth' | 'api_key' | 'local';
  category: 'Popular' | 'OAuth / Web' | 'API Key' | 'Local';
  dashboardUrl?: string;
  description?: string;
}

export interface RemoteApiConfig {
  enabled: boolean;
  port: number;
  host: string;
  apiKey: string;
  pollingEnabled: boolean;
  pollingUrl: string;
  pollingInterval: number;
  pollingApiKey: string;
}

export interface EndpointsInfo {
  promptEndpoint: string;
  statusEndpoint: string;
  infoEndpoint: string;
}

export interface RunInfo {
  runId: string;
  prompt: string;
  cwd: string;
  model?: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed' | string;
  success: boolean;
  error?: string;
}

export interface RemoteApiStatus {
  enabled: boolean;
  running: boolean;
  port: number;
  host: string;
  apiKey: string;
  endpoints: EndpointsInfo;
  agentStatus: string;
  isWorking: boolean;
  status?: string;
  is_running?: boolean;
  is_idle?: boolean;
  task_id?: string;
  activeRunId?: string;
  currentRun?: RunInfo;
  lastRun?: RunInfo;
  pollingEnabled?: boolean;
  pollingActive?: boolean;
  pollingUrl?: string;
  pollingInterval?: number;
  lastPollTime?: string;
  lastPollStatus?: string;
}
