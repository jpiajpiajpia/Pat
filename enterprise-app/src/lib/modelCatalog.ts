export type ModelRole = "chat" | "code" | "reasoning" | "vision" | "embedding";

export interface CatalogModel {
  id: string;             // ollama model ID (used for pull / model param)
  displayName: string;
  role: ModelRole;
  sizeGB: number;         // approximate download size
  description: string;
  recommended?: boolean;
  required?: boolean;     // if true, the app needs this to function (e.g. embedding model)
}

export const MODEL_CATALOG: CatalogModel[] = [
  // Chat
  {
    id: "mistral:7b",
    displayName: "Mistral 7B",
    role: "chat",
    sizeGB: 4.1,
    description: "Fast, balanced general-purpose chat. Good default for everyday questions.",
    recommended: true,
  },
  {
    id: "llama3.2:3b",
    displayName: "Llama 3.2 3B",
    role: "chat",
    sizeGB: 2.0,
    description: "Smallest viable chat model — runs comfortably on 8GB RAM machines.",
  },
  {
    id: "qwen2.5:14b",
    displayName: "Qwen 2.5 14B",
    role: "chat",
    sizeGB: 9.0,
    description: "Strong multilingual reasoning and instruction following.",
  },
  {
    id: "gemma3:12b",
    displayName: "Gemma 3 12B",
    role: "chat",
    sizeGB: 8.1,
    description: "Google's latest. Excellent for analysis, writing, and Q&A.",
  },
  {
    id: "phi4:14b",
    displayName: "Phi-4 14B",
    role: "chat",
    sizeGB: 9.1,
    description: "Microsoft's frontier-quality compact model. Great for technical tasks.",
  },

  // Code
  {
    id: "qwen2.5-coder:7b",
    displayName: "Qwen 2.5 Coder 7B",
    role: "code",
    sizeGB: 4.7,
    description: "Default Code Agent model. Trained specifically for code generation and editing.",
    recommended: true,
  },
  {
    id: "qwen2.5-coder:14b",
    displayName: "Qwen 2.5 Coder 14B",
    role: "code",
    sizeGB: 9.0,
    description: "Larger coder variant. Better for complex multi-file refactors.",
  },
  {
    id: "deepseek-coder-v2:16b",
    displayName: "DeepSeek Coder V2 16B",
    role: "code",
    sizeGB: 8.9,
    description: "MoE coder model. Fast inference with strong code completion.",
  },

  // Reasoning
  {
    id: "deepseek-r1:8b",
    displayName: "DeepSeek R1 8B",
    role: "reasoning",
    sizeGB: 5.2,
    description: "Reasoning-focused model with explicit chain-of-thought. Use for hard problems.",
    recommended: true,
  },
  {
    id: "deepseek-r1:14b",
    displayName: "DeepSeek R1 14B",
    role: "reasoning",
    sizeGB: 9.0,
    description: "Larger reasoning variant. Slower but more thorough analysis.",
  },

  // Vision
  {
    id: "llama3.2-vision:11b",
    displayName: "Llama 3.2 Vision 11B",
    role: "vision",
    sizeGB: 7.8,
    description: "Multimodal — can describe and analyze images.",
  },

  // Embedding (required for the Memory feature)
  {
    id: "nomic-embed-text",
    displayName: "Nomic Embed Text",
    role: "embedding",
    sizeGB: 0.3,
    description: "Powers semantic memory search. Required for the Memory feature.",
    required: true,
  },
];

export function modelsByRole(role: ModelRole): CatalogModel[] {
  return MODEL_CATALOG.filter((m) => m.role === role);
}

export function getCatalogModel(id: string): CatalogModel | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}
