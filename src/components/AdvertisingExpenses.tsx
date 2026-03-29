import React, { useState, useEffect, useMemo } from 'react';
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  Target, 
  Layers, 
  DollarSign,
  Search,
  Filter,
  TrendingUp,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './Auth';
import { format, startOfDay, eachDayOfInterval, subDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, AreaChart, Area 
} from 'recharts';

interface AdvertisingExpense {
  id: string;
  uid: string;
  productId: string;
  productName: string;
  date: string;
  accountName: string;
  platform: string;
  amount: number;
  timestamp: number;
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

const COLORS = ['#00ff88', '#00ccff', '#ffcc00', '#ff00ff', '#ff4444', '#9966ff', '#ff8800', '#44ff44'];

export default function AdvertisingExpenses({ formatCurrency }: { formatCurrency: (amount: number) => string }) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<AdvertisingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([]);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    productName: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    accountName: '',
    platform: 'Facebook Ads',
    customPlatform: '',
    amount: ''
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

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount)) return;

      // Find product name if only ID was selected (though we handle it in onChange)
      let finalProductName = formData.productName;
      if (!finalProductName && formData.productId) {
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
        amount: amount,
        timestamp: Date.now()
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
        amount: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'ad_expenses');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'ad_expenses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'ad_expenses');
    }
  };

  const stats = useMemo(() => {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    // By Platform (Dynamic)
    const platforms: Record<string, number> = {};
    expenses.forEach(e => {
      platforms[e.platform] = (platforms[e.platform] || 0) + e.amount;
    });
    const platformData = Object.entries(platforms)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // By Account
    const accounts: Record<string, number> = {};
    expenses.forEach(e => {
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
      const dayExpenses = expenses.filter(e => isSameDay(new Date(e.date), day));
      return {
        date: format(day, 'dd MMM', { locale: es }),
        amount: dayExpenses.reduce((sum, e) => sum + e.amount, 0)
      };
    });

    return { total, platformData, accountData, dailyData };
  }, [expenses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-neon/20 border-t-neon rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
            <Megaphone className="text-neon" /> Gastos de Publicidad
          </h2>
          <p className="text-slate-500 text-sm">Control aislado de inversión publicitaria por producto y plataforma</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="bg-neon text-background font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-neon/20"
        >
          <Plus size={18} /> Registrar Gasto
        </button>
      </div>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-6 border-neon/50 bg-card/30 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-display uppercase tracking-[0.2em] text-slate-400 font-bold">Inversión Total</span>
            <div className="p-2 bg-neon/20 rounded-lg">
              <DollarSign size={18} className="text-neon" />
            </div>
          </div>
          <p className="text-4xl font-mono font-bold text-white tracking-tighter">
            {formatCurrency(stats.total)}
          </p>
        </div>
        
        <div className="glass-card p-6 border-gold/50 bg-card/30 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-display uppercase tracking-[0.2em] text-slate-400 font-bold">Gastos por Plataforma</span>
            <div className="p-2 bg-gold/20 rounded-lg">
              <Target size={18} className="text-gold" />
            </div>
          </div>
          {stats.platformData.length > 0 ? (
            <div className="space-y-2 max-h-[100px] overflow-y-auto pr-1 custom-scrollbar">
              {stats.platformData.map((plat, idx) => (
                <div key={plat.name} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <p className="text-sm font-bold text-white truncate max-w-[120px]">{plat.name}</p>
                  </div>
                  <p className="text-sm font-mono text-gold font-bold">{formatCurrency(plat.value)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 italic">Sin datos</p>
          )}
        </div>

        <div className="glass-card p-6 border-blue-500/50 bg-card/30 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-display uppercase tracking-[0.2em] text-slate-400 font-bold">Registros</span>
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Layers size={18} className="text-blue-400" />
            </div>
          </div>
          <p className="text-4xl font-mono font-bold text-white tracking-tighter">
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
            className="glass-card p-6 border-neon/30 bg-card/60 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-neon" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <Plus className="text-neon" size={20} /> Nuevo Registro de Gasto
              </h3>
              <button 
                onClick={() => setShowAddForm(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Fecha</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input 
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-background/50 border border-border/50 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:border-neon/50 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Producto</label>
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
                  className="w-full bg-background/50 border border-border/50 rounded-lg py-2 px-3 text-sm text-white focus:border-neon/50 outline-none transition-all"
                >
                  <option value="" className="bg-slate-900">Seleccionar Producto...</option>
                  {savedProducts.map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>
                  ))}
                  <option value="manual" className="bg-slate-900">Otro (Manual)</option>
                </select>
              </div>

              {formData.productId === 'manual' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Nombre del Producto</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ej: Producto Especial"
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    className="w-full bg-background/50 border border-border/50 rounded-lg py-2 px-3 text-sm text-white focus:border-neon/50 outline-none transition-all"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Plataforma</label>
                <select 
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  className="w-full bg-background/50 border border-border/50 rounded-lg py-2 px-3 text-sm text-white focus:border-neon/50 outline-none transition-all"
                >
                  {PLATFORMS.map(p => (
                    <option key={p} value={p} className="bg-slate-900">{p}</option>
                  ))}
                </select>
              </div>

              {formData.platform === 'Otro' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Nombre de Plataforma</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ej: Twitter Ads"
                    value={formData.customPlatform}
                    onChange={(e) => setFormData({ ...formData, customPlatform: e.target.value })}
                    className="w-full bg-background/50 border border-border/50 rounded-lg py-2 px-3 text-sm text-white focus:border-neon/50 outline-none transition-all"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Cuenta Publicitaria</label>
                <input 
                  type="text"
                  required
                  placeholder="Ej: Cuenta Principal"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  className="w-full bg-background/50 border border-border/50 rounded-lg py-2 px-3 text-sm text-white focus:border-neon/50 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Monto Invertido</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input 
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full bg-background/50 border border-border/50 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:border-neon/50 outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button 
                  type="submit"
                  className="w-full bg-neon text-background font-bold py-2 rounded-lg hover:brightness-110 transition-all shadow-lg shadow-neon/20"
                >
                  Guardar Gasto
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expenses Table - MOVED ABOVE CHARTS */}
      <div className="glass-card overflow-hidden border-border/50 bg-card/30 backdrop-blur-md">
        <div className="p-4 border-b border-border/50 flex items-center justify-between bg-white/5">
          <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider">Historial de Gastos</h3>
          <span className="text-[10px] text-slate-500 font-mono italic">Últimos registros primero</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-card/80 border-b border-border">
                <th className="p-4 text-xs uppercase tracking-widest text-slate-400 font-bold">Fecha</th>
                <th className="p-4 text-xs uppercase tracking-widest text-slate-400 font-bold">Producto</th>
                <th className="p-4 text-xs uppercase tracking-widest text-slate-400 font-bold">Plataforma</th>
                <th className="p-4 text-xs uppercase tracking-widest text-slate-400 font-bold">Cuenta</th>
                <th className="p-4 text-xs uppercase tracking-widest text-slate-400 font-bold text-right">Monto</th>
                <th className="p-4 text-xs uppercase tracking-widest text-slate-400 font-bold text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                    No hay gastos registrados aún.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-border/30 hover:bg-white/10 transition-colors group">
                    <td className="p-4 text-sm text-white font-mono font-medium">
                      {format(new Date(expense.date), 'dd MMM, yyyy', { locale: es })}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">{expense.productName}</span>
                        <span className="text-[10px] text-slate-500 font-mono uppercase">ID: {expense.productId || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded-full bg-white/10 border border-border/50 text-[10px] font-bold uppercase tracking-widest text-slate-200">
                        {expense.platform}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-300 font-medium">
                      {expense.accountName}
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm font-mono font-bold text-neon">
                        {formatCurrency(expense.amount)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="p-2 text-slate-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Section - MOVED BELOW TABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Spending Chart */}
        <div className="glass-card p-6 border-border/50 bg-card/20">
          <div className="flex items-center gap-2 mb-6">
            <Activity size={18} className="text-neon" />
            <h3 className="text-lg font-display font-bold text-white">Inversión Diaria (14D)</h3>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.dailyData}>
                <defs>
                  <linearGradient id="colorAd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00ff88" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                  itemStyle={{ color: '#00ff88', fontSize: '12px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                  cursor={{ stroke: '#00ff88', strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#00ff88" 
                  fillOpacity={1} 
                  fill="url(#colorAd)" 
                  strokeWidth={2}
                  activeDot={{ r: 6, fill: '#00ff88', stroke: '#12121a', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform Distribution Chart */}
        <div className="glass-card p-6 border-border/50 bg-card/20">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon size={18} className="text-blue-400" />
            <h3 className="text-lg font-display font-bold text-white">Inversión por Plataforma</h3>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.platformData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="#cbd5e1" 
                  fontSize={10} 
                  width={100}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                  formatter={(value: number) => formatCurrency(value)}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} activeBar={false}>
                  {stats.platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Account Analysis Chart */}
        <div className="glass-card p-6 border-border/50 lg:col-span-2 bg-card/20">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 size={18} className="text-gold" />
            <h3 className="text-lg font-display font-bold text-white">Análisis por Cuenta Publicitaria</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.accountData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                  itemStyle={{ color: '#ffcc00', fontSize: '12px' }}
                  formatter={(value: number) => formatCurrency(value)}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                />
                <Bar dataKey="value" fill="#ffcc00" radius={[4, 4, 0, 0]} barSize={40} activeBar={false}>
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

