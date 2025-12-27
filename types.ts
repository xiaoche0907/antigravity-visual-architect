
export enum WorkflowMode {
  PROMPT_ONLY = 'PROMPT_ONLY',
  DIRECT_GENERATION = 'DIRECT_GENERATION'
}

export enum RoleFocus {
  TECHNICAL = 'TECHNICAL',
  LIFESTYLE = 'LIFESTYLE',
  BALANCED = 'BALANCED'
}

export type BrainProvider = 'modelscope' | 'google' | 'openai' | 'custom' | 'gemini';

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
    provider: 'modelscope' | 'google' | 'openai' | 'custom' | 'gemini';
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
  visualGuidance: string;
  generatedImageUrl?: string;
}

export interface MarketingStrategy {
  analysis: string;
  secondaryImages: SecondaryImagePlan[];
  aPlusContent: APlusModulePlan[];
}
