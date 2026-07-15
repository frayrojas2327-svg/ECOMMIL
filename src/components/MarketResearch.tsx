import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  Edit2,
  Link as LinkIcon, 
  Video, 
  FileText, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Package,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Target,
  Sparkles,
  Download,
  Lightbulb,
  Check,
  CheckCircle2,
  PlusCircle,
  MinusCircle,
  AlertCircle,
  Smartphone,
  Globe,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, deleteDoc, addDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isFirebaseConfigValid } from '../firebase';
import { useAuth } from './Auth';

export interface ChecklistItem {
  id: string;
  text: string;
  description?: string;
  completed: boolean;
}

export interface MarketResearchEntry {
  id: string;
  uid: string;
  productName: string;
  price?: number;
  currency?: string;
  dropiId?: string;
  channel?: 'WhatsApp' | 'Landing';
  competitorsCount?: number;
  storeUrls: string[];
  videoUrls: string[];
  notes: string;
  angles?: string[];
  checklist?: ChecklistItem[];
  progress?: number;
  timestamp: number;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: '1', text: 'Proveedor Validado', description: 'Encontrar un proveedor local viable con stock garantizado.', completed: false },
  { id: '2', text: 'Videos de Ads Listos', description: 'Descargar creativos ganadores y editar ganchos principales.', completed: false },
  { id: '3', text: 'Embudo Configurado', description: 'Crear Landing Page atractiva o configurar enlace de WhatsApp.', completed: false },
  { id: '4', text: 'Precio de Venta Definido', description: 'Establecer precio competitivo basado en el mercado.', completed: false },
  { id: '5', text: 'Estrategia & Copys Listos', description: 'Redactar ofertas rompedoras (1+1, 2+1) y preparar campañas en Ads.', completed: false },
  { id: '6', text: 'Stock Asegurado con Importador', description: 'Validar disponibilidad con el importador para evitar quiebres.', completed: false },
];

const SUGGESTED_ANGLES = [
  'Solución de un Dolor',
  'Ahorro de Tiempo / Facilidad',
  'Efecto Guau / Novedad',
  'Oferta Irresistible / Descuento',
  'Salud / Cuidado Personal',
  'Regalo Perfecto / Familia',
  'Confianza / Pago Contra Entrega',
  'Seguridad / Garantía'
];

const CURRENCY_OPTIONS = [
  'co $ - Peso colombiano ($)',
  'mx $ - Peso mexicano ($)',
  'cl $ - Peso chileno ($)',
  'pe S/ - Sol peruano (S/)',
  'ec $ - Dólar ecuatoriano ($)',
  'us $ - Dólar estadounidense ($)'
];

export default function MarketResearch() {
  const { user, isDemoMode } = useAuth();
  const [researchList, setResearchList] = useState<MarketResearchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [textSize, setTextSize] = useState<number>(18);

  // Active Workspace / Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [suggestedPrice, setSuggestedPrice] = useState('');
  const [currency, setCurrency] = useState('co $ - Peso colombiano ($)');
  const [dropiId, setDropiId] = useState('');
  const [salesChannel, setSalesChannel] = useState<'WhatsApp' | 'Landing'>('WhatsApp');
  const [directCompetitors, setDirectCompetitors] = useState(3);
  const [notes, setNotes] = useState('');

  // Stores and Videos lists
  const [storeUrls, setStoreUrls] = useState<string[]>([]);
  const [storeUrlInput, setStoreUrlInput] = useState('');
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [videoUrlInput, setVideoUrlInput] = useState('');

  // Marketing communication angles
  const [selectedAngles, setSelectedAngles] = useState<string[]>([]);
  const [customAngleInput, setCustomAngleInput] = useState('');

  // Checklist state
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newChecklistDesc, setNewChecklistDesc] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [editingTaskDesc, setEditingTaskDesc] = useState('');

  // Pomodoro state
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timeRemaining, setTimeRemaining] = useState(25 * 60);
  const [timerIsActive, setTimerIsActive] = useState(false);
  const [timerMode, setTimerMode] = useState<'work' | 'break'>('work');
  const [focusTask, setFocusTask] = useState('Busca nuevos productos');
  const [completedPomodoros, setCompletedPomodoros] = useState(0);

  // Search History State
  const [searchHistoryTerm, setSearchHistoryTerm] = useState('');

  // Load from LocalStorage if demo/no firebase config
  useEffect(() => {
    if ((isDemoMode || !isFirebaseConfigValid) && !user) {
      const saved = localStorage.getItem('ecommil_market_research_items');
      if (saved) {
        setResearchList(JSON.parse(saved));
      }
      setLoading(false);
    }
  }, [user, isDemoMode]);

  // Load from Firestore
  useEffect(() => {
    if (!user || !isFirebaseConfigValid || isDemoMode) return;
    if (!db) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'market_research'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as MarketResearchEntry[];
      
      setResearchList(data.sort((a, b) => b.timestamp - a.timestamp));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'market_research');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, isDemoMode]);

  // Save to LocalStorage changes in Demo
  useEffect(() => {
    if (isDemoMode || !isFirebaseConfigValid) {
      localStorage.setItem('ecommil_market_research_items', JSON.stringify(researchList));
    }
  }, [researchList, isDemoMode]);

  // Pomodoro Interval Timer Tick
  useEffect(() => {
    let interval: any = null;
    if (timerIsActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    } else if (timeRemaining === 0 && timerIsActive) {
      setTimerIsActive(false);
      playCompletionSound();
      if (timerMode === 'work') {
        setCompletedPomodoros(prev => prev + 1);
        setTimerMode('break');
        setTimerMinutes(5);
        setTimeRemaining(5 * 60);
        alert('🎯 ¡Sesión Pomodoro Terminada! Tómate un descanso de 5 minutos.');
      } else {
        setTimerMode('work');
        setTimerMinutes(25);
        setTimeRemaining(25 * 60);
        alert('💪 ¡Descanso Terminado! De vuelta al enfoque.');
      }
    }
    return () => clearInterval(interval);
  }, [timerIsActive, timeRemaining, timerMode]);

  // Sound beep function on timer completion
  const playCompletionSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
      oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.3); // G5
      oscillator.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.45); // C6
      
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.8);
    } catch (e) {
      console.error(e);
    }
  };

  const testAlertSound = () => {
    playCompletionSound();
  };

  // Timer controls helpers
  const adjustTimerDuration = (delta: number) => {
    const newVal = Math.max(1, Math.min(120, timerMinutes + delta));
    setTimerMinutes(newVal);
    if (!timerIsActive) {
      setTimeRemaining(newVal * 60);
    }
  };

  const handleSliderChange = (val: number) => {
    setTimerMinutes(val);
    if (!timerIsActive) {
      setTimeRemaining(val * 60);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const toggleTimer = () => {
    setTimerIsActive(!timerIsActive);
  };

  const resetTimer = (mins: number) => {
    setTimerIsActive(false);
    setTimeRemaining(mins * 60);
  };

  // Text size control helpers
  const adjustTextSize = (delta: number) => {
    setTextSize(prev => Math.max(12, Math.min(20, prev + delta)));
  };

  // Form URL list helpers
  const handleAddStoreUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!storeUrlInput.trim()) return;
    let url = storeUrlInput.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    if (!storeUrls.includes(url)) {
      setStoreUrls(prev => [...prev, url]);
    }
    setStoreUrlInput('');
  };

  const handleRemoveStoreUrl = (index: number) => {
    setStoreUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddVideoUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!videoUrlInput.trim()) return;
    let url = videoUrlInput.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    if (!videoUrls.includes(url)) {
      setVideoUrls(prev => [...prev, url]);
    }
    setVideoUrlInput('');
  };

  const handleRemoveVideoUrl = (index: number) => {
    setVideoUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Angle helpers
  const toggleAngle = (angle: string) => {
    if (selectedAngles.includes(angle)) {
      setSelectedAngles(prev => prev.filter(a => a !== angle));
    } else {
      setSelectedAngles(prev => [...prev, angle]);
    }
  };

  const handleAddCustomAngle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAngleInput.trim()) return;
    const val = customAngleInput.trim();
    if (!selectedAngles.includes(val)) {
      setSelectedAngles(prev => [...prev, val]);
    }
    setCustomAngleInput('');
  };

  // Checklist progress calculator
  const progressPercentage = useMemo(() => {
    if (checklist.length === 0) return 0;
    const completed = checklist.filter(t => t.completed).length;
    return Math.round((completed / checklist.length) * 100);
  }, [checklist]);

  // Checklist handlers
  const toggleChecklistCompleted = (id: string) => {
    setChecklist(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleAddCustomTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;
    const newTask: ChecklistItem = {
      id: Math.random().toString(36).substring(2, 9),
      text: newChecklistText.trim(),
      description: newChecklistDesc.trim() || undefined,
      completed: false
    };
    setChecklist(prev => [...prev, newTask]);
    setNewChecklistText('');
    setNewChecklistDesc('');
  };

  const startEditingTask = (task: ChecklistItem) => {
    setEditingTaskId(task.id);
    setEditingTaskText(task.text);
    setEditingTaskDesc(task.description || '');
  };

  const saveEditingTask = () => {
    if (!editingTaskText.trim()) return;
    setChecklist(prev => prev.map(t => t.id === editingTaskId ? { ...t, text: editingTaskText.trim(), description: editingTaskDesc.trim() || undefined } : t));
    setEditingTaskId(null);
  };

  const deleteChecklistItem = (id: string) => {
    setChecklist(prev => prev.filter(t => t.id !== id));
  };

  // Clear active form
  const handleClearForm = () => {
    setEditingId(null);
    setProductName('');
    setSuggestedPrice('');
    setCurrency('co $ - Peso colombiano ($)');
    setDropiId('');
    setSalesChannel('WhatsApp');
    setDirectCompetitors(3);
    setNotes('');
    setStoreUrls([]);
    setStoreUrlInput('');
    setVideoUrls([]);
    setVideoUrlInput('');
    setSelectedAngles([]);
    setChecklist(DEFAULT_CHECKLIST);
    setNewChecklistText('');
    setNewChecklistDesc('');
    setEditingTaskId(null);
    setCustomAngleInput('');
  };

  // Save Research Item
  const handleSaveResearch = async () => {
    if (!productName.trim()) {
      alert('Por favor, ingresa el nombre del producto.');
      return;
    }

    const calculatedProgress = progressPercentage;
    const entryData = {
      uid: user?.uid || 'demo-user',
      productName: productName.trim(),
      price: parseFloat(suggestedPrice) || 0,
      currency,
      dropiId: dropiId.trim(),
      channel: salesChannel,
      competitorsCount: directCompetitors,
      storeUrls,
      videoUrls,
      notes: notes.trim(),
      angles: selectedAngles,
      checklist,
      progress: calculatedProgress,
      timestamp: Date.now()
    };

    if (isDemoMode || !isFirebaseConfigValid) {
      if (editingId) {
        setResearchList(prev => prev.map(item => item.id === editingId ? { ...item, ...entryData } : item));
      } else {
        const newEntry = { ...entryData, id: Math.random().toString(36).substring(2, 9) } as any;
        setResearchList(prev => [newEntry, ...prev]);
      }
      alert('Investigación guardada con éxito.');
      handleClearForm();
      return;
    }

    if (!db) return;
    try {
      if (editingId) {
        const ref = doc(db, 'market_research', editingId);
        await setDoc(ref, entryData, { merge: true });
        alert('Investigación actualizada con éxito.');
      } else {
        await addDoc(collection(db, 'market_research'), entryData);
        alert('Investigación registrada con éxito.');
      }
      handleClearForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'market_research');
    }
  };

  // Load selected entry for edit
  const loadResearchEntry = (item: any) => {
    setEditingId(item.id);
    setProductName(item.productName || '');
    setSuggestedPrice(item.price ? String(item.price) : '');
    setCurrency(item.currency || 'co $ - Peso colombiano ($)');
    setDropiId(item.dropiId || '');
    setSalesChannel(item.channel || 'WhatsApp');
    setDirectCompetitors(item.competitorsCount !== undefined ? item.competitorsCount : 3);
    setNotes(item.notes || '');
    setStoreUrls(item.storeUrls || []);
    setVideoUrls(item.videoUrls || []);
    setSelectedAngles(item.angles || []);
    setChecklist(item.checklist && item.checklist.length ? item.checklist : DEFAULT_CHECKLIST);
    
    // Smooth scroll to top of workspace
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete Research Item
  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta investigación de tu historial?')) return;

    if (isDemoMode || !isFirebaseConfigValid) {
      setResearchList(prev => prev.filter(item => item.id !== id));
      if (editingId === id) handleClearForm();
      return;
    }

    if (!db) return;
    try {
      await deleteDoc(doc(db, 'market_research', id));
      if (editingId === id) handleClearForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'market_research');
    }
  };

  // Export CSV helper
  const handleExportCSV = () => {
    if (researchList.length === 0) {
      alert('No hay investigaciones para exportar.');
      return;
    }

    const headers = ['Fecha', 'Producto', 'Precio', 'Moneda', 'ID Dropi', 'Canal', 'Competidores', 'Tiendas de Competencia', 'Videos Referencia', 'Ángulos', 'Progreso', 'Notas'];
    const rows = researchList.map(item => {
      const date = new Date(item.timestamp).toISOString().split('T')[0];
      const stores = (item.storeUrls || []).join(' | ');
      const videos = (item.videoUrls || []).join(' | ');
      const anglesStr = (item.angles || []).join(' | ');
      return [
        date,
        item.productName || '',
        item.price || 0,
        item.currency || '',
        item.dropiId || '',
        item.channel || '',
        item.competitorsCount || 0,
        stores,
        videos,
        anglesStr,
        `${item.progress || 0}%`,
        item.notes || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `historial_investigacion_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filters history items by query
  const filteredHistory = useMemo(() => {
    return researchList.filter(item => 
      (item.productName || '').toLowerCase().includes(searchHistoryTerm.toLowerCase()) ||
      (item.notes || '').toLowerCase().includes(searchHistoryTerm.toLowerCase())
    );
  }, [researchList, searchHistoryTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="market-research-container space-y-6 text-slate-100 bg-[#000000] p-6 md:p-8 rounded-3xl border border-[#1a1a1a]" style={{ backgroundColor: '#000000', fontSize: `${textSize}px` }}>
      <style>{`
        .market-research-container, 
        .market-research-container *, 
        .market-research-container input, 
        .market-research-container select, 
        .market-research-container textarea, 
        .market-research-container button,
        .market-research-container span,
        .market-research-container td,
        .market-research-container th,
        .market-research-container h1,
        .market-research-container h2,
        .market-research-container h3,
        .market-research-container label,
        .market-research-container p {
          font-size: ${textSize}px !important;
        }
      `}</style>
      
      {/* 1. Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1a1a1a] pb-5">
        <div>
          <div className="inline-block px-2.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 font-mono text-[9px] font-bold uppercase tracking-widest mb-1.5">
            Investigación & Inteligencia
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white leading-none tracking-tight">
            INVESTIGACIÓN DE <span className="text-orange-500">PRODUCTOS Y COMPETENCIA</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1.5 max-w-3xl leading-relaxed">
            Registra productos ganadores, monitorea tiendas de competidores, almacena anuncios en video de TikTok/Facebook, define su canal de venta ideal y completa tu checklist de lanzamiento ágil.
          </p>
        </div>
        
        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2 lg:self-end">
          <div className="flex items-center gap-1.5 bg-[#000000] p-1 rounded-xl border border-[#1a1a1a]" style={{ backgroundColor: '#000000' }}>
            <button 
              onClick={() => adjustTextSize(-1)} 
              className="px-2 py-1 bg-white/5 border border-[#1a1a1a] hover:bg-white/10 text-slate-300 text-xs rounded-lg font-mono font-bold transition-all active:scale-95"
              title="Reducir fuente"
            >
              A-
            </button>
            <span className="text-xs text-slate-400 font-mono font-bold px-1">{textSize}px</span>
            <button 
              onClick={() => adjustTextSize(1)} 
              className="px-2 py-1 bg-white/5 border border-[#1a1a1a] hover:bg-white/10 text-slate-300 text-xs rounded-lg font-mono font-bold transition-all active:scale-95"
              title="Aumentar fuente"
            >
              A+
            </button>
          </div>
          
          <button 
            onClick={handleClearForm} 
            className="px-3.5 py-2 rounded-xl border border-[#1a1a1a] hover:border-slate-700 bg-[#000000] hover:bg-white/5 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
            style={{ backgroundColor: '#000000' }}
          >
            <RotateCcw size={12} /> Limpiar
          </button>
          
          <button 
            onClick={handleSaveResearch} 
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-orange-500/15 border border-orange-600"
          >
            <Check size={13} strokeWidth={2.5} /> {editingId ? 'Actualizar Investigación' : 'Guardar Investigación'}
          </button>
        </div>
      </div>
 
 
 
      {/* 3. Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* COLUMN 1: Specs, competitor lists, marketing strategy */}
        <div className="space-y-6">
          
          {/* Card 1: Datos Básicos */}
          <div className="bg-[#000000] border border-[#1a1a1a] rounded-2xl p-5 relative" style={{ backgroundColor: '#000000' }}>
            <div className="absolute top-0 right-0 p-3 text-[9px] font-mono uppercase text-slate-600 font-bold tracking-wider">PRODUCT_SPECS</div>
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Package size={14} className="text-orange-500" /> DATOS BÁSICOS DEL PRODUCTO
            </h3>
 
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Nombre del Producto / Oferta</label>
                <input 
                  type="text"
                  placeholder="Ej: G-Fouk Limpiador Nasal v2"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full bg-[#000000] border border-[#1a1a1a] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-slate-700 outline-none transition-all"
                  style={{ backgroundColor: '#000000' }}
                />
              </div>
 
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Precio de Venta Sugerido</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">$</span>
                    <input 
                      type="number"
                      placeholder="Ej: 79900"
                      value={suggestedPrice}
                      onChange={(e) => setSuggestedPrice(e.target.value)}
                      className="w-full bg-[#000000] border border-[#1a1a1a] rounded-xl py-2 pl-7 pr-3 text-xs text-white placeholder-slate-600 focus:border-slate-700 outline-none font-mono"
                      style={{ backgroundColor: '#000000' }}
                    />
                  </div>
                  <span className="text-[9px] text-slate-500 font-bold block mt-0.5">Valor al público</span>
                </div>
 
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Moneda</label>
                  <select 
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-[#000000] border border-[#1a1a1a] rounded-xl p-2 text-xs text-white focus:border-slate-700 outline-none"
                    style={{ backgroundColor: '#000000' }}
                  >
                    {CURRENCY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
 
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">ID de Dropi</label>
                  <input 
                    type="text"
                    placeholder="Ej: 382918"
                    value={dropiId}
                    onChange={(e) => setDropiId(e.target.value)}
                    className="w-full bg-[#000000] border border-[#1a1a1a] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-slate-700 outline-none font-mono"
                    style={{ backgroundColor: '#000000' }}
                  />
                  <span className="text-[9px] text-orange-500 font-bold block mt-0.5">Dropshipping</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Canales de venta y competidores */}
          <div className="bg-[#000000] border border-[#1a1a1a] rounded-2xl p-5 relative" style={{ backgroundColor: '#000000' }}>
            <div className="absolute top-0 right-0 p-3 text-[9px] font-mono uppercase text-slate-600 font-bold tracking-wider">INTEL & CHANNELS</div>
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Globe size={14} className="text-orange-500" /> CANALES DE VENTA Y COMPETIDORES
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Canal / Método de Venta</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSalesChannel('WhatsApp')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${salesChannel === 'WhatsApp' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-[#000000] border-[#1a1a1a] text-slate-500 hover:text-slate-300'}`}
                      style={{ backgroundColor: salesChannel === 'WhatsApp' ? undefined : '#000000' }}
                    >
                      <MessageCircle size={13} /> WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setSalesChannel('Landing')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${salesChannel === 'Landing' ? 'bg-orange-500/10 border-orange-500 text-orange-400' : 'bg-[#000000] border-[#1a1a1a] text-slate-500 hover:text-slate-300'}`}
                      style={{ backgroundColor: salesChannel === 'Landing' ? undefined : '#000000' }}
                    >
                      <Smartphone size={13} /> Landing Page
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Número de Competidores Directos</label>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={() => setDirectCompetitors(prev => Math.max(0, prev - 1))}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#000000] border border-[#1a1a1a] text-slate-400 hover:bg-white/5 active:scale-95 font-bold font-mono"
                      style={{ backgroundColor: '#000000' }}
                    >
                      -
                    </button>
                    <input 
                      type="number"
                      value={directCompetitors}
                      onChange={(e) => setDirectCompetitors(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-16 bg-[#000000] border border-[#1a1a1a] rounded-xl py-1.5 text-center text-xs text-white font-mono font-bold"
                      style={{ backgroundColor: '#000000' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setDirectCompetitors(prev => prev + 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#000000] border border-[#1a1a1a] text-slate-400 hover:bg-white/5 active:scale-95 font-bold font-mono"
                      style={{ backgroundColor: '#000000' }}
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[9px] text-slate-500 font-bold block mt-0.5">Encontrados</span>
                </div>
              </div>

              {/* Competitors URL input & list */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">URLs de Tiendas de la Competencia</label>
                  <span className="text-[8px] text-slate-600 uppercase font-mono">Estructura o Shopify / WooCommerce</span>
                </div>
                <form onSubmit={handleAddStoreUrl} className="flex gap-1.5">
                  <input 
                    type="text"
                    placeholder="Pega el enlace de la tienda de un competidor..."
                    value={storeUrlInput}
                    onChange={(e) => setStoreUrlInput(e.target.value)}
                    className="flex-1 bg-[#000000] border border-[#1a1a1a] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-slate-700 outline-none"
                    style={{ backgroundColor: '#000000' }}
                  />
                  <button 
                    type="submit"
                    className="p-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-xl transition-all active:scale-95 flex items-center justify-center"
                    title="Agregar tienda"
                  >
                    <Plus size={15} strokeWidth={2.5} />
                  </button>
                </form>

                {storeUrls.length > 0 && (
                  <div className="space-y-1.5 mt-2 bg-[#050505] p-2.5 rounded-xl border border-[#1a1a1a]" style={{ backgroundColor: '#050505' }}>
                    {storeUrls.map((url, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded bg-black/20 border border-[#1a1a1a] text-slate-300">
                        <div className="flex items-center gap-1.5 truncate max-w-[85%] text-[11px] font-mono">
                          <Globe size={11} className="text-slate-500 shrink-0" />
                          <span className="truncate">{url}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <a href={url} target="_blank" rel="noreferrer" className="p-1 text-slate-500 hover:text-white transition-colors">
                            <ExternalLink size={11} />
                          </a>
                          <button type="button" onClick={() => handleRemoveStoreUrl(idx)} className="p-1 text-slate-500 hover:text-red-500 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Videos Ads URL inputs & lists */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">URLs de Videos Publicitarios / Creativos</label>
                  <span className="text-[8px] text-slate-600 uppercase font-mono">TikTok, Reels o FB Ads Library</span>
                </div>
                <form onSubmit={handleAddVideoUrl} className="flex gap-1.5">
                  <input 
                    type="text"
                    placeholder="Pega el enlace de video de reference..."
                    value={videoUrlInput}
                    onChange={(e) => setVideoUrlInput(e.target.value)}
                    className="flex-1 bg-[#000000] border border-[#1a1a1a] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-slate-700 outline-none"
                    style={{ backgroundColor: '#000000' }}
                  />
                  <button 
                    type="submit"
                    className="p-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-xl transition-all active:scale-95 flex items-center justify-center"
                    title="Agregar video"
                  >
                    <Plus size={15} strokeWidth={2.5} />
                  </button>
                </form>

                {videoUrls.length > 0 && (
                  <div className="space-y-1.5 mt-2 bg-[#050505] p-2.5 rounded-xl border border-[#1a1a1a]" style={{ backgroundColor: '#050505' }}>
                    {videoUrls.map((url, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded bg-black/20 border border-[#1a1a1a] text-slate-300">
                        <div className="flex items-center gap-1.5 truncate max-w-[85%] text-[11px] font-mono">
                          <Video size={11} className="text-slate-500 shrink-0" />
                          <span className="truncate">{url}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <a href={url} target="_blank" rel="noreferrer" className="p-1 text-slate-500 hover:text-white transition-colors">
                            <ExternalLink size={11} />
                          </a>
                          <button type="button" onClick={() => handleRemoveVideoUrl(idx)} className="p-1 text-slate-500 hover:text-red-500 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Notes strategy */}
          <div className="bg-[#000000] border border-[#1a1a1a] rounded-2xl p-5" style={{ backgroundColor: '#000000' }}>
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
              <FileText size={14} className="text-orange-500" /> NOTAS DE INVESTIGACIÓN Y ESTRATEGIA
            </h3>
            <textarea 
              rows={4}
              placeholder="Ej: Producto viral en TikTok Ads con alta demanda. Los competidores venden entre 75K y 85K COP con envío gratis."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#000000] border border-[#1a1a1a] rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:border-slate-700 outline-none resize-none leading-relaxed"
              style={{ backgroundColor: '#000000' }}
            />
          </div>

          {/* Card 4: Marketing communication angles */}
          <div className="bg-[#000000] border border-[#1a1a1a] rounded-2xl p-5 relative" style={{ backgroundColor: '#000000' }}>
            <div className="absolute top-0 right-0 p-3 text-[9px] font-mono uppercase text-slate-600 font-bold tracking-wider">MARKETING ANGLES</div>
            <h3 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
              <Target size={14} className="text-orange-500" /> ÁNGULOS DE VENTA DEL PRODUCTO
            </h3>
            <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
              Selecciona los enfoques de comunicación para tus creativos y landing pages o añade tus propios ángulos personalizados.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider font-bold">Ángulos sugeridos (Haz clic para alternar):</span>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_ANGLES.map((angle) => {
                    const active = selectedAngles.includes(angle);
                    return (
                      <button
                        key={angle}
                        type="button"
                        onClick={() => toggleAngle(angle)}
                        className={`px-2.5 py-1 text-[10px] rounded-lg border font-medium transition-all ${active ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-semibold' : 'bg-[#000000] border-[#1a1a1a] text-slate-500 hover:text-slate-300 hover:border-slate-850'}`}
                        style={{ backgroundColor: active ? undefined : '#000000' }}
                      >
                        {angle}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom angle input */}
              <form onSubmit={handleAddCustomAngle} className="flex gap-1.5">
                <input 
                  type="text"
                  placeholder="Escribe un ángulo personalizado (ej: Resuelve ronquidos)..."
                  value={customAngleInput}
                  onChange={(e) => setCustomAngleInput(e.target.value)}
                  className="flex-1 bg-[#000000] border border-[#1a1a1a] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-slate-700 outline-none"
                  style={{ backgroundColor: '#000000' }}
                />
                <button 
                  type="submit"
                  className="px-3 py-1.5 bg-[#000000] border border-[#1a1a1a] hover:border-slate-700 hover:bg-white/5 text-emerald-400 text-xs font-bold rounded-xl active:scale-95 transition-all"
                  style={{ backgroundColor: '#000000' }}
                >
                  + Agregar
                </button>
              </form>

              {/* Active angles display */}
              {selectedAngles.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[9px] font-mono text-slate-500 uppercase font-bold">Ángulos activos en esta investigación:</span>
                  <div className="flex flex-wrap gap-1.5 bg-[#050505] p-2 rounded-xl border border-[#1a1a1a]" style={{ backgroundColor: '#050505' }}>
                    {selectedAngles.map((angle, idx) => (
                      <span 
                        key={idx} 
                        onClick={() => toggleAngle(angle)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold cursor-pointer hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all"
                      >
                        {angle} <span className="text-[8px] font-mono">✕</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 2: Launch Checklist and tips */}
        <div className="space-y-6">
          
          {/* Card: Pomodoro Focus Timer (Compact version on the side) */}
          <div className="bg-[#000000] border border-[#1a1a1a] rounded-2xl p-4 relative" style={{ backgroundColor: '#000000' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Clock size={16} className="text-orange-500 animate-pulse" />
                <span className="font-bold text-sm md:text-base text-slate-200">Enfoque Pomodoro</span>
              </div>
              <div className="flex bg-[#000000] p-0.5 rounded-lg border border-[#1a1a1a] scale-90 origin-right" style={{ backgroundColor: '#000000' }}>
                <button 
                  onClick={() => { setTimerMode('work'); resetTimer(25); }}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${timerMode === 'work' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Trabajo
                </button>
                <button 
                  onClick={() => { setTimerMode('break'); resetTimer(5); }}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${timerMode === 'break' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Descanso
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center mb-3">
              <div className="text-3xl font-black font-mono tracking-widest text-white bg-[#000000] py-2 rounded-xl border border-[#1a1a1a] text-center select-none" style={{ backgroundColor: '#000000' }}>
                {formatTime(timeRemaining)}
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-mono">{timerMinutes}m</span>
                  <button 
                    onClick={testAlertSound} 
                    className="text-[8px] font-mono px-1 py-0.5 rounded border border-orange-500/20 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 active:scale-95"
                  >
                    Probar ⚡
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => adjustTimerDuration(-1)}
                    className="w-5 h-5 flex items-center justify-center rounded-md bg-[#000000] border border-[#1a1a1a] text-slate-400 hover:bg-white/5 active:scale-90 font-mono text-xs"
                    style={{ backgroundColor: '#000000' }}
                  >
                    -
                  </button>
                  <input 
                    type="range"
                    min="1"
                    max="120"
                    value={timerMinutes}
                    onChange={(e) => handleSliderChange(parseInt(e.target.value))}
                    className="flex-1 h-1 bg-[#0a0a0a] rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <button 
                    onClick={() => adjustTimerDuration(1)}
                    className="w-5 h-5 flex items-center justify-center rounded-md bg-[#000000] border border-[#1a1a1a] text-slate-400 hover:bg-white/5 active:scale-90 font-mono text-xs"
                    style={{ backgroundColor: '#000000' }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={toggleTimer}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-1.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1 shadow-lg active:scale-98"
              >
                {timerIsActive ? <Pause size={16} /> : <Play size={16} />}
                {timerIsActive ? 'Pausar' : 'Iniciar'}
              </button>
              <button 
                onClick={() => resetTimer(timerMinutes)}
                className="px-2.5 py-1.5 bg-[#000000] border border-[#1a1a1a] rounded-xl text-slate-400 hover:text-white hover:border-slate-700 transition-all active:scale-95"
                style={{ backgroundColor: '#000000' }}
                title="Reiniciar temporizador"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2.5 pt-2 border-t border-slate-900/40">
              <span className="truncate max-w-[65%]">
                🎯 Foco: <span className="text-orange-400 font-bold">{focusTask || 'Busca productos'}</span>
              </span>
              <span>
                Completados: <span className="text-white font-mono font-bold bg-orange-500/15 px-1.5 py-0.5 rounded border border-orange-500/30">{completedPomodoros} 🍅</span>
              </span>
            </div>
          </div>

          {/* Card 5: Launch Checklist */}
          <div className="bg-[#000000] border border-[#1a1a1a] rounded-2xl p-5" style={{ backgroundColor: '#000000' }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-500 animate-pulse" /> CHECKLIST DE LANZAMIENTO COMPLETO
              </h3>
              <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                {progressPercentage}%
              </span>
            </div>

            {/* Launch Progress bar */}
            <div className="w-full bg-[#050505] h-2 rounded-full overflow-hidden mb-4 border border-[#1a1a1a]" style={{ backgroundColor: '#050505' }}>
              <div 
                className="bg-emerald-500 h-full transition-all duration-300" 
                style={{ width: `${progressPercentage}%` }} 
              />
            </div>

            {/* Task list */}
            <div className="space-y-2 mb-6">
              {checklist.map((task) => (
                <div 
                  key={task.id} 
                  className={`flex items-start justify-between p-3 rounded-xl border transition-all ${task.completed ? 'bg-emerald-500/5 border-emerald-500/15 text-slate-400' : 'bg-[#000000] border-[#1a1a1a] text-slate-200 hover:border-slate-800'}`}
                  style={{ backgroundColor: task.completed ? undefined : '#000000' }}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button 
                      type="button"
                      onClick={() => toggleChecklistCompleted(task.id)}
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${task.completed ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-slate-700 hover:border-slate-500 bg-[#000000]'}`}
                      style={{ backgroundColor: '#000000' }}
                    >
                      {task.completed && <Check size={10} strokeWidth={4} />}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      {editingTaskId === task.id ? (
                        <div className="space-y-2 mt-0.5">
                          <input 
                            type="text"
                            value={editingTaskText}
                            onChange={(e) => setEditingTaskText(e.target.value)}
                            className="w-full bg-[#000000] border border-slate-800 rounded px-2.5 py-1 text-xs text-white"
                            style={{ backgroundColor: '#000000' }}
                          />
                          <textarea 
                            value={editingTaskDesc}
                            onChange={(e) => setEditingTaskDesc(e.target.value)}
                            className="w-full bg-[#000000] border border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-400 resize-none leading-relaxed"
                            style={{ backgroundColor: '#000000' }}
                            rows={2}
                          />
                          <div className="flex gap-1.5">
                            <button onClick={saveEditingTask} className="px-2.5 py-1 bg-emerald-500 text-black font-bold text-[10px] rounded-lg hover:brightness-110 active:scale-95 transition-all">Guardar</button>
                            <button onClick={() => setEditingTaskId(null)} className="px-2.5 py-1 bg-slate-800 text-slate-300 text-[10px] rounded-lg hover:bg-slate-700 active:scale-95 transition-all">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className={`font-bold text-xs ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                            {task.text}
                          </div>
                          {task.description && (
                            <p className={`text-[10px] mt-0.5 leading-relaxed ${task.completed ? 'text-slate-600' : 'text-slate-500'}`}>
                              {task.description}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Task Actions */}
                  <div className="flex items-center gap-1 ml-2 self-start shrink-0">
                    <button 
                      type="button"
                      onClick={() => { setFocusTask(task.text); setTimerIsActive(true); }}
                      className="p-1 text-slate-500 hover:text-orange-400 transition-colors"
                      title="Enfocar con Pomodoro"
                    >
                      <Clock size={11} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => startEditingTask(task)}
                      className="p-1 text-slate-500 hover:text-blue-400 transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => deleteChecklistItem(task.id)}
                      className="p-1 text-slate-500 hover:text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Custom task block */}
            <div className="p-4 bg-[#050505] rounded-xl border border-[#1a1a1a] space-y-3" style={{ backgroundColor: '#050505' }}>
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold font-mono">➕ AGREGAR TAREA PERSONALIZADA</span>
              <div className="space-y-2">
                <input 
                  type="text"
                  placeholder="Nombre de la tarea (ej. Comprar dominio)..."
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  className="w-full bg-[#000000] border border-[#1a1a1a] rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-slate-700 outline-none"
                  style={{ backgroundColor: '#000000' }}
                />
                <input 
                  type="text"
                  placeholder="Descripción (opcional)..."
                  value={newChecklistDesc}
                  onChange={(e) => setNewChecklistDesc(e.target.value)}
                  className="w-full bg-[#000000] border border-[#1a1a1a] rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-slate-700 outline-none"
                  style={{ backgroundColor: '#000000' }}
                />
                <div className="text-right">
                  <button 
                    type="button"
                    onClick={handleAddCustomTask}
                    className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-xl active:scale-95 transition-all"
                  >
                    Agregar Tarea
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 6: PRO TIP DE ESPIONAJE */}
          <div className="p-5 rounded-2xl bg-orange-500/5 border border-orange-500/25 relative overflow-hidden" style={{ backgroundColor: 'rgba(249, 115, 22, 0.03)' }}>
            <div className="absolute top-0 right-0 p-4 text-orange-500/15">
              <Lightbulb size={64} />
            </div>
            <h4 className="text-xs font-black uppercase text-orange-400 tracking-wider mb-2 flex items-center gap-1.5">
              💡 PRO TIP DE ESPIONAJE
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[90%] font-medium">
              Busca el nombre exacto de tu producto en la <strong className="text-slate-200">Biblioteca de Anuncios de Facebook</strong> o en el buscador de <strong className="text-slate-200">TikTok Creative Center</strong> filtrando por "Conversión". Esto te dará los creativos que están vendiendo actualmente en tiempo real.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Bottom Section: History Records table */}
      <div className="bg-[#000000] border border-[#1a1a1a] rounded-2xl p-5" style={{ backgroundColor: '#000000' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-[#1a1a1a] pb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 tracking-wide uppercase">
              📂 HISTORIAL DE INVESTIGACIONES REGISTRADAS
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Compara tus productos, visualiza enlaces guardados de la competencia, revisa avances y expórtalo todo a Excel/CSV.</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
              <input 
                type="text"
                placeholder="Buscar producto..."
                value={searchHistoryTerm}
                onChange={(e) => setSearchHistoryTerm(e.target.value)}
                className="bg-[#000000] border border-[#1a1a1a] rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-600 focus:border-slate-700 outline-none w-48 transition-all"
                style={{ backgroundColor: '#000000' }}
              />
            </div>
            
            <button 
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 bg-[#000000] border border-[#1a1a1a] text-slate-300 text-xs rounded-xl hover:bg-white/5 hover:text-white flex items-center gap-1.5 transition-all font-bold"
              style={{ backgroundColor: '#000000' }}
            >
              <Download size={12} /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1a1a1a] text-slate-500 uppercase font-bold tracking-wider font-mono text-[9px]">
                <th className="pb-3 pl-2">Fecha</th>
                <th className="pb-3">Producto Investigado</th>
                <th className="pb-3 text-right">Precio Público</th>
                <th className="pb-3 text-center">Canal</th>
                <th className="pb-3 text-center">Competidores</th>
                <th className="pb-3 text-center">Enlaces Rápidos</th>
                <th className="pb-3 text-center">Avance</th>
                <th className="pb-3 text-center pr-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#050505]">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 italic">No se han registrado investigaciones aún.</td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                    <td className="py-4 pl-2 text-slate-500 font-mono text-[10px]">
                      {new Date(item.timestamp).toISOString().split('T')[0]}
                    </td>
                    <td className="py-4 max-w-sm">
                      <span 
                        onClick={() => loadResearchEntry(item)} 
                        className="font-bold text-white hover:text-orange-400 transition-colors cursor-pointer text-sm block"
                      >
                        {item.productName}
                      </span>
                      {item.notes && (
                        <p className="text-[10px] text-slate-500 italic truncate mt-0.5">
                          "{item.notes}"
                        </p>
                      )}
                    </td>
                    <td className="py-4 text-right font-mono font-bold text-emerald-400">
                      {item.price ? (
                        <span>
                          {item.currency?.includes('($)') ? '$' : ''}{item.price.toLocaleString()}{item.currency?.replace(/.*\((.*)\).*/, ' $1') || ''}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-4 text-center">
                      {item.channel === 'WhatsApp' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold text-[9px]">
                          💬 WhatsApp
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20 font-bold text-[9px]">
                          🚀 Landing
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-center font-mono text-slate-300 font-bold">
                      {item.competitorsCount !== undefined ? item.competitorsCount : 0}
                    </td>
                    <td className="py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/5 border border-blue-500/15 text-blue-400 font-mono text-[9px]" title={`${item.storeUrls?.length || 0} tiendas registradas`}>
                          🌐 {item.storeUrls?.length || 0} tiendas
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/5 border border-purple-500/15 text-purple-400 font-mono text-[9px]" title={`${item.videoUrls?.length || 0} videos registrados`}>
                          🎥 {item.videoUrls?.length || 0} videos
                        </span>
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-14 bg-[#0a0a0a] h-1.5 rounded-full overflow-hidden border border-[#1a1a1a]" style={{ backgroundColor: '#0a0a0a' }}>
                          <div className="bg-emerald-500 h-full" style={{ width: `${item.progress || 0}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 font-bold">{item.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="py-4 text-center pr-2">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => loadResearchEntry(item)}
                          className="p-1 text-slate-500 hover:text-white transition-colors"
                          title="Cargar en editor para modificar"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-slate-500 hover:text-red-500 transition-colors"
                          title="Eliminar de historial"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
