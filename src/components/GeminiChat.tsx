import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Loader2, 
  Trash2, 
  Sparkles, 
  Copy, 
  Check, 
  Volume2, 
  Download, 
  Settings2, 
  RefreshCw, 
  ShieldCheck, 
  BrainCircuit, 
  Zap, 
  Gauge, 
  TrendingUp, 
  Truck, 
  DollarSign, 
  Layers, 
  HelpCircle,
  BarChart3,
  Sliders
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Order, CurrencyCode } from '../mockData';
import { getClientAIConfig, getClientGeminiApiKeys, cleanAiErrorMessage } from '../services/aiConfigService';

export interface ChatRole {
  id: string;
  name: string;
  badge: string;
  icon: any;
  color: string;
  description: string;
  systemInstruction: string;
  suggestedPrompts: string[];
}

export const CHAT_ROLES: ChatRole[] = [
  {
    id: 'dropi-ecommerce',
    name: 'Estratega E-commerce & Dropi',
    badge: 'Dropi & COD',
    icon: ShoppingBagIcon,
    color: 'emerald',
    description: 'Especialista en ventas contra entrega, márgenes netos, combos y reducción de cancelaciones.',
    systemInstruction: `Eres un Estratega Senior de E-commerce y Dropi especializado en venta contra entrega (Cash-On-Delivery / COD) para Latinoamérica. Tu objetivo es asesorar con respuestas prácticas, números y tácticas reales para maximizar el margen de utilidad neta, optimizar la tasa de entrega efectiva, crear ofertas ganadoras (bundles 2x1) y mitigar el impacto de devoluciones y fletes perdidos. Tus explicaciones son directas, accionables y estructuradas con viñetas claras.`,
    suggestedPrompts: [
      '¿Cómo puedo reducir la tasa de devoluciones en Dropi esta semana?',
      'Estrategia de ofertas 2x1 para aumentar mi ticket promedio sin sacrificar margen.',
      'Analiza mis métricas actuales y dime en qué punto estoy perdiendo dinero.',
      'Guión de WhatsApp para confirmar pedidos COD antes de despacharlos.'
    ]
  },
  {
    id: 'logistics-specialist',
    name: 'Especialista Logístico & Envíos',
    badge: 'Logística',
    icon: Truck,
    color: 'blue',
    description: 'Experto en semáforos de transportadoras, tiempos de ruta y resolución de novedades.',
    systemInstruction: `Eres un Director de Logística y Operaciones para e-commerce. Tu especialidad es la auditoría de transportadoras (tiempos de entrega, efectividad de entrega por departamento o ciudad, costos de fletes de retorno), semáforos de envíos y gestión preventiva de novedades antes de que el cliente rechace el paquete. Siempre sugiere protocolos concretos para contactar destinatarios y rescatar envíos en tránsito.`,
    suggestedPrompts: [
      'Protocolo para rescatar pedidos con novedad de "Cliente no responde".',
      '¿Qué transportadora es más eficiente según los tiempos de entrega en ruta?',
      '¿Cómo negociar o auditar el costo de flete de devolución con la transportadora?',
      'Crear un semáforo de alerta temprana para pedidos con más de 3 días en tránsito.'
    ]
  },
  {
    id: 'ads-media-buyer',
    name: 'Estratega de Ads & ROAS',
    badge: 'Meta & TikTok Ads',
    icon: TrendingUp,
    color: 'purple',
    description: 'Auditoría de campañas de tráfico y conversión, CPA, creativos ganadores y escalado.',
    systemInstruction: `Eres un Media Buyer y Estratega de Performance Marketing especializado en Meta Ads y TikTok Ads para e-commerce contra entrega. Analizas métricas clave: CPA (Costo por Adquisición), CTR (Click-Through Rate), CPM y ROAS. Proporcionas fórmulas para calcular tu CPA Máximo Permitido considerando devoluciones, y recomiendas estructuras de anuncios y ganchos (hooks) de 3 segundos para creativos de video 9:16.`,
    suggestedPrompts: [
      '¿Cuál es mi CPA máximo rentable considerando mi tasa de devolución actual?',
      'Estructura de campaña en Meta Ads (CBO vs ABO) para probar 5 creativos nuevos.',
      'Redacta 3 ganchos irresistibles para un video publicitario de TikTok Ads.',
      '¿Qué hacer cuando un anuncio ganador empieza a subir de costo por compra?'
    ]
  },
  {
    id: 'cfo-finance',
    name: 'Director Financiero (CFO)',
    badge: 'Finanzas & P&L',
    icon: DollarSign,
    color: 'amber',
    description: 'Análisis estricto de P&L, márgenes de contribución, punto de equilibrio y rentabilidad real.',
    systemInstruction: `Eres el Director Financiero (CFO) de una marca de comercio electrónico. Eres analítico, riguroso y transparente con los números: no te dejas deslumbrar por la facturación bruta; te enfocas exclusivamente en el Margen de Contribución Real, la absorción de costos fijos, el costo de mercancía (COGS) y el flujo de caja. Formulas proyecciones financieras claras y planes de mitigación de pérdidas.`,
    suggestedPrompts: [
      'Calcula mi punto de equilibrio (Break-even) y margen neto real.',
      '¿Cuánto dinero pierdo por cada pedido devuelto y cómo lo compenso?',
      'Audita mi estructura de costos: producto, flete, comisiones y pauta publicitaria.',
      'Plan financiero para reinvertir utilidades en inventario de alta rotación.'
    ]
  },
  {
    id: 'general-copilot',
    name: 'Copiloto Ejecutivo Multi-Propósito',
    badge: 'IA Ejecutiva',
    icon: BrainCircuit,
    color: 'emerald',
    description: 'Asistente de alta velocidad para redacción, análisis de datos y resolución de dudas operativas.',
    systemInstruction: `Eres un Asistente Ejecutivo de Inteligencia Artificial altamente capacitado, veloz y conciso. Ayudas a empresarios y equipos de comercio electrónico con redacción de correos, síntesis ejecutivas, análisis de datos tabulares, cálculos rápidos y resolución de dudas comerciales de forma ágil y profesional.`,
    suggestedPrompts: [
      'Haz un resumen ejecutivo de las 3 prioridades del negocio para hoy.',
      'Redacta un correo profesional para solicitar crédito con un proveedor mayorista.',
      '¿Cuáles son las mejores prácticas para fidelizar clientes que ya compraron contra entrega?',
      'Explícame cómo funciona la conciliación de cartera en Dropi de manera sencilla.'
    ]
  },
  {
    id: 'custom-role',
    name: 'Rol Personalizado',
    badge: 'Personalizado',
    icon: Sliders,
    color: 'cyan',
    description: 'Define tu propia instrucción de sistema (System Instruction) para adaptar a Gemini exactamente a tu necesidad.',
    systemInstruction: `Eres un asistente de inteligencia artificial personalizado configurado según las instrucciones del usuario. Responde de manera profesional y detallada.`,
    suggestedPrompts: [
      'Ayúdame con mis tareas operativas de hoy.',
      'Revisa el estado de mi negocio según los datos.',
      'Bríndame sugerencias de mejora continua.'
    ]
  }
];

function ShoppingBagIcon(props: any) {
  return <Layers {...props} />;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  model?: string;
  latencyMs?: number;
}

interface GeminiChatProps {
  orders: Order[];
  stats?: any;
  formatCurrency: (amount: number) => string;
  currency?: CurrencyCode;
  theme?: string;
}

export const GeminiChat: React.FC<GeminiChatProps> = ({
  orders,
  stats,
  formatCurrency,
  currency = 'USD',
  theme = 'theme-light-white'
}) => {
  // Available models strictly conforming to user instructions:
  // - gemini-3.1-pro-preview: For particularly complex tasks and deep reasoning
  // - gemini-3.5-flash: For general tasks and optimal balance
  // - gemini-3.1-flash-lite: For tasks that should happen fast
  // - gemini-3.8-flash: Recommended standard high-speed & high-intelligence model
  const MODEL_OPTIONS = [
    {
      id: 'gemini-3.8-flash',
      label: 'Gemini 3.8 Flash (Recomendado)',
      badge: 'Recomendado',
      desc: 'Máxima velocidad con razonamiento multimodal de última generación.',
      category: 'general'
    },
    {
      id: 'gemini-3.5-flash',
      label: 'Gemini 3.5 Flash',
      badge: 'Tareas Generales',
      desc: 'Balance óptimo para redacción, análisis de datos y consultas estándar.',
      category: 'general'
    },
    {
      id: 'gemini-3.1-pro-preview',
      label: 'Gemini 3.1 Pro Preview',
      badge: 'Tareas Complejas',
      desc: 'Razonamiento profundo, auditorías financieras y estrategias multivariables.',
      category: 'complex'
    },
    {
      id: 'gemini-3.1-flash-lite',
      label: 'Gemini 3.1 Flash Lite',
      badge: 'Ultra Rápido',
      desc: 'Baja latencia y respuestas casi instantáneas para tareas ágiles.',
      category: 'fast'
    }
  ];

  const [selectedRole, setSelectedRole] = useState<ChatRole>(CHAT_ROLES[0]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [customSystemInstruction, setCustomSystemInstruction] = useState<string>(
    CHAT_ROLES[5].systemInstruction
  );
  const [includeDataContext, setIncludeDataContext] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRoleConfig, setShowRoleConfig] = useState<boolean>(false);

  // Multi-turn conversation state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('ecommil_gemini_multiturn_chat_history_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error loading chat history:', e);
    }
    return [
      {
        id: 'msg-welcome',
        role: 'model',
        content: `¡Hola! Soy tu **${CHAT_ROLES[0].name}** impulsado por **Google Gemini**.

Estoy listo para auditar tus pedidos, optimizar tus márgenes de ganancia, estructurar campañas publicitarias o resolver incidencias operativas.

Selecciona un rol en la barra superior o hazme una pregunta directamente.`,
        timestamp: Date.now(),
        model: 'gemini-3.8-flash'
      }
    ];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ecommil_gemini_multiturn_chat_history_v1', JSON.stringify(messages));
    } catch (e) {
      console.warn('Error saving chat history:', e);
    }
  }, [messages]);

  // Auto-scroll to bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, isLoading]);

  // Compute business data context summary
  const dataContextSummary = React.useMemo(() => {
    if (!orders || orders.length === 0) {
      return 'No hay pedidos cargados en la sesión actual.';
    }

    const totalOrders = orders.length;
    let delivered = 0;
    let inTransit = 0;
    let returned = 0;
    let cancelled = 0;
    let totalRevenue = 0;
    let totalRealCost = 0;
    let totalShippingCost = 0;

    orders.forEach(o => {
      const statusLower = (o.status || '').toLowerCase();
      if (statusLower.includes('entregado')) delivered++;
      else if (statusLower.includes('transito')) inTransit++;
      else if (statusLower.includes('devuelt') || statusLower.includes('retorno')) returned++;
      else if (statusLower.includes('cancel')) cancelled++;

      totalRevenue += Number(o.price || 0);
      totalRealCost += Number(o.cost || 0);
      totalShippingCost += Number(o.shippingReal || o.precioFlete || 0);
    });

    const deliveryRate = totalOrders > 0 ? ((delivered / totalOrders) * 100).toFixed(1) : '0';
    const returnRate = totalOrders > 0 ? ((returned / totalOrders) * 100).toFixed(1) : '0';

    return `DATOS ACTUALES DEL NEGOCIO (CONTEXTO EN VIVO):
- Total de Pedidos: ${totalOrders}
- Entregados: ${delivered} (${deliveryRate}%)
- En Tránsito: ${inTransit}
- Devueltos: ${returned} (${returnRate}%)
- Cancelados: ${cancelled}
- Facturación Bruta: ${formatCurrency(totalRevenue)}
- Costo de Mercancía: ${formatCurrency(totalRealCost)}
- Flete Total Transportadoras: ${formatCurrency(totalShippingCost)}
- Moneda Principal: ${currency}`;
  }, [orders, formatCurrency, currency]);

  // Handle switching role
  const handleRoleChange = (role: ChatRole) => {
    setSelectedRole(role);
    // Add context notification message in thread
    const roleAnnouncement: ChatMessage = {
      id: `role-switch-${Date.now()}`,
      role: 'model',
      content: `*Has cambiado al rol de **${role.name}**.*

${role.description}

¿En qué puedo asistirte ahora?`,
      timestamp: Date.now(),
      model: selectedModel
    };
    setMessages(prev => [...prev, roleAnnouncement]);
  };

  // Clear chat
  const handleClearChat = () => {
    if (window.confirm('¿Deseas vaciar el historial de conversación actual?')) {
      const resetMessage: ChatMessage = {
        id: `msg-reset-${Date.now()}`,
        role: 'model',
        content: `Nueva conversación iniciada con el **${selectedRole.name}** utilizando **${selectedModel}**. ¿Cómo puedo ayudarte hoy?`,
        timestamp: Date.now(),
        model: selectedModel
      };
      setMessages([resetMessage]);
      localStorage.removeItem('ecommil_gemini_multiturn_chat_history_v1');
    }
  };

  // Download conversation as Markdown
  const handleExportChat = () => {
    const textContent = messages.map(m => {
      const roleName = m.role === 'user' ? 'Usuario' : `Gemini (${m.model || selectedModel})`;
      const timeStr = new Date(m.timestamp).toLocaleString();
      return `### ${roleName} - ${timeStr}\n\n${m.content}\n\n---\n`;
    }).join('\n');

    const blob = new Blob([textContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gemini_Chat_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Copy message text
  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Read aloud (TTS)
  const handleSpeakMessage = (id: string, text: string) => {
    if ('speechSynthesis' in window) {
      if (speakingId === id) {
        window.speechSynthesis.cancel();
        setSpeakingId(null);
        return;
      }
      window.speechSynthesis.cancel();
      const plainText = text.replace(/[*#_`~\[\]]/g, '');
      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.lang = 'es-ES';
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      setSpeakingId(id);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Send message to backend
  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend !== undefined ? textToSend : inputMessage).trim();
    if (!messageContent || isLoading) return;

    setInputMessage('');
    setErrorMessage(null);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: Date.now()
    };

    // Update conversation thread immediately
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const clientConfig = getClientAIConfig();
      const clientKeys = getClientGeminiApiKeys();

      // Determine active system instruction
      const effectiveInstruction = selectedRole.id === 'custom-role' 
        ? customSystemInstruction 
        : selectedRole.systemInstruction;

      // Build context-enriched system instruction if enabled
      const finalSystemInstruction = includeDataContext
        ? `${effectiveInstruction}\n\n${dataContextSummary}`
        : effectiveInstruction;

      // Multi-turn history payload formatted for Gemini API (user / model)
      const historyPayload = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          history: historyPayload,
          systemInstruction: finalSystemInstruction,
          model: selectedModel,
          apiKey: clientConfig.geminiKey,
          apiKeys: clientKeys,
          context: includeDataContext ? { ordersSummary: dataContextSummary } : undefined
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'No se pudo obtener respuesta del modelo Gemini.');
      }

      const botMessage: ChatMessage = {
        id: data.id || `ai-${Date.now()}`,
        role: 'model',
        content: data.text || 'Sin respuesta de Gemini.',
        timestamp: Date.now(),
        model: data.model || selectedModel,
        latencyMs: data.latencyMs
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err: any) {
      console.error('Gemini Chat Error:', err);
      const cleaned = cleanAiErrorMessage(err?.message || 'Error al comunicarse con Gemini');
      setErrorMessage(cleaned);

      const errorBotMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        content: `⚠️ **Aviso del Asistente:** ${cleaned}\n\nPor favor verifica tu conexión o intenta con otro modelo disponible (por ejemplo, **Gemini 3.5 Flash** o **Gemini 3.1 Flash Lite**).`,
        timestamp: Date.now(),
        model: selectedModel
      };
      setMessages(prev => [...prev, errorBotMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div id="gemini-chat-root" className="flex flex-col h-[calc(100vh-140px)] min-h-[580px] max-w-7xl mx-auto w-full px-2 sm:px-4 py-3 gap-3">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-white/10 bg-[#0d131a] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <Bot size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Chat Gemini Multi-Turn
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {selectedRole.badge}
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 line-clamp-1">
              {selectedRole.description}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Model Selector Pill */}
          <div className="relative">
            <select 
              id="model-selector"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/15 bg-[#141d26] text-white focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#141d26] text-white py-1">
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Context Toggle */}
          <button
            type="button"
            id="toggle-store-data-btn"
            onClick={() => setIncludeDataContext(!includeDataContext)}
            title="Al estar activo, Gemini lee automáticamente tus métricas de ventas y pedidos para darte respuestas exactas."
            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all ${
              includeDataContext
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 size={13} />
            <span className="hidden sm:inline">Datos de Tienda:</span>
            <span className="font-bold">{includeDataContext ? 'ON' : 'OFF'}</span>
          </button>

          {/* Role Configuration Toggle */}
          <button
            type="button"
            id="toggle-roles-btn"
            onClick={() => setShowRoleConfig(!showRoleConfig)}
            className={`p-1.5 rounded-lg border transition-colors ${
              showRoleConfig ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-white/5 text-slate-400 hover:text-white border-white/10'
            }`}
            title="Cambiar rol o instrucción de sistema"
          >
            <Settings2 size={16} />
          </button>

          {/* Export Chat */}
          <button
            type="button"
            id="export-chat-btn"
            onClick={handleExportChat}
            className="p-1.5 rounded-lg border bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border-white/10 transition-colors"
            title="Descargar conversación en Markdown"
          >
            <Download size={16} />
          </button>

          {/* Clear Chat */}
          <button
            type="button"
            id="clear-chat-btn"
            onClick={handleClearChat}
            className="p-1.5 rounded-lg border bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border-white/10 hover:border-red-500/30 transition-colors"
            title="Reiniciar conversación"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Role Switcher Drawer / Bar */}
      <AnimatePresence>
        {showRoleConfig && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden p-3.5 rounded-xl border border-white/10 bg-[#0d131a] flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders size={13} className="text-emerald-400" />
                Roles Especializados y System Instructions
              </span>
              <span className="text-[11px] text-slate-500">
                Cada rol aplica directrices de razonamiento exclusivas al modelo
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {CHAT_ROLES.map((role) => {
                const isSelected = selectedRole.id === role.id;
                const RoleIcon = role.icon;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleRoleChange(role)}
                    className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-sm'
                        : 'bg-[#141d26] border-white/5 text-slate-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <RoleIcon size={16} className={isSelected ? 'text-emerald-400' : 'text-slate-400'} />
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </div>
                    <span className="text-xs font-bold leading-tight line-clamp-1">{role.name}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{role.badge}</span>
                  </button>
                );
              })}
            </div>

            {selectedRole.id === 'custom-role' && (
              <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
                <label className="text-xs font-semibold text-slate-300">
                  Instrucción de Sistema Personalizada (System Instruction):
                </label>
                <textarea
                  value={customSystemInstruction}
                  onChange={(e) => setCustomSystemInstruction(e.target.value)}
                  placeholder="Define cómo debe comportarse el bot, su tono, restricciones y área de experiencia..."
                  className="w-full text-xs p-2.5 rounded-lg bg-[#141d26] text-white border border-white/15 focus:outline-none focus:border-emerald-500 h-20 resize-none"
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Conversation Scrollable Thread */}
      <div 
        id="messages-scroll-container"
        className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 rounded-xl border border-white/10 bg-[#0a0f14] flex flex-col gap-4 relative"
      >
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <motion.div
              key={msg.id || index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex flex-col max-w-[92%] sm:max-w-[80%] ${
                isUser ? 'ml-auto items-end' : 'mr-auto items-start'
              }`}
            >
              {/* Message Header */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1 px-1">
                {!isUser && (
                  <div className="w-4 h-4 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Bot size={11} />
                  </div>
                )}
                <span className="font-semibold text-slate-300">
                  {isUser ? 'Tú' : selectedRole.name}
                </span>
                {!isUser && msg.model && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-slate-400">
                    {msg.model}
                  </span>
                )}
                <span className="text-[10px] text-slate-500">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.latencyMs && (
                  <span className="text-[9px] text-slate-500">
                    ({(msg.latencyMs / 1000).toFixed(2)}s)
                  </span>
                )}
              </div>

              {/* Bubble Body */}
              <div
                className={`p-3.5 sm:p-4 rounded-2xl text-sm leading-relaxed ${
                  isUser
                    ? 'bg-emerald-600 text-white rounded-tr-sm shadow-md font-medium'
                    : 'bg-[#141e28] text-slate-100 border border-white/10 rounded-tl-sm shadow-sm'
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="markdown-body prose prose-invert max-w-none text-sm leading-relaxed break-words">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                )}
              </div>

              {/* Bot Message Action Toolbar */}
              {!isUser && (
                <div className="flex items-center gap-1 mt-1 px-1 text-slate-500">
                  <button
                    type="button"
                    onClick={() => handleCopyMessage(msg.id, msg.content)}
                    className="p-1 hover:text-slate-300 rounded transition-colors"
                    title="Copiar respuesta"
                  >
                    {copiedId === msg.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSpeakMessage(msg.id, msg.content)}
                    className={`p-1 hover:text-slate-300 rounded transition-colors ${
                      speakingId === msg.id ? 'text-emerald-400 animate-pulse' : ''
                    }`}
                    title="Escuchar respuesta"
                  >
                    <Volume2 size={12} />
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mr-auto flex flex-col items-start max-w-[80%]"
          >
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1 px-1">
              <div className="w-4 h-4 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Bot size={11} />
              </div>
              <span className="font-semibold text-slate-300">{selectedRole.name}</span>
              <span className="text-[10px] text-emerald-400 animate-pulse">Razonando con {selectedModel}...</span>
            </div>
            <div className="p-3.5 rounded-2xl rounded-tl-sm bg-[#141e28] border border-white/10 flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-emerald-400" />
              <span className="text-xs text-slate-300 font-medium">Analizando contexto y generando respuesta...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 whitespace-nowrap pl-1">
          <Sparkles size={11} className="text-emerald-400" />
          Sugerencias:
        </span>
        {selectedRole.suggestedPrompts.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(prompt)}
            disabled={isLoading}
            className="text-[11px] whitespace-nowrap px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Composer */}
      <div className="relative flex items-center gap-2 p-2 rounded-xl border border-white/10 bg-[#0d131a] shadow-md">
        <textarea
          ref={inputRef}
          id="gemini-chat-input"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Pregúntale a tu ${selectedRole.name}... (Presiona Enter para enviar, Shift+Enter para salto de línea)`}
          rows={2}
          className="flex-1 text-sm bg-transparent text-white placeholder-slate-500 focus:outline-none resize-none px-2 py-1"
          disabled={isLoading}
        />

        <div className="flex items-center gap-1.5 self-end">
          <button
            type="button"
            id="send-gemini-chat-btn"
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputMessage.trim()}
            className={`p-2.5 rounded-xl font-semibold flex items-center justify-center transition-all ${
              isLoading || !inputMessage.trim()
                ? 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md hover:scale-105 active:scale-95'
            }`}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};
