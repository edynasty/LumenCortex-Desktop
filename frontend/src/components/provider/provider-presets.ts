import type { ProviderPackage } from "../../types";

export type ProviderPreset = {
  id: string;
  name: string;
  baseURL: string;
  envVar: string;
  package: ProviderPackage;
};

export const providerPresets: ProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    envVar: "OPENAI_API_KEY",
    package: "openai-compatible",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    envVar: "DEEPSEEK_API_KEY",
    package: "openai-compatible",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    envVar: "OPENROUTER_API_KEY",
    package: "openai-compatible",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseURL: "https://api.anthropic.com",
    envVar: "ANTHROPIC_API_KEY",
    package: "anthropic-messages",
  },
];
