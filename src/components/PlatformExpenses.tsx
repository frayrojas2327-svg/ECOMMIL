import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  Check, 
  Table as TableIcon, 
  Globe, 
  CloudCheck, 
  Cloud,
  Calendar,
  CalendarDays,
  Clock,
  Coins,
  DollarSign,
  Filter,
  Sparkles,
  TrendingUp,
  Wallet,
  Building2,
  Calculator,
  Layers,
  PieChart,
  BarChart3,
  RefreshCw,
  Zap,
  ArrowRight,
  Info,
  CheckCircle2,
  ChevronRight,
  X
} from 'lucide-react';
import { CurrencyCode } from '../mockData';
import { useAuth } from './Auth';

interface FixedExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  originalAmount?: number;
  originalCurrency?: string;
  frequency: 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
}

interface VariableExpense {
  id: string;
  name: string;
  amount: number;
  originalAmount?: number;
  originalCurrency?: string;
  startDate: string;
  endDate: string;
}

interface PlatformExpensesProps {
  formatCurrency: (amount: number) => string;
  currencySymbol: string;
  currency: CurrencyCode;
  currencies: any;
  isConversionActive?: boolean;
  fixedExpenses: FixedExpense[];
  setFixedExpenses: React.Dispatch<React.SetStateAction<FixedExpense[]>>;
  variableExpenses: VariableExpense[];
  setVariableExpenses: React.Dispatch<React.SetStateAction<VariableExpense[]>>;
}

const EXPENSE_CATEGORIES = ['Software', 'Publicidad', 'Servicios', 'Personal', 'Suscripciones', 'Otros'];

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

const PlatformExpenses: React.FC<PlatformExpensesProps> = ({ 
  formatCurrency, 
  currencySymbol,
  currency,
  currencies,
  isConversionActive = false,
  fixedExpenses,
  setFixedExpenses,
  variableExpenses,
  setVariableExpenses
}) => {
  const localFormatCurrency = (amount: number, expense?: FixedExpense | VariableExpense) => {
    let rawVal = amount;
    if (expense) {
      const expAmount = expense.originalAmount !== undefined && expense.originalAmount > 0 
        ? expense.originalAmount 
        : expense.amount;
      if ('frequency' in expense && expense.frequency === 'yearly' && Math.abs(amount - expense.amount / 12) < 0.01) {
        rawVal = expAmount / 12;
      } else if (Math.abs(amount - expense.amount) < 0.01) {
        rawVal = expAmount;
      }
    }
      
    const locale = currency === 'PEN' ? 'es-PE' : currency === 'GTQ' ? 'es-GT' : currency === 'COP' ? 'es-CO' : currency === 'MXN' ? 'es-MX' : 'es-GT';
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(rawVal);
  };

  const { user } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Registration Modal & Expense Type States
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [registerExpenseType, setRegisterExpenseType] = useState<'fixed' | 'variable'>('fixed');

  // New Expense Form States
  const [newFixed, setNewFixed] = useState<Omit<FixedExpense, 'id'>>({
    name: '',
    category: 'Software',
    amount: 0,
    frequency: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });

  const [newVariable, setNewVariable] = useState<Omit<VariableExpense, 'id'>>({
    name: '',
    amount: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });

  const addExpense = () => {
    const rawAmount = Number(newFixed.amount) || 0;
    
    const newExpense: FixedExpense = {
      ...newFixed,
      amount: rawAmount,
      originalAmount: rawAmount,
      originalCurrency: currency,
      id: Math.random().toString(36).substr(2, 9)
    };
    setFixedExpenses([...fixedExpenses, newExpense]);
    // Reset form
    setNewFixed({
      name: '',
      category: 'Software',
      amount: 0,
      frequency: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      endDate: ''
    });
    setIsRegisterOpen(false);
  };

  const addVariableExpense = () => {
    const rawAmount = Number(newVariable.amount) || 0;
    
    const newExpense: VariableExpense = {
      ...newVariable,
      amount: rawAmount,
      originalAmount: rawAmount,
      originalCurrency: currency,
      id: Math.random().toString(36).substr(2, 9)
    };
    setVariableExpenses([...variableExpenses, newExpense]);
    // Reset form
    setNewVariable({
      name: '',
      amount: 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: ''
    });
    setIsRegisterOpen(false);
  };

  const removeExpense = (id: string) => {
    setFixedExpenses(fixedExpenses.filter(e => e.id !== id));
  };

  const updateExpense = (id: string, field: keyof FixedExpense, value: any) => {
    setFixedExpenses(fixedExpenses.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const removeVariableExpense = (id: string) => {
    setVariableExpenses(variableExpenses.filter(e => e.id !== id));
  };

  const updateVariableExpense = (id: string, field: keyof VariableExpense, value: any) => {
    setVariableExpenses(variableExpenses.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const totalMonthlyFixed = fixedExpenses.reduce((acc, curr) => {
    const val = curr.originalAmount !== undefined && curr.originalAmount > 0 ? curr.originalAmount : curr.amount;
    return acc + (curr.frequency === 'monthly' ? val : val / 12);
  }, 0);

  const totalVariable = variableExpenses.reduce((acc, curr) => {
    const val = curr.originalAmount !== undefined && curr.originalAmount > 0 ? curr.originalAmount : curr.amount;
    return acc + val;
  }, 0);

  // --- DASHBOARD DE GASTO ADMINISTRATIVO: STATES & CALCULATIONS ---
  const currentRealMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentRealYear = String(new Date().getFullYear());

  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(currentRealYear);
  const [filterTableByMonth, setFilterTableByMonth] = useState<boolean>(true);
  const [plannedMonthlyOrders, setPlannedMonthlyOrders] = useState<number>(300);

  // Available Years
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>([currentRealYear, '2025', '2024']);
    [...fixedExpenses, ...variableExpenses].forEach(exp => {
      if (exp.startDate) {
        const y = exp.startDate.split('-')[0];
        if (y && y.length === 4) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [fixedExpenses, variableExpenses, currentRealYear]);

  // Helper to determine if an expense applies to the selected month and year
  const isExpenseInMonth = (exp: FixedExpense | VariableExpense, month: string, year: string) => {
    if (month === 'all' && year === 'all') return true;
    
    const parts = (exp.startDate || '').split('-');
    const expYear = parts[0] || '';
    const expMonth = parts[1] || '';

    // If year is filtered
    if (year !== 'all' && expYear && expYear !== year) {
      if (!('frequency' in exp) || exp.frequency !== 'monthly') {
        return false;
      }
      if (expYear > year) return false;
      if (exp.endDate && exp.endDate.split('-')[0] < year) return false;
    }

    if (month === 'all') return true;

    // Check direct month match in start date
    if (expMonth === month) return true;

    // If recurring monthly fixed expense, check if active in this target month
    if ('frequency' in exp && exp.frequency === 'monthly') {
      const targetYear = year !== 'all' ? year : (expYear || currentRealYear);
      const targetMonthDate = `${targetYear}-${month}-01`;
      const startCheck = exp.startDate ? exp.startDate <= `${targetYear}-${month}-31` : true;
      const endCheck = !exp.endDate || exp.endDate >= targetMonthDate;
      return startCheck && endCheck;
    }

    return false;
  };

  // Filtered expenses based on dashboard month and year filter
  const filteredFixedExpenses = useMemo(() => {
    return fixedExpenses.filter(exp => isExpenseInMonth(exp, selectedMonth, selectedYear));
  }, [fixedExpenses, selectedMonth, selectedYear]);

  const filteredVariableExpenses = useMemo(() => {
    return variableExpenses.filter(exp => isExpenseInMonth(exp, selectedMonth, selectedYear));
  }, [variableExpenses, selectedMonth, selectedYear]);

  // Financial sums for the selected period
  const totalFixedPeriod = useMemo(() => {
    return filteredFixedExpenses.reduce((acc, curr) => {
      const val = curr.originalAmount !== undefined && curr.originalAmount > 0 ? curr.originalAmount : curr.amount;
      return acc + (curr.frequency === 'monthly' ? val : val / 12);
    }, 0);
  }, [filteredFixedExpenses]);

  const totalVariablePeriod = useMemo(() => {
    return filteredVariableExpenses.reduce((acc, curr) => {
      const val = curr.originalAmount !== undefined && curr.originalAmount > 0 ? curr.originalAmount : curr.amount;
      return acc + val;
    }, 0);
  }, [filteredVariableExpenses]);

  const totalAdminPeriod = totalFixedPeriod + totalVariablePeriod;

  // Days in selected period
  const daysInPeriod = useMemo(() => {
    if (selectedMonth === 'all') return 30; // 30-day operational average
    const mNum = parseInt(selectedMonth, 10);
    const yNum = selectedYear !== 'all' ? parseInt(selectedYear, 10) : new Date().getFullYear();
    return new Date(yNum, mNum, 0).getDate() || 30;
  }, [selectedMonth, selectedYear]);

  // Daily Expenses
  const dailyAdminExpense = totalAdminPeriod > 0 ? totalAdminPeriod / daysInPeriod : 0;
  const dailyFixedExpense = totalFixedPeriod > 0 ? totalFixedPeriod / daysInPeriod : 0;
  const dailyVariableExpense = totalVariablePeriod > 0 ? totalVariablePeriod / daysInPeriod : 0;

  // Category breakdown for administrative fixed expenses
  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    EXPENSE_CATEGORIES.forEach(c => cats[c] = 0);
    filteredFixedExpenses.forEach(exp => {
      const val = exp.originalAmount !== undefined && exp.originalAmount > 0 ? exp.originalAmount : exp.amount;
      const monthVal = exp.frequency === 'monthly' ? val : val / 12;
      const cat = exp.category || 'Otros';
      cats[cat] = (cats[cat] || 0) + monthVal;
    });
    return Object.entries(cats)
      .map(([cat, amount]) => ({
        category: cat,
        amount,
        percentage: totalFixedPeriod > 0 ? (amount / totalFixedPeriod) * 100 : 0
      }))
      .filter(item => item.amount > 0 || ['Software', 'Personal', 'Servicios', 'Suscripciones'].includes(item.category))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredFixedExpenses, totalFixedPeriod]);

  // Stats per month to display badges on month pills
  const monthStatsMap = useMemo(() => {
    const map: Record<string, { count: number, total: number }> = {};
    MONTH_NAMES.forEach(m => {
      const fExps = fixedExpenses.filter(e => isExpenseInMonth(e, m.value, selectedYear));
      const vExps = variableExpenses.filter(e => isExpenseInMonth(e, m.value, selectedYear));
      const fTotal = fExps.reduce((acc, curr) => {
        const val = curr.originalAmount !== undefined && curr.originalAmount > 0 ? curr.originalAmount : curr.amount;
        return acc + (curr.frequency === 'monthly' ? val : val / 12);
      }, 0);
      const vTotal = vExps.reduce((acc, curr) => {
        const val = curr.originalAmount !== undefined && curr.originalAmount > 0 ? curr.originalAmount : curr.amount;
        return acc + val;
      }, 0);
      map[m.value] = {
        count: fExps.length + vExps.length,
        total: fTotal + vTotal
      };
    });
    return map;
  }, [fixedExpenses, variableExpenses, selectedYear]);

  // Selected Month Label
  const selectedMonthObj = MONTH_NAMES.find(m => m.value === selectedMonth);
  const selectedMonthName = selectedMonth === 'all' 
    ? 'Todos los Meses' 
    : (selectedMonthObj ? selectedMonthObj.label : 'Mes Seleccionado');

  // COD Calculator Absorption: Administrative Expense per Order
  const costPerOrder = plannedMonthlyOrders > 0 ? totalAdminPeriod / plannedMonthlyOrders : 0;

  // Currency converter helper (Soles ⇄ Quetzales)
  const formatConvertedPair = (amountInCurrentCurrency: number) => {
    const ratePEN = currencies?.['PEN']?.rate || 3.75;
    const rateGTQ = currencies?.['GTQ']?.rate || 7.80;
    
    if (currency === 'PEN') {
      const inGTQ = amountInCurrentCurrency * (rateGTQ / ratePEN);
      return `🇬🇹 Q ${inGTQ.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (currency === 'GTQ') {
      const inPEN = amountInCurrentCurrency * (ratePEN / rateGTQ);
      return `🇵🇪 S/ ${inPEN.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      const inPEN = amountInCurrentCurrency * ratePEN;
      const inGTQ = amountInCurrentCurrency * rateGTQ;
      return `🇵🇪 S/ ${inPEN.toFixed(2)} | 🇬🇹 Q ${inGTQ.toFixed(2)}`;
    }
  };

  const displayedFixedExpenses = (filterTableByMonth && selectedMonth !== 'all') ? filteredFixedExpenses : fixedExpenses;
  const displayedVariableExpenses = (filterTableByMonth && selectedMonth !== 'all') ? filteredVariableExpenses : variableExpenses;

  const handleSave = () => {
    // Save to local storage as fallback and trigger state propagation for cloud sync
    localStorage.setItem('ecommil_fixed_expenses', JSON.stringify(fixedExpenses));
    localStorage.setItem('ecommil_variable_expenses', JSON.stringify(variableExpenses));
    // Trigger setFixedExpenses and setVariableExpenses to propagate to Firestore
    setFixedExpenses([...fixedExpenses]);
    setVariableExpenses([...variableExpenses]);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
    
    // Scroll to table view
    const tableView = document.getElementById('excel-table-view');
    if (tableView) {
      tableView.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
              <CreditCard className="text-neon" size={28} /> Gastos de Plataforma
            </h2>
            {user ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-neon/10 text-neon border border-neon/30 shadow-[0_0_10px_rgba(34,197,94,0.15)]">
                <CloudCheck size={13} className="text-neon" /> Sincronizado en la Nube
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Cloud size={13} /> Modo Local
              </span>
            )}
          </div>
          <p className="text-slate-400 mt-1">Configura tus costos fijos y variables. Se sincronizan en cualquier dispositivo donde inicies sesión.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-background/50 rounded-lg p-0.5 border border-border">
            <div className={`px-3 py-1.5 flex items-center gap-2 text-[10px] font-black tracking-widest ${isConversionActive ? 'text-neon' : 'text-slate-500'}`}>
              <Globe size={14} />
              {isConversionActive ? `MONEDA: ${currency}` : 'MODO USD'}
            </div>
          </div>
          <div className="flex items-center gap-4 bg-card border border-border p-3.5 rounded-2xl shadow-sm">
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Total Fijo Mensual</p>
              <p className="text-[16px] font-mono font-bold text-neon">{localFormatCurrency(totalMonthlyFixed)}</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Total Variable (Unidad)</p>
              <p className="text-[16px] font-mono font-bold text-gold">{localFormatCurrency(totalVariable)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DASHBOARD EJECUTIVO DE GASTOS ADMINISTRATIVOS: TOTAL POR MESES Y POR DÍAS */}
      {/* ========================================================================= */}
      <div className="bg-[#0b0f17] border-2 border-neon/30 hover:border-neon/50 rounded-2xl p-5 md:p-6 space-y-6 shadow-2xl relative overflow-hidden transition-all">
        {/* Glow ambient background elements */}
        <div className="absolute top-0 right-10 w-96 h-28 bg-neon/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-96 h-28 bg-purple-500/10 blur-3xl pointer-events-none" />

        {/* Dashboard Title & Quick Stats Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-5 relative z-10">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neon to-emerald-400 text-black flex items-center justify-center font-black shrink-0 shadow-lg shadow-neon/20">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-neon/15 text-neon border border-neon/30 flex items-center gap-1">
                  <Sparkles size={13} />
                  Dashboard Administrativo
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  {selectedMonthName} {selectedYear !== 'all' ? selectedYear : ''}
                </span>
                <span className="text-[14px] font-mono text-slate-300 font-semibold">
                  Base: {daysInPeriod} días ({localFormatCurrency(dailyAdminExpense)}/día)
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-black tracking-tight text-white flex items-center gap-2">
                CONTROL DE GASTOS: <span className="text-neon">¿CUÁNTO ES MI GASTO ADMINISTRATIVO?</span>
              </h3>
              <p className="text-[14px] text-slate-300 mt-1 max-w-3xl leading-relaxed font-normal">
                Visualiza el total consolidado por mes y por día. Usa los filtros de meses para auditar tus costos fijos, suscripciones y determinar con exactitud cuánto gasto administrativo debes imputar en tu Calculadora COD.
              </p>
            </div>
          </div>

          {/* Year selector & Quick Month Jumper */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Year Selector */}
            <div className="flex items-center gap-1.5 bg-[#141b24] p-1 rounded-xl border border-white/10">
              <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Año:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-[#141b24] text-white">Todos</option>
                {availableYears.map(y => (
                  <option key={y} value={y} className="bg-[#141b24] text-white">{y}</option>
                ))}
              </select>
            </div>

            {/* Quick Button: Este Mes */}
            <button
              type="button"
              onClick={() => {
                setSelectedMonth(currentRealMonth);
                setSelectedYear(currentRealYear);
              }}
              className="px-3 py-1.5 rounded-xl bg-neon/10 hover:bg-neon/20 border border-neon/30 text-neon text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              title="Ir al mes en curso actual"
            >
              <Zap size={13} className="fill-neon" />
              <span>Mes Actual ({MONTH_NAMES.find(m => m.value === currentRealMonth)?.label})</span>
            </button>

            {/* Quick Button: Todo el año */}
            <button
              type="button"
              onClick={() => setSelectedMonth('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border ${
                selectedMonth === 'all'
                  ? 'bg-white/15 text-white border-white/30 shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:text-white border-white/10'
              }`}
            >
              <span>Ver Todo</span>
            </button>
          </div>
        </div>

        {/* ========================================================== */}
        {/* FILTROS POR NOMBRE DE MESES: HORIZONTAL SELECTOR PILLS     */}
        {/* ========================================================== */}
        <div className="space-y-2 relative z-10">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-400">
            <span className="flex items-center gap-1.5">
              <Filter size={14} className="text-neon" />
              Filtro por Nombre de Mes:
            </span>
            <span className="text-[11px] font-mono text-neon font-bold">
              Seleccionado: {selectedMonthName}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {/* Option: Todos los Meses */}
            <button
              type="button"
              onClick={() => setSelectedMonth('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer border shrink-0 ${
                selectedMonth === 'all'
                  ? 'bg-neon text-black border-neon shadow-lg shadow-neon/20 font-extrabold ring-2 ring-neon/40'
                  : 'bg-[#141b24] text-slate-400 hover:text-white border-white/5 hover:border-white/20'
              }`}
            >
              <Calendar size={13} />
              <span>Todos los Meses</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${selectedMonth === 'all' ? 'bg-black/30 text-black font-extrabold' : 'bg-white/10 text-slate-400'}`}>
                {fixedExpenses.length + variableExpenses.length}
              </span>
            </button>

            {/* 12 Months Pills */}
            {MONTH_NAMES.map((m) => {
              const isSelected = selectedMonth === m.value;
              const isCurrent = currentRealMonth === m.value && (selectedYear === currentRealYear || selectedYear === 'all');
              const stats = monthStatsMap[m.value] || { count: 0, total: 0 };
              const hasExpenses = stats.count > 0;

              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setSelectedMonth(m.value)}
                  className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer border shrink-0 relative ${
                    isSelected
                      ? 'bg-gradient-to-r from-neon to-emerald-400 text-black border-neon shadow-lg shadow-neon/25 font-extrabold ring-2 ring-neon/50'
                      : isCurrent
                        ? 'bg-neon/10 hover:bg-neon/20 text-neon border-neon/40'
                        : hasExpenses
                          ? 'bg-[#141b24] hover:bg-[#1a2330] text-slate-200 border-white/10 hover:border-neon/30'
                          : 'bg-[#0f141c]/60 text-slate-500 hover:text-slate-300 border-white/5 hover:border-white/15'
                  }`}
                >
                  <span className="font-mono text-[10px] opacity-75">{m.value}</span>
                  <span>{m.label}</span>
                  {hasExpenses && (
                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected 
                        ? 'bg-black/40 text-black' 
                        : 'bg-neon/15 text-neon border border-neon/20'
                    }`}>
                      {stats.count}
                    </span>
                  )}
                  {isCurrent && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" title="Mes en curso" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================== */}
        {/* ========================================================== */}
        {/* 4 HERO KPI CARDS: TOTAL POR MESES Y POR DÍAS               */}
        {/* ========================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          
          {/* CARD 1: GASTO ADMINISTRATIVO TOTAL */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-neon/15 via-[#121820] to-[#0f141c] border-2 border-neon/40 space-y-2 relative overflow-hidden shadow-xl shadow-neon/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-neon tracking-wider flex items-center gap-1">
                <DollarSign size={14} />
                GASTO ADMINISTRATIVO TOTAL
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-neon/20 text-neon font-mono text-xs font-black">
                {selectedMonthName.toUpperCase()}
              </span>
            </div>

            <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
              {localFormatCurrency(totalAdminPeriod)}
            </div>

            {/* Live Soles ⇄ Quetzales conversion tag */}
            <div className="pt-2 border-t border-neon/20 text-[14px] font-mono flex items-center justify-between">
              <span className="text-slate-300 font-bold">Equivalencia en vivo:</span>
              <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                {formatConvertedPair(totalAdminPeriod)}
              </span>
            </div>

            <div className="flex justify-between text-[14px] font-mono text-slate-300 pt-1 border-t border-white/5 font-medium">
              <span>🔒 Fijos: <strong className="text-white">{localFormatCurrency(totalFixedPeriod)}</strong></span>
              <span>⚡ Variables: <strong className="text-gold">{localFormatCurrency(totalVariablePeriod)}</strong></span>
            </div>
          </div>

          {/* CARD 2: GASTO ADMINISTRATIVO POR DÍA (RITMO DIARIO) */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-sky-500/15 via-[#121820] to-[#0f141c] border-2 border-sky-500/40 space-y-2 relative overflow-hidden shadow-xl shadow-sky-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-sky-400 tracking-wider flex items-center gap-1">
                <CalendarDays size={14} />
                GASTO OPERATIVO POR DÍA
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono text-xs font-black">
                {daysInPeriod} DÍAS
              </span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-display font-black text-sky-300 tracking-tight">
                {localFormatCurrency(dailyAdminExpense)}
              </span>
              <span className="text-sm font-bold text-slate-300 uppercase">/ día</span>
            </div>

            {/* Live conversion */}
            <div className="pt-2 border-t border-sky-500/20 text-[14px] font-mono flex items-center justify-between">
              <span className="text-slate-300 font-bold">Costo diario:</span>
              <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                {formatConvertedPair(dailyAdminExpense)} / día
              </span>
            </div>

            <p className="text-[14px] text-slate-300 pt-1 border-t border-white/5 font-medium leading-relaxed">
              Lo que cuesta tu estructura administrativa cada 24h para operar.
            </p>
          </div>

          {/* CARD 3: TOTAL GASTOS FIJOS (Suscripciones, Sueldos, Software) */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-purple-500/15 via-[#121820] to-[#0f141c] border-2 border-purple-500/40 space-y-2 relative overflow-hidden shadow-xl shadow-purple-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-purple-400 tracking-wider flex items-center gap-1">
                <Building2 size={14} />
                GASTOS FIJOS DEL MES
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono text-xs font-black">
                {filteredFixedExpenses.length} ACTIVOS
              </span>
            </div>

            <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
              {localFormatCurrency(totalFixedPeriod)}
            </div>

            {/* Live conversion */}
            <div className="pt-2 border-t border-purple-500/20 text-[14px] font-mono flex items-center justify-between">
              <span className="text-slate-300 font-bold">Equivalencia:</span>
              <span className="text-amber-300 font-bold">
                {formatConvertedPair(totalFixedPeriod)}
              </span>
            </div>

            <div className="flex justify-between text-[14px] font-mono text-slate-300 pt-1 border-t border-white/5 font-medium">
              <span>Diario: <strong className="text-purple-300">{localFormatCurrency(dailyFixedExpense)}/d</strong></span>
              <span>Anual: <strong className="text-slate-200">{localFormatCurrency(totalFixedPeriod * 12)}</strong></span>
            </div>
          </div>

          {/* CARD 4: GASTOS VARIABLES OPERATIVOS */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-gold/15 via-[#121820] to-[#0f141c] border-2 border-gold/40 space-y-2 relative overflow-hidden shadow-xl shadow-gold/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-gold tracking-wider flex items-center gap-1">
                <Layers size={14} />
                GASTOS VARIABLES DEL MES
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-gold/20 text-gold font-mono text-xs font-black">
                {filteredVariableExpenses.length} CONCEPTOS
              </span>
            </div>

            <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
              {localFormatCurrency(totalVariablePeriod)}
            </div>

            {/* Live conversion */}
            <div className="pt-2 border-t border-gold/20 text-[14px] font-mono flex items-center justify-between">
              <span className="text-slate-300 font-bold">Equivalencia:</span>
              <span className="text-amber-300 font-bold">
                {formatConvertedPair(totalVariablePeriod)}
              </span>
            </div>

            <div className="flex justify-between text-[14px] font-mono text-slate-300 pt-1 border-t border-white/5 font-medium">
              <span>Diario: <strong className="text-gold">{localFormatCurrency(dailyVariableExpense)}/d</strong></span>
              <span>Por venta / unidad</span>
            </div>
          </div>

        </div>

        {/* ========================================================== */}
        {/* SUBPANEL DUAL: DISTRIBUCIÓN POR CATEGORÍA & COD CALCULATOR */}
        {/* ========================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 relative z-10">
          
          {/* LEFT: CATEGORY DISTRIBUTION */}
          <div className="bg-[#121820] border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <span className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5">
                <PieChart size={14} className="text-neon" />
                Distribución del Gasto por Categoría ({selectedMonthName})
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Total: {localFormatCurrency(totalFixedPeriod)}
              </span>
            </div>

            <div className="space-y-2.5 pt-1">
              {categoryBreakdown.length > 0 ? (
                categoryBreakdown.map((item) => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-slate-300 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-neon/80" />
                        {item.category}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">{localFormatCurrency(item.amount)}</span>
                        <span className="text-[10px] text-slate-500 w-10 text-right">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-black/60 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="h-full bg-gradient-to-r from-neon to-emerald-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 py-3 text-center">No hay categorías registradas aún para este período.</p>
              )}
            </div>
          </div>

          {/* RIGHT: COD CALCULATOR ADMINISTRATIVE IMPACT */}
          <div className="bg-gradient-to-br from-[#121820] to-[#18202c] border-2 border-amber-500/30 rounded-xl p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
              <span className="text-xs font-black uppercase text-amber-300 tracking-wider flex items-center gap-1.5">
                <Calculator size={14} className="text-amber-400" />
                Imputación en Calculadora COD: Gasto Administrativo por Pedido
              </span>
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold">
                Para pricing COD
              </span>
            </div>

            <p className="text-[14px] text-slate-200 leading-relaxed">
              Para no perder dinero en tu e-commerce, cada pedido entregado debe absorber una porción de tu gasto administrativo total mensual (<strong>{localFormatCurrency(totalAdminPeriod)}</strong>).
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/50 p-3 rounded-xl border border-white/10">
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-slate-300 block">
                  Tus Pedidos Mensuales Estimados:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    value={plannedMonthlyOrders}
                    onChange={(e) => setPlannedMonthlyOrders(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 bg-[#141b24] border border-white/15 focus:border-neon rounded-lg py-1 px-2.5 text-sm font-mono font-bold text-white focus:outline-none"
                  />
                  <div className="flex gap-1">
                    {[150, 300, 500, 1000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPlannedMonthlyOrders(val)}
                        className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                          plannedMonthlyOrders === val 
                            ? 'bg-neon text-black font-bold' 
                            : 'bg-white/5 text-slate-300 hover:text-white'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Result: Cost per order */}
              <div className="text-right sm:border-l sm:border-white/10 sm:pl-4">
                <span className="text-xs uppercase font-bold text-amber-400 tracking-wider block">
                  Colocar en la Calculadora:
                </span>
                <span className="text-xl sm:text-2xl font-mono font-black text-amber-300">
                  {localFormatCurrency(costPerOrder)}
                </span>
                <span className="text-[14px] text-slate-300 font-mono block">
                  / pedido entregado
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-[14px] text-slate-300 bg-white/5 px-3 py-2 rounded-lg border border-white/5 leading-relaxed">
              <Info size={16} className="text-amber-400 shrink-0" />
              <span>
                Ingresa este valor (<strong>{localFormatCurrency(costPerOrder)}</strong>) en el campo "Administración" de tu Calculadora de Precios COD para que tu margen cubra exactamente tu infraestructura.
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* BOTÓN ÚNICO PARA REGISTRAR GASTO (Reemplaza las dos secciones separadas) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-5 rounded-2xl bg-[#0e141d] border-2 border-white/10 hover:border-neon/40 shadow-xl transition-all">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neon via-emerald-400 to-[#00df9a] text-black flex items-center justify-center font-black shadow-lg shadow-neon/20 shrink-0">
            <Plus size={24} className="stroke-[3]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h3 className="text-sm sm:text-base font-display font-black text-white uppercase tracking-wider">
                REGISTRO DE GASTOS DE PLATAFORMA
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neon/15 text-neon font-black border border-neon/30">
                Fijo o Variable
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Registra costos de software, sueldos, suscripciones o gastos operativos por unidad en un solo formulario unificado.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsRegisterOpen(true)}
          className="px-6 py-3 bg-gradient-to-r from-neon via-emerald-400 to-[#00df9a] hover:brightness-110 text-black font-black uppercase tracking-wider text-xs sm:text-sm rounded-xl shadow-xl shadow-neon/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
        >
          <Plus size={18} className="stroke-[3]" />
          <span>+ Registrar Gasto</span>
        </button>
      </div>

      {/* MODAL UNIFICADO PARA REGISTRAR GASTO (Fijo o Variable) */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[#0f141c] border-2 border-neon/40 rounded-2xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-neon/15 text-neon border border-neon/30">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-display font-black text-white uppercase tracking-wider">
                    Registrar Nuevo Gasto
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Selecciona si es un costo fijo recurrente o un gasto variable por venta.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Segmented Type Switcher */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                Tipo de Gasto a Registrar:
              </label>
              <div className="grid grid-cols-2 gap-2 bg-black/50 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setRegisterExpenseType('fixed')}
                  className={`py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    registerExpenseType === 'fixed'
                      ? 'bg-neon text-black shadow-md shadow-neon/20 font-extrabold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🔒 Gasto Fijo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRegisterExpenseType('variable')}
                  className={`py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    registerExpenseType === 'variable'
                      ? 'bg-gold text-black shadow-md shadow-gold/20 font-extrabold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>⚡ Gasto Variable</span>
                </button>
              </div>
            </div>

            {/* Form Fields: Gasto Fijo */}
            {registerExpenseType === 'fixed' ? (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                      Categoría
                    </label>
                    <select 
                      value={newFixed.category}
                      onChange={(e) => setNewFixed({...newFixed, category: e.target.value})}
                      className="w-full bg-[#141b24] border border-white/15 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-neon cursor-pointer"
                    >
                      {EXPENSE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat} className="bg-[#141b24] text-white">{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                      Nombre / Concepto
                    </label>
                    <input 
                      type="text" 
                      value={newFixed.name}
                      onChange={(e) => setNewFixed({...newFixed, name: e.target.value})}
                      placeholder="Ej: Shopify, Canva, Sueldo"
                      className="w-full bg-[#141b24] border border-white/15 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-neon font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                      Monto ({currencySymbol})
                    </label>
                    <input 
                      type="number" 
                      step="any"
                      value={newFixed.amount || ''}
                      onChange={(e) => setNewFixed({...newFixed, amount: parseFloat(e.target.value) || 0})}
                      placeholder="0.00"
                      className="w-full bg-[#141b24] border border-white/15 rounded-xl py-2 px-3 text-white font-mono text-[15px] focus:outline-none focus:border-neon font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                      Frecuencia / Ciclo
                    </label>
                    <div className="flex p-1 bg-black/50 border border-white/10 rounded-xl">
                      <button 
                        type="button"
                        onClick={() => setNewFixed({...newFixed, frequency: 'monthly'})}
                        className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                          newFixed.frequency === 'monthly' ? 'bg-neon text-black' : 'text-slate-400'
                        }`}
                      >
                        Mensual
                      </button>
                      <button 
                        type="button"
                        onClick={() => setNewFixed({...newFixed, frequency: 'yearly'})}
                        className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                          newFixed.frequency === 'yearly' ? 'bg-neon text-black' : 'text-slate-400'
                        }`}
                      >
                        Anual
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                      Fecha Inicio
                    </label>
                    <input 
                      type="date" 
                      value={newFixed.startDate}
                      onClick={(e) => {
                        try {
                          (e.target as any).showPicker?.();
                        } catch (err) {
                          console.warn('showPicker restricted:', err);
                        }
                      }}
                      onChange={(e) => setNewFixed({...newFixed, startDate: e.target.value})}
                      className="w-full bg-[#141b24] border border-white/15 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-neon [color-scheme:dark] cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                      Fecha Fin (Opcional)
                    </label>
                    <input 
                      type="date" 
                      value={newFixed.endDate}
                      onClick={(e) => {
                        try {
                          (e.target as any).showPicker?.();
                        } catch (err) {
                          console.warn('showPicker restricted:', err);
                        }
                      }}
                      onChange={(e) => setNewFixed({...newFixed, endDate: e.target.value})}
                      className="w-full bg-[#141b24] border border-white/15 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-neon [color-scheme:dark] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRegisterOpen(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-white/15 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button"
                    onClick={addExpense}
                    disabled={!newFixed.name || !newFixed.amount}
                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-neon to-emerald-400 hover:brightness-110 text-black font-black uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-neon/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check size={14} className="stroke-[3]" />
                    <span>Guardar Gasto Fijo</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Form Fields: Gasto Variable */
              <div className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                    Concepto / Gasto Variable
                  </label>
                  <input 
                    type="text" 
                    value={newVariable.name}
                    onChange={(e) => setNewVariable({...newVariable, name: e.target.value})}
                    placeholder="Ej: Empaque, Bolsa de envío, Cinta"
                    className="w-full bg-[#141b24] border border-white/15 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-gold font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                    Monto por Unidad / Venta ({currencySymbol})
                  </label>
                  <input 
                    type="number" 
                    step="any"
                    value={newVariable.amount || ''}
                    onChange={(e) => setNewVariable({...newVariable, amount: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    className="w-full bg-[#141b24] border border-white/15 rounded-xl py-2 px-3 text-white font-mono text-[15px] focus:outline-none focus:border-gold font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                      Fecha Inicio
                    </label>
                    <input 
                      type="date" 
                      value={newVariable.startDate}
                      onChange={(e) => setNewVariable({...newVariable, startDate: e.target.value})}
                      className="w-full bg-[#141b24] border border-white/15 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-gold [color-scheme:dark] cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                      Fecha Fin (Opcional)
                    </label>
                    <input 
                      type="date" 
                      value={newVariable.endDate}
                      onChange={(e) => setNewVariable({...newVariable, endDate: e.target.value})}
                      className="w-full bg-[#141b24] border border-white/15 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-gold [color-scheme:dark] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRegisterOpen(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-white/15 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button"
                    onClick={addVariableExpense}
                    disabled={!newVariable.name || !newVariable.amount}
                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-gold to-amber-400 hover:brightness-110 text-black font-black uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-gold/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check size={14} className="stroke-[3]" />
                    <span>Guardar Gasto Variable</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Excel-like Table View (History Interface) */}
      <div id="excel-table-view" className="glass-card overflow-hidden border-border/50 bg-slate-900/20">
        <div className="p-4 border-b border-border bg-card/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon/10 rounded-lg">
              <TableIcon size={18} className="text-neon" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Historial de Gastos</h3>
              <p className="text-[10px] text-slate-500 font-medium">Registro detallado de todos los costos operativos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedMonth !== 'all' && (
              <div className="flex items-center gap-1.5 bg-neon/10 border border-neon/30 px-2.5 py-1 rounded-xl text-xs font-mono text-neon font-bold">
                <span>Filtrado: {selectedMonthName}</span>
                <button
                  type="button"
                  onClick={() => setFilterTableByMonth(!filterTableByMonth)}
                  className="underline hover:text-white ml-1 cursor-pointer text-[10px]"
                >
                  {filterTableByMonth ? '(Ver todos)' : '(Aplicar filtro)'}
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon" />
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                Fijos: {displayedFixedExpenses.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gold" />
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                Variables: {displayedVariableExpenses.length}
              </span>
            </div>
            <button
              onClick={handleSave}
              className={`ml-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isSaved 
                  ? 'bg-neon text-background shadow-[0_0_15px_rgba(34,197,94,0.4)]' 
                  : 'bg-white/5 border border-border text-slate-300 hover:text-white hover:border-neon/40'
              }`}
            >
              {isSaved ? (
                <>
                  <Check size={14} className="stroke-[3]" />
                  <span>¡Sincronizado!</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Guardar</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-800/30">
                <th className="p-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-black">Tipo</th>
                <th className="p-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-black">Mes</th>
                <th className="p-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-black">Concepto / Plataforma</th>
                <th className="p-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-black">Categoría</th>
                <th className="p-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-black">Monto</th>
                <th className="p-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-black">Ciclo / Frecuencia</th>
                <th className="p-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-black">Fechas (Inicio - Fin)</th>
                <th className="p-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-black">Impacto Mensual</th>
                <th className="p-3 text-center text-[10px] uppercase tracking-widest text-slate-500 font-black">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {/* Fixed Expenses Rows */}
              {displayedFixedExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-neon/5 transition-colors group">
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-md bg-neon/10 text-neon text-[10px] font-bold uppercase">Fijo</span>
                  </td>
                  <td className="p-3">
                    {(() => {
                      const dateVal = expense.startDate;
                      const { name: monthLabel, styles: monthStyles } = getMonthDetails(dateVal);
                      return (
                        <span className={`px-2.5 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider ${monthStyles.bg} ${monthStyles.text} ${monthStyles.border}`}>
                          {monthLabel}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <input 
                        type="text"
                        value={expense.name}
                        onChange={(e) => updateExpense(expense.id, 'name', e.target.value)}
                        className="w-full bg-background border border-border rounded-lg py-1 px-2 text-sm text-white focus:outline-none focus:border-neon"
                      />
                    ) : (
                      <span className="text-sm text-white font-medium">{expense.name}</span>
                    )}
                  </td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <select 
                        value={expense.category}
                        onChange={(e) => updateExpense(expense.id, 'category', e.target.value)}
                        className="w-full bg-background border border-border rounded-lg py-1 px-2 text-sm text-white focus:outline-none focus:border-neon"
                      >
                        {EXPENSE_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-slate-400">{expense.category}</span>
                    )}
                  </td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-mono text-xs">{currencySymbol}</span>
                        <input 
                          type="number"
                          step="any"
                          value={expense.originalAmount ?? expense.amount}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateExpense(expense.id, 'amount', val);
                            updateExpense(expense.id, 'originalAmount', val);
                          }}
                          className="w-24 bg-background border border-border rounded-lg py-1 px-2 text-sm font-mono text-white focus:outline-none focus:border-neon"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-mono text-white">{localFormatCurrency(expense.amount, expense)}</span>
                        <button 
                          onClick={() => setEditingId(expense.id)}
                          className="p-1 text-slate-500 hover:text-neon transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <select 
                        value={expense.frequency}
                        onChange={(e) => updateExpense(expense.id, 'frequency', e.target.value as any)}
                        className="w-full bg-background border border-border rounded-lg py-1 px-2 text-sm text-white focus:outline-none focus:border-neon"
                      >
                        <option value="monthly">Mensual</option>
                        <option value="yearly">Anual</option>
                      </select>
                    ) : (
                      <span className="text-sm text-slate-400 uppercase tracking-tighter">
                        {expense.frequency === 'monthly' ? 'Mensual' : 'Anual'}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <div className="flex items-center gap-2">
                        <input 
                          type="date"
                          value={expense.startDate}
                          onClick={(e) => {
                            try {
                              (e.target as any).showPicker?.();
                            } catch (err) {
                              console.warn('showPicker restricted in this environment:', err);
                            }
                          }}
                          onChange={(e) => updateExpense(expense.id, 'startDate', e.target.value)}
                          className="bg-background border border-border rounded-lg py-1 px-2 text-[11px] text-white focus:outline-none focus:border-neon [color-scheme:dark]"
                        />
                        <input 
                          type="date"
                          value={expense.endDate}
                          onClick={(e) => {
                            try {
                              (e.target as any).showPicker?.();
                            } catch (err) {
                              console.warn('showPicker restricted in this environment:', err);
                            }
                          }}
                          onChange={(e) => updateExpense(expense.id, 'endDate', e.target.value)}
                          className="bg-background border border-border rounded-lg py-1 px-2 text-[11px] text-white focus:outline-none focus:border-neon [color-scheme:dark]"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                        <span>{expense.startDate}</span>
                        {expense.endDate && (
                          <>
                            <span className="text-slate-700">-</span>
                            <span>{expense.endDate}</span>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-[15px] font-mono text-neon font-bold">
                    {localFormatCurrency(expense.frequency === 'monthly' ? expense.amount : expense.amount / 12, expense)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => setEditingId(editingId === expense.id ? null : expense.id)}
                        className={`p-1.5 transition-colors ${editingId === expense.id ? 'text-green-500 hover:text-green-400' : 'text-slate-600 hover:text-neon'}`}
                        title={editingId === expense.id ? "Guardar" : "Editar"}
                      >
                        {editingId === expense.id ? <Check size={14} /> : <Edit2 size={14} />}
                      </button>
                      <button 
                        onClick={() => removeExpense(expense.id)}
                        className="p-1.5 text-slate-600 hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {/* Variable Expenses Rows */}
              {displayedVariableExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gold/5 transition-colors group">
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-md bg-gold/10 text-gold text-[10px] font-bold uppercase">Variable</span>
                  </td>
                  <td className="p-3">
                    {(() => {
                      const dateVal = expense.startDate;
                      const { name: monthLabel, styles: monthStyles } = getMonthDetails(dateVal);
                      return (
                        <span className={`px-2.5 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider ${monthStyles.bg} ${monthStyles.text} ${monthStyles.border}`}>
                          {monthLabel}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <input 
                        type="text"
                        value={expense.name}
                        onChange={(e) => updateVariableExpense(expense.id, 'name', e.target.value)}
                        className="w-full bg-background border border-border rounded-lg py-1 px-2 text-sm text-white focus:outline-none focus:border-gold"
                      />
                    ) : (
                      <span className="text-sm text-white font-medium">{expense.name}</span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-slate-500 italic">Costo por Unidad</td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-mono text-xs">{currencySymbol}</span>
                        <input 
                          type="number"
                          step="any"
                          value={expense.originalAmount ?? expense.amount}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateVariableExpense(expense.id, 'amount', val);
                            updateVariableExpense(expense.id, 'originalAmount', val);
                          }}
                          className="w-24 bg-background border border-border rounded-lg py-1 px-2 text-sm font-mono text-white focus:outline-none focus:border-gold"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-mono text-white">{localFormatCurrency(expense.amount, expense)}</span>
                        <button 
                          onClick={() => setEditingId(expense.id)}
                          className="p-1 text-slate-500 hover:text-gold transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-sm text-slate-500 uppercase tracking-tighter">Por Venta</td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <div className="flex items-center gap-2">
                        <input 
                          type="date"
                          value={expense.startDate}
                          onChange={(e) => updateVariableExpense(expense.id, 'startDate', e.target.value)}
                          className="bg-background border border-border rounded-lg py-1 px-2 text-[11px] text-white focus:outline-none focus:border-gold [color-scheme:dark]"
                        />
                        <input 
                          type="date"
                          value={expense.endDate}
                          onChange={(e) => updateVariableExpense(expense.id, 'endDate', e.target.value)}
                          className="bg-background border border-border rounded-lg py-1 px-2 text-[11px] text-white focus:outline-none focus:border-gold [color-scheme:dark]"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                        <span>{expense.startDate}</span>
                        {expense.endDate && (
                          <>
                            <span className="text-slate-700">-</span>
                            <span>{expense.endDate}</span>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-[15px] font-mono text-gold font-bold">
                    {localFormatCurrency(expense.amount, expense)} <span className="text-[10px] text-slate-500 font-normal">(Unitario)</span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => setEditingId(editingId === expense.id ? null : expense.id)}
                        className={`p-1.5 transition-colors ${editingId === expense.id ? 'text-green-500 hover:text-green-400' : 'text-slate-600 hover:text-gold'}`}
                        title={editingId === expense.id ? "Guardar" : "Editar"}
                      >
                        {editingId === expense.id ? <Check size={14} /> : <Edit2 size={14} />}
                      </button>
                      <button 
                        onClick={() => removeVariableExpense(expense.id)}
                        className="p-1.5 text-slate-600 hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {displayedFixedExpenses.length === 0 && displayedVariableExpenses.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <TableIcon size={40} className="text-slate-700" />
                      <p className="text-slate-400 uppercase tracking-widest font-bold text-xs">
                        {selectedMonth !== 'all' && filterTableByMonth 
                          ? `No hay gastos registrados para ${selectedMonthName}` 
                          : 'No hay gastos en el historial'}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        {selectedMonth !== 'all' && filterTableByMonth
                          ? 'Haz clic en "Todos los Meses" o agrega un gasto asignado a este mes'
                          : 'Utiliza los formularios superiores para registrar nuevos gastos'}
                      </p>
                      {selectedMonth !== 'all' && filterTableByMonth && (
                        <button
                          type="button"
                          onClick={() => setSelectedMonth('all')}
                          className="px-3 py-1.5 rounded-lg bg-neon/10 hover:bg-neon/20 border border-neon/30 text-neon text-xs font-bold transition-all cursor-pointer"
                        >
                          Ver todos los meses
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {(displayedFixedExpenses.length > 0 || displayedVariableExpenses.length > 0) && (
              <tfoot>
                <tr className="bg-card/50 border-t border-border font-bold">
                  <td colSpan={7} className="p-3 text-right text-[11px] uppercase tracking-widest text-slate-400">
                    Total Administrativo ({selectedMonth !== 'all' && filterTableByMonth ? selectedMonthName : 'Fijos Acumulados'}):
                  </td>
                  <td className="p-3 text-[15px] font-mono text-neon font-black">
                    {localFormatCurrency(selectedMonth !== 'all' && filterTableByMonth ? totalAdminPeriod : totalMonthlyFixed)}
                  </td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default PlatformExpenses;
