import { LoginProviderDef } from '../types';

// Master list of 85 model providers aligned with `omp login`
export const LOGIN_PROVIDERS: LoginProviderDef[] = [
  // --- Popular ---
  {
    id: 'google-antigravity',
    index: 10,
    name: 'Google Antigravity (Gemini, Claude, GPT-OSS)',
    type: 'oauth',
    category: 'Popular',
    dashboardUrl: 'https://accounts.google.com',
    description: 'Google Cloud Antigravity geliştirici hesabı ve kotaları (OAuth 2.0)'
  },
  {
    id: 'anthropic',
    index: 2,
    name: 'Anthropic (Claude Pro/Max)',
    type: 'oauth',
    category: 'Popular',
    dashboardUrl: 'https://claude.ai',
    description: 'Claude Pro / Max abonelik yetkilendirmesi ve oturum açma (OAuth)'
  },
  {
    id: 'openai-codex',
    index: 1,
    name: 'ChatGPT Plus/Pro (Codex Subscription)',
    type: 'oauth',
    category: 'Popular',
    dashboardUrl: 'https://chatgpt.com',
    description: 'ChatGPT Plus/Pro aboneliği ve Codex oturumu (OAuth)'
  },
  {
    id: 'openrouter',
    index: 6,
    name: 'OpenRouter',
    type: 'oauth',
    category: 'Popular',
    dashboardUrl: 'https://openrouter.ai/keys',
    description: 'Tüm popüler modeller için birleşik LLM ağ geçidi (OAuth veya API Key)'
  },
  {
    id: 'deepseek',
    index: 37,
    name: 'DeepSeek',
    type: 'api_key',
    category: 'Popular',
    dashboardUrl: 'https://platform.deepseek.com/api_keys',
    description: 'DeepSeek V3 ve R1 akıl yürütme modelleri resmi API erişimi'
  },
  {
    id: 'github-copilot',
    index: 7,
    name: 'GitHub Copilot',
    type: 'oauth',
    category: 'Popular',
    dashboardUrl: 'https://github.com/login',
    description: 'GitHub Copilot abonelik yetkilendirmesi (Device/Web OAuth)'
  },
  {
    id: 'cursor',
    index: 8,
    name: 'Cursor (Claude, GPT, etc.)',
    type: 'oauth',
    category: 'Popular',
    dashboardUrl: 'https://cursor.com',
    description: 'Cursor abonelik oturumu ve model entegrasyonu'
  },
  {
    id: 'xai',
    index: 14,
    name: 'xAI Grok (SuperGrok / X Premium+)',
    type: 'oauth',
    category: 'Popular',
    dashboardUrl: 'https://console.x.ai',
    description: 'xAI Grok resmi OAuth ve API anahtarı erişimi'
  },
  {
    id: 'kimi-code',
    index: 5,
    name: 'Kimi Code (Moonshot AI)',
    type: 'api_key',
    category: 'Popular',
    dashboardUrl: 'https://platform.moonshot.cn/console/api-keys',
    description: 'Moonshot AI Kimi Code ve uzun bağlamlı model planı'
  },
  {
    id: 'groq',
    index: 66,
    name: 'Groq / Kilo Gateway',
    type: 'api_key',
    category: 'Popular',
    dashboardUrl: 'https://console.groq.com/keys',
    description: 'Ultra yüksek hızlı LPU donanımında açık kaynak model çıkarımı'
  },
  {
    id: 'together',
    index: 47,
    name: 'Together AI',
    type: 'api_key',
    category: 'Popular',
    dashboardUrl: 'https://api.together.ai/settings/api-keys',
    description: 'Llama, Qwen ve açık modeller için optimize edilmiş bulut kümesi'
  },
  {
    id: 'fireworks',
    index: 46,
    name: 'Fireworks AI',
    type: 'api_key',
    category: 'Popular',
    dashboardUrl: 'https://fireworks.ai/api-keys',
    description: 'Gecikme süresi optimize edilmiş model çıkarım servisi'
  },
  {
    id: 'cerebras',
    index: 43,
    name: 'Cerebras',
    type: 'api_key',
    category: 'Popular',
    dashboardUrl: 'https://cloud.cerebras.ai/platform/',
    description: 'Wafer-scale engine ile saniyede 1800+ token çıkarım hızı'
  },
  {
    id: 'ollama',
    index: 76,
    name: 'Ollama (Yerel OpenAI-Uyumlu)',
    type: 'local',
    category: 'Local',
    dashboardUrl: 'http://localhost:11434',
    description: 'Yerel bilgisayarınızda çalışan çevrimdışı Ollama modelleri'
  },
  {
    id: 'lm-studio',
    index: 78,
    name: 'LM Studio (Yerel)',
    type: 'local',
    category: 'Local',
    dashboardUrl: 'http://localhost:1234',
    description: 'LM Studio yerel sunucu bağlantısı (OpenAI API uyumlu)'
  },
  {
    id: 'vllm',
    index: 80,
    name: 'vLLM (Yerel Sunucu)',
    type: 'local',
    category: 'Local',
    dashboardUrl: 'http://localhost:8000',
    description: 'Yüksek throughput vLLM yerel çıkarım servisi'
  },
  // --- OAuth / Web ---
  {
    id: 'devin',
    index: 9,
    name: 'Devin',
    type: 'oauth',
    category: 'OAuth / Web',
    dashboardUrl: 'https://devin.ai',
    description: 'Cognition Devin AI platform hesabı'
  },
  {
    id: 'gemini-cli',
    index: 11,
    name: 'Google Cloud Code Assist (Gemini CLI)',
    type: 'oauth',
    category: 'OAuth / Web',
    dashboardUrl: 'https://console.cloud.google.com',
    description: 'Google Cloud Code Assist kurumsal yetkilendirme'
  },
  {
    id: 'gitlab-duo',
    index: 15,
    name: 'GitLab Duo (Agent / Non-Agentic)',
    type: 'oauth',
    category: 'OAuth / Web',
    dashboardUrl: 'https://gitlab.com',
    description: 'GitLab Duo kurumsal yapay zeka hesabı'
  },
  {
    id: 'z-ai',
    index: 3,
    name: 'Z.AI (GLM Coding Plan)',
    type: 'oauth',
    category: 'OAuth / Web',
    dashboardUrl: 'https://z.ai',
    description: 'Zhipu AI GLM kodlama aboneliği'
  },
  // --- API Key Providers ---
  {
    id: 'alibaba',
    index: 17,
    name: 'Alibaba Coding Plan (DashScope / Qwen)',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://dashscope.console.aliyun.com',
    description: 'Alibaba Qwen model ailesi ve token planı'
  },
  {
    id: 'perplexity',
    index: 52,
    name: 'Perplexity (Pro/Max)',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://www.perplexity.ai/settings/api',
    description: 'Perplexity online arama destekli model API anahtarı'
  },
  {
    id: 'siliconflow',
    index: 55,
    name: 'SiliconFlow',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://cloud.siliconflow.cn',
    description: 'SiliconFlow yüksek hızlı çıkarım ağı'
  },
  {
    id: 'huggingface',
    index: 51,
    name: 'Hugging Face Inference',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://huggingface.co/settings/tokens',
    description: 'Hugging Face Hub API erişim belirteci'
  },
  {
    id: 'cloudflare-ai',
    index: 62,
    name: 'Cloudflare AI Gateway',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://dash.cloudflare.com',
    description: 'Cloudflare yapay zeka ağ geçidi API belirteci'
  },
  {
    id: 'cloudflare-workers',
    index: 63,
    name: 'Cloudflare Workers AI',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://dash.cloudflare.com',
    description: 'Cloudflare Workers uç çıkarım modelleri'
  },
  {
    id: 'mistral',
    index: 40,
    name: 'Meta / Mistral Model API',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://console.mistral.ai/api-keys',
    description: 'Mistral AI resmi API erişimi'
  },
  {
    id: 'novita',
    index: 49,
    name: 'Novita AI',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://novita.ai',
    description: 'Ekonomik model çıkarım API hizmeti'
  },
  {
    id: 'deepinfra',
    index: 50,
    name: 'DeepInfra',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://deepinfra.com',
    description: 'Serverless açık kaynak model çıkarım platformu'
  },
  {
    id: 'baseten',
    index: 44,
    name: 'Baseten',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://baseten.co',
    description: 'Özelleştirilmiş model dağıtım platformu'
  },
  {
    id: 'venice',
    index: 54,
    name: 'Venice AI',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://venice.ai',
    description: 'Gizlilik odaklı, sansürsüz çıkarım'
  },
  {
    id: 'nanogpt',
    index: 58,
    name: 'NanoGPT',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://nano-gpt.com',
    description: 'Kullandıkça öde kripto mikro ödemeli model API'
  },
  {
    id: 'litellm',
    index: 65,
    name: 'LiteLLM',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://litellm.ai',
    description: 'LiteLLM evrensel proxy sunucusu'
  },
  {
    id: 'qwen-portal',
    index: 23,
    name: 'Qwen Portal',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://chat.qwenlm.ai',
    description: 'Qwen resmi geliştirici portalı'
  },
  {
    id: 'samba-nova',
    index: 25,
    name: 'SambaNova',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://sambanova.ai',
    description: 'SambaNova SN40L ultra hızlı çıkarım'
  },
  {
    id: 'minimax',
    index: 26,
    name: 'MiniMax Token Plan',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://api.minimax.chat',
    description: 'MiniMax dil ve ses model planı'
  },
  {
    id: 'xiaomi-mimo',
    index: 28,
    name: 'Xiaomi MiMo',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://xiaomi.com',
    description: 'Xiaomi yapay zeka modelleri'
  },
  {
    id: 'stepfun',
    index: 38,
    name: 'StepFun',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://stepfun.com',
    description: 'StepFun multimodal model API'
  },
  {
    id: 'tavily',
    index: 71,
    name: 'Tavily Search',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://tavily.com',
    description: 'Ajanlar için web arama API anahtarı'
  },
  {
    id: 'kagi',
    index: 72,
    name: 'Kagi Search',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://kagi.com',
    description: 'Kagi FastGPT ve arama API anahtarı'
  },
  {
    id: 'exa',
    index: 73,
    name: 'Exa AI Search',
    type: 'api_key',
    category: 'API Key',
    dashboardUrl: 'https://exa.ai',
    description: 'Semantik web arama API anahtarı'
  }
];
