import CryptoJS from 'crypto-js';

const ENCRYPTION_SECRET = 'profit-os-client-secret-key-2025';
export const DEFAULT_USER_GEMINI_KEY = 'AQ.Ab8RN6JZYP3o2uPxeueCNTTDIM0p14n0ksYdwHYiLZNj9_BqfQ';

export interface StoredAIConfig {
  provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek';
  geminiKey: string;
  geminiKey2?: string;
  geminiKey3?: string;
  openaiKey: string;
  anthropicKey: string;
  deepseekKey: string;
  geminiModel: string;
  openaiModel: string;
  anthropicModel: string;
  deepseekModel: string;
  customInstruction: string;
}

export function getClientAIConfig(): StoredAIConfig {
  const defaultConfig: StoredAIConfig = {
    provider: 'gemini',
    geminiKey: DEFAULT_USER_GEMINI_KEY,
    geminiKey2: '',
    geminiKey3: '',
    openaiKey: '',
    anthropicKey: '',
    deepseekKey: '',
    geminiModel: 'gemini-3.8-flash',
    openaiModel: 'gpt-4o',
    anthropicModel: 'claude-3-5-sonnet-latest',
    deepseekModel: 'deepseek-chat',
    customInstruction: '',
  };

  try {
    const savedConfigV3 = localStorage.getItem('profit_os_ai_config_v3');
    if (savedConfigV3) {
      const bytes = CryptoJS.AES.decrypt(savedConfigV3, ENCRYPTION_SECRET);
      const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
      if (decryptedStr && decryptedStr.trim().startsWith('{')) {
        const parsed = JSON.parse(decryptedStr);
        if (!parsed.geminiModel || parsed.geminiModel === 'gemini-3.6-flash' || parsed.geminiModel === 'gemini-2.5-flash' || parsed.geminiModel === 'gemini-2.5-pro') {
          parsed.geminiModel = 'gemini-3.8-flash';
        }
        return { ...defaultConfig, ...parsed };
      }
    }

    const savedConfigV2 = localStorage.getItem('profit_os_ai_config_v2');
    if (savedConfigV2) {
      const bytes = CryptoJS.AES.decrypt(savedConfigV2, ENCRYPTION_SECRET);
      const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
      if (decryptedStr && decryptedStr.trim().startsWith('{')) {
        const parsed = JSON.parse(decryptedStr);
        if (!parsed.geminiModel || parsed.geminiModel === 'gemini-3.6-flash' || parsed.geminiModel === 'gemini-2.5-flash' || parsed.geminiModel === 'gemini-2.5-pro') {
          parsed.geminiModel = 'gemini-3.8-flash';
        }
        return { ...defaultConfig, ...parsed };
      }
    }
  } catch (err) {
    console.warn("Failed to read encrypted AI config from localStorage:", err);
  }

  return defaultConfig;
}

/**
 * Returns an array of non-empty configured Gemini keys for failover rotation.
 */
export function getClientGeminiApiKeys(): string[] {
  const config = getClientAIConfig();
  const keys = [
    config.geminiKey?.trim().replace(/^["']|["']$/g, '').trim(),
    config.geminiKey2?.trim().replace(/^["']|["']$/g, '').trim(),
    config.geminiKey3?.trim().replace(/^["']|["']$/g, '').trim()
  ].filter((k): k is string => Boolean(k && k.length > 5));

  return Array.from(new Set(keys));
}

/**
 * Parses and sanitizes raw JSON or SDK error messages into clean, readable text.
 */
export function cleanAiErrorMessage(err: any): string {
  if (!err) return "Error inesperado de Inteligencia Artificial.";
  let raw = typeof err === 'string' ? err : err.message || JSON.stringify(err);

  // Extract JSON if embedded inside string like [GoogleGenAI Error]: {"error": ...}
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error?.message) {
        raw = parsed.error.message;
      } else if (parsed?.message) {
        raw = parsed.message;
      }
    } catch {}
  }

  const lower = raw.toLowerCase();
  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || (lower.includes('invalid') && lower.includes('api key'))) {
    return "La API Key de Gemini ingresada no es válida. Asegúrate de copiarla completa desde Google AI Studio (comienza con 'AIzaSy...').";
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return "Límite de cuota temporal alcanzado (429). El sistema reintentará con clave o modelo de contingencia.";
  }
  if (lower.includes('permission_denied') || lower.includes('403')) {
    return "Permiso denegado con la API Key configurada. Verifica que esté habilitada en Google AI Studio.";
  }
  if (lower.includes('not found') && (lower.includes('models/') || lower.includes('gemini'))) {
    return "El modelo seleccionado no está disponible. Usando Gemini 3.8 Flash automáticamente.";
  }
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
    return "El servicio de Gemini presenta alta demanda temporal (503). Reintentando...";
  }

  return raw;
}
