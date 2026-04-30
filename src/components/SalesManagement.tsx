import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Plus, 
  Trash2, 
  Calendar, 
  DollarSign, 
  PieChart as PieChartIcon, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight,
  Target,
  Wallet,
  Briefcase,
  Megaphone,
  CreditCard,
  Edit2,
  Save,
  X,
  LayoutGrid,
  Table as TableIcon,
  Search,
  ShoppingCart,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isFirebaseConfigValid } from '../firebase';
import { useAuth } from './Auth';
import { CurrencyCode } from '../mockData';

interface SalePeriod {
  id: string;
  uid: string;
  month: string;
  startDate: string;
  endDate: string;
  withdrawalDropi: number;
  withdrawalBankName?: string;
  commission: number;
  withdrawalBank: number;
  adsSpend: number;
  platformExpenses: number;
  shopifyOrders?: number;
  cancelledOrders?: number;
  dropiOrders?: number;
  tiktokOrders?: number;
  dropiCancelled?: number;
  returnedOrders?: number;
  deliveredOrders?: number;
  tags?: string;
  notes: string;
  createdAt?: any;
  updatedAt?: any;
}

interface SalesManagementProps {
  formatCurrency: (amount: number) => string;
  currency: CurrencyCode;
  isConversionActive?: boolean;
  currencies?: Record<CurrencyCode, { rate: number; symbol: string; name: string }>;
}

const SalesManagement: React.FC<SalesManagementProps> = ({ 
  formatCurrency, 
  currency,
  isConversionActive = false,
  currencies = {}
}) => {
  const { user, isDemoMode } = useAuth();
  const [periods, setPeriods] = useState<SalePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('salesViewMode') as 'grid' | 'table') || 'grid';
  });
  const [activeTab, setActiveTab] = useState<'finance' | 'orders'>('finance');
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Persist view mode
  useEffect(() => {
    localStorage.setItem('salesViewMode', viewMode);
  }, [viewMode]);
  
  const [formData, setFormData] = useState<any>({
    month: '',
    startDate: '',
    endDate: '',
    withdrawalDropi: 0,
    withdrawalBankName: '',
    commission: 0,
    withdrawalBank: 0,
    adsSpend: 0,
    platformExpenses: 0,
    shopifyOrders: 0,
    cancelledOrders: 0,
    dropiOrders: 0,
    tiktokOrders: 0,
    dropiCancelled: 0,
    returnedOrders: 0,
    deliveredOrders: 0,
    tags: '',
    notes: ''
  });

  useEffect(() => {
    if (!user) return;

    if (isDemoMode || !isFirebaseConfigValid) {
      // Mock data for demo
      const mockPeriods: SalePeriod[] = [
        {
          id: '1',
          uid: user.uid,
          month: 'Enero 2026',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          withdrawalDropi: 1500,
          commission: 150,
          withdrawalBank: 1200,
          adsSpend: 400,
          platformExpenses: 50,
          notes: 'Mes de prueba'
        },
        {
          id: '2',
          uid: user.uid,
          month: 'Febrero 2026',
          startDate: '2026-02-01',
          endDate: '2026-02-28',
          withdrawalDropi: 2200,
          commission: 220,
          withdrawalBank: 1800,
          adsSpend: 600,
          platformExpenses: 75,
          notes: 'Crecimiento estable'
        }
      ];
      setPeriods(mockPeriods);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'salePeriods'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SalePeriod[];
      setPeriods(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'salePeriods');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isDemoMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Convert values BACK to USD (base) if conversion is active
    const rate = isConversionActive ? (currencies[currency]?.rate || 1) : 1;
    
    const baseData = {
      ...formData,
      withdrawalDropi: (Number(formData.withdrawalDropi) || 0) / rate,
      withdrawalBankName: formData.withdrawalBankName || '',
      withdrawalBank: (Number(formData.withdrawalBank) || 0) / rate,
      adsSpend: (Number(formData.adsSpend) || 0) / rate,
      platformExpenses: (Number(formData.platformExpenses) || 0) / rate,
      shopifyOrders: Number(formData.shopifyOrders) || 0,
      cancelledOrders: Number(formData.cancelledOrders) || 0,
      dropiOrders: Number(formData.dropiOrders) || 0,
      tiktokOrders: Number(formData.tiktokOrders) || 0,
      dropiCancelled: Number(formData.dropiCancelled) || 0,
      returnedOrders: Number(formData.returnedOrders) || 0,
      deliveredOrders: Number(formData.deliveredOrders) || 0,
      tags: formData.tags || '',
    };

    const calculatedCommission = baseData.withdrawalDropi - baseData.withdrawalBank;

    const finalData = {
      ...baseData,
      commission: calculatedCommission,
      uid: user.uid,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingId) {
        if (isDemoMode) {
          setPeriods(prev => prev.map(p => p.id === editingId ? { ...p, ...formData } : p));
        } else {
          await setDoc(doc(db, 'salePeriods', editingId), finalData, { merge: true });
        }
        setEditingId(null);
      } else {
        if (isDemoMode) {
          const newPeriod = { ...formData, id: Math.random().toString(36).substr(2, 9), uid: user.uid };
          setPeriods(prev => [newPeriod, ...prev]);
        } else {
          await addDoc(collection(db, 'salePeriods'), {
            ...finalData,
            createdAt: serverTimestamp()
          });
        }
      }
      setFormData({
        month: '',
        startDate: '',
        endDate: '',
        withdrawalDropi: 0,
        withdrawalBankName: '',
        commission: 0,
        withdrawalBank: 0,
        adsSpend: 0,
        platformExpenses: 0,
        shopifyOrders: 0,
        cancelledOrders: 0,
        dropiOrders: 0,
        tiktokOrders: 0,
        dropiCancelled: 0,
        returnedOrders: 0,
        deliveredOrders: 0,
        tags: '',
        notes: ''
      });
      setShowAddForm(false);
      setInlineEditingId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'salePeriods');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (isDemoMode) {
        setPeriods(prev => prev.filter(p => p.id !== id));
      } else {
        await deleteDoc(doc(db, 'salePeriods', id));
      }
      setDeleteConfirmId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'salePeriods');
    }
  };

  const handleEdit = (period: SalePeriod, showModal = true) => {
    const rate = isConversionActive ? (currencies[currency]?.rate || 1) : 1;

    const clearZero = (val: number) => val === 0 ? '' : val;

    setFormData({
      month: period.month,
      startDate: period.startDate,
      endDate: period.endDate,
      withdrawalDropi: clearZero(period.withdrawalDropi * rate),
      withdrawalBankName: period.withdrawalBankName || '',
      commission: period.commission * rate,
      withdrawalBank: clearZero(period.withdrawalBank * rate),
      adsSpend: clearZero(period.adsSpend * rate),
      platformExpenses: clearZero(period.platformExpenses * rate),
      shopifyOrders: clearZero(period.shopifyOrders || 0),
      cancelledOrders: clearZero(period.cancelledOrders || 0),
      dropiOrders: clearZero(period.dropiOrders || 0),
      tiktokOrders: clearZero(period.tiktokOrders || 0),
      dropiCancelled: clearZero(period.dropiCancelled || 0),
      returnedOrders: clearZero(period.returnedOrders || 0),
      deliveredOrders: clearZero(period.deliveredOrders || 0),
      tags: period.tags || '',
      notes: period.notes
    } as any);
    setEditingId(period.id);
    if (showModal) {
      setShowAddForm(true);
    }
  };

  const displayPeriods = useMemo(
    () => {
      let filtered = [...periods];
      if (filterTag) {
        filtered = filtered.filter(p => 
          p.tags?.toLowerCase().includes(filterTag.toLowerCase())
        );
      }
      return filtered.sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return dateB - dateA;
      });
    },
    [periods, filterTag]
  );

  const stats = useMemo(() => {
    const totalWithdrawalDropi = displayPeriods.reduce((acc, p) => acc + (p.withdrawalDropi || 0), 0);
    const totalWithdrawalBank = displayPeriods.reduce((acc, p) => acc + (p.withdrawalBank || 0), 0);
    const totalAds = displayPeriods.reduce((acc, p) => acc + (p.adsSpend || 0), 0);
    const totalExpenses = displayPeriods.reduce((acc, p) => acc + (p.platformExpenses || 0), 0);
    const totalCommission = displayPeriods.reduce((acc, p) => acc + (p.commission || 0), 0);
    
    // Order cumulative stats
    const totalShopify = displayPeriods.reduce((acc, p) => acc + (p.shopifyOrders || 0), 0);
    const totalDropiOrders = displayPeriods.reduce((acc, p) => acc + (p.dropiOrders || 0), 0);
    const totalCancelled = displayPeriods.reduce((acc, p) => acc + (p.cancelledOrders || 0), 0);
    const totalReturned = displayPeriods.reduce((acc, p) => acc + (p.returnedOrders || 0), 0);
    const totalDelivered = displayPeriods.reduce((acc, p) => acc + (p.deliveredOrders || 0), 0);
    const totalDropiCancelled = displayPeriods.reduce((acc, p) => acc + (p.dropiCancelled || 0), 0);

    // Percentages (Funnel Logic - Base Shopify for consistency with Control Panel)
    const cancelRate = totalShopify > 0 ? (totalCancelled / totalShopify) * 100 : 0;
    const confirmRate = totalShopify > 0 ? (totalDropiOrders / totalShopify) * 100 : 0;
    const deliveredRate = totalShopify > 0 ? (totalDelivered / totalShopify) * 100 : 0;
    const returnRate = totalShopify > 0 ? (totalReturned / totalShopify) * 100 : 0;
    const dropiCancelRate = totalShopify > 0 ? (totalDropiCancelled / totalShopify) * 100 : 0;

    // Net profit estimation: Bank Withdrawal - Ads - Expenses
    const estimatedNetProfit = totalWithdrawalBank - totalAds - totalExpenses;

    const chartData = [...displayPeriods].reverse().map(p => ({
      name: p.month,
      'Retiro Dropi': p.withdrawalDropi,
      'Retiro Banco': p.withdrawalBank,
      'Publicidad': p.adsSpend,
      'Gasto Plataforma': p.platformExpenses,
      'Profit Neto': p.withdrawalBank - p.adsSpend - p.platformExpenses
    }));

    // Projections based on Net Profit growth
    const getNetProfit = (p: SalePeriod) => (p.withdrawalBank || 0) - (p.adsSpend || 0) - (p.platformExpenses || 0);
    
    const avgGrowth = periods.length > 1 
      ? (getNetProfit(periods[0]) - getNetProfit(periods[periods.length-1])) / periods.length 
      : 200;
    
    const lastProfit = periods[0] ? getNetProfit(periods[0]) : 0;
    
    const projections = Array.from({ length: 3 }).map((_, i) => {
      return {
        name: `Proyección ${i + 1}`,
        'Profit Neto': Math.max(0, lastProfit + (avgGrowth * (i + 1))),
        isProjection: true
      };
    });

    return {
      totalWithdrawalDropi,
      totalWithdrawalBank,
      totalAds,
      totalExpenses,
      totalCommission,
      estimatedNetProfit,
      cancelRate,
      confirmRate,
      deliveredRate,
      returnRate,
      dropiCancelRate,
      chartData,
      projectionData: [...chartData, ...projections]
    };
  }, [displayPeriods, periods]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-neon/20 border-t-neon rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setDeleteConfirmId(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-zinc-900 border border-red-500/30 p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6"
            >
              <div className="flex items-center gap-3 text-red-500">
                <div className="p-3 bg-red-500/10 rounded-xl">
                  <Trash2 size={24} />
                </div>
                <h4 className="text-xl font-display font-bold text-white uppercase tracking-tighter">¿Confirmar?</h4>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Estás a punto de eliminar este registro financiero. Esta acción es irreversible y afectará las métricas consolidadas.
              </p>
              <div className="flex gap-4 pt-2">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-4 py-3 bg-zinc-800 text-slate-300 font-bold rounded-xl hover:bg-zinc-700 transition-all text-xs uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="flex-1 px-4 py-3 bg-red-500 text-white font-black rounded-xl hover:bg-red-600 transition-all text-xs uppercase tracking-widest shadow-lg shadow-red-500/20"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-white flex items-center gap-3 tracking-tighter">
            <TrendingUp className="text-neon" size={32} /> VENTAS & RETIROS
          </h2>
          <p className="text-slate-400 text-lg">Control financiero de retiros y conciliación bancaria.</p>
        </div>
        <button 
          onClick={() => {
            setShowAddForm(true);
            setEditingId(null);
          }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-neon text-background font-black rounded-xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] uppercase tracking-widest text-sm"
        >
          <Plus size={20} strokeWidth={3} /> Nuevo Registro
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-white/10 gap-8">
        <button 
          onClick={() => setActiveTab('finance')}
          className={`pb-4 px-2 text-sm font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'finance' ? 'text-neon' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Resumen Financiero
          {activeTab === 'finance' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon shadow-[0_0_10px_rgba(34,197,94,0.5)]" />}
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={`pb-4 px-2 text-sm font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'orders' ? 'text-neon' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Historial Pedidos
          {activeTab === 'orders' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon shadow-[0_0_10px_rgba(34,197,94,0.5)]" />}
        </button>
      </div>

      {activeTab === 'finance' ? (
        <>
          {/* KPI Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard 
              title="Total Retiros Dropi" 
              value={formatCurrency(stats.totalWithdrawalDropi)} 
              icon={Wallet} 
              color="neon"
              subValue={`${periods.length} periodos registrados`}
            />
            <KPICard 
              title="Dinero en Banco" 
              value={formatCurrency(stats.totalWithdrawalBank)} 
              icon={Briefcase} 
              color="gold"
              subValue={`Recibido en cuenta (Local)`}
            />
            <KPICard 
              title="Profit Est. Total" 
              value={formatCurrency(stats.estimatedNetProfit)} 
              icon={Target} 
              color={stats.estimatedNetProfit >= 0 ? "neon" : "red"}
              subValue="Deducidos Ads y Plataforma"
              glow={stats.estimatedNetProfit > 0}
            />
          </div>

          <div className="space-y-8">
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="glass-card p-6 bg-black">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                    <BarChart3 size={20} className="text-neon" /> Flujo de Caja Mensual
                  </h3>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" vertical={false} />
                      <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis 
                        stroke="#475569" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(val) => {
                          if (val === 0) return '0';
                          const rate = isConversionActive ? (currencies[currency]?.rate || 1) : 1;
                          const converted = val * rate;
                          if (converted >= 1000) return `${(converted/1000).toFixed(1)}k`;
                          return converted.toFixed(0);
                        }} 
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(0, 0, 0, 0.4)' }}
                        contentStyle={{ backgroundColor: '#000000', border: '1px solid #1f1f2e', borderRadius: '12px' }}
                        itemStyle={{ fontSize: '13px', fontFamily: 'JetBrains Mono' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="Retiro Banco" fill="#eab308" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Publicidad" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card p-6 bg-black">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                    <TrendingUp size={20} className="text-neon" /> Proyección de Crecimiento
                  </h3>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.projectionData}>
                      <defs>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" vertical={false} />
                      <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis 
                        stroke="#475569" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(val) => {
                          if (val === 0) return '0';
                          const rate = isConversionActive ? (currencies[currency]?.rate || 1) : 1;
                          const converted = val * rate;
                          if (converted >= 1000) return `${(converted/1000).toFixed(1)}k`;
                          return converted.toFixed(0);
                        }} 
                      />
                      <Tooltip 
                        cursor={{ stroke: '#22c55e', strokeWidth: 2 }}
                        contentStyle={{ backgroundColor: '#000000', border: '1px solid #1f1f2e', borderRadius: '12px' }}
                        itemStyle={{ fontSize: '13px', fontFamily: 'JetBrains Mono' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="Profit Neto" 
                        stroke="#22c55e" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorProfit)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Financial History Section */}
            <div className="glass-card p-0 overflow-hidden border-border/40 shadow-2xl bg-black">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-neon/10 rounded-lg text-neon">
                    <Calendar size={20} />
                  </div>
                  <h3 className="text-xl font-display font-bold text-white tracking-tighter uppercase">
                    Control Financiero Mensual
                  </h3>
                </div>

                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input 
                      type="text"
                      placeholder="Filtrar por etiqueta..."
                      value={filterTag}
                      onChange={(e) => setFilterTag(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:border-neon outline-none w-48"
                    />
                  </div>
                  <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                    <button 
                      onClick={() => setViewMode('grid')}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${viewMode === 'grid' ? 'bg-neon text-background' : 'text-zinc-500'}`}
                    >
                      <LayoutGrid size={14} />
                    </button>
                    <button 
                      onClick={() => setViewMode('table')}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${viewMode === 'table' ? 'bg-neon text-background' : 'text-zinc-500'}`}
                    >
                      <TableIcon size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {displayPeriods.length === 0 ? (
                <div className="text-center py-20 text-slate-500 font-mono">No hay registros financieros.</div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
                  {displayPeriods.map(period => (
                    <div key={period.id} className="p-5 rounded-2xl bg-black border border-neon/20 group hover:border-neon transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-sm font-display font-bold text-white tracking-widest uppercase">{period.month}</p>
                            <p className="text-[15px] text-slate-500 font-mono mt-1">{period.startDate} / {period.endDate}</p>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => handleEdit(period)} className="p-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold hover:text-black transition-colors"><Edit2 size={12} /></button>
                             <button onClick={() => setDeleteConfirmId(period.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"><Trash2 size={12} /></button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center pb-2 border-b border-white/5">
                            <span className="text-[10px] text-slate-500 uppercase font-black">Banco</span>
                            <span className="text-[15px] text-slate-300 font-black">{period.withdrawalBankName || '—'}</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/5">
                            <span className="text-[10px] text-slate-500 uppercase font-black">Dropi</span>
                            <span className="text-[15px] font-mono text-neon font-bold">{formatCurrency(period.withdrawalDropi)}</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/5">
                            <span className="text-[10px] text-slate-500 uppercase font-black">Recibido</span>
                            <span className="text-[15px] font-mono text-gold font-bold">{formatCurrency(period.withdrawalBank)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-500 uppercase font-black">Profit Neto</span>
                            <span className="text-[15px] font-mono text-white font-bold">{formatCurrency(period.withdrawalBank - period.adsSpend - period.platformExpenses)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-950/50 border-b border-white/5">
                        <th className="px-6 py-4 text-xs uppercase tracking-tighter font-black text-slate-500">Periodo</th>
                        <th className="px-4 py-4 text-xs uppercase tracking-tighter font-black text-slate-500 text-right">Retiro Dropi</th>
                        <th className="px-4 py-4 text-xs uppercase tracking-tighter font-black text-slate-500 text-right">Comisión</th>
                        <th className="px-4 py-4 text-xs uppercase tracking-tighter font-black text-slate-500 text-right">Banco</th>
                        <th className="px-4 py-4 text-xs uppercase tracking-tighter font-black text-slate-500 text-right">Recibido (Banco)</th>
                        <th className="px-4 py-4 text-xs uppercase tracking-tighter font-black text-slate-500 text-right">ADS / Gastos</th>
                        <th className="px-4 py-4 text-xs uppercase tracking-tighter font-black text-white text-right">Profit Neto</th>
                        <th className="px-6 py-4 text-xs uppercase tracking-tighter font-black text-slate-500 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {displayPeriods.map(period => {
                        const isInlineEditing = inlineEditingId === period.id;
                        const rate = isConversionActive ? (currencies[currency]?.rate || 1) : 1;
                        const netProfit = (period.withdrawalBank - period.adsSpend - period.platformExpenses) * rate;
                        const symbol = currency === 'PEN' ? 'S/' : 'Q';

                        return (
                          <tr key={period.id} className={`${isInlineEditing ? 'bg-white/[0.03]' : 'hover:bg-white/[0.01]'} transition-colors group`}>
                            <td 
                              className="px-6 py-4 cursor-pointer"
                              onClick={() => {
                                if (!isInlineEditing) {
                                  handleEdit(period, false);
                                  setInlineEditingId(period.id);
                                }
                              }}
                            >
                              {isInlineEditing ? (
                                <div className="space-y-2">
                                  <input 
                                    type="text"
                                    value={formData.month}
                                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                                    className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[15px] text-white"
                                  />
                                  <div className="flex gap-1">
                                    <input 
                                      type="date"
                                      value={formData.startDate}
                                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                      className="bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[15px] text-white"
                                    />
                                    <input 
                                      type="date"
                                      value={formData.endDate}
                                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                      className="bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[15px] text-white"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm font-black text-neon uppercase">{period.month}</p>
                                  <p className="text-[15px] text-slate-500 font-mono">{period.startDate} / {period.endDate}</p>
                                </>
                              )}
                            </td>
                            <td 
                              className="px-4 py-4 text-right cursor-pointer"
                              onClick={() => {
                                if (!isInlineEditing) {
                                  handleEdit(period, false);
                                  setInlineEditingId(period.id);
                                }
                              }}
                            >
                              {isInlineEditing ? (
                                <input 
                                  type="number"
                                  value={formData.withdrawalDropi}
                                  onChange={(e) => setFormData({ ...formData, withdrawalDropi: e.target.value === '' ? '' : Number(e.target.value) })}
                                  className="w-24 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[15px] text-neon font-mono text-right"
                                />
                              ) : (
                                <span className="font-mono text-[15px] text-neon font-bold">
                                  {symbol} {(period.withdrawalDropi * rate).toLocaleString()}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className="font-mono text-[15px] text-amber-500/70">
                                {symbol} {(period.commission * rate).toLocaleString()}
                              </span>
                            </td>
                            <td 
                              className="px-4 py-4 text-right cursor-pointer"
                              onClick={() => {
                                if (!isInlineEditing) {
                                  handleEdit(period, false);
                                  setInlineEditingId(period.id);
                                }
                              }}
                            >
                              {isInlineEditing ? (
                                <input 
                                  type="text"
                                  value={formData.withdrawalBankName || ''}
                                  onChange={(e) => setFormData({ ...formData, withdrawalBankName: e.target.value })}
                                  className="w-24 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[15px] text-slate-300"
                                  placeholder="Banco"
                                />
                              ) : (
                                <span className="text-[15px] text-slate-400 font-black uppercase tracking-tighter">{period.withdrawalBankName || '—'}</span>
                              )}
                            </td>
                            <td 
                              className="px-4 py-4 text-right cursor-pointer"
                              onClick={() => {
                                if (!isInlineEditing) {
                                  handleEdit(period, false);
                                  setInlineEditingId(period.id);
                                }
                              }}
                            >
                              {isInlineEditing ? (
                                <input 
                                  type="number"
                                  value={formData.withdrawalBank}
                                  onChange={(e) => setFormData({ ...formData, withdrawalBank: e.target.value === '' ? '' : Number(e.target.value) })}
                                  className="w-24 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[15px] text-gold font-mono text-right"
                                />
                              ) : (
                                <span className="font-mono text-[15px] text-gold font-bold">
                                  {symbol} {(period.withdrawalBank * rate).toLocaleString()}
                                </span>
                              )}
                            </td>
                            <td 
                              className="px-4 py-4 text-right cursor-pointer"
                              onClick={() => {
                                if (!isInlineEditing) {
                                  handleEdit(period, false);
                                  setInlineEditingId(period.id);
                                }
                              }}
                            >
                              {isInlineEditing ? (
                                <div className="flex flex-col gap-1 items-end">
                                  <input 
                                    type="number"
                                    value={formData.adsSpend}
                                    onChange={(e) => setFormData({ ...formData, adsSpend: e.target.value === '' ? '' : Number(e.target.value) })}
                                    className="w-20 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[15px] text-blue-400 font-mono text-right"
                                    placeholder="Ads"
                                  />
                                  <input 
                                    type="number"
                                    value={formData.platformExpenses}
                                    onChange={(e) => setFormData({ ...formData, platformExpenses: e.target.value === '' ? '' : Number(e.target.value) })}
                                    className="w-20 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[15px] text-slate-400 font-mono text-right"
                                    placeholder="Plataforma"
                                  />
                                </div>
                              ) : (
                                <span className="font-mono text-[15px] text-slate-500">
                                  -{symbol} {((period.adsSpend + period.platformExpenses) * rate).toLocaleString()}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className={`px-2 py-1 rounded font-mono text-[15px] font-black ${netProfit >= 0 ? 'bg-neon/10 text-neon' : 'bg-red-500/10 text-red-500'}`}>
                                {symbol} {netProfit.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center gap-2">
                                {isInlineEditing ? (
                                  <>
                                    <button onClick={handleSubmit} className="p-1.5 rounded bg-neon text-background"><Save size={12} /></button>
                                    <button onClick={() => setInlineEditingId(null)} className="p-1.5 rounded bg-zinc-800 text-slate-400"><X size={12} /></button>
                                  </>
                                ) : (
                                  <>
                                    <button 
                                      onClick={() => {
                                        handleEdit(period, false);
                                        setInlineEditingId(period.id);
                                      }} 
                                      className="p-1.5 rounded bg-white/5 text-slate-400 hover:bg-white/10 transition-all"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button 
                                      onClick={() => setDeleteConfirmId(period.id)} 
                                      className="p-1.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
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
        </>
      ) : (
        <div className="glass-card p-0 overflow-hidden border-border/40 bg-black shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-neon/10 rounded-lg text-neon">
                <ShoppingCart size={20} />
              </div>
              <h3 className="text-xl font-display font-bold text-white tracking-tighter uppercase">
                Historial de Pedidos (Excel View)
              </h3>
            </div>
            
            <button className="text-[10px] text-slate-500 font-bold uppercase tracking-widest hover:text-neon transition-colors flex items-center gap-2">
              <ArrowDownRight size={14} /> Exportar CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-zinc-950/80 border-b border-white/10 font-mono text-[10px] uppercase text-slate-500 font-black tracking-widest">
                  <th className="px-6 py-4 border-r border-white/5">Mes / Periodo</th>
                  <th className="px-4 py-4 text-center border-r border-white/5 bg-white/2">Shopify</th>
                  <th className="px-4 py-4 text-center border-r border-white/5 bg-red-500/5">Canc.</th>
                  <th className="px-4 py-4 text-center border-r border-white/5 bg-neon/5 font-black text-neon">Dropi</th>
                  <th className="px-4 py-4 text-center border-r border-white/5 bg-sky-500/5 text-sky-400">TikTok</th>
                  <th className="px-4 py-4 text-center border-r border-white/5 bg-orange-500/5">Canc. Dropi</th>
                  <th className="px-4 py-4 text-center border-r border-white/5 bg-green-500/5 text-green-400">Entr.</th>
                  <th className="px-4 py-4 text-center border-r border-white/5 bg-amber-500/5">Dev.</th>
                  <th className="px-6 py-4">Etiquetas / Tags</th>
                  <th className="px-4 py-4 text-center border-r border-white/5 text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {displayPeriods.map(period => {
                  const isInlineEditing = inlineEditingId === period.id;
                  return (
                  <tr key={period.id} className={`${isInlineEditing ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'} transition-colors group`}>
                    <td 
                      className="px-6 py-4 border-r border-white/5 whitespace-nowrap cursor-pointer"
                      onClick={() => {
                        if (!isInlineEditing) {
                          handleEdit(period, false);
                          setInlineEditingId(period.id);
                        }
                      }}
                    >
                       <span className="text-xs font-black text-white">{period.month}</span>
                       <span className="block text-[15px] text-slate-500 mt-0.5">{period.startDate} a {period.endDate}</span>
                    </td>
                    <td 
                      className="px-4 py-4 text-center border-r border-white/5 bg-white/[0.01] cursor-pointer"
                      onClick={() => {
                        if (!isInlineEditing) {
                          handleEdit(period, false);
                          setInlineEditingId(period.id);
                        }
                      }}
                    >
                       {isInlineEditing ? (
                         <input 
                           type="number"
                           value={formData.shopifyOrders}
                           onChange={(e) => setFormData({ ...formData, shopifyOrders: e.target.value === '' ? '' : Number(e.target.value) })}
                           className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[15px] text-white text-center"
                         />
                       ) : (
                         <span className="text-[15px] font-bold text-white">{period.shopifyOrders || 0}</span>
                       )}
                    </td>
                    <td 
                      className="px-4 py-4 text-center border-r border-white/5 bg-red-500/5 cursor-pointer"
                      onClick={() => {
                        if (!isInlineEditing) {
                          handleEdit(period, false);
                          setInlineEditingId(period.id);
                        }
                      }}
                    >
                       {isInlineEditing ? (
                         <input 
                           type="number"
                           value={formData.cancelledOrders}
                           onChange={(e) => setFormData({ ...formData, cancelledOrders: e.target.value === '' ? '' : Number(e.target.value) })}
                           className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[15px] text-red-400 text-center"
                         />
                       ) : (
                         <span className="text-[15px] font-bold text-red-400">{period.cancelledOrders || 0}</span>
                       )}
                    </td>
                    <td 
                      className="px-4 py-4 text-center border-r border-white/5 bg-neon/10 cursor-pointer"
                      onClick={() => {
                        if (!isInlineEditing) {
                          handleEdit(period, false);
                          setInlineEditingId(period.id);
                        }
                      }}
                    >
                       {isInlineEditing ? (
                         <input 
                           type="number"
                           value={formData.dropiOrders}
                           onChange={(e) => setFormData({ ...formData, dropiOrders: e.target.value === '' ? '' : Number(e.target.value) })}
                           className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[15px] text-neon text-center"
                         />
                       ) : (
                         <span className="text-[15px] font-black text-neon">{period.dropiOrders || 0}</span>
                       )}
                    </td>
                    <td 
                      className="px-4 py-4 text-center border-r border-white/5 bg-sky-500/[0.03] cursor-pointer"
                      onClick={() => {
                        if (!isInlineEditing) {
                          handleEdit(period, false);
                          setInlineEditingId(period.id);
                        }
                      }}
                    >
                       {isInlineEditing ? (
                         <input 
                           type="number"
                           value={formData.tiktokOrders}
                           onChange={(e) => setFormData({ ...formData, tiktokOrders: e.target.value === '' ? '' : Number(e.target.value) })}
                           className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[15px] text-sky-400 text-center"
                         />
                       ) : (
                         <span className="text-[15px] font-bold text-sky-400">{period.tiktokOrders || 0}</span>
                       )}
                    </td>
                    <td 
                      className="px-4 py-4 text-center border-r border-white/5 bg-orange-500/[0.03] cursor-pointer"
                      onClick={() => {
                        if (!isInlineEditing) {
                          handleEdit(period, false);
                          setInlineEditingId(period.id);
                        }
                      }}
                    >
                       {isInlineEditing ? (
                         <input 
                           type="number"
                           value={formData.dropiCancelled}
                           onChange={(e) => setFormData({ ...formData, dropiCancelled: e.target.value === '' ? '' : Number(e.target.value) })}
                           className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[15px] text-orange-400 text-center"
                         />
                       ) : (
                         <span className="text-[15px] font-bold text-orange-400">{period.dropiCancelled || 0}</span>
                       )}
                    </td>
                    <td 
                      className="px-4 py-4 text-center border-r border-white/5 bg-amber-500/[0.03] cursor-pointer"
                      onClick={() => {
                        if (!isInlineEditing) {
                          handleEdit(period, false);
                          setInlineEditingId(period.id);
                        }
                      }}
                    >
                       {isInlineEditing ? (
                         <input 
                           type="number"
                           value={formData.returnedOrders}
                           onChange={(e) => setFormData({ ...formData, returnedOrders: e.target.value === '' ? '' : Number(e.target.value) })}
                           className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[15px] text-amber-500 text-center"
                         />
                       ) : (
                         <span className="text-[15px] font-bold text-amber-500">{period.returnedOrders || 0}</span>
                       )}
                    </td>
                    <td 
                      className="px-4 py-4 text-center border-r border-white/5 bg-green-500/[0.03] cursor-pointer"
                      onClick={() => {
                        if (!isInlineEditing) {
                          handleEdit(period, false);
                          setInlineEditingId(period.id);
                        }
                      }}
                    >
                       {isInlineEditing ? (
                         <input 
                           type="number"
                           value={formData.deliveredOrders}
                           onChange={(e) => setFormData({ ...formData, deliveredOrders: e.target.value === '' ? '' : Number(e.target.value) })}
                           className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[15px] text-green-400 text-center"
                         />
                       ) : (
                         <span className="text-[15px] font-bold text-green-400">{period.deliveredOrders || 0}</span>
                       )}
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex flex-wrap gap-1">
                          {period.tags?.split(',').map((tag, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded-sm bg-zinc-800 text-[8px] text-zinc-400 font-bold uppercase hover:bg-neon hover:text-black transition-colors cursor-default">
                              {tag.trim()}
                            </span>
                          )) || <span className="text-[10px] text-zinc-700 italic">Sin etiquetas</span>}
                       </div>
                    </td>
                    <td className="px-4 py-4 border-l border-white/5">
                      <div className="flex justify-center gap-2">
                        {isInlineEditing ? (
                          <>
                            <button onClick={handleSubmit} className="p-1.5 rounded bg-neon text-background"><Save size={12} /></button>
                            <button onClick={() => setInlineEditingId(null)} className="p-1.5 rounded bg-zinc-800 text-slate-400"><X size={12} /></button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => {
                                handleEdit(period, false);
                                setInlineEditingId(period.id);
                              }} 
                              className="p-1.5 rounded bg-white/5 text-slate-400 hover:bg-white/10 transition-all"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmId(period.id)} 
                              className="p-1.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
              <tfoot className="bg-zinc-950 font-black">
                 <tr className="border-t border-white/20">
                    <td className="px-6 py-4 text-[10px] text-slate-500 uppercase">Totales</td>
                    <td className="px-4 py-4 text-center text-white text-[15px]">{displayPeriods.reduce((acc, p) => acc + (p.shopifyOrders || 0), 0)}</td>
                    <td className="px-4 py-4 text-center text-red-400 text-[15px]">{displayPeriods.reduce((acc, p) => acc + (p.cancelledOrders || 0), 0)}</td>
                    <td className="px-4 py-4 text-center text-neon text-[15px]">{displayPeriods.reduce((acc, p) => acc + (p.dropiOrders || 0), 0)}</td>
                    <td className="px-4 py-4 text-center text-sky-400 text-[15px]">{displayPeriods.reduce((acc, p) => acc + (p.tiktokOrders || 0), 0)}</td>
                    <td className="px-4 py-4 text-center text-orange-400 text-[15px]">{displayPeriods.reduce((acc, p) => acc + (p.dropiCancelled || 0), 0)}</td>
                    <td className="px-4 py-4 text-center text-green-400 text-[15px]">{displayPeriods.reduce((acc, p) => acc + (p.deliveredOrders || 0), 0)}</td>
                    <td className="px-4 py-4 text-center text-amber-500 text-[15px]">{displayPeriods.reduce((acc, p) => acc + (p.returnedOrders || 0), 0)}</td>
                    <td className="px-6 py-4"></td>
                    <td className="px-4 py-4"></td>
                 </tr>
                 <tr className="border-t border-white/10 bg-white/[0.02]">
                    <td className="px-6 py-3 text-[10px] text-slate-400 uppercase">Ratio Operativo / Eficiencia %</td>
                    <td className="px-4 py-3 text-center text-slate-400 text-[12px] font-black" title="Base Shopify total (Todos los pedidos)">100%</td>
                    <td className="px-4 py-3 text-center text-red-100 text-[11px]" title="% Cancelación sobre Shopify">{stats.cancelRate.toFixed(1)}% <span className="text-[8px] opacity-40">/Sh</span></td>
                    <td className="px-4 py-3 text-center text-neon text-[12px] font-black" title="% Confirmación sobre Shopify">{stats.confirmRate.toFixed(1)}% <span className="text-[8px] opacity-40">/Sh</span></td>
                    <td className="px-4 py-3 text-center text-slate-600">—</td>
                    <td className="px-4 py-3 text-center text-orange-200 text-[11px]" title="% Cancelado en Dropi sobre Shopify total">{stats.dropiCancelRate.toFixed(1)}% <span className="text-[8px] opacity-40">/Sh</span></td>
                    <td className="px-4 py-3 text-center text-green-400 font-black text-[12px]" title="% Entregados sobre Shopify total">{stats.deliveredRate.toFixed(1)}% <span className="text-[8px] opacity-40">/Sh</span></td>
                    <td className="px-4 py-3 text-center text-amber-200 text-[11px]" title="% Devolución sobre Shopify total">{stats.returnRate.toFixed(1)}% <span className="text-[8px] opacity-40">/Sh</span></td>
                    <td className="px-6 py-3"></td>
                    <td className="px-4 py-3"></td>
                 </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-card border border-border shadow-2xl rounded-3xl overflow-hidden"
            >
              <div className="p-8 border-b border-border bg-gradient-to-r from-neon/10 to-transparent flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-display font-bold text-white tracking-tighter">
                    {editingId ? 'EDITAR REGISTRO' : 'NUEVO REGISTRO MENSUAL'}
                  </h3>
                  <p className="text-slate-400 text-sm">Completa los datos financieros del periodo.</p>
                </div>
                <button 
                  onClick={() => setShowAddForm(false)}
                  className="p-2 rounded-full hover:bg-white/5 text-slate-400 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                       <Calendar size={14} className="text-neon" /> Mes / Identificador
                    </label>
                    <input 
                      required
                      type="text"
                      placeholder="Marzo 2026"
                      value={formData.month}
                      onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl p-3 text-white focus:border-neon focus:ring-1 focus:ring-neon outline-none transition-all font-display"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                       <ArrowUpRight size={14} className="text-gold" /> Fecha Inicio
                    </label>
                    <input 
                      required
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl p-3 text-white focus:border-neon focus:ring-1 focus:ring-neon outline-none transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                       <ArrowDownRight size={14} className="text-red-500" /> Fecha Cierre
                    </label>
                    <input 
                      required
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl p-3 text-white focus:border-neon focus:ring-1 focus:ring-neon outline-none transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                       <Wallet size={14} className="text-neon" /> Monto Retiro Dropi
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                        required
                        type="number"
                        step="0.01"
                        value={formData.withdrawalDropi}
                        onChange={(e) => setFormData({ ...formData, withdrawalDropi: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full bg-background border border-border rounded-xl p-3 pl-10 text-white focus:border-neon focus:ring-1 focus:ring-neon outline-none transition-all font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                       <Briefcase size={14} className="text-gold" /> Retiro a Banco (Local)
                    </label>
                    <div className="flex gap-4">
                      <div className="relative flex-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                          required
                          type="number"
                          step="0.01"
                          value={formData.withdrawalBank}
                          onChange={(e) => setFormData({ ...formData, withdrawalBank: e.target.value === '' ? '' : Number(e.target.value) })}
                          className="w-full bg-background border border-border rounded-xl p-3 pl-10 text-white focus:border-neon focus:ring-1 focus:ring-neon outline-none transition-all font-mono"
                        />
                      </div>
                      <div className="flex-1">
                        <input 
                          type="text"
                          placeholder="Nombre del Banco"
                          value={formData.withdrawalBankName || ''}
                          onChange={(e) => setFormData({ ...formData, withdrawalBankName: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl p-3 text-white focus:border-neon focus:ring-1 focus:ring-neon outline-none transition-all font-display"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">La comisión se calcula: Dropi - Banco.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                       <Megaphone size={14} className="text-blue-500" /> Gasto Publicidad
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                        required
                        type="number"
                        step="0.01"
                        value={formData.adsSpend}
                        onChange={(e) => setFormData({ ...formData, adsSpend: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full bg-background border border-border rounded-xl p-3 pl-10 text-white focus:border-neon focus:ring-1 focus:ring-neon outline-none transition-all font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                       <CreditCard size={14} className="text-purple-500" /> Gasto Plataforma
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                        required
                        type="number"
                        step="0.01"
                        value={formData.platformExpenses}
                        onChange={(e) => setFormData({ ...formData, platformExpenses: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full bg-background border border-border rounded-xl p-3 pl-10 text-white focus:border-neon focus:ring-1 focus:ring-neon outline-none transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Historial de Pedidos section in Form */}
                <div className="p-6 bg-zinc-950/50 border border-border/50 rounded-2xl space-y-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <ShoppingCart size={14} className="text-neon" /> Historial de Pedidos
                  </h4>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Shopify Ingresados</label>
                      <input 
                        type="number"
                        value={formData.shopifyOrders}
                        onChange={(e) => setFormData({ ...formData, shopifyOrders: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full bg-background border border-border rounded-xl p-2 text-white focus:border-neon outline-none transition-all font-mono sm:text-sm text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Cancelados</label>
                      <input 
                        type="number"
                        value={formData.cancelledOrders}
                        onChange={(e) => setFormData({ ...formData, cancelledOrders: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full bg-background border border-border rounded-xl p-2 text-white focus:border-red-500 outline-none transition-all font-mono sm:text-sm text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Subidos a Dropi</label>
                      <input 
                        type="number"
                        value={formData.dropiOrders}
                        onChange={(e) => setFormData({ ...formData, dropiOrders: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full bg-background border border-border rounded-xl p-2 text-white focus:border-neon outline-none transition-all font-mono sm:text-sm text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">TikTok</label>
                      <input 
                        type="number"
                        value={formData.tiktokOrders}
                        onChange={(e) => setFormData({ ...formData, tiktokOrders: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full bg-background border border-border rounded-xl p-2 text-white focus:border-sky-400 outline-none transition-all font-mono sm:text-sm text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Canc. Dropi</label>
                      <input 
                        type="number"
                        value={formData.dropiCancelled}
                        onChange={(e) => setFormData({ ...formData, dropiCancelled: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full bg-background border border-border rounded-xl p-2 text-white focus:border-orange-500 outline-none transition-all font-mono sm:text-sm text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Entregados</label>
                      <input 
                        type="number"
                        value={formData.deliveredOrders}
                        onChange={(e) => setFormData({ ...formData, deliveredOrders: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full bg-background border border-border rounded-xl p-2 text-white focus:border-green-500 outline-none transition-all font-mono sm:text-sm text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Devueltos</label>
                      <input 
                        type="number"
                        value={formData.returnedOrders}
                        onChange={(e) => setFormData({ ...formData, returnedOrders: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full bg-background border border-border rounded-xl p-2 text-white focus:border-amber-500 outline-none transition-all font-mono sm:text-sm text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold text-slate-500 tracking-widest">Etiquetas (Tags)</label>
                  <input 
                    type="text"
                    placeholder="Ejem: Escalado, Prueba, Navidad"
                    value={formData.tags || ''}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl p-3 text-white focus:border-neon outline-none transition-all"
                  />
                  <p className="text-[10px] text-zinc-500">Separadas por comas.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold text-slate-500 tracking-widest">Notas Adicionales</label>
                  <textarea 
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Detalles sobre el periodo, picos de venta, etc..."
                    className="w-full bg-background border border-border rounded-xl p-3 text-white focus:border-neon outline-none transition-all resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 px-6 py-4 border border-border rounded-xl text-slate-400 font-bold hover:text-white hover:bg-white/5 transition-all text-sm uppercase tracking-widest"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-neon text-background font-black rounded-xl hover:scale-105 transition-all shadow-lg text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <Save size={18} /> {editingId ? 'Actualizar' : 'Guardar Periodo'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const KPICard = ({ title, value, icon: Icon, color, subValue, extra, glow = false }: any) => {
  const colorMap: any = {
    neon: "text-neon bg-neon/10 border-neon/30",
    gold: "text-gold bg-gold/10 border-gold/30",
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/30",
    red: "text-red-500 bg-red-500/10 border-red-500/30",
    sky: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  };

  return (
    <div className={`glass-card p-6 flex flex-col justify-between group hover:border-gold shadow-[0_0_15px_rgba(20,255,186,0.02)] hover:shadow-[0_0_15px_rgba(20,255,186,0.1)] bg-black transition-all ${glow ? 'neon-glow border-neon/50' : 'border-white/5'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${colorMap[color] || colorMap.neon} border border-current/20 transition-all group-hover:scale-110 shadow-lg`}>
          <Icon size={20} />
        </div>
        <ArrowUpRight size={14} className="text-slate-600 group-hover:text-neon transition-colors" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">{title}</p>
        <p className="text-2xl font-mono font-bold text-white tracking-tighter">{value}</p>
        {subValue && <p className="text-[10px] text-slate-500 mt-1">{subValue}</p>}
        {extra}
      </div>
    </div>
  );
};

export default SalesManagement;
