import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Calculator, 
  RotateCcw, 
  Truck, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Bot,
  LogOut,
  Globe,
  Settings as SettingsIcon,
  Bell,
  Megaphone,
  Search,
  CreditCard,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { generateMockData, CURRENCIES, CurrencyCode, Order, calculateOrderProfit } from './mockData';
import { fetchExchangeRates } from './services/currencyService';
import Dashboard from './components/Dashboard';
import OrderManagement from './components/OrderManagement';
import ProfitCalculator from './components/ProfitCalculator';
import ReturnsAnalysis from './components/ReturnsAnalysis';
import ShippingAnalysis from './components/ShippingAnalysis';
import FinancialSummary from './components/FinancialSummary';
import AdvertisingExpenses from './components/AdvertisingExpenses';
import MarketResearch from './components/MarketResearch';
import LogisticsAI from './components/LogisticsAI';
import PlatformExpenses from './components/PlatformExpenses';
import KPIPanel from './components/KPIPanel';
import Settings from './components/Settings';
import { AuthProvider, AuthScreen, useAuth } from './components/Auth';
import ErrorBoundary from './components/ErrorBoundary';

const Logo = ({ size = 32, className = "" }: { size?: number, className?: string }) => (
  <div className={`relative flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size }}>
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_12px_rgba(34,197,94,0.6)]">
      {/* Magnifying Glass Handle */}
      <rect x="68" y="68" width="22" height="8" rx="4" transform="rotate(45 68 68)" fill="#475569" />
      {/* Magnifying Glass Circle */}
      <circle cx="45" cy="45" r="38" fill="none" stroke="#22C55E" strokeWidth="7" />
      {/* Bars */}
      <rect x="25" y="55" width="10" height="15" rx="2" fill="#22C55E" />
      <rect x="40" y="40" width="10" height="30" rx="2" fill="#00FF88" />
      <rect x="55" y="25" width="10" height="45" rx="2" fill="#22C55E" />
      {/* Arrow */}
      <path d="M20 70 L85 15 M85 15 L70 15 M85 15 L85 30" stroke="#00FF88" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  </div>
);

const GlowingAnalysisIcon = ({ size = 20, className = "" }: { size?: number, className?: string }) => (
  <div className={`relative flex items-center justify-center ${className}`} style={{ width: size + 10, height: size + 10 }}>
    <div className="absolute inset-0 bg-neon/20 blur-lg rounded-full animate-pulse" />
    <Activity size={size} className="relative text-neon drop-shadow-[0_0_10px_rgba(34,197,94,0.9)]" />
  </div>
);

function AppContent() {
  const { user, loading: authLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [dynamicCurrencies, setDynamicCurrencies] = useState(CURRENCIES);
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem('profit_os_currency');
    return (saved as CurrencyCode) || 'USD';
  });
  const [isConversionActive, setIsConversionActive] = useState(() => {
    const saved = localStorage.getItem('profit_os_conversion_active');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('profit_os_currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('profit_os_conversion_active', String(isConversionActive));
  }, [isConversionActive]);

  // Fetch live rates on mount
  useEffect(() => {
    const updateRates = async () => {
      const liveRates = await fetchExchangeRates();
      if (liveRates) {
        console.log('Live rates fetched:', liveRates);
        setDynamicCurrencies(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(code => {
            if (liveRates[code]) {
              updated[code as CurrencyCode] = {
                ...updated[code as CurrencyCode],
                rate: liveRates[code]
              };
            }
          });
          return updated;
        });
      }
    };
    updateRates();
    // Refresh rates every 1 hour
    const interval = setInterval(updateRates, 3600000);
    return () => clearInterval(interval);
  }, []);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);

  // Fetch orders from Firestore
  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoadingOrders(false);
      return;
    }

    const q = query(collection(db, 'orders'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          ...data, 
          id: doc.id,
          orderId: data.orderId || doc.id.substring(0, 8).toUpperCase(),
          date: data.date ? new Date(data.date) : new Date(),
          price: Number(data.price || 0),
          cost: Number(data.cost || 0),
          shippingCharged: Number(data.shippingCharged || 0),
          shippingReal: Number(data.shippingReal || 0),
          adsCost: Number(data.adsCost || 0),
          platformFee: Number(data.platformFee || 0),
        } as Order;
      });
      
      // If no orders, seed with mock data for the first time
      if (ordersData.length === 0 && loadingOrders) {
        const mock = generateMockData();
        const batch = writeBatch(db);
        mock.forEach(o => {
          const newDoc = doc(collection(db, 'orders'));
          batch.set(newDoc, { 
            ...o, 
            id: newDoc.id,
            uid: user.uid,
            date: o.date.toISOString() 
          });
        });
        batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'orders'));
      }
      
      setOrders(ordersData);
      setLoadingOrders(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    return () => unsubscribe();
  }, [user]);

  const deleteOrders = async (ids: string[]) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      ids.forEach(id => {
        batch.delete(doc(db, 'orders', id));
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'orders');
    }
  };

  const addOrders = async (newOrders: Omit<Order, 'id' | 'uid'>[]) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      newOrders.forEach(o => {
        const newDoc = doc(collection(db, 'orders'));
        const orderDate = o.date instanceof Date && !isNaN(o.date.getTime()) ? o.date : new Date();
        batch.set(newDoc, { 
          ...o, 
          id: newDoc.id,
          uid: user.uid,
          date: orderDate.toISOString() 
        });
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'orders');
    }
  };

  const resetData = async () => {
    if (!user) return;
    try {
      // 1. Delete all current orders
      const batch = writeBatch(db);
      orders.forEach(o => {
        batch.delete(doc(db, 'orders', o.id));
      });
      await batch.commit();

      // 2. Seed with mock data
      const mock = generateMockData();
      const seedBatch = writeBatch(db);
      mock.forEach(o => {
        const newDoc = doc(collection(db, 'orders'));
        seedBatch.set(newDoc, { 
          ...o, 
          id: newDoc.id,
          uid: user.uid,
          date: o.date.toISOString() 
        });
      });
      await seedBatch.commit();

      // 3. Clear calculator local storage
      localStorage.removeItem('ecommil_saved_products');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'orders');
    }
  };

  const clearAllData = async () => {
    if (!user) return;
    try {
      // 1. Delete all current orders
      const batch = writeBatch(db);
      orders.forEach(o => {
        batch.delete(doc(db, 'orders', o.id));
      });
      await batch.commit();

      // 2. Clear calculator local storage
      localStorage.removeItem('ecommil_saved_products');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'orders');
    }
  };

  const clearAIConfig = () => {
    localStorage.removeItem('profit_os_ai_config_v2');
    localStorage.removeItem('profit_os_ai_config');
    window.location.reload(); // Reload to apply changes
  };

  const currencyInfo = dynamicCurrencies[currency];

  const formatCurrency = (amount: number) => {
    const info = dynamicCurrencies[currency];
    
    // Now the internal base is USD.
    // If isConversionActive is ON, we convert from USD to the target currency.
    // If isConversionActive is OFF, we show the raw amount (which is USD).
    
    let converted = amount;
    if (isConversionActive) {
      converted = amount * info.rate;
    }
    
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(converted);
  };

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalNetProfit = 0;
    let totalAds = 0;
    let totalCost = 0;
    let totalShipping = 0;
    
    orders.forEach(order => {
      const { revenue, netProfit } = calculateOrderProfit(order);
      totalRevenue += revenue;
      totalNetProfit += netProfit;
      totalAds += order.adsCost;
      totalCost += order.cost;
      totalShipping += order.shippingReal;
    });

    const margin = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;
    const roas = totalAds > 0 ? totalRevenue / totalAds : 0;
    const roi = (totalCost + totalShipping + totalAds) > 0 
      ? (totalNetProfit / (totalCost + totalShipping + totalAds)) * 100 
      : 0;

    // Health Score calculation
    const returnRate = orders.length > 0 ? (orders.filter(o => o.status === 'Devuelto').length / orders.length) * 100 : 0;
    const healthScore = Math.max(0, Math.min(100, 
      (margin * 2) + (roi / 2) + (100 - returnRate * 5)
    )) || 0;

    return { totalRevenue, totalNetProfit, margin, roas, roi, healthScore };
  }, [orders]);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'kpis', label: 'Análisis Pro', icon: Activity, isGlowing: true },
    { id: 'logistics-ai', label: 'Asesor IA', icon: Bot },
    { id: 'orders', label: 'Pedidos', icon: ShoppingCart },
    { id: 'calculator', label: 'Calculadora', icon: Calculator },
    { id: 'returns', label: 'Devoluciones', icon: RotateCcw },
    { id: 'shipping', label: 'Fletes', icon: Truck },
    { id: 'financial', label: 'Resumen P&L', icon: BarChart3 },
  ];

  const alerts = [
    { id: 1, text: "Tasa de cancelación subió 12% esta semana", type: 'warning' },
    { id: 2, text: "ROI de 'Smartwatch Pro X' bajó un 5%", type: 'danger' },
    { id: 3, text: "Flete a Colombia aumentó promedio $2.5", type: 'info' }
  ];

  if (authLoading || (user && loadingOrders)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neon/20 border-t-neon rounded-full animate-spin" />
          <p className="text-slate-400 font-display text-sm animate-pulse">Sincronizando datos...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarCollapsed ? 80 : 260 }}
        className="border-r border-border bg-card flex flex-col z-20"
      >
        <div className="p-6 flex flex-col items-center gap-4">
          {isSidebarCollapsed ? (
            <>
              <Logo size={32} />
              <button 
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-1.5 rounded-lg bg-background border border-border text-slate-400 hover:text-neon transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3"
              >
                <Logo size={32} />
                <h1 className="text-2xl font-display font-bold text-white tracking-tighter">
                  ECOMM<span className="text-neon">IL</span>
                </h1>
              </motion.div>
              <button 
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1.5 rounded-lg bg-background border border-border text-slate-400 hover:text-neon transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
                activeTab === item.id 
                  ? 'bg-neon/10 text-neon border border-neon/20' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {item.isGlowing ? (
                <div className="relative">
                  <div className={`absolute inset-0 bg-neon/20 blur-md rounded-full transition-opacity ${activeTab === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                  <item.icon size={20} className={`relative ${activeTab === item.id ? 'text-neon drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]' : 'group-hover:text-neon'}`} />
                </div>
              ) : (
                <item.icon size={20} className={activeTab === item.id ? 'text-neon' : 'group-hover:text-neon'} />
              )}
              {!isSidebarCollapsed && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="px-4 mb-2 space-y-2">
          <button
            onClick={() => setActiveTab('research')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
              activeTab === 'research' 
                ? 'bg-neon/10 text-neon border border-neon/20' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Search size={20} className={activeTab === 'research' ? 'text-neon' : 'group-hover:text-neon'} />
            {!isSidebarCollapsed && <span className="font-medium">Investigación</span>}
          </button>
          <button
            onClick={() => setActiveTab('ads')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
              activeTab === 'ads' 
                ? 'bg-neon/10 text-neon border border-neon/20' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Megaphone size={20} className={activeTab === 'ads' ? 'text-neon' : 'group-hover:text-neon'} />
            {!isSidebarCollapsed && <span className="font-medium">Publicidad</span>}
          </button>
          <button
            onClick={() => setActiveTab('platform-expenses')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
              activeTab === 'platform-expenses' 
                ? 'bg-neon/10 text-neon border border-neon/20' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <CreditCard size={20} className={activeTab === 'platform-expenses' ? 'text-neon' : 'group-hover:text-neon'} />
            {!isSidebarCollapsed && <span className="font-medium">Gastos Plataforma</span>}
          </button>
        </div>

        <div className="p-4 border-t border-border">
          <div className={`relative flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-neon/10 border border-neon/30 flex items-center justify-center text-neon font-bold text-sm shadow-[0_0_10px_rgba(34,197,94,0.1)]">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{user?.displayName || 'Usuario'}</p>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => logout()}
                    className="text-[10px] text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1"
                  >
                    <LogOut size={10} /> Cerrar Sesión
                  </button>
                  <button 
                    onClick={() => setActiveTab('settings')}
                    className={`text-[10px] transition-colors flex items-center gap-1 ${activeTab === 'settings' ? 'text-neon' : 'text-slate-500 hover:text-neon'}`}
                  >
                    <SettingsIcon size={10} /> Ajustes
                  </button>
                </div>
              </div>
            )}
            {isSidebarCollapsed && (
              <button 
                onClick={() => setActiveTab('settings')}
                className={`absolute -top-2 -right-2 p-1 rounded-full bg-card border border-border transition-colors ${activeTab === 'settings' ? 'text-neon border-neon' : 'text-slate-500 hover:text-neon'}`}
              >
                <SettingsIcon size={12} />
              </button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-display text-slate-500 uppercase tracking-tighter">Health Score</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.healthScore}%` }}
                    className={`h-full ${stats.healthScore > 70 ? 'bg-neon' : stats.healthScore > 40 ? 'bg-gold' : 'bg-red-500'}`}
                  />
                </div>
                <span className={`text-sm font-mono font-bold ${stats.healthScore > 70 ? 'text-neon' : stats.healthScore > 40 ? 'text-gold' : 'text-red-500'}`}>
                  {Math.round(stats.healthScore || 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-3 py-1 bg-card border border-border rounded-lg">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-slate-500 uppercase leading-none">Conversión</span>
                {isConversionActive && currency !== 'USD' && (
                  <span className="text-[9px] font-mono text-neon/70 leading-none mt-1">
                    1 USD = {dynamicCurrencies[currency].rate.toFixed(2)} {currency}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsConversionActive(!isConversionActive)}
                className={`w-8 h-4 rounded-full relative transition-all ${isConversionActive ? 'bg-neon' : 'bg-slate-700'}`}
                title={isConversionActive ? "Desactivar conversión de moneda" : "Activar conversión en tiempo real"}
              >
                <motion.div
                  animate={{ x: isConversionActive ? 16 : 0 }}
                  className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>

            <div className="flex p-1 bg-card border border-border rounded-lg">
              {(Object.keys(dynamicCurrencies) as CurrencyCode[]).map((code) => (
                <button
                  key={code}
                  onClick={() => setCurrency(code)}
                  className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${
                    currency === code ? 'bg-neon text-background font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>

            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-lg border transition-all relative ${showNotifications ? 'bg-neon/10 border-neon text-neon' : 'bg-card border-border text-slate-400 hover:text-white'}`}
              >
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-card"></span>
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-2xl shadow-2xl p-4 z-50"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-display uppercase tracking-widest text-white font-bold">Alertas Smart</h3>
                      <span className="text-[10px] text-neon bg-neon/10 px-2 py-0.5 rounded-full">3 Nuevas</span>
                    </div>
                    <div className="space-y-3">
                      {alerts.map(alert => (
                        <div key={alert.id} className="p-3 rounded-xl bg-background/50 border border-border/50 hover:border-neon/30 transition-colors">
                          <p className="text-xs text-slate-300 leading-relaxed">{alert.text}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="h-8 w-px bg-border mx-2" />
            <div className="flex items-center gap-3">
              <GlowingAnalysisIcon size={24} />
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-display">Net Profit 30D</p>
                <p className="text-lg font-mono font-bold text-neon">{formatCurrency(stats.totalNetProfit)}</p>
              </div>
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard orders={orders} stats={stats} formatCurrency={formatCurrency} currencySymbol={currencyInfo.symbol} />}
              {activeTab === 'kpis' && <KPIPanel orders={orders} stats={stats} formatCurrency={formatCurrency} />}
              {activeTab === 'logistics-ai' && <LogisticsAI orders={orders} stats={stats} formatCurrency={formatCurrency} />}
            {activeTab === 'orders' && (
              <OrderManagement 
                orders={orders} 
                formatCurrency={formatCurrency} 
                onDeleteOrders={deleteOrders} 
                onAddOrders={addOrders}
                currentCurrency={currency}
                exchangeRate={currencyInfo.rate}
                isConversionActive={isConversionActive}
              />
            )}
              {activeTab === 'calculator' && (
                <ProfitCalculator 
                  formatCurrency={formatCurrency} 
                  currencySymbol={currencyInfo.symbol} 
                  currency={currency}
                  setCurrency={setCurrency}
                  isConversionActive={isConversionActive}
                  currencies={dynamicCurrencies}
                />
              )}
              {activeTab === 'research' && <MarketResearch />}
              {activeTab === 'returns' && <ReturnsAnalysis orders={orders} formatCurrency={formatCurrency} />}
              {activeTab === 'ads' && (
                <AdvertisingExpenses 
                  formatCurrency={formatCurrency} 
                  currency={currency}
                  currencies={dynamicCurrencies}
                  isConversionActive={isConversionActive}
                />
              )}
              {activeTab === 'platform-expenses' && (
                <PlatformExpenses 
                  formatCurrency={formatCurrency} 
                  currencySymbol={currencyInfo.symbol} 
                  currency={currency}
                  currencies={dynamicCurrencies}
                />
              )}
              {activeTab === 'shipping' && <ShippingAnalysis orders={orders} formatCurrency={formatCurrency} />}
              {activeTab === 'financial' && (
                <div className="space-y-6">
                  <FinancialSummary 
                    orders={orders} 
                    formatCurrency={formatCurrency} 
                  />
                </div>
              )}
              {activeTab === 'settings' && (
                <Settings 
                  onResetData={resetData} 
                  onClearAllData={clearAllData} 
                  onClearAIConfig={clearAIConfig}
                  currency={currency}
                  setCurrency={setCurrency}
                  isConversionActive={isConversionActive}
                  setIsConversionActive={setIsConversionActive}
                  currencies={dynamicCurrencies}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
