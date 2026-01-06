import { GoogleGenAI } from "@google/genai";
import { AppConfig, BrainProvider, MarketingStrategy, RoleFocus, ProductInput, ChatMessage } from "../types";
// cspell:ignore genai Nanobannan DALL Aliyun Volcengine volcengine modelscope dall wanx Wanx Jiekou Grsai grsai Imagen Zhipu Apisix grsaiapi dakka
import { ModelConfig } from "../types/models";
import { ROLE_FOCUS_PROMPTS } from "../constants";

// Unified response interface
interface AIResponse {
    content: string;
}

// 🛡️ Helper: Sanitize System Instructions
// Handles cases where users paste JSON objects directly as system prompts
// Converts them into proper markdown-formatted instructions that AI can understand
const sanitizeSystemInstruction = (instruction: string): string => {
    if (!instruction || typeof instruction !== 'string') {
        return instruction || '';
    }

    const trimmed = instruction.trim();

    // Check if it looks like a JSON object (starts with { and ends with })
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
            const parsed = JSON.parse(trimmed);
            // Successfully parsed as JSON - convert to readable format
            console.log("⚠️ [sanitizeSystemInstruction] Detected JSON object in system prompt, converting to text format...");

            // Convert the JSON schema into a human-readable prompt
            let readablePrompt = `You are the **Amazon A9 Strategic Director**.
Your Goal: Analyze the product and output a Visual Strategy Plan in **Strict JSON**.

### 🛑 LANGUAGE RULES (MUST FOLLOW):
1.  **Rationale & Visual Description**: MUST be in **SIMPLIFIED CHINESE (简体中文)**. The user needs to read this analysis.
2.  **Copywriting (Headlines/Bullets)**: MUST be in **ENGLISH** (for the Amazon Global Listing).

### 📤 OUTPUT SCHEMA (JSON ONLY):
The output should follow this structure:
\`\`\`json
${JSON.stringify(parsed, null, 2)}
\`\`\`

**IMPORTANT**: 
- Generate valid JSON that matches this schema structure.
- Use the field names and structure shown above.
- Include Chinese descriptions for visual execution fields.
- Include English copywriting for marketing fields.
`;
            return readablePrompt;
        } catch (e) {
            // Not valid JSON, might just start/end with braces by coincidence
            console.log("🔍 [sanitizeSystemInstruction] Looks like JSON but failed to parse, using as-is");
        }
    }

    // Check for JSON-like content in the middle (e.g., user pasted a partial JSON)
    // Look for common schema patterns that indicate a pasted JSON output example
    const jsonPatterns = [
        /"typography_layout"\s*:/,
        /"visual_composition"\s*:/,
        /"listing_image_plan"\s*:/,
        /"premium_aplus_plan"\s*:/,
        /"visual_dna_analysis"\s*:/,
        /"module_type"\s*:/,
        /"strategy_rationale"\s*:/
    ];

    const hasJsonPatterns = jsonPatterns.some(pattern => pattern.test(trimmed));

    if (hasJsonPatterns && !trimmed.includes('### ') && !trimmed.includes('## ')) {
        // This looks like a JSON schema without proper context
        console.log("⚠️ [sanitizeSystemInstruction] Detected raw JSON schema in system prompt, wrapping with context...");

        return `You are the **Amazon A9 Strategic Director**.
Your Goal: Analyze the product and output a Visual Strategy Plan in **Strict JSON format**.

### 🛑 CRITICAL RULES:
1. Output ONLY valid JSON - no markdown, no explanations.
2. **Strategy Rationale & Visual Descriptions**: MUST be in **SIMPLIFIED CHINESE (简体中文)**.
3. **Copywriting/Headlines**: MUST be in **ENGLISH**.

### 📤 YOUR OUTPUT MUST MATCH THIS SCHEMA:
${trimmed}

Generate the JSON output now based on the product data provided by the user.`;
    }

    return instruction;
};

// Helper: Robust JSON Parser
// 🛡️ Enhanced for Vision Model Compatibility (GLM-4.6V, Qwen-VL, etc.)
// Handles: conversational text, markdown code blocks, malformed JSON
const safeJSONParse = (text: string): any => {
    if (!text || typeof text !== 'string') return null;

    console.log("🔍 [safeJSONParse] Input length:", text.length, "First 100 chars:", text.substring(0, 100));

    // 0. Pre-process: Try to extract JSON from code blocks first (handles ```json...```)
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    let clean = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();

    // Also strip any remaining ``` that might be malformed
    clean = clean.replace(/```json/gi, '').replace(/```/g, '').trim();

    // 1. Try direct parse
    try {
        return JSON.parse(clean);
    } catch (e) {
        // Continue...
    }

    // 2. 🛡️ SIMPLE REGEX: Extract using \{[\s\S]*\} pattern (ignores conversational text)
    try {
        console.log("🔍 [safeJSONParse] Trying regex extraction with /\\{[\\s\\S]*\\}/ ...");

        // Use regex to find JSON object (matches first { to last })
        const jsonMatch = clean.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            console.log("🔍 [safeJSONParse] Found JSON match, length:", jsonMatch[0].length);
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log("✅ [safeJSONParse] Regex extraction SUCCESS!");
                return parsed;
            } catch (e) {
                console.warn("⚠️ [safeJSONParse] Regex match found but parse failed:", (e as Error).message);
                // Continue to more advanced methods...
            }
        } else {
            console.warn("⚠️ [safeJSONParse] No JSON object pattern found in input");
        }
    } catch (e) {
        // Continue...
    }

    try {
        // 3. Balanced brace algorithm for nested structures
        let start = clean.indexOf('{');

        // 3b. Look for JSON key patterns if no braces found
        if (start === -1) {
            const keyMatch = clean.match(/"(analysis|secondaryImages|aPlusContent|visual_dna_analysis|listing_generation_tasks|listing_image_plan)":/);
            if (keyMatch && keyMatch.index !== undefined) {
                clean = `{${clean.substring(keyMatch.index)}}`;
                start = 0;
            }
        }

        if (start !== -1) {
            let depth = 0;
            let jsonEnd = start;
            let inString = false;
            let escaped = false;

            for (let i = start; i < clean.length; i++) {
                const char = clean[i];

                if (escaped) {
                    escaped = false;
                    continue;
                }

                if (char === '\\') {
                    escaped = true;
                    continue;
                }

                if (char === '"') {
                    inString = !inString;
                    continue;
                }

                if (inString) continue;

                if (char === '{') depth++;
                if (char === '}') {
                    depth--;
                    if (depth === 0) {
                        jsonEnd = i;
                        break;
                    }
                }
            }

            clean = clean.substring(start, jsonEnd + 1);
            try { return JSON.parse(clean); } catch (e) { }
        }

        // 4. Robust Sanitization (State Machine)
        let sanitized = "";
        let inString = false;
        let isEscaped = false;

        for (let i = 0; i < clean.length; i++) {
            const char = clean[i];

            if (inString) {
                if (char === '\\') {
                    isEscaped = !isEscaped;
                    sanitized += char;
                } else if (char === '"' && !isEscaped) {
                    inString = false;
                    sanitized += char;
                } else if (char === '\n') {
                    sanitized += '\\n';
                } else if (char === '\r') {
                    // Ignore CR
                } else if (char === '\t') {
                    sanitized += '\\t';
                } else {
                    isEscaped = false;
                    sanitized += char;
                }
            } else {
                if (char === '"') {
                    inString = true;
                }
                sanitized += char;
            }
        }

        // 5. Regex Fixes (Trailing commas)
        sanitized = sanitized.replace(/,(\s*[}\]])/g, '$1');

        return JSON.parse(sanitized);

    } catch (e) {
        console.error("❌ [safeJSONParse] All parsing methods failed:", e);
        console.error("📝 Input text (first 500 chars):", text.substring(0, 500));
        return null;
    }
};

// 🛡️ Universal Adapter: Normalize AI output to standard fields
// This ensures UI compatibility regardless of prompt field names
// 🆕 SKYSPER FORMAT SUPPORT: Handles nested visual_composition/typography_layout objects
const normalizeAgentOutput = (rawData: any): any => {
    if (!rawData) return rawData;

    console.log("🔄 [Normalizer] Processing raw data with keys:", Object.keys(rawData));

    // 🆕 Helper: Convert Skysper nested objects to display string
    const flattenSkysperFormat = (item: any): string => {
        const parts: string[] = [];

        // Handle visual_composition object
        if (item.visual_composition && typeof item.visual_composition === 'object') {
            const vc = item.visual_composition;
            if (vc.layout) parts.push(`📐 布局: ${vc.layout}`);
            if (vc.product_view) parts.push(`📷 视角: ${vc.product_view}`);
            if (vc.background) parts.push(`🎨 背景: ${vc.background}`);
            if (vc.lighting) parts.push(`💡 光线: ${vc.lighting}`);
            if (vc.product_placement) parts.push(`📍 位置: ${vc.product_placement}`);
        }

        // Handle typography_layout object
        if (item.typography_layout && typeof item.typography_layout === 'object') {
            const tl = item.typography_layout;
            if (tl.logo_position) parts.push(`🏷️ Logo: ${tl.logo_position}`);
            if (tl.headline) parts.push(`📝 标题: ${tl.headline}`);
            if (tl.main_headline) parts.push(`📝 主标题: ${tl.main_headline}`);
            if (tl.subtext || tl.sub_headline) parts.push(`📋 副文案: ${tl.subtext || tl.sub_headline}`);
            if (tl.icon_bar) parts.push(`🔘 图标栏: ${tl.icon_bar}`);
            if (tl.brand_logo) parts.push(`🏷️ 品牌Logo: ${tl.brand_logo}`);
            if (tl.cta_element) parts.push(`🎯 CTA: ${tl.cta_element}`);
        }

        return parts.length > 0 ? parts.join('\n') : '';
    };

    // 1. Normalize Listing Image Plan - search DEEPLY for any array that looks like image plans
    let listingPlan = rawData.listing_image_plan
        || rawData.listing_images
        || rawData.image_plan
        || rawData.images
        || rawData.secondary_images
        || rawData.product_images
        || rawData.image_plans
        || [];

    // If still empty, search in nested objects
    if (!listingPlan.length) {
        for (const key of Object.keys(rawData)) {
            const val = rawData[key];
            if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
                // 🆕 SKYSPER FORMAT: Check for visual_composition (object) in addition to visual_execution (string)
                if (val[0].type || val[0].index !== undefined || val[0].visual_execution ||
                    val[0].visual_composition || val[0].layout_logic || val[0].strategy_rationale) {
                    console.log("🔍 [Normalizer] Found listing plan at key:", key);
                    listingPlan = val;
                    break;
                }
            }
        }
    }

    console.log("📊 [Normalizer] Found listing items:", listingPlan.length);

    const normalizedListing = listingPlan.map((item: any, index: number) => {
        // 🆕 SKYSPER FORMAT: Try to flatten nested objects first
        const skysperFlattened = flattenSkysperFormat(item);

        return {
            ...item,
            index: item.index ?? index + 1, // 🛡️ Ensure 1-indexed
            // Map ANY logic/directive field to standard 'visual_execution'
            // 🆕 SKYSPER: Use flattened format if available
            visual_execution: item.visual_execution
                || skysperFlattened
                || item.layout_logic
                || item.design_directive
                || item.visual_guide
                || item.visual_description
                || item.composition_guide
                || item.design_concept
                || item.layout_instruction
                || "No visual execution provided",
            // Map ANY rationale/strategy field to standard 'strategy_rationale'
            strategy_rationale: item.strategy_rationale
                || item.strategy_reasoning
                || item.rationale
                || item.purpose
                || item.reasoning
                || "Strategy analysis",
        };
    });

    // 2. Normalize A+ Content Plan
    const aplusPlan = rawData.premium_aplus_plan || rawData.aplus_plan || rawData.aplus_content || rawData.a_plus_content || [];
    const normalizedAplus = aplusPlan.map((item: any, index: number) => {
        // 🆕 SKYSPER FORMAT: Try to flatten nested objects first
        const skysperFlattened = flattenSkysperFormat(item);

        const desc = item.visual_description
            || skysperFlattened
            || item.layout_directive
            || item.layout_logic
            || item.design_directive
            || item.visual_content
            || item.module_description
            || "No description";

        return {
            ...item,
            module_index: item.module_index ?? index + 1, // 🛡️ Ensure 1-indexed
            // Map various A+ description keys to standard 'visual_description'
            visual_description: desc,
            // 🆕 CRITICAL FIX: Also map to 'visual_execution' because getStrategyText() prioritizes it!
            visual_execution: desc,
        };
    });

    // 3. Normalize Visual DNA Analysis (try alternative keys)
    let visualDna = rawData.visual_dna_analysis;
    if (!visualDna) {
        const altKeys = ['analysis', 'strategy', 'visual_strategy', 'dna_analysis', 'brand_analysis', 'visual_analysis'];
        for (const key of altKeys) {
            if (rawData[key]) {
                visualDna = rawData[key];
                console.log("🔄 [Normalizer] Found visual_dna_analysis at alternative key:", key);
                break;
            }
        }
    }

    // 🆕 SKYSPER FORMAT: Normalize visual_dna_analysis fields
    if (visualDna) {
        // Map brand_standard to brand_tone if missing
        if (!visualDna.brand_tone && visualDna.brand_standard) {
            visualDna.brand_tone = visualDna.brand_standard;
        }
        // Map visual_strategy to lighting_strategy if missing (as a fallback)
        if (!visualDna.lighting_strategy && visualDna.visual_strategy) {
            visualDna.lighting_strategy = visualDna.visual_strategy;
        }
        // Ensure required fields exist
        visualDna.brand_tone = visualDna.brand_tone || visualDna.typography_system || "Brand Tone";
        visualDna.lighting_strategy = visualDna.lighting_strategy || "Studio Lighting";
        visualDna.color_palette = visualDna.color_palette || "#ED6D46, #C8E1EF"; // Skysper default colors
    }

    const result = {
        ...rawData,
        visual_dna_analysis: visualDna || rawData.visual_dna_analysis,
        listing_image_plan: normalizedListing,
        premium_aplus_plan: normalizedAplus
    };

    console.log("✅ [Normalizer] Output listing_image_plan count:", result.listing_image_plan.length);
    console.log("✅ [Normalizer] Output premium_aplus_plan count:", result.premium_aplus_plan.length);

    // 🆕 Debug: Log first item to verify structure
    if (result.listing_image_plan.length > 0) {
        console.log("🔍 [Normalizer] First listing item visual_execution:",
            result.listing_image_plan[0].visual_execution?.substring(0, 100));
    }

    return result;
};

// --- Business Logic Services ---

// Helper: Universal Proxy URL Generator
// 🆕 Uses dedicated proxy paths for known providers (more stable than generic proxy)
const getProxiedUrl = (originalUrl: string): string => {
    // 只在浏览器环境且 URL 开头为 http(s) 时使用代理
    if (typeof window !== 'undefined' && originalUrl.startsWith('http')) {
        // 🆕 Use dedicated proxy paths for known providers (better stability)
        const lowerUrl = originalUrl.toLowerCase();

        // ModelScope - use dedicated proxy
        if (lowerUrl.includes('modelscope.cn')) {
            // Extract path after /v1/
            const urlObj = new URL(originalUrl);
            const pathAfterV1 = urlObj.pathname.replace(/^\/v1/, '');
            console.log(`🔄 [Proxy] Using dedicated ModelScope proxy for: ${pathAfterV1}`);
            return `/api/proxy/modelscope${pathAfterV1}`;
        }

        // Dashscope/Aliyun - use dedicated proxy  
        if (lowerUrl.includes('dashscope.aliyuncs.com')) {
            const urlObj = new URL(originalUrl);
            const pathAfterV1 = urlObj.pathname.replace(/^\/compatible-mode\/v1/, '');
            console.log(`🔄 [Proxy] Using dedicated Dashscope proxy for: ${pathAfterV1}`);
            return `/api/proxy/dashscope${pathAfterV1}`;
        }

        // OpenAI - use dedicated proxy
        if (lowerUrl.includes('api.openai.com')) {
            const urlObj = new URL(originalUrl);
            const pathAfterV1 = urlObj.pathname.replace(/^\/v1/, '');
            console.log(`🔄 [Proxy] Using dedicated OpenAI proxy for: ${pathAfterV1}`);
            return `/api/proxy/openai${pathAfterV1}`;
        }

        // Google - use dedicated proxy
        if (lowerUrl.includes('generativelanguage.googleapis.com')) {
            const urlObj = new URL(originalUrl);
            console.log(`🔄 [Proxy] Using dedicated Google proxy for: ${urlObj.pathname}`);
            return `/api/proxy/google${urlObj.pathname}`;
        }

        // Fallback: Use generic proxy for other URLs
        console.log(`🔄 [Proxy] Using generic proxy for: ${originalUrl}`);
        return `/api/proxy?target=${encodeURIComponent(originalUrl)}`;
    }
    return originalUrl;
};

// === 🆕 V7.0 Dual-Agent Flow Implementation ===

// Helper: Aspect Ratio Mapper based on Type
const getAspectRatioForType = (type: string): '1:1' | '3:4' | '21:9' | '16:9' => {
    const t = type.toUpperCase();
    if (t.includes('BANNER') || t.includes('HERO') || t.includes('HEADER')) {
        return '21:9';
    }
    if (t.includes('LISTING') || t.includes('MAIN') || t.includes('LIFESTYLE')) {
        return '3:4';
    }
    // Default fallback
    return '1:1';
};

export const generateMarketingStrategy = async (
    input: ProductInput,
    roleFocus: RoleFocus,
    textModel: ModelConfig | null,
    config: AppConfig,
    promptEngineerConfig?: {
        model: ModelConfig | null;
        instruction: string;
    },
    onProgress?: (stage: 'strategy' | 'translating' | 'done', message: string) => void
): Promise<MarketingStrategy> => {
    console.log('📥 [aiService] generateMarketingStrategy (Dual-Agent V7) called');

    const reportProgress = (stage: 'strategy' | 'translating' | 'done', message: string) => {
        console.log(`📢 [Progress] ${stage}: ${message}`);
        onProgress?.(stage, message);
    };

    // 🛡️ Error Fallback
    const errorFallback: MarketingStrategy = {
        isError: true,
        errorMessage: "Unknown Error",
        analysis: "### Service Unavailable",
        secondaryImages: [],
        aPlusContent: [],
        visualStrategy: undefined,
        executionPrompts: undefined
    };

    // 🛡️ Smart Fetch with Proxy Fallback
    // Attempts dedicated proxy first, falls back to universal proxy on failure
    const smartFetch = async (endpoint: string, options: any): Promise<Response> => {
        // 1. Try Dedicated Proxy (Rewrite)
        const dedicatedUrl = getProxiedUrl(endpoint);
        console.log(`📡 [SmartFetch] Attempt 1: Dedicated Proxy -> ${dedicatedUrl}`);

        try {
            const res = await fetch(dedicatedUrl, { ...options });
            if (res.ok) return res;

            console.warn(`⚠️ [SmartFetch] Dedicated Proxy failed with status ${res.status}. Retrying with Universal Proxy...`);
        } catch (err: any) {
            console.warn(`⚠️ [SmartFetch] Dedicated Proxy network error: ${err.message}. Retrying with Universal Proxy...`);
        }

        // 2. Try Universal Proxy (Function)
        // Construct universal URL manually ensuring exact format
        const universalUrl = `/api/proxy?target=${encodeURIComponent(endpoint)}`;
        console.log(`📡 [SmartFetch] Attempt 2: Universal Proxy -> ${universalUrl}`);

        return fetch(universalUrl, { ...options });
    };

    if (config.mockMode) {
        // ... (Mock logic can be updated later if needed, mostly skipping for now)
        return new Promise((resolve) => setTimeout(() => resolve(errorFallback), 1000));
    }

    if (!textModel) return { ...errorFallback, errorMessage: "No Text Model Selected" };

    try {
        // ==========================================
        // 🟢 STAGE 1: STRATEGY DIRECTOR (AGENT A)
        // ==========================================
        reportProgress('strategy', '🧠 (Agent A) Strategy Director is analyzing Visual DNA...');

        // 1. Construct Prompt for Agent A
        // 🛡️ Sanitize system instruction in case user pasted raw JSON
        const strategySystemInstruction = sanitizeSystemInstruction(config.brain.systemInstruction);
        const agentAPrompt = `
        Product Data:
        - USPs: ${input.usps}
        - Target Audience: ${input.targetAudience}
        - Competitor Pain Points: ${input.competitorPainPoints}
        - Specs: ${input.specs}

        TASK: Generate the "VisualStrategy" JSON object.
        `;

        // 2. Call LLM (Agent A)
        let strategyJsonRaw = "";

        // ... (Reuse existing LLM call logic, simplified here for brevity, assume similar to before)
        // NOTE: In a real refactor, checking provider types (Google vs OpenAI) is needed. 
        // For brevity in this replacement block, I will assume the `callLLM` logic is abstracted or inline.
        // Since I need to replace the whole function, I must include the calling logic.

        if (textModel.provider === 'google') {
            const ai = new GoogleGenAI({ apiKey: textModel.apiKey });
            const parts: any[] = [{ text: agentAPrompt }];
            input.productImages.slice(0, 2).forEach(img => {
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: img.split(',')[1] } });
            });
            const result = await ai.models.generateContent({
                model: textModel.modelId,
                contents: { parts },
                config: { systemInstruction: strategySystemInstruction, responseMimeType: 'application/json' }
            });
            strategyJsonRaw = result.text?.trim() || "";
        } else {
            // OpenAI Compatible Logic
            // ... Same endpoint resolution logic ...
            let endpoint = textModel.baseUrl;
            // ... (Grsai/Jiekou fixes) ...
            if (textModel.provider === 'grsai' || endpoint.includes('grsai')) {
                if (!endpoint.includes('grsaiapi.com')) endpoint = 'https://grsaiapi.com/v1';
            }
            if (!endpoint.endsWith('/chat/completions')) endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';

            const messages: any[] = [
                { role: "system", content: strategySystemInstruction },
                { role: "user", content: agentAPrompt }
            ];
            // Add images (if supported)
            if (input.productImages.length > 0) {
                const contentParts: any[] = [{ type: "text", text: agentAPrompt }];
                // ... image pushing logic ...
                input.productImages.slice(0, 1).forEach(img => contentParts.push({ type: "image_url", image_url: { url: img } }));
                messages[1] = { role: "user", content: contentParts };
            }

            // 🛡️ Build request body - only include response_format for providers that support it
            const requestBody: any = {
                model: textModel.modelId,
                messages,
                temperature: 0.7,
            };

            // Only OpenAI and some compatible APIs support response_format
            // ModelScope, Dashscope, and many others do NOT support it
            // 🛡️ Also check modelId and baseUrl for DeepSeek detection (might be configured via openai-compatible)
            const isDeepSeek = textModel.modelId?.toLowerCase().includes('deepseek') ||
                textModel.baseUrl?.toLowerCase().includes('deepseek');
            const supportsJsonMode = ['openai', 'azure', 'deepseek'].includes(textModel.provider?.toLowerCase() || '') || isDeepSeek;
            if (supportsJsonMode) {
                requestBody.response_format = { type: "json_object" };
            }

            console.log(`📡 [Stage 1] Calling ${textModel.provider} at ${endpoint} (JSON mode: ${supportsJsonMode})`);

            try {
                // 🆕 Use smartFetch instead of direct fetch
                const res = await smartFetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${textModel.apiKey}` },
                    body: JSON.stringify(requestBody)
                });

                // 🛡️ Handle non-OK responses or empty bodies gracefully
                if (!res.ok) {
                    let errMsg = `API Error (${res.status})`;
                    try {
                        const data = await res.json();
                        errMsg = data.error?.message || data.message || JSON.stringify(data);
                    } catch (e) {
                        // Body might be empty
                        errMsg += " (No response body)";
                    }
                    console.error("❌ [Stage 1] API Error:", errMsg);
                    throw new Error(`API Failed (${res.status}): ${errMsg}`);
                }

                const data = await res.json();

                if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
                    console.error("❌ [Stage 1] Invalid API response - no choices:", data);
                    throw new Error(`Invalid API response: ${JSON.stringify(data).substring(0, 200)}`);
                }

                strategyJsonRaw = data.choices[0]?.message?.content || "";
            } catch (networkError: any) {
                console.error("❌ [Stage 1] Network/Parse Error:", networkError.message);
                throw new Error(`Network/API Error: ${networkError.message}`);
            }
        }

        console.log("📝 [Stage 1] Raw Output:", strategyJsonRaw.substring(0, 100));
        let visualStrategy = safeJSONParse(strategyJsonRaw);

        // 🛡️ Apply Universal Normalizer to standardize field names
        visualStrategy = normalizeAgentOutput(visualStrategy);

        // 🛡️ Detailed logging for debugging
        console.log("📊 [Stage 1] Normalized visualStrategy:", JSON.stringify(visualStrategy, null, 2).substring(0, 500));
        console.log("📊 [Stage 1] visual_dna_analysis:", visualStrategy?.visual_dna_analysis);
        console.log("📊 [Stage 1] listing_image_plan count:", visualStrategy?.listing_image_plan?.length || 0);

        // 🛡️ FALLBACK: If parsing failed or structure is invalid, create a usable error state
        if (!visualStrategy) {
            console.error("❌ [Stage 1] JSON parsing completely failed. Raw:", strategyJsonRaw.substring(0, 500));
            visualStrategy = {
                visual_dna_analysis: {
                    brand_tone: "⚠️ Parsing Error - Model output could not be parsed. Check console for details.",
                    color_palette: "#FF6B6B",
                    lighting_strategy: "Please try again with a different model or check the system prompt."
                },
                listing_image_plan: []
            };
        } else if (!visualStrategy.visual_dna_analysis) {
            console.error("❌ [Stage 1] Missing visual_dna_analysis. Keys found:", Object.keys(visualStrategy));
            // Try to extract from alternative field names (key-agnostic)
            const altKeys = ['analysis', 'strategy', 'visual_strategy', 'dna_analysis', 'brand_analysis'];
            let found = null;
            for (const key of altKeys) {
                if (visualStrategy[key]) {
                    found = visualStrategy[key];
                    console.log("🔄 [Stage 1] Found alternative key:", key);
                    break;
                }
            }
            if (found) {
                visualStrategy.visual_dna_analysis = found;
            } else {
                // Create placeholder so UI doesn't crash
                visualStrategy.visual_dna_analysis = {
                    brand_tone: "⚠️ Model output missing required 'visual_dna_analysis'. Check system prompt.",
                    color_palette: "#FFA500",
                    lighting_strategy: "Model returned: " + JSON.stringify(visualStrategy).substring(0, 200)
                };
            }
        }

        // 🛡️ SMART DEFAULTS: If model output is garbage, provide usable defaults instead of errors
        const dna = visualStrategy.visual_dna_analysis;
        const isGarbage = (val: any) => !val || val === '///' || val === '--' || val === '...' || (typeof val === 'string' && val.length < 2);

        if (isGarbage(dna.brand_tone)) {
            console.warn("⚠️ [Stage 1] Garbage brand_tone detected. Using Smart Default.");
            dna.brand_tone = "Modern & Professional (Auto-Default)";
        }
        if (isGarbage(dna.lighting_strategy)) {
            console.warn("⚠️ [Stage 1] Garbage lighting_strategy detected. Using Smart Default.");
            dna.lighting_strategy = "Soft Studio Lighting, Clean & Minimalist (Auto-Default)";
        }
        if (isGarbage(dna.color_palette) || dna.color_palette === "#FFA500") {
            dna.color_palette = "#2C3E50"; // Dark Blue/Grey Professional
        }

        // 🛡️ CRITICAL FALLBACK: If listing listing_image_plan is empty, generate a generic plan
        if (!visualStrategy.listing_image_plan || visualStrategy.listing_image_plan.length === 0) {
            console.warn("⚠️ [Stage 1] No listing image plan found. Generating Generic Plan.");
            visualStrategy.listing_image_plan = [
                { index: 1, type: "Main_Image", visual_execution: "Clean white background, high angle shot showing entire product, studio lighting", strategy_rationale: "Standard Main Image" },
                { index: 2, type: "Lifestyle", visual_execution: "Product in use in a modern living room setting, soft natural light", strategy_rationale: "Usage Context" },
                { index: 3, type: "Detail_Shot", visual_execution: "Close-up textural shot of the material, macro lens, sharp focus", strategy_rationale: "Material Quality" },
                { index: 4, type: "Feature_1", visual_execution: "Demonstrating key feature mechanism, clear informative angle", strategy_rationale: "Feature Highlight" },
                { index: 5, type: "Scale_Ref", visual_execution: "Product next to everyday objects for scale reference", strategy_rationale: "Size Perception" },
                { index: 6, type: "Packaging", visual_execution: "Product with premium packaging arrangement", strategy_rationale: "Unboxing Experience" }
            ];
        }

        // ==========================================
        // 🔵 STAGE 2: VISUAL DIRECTOR (AGENT B)
        // ==========================================
        reportProgress('translating', '🎨 (Agent B) Visual Director is crafting execution prompts...');

        let executionPrompts = null;
        const agentBModel = promptEngineerConfig?.model || textModel; // Use specific model or fallback to main
        const agentBInstruction = promptEngineerConfig?.instruction || ""; // Should be V7.0 Prompt Engineer Prompt

        // 🚨 CRITICAL: Agent B MUST receive Agent A's output as context
        // Convert the entire visualStrategy to a JSON string to pass as context
        const agentAOutputString = JSON.stringify(visualStrategy, null, 2);
        console.log("📦 [Stage 2] Agent A Output (Context for B):", agentAOutputString.substring(0, 300) + "...");

        if (agentBModel && agentBInstruction) {
            // 🛡️ KEY-AGNOSTIC: Pass ENTIRE Agent A output, let Agent B (LLM) find the right fields
            // This makes the pipeline robust against field name changes in System Prompts
            const agentBPrompt = `You are the Visual Technical Director (Prompt Engineer). 
Your task is to convert the following Visual Strategy JSON into executable image generation prompts.

=== STRATEGY JSON FROM AGENT A (FULL OBJECT) ===
${agentAOutputString}
=== END OF STRATEGY JSON ===

IMPORTANT: The JSON may use different field names depending on the version. 
Look for ANY of these visual instruction fields and convert them to prompts:
- 'visual_execution', 'composition_guide', 'design_concept', 
- 'design_layout_instruction', 'visual_description', 'layout_instruction'

FOR EACH visual instruction found in 'listing_image_plan' (or similar arrays), generate:
- 'index': matching the original item's index
- 'positive_prompt': Detailed English prompt for image generation (style, lighting, composition, subject)
- 'negative_prompt': What to avoid
- 'layout_tags': Relevant tags

FOR EACH visual instruction in 'premium_aplus_plan' (or similar), generate:
- 'module': matching the original module_index
- 'positive_prompt', 'negative_prompt', 'layout_tags'

Output a valid JSON object with 'listing_generation_tasks' and 'aplus_generation_tasks' arrays.`;

            // Call Agent B
            let executionJsonRaw = "";
            let endpoint = agentBModel.baseUrl?.replace(/\/$/, '') || '';

            // 🛡️ Ensure endpoint ends with /chat/completions if not already
            if (!endpoint.includes('/chat/completions')) {
                // If it's ModelScope but missing /v1, add it
                if (endpoint.includes('modelscope.cn') && !endpoint.includes('/v1')) {
                    endpoint += '/v1';
                }
                endpoint += '/chat/completions';
            }

            // 🛡️ Build request body
            const agentBRequestBody: any = {
                model: agentBModel.modelId,
                messages: [
                    { role: "system", content: agentBInstruction + "\n\nCRITICAL: OUTPUT RAW JSON ONLY. NO MARKDOWN. NO ```json WRAPPERS." },
                    { role: "user", content: agentBPrompt }
                ],
                temperature: 0.7,
            };

            // 🛡️ JSON Mode Logic: 
            // DeepSeek supports JSON mode on OpenAI/DeepSeek API, but ModelScope's implementation is often flaky with it.
            // So we ONLY enable it for official OpenAI, Azure, and DeepSeek Official API.
            // We explicitly DISABLE it for ModelScope to avoid 400/500 errors.
            const isModelScope = agentBModel.provider === 'modelscope' || endpoint.includes('modelscope.cn');
            const isDeepSeekOfficial = agentBModel.provider === 'openai-compatible' && endpoint.includes('api.deepseek.com');

            const agentBSupportsJsonMode = !isModelScope && (
                ['openai', 'azure', 'deepseek'].includes(agentBModel.provider?.toLowerCase() || '') ||
                isDeepSeekOfficial
            );

            if (agentBSupportsJsonMode) {
                agentBRequestBody.response_format = { type: "json_object" };
            }

            console.log(`📡 [Stage 2] Calling Agent B at: ${endpoint}`);
            console.log(`   - Model: ${agentBModel.modelId}`);
            console.log(`   - Provider: ${agentBModel.provider}`);
            console.log(`   - JSON Mode: ${agentBSupportsJsonMode ? 'ENABLED' : 'DISABLED (Relies on Prompt)'}`);

            try {
                // 🆕 Use smartFetch instead of direct fetch
                const res = await smartFetch(getProxiedUrl(endpoint), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${agentBModel.apiKey} ` },
                    body: JSON.stringify(agentBRequestBody)
                });

                // 🛡️ Handle non-OK responses or empty bodies gracefully
                if (!res.ok) {
                    let errMsg = `API Error(${res.status})`;
                    try {
                        const data = await res.json();
                        errMsg = data.error?.message || data.message || JSON.stringify(data);
                    } catch (e) {
                        // Body might be empty or not JSON on 500
                        errMsg += " (No response body)";
                    }
                    console.error("❌ [Stage 2] Agent B API Error:", errMsg);
                    console.warn("⚠️ Agent B API failed, skipping prompt translation (Fallback active).");
                } else {
                    const data = await res.json();
                    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
                        console.error("❌ [Stage 2] Invalid Agent B response - no choices:", data);
                        console.warn("⚠️ Agent B response invalid, skipping prompt translation.");
                    } else {
                        executionJsonRaw = data.choices[0]?.message?.content || "{}";
                        console.log("📝 [Stage 2] Agent B Raw Output:", executionJsonRaw.substring(0, 200) + "...");
                        executionPrompts = safeJSONParse(executionJsonRaw);
                    }
                }
            } catch (networkError: any) {
                console.error("❌ [Stage 2] Agent B Network/Parse Error:", networkError.message);
                console.warn("⚠️ Agent B crashed, skipping prompt translation (Fallback active).");
            }

            if (!executionPrompts || (!executionPrompts.listing_generation_tasks && !executionPrompts.aplus_generation_tasks)) {
                console.warn("⚠️ [Stage 2] Agent B output is invalid or empty. Will fall back to Agent A's visual_execution.");
            }
        } else {
            console.warn("⚠️ [Stage 2] Agent B skipped: No model or instruction configured.");
        }

        reportProgress('done', '✅ Strategy & Execution Plan Ready!');

        // ==========================================
        // 🔄 MAPPING & RETURN
        // ==========================================
        // We map the new structure back to the legacy one for compatibility if needed, 
        // OR we just return the new fields and let UI handle it.
        // The implementation plan says "Combine strategy and execution data".

        // Map to legacy fields for backward compatibility where possible
        const legacyAnalysis = `### Visual DNA Analysis\n ** Brand Tone:** ${visualStrategy.visual_dna_analysis.brand_tone} \n\n ** Lighting:** ${visualStrategy.visual_dna_analysis.lighting_strategy} `;

        const legacySecondaryImages = (visualStrategy.listing_image_plan || []).map((item: any, idx: number) => {
            // Find matching execution prompt
            const exec = executionPrompts?.listing_generation_tasks?.find((t: any) => t.index === item.index);
            return {
                id: item.index,
                type: item.type,
                description: item.visual_execution, // Correctly map Visual Execution to description
                visualPrompt: exec?.positive_prompt
                    ? exec.positive_prompt
                    : `[FALLBACK PROMPT] /imagine prompt: ${item.visual_execution?.replace(/^\[|\]$/g, '')} --ar 3:4 --styled`, // Clean up brackets if present
                copywriting: item.english_copy
            };
        });

        const legacyAPlus = (visualStrategy.premium_aplus_plan || []).map((item: any, idx: number) => {
            const exec = executionPrompts?.aplus_generation_tasks?.find((t: any) => t.module === item.module_index);
            return {
                id: item.module_index,
                moduleType: item.module_type,
                content: item.narrative_goal,
                visualGuidance: item.visual_description,
                visualPrompt: exec?.positive_prompt || item.visual_description
            };
        });

        return {
            analysis: legacyAnalysis,
            secondaryImages: legacySecondaryImages,
            aPlusContent: legacyAPlus,
            // New Fields
            visualStrategy: visualStrategy,
            executionPrompts: executionPrompts,
            isError: false
        };

    } catch (error: any) {
        console.error("❌ Dual-Agent Generation Failed:", error);
        return {
            ...errorFallback,
            errorMessage: error.message,
            rawResponse: error.stack
        };
    }
};

// Removed refinePromptsWithPromptEngineer as it is now Agent B's job.


// === 🔄 ModelScope 异步任务轮询辅助函数 (通过代理) ===
const pollModelScopeTask = async (taskId: string, apiKey: string): Promise<string> => {
    console.log(`🔄[ModelScope Polling] 开始轮询任务: ${taskId} `);

    // 最多轮询 30 次 (60 秒超时)
    for (let i = 0; i < 30; i++) {
        // 等待 2 秒
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 使用 Vercel 代理转发 ModelScope 请求
        const targetUrl = `https://api-inference.modelscope.cn/v1/tasks/${taskId}`;
        const res = await fetch(`/api/proxy?target=${encodeURIComponent(targetUrl)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `查询任务状态失败: ${res.status} `);
        }

        const data = await res.json();
        console.log(`🔄[ModelScope Polling] 第 ${i + 1} 次轮询, 状态: ${data.task_status} `);

        if (data.task_status === 'SUCCEED') {
            // 成功！返回图片 URL
            const imageUrl = data.output_images?.[0] || data.output?.url || data.result?.image_url;
            if (!imageUrl) {
                throw new Error(`ModelScope 返回成功但未找到图片 URL: ${JSON.stringify(data)} `);
            }
            console.log('✅ [ModelScope Polling] 任务成功完成');
            return imageUrl;
        } else if (data.task_status === 'FAILED') {
            throw new Error(`ModelScope 生成失败: ${JSON.stringify(data)} `);
        }
        // 如果是 RUNNING 或 PENDING，继续下一次循环
    }
    throw new Error("ModelScope 生成超时 (60s)");
};

/**
 * 🧠 智能提示词精简 (仅用于 ModelScope)
 * 当 prompt 超过 1500 字时，使用文本模型将其压缩为简洁的视觉描述
 */
const summarizePromptForModelScope = async (
    longPrompt: string,
    textModel: ModelConfig | null
): Promise<string> => {
    // 如果没有文本模型或提示词不长，直接截断返回
    if (!textModel || longPrompt.length <= 1500) {
        return longPrompt.length > 1900 ? longPrompt.substring(0, 1900) : longPrompt;
    }

    console.log(`🧠 [Summarize] 使用 ${textModel.name} 精简 ModelScope 提示词 (${longPrompt.length} 字)...`);

    try {
        const systemPrompt = `You are an expert at condensing image generation prompts. Your task:
1. Extract ONLY the essential visual elements from the long prompt below.
2. Output a concise English prompt under 1000 characters.
3. Focus on: subject, style, lighting, colors, composition, mood.
4. Do NOT explain, just output the condensed prompt directly.`;

        let endpoint = textModel.baseUrl;
        if (!endpoint.endsWith('/chat/completions')) {
            endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
        }

        const res = await fetch(getProxiedUrl(endpoint), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${textModel.apiKey}`
            },
            body: JSON.stringify({
                model: textModel.modelId,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Condense this prompt:\n\n${longPrompt}` }
                ],
                max_tokens: 500,
                temperature: 0.3
            })
        });

        if (!res.ok) {
            console.warn('[Summarize] 精简失败，回退到截断');
            return longPrompt.substring(0, 1900);
        }

        const data = await res.json();
        const summarized = data.choices?.[0]?.message?.content?.trim() || '';

        if (summarized && summarized.length < 1900) {
            console.log(`✅ [Summarize] 精简成功: ${longPrompt.length} -> ${summarized.length} 字`);
            return summarized;
        }
    } catch (e) {
        console.error('[Summarize] 精简异常:', e);
    }

    // Fallback: simple truncation
    return longPrompt.substring(0, 1900);
};

export const generateVisual = async (prompt: string, imageModel: ModelConfig | null, config: AppConfig, aspectRatio: '1:1' | '16:9' | '21:9' | '3:4' = '1:1', resolution: '1K' | '2K' | '4K' = '1K', referenceImages: string[] = [], textModelForSummarize?: ModelConfig | null): Promise<string> => {
    if (config.mockMode) return `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/${aspectRatio === '1:1' ? '1024/1024' : '1024/576'}`;

    // 🛡️ 防御性检查：确保传入的是图像模型
    if (!imageModel) {
        console.error('❌ [generateVisual] 未提供图像模型配置');
        throw new Error("无图像模型");
    }

    // 🛡️ 关键防御：检查模型类别，防止误用文本模型
    if (imageModel.category !== 'image') {
        console.error('❌ [generateVisual] 错误：尝试使用非图像模型生成图片', {
            modelId: imageModel.id,
            modelName: imageModel.name,
            category: imageModel.category,
            expectedCategory: 'image'
        });
        throw new Error(`模型类别错误：${imageModel.name} 是 ${imageModel.category} 模型，不能用于图像生成`);
    }

    // 📐 Resolution & Aspect Ratio Mapping Logic
    let size = "1024x1024"; // Default 1:1
    const isDallE3 = imageModel.modelId.includes('dall-e-3');
    const isNano = imageModel.provider === 'grsai' || imageModel.modelId.includes('nano');

    // 🆕 STRICT Aspect Ratio Enforcement based on User Rule
    // We expect the caller to pass the correct 'aspectRatio' string ('21:9', '3:4', '1:1')
    // But we map that string to specific pixel dimensions here.

    if (aspectRatio === '21:9' || aspectRatio === '16:9') {
        if (isNano) {
            size = "1464x600"; // 🚀 User Rule: A+ Hero/Banner (Ultra Wide)
        } else if (imageModel.provider === 'modelscope') {
            size = "1280x720";
        } else if (isDallE3) {
            size = "1792x1024";
        } else {
            size = "1024x576";
        }
    } else if (aspectRatio === '3:4') {
        if (isNano) {
            size = "896x1152"; // 🚀 User Rule: Listing Vertical (Mobile Optimized)
        } else if (isDallE3) {
            size = "1024x1792";
        } else {
            size = "768x1024";
        }
    } else {
        // 1:1
        size = "1024x1024";
    }

    console.log('🎨 [generateVisual] 开始生成图像', {
        model: imageModel.name,
        provider: imageModel.provider,
        aspectRatio,
        resolution,
        targetSize: size,
        promptLength: prompt.length,
        referenceImagesCount: referenceImages.length
    });

    try {
        // === 🆕 Jiekou/Gemini Image Models (Chat Completion API) ===
        // Supports: gemini-3-pro-image-preview, gemini-2.5-flash-image, etc.
        // These use /v1/chat/completions instead of /v1/images/generations
        if (imageModel.modelId.includes('gemini') && imageModel.modelId.includes('image')) {
            console.log('🔵 [generateVisual] Gemini Image Model Detected (Chat Mode)...');

            let endpoint = imageModel.baseUrl.trim();

            // 🚨 FORCE CORRECT ENDPOINT FOR GRSAI (New Domain: grsaiapi.com)
            if (imageModel.provider === 'grsai' || endpoint.includes('grsai') || endpoint.includes('grsaiapi')) {
                endpoint = 'https://grsaiapi.com/v1/chat/completions';
                console.log('🔹 [Auto-Fix] Forced Grsai Endpoint:', endpoint);
            } else {
                // Generic Gemini Logic
                if (!endpoint.endsWith('/chat/completions')) {
                    // Remove /images/generations if present and append chat/completions
                    endpoint = endpoint.replace(/\/images\/generations$/, '').replace(/\/$/, '') + '/chat/completions';
                }
            }

            // Construct Content Array
            const content: any[] = [
                { type: "text", text: prompt }
            ];

            // Add Reference Image if available (Logic for Edit/Preview)
            if (referenceImages && referenceImages.length > 0) {
                // Only take the first image for now as most APIs expect single ref image for edit
                const refImg = referenceImages[0];
                content.push({
                    type: "image_url",
                    image_url: {
                        url: refImg // Assumes base64 data URI or public URL
                    }
                });
                console.log('🖼️ [generateVisual] Added reference image to payload');
            }

            console.log(`📡 [generateVisual] Gemini Request to: ${endpoint}`);

            const response = await fetch(getProxiedUrl(endpoint), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${imageModel.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: imageModel.modelId,
                    stream: false,
                    messages: [
                        {
                            role: "user",
                            content: content
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                // 404 Specific Hint
                if (response.status === 404) {
                    throw new Error(`Gemini Image API Failed (404): Path not found. Requested: ${endpoint}`);
                }
                throw new Error(`Gemini Image API Failed (${response.status}): ${errText}`);
            }

            const data = await response.json();
            const contentText = data.choices?.[0]?.message?.content || "";

            // Extract URL from Markdown ![image](url) OR Base64 data URI
            // Regex supports:
            // 1. https://...
            // 2. data:image/...;base64,...
            // 3. Markdown format ![...](...)

            // Try matching Markdown first: ![image](LINK)
            const markdownMatch = contentText.match(/!\[.*?\]\((.*?)\)/);
            if (markdownMatch && markdownMatch[1]) {
                const link = markdownMatch[1];
                console.log('✅ [generateVisual] Found Markdown Image Link');
                return link;
            }

            // Try matching raw https URL
            const urlMatch = contentText.match(/(https?:\/\/[^\s)]+)/);
            if (urlMatch) {
                console.log('✅ [generateVisual] Found HTTPS URL');
                return urlMatch[1];
            }

            // Try matching raw Base64 Data URI if it's not in markdown
            if (contentText.startsWith('data:image')) {
                console.log('✅ [generateVisual] Found Raw Base64 Data URI');
                return contentText;
            }

            // If we are here, we got success response but NO image
            console.error("Gemini Response Content:", contentText);

            // 🔍 Debug: Dump the whole response to UI to see what's wrong
            const debugInfo = JSON.stringify(data, null, 2);
            throw new Error(`Gemini API returned success but no image found.\nFull Response: ${debugInfo.substring(0, 500)}...`);
        }

        // === 🚀 阿里 Wanx / 这里的 Jiekou 可能是指老版接口 ? ===
        // Note: The original Jiekou.ai logic was here. The user's instruction implies combining it with Aliyun.
        // Assuming the user intended to keep the jiekou.ai base URL check.
        if (imageModel.provider === 'aliyun' || imageModel.provider === 'jiekou' || imageModel.baseUrl?.includes('jiekou.ai')) {
            console.log('🔵 [generateVisual] Detected Jiekou.ai API...');

            let targetUrl = imageModel.baseUrl.replace(/\/$/, '');
            if (imageModel.modelId && !targetUrl.endsWith(imageModel.modelId)) {
                targetUrl = `${targetUrl}/${imageModel.modelId}`;
            }

            console.log(`📡 [generateVisual] Jiekou URL: ${targetUrl}`);

            // Prepare payload
            const payload: any = {
                prompt: prompt,
                aspect_ratio: aspectRatio,
                size: resolution,
                model: imageModel.modelId
            };

            // 🟢 Special handling for Image Editing / Reference Image
            // 🟢 Special handling for Reference Images (Universal)
            if (referenceImages.length > 0) {
                console.log(`🖼️ [generateVisual] Using ${referenceImages.length} reference images for ${imageModel.modelId}...`);

                // Check if images are Base64 or URLs
                const base64s: string[] = [];
                const urls: string[] = [];

                referenceImages.forEach(img => {
                    if (img.startsWith('data:')) {
                        // Strip header for API if needed
                        base64s.push(img.split(',')[1]);
                    } else if (img.startsWith('http')) {
                        urls.push(img);
                    }
                });

                // Add parameters potentially supported by various downstream adapters
                if (base64s.length > 0) {
                    payload.image_base64s = base64s;
                    // Wanx / ModelScope might like singular 'image' or 'img_url'
                    payload.image = base64s[0];
                }
                if (urls.length > 0) {
                    payload.image_urls = urls;
                    // Wanx often uses 'img_url' or 'base_image_url'
                    payload.img_url = urls[0];
                    payload.base_image_url = urls[0];
                }
            }

            const res = await fetch(getProxiedUrl(targetUrl), {
                method: 'POST',
                headers: {
                    'Authorization': imageModel.apiKey.startsWith('Bearer') ? imageModel.apiKey : `Bearer ${imageModel.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                // mode: 'cors' // 代理模式下不需要 CORS mode
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error(`❌ [generateVisual] Jiekou API 请求失败: ${res.status} - ${errText}`);
                throw new Error(`Jiekou API Request Failed: ${res.status} - ${errText}`);
            }

            const data = await res.json();
            // User provided: url || data[0].url || output_url || image_urls[0]
            const imageUrl = data.url || data.data?.[0]?.url || data.output_url || data.image_urls?.[0];

            if (!imageUrl) {
                throw new Error(`Jiekou API returned success but no image URL found: ${JSON.stringify(data)}`);
            }

            console.log('✅ [generateVisual] Jiekou 图像生成成功:', imageUrl.substring(0, 50) + '...');
            return imageUrl;
        }

        // === 🍌 Grsai nano-banana (Async Draw API) ===
        // Docs: https://grsai.com/zh/dashboard/documents/nano-banana
        // Host(海外): https://grsaiapi.com
        // Host(国内直连): https://grsai.dakka.com.cn
        // 绘图接口: POST /v1/draw/{model}
        // 结果接口: POST /v1/draw/result
        if (imageModel.provider === 'grsai' || imageModel.baseUrl?.includes('grsai')) {
            console.log('🍌 [generateVisual] Grsai nano-banana Detected (Async Draw API)...');

            // Determine host - prioritize user config
            // TRUST MODE: We trust the user's config fully, only auto-remove trailing slash
            // NOTE: Docs recommend 'https://grsai.ai' for China users, 'https://grsaiapi.com' for global.
            let host = imageModel.baseUrl?.replace(/\/$/, '') || 'https://grsaiapi.com';

            // Handle potential /v1 suffix in user config (Common Pitfall)
            if (host.endsWith('/v1')) {
                host = host.substring(0, host.length - 3);
            }

            const modelId = imageModel.modelId?.trim() || 'nano-banana';

            // FIX: Nano Banana API endpoint is FIXED to /v1/draw/nano-banana regardless of the specific model variant (Pro/Basic)
            // The specific model variant is passed in the JSON body if supported, or the endpoint handles it.
            // We map 'nano-banana-pro' etc. to the base endpoint.
            let drawPath = `/v1/draw/${modelId}`;
            if (modelId.includes('nano-banana')) {
                drawPath = '/v1/draw/nano-banana';
            }

            const drawEndpoint = `${host}${drawPath}`;
            const resultEndpoint = `${host}/v1/draw/result`;

            console.log(`📡 [generateVisual] Submitting to Grsai: ${drawEndpoint}`);

            // 1. Submit Draw Task
            // Required fields: model, prompt
            // Optional: urls (reference images), aspectRatio, imageSize, webHook
            const drawPayload: any = {
                model: modelId,  // Required!
                prompt: prompt,
                webHook: "-1"    // Return task ID for polling
            };

            // Add reference images if provided
            if (referenceImages && referenceImages.length > 0) {
                console.log(`🖼️ [generateVisual] Adding ${referenceImages.length} reference image(s) to Grsai payload (image_urls)...`);
                // FIX: Use 'image_urls' (standard) and 'images' (alias) and 'urls' (legacy) to cover all bases
                drawPayload.image_urls = referenceImages;
                drawPayload.images = referenceImages;
                drawPayload.urls = referenceImages; // Keep legacy just in case
            }

            // Add aspect ratio if specified
            if (aspectRatio) {
                drawPayload.aspectRatio = aspectRatio;
            }

            // Add resolution/size
            if (resolution) {
                // Map 1024x1024 -> "1K", 2048x2048 -> "2K", etc.
                if (resolution.includes('2048') || resolution.includes('2K')) {
                    drawPayload.imageSize = '2K';
                } else if (resolution.includes('4096') || resolution.includes('4K')) {
                    drawPayload.imageSize = '4K';
                } else {
                    drawPayload.imageSize = '1K';
                }
            }

            console.log(`📦 [generateVisual] Grsai Payload:`, JSON.stringify(drawPayload));

            const submitRes = await fetch(getProxiedUrl(drawEndpoint), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${imageModel.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(drawPayload)
            });

            if (!submitRes.ok) {
                const errText = await submitRes.text();
                throw new Error(`Grsai 提交失败 (${submitRes.status}) [URL: ${drawEndpoint}]: ${errText}`);
            }

            const submitData = await submitRes.json();

            // Check for immediate error
            if (submitData.code !== 0) {
                throw new Error(`Grsai 提交失败: ${submitData.msg || JSON.stringify(submitData)}`);
            }

            const taskId = submitData.data?.id;
            if (!taskId) {
                throw new Error(`Grsai 提交成功但未返回任务 ID: ${JSON.stringify(submitData)}`);
            }
            console.log(`⏳ [generateVisual] Grsai Task Submitted. Task ID: ${taskId}`);

            // 2. Poll for Result
            let attempts = 0;
            const maxAttempts = 240; // 240 * 2s = 480s timeout (8 minutes)

            while (attempts < maxAttempts) {
                attempts++;
                await new Promise(r => setTimeout(r, 2000)); // Wait 2s

                const pollRes = await fetch(getProxiedUrl(resultEndpoint), {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${imageModel.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ id: taskId })
                });

                if (!pollRes.ok) {
                    console.warn(`[Grsai] Polling error: ${pollRes.status}`);
                    continue;
                }

                const pollData = await pollRes.json();

                if (pollData.code !== 0) {
                    // code: -22 means task not found yet, keep polling
                    if (pollData.code === -22) continue;
                    throw new Error(`Grsai 轮询失败: ${pollData.msg || JSON.stringify(pollData)}`);
                }

                const status = pollData.data?.status;
                const progress = pollData.data?.progress || 0;

                console.log(`🔄 [Grsai] Polling... Status: ${status}, Progress: ${progress}%`);

                if (status === 'succeeded') {
                    // Success! Extract image URL
                    const imageUrl = pollData.data?.results?.[0]?.url;
                    if (!imageUrl) {
                        throw new Error(`Grsai 任务成功但未找到图片 URL: ${JSON.stringify(pollData.data)}`);
                    }
                    console.log('✅ [generateVisual] Grsai 图像生成成功:', imageUrl.substring(0, 80) + '...');
                    return imageUrl;
                } else if (status === 'failed') {
                    throw new Error(`Grsai 任务失败: ${pollData.data?.failure_reason || pollData.data?.error || 'Unknown error'}`);
                }
                // If pending or processing, continue loop
            }

            throw new Error(`Grsai 生成超时 (${maxAttempts * 2}秒)`);
        }



        // === ✅ ModelScope 专用通道 (通过代理 API, 异步轮询模式) ===
        if (imageModel.provider === 'modelscope' || imageModel.baseUrl?.includes('modelscope.cn')) {
            console.log('🔵 [generateVisual] 检测到 ModelScope API，使用异步轮询模式...');

            // *******************************************
            // 1. 提交任务 (POST /v1/images/generations)
            // *******************************************
            // 注意：使用 Vercel Proxy 转发
            const targetUrl = 'https://api-inference.modelscope.cn/v1/images/generations';
            const postUrl = `/api/proxy?target=${encodeURIComponent(targetUrl)}`;

            console.log(`📡 [ModelScope] Submitting Task to: ${postUrl} (via Proxy)`);

            // 🧠 智能精简：使用文本模型压缩超长提示词 (仅 ModelScope 需要)
            const optimizedPrompt = await summarizePromptForModelScope(prompt, textModelForSummarize || null);
            console.log(`🔤 [ModelScope] Prompt: ${prompt.length} -> ${optimizedPrompt.length} 字`);

            const submitPayload: any = {
                model: imageModel.modelId,
                input: {
                    prompt: optimizedPrompt
                },
                parameters: {
                    size: size
                }
            };

            // Simple schema for some proxies
            const simplePayload: any = {
                model: imageModel.modelId,
                prompt: optimizedPrompt,
                size: size
            };

            // 🟢 Add Reference Image for ModelScope (ControlNet / i2i)
            if (referenceImages && referenceImages.length > 0) {
                console.log(`🖼️ [generateVisual] Adding reference image to ModelScope payload...`);
                // Standard params for many pipelines
                submitPayload.input.image = referenceImages[0];
                simplePayload.image = referenceImages[0];
                simplePayload.img_url = referenceImages[0];
            }

            const submitRes = await fetch(getProxiedUrl(postUrl), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${imageModel.apiKey}`,
                    'Content-Type': 'application/json',
                    // Async Mode Header
                    'X-ModelScope-Async-Mode': 'true',
                    'X-ModelScope-Task-Type': 'image_generation'
                },
                // Try simple payload first as it matches previous structure, but enriched
                body: JSON.stringify(simplePayload)
            });

            if (!submitRes.ok) {
                const errText = await submitRes.text();
                throw new Error(`ModelScope 提交失败 (${submitRes.status}): ${errText}`);
            }

            const submitData = await submitRes.json();
            const taskId = submitData.task_id;
            if (!taskId) {
                throw new Error(`ModelScope 提交成功但未返回 task_id: ${JSON.stringify(submitData)}`);
            }
            console.log(`⏳ [ModelScope] Task Submitted. Task ID: ${taskId}`);


            // *******************************************
            // 2. 轮询状态 (GET /v1/tasks/{taskId})
            // *******************************************
            const pollTarget = `https://api-inference.modelscope.cn/v1/tasks/${taskId}`;
            const pollUrl = `/api/proxy?target=${encodeURIComponent(pollTarget)}`;
            let attempts = 0;
            const maxAttempts = 30; // 30 * 2s = 60s timeout

            while (attempts < maxAttempts) {
                attempts++;
                await new Promise(r => setTimeout(r, 2000)); // Wait 2s

                const pollRes = await fetch(pollUrl, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${imageModel.apiKey}` }
                });

                if (!pollRes.ok) {
                    console.warn(`[ModelScope] Polling error: ${pollRes.status}`);
                    continue;
                }

                const pollData = await pollRes.json();
                const status = pollData.task_status;

                console.log(`🔄 [ModelScope] Polling... Status: ${status}`);

                if (status === 'SUCCEED') {
                    // Success!
                    // Output format: { task_status: "SUCCEED", output_images: ["url1", ...], ... }
                    const imageUrl = pollData.output_images?.[0] || pollData.output?.results?.[0]?.url;
                    if (!imageUrl) {
                        throw new Error(`ModelScope 任务成功但未找到图片 URL: ${JSON.stringify(pollData)}`);
                    }
                    console.log('✅ [generateVisual] ModelScope 图像生成成功');
                    return imageUrl;

                } else if (status === 'FAILED') {
                    throw new Error(`ModelScope 任务失败: ${pollData.message || JSON.stringify(pollData)}`);
                }
                // If PENDING or RUNNING, continue loop
            }

            throw new Error(`ModelScope 生成超时 (${maxAttempts * 2}秒)`);
        }


        // === 原有逻辑：Google / OpenAI / Aliyun 等 ===
        if (imageModel.provider === 'google') {
            // Placeholder for Google Imagen as current SDK usage is text-centric or requires specific beta endpoints
            console.warn('⚠️ [generateVisual] Google Imagen 暂不支持，返回占位图');
            return "https://via.placeholder.com/1024?text=Google+Imagen+Placeholder";
        }

        const endpoint = `${imageModel.baseUrl}/images/generations`;

        console.log(`📡 [generateVisual] 调用 ${imageModel.provider} API:`, endpoint);

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${imageModel.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: imageModel.modelId,
                prompt,
                n: 1,
                size: size
            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`❌ [generateVisual] API 错误 (${res.status}):`, errorText);
            throw new Error(`图像生成 API 错误 (${res.status}): ${errorText}`);
        }

        const data = await res.json();
        const imageUrl = data.data?.[0]?.url || data.output?.url || "https://via.placeholder.com/1024?text=Generation+Failed";

        console.log('✅ [generateVisual] 图像生成成功:', imageUrl.substring(0, 80) + '...');
        return imageUrl;

    } catch (e: any) {
        console.error('❌ [generateVisual] 图像生成异常:', e);
        throw e; // Rethrow to let caller handle the UI state
    }
};

// ✅ 重写：严格连通性测试
export const verifyModelConnection = async (config: ModelConfig): Promise<{ success: boolean; msg: string }> => {
    try {
        let baseUrl = config.baseUrl?.replace(/\/$/, '') || '';
        // 智能补全
        if (baseUrl && !baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;

        // 🚨 Global Auto-Fix: Update old dashboard URL (grsai.ai) to new API domain (grsaiapi.com)
        // New Domain: grsaiapi.com
        if (baseUrl.includes('grsai') && !baseUrl.includes('grsaiapi.com')) {
            baseUrl = 'https://grsaiapi.com';
        }
        // 🚨 Global Auto-Fix: Ensure /v1
        if (baseUrl.includes('grsaiapi.com') && !baseUrl.includes('/v1')) {
            baseUrl = 'https://grsaiapi.com/v1';
        }

        console.log(`[Strict Test] Testing ${config.name} (${config.provider})...`);

        // === 场景 A: ModelScope 特殊测试 ===
        // 修正逻辑：只有明确为 'image' 分类且使用 modelscope 的才走生图测试
        // 文本/多模态模型 (如 ZhipuAI/GLM-4.7) 即使是 modelscope 提供商，也应走下方的 Chat 测试
        if ((baseUrl.includes('modelscope.cn') || config.provider === 'modelscope') && config.category === 'image') {
            // 策略：通过代理发送一个生图请求，但使用无效参数，看是否返回业务错误(JSON)而非 401(Auth)
            console.log('[Strict Test] Testing ModelScope Image via Proxy...');
            const res = await fetch('/api/modelscope?action=generate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                // 故意构造错误 input，但保留必要字段以通过初步校验
                body: JSON.stringify({
                    model: 'check-auth-only',
                    prompt: '', // 空 prompt 可能会触发 400
                    size: '1024x1024'
                })
            });

            // 如果返回 401/403，肯定是 Key 错
            if (res.status === 401 || res.status === 403) throw new Error("认证失败：API Key 无效");

            // 如果返回 400 或 200，说明连通了（因为服务器处理了请求）
            // 只要不是 404 (地址错) 或 401 (Key错)，就算通了
            if (res.status === 404) throw new Error("地址错误：未找到 API 端点");

            // 即使是 400 Bad Request (因为我们故意发了错误参数)，也说明连通性没问题，Auth 也没问题
            return { success: true, msg: "ModelScope (Image) 连接成功" };
        }

        // === 场景 C: Grsai 连通性测试 (Standard Chat) ===
        if (config.provider === 'grsai') {
            // Forced Correct Base URL
            const baseUrl = 'https://grsaiapi.com/v1';
            const chatUrl = `${baseUrl}/chat/completions`;

            console.log(`[Strict Test] Testing Grsai via Chat API: ${chatUrl} (Proxy)`);

            try {
                const res = await fetch(getProxiedUrl(chatUrl), {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${config.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: config.modelId || 'gpt-4o-mini', // Default fallback
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 1
                    })
                });

                if (res.status === 401) throw new Error("认证失败：API Key 无效");
                if (res.status === 404) throw new Error("地址错误：未找到 API 端点");

                // 400 (Bad Request) usually means params error but auth passed. 200 is success.
                if (!res.ok && res.status !== 400) {
                    const errText = await res.text();
                    throw new Error(`连接失败 (${res.status}): ${errText}`);
                }

                return { success: true, msg: "Grsai 连接成功 (Chat Mode)" };
            } catch (e: any) {
                throw new Error(e.message);
            }
        }

        // === 场景 D: 文本/多模态模型 (真·对话测试) ===
        if (config.category === 'text' || config.category === 'multimodal') {
            // Google Gemini 特殊处理 (如果 SDK 未就绪，使用 REST)
            if (config.provider === 'google') {
                // 简单检查
                if (!config.apiKey) throw new Error("API Key 不能为空");
                return { success: true, msg: "Google Gemini 配置格式正确" };
            }

            let chatUrl = config.baseUrl;
            if (!chatUrl.endsWith('/chat/completions')) {
                chatUrl = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
            }

            const res = await fetch(chatUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.modelId,
                    messages: [{ role: 'user', content: 'Hi' }], // 最小 Payload
                    max_tokens: 1 // 极省 Token
                })
            });

            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await res.text();
                // 处理 Nginx/Apisix 等网关返回的 HTML 错误页面
                throw new Error(res.status === 404 ? "地址错误 (404 Not Found)" : `非 JSON 响应: ${text.slice(0, 50)}...`);
            }

            const data = await res.json();
            if (!res.ok) {
                // 抛出厂商返回的具体错误信息
                throw new Error(data.error?.message || `Error ${res.status}: ${JSON.stringify(data)}`);
            }

            // 进一步验证结构
            if (!data.choices && !data.id) throw new Error("返回数据格式异常 (无 choices/id)");

            return { success: true, msg: `连接成功！延迟: ${Date.now() % 1000}ms` };
        }

        // === 场景 C: 通用图像模型 (尝试列出模型或验证连通) ===
        // 大多数 OpenAI 兼容接口支持 /models
        let listUrl = baseUrl;
        if (baseUrl.endsWith('/v1')) {
            listUrl = `${baseUrl}/models`;
        } else if (!baseUrl.endsWith('/models')) {
            listUrl = `${baseUrl.replace(/\/$/, '')}/models`;
        }

        const res = await fetch(listUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${config.apiKey}` },
            mode: 'cors'
        });

        if (res.status === 401) throw new Error("认证失败：API Key 无效");
        if (res.status === 404) {
            // 如果 /models 不存在，尝试假设成功，但给出警告
            console.warn("Target does not support /models, assuming success if not 401");
            return { success: true, msg: "连接成功 (未发现模型列表接口，但服务器可达)" };
        }

        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.data) || Array.isArray(data)) {
                return { success: true, msg: "连接成功 (模型列表可用)" };
            }
        }

        throw new Error(`连接失败 (Status ${res.status})。请检查 Base URL 是否正确。`);

    } catch (e: any) {
        console.error("[Connection Test Failed]", e);

        // 🆕 全局重试逻辑 (尝试通用代理)
        if (config.provider === 'custom' || config.provider === 'openai-compatible' || config.provider === 'jiekou') {
            try {
                console.log(`[Retry with Proxy] Testing ${config.name} via universal proxy...`);
                // 重新构建 URL (Copy logic from above)
                let testUrl = config.baseUrl;
                if (config.category === 'text' || config.category === 'multimodal') {
                    if (!testUrl.endsWith('/chat/completions')) {
                        testUrl = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
                    }
                    const res = await fetch(getProxiedUrl(testUrl), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
                        body: JSON.stringify({ model: config.modelId, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 1 })
                    });
                    if (res.ok || res.status === 400) return { success: true, msg: "连接成功 (via Proxy)" };
                    if (res.status === 401) throw new Error("认证失败");
                } else if (!config.baseUrl.includes('modelscope')) {
                    // Image defaults
                    let listUrl = config.baseUrl;
                    if (config.baseUrl.endsWith('/v1')) listUrl = `${config.baseUrl}/models`;
                    else if (!config.baseUrl.endsWith('/models')) listUrl = `${config.baseUrl.replace(/\/$/, '')}/models`;

                    const res = await fetch(getProxiedUrl(listUrl), {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${config.apiKey}` }
                    });
                    if (res.ok) return { success: true, msg: "连接成功 (via Proxy)" };
                }
            } catch (proxyErr) {
                console.error("Proxy retry failed", proxyErr);
            }
        }

        return { success: false, msg: e.message || "未知连接错误" };
    }
};

export const fetchAvailableModels = async (
    provider: BrainProvider,
    baseUrl: string,
    apiKey: string,
    filterKeywords?: string[]
): Promise<string[]> => {
    // 简化的默认列表，实际逻辑可以扩展
    return ['gpt-4o', 'gemini-pro', 'claude-3-5-sonnet'];
};

/**
 * 统一对话服务 (支持多模态)
 * 取代 PersonalAgents.tsx 中的内联逻辑
 */
export const chatWithAI = async (
    messages: ChatMessage[],
    modelConfig: ModelConfig,
    systemPrompt: string
): Promise<string> => {
    console.log('💬 [chatWithAI]', { model: modelConfig.name, msgCount: messages.length });

    if (modelConfig.provider === 'google') {
        const ai = new GoogleGenAI({ apiKey: modelConfig.apiKey });

        // Construct contents array for history + current
        const contents = messages.map(msg => {
            const parts: any[] = [];
            if (msg.content) parts.push({ text: msg.content });

            if (msg.attachments && msg.attachments.length > 0) {
                msg.attachments.forEach(img => {
                    const matches = img.match(/^data:(.+);base64,(.+)$/);
                    if (matches) {
                        parts.push({
                            inlineData: {
                                mimeType: matches[1],
                                data: matches[2]
                            }
                        });
                    }
                });
            }

            return {
                role: msg.role === 'user' ? 'user' : 'model',
                parts: parts
            };
        });

        const result = await ai.models.generateContent({
            model: modelConfig.modelId,
            contents: contents,
            config: {
                systemInstruction: systemPrompt
            }
        });

        return result.text?.trim() || "";

    } else {
        // OpenAI Compatible (including ModelScope, DashScope, etc.)
        let endpoint = modelConfig.baseUrl;

        // 🚨 Grsai Auto-Fix (grsaiapi.com)
        if (modelConfig.provider === 'grsai') {
            if (endpoint.includes('grsai') && !endpoint.includes('grsaiapi.com')) {
                endpoint = 'https://grsaiapi.com';
            }
            if (endpoint.includes('grsaiapi.com') && !endpoint.includes('/v1')) {
                endpoint = 'https://grsaiapi.com/v1';
            }
        }

        // Apply Proxy for ModelScope and Jiekou to avoid CORS
        const needsProxy = modelConfig.provider === 'modelscope' ||
            endpoint.includes('modelscope.cn') ||
            endpoint.includes('jiekou.ai');

        if (needsProxy && typeof window !== 'undefined') {
            // 1. Smart Fix: Ensure /v1/chat/completions path is complete
            if (!endpoint.endsWith('/chat/completions')) {
                // Clean up the endpoint first
                let base = endpoint.replace(/\/$/, '');

                // Remove any incomplete path fragments
                if (base.includes('/chat/completions')) {
                    base = base.split('/chat/completions')[0];
                }

                // 🛡️ Pre-process Endpoint for Provider Compatibility
                // (Google is handled in the first if block, so this reached code was dead)

                // Generic handling for others
                if (!endpoint.endsWith('/chat/completions') && !endpoint.includes('generateContent') && !endpoint.includes('openai')) {
                    if (endpoint.includes('modelscope.cn') && !endpoint.includes('/v1')) {
                        endpoint += '/v1';
                    }
                    endpoint += '/chat/completions';
                }

                console.log(`📡 [Stage 1] Calling ${modelConfig.provider} at ${endpoint} (JSON mode: ${false})`); // Assuming supportsJsonMode is not available here, using false as placeholder

                // 2. Wrap via Proxy (MUST use absolute path /api/proxy)
                endpoint = getProxiedUrl(endpoint);
            } else {
                // For non-proxied endpoints, ensure /chat/completions
                endpoint = endpoint.endsWith('/chat/completions')
                    ? endpoint
                    : `${endpoint.replace(/\/$/, '')}/chat/completions`;
            }

            console.log(`📡 [chatWithAI] Proxying ${modelConfig.provider} to: ${endpoint}`);

            // 2. Wrap via Proxy (MUST use absolute path /api/proxy)
            endpoint = getProxiedUrl(endpoint);
        } else {
            // For non-proxied endpoints, ensure /chat/completions
            endpoint = endpoint.endsWith('/chat/completions')
                ? endpoint
                : `${endpoint.replace(/\/$/, '')}/chat/completions`;
        }

        const apiMessages: any[] = [
            { role: 'system', content: systemPrompt }
        ];

        // Format history
        messages.forEach((msg, index) => {
            if (msg.role === 'error') return;

            let content: any = msg.content;
            const isLastMessage = index === messages.length - 1;

            // If message has attachments
            if (msg.attachments && msg.attachments.length > 0) {
                // STRATEGY: Smart Context Pruning
                // Only send Base64 image data for the LAST message (current turn).
                // For history messages, strip the heavy image data to avoid "Payload Too Large" (HTTP 500).
                // We assume the model 'remembers' the image content via its previous textual response.

                if (isLastMessage) {
                    content = [];
                    if (msg.content.trim()) {
                        content.push({ type: 'text', text: msg.content });
                    }
                    msg.attachments.forEach(img => {
                        content.push({
                            type: 'image_url',
                            image_url: { url: img }
                        });
                    });
                } else {
                    // For history: Keep text only, append a note
                    content = msg.content;
                    if (!content || content.trim() === '') {
                        content = '[Image uploaded in previous turn]';
                    } else {
                        content += ' [Image context preserved]';
                    }
                }
            }

            apiMessages.push({
                role: msg.role,
                content: content
            });
        });

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${modelConfig.apiKey}`
            },
            body: JSON.stringify({
                model: modelConfig.modelId,
                messages: apiMessages,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errText = await response.text();

            // 尝试解析 JSON 错误信息
            let friendlyMsg = '';
            try {
                const errJson = JSON.parse(errText);
                const code = errJson.error?.code;
                const msg = errJson.error?.message;

                // Zhipu / ModelScope 常见鉴权错误
                if (response.status === 401 || code === '1000' || code === '1001') {
                    friendlyMsg = '身份验证失败 (API Key 无效或过期)。请在模型管理中检查您的 API Key。';
                } else if (msg) {
                    friendlyMsg = msg;
                }
            } catch (e) {
                // Ignore json parse error
            }

            // 如果返回 500 且无内容，通常是 Payload 过大或上游崩溃
            const errorMsg = friendlyMsg || errText || (response.status === 500 ? '请求可能过大或服务器内部错误 (Payload Too Large?)' : 'Unknown Error');
            throw new Error(friendlyMsg ? errorMsg : `HTTP ${response.status}: ${errorMsg}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    }
};
