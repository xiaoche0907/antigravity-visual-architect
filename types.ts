export enum WorkflowMode {
  PROMPT_ONLY = "PROMPT_ONLY",
  DIRECT_GENERATION = "DIRECT_GENERATION",
}

export enum RoleFocus {
  TECHNICAL = "TECHNICAL",
  LIFESTYLE = "LIFESTYLE",
  BALANCED = "BALANCED",
  VISUAL_ARCHITECT = "VISUAL_ARCHITECT",
}

export type BrainProvider =
  | "modelscope"
  | "google"
  | "openai"
  | "custom"
  | "gemini"
  | "grsai";

export interface AppConfig {
  mockMode: boolean;
  brain: {
    provider: BrainProvider;
    baseUrl: string;
    model: string;
    systemInstruction: string;
    apiKey?: string;
  };
  visual: {
    provider:
    | "modelscope"
    | "google"
    | "openai"
    | "custom"
    | "gemini"
    | "grsai";
    model: string;
    baseUrl: string;
    useSameKeyAsBrain: boolean;
    apiKey?: string;
  };
}

export interface ProductInput {
  productImages: string[]; // Base64 strings
  styleReferences: string[]; // Base64 strings
  usps: string;
  targetAudience: string;
  competitorPainPoints: string;
  specs: string;
}

export interface SecondaryImagePlan {
  id: number;
  type: string;
  description: string;
  visualPrompt: string;
  copywriting: string;
  generatedImageUrl?: string;
}

export interface APlusModulePlan {
  id: number;
  moduleType: string;
  content: string;
  visualGuidance: string; // 中文视觉指导 (用于人看)
  visualPrompt: string; // 英文生图提示词 (用于 AI 画)
  generatedImageUrl?: string;
}

export interface MarketingStrategy {
  analysis: string;
  secondaryImages: SecondaryImagePlan[];
  aPlusContent: APlusModulePlan[];
  // Error Handling Fields
  isError?: boolean;
  errorMessage?: string;
  rawResponse?: string;
}

export interface HistorySession {
  id: string;
  timestamp: number;
  title: string;
  thumbnail?: string;
  input: ProductInput;
  strategy: MarketingStrategy | null;
  mode: WorkflowMode;
  roleFocus: RoleFocus;
}

/**
 * 个人智能体配置
 * 用于"我的智能体"功能，允许用户创建自定义的通用智能体
 */
export interface PersonalAgent {
  id: string;
  name: string;
  avatar: string; // emoji 字符
  modelId: string; // 关联的 ModelConfig.id
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  role: "user" | "assistant" | "error" | "system";
  content: string;
  attachments?: string[];
  timestamp: number;
}

// === New V7.0 Dual-Agent Interfaces ===

export interface VisualStrategy {
  visual_dna_analysis: {
    brand_tone: string;
    color_palette: string; // Renamed from color_palette_hex
    lighting_strategy: string;
  };
  listing_image_plan: Array<{
    index: number;
    type: string;
    strategy_rationale: string;
    visual_execution: string;
    english_copy: string;
  }>;
  premium_aplus_plan: Array<{
    module_index: number;
    module_type: string;
    narrative_goal: string;
    visual_description: string;
    copy_focus: string;
  }>;
}

export interface ExecutionPrompts {
  listing_generation_tasks: Array<{
    index: number;
    type: string;
    positive_prompt: string;
    negative_prompt?: string;
  }>;
  aplus_generation_tasks: Array<{
    module: number;
    type: string;
    positive_prompt: string;
  }>;
}

// Updated Strategy Interface (Backwards Compatible)
export interface MarketingStrategy {
  analysis: string; // Legacy field, now populated from visual_dna_analysis summary
  secondaryImages: SecondaryImagePlan[]; // Legacy field
  aPlusContent: APlusModulePlan[]; // Legacy field
  
  // New Structured Data
  visualStrategy?: VisualStrategy;
  executionPrompts?: ExecutionPrompts;

  // Error Handling Fields
  isError?: boolean;
  errorMessage?: string;
  rawResponse?: string;
}
