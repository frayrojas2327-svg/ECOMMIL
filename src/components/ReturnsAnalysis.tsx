import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { 
  AlertTriangle, RotateCcw, XCircle, TrendingDown, Globe, Brain, Sparkles, Cpu, Loader2, 
  BarChart3, TrendingUp, CheckCircle, ArrowRight, Plus, Trash2, Edit2, Calendar, FileText, X, 
  Search, Info, AlertCircle, RefreshCw, Palette, Tag, Check
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
  theme?: string;
  onDeleteOrders?: (ids: string[]) => Promise<void> | void;
}

export interface CustomLabel {
  name: string;
  colorId: string; // references COLOR_PRESETS id
}

export interface ColorPreset {
  id: string;
  name: string;
  dotBg: string; // CSS style background color
  lightBg: string; // Tailwind class
  lightText: string;
  lightBorder: string;
  darkBg: string;
  darkText: string;
  darkBorder: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'gray',
    name: 'Gris Carbón',
    dotBg: '#374151',
    lightBg: 'bg-slate-100',
    lightText: 'text-slate-800',
    lightBorder: 'border-slate-300',
    darkBg: 'bg-slate-800/40',
    darkText: 'text-slate-300',
    darkBorder: 'border-slate-700/60'
  },
  {
    id: 'red',
    name: 'Rojo',
    dotBg: '#ef4444',
    lightBg: 'bg-red-50',
    lightText: 'text-red-700',
    lightBorder: 'border-red-200',
    darkBg: 'bg-red-500/15',
    darkText: 'text-red-400',
    darkBorder: 'border-red-500/20'
  },
  {
    id: 'brown',
    name: 'Marrón Ocre',
    dotBg: '#b45309',
    lightBg: 'bg-amber-100/70',
    lightText: 'text-amber-800',
    lightBorder: 'border-amber-300',
    darkBg: 'bg-amber-700/20',
    darkText: 'text-amber-400',
    darkBorder: 'border-amber-700/30'
  },
  {
    id: 'navy',
    name: 'Azul Marino',
    dotBg: '#1e3a8a',
    lightBg: 'bg-blue-50',
    lightText: 'text-blue-800',
    lightBorder: 'border-blue-200',
    darkBg: 'bg-blue-500/15',
    darkText: 'text-blue-400',
    darkBorder: 'border-blue-500/20'
  },
  {
    id: 'maroon',
    name: 'Guinda / Maroon',
    dotBg: '#831843',
    lightBg: 'bg-purple-50',
    lightText: 'text-purple-800',
    lightBorder: 'border-purple-200',
    darkBg: 'bg-purple-500/15',
    darkText: 'text-purple-400',
    darkBorder: 'border-purple-500/20'
  },
  {
    id: 'orange',
    name: 'Naranja',
    dotBg: '#ea580c',
    lightBg: 'bg-orange-50',
    lightText: 'text-orange-700',
    lightBorder: 'border-orange-200',
    darkBg: 'bg-orange-500/15',
    darkText: 'text-orange-400',
    darkBorder: 'border-orange-500/20'
  },
  {
    id: 'yellow',
    name: 'Amarillo / Oro',
    dotBg: '#eab308',
    lightBg: 'bg-yellow-50',
    lightText: 'text-yellow-700',
    lightBorder: 'border-yellow-200',
    darkBg: 'bg-yellow-500/15',
    darkText: 'text-yellow-400',
    darkBorder: 'border-yellow-500/20'
  },
  {
    id: 'green',
    name: 'Verde',
    dotBg: '#10b981',
    lightBg: 'bg-emerald-50',
    lightText: 'text-emerald-700',
    lightBorder: 'border-emerald-200',
    darkBg: 'bg-emerald-500/15',
    darkText: 'text-emerald-400',
    darkBorder: 'border-emerald-500/20'
  },
  {
    id: 'pink',
    name: 'Rosa',
    dotBg: '#ec4899',
    lightBg: 'bg-pink-50',
    lightText: 'text-pink-700',
    lightBorder: 'border-pink-200',
    darkBg: 'bg-pink-500/15',
    darkText: 'text-pink-400',
    darkBorder: 'bg-pink-500/20'
  },
  {
    id: 'cyan',
    name: 'Celeste / Cian',
    dotBg: '#06b6d4',
    lightBg: 'bg-cyan-50',
    lightText: 'text-cyan-700',
    lightBorder: 'border-cyan-200',
    darkBg: 'bg-cyan-500/15',
    darkText: 'text-cyan-400',
    darkBorder: 'border-cyan-500/20'
  }
];

export const DEFAULT_LABELS: CustomLabel[] = [
  { name: 'TIK TOK ORGANICO', colorId: 'gray' },
  { name: 'RECORDAR EXPRES CENT', colorId: 'red' },
  { name: 'PEDIR BIEN DEPAR-CIU', colorId: 'brown' },
  { name: 'PRUEBA', colorId: 'navy' },
  { name: 'DATOS INCORR-BUZON', colorId: 'maroon' },
  { name: 'CLIENTE NO CONTESTA', colorId: 'orange' },
  { name: 'POSTERGACION', colorId: 'yellow' }
];

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

const ReturnsAnalysis: React.FC<ReturnsAnalysisProps> = ({ orders, formatCurrency, currency = 'USD', currencies = {}, isConversionActive = false, theme, onDeleteOrders }) => {
  const { user, isDemoMode } = useAuth();
  
  const isLightWhite = theme === 'theme-light-white';
  
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

  // Custom Labels States
  const [customLabels, setCustomLabels] = useState<CustomLabel[]>(() => {
    const saved = localStorage.getItem('ecommil_custom_return_tags');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_LABELS;
  });

  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColorId, setNewTagColorId] = useState('gray');

  // Load custom tags from Firestore if logged in
  useEffect(() => {
    if (!user || !isFirebaseConfigValid || isDemoMode || !db) {
      return;
    }

    const docRef = doc(db, 'custom_return_tags', user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.labels)) {
          setCustomLabels(data.labels);
          localStorage.setItem('ecommil_custom_return_tags', JSON.stringify(data.labels));
        }
      } else {
        // Seed database
        const initialLabels = localStorage.getItem('ecommil_custom_return_tags')
          ? JSON.parse(localStorage.getItem('ecommil_custom_return_tags')!)
          : DEFAULT_LABELS;
          
        setDoc(docRef, {
          uid: user.uid,
          labels: initialLabels
        }).catch(err => console.error("Error seeding initial tags in Firestore:", err));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'custom_return_tags');
    });

    return () => unsubscribe();
  }, [user, isDemoMode]);

  // Save tags helper
  const saveCustomLabels = async (newLabels: CustomLabel[]) => {
    setCustomLabels(newLabels);
    localStorage.setItem('ecommil_custom_return_tags', JSON.stringify(newLabels));

    if (user && isFirebaseConfigValid && !isDemoMode && db) {
      try {
        await setDoc(doc(db, 'custom_return_tags', user.uid), {
          uid: user.uid,
          labels: newLabels
        });
      } catch (err) {
        console.error("Error saving custom tags to Firestore:", err);
      }
    }
  };

  const getLabelPreset = (labelName: string) => {
    const cleanName = labelName.trim().toUpperCase();
    const foundLabel = customLabels.find(l => l.name.toUpperCase() === cleanName);
    const colorId = foundLabel ? foundLabel.colorId : 'gray';
    return COLOR_PRESETS.find(p => p.id === colorId) || COLOR_PRESETS[0];
  };

  const renderEtiquetaDevolucion = (labelName: string | undefined) => {
    if (!labelName || labelName.trim() === '') {
      return <span className="text-slate-400 text-[15px] italic font-sans">— Sin Etiqueta —</span>;
    }
    const preset = getLabelPreset(labelName);
    const colorClass = isLightWhite 
      ? `${preset.lightBg} ${preset.lightText} ${preset.lightBorder}` 
      : `${preset.darkBg} ${preset.darkText} ${preset.darkBorder}`;
      
    return (
      <span className={`px-2.5 py-1 rounded-lg text-[15px] font-bold uppercase tracking-wider border ${colorClass}`}>
        {labelName}
      </span>
    );
  };
  
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
  const [showCustomCauseInput, setShowCustomCauseInput] = useState(false);
  const [tempCauseName, setTempCauseName] = useState('');

  // Tab state for professional return list vs novelties control
  const [activeSubTab, setActiveSubTab] = useState<'novelties' | 'all-returns'>('all-returns');
  const [allReturnsSearch, setAllReturnsSearch] = useState<string>('');
  const [allReturnsTagFilter, setAllReturnsTagFilter] = useState<string>('TODOS');

  // Selection and Deletion states for returned orders list
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<string[] | null>(null);

  // Auto-sync month when fecha changes
  useEffect(() => {
    if (formFecha) {
      const calculatedMonth = getMonthFromDate(formFecha);
      setFormMes(calculatedMonth);
    }
  }, [formFecha]);

  // Fallback to localStorage if Firebase is not valid or in Demo Mode
  useEffect(() => {
    const loadLocalNovelties = () => {
      if ((isDemoMode || !isFirebaseConfigValid) || !user) {
        const saved = localStorage.getItem('ecommil_return_novelties');
        if (saved) {
          try {
            setNovelties(JSON.parse(saved));
          } catch (e) {
            console.error("Error parsing local return novelties:", e);
          }
        }
        setNoveltiesLoading(false);
      }
    };

    loadLocalNovelties();

    window.addEventListener('storage', loadLocalNovelties);
    window.addEventListener('order-status-updated', loadLocalNovelties);

    return () => {
      window.removeEventListener('storage', loadLocalNovelties);
      window.removeEventListener('order-status-updated', loadLocalNovelties);
    };
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

  // Find minimum and maximum dates from orders to get the current selected date range
  const dateRange = useMemo(() => {
    if (orders.length === 0) return null;
    let minDate = '';
    let maxDate = '';
    orders.forEach(o => {
      const d = o.date || o.fechaSolicitud || o.fechaEntregaDevolucion;
      if (d) {
        const dStr = d instanceof Date ? d.toISOString().split('T')[0] : String(d);
        if (!minDate || dStr < minDate) minDate = dStr;
        if (!maxDate || dStr > maxDate) maxDate = dStr;
      }
    });
    return { minDate, maxDate };
  }, [orders]);

  // Filter novelties based on the active date range / matching active orders
  const noveltiesInDateRange = useMemo(() => {
    return novelties.filter(n => {
      // If it's linked to an order, and that order is in the current orders list, keep it!
      if (n.orderId) {
        const hasOrderInActiveList = orderLookupMap.has(n.orderId.toLowerCase());
        if (hasOrderInActiveList) return true;
      }
      
      // Otherwise, filter by the date range computed from the active orders
      if (dateRange && n.fecha) {
        return n.fecha >= dateRange.minDate && n.fecha <= dateRange.maxDate;
      }
      
      // Default fallback: keep it if no date range is set
      return !dateRange;
    });
  }, [novelties, dateRange, orderLookupMap]);

  // List of all returned orders
  const returnedOrders = useMemo(() => {
    return orders.filter(o => o.status === 'Devuelto');
  }, [orders]);

  // Compute unique tags from all returned orders for filter select dropdown
  const allReturnedOrdersTags = useMemo(() => {
    const tagsSet = new Set<string>();
    returnedOrders.forEach(o => {
      if (o.tags) {
        o.tags.split(',').forEach(t => {
          const trimmed = t.trim().toLowerCase();
          if (trimmed) {
            tagsSet.add(trimmed);
          }
        });
      }
    });
    return Array.from(tagsSet).sort();
  }, [returnedOrders]);

  // Filter returned orders for the "Todos los Pedidos Devueltos" list
  const filteredReturnedOrders = useMemo(() => {
    return returnedOrders.filter(o => {
      // Filter by tag
      if (allReturnsTagFilter !== 'TODOS') {
        if (!o.tags) return false;
        const oTagsLower = o.tags.toLowerCase();
        const targetLower = allReturnsTagFilter.toLowerCase();
        
        if (allReturnsTagFilter === 'SIN_ETIQUETA') {
          if (o.tags.trim() !== '') return false;
        } else {
          const individualTags = oTagsLower.split(',').map(t => t.trim());
          const hasTag = individualTags.includes(targetLower) || oTagsLower.includes(targetLower);
          if (!hasTag) return false;
        }
      }
      
      // Filter by search query
      const queryLower = allReturnsSearch.toLowerCase();
      if (!queryLower) return true;
      return (
        o.orderId?.toLowerCase().includes(queryLower) ||
        o.nombreCliente?.toLowerCase().includes(queryLower) ||
        o.product?.toLowerCase().includes(queryLower) ||
        o.trackingId?.toLowerCase().includes(queryLower) ||
        o.tags?.toLowerCase().includes(queryLower) ||
        o.transportadora?.toLowerCase().includes(queryLower)
      );
    });
  }, [returnedOrders, allReturnsSearch, allReturnsTagFilter]);

  const handleToggleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const allFilteredIds = filteredReturnedOrders.map(o => o.id);
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedOrderIds.includes(id));
    
    if (allSelected) {
      setSelectedOrderIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedOrderIds(prev => {
        const newSelection = [...prev];
        allFilteredIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingIds || deletingIds.length === 0) return;
    if (onDeleteOrders) {
      await onDeleteOrders(deletingIds);
    }
    setSelectedOrderIds(prev => prev.filter(id => !deletingIds.includes(id)));
    setDeletingIds(null);
  };

  const findAssociatedNovelty = (order: Order) => {
    return novelties.find(n => 
      (n.orderId && order.orderId && n.orderId.toLowerCase() === order.orderId.toLowerCase()) || 
      (n.orderId && order.id && n.orderId.toLowerCase() === order.id.toLowerCase())
    );
  };

  const handleCreateNoveltyFromOrder = (order: Order) => {
    // Open the form
    setIsFormOpen(true);
    // Select editing/creating from order
    setSelectedOrderId(order.id || order.orderId);
    // Pre-fill the form values
    setFormOrderId(order.orderId || '');
    setFormGuia(order.trackingId || '');
    setFormProductName(order.product || '');
    setFormNombreCliente(order.nombreCliente || '');
    setFormTransportadora(order.transportadora || '');
    if (order.date) {
      const formattedDate = new Date(order.date).toISOString().split('T')[0];
      setFormFecha(formattedDate);
    }
    // Set a default description
    setFormDescripcion(`Creado automáticamente desde el pedido devuelto.`);
    setFormResolucion('🔄 Devolución');
    
    // Switch sub-tab to novelties so they see the form
    setActiveSubTab('novelties');
    
    // Scroll to form or focus after transition
    setTimeout(() => {
      const formElement = document.querySelector('form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const renderOrderTags = (tagsString: string | undefined) => {
    if (!tagsString || tagsString.trim() === '') {
      return <span className="text-slate-500 text-[15px] italic">Sin etiquetas</span>;
    }
    const tagsList = tagsString.split(',').map(t => t.trim()).filter(Boolean);
    return (
      <div className="flex flex-wrap gap-1.5">
        {tagsList.map((tag, idx) => {
          const preset = getLabelPreset(tag);
          const colorClass = isLightWhite 
            ? `${preset.lightBg} ${preset.lightText} ${preset.lightBorder}` 
            : `${preset.darkBg} ${preset.darkText} ${preset.darkBorder}`;
          return (
            <span key={idx} className={`text-[14px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider ${colorClass}`}>
              {tag}
            </span>
          );
        })}
      </div>
    );
  };

  // Filter return novelties for listing
  const filteredNovelties = useMemo(() => {
    return noveltiesInDateRange.filter(n => {
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
  }, [noveltiesInDateRange, noveltySearch, noveltyTagFilter, noveltyDevolucionFilter, orderLookupMap]);

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
    const totalNovelties = noveltiesInDateRange.length;

    // Carrier distribution (Distribución de Transportadoras)
    const carrierMap: Record<string, { name: string, total: number, devuelto: number, reintento: number, solucionado: number }> = {};
    noveltiesInDateRange.forEach(n => {
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
    noveltiesInDateRange.forEach(n => {
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

    const detailedNoveltiesList = noveltiesInDateRange.map(n => ({
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
  }, [noveltiesInDateRange]);

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

        <div className={`lg:col-span-2 glass-card p-8 border ${isLightWhite ? 'bg-white border-slate-200 shadow-sm' : '!bg-black border-slate-900 shadow-[0_0_25px_rgba(0,0,0,0.9)]'} flex flex-col justify-between`}>
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className={`text-xl font-display font-bold ${isLightWhite ? 'text-slate-800' : 'text-white'}`}>Análisis de Cancelaciones</h3>
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
                      contentStyle={{ 
                        backgroundColor: isLightWhite ? '#ffffff' : '#000000', 
                        border: isLightWhite ? '1px solid #e2e8f0' : '1px solid #1f1f2e', 
                        borderRadius: '8px' 
                      }}
                      itemStyle={{ 
                        color: isLightWhite ? '#1e293b' : '#fff', 
                        fontSize: '15px', 
                        fontFamily: 'DM Mono' 
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className={`overflow-hidden border rounded-xl ${isLightWhite ? 'border-slate-100 bg-slate-50/50' : 'border-border bg-transparent'}`}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b ${isLightWhite ? 'bg-slate-50 border-slate-100' : 'bg-background border-border'}`}>
                      <th className="px-4 py-3 text-[15px] uppercase tracking-widest text-slate-500 font-display">Motivo</th>
                      <th className="px-4 py-3 text-[15px] uppercase tracking-widest text-slate-500 font-display text-right">Pedidos</th>
                      <th className="px-4 py-3 text-[15px] uppercase tracking-widest text-slate-500 font-display text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.pieData.map((entry, index) => (
                      <tr key={entry.name} className={`border-b transition-colors ${isLightWhite ? 'border-slate-100/50 hover:bg-slate-100' : 'border-border/50 hover:bg-white/5'}`}>
                        <td className="px-4 py-3 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className={`text-base truncate ${isLightWhite ? 'text-slate-700' : 'text-slate-300'}`}>{entry.name}</span>
                        </td>
                        <td className={`px-4 py-3 text-base font-mono font-bold text-right ${isLightWhite ? 'text-slate-900' : 'text-white'}`}>{entry.value}</td>
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
              <div className={`py-4 text-center rounded-xl border ${isLightWhite ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/30 border-slate-900'}`}>
                <p className="text-xs text-slate-500 font-medium">No hay pedidos cancelados registrados en este periodo.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                {orders.filter(o => o.status === 'Cancelado').map(order => {
                  const currentReason = localCancellationReasons[order.id] || order.cancellationReason || "";
                  return (
                    <div key={order.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl transition-colors border ${
                      isLightWhite 
                        ? 'bg-slate-50/60 border-slate-200/60 hover:border-slate-300' 
                        : 'bg-slate-950/40 border-slate-900/60 hover:border-slate-800'
                    }`}>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono font-bold uppercase ${isLightWhite ? 'text-slate-800' : 'text-white'}`}>{order.orderId || order.id.substring(0, 8)}</span>
                          <span className="text-[9px] bg-red-500/10 text-red-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Cancelado</span>
                        </div>
                        <span className="text-[11px] text-slate-400 mt-1">
                          Cliente: <strong className={isLightWhite ? 'text-slate-700' : 'text-slate-300'}>{order.nombreCliente || "Manual"}</strong> | Producto: <strong className={isLightWhite ? 'text-slate-600' : 'text-slate-400'}>{order.product || "No especificado"}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={currentReason}
                          onChange={(e) => handleAssignCancellationReason(order.id, e.target.value)}
                          className={`rounded-lg text-[11px] py-1 px-2 focus:outline-none focus:border-emerald-500 transition-colors min-w-[160px] cursor-pointer border ${
                            isLightWhite 
                              ? 'bg-white border-slate-200 text-slate-800' 
                              : 'bg-black border-slate-800 text-slate-200'
                          }`}
                        >
                          <option value="" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111]'}>-- Sin motivo --</option>
                          <option value="Cambio de opinión" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111]'}>Cambio de opinión</option>
                          <option value="Error en dirección" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111]'}>Error en dirección</option>
                          <option value="Precio alto" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111]'}>Precio alto</option>
                          <option value="Tiempo de entrega" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111]'}>Tiempo de entrega</option>
                          <option value="Duplicado" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111]'}>Duplicado</option>
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-border/60 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-orange-400 font-bold">
              <RotateCcw size={16} />
              <span className="text-xs tracking-wider uppercase font-mono">Control y Seguimiento</span>
            </div>
            <h3 className="text-2xl font-display font-extrabold text-white">Análisis y Gestión de Devoluciones</h3>
            <p className="text-sm text-slate-400">Inspecciona todos los pedidos devueltos en Dropi con sus etiquetas o registra fichas de novedades operativas.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 self-start lg:self-center">
            {/* Sub-tab selection controls */}
            <div className="flex items-center p-1 bg-background/80 border border-border/60 rounded-xl">
              <button
                onClick={() => setActiveSubTab('all-returns')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  activeSubTab === 'all-returns'
                    ? 'bg-neon/15 text-neon shadow-[0_0_15px_rgba(34,197,94,0.1)] border border-neon/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📦 Pedidos Devueltos ({returnedOrders.length})
              </button>
              <button
                onClick={() => setActiveSubTab('novelties')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  activeSubTab === 'novelties'
                    ? 'bg-neon/15 text-neon shadow-[0_0_15px_rgba(34,197,94,0.1)] border border-neon/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ✍️ Gestión de Novedades ({novelties.length})
              </button>
            </div>

            {activeSubTab === 'novelties' && (
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
            )}
          </div>
        </div>

        {activeSubTab === 'novelties' && (
          <div className="space-y-6">
            {/* Formulario de registro/edición de Novedades (Inline & Animado) */}
        {isFormOpen && (
          <form onSubmit={handleSubmitNovelty} className={`p-6 rounded-2xl border space-y-6 animate-fade-in ${
            isLightWhite ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'bg-black/40 border-border/80 text-white'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-gold" />
              <h4 className={`text-lg font-bold uppercase tracking-wider font-display ${isLightWhite ? 'text-slate-800' : 'text-white'}`}>
                {editingNovelty ? 'Editar Registro de Novedad' : 'Ingresar Nueva Novedad de Pedido'}
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Fecha */}
              <div className="space-y-2">
                <label className={`block uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-[13px] text-slate-600' : 'text-[14px] text-slate-300'}`}>Fecha del Suceso</label>
                <input
                  type="date"
                  required
                  value={formFecha}
                  onChange={(e) => setFormFecha(e.target.value)}
                  className={`w-full border focus:border-gold rounded-xl px-4 py-2.5 font-mono focus:outline-none focus:ring-1 focus:ring-gold ${
                    isLightWhite 
                      ? 'bg-white border-slate-200 text-slate-800 text-[15px]' 
                      : 'bg-[#111] border-border text-white text-[14px]'
                  }`}
                />
              </div>

              {/* Mes de Registro */}
              <div className="space-y-2">
                <label className={`block uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-[12px] text-slate-600' : 'text-[14px] text-slate-300'}`}>Mes de Registro</label>
                <select
                  value={formMes}
                  onChange={(e) => setFormMes(e.target.value)}
                  className={`w-full border focus:border-gold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-gold font-sans ${
                    isLightWhite 
                      ? 'bg-white border-slate-200 text-slate-800 text-[15px]' 
                      : 'bg-[#111] border-border text-white text-[14px]'
                  }`}
                >
                  <option value="" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111]'}>-- Seleccionar Mes --</option>
                  {MONTHS_SPANISH.map((m) => (
                    <option key={m} value={m} className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111] text-white'}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pedido de referencia (Drop-down de pedidos con estado Devuelto/Incidencia) */}
              <div className="space-y-2">
                <label className={`block uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-[12px] text-slate-600' : 'text-[14px] text-slate-300'}`}>Vincular con Devolución</label>
                <select
                  value={selectedOrderId}
                  onChange={handleSelectOrderChange}
                  className={`w-full border focus:border-gold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-gold ${
                    isLightWhite 
                      ? 'bg-white border-slate-200 text-slate-800 text-[15px]' 
                      : 'bg-[#111] border-border text-white text-[14px]'
                  }`}
                >
                  <option value="manual" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111]'}>-- INGRESO MANUAL (Sin Vincular) --</option>
                  {returnedOrdersDropdown.map((o) => (
                    <option key={o.id || o.orderId} value={o.id || o.orderId} className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111] text-white'}>
                      {o.orderId} - {o.nombreCliente} ({o.product})
                    </option>
                  ))}
                </select>
              </div>

              {/* ID Pedido */}
              <div className="space-y-2">
                <label className={`block uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-[12px] text-slate-600' : 'text-[14px] text-slate-300'}`}>ID Pedido</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. DROP0123"
                  value={formOrderId}
                  onChange={(e) => setFormOrderId(e.target.value)}
                  className={`w-full border focus:border-gold rounded-xl px-4 py-2.5 font-mono focus:outline-none focus:ring-1 focus:ring-gold ${
                    isLightWhite 
                      ? 'bg-white border-slate-200 text-slate-800 text-[15px]' 
                      : 'bg-[#111] border-border text-white text-[14px]'
                  }`}
                />
              </div>

              {/* Guía de Transporte de retorno */}
              <div className="space-y-2">
                <label className={`block uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-[12px] text-slate-600' : 'text-[14px] text-slate-300'}`}>Guía de Transporte</label>
                <input
                  type="text"
                  placeholder="Ej. 10020439294"
                  value={formGuia}
                  onChange={(e) => setFormGuia(e.target.value)}
                  className={`w-full border focus:border-gold rounded-xl px-4 py-2.5 font-mono focus:outline-none focus:ring-1 focus:ring-gold ${
                    isLightWhite 
                      ? 'bg-white border-slate-200 text-slate-800 text-[15px]' 
                      : 'bg-[#111] border-border text-white text-[14px]'
                  }`}
                />
              </div>

              {/* Transportadora */}
              <div className="space-y-2">
                <label className={`block uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-[12px] text-slate-600' : 'text-[14px] text-slate-300'}`}>Transportadora</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ej. Servientrega, Interrapidisimo..."
                    value={formTransportadora}
                    onChange={(e) => setFormTransportadora(e.target.value)}
                    list="carriers-list"
                    className={`w-full border focus:border-gold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-gold font-sans ${
                      isLightWhite 
                        ? 'bg-white border-slate-200 text-slate-800 text-[15px]' 
                        : 'bg-[#111] border-border text-white text-[14px]'
                    }`}
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
                <label className={`block uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-[12px] text-slate-600' : 'text-[14px] text-slate-300'}`}>Producto Relacionado</label>
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
                      className={`w-full border focus:border-gold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-gold font-sans ${
                        isLightWhite 
                          ? 'bg-white border-slate-200 text-slate-800 text-[15px]' 
                          : 'bg-[#111] border-border text-white text-[14px]'
                      }`}
                    >
                      <option value="" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111]'}>-- Seleccione un Producto --</option>
                      {savedProducts.map((p) => (
                        <option key={p.id} value={p.name} className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111] text-white'}>
                          {p.name}
                        </option>
                      ))}
                      <option value="__MANUAL_INPUT__" className={isLightWhite ? 'bg-white text-gold font-bold' : 'bg-[#111] text-gold font-bold'}>
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
                        className={`w-full border focus:border-gold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-gold font-sans ${
                          isLightWhite 
                            ? 'bg-white border-slate-200 text-slate-800 text-[15px]' 
                            : 'bg-[#111] border-border text-white text-[14px]'
                        }`}
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
                <label className={`block uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-[12px] text-slate-600' : 'text-[14px] text-slate-300'}`}>Nombre del Cliente</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Fray Rojas"
                  value={formNombreCliente}
                  onChange={(e) => setFormNombreCliente(e.target.value)}
                  className={`w-full border focus:border-gold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-gold ${
                    isLightWhite 
                      ? 'bg-white border-slate-200 text-slate-800 text-[15px]' 
                      : 'bg-[#111] border-border text-white text-[14px]'
                  }`}
                />
              </div>

              {/* Origen/Causa de Novedad */}
              <div className="space-y-2">
                <label className={`block uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-[12px] text-slate-600' : 'text-[14px] text-slate-300'}`}>Causa / Origen de Incidencia</label>
                <div className="space-y-2">
                  {!showCustomCauseInput ? (
                    <div className="flex gap-2">
                      <select
                        value={formOrigenNovedad}
                        onChange={(e) => {
                          if (e.target.value === 'ADD_NEW') {
                            setShowCustomCauseInput(true);
                          } else {
                            setFormOrigenNovedad(e.target.value);
                          }
                        }}
                        className={`flex-1 border focus:border-gold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-gold font-sans ${
                          isLightWhite 
                            ? 'bg-white border-slate-200 text-slate-800 text-[15px]' 
                            : 'bg-[#111] border-border text-white text-[14px]'
                        }`}
                      >
                        <option value="Cliente no responde / Apagado / No contestó" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111] text-white'}>Cliente no responde / Apagado</option>
                        <option value="Dirección incorrecta / incompleta / Sin cobertura" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111] text-white'}>Dirección incorrecta / Sin cobertura</option>
                        <option value="Rechazado por precio / Falta de dinero" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111] text-white'}>Rechazado por precio / Falta de dinero</option>
                        <option value="Paquete dañado / averiado por transportadora" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111] text-white'}>Paquete dañado por transportadora</option>
                        <option value="Error en producto (Mala calidad, talla, color incorrecto)" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111] text-white'}>Error en producto (Fallas, color, talla)</option>
                        <option value="Rechazado porque demoró mucho en llegar" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111] text-white'}>Demora excesiva en entrega</option>
                        <option value="Estafa de entrega / Cliente arrepentido / No pidió" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111] text-white'}>Estafa de entrega / Cliente arrepentido / No pidió</option>
                        <option value="Otro motivo de logística" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111] text-white'}>Otro motivo de logística</option>
                        {customOrigines.map((cause, idx) => (
                          <option key={idx} value={cause} className={isLightWhite ? 'bg-white text-cyan-600 font-sans' : 'bg-[#111] text-cyan-400 font-sans'}>
                            {cause}
                          </option>
                        ))}
                        <option value="ADD_NEW" className="text-gold font-bold font-sans">+ Agregar causa personalizada...</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCustomCauseInput(true)}
                        className={`p-2.5 border rounded-xl transition-all flex items-center justify-center shrink-0 ${
                          isLightWhite 
                            ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' 
                            : 'bg-[#111] border-border text-slate-300 hover:bg-white/5'
                        }`}
                        title="Agregar Causa Personalizada"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nueva causa personalizada..."
                        value={tempCauseName}
                        onChange={(e) => setTempCauseName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = tempCauseName.trim();
                            if (val) {
                              if (!customOrigines.includes(val)) {
                                setCustomOrigines(prev => [...prev, val]);
                              }
                              setFormOrigenNovedad(val);
                              setTempCauseName('');
                              setShowCustomCauseInput(false);
                            }
                          }
                        }}
                        className={`flex-1 border rounded-xl px-4 py-2.5 focus:outline-none focus:border-gold font-sans ${
                          isLightWhite 
                            ? 'bg-white border-slate-200 text-slate-800 text-[14px] placeholder-slate-400' 
                            : 'bg-[#151522] border-border/85 text-white text-xs placeholder-slate-500'
                        }`}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = tempCauseName.trim();
                          if (val) {
                            if (!customOrigines.includes(val)) {
                              setCustomOrigines(prev => [...prev, val]);
                            }
                            setFormOrigenNovedad(val);
                            setTempCauseName('');
                            setShowCustomCauseInput(false);
                          }
                        }}
                        className="px-4 py-2.5 bg-gold hover:brightness-110 text-background rounded-xl text-xs font-extrabold uppercase whitespace-nowrap transition-all"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTempCauseName('');
                          setShowCustomCauseInput(false);
                        }}
                        className={`p-2.5 border rounded-xl transition-all flex items-center justify-center shrink-0 ${
                          isLightWhite 
                            ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' 
                            : 'bg-[#111] border-border text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Estado / Acción actual */}
              <div className="space-y-2 md:col-span-1">
                <label className={`block uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-[12px] text-slate-600' : 'text-[14px] text-slate-300'}`}>Estado del Proceso (Acción)</label>
                <select
                  value={formResolucion}
                  onChange={(e) => setFormResolucion(e.target.value)}
                  className={`w-full border focus:border-gold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-gold font-sans ${
                    isLightWhite 
                      ? 'bg-white border-slate-200 text-slate-800 text-[15px]' 
                      : 'bg-[#111] border-border text-white text-[14px]'
                  }`}
                >
                  <option value="🟡 En Proceso de Retorno / Bodega" className={isLightWhite ? 'bg-white text-slate-800' : 'bg-[#111] text-white'}>🟡 En Proceso de Retorno / Bodega</option>
                  <option value="🔄 Devolución" className={isLightWhite ? 'bg-white text-orange-600' : 'bg-[#111] text-orange-400'}>🔄 Devolución</option>
                  <option value="⚡ Devolución Express Center" className={isLightWhite ? 'bg-white text-amber-600' : 'bg-[#111] text-amber-400'}>⚡ Devolución Express Center</option>
                  <option value="🔴 Pérdida Total (Paquete destruido/hurtado)" className={isLightWhite ? 'bg-white text-red-600' : 'bg-[#111] text-red-500'}>🔴 Pérdida Total (Paquete destruido/hurtado)</option>
                  <option value="🟢 Re-despachado con éxito (Segundo intento)" className={isLightWhite ? 'bg-white text-[#16a34a]' : 'bg-[#111] text-[#22c55e]'}>🟢 Re-despachado con éxito (Segundo intento)</option>
                  <option value="🔵 Entregado con descuento / Acuerdo de precio" className={isLightWhite ? 'bg-white text-blue-600' : 'bg-[#111] text-blue-400'}>🔵 Entregado con descuento / Acuerdo de precio</option>
                  <option value="📦 Retorno recibido y verificado en bodega" className={isLightWhite ? 'bg-white text-cyan-600 font-sans' : 'bg-[#111] text-cyan-400 font-sans'}>📦 Retorno recibido y verificado en bodega</option>
                  <option value="⚙️ En gestión con transporte / Reclamo" className={isLightWhite ? 'bg-white text-slate-600 font-sans' : 'bg-[#111] text-slate-400 font-sans'}>⚙️ En gestión con transporte / Reclamo</option>
                </select>
              </div>

              {/* Etiqueta por Devolución */}
              <div className="space-y-2 md:col-span-1">
                <label className={`block uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-[12px] text-slate-600' : 'text-[14px] text-slate-300'}`}>Etiqueta por Devolución</label>
                <select
                  value={formEtiquetaDevolucion}
                  onChange={(e) => setFormEtiquetaDevolucion(e.target.value)}
                  className={`w-full border focus:border-gold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-gold font-sans ${
                    isLightWhite 
                      ? 'bg-white border-slate-200 text-slate-800 text-[15px]' 
                      : 'bg-[#111] border-border text-white text-[14px]'
                  }`}
                >
                  <option value="" className={isLightWhite ? 'bg-white text-slate-500' : 'bg-[#111] text-slate-500'}>-- Ninguna / Sin Etiqueta --</option>
                  {customLabels.map(lbl => {
                    const preset = getLabelPreset(lbl.name);
                    return (
                      <option 
                        key={lbl.name} 
                        value={lbl.name} 
                        className={isLightWhite ? 'bg-white text-slate-800 font-bold' : 'bg-[#111] text-white font-bold'}
                        style={{ color: preset.dotBg }}
                      >
                        {lbl.name}
                      </option>
                    );
                  })}
                </select>
                <div className="flex items-center justify-between mt-1">
                  <button
                    type="button"
                    onClick={() => setIsTagManagerOpen(true)}
                    className="text-[14px] text-gold hover:underline font-bold flex items-center gap-1.5 cursor-pointer mt-1"
                  >
                    🎨 Personalizar Etiquetas y Paleta de Colores
                  </button>
                </div>
              </div>

              {/* Descripción detallada */}
              <div className="space-y-2 md:col-span-3">
                <label className={`block uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-[12px] text-slate-600' : 'text-[14px] text-slate-300'}`}>Explicación por qué surgió la novedad (Copia chat o detalle)</label>
                <textarea
                  required
                  placeholder="Detalla detalladamente qué causó la novedad. Ej: La transportadora reprogramó la entrega 2 veces..."
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  rows={2.5}
                  className={`w-full border focus:border-gold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-gold resize-none ${
                    isLightWhite 
                      ? 'bg-white border-slate-200 text-slate-800 text-[15px] placeholder-slate-400' 
                      : 'bg-[#111] border-border text-white text-[14px]'
                  }`}
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
              <div className={`flex items-center gap-2 border rounded-xl px-3 py-1.5 h-8 ${isLightWhite ? 'bg-white border-[#f3e8e8]' : 'border-border bg-[#0c0c14]'}`}>
                <span className={`uppercase font-black tracking-widest text-slate-500 ${isLightWhite ? 'text-[12px]' : 'text-[10px]'}`}>Etiqueta de Pedido:</span>
                <select 
                  value={noveltyTagFilter}
                  onChange={(e) => setNoveltyTagFilter(e.target.value)}
                  className={`bg-transparent border-none p-0 ${isLightWhite ? 'text-[14px]' : 'text-xs'} font-bold text-gold uppercase focus:outline-none focus:ring-0 cursor-pointer h-full`}
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
              <div className={`flex items-center gap-2 border rounded-xl px-3 py-1.5 h-8 ${isLightWhite ? 'bg-white border-[#f3e8e8]' : 'border-border bg-[#0c0c14]'}`}>
                <span className={`uppercase font-black tracking-widest text-slate-500 ${isLightWhite ? 'text-[12px]' : 'text-[10px]'}`}>Etiqueta Devolución:</span>
                <select 
                  value={noveltyDevolucionFilter}
                  onChange={(e) => setNoveltyDevolucionFilter(e.target.value)}
                  className={`bg-transparent border-none p-0 ${isLightWhite ? 'text-[13px]' : 'text-xs'} font-bold text-gold uppercase focus:outline-none focus:ring-0 cursor-pointer h-full`}
                >
                  <option value="TODOS" className="bg-[#111] text-white font-bold">TODAS</option>
                  <option value="SIN_ETIQUETA" className="bg-[#111] text-[#ef4444] font-bold">SIN ETIQUETA</option>
                  {customLabels.map(lbl => {
                    const preset = getLabelPreset(lbl.name);
                    return (
                      <option 
                        key={lbl.name} 
                        value={lbl.name} 
                        className="bg-[#111] font-bold"
                        style={{ color: preset.dotBg }}
                      >
                        {lbl.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Botón rápido paleta */}
              <button
                type="button"
                onClick={() => setIsTagManagerOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 h-8 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  isLightWhite 
                    ? 'bg-white border-[#f3e8e8] hover:bg-slate-50 text-slate-700' 
                    : 'border-border bg-[#0c0c14] hover:bg-white/5 text-slate-300'
                }`}
                title="Personalizar etiquetas y paleta de colores"
              >
                <Palette size={14} className="text-gold" />
                <span className="hidden md:inline">Colores y Etiquetas</span>
              </button>

              {/* Búsqueda de novedad */}
              <div className={`relative w-full sm:w-64 h-8 flex items-center rounded-xl ${isLightWhite ? 'bg-[#edf2f8] border border-slate-200' : ''}`}>
                <span className={`absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none ${isLightWhite ? 'text-[12px]' : ''}`}>
                  <Search size={15} />
                </span>
                <input
                  type="text"
                  placeholder="Buscar novedad..."
                  value={noveltySearch}
                  onChange={(e) => setNoveltySearch(e.target.value)}
                  className={`w-full bg-transparent border-none pl-9 pr-4 py-1.5 font-sans h-full focus:outline-none ${
                    isLightWhite 
                      ? 'text-slate-800 text-[14px] placeholder-slate-400' 
                      : 'text-white text-xs placeholder-slate-500'
                  }`}
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
            <div className={`overflow-x-auto border rounded-2xl ${isLightWhite ? 'bg-white border-slate-200' : 'border-border bg-[#08080f]/50'}`}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b text-[15px] ${isLightWhite ? 'bg-slate-50 border-slate-200' : 'bg-background border-b border-border/80'}`}>
                    <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Fecha</th>
                    <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Mes</th>
                    <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>ID Pedido</th>
                    <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Guía / Tracking</th>
                    <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Cliente / Producto</th>
                    <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Etiqueta Devolución</th>
                    <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Transportadora</th>
                    <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Incidencia / Causa</th>
                    <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Explicación Suceso</th>
                    <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Estado Acción</th>
                    <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display text-right w-24 ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Acciones</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLightWhite ? 'divide-slate-100' : 'divide-border/40'}`}>
                  {filteredNovelties.map((item, index) => {
                    // Pre-generate nice tag styling based on causes
                    let causeStyle = isLightWhite 
                      ? 'bg-orange-50 text-orange-700 border-orange-200' 
                      : 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                    if (item.origenNovedad.includes('Transporte') || item.origenNovedad.includes('transportadora')) {
                      causeStyle = isLightWhite 
                        ? 'bg-red-50 text-red-700 border-red-200' 
                        : 'bg-red-500/10 text-red-400 border-red-500/20';
                    } else if (item.origenNovedad.includes('Error en producto')) {
                      causeStyle = isLightWhite 
                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                    } else if (item.origenNovedad.includes('Cliente no responde')) {
                      causeStyle = isLightWhite 
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200' 
                        : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
                    }

                    // Resolution status labels
                    let resStyle = isLightWhite 
                      ? 'bg-slate-50 text-slate-600 border border-slate-200' 
                      : 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
                    if (item.resolucion.includes('🟢')) {
                      resStyle = isLightWhite 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-emerald-500/10 text-[#22c55e] border border-emerald-500/20';
                    } else if (item.resolucion.includes('🟡')) {
                      resStyle = isLightWhite 
                        ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' 
                        : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
                    } else if (item.resolucion.includes('🔴')) {
                      resStyle = isLightWhite 
                        ? 'bg-red-50 text-red-700 border border-red-200' 
                        : 'bg-red-500/10 text-red-500 border-red-500/20';
                    } else if (item.resolucion.includes('📦')) {
                      resStyle = isLightWhite 
                        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                    } else if (item.resolucion.includes('🔄') || item.resolucion === 'Devolución') {
                      resStyle = isLightWhite 
                        ? 'bg-orange-50 text-orange-700 border border-orange-200' 
                        : 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                    } else if (item.resolucion.includes('⚡') || item.resolucion === 'Devolución Express Center') {
                      resStyle = isLightWhite 
                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                        : 'bg-amber-500/10 text-gold border border-gold/20';
                    }

                    return (
                      <tr key={item.id} className={`transition-colors group ${isLightWhite ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar size={15} className="text-slate-500" />
                            <span className={`font-mono ${isLightWhite ? 'text-slate-700 text-[15px]' : 'text-slate-300 text-[15px]'}`}>{item.fecha}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`font-semibold font-display ${isLightWhite ? 'text-[15px] text-amber-600' : 'text-[15px] text-amber-400'}`}>
                            {item.mes || getMonthFromDate(item.fecha) || 'Sin Mes'}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`font-mono font-bold block truncate ${isLightWhite ? 'text-slate-800 text-[15px]' : 'text-white text-[15px]'}`}>{item.orderId || "M-MANUAL"}</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`font-mono font-medium block truncate ${isLightWhite ? 'text-cyan-700 text-[15px]' : 'text-cyan-300 text-[15px]'}`}>{item.guia || "Sin Guía"}</span>
                        </td>
                        <td className="px-5 py-4 max-w-[200px]">
                          <div>
                            <span className={`block truncate font-medium ${isLightWhite ? 'text-slate-800 text-[15px]' : 'text-slate-300 text-[15px]'}`}>{item.nombreCliente}</span>
                            {item.productName && (
                              <span className="text-[15px] text-slate-500 block italic truncate">{item.productName}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {renderEtiquetaDevolucion(item.etiquetaDevolucion)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`font-semibold px-2.5 py-1 rounded-lg border block text-center max-w-[150px] truncate ${
                            isLightWhite 
                              ? 'text-cyan-700 bg-cyan-50 border-cyan-100 text-[15px]' 
                              : 'text-cyan-400 bg-cyan-950/20 border-cyan-500/10 text-[15px]'
                          }`}>
                            {item.transportadora || 'No especificada'}
                          </span>
                        </td>
                        <td 
                          className={`px-5 py-4 ${index === 0 ? 'h-[8.7109px] w-[47.5px]' : ''}`}
                          style={index === 0 ? { height: '8.7109px', width: '47.5px' } : undefined}
                        >
                          <span 
                            className={`px-2.5 py-1 rounded-full text-[15px] uppercase tracking-wider border font-semibold ${causeStyle} max-w-[180px] inline-block truncate ${index === 0 ? 'w-[246px] text-center' : ''}`}
                            style={index === 0 ? { width: '246px', textAlign: 'center' } : undefined}
                          >
                            {item.origenNovedad}
                          </span>
                        </td>
                        <td className="px-5 py-4 max-w-[320px]">
                          <p className={`whitespace-pre-wrap break-words leading-relaxed ${isLightWhite ? 'text-slate-700 text-[15px]' : 'text-slate-300 text-[15px]'}`}>{item.descripcion}</p>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-[15px] uppercase tracking-wider font-semibold ${resStyle}`}>
                            {item.resolucion.replace(/[🟡🔴🟢🔵📦⚙️🔄⚡]\s*/g, '')}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right text-xs">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => handleEditNovelty(item)}
                              title="Editar Novedad"
                              className={`p-1.5 transition-colors cursor-pointer ${isLightWhite ? 'text-slate-400 hover:text-slate-800' : 'text-slate-400 hover:text-white'}`}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteNovelty(item.id)}
                              title="Eliminar Novedad"
                              className={`p-1.5 transition-colors cursor-pointer ${isLightWhite ? 'text-slate-400 hover:text-red-500' : 'text-slate-400 hover:text-red-400'}`}
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
        )}

        {/* All returned orders UI block */}
        {activeSubTab === 'all-returns' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h4 className="text-base font-bold font-display text-white uppercase tracking-wider">
                Pedidos Devueltos en el Sistema ({filteredReturnedOrders.length})
              </h4>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Filter tags */}
                <div className={`flex items-center gap-2 border rounded-xl px-3 py-1.5 h-8 ${isLightWhite ? 'bg-white border-[#f3e8e8]' : 'border-border bg-[#0c0c14]'}`}>
                  <span className={`uppercase font-black tracking-widest text-slate-500 ${isLightWhite ? 'text-[12px]' : 'text-[10px]'}`}>Etiqueta Dropi:</span>
                  <select 
                    value={allReturnsTagFilter}
                    onChange={(e) => setAllReturnsTagFilter(e.target.value)}
                    className={`bg-transparent border-none p-0 ${isLightWhite ? 'text-[14px]' : 'text-xs'} font-bold text-gold uppercase focus:outline-none focus:ring-0 cursor-pointer h-full`}
                  >
                    <option value="TODOS" className="bg-[#111] text-white">TODAS</option>
                    <option value="SIN_ETIQUETA" className="bg-[#111] text-[#ef4444]">SIN ETIQUETA</option>
                    {allReturnedOrdersTags.map(tag => (
                      <option key={tag} value={tag} className="bg-[#111] text-sky-400">
                        {tag.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search returned orders */}
                <div className={`relative w-full sm:w-64 h-8 flex items-center rounded-xl ${isLightWhite ? 'bg-[#edf2f8] border border-slate-200' : ''}`}>
                  <span className={`absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none ${isLightWhite ? 'text-[12px]' : ''}`}>
                    <Search size={15} />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar pedido devuelto..."
                    value={allReturnsSearch}
                    onChange={(e) => setAllReturnsSearch(e.target.value)}
                    className={`w-full bg-transparent border-none pl-9 pr-4 py-1.5 font-sans h-full focus:outline-none ${
                      isLightWhite 
                        ? 'text-slate-800 text-[14px] placeholder-slate-400' 
                        : 'text-white text-xs placeholder-slate-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {selectedOrderIds.length > 0 && (
              <div className={`p-4 rounded-xl flex items-center justify-between animate-fade-in border ${
                isLightWhite 
                  ? 'bg-amber-50/50 border-amber-200 text-slate-800' 
                  : 'bg-amber-500/10 border-amber-500/20 text-white'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[15px] font-semibold">
                    {selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'pedido seleccionado' : 'pedidos seleccionados'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedOrderIds([])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      isLightWhite ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    Desmarcar todos
                  </button>
                  <button
                    onClick={() => setDeletingIds(selectedOrderIds)}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-black tracking-widest uppercase transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Trash2 size={13} /> Eliminar Seleccionados
                  </button>
                </div>
              </div>
            )}

            {filteredReturnedOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-[#0c0c12]/30 rounded-2xl border border-dashed border-border text-center space-y-3">
                <AlertCircle size={36} className="text-slate-600" />
                <div>
                  <p className="text-base font-medium text-slate-300">No hay pedidos devueltos con estos filtros</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Prueba cambiando las fechas en el filtro general arriba o cambia el filtro de etiquetas.
                  </p>
                </div>
              </div>
            ) : (
              <div className={`overflow-x-auto border rounded-2xl ${isLightWhite ? 'bg-white border-slate-200' : 'border-border bg-[#08080f]/50'}`}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b text-[15px] ${isLightWhite ? 'bg-slate-50 border-slate-200' : 'bg-background border-b border-border/80'}`}>
                      <th className="px-4 py-4 text-center w-12">
                        <input
                          type="checkbox"
                          checked={filteredReturnedOrders.length > 0 && filteredReturnedOrders.every(o => selectedOrderIds.includes(o.id))}
                          onChange={handleToggleSelectAll}
                          className="w-4 h-4 rounded border-gray-300 text-neon focus:ring-neon accent-neon bg-[#0c0c14] border-border cursor-pointer"
                        />
                      </th>
                      <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Fecha</th>
                      <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>ID Pedido</th>
                      <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Guía / Tracking</th>
                      <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Cliente</th>
                      <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Producto</th>
                      <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Etiquetas Dropi</th>
                      <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Estado Ficha</th>
                      <th className={`px-5 py-4 text-[15px] uppercase tracking-widest font-extrabold font-display ${isLightWhite ? 'text-slate-600' : 'text-slate-400'}`}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isLightWhite ? 'divide-slate-100' : 'divide-border/40'}`}>
                    {filteredReturnedOrders.map((order) => {
                      const associatedNovelty = findAssociatedNovelty(order);
                      const hasFicha = !!associatedNovelty;
                      const orderDateFormatted = order.date ? new Date(order.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '---';
                      
                      return (
                        <tr key={order.id} className={`hover:bg-white/5 transition-colors ${isLightWhite ? 'hover:bg-slate-50' : ''} ${selectedOrderIds.includes(order.id) ? (isLightWhite ? 'bg-amber-50/25' : 'bg-amber-500/5') : ''}`}>
                          <td className="px-4 py-4 text-center w-12">
                            <input
                              type="checkbox"
                              checked={selectedOrderIds.includes(order.id)}
                              onChange={() => handleToggleSelectOrder(order.id)}
                              className="w-4 h-4 rounded border-gray-300 text-neon focus:ring-neon accent-neon bg-[#0c0c14] border-border cursor-pointer"
                            />
                          </td>
                          <td className="px-5 py-4 font-mono text-[15px] text-slate-400 font-medium">
                            {orderDateFormatted}
                          </td>
                          <td className="px-5 py-4 font-mono text-[15px] font-bold">
                            <span className={isLightWhite ? 'text-slate-800' : 'text-white'}>{order.orderId}</span>
                          </td>
                          <td className="px-5 py-4 font-mono text-[15px] text-slate-400">
                            {order.trackingId || '---'}
                          </td>
                          <td className="px-5 py-4 text-[15px] font-medium">
                            <div className={isLightWhite ? 'text-slate-800' : 'text-white'}>{order.nombreCliente || '---'}</div>
                          </td>
                          <td className="px-5 py-4 text-[15px] text-slate-400 font-medium">
                            {order.product || '---'}
                          </td>
                          <td className="px-5 py-4">
                            {renderOrderTags(order.tags)}
                          </td>
                          <td className="px-5 py-4">
                            {hasFicha ? (
                              <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[15px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                <CheckCircle size={14} /> Registrada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 text-[15px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                <AlertCircle size={14} /> Sin Ficha
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              {hasFicha ? (
                                <button
                                  onClick={() => handleEditNovelty(associatedNovelty!)}
                                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-border rounded-lg text-[15px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                                >
                                  <Edit2 size={14} /> Editar Ficha
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleCreateNoveltyFromOrder(order)}
                                  className="px-4 py-2 bg-gold hover:bg-gold/80 text-black rounded-lg text-[15px] font-black tracking-wider uppercase transition-all shadow-md cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                                >
                                  <Plus size={14} /> Vincular Novedad
                                </button>
                              )}
                              <button
                                onClick={() => setDeletingIds([order.id])}
                                className="p-2 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 border border-red-500/20 hover:border-red-500 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                                title="Eliminar pedido"
                              >
                                <Trash2 size={15} />
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
        )}
      </div>

      {/* AI PRO LOGISTICS ANALYST DASHBOARD SECTOR (DEBAJO DE TODO) */}
      <div id="ai-logistics-analyst-panel" className={`rounded-2xl overflow-hidden p-8 space-y-6 shadow-2xl relative border ${
        isLightWhite 
          ? 'bg-emerald-50/40 border-emerald-500/20 shadow-sm' 
          : 'border-emerald-500/20 bg-emerald-500/5'
      }`}>
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Brain size={180} className="text-emerald-400" />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 font-bold mb-1">
              <Sparkles size={16} className="animate-spin" style={{ animationDuration: '6s' }} />
              <span className="text-xs tracking-wider uppercase font-mono">IA PRO Inteligencia Logística</span>
            </div>
            <h3 className={`text-2xl font-display font-extrabold ${isLightWhite ? 'text-slate-800' : 'text-white'}`}>Análisis Avanzado con Gemini PRO</h3>
            <p className="text-[15px] text-slate-500">Analiza en profundidad causas raíces de cancelaciones, devoluciones e incidencias por demografía (direcciones, ciudades y departamentos) de inmediato.</p>
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
          <div className={`mt-6 p-8 rounded-xl border flex flex-col items-center justify-center text-center space-y-4 ${
            isLightWhite ? 'bg-white border-emerald-500/25' : 'bg-black/60 border-emerald-500/25'
          }`}>
            <Loader2 size={40} className="text-emerald-600 animate-spin" />
            <div>
              <p className={`text-[17px] font-semibold tracking-wide ${isLightWhite ? 'text-slate-800' : 'text-white'}`}>Analizando comportamiento logístico...</p>
              <p className="text-sm text-slate-500 mt-1 italic animate-pulse">"{loadingMessages[loadingStep]}"</p>
            </div>
            <div className={`w-1/3 h-1.5 rounded-full overflow-hidden ${isLightWhite ? 'bg-slate-100' : 'bg-slate-800'}`}>
              <div 
                className="bg-emerald-500 h-full transition-all duration-500" 
                style={{ width: `${((loadingStep + 1) / loadingMessages.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error State */}
        {aiError && (
          <div className={`mt-6 p-6 border rounded-xl ${isLightWhite ? 'bg-red-50 border-red-200 text-red-800' : 'bg-red-950/40 border-red-500/20 text-red-200'}`}>
            <div className="flex items-center gap-3 mb-2 font-bold text-red-600">
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
              <div className={`glass-card p-8 flex flex-col h-full justify-between border ${
                isLightWhite ? 'bg-white border-slate-200' : 'bg-black/30 border-emerald-500/10'
              }`}>
                <div>
                  <div className="flex items-center gap-2 text-emerald-600 font-bold mb-4">
                    <Brain size={18} />
                    <span className="text-sm tracking-wider uppercase font-mono">Reporte Analítico Copiloto</span>
                  </div>
                  
                  <div className={`prose max-w-none text-[15px] leading-relaxed space-y-4 ${isLightWhite ? 'text-slate-700' : 'prose-invert text-slate-300'}`}>
                    {parsedSections.length > 0 ? (
                      <div className="space-y-6">
                        {/* Interactive Tab Selectors */}
                        <div className={`grid grid-cols-2 md:grid-cols-4 gap-2 border-b pb-4 ${isLightWhite ? 'border-slate-100' : 'border-white/5'}`}>
                          {parsedSections.map((section, idx) => {
                            const isSelected = activeTab === idx;
                            const icons = [
                              <TrendingUp size={14} className="text-emerald-600 shrink-0" />,
                              <BarChart3 size={14} className="text-emerald-600 shrink-0" />,
                              <Brain size={14} className="text-emerald-600 shrink-0" />,
                              <Sparkles size={14} className="text-emerald-600 shrink-0" />
                            ];
                            const icon = icons[idx % icons.length];
                            
                            return (
                              <button
                                key={idx}
                                onClick={() => setActiveTab(idx)}
                                className={`flex items-center gap-1.5 justify-center py-2 px-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-300 border cursor-pointer ${
                                  isSelected 
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.08)]' 
                                    : (isLightWhite 
                                        ? 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100' 
                                        : 'bg-black/50 border-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-950/60')
                                }`}
                              >
                                {icon}
                                <span className="truncate">{section.title}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Active Section Content Container */}
                        <div className={`p-5 rounded-xl border prose max-w-none text-[15px] leading-relaxed min-h-[220px] ${
                          isLightWhite 
                            ? 'bg-slate-50 border-slate-150 text-slate-700' 
                            : 'bg-black/40 border-slate-900 prose-invert text-slate-300'
                        }`}>
                          <Markdown
                            components={{
                              h1: ({ ...props }) => <h3 className={`text-base font-extrabold font-display mt-1 mb-3 border-l-4 border-emerald-500 pl-3 uppercase tracking-wider ${isLightWhite ? 'text-slate-900' : 'text-white'}`} {...props} />,
                              h2: ({ ...props }) => <h4 className="text-sm font-bold font-display text-emerald-600 mt-4 mb-2 uppercase tracking-wide" {...props} />,
                              h3: ({ ...props }) => <h5 className="text-xs font-bold font-display text-emerald-600 mt-3 mb-1 uppercase tracking-wider" {...props} />,
                              p: ({ ...props }) => <p className={`text-[13px] leading-relaxed mb-3 ${isLightWhite ? 'text-slate-600' : 'text-slate-300'}`} {...props} />,
                              ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-1.5 my-3 marker:text-emerald-500" {...props} />,
                              ol: ({ ...props }) => <ol className="list-decimal pl-5 space-y-1.5 my-3 marker:text-emerald-500" {...props} />,
                              li: ({ ...props }) => <li className={`text-[13px] leading-relaxed pl-1 ${isLightWhite ? 'text-slate-600' : 'text-slate-300'}`} {...props} />,
                              strong: ({ ...props }) => <strong className="font-semibold text-emerald-600 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/10" {...props} />,
                              code: ({ ...props }) => <code className={`rounded px-1.5 py-0.5 text-xs font-mono text-emerald-600 ${isLightWhite ? 'bg-slate-100 border border-slate-200' : 'bg-slate-900 border border-slate-800'}`} {...props} />,
                              hr: () => <hr className={isLightWhite ? 'my-4 border-slate-200' : 'my-4 border-slate-900'} />,
                            }}
                          >
                            {parsedSections[activeTab]?.rawContent || ""}
                          </Markdown>
                        </div>
                      </div>
                    ) : (
                      <Markdown
                        components={{
                          h1: ({ ...props }) => <h3 className={`text-lg font-extrabold font-display mt-6 mb-3 border-l-4 border-emerald-500 pl-3 uppercase tracking-wider ${isLightWhite ? 'text-slate-900' : 'text-white'}`} {...props} />,
                          h2: ({ ...props }) => <h4 className="text-base font-bold font-display text-emerald-600 mt-5 mb-2 uppercase tracking-wide" {...props} />,
                          h3: ({ ...props }) => <h5 className="text-[15px] font-bold font-display text-emerald-600 mt-4 mb-2 uppercase tracking-wider" {...props} />,
                          p: ({ ...props }) => <p className={`text-[14px] leading-relaxed mb-4 ${isLightWhite ? 'text-slate-600' : 'text-slate-300'}`} {...props} />,
                          ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-2 my-4 marker:text-emerald-500" {...props} />,
                          ol: ({ ...props }) => <ol className="list-decimal pl-5 space-y-2 my-4 marker:text-emerald-500" {...props} />,
                          li: ({ ...props }) => <li className={`text-[14px] leading-relaxed pl-1 ${isLightWhite ? 'text-slate-600' : 'text-slate-300'}`} {...props} />,
                          strong: ({ ...props }) => <strong className="font-semibold text-emerald-600 bg-emerald-500/5 px-1 py-0.5 rounded border border-emerald-500/10" {...props} />,
                          code: ({ ...props }) => <code className={`rounded px-1.5 py-0.5 text-xs font-mono text-emerald-600 ${isLightWhite ? 'bg-slate-100 border border-slate-200' : 'bg-slate-900 border border-slate-800'}`} {...props} />,
                          hr: () => <hr className={isLightWhite ? 'my-6 border-slate-200' : 'my-6 border-slate-800'} />,
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
              <div className={`glass-card p-8 space-y-6 border ${
                isLightWhite ? 'bg-white border-slate-200' : 'bg-black/30 border-emerald-500/10'
              }`}>
                <div>
                  <div className="flex items-center gap-2 text-emerald-600 font-bold mb-1">
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
                      <div key={idx} className={`space-y-1.5 p-3 rounded-lg border transition-all ${
                        isLightWhite 
                          ? 'bg-slate-50 border-slate-200/85 hover:border-emerald-500/20' 
                          : 'bg-black/20 border-border hover:border-emerald-500/20'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-base font-medium ${isLightWhite ? 'text-slate-800' : 'text-white'}`}>{rec.aspect}</span>
                          <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            Impacto: {rec.score}%
                          </span>
                        </div>
                        <p className="text-[13px] text-slate-500 italic">Estrategia: {rec.label}</p>
                        <div className={`w-full h-2 rounded-full overflow-hidden ${isLightWhite ? 'bg-slate-200' : 'bg-slate-900'}`}>
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
                <h4 className={`text-xl font-display font-medium ${isLightWhite ? 'text-slate-800' : 'text-white'}`}>Visualizaciones Logísticas Estructuradas por IA</h4>
                <p className="text-sm text-slate-500">Representaciones gráficas basadas en el cruce de datos de la sección de devoluciones analizada por la Inteligencia Artificial.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Chart 1: Carrier Incidents */}
                <div className={`glass-card p-6 border ${isLightWhite ? 'bg-white border-slate-200 shadow-sm' : '!bg-black border-slate-900 shadow-[0_0_25px_rgba(0,0,0,0.9)]'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h5 className={`text-[15px] font-bold uppercase tracking-wider font-display ${isLightWhite ? 'text-slate-700' : 'text-white'}`}>Tasa de Incidencias por Transportadora</h5>
                    <span className="text-[11px] font-mono text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">Transportadoras</span>
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiResult.charts?.carriers || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isLightWhite ? "#e2e8f0" : "#222"} />
                        <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} />
                        <YAxis stroke="#888" fontSize={12} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isLightWhite ? '#ffffff' : '#000000', 
                            border: isLightWhite ? '1px solid #e2e8f0' : '1px solid #1f1f2e', 
                            borderRadius: '8px' 
                          }}
                          labelStyle={{ color: isLightWhite ? '#1e293b' : '#fff', fontSize: '14px', fontWeight: 'bold' }}
                          cursor={{ fill: isLightWhite ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.5)' }}
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
                <div className={`glass-card p-6 border ${isLightWhite ? 'bg-white border-slate-200 shadow-sm' : '!bg-black border-slate-900 shadow-[0_0_25px_rgba(0,0,0,0.9)]'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h5 className={`text-[15px] font-bold uppercase tracking-wider font-display ${isLightWhite ? 'text-slate-700' : 'text-white'}`}>Distribución Temporal de Novedades por Mes</h5>
                    <span className="text-[11px] font-mono text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">Historial Mensual</span>
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiResult.charts?.months || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isLightWhite ? "#e2e8f0" : "#222"} />
                        <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} />
                        <YAxis stroke="#888" fontSize={12} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isLightWhite ? '#ffffff' : '#000000', 
                            border: isLightWhite ? '1px solid #e2e8f0' : '1px solid #1f1f2e', 
                            borderRadius: '8px' 
                          }}
                          labelStyle={{ color: isLightWhite ? '#1e293b' : '#fff', fontSize: '14px', fontWeight: 'bold' }}
                          cursor={{ fill: isLightWhite ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.5)' }}
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
                <div className={`glass-card p-6 border lg:col-span-2 ${isLightWhite ? 'bg-white border-slate-200 shadow-sm' : '!bg-black border-slate-900 shadow-[0_0_25px_rgba(0,0,0,0.9)]'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h5 className={`text-[15px] font-bold uppercase tracking-wider font-display ${isLightWhite ? 'text-slate-700' : 'text-white'}`}>Principales Causales de Retorno / Novedad</h5>
                    <span className="text-[11px] font-mono text-red-600 bg-red-400/10 px-2 py-0.5 rounded-full">Causas Frecuentes</span>
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiResult.charts?.causes || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke={isLightWhite ? "#e2e8f0" : "#222"} />
                        <XAxis type="number" stroke="#888" fontSize={12} tickLine={false} />
                        <YAxis dataKey="name" type="category" stroke="#888" fontSize={12} tickLine={false} width={180} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isLightWhite ? '#ffffff' : '#000000', 
                            border: isLightWhite ? '1px solid #e2e8f0' : '1px solid #1f1f2e', 
                            borderRadius: '8px' 
                          }}
                          labelStyle={{ color: isLightWhite ? '#1e293b' : '#fff', fontSize: '14px', fontWeight: 'bold' }}
                          cursor={{ fill: isLightWhite ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.5)' }}
                        />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#f5c842" name="Volumen de Casos" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 4: Explanations of Noveltity/Success event descriptions */}
                <div className={`glass-card p-6 border lg:col-span-2 ${isLightWhite ? 'bg-white border-slate-200 shadow-sm' : '!bg-black border-slate-900 shadow-[0_0_25px_rgba(0,0,0,0.9)]'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h5 className={`text-[15px] font-bold uppercase tracking-wider font-display ${isLightWhite ? 'text-slate-700' : 'text-white'}`}>Incidencias por Explicación del Suceso</h5>
                    <span className="text-[11px] font-mono text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded-full">Explicación Detallada (IA NLP)</span>
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiResult.charts?.explanations || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke={isLightWhite ? "#e2e8f0" : "#222"} />
                        <XAxis type="number" stroke="#888" fontSize={12} tickLine={false} />
                        <YAxis dataKey="name" type="category" stroke="#888" fontSize={11} tickLine={false} width={200} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isLightWhite ? '#ffffff' : '#000000', 
                            border: isLightWhite ? '1px solid #e2e8f0' : '1px solid #1f1f2e', 
                            borderRadius: '8px' 
                          }}
                          labelStyle={{ color: isLightWhite ? '#1e293b' : '#fff', fontSize: '13px', fontWeight: 'bold' }}
                          cursor={{ fill: isLightWhite ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.5)' }}
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
      {/* MODAL GESTOR DE ETIQUETAS Y PALETA DE COLORES */}
      {isTagManagerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg p-6 rounded-2xl border shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto ${
            isLightWhite ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0f0f18] border-border text-white'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-500/10 pb-4">
              <div className="flex items-center gap-2.5">
                <Palette size={20} className="text-gold" />
                <h3 className="text-lg font-black font-display uppercase tracking-wider">Gestión de Etiquetas y Colores</h3>
              </div>
              <button 
                onClick={() => setIsTagManagerOpen(false)}
                className="text-slate-400 hover:text-white font-extrabold text-sm p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                ✕
              </button>
            </div>

            {/* SECCIÓN CREAR NUEVA ETIQUETA */}
            <div className={`p-4 rounded-xl border space-y-3 ${
              isLightWhite ? 'bg-slate-50 border-slate-200/80' : 'bg-[#141422] border-border/60'
            }`}>
              <h4 className="text-xs font-extrabold tracking-wider uppercase text-slate-400">Crear Nueva Etiqueta Personalizada</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Ej. RETORNO RECURRENTE"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value.toUpperCase())}
                  className={`w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-gold font-sans uppercase font-bold ${
                    isLightWhite 
                      ? 'bg-white border-slate-200 text-slate-800' 
                      : 'bg-[#0f0f18] border-border/80 text-white'
                  }`}
                />
                
                {/* Paleta para la nueva etiqueta */}
                <div className="space-y-1.5">
                  <span className="text-[14px] text-slate-500 font-bold block">Seleccionar color de paleta:</span>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setNewTagColorId(p.id)}
                        className={`w-7 h-7 rounded-full transition-all flex items-center justify-center relative cursor-pointer border hover:scale-110 ${
                          newTagColorId === p.id 
                            ? 'ring-2 ring-gold scale-110 border-white/40 shadow-lg' 
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: p.dotBg }}
                        title={p.name}
                      >
                        {newTagColorId === p.id && <Check size={14} className="text-white drop-shadow-md font-bold" />}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!newTagName.trim()}
                  onClick={() => {
                    const nameUpper = newTagName.trim().toUpperCase();
                    if (customLabels.some(l => l.name.toUpperCase() === nameUpper)) {
                      alert('¡Esta etiqueta ya existe!');
                      return;
                    }
                    const updated = [...customLabels, { name: nameUpper, colorId: newTagColorId }];
                    saveCustomLabels(updated);
                    setNewTagName('');
                    setNewTagColorId('gray');
                  }}
                  className={`w-full py-2 bg-gold hover:bg-gold/90 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    !newTagName.trim() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95 shadow-md shadow-gold/10'
                  }`}
                >
                  <Plus size={14} /> Crear Etiqueta
                </button>
              </div>
            </div>

            {/* LISTADO DE ETIQUETAS ACTIVAS */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold tracking-wider uppercase text-slate-400">Paleta de Colores de Etiquetas Existentes</h4>
              <p className="text-[14px] text-slate-500">Haz clic en cualquier círculo de color para cambiar instantáneamente la tonalidad de esa etiqueta.</p>
              
              <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                {customLabels.map((lbl) => {
                  return (
                    <div 
                      key={lbl.name} 
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border ${
                        isLightWhite ? 'bg-slate-50/50 border-slate-100' : 'bg-[#141422]/65 border-border/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {renderEtiquetaDevolucion(lbl.name)}
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Selector de paleta rápido */}
                        <div className="flex gap-1">
                          {COLOR_PRESETS.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                const updated = customLabels.map(item => {
                                  if (item.name === lbl.name) {
                                    return { ...item, colorId: p.id };
                                  }
                                  return item;
                                });
                                saveCustomLabels(updated);
                              }}
                              className={`w-4 h-4 rounded-full transition-all border hover:scale-125 cursor-pointer flex items-center justify-center ${
                                lbl.colorId === p.id 
                                  ? 'border-white scale-110 shadow-sm shadow-black' 
                                  : 'border-transparent'
                              }`}
                              style={{ backgroundColor: p.dotBg }}
                              title={p.name}
                            >
                              {lbl.colorId === p.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </button>
                          ))}
                        </div>

                        {/* Botón borrar */}
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`¿Estás seguro de eliminar la etiqueta "${lbl.name}"?`)) {
                              const updated = customLabels.filter(item => item.name !== lbl.name);
                              saveCustomLabels(updated);
                            }
                          }}
                          className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                          title="Eliminar Etiqueta"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-500/10 pt-4">
              <button
                onClick={() => setIsTagManagerOpen(false)}
                className="px-5 py-2.5 bg-gold hover:bg-gold/90 text-black font-black uppercase tracking-wider rounded-xl text-xs transition-all shadow-md shadow-gold/5 cursor-pointer"
              >
                Listo / Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      {deletingIds && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-6 ${
            isLightWhite ? 'bg-white border-slate-200 text-slate-800' : 'bg-card border-border text-white'
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
                <AlertTriangle size={24} className="animate-bounce" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-display uppercase tracking-wider">Confirmar Eliminación</h3>
                <p className="text-xs text-slate-500 mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <p className={`text-[15px] leading-relaxed ${isLightWhite ? 'text-slate-600' : 'text-slate-300'}`}>
              ¿Estás seguro de que deseas eliminar {deletingIds.length === 1 ? 'este pedido devuelto' : `estos ${deletingIds.length} pedidos devueltos`} del sistema?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingIds(null)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer border ${
                  isLightWhite 
                    ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700' 
                    : 'bg-[#111] border-border hover:bg-white/5 text-slate-300 hover:text-white'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-red-600/10 cursor-pointer"
              >
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnsAnalysis;
