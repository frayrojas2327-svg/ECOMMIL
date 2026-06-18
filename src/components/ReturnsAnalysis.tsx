import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { 
  AlertTriangle, RotateCcw, XCircle, TrendingDown, Globe, Brain, Sparkles, Cpu, Loader2, 
  BarChart3, TrendingUp, CheckCircle, ArrowRight, Plus, Trash2, Edit2, Calendar, FileText, 
  Search, Info, AlertCircle, RefreshCw
} from 'lucide-react';
import { Order, calculateOrderProfit, CurrencyCode } from '../mockData';
import Markdown from 'react-markdown';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isFirebaseConfigValid } from '../firebase';
import { useAuth } from './Auth';

export interface ReturnNovelty {
  id: string;
  uid: string;
  orderId: string;
  guia?: string;
  productName: string;
  nombreCliente: string;
  fecha: string;
  origenNovedad: string;
  descripcion: string;
  resolucion: string;
  timestamp: number;
  transportadora?: string;
  mes?: string;
  etiquetaDevolucion?: string;
}

export interface SavedProduct {
  id: string;
  name: string;
  productId: string;
}

interface ReturnsAnalysisProps {
  orders: Order[];
  formatCurrency: (amount: number) => string;
  currency?: CurrencyCode;
  currencies?: any;
  isConversionActive?: boolean;
}

const MONTHS_SPANISH = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const getMonthFromDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return MONTHS_SPANISH[monthIndex];
    }
  }
  return '';
};

const ReturnsAnalysis: React.FC<ReturnsAnalysisProps> = ({ orders, formatCurrency, currency = 'USD', currencies = {}, isConversionActive = false }) => {
  const { user, isDemoMode } = useAuth();
  
  // Local overrides for order cancellation reasons
  const [localCancellationReasons, setLocalCancellationReasons] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('ecommil_local_cancellation_reasons');
    return saved ? JSON.parse(saved) : {};
  });

  const handleAssignCancellationReason = async (orderId: string, reason: string) => {
    const updated = { ...localCancellationReasons, [orderId]: reason };
    setLocalCancellationReasons(updated);
    localStorage.setItem('ecommil_local_cancellation_reasons', JSON.stringify(updated));

    if (user && isFirebaseConfigValid && !isDemoMode && db) {
      try {
        const orderRef = doc(db, 'orders', orderId);
        await setDoc(orderRef, { cancellationReason: reason }, { merge: true });
      } catch (err) {
        console.error("Error setting cancellation reason in Firestore:", err);
      }
    }
  };

  const handleAutoAssignAllReasons = async () => {
    const CANCEL_REASONS = ['Cambio de opinión', 'Error en dirección', 'Precio alto', 'Tiempo de entrega', 'Duplicado'];
    const cancellations = orders.filter(o => o.status === 'Cancelado');
    const updated = { ...localCancellationReasons };

    for (let i = 0; i < cancellations.length; i++) {
      const o = cancellations[i];
      if (!updated[o.id] && !o.cancellationReason) {
        const randomReason = CANCEL_REASONS[i % CANCEL_REASONS.length];
        updated[o.id] = randomReason;
        
        if (user && isFirebaseConfigValid && !isDemoMode && db) {
          try {
            const orderRef = doc(db, 'orders', o.id);
            await setDoc(orderRef, { cancellationReason: randomReason }, { merge: true });
          } catch (err) {
            console.error("Error batch setting cancellation reason:", err);
          }
        }
      }
    }

    setLocalCancellationReasons(updated);
    localStorage.setItem('ecommil_local_cancellation_reasons', JSON.stringify(updated));
  };
  
  // Return Novelties states
  const [novelties, setNovelties] = useState<ReturnNovelty[]>([]);
  const [noveltiesLoading, setNoveltiesLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNovelty, setEditingNovelty] = useState<ReturnNovelty | null>(null);
  
  // Saved product list from price calculator
  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([]);
  const [showManualProductInput, setShowManualProductInput] = useState(false);

  // Dynamic Incident Cause/Origenes
  const [customOrigines, setCustomOrigines] = useState<string[]>(() => {
    const saved = localStorage.getItem('ecommil_custom_origenes');
    return saved ? JSON.parse(saved) : [];
  });

  // Sync custom origines with localStorage
  useEffect(() => {
    localStorage.setItem('ecommil_custom_origenes', JSON.stringify(customOrigines));
  }, [customOrigines]);

  // Load saved products on mount
  useEffect(() => {
    const saved = localStorage.getItem('ecommil_saved_products');
    if (saved) {
      try {
        setSavedProducts(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Form states
  const [selectedOrderId, setSelectedOrderId] = useState<string>('manual');
  const [formFecha, setFormFecha] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formOrderId, setFormOrderId] = useState<string>('');
  const [formGuia, setFormGuia] = useState<string>('');
  const [formProductName, setFormProductName] = useState<string>('');
  const [formNombreCliente, setFormNombreCliente] = useState<string>('');
  const [formOrigenNovedad, setFormOrigenNovedad] = useState<string>('Cliente no responde / Apagado / No contestó');
  const [formDescripcion, setFormDescripcion] = useState<string>('');
  const [formResolucion, setFormResolucion] = useState<string>('🟡 En Proceso de Retorno / Bodega');
  const [formTransportadora, setFormTransportadora] = useState<string>('');
  const [formMes, setFormMes] = useState<string>('');
  const [noveltySearch, setNoveltySearch] = useState<string>('');
  const [noveltyTagFilter, setNoveltyTagFilter] = useState<string>('TODOS');
  const [noveltyDevolucionFilter, setNoveltyDevolucionFilter] = useState<string>('TODOS');
  const [formEtiquetaDevolucion, setFormEtiquetaDevolucion] = useState<string>('');

  // Auto-sync month when fecha changes
  useEffect(() => {
    if (formFecha) {
      const calculatedMonth = getMonthFromDate(formFecha);
      setFormMes(calculatedMonth);
    }
  }, [formFecha]);

  // Fallback to localStorage if Firebase is not valid or in Demo Mode
  useEffect(() => {
    if ((isDemoMode || !isFirebaseConfigValid) && !user) {
      const saved = localStorage.getItem('ecommil_return_novelties');
      if (saved) {
        setNovelties(JSON.parse(saved));
      }
      setNoveltiesLoading(false);
    }
  }, [user, isDemoMode]);

  // Sync with Firestore database
  useEffect(() => {
    if (!user || !isFirebaseConfigValid || isDemoMode) {
      setNoveltiesLoading(false);
      return;
    }

    if (!db) {
      setNoveltiesLoading(false);
      return;
    }

    const q = query(collection(db, 'return_novelties'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as ReturnNovelty[];
      
      // Sort novelties by timestamp desc
      data.sort((a, b) => b.timestamp - a.timestamp);
      
      setNovelties(data);
      setNoveltiesLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'return_novelties');
    });

    return () => unsubscribe();
  }, [user, isDemoMode]);

  // Save to localStorage when novelties change in Demo Mode or offline
  useEffect(() => {
    if (isDemoMode || !isFirebaseConfigValid) {
      localStorage.setItem('ecommil_return_novelties', JSON.stringify(novelties));
    }
  }, [novelties, isDemoMode]);

  // Handle selected order change
  const handleSelectOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedOrderId(val);
    if (val === 'manual') {
      setFormOrderId('');
      setFormGuia('');
      setFormProductName('');
      setFormNombreCliente('');
      setFormTransportadora('');
      setShowManualProductInput(false);
    } else {
      const found = orders.find(o => o.id === val || o.orderId === val);
      if (found) {
        setFormOrderId(found.orderId || found.id || '');
        setFormGuia(found.trackingId || '');
        const prod = found.product || '';
        setFormProductName(prod);
        setFormNombreCliente(found.nombreCliente || '');
        setFormTransportadora(found.transportadora || '');
        
        // If the order product was found, check if it's in the saved products
        const savedProdExists = savedProducts.some(p => p.name.toLowerCase() === prod.toLowerCase());
        setShowManualProductInput(!savedProdExists);
      }
    }
  };

  const handleResetForm = () => {
    setEditingNovelty(null);
    setFormFecha(new Date().toISOString().split('T')[0]);
    setFormOrderId('');
    setFormGuia('');
    setFormProductName('');
    setFormNombreCliente('');
    setFormOrigenNovedad('Cliente no responde / Apagado / No contestó');
    setFormDescripcion('');
    setFormResolucion('🟡 En Proceso de Retorno / Bodega');
    setFormTransportadora('');
    setFormMes('');
    setFormEtiquetaDevolucion('');
    setSelectedOrderId('manual');
    setShowManualProductInput(false);
    setIsFormOpen(false);
  };

  const handleSubmitNovelty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && !isDemoMode) return;

    const noveltyIdInput = editingNovelty ? editingNovelty.id : Math.random().toString(36).substring(2, 11);
    const noveltyData = {
      uid: user?.uid || 'demo-user',
      orderId: formOrderId,
      guia: formGuia,
      productName: formProductName,
      nombreCliente: formNombreCliente,
      fecha: formFecha,
      origenNovedad: formOrigenNovedad,
      descripcion: formDescripcion,
      resolucion: formResolucion,
      transportadora: formTransportadora,
      mes: formMes,
      etiquetaDevolucion: formEtiquetaDevolucion,
      timestamp: editingNovelty ? editingNovelty.timestamp : Date.now()
    };

    try {
      if (isDemoMode || !isFirebaseConfigValid) {
        if (editingNovelty) {
          setNovelties(prev => prev.map(item => item.id === editingNovelty.id ? { ...noveltyData, id: item.id } as ReturnNovelty : item));
        } else {
          const newNovelty = { ...noveltyData, id: noveltyIdInput } as ReturnNovelty;
          setNovelties(prev => [newNovelty, ...prev]);
        }
      } else {
        if (editingNovelty) {
          await setDoc(doc(db, 'return_novelties', editingNovelty.id), noveltyData);
        } else {
          await addDoc(collection(db, 'return_novelties'), noveltyData);
        }
      }
      handleResetForm();
    } catch (err) {
      console.error("Error saving novelty:", err);
    }
  };

  const handleEditNovelty = (item: ReturnNovelty) => {
    setEditingNovelty(item);
    setFormFecha(item.fecha);
    setFormOrderId(item.orderId || '');
    setFormGuia(item.guia || '');
    setFormProductName(item.productName || '');
    setFormNombreCliente(item.nombreCliente || '');
    setFormOrigenNovedad(item.origenNovedad);
    setFormDescripcion(item.descripcion);
    setFormResolucion(item.resolucion);
    setFormTransportadora(item.transportadora || '');
    setFormMes(item.mes || getMonthFromDate(item.fecha));
    setFormEtiquetaDevolucion(item.etiquetaDevolucion || '');
    setSelectedOrderId('manual');
    
    // Check if the current product name exists in saved products. If not, default to manual product input
    const isSaved = savedProducts.some(p => p.name.toLowerCase() === (item.productName || '').toLowerCase());
    setShowManualProductInput(!isSaved);
    
    setIsFormOpen(true);
  };

  const handleDeleteNovelty = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro de novedad?')) return;
    try {
      if (isDemoMode || !isFirebaseConfigValid) {
        setNovelties(prev => prev.filter(item => item.id !== id));
      } else {
        await deleteDoc(doc(db, 'return_novelties', id));
      }
    } catch (err) {
      console.error("Error deleting novelty:", err);
    }
  };

  // Filter returned orders for selection references
  const returnedOrdersDropdown = useMemo(() => {
    return orders.filter(o => o.status === 'Devuelto' || o.status === 'Incidencia' || o.status === 'Cancelado');
  }, [orders]);

  // Dynamically extract other tags from actual orders in alphabetical order
  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    orders.forEach(o => {
      if (o.tags && o.tags.trim() !== '') {
        const rawTags = o.tags.split(',');
        rawTags.forEach(raw => {
          const clean = raw.trim();
          if (clean !== '') {
            const lowerClean = clean.toLowerCase();
            if (
              lowerClean !== 'tik tok organico' && 
              lowerClean !== 'tiktok organico' && 
              lowerClean !== 'sin etiqueta' &&
              lowerClean !== 'sin_etiqueta'
            ) {
              tagsSet.add(clean);
            }
          }
        });
      }
    });
    return Array.from(tagsSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [orders]);

  const orderLookupMap = useMemo(() => {
    const map = new Map<string, Order>();
    orders.forEach(o => {
      if (o.orderId) map.set(o.orderId.toLowerCase(), o);
      if (o.id) map.set(o.id.toLowerCase(), o);
    });
    return map;
  }, [orders]);

  // Filter return novelties for listing
  const filteredNovelties = useMemo(() => {
    return novelties.filter(n => {
      // Tag filter
      if (noveltyTagFilter !== 'TODOS') {
        const orderIdKey = n.orderId?.toLowerCase() || '';
        const relatedOrder = orderLookupMap.get(orderIdKey);
        const orderTagLower = relatedOrder?.tags?.toLowerCase() || '';

        if (noveltyTagFilter === 'SIN ETIQUETA') {
          const hasNoTags = !relatedOrder || !relatedOrder.tags || relatedOrder.tags.trim() === '';
          if (!hasNoTags) return false;
        } else if (noveltyTagFilter === 'TIK_TOK_ORGANICO') {
          const isTikTok = orderTagLower.includes('tik tok organico') || orderTagLower.includes('tiktok organico') || (orderTagLower.includes('tik') && orderTagLower.includes('organ'));
          if (!isTikTok) return false;
        } else {
          const targetLower = noveltyTagFilter.toLowerCase();
          const individualTags = orderTagLower.split(',').map(t => t.trim());
          const hasTag = individualTags.includes(targetLower) || orderTagLower.includes(targetLower);
          if (!hasTag) return false;
        }
      }

      // Return label filter
      if (noveltyDevolucionFilter !== 'TODOS') {
        const itemLabel = n.etiquetaDevolucion || '';
        if (noveltyDevolucionFilter === 'SIN_ETIQUETA') {
          if (itemLabel !== '') return false;
        } else {
          if (itemLabel.toLowerCase() !== noveltyDevolucionFilter.toLowerCase()) return false;
        }
      }

      const queryLower = noveltySearch.toLowerCase();
      if (!queryLower) return true;
      return (
        n.nombreCliente?.toLowerCase().includes(queryLower) ||
        n.orderId?.toLowerCase().includes(queryLower) ||
        n.productName?.toLowerCase().includes(queryLower) ||
        n.origenNovedad?.toLowerCase().includes(queryLower) ||
        n.descripcion?.toLowerCase().includes(queryLower) ||
        n.resolucion?.toLowerCase().includes(queryLower) ||
        n.transportadora?.toLowerCase().includes(queryLower) ||
        n.mes?.toLowerCase().includes(queryLower)
      );
    });
  }, [novelties, noveltySearch, noveltyTagFilter, noveltyDevolucionFilter, orderLookupMap]);

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

  const stats = useMemo(() => {
    const returns = orders.filter(o => o.status === 'Devuelto');
    const cancellations = orders.filter(o => o.status === 'Cancelado');
    
    const returnRate = orders.length > 0 ? (returns.length / orders.length) * 100 : 0;
    const cancelRate = orders.length > 0 ? (cancellations.length / orders.length) * 100 : 0;

    // Cost of returns: aligned with main financial engine for perfect data consistency
    const totalReturnCost = returns.reduce((acc, o) => {
      const profitInfo = calculateOrderProfit(o);
      return acc + Math.abs(profitInfo.netProfit);
    }, 0);

    // What we would have earned if those returned orders had been delivered successfully
    const potentialEarnedIfDelivered = returns.reduce((acc, o) => {
      const simulatedOrder = { ...o, status: 'Entregado' as const };
      const profitInfo = calculateOrderProfit(simulatedOrder);
      return acc + profitInfo.netProfit;
    }, 0);

    // Cancellation reasons
    const reasons: Record<string, number> = {};
    cancellations.forEach(o => {
      const reason = localCancellationReasons[o.id] || o.cancellationReason || "Sin motivo especificado";
      reasons[reason] = (reasons[reason] || 0) + 1;
    });

    const pieData = Object.entries(reasons).map(([name, value]) => ({ name, value }));

    return { returnRate, cancelRate, totalReturnCost, potentialEarnedIfDelivered, pieData, returnsCount: returns.length, cancellationsCount: cancellations.length };
  }, [orders, localCancellationReasons]);

  // AI Analysis States
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [activeTab, setActiveTab] = useState(0);

  // Parse structured sections dynamically from Markdown headings for high precision reporting tabs
  const parsedSections = useMemo(() => {
    if (!aiResult || !aiResult.analysisText) return [];
    
    const lines = aiResult.analysisText.split('\n');
    const sections: { title: string; content: string[] }[] = [];
    let currentSection: { title: string; content: string[] } | null = null;
    
    lines.forEach((line: string) => {
      const headingMatch = line.match(/^#{1,4}\s+(.*)$/);
      if (headingMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        let cleanTitle = headingMatch[1].replace(/[\*\#\_]/g, '').trim();
        // Keep section header tight and neat
        if (cleanTitle.length > 28) {
          cleanTitle = cleanTitle.split(':')[0].split('(')[0].trim();
        }
        if (cleanTitle.length > 28) {
          cleanTitle = cleanTitle.substring(0, 28) + "...";
        }
        currentSection = {
          title: cleanTitle,
          content: []
        };
      } else {
        if (currentSection) {
          currentSection.content.push(line);
        } else if (line.trim()) {
          currentSection = {
            title: "Diagnóstico",
            content: [line]
          };
        }
      }
    });
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections.map(s => ({
      title: s.title,
      rawContent: s.content.join('\n').trim()
    })).filter(s => s.rawContent.length > 0);
  }, [aiResult]);

  // Reset tab index on fresh analysis executions
  useEffect(() => {
    setActiveTab(0);
  }, [aiResult]);

  const loadingMessages = [
    "Consolidando base de datos histórica de la tienda...",
    "Evaluando causales y motivos de cancelación registrados...",
    "Filtrando entregas exitosas y devoluciones por ciudades y departamentos...",
    "Ejecutando algoritmos analíticos con Gemini PRO Inteligencia Artificial...",
    "Estructurando planes de optimización logística y mitigación de costos..."
  ];

  useEffect(() => {
    let interval: any;
    if (aiLoading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 3000);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [aiLoading]);

  // Consolidate dataset on client-side to only analyze returns & incidents (Novedades de Devoluciones)
  const aiPreparedData = useMemo(() => {
    const totalNovelties = novelties.length;

    // Carrier distribution (Distribución de Transportadoras)
    const carrierMap: Record<string, { name: string, total: number, devuelto: number, reintento: number, solucionado: number }> = {};
    novelties.forEach(n => {
      const carrier = n.transportadora || "No especificada";
      if (!carrierMap[carrier]) {
        carrierMap[carrier] = { name: carrier, total: 0, devuelto: 0, reintento: 0, solucionado: 0 };
      }
      carrierMap[carrier].total++;
      
      const res = n.resolucion || "";
      if (res.includes("Devolución") || res.includes("Pérdida") || res.includes("🔄")) {
        carrierMap[carrier].devuelto++;
      } else if (res.includes("Retorno") || res.includes("Proceso") || res.includes("🟡")) {
        carrierMap[carrier].reintento++;
      } else {
        carrierMap[carrier].solucionado++;
      }
    });

    // Monthly distribution (Distribución por Mes de Registro)
    const monthlyMap: Record<string, { name: string, total: number, devuelto: number, solucionado: number }> = {};
    novelties.forEach(n => {
      let month = n.mes;
      if (!month && n.fecha) {
        month = getMonthFromDate(n.fecha);
      }
      month = month || "Sin registrar";
      if (!monthlyMap[month]) {
        monthlyMap[month] = { name: month, total: 0, devuelto: 0, solucionado: 0 };
      }
      monthlyMap[month].total++;
      
      const res = n.resolucion || "";
      if (res.includes("Devolución") || res.includes("Pérdida") || res.includes("🔄")) {
        monthlyMap[month].devuelto++;
      } else {
        monthlyMap[month].solucionado++;
      }
    });

    const detailedNoveltiesList = novelties.map(n => ({
      fecha: n.fecha,
      mes: n.mes || getMonthFromDate(n.fecha) || "Sin registrar",
      orderId: n.orderId || "MANUAL",
      guia: n.guia || "Sin Guía",
      nombreCliente: n.nombreCliente,
      productName: n.productName || "No especificado",
      transportadora: n.transportadora || "No especificada",
      origenNovedad: n.origenNovedad,
      descripcion: n.descripcion,
      resolucion: n.resolucion
    }));

    return {
      totalNovelties,
      carrierData: Object.values(carrierMap),
      monthlyData: Object.values(monthlyMap),
      detailedNoveltiesList
    };
  }, [novelties]);

  const handleAIAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch("/api/analisis-devoluciones-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiPreparedData)
      });
      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Ocurrió un error al procesar el análisis de Inteligencia Artificial.");
      }
      const data = await response.json();
      setAiResult(data);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "La conexión con el proveedor de IA falló en este momento.");
    } finally {
      setAiLoading(false);
    }
  };

  const COLORS = ['#00ff88', '#f5c842', '#ef4444', '#3b82f6', '#8b5cf6'];
  const AI_CHART_COLORS = {
    entregas: '#22c55e',
    devoluciones: '#f97316',
    cancelaciones: '#ef4444',
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Análisis de Devoluciones y Cancelaciones</h2>
          <p className="text-base text-slate-500">Impacto financiero de pedidos no completados</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-background/50 rounded-lg p-0.5 border border-border">
            <div className={`px-3 py-1.5 flex items-center gap-2 text-[10px] font-black tracking-widest ${isConversionActive ? 'text-neon' : 'text-slate-500'}`}>
              <Globe size={14} />
               {isConversionActive ? `MONEDA: ${currency}` : 'MODO USD'}
            </div>
          </div>
          {stats.returnRate > 8 && (
            <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-base font-bold animate-pulse">
              <AlertTriangle size={18} />
              Alerta: Tasa de devolución crítica ({(stats.returnRate || 0).toFixed(1)}%)
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="glass-card p-8 flex flex-col justify-center items-center text-center">
          <RotateCcw size={48} className="text-orange-400 mb-4 opacity-20" />
          <p className="text-[15px] uppercase tracking-widest text-slate-500 mb-1">Tasa de Devolución</p>
          <h3 className="text-5xl font-mono font-bold text-white mb-2">{(stats.returnRate || 0).toFixed(1)}%</h3>
          <p className="text-base text-slate-500">{stats.returnsCount} pedidos devueltos de {orders.length}</p>
          
          <div className="mt-8 w-full pt-8 border-t border-border space-y-6">
            <div>
              <p className="text-[15px] uppercase tracking-widest text-slate-500 mb-2">Costo Absorbido</p>
              <p className="text-3xl font-mono font-bold text-red-400">{localFormatCurrency(stats.totalReturnCost)}</p>
              <p className="text-[13px] text-slate-500 mt-1 italic">Flete ida/vuelta + Ads perdidos</p>
            </div>
            
            <div className="pt-6 border-t border-border/40">
              <p className="text-[15px] uppercase tracking-widest text-[#10b981] mb-2">Ganancia si se Entregaran</p>
              <p className="text-3xl font-mono font-bold text-emerald-400">{localFormatCurrency(stats.potentialEarnedIfDelivered)}</p>
              <p className="text-[13px] text-slate-500 mt-1 italic">Utilidad que hubieras recibido hoy</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 glass-card p-8 !bg-black border border-slate-900 shadow-[0_0_25px_rgba(0,0,0,0.9)] flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-display font-bold text-white">Análisis de Cancelaciones</h3>
                <p className="text-xs text-slate-500 mt-1">Identifica y registra por qué se cancelaron los pedidos antes del envío para mejorar tu conversión e inventario.</p>
              </div>
              <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider h-fit w-fit">
                {stats.cancellationsCount} Cancelados
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000000', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff', fontSize: '15px', fontFamily: 'DM Mono' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="overflow-hidden border border-border rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-background border-b border-border">
                      <th className="px-4 py-3 text-[15px] uppercase tracking-widest text-slate-500 font-display">Motivo</th>
                      <th className="px-4 py-3 text-[15px] uppercase tracking-widest text-slate-500 font-display text-right">Pedidos</th>
                      <th className="px-4 py-3 text-[15px] uppercase tracking-widest text-slate-500 font-display text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.pieData.map((entry, index) => (
                      <tr key={entry.name} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-base text-slate-300 truncate">{entry.name}</span>
                        </td>
                        <td className="px-4 py-3 text-base font-mono font-bold text-white text-right">{entry.value}</td>
                        <td className="px-4 py-3 text-base font-mono text-slate-500 text-right">
                          {(stats.cancellationsCount > 0 ? (entry.value / stats.cancellationsCount) * 100 : 0).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Interactive Cancellation Orders Reason Assignment */}
          <div className="border-t border-slate-900 pt-6 mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h4 className="text-sm font-bold text-white font-display flex items-center gap-2">
                  <Brain size={14} className="text-emerald-400" />
                  Gestión de Motivos - Pedidos Cancelados
                </h4>
                <p className="text-xs text-slate-500">Asigna causales reales a cada pedido para perfeccionar tu inteligencia comercial.</p>
              </div>
              {orders.filter(o => o.status === 'Cancelado').length > 0 && orders.filter(o => o.status === 'Cancelado').some(o => !localCancellationReasons[o.id] && !o.cancellationReason) && (
                <button 
                  onClick={handleAutoAssignAllReasons}
                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] uppercase tracking-wider font-bold border border-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sparkles size={11} />
                  Autocompletar
                </button>
              )}
            </div>
            
            {orders.filter(o => o.status === 'Cancelado').length === 0 ? (
              <div className="py-4 text-center rounded-xl bg-slate-950/30 border border-slate-900">
                <p className="text-xs text-slate-500 font-medium">No hay pedidos cancelados registrados en este periodo.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                {orders.filter(o => o.status === 'Cancelado').map(order => {
                  const currentReason = localCancellationReasons[order.id] || order.cancellationReason || "";
                  return (
                    <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-950/40 border border-slate-900/60 rounded-xl hover:border-slate-800 transition-colors">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-white uppercase">{order.orderId || order.id.substring(0, 8)}</span>
                          <span className="text-[9px] bg-red-500/10 text-red-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Cancelado</span>
                        </div>
                        <span className="text-[11px] text-slate-400 mt-1">
                          Cliente: <strong className="text-slate-300">{order.nombreCliente || "Manual"}</strong> | Producto: <strong className="text-slate-400">{order.product || "No especificado"}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={currentReason}
                          onChange={(e) => handleAssignCancellationReason(order.id, e.target.value)}
                          className="bg-black border border-slate-800 rounded-lg text-[11px] py-1 px-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors min-w-[160px] cursor-pointer"
                        >
                          <option value="">-- Sin motivo --</option>
                          <option value="Cambio de opinión">Cambio de opinión</option>
                          <option value="Error en dirección">Error en dirección</option>
                          <option value="Precio alto">Precio alto</option>
                          <option value="Tiempo de entrega">Tiempo de entrega</option>
                          <option value="Duplicado">Duplicado</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card p-8">
        <h3 className="text-xl font-display font-bold text-white mb-6">Impacto en Rentabilidad Acumulada</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 bg-background rounded-xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-display text-slate-500 uppercase">Pérdida por Cancelaciones</span>
              <XCircle size={16} className="text-red-500" />
            </div>
            <p className="text-2xl font-mono font-bold text-white">{localFormatCurrency(stats.cancellationsCount * 10)}</p>
            <p className="text-[15px] text-slate-500 mt-1 italic">*Estimado de $10 USD en ads por cada cancelación</p>
          </div>
          <div className="p-6 bg-background rounded-xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-display text-slate-500 uppercase">Pérdida por Devoluciones</span>
              <RotateCcw size={16} className="text-orange-400" />
            </div>
            <p className="text-2xl font-mono font-bold text-white">{localFormatCurrency(stats.totalReturnCost)}</p>
            <p className="text-[15px] text-slate-500 mt-1 italic">*Incluye flete de ida, vuelta y ads perdidos</p>
          </div>
          <div className="p-6 bg-neon/5 rounded-xl border border-neon/20">
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-display text-neon uppercase">Impacto Total</span>
              <TrendingDown size={16} className="text-red-500" />
            </div>
            <p className="text-2xl font-mono font-bold text-red-400">{localFormatCurrency(stats.totalReturnCost + (stats.cancellationsCount * 10))}</p>
            <p className="text-[15px] text-slate-500 mt-1 italic">Capital drenado este mes</p>
          </div>
          <div className="p-6 bg-emerald-500/5 rounded-xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-display text-emerald-400 uppercase font-black tracking-wider">Ganancia si se Entregaran</span>
              <TrendingUp size={16} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-mono font-bold text-emerald-400">{localFormatCurrency(stats.potentialEarnedIfDelivered)}</p>
            <p className="text-[15px] text-emerald-400/80 mt-1 italic">Utilidad neta que hubieras ganado de mas</p>
          </div>
        </div>
      </div>

      {/* Historial y Gestión de Novedades de Devoluciones */}
      <div className="glass-card p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <div className="flex items-center gap-2 text-orange-400 font-bold mb-1">
              <RotateCcw size={16} />
              <span className="text-xs tracking-wider uppercase font-mono">Control Operativo</span>
            </div>
            <h3 className="text-2xl font-display font-extrabold text-white">Gestión de Novedades de Devoluciones</h3>
            <p className="text-sm text-slate-400">Registra, edita y elimina explicaciones de novedades o incidencias presentadas por transportadoras o clientes.</p>
          </div>

          <button
            onClick={() => {
              if (isFormOpen) {
                handleResetForm();
              } else {
                setIsFormOpen(true);
              }
            }}
            className={`px-5 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isFormOpen 
                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20' 
                : 'bg-gold hover:bg-gold/80 text-black shadow-lg shadow-gold/10'
            }`}
          >
            {isFormOpen ? (
              <>
                <XCircle size={16} />
                <span>Cancelar Registro</span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>Registrar Nueva Novedad</span>
              </>
            )}
          </button>
        </div>

        {/* Formulario de registro/edición de Novedades (Inline & Animado) */}
        {isFormOpen && (
          <form onSubmit={handleSubmitNovelty} className="p-6 bg-black/40 rounded-2xl border border-border/80 space-y-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-gold" />
              <h4 className="text-lg font-bold text-white uppercase tracking-wider font-display">
                {editingNovelty ? 'Editar Registro de Novedad' : 'Ingresar Nueva Novedad de Pedido'}
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Fecha */}
              <div className="space-y-2">
                <label className="block text-[14px] uppercase tracking-widest text-slate-300 font-extrabold font-display">Fecha del Suceso</label>
                <input
                  type="date"
                  required
                  value={formFecha}
                  onChange={(e) => setFormFecha(e.target.value)}
                  className="w-full bg-[#111] border border-border focus:border-gold rounded-xl px-4 py-2.5 text-white font-mono text-[14px] focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>

              {/* Mes de Registro */}
              <div className="space-y-2">
                <label className="block text-[14px] uppercase tracking-widest text-slate-300 font-extrabold font-display">Mes de Registro</label>
                <select
                  value={formMes}
                  onChange={(e) => setFormMes(e.target.value)}
                  className="w-full bg-[#111] border border-border focus:border-gold rounded-xl px-4 py-2.5 text-white text-[14px] focus:outline-none focus:ring-1 focus:ring-gold font-sans"
                >
                  <option value="" className="bg-[#111]">-- Seleccionar Mes --</option>
                  {MONTHS_SPANISH.map((m) => (
                    <option key={m} value={m} className="bg-[#111] text-white">
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pedido de referencia (Drop-down de pedidos con estado Devuelto/Incidencia) */}
              <div className="space-y-2">
                <label className="block text-[14px] uppercase tracking-widest text-slate-300 font-extrabold font-display">Vincular con Devolución</label>
                <select
                  value={selectedOrderId}
                  onChange={handleSelectOrderChange}
                  className="w-full bg-[#111] border border-border focus:border-gold rounded-xl px-4 py-2.5 text-white text-[14px] focus:outline-none focus:ring-1 focus:ring-gold"
                >
                  <option value="manual">-- INGRESO MANUAL (Sin Vincular) --</option>
                  {returnedOrdersDropdown.map((o) => (
                    <option key={o.id || o.orderId} value={o.id || o.orderId}>
                      {o.orderId} - {o.nombreCliente} ({o.product})
                    </option>
                  ))}
                </select>
              </div>

              {/* ID Pedido */}
              <div className="space-y-2">
                <label className="block text-[14px] uppercase tracking-widest text-slate-300 font-extrabold font-display">ID Pedido</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. DROP0123"
                  value={formOrderId}
                  onChange={(e) => setFormOrderId(e.target.value)}
                  className="w-full bg-[#111] border border-border focus:border-gold rounded-xl px-4 py-2.5 text-white text-[14px] focus:outline-none focus:ring-1 focus:ring-gold font-mono"
                />
              </div>

              {/* Guía de Transporte de retorno */}
              <div className="space-y-2">
                <label className="block text-[14px] uppercase tracking-widest text-slate-300 font-extrabold font-display">Guía de Transporte</label>
                <input
                  type="text"
                  placeholder="Ej. 10020439294"
                  value={formGuia}
                  onChange={(e) => setFormGuia(e.target.value)}
                  className="w-full bg-[#111] border border-border focus:border-gold rounded-xl px-4 py-2.5 text-white text-[14px] focus:outline-none focus:ring-1 focus:ring-gold font-mono"
                />
              </div>

              {/* Transportadora */}
              <div className="space-y-2">
                <label className="block text-[14px] uppercase tracking-widest text-slate-300 font-extrabold font-display">Transportadora</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ej. Servientrega, Interrapidisimo..."
                    value={formTransportadora}
                    onChange={(e) => setFormTransportadora(e.target.value)}
                    list="carriers-list"
                    className="w-full bg-[#111] border border-border focus:border-gold rounded-xl px-4 py-2.5 text-white text-[14px] focus:outline-none focus:ring-1 focus:ring-gold font-sans"
                  />
                  <datalist id="carriers-list">
                    <option value="Servientrega" />
                    <option value="Interrapidisimo" />
                    <option value="Envía" />
                    <option value="Coordinadora" />
                    <option value="Domina" />
                    <option value="TCC" />
                    <option value="99 Minutos" />
                  </datalist>
                </div>
              </div>

              {/* Producto */}
              <div className="space-y-2">
                <label className="block text-[14px] uppercase tracking-widest text-slate-300 font-extrabold font-display">Producto Relacionado</label>
                {savedProducts.length > 0 && !showManualProductInput ? (
                  <div className="relative">
                    <select
                      value={formProductName}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__MANUAL_INPUT__') {
                          setShowManualProductInput(true);
                          setFormProductName('');
                        } else {
                          setFormProductName(val);
                        }
                      }}
                      className="w-full bg-[#111] border border-border focus:border-gold rounded-xl px-4 py-2.5 text-white text-[14px] focus:outline-none focus:ring-1 focus:ring-gold font-sans"
                    >
                      <option value="">-- Seleccione un Producto --</option>
                      {savedProducts.map((p) => (
                        <option key={p.id} value={p.name} className="bg-[#111] text-white">
                          {p.name}
                        </option>
                      ))}
                      <option value="__MANUAL_INPUT__" className="bg-[#111] text-gold font-bold">
                        ✍️ Ingresar manualmente...
                      </option>
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="Ej. Mini Proyector"
                        value={formProductName}
                        onChange={(e) => setFormProductName(e.target.value)}
                        className="w-full bg-[#111] border border-border focus:border-gold rounded-xl px-4 py-2.5 text-white text-[14px] focus:outline-none focus:ring-1 focus:ring-gold font-sans"
                      />
                      {savedProducts.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowManualProductInput(false);
                            if (savedProducts.length > 0) {
                              setFormProductName(savedProducts[0].name);
                            }
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gold hover:underline font-semibold cursor-pointer"
                        >
                          Ver lista
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Nombre Cliente */}
              <div className="space-y-2">
                <label className="block text-[14px] uppercase tracking-widest text-slate-300 font-extrabold font-display">Nombre del Cliente</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Fray Rojas"
                  value={formNombreCliente}
                  onChange={(e) => setFormNombreCliente(e.target.value)}
                  className="w-full bg-[#111] border border-border focus:border-gold rounded-xl px-4 py-2.5 text-white text-[14px] focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>

              {/* Origen/Causa de Novedad */}
              <div className="space-y-2">
                <label className="block text-[14px] uppercase tracking-widest text-slate-300 font-extrabold font-display">Causa / Origen de Incidencia</label>
                <div className="space-y-2">
                  <select
                    value={formOrigenNovedad}
                    onChange={(e) => setFormOrigenNovedad(e.target.value)}
                    className="w-full bg-[#111] border border-border focus:border-gold rounded-xl px-4 py-2.5 text-white text-[14px] focus:outline-none focus:ring-1 focus:ring-gold font-sans"
                  >
                    <option value="Cliente no responde / Apagado / No contestó" className="bg-[#111] text-white">Cliente no responde / Apagado</option>
                    <option value="Dirección incorrecta / incompleta / Sin cobertura" className="bg-[#111] text-white">Dirección incorrecta / Sin cobertura</option>
                    <option value="Rechazado por precio / Falta de dinero" className="bg-[#111] text-white">Rechazado por precio / Falta de dinero</option>
                    <option value="Paquete dañado / averiado por transportadora" className="bg-[#111] text-white">Paquete dañado por transportadora</option>
                    <option value="Error en producto (Mala calidad, talla, color incorrecto)" className="bg-[#111] text-white">Error en producto (Fallas, color, talla)</option>
                    <option value="Rechazado porque demoró mucho en llegar" className="bg-[#111] text-white">Demora excesiva en entrega</option>
                    <option value="Estafa de entrega / Cliente arrepentido / No pidió" className="bg-[#111] text-white">Estafa de entrega / Cliente arrepentido / No pidió</option>
                    <option value="Otro motivo de logística" className="bg-[#111] text-white">Otro motivo de logística</option>
                    {customOrigines.map((cause, idx) => (
                      <option key={idx} value={cause} className="bg-[#111] text-cyan-400 font-sans">
                        {cause}
                      </option>
                    ))}
                  </select>

                  {/* Input to append a dynamic cause option */}
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      id="dynamic-new-cause-box"
                      placeholder="Nueva causa personalizada..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val && !customOrigines.includes(val)) {
                            setCustomOrigines(prev => [...prev, val]);
                            setFormOrigenNovedad(val);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                      className="w-full bg-[#151522] border border-border/85 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const inputEl = document.getElementById('dynamic-new-cause-box') as HTMLInputElement;
                        const val = inputEl?.value.trim();
                        if (val && !customOrigines.includes(val)) {
                          setCustomOrigines(prev => [...prev, val]);
                          setFormOrigenNovedad(val);
                          inputEl.value = '';
                        }
                      }}
                      className="px-3 py-1.5 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/25 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer"
                    >
                      + Agregar
                    </button>
                  </div>
                </div>
              </div>

              {/* Estado / Acción actual */}
              <div className="space-y-2 md:col-span-1">
                <label className="block text-[14px] uppercase tracking-widest text-slate-300 font-extrabold font-display">Estado del Proceso (Acción)</label>
                <select
                  value={formResolucion}
                  onChange={(e) => setFormResolucion(e.target.value)}
                  className="w-full bg-[#111] border border-border focus:border-gold rounded-xl px-4 py-2.5 text-white text-[14px] focus:outline-none focus:ring-1 focus:ring-gold font-sans"
                >
                  <option value="🟡 En Proceso de Retorno / Bodega" className="bg-[#111] text-white">🟡 En Proceso de Retorno / Bodega</option>
                  <option value="🔄 Devolución" className="bg-[#111] text-orange-400">🔄 Devolución</option>
                  <option value="⚡ Devolución Express Center" className="bg-[#111] text-amber-400">⚡ Devolución Express Center</option>
                  <option value="🔴 Pérdida Total (Paquete destruido/hurtado)" className="bg-[#111] text-red-500">🔴 Pérdida Total (Paquete destruido/hurtado)</option>
                  <option value="🟢 Re-despachado con éxito (Segundo intento)" className="bg-[#111] text-[#22c55e]">🟢 Re-despachado con éxito (Segundo intento)</option>
                  <option value="🔵 Entregado con descuento / Acuerdo de precio" className="bg-[#111] text-blue-400">🔵 Entregado con descuento / Acuerdo de precio</option>
                  <option value="📦 Retorno recibido y verificado en bodega" className="bg-[#111] text-cyan-400 font-sans">📦 Retorno recibido y verificado en bodega</option>
                  <option value="⚙️ En gestión con transporte / Reclamo" className="bg-[#111] text-slate-400 font-sans">⚙️ En gestión con transporte / Reclamo</option>
                </select>
              </div>

              {/* Etiqueta por Devolución */}
              <div className="space-y-2 md:col-span-1">
                <label className="block text-[14px] uppercase tracking-widest text-slate-300 font-extrabold font-display">Etiqueta por Devolución</label>
                <select
                  value={formEtiquetaDevolucion}
                  onChange={(e) => setFormEtiquetaDevolucion(e.target.value)}
                  className="w-full bg-[#111] border border-border focus:border-gold rounded-xl px-4 py-2.5 text-white text-[14px] focus:outline-none focus:ring-1 focus:ring-gold font-sans"
                >
                  <option value="" className="bg-[#111] text-slate-500">-- Ninguna / Sin Etiqueta --</option>
                  <option value="TIK TOK ORGANICO" className="bg-[#111] text-neon font-bold">TIK TOK ORGANICO</option>
                  <option value="RECORDAR EXPRES CENT" className="bg-[#111] text-sky-450 font-bold">RECORDAR EXPRES CENT</option>
                  <option value="PEDIR BIEN DEPAR-CIU" className="bg-[#111] text-pink-450 font-bold">PEDIR BIEN DEPAR-CIU</option>
                  <option value="PRUEBA" className="bg-[#111] text-yellow-450 font-bold">PRUEBA</option>
                  <option value="DATOS INCORR-BUZON" className="bg-[#111] text-purple-450 font-bold">DATOS INCORR-BUZON</option>
                  <option value="CLIENTE NO CONTESTA" className="bg-[#111] text-red-455 font-bold">CLIENTE NO CONTESTA</option>
                </select>
              </div>

              {/* Descripción detallada */}
              <div className="space-y-2 md:col-span-3">
                <label className="block text-[14px] uppercase tracking-widest text-slate-300 font-extrabold font-display">Explicación por qué surgió la novedad (Copia chat o detalle)</label>
                <textarea
                  required
                  placeholder="Detalla detalladamente qué causó la novedad. Ej: La transportadora reprogramó la entrega 2 veces..."
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  rows={2.5}
                  className="w-full bg-[#111] border border-border focus:border-gold rounded-xl px-4 py-2.5 text-white text-[14px] focus:outline-none focus:ring-1 focus:ring-gold resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-5 py-2 hover:bg-white/5 text-slate-400 font-semibold rounded-xl text-sm transition-all"
              >
                Limpiar todo
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-[#22c55e] to-emerald-400 hover:from-[#16a34a] hover:to-emerald-500 text-black font-bold rounded-xl text-sm transition-all shadow-lg active:scale-95 cursor-pointer"
              >
                {editingNovelty ? 'Guardar Cambios' : 'Guardar Novedad de Devolución'}
              </button>
            </div>
          </form>
        )}

        {/* Tabla / Lista de Novedades registradas */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h4 className="text-base font-bold font-display text-white uppercase tracking-wider">
              Historial de Novedades Registradas ({filteredNovelties.length})
            </h4>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              {/* Filtro de ETIQUETAS */}
              <div className="flex items-center gap-2 bg-[#0c0c14] border border-border rounded-xl px-3 py-1.5 h-8">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Etiqueta de Pedido:</span>
                <select 
                  value={noveltyTagFilter}
                  onChange={(e) => setNoveltyTagFilter(e.target.value)}
                  className="bg-transparent border-none p-0 text-xs font-bold text-gold uppercase focus:outline-none focus:ring-0 cursor-pointer h-full"
                >
                  <optgroup label="PRINCIPALES" className="bg-[#111] text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                    <option value="TODOS" className="bg-[#111] text-white">TODAS</option>
                    <option value="SIN ETIQUETA" className="bg-[#111] text-[#ef4444]">SIN ETIQUETA</option>
                    <option value="TIK_TOK_ORGANICO" className="bg-[#111] text-neon">TIK TOK ORGANICO</option>
                  </optgroup>
                  {availableTags.length > 0 && (
                    <optgroup label="OTRAS ETIQUETAS" className="bg-[#111] text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                      {availableTags.map(tag => (
                        <option key={tag} value={tag} className="bg-[#111] text-sky-400">
                          {tag.toUpperCase()}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Filtro de ETIQUETA POR DEVOLUCION */}
              <div className="flex items-center gap-2 bg-[#0c0c14] border border-border rounded-xl px-3 py-1.5 h-8">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Etiqueta Devolución:</span>
                <select 
                  value={noveltyDevolucionFilter}
                  onChange={(e) => setNoveltyDevolucionFilter(e.target.value)}
                  className="bg-transparent border-none p-0 text-xs font-bold text-gold uppercase focus:outline-none focus:ring-0 cursor-pointer h-full"
                >
                  <option value="TODOS" className="bg-[#111] text-white">TODAS</option>
                  <option value="SIN_ETIQUETA" className="bg-[#111] text-[#ef4444]">SIN ETIQUETA</option>
                  <option value="TIK TOK ORGANICO" className="bg-[#111] text-neon">TIK TOK ORGANICO</option>
                  <option value="RECORDAR EXPRES CENT" className="bg-[#111] text-sky-400">RECORDAR EXPRES CENT</option>
                  <option value="PEDIR BIEN DEPAR-CIU" className="bg-[#111] text-pink-400">PEDIR BIEN DEPAR-CIU</option>
                  <option value="PRUEBA" className="bg-[#111] text-yellow-450">PRUEBA</option>
                  <option value="DATOS INCORR-BUZON" className="bg-[#111] text-purple-400">DATOS INCORR-BUZON</option>
                  <option value="CLIENTE NO CONTESTA" className="bg-[#111] text-red-400">CLIENTE NO CONTESTA</option>
                </select>
              </div>

              {/* Búsqueda de novedad */}
              <div className="relative w-full sm:w-64 h-8 flex items-center">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                  <Search size={15} />
                </span>
                <input
                  type="text"
                  placeholder="Buscar novedad..."
                  value={noveltySearch}
                  onChange={(e) => setNoveltySearch(e.target.value)}
                  className="w-full bg-background/60 border border-border rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold font-sans h-full"
                />
              </div>
            </div>
          </div>

          {noveltiesLoading ? (
            <div className="flex items-center justify-center p-12 bg-black/10 rounded-xl border border-border/40">
              <Loader2 size={32} className="animate-spin text-gold mr-3" />
              <span className="text-slate-400 text-sm font-mono">Sincronizando base de datos de control...</span>
            </div>
          ) : filteredNovelties.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-[#0c0c12]/30 rounded-2xl border border-dashed border-border text-center space-y-3">
              <AlertCircle size={36} className="text-slate-600" />
              <div>
                <p className="text-base font-medium text-slate-300">No hay novedades registradas</p>
                <p className="text-xs text-slate-500 mt-1">
                  {noveltySearch ? 'Prueba cambiando tus términos de búsqueda.' : 'Registra la explicación de por qué surgen tus novedades de entrega o retorno justo arriba.'}
                </p>
              </div>
              {!isFormOpen && (
                <button
                  type="button"
                  onClick={() => setIsFormOpen(true)}
                  className="px-4 py-2 border border-gold/20 hover:border-gold/40 text-gold hover:bg-gold/5 font-semibold text-xs rounded-xl transition-all"
                >
                  Comenzar Primer Registro
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto border border-border rounded-2xl bg-[#08080f]/50">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background border-b border-border/80 text-[14px]">
                    <th className="px-5 py-4 text-[14px] uppercase tracking-widest text-slate-400 font-extrabold font-display">Fecha</th>
                    <th className="px-5 py-4 text-[14px] uppercase tracking-widest text-slate-400 font-extrabold font-display">Mes</th>
                    <th className="px-5 py-4 text-[14px] uppercase tracking-widest text-slate-400 font-extrabold font-display">ID Pedido</th>
                    <th className="px-5 py-4 text-[14px] uppercase tracking-widest text-slate-400 font-extrabold font-display">Guía / Tracking</th>
                    <th className="px-5 py-4 text-[14px] uppercase tracking-widest text-slate-400 font-extrabold font-display">Cliente / Producto</th>
                    <th className="px-5 py-4 text-[14px] uppercase tracking-widest text-slate-400 font-extrabold font-display">Etiqueta Devolución</th>
                    <th className="px-5 py-4 text-[14px] uppercase tracking-widest text-slate-400 font-extrabold font-display">Transportadora</th>
                    <th className="px-5 py-4 text-[14px] uppercase tracking-widest text-slate-400 font-extrabold font-display">Incidencia / Causa</th>
                    <th className="px-5 py-4 text-[14px] uppercase tracking-widest text-slate-400 font-extrabold font-display">Explicación Suceso</th>
                    <th className="px-5 py-4 text-[14px] uppercase tracking-widest text-slate-400 font-extrabold font-display">Estado Acción</th>
                    <th className="px-5 py-4 text-[14px] uppercase tracking-widest text-slate-400 font-extrabold font-display text-right w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredNovelties.map((item) => {
                    // Pre-generate nice tag styling based on causes
                    let causeStyle = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                    if (item.origenNovedad.includes('Transporte') || item.origenNovedad.includes('transportadora')) {
                      causeStyle = 'bg-red-500/10 text-red-400 border-red-500/20';
                    } else if (item.origenNovedad.includes('Error en producto')) {
                      causeStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                    } else if (item.origenNovedad.includes('Cliente no responde')) {
                      causeStyle = 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
                    }

                    // Resolution status labels
                    let resStyle = 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
                    if (item.resolucion.includes('🟢')) {
                      resStyle = 'bg-emerald-500/10 text-[#22c55e] border border-emerald-500/20';
                    } else if (item.resolucion.includes('🟡')) {
                      resStyle = 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
                    } else if (item.resolucion.includes('🔴')) {
                      resStyle = 'bg-red-500/10 text-red-500 border border-red-500/20';
                    } else if (item.resolucion.includes('📦')) {
                      resStyle = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
                    } else if (item.resolucion.includes('🔄') || item.resolucion === 'Devolución') {
                      resStyle = 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
                    } else if (item.resolucion.includes('⚡') || item.resolucion === 'Devolución Express Center') {
                      resStyle = 'bg-amber-500/10 text-gold border border-gold/20';
                    }

                    return (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar size={15} className="text-slate-500" />
                            <span className="text-[14px] text-slate-300 font-mono">{item.fecha}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-[14px] text-amber-400 font-semibold font-display">
                            {item.mes || getMonthFromDate(item.fecha) || 'Sin Mes'}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-[14px] font-mono font-bold text-white block truncate">{item.orderId || "M-MANUAL"}</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-[14px] font-mono font-medium text-cyan-300 block truncate">{item.guia || "Sin Guía"}</span>
                        </td>
                        <td className="px-5 py-4 max-w-[200px]">
                          <div>
                            <span className="text-[14px] text-slate-300 block truncate font-medium">{item.nombreCliente}</span>
                            {item.productName && (
                              <span className="text-[13px] text-slate-500 block italic truncate">{item.productName}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {item.etiquetaDevolucion ? (
                            <span 
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                                item.etiquetaDevolucion === 'TIK TOK ORGANICO'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : item.etiquetaDevolucion === 'RECORDAR EXPRES CENT'
                                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                  : item.etiquetaDevolucion === 'PEDIR BIEN DEPAR-CIU'
                                  ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                                  : item.etiquetaDevolucion === 'PRUEBA'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : item.etiquetaDevolucion === 'DATOS INCORR-BUZON'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}
                            >
                              {item.etiquetaDevolucion}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs italic font-sans">— Sin Etiqueta —</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-[14px] text-cyan-400 font-semibold bg-cyan-950/20 px-2.5 py-1 rounded-lg border border-cyan-500/10 block text-center max-w-[150px] truncate">
                            {item.transportadora || 'No especificada'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[13px] uppercase tracking-wider border font-semibold ${causeStyle} max-w-[180px] inline-block truncate`}>
                            {item.origenNovedad}
                          </span>
                        </td>
                        <td className="px-5 py-4 max-w-[320px]">
                          <p className="text-[14px] text-slate-300 whitespace-pre-wrap break-words leading-relaxed">{item.descripcion}</p>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-[13px] uppercase tracking-wider font-semibold ${resStyle}`}>
                            {item.resolucion.replace(/[🟡🔴🟢🔵📦⚙️🔄⚡]\s*/g, '')}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right text-xs">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => handleEditNovelty(item)}
                              title="Editar Novedad"
                              className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteNovelty(item.id)}
                              title="Eliminar Novedad"
                              className="p-1.5 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* AI PRO LOGISTICS ANALYST DASHBOARD SECTOR (DEBAJO DE TODO) */}
      <div id="ai-logistics-analyst-panel" className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl overflow-hidden p-8 space-y-6 shadow-2xl relative">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Brain size={180} className="text-emerald-400" />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
              <Sparkles size={16} className="animate-spin" style={{ animationDuration: '6s' }} />
              <span className="text-xs tracking-wider uppercase font-mono">IA PRO Inteligencia Logística</span>
            </div>
            <h3 className="text-2xl font-display font-extrabold text-white">Análisis Avanzado con Gemini PRO</h3>
            <p className="text-[15px] text-slate-400">Analiza en profundidad causas raíces de cancelaciones, devoluciones e incidencias por demografía (direcciones, ciudades y departamentos) de inmediato.</p>
          </div>
          
          <button
            onClick={handleAIAnalysis}
            disabled={aiLoading}
            id="ai-generate-reports-btn"
            className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            {aiLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Cpu size={18} />
            )}
            <span>{aiResult ? "Volver a Analizar con IA Pro" : "Iniciar Análisis Inteligente Pro"}</span>
          </button>
        </div>

        {/* Loading Indicator with Reassurance Steps */}
        {aiLoading && (
          <div className="mt-6 p-8 bg-black/60 rounded-xl border border-emerald-500/25 flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 size={40} className="text-emerald-400 animate-spin" />
            <div>
              <p className="text-[17px] font-semibold text-white tracking-wide">Analizando comportamiento logístico...</p>
              <p className="text-sm text-slate-400 mt-1 italic animate-pulse">"{loadingMessages[loadingStep]}"</p>
            </div>
            <div className="w-1/3 bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-400 h-full transition-all duration-500" 
                style={{ width: `${((loadingStep + 1) / loadingMessages.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error State */}
        {aiError && (
          <div className="mt-6 p-6 bg-red-950/40 border border-red-500/20 rounded-xl text-red-200">
            <div className="flex items-center gap-3 mb-2 font-bold text-red-400">
              <AlertTriangle size={20} />
              <span>Ocurrió un inconveniente</span>
            </div>
            <p className="text-[15px]">{aiError}</p>
            <p className="text-xs text-slate-500 mt-2">Nota: Asegúrate de habilitar tus credenciales en Ajustes &gt; Secretos para habilitar las consultas de IA.</p>
          </div>
        )}

        {/* AI Result Report Panel with Real-time Recharts charts generated entirely from the intelligent analysis */}
        {aiResult && !aiLoading && (
          <div className="mt-8 space-y-8 animate-fade-in divide-y divide-border/60">
            
            {/* Markdown Report Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
              <div className="glass-card p-8 bg-black/30 border-emerald-500/10 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 font-bold mb-4">
                    <Brain size={18} />
                    <span className="text-sm tracking-wider uppercase font-mono">Reporte Analítico Copiloto</span>
                  </div>
                  
                  <div className="prose prose-invert max-w-none text-slate-300 text-[15px] leading-relaxed space-y-4">
                    {parsedSections.length > 0 ? (
                      <div className="space-y-6">
                        {/* Interactive Tab Selectors */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-b border-white/5 pb-4">
                          {parsedSections.map((section, idx) => {
                            const isSelected = activeTab === idx;
                            const icons = [
                              <TrendingUp size={14} className="text-emerald-400 shrink-0" />,
                              <BarChart3 size={14} className="text-emerald-400 shrink-0" />,
                              <Brain size={14} className="text-emerald-400 shrink-0" />,
                              <Sparkles size={14} className="text-emerald-400 shrink-0" />
                            ];
                            const icon = icons[idx % icons.length];
                            
                            return (
                              <button
                                key={idx}
                                onClick={() => setActiveTab(idx)}
                                className={`flex items-center gap-1.5 justify-center py-2 px-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-300 border cursor-pointer ${
                                  isSelected 
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.08)]' 
                                    : 'bg-black/50 border-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-950/60'
                                }`}
                              >
                                {icon}
                                <span className="truncate">{section.title}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Active Section Content Container */}
                        <div className="bg-black/40 p-5 rounded-xl border border-slate-900 prose prose-invert max-w-none text-slate-300 text-[15px] leading-relaxed min-h-[220px]">
                          <Markdown
                            components={{
                              h1: ({ ...props }) => <h3 className="text-base font-extrabold font-display text-white mt-1 mb-3 border-l-4 border-emerald-500 pl-3 uppercase tracking-wider" {...props} />,
                              h2: ({ ...props }) => <h4 className="text-sm font-bold font-display text-emerald-400 mt-4 mb-2 uppercase tracking-wide" {...props} />,
                              h3: ({ ...props }) => <h5 className="text-xs font-bold font-display text-emerald-400 mt-3 mb-1 uppercase tracking-wider" {...props} />,
                              p: ({ ...props }) => <p className="text-[13px] text-slate-300 leading-relaxed mb-3" {...props} />,
                              ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-1.5 my-3 text-slate-300 marker:text-emerald-400" {...props} />,
                              ol: ({ ...props }) => <ol className="list-decimal pl-5 space-y-1.5 my-3 text-slate-300 marker:text-emerald-400" {...props} />,
                              li: ({ ...props }) => <li className="text-[13px] leading-relaxed text-slate-300 pl-1" {...props} />,
                              strong: ({ ...props }) => <strong className="font-semibold text-emerald-300 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/10" {...props} />,
                              code: ({ ...props }) => <code className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs font-mono text-emerald-400" {...props} />,
                              hr: () => <hr className="my-4 border-slate-900" />,
                            }}
                          >
                            {parsedSections[activeTab]?.rawContent || ""}
                          </Markdown>
                        </div>
                      </div>
                    ) : (
                      <Markdown
                        components={{
                          h1: ({ ...props }) => <h3 className="text-lg font-extrabold font-display text-white mt-6 mb-3 border-l-4 border-emerald-500 pl-3 uppercase tracking-wider" {...props} />,
                          h2: ({ ...props }) => <h4 className="text-base font-bold font-display text-emerald-400 mt-5 mb-2 uppercase tracking-wide" {...props} />,
                          h3: ({ ...props }) => <h5 className="text-[15px] font-bold font-display text-emerald-400 mt-4 mb-2 uppercase tracking-wider" {...props} />,
                          p: ({ ...props }) => <p className="text-[14px] text-slate-300 leading-relaxed mb-4" {...props} />,
                          ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-2 my-4 text-slate-300 marker:text-emerald-400" {...props} />,
                          ol: ({ ...props }) => <ol className="list-decimal pl-5 space-y-2 my-4 text-slate-300 marker:text-emerald-400" {...props} />,
                          li: ({ ...props }) => <li className="text-[14px] leading-relaxed text-slate-300 pl-1" {...props} />,
                          strong: ({ ...props }) => <strong className="font-semibold text-emerald-300 bg-emerald-500/5 px-1 py-0.5 rounded border border-emerald-500/10" {...props} />,
                          code: ({ ...props }) => <code className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs font-mono text-emerald-400" {...props} />,
                          hr: () => <hr className="my-6 border-slate-800" />,
                        }}
                      >
                        {aiResult.analysisText}
                      </Markdown>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-emerald-500/15 flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>MODELO: gemini-3.5-flash-pro</span>
                  <span>PREDICTIVO: ALTO RANGO</span>
                </div>
              </div>

              {/* Recommendations Score Dashboard */}
              <div className="glass-card p-8 bg-black/30 border-emerald-500/10 space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                    <CheckCircle size={18} />
                    <span className="text-sm tracking-wider uppercase font-mono">Plan de Acción & Urgencia</span>
                  </div>
                  <p className="text-xs text-slate-500">Métricas de impacto correctivo calculadas dinámicamente por la IA</p>
                </div>

                <div className="space-y-5">
                  {aiResult.charts?.recommendations?.map((rec: any, idx: number) => {
                    const barColors = ['bg-emerald-500', 'bg-orange-500', 'bg-sky-500', 'bg-teal-500', 'bg-amber-500'];
                    const colorClass = barColors[idx % barColors.length];
                    return (
                      <div key={idx} className="space-y-1.5 p-3 rounded-lg border border-border bg-black/20 hover:border-emerald-500/20 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-base font-medium text-white">{rec.aspect}</span>
                          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            Impacto: {rec.score}%
                          </span>
                        </div>
                        <p className="text-[13px] text-slate-500 italic">Estrategia: {rec.label}</p>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                          <div className={`h-full ${colorClass}`} style={{ width: `${rec.score}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  
                  {(!aiResult.charts?.recommendations || aiResult.charts.recommendations.length === 0) && (
                    <p className="text-sm text-slate-600">No se recuperaron metas recomendadas en este rango.</p>
                  )}
                </div>
              </div>
            </div>

            {/* REAL GRAPHICS DEBAJO DE TODO */}
            <div className="pt-8 space-y-8">
              <div>
                <h4 className="text-xl font-display font-medium text-white">Visualizaciones Logísticas Estructuradas por IA</h4>
                <p className="text-sm text-slate-500">Representaciones gráficas basadas en el cruce de datos de la sección de devoluciones analizada por la Inteligencia Artificial.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Chart 1: Carrier Incidents */}
                <div className="glass-card p-6 !bg-black border border-slate-900 shadow-[0_0_25px_rgba(0,0,0,0.9)]">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-[15px] font-bold text-white uppercase tracking-wider font-display">Tasa de Incidencias por Transportadora</h5>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Transportadoras</span>
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiResult.charts?.carriers || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} />
                        <YAxis stroke="#888" fontSize={12} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000000', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
                          cursor={{ fill: 'rgba(0, 0, 0, 0.5)' }}
                        />
                        <Legend />
                        <Bar dataKey="total" fill="#3b82f6" name="Total Incidencias" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="devuelto" fill="#f97316" name="Devueltos / Pérdida" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="reintento" fill="#eab308" name="En Retorno" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="solucionado" fill="#22c55e" name="Solucionados" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Monthly Incidents */}
                <div className="glass-card p-6 !bg-black border border-slate-900 shadow-[0_0_25px_rgba(0,0,0,0.9)]">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-[15px] font-bold text-white uppercase tracking-wider font-display">Distribución Temporal de Novedades por Mes</h5>
                    <span className="text-[11px] font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">Historial Mensual</span>
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiResult.charts?.months || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} />
                        <YAxis stroke="#888" fontSize={12} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000000', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
                          cursor={{ fill: 'rgba(0, 0, 0, 0.5)' }}
                        />
                        <Legend />
                        <Bar dataKey="total" fill="#3b82f6" name="Total Novedades" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="devuelto" fill="#f97316" name="Devueltos" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="solucionado" fill="#22c55e" name="Solucionados" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 3: Frequent Causes (Causales) */}
                <div className="glass-card p-6 !bg-black border border-slate-900 lg:col-span-2 shadow-[0_0_25px_rgba(0,0,0,0.9)]">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-[15px] font-bold text-white uppercase tracking-wider font-display">Principales Causales de Retorno / Novedad</h5>
                    <span className="text-[11px] font-mono text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">Causas Frecuentes</span>
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiResult.charts?.causes || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis type="number" stroke="#888" fontSize={12} tickLine={false} />
                        <YAxis dataKey="name" type="category" stroke="#888" fontSize={12} tickLine={false} width={180} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000000', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
                          cursor={{ fill: 'rgba(0, 0, 0, 0.5)' }}
                        />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#f5c842" name="Volumen de Casos" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 4: Explanations of Noveltity/Success event descriptions */}
                <div className="glass-card p-6 !bg-black border border-slate-900 lg:col-span-2 shadow-[0_0_25px_rgba(0,0,0,0.9)]">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-[15px] font-bold text-white uppercase tracking-wider font-display">Incidencias por Explicación del Suceso</h5>
                    <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">Explicación Detallada (IA NLP)</span>
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiResult.charts?.explanations || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis type="number" stroke="#888" fontSize={12} tickLine={false} />
                        <YAxis dataKey="name" type="category" stroke="#888" fontSize={11} tickLine={false} width={200} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000000', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}
                          cursor={{ fill: 'rgba(0, 0, 0, 0.5)' }}
                        />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#a855f7" name="Casos por Explicación" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default ReturnsAnalysis;
