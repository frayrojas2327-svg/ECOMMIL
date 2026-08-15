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

const MONTH_NAMES = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

const YEAR_OPTIONS = ['2024', '2025', '2026', '2027', '2028'];

const MONTH_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  '01': { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' }, // Enero
  '02': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' }, // Febrero
  '03': { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' }, // Marzo
  '04': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' }, // Abril
  '05': { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' }, // Mayo
  '06': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' }, // Junio
  '07': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' }, // Julio
  '08': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' }, // Agosto
  '09': { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' }, // Septiembre
  '10': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' }, // Octubre
  '11': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' }, // Noviembre
  '12': { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' }, // Diciembre
};

const getMonthDetails = (dateStr: string) => {
  if (!dateStr) return { name: 'Desconocido', styles: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' } };
  const parts = dateStr.split('-');
  if (parts.length < 2) return { name: 'Desconocido', styles: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' } };
  const monthVal = parts[1];
  const monthObj = MONTH_NAMES.find(m => m.value === monthVal);
  const name = monthObj ? monthObj.label : 'Desconocido';
  const styles = MONTH_COLORS[monthVal] || { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' };
  return { name, styles };
};

export default function AdvertisingExpenses({ 
  formatCurrency,
  currency,
  currencies,
  isConversionActive,
  selectedYear: propSelectedYear,
  setSelectedYear: propSetSelectedYear,
  selectedMonth: propSelectedMonth,
  setSelectedMonth: propSetSelectedMonth
}: { 
  formatCurrency: (amount: number) => string,
  currency: CurrencyCode,
  currencies: any,
  isConversionActive: boolean,
  selectedYear?: string,
  setSelectedYear?: React.Dispatch<React.SetStateAction<string>>,
  selectedMonth?: string,
  setSelectedMonth?: React.Dispatch<React.SetStateAction<string>>
}) {
  const { user } = useAuth();

  const [expenses, setExpenses] = useState<AdvertisingExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const [notification, setNotification] = useState<{message: string, type: 'info' | 'success'} | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const localFormatCurrency = (amount: number, expense?: AdvertisingExpense) => {
    // If we have an expense with original amount and currency, and it matches current view, use it exactly
    if (expense?.originalAmount !== undefined && expense?.originalCurrency === currency) {
      const locale = currency === 'PEN' ? 'es-PE' : 'es-GT';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        currencyDisplay: 'symbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(expense.originalAmount);
    }

    // Otherwise use the passed global formatter, or apply current currency rate
    const info = currencies[currency];
    const converted = amount * info.rate;
    const rounded = Math.round(converted * 100) / 100;

    // Choose locale based on currency
    const locale = currency === 'PEN' ? 'es-PE' : 'es-GT';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      currencyDisplay: 'symbol',
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
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');

  // Month-by-month filtering states
  const [localSelectedYear, localSetSelectedYear] = useState(() => {
    const now = new Date();
    return now.getFullYear().toString();
  });
  const [localSelectedMonth, localSetSelectedMonth] = useState(() => {
    const now = new Date();
    return String(now.getMonth() + 1).padStart(2, '0');
  });

  const selectedYear = (propSelectedYear && propSelectedYear !== '') ? propSelectedYear : localSelectedYear;
  const setSelectedYear = propSetSelectedYear !== undefined ? propSetSelectedYear : localSetSelectedYear;
  const selectedMonth = (propSelectedMonth && propSelectedMonth !== '') ? propSelectedMonth : localSelectedMonth;
  const setSelectedMonth = propSetSelectedMonth !== undefined ? propSetSelectedMonth : localSetSelectedMonth;

  const [isMonthFilterActive, setIsMonthFilterActive] = useState(true);
  
  // Default and saved advertising accounts for autocompletion
  const [defaultAccount, setDefaultAccount] = useState<string>(() => {
    return localStorage.getItem('ecommil_default_ad_account') || '';
  });

  const uniqueAccounts = useMemo(() => {
    const list = expenses.map(e => e.accountName?.trim() || '').filter(Boolean);
    if (defaultAccount && !list.includes(defaultAccount)) {
      list.unshift(defaultAccount);
    }
    return Array.from(new Set(list)).sort();
  }, [expenses, defaultAccount]);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState(() => {
    const savedDefault = localStorage.getItem('ecommil_default_ad_account') || '';
    return {
      productId: '',
      productName: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      accountName: savedDefault,
      platform: 'Facebook Ads',
      customPlatform: '',
      amount: '',
      notes: '',
      color: 'transparent'
    };
  });

  // If default account changes or is loaded, keep it synced
  const handleSetDefaultAccount = (account: string) => {
    const trimmed = account.trim();
    if (trimmed) {
      localStorage.setItem('ecommil_default_ad_account', trimmed);
      setDefaultAccount(trimmed);
    }
  };

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
      const normalizedAmount = isConversionActive ? rawAmount / info.rate : rawAmount;

      // Find product name if only ID was selected
      let finalProductName = formData.productName;
      if (!finalProductName && formData.productId && formData.productId !== 'manual') {
        const prod = savedProducts.find(p => p.id === formData.productId);
        if (prod) finalProductName = prod.name;
      }

      const finalPlatform = formData.platform === 'Otro' ? formData.customPlatform : formData.platform;
      const finalAccount = formData.accountName.trim() || defaultAccount || 'Cuenta Principal';

      // Save account as default for future autocompletion
      if (finalAccount) {
        handleSetDefaultAccount(finalAccount);
      }

      const newExpense = {
        uid: user.uid,
        productId: formData.productId,
        productName: finalProductName || 'Sin Producto',
        date: formData.date,
        accountName: finalAccount,
        platform: finalPlatform || 'Otro',
        amount: normalizedAmount,
        originalAmount: rawAmount,
        originalCurrency: isConversionActive ? currency : 'USD',
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
        accountName: finalAccount, // Keep the account name by default for next entry!
        platform: formData.platform || 'Facebook Ads',
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
      
      let matchesDate = true;
      if (startDateFilter) {
        matchesDate = matchesDate && exp.date >= startDateFilter;
      }
      if (endDateFilter) {
        matchesDate = matchesDate && exp.date <= endDateFilter;
      }

      // Filter by Month and Year if option is active
      if (isMonthFilterActive && exp.date) {
        const trimmed = exp.date.trim();
        const dateMatch = trimmed.match(/^(\d{4})-(\d{1,2})/);
        if (dateMatch) {
          const yr = dateMatch[1];
          const mth = dateMatch[2].padStart(2, '0');
          matchesDate = matchesDate && yr === selectedYear && mth === selectedMonth;
        } else {
          matchesDate = false;
        }
      }

      let matchesAccount = true;
      if (accountFilter) {
        if (accountFilter === 'Sin Cuenta') {
          matchesAccount = !exp.accountName || exp.accountName.trim() === '';
        } else {
          matchesAccount = exp.accountName?.trim() === accountFilter;
        }
      }
      
      return matchesSearch && matchesDate && matchesAccount;
    });
  }, [expenses, searchTerm, startDateFilter, endDateFilter, accountFilter, selectedYear, selectedMonth, isMonthFilterActive]);

  // Group all expenses from this section to display a simple month-by-month total sum table!
  const monthlySummaryData = useMemo(() => {
    const groups: Record<string, { amount: number; count: number }> = {};
    
    // Always guarantee that the current real-world month and the currently selected month are included
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const selectedKey = `${selectedYear}-${selectedMonth}`;
    
    groups[currentKey] = { amount: 0, count: 0 };
    groups[selectedKey] = { amount: 0, count: 0 };

    expenses.forEach(e => {
      if (!e.date) return;
      const trimmed = e.date.trim();
      const match = trimmed.match(/^(\d{4})-(\d{1,2})/);
      if (!match) return;
      const yr = match[1];
      const mth = match[2].padStart(2, '0');
      const monthPrefix = `${yr}-${mth}`;

      if (!groups[monthPrefix]) {
        groups[monthPrefix] = { amount: 0, count: 0 };
      }
      groups[monthPrefix].amount += e.amount || 0;
      groups[monthPrefix].count += 1;
    });

    const list = Object.entries(groups)
      .map(([monthKey, data]) => {
        const [yr, mth] = monthKey.split('-');
        const monthObj = MONTH_NAMES.find(m => m.value === mth);
        const monthLabel = monthObj ? monthObj.label : mth;
        return {
          monthKey,
          label: `${monthLabel} ${yr}`,
          amount: data.amount,
          count: data.count,
          year: yr,
          month: mth
        };
      })
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    // De-duplicate items based on monthKey to guarantee absolute uniqueness
    const deDuplicated: typeof list = [];
    const seenKeys = new Set<string>();
    for (const item of list) {
      if (!seenKeys.has(item.monthKey)) {
        seenKeys.add(item.monthKey);
        deDuplicated.push(item);
      }
    }
    return deDuplicated;
  }, [expenses, selectedYear, selectedMonth]);

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
        <div className="flex bg-background/50 rounded-lg p-0.5 border border-border">
          <div className={`px-3 py-1.5 flex items-center gap-2 text-[10px] font-black tracking-widest ${isConversionActive ? 'text-primary' : 'text-slate-500'}`}>
            <Globe size={14} />
            {isConversionActive ? `MONEDA: ${currency}` : 'MODO USD'}
          </div>
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

      {/* Resumen de Totales por Mes */}
      <div className="fintech-card p-6 border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-[13px] font-display font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <span className="text-primary">📊</span> Resumen de Inversión por Mes (Suma Total)
            </h3>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Consolidado automático de todos los registros de publicidad por mes. Haz clic en un mes para filtrarlo abajo.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-border">
            Total meses registrados: {monthlySummaryData.length}
          </span>
        </div>

        {monthlySummaryData.length === 0 ? (
          <div className="py-6 text-center text-slate-500 font-mono text-xs">
            No hay gastos registrados en Publicidad para consolidar.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {monthlySummaryData.map((item) => {
              const isActive = isMonthFilterActive && selectedYear === item.year && selectedMonth === item.month;
              return (
                <button
                  key={item.monthKey}
                  type="button"
                  onClick={() => {
                    setSelectedYear(item.year);
                    setSelectedMonth(item.month);
                    setIsMonthFilterActive(true);
                  }}
                  className={`p-3.5 rounded-xl border font-mono text-left transition-all active:scale-95 cursor-pointer relative group ${
                    isActive
                      ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5 text-white'
                      : 'bg-background border-border hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-bold ${isActive ? 'text-primary' : 'text-slate-400 group-hover:text-white'}`}>
                      {item.label}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                    )}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-bold text-white">
                      {localFormatCurrency(item.amount)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {item.count} {item.count === 1 ? 'reg' : 'regs'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
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
                    onClick={(e) => {
                      try {
                        (e.target as any).showPicker?.();
                      } catch (err) {
                        console.warn('showPicker restricted in this environment:', err);
                      }
                    }}
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
                    const pName = prod ? prod.name : '';
                    let autoAccount = formData.accountName;
                    if (!autoAccount) {
                      const pastExp = expenses.find(exp => exp.productId === e.target.value || exp.productName === pName);
                      autoAccount = pastExp?.accountName || defaultAccount || '';
                    }
                    setFormData({ 
                      ...formData, 
                      productId: e.target.value,
                      productName: pName,
                      accountName: autoAccount
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
                <div className="flex items-center justify-between">
                  <label className="text-[13px] uppercase tracking-widest text-slate-400 font-bold ml-1 flex items-center gap-1.5">
                    <span>Cuenta Publicitaria</span>
                    {formData.accountName && formData.accountName === defaultAccount && (
                      <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 rounded font-bold">
                        ⭐ Por defecto
                      </span>
                    )}
                  </label>
                  {formData.accountName && formData.accountName !== defaultAccount && (
                    <button
                      type="button"
                      onClick={() => handleSetDefaultAccount(formData.accountName)}
                      className="text-[11px] text-primary/80 hover:text-primary underline font-medium transition-colors cursor-pointer"
                      title="Fijar esta cuenta como predeterminada"
                    >
                      Fijar por defecto
                    </button>
                  )}
                </div>
                
                <div className="relative">
                  <input 
                    type="text"
                    required
                    list="advertising-accounts-list"
                    placeholder="Ej: Cuenta Principal / BM-01"
                    value={formData.accountName}
                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl py-2.5 px-4 text-[15px] text-white focus:border-primary outline-none transition-all"
                  />
                  <datalist id="advertising-accounts-list">
                    {uniqueAccounts.map((acc) => (
                      <option key={acc} value={acc} />
                    ))}
                  </datalist>
                </div>

                {uniqueAccounts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-500 font-medium">Sugeridas:</span>
                    {uniqueAccounts.slice(0, 6).map((acc) => (
                      <button
                        key={acc}
                        type="button"
                        onClick={() => setFormData({ ...formData, accountName: acc })}
                        className={`text-[11px] px-2.5 py-0.5 rounded-lg border font-mono transition-all cursor-pointer ${
                          formData.accountName === acc
                            ? 'bg-primary/20 border-primary text-primary font-bold shadow-sm'
                            : 'bg-white/5 border-border hover:border-slate-600 text-slate-400 hover:text-white'
                        }`}
                      >
                        {acc === defaultAccount ? `⭐ ${acc}` : acc}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[13px] uppercase tracking-widest text-slate-400 font-bold ml-1 flex justify-between items-center">
                  Monto Invertido
                  <div className="flex items-center gap-2">
                    <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${isConversionActive ? 'bg-primary text-background' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                      {isConversionActive ? `En ${currency}` : 'En USD'}
                    </div>
                  </div>
                </label>
                <div className={`relative rounded-xl border transition-all duration-300 ${isConversionActive ? 'bg-primary/5 border-primary/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-background border-border'}`}>
                  <div className={`absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[16px] font-bold transition-colors ${isConversionActive ? 'text-primary' : 'text-slate-500'}`}>
                    {isConversionActive ? currencies[currency].symbol : '$'}
                  </div>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    placeholder="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className={`w-full bg-transparent py-3.5 pl-12 pr-16 text-[18px] font-mono text-white outline-none transition-all ${isConversionActive ? 'placeholder:text-primary/30' : 'placeholder:text-slate-700'}`}
                  />
                  <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${isConversionActive ? 'bg-primary text-background' : 'bg-slate-800 text-slate-500'}`}>
                    {isConversionActive ? currency : 'USD'}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1 px-1">
                  {isConversionActive ? (
                    <TrendingUp size={12} className="text-primary animate-pulse" />
                  ) : (
                    <Globe size={12} className="text-slate-500" />
                  )}
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {isConversionActive ? (
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
              {/* Filtro por Mes */}
              <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => setIsMonthFilterActive(!isMonthFilterActive)}
                  className={`text-[10px] font-bold uppercase transition-colors mr-1 cursor-pointer ${
                    isMonthFilterActive ? 'text-primary' : 'text-slate-500 hover:text-white'
                  }`}
                  title="Activar/Desactivar filtro por mes"
                >
                  📅 {isMonthFilterActive ? 'Mes Filtrado:' : 'Ver Histórico'}
                </button>
                {isMonthFilterActive && (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-transparent border-none text-white text-xs font-bold outline-none cursor-pointer appearance-none pr-1"
                    >
                      {MONTH_NAMES.map(m => (
                        <option key={m.value} value={m.value} className="bg-black text-white">
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-slate-600 text-xs font-bold">/</span>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="bg-transparent border-none text-white text-xs font-bold outline-none cursor-pointer appearance-none pr-1"
                    >
                      {YEAR_OPTIONS.map(y => (
                        <option key={y} value={y} className="bg-black text-white">
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

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

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Cuenta:</span>
                <div className="relative group/account">
                  <Target className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-hover/account:text-primary transition-colors pointer-events-none" size={14} />
                  <select
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                    className="bg-background border border-border rounded-xl py-1.5 pl-9 pr-8 text-xs text-white focus:border-primary outline-none cursor-pointer appearance-none min-w-[150px]"
                  >
                    <option value="">Todas las cuentas</option>
                    {uniqueAccounts.map((account) => (
                      <option key={account} value={account}>
                        {account}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Inicio:</span>
                <div className="relative group/start-date">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-hover/start-date:text-primary transition-colors pointer-events-none" size={14} />
                  <input 
                    type="date"
                    value={startDateFilter}
                    onClick={(e) => {
                      try {
                        (e.target as any).showPicker?.();
                      } catch (err) {
                        console.warn('showPicker restricted in this environment:', err);
                      }
                    }}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="bg-background border border-border rounded-xl py-1.5 pl-9 pr-7 text-xs text-white focus:border-primary outline-none [color-scheme:dark] cursor-pointer"
                  />
                  {startDateFilter && (
                    <button 
                      onClick={() => setStartDateFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <CloseIcon size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Fin:</span>
                <div className="relative group/end-date">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-hover/end-date:text-primary transition-colors pointer-events-none" size={14} />
                  <input 
                    type="date"
                    value={endDateFilter}
                    onClick={(e) => {
                      try {
                        (e.target as any).showPicker?.();
                      } catch (err) {
                        console.warn('showPicker restricted in this environment:', err);
                      }
                    }}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="bg-background border border-border rounded-xl py-1.5 pl-9 pr-7 text-xs text-white focus:border-primary outline-none [color-scheme:dark] cursor-pointer"
                  />
                  {endDateFilter && (
                    <button 
                      onClick={() => setEndDateFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <CloseIcon size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="bg-background/50 text-[13px] uppercase tracking-widest text-slate-500 font-display">
                <th className="p-4 font-bold border-b border-border">Fecha</th>
                <th className="p-4 font-bold border-b border-border">Mes</th>
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
                  <td colSpan={7} className="p-12 text-center text-slate-500 italic">
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
                            onClick={(e) => {
                              try {
                                (e.target as any).showPicker?.();
                              } catch (err) {
                                console.warn('showPicker restricted in this environment:', err);
                              }
                            }}
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
                      {(() => {
                        const dateVal = editingId === expense.id && tempEdit?.date ? tempEdit.date : expense.date;
                        const { name: monthLabel, styles: monthStyles } = getMonthDetails(dateVal);
                        return (
                          <span className={`px-2.5 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider ${monthStyles.bg} ${monthStyles.text} ${monthStyles.border}`}>
                            {monthLabel}
                          </span>
                        );
                      })()}
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
                            list="advertising-accounts-list"
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
                              value={tempEdit?.originalAmount && tempEdit.originalCurrency === currency ? tempEdit.originalAmount : (tempEdit?.amount ? Number((tempEdit.amount * (isConversionActive ? currencies[currency].rate : 1)).toFixed(2)) : '')}
                              onChange={(e) => {
                                const valString = e.target.value;
                                const val = parseFloat(valString) || 0;
                                const rate = isConversionActive ? currencies[currency].rate : 1;
                                setTempEdit({ 
                                  ...tempEdit!, 
                                  amount: val / rate,
                                  originalAmount: val,
                                  originalCurrency: isConversionActive ? currency : 'USD',
                                  conversionRate: rate
                                });
                              }}
                              className="w-24 bg-background border border-primary rounded-lg py-1 px-2 text-sm font-mono text-white text-right focus:outline-none pr-8"
                            />
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500 opacity-50">
                              {isConversionActive ? currency : 'USD'}
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

