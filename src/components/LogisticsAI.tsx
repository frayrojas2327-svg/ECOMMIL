import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  Loader2, 
  AlertCircle, 
  TrendingDown, 
  TrendingUp, 
  Package, 
  Truck, 
  DollarSign, 
  Settings, 
  Shield, 
  Key, 
  MessageSquare, 
  Eye, 
  EyeOff, 
  Save, 
  Cpu, 
  Brain, 
  Zap, 
  Globe,
  Check,
  Copy,
  RefreshCw,
  ExternalLink,
  HelpCircle,
  Radio,
  Trash2,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, CurrencyCode } from '../mockData';
import Markdown from 'react-markdown';
import CryptoJS from 'crypto-js';
import { cleanAiErrorMessage } from '../services/aiConfigService';

const ENCRYPTION_SECRET = 'profit-os-ai-secret-key';

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'deepseek';

export type AnalysisMode = 'flash' | 'financial' | 'returns' | 'ads';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  provider?: AIProvider;
  model?: string;
  latencyMs?: number;
  timestamp: string;
}

interface LogisticsAIProps {
  orders: Order[];
  stats: any;
  formatCurrency: (amount: number) => string;
  currency?: CurrencyCode;
  currencies?: any;
  isConversionActive?: boolean;
}

const PROVIDER_INFO: Record<AIProvider, {
  name: string;
  shortName: string;
  tagline: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
  bgLight: string;
  borderLight: string;
  models: { id: string; name: string; tag: string }[];
  defaultModel: string;
  keyPlaceholder: string;
  keyPrefix: string;
  helpUrl: string;
}> = {
  gemini: {
    name: 'Google Gemini',
    shortName: 'Gemini',
    tagline: 'Gemini 3.8 Flash • Máxima velocidad, estabilidad y razonamiento',
    icon: Zap,
    accentColor: 'text-cyan-400',
    bgLight: 'bg-cyan-500/10',
    borderLight: 'border-cyan-500/30',
    models: [
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', tag: 'Ultra Rápido & Recomendado' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', tag: 'Baja Latencia & Eficiente' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', tag: 'Razonamiento Complejo' },
    ],
    defaultModel: 'gemini-3.8-flash',
    keyPlaceholder: 'AQ... o AIzaSy... (API Key de Gemini)',
    keyPrefix: 'AIzaSy / AQ',
    helpUrl: 'https://aistudio.google.com/app/apikey',
  },
  openai: {
    name: 'OpenAI ChatGPT',
    shortName: 'ChatGPT',
    tagline: 'GPT-4o • Análisis comercial de alto nivel',
    icon: Brain,
    accentColor: 'text-emerald-400',
    bgLight: 'bg-emerald-500/10',
    borderLight: 'border-emerald-500/30',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o (Omni)', tag: 'Máxima Capacidad' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tag: 'Económico & Veloz' },
      { id: 'o3-mini', name: 'o3-mini (Razonamiento)', tag: 'Lógica Matemática' },
    ],
    defaultModel: 'gpt-4o',
    keyPlaceholder: 'sk-proj-... / sk-...',
    keyPrefix: 'sk-',
    helpUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    name: 'Anthropic Claude',
    shortName: 'Claude',
    tagline: 'Claude 3.5 • Especialista en auditoría y datos',
    icon: Bot,
    accentColor: 'text-amber-400',
    bgLight: 'bg-amber-500/10',
    borderLight: 'border-amber-500/30',
    models: [
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', tag: 'Líder en Auditoría' },
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', tag: 'Ultra Veloz' },
    ],
    defaultModel: 'claude-3-5-sonnet-latest',
    keyPlaceholder: 'sk-ant-api03-...',
    keyPrefix: 'sk-ant-',
    helpUrl: 'https://console.anthropic.com/settings/keys',
  },
  deepseek: {
    name: 'DeepSeek AI',
    shortName: 'DeepSeek',
    tagline: 'DeepSeek V3 / R1 • Razonamiento de costo eficiente',
    icon: Sparkles,
    accentColor: 'text-blue-400',
    bgLight: 'bg-blue-500/10',
    borderLight: 'border-blue-500/30',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3 Chat', tag: 'General & Veloz' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1 Reasoner', tag: 'Modo Pensamiento' },
    ],
    defaultModel: 'deepseek-chat',
    keyPlaceholder: 'sk-...',
    keyPrefix: 'sk-',
    helpUrl: 'https://platform.deepseek.com/api_keys',
  }
};

const LogisticsAI: React.FC<LogisticsAIProps> = ({ 
  orders, 
  stats, 
  formatCurrency,
  currency = 'USD',
  currencies = {},
  isConversionActive = false
}) => {
  const localFormatCurrency = (amount: number) => {
    const isUSD = !isConversionActive;
    const targetCurrency = isUSD ? 'USD' : currency;
    const rate = currencies[currency]?.rate || 1;
    
    let converted = amount;
    if (!isUSD) {
      converted = amount * rate;
    }
    
    const rounded = Math.round(converted * 100) / 100;
    
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: targetCurrency,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(rounded);
  };

  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<AnalysisMode>('flash');

  // Connection testing states
  const [testingProvider, setTestingProvider] = useState<AIProvider | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, {
    success?: boolean;
    latencyMs?: number;
    message?: string;
    testedAt?: number;
  }>>({});

  // Server-detected keys availability
  const [serverStatus, setServerStatus] = useState<Record<string, any>>({});
  
  // AI Config State
  const DEFAULT_USER_GEMINI_KEY = 'AQ.Ab8RN6JZYP3o2uPxeueCNTTDIM0p14n0ksYdwHYiLZNj9_BqfQ';

  const [aiConfig, setAiConfig] = useState({
    provider: 'gemini' as AIProvider,
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
  });

  const [multiKeyResults, setMultiKeyResults] = useState<Array<{
    index: number;
    active: boolean;
    success: boolean;
    latencyMs?: number;
    message?: string;
    error?: string;
  }> | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch server status on mount
  useEffect(() => {
    fetch('/api/ai/status')
      .then(res => res.json())
      .then(data => {
        setServerStatus(data);
      })
      .catch(err => console.warn("Failed to check server AI status:", err));
  }, []);

  // Load and decrypt config on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('profit_os_ai_config_v3');
    if (savedConfig) {
      try {
        const bytes = CryptoJS.AES.decrypt(savedConfig, ENCRYPTION_SECRET);
        const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
        if (decryptedStr && decryptedStr.trim().startsWith('{')) {
          const decryptedData = JSON.parse(decryptedStr);
          // Auto-upgrade any deprecated or old gemini-2.5 / 3.6 models
          if (!decryptedData.geminiModel || decryptedData.geminiModel === 'gemini-3.6-flash' || decryptedData.geminiModel === 'gemini-2.5-flash' || decryptedData.geminiModel === 'gemini-2.5-pro') {
            decryptedData.geminiModel = 'gemini-3.8-flash';
          }
          if (!decryptedData.geminiKey) {
            decryptedData.geminiKey = DEFAULT_USER_GEMINI_KEY;
          }
          setAiConfig(prev => ({
            ...prev,
            geminiKey2: '',
            geminiKey3: '',
            ...decryptedData
          }));
        }
      } catch (e) {
        console.error("Failed to decrypt AI config v3:", e);
      }
    } else {
      // Migrate from v2 if exists
      const v2Config = localStorage.getItem('profit_os_ai_config_v2');
      if (v2Config) {
        try {
          const bytes = CryptoJS.AES.decrypt(v2Config, ENCRYPTION_SECRET);
          const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
          if (decryptedStr && decryptedStr.trim().startsWith('{')) {
            const decryptedData = JSON.parse(decryptedStr);
            setAiConfig(prev => ({
              ...prev,
              provider: decryptedData.provider || 'gemini',
              geminiKey: decryptedData.geminiKey || DEFAULT_USER_GEMINI_KEY,
              geminiKey2: '',
              geminiKey3: '',
              openaiKey: decryptedData.openaiKey || '',
              anthropicKey: decryptedData.anthropicKey || '',
              deepseekKey: decryptedData.deepseekKey || '',
              geminiModel: 'gemini-3.8-flash',
              customInstruction: decryptedData.customInstruction || '',
            }));
          }
        } catch (e) {
          console.error("Failed to migrate AI config:", e);
        }
      }
    }
    setIsConfigLoaded(true);
  }, []);

  const saveConfig = (newConfig?: typeof aiConfig) => {
    const configToSave = { ...(newConfig || aiConfig) };
    if (!configToSave.geminiModel || configToSave.geminiModel === 'gemini-3.6-flash' || configToSave.geminiModel === 'gemini-2.5-flash' || configToSave.geminiModel === 'gemini-2.5-pro') {
      configToSave.geminiModel = 'gemini-3.8-flash';
    }
    if (configToSave.geminiKey) {
      configToSave.geminiKey = configToSave.geminiKey.trim().replace(/^["']|["']$/g, '').trim();
    }
    if (configToSave.geminiKey2) {
      configToSave.geminiKey2 = configToSave.geminiKey2.trim().replace(/^["']|["']$/g, '').trim();
    }
    if (configToSave.geminiKey3) {
      configToSave.geminiKey3 = configToSave.geminiKey3.trim().replace(/^["']|["']$/g, '').trim();
    }
    try {
      const encrypted = CryptoJS.AES.encrypt(JSON.stringify(configToSave), ENCRYPTION_SECRET).toString();
      localStorage.setItem('profit_os_ai_config_v3', encrypted);
    } catch (err) {
      console.error("Error al cifrar configuración con AES:", err);
    }
    setAiConfig(configToSave);
    setIsConfigOpen(false);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Test live connection for an assistant
  const testConnection = async (provider: AIProvider, explicitKey?: string, explicitModel?: string, testAllGemini = false) => {
    setTestingProvider(provider);
    setMultiKeyResults(null);
    const key = explicitKey !== undefined 
      ? explicitKey 
      : provider === 'gemini' 
        ? aiConfig.geminiKey 
        : provider === 'openai' 
          ? aiConfig.openaiKey 
          : provider === 'anthropic' 
            ? aiConfig.anthropicKey 
            : aiConfig.deepseekKey;

    let model = explicitModel || (
      provider === 'gemini' ? aiConfig.geminiModel :
      provider === 'openai' ? aiConfig.openaiModel :
      provider === 'anthropic' ? aiConfig.anthropicModel :
      aiConfig.deepseekModel
    );

    if (provider === 'gemini' && (!model || model === 'gemini-2.5-flash' || model === 'gemini-2.5-pro')) {
      model = 'gemini-3.6-flash';
    }

    try {
      const bodyPayload = (provider === 'gemini' && testAllGemini)
        ? {
            provider: 'gemini',
            apiKeys: [aiConfig.geminiKey, aiConfig.geminiKey2, aiConfig.geminiKey3].filter(Boolean),
            testAll: true,
            model
          }
        : {
            provider,
            apiKey: (key || '').trim(),
            model
          };

      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json().catch(() => ({ success: false, error: 'Respuesta inválida del servidor' }));

      if (data.keyResults) {
        const cleanedKeyResults = (data.keyResults || []).map((kr: any) => ({
          ...kr,
          error: kr.error ? cleanAiErrorMessage(kr.error) : undefined,
          message: kr.message ? cleanAiErrorMessage(kr.message) : undefined
        }));
        setMultiKeyResults(cleanedKeyResults);
      }

      const displayMessage = cleanAiErrorMessage(data.message || data.error);

      setConnectionStatus(prev => ({
        ...prev,
        [provider]: {
          success: data.success,
          latencyMs: data.latencyMs,
          message: displayMessage,
          testedAt: Date.now()
        }
      }));
    } catch (err: any) {
      const errMsg = cleanAiErrorMessage(err);
      setConnectionStatus(prev => ({
        ...prev,
        [provider]: {
          success: false,
          message: errMsg,
          testedAt: Date.now()
        }
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const analyzeData = async (userQuery?: string, targetProvider?: AIProvider) => {
    setIsLoading(true);
    setError(null);

    const providerToUse = targetProvider || aiConfig.provider;
    const modelToUse = 
      providerToUse === 'gemini' ? aiConfig.geminiModel :
      providerToUse === 'openai' ? aiConfig.openaiModel :
      providerToUse === 'anthropic' ? aiConfig.anthropicModel :
      aiConfig.deepseekModel;

    try {
      let activeApiKey = '';
      if (providerToUse === 'gemini') activeApiKey = aiConfig.geminiKey || '';
      if (providerToUse === 'openai') activeApiKey = aiConfig.openaiKey;
      if (providerToUse === 'anthropic') activeApiKey = aiConfig.anthropicKey;
      if (providerToUse === 'deepseek') activeApiKey = aiConfig.deepseekKey;
      
      const isServerGeminiAvailable = serverStatus?.gemini?.available;
      if (!activeApiKey && providerToUse !== 'gemini' && !isServerGeminiAvailable) {
        setError(`Para utilizar ${PROVIDER_INFO[providerToUse].name}, ingresa tu API Key en 'Configuración de Asistentes'.`);
        setIsLoading(false);
        setIsConfigOpen(true);
        return;
      }

      // Prepare comprehensive business context
      const deliveredOrders = orders.filter(o => o.status === 'Entregado').length;
      const returnedOrders = orders.filter(o => o.status === 'Devuelto').length;
      const cancelledOrders = orders.filter(o => o.status === 'Cancelado').length;
      const pendingOrders = orders.filter(o => o.status === 'Pendiente' || o.status === 'En tránsito').length;
      const returnRate = orders.length > 0 ? ((returnedOrders / orders.length) * 100).toFixed(1) : '0';
      const deliveryRate = orders.length > 0 ? ((deliveredOrders / orders.length) * 100).toFixed(1) : '0';

      const context = {
        totalRevenue: stats.totalRevenue || 0,
        totalNetProfit: stats.totalNetProfit || 0,
        margin: stats.margin || 0,
        roas: stats.roas || 0,
        roi: stats.roi || 0,
        healthScore: stats.healthScore || 0,
        orderCount: orders.length,
        delivered: deliveredOrders,
        returns: returnedOrders,
        cancellations: cancelledOrders,
        pending: pendingOrders,
        returnRate,
        deliveryRate,
        topProducts: Array.from(new Set(orders.map(o => o.product))).slice(0, 5),
        countries: Array.from(new Set(orders.map(o => o.country))),
      };

      // Customized system instruction based on analytical mode
      let modePrompt = "";
      if (activeMode === 'flash') {
        modePrompt = "MODO: Diagnóstico Flash Ejecutivo. MÁXIMO 3 a 4 LÍNEAS. Sé directo, sin rodeos, analítico y ejecutivo.";
      } else if (activeMode === 'financial') {
        modePrompt = "MODO: Auditor Financiero & P&L. Enfócate en margen neto, comisiones de pasarela, costos de adquisición (CPA) y fugas invisibles de capital.";
      } else if (activeMode === 'returns') {
        modePrompt = "MODO: Especialista Logístico & Reducción de Devoluciones (COD). Enfócate en tácticas para rescatar pedidos contra entrega, llamadas de confirmación previas y renegociación de fletes.";
      } else if (activeMode === 'ads') {
        modePrompt = "MODO: Estratega ROAS & Ads Scaling. Evalúa si el CPA y ROAS actuales permiten escalar el presupuesto publicitario sin quemar el margen operativo.";
      }

      const systemInstruction = `Eres el Asesor IA Élite de ECOMMIL (Suite de analítica e-commerce y dropshipping contra entrega).
${modePrompt}
Asistente activo: ${PROVIDER_INFO[providerToUse].name} (${modelToUse}).

Reglas de respuesta:
1. Respuestas de alto valor, estructuradas con viñetas o números breves, basadas estrictamente en los datos del negocio.
2. Menciona los números exactos de la tienda cuando sea pertinente.
3. Termina siempre con 1 RECOMENDACIÓN TÁCTICA ACCIONABLE INMEDIATA.
${aiConfig.customInstruction ? `Instrucción personalizada del usuario: ${aiConfig.customInstruction}` : ''}

Datos operativos actuales:
- Ventas Totales: ${localFormatCurrency(context.totalRevenue)}
- Ganancia Neta: ${localFormatCurrency(context.totalNetProfit)} (Margen: ${context.margin.toFixed(1)}%)
- Pedidos: ${context.orderCount} (Entregados: ${context.delivered} - ${deliveryRate}%, Devoluciones: ${context.returns} - ${returnRate}%, Pendientes: ${context.pending})
- ROAS Promedio: ${context.roas.toFixed(2)}x | Salud del Negocio: ${Math.round(context.healthScore)}/100
- Productos principales: ${context.topProducts.join(', ') || 'N/A'}`;

      const prompt = userQuery || (
        activeMode === 'flash' 
          ? "Ejecuta un diagnóstico flash de rentabilidad y logística con los datos de hoy."
          : activeMode === 'financial'
            ? "Realiza una auditoría financiera de mi margen neto y fugas de capital."
            : activeMode === 'returns'
              ? "¿Qué acciones urgentes debo aplicar para bajar la tasa de devoluciones?"
              : "¿Mi ROAS y margen actual soportan un incremento de presupuesto publicitario?"
      );

      // Call server proxy
      const geminiApiKeys = [aiConfig.geminiKey, aiConfig.geminiKey2, aiConfig.geminiKey3].filter(Boolean);
      const response = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          systemInstruction,
          provider: providerToUse,
          model: modelToUse,
          apiKey: activeApiKey,
          apiKeys: providerToUse === 'gemini' ? geminiApiKeys : undefined,
          context,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(cleanAiErrorMessage(errorData.error || `Error en el servicio de IA (${response.status})`));
      }

      const data = await response.json();
      const text = data.text || "Lo siento, no pude generar una respuesta en este momento.";
      const responseModel = data.model || modelToUse;
      const latency = data.latencyMs || undefined;
      
      const newAiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: text,
        provider: providerToUse,
        model: responseModel,
        latencyMs: latency,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (userQuery) {
        setMessages(prev => [...prev, newAiMsg]);
      } else {
        setMessages([newAiMsg]);
      }
    } catch (err: any) {
      console.error("AI Error:", err);
      const errorMessage = cleanAiErrorMessage(err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial analysis after config is loaded
  useEffect(() => {
    if (isConfigLoaded && messages.length === 0) {
      analyzeData();
    }
  }, [isConfigLoaded]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || query;
    if (!textToSend.trim() || isLoading) return;
    
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setQuery('');
    await analyzeData(textToSend);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const switchProviderAndRetry = (provider: AIProvider) => {
    setAiConfig(prev => ({ ...prev, provider }));
    saveConfig({ ...aiConfig, provider });
    // Re-run with the new provider
    const lastUserQuery = messages.filter(m => m.role === 'user').slice(-1)[0]?.content;
    analyzeData(lastUserQuery, provider);
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    analyzeData();
  };

  const exportChat = () => {
    const formatted = messages.map(m => `[${m.timestamp}] ${m.role === 'user' ? 'USUARIO' : `ASESOR IA (${m.provider?.toUpperCase()} - ${m.model})`}:\n${m.content}\n`).join('\n---\n\n');
    const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-ecommil-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentProviderInfo = PROVIDER_INFO[aiConfig.provider];
  const CurrentIcon = currentProviderInfo.icon;

  return (
    <div className="h-full flex flex-col space-y-5">
      {/* Header & Main Assistant Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card/60 p-4 rounded-2xl border border-border/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-neon/15 border border-neon/30 flex items-center justify-center text-neon shadow-[0_0_15px_rgba(34,197,94,0.25)]">
              <Bot size={24} />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-neon"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-display font-bold text-white tracking-tight">
                Asesor Logístico & Financiero IA
              </h2>
              <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-neon/20 text-neon border border-neon/30">
                Multi-Motor
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Conexión directa con Google Gemini, OpenAI ChatGPT, Anthropic Claude y DeepSeek
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="flex bg-background/60 rounded-xl p-1 border border-border/80 text-xs">
            <div className={`px-2.5 py-1 flex items-center gap-1.5 font-mono text-[11px] font-semibold ${isConversionActive ? 'text-neon' : 'text-slate-400'}`}>
              <Globe size={13} />
              {isConversionActive ? `${currency}` : 'USD'}
            </div>
          </div>

          <button
            onClick={() => testConnection(aiConfig.provider)}
            disabled={testingProvider !== null}
            title="Verificar latencia y conexión con el asistente seleccionado"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background/60 hover:bg-white/5 border border-border/80 text-slate-300 text-xs font-mono transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={testingProvider === aiConfig.provider ? 'animate-spin text-neon' : 'text-slate-400'} />
            <span>
              {testingProvider === aiConfig.provider 
                ? 'Verificando...' 
                : connectionStatus[aiConfig.provider]?.latencyMs 
                  ? `⚡ ${connectionStatus[aiConfig.provider].latencyMs}ms` 
                  : 'Probar Conexión'}
            </span>
          </button>

          <button 
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-neon/10 border border-neon/30 hover:bg-neon/20 text-neon rounded-xl text-xs font-semibold font-mono transition-all cursor-pointer shadow-sm"
          >
            <Settings size={14} />
            <span>Ajustes de API Keys</span>
          </button>
        </div>
      </div>

      {/* Assistant Engine Selector Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(PROVIDER_INFO) as AIProvider[]).map((pKey) => {
          const p = PROVIDER_INFO[pKey];
          const isSelected = aiConfig.provider === pKey;
          const PIcon = p.icon;
          const isServerGemini = pKey === 'gemini' && serverStatus?.gemini?.available;
          const hasKey = pKey === 'gemini' ? (aiConfig.geminiKey || isServerGemini) :
                        pKey === 'openai' ? !!aiConfig.openaiKey :
                        pKey === 'anthropic' ? !!aiConfig.anthropicKey :
                        !!aiConfig.deepseekKey;
          const status = connectionStatus[pKey];

          return (
            <div
              key={pKey}
              role="button"
              tabIndex={0}
              onClick={() => {
                setAiConfig(prev => ({ ...prev, provider: pKey }));
                saveConfig({ ...aiConfig, provider: pKey });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setAiConfig(prev => ({ ...prev, provider: pKey }));
                  saveConfig({ ...aiConfig, provider: pKey });
                }
              }}
              className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer relative overflow-hidden group text-left ${
                isSelected 
                  ? `${p.bgLight} ${p.borderLight} ring-1 ring-neon/40 shadow-[0_0_20px_rgba(0,0,0,0.3)]` 
                  : 'bg-card/40 border-border/60 hover:bg-card/70 hover:border-border'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neon via-emerald-400 to-cyan-400" />
              )}
              
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${isSelected ? 'bg-background/80 text-neon shadow-inner' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}>
                    <PIcon size={18} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                      {p.shortName}
                    </h4>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {pKey === 'gemini' ? aiConfig.geminiModel :
                       pKey === 'openai' ? aiConfig.openaiModel :
                       pKey === 'anthropic' ? aiConfig.anthropicModel :
                       aiConfig.deepseekModel}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  {isSelected ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-neon font-mono bg-neon/15 px-2 py-0.5 rounded-full border border-neon/30">
                      <Check size={10} /> Activo
                    </span>
                  ) : hasKey ? (
                    <span className="text-[10px] text-slate-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                      Listo
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                      Sin clave
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-border/30">
                <span className="truncate max-w-[140px] text-[10px]">
                  {pKey === 'gemini' && !aiConfig.geminiKey ? '⚡ Nativo en Servidor' : p.tagline.split('•')[0]}
                </span>
                {status?.latencyMs ? (
                  <span className="font-mono text-neon text-[10px]">
                    {status.latencyMs}ms
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 group-hover:text-slate-300">
                    Cambiar →
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytical Mode Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-mono uppercase text-slate-400 shrink-0 font-bold flex items-center gap-1 mr-1">
          <Radio size={12} className="text-neon" /> Modo de Análisis:
        </span>
        <button
          onClick={() => setActiveMode('flash')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeMode === 'flash'
              ? 'bg-neon text-background font-bold shadow-[0_0_12px_rgba(34,197,94,0.4)]'
              : 'bg-card/70 border border-border/70 text-slate-400 hover:text-white hover:bg-card'
          }`}
        >
          ⚡ Diagnóstico Flash Ejecutivo
        </button>
        <button
          onClick={() => setActiveMode('financial')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeMode === 'financial'
              ? 'bg-neon text-background font-bold shadow-[0_0_12px_rgba(34,197,94,0.4)]'
              : 'bg-card/70 border border-border/70 text-slate-400 hover:text-white hover:bg-card'
          }`}
        >
          📊 Auditor Financiero & P&L
        </button>
        <button
          onClick={() => setActiveMode('returns')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeMode === 'returns'
              ? 'bg-neon text-background font-bold shadow-[0_0_12px_rgba(34,197,94,0.4)]'
              : 'bg-card/70 border border-border/70 text-slate-400 hover:text-white hover:bg-card'
          }`}
        >
          🚚 Especialista Devoluciones (COD)
        </button>
        <button
          onClick={() => setActiveMode('ads')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeMode === 'ads'
              ? 'bg-neon text-background font-bold shadow-[0_0_12px_rgba(34,197,94,0.4)]'
              : 'bg-card/70 border border-border/70 text-slate-400 hover:text-white hover:bg-card'
          }`}
        >
          🎯 Estratega ROAS & Ads
        </button>
      </div>

      {/* Main Workspace (Stats Sidebar + Intelligent Chat Area) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 flex-1 min-h-0">
        
        {/* Left Side: Real-time Business Vitals */}
        <div className="lg:col-span-1 space-y-4 flex flex-col">
          
          {/* Health Score Card */}
          <div className="glass-card p-5 border-border/70 bg-card/60 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold">
                Índice de Salud Operativa
              </span>
              <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${
                stats.healthScore > 70 ? 'bg-neon/15 text-neon border border-neon/30' :
                stats.healthScore > 40 ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                'bg-red-500/15 text-red-400 border border-red-500/30'
              }`}>
                {stats.healthScore > 70 ? 'Óptimo' : stats.healthScore > 40 ? 'Alerta' : 'Crítico'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-4xl font-mono font-bold tracking-tight ${
                stats.healthScore > 70 ? 'text-neon' : stats.healthScore > 40 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {Math.round(stats.healthScore || 0)}
              </span>
              <span className="text-slate-500 text-sm font-mono">/ 100</span>
            </div>

            <div className="w-full h-2 bg-background/80 rounded-full overflow-hidden border border-border/50">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, stats.healthScore || 0))}%` }}
                className={`h-full transition-all duration-500 ${
                  stats.healthScore > 70 ? 'bg-gradient-to-r from-emerald-500 to-neon' :
                  stats.healthScore > 40 ? 'bg-amber-500' :
                  'bg-red-500'
                }`}
              />
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="glass-card p-4 space-y-3 bg-card/60 border-border/70">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
                  <TrendingDown size={14} />
                </div>
                <span>Tasa Devoluciones</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-mono font-bold text-white">
                  {orders.length > 0 ? ((orders.filter(o => o.status === 'Devuelto').length / orders.length) * 100).toFixed(1) : 0}%
                </span>
                <span className="text-[10px] text-slate-500 block font-mono">
                  {orders.filter(o => o.status === 'Devuelto').length} de {orders.length}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <div className="p-1.5 rounded-lg bg-neon/10 text-neon">
                  <DollarSign size={14} />
                </div>
                <span>Margen Neto Real</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-mono font-bold text-neon">
                  {(stats.margin || 0).toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500 block font-mono">
                  {localFormatCurrency(stats.totalNetProfit || 0)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <TrendingUp size={14} />
                </div>
                <span>ROAS Promedio</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-mono font-bold text-white">
                  {(stats.roas || 0).toFixed(2)}x
                </span>
                <span className="text-[10px] text-slate-500 block font-mono">
                  ROI: {(stats.roi || 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Active Assistant Details Box */}
          <div className={`p-4 rounded-2xl border ${currentProviderInfo.bgLight} ${currentProviderInfo.borderLight} space-y-2`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
                Motor Activo
              </span>
              <span className={`text-[10px] font-mono font-bold ${currentProviderInfo.accentColor}`}>
                {currentProviderInfo.shortName}
              </span>
            </div>
            <p className="text-xs text-white font-medium">
              {aiConfig.provider === 'gemini' ? aiConfig.geminiModel :
               aiConfig.provider === 'openai' ? aiConfig.openaiModel :
               aiConfig.provider === 'anthropic' ? aiConfig.anthropicModel :
               aiConfig.deepseekModel}
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {currentProviderInfo.tagline}
            </p>
            <div className="pt-2 flex items-center justify-between border-t border-border/40">
              <button
                onClick={() => testConnection(aiConfig.provider)}
                className="text-[11px] text-neon hover:underline flex items-center gap-1 font-mono cursor-pointer"
              >
                <RefreshCw size={11} className={testingProvider === aiConfig.provider ? 'animate-spin' : ''} />
                Comprobar estado
              </button>
              <button
                onClick={() => setIsConfigOpen(true)}
                className="text-[11px] text-slate-400 hover:text-white font-mono cursor-pointer"
              >
                Cambiar modelo →
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive AI Dialogue Stream */}
        <div className="lg:col-span-3 glass-card flex flex-col overflow-hidden border-border/70 bg-card/50 rounded-2xl">
          
          {/* Stream Header */}
          <div className="px-5 py-3.5 bg-background/50 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CurrentIcon size={16} className={currentProviderInfo.accentColor} />
              <span className="text-xs font-bold text-white tracking-wide">
                Sesión con {currentProviderInfo.name}
              </span>
              <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-white/5 border border-border/50">
                {messages.length} mensaje(s)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {messages.length > 0 && (
                <>
                  <button
                    onClick={exportChat}
                    title="Exportar análisis a archivo de texto"
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={clearChat}
                    title="Limpiar conversación y reiniciar diagnóstico"
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-border/80"
          >
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isAi = msg.role === 'ai';
                const msgProvider = msg.provider || aiConfig.provider;
                const pInfo = PROVIDER_INFO[msgProvider];
                const MsgIcon = pInfo?.icon || Bot;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex flex-col ${isAi ? 'items-start' : 'items-end'}`}
                  >
                    {/* Message Header Label */}
                    <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400 font-mono px-1">
                      {isAi ? (
                        <>
                          <MsgIcon size={12} className={pInfo?.accentColor || 'text-neon'} />
                          <span className="font-semibold text-slate-300">{pInfo?.name || 'Asesor IA'}</span>
                          {msg.model && <span className="text-slate-400">• {msg.model}</span>}
                          {msg.latencyMs && (
                            <span className="text-neon bg-neon/10 px-1.5 py-0.2 rounded border border-neon/20">
                              {(msg.latencyMs / 1000).toFixed(2)}s
                            </span>
                          )}
                          <span className="text-slate-400">{msg.timestamp}</span>
                        </>
                      ) : (
                        <>
                          <span>Tú</span>
                          <span className="text-slate-400">{msg.timestamp}</span>
                        </>
                      )}
                    </div>

                    {/* Bubble Content */}
                    <div className={`max-w-[92%] rounded-2xl p-4 text-sm leading-relaxed ${
                      isAi 
                        ? 'bg-card/95 border border-border/80 text-slate-200 shadow-sm' 
                        : 'bg-neon text-background font-semibold shadow-md'
                    }`}>
                      {isAi ? (
                        <div className="markdown-body prose prose-invert prose-sm max-w-none text-slate-200">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}

                      {/* AI Response Footer Actions */}
                      {isAi && (
                        <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs text-slate-400">
                          <button
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="flex items-center gap-1 hover:text-white font-mono text-[11px] transition-colors cursor-pointer"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check size={12} className="text-neon" />
                                <span className="text-neon">Copiado al portapapeles</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copiar diagnóstico</span>
                              </>
                            )}
                          </button>

                          {/* Quick model comparison button */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">Comparar con:</span>
                            {(['gemini', 'openai', 'anthropic'] as AIProvider[])
                              .filter(p => p !== msgProvider)
                              .map(altP => (
                                <button
                                  key={altP}
                                  onClick={() => switchProviderAndRetry(altP)}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-border text-slate-300 hover:text-white transition-all cursor-pointer"
                                >
                                  {PROVIDER_INFO[altP].shortName}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {isLoading && (
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 px-1">
                  <CurrentIcon size={12} className={currentProviderInfo.accentColor} />
                  <span>{currentProviderInfo.name} procesando...</span>
                </div>
                <div className="bg-card/90 border border-border/80 p-4 rounded-2xl flex items-center gap-3">
                  <Loader2 size={18} className="animate-spin text-neon" />
                  <span className="text-sm text-slate-300 font-mono animate-pulse">
                    Consultando métricas y formulando diagnóstico...
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs flex items-start gap-3">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Error de conexión:</p>
                  <p>{error}</p>
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      onClick={() => setIsConfigOpen(true)}
                      className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-mono font-bold cursor-pointer"
                    >
                      Revisar API Keys
                    </button>
                    <button
                      onClick={() => analyzeData(undefined, 'gemini')}
                      className="text-neon hover:underline font-mono cursor-pointer"
                    >
                      Probar con Google Gemini (Nativo) →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Prompts & User Input Area */}
          <div className="p-4 bg-background/70 border-t border-border/60 space-y-3">
            
            {/* Quick Prompt Chips */}
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => handleSend("¿Por qué mi margen neto está en este nivel y qué gastos debo recortar inmediatamente?")}
                disabled={isLoading}
                className="px-2.5 py-1 bg-neon/10 hover:bg-neon/20 border border-neon/20 text-neon rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <DollarSign size={12} /> Diagnóstico de Margen
              </button>
              <button 
                onClick={() => handleSend("Diseña una estrategia paso a paso para bajar las devoluciones contra entrega por debajo del 8%.")}
                disabled={isLoading}
                className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <TrendingDown size={12} /> Bajar Devoluciones COD
              </button>
              <button 
                onClick={() => handleSend("Analiza mi ROAS actual. ¿Puedo incrementar el presupuesto publicitario un 25% mañana?")}
                disabled={isLoading}
                className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Zap size={12} /> Escalar Presupuesto Ads
              </button>
            </div>

            {/* Input Bar */}
            <div className="relative flex items-center gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={`Pregunta a ${currentProviderInfo.name} sobre fletes, productos ganadores, CPA o rentabilidad...`}
                className="flex-1 bg-card/80 border border-border/80 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/40 transition-all font-sans"
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !query.trim()}
                className="absolute right-2 p-2 bg-neon text-background font-bold rounded-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100 cursor-pointer shadow-md"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-AI Configuration Modal */}
      <AnimatePresence>
        {isConfigOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-border flex items-center justify-between bg-background/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-neon/15 text-neon border border-neon/30">
                    <Shield size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold text-white">
                      Conexiones de Asistentes IA
                    </h3>
                    <p className="text-xs text-slate-400">
                      Gestiona tus claves de API para Google Gemini, ChatGPT, Claude y DeepSeek
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsConfigOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 scrollbar-thin">
                
                {/* Provider Selector Tabs */}
                <div className="space-y-2">
                  <label className="text-xs uppercase font-mono font-bold text-slate-400 flex items-center gap-1.5">
                    <Cpu size={14} className="text-neon" /> Seleccionar Asistente Predeterminado
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(Object.keys(PROVIDER_INFO) as AIProvider[]).map((pKey) => {
                      const p = PROVIDER_INFO[pKey];
                      const isSelected = aiConfig.provider === pKey;
                      const PIcon = p.icon;
                      return (
                        <button
                          key={pKey}
                          onClick={() => setAiConfig(prev => ({ ...prev, provider: pKey }))}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected 
                              ? `${p.bgLight} ${p.borderLight} ring-1 ring-neon/40 text-white` 
                              : 'bg-background/40 border-border/70 text-slate-400 hover:border-border'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <PIcon size={16} className={isSelected ? 'text-neon' : 'text-slate-400'} />
                            <span className="font-bold text-xs">{p.shortName}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block truncate">{p.models[0].name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* API Keys Configuration for Each Provider */}
                <div className="space-y-4 pt-2 border-t border-border/50">
                  <h4 className="text-xs font-mono uppercase font-bold text-slate-300">
                    Credenciales & Modelos de Asistentes
                  </h4>

                  {/* 1. Google Gemini */}
                  <div className="p-4 rounded-xl bg-background/50 border border-border/70 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap size={16} className="text-cyan-400" />
                        <span className="text-sm font-bold text-white">Google Gemini</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                          {serverStatus?.gemini?.available ? '⚡ Servidor Activo' : 'Clave requerida'}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hidden sm:inline">
                          🛡️ Failover Multi-Clave (3x)
                        </span>
                      </div>
                      <a
                        href={PROVIDER_INFO.gemini.helpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 font-mono"
                      >
                        Obtener Key <ExternalLink size={12} />
                      </a>
                    </div>

                    <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-800/30 text-[11px] text-cyan-200/90 leading-relaxed">
                      💡 <strong>Rotación Anti-Agotamiento de Cuota:</strong> Puedes configurar hasta 3 claves de Gemini gratuitas. Si una clave llega al límite de peticiones (429 Quota/Resource Exhausted), el sistema rota instantáneamente a la siguiente clave para que nunca se interrumpan tus análisis.
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-mono">Modelo Gemini Preferido</label>
                      <select
                        value={aiConfig.geminiModel}
                        onChange={(e) => setAiConfig(prev => ({ ...prev, geminiModel: e.target.value }))}
                        className="w-full bg-card border border-border rounded-lg py-2 px-3 text-xs text-white font-mono focus:outline-none focus:border-neon"
                      >
                        {PROVIDER_INFO.gemini.models.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.tag})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3 pt-1">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] text-slate-300 font-mono font-bold flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-black">1</span>
                            API Key Principal (Gemini 1)
                          </label>
                          <span className="text-[10px] text-slate-500 font-mono">Prioritaria</span>
                        </div>
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={aiConfig.geminiKey}
                          onChange={(e) => setAiConfig(prev => ({ ...prev, geminiKey: e.target.value }))}
                          placeholder="AQ... o AIzaSy... (API Key Principal)"
                          className="w-full bg-card border border-border rounded-lg py-2 px-3 text-xs text-white font-mono focus:outline-none focus:border-neon"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 text-[10px] flex items-center justify-center font-black">2</span>
                              API Key Respaldo 1 (Gemini 2)
                            </label>
                            <span className="text-[10px] text-slate-500 font-mono">Failover</span>
                          </div>
                          <input
                            type={showApiKey ? "text" : "password"}
                            value={aiConfig.geminiKey2 || ''}
                            onChange={(e) => setAiConfig(prev => ({ ...prev, geminiKey2: e.target.value }))}
                            placeholder="AQ... o AIzaSy... (Opcional - Failover)"
                            className="w-full bg-card border border-border rounded-lg py-2 px-3 text-xs text-white font-mono focus:outline-none focus:border-neon"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 text-[10px] flex items-center justify-center font-black">3</span>
                              API Key Respaldo 2 (Gemini 3)
                            </label>
                            <span className="text-[10px] text-slate-500 font-mono">Failover</span>
                          </div>
                          <input
                            type={showApiKey ? "text" : "password"}
                            value={aiConfig.geminiKey3 || ''}
                            onChange={(e) => setAiConfig(prev => ({ ...prev, geminiKey3: e.target.value }))}
                            placeholder="AQ... o AIzaSy... (Opcional - Failover)"
                            className="w-full bg-card border border-border rounded-lg py-2 px-3 text-xs text-white font-mono focus:outline-none focus:border-neon"
                          />
                        </div>
                      </div>
                    </div>

                    {multiKeyResults && (
                      <div className="p-3 rounded-lg bg-black/60 border border-border space-y-1.5 text-xs font-mono">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Diagnóstico Multi-Clave:</span>
                        {multiKeyResults.map((kr) => (
                          <div key={kr.index} className="flex items-center justify-between py-0.5">
                            <span className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${kr.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                              <span>Clave #{kr.index + 1}:</span>
                            </span>
                            <span className={kr.success ? 'text-emerald-400 font-bold' : 'text-red-400'}>
                              {kr.success ? `Activa (${kr.latencyMs}ms)` : (cleanAiErrorMessage(kr.error) || 'Inactiva')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-slate-400">
                        {connectionStatus.gemini?.message || 'Gemini 3.8 Flash / 3.1 Flash Lite con rotación de claves activo'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => testConnection('gemini', aiConfig.geminiKey, aiConfig.geminiModel, false)}
                          disabled={testingProvider === 'gemini'}
                          className="px-3 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold transition-all cursor-pointer"
                        >
                          {testingProvider === 'gemini' ? 'Verificando...' : 'Probar Principal'}
                        </button>
                        <button
                          type="button"
                          onClick={() => testConnection('gemini', undefined, aiConfig.geminiModel, true)}
                          disabled={testingProvider === 'gemini'}
                          className="px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold transition-all cursor-pointer"
                        >
                          Probar Todas (Failover)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 2. OpenAI ChatGPT */}
                  <div className="p-4 rounded-xl bg-background/50 border border-border/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Brain size={16} className="text-emerald-400" />
                        <span className="text-sm font-bold text-white">OpenAI ChatGPT</span>
                        {aiConfig.openaiKey && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Clave Guardada
                          </span>
                        )}
                      </div>
                      <a
                        href={PROVIDER_INFO.openai.helpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 font-mono"
                      >
                        Obtener Key <ExternalLink size={12} />
                      </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1 font-mono">Modelo ChatGPT</label>
                        <select
                          value={aiConfig.openaiModel}
                          onChange={(e) => setAiConfig(prev => ({ ...prev, openaiModel: e.target.value }))}
                          className="w-full bg-card border border-border rounded-lg py-2 px-3 text-xs text-white font-mono focus:outline-none focus:border-neon"
                        >
                          {PROVIDER_INFO.openai.models.map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({m.tag})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1 font-mono">OpenAI API Key</label>
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={aiConfig.openaiKey}
                          onChange={(e) => setAiConfig(prev => ({ ...prev, openaiKey: e.target.value }))}
                          placeholder="sk-proj-... / sk-..."
                          className="w-full bg-card border border-border rounded-lg py-2 px-3 text-xs text-white font-mono focus:outline-none focus:border-neon"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400 truncate max-w-sm">
                        {connectionStatus.openai?.message || 'Requiere clave OpenAI activa'}
                      </span>
                      <button
                        type="button"
                        onClick={() => testConnection('openai', aiConfig.openaiKey, aiConfig.openaiModel)}
                        disabled={testingProvider === 'openai' || !aiConfig.openaiKey}
                        className="px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold transition-all cursor-pointer disabled:opacity-40"
                      >
                        {testingProvider === 'openai' ? 'Verificando...' : 'Probar ChatGPT'}
                      </button>
                    </div>
                  </div>

                  {/* 3. Anthropic Claude */}
                  <div className="p-4 rounded-xl bg-background/50 border border-border/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot size={16} className="text-amber-400" />
                        <span className="text-sm font-bold text-white">Anthropic Claude</span>
                        {aiConfig.anthropicKey && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            Clave Guardada
                          </span>
                        )}
                      </div>
                      <a
                        href={PROVIDER_INFO.anthropic.helpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1 font-mono"
                      >
                        Obtener Key <ExternalLink size={12} />
                      </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1 font-mono">Modelo Claude</label>
                        <select
                          value={aiConfig.anthropicModel}
                          onChange={(e) => setAiConfig(prev => ({ ...prev, anthropicModel: e.target.value }))}
                          className="w-full bg-card border border-border rounded-lg py-2 px-3 text-xs text-white font-mono focus:outline-none focus:border-neon"
                        >
                          {PROVIDER_INFO.anthropic.models.map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({m.tag})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1 font-mono">Anthropic API Key</label>
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={aiConfig.anthropicKey}
                          onChange={(e) => setAiConfig(prev => ({ ...prev, anthropicKey: e.target.value }))}
                          placeholder="sk-ant-api03-..."
                          className="w-full bg-card border border-border rounded-lg py-2 px-3 text-xs text-white font-mono focus:outline-none focus:border-neon"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400 truncate max-w-sm">
                        {connectionStatus.anthropic?.message || 'Requiere clave Anthropic activa'}
                      </span>
                      <button
                        type="button"
                        onClick={() => testConnection('anthropic', aiConfig.anthropicKey, aiConfig.anthropicModel)}
                        disabled={testingProvider === 'anthropic' || !aiConfig.anthropicKey}
                        className="px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold transition-all cursor-pointer disabled:opacity-40"
                      >
                        {testingProvider === 'anthropic' ? 'Verificando...' : 'Probar Claude'}
                      </button>
                    </div>
                  </div>

                  {/* 4. DeepSeek */}
                  <div className="p-4 rounded-xl bg-background/50 border border-border/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-blue-400" />
                        <span className="text-sm font-bold text-white">DeepSeek AI</span>
                        {aiConfig.deepseekKey && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                            Clave Guardada
                          </span>
                        )}
                      </div>
                      <a
                        href={PROVIDER_INFO.deepseek.helpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1 font-mono"
                      >
                        Obtener Key <ExternalLink size={12} />
                      </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1 font-mono">Modelo DeepSeek</label>
                        <select
                          value={aiConfig.deepseekModel}
                          onChange={(e) => setAiConfig(prev => ({ ...prev, deepseekModel: e.target.value }))}
                          className="w-full bg-card border border-border rounded-lg py-2 px-3 text-xs text-white font-mono focus:outline-none focus:border-neon"
                        >
                          {PROVIDER_INFO.deepseek.models.map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({m.tag})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1 font-mono">DeepSeek API Key</label>
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={aiConfig.deepseekKey}
                          onChange={(e) => setAiConfig(prev => ({ ...prev, deepseekKey: e.target.value }))}
                          placeholder="sk-... (Requiere saldo prepagado en DeepSeek)"
                          className="w-full bg-card border border-border rounded-lg py-2 px-3 text-xs text-white font-mono focus:outline-none focus:border-neon"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          {connectionStatus.deepseek?.message && connectionStatus.deepseek.success
                            ? connectionStatus.deepseek.message
                            : 'Requiere saldo en platform.deepseek.com'}
                        </span>
                        <button
                          type="button"
                          onClick={() => testConnection('deepseek', aiConfig.deepseekKey, aiConfig.deepseekModel)}
                          disabled={testingProvider === 'deepseek' || !aiConfig.deepseekKey}
                          className="px-3 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 text-xs font-mono font-bold transition-all cursor-pointer disabled:opacity-40"
                        >
                          {testingProvider === 'deepseek' ? 'Verificando...' : 'Probar DeepSeek'}
                        </button>
                      </div>

                      {connectionStatus.deepseek?.message && !connectionStatus.deepseek.success && (
                        <div className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                          (connectionStatus.deepseek.message.toLowerCase().includes('saldo') || connectionStatus.deepseek.message.includes('402'))
                            ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                            : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                        }`}>
                          <AlertCircle size={14} className="shrink-0 mt-0.5" />
                          <div className="flex-1 space-y-1">
                            <p>{connectionStatus.deepseek.message}</p>
                            {(connectionStatus.deepseek.message.toLowerCase().includes('saldo') || connectionStatus.deepseek.message.includes('402')) && (
                              <div className="flex items-center gap-3 pt-1">
                                <a 
                                  href="https://platform.deepseek.com/top_up" 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-[11px] text-blue-400 underline hover:text-blue-300 font-mono"
                                >
                                  Recargar saldo en DeepSeek ↗
                                </a>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...aiConfig, provider: 'gemini' as AIProvider, geminiModel: 'gemini-3.6-flash' };
                                    setAiConfig(updated);
                                    saveConfig(updated);
                                  }}
                                  className="text-[11px] text-emerald-400 underline hover:text-emerald-300 font-mono font-bold cursor-pointer"
                                >
                                  Activar Google Gemini (Con cuota activa)
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Custom Instruction Box */}
                <div className="space-y-2">
                  <label className="text-xs uppercase font-mono font-bold text-slate-400 flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-neon" /> Instrucciones Personalizadas para los Asistentes
                  </label>
                  <textarea
                    value={aiConfig.customInstruction}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, customInstruction: e.target.value }))}
                    placeholder="Ejemplo: Prioriza siempre reducir la tasa de devolución en transportadoras como Servientrega/Envia. Sé muy estricto con los fletes..."
                    className="w-full bg-background/50 border border-border rounded-xl p-3 text-xs text-white h-20 resize-none focus:outline-none focus:border-neon font-sans"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                    >
                      {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span>{showApiKey ? 'Ocultar claves' : 'Mostrar claves'}</span>
                    </button>
                    <span>Cifrado AES-256 local</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-background/60 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => saveConfig()}
                  className="px-5 py-2 rounded-xl bg-neon text-background font-bold text-xs font-mono flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                >
                  <Save size={14} />
                  Guardar y Activar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LogisticsAI;
