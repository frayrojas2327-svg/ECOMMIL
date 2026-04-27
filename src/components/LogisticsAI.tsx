import React, { useState, useEffect, useRef } from 'react';
import { Bot, Sparkles, Send, Loader2, AlertCircle, TrendingDown, TrendingUp, Package, Truck, DollarSign, Settings, Shield, Key, MessageSquare, Eye, EyeOff, Save, Cpu, Brain, Zap, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Order, CurrencyCode } from '../mockData';
import Markdown from 'react-markdown';
import CryptoJS from 'crypto-js';

const ENCRYPTION_SECRET = 'profit-os-ai-secret-key';

type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'deepseek';

interface LogisticsAIProps {
  orders: Order[];
  stats: any;
  formatCurrency: (amount: number) => string;
  currency?: CurrencyCode;
  currencies?: any;
  isConversionActive?: boolean;
}

const LogisticsAI: React.FC<LogisticsAIProps> = ({ 
  orders, 
  stats, 
  formatCurrency,
  currency = 'USD',
  currencies = {},
  isConversionActive = false
}) => {
  const [isLocalConversionActive, setIsLocalConversionActive] = useState(isConversionActive);

  useEffect(() => {
    setIsLocalConversionActive(isConversionActive);
  }, [isConversionActive]);

  const localFormatCurrency = (amount: number) => {
    const isUSD = !isLocalConversionActive;
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
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  
  // AI Config State
  const [aiConfig, setAiConfig] = useState({
    provider: 'gemini' as AIProvider,
    geminiKey: '',
    openaiKey: '',
    anthropicKey: '',
    deepseekKey: '',
    customInstruction: '',
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load and decrypt config on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('profit_os_ai_config_v2');
    if (savedConfig) {
      try {
        const bytes = CryptoJS.AES.decrypt(savedConfig, ENCRYPTION_SECRET);
        const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        setAiConfig(decryptedData);
      } catch (e) {
        console.error("Failed to decrypt AI config:", e);
      }
    } else {
      // Migrate from v1 if exists
      const v1Config = localStorage.getItem('profit_os_ai_config');
      if (v1Config) {
        try {
          const bytes = CryptoJS.AES.decrypt(v1Config, ENCRYPTION_SECRET);
          const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
          setAiConfig({
            provider: 'gemini',
            geminiKey: decryptedData.apiKey || '',
            openaiKey: '',
            anthropicKey: '',
            deepseekKey: '',
            customInstruction: decryptedData.customInstruction || '',
          });
        } catch (e) {
          console.error("Failed to migrate AI config:", e);
        }
      }
    }
    setIsConfigLoaded(true);
  }, []);

  const saveConfig = () => {
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(aiConfig), ENCRYPTION_SECRET).toString();
    localStorage.setItem('profit_os_ai_config_v2', encrypted);
    setIsConfigOpen(false);
    // Trigger a fresh analysis with new config
    analyzeData(undefined, aiConfig);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const analyzeData = async (userQuery?: string, overrideConfig?: typeof aiConfig) => {
    setIsLoading(true);
    setError(null);

    const config = overrideConfig || aiConfig;

    try {
      let activeApiKey = '';
      if (config.provider === 'gemini') activeApiKey = config.geminiKey || process.env.GEMINI_API_KEY || '';
      if (config.provider === 'openai') activeApiKey = config.openaiKey;
      if (config.provider === 'anthropic') activeApiKey = config.anthropicKey;
      if (config.provider === 'deepseek') activeApiKey = config.deepseekKey;
      
      if (!activeApiKey) {
        setError(`Por favor, configura una API Key para ${config.provider.toUpperCase()} en los ajustes.`);
        setIsLoading(false);
        return;
      }

      // Prepare context for the AI
      const context = {
        totalRevenue: stats.totalRevenue || 0,
        totalNetProfit: stats.totalNetProfit || 0,
        margin: stats.margin || 0,
        roas: stats.roas || 0,
        roi: stats.roi || 0,
        healthScore: stats.healthScore || 0,
        orderCount: orders.length,
        returns: orders.filter(o => o.status === 'Devuelto').length,
        cancellations: orders.filter(o => o.status === 'Cancelado').length,
        topProducts: Array.from(new Set(orders.map(o => o.product))).slice(0, 5),
        countries: Array.from(new Set(orders.map(o => o.country))),
      };

      const baseInstruction = `Eres un Analista Experto de Nivel Élite en Logística y E-commerce.
      Tu misión es realizar un análisis crítico y ultra-conciso de los números de ECOMMIL.
      REGLA DE ORO: Tus respuestas deben ser de MÁXIMO 3 LÍNEAS. Sé directo, brutalmente honesto y puramente basado en datos.
      Usa un tono profesional, analítico y ejecutivo (estilo "High-Level Consultant").
      Si la situación es crítica, di exactamente qué está fallando sin rodeos.
      
      Contexto actual del negocio:
      - Ingresos Totales: ${localFormatCurrency(context.totalRevenue)}
      - Ganancia Neta: ${localFormatCurrency(context.totalNetProfit)}
      - Margen: ${context.margin.toFixed(2)}%
      - ROAS: ${context.roas.toFixed(2)}
      - ROI: ${context.roi.toFixed(2)}%
      - Health Score: ${context.healthScore.toFixed(0)}/100
      - Pedidos Totales: ${context.orderCount}
      - Devoluciones: ${context.returns}
      - Cancelaciones: ${context.cancellations}
      - Países: ${context.countries.join(', ')}
      `;

      const systemInstruction = config.customInstruction 
        ? `${baseInstruction}\n\nInstrucciones Adicionales del Usuario:\n${config.customInstruction}`
        : baseInstruction;

      const prompt = userQuery || "Ejecuta un diagnóstico flash de rentabilidad y logística basándote en los datos actuales.";

      let text = "";

      if (config.provider === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: activeApiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });
        text = response.text || "Lo siento, no pude generar un análisis en este momento.";
      } else if (config.provider === 'openai') {
        const openai = new OpenAI({ apiKey: activeApiKey, dangerouslyAllowBrowser: true });
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
        });
        text = response.choices[0].message.content || "Lo siento, OpenAI no pudo generar una respuesta.";
      } else if (config.provider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: activeApiKey, dangerouslyAllowBrowser: true });
        const response = await anthropic.messages.create({
          model: "claude-3-5-sonnet-latest",
          max_tokens: 1024,
          system: systemInstruction,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        });
        text = (response.content[0] as any).text || "Lo siento, Claude no pudo generar una respuesta.";
      } else if (config.provider === 'deepseek') {
        const openai = new OpenAI({ 
          apiKey: activeApiKey, 
          baseURL: 'https://api.deepseek.com',
          dangerouslyAllowBrowser: true 
        });
        const response = await openai.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
        });
        text = response.choices[0].message.content || "Lo siento, DeepSeek no pudo generar una respuesta.";
      }
      
      if (userQuery) {
        setMessages(prev => [...prev, { role: 'ai', content: text }]);
      } else {
        setMessages([{ role: 'ai', content: text }]);
      }
    } catch (err: any) {
      console.error("AI Error:", err);
      const errorMessage = err.message || (typeof err === 'string' ? err : "Error de conexión o API Key inválida");
      setError(`Error al conectar con ${aiConfig.provider.toUpperCase()}: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial analysis after config is loaded
  useEffect(() => {
    if (isConfigLoaded) {
      analyzeData();
    }
  }, [isConfigLoaded]);

  const handleSend = async () => {
    if (!query.trim() || isLoading) return;
    
    const userMsg = query;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setQuery('');
    await analyzeData(userMsg);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
            <Bot className="text-neon" /> Asesor Logístico IA <span className="text-base bg-neon/20 text-neon px-2 py-1 rounded-full uppercase tracking-widest font-mono">Pro</span>
          </h2>
          <p className="text-base text-slate-500">Análisis experto y estrategias de optimización en tiempo real</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsLocalConversionActive(!isLocalConversionActive)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-black text-[10px] tracking-widest transition-all ${
              isLocalConversionActive 
                ? 'bg-neon text-background shadow-lg shadow-neon/20' 
                : 'bg-card border border-border text-slate-500 hover:text-slate-300'
            }`}
          >
            <Globe size={14} /> {isLocalConversionActive ? 'CONVERSIÓN ACTIVA' : 'MODO USD'}
          </button>
          <button 
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-base font-mono transition-all ${
              isConfigOpen ? 'bg-neon text-background border-neon' : 'bg-neon/10 border-neon/20 text-neon hover:bg-neon/20'
            }`}
          >
            <Settings size={14} className={isConfigOpen ? 'animate-spin-slow' : ''} />
            Configuración IA
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-neon/10 border border-neon/20 rounded-xl text-neon text-base font-mono">
            <Sparkles size={14} className="animate-pulse" />
            {aiConfig.provider === 'gemini' && !aiConfig.geminiKey ? 'Gemini Pro (Default)' : `${aiConfig.provider.toUpperCase()} Activo`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Quick Stats Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {isConfigOpen ? (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-6 border-neon/30 bg-neon/5 space-y-6"
            >
              <div className="flex items-center gap-2 text-neon mb-2">
                <Shield size={16} />
                <h3 className="text-base uppercase tracking-widest font-bold">Seguridad & Multi-IA</h3>
              </div>
              
              <div className="space-y-4">
                {/* Provider Selector */}
                <div className="space-y-2">
                  <label className="text-[15px] uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Cpu size={10} /> Proveedor de IA
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    <button 
                      onClick={() => setAiConfig(prev => ({ ...prev, provider: 'gemini' }))}
                      className={`p-2 rounded-lg border text-[15px] font-bold transition-all flex flex-col items-center gap-1 ${
                        aiConfig.provider === 'gemini' ? 'bg-neon border-neon text-background' : 'bg-background/50 border-border text-slate-400 hover:border-neon/50'
                      }`}
                    >
                      <Zap size={14} /> Gemini
                    </button>
                    <button 
                      onClick={() => setAiConfig(prev => ({ ...prev, provider: 'openai' }))}
                      className={`p-2 rounded-lg border text-[15px] font-bold transition-all flex flex-col items-center gap-1 ${
                        aiConfig.provider === 'openai' ? 'bg-neon border-neon text-background' : 'bg-background/50 border-border text-slate-400 hover:border-neon/50'
                      }`}
                    >
                      <Brain size={14} /> GPT-4
                    </button>
                    <button 
                      onClick={() => setAiConfig(prev => ({ ...prev, provider: 'anthropic' }))}
                      className={`p-2 rounded-lg border text-[15px] font-bold transition-all flex flex-col items-center gap-1 ${
                        aiConfig.provider === 'anthropic' ? 'bg-neon border-neon text-background' : 'bg-background/50 border-border text-slate-400 hover:border-neon/50'
                      }`}
                    >
                      <Bot size={14} /> Claude
                    </button>
                    <button 
                      onClick={() => setAiConfig(prev => ({ ...prev, provider: 'deepseek' }))}
                      className={`p-2 rounded-lg border text-[15px] font-bold transition-all flex flex-col items-center gap-1 ${
                        aiConfig.provider === 'deepseek' ? 'bg-neon border-neon text-background' : 'bg-background/50 border-border text-slate-400 hover:border-neon/50'
                      }`}
                    >
                      <Sparkles size={14} /> DeepSeek
                    </button>
                  </div>
                </div>

                {/* API Key Input based on provider */}
                <div className="space-y-2">
                  <label className="text-[15px] uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Key size={10} /> {aiConfig.provider.toUpperCase()} API Key
                  </label>
                  <div className="relative">
                    <input 
                      type={showApiKey ? "text" : "password"}
                      value={
                        aiConfig.provider === 'gemini' ? aiConfig.geminiKey :
                        aiConfig.provider === 'openai' ? aiConfig.openaiKey :
                        aiConfig.provider === 'anthropic' ? aiConfig.anthropicKey :
                        aiConfig.deepseekKey
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setAiConfig(prev => ({
                          ...prev,
                          geminiKey: prev.provider === 'gemini' ? val : prev.geminiKey,
                          openaiKey: prev.provider === 'openai' ? val : prev.openaiKey,
                          anthropicKey: prev.provider === 'anthropic' ? val : prev.anthropicKey,
                          deepseekKey: prev.provider === 'deepseek' ? val : prev.deepseekKey,
                        }));
                      }}
                      placeholder={
                        aiConfig.provider === 'gemini' ? "AIzaSy..." :
                        aiConfig.provider === 'openai' ? "sk-..." :
                        aiConfig.provider === 'anthropic' ? "sk-ant-..." :
                        "sk-..."
                      }
                      className="w-full bg-background/50 border border-border rounded-lg py-2 pl-3 pr-10 text-base text-white font-mono focus:outline-none focus:border-neon"
                    />
                    <button 
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-neon transition-colors"
                    >
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[15px] text-slate-500 leading-tight">
                    Tus llaves se encriptan con AES-256 localmente.
                  </p>
                </div>

                {/* Custom Instructions */}
                <div className="space-y-2">
                  <label className="text-[15px] uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <MessageSquare size={10} /> Instrucciones Libres
                  </label>
                  <textarea 
                    value={aiConfig.customInstruction}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, customInstruction: e.target.value }))}
                    placeholder="Ej: Analiza como un experto en logística de última milla..."
                    className="w-full bg-background/50 border border-border rounded-lg py-2 px-3 text-base text-white h-20 resize-none focus:outline-none focus:border-neon"
                  />
                </div>

                <button 
                  onClick={saveConfig}
                  className="w-full py-2 bg-neon text-background rounded-lg font-bold text-base flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
                >
                  <Save size={14} />
                  Guardar y Encriptar
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              <div className="glass-card p-6 border-neon/20 bg-neon/5">
                <h3 className="text-[15px] uppercase tracking-widest text-slate-500 mb-4 font-display">Estado de Salud</h3>
                <div className="flex items-end gap-2 mb-2">
                  <span className={`text-4xl font-mono font-bold ${stats.healthScore > 70 ? 'text-neon' : stats.healthScore > 40 ? 'text-gold' : 'text-red-500'}`}>
                    {Math.round(stats.healthScore || 0)}
                  </span>
                  <span className="text-slate-500 text-base mb-1">/100</span>
                </div>
                <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.healthScore}%` }}
                    className={`h-full ${stats.healthScore > 70 ? 'bg-neon' : stats.healthScore > 40 ? 'bg-gold' : 'bg-red-500'}`}
                  />
                </div>
              </div>

              <div className="glass-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
                      <TrendingDown size={16} />
                    </div>
                    <span className="text-base text-slate-400">Devoluciones</span>
                  </div>
                  <span className="text-base font-mono font-bold text-white">{orders.filter(o => o.status === 'Devuelto').length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400">
                      <AlertCircle size={16} />
                    </div>
                    <span className="text-base text-slate-400">Cancelaciones</span>
                  </div>
                  <span className="text-base font-mono font-bold text-white">{orders.filter(o => o.status === 'Cancelado').length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-neon/10 rounded-lg text-neon">
                      <TrendingUp size={16} />
                    </div>
                    <span className="text-base text-slate-400">Margen Neto</span>
                  </div>
                  <span className="text-base font-mono font-bold text-white">{(stats.margin || 0).toFixed(1)}%</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gold/5 border border-gold/20">
                <p className="text-[15px] text-gold uppercase font-bold mb-2">Tip del Asesor</p>
                <p className="text-base text-slate-300 leading-relaxed italic">
                  "Si tu ROI es menor al 30%, estás trabajando para la plataforma de ads, no para ti. Revisa tus costos de flete inmediatamente."
                </p>
              </div>
            </>
          )}
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-3 glass-card flex flex-col overflow-hidden border-border/50">
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-border"
          >
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[85%] p-4 rounded-2xl ${
                    msg.role === 'ai' 
                      ? 'bg-card border border-border text-slate-200' 
                      : 'bg-neon text-background font-medium'
                  }`}>
                    {msg.role === 'ai' ? (
                      <div className="markdown-body prose prose-invert prose-base max-w-none">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    ) : (
                      <p className="text-base">{msg.content}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-3">
                  <Loader2 size={18} className="animate-spin text-neon" />
                  <span className="text-base text-slate-400 animate-pulse">Analizando métricas y generando estrategias...</span>
                </div>
              </div>
            )}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-base flex items-center gap-2">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
          </div>

          <div className="p-4 bg-background/50 border-t border-border space-y-4">
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => { setQuery('¿Cómo bajar mi tasa de devoluciones al 5%?'); }}
                className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-all flex items-center gap-2"
              >
                <TrendingDown size={12} /> Optimizar Devolución 5%
              </button>
              <button 
                onClick={() => { setQuery('Analiza mi ROI actual y dime si es sostenible.'); }}
                className="px-3 py-1.5 bg-neon/10 border border-neon/20 text-neon rounded-lg text-xs font-bold hover:bg-neon/20 transition-all flex items-center gap-2"
              >
                <Zap size={12} /> Diagnóstico ROI
              </button>
              <button 
                onClick={() => { setQuery('¿Mi margen neto es saludable para escalar a más países?'); }}
                className="px-3 py-1.5 bg-gold/10 border border-gold/20 text-gold rounded-lg text-xs font-bold hover:bg-gold/20 transition-all flex items-center gap-2"
              >
                <Truck size={12} /> Estrategia de Escala
              </button>
            </div>

            <div className="relative flex items-center gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Consultar análisis experto sobre fletes, ROI o salud del negocio..."
                className="flex-1 bg-card border border-border rounded-xl py-3 pl-4 pr-12 text-base text-white focus:outline-none focus:border-neon transition-all"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !query.trim()}
                className="absolute right-2 p-2 bg-neon text-background rounded-lg hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsAI;
