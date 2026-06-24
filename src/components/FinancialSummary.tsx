import React, { useMemo, useRef, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  FileText, 
  Download, 
  ChevronDown, 
  ArrowUp, 
  Edit2, 
  Check, 
  X, 
  RefreshCw, 
  AlertCircle, 
  Sparkles,
  Calendar,
  Layers,
  Save,
  Undo2
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isFirebaseConfigValid } from '../firebase';
import { useAuth } from './Auth';
import { Order, calculateOrderProfit, CurrencyCode, CURRENCIES } from '../mockData';

interface FinancialSummaryProps {
  orders: Order[];
  formatCurrency: (amount: number) => string;
  currency?: CurrencyCode;
  currencies?: any;
  isConversionActive?: boolean;
}

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
  { value: '12', label: 'Diciembre' }
];

const FinancialSummary: React.FC<FinancialSummaryProps> = ({ 
  orders, 
  formatCurrency, 
  currency = 'USD', 
  currencies = {}, 
  isConversionActive = false 
}) => {
  const { user, isDemoMode } = useAuth();
  
  // Mobile / responsive context
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const rate = useMemo(() => {
    return currencies[currency]?.rate || CURRENCIES[currency]?.rate || 1;
  }, [currencies, currency]);

  const currencySymbol = useMemo(() => {
    return currencies[currency]?.symbol || CURRENCIES[currency]?.symbol || '$';
  }, [currencies, currency]);

  // Convert USD from DB to display currency
  const fromUSD = (amount: number) => {
    const isUSD = !isConversionActive;
    if (isUSD) return amount;
    return amount * rate;
  };

  // Convert display currency back to USD for DB persistence
  const toUSD = (amount: number) => {
    const isUSD = !isConversionActive;
    if (isUSD) return amount;
    return amount / rate;
  };

  const localFormatCurrency = (amount: number) => {
    const targetCurrency = isConversionActive ? currency : 'USD';
    const rounded = Math.round(amount * 100) / 100;
    
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: targetCurrency,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(rounded);
  };

  const topRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Default to latest order's month or current calendar month
  const defaultYearMonth = useMemo(() => {
    if (orders.length > 0) {
      const dates = orders.map(o => o.date).filter(Boolean);
      if (dates.length > 0) {
        const latest = new Date(Math.max(...dates.map(d => d.getTime())));
        return {
          year: latest.getFullYear().toString(),
          month: String(latest.getMonth() + 1).padStart(2, '0')
        };
      }
    }
    const now = new Date();
    return {
      year: now.getFullYear().toString(),
      month: String(now.getMonth() + 1).padStart(2, '0')
    };
  }, [orders]);

  const [selectedYear, setSelectedYear] = useState(defaultYearMonth.year);
  const [selectedMonth, setSelectedMonth] = useState(defaultYearMonth.month);

  useEffect(() => {
    setSelectedYear(defaultYearMonth.year);
    setSelectedMonth(defaultYearMonth.month);
  }, [defaultYearMonth]);

  const monthKey = `${selectedYear}-${selectedMonth}`;

  // Filter orders by selected month/year
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const d = o.date;
      if (!d) return false;
      const yr = d.getFullYear().toString();
      const mth = String(d.getMonth() + 1).padStart(2, '0');
      return yr === selectedYear && mth === selectedMonth;
    });
  }, [orders, selectedYear, selectedMonth]);

  // Advertising Expense local description matching schemas
  const [adExpenses, setAdExpenses] = useState<{
    id: string;
    uid: string;
    productId: string;
    productName: string;
    date: string;
    platform: string;
    amount: number;
    timestamp: number;
  }[]>([]);

  // Firestore sync for advertising expenses
  useEffect(() => {
    if (!user || isDemoMode || !isFirebaseConfigValid) {
      // Offline/Demo mock expenses to populate nicely
      const demoData = [
        { id: '1', uid: 'demo', productId: 'p1', productName: 'Producto A', date: `${selectedYear}-${selectedMonth}-05`, platform: 'Facebook Ads', amount: 150, timestamp: Date.now() },
        { id: '2', uid: 'demo', productId: 'p2', productName: 'Producto B', date: `${selectedYear}-${selectedMonth}-12`, platform: 'TikTok Ads', amount: 80, timestamp: Date.now() },
        { id: '3', uid: 'demo', productId: 'p3', productName: 'Producto C', date: `${selectedYear}-${selectedMonth}-18`, platform: 'Google Ads', amount: 120, timestamp: Date.now() }
      ];
      setAdExpenses(demoData);
      return;
    }

    const q = query(collection(db, 'ad_expenses'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        } as any;
      });
      setAdExpenses(expensesData);
    }, (error) => {
      console.warn("Error reading ad expenses for P&L:", error);
    });

    return () => unsubscribe();
  }, [user, isDemoMode, selectedYear, selectedMonth]);

  // Explainer details for transparent automatic system data sources
  const systemExplainer = useMemo(() => {
    let deliveredCount = 0;
    let shippedCount = 0;
    let returnedCount = 0;
    let totalCount = filteredOrders.length;
    let adsCount = 0;
    
    filteredOrders.forEach(o => {
      if (o.status === 'Entregado') deliveredCount++;
      if (o.status !== 'Cancelado') shippedCount++;
      if (o.status === 'Devuelto') returnedCount++;
    });

    const monthPrefix = `${selectedYear}-${selectedMonth}`;
    const monthlyAdExpenses = adExpenses.filter(e => e.date && e.date.startsWith(monthPrefix));
    adsCount = monthlyAdExpenses.length;

    const usingAdExpenses = adsCount > 0;

    return {
      deliveredCount,
      shippedCount,
      returnedCount,
      totalCount,
      adsCount,
      usingAdExpenses
    };
  }, [filteredOrders, adExpenses, selectedYear, selectedMonth]);

  // System raw calculations for selected month in USD (Direct integration with Dropi uploads)
  const systemCalculatedDataUSD = useMemo(() => {
    let revenue = 0;
    let cogs = 0;
    let shipping = 0;
    let ads = 0;
    let fees = 0;
    let returnsLoss = 0;

    filteredOrders.forEach(o => {
      // In Dropi / ecommerce logic:
      // Revenue is only accounted for delivered orders ('Entregado')
      const isDelivered = o.status === 'Entregado';
      
      if (isDelivered) {
        revenue += o.price;
        cogs += o.cost;
      }
      
      if (o.status !== 'Cancelado') {
        shipping += o.shippingReal;
        
        // Exact platform fee / comision from Dropi orders if available
        const comisionVal = Number(o.comision || 0);
        if (comisionVal > 0) {
          fees += comisionVal;
        } else {
          fees += o.price * (o.platformFee || 0);
        }
      }
      
      if (o.status === 'Devuelto') {
        const returnPenalty = Math.abs(Number(o.costoDevolucionFlete || 0));
        // Use real return freight cost if supplied, else use standard fallback
        returnsLoss += returnPenalty > 0 ? returnPenalty : (o.shippingReal > 0 ? o.shippingReal * 0.5 : 3.88);
      }
    });

    // Extract real recorded advertisement platform expenses if logged, else fallback to order fields
    const monthPrefix = `${selectedYear}-${selectedMonth}`;
    const monthlyAdExpenses = adExpenses.filter(e => e.date && e.date.startsWith(monthPrefix));
    
    if (monthlyAdExpenses.length > 0) {
      ads = monthlyAdExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    } else {
      // Fallback: sum of order ads cost
      ads = filteredOrders.reduce((sum, o) => sum + (o.adsCost || 0), 0);
    }

    return { revenue, cogs, shipping, ads, fees, returnsLoss };
  }, [filteredOrders, adExpenses, selectedYear, selectedMonth]);

  // Load Overrides state
  const [overrides, setOverrides] = useState<Record<string, {
    revenue: number; // Stored in USD
    cogs: number; // Stored in USD
    shipping: number; // Stored in USD
    ads: number; // Stored in USD
    fees: number; // Stored in USD
    returnsLoss: number; // Stored in USD
  }>>({});
  const [loadingOverrides, setLoadingOverrides] = useState(true);

  // Firestore sync for overrides
  useEffect(() => {
    // Load local storage fallback immediately
    const localData: Record<string, any> = {};
    try {
      const savedKeys = Object.keys(localStorage).filter(k => k.startsWith('profit_os_pnl_ov_'));
      savedKeys.forEach(k => {
        const mKey = k.replace('profit_os_pnl_ov_', '');
        localData[mKey] = JSON.parse(localStorage.getItem(k) || '');
      });
      setOverrides(localData);
    } catch (e) {
      console.warn("Could not read local overrides:", e);
    }

    if (!user || isDemoMode || !isFirebaseConfigValid) {
      setLoadingOverrides(false);
      return;
    }

    const q = query(collection(db, 'financialOverrides'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreData: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.monthKey) {
          firestoreData[data.monthKey] = {
            id: doc.id,
            revenue: Number(data.revenue ?? 0),
            cogs: Number(data.cogs ?? 0),
            shipping: Number(data.shipping ?? 0),
            ads: Number(data.ads ?? 0),
            fees: Number(data.fees ?? 0),
            returnsLoss: Number(data.returnsLoss ?? 0),
          };
        }
      });

      // Keep both local storage and database synced
      setOverrides(prev => ({ ...prev, ...firestoreData }));
      setLoadingOverrides(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'financialOverrides');
      setLoadingOverrides(false);
    });

    return () => unsubscribe();
  }, [user, isDemoMode]);

  // Values in display currency (USD or active rate)
  const activeData = useMemo(() => {
    const override = overrides[monthKey];
    const isOverridden = !!override;
    const base = override || systemCalculatedDataUSD;

    // Convert base USD values to active display currency
    const revenue = fromUSD(base.revenue);
    const cogs = fromUSD(base.cogs);
    const shipping = fromUSD(base.shipping);
    const ads = fromUSD(base.ads);
    const fees = fromUSD(base.fees);
    const returnsLoss = fromUSD(base.returnsLoss);

    const grossProfit = revenue - cogs;
    const ebitda = grossProfit - shipping - ads - fees - returnsLoss;

    return {
      revenue,
      cogs,
      shipping,
      ads,
      fees,
      returnsLoss,
      grossProfit,
      ebitda,
      isOverridden
    };
  }, [monthKey, overrides, systemCalculatedDataUSD, rate, isConversionActive]);

  // Local editing states (maintained in display currency for the user's convenience)
  const [isEditing, setIsEditing] = useState(false);
  const [editedRevenue, setEditedRevenue] = useState(0);
  const [editedCogs, setEditedCogs] = useState(0);
  const [editedShipping, setEditedShipping] = useState(0);
  const [editedAds, setEditedAds] = useState(0);
  const [editedPlatformFees, setEditedPlatformFees] = useState(0);
  const [editedReturnsLoss, setEditedReturnsLoss] = useState(0);

  // Sync inputs with active month details whenever the selected month or edit status triggers
  useEffect(() => {
    setEditedRevenue(Math.round(activeData.revenue * 100) / 100);
    setEditedCogs(Math.round(activeData.cogs * 100) / 100);
    setEditedShipping(Math.round(activeData.shipping * 100) / 100);
    setEditedAds(Math.round(activeData.ads * 100) / 100);
    setEditedPlatformFees(Math.round(activeData.fees * 100) / 100);
    setEditedReturnsLoss(Math.round(activeData.returnsLoss * 100) / 100);
  }, [activeData, isEditing]);

  const [saving, setSaving] = useState(false);

  const handleStartEdit = () => {
    setEditedRevenue(Math.round(activeData.revenue * 100) / 100);
    setEditedCogs(Math.round(activeData.cogs * 100) / 100);
    setEditedShipping(Math.round(activeData.shipping * 100) / 100);
    setEditedAds(Math.round(activeData.ads * 100) / 100);
    setEditedPlatformFees(Math.round(activeData.fees * 100) / 100);
    setEditedReturnsLoss(Math.round(activeData.returnsLoss * 100) / 100);
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    // Values converted back to USD base for general database consistency
    const saveObjUSD = {
      revenue: toUSD(Number(editedRevenue)),
      cogs: toUSD(Number(editedCogs)),
      shipping: toUSD(Number(editedShipping)),
      ads: toUSD(Number(editedAds)),
      fees: toUSD(Number(editedPlatformFees)),
      returnsLoss: toUSD(Number(editedReturnsLoss))
    };

    try {
      // 1. Save to Local Storage
      localStorage.setItem(`profit_os_pnl_ov_${monthKey}`, JSON.stringify(saveObjUSD));

      // 2. Save to Firestore if connected
      if (user && !isDemoMode && isFirebaseConfigValid) {
        const docId = `override_${monthKey}_${user.uid}`;
        await setDoc(doc(db, 'financialOverrides', docId), {
          uid: user.uid,
          monthKey,
          ...saveObjUSD,
          updatedAt: Date.now()
        }, { merge: true });
      }

      // Update local state directly so UI reacts even in offline/demo mode
      setOverrides(prev => ({
        ...prev,
        [monthKey]: saveObjUSD
      }));

      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'financialOverrides');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToSystem = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar los cambios personalizados y volver a los valores calculados del sistema para este mes?')) {
      return;
    }

    setSaving(true);
    try {
      // 1. Remove from Local Storage
      localStorage.removeItem(`profit_os_pnl_ov_${monthKey}`);

      // 2. Remove from Firestore if connected
      if (user && !isDemoMode && isFirebaseConfigValid) {
        const docId = `override_${monthKey}_${user.uid}`;
        await deleteDoc(doc(db, 'financialOverrides', docId));
      }

      // Update local overrides state
      setOverrides(prev => {
        const updated = { ...prev };
        delete updated[monthKey];
        return updated;
      });

      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'financialOverrides');
    } finally {
      setSaving(false);
    }
  };

  // Real-time live data for chart rendering (incorporating user edits on-the-fly)
  const chartData = useMemo(() => {
    const rev = isEditing ? Number(editedRevenue) : activeData.revenue;
    const cog = isEditing ? Number(editedCogs) : activeData.cogs;
    const ship = isEditing ? Number(editedShipping) : activeData.shipping;
    const ad = isEditing ? Number(editedAds) : activeData.ads;
    const fe = isEditing ? Number(editedPlatformFees) : activeData.fees;
    const ret = isEditing ? Number(editedReturnsLoss) : activeData.returnsLoss;

    return [
      { name: 'Ingresos', value: rev, color: '#00ff88' },
      { name: 'COGS', value: -cog, color: '#f5c842' },
      { name: 'Fletes', value: -ship, color: '#3b82f6' },
      { name: 'Ads', value: -ad, color: '#8b5cf6' },
      { name: 'Comisiones', value: -fe, color: '#64748b' },
      { name: 'Devoluciones', value: -ret, color: '#ef4444' },
    ];
  }, [isEditing, editedRevenue, editedCogs, editedShipping, editedAds, editedPlatformFees, editedReturnsLoss, activeData]);

  // Live P&L derived results
  const liveGrossProfit = isEditing ? (Number(editedRevenue) - Number(editedCogs)) : activeData.grossProfit;
  const liveNetProfit = isEditing ? 
    (liveGrossProfit - Number(editedShipping) - Number(editedAds) - Number(editedPlatformFees) - Number(editedReturnsLoss)) : 
    activeData.ebitda;

  const currentMonthLabel = MONTH_NAMES.find(m => m.value === selectedMonth)?.label || 'Marzo';

  return (
    <div className="space-y-8">
      <div ref={topRef} />
      
      {/* Header section with Select and Config labels */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-950 border border-slate-900 rounded-2xl">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <FileText size={24} className="text-neon" />
            Resumen Financiero Mensual P&L
          </h2>
          <p className="text-[14px] text-slate-500 mt-1">Crea, edita, y guarda el estado de resultados consolidado de tu negocio por mes</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Calendar Select Month */}
          <div className="flex items-center gap-2 bg-black border border-slate-800 rounded-xl px-3 py-2">
            <Calendar size={15} className="text-neon" />
            <select 
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setIsEditing(false); // reset edit status on month change to load saved values
              }}
              className="bg-transparent border-none text-white text-[14px] font-bold outline-none cursor-pointer pr-1"
            >
              {MONTH_NAMES.map(m => (
                <option key={m.value} value={m.value} className="bg-black text-white">
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Calendar Select Year */}
          <div className="flex items-center gap-2 bg-black border border-slate-800 rounded-xl px-3 py-2">
            <select 
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setIsEditing(false);
              }}
              className="bg-transparent border-none text-white text-[14px] font-bold outline-none cursor-pointer"
            >
              <option value="2024" className="bg-black text-white">2024</option>
              <option value="2025" className="bg-black text-white">2025</option>
              <option value="2026" className="bg-black text-white">2026</option>
              <option value="2027" className="bg-black text-white">2027</option>
            </select>
          </div>

          {/* Source indicator tag */}
          {activeData.isOverridden ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Sparkles size={14} className="animate-spin" style={{ animationDuration: '6s' }} />
              DATO MANUAL
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Layers size={14} />
              DATO SISTEMA
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* P&L Statement Table with Inline Inputs */}
        <div className="lg:col-span-2 glass-card overflow-hidden bg-black border border-slate-900 rounded-2xl">
          <div className="p-6 border-b border-slate-900 bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-display font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                <FileText size={16} className="text-neon" /> Profit & Loss Statement (P&L)
              </h3>
              <p className="text-xs text-slate-500 font-mono text-left uppercase mt-0.5">
                {currentMonthLabel} {selectedYear}
              </p>
            </div>
            
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {!isEditing ? (
                <>
                  <button 
                    onClick={handleStartEdit}
                    className="flex items-center gap-2 px-3 py-1.5 bg-neon hover:bg-neon/90 text-black font-bold text-sm rounded-lg transition-all"
                  >
                    <Edit2 size={14} /> Editar Valores
                  </button>
                  {activeData.isOverridden && (
                    <button 
                      onClick={handleResetToSystem}
                      className="flex items-center gap-2 px-3 py-1.5 border border-red-500/40 text-red-400 hover:bg-red-500/10 text-sm rounded-lg font-bold transition-all"
                    >
                      <Undo2 size={14} /> Resetear
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-sm rounded-lg transition-all"
                  >
                    {saving ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    Guardar
                  </button>
                  <button 
                    onClick={() => setIsEditing(false)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-800 text-slate-400 hover:bg-slate-900 text-sm rounded-lg font-bold transition-all"
                  >
                    <X size={14} /> Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="p-6 space-y-5">
            
            {/* INGRESO ROW */}
            <div className="flex justify-between items-start py-2 border-b border-slate-900 gap-4">
              <div>
                <span className="text-base text-slate-300 block text-left">Ingresos Totales (Ventas)</span>
                <span className="text-[11px] text-slate-500 font-mono block text-left">
                  Suma de {systemExplainer.deliveredCount} pedidos &quot;Entregado&quot; para este mes
                </span>
              </div>
              {isEditing ? (
                <div className="flex items-center bg-black border border-slate-700 focus-within:border-neon rounded-lg px-2.5 py-1 max-w-[190px] w-full transition-all shrink-0">
                  <span className="text-slate-500 font-mono text-sm mr-1">{currencySymbol}</span>
                  <input 
                    type="number"
                    value={editedRevenue}
                    onChange={(e) => setEditedRevenue(Number(e.target.value))}
                    className="bg-transparent text-right outline-none text-white font-mono w-full text-base"
                    placeholder="0"
                  />
                </div>
              ) : (
                <span className="text-base font-mono font-bold text-emerald-400 shrink-0">
                  {localFormatCurrency(activeData.revenue)}
                </span>
              )}
            </div>

            {/* COGS ROW */}
            <div className="flex justify-between items-start py-2 border-b border-slate-900 gap-4">
              <div>
                <span className="text-base text-slate-400 block text-left">(-) Costo de Mercadería (COGS)</span>
                <span className="text-[11px] text-slate-500 font-mono block text-left">
                  Costo de importación/compra de {systemExplainer.deliveredCount} pedidos entregados
                </span>
              </div>
              {isEditing ? (
                <div className="flex items-center bg-black border border-slate-700 focus-within:border-red-500 rounded-lg px-2.5 py-1 max-w-[190px] w-full transition-all shrink-0">
                  <span className="text-slate-500 font-mono text-sm mr-1">{currencySymbol}</span>
                  <input 
                    type="number"
                    value={editedCogs}
                    onChange={(e) => setEditedCogs(Number(e.target.value))}
                    className="bg-transparent text-right outline-none text-white font-mono w-full text-base"
                    placeholder="0"
                  />
                </div>
              ) : (
                <span className="text-base font-mono text-red-500 shrink-0">
                  ({localFormatCurrency(activeData.cogs)})
                </span>
              )}
            </div>

            {/* GROSS PROFIT ROW (CALCULATED LIVE) */}
            <div className="flex justify-between items-center py-3 bg-neon/5 px-4 rounded-xl border border-neon/10">
              <span className="text-base font-bold text-neon">Utilidad Bruta</span>
              <span className="text-base font-mono font-bold text-neon">
                {localFormatCurrency(liveGrossProfit)}
              </span>
            </div>
            
            {/* GASTOS BREAKDOWN */}
            <div className="space-y-4 pt-4 border-t border-dashed border-slate-900">
              
              {/* SHIPPING cost */}
              <div className="flex justify-between items-start py-1 gap-4">
                <div>
                  <span className="text-base text-slate-400 block text-left">(-) Gastos de Envío (Fletes)</span>
                  <span className="text-[11px] text-slate-500 font-mono block text-left">
                    Fletes reales de transportadoras para {systemExplainer.shippedCount} despachos reales
                  </span>
                </div>
                {isEditing ? (
                  <div className="flex items-center bg-black border border-slate-700 focus-within:border-neon rounded-lg px-2.5 py-1 max-w-[190px] w-full transition-all shrink-0">
                    <span className="text-slate-500 font-mono text-sm mr-1">{currencySymbol}</span>
                    <input 
                      type="number"
                      value={editedShipping}
                      onChange={(e) => setEditedShipping(Number(e.target.value))}
                      className="bg-transparent text-right outline-none text-white font-mono w-full text-base"
                      placeholder="0"
                    />
                  </div>
                ) : (
                  <span className="text-base font-mono text-slate-300 shrink-0">
                    {localFormatCurrency(activeData.shipping)}
                  </span>
                )}
              </div>

              {/* OUTWARD MARKETING ETC */}
              <div className="flex justify-between items-start py-1 gap-4">
                <div>
                  <span className="text-base text-slate-400 block text-left">(-) Inversión Ads & Marketing</span>
                  <span className="text-[11px] text-slate-500 font-mono block text-left">
                    {systemExplainer.usingAdExpenses 
                      ? `Sumatoria de ${systemExplainer.adsCount} registros en sección campañas de Ads`
                      : `Suma de costos de publicidad de pedidos cargados`}
                  </span>
                </div>
                {isEditing ? (
                  <div className="flex items-center bg-black border border-slate-700 focus-within:border-neon rounded-lg px-2.5 py-1 max-w-[190px] w-full transition-all shrink-0">
                    <span className="text-slate-500 font-mono text-sm mr-1">{currencySymbol}</span>
                    <input 
                      type="number"
                      value={editedAds}
                      onChange={(e) => setEditedAds(Number(e.target.value))}
                      className="bg-transparent text-right outline-none text-white font-mono w-full text-base"
                      placeholder="0"
                    />
                  </div>
                ) : (
                  <span className="text-base font-mono text-slate-300 shrink-0">
                    {localFormatCurrency(activeData.ads)}
                  </span>
                )}
              </div>

              {/* PLATFORM COMMISSIONS */}
              <div className="flex justify-between items-start py-1 gap-4">
                <div>
                  <span className="text-base text-slate-400 block text-left">(-) Comisiones de Plataforma</span>
                  <span className="text-[11px] text-slate-500 font-mono block text-left">
                    Comisión de vendedor y costos tecnológicos cobrados por Dropi / pasarelas
                  </span>
                </div>
                {isEditing ? (
                  <div className="flex items-center bg-black border border-slate-700 focus-within:border-neon rounded-lg px-2.5 py-1 max-w-[190px] w-full transition-all shrink-0">
                    <span className="text-slate-500 font-mono text-sm mr-1">{currencySymbol}</span>
                    <input 
                      type="number"
                      value={editedPlatformFees}
                      onChange={(e) => setEditedPlatformFees(Number(e.target.value))}
                      className="bg-transparent text-right outline-none text-white font-mono w-full text-base"
                      placeholder="0"
                    />
                  </div>
                ) : (
                  <span className="text-base font-mono text-slate-300 shrink-0">
                    {localFormatCurrency(activeData.fees)}
                  </span>
                )}
              </div>

              {/* LOGISTICA DE DEVOLUCIONES */}
              <div className="flex justify-between items-start py-1 gap-4">
                <div>
                  <span className="text-base text-slate-400 block text-left">(-) Logística de Devoluciones</span>
                  <span className="text-[11px] text-slate-500 font-mono block text-left">
                    Flete de devolución de {systemExplainer.returnedCount} pedidos con novedad o devueltos
                  </span>
                </div>
                {isEditing ? (
                  <div className="flex items-center bg-black border border-slate-700 focus-within:border-neon rounded-lg px-2.5 py-1 max-w-[190px] w-full transition-all shrink-0">
                    <span className="text-slate-500 font-mono text-sm mr-1">{currencySymbol}</span>
                    <input 
                      type="number"
                      value={editedReturnsLoss}
                      onChange={(e) => setEditedReturnsLoss(Number(e.target.value))}
                      className="bg-transparent text-right outline-none text-white font-mono w-full text-base"
                      placeholder="0"
                    />
                  </div>
                ) : (
                  <span className="text-base font-mono text-slate-300 shrink-0">
                    {localFormatCurrency(activeData.returnsLoss)}
                  </span>
                )}
              </div>
            </div>

            {/* EBITDA / FINAL REAL NET PROFIT (CALCULATED LIVE) */}
            <div className={`mt-6 p-6 rounded-xl flex justify-between items-center transition-all ${
              liveNetProfit >= 0 
                ? 'bg-positive-green-10 border border-emerald-500/20' 
                : 'bg-negative-red-10 border border-red-500/20'
            }`}>
              <div>
                <p className={`text-[12px] uppercase tracking-widest font-bold mb-1 ${
                  liveNetProfit >= 0 ? 'text-positive-green' : 'text-negative-red'
                }`}>Resultado Neto Final</p>
                <p className={`text-3xl font-mono font-bold ${
                  liveNetProfit >= 0 ? 'text-positive-green' : 'text-negative-red'
                }`}>
                  {localFormatCurrency(liveNetProfit)}
                </p>
              </div>
              <div className="text-right">
                <div className={`flex items-center gap-1 text-[15px] font-mono font-bold mb-1 ${
                  liveNetProfit >= 0 ? 'text-positive-green' : 'text-negative-red'
                }`}>
                  {liveNetProfit >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  {liveNetProfit !== 0 && Number(editedRevenue) > 0 ? (
                    `${Math.round((liveNetProfit / (isEditing ? Number(editedRevenue) : activeData.revenue)) * 1000) / 10}%`
                  ) : '0%'}
                </div>
                <p className="text-[11px] text-slate-500 uppercase font-mono">Margen de Ventas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Expense Structure Visualizer Bar Chart */}
        <div className="glass-card p-6 bg-black border border-slate-900 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-display font-bold text-white mb-1 uppercase tracking-wider">Estructura de Costos</h3>
            <p className="text-xs text-slate-500 mb-6 font-mono">Resumen visual de este periodo</p>
            
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#101015" horizontal={false} vertical={true} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    stroke="#475569" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    width={85}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                    contentStyle={{ backgroundColor: '#000000', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '13px', fontFamily: 'DM Mono' }}
                    formatter={(value: number) => localFormatCurrency(Math.abs(value))}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-slate-900 space-y-4 font-mono text-[13px]">
            <div className="flex justify-between text-slate-500">
              <span>Ingresos Totales:</span>
              <span className="text-white font-bold">{localFormatCurrency(isEditing ? Number(editedRevenue) : activeData.revenue)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Gastos Totales:</span>
              <span className="text-red-400">
                {localFormatCurrency(
                  (isEditing ? Number(editedCogs) : activeData.cogs) +
                  (isEditing ? Number(editedShipping) : activeData.shipping) +
                  (isEditing ? Number(editedAds) : activeData.ads) +
                  (isEditing ? Number(editedPlatformFees) : activeData.fees) +
                  (isEditing ? Number(editedReturnsLoss) : activeData.returnsLoss)
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Scroll to Top */}
      <button 
        onClick={scrollToTop}
        className="fixed bottom-8 right-8 p-3 bg-neon text-background rounded-full shadow-2xl shadow-neon/40 hover:scale-110 active:scale-95 transition-all z-50 duration-200"
      >
        <ArrowUp size={24} />
      </button>
    </div>
  );
};

export default FinancialSummary;
