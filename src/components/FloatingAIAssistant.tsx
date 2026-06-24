import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Loader2, 
  X, 
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { Order, CurrencyCode } from '../mockData';
import Markdown from 'react-markdown';
import CryptoJS from 'crypto-js';

const ENCRYPTION_SECRET = 'profit-os-ai-secret-key';

interface FloatingAIAssistantProps {
  orders: Order[];
  stats: any;
  periods?: any[];
  formatCurrency: (amount: number) => string;
  currency?: CurrencyCode;
  currencies?: any;
  isConversionActive?: boolean;
  activeTab: string;
  theme?: string;
}

export const FloatingAIAssistant: React.FC<FloatingAIAssistantProps> = ({
  orders,
  stats,
  periods = [],
  formatCurrency,
  currency = 'USD',
  currencies = {},
  isConversionActive = false,
  activeTab,
  theme
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string; id: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [activeTheme, setActiveTheme] = useState<'theme-light-white' | 'theme-dark-green' | 'theme-dark-blue'>('theme-light-white');

  // Detect theme dynamically
  useEffect(() => {
    const detectTheme = () => {
      const root = document.documentElement;
      if (root.classList.contains('theme-light-white')) {
        setActiveTheme('theme-light-white');
      } else if (root.classList.contains('theme-dark-blue')) {
        setActiveTheme('theme-dark-blue');
      } else {
        setActiveTheme('theme-dark-green');
      }
    };
    
    detectTheme();
    
    // Watch for class attribute modifications on <html> element
    const observer = new MutationObserver(detectTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  // Decrypt and load Gemini API Key
  useEffect(() => {
    const savedConfig = localStorage.getItem('profit_os_ai_config_v2');
    if (savedConfig) {
      try {
        const bytes = CryptoJS.AES.decrypt(savedConfig, ENCRYPTION_SECRET);
        const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        if (decryptedData.geminiKey) {
          setGeminiApiKey(decryptedData.geminiKey);
        }
      } catch (e) {
        console.error("Failed to decrypt Gemini config in floating advisor:", e);
      }
    } else {
      const v1Config = localStorage.getItem('profit_os_ai_config');
      if (v1Config) {
        try {
          const bytes = CryptoJS.AES.decrypt(v1Config, ENCRYPTION_SECRET);
          const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
          if (decryptedData.apiKey) {
            setGeminiApiKey(decryptedData.apiKey);
          }
        } catch (e) {
          console.error("Failed to decrypt legacy AI config in floating advisor:", e);
        }
      }
    }
  }, []);

  // Load chat history
  useEffect(() => {
    const saved = localStorage.getItem('ecommil_ai_chat_history_simple');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved chat history:", e);
      }
    }
  }, []);

  // Save chat history
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('ecommil_ai_chat_history_simple', JSON.stringify(messages));
    }
  }, [messages]);

  // Handle initialization greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = `¡Hola! Soy tu Asesor Inteligente.\n\nEscribe tu pregunta sobre tus fletes, pedidos, márgenes de ganancia o rentabilidad en Guatemala.`;
      setMessages([{
        role: 'ai',
        content: greeting,
        id: 'greeting'
      }]);
    }
  }, [isOpen]);

  // Scroll to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleClearHistory = () => {
    localStorage.removeItem('ecommil_ai_chat_history_simple');
    const greeting = `Hola. He reiniciado la conversación. Cuéntame, ¿qué indicador o consulta de rentabilidad te gustaría analizar hoy?`;
    setMessages([{
      role: 'ai',
      content: greeting,
      id: 'greeting-' + Date.now()
    }]);
  };

  const handleQuerySend = async () => {
    if (!query.trim() || isLoading) return;

    const userMessageId = 'user-' + Date.now();
    const aiMessageId = 'ai-' + Date.now();
    const userQuery = query;

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userQuery, id: userMessageId }]);
    setQuery('');
    setIsLoading(true);
    setError(null);

    // Retrieve active API key
    const activeApiKey = geminiApiKey || process.env.GEMINI_API_KEY || '';

    if (!activeApiKey) {
      setError("Ingresa tu Gemini API Key en la pestaña 'Configuración' para habilitar tus consultas.");
      setIsLoading(false);
      return;
    }

    try {
      const pendingCount = orders.filter(o => o.status === 'Pendiente').length;
      const returnedCount = orders.filter(o => o.status === 'Devuelto').length;
      const deliveredCount = orders.filter(o => o.status === 'Entregado').length;
      const cancelledCount = orders.filter(o => o.status === 'Cancelado').length;

      const topProducts = Array.from(new Set(orders.map(o => o.product)))
        .map(p => {
          const prodOrders = orders.filter(o => o.product === p);
          const revenue = prodOrders.reduce((sum, o) => sum + (o.price || 0), 0);
          return `${p} (Pedidos: ${prodOrders.length}, Ingreso: ${formatCurrency(revenue)})`;
        }).slice(0, 4).join(', ');

      const contextDataPrompt = `
      Eres el Asesor Logístico y de Growth Hacking de ECOMMIL.
      Toda la operación, logística, fletes y datos del negocio están basados exclusivamente en GUATEMALA.
      Tienes acceso en tiempo real a los datos:
      
      DATOS GENERALES:
      - Ingresos: ${formatCurrency(stats.totalRevenue || 0)}
      - Ganancia Neta: ${formatCurrency(stats.totalNetProfit || 0)}
      - Margen Neto: ${(stats.margin || 0).toFixed(2)}%
      - ROAS: ${(stats.roas || 0).toFixed(2)}
      - ROI: ${(stats.roi || 0).toFixed(1)}%
      - Salud del Negocio: ${Math.round(stats.healthScore || 0)}/100

      PEDIDOS (${orders.length}):
      - Pendientes: ${pendingCount}
      - Devoluciones: ${returnedCount} (Tasa: ${(stats.returnRate || 0).toFixed(1)}%)
      - Entregados: ${deliveredCount}
      - Cancelados: ${cancelledCount}

      PUBLICIDAD:
      - Inversión total: ${formatCurrency(stats.totalAds || 0)}

      INSTRUCCIONES DE RESPUESTA:
      1. SÉ EXTREMADAMENTE BREVE y directo. Responde en un MÁXIMO DE 3 LÍNEAS.
      2. Da consejos contextualizados a Guatemala y directos al grano.
      3. Habla de forma muy sintetizada y ejecutiva.
      4. Toda tu respuesta debe de tener un tono profesional y directo.
      `;

      const mappedHistory = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const apiContents = [
        ...mappedHistory,
        {
          role: 'user',
          parts: [{ text: userQuery }]
        }
      ];

      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: apiContents,
        config: {
          systemInstruction: contextDataPrompt,
          temperature: 0.7,
        }
      });

      const responseText = response.text || "No obtuve respuesta del modelo.";
      setMessages(prev => [...prev, { role: 'ai', content: responseText, id: aiMessageId }]);
    } catch (err: any) {
      console.error("Gemini Error:", err);
      setError(`Error: ${err.message || err.toString()}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleQuerySend();
    }
  };

  const isLight = activeTheme === 'theme-light-white';

  return (
    <>
      {/* Highly Professional, Minimalist Floating Bubble */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          id="floating-ai-trigger"
          onClick={() => setIsOpen(!isOpen)}
          className={isLight 
            ? "w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 bg-white border-2 border-orange-500 text-orange-600 shadow-md shadow-orange-500/10 cursor-pointer" 
            : "w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 bg-[#0a0a0a] border border-white/10 text-primary hover:border-primary hover:text-white shadow-lg shadow-black/40 cursor-pointer"}
          title="Abrir Asesor IA"
        >
          {isOpen ? (
            <X size={22} />
          ) : (
            <Bot size={24} />
          )}
        </button>
      </div>

      {/* Beautiful Floating Window - No full-screen backdrop overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={isLight 
              ? "fixed bottom-24 right-6 w-96 max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-8rem)] bg-white border border-slate-200 flex flex-col shadow-2xl rounded-2xl z-50 overflow-hidden" 
              : "fixed bottom-24 right-6 w-96 max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-8rem)] bg-[#0e0e0e] border border-white/10 flex flex-col shadow-2xl rounded-2xl z-50 overflow-hidden"}
          >
            {/* Minimal Header */}
            <div className={isLight 
              ? "p-4 border-b border-slate-100 bg-white flex items-center justify-between" 
              : "p-4 border-b border-white/5 bg-[#141414] flex items-center justify-between"}>
              <div className="flex items-center gap-2">
                <Bot size={18} className={isLight ? "text-orange-500" : "text-primary animate-pulse"} />
                <span className={isLight ? "text-sm font-bold text-slate-800 tracking-tight" : "text-sm font-bold text-slate-200 tracking-tight"}>Asesor IA</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Clear History Button */}
                <button
                  onClick={handleClearHistory}
                  className={isLight 
                    ? "p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer" 
                    : "p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"}
                  title="Limpiar chat"
                >
                  <Trash2 size={14} />
                </button>

                {/* Close button */}
                <button 
                  onClick={() => setIsOpen(false)}
                  className={isLight 
                    ? "p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer" 
                    : "p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Chat Thread - WhatsApp Style Beige Background */}
            <div className={isLight 
              ? "flex-1 overflow-y-auto p-4 space-y-3 bg-[#efeae2]" 
              : "flex-1 overflow-y-auto p-4 space-y-3 bg-[#080808]"}>
              <AnimatePresence initial={false}>
                {messages.map((item) => (
                  <div
                    key={item.id}
                    className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`p-2.5 px-3.5 rounded-lg text-[13px] leading-relaxed max-w-[85%] shadow-[0_1px_0.5px_rgba(0,0,0,0.12)] floating-ai-body ${
                      item.role === 'user'
                        ? (isLight ? 'bg-[#ffe8d6] text-slate-900 rounded-tr-none' : 'bg-[#005c4b] text-white rounded-tr-none border border-emerald-950/30')
                        : (isLight ? 'bg-white text-slate-900 rounded-tl-none' : 'bg-[#202c33] text-slate-200 rounded-tl-none border border-white/5')
                    }`}>
                      {item.role === 'ai' ? (
                        <div className={`prose max-w-none text-[13px] font-normal markdown-body ${isLight ? 'text-slate-950' : 'text-slate-100'}`}>
                          <Markdown>{item.content}</Markdown>
                        </div>
                      ) : (
                        <p className={`font-normal m-0 ${isLight ? 'text-slate-950' : 'text-white'}`}>{item.content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <div className="flex justify-start">
                  <div className={isLight 
                    ? "bg-white p-2.5 px-3.5 rounded-lg rounded-tl-none max-w-[85%] flex items-center shadow-[0_1px_0.5px_rgba(0,0,0,0.12)]" 
                    : "bg-[#202c33] p-2.5 px-3.5 rounded-lg rounded-tl-none max-w-[85%] flex items-center border border-white/5"}>
                    <span className={isLight 
                      ? "flex items-center gap-1.5 text-xs text-slate-500" 
                      : "flex items-center gap-1.5 text-xs text-slate-400"}>
                      <Loader2 size={12} className={isLight ? "animate-spin text-slate-500" : "animate-spin text-primary"} />
                      Escribiendo...
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className={isLight 
                  ? "p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs" 
                  : "p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs"}>
                  <p className="font-medium">{error}</p>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Area - WhatsApp style input bar */}
            <div className={isLight 
              ? "p-3 bg-[#f0f2f5] border-t border-slate-200 flex items-center gap-2" 
              : "p-3 bg-[#1f2c34] border-t border-white/5 flex items-center gap-2"}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
                placeholder="Escribe tu mensaje aquí..."
                className={isLight 
                  ? "flex-1 bg-white border border-slate-200 rounded-full py-2.5 px-4 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 shadow-sm transition-all" 
                  : "flex-1 bg-[#2a3942] border border-transparent rounded-full py-2.5 px-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-inner transition-all"}
              />

              <button
                onClick={handleQuerySend}
                disabled={isLoading || !query.trim()}
                className={isLight 
                  ? "p-2.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-full transition-all disabled:opacity-30 disabled:hover:scale-100 cursor-pointer flex items-center justify-center shadow-sm shrink-0" 
                  : "p-2.5 bg-primary hover:bg-primary/95 active:scale-95 text-black rounded-full transition-all disabled:opacity-30 disabled:hover:scale-100 cursor-pointer flex items-center justify-center shadow-md shadow-primary/10 shrink-0"}
              >
                <Send size={14} className={isLight ? "text-white" : "text-black"} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingAIAssistant;
