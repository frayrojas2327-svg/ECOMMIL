import React, { useState, useEffect, useMemo } from 'react';
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  Edit2,
  Check,
  X as CloseIcon,
  Calendar as CalendarIcon, 
  Target, 
  Layers, 
  DollarSign,
  Search,
  Filter,
  AlertCircle,
  TrendingUp,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  Activity,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './Auth';
import { format, startOfDay, eachDayOfInterval, subDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, AreaChart, Area 
} from 'recharts';
import { CurrencyCode } from '../mockData';

interface AdvertisingExpense {
  id: string;
  uid: string;
  productId: string;
  productName: string;
  date: string;
  accountName: string;
  platform: string;
  amount: number;
  originalAmount?: number;
  originalCurrency?: string;
  conversionRate?: number;
  timestamp: number;
  notes?: string;
  color?: string;
}

interface SavedProduct {
  id: string;
  name: string;
  productId: string;
}

const PLATFORMS = [
  'Facebook Ads',
  'TikTok Ads',
  'Google Ads',
  'Instagram Ads',
  'Kwai Ads',
  'Pinterest Ads',
  'Snapchat Ads',
  'Otro'
];

const COLORS = ['#22c55e', '#38bdf8', '#fbbf24', '#f472b6', '#f87171', '#a78bfa', '#fb923c', '#4ade80'];

const TAG_COLORS = [
  { name: 'Ninguno', value: 'transparent' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Azul', value: '#38bdf8' },
  { name: 'Amarillo', value: '#fbbf24' },
  { name: 'Rosa', value: '#f472b6' },
  { name: 'Rojo', value: '#f87171' },
  { name: 'Violeta', value: '#a78bfa' },
  { name: 'Naranja', value: '#fb923c' },
];

export default function AdvertisingExpenses({ 
  formatCurrency,
  currency,
  currencies,
  isConversionActive 
}: { 
  formatCurrency: (amount: number) => string,
  currency: CurrencyCode,
  currencies: any,
  isConversionActive: boolean
}) {
  const { user } = useAuth();
  const [isLocalConversionActive, setIsLocalConversionActive] = useState(isConversionActive);
  
  // Sync with global conversion when prop changes
  useEffect(() => {
    setIsLocalConversionActive(isConversionActive);
  }, [isConversionActive]);

  const [expenses, setExpenses] = useState<AdvertisingExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const [notification, setNotification] = useState<{message: string, type: 'info' | 'success'} | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleToggleConversion = () => {
    const newState = !isLocalConversionActive;
    setIsLocalConversionActive(newState);
    
    const info = currencies[currency];
    if (newState) {
      setNotification({
        message: `Conversión Activa: Visualizando todos los gastos en ${currency} (TRM: ${info.rate.toLocaleString('es-CO')}). Los nuevos registros se interpretarán en esta moneda.`,
        type: 'success'
      });
    } else {
      setNotification({
        message: `Conversión Desactivada: Visualizando en dólares (USD). Los nuevos registros se interpretarán en USD.`,
        type: 'info'
      });
    }
  };

  const localFormatCurrency = (amount: number, expense?: AdvertisingExpense) => {
    const info = currencies[currency];
    const isUSD = !isLocalConversionActive;
    const targetCurrency = isUSD ? 'USD' : currency;

    // Fixed logic: If we are viewing in a currency that matches the original registration currency,
    // show the EXACT original amount to prevent "numbers changing" due to TRM volatility.
    if (expense && expense.originalCurrency === targetCurrency && expense.originalAmount !== undefined) {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: targetCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(expense.originalAmount);
    }

    let converted = amount;
    if (!isUSD) {
      if (expense && expense.conversionRate && expense.originalCurrency === 'USD' && targetCurrency === currency) {
        converted = amount * info.rate;
      } else {
        converted = amount * info.rate;
      }
    }
    
    // Safety rounding to avoid float precision artifacts
    const rounded = Math.round(converted * 100) / 100;
    
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: targetCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(rounded);
  };

  const parseDateSafe = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    } catch (e) {
      return new Date();
    }
  };
  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempEdit, setTempEdit] = useState<Partial<AdvertisingExpense> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    productName: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    accountName: '',
    platform: 'Facebook Ads',
    customPlatform: '',
    amount: '',
    notes: '',
    color: 'transparent'
  });

  // Load saved products from localStorage (from ProfitCalculator)
  useEffect(() => {
    const loadProducts = () => {
      const saved = localStorage.getItem('ecommil_saved_products');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSavedProducts(parsed.map((p: any) => ({
            id: p.id,
            name: p.name,
            productId: p.productId
          })));
        } catch (e) {
          console.error("Error parsing saved products", e);
        }
      }
    };

    loadProducts();
    // Also listen for storage changes in case user saves a product in another tab
    window.addEventListener('storage', loadProducts);
    return () => window.removeEventListener('storage', loadProducts);
  }, []);

  // Fetch expenses from Firestore
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'ad_expenses'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as AdvertisingExpense[];
      
      // Sort by date descending
      setExpenses(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'ad_expenses');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const startEditing = (expense: AdvertisingExpense) => {
    setEditingId(expense.id);
    setTempEdit({ ...expense });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setTempEdit(null);
  };

  const saveEditing = async () => {
    if (!editingId || !tempEdit) return;
    try {
      await updateDoc(doc(db, 'ad_expenses', editingId), tempEdit);
      cancelEditing();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'ad_expenses');
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const rawAmount = parseFloat(formData.amount);
      if (isNaN(rawAmount)) return;

      // Normalize amount depending on current mode
      const info = currencies[currency];
      const normalizedAmount = isLocalConversionActive ? rawAmount / info.rate : rawAmount;

      // Find product name if only ID was selected
      let finalProductName = formData.productName;
      if (!finalProductName && formData.productId && formData.productId !== 'manual') {
        const prod = savedProducts.find(p => p.id === formData.productId);
        if (prod) finalProductName = prod.name;
      }

      const finalPlatform = formData.platform === 'Otro' ? formData.customPlatform : formData.platform;

      const newExpense = {
        uid: user.uid,
        productId: formData.productId,
        productName: finalProductName || 'Sin Producto',
        date: formData.date,
        accountName: formData.accountName,
        platform: finalPlatform || 'Otro',
        amount: normalizedAmount,
        originalAmount: rawAmount,
        originalCurrency: isLocalConversionActive ? currency : 'USD',
        conversionRate: info.rate,
        timestamp: Date.now(),
        notes: formData.notes,
        color: formData.color
      };

      await addDoc(collection(db, 'ad_expenses'), newExpense);
      
      setShowAddForm(false);
      setFormData({
        productId: '',
        productName: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        accountName: '',
        platform: 'Facebook Ads',
        customPlatform: '',
        amount: '',
        notes: '',
        color: 'transparent'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'ad_expenses');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateExpense = async (id: string, updates: Partial<AdvertisingExpense>) => {
    try {
      await updateDoc(doc(db, 'ad_expenses', id), updates);
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'ad_expenses');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'ad_expenses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'ad_expenses');
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const productName = exp.productName || '';
      const accountName = exp.accountName || '';
      const platform = exp.platform || '';
      const notes = exp.notes || '';

      const matchesSearch = productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           platform.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           notes.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDate = !dateFilter || exp.date === dateFilter;
      
      return matchesSearch && matchesDate;
    });
  }, [expenses, searchTerm, dateFilter]);

  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    // By Platform (Dynamic)
    const platforms: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      platforms[e.platform] = (platforms[e.platform] || 0) + e.amount;
    });
    const platformData = Object.entries(platforms)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // By Account
    const accounts: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      accounts[e.accountName] = (accounts[e.accountName] || 0) + e.amount;
    });
    const accountData = Object.entries(accounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // By Day (Last 14 days)
    const last14Days = eachDayOfInterval({
      start: subDays(new Date(), 13),
      end: new Date()
    });

    const dailyData = last14Days.map(day => {
      const dayExpenses = filteredExpenses.filter(e => isSameDay(parseDateSafe(e.date), day));
      return {
        date: format(day, 'dd MMM', { locale: es }),
        amount: dayExpenses.reduce((sum, e) => sum + e.amount, 0)
      };
    });

    return { total, platformData, accountData, dailyData };
  }, [filteredExpenses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
            <Megaphone className="text-primary" /> Gastos de Publicidad
          </h2>
          <p className="text-slate-500 text-[15px]">Control aislado de inversión publicitaria por producto y plataforma</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-xl border border-border relative">
            <span className="text-[12px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Conversión</span>
            <button 
              onClick={handleToggleConversion}
              className={`relative w-12 h-6 rounded-full transition-all duration-300 ${isLocalConversionActive ? 'bg-primary' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${isLocalConversionActive ? 'left-7' : 'left-1'}`} />
            </button>
            
            {/* Notification Float */}
            <AnimatePresence>
              {notification && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.9 }}
                  className={`absolute bottom-full mb-4 right-0 min-w-[280px] p-4 rounded-2xl border shadow-2xl z-[100] flex items-start gap-3 ${
                    notification.type === 'success' 
                      ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100' 
                      : 'bg-slate-900/90 border-slate-700 text-slate-200'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${notification.type === 'success' ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
                    {notification.type === 'success' ? <TrendingUp size={18} className="text-emerald-400" /> : <Globe size={18} className="text-slate-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-medium leading-tight">
                      {notification.message}
                    </p>
                    <div className="mt-2 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: '100%' }}
                        animate={{ width: '0%' }}
                        transition={{ duration: 5, ease: 'linear' }}
                        className={`h-full ${notification.type === 'success' ? 'bg-emerald-400' : 'bg-slate-400'}`}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-primary text-background font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-primary/20 text-[15px]"
          >
            <Plus size={18} /> Registrar Gasto
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="fintech-card p-6 border-primary/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-display uppercase tracking-widest text-slate-400 font-bold">Inversión Total</span>
            <div className="p-2 bg-primary/10 rounded-lg">
              <DollarSign size={18} className="text-primary" />
            </div>
          </div>
          <p className="text-3xl font-mono font-bold text-white tracking-tighter">
            {localFormatCurrency(stats.total)}
          </p>
        </div>
        
        <div className="fintech-card p-6 border-secondary/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-display uppercase tracking-widest text-slate-400 font-bold">Por Plataforma</span>
            <div className="p-2 bg-secondary/10 rounded-lg">
              <Target size={18} className="text-secondary" />
            </div>
          </div>
          {stats.platformData.length > 0 ? (
            <div className="space-y-2 max-h-[100px] overflow-y-auto pr-1 custom-scrollbar">
              {stats.platformData.map((plat, idx) => (
                <div key={plat.name} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <p className="text-[15px] font-bold text-white truncate max-w-[120px]">{plat.name}</p>
                  </div>
                  <p className="text-[15px] font-mono text-secondary font-bold">{localFormatCurrency(plat.value)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 italic text-[15px]">Sin datos</p>
          )}
        </div>

        <div className="fintech-card p-6 border-gold/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-display uppercase tracking-widest text-slate-400 font-bold">Registros</span>
            <div className="p-2 bg-gold/10 rounded-lg">
              <Layers size={18} className="text-gold" />
            </div>
          </div>
          <p className="text-3xl font-mono font-bold text-white tracking-tighter">
            {expenses.length}
          </p>
        </div>
      </div>

      {/* Add Expense Form Section */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fintech-card p-8 border-primary/30 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-display font-bold text-white flex items-center gap-3">
                <Plus className="text-primary" size={24} /> Nuevo Registro de Gasto
              </h3>
              <button 
                onClick={() => setShowAddForm(false)}
                className="text-slate-500 hover:text-white transition-colors text-[15px] font-bold uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[13px] uppercase tracking-widest text-slate-400 font-bold ml-1">Fecha de Gasto</label>
                <div className="relative group/date">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-hover/date:text-primary transition-colors pointer-events-none" size={16} />
                  <input 
                    type="date"
                    required
                    value={formData.date}
                    onClick={(e) => (e.target as any).showPicker?.()}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-[15px] text-white focus:border-primary outline-none transition-all [color-scheme:dark] cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] uppercase tracking-widest text-slate-400 font-bold ml-1">Producto</label>
                <select 
                  value={formData.productId}
                  onChange={(e) => {
                    const prod = savedProducts.find(p => p.id === e.target.value);
                    setFormData({ 
                      ...formData, 
                      productId: e.target.value,
                      productName: prod ? prod.name : ''
                    });
                  }}
                  className="w-full bg-background border border-border rounded-xl py-2.5 px-4 text-[15px] text-white focus:border-primary outline-none transition-all"
                >
                  <option value="" className="bg-slate-900">Seleccionar Producto...</option>
                  {savedProducts.map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>
                  ))}
                  <option value="manual" className="bg-slate-900">Otro (Manual)</option>
                </select>
              </div>

              {formData.productId === 'manual' && (
                <div className="space-y-2">
                  <label className="text-[13px] uppercase tracking-widest text-slate-400 font-bold ml-1">Nombre del Producto</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ej: Producto Especial"
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl py-2.5 px-4 text-[15px] text-white focus:border-primary outline-none transition-all"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[13px] uppercase tracking-widest text-slate-400 font-bold ml-1">Plataforma</label>
                <select 
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl py-2.5 px-4 text-[15px] text-white focus:border-primary outline-none transition-all"
                >
                  {PLATFORMS.map(p => (
                    <option key={p} value={p} className="bg-slate-900">{p}</option>
                  ))}
                </select>
              </div>

              {formData.platform === 'Otro' && (
                <div className="space-y-2">
                  <label className="text-[13px] uppercase tracking-widest text-slate-400 font-bold ml-1">Nombre de Plataforma</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ej: Twitter Ads"
                    value={formData.customPlatform}
                    onChange={(e) => setFormData({ ...formData, customPlatform: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl py-2.5 px-4 text-[15px] text-white focus:border-primary outline-none transition-all"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[13px] uppercase tracking-widest text-slate-400 font-bold ml-1">Cuenta Publicitaria</label>
                <input 
                  type="text"
                  required
                  placeholder="Ej: Cuenta Principal"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl py-2.5 px-4 text-[15px] text-white focus:border-primary outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[13px] uppercase tracking-widest text-slate-400 font-bold ml-1 flex justify-between items-center">
                  Monto Invertido
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={handleToggleConversion}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${isLocalConversionActive ? 'bg-primary text-background' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                    >
                      {isLocalConversionActive ? `En ${currency}` : 'En USD'}
                    </button>
                  </div>
                </label>
                <div className={`relative rounded-xl border transition-all duration-300 ${isLocalConversionActive ? 'bg-primary/5 border-primary/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-background border-border'}`}>
                  <div className={`absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[16px] font-bold transition-colors ${isLocalConversionActive ? 'text-primary' : 'text-slate-500'}`}>
                    {isLocalConversionActive ? currencies[currency].symbol : '$'}
                  </div>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    placeholder="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className={`w-full bg-transparent py-3.5 pl-12 pr-16 text-[18px] font-mono text-white outline-none transition-all ${isLocalConversionActive ? 'placeholder:text-primary/30' : 'placeholder:text-slate-700'}`}
                  />
                  <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${isLocalConversionActive ? 'bg-primary text-background' : 'bg-slate-800 text-slate-500'}`}>
                    {isLocalConversionActive ? currency : 'USD'}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1 px-1">
                  {isLocalConversionActive ? (
                    <TrendingUp size={12} className="text-primary animate-pulse" />
                  ) : (
                    <Globe size={12} className="text-slate-500" />
                  )}
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {isLocalConversionActive ? (
                      <>Digitando en <span className="text-primary font-bold">{currency}</span>. Equivale a <span className="text-white font-bold">{(parseFloat(formData.amount || '0') / currencies[currency].rate).toFixed(2)} USD</span></>
                    ) : (
                      <>Digitando en <span className="text-slate-300 font-bold">Dólares (USD)</span>. Desactivado para moneda local.</>
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-2 col-span-full">
                <label className="text-[13px] uppercase tracking-widest text-slate-400 font-bold ml-1">Color de Registro</label>
                <div className="flex flex-wrap gap-2 p-3 bg-white/5 rounded-xl border border-border">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                        formData.color === color.value ? 'border-primary scale-110 shadow-lg shadow-white/10' : 'border-transparent hover:border-white/20'
                      }`}
                      style={{ backgroundColor: color.value === 'transparent' ? 'transparent' : color.value }}
                      title={color.name}
                    >
                      {color.value === 'transparent' && <div className="w-6 h-0.5 bg-red-500/50 rotate-45" />}
                      {formData.color === color.value && color.value !== 'transparent' && <Check size={14} className="text-white drop-shadow-md" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 col-span-full">
                <label className="text-[13px] uppercase tracking-widest text-slate-400 font-bold ml-1">Notas / Detalles (Opcional)</label>
                <textarea 
                  placeholder="Añade notas adicionales sobre este gasto..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-background border border-border rounded-xl py-2.5 px-4 text-[15px] text-white focus:border-primary outline-none transition-all resize-none"
                />
              </div>

              <div className="col-span-full pt-4">
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary text-background font-bold py-4 rounded-xl hover:brightness-110 transition-all shadow-lg shadow-primary/20 text-[15px] uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  ) : (
                    <Plus size={20} />
                  )}
                  {isSubmitting ? 'Guardando...' : 'Guardar Gasto'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expenses List Section */}
      <div className="fintech-card overflow-hidden">
        <div className="p-4 border-b border-border bg-white/5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-[13px] font-display font-bold text-white uppercase tracking-widest">Historial de Gastos</h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <input 
                  type="text"
                  placeholder="Buscar gasto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl py-1.5 pl-9 pr-4 text-xs text-white focus:border-primary outline-none"
                />
              </div>
              <div className="relative group/date-filter">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-hover/date-filter:text-primary transition-colors pointer-events-none" size={14} />
                <input 
                  type="date"
                  value={dateFilter}
                  onClick={(e) => (e.target as any).showPicker?.()}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-background border border-border rounded-xl py-1.5 pl-9 pr-4 text-xs text-white focus:border-primary outline-none [color-scheme:dark] cursor-pointer"
                />
                {dateFilter && (
                  <button 
                    onClick={() => setDateFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <CloseIcon size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="bg-background/50 text-[13px] uppercase tracking-widest text-slate-500 font-display">
                <th className="p-4 font-bold border-b border-border">Fecha</th>
                <th className="p-4 font-bold border-b border-border">Producto</th>
                <th className="p-4 font-bold border-b border-border">Plataforma</th>
                <th className="p-4 font-bold border-b border-border">Detalles</th>
                <th className="p-4 font-bold border-b border-border text-right">Monto</th>
                <th className="p-4 font-bold border-b border-border text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="text-[15px] font-mono">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500 italic">
                    {expenses.length === 0 ? 'No hay gastos registrados aún.' : 'No se encontraron gastos con estos filtros.'}
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr 
                    key={expense.id} 
                    className="group relative transition-all duration-300"
                    style={expense.color && expense.color !== 'transparent' ? { 
                      backgroundColor: `${expense.color}15`,
                      boxShadow: `0 0 0 2px ${expense.color}, 0 8px 32px -4px rgba(0,0,0,0.4)`,
                      zIndex: 1
                    } : { 
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)'
                    }}
                  >
                    <td className="p-4 text-white font-medium relative rounded-l-xl">
                      {editingId === expense.id ? (
                        <div className="relative">
                          <input 
                            type="date"
                            value={tempEdit?.date || ''}
                            onClick={(e) => (e.target as any).showPicker?.()}
                            onChange={(e) => setTempEdit({ ...tempEdit, date: e.target.value })}
                            className="bg-background border border-border rounded-lg py-1 px-2 text-sm text-white focus:border-primary outline-none [color-scheme:dark] w-full cursor-pointer"
                          />
                        </div>
                      ) : (
                        (() => {
                          try {
                            const [year, month, day] = expense.date.split('-').map(Number);
                            const d = new Date(year, month - 1, day);
                            return isNaN(d.getTime()) ? 'Fecha Inválida' : format(d, 'dd MMM, yyyy', { locale: es });
                          } catch (e) {
                            return 'Fecha Inválida';
                          }
                        })()
                      )}
                    </td>
                    <td className="p-4">
                      {editingId === expense.id ? (
                        <div className="flex flex-col gap-2">
                          <select 
                            value={tempEdit?.productId === 'manual' || !tempEdit?.productId ? 'manual' : tempEdit.productId}
                            onChange={(e) => {
                              const prod = savedProducts.find(p => p.id === e.target.value);
                              setTempEdit({ 
                                ...tempEdit, 
                                productId: e.target.value,
                                productName: prod ? prod.name : (tempEdit?.productName || '')
                              });
                            }}
                            className="bg-background border border-border rounded-lg py-1 px-2 text-sm text-white focus:border-primary outline-none"
                          >
                            {savedProducts.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                            <option value="manual">Manual</option>
                          </select>
                          {(!tempEdit?.productId || tempEdit?.productId === 'manual') && (
                            <input 
                              type="text"
                              value={tempEdit?.productName || ''}
                              onChange={(e) => setTempEdit({ ...tempEdit, productName: e.target.value })}
                              className="bg-background border border-border rounded-lg py-1 px-2 text-sm text-white focus:border-primary outline-none"
                              placeholder="Nombre producto"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-bold text-white">{expense.productName}</span>
                          <span className="text-[13px] text-slate-500 uppercase tracking-widest">ID: {expense.productId || 'N/A'}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {editingId === expense.id ? (
                        <select 
                          value={tempEdit?.platform || PLATFORMS[0]}
                          onChange={(e) => setTempEdit({ ...tempEdit, platform: e.target.value })}
                          className="bg-background border border-border rounded-lg py-1 px-2 text-sm text-white focus:border-primary outline-none"
                        >
                          {PLATFORMS.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="px-2 py-1 rounded-lg bg-white/5 border border-border text-[13px] font-bold uppercase tracking-widest text-slate-300">
                          {expense.platform}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-300">
                      {editingId === expense.id ? (
                        <div className="space-y-2">
                          <input 
                            type="text"
                            placeholder="Cuenta publicitaria"
                            value={tempEdit?.accountName || ''}
                            onChange={(e) => setTempEdit({ ...tempEdit, accountName: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg py-1 px-2 text-sm text-white focus:border-primary outline-none"
                          />
                          <input 
                            type="text"
                            placeholder="Notas / Detalles"
                            value={tempEdit?.notes || ''}
                            onChange={(e) => setTempEdit({ ...tempEdit, notes: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg py-1 px-2 text-sm text-white focus:border-primary outline-none"
                          />
                          <div className="flex flex-wrap gap-1 mt-1">
                            {TAG_COLORS.map(c => (
                              <button
                                key={c.value}
                                onClick={() => setTempEdit({ ...tempEdit, color: c.value })}
                                className={`w-4 h-4 rounded-full border border-white/10 ${tempEdit?.color === c.value ? 'ring-2 ring-primary' : ''}`}
                                style={{ backgroundColor: c.value === 'transparent' ? 'transparent' : c.value }}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 min-w-[150px]">
                          <span className="text-white font-medium">{expense.accountName}</span>
                          {expense.notes && (
                            <span className="text-[12px] text-slate-500 italic leading-tight bg-white/5 rounded p-1 border border-border/50">
                              {expense.notes}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {editingId === expense.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <div className="relative">
                            <input 
                              type="number"
                              step="0.01"
                              value={tempEdit?.amount ? Number((tempEdit.amount * (isLocalConversionActive ? currencies[currency].rate : 1)).toFixed(2)).toString() : ''}
                              onChange={(e) => {
                                const valString = e.target.value;
                                const val = parseFloat(valString) || 0;
                                const rate = currencies[currency].rate;
                                setTempEdit({ 
                                  ...tempEdit!, 
                                  amount: isLocalConversionActive ? val / rate : val,
                                  originalAmount: val,
                                  originalCurrency: isLocalConversionActive ? currency : 'USD',
                                  conversionRate: rate
                                });
                              }}
                              className="w-24 bg-background border border-primary rounded-lg py-1 px-2 text-sm font-mono text-white text-right focus:outline-none pr-8"
                            />
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500 opacity-50">
                              {isLocalConversionActive ? currency : 'USD'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2 group/amount">
                          <span className="font-bold text-primary">
                            {localFormatCurrency(expense.amount, expense)}
                          </span>
                          <button 
                            onClick={() => startEditing(expense)}
                            className="p-1 text-slate-500 hover:text-primary transition-colors opacity-0 group-hover/amount:opacity-100"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center rounded-r-xl">
                      <div className="flex items-center justify-center gap-2">
                        {editingId === expense.id ? (
                          <>
                            <button 
                              onClick={saveEditing}
                              className="p-2 text-primary hover:text-green-400 transition-colors"
                              title="Guardar"
                            >
                              <Check size={16} />
                            </button>
                            <button 
                              onClick={cancelEditing}
                              className="p-2 text-slate-500 hover:text-white transition-colors"
                              title="Cancelar"
                            >
                              <CloseIcon size={16} />
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="p-2 text-slate-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Spending Chart */}
        <div className="fintech-card p-6 border-primary/20">
          <div className="flex items-center gap-2 mb-8">
            <Activity size={20} className="text-primary" />
            <h3 className="text-lg font-display font-bold text-white">Inversión Diaria (14D)</h3>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.dailyData}>
                <defs>
                  <linearGradient id="colorAd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b" 
                  fontSize={13} 
                  tickLine={false} 
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={13} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => localFormatCurrency(value)}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px' }}
                  itemStyle={{ color: '#22c55e', fontSize: '15px', fontWeight: 'bold' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '13px', marginBottom: '4px' }}
                  cursor={{ stroke: '#22c55e', strokeWidth: 1, strokeDasharray: '3 3' }}
                  formatter={(value: number) => localFormatCurrency(value)}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#22c55e" 
                  fillOpacity={1} 
                  fill="url(#colorAd)" 
                  strokeWidth={3}
                  activeDot={{ r: 6, fill: '#22c55e', stroke: '#000000', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform Distribution Chart */}
        <div className="fintech-card p-6 border-secondary/20">
          <div className="flex items-center gap-2 mb-8">
            <PieChartIcon size={20} className="text-secondary" />
            <h3 className="text-lg font-display font-bold text-white">Por Plataforma</h3>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.platformData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="#cbd5e1" 
                  fontSize={13} 
                  width={100}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '15px', fontWeight: 'bold' }}
                  formatter={(value: number) => localFormatCurrency(value)}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24} activeBar={false}>
                  {stats.platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Account Analysis Chart */}
        <div className="fintech-card p-6 border-gold/20 lg:col-span-2">
          <div className="flex items-center gap-2 mb-8">
            <BarChart3 size={20} className="text-gold" />
            <h3 className="text-lg font-display font-bold text-white">Análisis por Cuenta</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.accountData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  fontSize={13} 
                  tickLine={false} 
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={13} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => localFormatCurrency(value)}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px' }}
                  itemStyle={{ color: '#fbbf24', fontSize: '15px', fontWeight: 'bold' }}
                  formatter={(value: number) => localFormatCurrency(value)}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                />
                <Bar dataKey="value" fill="#fbbf24" radius={[8, 8, 0, 0]} barSize={48} activeBar={false}>
                  {stats.accountData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

