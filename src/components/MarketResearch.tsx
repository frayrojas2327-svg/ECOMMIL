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
  MessageCircle,
  Megaphone,
  Tag
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

export type TestingStatus = 'TESTEADO' | 'EN PROCESO' | 'FALTA DE TESTEAR';
export type SalesChannelType = 'WhatsApp' | 'Landing' | 'Ambos';

export const AVAILABLE_MARKETING_TAGS = [
  { 
    name: 'WHATSAPP META', 
    label: 'WHATSAPP META', 
    activeBadge: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold shadow-sm',
    inactiveBadge: 'bg-black/40 border-[#1a1a1a] text-slate-600 hover:text-slate-400 hover:border-slate-700'
  },
  { 
    name: 'WEB FACEBOOK', 
    label: 'WEB FACEBOOK', 
    activeBadge: 'bg-blue-500/15 border-blue-500/40 text-blue-400 font-bold shadow-sm',
    inactiveBadge: 'bg-black/40 border-[#1a1a1a] text-slate-600 hover:text-slate-400 hover:border-slate-700'
  },
  { 
    name: 'WEB TIKTOK', 
    label: 'WEB TIKTOK', 
    activeBadge: 'bg-pink-500/15 border-pink-500/40 text-pink-400 font-bold shadow-sm',
    inactiveBadge: 'bg-black/40 border-[#1a1a1a] text-slate-600 hover:text-slate-400 hover:border-slate-700'
  }
];

export interface MarketResearchEntry {
  id: string;
  uid: string;
  productName: string;
  price?: number;
  currency?: string;
  dropiId?: string;
  suppliersCount?: number;
  channel?: SalesChannelType;
  competitorsCount?: number;
  competitorsWhatsApp?: number;
  competitorsLanding?: number;
  marketingTags?: string[];
  storeUrls: string[];
  adUrls?: string[];
  videoUrls: string[];
  notes: string;
  angles?: string[];
  checklist?: ChecklistItem[];
  progress?: number;
  testingStatus?: TestingStatus;
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
  'us $ - Dólar estadounidense ($)',
  'gt Q - Quetzal guatemalteco (Q)'
];

export const STATUS_CONFIG: Record<TestingStatus, { label: string; icon: string; bgBadge: string; textBadge: string; borderBadge: string; activeClass: string }> = {
  'TESTEADO': {
    label: 'TESTEADO',
    icon: '✓',
    bgBadge: 'bg-emerald-500/15',
    textBadge: 'text-emerald-400',
    borderBadge: 'border-emerald-500/30',
    activeClass: 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-sm'
  },
  'EN PROCESO': {
    label: 'EN PROCESO',
    icon: '⚡',
    bgBadge: 'bg-amber-500/15',
    textBadge: 'text-amber-400',
    borderBadge: 'border-amber-500/30',
    activeClass: 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-sm'
  },
  'FALTA DE TESTEAR': {
    label: 'FALTA DE TESTEAR',
    icon: '⏳',
    bgBadge: 'bg-purple-500/15',
    textBadge: 'text-purple-400',
    borderBadge: 'border-purple-500/30',
    activeClass: 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold shadow-sm'
  }
};

interface MarketResearchProps {
  timerMinutes: number;
  setTimerMinutes: React.Dispatch<React.SetStateAction<number>>;
  timeRemaining: number;
  setTimeRemaining: React.Dispatch<React.SetStateAction<number>>;
  timerIsActive: boolean;
  setTimerIsActive: React.Dispatch<React.SetStateAction<boolean>>;
  timerMode: 'work' | 'break';
  setTimerMode: React.Dispatch<React.SetStateAction<'work' | 'break'>>;
  focusTask: string;
  setFocusTask: React.Dispatch<React.SetStateAction<string>>;
  completedPomodoros: number;
  setCompletedPomodoros: React.Dispatch<React.SetStateAction<number>>;
  notificationPermission: string;
  requestNotificationPermission: () => Promise<void>;
  showDesktopNotification: (title: string, body: string) => void;
  playCompletionSound: () => void;
}

export default function MarketResearch({
  timerMinutes,
  setTimerMinutes,
  timeRemaining,
  setTimeRemaining,
  timerIsActive,
  setTimerIsActive,
  timerMode,
  setTimerMode,
  focusTask,
  setFocusTask,
  completedPomodoros,
  setCompletedPomodoros,
  notificationPermission,
  requestNotificationPermission,
  showDesktopNotification,
  playCompletionSound
}: MarketResearchProps) {
  const { user, isDemoMode } = useAuth();
  const [researchList, setResearchList] = useState<MarketResearchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const textSize = 14;

  const [calcProducts, setCalcProducts] = useState<any[]>([]);

  // Load products from ProfitCalculator (1 unit)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ecommil_saved_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Filter for 1 unit products: packUnits === '1' or undefined/null/empty/missing
        const oneUnitProducts = parsed.filter((p: any) => {
          const units = p.packUnits || '1';
          return units === '1';
        });
        setCalcProducts(oneUnitProducts);
      }
    } catch (e) {
      console.error('Error loading products from calculator:', e);
    }
  }, []);

  // Active Workspace / Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [suggestedPrice, setSuggestedPrice] = useState('');
  const [currency, setCurrency] = useState('co $ - Peso colombiano ($)');
  const [dropiId, setDropiId] = useState('');
  const [suppliersCount, setSuppliersCount] = useState(1);
  const [salesChannel, setSalesChannel] = useState<SalesChannelType>('WhatsApp');
  const [marketingTags, setMarketingTags] = useState<string[]>([]);
  const [competitorsWhatsApp, setCompetitorsWhatsApp] = useState(2);
  const [competitorsLanding, setCompetitorsLanding] = useState(2);
  const [directCompetitors, setDirectCompetitors] = useState(4);
  const [testingStatus, setTestingStatus] = useState<TestingStatus>('FALTA DE TESTEAR');
  const [notes, setNotes] = useState('');

  // Stores and Videos lists
  const [storeUrls, setStoreUrls] = useState<string[]>([]);
  const [storeUrlInput, setStoreUrlInput] = useState('');
  const [adUrls, setAdUrls] = useState<string[]>([]);
  const [adUrlInput, setAdUrlInput] = useState('');
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

  // Search History & Filter State
  const [searchHistoryTerm, setSearchHistoryTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TestingStatus>('ALL');

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

  const testAlertSound = () => {
    playCompletionSound();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        showDesktopNotification('⚡ Prueba de Alerta Ecommil', '¡Tu sonido y notificación de escritorio están funcionando correctamente!');
      } else {
        requestNotificationPermission();
      }
    }
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

  const handleAddAdUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!adUrlInput.trim()) return;
    let url = adUrlInput.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    if (!adUrls.includes(url)) {
      setAdUrls(prev => [...prev, url]);
    }
    setAdUrlInput('');
  };

  const handleRemoveAdUrl = (index: number) => {
    setAdUrls(prev => prev.filter((_, i) => i !== index));
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

  const handleSelectTaskForFocus = (taskText: string) => {
    setFocusTask(taskText);
    setTimerMode('work');
    setTimeRemaining(timerMinutes * 60);
    setTimerIsActive(true);
  };

  // Clear active form
  const handleClearForm = () => {
    setEditingId(null);
    setProductName('');
    setSuggestedPrice('');
    setCurrency('co $ - Peso colombiano ($)');
    setDropiId('');
    setSuppliersCount(1);
    setSalesChannel('WhatsApp');
    setCompetitorsWhatsApp(2);
    setCompetitorsLanding(2);
    setDirectCompetitors(4);
    setMarketingTags([]);
    setTestingStatus('FALTA DE TESTEAR');
    setNotes('');
    setStoreUrls([]);
    setStoreUrlInput('');
    setAdUrls([]);
    setAdUrlInput('');
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
    const totalComp = (competitorsWhatsApp || 0) + (competitorsLanding || 0);
    const entryData = {
      uid: user?.uid || 'demo-user',
      productName: productName.trim(),
      price: parseFloat(suggestedPrice) || 0,
      currency,
      dropiId: dropiId.trim(),
      suppliersCount: Math.max(0, suppliersCount || 0),
      channel: salesChannel,
      competitorsCount: totalComp,
      competitorsWhatsApp: Math.max(0, competitorsWhatsApp || 0),
      competitorsLanding: Math.max(0, competitorsLanding || 0),
      marketingTags,
      testingStatus,
      storeUrls,
      adUrls,
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

  // Direct status update from history table
  const handleUpdateStatus = async (id: string, newStatus: TestingStatus) => {
    if (isDemoMode || !isFirebaseConfigValid) {
      setResearchList(prev => prev.map(item => item.id === id ? { ...item, testingStatus: newStatus } : item));
      return;
    }

    if (!db) return;
    try {
      const ref = doc(db, 'market_research', id);
      await setDoc(ref, { testingStatus: newStatus }, { merge: true });
      setResearchList(prev => prev.map(item => item.id === id ? { ...item, testingStatus: newStatus } : item));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'market_research');
    }
  };

  // Direct tag toggle from history table
  const handleToggleMarketingTag = async (id: string, tagName: string) => {
    const targetItem = researchList.find(item => item.id === id);
    if (!targetItem) return;
    const currentTags = targetItem.marketingTags || [];
    const updatedTags = currentTags.includes(tagName)
      ? currentTags.filter(t => t !== tagName)
      : [...currentTags, tagName];

    setResearchList(prev => prev.map(item => item.id === id ? { ...item, marketingTags: updatedTags } : item));

    if (isDemoMode || !isFirebaseConfigValid) return;
    if (!db) return;
    try {
      const ref = doc(db, 'market_research', id);
      await setDoc(ref, { marketingTags: updatedTags }, { merge: true });
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
    setSuppliersCount(item.suppliersCount !== undefined ? item.suppliersCount : 1);
    setSalesChannel(item.channel || 'WhatsApp');
    setMarketingTags(item.marketingTags || []);

    const compWa = item.competitorsWhatsApp !== undefined 
      ? item.competitorsWhatsApp 
      : (item.channel === 'WhatsApp' ? (item.competitorsCount ?? 2) : 0);
    const compLand = item.competitorsLanding !== undefined 
      ? item.competitorsLanding 
      : (item.channel === 'Landing' ? (item.competitorsCount ?? 2) : 0);
    
    setCompetitorsWhatsApp(compWa);
    setCompetitorsLanding(compLand);
    setDirectCompetitors(item.competitorsCount !== undefined ? item.competitorsCount : (compWa + compLand));

    setTestingStatus(item.testingStatus || 'FALTA DE TESTEAR');
    setNotes(item.notes || '');
    setStoreUrls(item.storeUrls || []);
    setAdUrls(item.adUrls || []);
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

    const headers = ['Fecha', 'Producto', 'Estado de Testeo', 'Etiquetas de Tráfico', 'Precio', 'Moneda', 'ID Dropi', 'N° Proveedores', 'Canal', 'Competidores WhatsApp', 'Competidores Landing', 'Total Competidores', 'Tiendas de Competencia', 'URLs de Anuncio', 'Videos Referencia', 'Ángulos', 'Progreso', 'Notas'];
    const rows = researchList.map(item => {
      const date = new Date(item.timestamp).toISOString().split('T')[0];
      const tagsStr = (item.marketingTags || []).join(' | ');
      const stores = (item.storeUrls || []).join(' | ');
      const ads = (item.adUrls || []).join(' | ');
      const videos = (item.videoUrls || []).join(' | ');
      const anglesStr = (item.angles || []).join(' | ');
      const compWa = item.competitorsWhatsApp !== undefined ? item.competitorsWhatsApp : (item.channel === 'WhatsApp' ? (item.competitorsCount || 0) : 0);
      const compLand = item.competitorsLanding !== undefined ? item.competitorsLanding : (item.channel === 'Landing' ? (item.competitorsCount || 0) : 0);
      const totalComp = item.competitorsCount !== undefined ? item.competitorsCount : (compWa + compLand);

      return [
        date,
        item.productName || '',
        item.testingStatus || 'FALTA DE TESTEAR',
        tagsStr,
        item.price || 0,
        item.currency || '',
        item.dropiId || '',
        item.suppliersCount !== undefined ? item.suppliersCount : 1,
        item.channel || '',
        compWa,
        compLand,
        totalComp,
        stores,
        ads,
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

  // Filters history items by query and status
  const filteredHistory = useMemo(() => {
    return researchList.filter(item => {
      const matchesSearch = (item.productName || '').toLowerCase().includes(searchHistoryTerm.toLowerCase()) ||
        (item.notes || '').toLowerCase().includes(searchHistoryTerm.toLowerCase());
      
      const itemStatus = item.testingStatus || 'FALTA DE TESTEAR';
      const matchesStatus = statusFilter === 'ALL' || itemStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [researchList, searchHistoryTerm, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = {
      ALL: researchList.length,
      TESTEADO: 0,
      'EN PROCESO': 0,
      'FALTA DE TESTEAR': 0
    };
    researchList.forEach(item => {
      const st = item.testingStatus || 'FALTA DE TESTEAR';
      if (counts[st] !== undefined) counts[st]++;
    });
    return counts;
  }, [researchList]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="market-research-container space-y-[15px] text-slate-100 bg-[#000000] p-6 md:p-8 rounded-3xl border border-[#1a1a1a]" style={{ backgroundColor: '#000000', fontSize: `${textSize}px` }}>
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
              {calcProducts.length > 0 && (
                <div className="space-y-1 bg-orange-500/5 border border-orange-500/15 p-3 rounded-xl mb-3">
                  <label className="text-[10px] uppercase tracking-widest text-orange-400 font-black flex items-center gap-1.5">
                    <Sparkles size={12} className="text-orange-500 animate-pulse" /> Autocompletar desde la Calculadora (1 Ud.)
                  </label>
                  <select
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      if (!selectedId) return;
                      const prod = calcProducts.find(p => p.id === selectedId);
                      if (prod) {
                        setProductName(prod.name);
                        
                        // Calculate recommended Selling Price (PV)
                        let priceVal = '';
                        if (prod.costPerUnit !== undefined) {
                          const uUnits = parseFloat(prod.packUnits || '1') || 1;
                          const cUnit = parseFloat(prod.costPerUnit || '0') || 0;
                          const sBase = parseFloat(prod.shippingBase || '0') || 0;
                          const dDispatch = parseFloat(prod.deliveryDispatchPercent || '100') || 100;
                          const admin = parseFloat(prod.adminCosts || '0') || 0;
                          const fulfillment = parseFloat(prod.fulfillment || '0') || 0;
                          const cpa = parseFloat(prod.cpaAds || '0') || 0;
                          const fDelivery = parseFloat(prod.finalDeliveryPercent || '100') || 100;
                          const profitPct = parseFloat(prod.desiredProfitPercent || '0') || 0;

                          const proveedor = cUnit * uUnits;
                          const fleteDev = dDispatch > 0 ? sBase / (dDispatch / 100) : sBase;
                          const cpaCosteado = fDelivery > 0 ? cpa / (fDelivery / 100) : cpa;
                          const totalCost = proveedor + fleteDev + cpaCosteado + admin + fulfillment;
                          const pv = profitPct < 100 ? totalCost / (1 - (profitPct / 100)) : totalCost;
                          priceVal = String(Math.round(pv));
                        } else if (prod.inputs?.price) {
                          priceVal = String(prod.inputs.price);
                        }
                        if (priceVal) {
                          setSuggestedPrice(priceVal);
                        }
                        
                        // Set currency
                        const prodCurrency = prod.currency || 'COP';
                        let mappedOption = '';
                        if (prodCurrency === 'COP') mappedOption = 'co $ - Peso colombiano ($)';
                        else if (prodCurrency === 'MXN') mappedOption = 'mx $ - Peso mexicano ($)';
                        else if (prodCurrency === 'CLP') mappedOption = 'cl $ - Peso chileno ($)';
                        else if (prodCurrency === 'PEN') mappedOption = 'pe S/ - Sol peruano (S/)';
                        else if (prodCurrency === 'USD') mappedOption = 'us $ - Dólar estadounidense ($)';
                        else if (prodCurrency === 'GTQ') mappedOption = 'gt Q - Quetzal guatemalteco (Q)';
                        
                        if (mappedOption) {
                          setCurrency(mappedOption);
                        }
                      }
                      // Clear the value so user can re-select if needed
                      e.target.value = '';
                    }}
                    className="w-full bg-[#000000] border border-orange-500/20 hover:border-orange-500/40 rounded-xl px-3 py-2 text-xs text-orange-300 focus:border-orange-500 outline-none transition-all cursor-pointer font-bold"
                    style={{ backgroundColor: '#000000' }}
                  >
                    <option value="" className="text-slate-500">-- Seleccionar producto de 1 unidad --</option>
                    {calcProducts.map((p) => (
                      <option key={p.id} value={p.id} className="text-white bg-black">
                        {p.name} ({p.currency})
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Precio de Venta Sugerido</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                      {currency.includes('(Q)') ? 'Q' : currency.includes('(S/)') ? 'S/' : '$'}
                    </span>
                    <input 
                      type="number"
                      placeholder="Ej: 79900"
                      value={suggestedPrice}
                      onChange={(e) => setSuggestedPrice(e.target.value)}
                      className={`w-full bg-[#000000] border border-[#1a1a1a] rounded-xl py-2 ${currency.includes('(S/)') ? 'pl-9' : 'pl-7'} pr-3 text-xs text-white placeholder-slate-600 focus:border-slate-700 outline-none font-mono`}
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
                  <span className="text-[9px] text-slate-500 font-bold block mt-0.5">Mercado / País</span>
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

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">N° de Proveedores</label>
                  <div className="flex items-center gap-1.5">
                    <button 
                      type="button" 
                      onClick={() => setSuppliersCount(prev => Math.max(0, (parseInt(String(prev)) || 0) - 1))}
                      className="w-8 h-[34px] flex items-center justify-center rounded-xl bg-[#000000] border border-[#1a1a1a] text-slate-400 hover:bg-white/5 active:scale-95 font-bold font-mono shrink-0"
                      style={{ backgroundColor: '#000000' }}
                    >
                      -
                    </button>
                    <input 
                      type="number"
                      min="0"
                      placeholder="1"
                      value={suppliersCount}
                      onChange={(e) => setSuppliersCount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-[#000000] border border-[#1a1a1a] rounded-xl py-1.5 text-center text-xs text-white placeholder-slate-600 focus:border-slate-700 outline-none font-mono font-bold"
                      style={{ backgroundColor: '#000000' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setSuppliersCount(prev => (parseInt(String(prev)) || 0) + 1)}
                      className="w-8 h-[34px] flex items-center justify-center rounded-xl bg-[#000000] border border-[#1a1a1a] text-slate-400 hover:bg-white/5 active:scale-95 font-bold font-mono shrink-0"
                      style={{ backgroundColor: '#000000' }}
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[9px] text-blue-400 font-bold block mt-0.5">Proveedores validados</span>
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

            <div className="space-y-3">
              {/* Selector de Plataforma / Estrategia a Pautar */}
              <div className="space-y-1.5 pb-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Plataforma / Estrategia a Pautar</label>
                  <span className="text-[8px] text-slate-600 uppercase font-mono">Define el contorno del registro</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {AVAILABLE_MARKETING_TAGS.map(tag => {
                    const isSelected = marketingTags.includes(tag.name);
                    return (
                      <button
                        key={tag.name}
                        type="button"
                        onClick={() => {
                          setMarketingTags(prev => 
                            prev.includes(tag.name)
                              ? prev.filter(t => t !== tag.name)
                              : [...prev, tag.name]
                          );
                        }}
                        className={`py-2 px-2.5 rounded-xl border text-[10px] font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? tag.name === 'WHATSAPP META'
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400 shadow-sm shadow-emerald-500/10'
                              : tag.name === 'WEB FACEBOOK'
                              ? 'bg-blue-500/15 border-blue-500/50 text-blue-400 shadow-sm shadow-blue-500/10'
                              : 'bg-pink-500/15 border-pink-500/50 text-pink-400 shadow-sm shadow-pink-500/10'
                            : 'bg-[#000000] border-[#1a1a1a] text-slate-500 hover:text-slate-300 hover:border-slate-800'
                        }`}
                        style={{ backgroundColor: isSelected ? undefined : '#000000' }}
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          tag.name === 'WHATSAPP META' ? 'bg-emerald-400' :
                          tag.name === 'WEB FACEBOOK' ? 'bg-blue-400' :
                          'bg-pink-400'
                        }`} />
                        <span>{tag.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Espacios Independientes de Competidores por Canal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Espacio Independiente WhatsApp */}
                <div className="bg-[#050505] border border-[#1a1a1a] rounded-xl p-3 space-y-2 relative" style={{ backgroundColor: '#050505' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                      <MessageCircle size={14} />
                      <span>Competidores WhatsApp</span>
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                      Chat / WA
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[#1a1a1a]">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Competidores:</span>
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button" 
                        onClick={() => setCompetitorsWhatsApp(prev => Math.max(0, (parseInt(String(prev)) || 0) - 1))}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#000000] border border-[#1a1a1a] text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 font-bold font-mono text-xs"
                        style={{ backgroundColor: '#000000' }}
                      >
                        -
                      </button>
                      <input 
                        type="number"
                        min="0"
                        value={competitorsWhatsApp}
                        onChange={(e) => setCompetitorsWhatsApp(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-12 bg-[#000000] border border-[#1a1a1a] rounded-lg py-1 text-center text-xs text-emerald-400 font-mono font-bold outline-none focus:border-emerald-500/50"
                        style={{ backgroundColor: '#000000' }}
                      />
                      <button 
                        type="button" 
                        onClick={() => setCompetitorsWhatsApp(prev => (parseInt(String(prev)) || 0) + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#000000] border border-[#1a1a1a] text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 font-bold font-mono text-xs"
                        style={{ backgroundColor: '#000000' }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Espacio Independiente Landing Page */}
                <div className="bg-[#050505] border border-[#1a1a1a] rounded-xl p-3 space-y-2 relative" style={{ backgroundColor: '#050505' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-orange-400 font-bold text-xs">
                      <Smartphone size={14} />
                      <span>Competidores Landing</span>
                    </div>
                    <span className="text-[9px] font-mono text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 font-bold">
                      Web / Tiendas
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[#1a1a1a]">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Competidores:</span>
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button" 
                        onClick={() => setCompetitorsLanding(prev => Math.max(0, (parseInt(String(prev)) || 0) - 1))}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#000000] border border-[#1a1a1a] text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 font-bold font-mono text-xs"
                        style={{ backgroundColor: '#000000' }}
                      >
                        -
                      </button>
                      <input 
                        type="number"
                        min="0"
                        value={competitorsLanding}
                        onChange={(e) => setCompetitorsLanding(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-12 bg-[#000000] border border-[#1a1a1a] rounded-lg py-1 text-center text-xs text-orange-400 font-mono font-bold outline-none focus:border-orange-500/50"
                        style={{ backgroundColor: '#000000' }}
                      />
                      <button 
                        type="button" 
                        onClick={() => setCompetitorsLanding(prev => (parseInt(String(prev)) || 0) + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#000000] border border-[#1a1a1a] text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 font-bold font-mono text-xs"
                        style={{ backgroundColor: '#000000' }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra de total combinado */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#050505] border border-[#1a1a1a] text-xs" style={{ backgroundColor: '#050505' }}>
                <span className="text-slate-400 font-medium">Total Competidores:</span>
                <div className="flex items-center gap-2 font-mono font-bold text-xs">
                  <span className="text-emerald-400">💬 {competitorsWhatsApp} WA</span>
                  <span className="text-slate-600">+</span>
                  <span className="text-orange-400">🚀 {competitorsLanding} Landing</span>
                  <span className="text-slate-600">=</span>
                  <span className="text-white bg-white/10 px-2 py-0.5 rounded border border-white/20">{(competitorsWhatsApp || 0) + (competitorsLanding || 0)} Total</span>
                </div>
              </div>

              {/* Competitors URL input & list */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
                    <Globe size={11} className="text-blue-400" /> URLs de Tiendas de la Competencia
                  </label>
                  <span className="text-[8px] text-slate-600 uppercase font-mono">Shopify / WooCommerce</span>
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
                          <Globe size={11} className="text-blue-400 shrink-0" />
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

              {/* Ad URLs input & list */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
                    <Megaphone size={11} className="text-amber-400" /> URLs de Anuncios
                  </label>
                  <span className="text-[8px] text-slate-600 uppercase font-mono">Meta Ads Library, TikTok Ad, etc.</span>
                </div>
                <form onSubmit={handleAddAdUrl} className="flex gap-1.5">
                  <input 
                    type="text"
                    placeholder="Pega el enlace del anuncio (Meta Ads Library, TikTok Creative...)"
                    value={adUrlInput}
                    onChange={(e) => setAdUrlInput(e.target.value)}
                    className="flex-1 bg-[#000000] border border-[#1a1a1a] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-slate-700 outline-none"
                    style={{ backgroundColor: '#000000' }}
                  />
                  <button 
                    type="submit"
                    className="p-2 bg-amber-500 hover:bg-amber-600 text-black rounded-xl transition-all active:scale-95 flex items-center justify-center"
                    title="Agregar URL de anuncio"
                  >
                    <Plus size={15} strokeWidth={2.5} />
                  </button>
                </form>

                {adUrls.length > 0 && (
                  <div className="space-y-1.5 mt-2 bg-[#050505] p-2.5 rounded-xl border border-[#1a1a1a]" style={{ backgroundColor: '#050505' }}>
                    {adUrls.map((url, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded bg-black/20 border border-[#1a1a1a] text-slate-300">
                        <div className="flex items-center gap-1.5 truncate max-w-[85%] text-[11px] font-mono">
                          <Megaphone size={11} className="text-amber-400 shrink-0" />
                          <span className="truncate">{url}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <a href={url} target="_blank" rel="noreferrer" className="p-1 text-slate-500 hover:text-white transition-colors">
                            <ExternalLink size={11} />
                          </a>
                          <button type="button" onClick={() => handleRemoveAdUrl(idx)} className="p-1 text-slate-500 hover:text-red-500 transition-colors">
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
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
                    <Video size={11} className="text-purple-400" /> URLs de Videos Publicitarios / Creativos
                  </label>
                  <span className="text-[8px] text-slate-600 uppercase font-mono">TikTok, Reels o Drive</span>
                </div>
                <form onSubmit={handleAddVideoUrl} className="flex gap-1.5">
                  <input 
                    type="text"
                    placeholder="Pega el enlace de video de referencia..."
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
                          <Video size={11} className="text-purple-400 shrink-0" />
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
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Target size={14} className="text-orange-500" /> ÁNGULOS DE VENTA DEL PRODUCTO
            </h3>

            <div className="space-y-3">
              {/* Custom angle input */}
              <form onSubmit={handleAddCustomAngle} className="flex gap-1.5">
                <input 
                  type="text"
                  placeholder="Escribe un ángulo de venta para agregar..."
                  value={customAngleInput}
                  onChange={(e) => setCustomAngleInput(e.target.value)}
                  className="flex-1 bg-[#000000] border border-[#1a1a1a] rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:border-slate-700 outline-none"
                  style={{ backgroundColor: '#000000' }}
                />
                <button 
                  type="submit"
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold rounded-xl active:scale-95 transition-all flex items-center gap-1 shrink-0"
                >
                  <Plus size={14} strokeWidth={2.5} /> Agregar
                </button>
              </form>

              {/* Active angles display */}
              {selectedAngles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 bg-[#050505] p-2.5 rounded-xl border border-[#1a1a1a]" style={{ backgroundColor: '#050505' }}>
                  {selectedAngles.map((angle, idx) => (
                    <span 
                      key={idx} 
                      onClick={() => toggleAngle(angle)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold cursor-pointer hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all"
                      title="Haz clic para eliminar este ángulo"
                    >
                      {angle} <span className="text-[10px] font-mono opacity-80">✕</span>
                    </span>
                  ))}
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

            {/* Desktop Notification Request/Status Block */}
            <div className="mt-2 pt-2 border-t border-[#1a1a1a]">
              {typeof window !== 'undefined' && 'Notification' in window ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] text-slate-500 uppercase font-mono tracking-wider font-bold">Notificaciones de PC:</span>
                  {notificationPermission === 'default' ? (
                    <button
                      type="button"
                      onClick={requestNotificationPermission}
                      className="px-2 py-0.5 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/35 text-orange-400 font-bold text-[9px] rounded-lg transition-all active:scale-95"
                    >
                      🔔 Activar
                    </button>
                  ) : notificationPermission === 'denied' ? (
                    <span className="text-[9px] text-red-500/80 font-bold" title="Habilita las notificaciones en la configuración de candado de tu navegador">
                      ❌ Bloqueadas
                    </span>
                  ) : (
                    <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Activas
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[8px] text-slate-500 block text-center">
                  ⚠️ Tu navegador no soporta notificaciones de PC
                </span>
              )}
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
              {checklist.map((task) => {
                const isFocused = focusTask === task.text && !task.completed && timerIsActive;
                return (
                  <div 
                    key={task.id} 
                    className={`flex items-start justify-between p-3 rounded-xl border transition-all ${
                      task.completed 
                        ? 'bg-emerald-500/5 border-emerald-500/15 text-slate-400' 
                        : isFocused 
                          ? 'bg-orange-500/5 border-orange-500/40 text-slate-200 ring-1 ring-orange-500/20' 
                          : 'bg-[#000000] border-[#1a1a1a] text-slate-200 hover:border-slate-800'
                    }`}
                    style={{ backgroundColor: task.completed ? undefined : isFocused ? 'rgba(249, 115, 22, 0.05)' : '#000000' }}
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
                      
                      <div 
                        className={`flex-1 min-w-0 ${!task.completed ? 'cursor-pointer' : ''}`}
                        onClick={() => !task.completed && handleSelectTaskForFocus(task.text)}
                      >
                        {editingTaskId === task.id ? (
                          <div className="space-y-2 mt-0.5" onClick={(e) => e.stopPropagation()}>
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
                            <div className={`font-bold text-xs ${task.completed ? 'line-through text-slate-500' : isFocused ? 'text-orange-400' : 'text-slate-200'} flex flex-wrap items-center gap-1.5`}>
                              {task.text}
                              {isFocused && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[8px] font-black uppercase tracking-wider animate-pulse">
                                  ⏱️ EN FOCO
                                </span>
                              )}
                            </div>
                            {task.description && (
                              <p className={`text-[10px] mt-0.5 leading-relaxed ${task.completed ? 'text-slate-600' : isFocused ? 'text-orange-200/60' : 'text-slate-500'}`}>
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
                        onClick={() => handleSelectTaskForFocus(task.text)}
                        className={`p-1 transition-colors ${isFocused ? 'text-orange-400' : 'text-slate-500 hover:text-orange-400'}`}
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
                );
              })}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-[#1a1a1a] pb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 tracking-wide uppercase">
              📂 HISTORIAL DE INVESTIGACIONES REGISTRADAS
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Compara tus productos, visualiza el estado de testeo, enlaces guardados de la competencia, revisa avances y expórtalo todo a Excel/CSV.</p>
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

        {/* Filter Pills and Contour Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold mr-1">Filtrar por:</span>
            
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 text-xs rounded-xl font-bold border transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-white text-black border-white shadow-sm'
                  : 'bg-[#000000] border-[#1a1a1a] text-slate-400 hover:text-white hover:border-slate-800'
              }`}
              style={{ backgroundColor: statusFilter === 'ALL' ? undefined : '#000000' }}
            >
              Todos ({statusCounts.ALL})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('FALTA DE TESTEAR')}
              className={`px-3 py-1 text-xs rounded-xl font-bold border transition-all flex items-center gap-1.5 ${
                statusFilter === 'FALTA DE TESTEAR'
                  ? 'bg-purple-500 text-white border-purple-400 shadow-sm shadow-purple-500/20'
                  : 'bg-[#000000] border-[#1a1a1a] text-purple-400 hover:border-purple-500/40 hover:bg-purple-500/10'
              }`}
              style={{ backgroundColor: statusFilter === 'FALTA DE TESTEAR' ? undefined : '#000000' }}
            >
              <span>⏳</span> Falta de Testear ({statusCounts['FALTA DE TESTEAR']})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('EN PROCESO')}
              className={`px-3 py-1 text-xs rounded-xl font-bold border transition-all flex items-center gap-1.5 ${
                statusFilter === 'EN PROCESO'
                  ? 'bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/20'
                  : 'bg-[#000000] border-[#1a1a1a] text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/10'
              }`}
              style={{ backgroundColor: statusFilter === 'EN PROCESO' ? undefined : '#000000' }}
            >
              <span>⚡</span> En Proceso ({statusCounts['EN PROCESO']})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('TESTEADO')}
              className={`px-3 py-1 text-xs rounded-xl font-bold border transition-all flex items-center gap-1.5 ${
                statusFilter === 'TESTEADO'
                  ? 'bg-emerald-500 text-black border-emerald-400 shadow-sm shadow-emerald-500/20'
                  : 'bg-[#000000] border-[#1a1a1a] text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10'
              }`}
              style={{ backgroundColor: statusFilter === 'TESTEADO' ? undefined : '#000000' }}
            >
              <span>✓</span> Testeado ({statusCounts.TESTEADO})
            </button>
          </div>

          {/* Indicador visual de contorno */}
          <div className="flex flex-wrap items-center gap-2.5 text-[9px] font-mono font-bold bg-[#050505] px-2.5 py-1 rounded-lg border border-[#141414]" style={{ backgroundColor: '#050505' }}>
            <span className="text-slate-500 uppercase tracking-wider">Contorno:</span>
            <span className="flex items-center gap-1 text-emerald-400" title="Contorno verde: WhatsApp Meta">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span> WhatsApp
            </span>
            <span className="flex items-center gap-1 text-blue-400" title="Contorno azul: Web Facebook">
              <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></span> FB Web
            </span>
            <span className="flex items-center gap-1 text-pink-400" title="Contorno rosa: Web TikTok">
              <span className="w-2 h-2 rounded-full bg-pink-500 shadow-sm shadow-pink-500/50"></span> TikTok Web
            </span>
          </div>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1a1a1a] text-slate-500 uppercase font-bold tracking-wider font-mono text-[9px]">
                <th className="pb-3 pl-3">Fecha</th>
                <th className="pb-3">Producto Investigado</th>
                <th className="pb-3 text-center">Estado de Testeo</th>
                <th className="pb-3 text-right">Precio Público</th>
                <th className="pb-3 text-center">Competidores</th>
                <th className="pb-3 text-center">Enlaces Rápidos</th>
                <th className="pb-3 text-center">Avance</th>
                <th className="pb-3 text-center pr-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#050505]">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 italic">No se han registrado investigaciones con este filtro aún.</td>
                </tr>
              ) : (
                filteredHistory.map((item) => {
                  const currentStatus: TestingStatus = item.testingStatus || 'FALTA DE TESTEAR';
                  const statusCfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG['FALTA DE TESTEAR'];

                  // Estilo dinámico de contorno de acuerdo a la etiqueta / plataforma a pautar
                  const tags = item.marketingTags || [];
                  const isWhatsApp = tags.includes('WHATSAPP META') || item.channel === 'WhatsApp';
                  const isWebFb = tags.includes('WEB FACEBOOK');
                  const isWebTt = tags.includes('WEB TIKTOK');

                  let rowBorderClasses = 'border-l-[4px] border-l-slate-700 bg-black/20 hover:bg-white/5';
                  let contourTitle = 'Sin etiqueta específica';

                  if (isWhatsApp && (isWebFb || isWebTt)) {
                    rowBorderClasses = 'border-l-[4px] border-l-amber-500 bg-amber-500/[0.03] hover:bg-amber-500/[0.08]';
                    contourTitle = 'Estrategia Multicanal';
                  } else if (isWhatsApp) {
                    rowBorderClasses = 'border-l-[4px] border-l-emerald-500 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.08]';
                    contourTitle = 'Estrategia WhatsApp Meta';
                  } else if (isWebFb) {
                    rowBorderClasses = 'border-l-[4px] border-l-blue-500 bg-blue-500/[0.03] hover:bg-blue-500/[0.08]';
                    contourTitle = 'Estrategia Web Facebook';
                  } else if (isWebTt) {
                    rowBorderClasses = 'border-l-[4px] border-l-pink-500 bg-pink-500/[0.03] hover:bg-pink-500/[0.08]';
                    contourTitle = 'Estrategia Web TikTok';
                  } else if (item.channel === 'Landing') {
                    rowBorderClasses = 'border-l-[4px] border-l-blue-500 bg-blue-500/[0.03] hover:bg-blue-500/[0.08]';
                    contourTitle = 'Estrategia Landing Page';
                  }

                  return (
                    <tr 
                      key={item.id} 
                      className={`transition-all group border-b border-[#121212] ${rowBorderClasses}`}
                      title={contourTitle}
                    >
                      <td className="py-3.5 pl-3 text-slate-500 font-mono text-[10px] whitespace-nowrap">
                        {new Date(item.timestamp).toISOString().split('T')[0]}
                      </td>
                      <td className="py-3.5 max-w-sm">
                        <span 
                          onClick={() => loadResearchEntry(item)} 
                          className="font-bold text-white hover:text-orange-400 transition-colors cursor-pointer text-sm block leading-snug"
                        >
                          {item.productName}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {item.dropiId && (
                            <span className="text-[9px] font-mono bg-orange-500/10 border border-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-bold">
                              ID: {item.dropiId}
                            </span>
                          )}
                          {item.suppliersCount !== undefined && item.suppliersCount > 0 && (
                            <span className="text-[9px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold">
                              🏭 {item.suppliersCount} {item.suppliersCount === 1 ? 'prov.' : 'provs.'}
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-[10px] text-slate-500 italic truncate mt-1">
                            "{item.notes}"
                          </p>
                        )}
                      </td>
                      
                      {/* Estado de Testeo Tag Column */}
                      <td className="py-3.5 text-center">
                        <div className="inline-block relative">
                          <select
                            value={currentStatus}
                            onChange={(e) => handleUpdateStatus(item.id, e.target.value as TestingStatus)}
                            className={`appearance-none cursor-pointer text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all text-center outline-none ${statusCfg.bgBadge} ${statusCfg.textBadge} ${statusCfg.borderBadge}`}
                            style={{ backgroundColor: currentStatus === 'TESTEADO' ? 'rgba(16, 185, 129, 0.12)' : currentStatus === 'EN PROCESO' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(168, 85, 247, 0.12)' }}
                            title="Haz clic para cambiar el estado de testeo"
                          >
                            <option value="FALTA DE TESTEAR" className="bg-black text-purple-400 font-bold">⏳ FALTA DE TESTEAR</option>
                            <option value="EN PROCESO" className="bg-black text-amber-400 font-bold">⚡ EN PROCESO</option>
                            <option value="TESTEADO" className="bg-black text-emerald-400 font-bold">✓ TESTEADO</option>
                          </select>
                        </div>
                      </td>

                      {/* Precio Público */}
                      <td className="py-3.5 text-right font-mono font-bold text-emerald-400">
                        {item.price ? (
                          <span className="text-justify inline-block">
                            {item.currency?.includes('(Q)') ? 'Q ' : item.currency?.includes('(S/)') ? 'S/ ' : item.currency?.includes('($)') ? '$ ' : ''}
                            {item.price.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* Competidores */}
                      <td className="py-3.5 text-center font-mono">
                        <div className="font-bold text-white text-xs">
                          {item.competitorsCount !== undefined 
                            ? item.competitorsCount 
                            : ((item.competitorsWhatsApp || 0) + (item.competitorsLanding || 0))}
                        </div>
                        {(item.competitorsWhatsApp !== undefined || item.competitorsLanding !== undefined) && (
                          <div className="flex items-center justify-center gap-1 mt-0.5 text-[9px]">
                            <span className="text-emerald-400 font-bold" title="Competidores WhatsApp">💬 {item.competitorsWhatsApp ?? 0}</span>
                            <span className="text-slate-600">|</span>
                            <span className="text-orange-400 font-bold" title="Competidores Landing">🚀 {item.competitorsLanding ?? 0}</span>
                          </div>
                        )}
                      </td>

                      {/* Enlaces Rápidos */}
                      <td className="py-3.5 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/5 border border-blue-500/15 text-blue-400 font-mono text-[9px]" title={`${item.storeUrls?.length || 0} tiendas registradas`}>
                            🌐 {item.storeUrls?.length || 0}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/5 border border-amber-500/15 text-amber-400 font-mono text-[9px]" title={`${item.adUrls?.length || 0} anuncios registrados`}>
                            📢 {item.adUrls?.length || 0}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/5 border border-purple-500/15 text-purple-400 font-mono text-[9px]" title={`${item.videoUrls?.length || 0} videos registrados`}>
                            🎥 {item.videoUrls?.length || 0}
                          </span>
                        </div>
                      </td>

                      {/* Avance */}
                      <td className="py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-14 bg-[#0a0a0a] h-1.5 rounded-full overflow-hidden border border-[#1a1a1a]" style={{ backgroundColor: '#0a0a0a' }}>
                            <div className="bg-emerald-500 h-full" style={{ width: `${item.progress || 0}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 font-bold">{item.progress || 0}%</span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 text-center pr-3">
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
