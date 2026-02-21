import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth, getAuthToken } from '../contexts/AuthContext';

export type AIProvider = 'claude-code' | 'codex' | 'gemini-cli' | 'openai' | 'anthropic' | 'google' | 'deepseek' | 'qwen';

// Local CLI providers that don't need API keys (dev only)
export const LOCAL_PROVIDERS = new Set<AIProvider>(['claude-code', 'codex', 'gemini-cli']);
export const IS_LOCAL = import.meta.env.DEV;

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

const AI_CONFIG_KEY = 'dsa-prep-ai-config';
const API_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

const MODELS: Record<AIProvider, string[]> = {
  'claude-code': ['claude-code-local'],
  'codex': ['codex-local'],
  'gemini-cli': ['gemini-cli-local'],
  openai: ['gpt-4.1-nano', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o', 'o4-mini', 'o3-mini', 'gpt-4.5-preview'],
  anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929', 'claude-opus-4-6'],
  google: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-3-flash-preview', 'gemini-3-pro-preview'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  qwen: ['qwen-turbo-latest', 'qwen-plus-latest', 'qwen-max-latest', 'qwen3-235b-a22b', 'qwen3-32b', 'qwq-32b'],
};

export function getModels(provider: AIProvider): string[] {
  return MODELS[provider] || [];
}

export function loadAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return IS_LOCAL
    ? { provider: 'claude-code' as AIProvider, apiKey: '', model: 'claude-code-local' }
    : { provider: 'anthropic' as AIProvider, apiKey: '', model: 'claude-sonnet-4-5-20250929' };
}

export function saveAIConfig(config: AIConfig) {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}

const SYSTEM_PROMPT = `You are a DSA (Data Structures & Algorithms) coding tutor embedded in a practice tool. The student is working on a coding problem and needs guidance.

RULES:
- NEVER give the full solution or complete code
- Give small, focused hints that guide thinking
- Ask Socratic questions to help them discover the approach
- If they're stuck, suggest the pattern or data structure to consider
- Point out edge cases they might be missing
- If their code has a bug, hint at WHERE the issue is, not HOW to fix it
- Keep responses concise (2-4 sentences max)
- Use code snippets only for tiny illustrations (1-2 lines max, pseudocode preferred)
- If they explicitly ask for the solution, politely decline and offer a stronger hint instead

You have context about the problem they're solving and their current code.`;

const OPENAI_COMPAT_URLS: Partial<Record<AIProvider, string>> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
};

async function streamOpenAICompat(config: AIConfig, messages: AIMessage[], systemContext: string, onChunk: (text: string) => void, signal: AbortSignal) {
  const url = OPENAI_COMPAT_URLS[config.provider] || OPENAI_COMPAT_URLS.openai!;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + '\n\n' + systemContext },
        ...messages,
      ],
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${config.provider} API error: ${res.status} - ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const json = JSON.parse(line.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) onChunk(content);
        } catch { }
      }
    }
  }
}

async function streamAnthropic(config: AIConfig, messages: AIMessage[], systemContext: string, onChunk: (text: string) => void, signal: AbortSignal) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 512,
      stream: true,
      system: SYSTEM_PROMPT + '\n\n' + systemContext,
      messages,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} - ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.type === 'content_block_delta' && json.delta?.text) {
            onChunk(json.delta.text);
          }
        } catch { }
      }
    }
  }
}

async function streamGoogle(config: AIConfig, messages: AIMessage[], systemContext: string, onChunk: (text: string) => void, signal: AbortSignal) {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT + '\n\n' + systemContext }] },
        contents,
      }),
      signal,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google API error: ${res.status} - ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const json = JSON.parse(line.slice(6));
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) onChunk(text);
        } catch { }
      }
    }
  }
}

// Maps frontend provider names to server-side tool names
const LOCAL_TOOL_MAP: Partial<Record<AIProvider, string>> = {
  'claude-code': 'claude',
  'codex': 'codex',
  'gemini-cli': 'gemini',
};

async function streamLocalCLI(config: AIConfig, messages: AIMessage[], systemContext: string, onChunk: (text: string) => void, signal: AbortSignal) {
  const tool = LOCAL_TOOL_MAP[config.provider] || 'claude';
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      systemPrompt: SYSTEM_PROMPT + '\n\n' + systemContext,
      tool,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Local CLI server error: ${res.status} - ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.text) onChunk(json.text);
          if (json.error) throw new Error(json.error);
        } catch (e: any) {
          if (e.message && !e.message.includes('JSON')) throw e;
        }
      }
    }
  }
}

const LOCAL_CHATS_KEY = 'dsa-prep-chats';

function loadLocalChats(): Record<string, AIMessage[]> {
  try {
    const raw = localStorage.getItem(LOCAL_CHATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalChats(all: Record<string, AIMessage[]>) {
  localStorage.setItem(LOCAL_CHATS_KEY, JSON.stringify(all));
}

export function useAI(problemId?: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load chat history when problem changes
  useEffect(() => {
    if (!problemId) return;
    setMessages([]);
    setError(null);

    if (user) {
      // Signed in: load from backend API
      const token = getAuthToken();
      if (!token) return;

      fetch(`${API_URL}/api/chats?problemId=${problemId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.messages && Array.isArray(data.messages)) {
            setMessages(data.messages as AIMessage[]);
          }
        })
        .catch(err => console.error('Failed to load chats:', err));
    } else {
      // Guest: load from localStorage
      const all = loadLocalChats();
      if (all[problemId]) {
        setMessages(all[problemId]);
      }
    }
  }, [user, problemId]);

  const persistMessages = useCallback((msgs: AIMessage[]) => {
    if (!problemId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (user) {
        // Signed in: save to backend API
        const token = getAuthToken();
        if (!token) return;

        fetch(`${API_URL}/api/chats`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ problemId, messages: msgs }),
        }).catch(err => console.error('Failed to save chats:', err));
      } else {
        // Guest: save to localStorage
        const all = loadLocalChats();
        all[problemId] = msgs;
        saveLocalChats(all);
      }
    }, 300);
  }, [user, problemId]);

  const ask = useCallback(async (
    userMessage: string,
    config: AIConfig,
    systemContext: string,
    signal?: AbortSignal,
  ) => {
    setError(null);
    const newMessages: AIMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsStreaming(true);

    let fullResponse = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const onChunk = (text: string) => {
      fullResponse += text;
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: fullResponse },
      ]);
    };

    try {
      const streamFn = LOCAL_PROVIDERS.has(config.provider) ? streamLocalCLI
        : config.provider === 'anthropic' ? streamAnthropic
        : config.provider === 'google' ? streamGoogle
        : streamOpenAICompat;

      await streamFn(config, newMessages, systemContext, onChunk, signal || new AbortController().signal);

      // Persist after streaming completes
      const finalMessages: AIMessage[] = [...newMessages, { role: 'assistant', content: fullResponse }];
      persistMessages(finalMessages);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message);
      }
      // Still persist the user message + partial response
      if (fullResponse) {
        persistMessages([...newMessages, { role: 'assistant', content: fullResponse }]);
      }
    } finally {
      setIsStreaming(false);
    }
  }, [messages, persistMessages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    if (!problemId) return;
    if (user) {
      const token = getAuthToken();
      if (!token) return;

      fetch(`${API_URL}/api/chats?problemId=${problemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(err => console.error('Failed to delete chats:', err));
    } else {
      const all = loadLocalChats();
      delete all[problemId];
      saveLocalChats(all);
    }
  }, [user, problemId]);

  return { messages, isStreaming, error, ask, clearMessages };
}
