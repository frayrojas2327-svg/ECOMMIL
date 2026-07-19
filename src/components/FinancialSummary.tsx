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
  Undo2,
  Trash2
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isFirebaseConfigValid } from '../firebase';
import { useAuth } from './Auth';
import { Order, calculateOrderProfit, CurrencyCode, CURRENCIES } from '../mockData';

interface FinancialSummaryProps {
  orders: Order[];
  formatCurrency: (amount: number) => string;
  currency?: CurrencyCode;
  currencies?: any;
  isConversionActive?: boolean;
  fixedExpenses: any[];
  setFixedExpenses: React.Dispatch<React.SetStateAction<any[]>>;
  variableExpenses: any[];
  setVariableExpenses: React.Dispatch<React.SetStateAction<any[]>>;
  selectedYear?: string;
  setSelectedYear?: React.Dispatch<React.SetStateAction<string>>;
  selectedMonth?: string;
  setSelectedMonth?: React.Dispatch<React.SetStateAction<string>>;
}

const matchDatePrefix = (dateStr: string, prefix: string) => {
  if (!dateStr || !prefix) return false;
  const trimmedDate = dateStr.trim();
  const dateMatch = trimmedDate.match(/^(\d{4})-(\d{1,2})/);
  if (!dateMatch) return false;
  
  const prefMatch = prefix.trim().match(/^(\d{4})-(\d{1,2})/);
  if (!prefMatch) return false;
  
  return dateMatch[1] === prefMatch[1] && dateMatch[2].padStart(2, '0') === prefMatch[2].padStart(2, '0');
};

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
  isConversionActive = false,
  fixedExpenses,
  setFixedExpenses,
  variableExpenses,
  setVariableExpenses,
  selectedYear: propSelectedYear,
  setSelectedYear: propSetSelectedYear,
  selectedMonth: propSelectedMonth,
  setSelectedMonth: propSetSelectedMonth
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

  const [localSelectedYear, localSetSelectedYear] = useState(defaultYearMonth.year);
  const [localSelectedMonth, localSetSelectedMonth] = useState(defaultYearMonth.month);

  const selectedYear = (propSelectedYear && propSelectedYear !== '') ? propSelectedYear : localSelectedYear;
  const setSelectedYear = propSetSelectedYear !== undefined ? propSetSelectedYear : localSetSelectedYear;
  const selectedMonth = (propSelectedMonth && propSelectedMonth !== '') ? propSelectedMonth : localSelectedMonth;
  const setSelectedMonth = propSetSelectedMonth !== undefined ? propSetSelectedMonth : localSetSelectedMonth;

  useEffect(() => {
    if (propSelectedYear === undefined) {
      localSetSelectedYear(defaultYearMonth.year);
    }
    if (propSelectedMonth === undefined) {
      localSetSelectedMonth(defaultYearMonth.month);
    }
  }, [defaultYearMonth, propSelectedYear, propSelectedMonth]);

  const [showFeesDetail, setShowFeesDetail] = useState(false);
  const [showOtherDetail, setShowOtherDetail] = useState(false);

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
      handleFirestoreError(error, OperationType.LIST, 'ad_expenses');
    });

    return () => unsubscribe();
  }, [user, isDemoMode, selectedYear, selectedMonth]);

  // Other platform/variable expenses state
  const [otherExpenses, setOtherExpenses] = useState<{
    id: string;
    uid: string;
    name: string;
    category: string;
    amount: number; // in USD
    originalAmount?: number;
    originalCurrency?: string;
    date: string;
    timestamp: number;
  }[]>([]);

  // Firestore sync for other platform expenses
  useEffect(() => {
    if (!user || isDemoMode || !isFirebaseConfigValid) {
      // Offline/Demo fallback to localStorage
      const localSaved = localStorage.getItem('ecommil_other_platform_expenses');
      if (localSaved) {
        try {
          setOtherExpenses(JSON.parse(localSaved));
        } catch (e) {
          console.error("Error parsing local other platform expenses:", e);
        }
      } else {
        const demoOther = [
          { id: 'local_other_1', uid: 'demo', name: 'Suscripción Shopify', category: 'Software', amount: 39, date: `${selectedYear}-${selectedMonth}-01`, timestamp: Date.now() },
          { id: 'local_other_2', uid: 'demo', name: 'Apps de Dropshipping', category: 'Software', amount: 19, date: `${selectedYear}-${selectedMonth}-05`, timestamp: Date.now() },
          { id: 'local_other_3', uid: 'demo', name: 'Hosting & Dominio', category: 'Infraestructura', amount: 15, date: `${selectedYear}-${selectedMonth}-10`, timestamp: Date.now() }
        ];
        setOtherExpenses(demoOther);
        localStorage.setItem('ecommil_other_platform_expenses', JSON.stringify(demoOther));
      }
      return;
    }

    const q = query(collection(db, 'other_platform_expenses'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d
        } as any;
      });
      setOtherExpenses(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'other_platform_expenses');
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
    const monthlyAdExpenses = adExpenses.filter(e => e.date && matchDatePrefix(e.date, monthPrefix));
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

  // Combine, deduplicate, and sort all expenses for the selected month in memory
  const unifiedExpenses = useMemo(() => {
    const monthPrefix = `${selectedYear}-${selectedMonth}`;
    
    const mFixed = fixedExpenses
      .filter(e => e.startDate && matchDatePrefix(e.startDate, monthPrefix))
      .map(e => ({
        ...e,
        source: 'fixed' as const,
        typeLabel: 'Fijo (Plataforma)',
        date: e.startDate
      }));

    const mVariable = variableExpenses
      .filter(e => e.startDate && matchDatePrefix(e.startDate, monthPrefix))
      .map(e => ({
        ...e,
        source: 'variable' as const,
        typeLabel: 'Variable (Plataforma)',
        date: e.startDate
      }));

    // Deduplicate manual other expenses against fixed/variable
    const mOther = otherExpenses
      .filter(e => e.date && matchDatePrefix(e.date, monthPrefix))
      .filter(e => {
        const isDuplicateOfFixed = mFixed.some(f => f.name.toLowerCase().trim() === e.name.toLowerCase().trim() && Math.abs(fromUSD(f.amount) - fromUSD(e.amount)) < 0.05);
        const isDuplicateOfVariable = mVariable.some(v => v.name.toLowerCase().trim() === e.name.toLowerCase().trim() && Math.abs(fromUSD(v.amount) - fromUSD(e.amount)) < 0.05);
        return !isDuplicateOfFixed && !isDuplicateOfVariable;
      })
      .map(e => ({
        ...e,
        source: 'other' as const,
        typeLabel: 'Manual',
        date: e.date
      }));

    return [...mFixed, ...mVariable, ...mOther].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [fixedExpenses, variableExpenses, otherExpenses, selectedYear, selectedMonth]);

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

    // Extract real recorded advertisement platform expenses from the Publicidad section (ad_expenses)
    const monthPrefix = `${selectedYear}-${selectedMonth}`;
    const monthlyAdExpenses = adExpenses.filter(e => e.date && matchDatePrefix(e.date, monthPrefix));
    ads = monthlyAdExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const otherExpensesSum = unifiedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    return { revenue, cogs, shipping, ads, fees, returnsLoss, otherExpenses: otherExpensesSum };
  }, [filteredOrders, adExpenses, unifiedExpenses, selectedYear, selectedMonth]);

  // Load Overrides state
  const [overrides, setOverrides] = useState<Record<string, {
    revenue: number; // Stored in USD
    cogs: number; // Stored in USD
    shipping: number; // Stored in USD
    ads: number; // Stored in USD
    fees: number; // Stored in USD
    returnsLoss: number; // Stored in USD
    otherExpenses?: number; // Stored in USD
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
            otherExpenses: Number(data.otherExpenses ?? 0),
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
    const otherExpenses = fromUSD(base.otherExpenses ?? systemCalculatedDataUSD.otherExpenses ?? 0);

    const grossProfit = revenue - cogs;
    const ebitda = grossProfit - shipping - ads - fees - returnsLoss - otherExpenses;

    return {
      revenue,
      cogs,
      shipping,
      ads,
      fees,
      returnsLoss,
      otherExpenses,
      grossProfit,
      ebitda,
      isOverridden
    };
  }, [monthKey, overrides, systemCalculatedDataUSD, rate, isConversionActive]);

  // Aggregate financial data month-by-month for the quick filter buttons grid
  const monthlyFinancialSummaryData = useMemo(() => {
    const allMonths = new Set<string>();
    
    // Always guarantee that the current real-world month and the currently selected month are included
    const now = new Date();
    allMonths.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    allMonths.add(`${selectedYear}-${selectedMonth}`);
    
    orders.forEach(o => {
      const d = o.date;
      if (d && d instanceof Date && !isNaN(d.getTime())) {
        allMonths.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    });

    Object.keys(overrides).forEach(k => {
      const trimmed = k.trim();
      const match = trimmed.match(/^(\d{4})-(\d{1,2})/);
      if (match) {
        const yr = match[1];
        const mth = match[2].padStart(2, '0');
        allMonths.add(`${yr}-${mth}`);
      }
    });

    adExpenses.forEach(e => {
      if (e.date) {
        const trimmed = e.date.trim();
        const match = trimmed.match(/^(\d{4})-(\d{1,2})/);
        if (match) {
          const yr = match[1];
          const mth = match[2].padStart(2, '0');
          allMonths.add(`${yr}-${mth}`);
        }
      }
    });

    otherExpenses.forEach(e => {
      if (e.date) {
        const trimmed = e.date.trim();
        const match = trimmed.match(/^(\d{4})-(\d{1,2})/);
        if (match) {
          const yr = match[1];
          const mth = match[2].padStart(2, '0');
          allMonths.add(`${yr}-${mth}`);
        }
      }
    });

    if (allMonths.size === 0) {
      const now = new Date();
      allMonths.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    }

    const list = Array.from(allMonths).map(mKey => {
      const [yr, mth] = mKey.split('-');
      
      const mOrders = orders.filter(o => {
        const d = o.date;
        if (!d) return false;
        return d.getFullYear().toString() === yr && String(d.getMonth() + 1).padStart(2, '0') === mth;
      });

      const mAdExpenses = adExpenses.filter(e => e.date && matchDatePrefix(e.date, mKey));
      const adsUSD = mAdExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      const mOtherExpenses = otherExpenses.filter(e => e.date && matchDatePrefix(e.date, mKey));
      const otherExpensesUSD = mOtherExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      let sysRevenue = 0;
      let sysCogs = 0;
      let sysShipping = 0;
      let sysFees = 0;
      let sysReturnsLoss = 0;

      mOrders.forEach(o => {
        const isDelivered = o.status === 'Entregado';
        if (isDelivered) {
          sysRevenue += o.price;
          sysCogs += o.cost;
        }
        if (o.status !== 'Cancelado') {
          sysShipping += o.shippingReal;
          const comisionVal = Number(o.comision || 0);
          if (comisionVal > 0) {
            sysFees += comisionVal;
          } else {
            sysFees += o.price * (o.platformFee || 0);
          }
        }
        if (o.status === 'Devuelto') {
          const returnPenalty = Math.abs(Number(o.costoDevolucionFlete || 0));
          sysReturnsLoss += returnPenalty > 0 ? returnPenalty : (o.shippingReal > 0 ? o.shippingReal * 0.5 : 3.88);
        }
      });

      // Add fixed & variable platform expenses for this specific month key to otherExpensesUSD instead of sysFees
      const mFixed = fixedExpenses.filter(e => e.startDate && matchDatePrefix(e.startDate, mKey));
      const mVariable = variableExpenses.filter(e => e.startDate && matchDatePrefix(e.startDate, mKey));
      const mPlatExpUSD = mFixed.reduce((sum, e) => sum + (e.amount || 0), 0) + 
                          mVariable.reduce((sum, e) => sum + (e.amount || 0), 0);
      const finalOtherExpensesUSD = otherExpensesUSD + mPlatExpUSD;

      const override = overrides[mKey];
      const base = override || {
        revenue: sysRevenue,
        cogs: sysCogs,
        shipping: sysShipping,
        ads: adsUSD,
        fees: sysFees,
        returnsLoss: sysReturnsLoss,
        otherExpenses: finalOtherExpensesUSD
      };

      const finalRev = base.revenue;
      const finalCogs = base.cogs;
      const finalShipping = base.shipping;
      const finalAds = base.ads ?? adsUSD;
      const finalFees = base.fees;
      const finalReturnsLoss = base.returnsLoss;
      const finalOther = base.otherExpenses ?? finalOtherExpensesUSD;

      const grossProfit = finalRev - finalCogs;
      const netProfit = grossProfit - finalShipping - finalAds - finalFees - finalReturnsLoss - finalOther;

      const monthObj = MONTH_NAMES.find(m => m.value === mth);
      const monthLabel = monthObj ? monthObj.label : mth;

      return {
        monthKey,
        label: `${monthLabel} ${yr}`,
        year: yr,
        month: mth,
        revenue: finalRev,
        cogs: finalCogs,
        shipping: finalShipping,
        ads: finalAds,
        fees: finalFees,
        returnsLoss: finalReturnsLoss,
        otherExpenses: finalOther,
        grossProfit,
        netProfit,
        isOverridden: !!override
      };
    });

    const sortedList = list.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    
    // De-duplicate items based on monthKey to guarantee absolute uniqueness
    const deDuplicated: typeof sortedList = [];
    const seenKeys = new Set<string>();
    for (const item of sortedList) {
      if (!seenKeys.has(item.monthKey)) {
        seenKeys.add(item.monthKey);
        deDuplicated.push(item);
      }
    }
    return deDuplicated;
  }, [orders, overrides, adExpenses, otherExpenses, selectedYear, selectedMonth, fixedExpenses, variableExpenses]);

  // Local editing states (maintained in display currency for the user's convenience)
  const [isEditing, setIsEditing] = useState(false);
  const [editedRevenue, setEditedRevenue] = useState(0);
  const [editedCogs, setEditedCogs] = useState(0);
  const [editedShipping, setEditedShipping] = useState(0);
  const [editedAds, setEditedAds] = useState(0);
  const [editedPlatformFees, setEditedPlatformFees] = useState(0);
  const [editedReturnsLoss, setEditedReturnsLoss] = useState(0);
  const [editedOtherExpenses, setEditedOtherExpenses] = useState(0);

  // Sync inputs with active month details whenever the selected month or edit status triggers
  useEffect(() => {
    setEditedRevenue(Math.round(activeData.revenue * 100) / 100);
    setEditedCogs(Math.round(activeData.cogs * 100) / 100);
    setEditedShipping(Math.round(activeData.shipping * 100) / 100);
    setEditedAds(Math.round(activeData.ads * 100) / 100);
    setEditedPlatformFees(Math.round(activeData.fees * 100) / 100);
    setEditedReturnsLoss(Math.round(activeData.returnsLoss * 100) / 100);
    setEditedOtherExpenses(Math.round(activeData.otherExpenses * 100) / 100);
  }, [activeData, isEditing]);

  const [saving, setSaving] = useState(false);

  const handleStartEdit = () => {
    setEditedRevenue(Math.round(activeData.revenue * 100) / 100);
    setEditedCogs(Math.round(activeData.cogs * 100) / 100);
    setEditedShipping(Math.round(activeData.shipping * 100) / 100);
    setEditedAds(Math.round(activeData.ads * 100) / 100);
    setEditedPlatformFees(Math.round(activeData.fees * 100) / 100);
    setEditedReturnsLoss(Math.round(activeData.returnsLoss * 100) / 100);
    setEditedOtherExpenses(Math.round(activeData.otherExpenses * 100) / 100);
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
      returnsLoss: toUSD(Number(editedReturnsLoss)),
      otherExpenses: toUSD(Number(editedOtherExpenses))
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

  const [showAdsDetail, setShowAdsDetail] = useState(false);
  const [showAddOtherForm, setShowAddOtherForm] = useState(false);
  const [newExpenseType, setNewExpenseType] = useState<'other' | 'fixed' | 'variable'>('other');
  const [newOtherExpense, setNewOtherExpense] = useState({
    name: '',
    category: 'Software',
    amount: '',
    date: `${selectedYear}-${selectedMonth}-01`
  });

  // Sync date when month or year changes
  useEffect(() => {
    setNewOtherExpense(prev => ({
      ...prev,
      date: `${selectedYear}-${selectedMonth}-01`
    }));
  }, [selectedYear, selectedMonth]);

  const handleAddOtherExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOtherExpense.name || !newOtherExpense.amount) return;

    // Convert display currency amount back to USD if isConversionActive is enabled
    const amtInDisplay = Number(newOtherExpense.amount);
    const amtInUSD = toUSD(amtInDisplay);

    // Enforce that it saves in the currently selected year & month
    let finalDate = newOtherExpense.date;
    const expectedPrefix = `${selectedYear}-${selectedMonth}`;
    if (!finalDate.startsWith(expectedPrefix)) {
      const dayPart = finalDate.split('-')[2] || '01';
      finalDate = `${expectedPrefix}-${dayPart}`;
    }

    try {
      if (newExpenseType === 'other') {
        const expenseObj = {
          uid: user?.uid || 'demo',
          name: newOtherExpense.name,
          category: newOtherExpense.category,
          amount: amtInUSD,
          date: finalDate,
          timestamp: Date.now()
        };

        if (user && !isDemoMode && isFirebaseConfigValid) {
          await addDoc(collection(db, 'other_platform_expenses'), expenseObj);
        } else {
          // Local state offline update
          const localItems = [...otherExpenses, { id: 'local_' + Date.now(), ...expenseObj }];
          setOtherExpenses(localItems);
          localStorage.setItem('ecommil_other_platform_expenses', JSON.stringify(localItems));
        }
      } else if (newExpenseType === 'fixed') {
        const newId = 'fixed_' + Math.random().toString(36).substring(2, 9);
        const fixedItem = {
          id: newId,
          name: newOtherExpense.name,
          category: newOtherExpense.category,
          amount: amtInUSD,
          originalAmount: amtInDisplay,
          originalCurrency: currency,
          frequency: 'monthly' as const,
          startDate: finalDate,
          endDate: ''
        };
        setFixedExpenses(prev => [...prev, fixedItem]);
      } else if (newExpenseType === 'variable') {
        const newId = 'var_' + Math.random().toString(36).substring(2, 9);
        const variableItem = {
          id: newId,
          name: newOtherExpense.name,
          amount: amtInUSD,
          originalAmount: amtInDisplay,
          originalCurrency: currency,
          startDate: finalDate,
          endDate: ''
        };
        setVariableExpenses(prev => [...prev, variableItem]);
      }

      // Reset form
      setNewOtherExpense({
        name: '',
        category: 'Software',
        amount: '',
        date: `${selectedYear}-${selectedMonth}-01`
      });
      setShowAddOtherForm(false);
    } catch (err) {
      console.error("Error adding expense:", err);
      alert("Error al guardar el gasto");
    }
  };

  const handleImportAllPlatformExpenses = async () => {
    const monthPrefix = `${selectedYear}-${selectedMonth}`;
    const mFixed = fixedExpenses.filter(e => e.startDate && matchDatePrefix(e.startDate, monthPrefix));
    const mVariable = variableExpenses.filter(e => e.startDate && matchDatePrefix(e.startDate, monthPrefix));
    
    if (mFixed.length === 0 && mVariable.length === 0) {
      alert("No hay gastos fijos ni variables registrados en este mes para importar.");
      return;
    }

    const currentMonthOthers = otherExpenses.filter(e => e.date && matchDatePrefix(e.date, monthPrefix));
    
    let importedCount = 0;
    const toImport = [];

    // Filter out duplicates
    for (const e of mFixed) {
      const isDuplicate = currentMonthOthers.some(existing => 
        existing.name.toLowerCase() === e.name.toLowerCase() && 
        Math.abs(fromUSD(existing.amount) - fromUSD(e.amount)) < 0.01
      );
      if (!isDuplicate) {
        toImport.push({
          uid: user?.uid || 'demo',
          name: e.name,
          category: e.category || 'Software',
          amount: e.amount, // base in USD
          date: e.startDate || `${selectedYear}-${selectedMonth}-01`,
          timestamp: Date.now()
        });
      }
    }

    for (const e of mVariable) {
      const isDuplicate = currentMonthOthers.some(existing => 
        existing.name.toLowerCase() === e.name.toLowerCase() && 
        Math.abs(fromUSD(existing.amount) - fromUSD(e.amount)) < 0.01
      );
      if (!isDuplicate) {
        toImport.push({
          uid: user?.uid || 'demo',
          name: e.name,
          category: 'Software',
          amount: e.amount, // base in USD
          date: e.startDate || `${selectedYear}-${selectedMonth}-01`,
          timestamp: Date.now()
        });
      }
    }

    if (toImport.length === 0) {
      alert("Todos los gastos de plataforma de este mes ya fueron importados.");
      return;
    }

    try {
      if (user && !isDemoMode && isFirebaseConfigValid) {
        // Save to Firebase
        for (const item of toImport) {
          await addDoc(collection(db, 'other_platform_expenses'), item);
          importedCount++;
        }
      } else {
        // Local state offline update
        const newItems = [...otherExpenses];
        for (const item of toImport) {
          newItems.push({ id: 'local_' + Date.now() + '_' + Math.random(), ...item });
          importedCount++;
        }
        setOtherExpenses(newItems);
        localStorage.setItem('ecommil_other_platform_expenses', JSON.stringify(newItems));
      }
      alert(`Se importaron con éxito ${importedCount} gastos de plataforma para ${currentMonthLabel} ${selectedYear}`);
    } catch (err) {
      console.error("Error importing platform expenses:", err);
      alert("Error al importar los gastos");
    }
  };

  const handleDirectAddOtherExpense = async (expenseObj: {
    uid: string;
    name: string;
    category: string;
    amount: number;
    date: string;
    timestamp: number;
  }) => {
    try {
      if (user && !isDemoMode && isFirebaseConfigValid) {
        await addDoc(collection(db, 'other_platform_expenses'), expenseObj);
      } else {
        // Local state offline update
        const localItems = [...otherExpenses, { id: 'local_' + Date.now(), ...expenseObj }];
        setOtherExpenses(localItems);
        localStorage.setItem('ecommil_other_platform_expenses', JSON.stringify(localItems));
      }
    } catch (err) {
      console.error("Error copying platform expense:", err);
      alert("Error al copiar el gasto");
    }
  };

  const handleDeleteOtherExpense = async (expense: any) => {
    if (!window.confirm(`¿Seguro que deseas eliminar este gasto (${expense.name})?`)) return;

    try {
      if (expense.source === 'other') {
        if (user && !isDemoMode && isFirebaseConfigValid) {
          await deleteDoc(doc(db, 'other_platform_expenses', expense.id));
        } else {
          const updated = otherExpenses.filter(e => e.id !== expense.id);
          setOtherExpenses(updated);
          localStorage.setItem('ecommil_other_platform_expenses', JSON.stringify(updated));
        }
      } else if (expense.source === 'fixed') {
        setFixedExpenses(prev => prev.filter(e => e.id !== expense.id));
      } else if (expense.source === 'variable') {
        setVariableExpenses(prev => prev.filter(e => e.id !== expense.id));
      }
    } catch (err) {
      console.error("Error deleting expense:", err);
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
    const oth = isEditing ? Number(editedOtherExpenses) : activeData.otherExpenses;

    return [
      { name: 'Ingresos', value: rev, color: '#00ff88' },
      { name: 'COGS', value: -cog, color: '#f5c842' },
      { name: 'Fletes', value: -ship, color: '#3b82f6' },
      { name: 'Ads', value: -ad, color: '#8b5cf6' },
      { name: 'Comisiones', value: -fe, color: '#64748b' },
      { name: 'Devoluciones', value: -ret, color: '#ef4444' },
      { name: 'Otras Plat.', value: -oth, color: '#f43f5e' },
    ];
  }, [isEditing, editedRevenue, editedCogs, editedShipping, editedAds, editedPlatformFees, editedReturnsLoss, editedOtherExpenses, activeData]);

  // Live P&L derived results
  const liveGrossProfit = isEditing ? (Number(editedRevenue) - Number(editedCogs)) : activeData.grossProfit;
  const liveNetProfit = isEditing ? 
    (liveGrossProfit - Number(editedShipping) - Number(editedAds) - Number(editedPlatformFees) - Number(editedReturnsLoss) - Number(editedOtherExpenses)) : 
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

      {/* Visual Month-by-Month Financial Summary / Filter Grid */}
      <div className="glass-card p-6 bg-black border border-slate-900 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-[13px] font-display font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <span className="text-neon">📊</span> Consolidado Mensual de Resultados (P&L)
            </h3>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5 text-left">
              Suma total de ingresos, costos y utilidad neta por mes. Haz clic en un mes para seleccionarlo y ver su estado de resultados detallado abajo.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-slate-900 shrink-0">
            Total meses: {monthlyFinancialSummaryData.length}
          </span>
        </div>

        {monthlyFinancialSummaryData.length === 0 ? (
          <div className="py-6 text-center text-slate-500 font-mono text-xs">
            No hay registros financieros suficientes para consolidar por mes.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {monthlyFinancialSummaryData.map((item) => {
              const isActive = selectedYear === item.year && selectedMonth === item.month;
              const displayRevenue = fromUSD(item.revenue);
              const displayNetProfit = fromUSD(item.netProfit);
              const displayTotalExpenses = fromUSD(item.revenue - item.netProfit);
              const isProfitPositive = item.netProfit >= 0;

              return (
                <button
                  key={item.monthKey}
                  type="button"
                  onClick={() => {
                    setSelectedYear(item.year);
                    setSelectedMonth(item.month);
                    setIsEditing(false); // Reset editing mode
                  }}
                  className={`p-3.5 rounded-xl border font-mono text-left transition-all active:scale-95 cursor-pointer relative group ${
                    isActive
                      ? 'bg-neon/10 border-neon shadow-lg shadow-neon/5 text-white'
                      : 'bg-slate-950 border-slate-900 hover:border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[11px] font-bold ${isActive ? 'text-neon' : 'text-slate-400 group-hover:text-white'}`}>
                      {item.label}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-neon" />
                    )}
                  </div>
                  
                  {/* Revenue / Expenses detail */}
                  <div className="space-y-1 mb-2 text-[10px] text-slate-400 border-b border-slate-900 pb-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ingresos:</span>
                      <span className="text-slate-300">{localFormatCurrency(displayRevenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gastos:</span>
                      <span className="text-slate-400">-{localFormatCurrency(displayTotalExpenses)}</span>
                    </div>
                  </div>

                  {/* Net Profit */}
                  <div className="flex items-baseline justify-between pt-0.5">
                    <span className="text-[9px] uppercase text-slate-500 font-bold">Utilidad:</span>
                    <span className={`text-xs font-bold font-mono ${isProfitPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isProfitPositive ? '+' : ''}{localFormatCurrency(displayNetProfit)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
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
                  <button 
                    type="button"
                    onClick={() => {
                      setShowAddOtherForm(true);
                      setTimeout(() => {
                        const element = document.getElementById('other-expenses-section');
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          const nameInput = document.getElementById('new-expense-name-input');
                          if (nameInput) nameInput.focus();
                        }
                      }, 100);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm rounded-lg transition-all active:scale-95 cursor-pointer"
                  >
                    <span>➕ Agregar Gasto</span>
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
                    type="button"
                    onClick={() => {
                      setShowAddOtherForm(true);
                      setTimeout(() => {
                        const element = document.getElementById('other-expenses-section');
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          const nameInput = document.getElementById('new-expense-name-input');
                          if (nameInput) nameInput.focus();
                        }
                      }, 100);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm rounded-lg transition-all active:scale-95 cursor-pointer"
                  >
                    <span>➕ Agregar Gasto</span>
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
                <span className="text-[15px] text-slate-300 block text-left">Ingresos Totales (Ventas)</span>
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
                    className="bg-transparent text-right outline-none text-white font-mono w-full text-[15px]"
                    placeholder="0"
                  />
                </div>
              ) : (
                <span className="text-[15px] font-mono font-bold text-emerald-400 shrink-0">
                  {localFormatCurrency(activeData.revenue)}
                </span>
              )}
            </div>

            {/* COGS ROW */}
            <div className="flex justify-between items-start py-2 border-b border-slate-900 gap-4">
              <div>
                <span className="text-[15px] text-slate-400 block text-left">(-) Costo de Mercadería (COGS)</span>
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
                    className="bg-transparent text-right outline-none text-white font-mono w-full text-[15px]"
                    placeholder="0"
                  />
                </div>
              ) : (
                <span className="text-[15px] font-mono text-red-500 shrink-0">
                  ({localFormatCurrency(activeData.cogs)})
                </span>
              )}
            </div>

            {/* GROSS PROFIT ROW (CALCULATED LIVE) */}
            <div className="flex justify-between items-center py-3 bg-neon/5 px-4 rounded-xl border border-neon/10">
              <span className="text-[15px] font-bold text-neon">Utilidad Bruta</span>
              <span className="text-[15px] font-mono font-bold text-neon">
                {localFormatCurrency(liveGrossProfit)}
              </span>
            </div>
            
            {/* GASTOS BREAKDOWN */}
            <div className="space-y-4 pt-4 border-t border-dashed border-slate-900">
              
              {/* SHIPPING cost */}
              <div className="flex justify-between items-start py-1 gap-4">
                <div>
                  <span className="text-[15px] text-slate-400 block text-left">(-) Gastos de Envío (Fletes)</span>
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
                      className="bg-transparent text-right outline-none text-white font-mono w-full text-[15px]"
                      placeholder="0"
                    />
                  </div>
                ) : (
                  <span className="text-[15px] font-mono text-slate-300 shrink-0">
                    {localFormatCurrency(activeData.shipping)}
                  </span>
                )}
              </div>

              {/* OUTWARD MARKETING ETC */}
              <div className="border-b border-slate-900/40 pb-2">
                <div className="flex justify-between items-start py-1 gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] text-slate-400 block text-left">(-) Inversión Ads & Marketing</span>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => setEditedAds(Math.round(fromUSD(systemCalculatedDataUSD.ads) * 100) / 100)}
                          className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                          title="Jalar el valor automático calculado para este mes"
                        >
                          🔄 Jalar de Publicidad
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowAdsDetail(!showAdsDetail)}
                        className="px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[10px] font-mono transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                        title="Ver desglose de campañas para este mes"
                      >
                        📊 {showAdsDetail ? 'Ocultar' : 'Ver'} Detalle ({adExpenses.filter(e => e.date && matchDatePrefix(e.date, `${selectedYear}-${selectedMonth}`)).length})
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono block text-left">
                      Suma total de publicidad jalada de la sección de Publicidad ({systemExplainer.adsCount} registros) para el mes
                    </span>
                  </div>
                  {isEditing ? (
                    <div className="flex items-center bg-black border border-slate-700 focus-within:border-neon rounded-lg px-2.5 py-1 max-w-[190px] w-full transition-all shrink-0">
                      <span className="text-slate-500 font-mono text-sm mr-1">{currencySymbol}</span>
                      <input 
                        type="number"
                        value={editedAds}
                        onChange={(e) => setEditedAds(Number(e.target.value))}
                        className="bg-transparent text-right outline-none text-white font-mono w-full text-[15px]"
                        placeholder="0"
                      />
                    </div>
                  ) : (
                    <span className="text-[15px] font-mono text-slate-300 shrink-0">
                      {localFormatCurrency(activeData.ads)}
                    </span>
                  )}
                </div>

                {/* Inline Collapsible Ad Expenses Detail */}
                {showAdsDetail && (
                  <div className="mt-3 p-4 bg-slate-950 border border-slate-900 rounded-xl space-y-2 text-xs font-mono animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Campañas de {currentMonthLabel} {selectedYear}</span>
                      <span className="text-slate-500 text-[10px]">Valores jalados de Publicidad</span>
                    </div>
                    {(() => {
                      const monthPrefix = `${selectedYear}-${selectedMonth}`;
                      const monthlyAds = adExpenses.filter(e => e.date && matchDatePrefix(e.date, monthPrefix));
                      
                      if (monthlyAds.length === 0) {
                        return (
                          <div className="text-center py-4 text-slate-500">
                            No hay gastos registrados en Publicidad para este mes.
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                          {monthlyAds.map((e) => (
                            <div key={e.id} className="flex justify-between items-center text-[11px]">
                              <div className="flex flex-col text-left">
                                <span className="text-slate-300 font-bold">{e.productName || 'Campaña General'}</span>
                                <span className="text-slate-500 text-[9px]">{e.platform} • {e.date}</span>
                              </div>
                              <span className="text-slate-300 font-bold">{localFormatCurrency(fromUSD(e.amount))}</span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center border-t border-slate-900 pt-2 font-bold text-neon">
                            <span>Suma Total Mes:</span>
                            <span>{localFormatCurrency(fromUSD(monthlyAds.reduce((sum, e) => sum + (e.amount || 0), 0)))}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* PLATFORM COMMISSIONS */}
              <div className="border-b border-slate-900/40 pb-2">
                <div className="flex justify-between items-start py-1 gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] text-slate-400 block text-left">(-) Comisiones de Plataforma</span>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => setEditedPlatformFees(Math.round(fromUSD(systemCalculatedDataUSD.fees) * 100) / 100)}
                          className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                          title="Jalar el valor automático calculado para este mes"
                        >
                          🔄 Jalar de Plataforma
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowFeesDetail(!showFeesDetail)}
                        className="px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[10px] font-mono transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                        title="Ver desglose de comisiones y gastos operativos de plataforma"
                      >
                        📊 {showFeesDetail ? 'Ocultar' : 'Ver'} Detalle ({
                          (() => {
                            const monthPrefix = `${selectedYear}-${selectedMonth}`;
                            const orderCommissionsCount = filteredOrders.filter(o => o.status !== 'Cancelado' && (Number(o.comision || 0) > 0 || (o.price * (o.platformFee || 0)) > 0)).length;
                            const mFixed = fixedExpenses.filter(e => e.startDate && matchDatePrefix(e.startDate, monthPrefix));
                            const mVariable = variableExpenses.filter(e => e.startDate && matchDatePrefix(e.startDate, monthPrefix));
                            return (orderCommissionsCount > 0 ? 1 : 0) + mFixed.length + mVariable.length;
                          })()
                        })
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono block text-left">
                      Comisión de vendedor y costos tecnológicos cobrados por Dropi / pasarelas, más gastos de plataforma registrados
                    </span>
                  </div>
                  {isEditing ? (
                    <div className="flex items-center bg-black border border-slate-700 focus-within:border-neon rounded-lg px-2.5 py-1 max-w-[190px] w-full transition-all shrink-0">
                      <span className="text-slate-500 font-mono text-sm mr-1">{currencySymbol}</span>
                      <input 
                        type="number"
                        value={editedPlatformFees}
                        onChange={(e) => setEditedPlatformFees(Number(e.target.value))}
                        className="bg-transparent text-right outline-none text-white font-mono w-full text-[15px]"
                        placeholder="0"
                      />
                    </div>
                  ) : (
                    <span className="text-[15px] font-mono text-slate-300 shrink-0">
                      {localFormatCurrency(activeData.fees)}
                    </span>
                  )}
                </div>

                {/* Inline Collapsible Platform Expenses Detail */}
                {showFeesDetail && (
                  <div className="mt-3 p-4 bg-slate-950 border border-slate-900 rounded-xl space-y-2.5 text-xs font-mono animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Gastos de Plataforma - {currentMonthLabel} {selectedYear}</span>
                      <span className="text-slate-500 text-[10px]">Detalle por Plataforma y Concepto</span>
                    </div>
                    {(() => {
                      const monthPrefix = `${selectedYear}-${selectedMonth}`;
                      
                      // Calculate and group order-level fees by platform provider name
                      const platformFeesGrouped: Record<string, number> = {};
                      let sysOrderFees = 0;
                      
                      filteredOrders.forEach(o => {
                        if (o.status !== 'Cancelado') {
                          const platform = o.provider || o.tienda || o.tipoTienda || 'Otros';
                          const comisionVal = Number(o.comision || 0);
                          const feeAmt = comisionVal > 0 ? comisionVal : o.price * (o.platformFee || 0);
                          if (feeAmt > 0) {
                            platformFeesGrouped[platform] = (platformFeesGrouped[platform] || 0) + feeAmt;
                            sysOrderFees += feeAmt;
                          }
                        }
                      });

                      const noData = sysOrderFees === 0;

                      if (noData) {
                        return (
                          <div className="text-center py-4 text-slate-500">
                            No hay comisiones de pedidos registradas para este mes.
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                          {/* Order commissions grouped by platform name */}
                          {Object.keys(platformFeesGrouped).length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] text-blue-400 uppercase font-black tracking-wider block text-left">🛒 Comisiones de Pedidos</span>
                              {Object.entries(platformFeesGrouped).map(([platformName, amt]) => (
                                <div key={platformName} className="flex justify-between items-center text-[11px] pl-2">
                                  <div className="flex flex-col text-left">
                                    <span className="text-slate-300 font-bold">{platformName}</span>
                                    <span className="text-slate-500 text-[9px]">Cálculo automático de pedidos</span>
                                  </div>
                                  <span className="text-slate-300 font-bold">{localFormatCurrency(fromUSD(amt))}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex justify-between items-center border-t border-slate-900 pt-2 font-bold text-neon">
                            <span>Suma Total Plataforma:</span>
                            <span>{localFormatCurrency(fromUSD(sysOrderFees))}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* LOGISTICA DE DEVOLUCIONES */}
              <div className="flex justify-between items-start py-1 gap-4">
                <div>
                  <span className="text-[15px] text-slate-400 block text-left">(-) Logística de Devoluciones</span>
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
                      className="bg-transparent text-right outline-none text-white font-mono w-full text-[15px]"
                      placeholder="0"
                    />
                  </div>
                ) : (
                  <span className="text-[15px] font-mono text-slate-300 shrink-0">
                    {localFormatCurrency(activeData.returnsLoss)}
                  </span>
                )}
              </div>

              {/* OTRAS PLATAFORMAS Y GASTOS OPERATIVOS */}
              <div className="border-b border-slate-900/40 pb-2">
                <div className="flex justify-between items-start py-1 gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] text-slate-400 block text-left">(-) Otras Plataformas y Herramientas</span>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => setEditedOtherExpenses(Math.round(fromUSD(systemCalculatedDataUSD.otherExpenses) * 100) / 100)}
                          className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                          title="Jalar el valor automático calculado para este mes"
                        >
                          🔄 Jalar de Gastos
                        </button>
                      )}
                      {(() => {
                        const monthPrefix = `${selectedYear}-${selectedMonth}`;
                        const monthlyOther = otherExpenses.filter(e => e.date && matchDatePrefix(e.date, monthPrefix));
                        const mFixed = fixedExpenses.filter(e => e.startDate && matchDatePrefix(e.startDate, monthPrefix));
                        const mVariable = variableExpenses.filter(e => e.startDate && matchDatePrefix(e.startDate, monthPrefix));
                        const totalCount = monthlyOther.length + mFixed.length + mVariable.length;
                        return (
                          <button
                            type="button"
                            onClick={() => setShowOtherDetail(!showOtherDetail)}
                            className="px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[10px] font-mono transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                            title="Ver desglose de otros gastos operativos y herramientas"
                          >
                            📊 {showOtherDetail ? 'Ocultar' : 'Ver'} Detalle ({totalCount})
                          </button>
                        );
                      })()}
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono block text-left">
                      Shopify, hosting, dominios, sueldos, integraciones and otros costos operativos registrados
                    </span>
                  </div>
                  {isEditing ? (
                    <div className="flex items-center bg-black border border-slate-700 focus-within:border-neon rounded-lg px-2.5 py-1 max-w-[190px] w-full transition-all shrink-0">
                      <span className="text-slate-500 font-mono text-sm mr-1">{currencySymbol}</span>
                      <input 
                        type="number"
                        value={editedOtherExpenses}
                        onChange={(e) => setEditedOtherExpenses(Number(e.target.value))}
                        className="bg-transparent text-right outline-none text-white font-mono w-full text-[15px]"
                        placeholder="0"
                      />
                    </div>
                  ) : (
                    <span className="text-[15px] font-mono text-slate-300 shrink-0">
                      {localFormatCurrency(activeData.otherExpenses)}
                    </span>
                  )}
                </div>

                {/* Inline Collapsible Other Expenses Detail */}
                {showOtherDetail && (
                  <div className="mt-3 p-4 bg-slate-950 border border-slate-900 rounded-xl space-y-2.5 text-xs font-mono animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Gastos Operativos - {currentMonthLabel} {selectedYear}</span>
                      <span className="text-slate-500 text-[10px]">🟢 Sincronizado en tiempo real</span>
                    </div>
                    {unifiedExpenses.length === 0 ? (
                      <div className="text-center py-4 text-slate-500">
                        No hay otros gastos registrados para este mes.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {unifiedExpenses.map((e) => (
                          <div key={e.id} className="flex justify-between items-center text-[11px] hover:bg-slate-900/40 rounded py-1 px-2">
                            <div className="flex flex-col text-left">
                              <span className="text-slate-300 font-bold">{e.name}</span>
                              <span className="text-slate-500 text-[9px]">
                                {e.typeLabel} {e.category ? `• ${e.category}` : ''} • {e.date}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-200 font-bold">{localFormatCurrency(fromUSD(e.amount))}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteOtherExpense(e)}
                                className="text-slate-500 hover:text-red-400 transition-all cursor-pointer p-0.5"
                                title="Eliminar gasto"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        ))}

                        <div className="flex justify-between items-center border-t border-slate-900 pt-2 font-bold text-neon">
                          <span>Suma Total Otros Gastos:</span>
                          <span>{localFormatCurrency(fromUSD(unifiedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)))}</span>
                        </div>
                      </div>
                    )}
                  </div>
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
                  (isEditing ? Number(editedReturnsLoss) : activeData.returnsLoss) +
                  (isEditing ? Number(editedOtherExpenses) : activeData.otherExpenses)
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* DETALLE DE PUBLICIDAD (ADS) POR MES */}
      <div className="glass-card p-6 bg-black border border-slate-900 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-display font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="text-neon">📢</span> Detalle de Publicidad y Campañas (Ads)
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Gastos de publicidad importados de la sección de campañas para {currentMonthLabel} {selectedYear}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg">
              Mes: {currentMonthLabel} {selectedYear}
            </span>
          </div>
        </div>

        {/* Expenses List for current selectedMonth */}
        {(() => {
          const monthPrefix = `${selectedYear}-${selectedMonth}`;
          const filteredAdList = adExpenses.filter(e => e.date && matchDatePrefix(e.date, monthPrefix));

          if (filteredAdList.length === 0) {
            return (
              <div className="py-8 text-center bg-slate-950/40 border border-slate-900 border-dashed rounded-xl">
                <p className="text-sm text-slate-500 font-mono">No hay gastos de publicidad registrados para {currentMonthLabel} {selectedYear}.</p>
                <p className="text-xs text-slate-600 font-mono mt-1">Los gastos de publicidad de campañas se sumarán automáticamente si existen, de lo contrario se utilizará el costo estimado en los pedidos.</p>
              </div>
            );
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="pb-3 pl-2">Producto</th>
                    <th className="pb-3">Plataforma</th>
                    <th className="pb-3">Fecha</th>
                    <th className="pb-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {filteredAdList.map((expense) => {
                    const displayAmt = fromUSD(expense.amount);
                    return (
                      <tr key={expense.id} className="hover:bg-slate-950/40 transition-colors">
                        <td className="py-3.5 pl-2 font-bold text-slate-200">
                          {expense.productName || 'Campaña General'}
                        </td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] border ${
                            expense.platform.includes('Facebook') ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            expense.platform.includes('TikTok') ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' :
                            expense.platform.includes('Google') ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                            'bg-slate-900 text-slate-400 border-slate-800'
                          }`}>
                            {expense.platform}
                          </span>
                        </td>
                        <td className="py-3.5 text-slate-400">{expense.date}</td>
                        <td className="py-3.5 text-right font-bold text-slate-200">{localFormatCurrency(displayAmt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-800">
                    <td colSpan={3} className="py-4 pl-2 font-bold text-slate-400">Total de Publicidad (Filtrado por Mes):</td>
                    <td className="py-4 text-right font-bold text-neon text-sm">
                      {localFormatCurrency(fromUSD(filteredAdList.reduce((sum, e) => sum + (e.amount || 0), 0)))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}
      </div>

      {/* OTRAS PLATAFORMAS DETAILED LIST & ADD FORM */}
      <div id="other-expenses-section" className="glass-card p-6 bg-black border border-slate-900 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-display font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="text-neon">💼</span> Otras Plataformas y Gastos Operativos
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5 text-left">
              Administra suscripciones, software, sueldos y gastos de plataforma en tiempo real para {currentMonthLabel} {selectedYear}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleImportAllPlatformExpenses}
              className="px-3.5 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl text-xs font-mono font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              title="Jalar automáticamente todos los gastos de plataforma de este mes con su nombre y monto"
            >
              ⚡ Jalar Gastos de Plataforma ({
                fixedExpenses.filter(e => e.startDate && matchDatePrefix(e.startDate, `${selectedYear}-${selectedMonth}`)).length + 
                variableExpenses.filter(e => e.startDate && matchDatePrefix(e.startDate, `${selectedYear}-${selectedMonth}`)).length
              })
            </button>
            <button
              onClick={() => setShowAddOtherForm(!showAddOtherForm)}
              className="px-4 py-2 bg-neon/10 hover:bg-neon/20 border border-neon/30 text-neon rounded-xl text-sm font-mono font-bold transition-all active:scale-95 shrink-0 flex items-center justify-center gap-2 cursor-pointer"
            >
              {showAddOtherForm ? 'Cancelar' : '+ Agregar Gasto'}
            </button>
          </div>
        </div>

        {/* Collapsible Add Form */}
        {showAddOtherForm && (
          <form onSubmit={handleAddOtherExpense} className="mb-6 p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-900 pb-3 gap-2">
              <h4 className="text-sm font-bold text-slate-300 font-mono uppercase tracking-wider">Nuevo Gasto</h4>
              
              {/* Quick Autocomplete dropdown */}
              {(fixedExpenses.length > 0 || variableExpenses.length > 0) && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">⚡ Autocompletar:</span>
                  <select
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      const [type, id] = val.split(':');
                      const source = type === 'fixed' ? fixedExpenses : variableExpenses;
                      const found = source.find(item => item.id === id);
                      if (found) {
                        setNewOtherExpense({
                          name: found.name,
                          category: found.category || 'Software',
                          amount: String(Math.round(fromUSD(found.amount) * 100) / 100),
                          date: found.startDate || `${selectedYear}-${selectedMonth}-01`
                        });
                        setNewExpenseType(type as any);
                      }
                      e.target.value = '';
                    }}
                    className="bg-black border border-slate-800 text-slate-300 font-mono text-xs rounded-lg px-2.5 py-1 focus:border-neon outline-none cursor-pointer max-w-xs"
                  >
                    <option value="">-- Cargar de Gastos de Plataforma --</option>
                    {fixedExpenses.length > 0 && (
                      <optgroup label="🔒 Gastos Fijos">
                        {fixedExpenses.map(item => (
                          <option key={`fixed:${item.id}`} value={`fixed:${item.id}`}>
                            {item.name} ({localFormatCurrency(fromUSD(item.amount))})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {variableExpenses.length > 0 && (
                      <optgroup label="⚡ Gastos Variables">
                        {variableExpenses.map(item => (
                          <option key={`variable:${item.id}`} value={`variable:${item.id}`}>
                            {item.name} ({localFormatCurrency(fromUSD(item.amount))})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-mono">Tipo de Gasto</label>
                <select
                  value={newExpenseType}
                  onChange={(e) => setNewExpenseType(e.target.value as any)}
                  className="w-full bg-black border border-slate-800 focus:border-neon rounded-lg px-3 py-2 text-white text-sm outline-none font-mono"
                >
                  <option value="other">Gasto Único / Manual</option>
                  <option value="fixed">🔒 Gasto Fijo (Plataforma)</option>
                  <option value="variable">⚡ Gasto Variable (Plataforma)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-mono">Nombre / Descripción</label>
                <input
                  id="new-expense-name-input"
                  type="text"
                  required
                  placeholder="Ej: Shopify Plus, Diseñador, Hosting"
                  value={newOtherExpense.name}
                  onChange={(e) => setNewOtherExpense(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-black border border-slate-800 focus:border-neon rounded-lg px-3 py-2 text-white text-sm outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-mono">Categoría</label>
                <select
                  value={newOtherExpense.category}
                  onChange={(e) => setNewOtherExpense(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-black border border-slate-800 focus:border-neon rounded-lg px-3 py-2 text-white text-sm outline-none font-mono"
                >
                  <option value="Software">Software & Apps</option>
                  <option value="Sueldos">Sueldos & Comisiones</option>
                  <option value="Servicios">Hosting & Servicios</option>
                  <option value="Marketing">Diseño & Publicidad extra</option>
                  <option value="Oficina">Alquiler & Oficina</option>
                  <option value="Otro">Otro gasto</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-mono">Monto ({currencySymbol})</label>
                <input
                  type="number"
                  required
                  step="any"
                  placeholder="0.00"
                  value={newOtherExpense.amount}
                  onChange={(e) => setNewOtherExpense(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full bg-black border border-slate-800 focus:border-neon rounded-lg px-3 py-2 text-white text-sm outline-none font-mono text-right"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-mono">Fecha</label>
                <input
                  type="date"
                  required
                  value={newOtherExpense.date}
                  onChange={(e) => setNewOtherExpense(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full bg-black border border-slate-800 focus:border-neon rounded-lg px-3 py-2 text-white text-sm outline-none font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-neon hover:bg-neon/90 text-background font-mono font-bold text-xs rounded-lg transition-all active:scale-95 cursor-pointer"
              >
                Guardar Gasto
              </button>
            </div>
          </form>
        )}

        {/* Expenses List for current selectedMonth */}
        {(() => {
          if (unifiedExpenses.length === 0) {
            return (
              <div className="py-8 text-center bg-slate-950/40 border border-slate-900 border-dashed rounded-xl">
                <p className="text-sm text-slate-500 font-mono">No hay otros gastos registrados para {currentMonthLabel} {selectedYear}.</p>
                <p className="text-xs text-slate-600 font-mono mt-1">Los gastos fijos, variables o suscripciones de este mes se sumarán y mostrarán aquí en tiempo real.</p>
              </div>
            );
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="pb-3 pl-2">Descripción</th>
                    <th className="pb-3">Tipo</th>
                    <th className="pb-3">Categoría</th>
                    <th className="pb-3">Fecha</th>
                    <th className="pb-3 text-right">Monto</th>
                    <th className="pb-3 pr-2 text-center w-12">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {unifiedExpenses.map((expense) => {
                    // Since stored in USD base, convert to display currency
                    const displayAmt = fromUSD(expense.amount);
                    return (
                      <tr key={expense.id} className="hover:bg-slate-950/40 transition-colors">
                        <td className="py-3.5 pl-2 font-bold text-slate-200">{expense.name}</td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] border ${
                            expense.source === 'fixed' 
                              ? 'bg-neon/10 text-neon border-neon/20' 
                              : expense.source === 'variable' 
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                            {expense.typeLabel}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 text-[10px] border border-slate-800">
                            {expense.category || 'Software'}
                          </span>
                        </td>
                        <td className="py-3.5 text-slate-400">{expense.date}</td>
                        <td className="py-3.5 text-right font-bold text-slate-200">{localFormatCurrency(displayAmt)}</td>
                        <td className="py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteOtherExpense(expense)}
                            className="p-1 hover:text-red-500 text-slate-500 transition-all hover:scale-110 active:scale-95 cursor-pointer"
                            title="Eliminar gasto"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-800">
                    <td colSpan={4} className="py-4 pl-2 font-bold text-slate-400">Total de Otras Plataformas y Gastos Operativos:</td>
                    <td className="py-4 text-right font-bold text-neon text-sm">
                      {localFormatCurrency(fromUSD(unifiedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}
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
