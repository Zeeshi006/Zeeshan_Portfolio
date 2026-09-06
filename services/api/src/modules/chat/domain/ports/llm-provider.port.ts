export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
}

export type StreamWithToolsEvent =
  | { token: string }
  | { toolCall: ToolCall }
  | { usage: LLMUsage };

export interface ILLMProvider {
  chat(messages: ChatMessage[], systemPrompt: string): Promise<string>;
  streamWithTools(
    messages: ChatMessage[],
    systemPrompt: string,
    tools: Tool[],
  ): AsyncIterable<StreamWithToolsEvent>;
  chatWithTools(
    messages: ChatMessage[],
    systemPrompt: string,
    tools: Tool[],
  ): Promise<{ content: string; toolCalls: ToolCall[]; usage: LLMUsage }>;
}
