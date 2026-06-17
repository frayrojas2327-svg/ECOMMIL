import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  Loader2, 
  X, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  Truck, 
  Activity, 
  Info,
  Maximize2,
  Minimize2,
  StopCircle,
  HelpCircle,
  Trash2,
  RotateCcw
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
}

// Ensure TypeScript knows Web Speech API
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const FloatingAIAssistant: React.FC<FloatingAIAssistantProps> = ({
  orders,
  stats,
  periods = [],
  formatCurrency,
  currency = 'USD',
  currencies = {},
  isConversionActive = false,
  activeTab
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string; id: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Voice Synthesis States
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null); // messageId being spoken
  const [autoSpeak, setAutoSpeak] = useState(false);
  
  // Voice Recognition (Dictado) States
  const [isRecording, setIsRecording] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [isRecognitionSupported, setIsRecognitionSupported] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const speechUttRef = useRef<any>(null);

  // AI Config Load and Decrypt
  const [geminiApiKey, setGeminiApiKey] = useState('');

  useEffect(() => {
    // Check Speech Recognition support inside useEffect to prevent SSR/hydration issues
    setIsRecognitionSupported(!!SpeechRecognition);
    
    // Quick load and decrypt Gemini key
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

  // Initialize Speech Recognition
  useEffect(() => {
    if (!SpeechRecognition) return;

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'es-ES';

      rec.onstart = () => {
        setIsRecording(true);
        setRecognitionError(null);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setQuery(prev => prev ? `${prev} ${transcript}` : transcript);
        }
      };

      rec.onerror = (event: any) => {
        console.error('Speech Recognition Error:', event.error);
        if (event.error === 'not-allowed') {
          setRecognitionError('Acceso al micrófono denegado. Permite el micrófono en tu navegador.');
        } else {
          setRecognitionError(`Error: ${event.error}`);
        }
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    } catch (err) {
      console.error('Failed to initialize speech recognition:', err);
    }
    
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [isRecognitionSupported]);

  // Load saved chat history on first mount
  useEffect(() => {
    const saved = localStorage.getItem('ecommil_ai_chat_history');
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

  // Auto-save chat history to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('ecommil_ai_chat_history', JSON.stringify(messages));
    }
  }, [messages]);

  const handleClearHistory = () => {
    stopSpeakingGlobal();
    localStorage.removeItem('ecommil_ai_chat_history');
    const greeting = `¡Hola de nuevo! He reiniciado la memoria del chat del **Asesor Logístico**. Analizando tu reporte actual de **${getTabFriendlyName(activeTab)}**.\n\n¿En qué indicador te gustaría enfocarte ahora?`;
    setMessages([{
      role: 'ai',
      content: greeting,
      id: 'greeting-' + Date.now()
    }]);
  };

  // Init greeting with short delay if first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = `¡Hola! Soy el **Asesor Logístico de ECOMMIL**. He analizado en tiempo real todos los datos de tu negocio en esta pestaña de **${getTabFriendlyName(activeTab)}**.\n\n¿Quieres que hagamos un diagnóstico rápido de tu ROI, fletes o una optimización de devoluciones? ¡Puedes incluso hablarme usando tu micrófono!`;
      setMessages([{
        role: 'ai',
        content: greeting,
        id: 'greeting'
      }]);
      
      if (autoSpeak) {
        speakText(greeting, 'greeting');
      }
    }
  }, [isOpen]);

  // Scroll to bottom when messages list updates
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const getTabFriendlyName = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Panel de Control General';
      case 'kpis': return 'Análisis Financiero Pro';
      case 'logistics-ai': return 'Asesor Logístico Completo';
      case 'orders': return 'Plataforma DROPI';
      case 'shopify': return 'INTEGRACIÓN SHOPIFY';
      case 'consiliador-pro': return 'ANÁLISIS TIKTOK PANEL';
      case 'calculator': return 'Calculadora de Rentabilidad';
      case 'returns': return 'Control de Devoluciones';
      case 'shipping': return 'Análisis de Fletes';
      case 'financial': return 'Resumen P&L Total';
      case 'ads': return 'Gastos de Publicidad detallados';
      case 'platform-expenses': return 'Plataforma y Shopify Fee';
      case 'settings': return 'Configuración de Sistema';
      default: return tab;
    }
  };

  // Capture Audio Speech Recognition Toggler
  const toggleRecording = () => {
    if (!isRecognitionSupported) {
      setRecognitionError('La entrada de voz no es compatible con este navegador.');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error('Error starting recognition:', e);
      }
    }
  };

  // Speak out text (Text to Speech) using native Web Speech Synthesis
  const speakText = (text: string, messageId: string) => {
    if (!window.speechSynthesis) return;

    // If already speaking this message, stop it
    if (isSpeaking === messageId) {
      window.speechSynthesis.cancel();
      setIsSpeaking(null);
      return;
    }

    // Cancel anything active
    window.speechSynthesis.cancel();

    // Clean markdown symbols to make reading pleasant
    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#+\s+([^\n]+)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .slice(0, 1000); // safety length limit

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-ES';

    // Find a beautiful Spanish voice
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(v => 
      v.lang.startsWith('es') && 
      (v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('natural'))
    ) || voices.find(v => v.lang.startsWith('es'));

    if (esVoice) {
      utterance.voice = esVoice;
    }

    utterance.rate = 1.05; // slightly faster and energetic
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(messageId);
    };

    utterance.onend = () => {
      setIsSpeaking(null);
    };

    utterance.onerror = () => {
      setIsSpeaking(null);
    };

    speechUttRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeakingGlobal = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(null);
  };

  // Generate response from Gemini API
  const handleQuerySend = async (customQuery?: string) => {
    const rawVal = customQuery || query;
    if (!rawVal.trim() || isLoading) return;

    stopSpeakingGlobal();

    const userMessageId = 'user-' + Date.now();
    const aiMessageId = 'ai-' + Date.now();

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: rawVal, id: userMessageId }]);
    setQuery('');
    setIsLoading(true);
    setError(null);

    // Retrieve active API key
    const activeApiKey = geminiApiKey || process.env.GEMINI_API_KEY || '';

    if (!activeApiKey) {
      setError("Por favor, ingresa una Gemini API Key en la pestaña 'Asesor IA > Configuración' para habilitar las consultas expertas.");
      setIsLoading(false);
      return;
    }

    try {
      // 1. Prepare incredibly comprehensive system context about ALL APP DATA
      const pendingCount = orders.filter(o => o.status === 'Pendiente').length;
      const returnedCount = orders.filter(o => o.status === 'Devuelto').length;
      const deliveredCount = orders.filter(o => o.status === 'Entregado').length;
      const cancelledCount = orders.filter(o => o.status === 'Cancelado').length;

      // Extract details about advertising channels if available
      const lastMonthAds = periods.length > 0 ? periods[0] : null;

      const topProducts = Array.from(new Set(orders.map(o => o.product)))
        .map(p => {
          const prodOrders = orders.filter(o => o.product === p);
          const revenue = prodOrders.reduce((sum, o) => sum + (o.price || 0), 0);
          return `${p} (Pedidos: ${prodOrders.length}, Ingreso: ${formatCurrency(revenue)})`;
        }).slice(0, 4).join(', ');

      const countries = Array.from(new Set(orders.map(o => o.country))).join(', ');

      const contextDataPrompt = `
      Eres el Asesor Logístico y de Growth Hacking de ECOMMIL (Nivel Elite).
      Toda la operación, logística, fletes, pedidos y datos del negocio están basados exclusivamente en GUATEMALA (fletes locales en Quetzales/moneda local si corresponde, envíos locales, proveedores y transportadoras locales en Guatemala). Ten esto siempre en cuenta para dar tus consejos contextualizados al mercado guatemalteco.
      Tienes acceso completo en tiempo real a TODO el sistema de datos del usuario, resumido a continuación:
      
      ESTADO GLOBAL DEL NEGOCIO (Resumido):
      - Ingresos Totales: ${formatCurrency(stats.totalRevenue || 0)}
      - Ganancia Neta: ${formatCurrency(stats.totalNetProfit || 0)}
      - Margen Neto: ${(stats.margin || 0).toFixed(2)}%
      - ROAS Promedio: ${(stats.roas || 0).toFixed(2)}
      - ROI General: ${(stats.roi || 0).toFixed(1)}%
      - Salud General del Negocio (Health Score): ${Math.round(stats.healthScore || 0)}/100
      - Conversión Activa: ${isConversionActive ? 'Sí' : 'No'} (Moneda configurada: ${currency})

      ESTRUCTURA DE PEDIDOS (Total: ${orders.length}):
      - Pedidos Pendientes: ${pendingCount}
      - Devoluciones: ${returnedCount} (Tasa: ${(stats.returnRate || 0).toFixed(1)}%)
      - Entregados: ${deliveredCount}
      - Cancelados: ${cancelledCount}
      - Top Productos Vendidos: ${topProducts || 'Ninguno cargado'}
      - Países de Operación: Guatemala (todos los pedidos son de Guatemala)

      GENTLENESS / CONEXIÓN DE ADS & RETIRO (Sale Periods):
      - Inversión total de publicidad: ${formatCurrency(stats.totalAds || 0)}
      - Periodos de Retiros y Facturaciones Históricas: ${periods.length} períodos registrados.
      ${periods.length > 0 ? `Detalle último mes registrado (${periods[0].month}): Retiros Dropi de ${formatCurrency(periods[0].withdrawalDropi)}, comisiones de ${formatCurrency(periods[0].commission)}, recibido en banco de ${formatCurrency(periods[0].withdrawalBank)}, inversión en Facebook de ${formatCurrency(periods[0].fbAdsSpend || 0)}, TikTok de ${formatCurrency(periods[0].tiktokAdsSpend || 0)}, Google de ${formatCurrency(periods[0].googleAdsSpend || 0)}. Profit Neto de este mes: ${formatCurrency(periods[0].withdrawalBank - periods[0].adsSpend - periods[0].platformExpenses)}` : ''}

      ESTADO DE VISUALIZACIÓN ACTUAL:
      El usuario se encuentra visualizando la pestaña: **${getTabFriendlyName(activeTab)}** (ID: ${activeTab}).

      INSTRUCCIONES DE RESPUESTA (CRÍTICAS):
      1. LIMITACIÓN DE ESPACIO: Responde obligatoriamente en un MÁXIMO DE 3 LÍNEAS físicas en total. Ve directo al grano con lo más importante y crítico del análisis.
      2. No inventes datos ficticios. Bájate 100% en el contexto de Guatemala y de los datos numéricos provistos de ECOMMIL.
      3. Sé sumamente relevante, ejecutivo y sintético. Elimina preámbulos o formalidades largas.
      4. Responde con tono analítico y profesional. Háblale en español. Usa Markdown simple.
      `;

      // Build previous messages list to pass as multi-turn history content (role user vs model)
      const mappedHistory = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      // Append user's raw input query to complete the array
      const apiContents = [
        ...mappedHistory,
        {
          role: 'user',
          parts: [{ text: rawVal }]
        }
      ];

      // Use modern Gemini 3.5 Flash Model
      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: apiContents,
        config: {
          systemInstruction: contextDataPrompt,
          temperature: 0.75,
        }
      });

      const responseText = response.text || "Disculpa, obtuve una respuesta vacía del modelo Gemini.";
      
      // Add AI response to the chat
      setMessages(prev => [...prev, { role: 'ai', content: responseText, id: aiMessageId }]);
      
      // Auto speech output if checkmark is active
      if (autoSpeak) {
        setTimeout(() => {
          speakText(responseText, aiMessageId);
        }, 150);
      }
    } catch (err: any) {
      console.error("Gemini Error:", err);
      setError(`Ocurrió un error al contactar al asesor IA: ${err.message || err.toString()}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleQuerySend();
    }
  };

  const chooseQuickSuggestion = (sug: string) => {
    handleQuerySend(sug);
  };

  return (
    <>
      {/* Floating Animated Button */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {/* Simple hover notification banner */}
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 20 }}
              className="hidden md:flex flex-col items-end pointer-events-none"
            >
              <div className="bg-zinc-950/90 border border-neon/30 text-white rounded-xl px-4 py-2 text-xs font-sans tracking-wide pr-8 relative shadow-lg shadow-neon/10 backdrop-blur-md">
                <span className="flex items-center gap-1.5 text-neon font-black uppercase tracking-widest text-[10px] mb-0.5">
                  <Sparkles size={11} className="animate-spin-slow" /> ASESOR IA ACTIVO
                </span>
                <span className="text-slate-400 font-medium">¿Fletes altos? ¿Tasa de retorno? Consulta aquí por voz</span>
                <div className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-neon animate-ping" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The Pulsating Core Bubble Trigger */}
        <button
          id="floating-ai-trigger"
          onClick={() => setIsOpen(!isOpen)}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 text-white ${
            isOpen 
              ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
              : 'bg-gradient-to-tr from-neon via-[#1877F2] to-gold hover:opacity-90 shadow-neon/40'
          }`}
          title="Abrir Asesor de Inteligencia Artificial"
        >
          {/* Audio frequency wave circles around the trigger while AI is speaking */}
          {isSpeaking && (
            <div className="absolute inset-0 rounded-full border-2 border-neon animate-ping opacity-60" />
          )}
          {!isOpen && (
            <div className="absolute inset-0 rounded-full bg-neon/20 blur-md animate-pulse -z-10" />
          )}

          {isOpen ? (
            <X size={24} className="animate-transform duration-200" />
          ) : (
            <div className="relative">
              <Bot size={26} className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-gold border border-black rounded-full animate-pulse" />
            </div>
          )}
        </button>
      </div>

      {/* Slide-out Overlay Drawer */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs flex justify-end">
            {/* Click outside backdrop to close */}
            <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

            <motion.div
              initial={{ x: '100%', opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.9 }}
              transition={{ type: 'spring', damping: 24, stiffness: 150 }}
              className="relative w-full max-w-lg h-full bg-slate-950/95 border-l border-white/10 flex flex-col shadow-2xl backdrop-blur-lg"
            >
              {/* Esquina Superior Derecha Close Button */}
              <button 
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 z-50 p-2.5 rounded-xl bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 border border-white/10 hover:border-red-500/20 transition-all hover:rotate-90 duration-200 cursor-pointer shadow-lg"
                title="Cerrar Chat"
              >
                <X size={18} />
              </button>

              {/* Drawer Header */}
              <div className="p-4 pr-16 border-b border-white/5 bg-zinc-950/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-xl bg-neon/10 flex items-center justify-center border border-neon/30">
                    <div className="absolute inset-0 bg-neon/10 blur-xs rounded-xl" />
                    <Bot className="text-neon relative" size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-display font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      Asesor Ecommil IA <span className="text-[9px] bg-neon/15 text-neon px-1.5 py-0.5 rounded uppercase font-mono tracking-widest font-black">Voice 2.5</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">Conectado a todos tus reportes de fletes y ROI</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* TTS global speed mute or stop */}
                  {isSpeaking && (
                    <button 
                      onClick={stopSpeakingGlobal}
                      className="p-1 px-2.5 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-mono tracking-wider font-bold flex items-center gap-1 animate-pulse hover:bg-red-500/30 transition-colors"
                      title="Detener lectura"
                    >
                      <StopCircle size={10} /> DETENER VOZ
                    </button>
                  )}

                  {/* Clean History Button */}
                  <button
                    onClick={handleClearHistory}
                    className="p-1 px-2.5 rounded-lg bg-zinc-900 border border-white/5 hover:border-red-500/20 text-slate-400 hover:text-red-400 text-xs font-mono tracking-wide flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Limpiar historial de conversación y reiniciar memoria del asesor"
                  >
                    <Trash2 size={11} />
                    <span>LIMPIAR</span>
                  </button>

                  {/* Auto-Speak Checkbox Option */}
                  <label 
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs font-mono cursor-pointer transition-colors ${
                      autoSpeak 
                        ? 'bg-neon/15 border-neon/30 text-neon' 
                        : 'bg-zinc-900 border-white/5 text-slate-400 hover:text-white'
                    }`}
                    title="Vocalizar automáticamente respuestas generadas"
                  >
                    <input 
                      type="checkbox"
                      checked={autoSpeak}
                      onChange={(e) => setAutoSpeak(e.target.checked)}
                      className="sr-only"
                    />
                    <Volume2 size={12} className={autoSpeak ? 'animate-bounce' : ''} />
                    <span>AUTO-LECTURA</span>
                  </label>
                </div>
              </div>

              {/* Status / Active Info strip */}
              <div className="px-4 py-2 bg-gradient-to-r from-neon/10 via-zinc-950 to-gold/10 border-b border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <Activity size={11} className="text-neon" />
                  Health Score: <span className="text-neon font-bold">{Math.round(stats.healthScore || 0)}%</span>
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded">
                  Pestaña: {getTabFriendlyName(activeTab)}
                </span>
                <span>
                  Neto: <span className={stats.totalNetProfit >= 0 ? "text-neon font-bold" : "text-red-400 font-bold"}>{formatCurrency(stats.totalNetProfit || 0)}</span>
                </span>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center p-6 text-center">
                    <div className="space-y-4 max-w-sm">
                      <div className="w-12 h-12 rounded-full bg-neon/10 flex items-center justify-center mx-auto text-neon border border-neon/20 animate-pulse">
                        <Sparkles size={24} />
                      </div>
                      <h4 className="text-white font-display font-bold uppercase tracking-wider text-sm">ECOMMIL Inteligencia Avanzada</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Análisis flash de rentabilidad basado en tus pedidos, fletes, comisiones de Dropi e inversión publicitaria.
                      </p>
                    </div>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-3 ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {item.role === 'ai' && (
                          <div className="w-8 h-8 rounded-lg bg-neon/10 border border-neon/20 flex items-center justify-center text-neon flex-shrink-0">
                            <Bot size={15} />
                          </div>
                        )}

                        <div className="flex flex-col space-y-1 max-w-[85%]">
                          <div className={`p-3 rounded-2xl relative group ${
                            item.role === 'user'
                              ? 'bg-gradient-to-tr from-[#1877F2]/80 to-neon/80 text-white rounded-tr-none'
                              : 'bg-zinc-900 border border-white/5 text-slate-200 rounded-tl-none'
                          }`}>
                            {item.role === 'ai' ? (
                              <div className="markdown-body prose prose-invert text-xs leading-relaxed max-w-none">
                                <Markdown>{item.content}</Markdown>
                              </div>
                            ) : (
                              <p className="text-xs">{item.content}</p>
                            )}

                            {/* Voice Speak button inside AI Chat Box bubble */}
                            {item.role === 'ai' && (
                              <div className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-zinc-950 border border-white/10 rounded-md p-1 px-1.5 flex items-center gap-1 text-[9px] font-mono font-bold text-slate-300 hover:text-neon cursor-pointer shadow-lg z-10"
                                onClick={() => speakText(item.content, item.id)}
                              >
                                {isSpeaking === item.id ? (
                                  <>
                                    {/* Small audio wave visualization */}
                                    <span className="flex items-center gap-0.5 pointer-events-none text-neon">
                                      <span className="w-0.5 h-1.5 bg-neon rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                      <span className="w-0.5 h-2.5 bg-neon rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                                      <span className="w-0.5 h-1.5 bg-neon rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
                                    </span>
                                    <span>DETENER</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 size={10} className="text-neon" />
                                    <span>ESCUCHAR</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-500 font-mono tracking-tight self-start px-1 uppercase">
                            {item.role === 'user' ? 'Tú' : 'Asesor de Ecommil'}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}

                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-lg bg-neon/10 border border-neon/20 flex items-center justify-center text-neon flex-shrink-0 animate-pulse">
                      <Loader2 size={15} className="animate-spin" />
                    </div>
                    <div className="bg-zinc-900 border border-white/5 p-3 rounded-2xl rounded-tl-none max-w-[85%] flex items-center gap-2">
                      <span className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="w-1 h-3 bg-neon rounded-full animate-pulse" />
                        Pensando & analizando tus fletes y ROI...
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-start gap-2">
                    <Info size={14} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-bold">Error de Configuración</p>
                      <p className="opacity-90">{error}</p>
                    </div>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>

              {/* Quick Knowledge Actions Panel */}
              <div className="px-4 py-2 border-t border-white/5 bg-zinc-950/40 space-y-1.5">
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider font-bold">Consultas Rápidas de un Clic:</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  <button
                    onClick={() => chooseQuickSuggestion("Actúa como un experto en logística de Shopify & Dropi: analizando mis pedidos totales, pedidos pendientes, entregados, tasa de devoluciones y fletes de Dropi. Dame un diagnóstico logístico específico y soluciones para optimizar mis despachos.")}
                    className="p-1.5 px-2 bg-gradient-to-r from-neon/5 to-white/5 border border-white/5 hover:border-neon/30 text-slate-300 hover:text-neon rounded-lg text-[10px] font-mono text-left transition-all flex flex-col justify-between h-full group"
                  >
                    <span className="font-bold text-white group-hover:text-neon">📦 Logística Shopify-Dropi</span>
                    <span className="text-[8px] text-slate-500 mt-0.5 whitespace-normal">Ver fletes, pedidos, entregados y dejas</span>
                  </button>
                  <button
                    onClick={() => chooseQuickSuggestion("Actúa como un analista experto de publicidad digital: analiza mi inversión en publicidad de Facebook, Instagram, Google y TikTok Ads junto con el rendimiento del ROAS y ROI actual. Explícame si estoy optimizando mi presupuesto o quemando dinero.")}
                    className="p-1.5 px-2 bg-gradient-to-r from-blue-500/5 to-white/5 border border-white/5 hover:border-[#1877F2]/35 text-slate-300 hover:text-sky-400 rounded-lg text-[10px] font-mono text-left transition-all flex flex-col justify-between h-full group"
                  >
                    <span className="font-bold text-white group-hover:text-sky-400">📊 Análisis Publicidad IA</span>
                    <span className="text-[8px] text-slate-500 mt-0.5 whitespace-normal">Revisar inversión de Facebook, TikTok, Google y ROAS</span>
                  </button>
                  <button
                    onClick={() => chooseQuickSuggestion("Actúa como un consultor financiero premium: revisa en detalle todos mis gastos de la sección de plataformas (Shopify Fee, Apps, pasarelas de pago) más los costos mensuales totales. Calcula mi punto de equilibrio y el impacto en el margen neto de ganancia.")}
                    className="p-1.5 px-2 bg-gradient-to-r from-gold/5 to-white/5 border border-white/5 hover:border-gold/30 text-slate-300 hover:text-gold rounded-lg text-[10px] font-mono text-left transition-all flex flex-col justify-between h-full group"
                  >
                    <span className="font-bold text-white group-hover:text-gold">💰 Gastos & Plataformas</span>
                    <span className="text-[8px] text-slate-500 mt-0.5 whitespace-normal">Evaluar Shopify fees, herramientas de sistema y costos</span>
                  </button>
                </div>
              </div>

              {/* Chat Input Area */}
              <div className="p-4 border-t border-white/5 bg-zinc-950/80 space-y-2">
                {recognitionError && (
                  <div className="text-[10px] text-red-400 font-mono flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded">
                    <Info size={10} />
                    {recognitionError}
                  </div>
                )}

                <div className="relative flex items-center gap-2">
                  {/* Micro Dictado por Voz Toggler */}
                  <button
                    onClick={toggleRecording}
                    className={`p-3 rounded-xl border flex items-center justify-center transition-all flex-shrink-0 ${
                      isRecording
                        ? 'bg-red-500 border-red-500 text-white animate-pulse'
                        : 'bg-zinc-800 border-white/10 text-slate-300 hover:text-neon hover:border-neon'
                    }`}
                    title={isRecording ? 'Detener dictado por voz (escuchando)' : 'Hablarle al asesor (dictado por voz)'}
                  >
                    {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>

                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyPress}
                      disabled={isLoading}
                      placeholder={isRecording ? "Escuchando tu voz..." : "Pregúntale al asesor logístico..."}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 pl-4 pr-10 text-xs text-white focus:outline-none focus:border-neon transition-all"
                    />

                    <button
                      onClick={() => handleQuerySend()}
                      disabled={isLoading || !query.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-neon text-background rounded-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-30 disabled:hover:scale-100 cursor-pointer"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <HelpCircle size={10} />
                    Soporte de consultas en español 
                  </span>
                  {isRecording && (
                    <span className="text-neon animate-pulse flex items-center gap-1 font-bold">
                      ● GRABANDO VOZ... Habla ahora
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingAIAssistant;
