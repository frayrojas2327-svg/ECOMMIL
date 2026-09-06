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
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ArrowDown,
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
  Zap,
  Calendar,
  Filter,
  StickyNote,
  Pin
} from 'lucide-react';
import { parseISO, startOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isFirebaseConfigValid } from './firebase';
import { generateMockData, CURRENCIES, CurrencyCode, Order, calculateOrderProfit, OrderStatus, parseFlexibleDate } from './mockData';
import { fetchExchangeRates } from './services/currencyService';
import Dashboard from './components/Dashboard';
import OrderManagement from './components/OrderManagement';
import ProfitCalculator from './components/ProfitCalculator';
import ReturnsAnalysis from './components/ReturnsAnalysis';
import ShippingAnalysis from './components/ShippingAnalysis';
import FinancialSummary from './components/FinancialSummary';
import AdvertisingExpenses from './components/AdvertisingExpenses';
import MarketResearch from './components/MarketResearch';
import AdPanel from './components/AdPanel';
import NotesSection from './components/NotesSection';
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
    const migrated = localStorage.getItem('profit_os_theme_migrated_v2');
    if (!migrated) {
      localStorage.setItem('profit_os_theme_migrated_v2', 'true');
      localStorage.setItem('profit_os_theme', 'theme-light-white');
      return 'theme-light-white';
    }
    return (saved as any) || 'theme-light-white';
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

  // Sidebar Scroll states and controls
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const [sidebarCanScrollDown, setSidebarCanScrollDown] = useState(true);
  const [sidebarCanScrollUp, setSidebarCanScrollUp] = useState(false);

  const checkSidebarScroll = () => {
    if (sidebarScrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = sidebarScrollRef.current;
      setSidebarCanScrollUp(scrollTop > 20);
      setSidebarCanScrollDown(scrollTop + clientHeight < scrollHeight - 20);
    }
  };

  const handleSidebarScroll = () => {
    checkSidebarScroll();
  };

  const scrollSidebarDown = () => {
    if (sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollBy({ top: 220, behavior: 'smooth' });
      setTimeout(checkSidebarScroll, 300);
    }
  };

  const scrollSidebarUp = () => {
    if (sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollBy({ top: -220, behavior: 'smooth' });
      setTimeout(checkSidebarScroll, 300);
    }
  };

  const scrollSidebarToBottom = () => {
    if (sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollTo({ top: sidebarScrollRef.current.scrollHeight, behavior: 'smooth' });
      setTimeout(checkSidebarScroll, 300);
    }
  };

  const scrollSidebarToTop = () => {
    if (sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(checkSidebarScroll, 300);
    }
  };

  useEffect(() => {
    checkSidebarScroll();
    window.addEventListener('resize', checkSidebarScroll);
    const timer = setTimeout(checkSidebarScroll, 500);
    return () => {
      window.removeEventListener('resize', checkSidebarScroll);
      clearTimeout(timer);
    };
  }, [isSidebarCollapsed, activeTab]);

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

  // Shared Month/Year selection state across components (e.g. FinancialSummary, AdvertisingExpenses)
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

  const [selectedYear, setSelectedYear] = useState<string>(() => {
    const now = new Date();
    return now.getFullYear().toString();
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return String(now.getMonth() + 1).padStart(2, '0');
  });

  useEffect(() => {
    if (defaultYearMonth.year && defaultYearMonth.month) {
      setSelectedYear(defaultYearMonth.year);
      setSelectedMonth(defaultYearMonth.month);
    }
  }, [defaultYearMonth]);

  const [fixedExpenses, setFixedExpenses] = useState<any[]>(() => {
    const saved = localStorage.getItem('ecommil_fixed_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  const [variableExpenses, setVariableExpenses] = useState<any[]>(() => {
    const saved = localStorage.getItem('ecommil_variable_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('ecommil_fixed_expenses', JSON.stringify(fixedExpenses));
  }, [fixedExpenses]);

  useEffect(() => {
    localStorage.setItem('ecommil_variable_expenses', JSON.stringify(variableExpenses));
  }, [variableExpenses]);

  // Global Product Filter states
  const [globalProductFilter, setGlobalProductFilter] = useState<string>('all');

  const globalUniqueProducts = useMemo(() => {
    const productsSet = new Set<string>();
    orders.forEach(o => {
      if (o.product) {
        productsSet.add(o.product);
      }
    });
    return Array.from(productsSet).sort();
  }, [orders]);

  // Global Date Range Filter states
  const [globalStartDate, setGlobalStartDate] = useState<string>(() => {
    return localStorage.getItem('ecommil_global_start_date') || '';
  });
  const [globalEndDate, setGlobalEndDate] = useState<string>(() => {
    return localStorage.getItem('ecommil_global_end_date') || '';
  });
  const [globalDateFilterType, setGlobalDateFilterType] = useState<'solicitud' | 'entrega_devolucion' | 'registro'>(() => {
    return (localStorage.getItem('ecommil_global_date_type') as any) || 'solicitud';
  });

  // Pending states for manual "Filtrar" button trigger
  const [pendingStartDate, setPendingStartDate] = useState<string>(globalStartDate);
  const [pendingEndDate, setPendingEndDate] = useState<string>(globalEndDate);
  const [pendingDateFilterType, setPendingDateFilterType] = useState<'solicitud' | 'entrega_devolucion' | 'registro'>(globalDateFilterType);

  useEffect(() => {
    setPendingStartDate(globalStartDate);
  }, [globalStartDate]);

  useEffect(() => {
    setPendingEndDate(globalEndDate);
  }, [globalEndDate]);

  useEffect(() => {
    setPendingDateFilterType(globalDateFilterType);
  }, [globalDateFilterType]);

  useEffect(() => {
    localStorage.setItem('ecommil_global_start_date', globalStartDate);
  }, [globalStartDate]);

  useEffect(() => {
    localStorage.setItem('ecommil_global_end_date', globalEndDate);
  }, [globalEndDate]);

  useEffect(() => {
    localStorage.setItem('ecommil_global_date_type', globalDateFilterType);
  }, [globalDateFilterType]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (globalProductFilter !== 'all') {
      if (globalProductFilter === 'sin_producto') {
        result = result.filter(o => !o.product || o.product.trim() === '' || o.product.toLowerCase().trim() === 'sin producto');
      } else {
        result = result.filter(o => o.product === globalProductFilter);
      }
    }

    const startDateObj = globalStartDate ? parseFlexibleDate(globalStartDate) : null;
    const endDateObj = globalEndDate ? parseFlexibleDate(globalEndDate) : null;
    const startTime = startDateObj ? startOfDay(startDateObj).getTime() : null;
    const endTime = endDateObj ? startOfDay(endDateObj).getTime() : null;

    return result.filter(o => {
      let orderDate: Date | null = null;
      if (globalDateFilterType === 'solicitud') {
        if (o.fechaSolicitud) {
          const parsed = parseFlexibleDate(o.fechaSolicitud);
          if (parsed && !isNaN(parsed.getTime())) {
            orderDate = parsed;
          }
        }
        if (!orderDate) {
          orderDate = o.date ? parseFlexibleDate(o.date) : null;
        }
      } else if (globalDateFilterType === 'entrega_devolucion') {
        if (o.fechaEntregaDevolucion) {
          const parsed = parseFlexibleDate(o.fechaEntregaDevolucion);
          if (parsed && !isNaN(parsed.getTime())) {
            orderDate = parsed;
          }
        }
        if (!orderDate) {
          orderDate = o.date ? parseFlexibleDate(o.date) : null;
        }
      } else {
        orderDate = o.date ? parseFlexibleDate(o.date) : null;
      }

      // If we have date filters active but no order date could be resolved, exclude it
      if ((startTime !== null || endTime !== null) && !orderDate) {
        return false;
      }

      if (orderDate) {
        const orderTime = startOfDay(orderDate).getTime();
        if (startTime !== null && orderTime < startTime) return false;
        if (endTime !== null && orderTime > endTime) return false;
      }
      return true;
    });
  }, [orders, globalStartDate, globalEndDate, globalDateFilterType, globalProductFilter]);

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

  // Pomodoro Global States (persistent across panel navigation)
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timeRemaining, setTimeRemaining] = useState(25 * 60);
  const [timerIsActive, setTimerIsActive] = useState(false);
  const [timerMode, setTimerMode] = useState<'work' | 'break'>('work');
  const [focusTask, setFocusTask] = useState('Busca nuevos productos');
  const [completedPomodoros, setCompletedPomodoros] = useState<number>(() => {
    const saved = localStorage.getItem('ecommil_completed_pomodoros');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Desktop Notifications Permission & Triggering
  const [notificationPermission, setNotificationPermission] = useState<string>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
          try {
            new Notification('🔔 Notificaciones de PC activadas', {
              body: 'Te avisaremos con alertas visuales en tu computadora al finalizar tus temporizadores.',
              icon: 'https://cdn-icons-png.flaticon.com/512/3602/3602123.png'
            });
          } catch (e) {
            console.error('Error triggering permission confirmation:', e);
          }
        }
      } catch (error) {
        console.error('Error requesting notification permission:', error);
      }
    }
  };

  const showDesktopNotification = (title: string, body: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: 'https://cdn-icons-png.flaticon.com/512/3602/3602123.png',
          requireInteraction: true // Keep it open until clicked/dismissed so they don't miss it
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (e) {
        console.error('Error creating desktop notification:', e);
      }
    }
  };

  // Loud and distinct sound pattern on timer completion (Triangle wave, loud and clear)
  const playCompletionSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBeep = (startTime: number, duration: number, frequency: number) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'triangle'; // Triangle is warmer and much louder than sine
        oscillator.frequency.setValueAtTime(frequency, startTime);
        
        // Loud envelope that ramps up and stays at high volume (0.85) then fades out quickly
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.85, startTime + 0.04);
        gainNode.gain.setValueAtTime(0.85, startTime + duration - 0.04);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioCtx.currentTime;
      // High frequency double triple-beep rhythm so it is extremely noticeable
      playBeep(now, 0.20, 880);         // Beep 1 (A5)
      playBeep(now + 0.25, 0.20, 880);    // Beep 2 (A5)
      playBeep(now + 0.50, 0.20, 880);    // Beep 3 (A5)
      playBeep(now + 0.75, 0.45, 1200);   // Beep 4 (Higher pitch & longer)
    } catch (e) {
      console.error('Error playing notification sound:', e);
    }
  };

  // Pomodoro Interval Timer Tick
  useEffect(() => {
    let interval: any = null;
    if (timerIsActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    } else if (timeRemaining === 0 && timerIsActive) {
      setTimerIsActive(false);
      playCompletionSound();
      if (timerMode === 'work') {
        const newCount = completedPomodoros + 1;
        setCompletedPomodoros(newCount);
        localStorage.setItem('ecommil_completed_pomodoros', String(newCount));
        setTimerMode('break');
        setTimerMinutes(5);
        setTimeRemaining(5 * 60);
        showDesktopNotification('🎯 ¡Sesión Pomodoro Terminada!', 'Tómate un descanso de 5 minutos.');
        alert('🎯 ¡Sesión Pomodoro Terminada! Tómate un descanso de 5 minutos.');
      } else {
        setTimerMode('work');
        setTimerMinutes(25);
        setTimeRemaining(25 * 60);
        showDesktopNotification('💪 ¡Descanso Terminado!', 'De vuelta al enfoque.');
        alert('💪 ¡Descanso Terminado! De vuelta al enfoque.');
      }
    }
    return () => clearInterval(interval);
  }, [timerIsActive, timeRemaining, timerMode, completedPomodoros]);

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
        const oDate = data.date ? new Date(data.date) : new Date();
        
        // Normalize status for total consistency across Semáforo and KPI panels
        const rawStatus = String(data.status || 'Pendiente').trim();
        let normalizedStatus: OrderStatus = 'Pendiente';
        const sLower = rawStatus.toLowerCase();
        if (sLower === 'entregado' || sLower === 'exitoso' || sLower === 'finalizado' || sLower === 'cod pagado') {
          normalizedStatus = 'Entregado';
        } else if (sLower === 'devuelto' || sLower === 'devolución' || sLower === 'devolucion' || sLower === 'retorno') {
          normalizedStatus = 'Devuelto';
        } else if (sLower === 'cancelado' || sLower === 'anulado') {
          normalizedStatus = 'Cancelado';
        } else if (sLower === 'incidencia' || sLower === 'novedad') {
          normalizedStatus = 'Incidencia';
        } else if (sLower === 'en tránsito' || sLower === 'en transito' || sLower === 'transito' || sLower === 'despachado') {
          normalizedStatus = 'En tránsito';
        } else if (sLower === 'guía generada' || sLower === 'guia generada') {
          normalizedStatus = 'Guía Generada';
        } else if (sLower === 'recolectado') {
          normalizedStatus = 'Recolectado';
        } else {
          normalizedStatus = (data.status || 'Pendiente') as OrderStatus;
        }

        return { 
          ...data, 
          id: doc.id,
          status: normalizedStatus,
          orderId: data.orderId || doc.id.substring(0, 8).toUpperCase(),
          date: oDate,
          originalDate: data.originalDate ? new Date(data.originalDate) : oDate,
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
    if (filteredOrders.length === 0 && periods.length > 0) {
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
      filteredOrders.forEach(o => {
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
    
    filteredOrders.forEach(order => {
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

    const returnRate = filteredOrders.length > 0 ? (filteredOrders.filter(o => o.status === 'Devuelto').length / filteredOrders.length) * 100 : 0;
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
  }, [filteredOrders, periods, manualAdSpend, currency, isConversionActive, dynamicCurrencies]);

  const menuItems = [
    { id: 'dashboard', label: 'Panel Control', icon: LayoutDashboard },
    { id: 'kpis', label: 'Análisis Pro', icon: Activity, isGlowing: true },
    { id: 'logistics-ai', label: 'Asesor IA', icon: Bot },
    { id: 'orders', label: 'DROPI', icon: ShoppingCart },
    { id: 'returns', label: 'Devoluciones', icon: RotateCcw },
    { id: 'shipping', label: 'Semáforos de Transportadora', icon: Truck },
    { id: 'financial', label: 'Resumen P&L', icon: BarChart3 },
  ];

  const secondaryMenuItems = useMemo(() => [
    { id: 'sales', label: 'Ventas', icon: TrendingUp },
    { id: 'research', label: 'Investigación', icon: Search },
    { id: 'calculator', label: 'Calculadora', icon: Calculator },
    { id: 'ad-panel', label: 'Panel Ads', icon: TrendingUp },
    { id: 'notes', label: 'Notas', icon: StickyNote },
    { id: 'ads', label: 'Publicidad', icon: Megaphone },
    { id: 'platform-expenses', label: 'Gastos Plataforma', icon: CreditCard },
  ], []);

  const allNavItems = useMemo(() => [
    ...menuItems,
    ...secondaryMenuItems
  ], [secondaryMenuItems]);

  const [pinnedTools, setPinnedTools] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ecommil_pinned_tools');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error loading pinned tools:', e);
    }
    return [];
  });

  const togglePinTool = (toolId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPinnedTools(prev => {
      const next = prev.includes(toolId) 
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId];
      localStorage.setItem('ecommil_pinned_tools', JSON.stringify(next));
      return next;
    });
  };

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
        <div className="p-6 flex flex-col items-center gap-4 border-b border-border/50">
          {isSidebarCollapsed ? (
            <>
              <Logo size={32} />
              <div className="flex flex-col gap-1.5 items-center">
                <button 
                  onClick={() => setIsSidebarCollapsed(false)}
                  title="Expandir menú"
                  className="p-1.5 rounded-lg bg-background border border-border text-slate-400 hover:text-neon transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={sidebarCanScrollDown ? scrollSidebarDown : scrollSidebarToTop}
                  title={sidebarCanScrollDown ? "Desplazar panel hacia abajo" : "Volver arriba"}
                  className="p-1.5 rounded-lg bg-background/80 border border-border text-slate-400 hover:text-neon hover:border-neon/40 transition-colors"
                >
                  {sidebarCanScrollDown ? <ChevronDown size={14} className="animate-bounce" /> : <ChevronUp size={14} />}
                </button>
              </div>
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
              <div className="flex items-center gap-1.5">
                <button
                  onClick={sidebarCanScrollDown ? scrollSidebarDown : scrollSidebarToTop}
                  title={sidebarCanScrollDown ? "Desplazar panel hacia abajo" : "Volver arriba"}
                  className="p-1.5 rounded-lg bg-background/80 border border-border text-slate-400 hover:text-neon hover:border-neon/40 transition-colors flex items-center justify-center"
                >
                  {sidebarCanScrollDown ? <ChevronDown size={16} className="text-neon animate-bounce" /> : <ChevronUp size={16} />}
                </button>
                <button 
                  onClick={() => setIsSidebarCollapsed(true)}
                  title="Colapsar menú"
                  className="p-1.5 rounded-lg bg-background border border-border text-slate-400 hover:text-neon transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Navigation Area */}
        <div 
          ref={sidebarScrollRef}
          onScroll={handleSidebarScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-1.5 relative scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-neon/30"
          style={{ scrollBehavior: 'smooth' }}
        >
          {/* SECCIÓN DE HERRAMIENTAS FIJADAS (si hay alguna fijada) */}
          {pinnedTools.length > 0 && (
            <div className="pb-2.5 mb-2 border-b border-border/50 space-y-1">
              {!isSidebarCollapsed ? (
                <div className="px-2 py-1 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  <span className="flex items-center gap-1.5 text-neon">
                    <Pin size={11} className="fill-neon" /> Herramientas Fijadas
                  </span>
                  <span className="text-[9px] bg-neon/15 text-neon px-1.5 py-0.2 rounded-full font-bold">
                    {pinnedTools.length}
                  </span>
                </div>
              ) : (
                <div className="flex justify-center pb-1" title="Herramientas Fijadas">
                  <Pin size={12} className="text-neon fill-neon" />
                </div>
              )}
              {pinnedTools.map(pinId => {
                const item = allNavItems.find(i => i.id === pinId);
                if (!item) return null;
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <div
                    key={`pinned-${item.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveTab(item.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(item.id); } }}
                    title={isSidebarCollapsed ? `Fijado: ${item.label}` : undefined}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 group relative cursor-pointer select-none ${
                      isActive 
                        ? 'bg-neon/15 text-neon border border-neon/30 shadow-[0_0_10px_rgba(34,197,94,0.15)] font-semibold' 
                        : 'text-slate-300 hover:bg-white/5 hover:text-white border border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon size={18} className={isActive ? 'text-neon' : 'text-slate-400 group-hover:text-neon'} />
                      {!isSidebarCollapsed && <span className="font-medium text-xs truncate">{item.label}</span>}
                    </div>
                    {!isSidebarCollapsed && (
                      <button
                        type="button"
                        onClick={(e) => togglePinTool(item.id, e)}
                        title="Desfijar de la barra rápida"
                        className="p-1 rounded-md text-neon hover:text-red-400 hover:bg-white/10 transition-colors opacity-80 group-hover:opacity-100 cursor-pointer"
                      >
                        <Pin size={12} className="fill-neon" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Menú Principal */}
          {menuItems.map((item) => {
            const isPinned = pinnedTools.includes(item.id);
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveTab(item.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(item.id); } }}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 group relative cursor-pointer select-none ${
                  activeTab === item.id 
                    ? 'bg-neon/10 text-neon border border-neon/20' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  {item.isGlowing ? (
                    <div className="relative shrink-0">
                      <div className={`absolute inset-0 bg-neon/20 blur-md rounded-full transition-opacity ${activeTab === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                      <item.icon size={20} className={`relative ${activeTab === item.id ? 'text-neon drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]' : 'group-hover:text-neon'}`} />
                    </div>
                  ) : (
                    <item.icon size={20} className={`shrink-0 ${activeTab === item.id ? 'text-neon' : 'group-hover:text-neon'}`} />
                  )}
                  {!isSidebarCollapsed && <span className="font-medium text-left truncate">{item.label}</span>}
                </div>

                {/* Opción para fijar */}
                {!isSidebarCollapsed ? (
                  <button
                    type="button"
                    onClick={(e) => togglePinTool(item.id, e)}
                    title={isPinned ? "Desfijar herramienta" : "Fijar herramienta en favoritos"}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      isPinned 
                        ? 'text-neon opacity-100 hover:text-red-400 hover:bg-white/5' 
                        : 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-neon hover:bg-white/10'
                    }`}
                  >
                    <Pin size={13} className={isPinned ? 'fill-neon' : ''} />
                  </button>
                ) : (
                  isPinned && (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_6px_rgba(34,197,94,1)]" />
                  )
                )}
              </div>
            );
          })}

          {/* Herramientas Secundarias */}
          <div className="pt-2 border-t border-border/40 space-y-1.5">
            {secondaryMenuItems.map((item) => {
              const isPinned = pinnedTools.includes(item.id);
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveTab(item.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(item.id); } }}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 group relative cursor-pointer select-none ${
                    activeTab === item.id 
                      ? 'bg-neon/10 text-neon border border-neon/20' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <item.icon size={20} className={`shrink-0 ${activeTab === item.id ? 'text-neon' : 'group-hover:text-neon'}`} />
                    {!isSidebarCollapsed && <span className="font-medium text-left truncate">{item.label}</span>}
                  </div>

                  {/* Opción para fijar */}
                  {!isSidebarCollapsed ? (
                    <button
                      type="button"
                      onClick={(e) => togglePinTool(item.id, e)}
                      title={isPinned ? "Desfijar herramienta" : "Fijar herramienta en favoritos"}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                        isPinned 
                          ? 'text-neon opacity-100 hover:text-red-400 hover:bg-white/5' 
                          : 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-neon hover:bg-white/10'
                      }`}
                    >
                      <Pin size={13} className={isPinned ? 'fill-neon' : ''} />
                    </button>
                  ) : (
                    isPinned && (
                      <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_6px_rgba(34,197,94,1)]" />
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Dedicated Scroll Action Bar for Ecom Mil Left Panel */}
        <div className="px-3 py-2 border-t border-border/40 bg-card/90">
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-2">
              <button
                onClick={scrollSidebarDown}
                title="Desplazar panel hacia abajo"
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-neon/10 border border-neon/30 text-neon hover:bg-neon/20 hover:border-neon text-xs font-semibold shadow-sm transition-all group"
              >
                <ChevronDown size={16} className="animate-bounce group-hover:translate-y-0.5 transition-transform" />
                <span>Desplazar Abajo</span>
              </button>
              {sidebarCanScrollUp && (
                <button
                  onClick={scrollSidebarToTop}
                  title="Volver al inicio del panel"
                  className="p-2 rounded-xl bg-background border border-border text-slate-400 hover:text-white hover:border-border/80 transition-all flex items-center justify-center"
                >
                  <ChevronUp size={16} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={sidebarCanScrollDown ? scrollSidebarDown : scrollSidebarToTop}
                title={sidebarCanScrollDown ? "Desplazar panel hacia abajo" : "Volver arriba"}
                className="w-10 h-10 rounded-xl bg-neon/10 border border-neon/30 text-neon hover:bg-neon/20 hover:border-neon flex items-center justify-center transition-all"
              >
                {sidebarCanScrollDown ? (
                  <ChevronDown size={18} className="animate-bounce" />
                ) : (
                  <ChevronUp size={18} />
                )}
              </button>
            </div>
          )}
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

            <div className="h-6 w-px bg-border/50 hidden sm:block" />

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-xs font-display text-slate-500 uppercase tracking-tighter hidden xs:inline">Producto</span>
              <div className="relative">
                <select
                  value={globalProductFilter}
                  onChange={(e) => setGlobalProductFilter(e.target.value)}
                  className="bg-card/40 border border-border rounded-lg text-[10px] sm:text-[11px] py-1 pl-2.5 pr-7 text-slate-300 focus:outline-none focus:border-neon cursor-pointer max-w-[120px] sm:max-w-[180px] font-bold truncate transition-colors hover:border-border/80 appearance-none"
                >
                  <option value="all">📦 Todos los Productos</option>
                  <option value="sin_producto" className="bg-slate-950 text-slate-300">📦 Sin producto</option>
                  {globalUniqueProducts.map(prod => (
                    <option key={prod} value={prod} className="bg-slate-950 text-slate-300">
                      {prod}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500 text-[8px]">
                  ▼
                </div>
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
                <p className={`text-xs sm:text-base font-mono font-bold ${stats.totalNetProfit >= 0 ? 'text-positive-green' : 'text-negative-red'}`}>{formatCurrency(stats.totalNetProfit)}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Horizontal Navigation (No Icons on Mobile - Highly Optimized) */}
        <div className="md:hidden bg-[#0A0A0A] border-b border-border/60 py-2.5 px-4 flex gap-2 overflow-x-auto scrollbar-none shrink-0" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          {[
            ...menuItems,
            ...secondaryMenuItems,
            { id: 'settings', label: 'Ajustes' }
          ].map((item) => {
            const isPinned = pinnedTools.includes(item.id);
            return (
              <button
                key={item.id}
                id={`mobile-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-display transition-all duration-200 flex items-center gap-1.5 ${
                  activeTab === item.id 
                    ? 'bg-neon/10 text-neon border border-neon/30 font-bold shadow-[0_0_15px_rgba(34,197,94,0.1)]' 
                    : isPinned
                      ? 'text-slate-200 bg-white/5 border border-neon/30 hover:text-white'
                      : 'text-slate-400 bg-card/20 border border-transparent hover:text-white'
                }`}
              >
                {isPinned && <Pin size={10} className="text-neon fill-neon shrink-0" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Global Date Range Filter Bar */}
        <div className={`border-b px-4 py-3 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          theme === 'theme-light-white' ? 'bg-slate-50 border-slate-200' : 'bg-card/30 border-border/80'
        }`}>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-neon animate-pulse" />
            <span className={`text-[11px] font-black uppercase tracking-wider ${
              theme === 'theme-light-white' ? 'text-slate-700' : 'text-slate-300'
            }`}>Filtro de Fecha Dropi:</span>
            {globalStartDate || globalEndDate ? (
              <span className="text-[10px] bg-neon/15 text-neon px-2.5 py-0.5 rounded-full font-black">
                Filtro Activo ({filteredOrders.length} de {orders.length} Pedidos)
              </span>
            ) : (
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                theme === 'theme-light-white' ? 'bg-slate-200/60 text-slate-500' : 'bg-slate-800 text-slate-500'
              }`}>
                Todo el tiempo ({orders.length} Pedidos)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold ${
                theme === 'theme-light-white' ? 'text-slate-500' : 'text-slate-400'
              }`}>Filtrar por:</span>
              <select
                value={pendingDateFilterType}
                onChange={(e: any) => setPendingDateFilterType(e.target.value)}
                className={`text-[11px] font-black uppercase tracking-wider py-1.5 px-3 rounded-lg border focus:outline-none focus:ring-1 focus:ring-neon transition-all cursor-pointer ${
                  theme === 'theme-light-white' 
                    ? 'bg-white border-slate-300 text-slate-700' 
                    : 'bg-background border-border text-white'
                }`}
              >
                <option value="solicitud">Fecha de Solicitud</option>
                <option value="entrega_devolucion">Fecha de Entrega/Devolución</option>
                <option value="registro">Fecha de Sincronización</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={pendingStartDate}
                onChange={(e) => setPendingStartDate(e.target.value)}
                onClick={(e) => {
                  try {
                    (e.target as any).showPicker?.();
                  } catch (err) {
                    console.warn('showPicker restricted:', err);
                  }
                }}
                className={`text-[11px] font-bold py-1.5 px-2.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-neon transition-all cursor-pointer ${
                  theme === 'theme-light-white' 
                    ? 'bg-white border-slate-300 text-slate-700 [color-scheme:light]' 
                    : 'bg-background border-border text-white [color-scheme:dark]'
                }`}
              />
              <span className={`text-xs ${theme === 'theme-light-white' ? 'text-slate-400' : 'text-slate-500'}`}>al</span>
              <input
                type="date"
                value={pendingEndDate}
                onChange={(e) => setPendingEndDate(e.target.value)}
                onClick={(e) => {
                  try {
                    (e.target as any).showPicker?.();
                  } catch (err) {
                    console.warn('showPicker restricted:', err);
                  }
                }}
                className={`text-[11px] font-bold py-1.5 px-2.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-neon transition-all cursor-pointer ${
                  theme === 'theme-light-white' 
                    ? 'bg-white border-slate-300 text-slate-700 [color-scheme:light]' 
                    : 'bg-background border-border text-white [color-scheme:dark]'
                }`}
              />
            </div>

            <button
              onClick={() => {
                setGlobalStartDate(pendingStartDate);
                setGlobalEndDate(pendingEndDate);
                setGlobalDateFilterType(pendingDateFilterType);
              }}
              className="bg-neon hover:bg-neon/80 text-black font-black uppercase tracking-wider px-4 py-1.5 rounded-lg transition-all text-[11px] shadow-[0_0_15px_rgba(34,197,94,0.3)] cursor-pointer flex items-center gap-1"
            >
              <Filter size={11} />
              Filtrar
            </button>

            {(globalStartDate || globalEndDate) && (
              <button
                onClick={() => {
                  setPendingStartDate('');
                  setPendingEndDate('');
                  setGlobalStartDate('');
                  setGlobalEndDate('');
                }}
                className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  theme === 'theme-light-white'
                    ? 'bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white border border-red-200'
                    : 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20'
                }`}
              >
                Limpiar
              </button>
            )}
          </div>
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
                  orders={filteredOrders} 
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
                  orders={filteredOrders} 
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
                  orders={filteredOrders} 
                  stats={stats} 
                  formatCurrency={formatCurrency} 
                  currency={currency}
                  currencies={dynamicCurrencies}
                  isConversionActive={isConversionActive}
                />
              )}
      {activeTab === 'orders' && (
                <OrderManagement 
                  orders={filteredOrders} 
                  setOrders={setOrders}
                  formatCurrency={formatCurrency} 
                  onDeleteOrders={deleteOrders} 
                  onAddOrders={addOrders}
                  currentCurrency={currency}
                  exchangeRate={currencyInfo.rate}
                  isConversionActive={isConversionActive}
                  viewMode="DROPI" theme={theme}
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
              {activeTab === 'research' && (
                <MarketResearch 
                  timerMinutes={timerMinutes}
                  setTimerMinutes={setTimerMinutes}
                  timeRemaining={timeRemaining}
                  setTimeRemaining={setTimeRemaining}
                  timerIsActive={timerIsActive}
                  setTimerIsActive={setTimerIsActive}
                  timerMode={timerMode}
                  setTimerMode={setTimerMode}
                  focusTask={focusTask}
                  setFocusTask={setFocusTask}
                  completedPomodoros={completedPomodoros}
                  setCompletedPomodoros={setCompletedPomodoros}
                  notificationPermission={notificationPermission}
                  requestNotificationPermission={requestNotificationPermission}
                  showDesktopNotification={showDesktopNotification}
                  playCompletionSound={playCompletionSound}
                />
              )}
              {activeTab === 'ad-panel' && (
                <AdPanel 
                  theme={theme} 
                  orders={orders} 
                  formatCurrency={formatCurrency} 
                  currency={currency} 
                />
              )}
              {activeTab === 'notes' && (
                <NotesSection theme={theme} />
              )}
              {activeTab === 'returns' && (
                <ReturnsAnalysis 
                  orders={filteredOrders} 
                  formatCurrency={formatCurrency} 
                  currency={currency}
                  currencies={dynamicCurrencies}
                  isConversionActive={isConversionActive}
                  theme={theme}
                  onDeleteOrders={deleteOrders}
                />
              )}
              {activeTab === 'ads' && (
                <AdvertisingExpenses 
                  formatCurrency={formatCurrency} 
                  currency={currency}
                  currencies={dynamicCurrencies}
                  isConversionActive={isConversionActive}
                  selectedYear={selectedYear}
                  setSelectedYear={setSelectedYear}
                  selectedMonth={selectedMonth}
                  setSelectedMonth={setSelectedMonth}
                />
              )}
              {activeTab === 'platform-expenses' && (
                <PlatformExpenses 
                  formatCurrency={formatCurrency} 
                  currencySymbol={currencyInfo.symbol} 
                  currency={currency}
                  currencies={dynamicCurrencies}
                  isConversionActive={isConversionActive}
                  fixedExpenses={fixedExpenses}
                  setFixedExpenses={setFixedExpenses}
                  variableExpenses={variableExpenses}
                  setVariableExpenses={setVariableExpenses}
                />
              )}
              {activeTab === 'shipping' && (
                <ShippingAnalysis 
                  orders={filteredOrders} 
                  formatCurrency={formatCurrency} 
                  currency={currency}
                  currencies={dynamicCurrencies}
                  isConversionActive={isConversionActive}
                />
              )}
              {activeTab === 'financial' && (
                <div className="space-y-[15px]">
                  <FinancialSummary 
                    orders={filteredOrders} 
                    periods={periods}
                    formatCurrency={formatCurrency} 
                    currency={currency}
                    currencies={dynamicCurrencies}
                    isConversionActive={isConversionActive}
                    fixedExpenses={fixedExpenses}
                    setFixedExpenses={setFixedExpenses}
                    variableExpenses={variableExpenses}
                    setVariableExpenses={setVariableExpenses}
                    selectedYear={selectedYear}
                    setSelectedYear={setSelectedYear}
                    selectedMonth={selectedMonth}
                    setSelectedMonth={setSelectedMonth}
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
        orders={filteredOrders}
        stats={stats}
        periods={periods}
        formatCurrency={formatCurrency}
        currency={currency}
        currencies={dynamicCurrencies}
        isConversionActive={isConversionActive}
        activeTab={activeTab}
        theme={theme}
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
