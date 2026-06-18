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
  Activity,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isFirebaseConfigValid } from './firebase';
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
import SalesManagement from './components/SalesManagement';
import { FloatingAIAssistant } from './components/FloatingAIAssistant';
import { AuthProvider, AuthScreen, useAuth } from './components/Auth';
import ErrorBoundary from './components/ErrorBoundary';
import { Logo } from './components/Logo';

const GlowingAnalysisIcon = ({ size = 20, className = "" }: { size?: number, className?: string }) => (
  <div className={`relative flex items-center justify-center ${className}`} style={{ width: size + 10, height: size + 10 }}>
    <div className="absolute inset-0 bg-neon/20 blur-lg rounded-full animate-pulse" />
    <Activity size={size} className="relative text-neon drop-shadow-[0_0_10px_rgba(34,197,94,0.9)]" />
  </div>
);

function AppContent() {
  const { user, loading: authLoading, logout, isDemoMode } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [dynamicCurrencies, setDynamicCurrencies] = useState(CURRENCIES);
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem('profit_os_currency');
    return (saved as CurrencyCode) || 'PEN';
  });
  const [isConversionActive, setIsConversionActive] = useState(() => {
    const saved = localStorage.getItem('profit_os_conversion_active');
    return saved !== 'false'; // Default to true if not explicitly false
  });
  const [manualAdSpend, setManualAdSpend] = useState(() => {
    const saved = localStorage.getItem('profit_os_manual_ad_spend');
    return saved ? Number(saved) : 0;
  });

  const [theme, setTheme] = useState<'theme-light-white' | 'theme-dark-green' | 'theme-dark-blue'>(() => {
    const saved = localStorage.getItem('profit_os_theme');
    return (saved as any) || 'theme-dark-green';
  });

  useEffect(() => {
    localStorage.setItem('profit_os_theme', theme);
    // Remove previous theme classes and apply the active one
    const root = document.documentElement;
    root.classList.remove('theme-light-white', 'theme-dark-green', 'theme-dark-blue');
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('profit_os_currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('profit_os_manual_ad_spend', String(manualAdSpend));
  }, [manualAdSpend]);

  useEffect(() => {
    localStorage.setItem('profit_os_conversion_active', String(isConversionActive));
  }, [isConversionActive]);

  const [currencyError, setCurrencyError] = useState(false);

  // Fetch live rates on mount
  useEffect(() => {
    const updateRates = async () => {
      const liveRates = await fetchExchangeRates();
      if (liveRates) {
        setCurrencyError(false);
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
      } else {
        setCurrencyError(true);
      }
    };
    updateRates();
    // Refresh rates every 1 hour
    const interval = setInterval(updateRates, 3600000);
    return () => clearInterval(interval);
  }, []);

  const [orders, setOrders] = useState<Order[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);

  const activeTabContentRef = useRef<HTMLDivElement>(null);

  // Scroll mobile active tab into view and reset scroll position of the content
  useEffect(() => {
    const timer = setTimeout(() => {
      const activeEl = document.getElementById(`mobile-tab-${activeTab}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }, 100);

    if (activeTabContentRef.current) {
      activeTabContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

    return () => clearTimeout(timer);
  }, [activeTab]);

  // Fetch orders from Firestore
  useEffect(() => {
    if (!user || isDemoMode || !isFirebaseConfigValid) {
      setOrders(generateMockData());
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

  // Fetch sale periods from Firestore for global stats
  useEffect(() => {
    if (!user || isDemoMode || !isFirebaseConfigValid) return;

    const q = query(collection(db, 'salePeriods'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const periodsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      setPeriods(periodsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'salePeriods');
    });

    return () => unsubscribe();
  }, [user]);

  const deleteOrders = async (ids: string[]) => {
    if (!user) return;
    
    if (isDemoMode || !isFirebaseConfigValid) {
      setOrders(prev => prev.filter(o => !ids.includes(o.id)));
      return;
    }

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

    if (isDemoMode || !isFirebaseConfigValid) {
      const ordersWithIds = newOrders.map(o => ({
        ...o,
        id: Math.random().toString(36).substring(2, 9),
        uid: user.uid,
        orderId: o.orderId || Math.random().toString(36).substring(2, 7).toUpperCase()
      }));
      setOrders(prev => [...ordersWithIds, ...prev]);
      return;
    }

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

    if (isDemoMode || !isFirebaseConfigValid) {
      setOrders(generateMockData());
      localStorage.removeItem('ecommil_saved_products');
      return;
    }

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

    if (isDemoMode || !isFirebaseConfigValid) {
      setOrders([]);
      localStorage.removeItem('ecommil_saved_products');
      return;
    }

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
    if (currency === 'USD') return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);

    const info = dynamicCurrencies[currency];
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

  const stats = useMemo(() => {
    const rate = isConversionActive ? (dynamicCurrencies[currency]?.rate || 1) : 1;
    // VERY IMPORTANT: manualAdSpend is stored in the DISPLAY currency in state/localStorage,
    // so we must divide it by rate to convert to our internal base currency (USD).
    const manualAdSpendInUSD = manualAdSpend > 0 ? (manualAdSpend / rate) : 0;

    // If we have manual periods and NO orders, they are the source of truth for high-level KPIs
    if (orders.length === 0 && periods.length > 0) {
      const totalRevenue = 0; // SalePeriods don't have revenue directly, usually withdrawal bank is the proxy for "money in"
      // But orders are better for revenue if they exist.
      // However, for percentages, we use periods.
      
      const sumAds = periods.reduce((acc, p) => acc + (p.adsSpend || 0), 0);
      const totalWithdrawalBank = periods.reduce((acc, p) => acc + (p.withdrawalBank || 0), 0);
      const totalExpenses = periods.reduce((acc, p) => acc + (p.platformExpenses || 0), 0);
      
      const totalShopify = periods.reduce((acc, p) => acc + (p.shopifyOrders || 0), 0);
      const totalDropiOrders = periods.reduce((acc, p) => acc + (p.dropiOrders || 0), 0);
      const totalReturned = periods.reduce((acc, p) => acc + (p.returnedOrders || 0), 0);
      const totalDelivered = periods.reduce((acc, p) => acc + (p.deliveredOrders || 0), 0);
      
      const returnRate = totalDropiOrders > 0 ? (totalReturned / totalDropiOrders) * 100 : 0;
      const deliveredRate = totalDropiOrders > 0 ? (totalDelivered / totalDropiOrders) * 100 : 0;
      
      // Calculate revenue from orders for the dashboard card
      let ordersRevenue = 0;
      orders.forEach(o => {
        ordersRevenue += calculateOrderProfit(o).revenue;
      });

      const usedAds = manualAdSpend > 0 ? manualAdSpendInUSD : sumAds;
      const finalNetProfit = totalWithdrawalBank - usedAds - totalExpenses;
      
      const margin = ordersRevenue > 0 ? (finalNetProfit / ordersRevenue) * 100 : 0;
      const roas = usedAds > 0 ? ordersRevenue / usedAds : 0;

      return {
        totalRevenue: ordersRevenue,
        totalNetProfit: finalNetProfit,
        margin,
        roas,
        roi: 0, // Simplified for now
        healthScore: 70,
        totalAds: usedAds,
        autoAds: sumAds,
        returnRate // Expose return rate for Dashboard alerts
      };
    }

    let totalRevenue = 0;
    let totalNetProfit = 0;
    let sumAds = 0;
    let totalCost = 0;
    let totalShipping = 0;
    
    orders.forEach(order => {
      const { revenue, netProfit } = calculateOrderProfit(order);
      totalRevenue += revenue;
      totalNetProfit += netProfit;
      sumAds += order.adsCost;
      totalCost += order.cost;
      totalShipping += order.shippingReal;
    });

    const usedAds = manualAdSpend > 0 ? manualAdSpendInUSD : sumAds;
    const finalNetProfit = manualAdSpend > 0 
      ? (totalNetProfit + sumAds - manualAdSpendInUSD) 
      : totalNetProfit;

    const margin = totalRevenue > 0 ? (finalNetProfit / totalRevenue) * 100 : 0;
    const roas = usedAds > 0 ? totalRevenue / usedAds : 0;
    const roi = (totalCost + totalShipping + usedAds) > 0 
      ? (finalNetProfit / (totalCost + totalShipping + usedAds)) * 100 
      : 0;

    const returnRate = orders.length > 0 ? (orders.filter(o => o.status === 'Devuelto').length / orders.length) * 100 : 0;
    const healthScore = Math.max(0, Math.min(100, 
      (margin * 2) + (roi / 2) + (100 - returnRate * 5)
    )) || 0;

    return { 
      totalRevenue, 
      totalNetProfit: finalNetProfit, 
      margin, 
      roas, 
      roi, 
      healthScore,
      totalAds: usedAds,
      autoAds: sumAds,
      returnRate
    };
  }, [orders, periods, manualAdSpend, currency, isConversionActive, dynamicCurrencies]);

  const menuItems = [
    { id: 'dashboard', label: 'Panel Control', icon: LayoutDashboard },
    { id: 'kpis', label: 'Análisis Pro', icon: Activity, isGlowing: true },
    { id: 'logistics-ai', label: 'Asesor IA', icon: Bot },
    { id: 'orders', label: 'DROPI', icon: ShoppingCart },
    { id: 'shopify', label: 'SHOPIFY', icon: Globe },
    { id: 'consiliador-pro', label: 'TIKTOK PANEL', icon: Zap, isGlowing: true },
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
      {/* Sidebar - hidden on mobile, visible on desktop */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarCollapsed ? 80 : 260 }}
        className="hidden md:flex border-r border-border bg-card flex-col z-20"
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
            onClick={() => setActiveTab('sales')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
              activeTab === 'sales' 
                ? 'bg-neon/10 text-neon border border-neon/20' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <TrendingUp size={20} className={activeTab === 'sales' ? 'text-neon' : 'group-hover:text-neon'} />
            {!isSidebarCollapsed && <span className="font-medium">Ventas</span>}
          </button>
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
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-4 md:px-8 z-10">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-display text-slate-500 uppercase tracking-tighter">Health Score</span>
              <div className="flex items-center gap-2">
                <div className="w-16 sm:w-24 h-1.5 bg-border rounded-full overflow-hidden hidden sm:block">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.healthScore}%` }}
                    className={`h-full ${stats.healthScore > 70 ? 'bg-neon' : stats.healthScore > 40 ? 'bg-gold' : 'bg-red-500'}`}
                  />
                </div>
                <span className={`text-xs sm:text-sm font-mono font-bold ${stats.healthScore > 70 ? 'text-neon' : stats.healthScore > 40 ? 'text-gold' : 'text-red-500'}`}>
                  {Math.round(stats.healthScore || 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-mono text-slate-500 uppercase leading-none mb-1 hidden sm:inline">Visualización General</span>
              <div className="flex items-center gap-1.5 sm:gap-2 bg-card/50 border border-border rounded-xl p-1 shadow-inner backdrop-blur-sm">
                <div className="flex bg-background rounded-lg p-0.5 border border-border/50">
                  <button
                    onClick={() => setIsConversionActive(false)}
                    className={`px-2 sm:px-3 py-1 rounded-md text-[9px] sm:text-[10px] font-black tracking-widest transition-all ${
                      !isConversionActive 
                        ? 'bg-red-500/20 text-red-500 border border-red-500/30' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    USD
                  </button>
                  <button
                    onClick={() => setIsConversionActive(true)}
                    className={`px-2 sm:px-3 py-1 rounded-md text-[9px] sm:text-[10px] font-black tracking-widest transition-all ${
                      isConversionActive 
                        ? 'bg-neon/20 text-neon border border-neon/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    CONV
                  </button>
                </div>

                {isConversionActive && (
                  <div className="flex gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-background rounded-lg border border-border/50 animate-in fade-in slide-in-from-right-1">
                    {(['PEN', 'GTQ'] as CurrencyCode[]).map((code) => (
                      <button
                        key={code}
                        onClick={() => setCurrency(code)}
                        className={`px-1.5 sm:px-2 py-1 rounded-md text-[9px] sm:text-[10px] font-mono font-bold transition-all ${
                          currency === code ? 'bg-neon/10 text-neon border border-neon/30' : 'text-slate-500 hover:text-white'
                        }`}
                      >
                        {code === 'PEN' ? 'S/' : 'Q'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isConversionActive && (
                <div className="flex flex-col items-end mt-1 animate-in fade-in slide-in-from-top-1">
                   {currencyError ? (
                     <div className="flex items-center gap-1 text-[8px] text-amber-500 font-bold bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20">
                       Offline
                     </div>
                   ) : (
                     <div className="flex items-center gap-1">
                       <Globe size={8} className="text-neon animate-spin-slow" />
                       <span className="text-[8px] sm:text-[10px] font-mono text-neon/70 font-bold">
                        1 = {dynamicCurrencies[currency].rate.toFixed(2)} {currency}
                       </span>
                     </div>
                   )}
                </div>
              )}
            </div>

            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-1.5 sm:p-2 rounded-lg border transition-all relative ${showNotifications ? 'bg-neon/10 border-neon text-neon' : 'bg-card border-border text-slate-400 hover:text-white'}`}
              >
                <Bell size={16} />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full border border-card"></span>
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in-50 duration-200"
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
            
            <div className="h-6 w-px bg-border mx-1 md:mx-2" />
            
            <div className="flex items-center gap-1.5 sm:gap-3">
              <div className="hidden sm:block">
                <GlowingAnalysisIcon size={20} />
              </div>
              <div className="text-right">
                <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-slate-500 font-display">Net Profit</p>
                <p className="text-xs sm:text-base font-mono font-bold text-neon">{formatCurrency(stats.totalNetProfit)}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Horizontal Navigation (No Icons on Mobile - Highly Optimized) */}
        <div className="md:hidden bg-[#0A0A0A] border-b border-border/60 py-2.5 px-4 flex gap-2 overflow-x-auto scrollbar-none shrink-0" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          {[
            ...menuItems,
            { id: 'sales', label: 'Ventas' },
            { id: 'research', label: 'Investigación' },
            { id: 'ads', label: 'Publicidad' },
            { id: 'platform-expenses', label: 'Gastos Plataforma' },
            { id: 'settings', label: 'Ajustes' }
          ].map((item) => (
            <button
              key={item.id}
              id={`mobile-tab-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-xl text-xs font-display transition-all duration-200 ${
                activeTab === item.id 
                  ? 'bg-neon/10 text-neon border border-neon/30 font-bold shadow-[0_0_15px_rgba(34,197,94,0.1)]' 
                  : 'text-slate-400 bg-card/20 border border-transparent hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* View Content */}
        <div ref={activeTabContentRef} className="flex-1 overflow-y-auto p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && (
                <Dashboard 
                  orders={orders} 
                  stats={stats} 
                  formatCurrency={formatCurrency} 
                  currencySymbol={currencyInfo.symbol} 
                  currency={currency}
                  currencies={dynamicCurrencies}
                  isConversionActive={isConversionActive}
                  manualAdSpend={manualAdSpend}
                  setManualAdSpend={setManualAdSpend}
                />
              )}
              {activeTab === 'kpis' && (
                <KPIPanel 
                  orders={orders} 
                  stats={stats} 
                  formatCurrency={formatCurrency} 
                  currency={currency}
                  currencies={dynamicCurrencies}
                  isConversionActive={isConversionActive}
                  manualAdSpend={manualAdSpend}
                  setManualAdSpend={setManualAdSpend}
                />
              )}
              {activeTab === 'logistics-ai' && (
                <LogisticsAI 
                  orders={orders} 
                  stats={stats} 
                  formatCurrency={formatCurrency} 
                  currency={currency}
                  currencies={dynamicCurrencies}
                  isConversionActive={isConversionActive}
                />
              )}
      {activeTab === 'orders' && (
                <OrderManagement 
                  orders={orders} 
                  setOrders={setOrders}
                  formatCurrency={formatCurrency} 
                  onDeleteOrders={deleteOrders} 
                  onAddOrders={addOrders}
                  currentCurrency={currency}
                  exchangeRate={currencyInfo.rate}
                  isConversionActive={isConversionActive}
                  viewMode="DROPI"
                />
              )}
              {activeTab === 'shopify' && (
                <OrderManagement 
                  orders={orders} 
                  setOrders={setOrders}
                  formatCurrency={formatCurrency} 
                  onDeleteOrders={deleteOrders} 
                  onAddOrders={addOrders}
                  currentCurrency={currency}
                  exchangeRate={currencyInfo.rate}
                  isConversionActive={isConversionActive}
                  viewMode="SHOPIFY"
                />
              )}
              {activeTab === 'consiliador-pro' && (
                <OrderManagement 
                  orders={orders} 
                  setOrders={setOrders}
                  formatCurrency={formatCurrency} 
                  onDeleteOrders={deleteOrders} 
                  onAddOrders={addOrders}
                  currentCurrency={currency}
                  exchangeRate={currencyInfo.rate}
                  isConversionActive={isConversionActive}
                  viewMode="TIKTOK"
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
              {activeTab === 'sales' && (
                <SalesManagement 
                  formatCurrency={formatCurrency} 
                  currency={currency}
                  isConversionActive={isConversionActive}
                  currencies={dynamicCurrencies}
                />
              )}
              {activeTab === 'research' && <MarketResearch />}
              {activeTab === 'returns' && (
                <ReturnsAnalysis 
                  orders={orders} 
                  formatCurrency={formatCurrency} 
                  currency={currency}
                  currencies={dynamicCurrencies}
                  isConversionActive={isConversionActive}
                />
              )}
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
                  isConversionActive={isConversionActive}
                />
              )}
              {activeTab === 'shipping' && (
                <ShippingAnalysis 
                  orders={orders} 
                  formatCurrency={formatCurrency} 
                  currency={currency}
                  currencies={dynamicCurrencies}
                  isConversionActive={isConversionActive}
                />
              )}
              {activeTab === 'financial' && (
                <div className="space-y-6">
                  <FinancialSummary 
                    orders={orders} 
                    formatCurrency={formatCurrency} 
                    currency={currency}
                    currencies={dynamicCurrencies}
                    isConversionActive={isConversionActive}
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
                  theme={theme}
                  setTheme={setTheme}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Global State-Aware voice guided AI Assistant */}
      <FloatingAIAssistant
        orders={orders}
        stats={stats}
        periods={periods}
        formatCurrency={formatCurrency}
        currency={currency}
        currencies={dynamicCurrencies}
        isConversionActive={isConversionActive}
        activeTab={activeTab}
      />
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
