import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, 
  Coins, 
  TrendingUp, 
  Trash2, 
  Search, 
  Filter, 
  AlertTriangle, 
  TrendingDown, 
  Sparkles, 
  X, 
  Plus, 
  Pencil, 
  Layers, 
  Calculator as CalcIcon, 
  Target, 
  Package, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight,
  Info,
  RefreshCw,
  Tag,
  Hash,
  Laptop,
  Monitor,
  Check,
  Copy
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './Auth';
import { CurrencyCode, Order } from '../mockData';

export interface AdDailyLog {
  id: string;
  adId?: string; // ID del anuncio (e.g. "AD-10294", "TK-01")
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM e.g. "2026-08"
  platform: string;
  campaignType: 'whatsapp' | 'landing';
  spend: number;
  salesCount: number;
  productName?: string;
  productSource?: 'calculator' | 'research' | 'orders' | 'custom';
  targetCpa?: number;
  notes?: string;
  uid?: string;
  timestamp?: number;
}

export interface AutoProductOption {
  id: string;
  name: string;
  source: 'calculator' | 'research' | 'orders' | 'custom';
  sourceLabel: string;
  channel?: 'whatsapp' | 'landing';
  cpaAds?: number;
  price?: number;
  costPerUnit?: number;
  currency?: string;
  notes?: string;
}

export interface KnownAdOption {
  adId: string;
  productName: string;
  productSource?: 'calculator' | 'research' | 'orders' | 'custom';
  platform: string;
  campaignType: 'whatsapp' | 'landing';
  targetCpa?: number;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const getMonthKeyFromDate = (dateStr: string): string => {
  if (!dateStr) return format(new Date(), 'yyyy-MM');
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}`;
  }
  return format(new Date(), 'yyyy-MM');
};

export const formatMonthLabel = (monthKey: string): string => {
  if (!monthKey) return 'Mes Actual';
  const parts = monthKey.split('-');
  if (parts.length >= 2) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${MONTH_NAMES[monthIdx]} ${year}`;
    }
  }
  return monthKey;
};

interface AdPanelProps {
  theme?: string;
  orders?: Order[];
  formatCurrency?: (val: number) => string;
  currency?: CurrencyCode;
}

export default function AdPanel({ 
  theme = 'theme-dark-green',
  orders = [],
  formatCurrency = (val: number) => `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  currency = 'USD'
}: AdPanelProps) {
  const isLight = theme === 'theme-light-white';
  const { user } = useAuth();

  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [copiedAdId, setCopiedAdId] = useState<string | null>(null);

  // Core state for Ad Daily Logs (synchronized with Firestore + localStorage cache)
  const [adDailyLogs, setAdDailyLogs] = useState<AdDailyLog[]>(() => {
    const saved = localStorage.getItem('profit_os_ad_daily_logs');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            ...item,
            adId: item.adId || '',
            month: item.month || getMonthKeyFromDate(item.date || format(new Date(), 'yyyy-MM-dd')),
            productName: item.productName || 'Producto General',
            productSource: item.productSource || 'custom',
            targetCpa: typeof item.targetCpa === 'number' ? item.targetCpa : undefined
          }));
        }
      } catch (e) {
        console.error('Error parsing ad daily logs:', e);
      }
    }
    const today = format(new Date(), 'yyyy-MM-dd');
    const currentMonth = getMonthKeyFromDate(today);
    return [
      { 
        id: 'log_default_1', 
        adId: 'AD-TK-NASAL-01',
        date: today, 
        month: currentMonth,
        productName: 'G-Fouk Limpiador Nasal x 2',
        productSource: 'calculator',
        targetCpa: 14,
        platform: 'TikTok Ads', 
        campaignType: 'whatsapp', 
        spend: 120, 
        salesCount: 15 
      },
      { 
        id: 'log_default_2', 
        adId: 'AD-FB-WATCH-02',
        date: today, 
        month: currentMonth,
        productName: 'SmartWatch Ultra Titanium Pro',
        productSource: 'research',
        targetCpa: 18,
        platform: 'Facebook Ads', 
        campaignType: 'landing', 
        spend: 250, 
        salesCount: 22 
      },
      { 
        id: 'log_default_3', 
        adId: 'AD-IG-LAMP-03',
        date: today, 
        month: currentMonth,
        productName: 'Lámpara LED Solar Sensor Exterior',
        productSource: 'calculator',
        targetCpa: 10,
        platform: 'Instagram Ads', 
        campaignType: 'landing', 
        spend: 180, 
        salesCount: 18 
      }
    ];
  });

  // State for products auto-pulled from Calculadora & Investigación
  const [calcProducts, setCalcProducts] = useState<AutoProductOption[]>([]);
  const [researchProducts, setResearchProducts] = useState<AutoProductOption[]>([]);

  // 1. FIRESTORE REAL-TIME SYNCHRONIZATION FOR AD LOGS
  useEffect(() => {
    if (!user?.uid) return;

    setIsCloudSyncing(true);
    const q = query(
      collection(db, 'ad_panel_logs'),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      setIsCloudSyncing(false);

      if (!snapshot.empty) {
        const cloudLogs: AdDailyLog[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          cloudLogs.push({
            id: docSnap.id,
            adId: data.adId || '',
            date: data.date || format(new Date(), 'yyyy-MM-dd'),
            month: data.month || getMonthKeyFromDate(data.date),
            platform: data.platform || 'TikTok Ads',
            campaignType: (data.campaignType === 'whatsapp' ? 'whatsapp' : 'landing'),
            spend: Number(data.spend) || 0,
            salesCount: Number(data.salesCount) || 0,
            productName: data.productName || 'Producto General',
            productSource: data.productSource || 'custom',
            targetCpa: typeof data.targetCpa === 'number' ? data.targetCpa : undefined,
            notes: data.notes || '',
            uid: data.uid,
            timestamp: data.timestamp || 0
          });
        });

        // Sort by date descending, then timestamp descending
        cloudLogs.sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return (b.timestamp || 0) - (a.timestamp || 0);
        });

        setAdDailyLogs(cloudLogs);
        localStorage.setItem('profit_os_ad_daily_logs', JSON.stringify(cloudLogs));
      } else {
        // Auto migrate local to Firestore
        const saved = localStorage.getItem('profit_os_ad_daily_logs');
        if (saved) {
          try {
            const localList = JSON.parse(saved);
            if (Array.isArray(localList) && localList.length > 0) {
              const batch = writeBatch(db);
              localList.forEach((item: any, idx: number) => {
                const docId = (item.id && !item.id.includes('default')) ? item.id.replace(/[^a-zA-Z0-9_-]/g, '_') : `adlog_${Date.now()}_${idx}`;
                const docRef = doc(db, 'ad_panel_logs', docId);
                batch.set(docRef, {
                  uid: user.uid,
                  adId: item.adId || '',
                  date: item.date || format(new Date(), 'yyyy-MM-dd'),
                  month: item.month || getMonthKeyFromDate(item.date),
                  platform: item.platform || 'TikTok Ads',
                  campaignType: item.campaignType === 'whatsapp' ? 'whatsapp' : 'landing',
                  spend: Number(item.spend) || 0,
                  salesCount: Number(item.salesCount) || 0,
                  productName: item.productName || 'Producto General',
                  productSource: item.productSource || 'custom',
                  targetCpa: Number(item.targetCpa) || 0,
                  notes: item.notes || '',
                  timestamp: Date.now()
                });
              });
              await batch.commit();
            }
          } catch (migrateErr) {
            console.error('Error auto-migrating local ad logs to Firestore:', migrateErr);
          }
        }
      }
    }, (err) => {
      console.error('Firestore ad_panel_logs snapshot error:', err);
      setIsCloudSyncing(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 2. FIRESTORE REAL-TIME SYNCHRONIZATION FOR SAVED PRODUCTS (Calculadora)
  useEffect(() => {
    if (!user?.uid) {
      loadCalculatorProductsLocal();
      return;
    }

    try {
      const qSaved = query(collection(db, 'savedProducts'), where('uid', '==', user.uid));
      const unsubSaved = onSnapshot(qSaved, (snapshot) => {
        const firestoreList: AutoProductOption[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const rawCpa = parseFloat(String(data.cpaAds || '0').replace(/[^0-9.]/g, '')) || 0;
          firestoreList.push({
            id: docSnap.id,
            name: data.name || 'Sin nombre',
            source: 'calculator',
            sourceLabel: '🧮 Calculadora (Cloud)',
            channel: 'landing',
            cpaAds: rawCpa > 0 ? rawCpa : undefined,
            costPerUnit: parseFloat(String(data.costPerUnit || '0')) || undefined,
            currency: data.currency || currency,
            notes: data.notes || ''
          });
        });

        if (firestoreList.length > 0) {
          setCalcProducts(firestoreList);
        } else {
          loadCalculatorProductsLocal();
        }
      }, (err) => {
        console.error('Firestore savedProducts error:', err);
        loadCalculatorProductsLocal();
      });

      return () => unsubSaved();
    } catch (e) {
      loadCalculatorProductsLocal();
    }
  }, [user, currency]);

  // Fallback loader from localStorage for Calculator
  const loadCalculatorProductsLocal = () => {
    try {
      const saved = localStorage.getItem('ecommil_saved_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const list: AutoProductOption[] = parsed.map((p: any) => {
            const rawCpa = parseFloat(String(p.cpaAds || '0').replace(/[^0-9.]/g, '')) || 0;
            return {
              id: p.id || p.productId || `calc-${p.name}`,
              name: p.name || 'Sin nombre',
              source: 'calculator',
              sourceLabel: '🧮 Calculadora',
              channel: 'landing',
              cpaAds: rawCpa > 0 ? rawCpa : undefined,
              costPerUnit: parseFloat(String(p.costPerUnit || '0')) || undefined,
              currency: p.currency || currency,
              notes: p.notes || ''
            };
          });
          setCalcProducts(list);
        }
      }
    } catch (e) {
      console.error('Error loading local calculator products:', e);
    }
  };

  // 3. FIRESTORE REAL-TIME SYNCHRONIZATION FOR MARKET RESEARCH (Investigación)
  useEffect(() => {
    if (!user?.uid) {
      loadResearchProductsLocal();
      return;
    }

    try {
      const qRes = query(collection(db, 'market_research'), where('uid', '==', user.uid));
      const unsubRes = onSnapshot(qRes, (snapshot) => {
        const firestoreList: AutoProductOption[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const channel = (data.channel === 'WhatsApp' || data.channel === 'whatsapp') ? 'whatsapp' : 'landing';
          firestoreList.push({
            id: docSnap.id,
            name: data.productName || 'Producto Investigado',
            source: 'research',
            sourceLabel: '🔍 Investigación (Cloud)',
            channel: channel,
            price: data.price,
            notes: data.notes || ''
          });
        });

        if (firestoreList.length > 0) {
          setResearchProducts(firestoreList);
        } else {
          loadResearchProductsLocal();
        }
      }, (err) => {
        console.error('Firestore market_research snapshot error:', err);
        loadResearchProductsLocal();
      });

      return () => unsubRes();
    } catch (e) {
      loadResearchProductsLocal();
    }
  }, [user]);

  // Fallback loader from localStorage for Market Research
  const loadResearchProductsLocal = () => {
    try {
      const saved = localStorage.getItem('ecommil_market_research_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const list: AutoProductOption[] = parsed.map((item: any) => {
            const channel = (item.channel === 'WhatsApp' || item.channel === 'whatsapp') ? 'whatsapp' : 'landing';
            return {
              id: item.id || `research-${item.productName}`,
              name: item.productName || 'Producto de Investigación',
              source: 'research',
              sourceLabel: '🔍 Investigación',
              channel: channel,
              price: item.price,
              notes: item.notes || ''
            };
          });
          setResearchProducts(list);
        }
      }
    } catch (e) {
      console.error('Error loading local research products:', e);
    }
  };

  // Combine unique product options
  const availableProductOptions = useMemo(() => {
    const map = new Map<string, AutoProductOption>();

    calcProducts.forEach(p => {
      if (p.name) map.set(`calc-${p.name.toLowerCase().trim()}`, p);
    });

    researchProducts.forEach(p => {
      if (p.name) {
        const key = `res-${p.name.toLowerCase().trim()}`;
        if (!map.has(key)) map.set(key, p);
      }
    });

    if (orders && orders.length > 0) {
      const uniqueOrderProducts = Array.from(new Set(orders.map(o => o.product).filter(Boolean)));
      uniqueOrderProducts.forEach(prodName => {
        const key = `ord-${prodName.toLowerCase().trim()}`;
        if (!Array.from(map.values()).some(v => v.name.toLowerCase().trim() === prodName.toLowerCase().trim())) {
          map.set(key, {
            id: `ord-${prodName}`,
            name: prodName,
            source: 'orders',
            sourceLabel: '📦 Pedidos Dropi',
            channel: 'landing'
          });
        }
      });
    }

    adDailyLogs.forEach(log => {
      if (log.productName && !Array.from(map.values()).some(v => v.name.toLowerCase().trim() === log.productName!.toLowerCase().trim())) {
        map.set(`log-${log.productName.toLowerCase().trim()}`, {
          id: `log-prod-${log.productName}`,
          name: log.productName,
          source: log.productSource || 'custom',
          sourceLabel: '🏷️ Registro Previo',
          channel: log.campaignType,
          cpaAds: log.targetCpa
        });
      }
    });

    return Array.from(map.values());
  }, [calcProducts, researchProducts, orders, adDailyLogs]);

  // Catalog of known Ad IDs with their configured details for instant autocompletion
  const knownAdCatalog = useMemo(() => {
    const map = new Map<string, KnownAdOption>();
    
    adDailyLogs.forEach(log => {
      if (log.adId && log.adId.trim()) {
        const cleanId = log.adId.trim();
        if (!map.has(cleanId.toLowerCase())) {
          map.set(cleanId.toLowerCase(), {
            adId: cleanId,
            productName: log.productName || '',
            productSource: log.productSource,
            platform: log.platform,
            campaignType: log.campaignType,
            targetCpa: log.targetCpa
          });
        }
      }
    });

    return Array.from(map.values());
  }, [adDailyLogs]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [autoFillSuccessMessage, setAutoFillSuccessMessage] = useState<string | null>(null);
  const [showAdIdSuggestions, setShowAdIdSuggestions] = useState(false);

  // Form State
  const [adLogForm, setAdLogForm] = useState({
    adId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    month: getMonthKeyFromDate(format(new Date(), 'yyyy-MM-dd')),
    platform: 'TikTok Ads',
    campaignType: 'landing' as 'whatsapp' | 'landing',
    spend: 100,
    salesCount: 10,
    productName: '',
    productSource: 'custom' as 'calculator' | 'research' | 'orders' | 'custom',
    targetCpa: 0,
    notes: ''
  });

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterProduct, setFilterProduct] = useState<string>('all');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterCampaign, setFilterCampaign] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Handle Autocompletion when typing or selecting an Ad ID
  const handleAdIdChange = (inputVal: string) => {
    setAdLogForm(prev => ({ ...prev, adId: inputVal }));

    if (!inputVal.trim()) return;

    // Check exact or trimmed match in known catalog
    const matched = knownAdCatalog.find(
      item => item.adId.toLowerCase().trim() === inputVal.toLowerCase().trim()
    );

    if (matched) {
      setAdLogForm(prev => ({
        ...prev,
        adId: matched.adId,
        productName: matched.productName || prev.productName,
        productSource: matched.productSource || prev.productSource,
        platform: matched.platform || prev.platform,
        campaignType: matched.campaignType || prev.campaignType,
        targetCpa: matched.targetCpa || prev.targetCpa
      }));

      setAutoFillSuccessMessage(`⚡ ¡ID de Anuncio reconocido (${matched.adId})! Producto, plataforma y campaña autocompletados.`);
      setTimeout(() => setAutoFillSuccessMessage(null), 5000);
    }
  };

  // Select a known Ad ID from the suggestion list
  const handleSelectKnownAdId = (item: KnownAdOption) => {
    setAdLogForm(prev => ({
      ...prev,
      adId: item.adId,
      productName: item.productName || prev.productName,
      productSource: item.productSource || prev.productSource,
      platform: item.platform || prev.platform,
      campaignType: item.campaignType || prev.campaignType,
      targetCpa: item.targetCpa || prev.targetCpa
    }));
    setShowAdIdSuggestions(false);
    setAutoFillSuccessMessage(`⚡ ¡Autocompletado con éxito desde ID de Anuncio #${item.adId}!`);
    setTimeout(() => setAutoFillSuccessMessage(null), 5000);
  };

  // Handle selecting a product to auto-fill data
  const handleSelectProductAutoPull = (selectedName: string) => {
    if (!selectedName) {
      setAdLogForm(prev => ({
        ...prev,
        productName: '',
        productSource: 'custom',
        targetCpa: 0
      }));
      setAutoFillSuccessMessage(null);
      return;
    }

    const matchedOption = availableProductOptions.find(
      opt => opt.name.toLowerCase().trim() === selectedName.toLowerCase().trim()
    );

    if (matchedOption) {
      setAdLogForm(prev => ({
        ...prev,
        productName: matchedOption.name,
        productSource: matchedOption.source,
        campaignType: matchedOption.channel || prev.campaignType,
        targetCpa: matchedOption.cpaAds || prev.targetCpa || 0,
        notes: ''
      }));

      const sourceText = matchedOption.source === 'calculator' 
        ? '🧮 Calculadora de Ganancia' 
        : matchedOption.source === 'research' 
        ? '🔍 Investigación de Mercado' 
        : '📦 Pedidos Dropi';
      
      const extraDetails = matchedOption.cpaAds 
        ? ` • CPA Meta jalado: $${matchedOption.cpaAds}` 
        : '';
      const channelDetail = matchedOption.channel 
        ? ` • Canal: ${matchedOption.channel === 'whatsapp' ? '💬 WhatsApp' : '📲 Página'}` 
        : '';

      setAutoFillSuccessMessage(`¡Datos jalados en automático desde ${sourceText}!${channelDetail}${extraDetails}`);
      setTimeout(() => setAutoFillSuccessMessage(null), 6000);
    } else {
      setAdLogForm(prev => ({
        ...prev,
        productName: selectedName,
        productSource: 'custom'
      }));
      setAutoFillSuccessMessage(null);
    }
  };

  // Submit Add / Edit (persisted directly to Firestore + optimistic local state update)
  const handleAddAdLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedDate = adLogForm.date || format(new Date(), 'yyyy-MM-dd');
    const resolvedMonth = getMonthKeyFromDate(resolvedDate);
    const resolvedProductName = adLogForm.productName.trim() || 'Producto General';
    const resolvedAdId = adLogForm.adId.trim();

    if (editingLogId) {
      // 1. Update in Firestore if logged in
      if (user?.uid) {
        try {
          await updateDoc(doc(db, 'ad_panel_logs', editingLogId), {
            adId: resolvedAdId,
            date: resolvedDate,
            month: resolvedMonth,
            platform: adLogForm.platform,
            campaignType: adLogForm.campaignType,
            spend: Number(adLogForm.spend) || 0,
            salesCount: Number(adLogForm.salesCount) || 0,
            productName: resolvedProductName,
            productSource: adLogForm.productSource,
            targetCpa: Number(adLogForm.targetCpa) || 0,
            notes: adLogForm.notes || '',
            timestamp: Date.now()
          });
        } catch (err) {
          console.error('Error updating ad log in Firestore:', err);
        }
      }

      // 2. Optimistic local update
      setAdDailyLogs(prev => prev.map(log => {
        if (log.id === editingLogId) {
          return {
            ...log,
            adId: resolvedAdId,
            date: resolvedDate,
            month: resolvedMonth,
            platform: adLogForm.platform,
            campaignType: adLogForm.campaignType,
            spend: Number(adLogForm.spend) || 0,
            salesCount: Number(adLogForm.salesCount) || 0,
            productName: resolvedProductName,
            productSource: adLogForm.productSource,
            targetCpa: Number(adLogForm.targetCpa) || undefined,
            notes: adLogForm.notes
          };
        }
        return log;
      }));
      setEditingLogId(null);
    } else {
      const newId = `adlog_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
      // 1. Create in Firestore if logged in
      if (user?.uid) {
        try {
          await setDoc(doc(db, 'ad_panel_logs', newId), {
            uid: user.uid,
            adId: resolvedAdId,
            date: resolvedDate,
            month: resolvedMonth,
            platform: adLogForm.platform,
            campaignType: adLogForm.campaignType,
            spend: Number(adLogForm.spend) || 0,
            salesCount: Number(adLogForm.salesCount) || 0,
            productName: resolvedProductName,
            productSource: adLogForm.productSource,
            targetCpa: Number(adLogForm.targetCpa) || 0,
            notes: adLogForm.notes || '',
            timestamp: Date.now()
          });
        } catch (err) {
          console.error('Error saving ad log to Firestore:', err);
        }
      }

      // 2. Optimistic local update
      const newLog: AdDailyLog = {
        id: newId,
        adId: resolvedAdId,
        date: resolvedDate,
        month: resolvedMonth,
        platform: adLogForm.platform,
        campaignType: adLogForm.campaignType,
        spend: Number(adLogForm.spend) || 0,
        salesCount: Number(adLogForm.salesCount) || 0,
        productName: resolvedProductName,
        productSource: adLogForm.productSource,
        targetCpa: Number(adLogForm.targetCpa) || undefined,
        notes: adLogForm.notes,
        uid: user?.uid,
        timestamp: Date.now()
      };
      setAdDailyLogs(prev => [newLog, ...prev]);
    }

    setIsModalOpen(false);
    setAutoFillSuccessMessage(null);
  };

  const handleEditAdLog = (log: AdDailyLog) => {
    setEditingLogId(log.id);
    setAdLogForm({
      adId: log.adId || '',
      date: log.date,
      month: log.month || getMonthKeyFromDate(log.date),
      platform: log.platform,
      campaignType: log.campaignType,
      spend: log.spend,
      salesCount: log.salesCount,
      productName: log.productName || '',
      productSource: log.productSource || 'custom',
      targetCpa: log.targetCpa || 0,
      notes: log.notes || ''
    });
    setAutoFillSuccessMessage(null);
    setIsModalOpen(true);
  };

  const handleDeleteAdLog = async (id: string) => {
    if (user?.uid) {
      try {
        await deleteDoc(doc(db, 'ad_panel_logs', id));
      } catch (err) {
        console.error('Error deleting ad log from Firestore:', err);
      }
    }

    setAdDailyLogs(prev => prev.filter(log => log.id !== id));
    if (editingLogId === id) {
      setEditingLogId(null);
    }
  };

  // Distinct Months list extracted from logs + current month
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const currentM = getMonthKeyFromDate(format(new Date(), 'yyyy-MM-dd'));
    monthsSet.add(currentM);

    adDailyLogs.forEach(log => {
      const m = log.month || getMonthKeyFromDate(log.date);
      if (m) monthsSet.add(m);
    });

    return Array.from(monthsSet).sort().reverse();
  }, [adDailyLogs]);

  // Distinct Products list from logs
  const distinctLoggedProducts = useMemo(() => {
    const set = new Set<string>();
    adDailyLogs.forEach(log => {
      if (log.productName) set.add(log.productName);
    });
    return Array.from(set);
  }, [adDailyLogs]);

  // Filter logs based on Month, Product, Platform, Campaign, Dates, and Search Query (Ad ID / Product)
  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return adDailyLogs.filter(log => {
      const logMonth = log.month || getMonthKeyFromDate(log.date);
      const matchMonth = filterMonth === 'all' || logMonth === filterMonth;
      const matchProduct = filterProduct === 'all' || (log.productName && log.productName.toLowerCase().trim() === filterProduct.toLowerCase().trim());
      const matchPlatform = filterPlatform === 'all' || log.platform === filterPlatform;
      const matchCampaign = filterCampaign === 'all' || log.campaignType === filterCampaign;
      const matchStartDate = !filterStartDate || log.date >= filterStartDate;
      const matchEndDate = !filterEndDate || log.date <= filterEndDate;
      
      const matchSearch = !q || 
        (log.adId && log.adId.toLowerCase().includes(q)) || 
        (log.productName && log.productName.toLowerCase().includes(q)) ||
        (log.platform && log.platform.toLowerCase().includes(q));

      return matchMonth && matchProduct && matchPlatform && matchCampaign && matchStartDate && matchEndDate && matchSearch;
    });
  }, [adDailyLogs, filterMonth, filterProduct, filterPlatform, filterCampaign, filterStartDate, filterEndDate, searchQuery]);

  // Totals calculations
  const totalSpend = useMemo(() => filteredLogs.reduce((sum, log) => sum + log.spend, 0), [filteredLogs]);
  const totalSalesCount = useMemo(() => filteredLogs.reduce((sum, log) => sum + log.salesCount, 0), [filteredLogs]);
  const averageCpa = totalSalesCount > 0 ? totalSpend / totalSalesCount : 0;
  
  const logsWithTarget = filteredLogs.filter(l => (l.targetCpa || 0) > 0);
  const averageTargetCpa = logsWithTarget.length > 0 
    ? logsWithTarget.reduce((sum, l) => sum + (l.targetCpa || 0), 0) / logsWithTarget.length 
    : 0;

  // Monthly summary breakdown
  const monthlyBreakdown = useMemo(() => {
    const map = new Map<string, { month: string; spend: number; sales: number; count: number }>();
    adDailyLogs.forEach(log => {
      const m = log.month || getMonthKeyFromDate(log.date);
      const current = map.get(m) || { month: m, spend: 0, sales: 0, count: 0 };
      current.spend += log.spend;
      current.sales += log.salesCount;
      current.count += 1;
      map.set(m, current);
    });
    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [adDailyLogs]);

  // Product summary breakdown
  const productBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; spend: number; sales: number; source: string; targetCpa?: number; adIds: Set<string> }>();
    filteredLogs.forEach(log => {
      const pName = log.productName || 'Producto General';
      const current = map.get(pName) || { 
        name: pName, 
        spend: 0, 
        sales: 0, 
        source: log.productSource || 'custom',
        targetCpa: log.targetCpa,
        adIds: new Set<string>()
      };
      current.spend += log.spend;
      current.sales += log.salesCount;
      if (log.adId) current.adIds.add(log.adId);
      if (log.targetCpa && !current.targetCpa) current.targetCpa = log.targetCpa;
      map.set(pName, current);
    });
    return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
  }, [filteredLogs]);

  // Filter matching Ad IDs for autocomplete dropdown in modal
  const matchingAdSuggestions = useMemo(() => {
    if (!adLogForm.adId) return knownAdCatalog;
    const q = adLogForm.adId.toLowerCase().trim();
    return knownAdCatalog.filter(k => k.adId.toLowerCase().includes(q));
  }, [knownAdCatalog, adLogForm.adId]);

  return (
    <div className="space-y-[15px]">
      {/* Cloud Cross-Device Sync Status Bar */}
      <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 rounded-2xl border ${
        user?.uid 
          ? (isLight ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' : 'bg-emerald-950/30 border-emerald-500/20 text-emerald-400')
          : (isLight ? 'bg-amber-50/80 border-amber-200 text-amber-900' : 'bg-amber-950/30 border-amber-500/20 text-amber-400')
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-bold text-[13px]">
            <Monitor size={15} />
            <span className="text-slate-400">•</span>
            <Laptop size={15} />
          </div>
          <span className="text-[12px] font-bold">
            {user?.uid ? (
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Base de Datos Sincronizada en Tiempo Real (PC & Laptop vinculadas a tu cuenta)
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                ⚠️ Modo Offline Local: Inicia sesión para sincronizar automáticamente entre tu PC y Laptop.
              </span>
            )}
          </span>
        </div>

        {user?.uid && (
          <div className="flex items-center gap-2 text-[11px] opacity-80 font-mono">
            {isCloudSyncing ? (
              <span className="flex items-center gap-1 text-orange-400">
                <RefreshCw size={12} className="animate-spin" /> Guardando en Firestore...
              </span>
            ) : (
              <span>☁️ Firestore ID: {adDailyLogs.length} registros sincronizados</span>
            )}
          </div>
        )}
      </div>

      {/* Header */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/5 rounded-3xl p-6 shadow-2xl backdrop-blur-md relative overflow-hidden ${isLight ? 'bg-[#fffbfb]' : 'bg-[#0f0f15]/80'}`}>
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#00df9a]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div>
          <div className="flex items-center gap-3">
            <h2 className={`text-4xl font-display font-black tracking-tighter uppercase leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>
              PANEL <span className="text-[#00df9a]">ADS</span>
            </h2>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${isLight ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
              {filterMonth === 'all' ? 'Todos los Meses' : formatMonthLabel(filterMonth)}
            </span>
          </div>
          <p className={`text-xs mt-2 font-sans max-w-xl ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Registra y gestiona tu inversión con <strong>ID del Anuncio</strong> y autocompletado inteligente, segmentado por <strong>Mes</strong> y <strong>Producto</strong> sincronizado en la Base de Datos.
          </p>
        </div>

        {/* Global summary stats */}
        <div className="flex flex-wrap gap-3">
          <div className={`border rounded-2xl px-5 py-3 min-w-[120px] ${isLight ? 'bg-[#ffffff] border-slate-200 text-left' : 'border-white/5 bg-white/[0.02] text-right'}`}>
            <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-widest font-sans">Inversión Total</span>
            <span className={`text-lg font-black tabular-nums block ${isLight ? 'text-slate-900 text-left' : 'text-white'}`}>${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          
          <div className={`border rounded-2xl px-5 py-3 min-w-[120px] ${isLight ? 'bg-[#ffffff] border-slate-200 text-left' : 'border-white/5 bg-white/[0.02] text-right'}`}>
            <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-widest font-sans">Ventas Totales</span>
            <span className={`font-black tabular-nums block ${isLight ? 'text-[19px] text-emerald-600 text-left' : 'text-lg text-[#00df9a]'}`}>{totalSalesCount} unds</span>
          </div>

          <div className={`border rounded-2xl px-5 py-3 text-right min-w-[120px] ${isLight ? 'bg-orange-50 border-orange-200' : 'bg-orange-500/10 border border-orange-500/20'}`}>
            <span className={`text-[9px] font-bold block uppercase tracking-widest font-sans ${isLight ? 'text-orange-700' : 'text-orange-400'}`}>CPA Promedio Real</span>
            <div className="flex items-baseline justify-end gap-1.5">
              <span className={`text-lg font-black tabular-nums ${isLight ? 'text-orange-600' : 'text-orange-400'}`}>${averageCpa.toFixed(2)}</span>
            </div>
            {averageTargetCpa > 0 && (
              <span className="text-[10px] text-slate-400 block font-mono">Meta: ${averageTargetCpa.toFixed(2)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Navigation Chips */}
      <div className={`border rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0f0f15]/70 border-white/5'}`}>
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1 pl-1">
            <Calendar size={13} /> Mes:
          </span>
          <button
            type="button"
            onClick={() => setFilterMonth('all')}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
              filterMonth === 'all'
                ? (isLight ? 'bg-orange-500 text-white border-orange-600 shadow-sm' : 'bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-sm')
                : (isLight ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200' : 'bg-white/5 text-slate-400 border-white/5 hover:text-white hover:bg-white/10')
            }`}
          >
            Todos los Meses
          </button>
          {availableMonths.map(mKey => (
            <button
              key={mKey}
              type="button"
              onClick={() => setFilterMonth(mKey)}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all cursor-pointer border whitespace-nowrap ${
                filterMonth === mKey
                  ? (isLight ? 'bg-orange-500 text-white border-orange-600 shadow-sm' : 'bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-sm')
                  : (isLight ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200' : 'bg-white/5 text-slate-400 border-white/5 hover:text-white hover:bg-white/10')
              }`}
            >
              📅 {formatMonthLabel(mKey)}
            </button>
          ))}
        </div>

        {/* Quick Product Source Indicator & Known Ads Count */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1 font-bold text-orange-400">
            <Hash size={12} /> {knownAdCatalog.length} IDs Anuncio
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> 🧮 {calcProducts.length} Calculadora
          </span>
          <span className="flex items-center gap-1 font-bold">
            <span className="w-2 h-2 rounded-full bg-purple-400"></span> 🔍 {researchProducts.length} Investigación
          </span>
          <button 
            type="button"
            onClick={() => {
              loadCalculatorProductsLocal();
              loadResearchProductsLocal();
            }}
            title="Recargar productos de Calculadora e Investigación"
            className={`p-1.5 rounded-lg border transition-all ${isLight ? 'border-slate-200 hover:bg-slate-100 text-slate-600' : 'border-white/5 hover:bg-white/10 text-slate-300'}`}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Main Full-Width Area */}
      <div className={`border rounded-3xl p-6 shadow-xl space-y-6 ${isLight ? 'bg-[#ffffff] border-slate-200 shadow-slate-100' : 'bg-[#0f0f15]/90 border border-white/5'}`}>
        
        {/* Upper Action Bar with all filters and "Registrar Pauta" button */}
        <div className={`flex flex-wrap items-center justify-between gap-4 border-b pb-5 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Search Input for ID Anuncio or Product */}
            <div className={`flex items-center gap-2 border rounded-xl px-3 py-1.5 text-[14px] ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111] border-white/5'}`}>
              <Search size={14} className="text-slate-400" />
              <input
                type="text"
                placeholder="Buscar ID Anuncio o Producto..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`bg-transparent text-[13px] focus:outline-none w-44 md:w-56 ${isLight ? 'text-slate-800' : 'text-slate-200'}`}
              />
              {searchQuery && (
                <button 
                  type="button" 
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-white font-bold text-xs"
                >
                  ×
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5">
              {/* Product Filter */}
              <div className="relative">
                <select 
                  value={filterProduct}
                  onChange={e => setFilterProduct(e.target.value)}
                  className={`border rounded-xl px-3.5 py-2 text-[14px] font-bold focus:outline-none focus:border-orange-500 cursor-pointer max-w-[200px] truncate ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#111] border-white/5 text-slate-300'}`}
                >
                  <option value="all">📦 Todos los Productos</option>
                  {distinctLoggedProducts.map(pName => (
                    <option key={pName} value={pName}>
                      {pName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Platform Filter */}
              <select 
                value={filterPlatform}
                onChange={e => setFilterPlatform(e.target.value)}
                className={`border rounded-xl px-3.5 py-2 text-[14px] focus:outline-none focus:border-orange-500 cursor-pointer ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#111] border-white/5 text-slate-300'}`}
              >
                <option value="all">Todas las plataformas</option>
                <option value="TikTok Ads">TikTok Ads</option>
                <option value="Facebook Ads">Facebook Ads</option>
                <option value="Instagram Ads">Instagram Ads</option>
                <option value="Google Ads">Google Ads</option>
                <option value="Pinterest Ads">Pinterest Ads</option>
                <option value="WhatsApp Orgánico">WhatsApp Orgánico</option>
              </select>

              {/* Campaign Type Filter */}
              <select 
                value={filterCampaign}
                onChange={e => setFilterCampaign(e.target.value)}
                className={`border rounded-xl px-3.5 py-2 text-[14px] focus:outline-none focus:border-orange-500 cursor-pointer ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#111] border-white/5 text-slate-300'}`}
              >
                <option value="all">Todos los tipos</option>
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="landing">📲 Página (Landing)</option>
              </select>

              {/* Fecha Inicio Filter */}
              <div className={`flex items-center gap-2 border rounded-xl px-3 py-1.5 text-[14px] ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111] border-white/5'}`}>
                <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider font-sans">Desde</span>
                <input 
                  type="date"
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                  className={`bg-transparent text-[13px] focus:outline-none cursor-pointer ${isLight ? 'text-slate-800' : 'text-slate-300 focus:text-white'}`}
                />
                {filterStartDate && (
                  <button 
                    type="button"
                    onClick={() => setFilterStartDate('')}
                    className="text-slate-500 hover:text-white font-bold text-xs"
                    title="Limpiar fecha"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Fecha Fin Filter */}
              <div className={`flex items-center gap-2 border rounded-xl px-3 py-1.5 text-[14px] ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111] border-white/5'}`}>
                <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider font-sans">Hasta</span>
                <input 
                  type="date"
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                  className={`bg-transparent text-[13px] focus:outline-none cursor-pointer ${isLight ? 'text-slate-800' : 'text-slate-300 focus:text-white'}`}
                />
                {filterEndDate && (
                  <button 
                    type="button"
                    onClick={() => setFilterEndDate('')}
                    className="text-slate-500 hover:text-white font-bold text-xs"
                    title="Limpiar fecha"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action button triggers the modal */}
          <button
            type="button"
            onClick={() => {
              setEditingLogId(null);
              const today = format(new Date(), 'yyyy-MM-dd');
              const defaultProd = availableProductOptions[0];
              setAdLogForm({
                adId: '',
                date: today,
                month: getMonthKeyFromDate(today),
                platform: 'TikTok Ads',
                campaignType: defaultProd?.channel || 'landing',
                spend: 100,
                salesCount: 10,
                productName: defaultProd?.name || '',
                productSource: defaultProd?.source || 'custom',
                targetCpa: defaultProd?.cpaAds || 0,
                notes: ''
              });
              setAutoFillSuccessMessage(null);
              setIsModalOpen(true);
            }}
            className={`px-5 py-2.5 bg-gradient-to-r from-orange-500 to-[#ff9100] hover:scale-[1.02] active:scale-[0.98] rounded-xl font-black text-[14px] uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-orange-500/20 flex items-center gap-2 ${
              isLight ? 'border border-[#d9e5f1] text-[#f6f9ff]' : 'text-white'
            }`}
          >
            <Plus size={16} />
            Registrar Pauta
          </button>
        </div>

        {/* Full-width Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`border-b ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                <th className="py-3.5 px-3 text-[13px] font-black text-slate-500 uppercase tracking-widest font-sans">ID Anuncio</th>
                <th className="py-3.5 px-3 text-[13px] font-black text-slate-500 uppercase tracking-widest font-sans">Fecha & Mes</th>
                <th className="py-3.5 px-3 text-[13px] font-black text-slate-500 uppercase tracking-widest font-sans">Producto / Tipo</th>
                <th className="py-3.5 px-3 text-[13px] font-black text-slate-500 uppercase tracking-widest font-sans">Plataforma</th>
                <th className="py-3.5 px-3 text-[13px] font-black text-slate-500 uppercase tracking-widest font-sans">Campaña</th>
                <th className={`py-3.5 px-3 text-[13px] font-black text-slate-500 uppercase tracking-widest font-sans text-right`}>Gasto Total</th>
                <th className={`py-3.5 px-3 text-[13px] font-black text-slate-500 uppercase tracking-widest font-sans text-center`}>Ventas</th>
                <th className="py-3.5 px-3 text-[13px] font-black text-slate-500 uppercase tracking-widest font-sans text-right">CPA Real vs Meta</th>
                <th className="py-3.5 px-3 text-[13px] font-black text-slate-500 uppercase tracking-widest font-sans text-center w-16">Acción</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-white/[0.02]'}`}>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[14px] text-slate-500 italic font-sans">
                    No se encontraron registros para los filtros o búsqueda seleccionada.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const logCpa = log.salesCount > 0 ? log.spend / log.salesCount : 0;
                  const logMonth = log.month || getMonthKeyFromDate(log.date);
                  
                  let cpaBadgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                  if (logCpa > 25) {
                    cpaBadgeColor = isLight 
                      ? "text-rose-700 bg-rose-50 border-rose-200" 
                      : "text-rose-400 bg-rose-500/10 border-rose-500/20";
                  } else if (logCpa > 15) {
                    cpaBadgeColor = isLight 
                      ? "text-amber-700 bg-amber-50 border-amber-200" 
                      : "text-amber-400 bg-amber-500/10 border-amber-500/20";
                  } else if (isLight) {
                    cpaBadgeColor = "text-[#0a392d] bg-emerald-50 border-emerald-200";
                  }

                  return (
                    <tr key={log.id} className={`${isLight ? 'hover:bg-slate-50/50' : 'hover:bg-white/[0.01]'} transition-colors group`}>
                      {/* ID Anuncio */}
                      <td className="py-4 px-3">
                        {log.adId ? (
                          <div className="flex items-center gap-1.5">
                            <span 
                              className={`px-2.5 py-1 rounded-lg border font-mono font-bold text-[12px] flex items-center gap-1 ${
                                isLight 
                                  ? 'bg-orange-50 text-orange-800 border-orange-200' 
                                  : 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                              }`}
                            >
                              <Hash size={11} className="opacity-70" />
                              {log.adId}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(log.adId || '');
                                setCopiedAdId(log.id);
                                setTimeout(() => setCopiedAdId(null), 2000);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-white"
                              title="Copiar ID"
                            >
                              {copiedAdId === log.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[12px] font-mono pl-2">-</span>
                        )}
                      </td>

                      {/* Fecha & Mes */}
                      <td className="py-4 px-3">
                        <div className="flex flex-col">
                          <span className={`text-[14px] font-mono font-bold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                            {log.date}
                          </span>
                          <span className="text-[11px] font-black uppercase text-orange-400/90 tracking-wide font-sans">
                            {formatMonthLabel(logMonth)}
                          </span>
                        </div>
                      </td>

                      {/* Producto */}
                      <td className="py-4 px-3">
                        <span className={`text-[14px] font-bold block truncate max-w-xs ${isLight ? 'text-slate-800' : 'text-white'}`} title={log.productName}>
                          {log.productName || 'Producto General'}
                        </span>
                      </td>

                      {/* Plataforma */}
                      <td className={`py-4 px-3 text-[14px] font-bold font-sans ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {log.platform}
                      </td>

                      {/* Campaña */}
                      <td className="py-4 px-3">
                        <span className={`px-2.5 py-1 rounded-full text-[12px] font-black border uppercase tracking-wider font-sans whitespace-nowrap ${
                          log.campaignType === 'whatsapp' 
                            ? (isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20') 
                            : (isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/10 text-blue-400 border-blue-500/20')
                        }`}>
                          {log.campaignType === 'whatsapp' ? '💬 wtsap' : '📲 pagina'}
                        </span>
                      </td>

                      {/* Gasto Total */}
                      <td className={`py-4 px-3 text-[14px] tabular-nums font-mono text-right font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                        ${log.spend.toFixed(2)}
                      </td>

                      {/* Ventas */}
                      <td className={`py-4 px-3 text-[14px] tabular-nums font-bold text-center ${isLight ? 'text-slate-800' : 'text-emerald-400'}`}>
                        {log.salesCount}
                      </td>

                      {/* CPA Real vs Meta */}
                      <td className="py-4 px-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2.5 py-1 rounded-lg border font-mono font-bold text-[13px] ${cpaBadgeColor}`}>
                            ${logCpa.toFixed(2)}
                          </span>
                          {log.targetCpa && log.targetCpa > 0 ? (
                            <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                              Meta: ${log.targetCpa.toFixed(2)}
                              {logCpa <= log.targetCpa ? (
                                <span className="text-emerald-400 text-xs font-bold" title="CPA por debajo o en la meta">✓</span>
                              ) : (
                                <span className="text-rose-400 text-xs font-bold" title="CPA por encima de la meta">▲</span>
                              )}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-4 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => handleEditAdLog(log)}
                            className={`p-1.5 rounded-lg transition-all active:scale-90 ${isLight ? 'text-slate-500 hover:text-orange-600 hover:bg-orange-50' : 'text-slate-400 hover:text-orange-400 hover:bg-orange-500/10'}`}
                            title="Editar registro"
                          >
                            <Pencil size={15} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteAdLog(log.id)}
                            className={`p-1.5 rounded-lg transition-all active:scale-90 ${isLight ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'}`}
                            title="Eliminar registro"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        {adDailyLogs.length > 0 && (
          <div className={`flex flex-wrap justify-between items-center gap-4 mt-6 border-t pt-4 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
            <span className="text-[13px] text-slate-500 font-bold uppercase tracking-wider font-sans">
              Mostrando {filteredLogs.length} de {adDailyLogs.length} registros • Mes: {filterMonth === 'all' ? 'Todos los Meses' : formatMonthLabel(filterMonth)}
            </span>
            <button 
              type="button"
              onClick={async () => {
                if (confirm('¿Estás seguro de que quieres borrar todos los registros del historial de Ads en la nube y en este dispositivo?')) {
                  if (user?.uid) {
                    try {
                      const batch = writeBatch(db);
                      adDailyLogs.forEach(log => {
                        if (log.id) batch.delete(doc(db, 'ad_panel_logs', log.id));
                      });
                      await batch.commit();
                    } catch (err) {
                      console.error('Error batch deleting ad logs from Firestore:', err);
                    }
                  }
                  setAdDailyLogs([]);
                  localStorage.removeItem('profit_os_ad_daily_logs');
                }
              }}
              className={`px-3.5 py-1.5 border rounded-xl text-[12px] font-bold uppercase tracking-widest transition-all active:scale-95 font-sans ${isLight ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200' : 'bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 text-red-400'}`}
            >
              🗑️ Limpiar Historial Ads
            </button>
          </div>
        )}
      </div>

      {/* Product & Monthly Breakdown Bento Grid */}
      {filteredLogs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Breakdown por Producto con sus IDs de Anuncio */}
          <div className={`border rounded-3xl p-5 shadow-lg ${isLight ? 'bg-white border-slate-200' : 'bg-[#0f0f15]/80 border-white/5'}`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-[14px] font-black uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                <Layers size={16} className="text-orange-400" /> Rendimiento por Producto ({productBreakdown.length})
              </h4>
              <span className="text-[11px] text-slate-500 uppercase font-mono">Ordenado por Inversión</span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {productBreakdown.map(prod => {
                const prodCpa = prod.sales > 0 ? prod.spend / prod.sales : 0;
                return (
                  <div 
                    key={prod.name}
                    className={`p-3 rounded-2xl border transition-all space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/5'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="max-w-[65%]">
                        <p className={`text-[13px] font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{prod.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-500 font-mono">${prod.spend.toFixed(2)} invertidos</span>
                          <span className="text-[11px] text-emerald-400 font-bold">• {prod.sales} ventas</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase font-black block">CPA Real</span>
                        <span className="text-[14px] font-black font-mono text-orange-400">${prodCpa.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Associated Ad IDs */}
                    {prod.adIds.size > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5">
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-0.5">
                          <Hash size={10} /> IDs:
                        </span>
                        {Array.from(prod.adIds).map(adId => (
                          <span 
                            key={adId}
                            onClick={() => setSearchQuery(adId)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                              isLight 
                                ? 'bg-orange-100 text-orange-800 hover:bg-orange-200' 
                                : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                            }`}
                            title="Filtrar por este ID de Anuncio"
                          >
                            #{adId}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Breakdown por Mes */}
          <div className={`border rounded-3xl p-5 shadow-lg ${isLight ? 'bg-white border-slate-200' : 'bg-[#0f0f15]/80 border-white/5'}`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-[14px] font-black uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                <Calendar size={16} className="text-[#00df9a]" /> Historial Mensual ({monthlyBreakdown.length})
              </h4>
              <span className="text-[11px] text-slate-500 uppercase font-mono">Resumen de Meses</span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {monthlyBreakdown.map(m => {
                const mCpa = m.sales > 0 ? m.spend / m.sales : 0;
                const isSelected = filterMonth === m.month;
                return (
                  <div 
                    key={m.month}
                    onClick={() => setFilterMonth(isSelected ? 'all' : m.month)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected 
                        ? (isLight ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-400' : 'bg-orange-500/10 border-orange-500/40 ring-1 ring-orange-500/40')
                        : (isLight ? 'bg-slate-50 border-slate-200 hover:bg-slate-100' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]')
                    }`}
                  >
                    <div>
                      <p className={`text-[13px] font-black uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        📅 {formatMonthLabel(m.month)}
                      </p>
                      <span className="text-[11px] text-slate-500">{m.count} registros de pauta</span>
                    </div>

                    <div className="text-right flex items-center gap-4">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-black block">Inversión</span>
                        <span className="text-[13px] font-bold font-mono text-slate-300">${m.spend.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-black block">CPA Mes</span>
                        <span className="text-[14px] font-black font-mono text-emerald-400">${mCpa.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Overlay Dialog for Add / Edit */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsModalOpen(false);
                setShowAdIdSuggestions(false);
              }}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />

            {/* Dialog Card */}
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className={`relative w-full max-w-lg border rounded-3xl p-6 shadow-2xl overflow-hidden backdrop-blur-lg max-h-[90vh] overflow-y-auto ${isLight ? 'bg-white border-slate-200' : 'bg-[#0f0f15]/95 border border-white/10'}`}
            >
              <div className="absolute top-0 right-0 w-36 h-36 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-36 h-36 bg-[#00df9a]/5 rounded-full blur-2xl pointer-events-none" />

              {/* Close Button */}
              <button 
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setShowAdIdSuggestions(false);
                }}
                className={`absolute top-4 right-4 p-1.5 rounded-lg transition-all ${isLight ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <X size={18} />
              </button>

              <form onSubmit={handleAddAdLog} className="space-y-4 relative">
                {/* Modal Title */}
                <div className={`flex items-center gap-2.5 border-b pb-3 pr-8 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                  <span className="text-2xl">{editingLogId ? "✏️" : "✍️"}</span>
                  <div>
                    <h4 className={`text-[16px] font-black uppercase tracking-wider font-sans ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {editingLogId ? "Editar Registro de Pauta" : "Registrar Día de Pauta"}
                    </h4>
                    <p className={`text-[12px] font-sans mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Ingresa el <strong>ID del Anuncio</strong> para autocompletar o selecciona el producto de la Calculadora/Investigación.
                    </p>
                  </div>
                </div>

                {/* Auto-fill Notification Banner */}
                {autoFillSuccessMessage && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[12px] flex items-center gap-2 font-medium"
                  >
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span>{autoFillSuccessMessage}</span>
                  </motion.div>
                )}

                {/* 1. ID DEL ANUNCIO (WITH AUTOCOMPLETE) */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className={`text-[12px] font-black uppercase tracking-widest flex items-center gap-1.5 font-sans ${isLight ? 'text-slate-700' : 'text-orange-400'}`}>
                      <Hash size={14} className="text-orange-400" />
                      ID del Anuncio / Código de Campaña
                    </label>
                    {knownAdCatalog.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAdIdSuggestions(!showAdIdSuggestions)}
                        className="text-[11px] font-bold text-slate-400 hover:text-orange-400 underline transition-colors"
                      >
                        {showAdIdSuggestions ? 'Ocultar sugerencias' : `Ver IDs guardados (${knownAdCatalog.length})`}
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <Hash className="absolute left-3.5 top-3 text-slate-500" size={15} />
                    <input 
                      type="text"
                      list="ad-id-datalist"
                      placeholder="Ej. AD-TK-01, FB-LIMPIADOR, 120204859..."
                      value={adLogForm.adId}
                      onChange={e => handleAdIdChange(e.target.value)}
                      onFocus={() => {
                        if (knownAdCatalog.length > 0) setShowAdIdSuggestions(true);
                      }}
                      className={`w-full border rounded-xl py-2 px-3.5 pl-10 text-[14px] font-mono font-bold focus:outline-none focus:border-orange-500 ${
                        isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#111] border-white/10 text-white'
                      }`}
                    />

                    {/* Datalist native support */}
                    <datalist id="ad-id-datalist">
                      {knownAdCatalog.map(k => (
                        <option key={k.adId} value={k.adId}>
                          {k.productName} ({k.platform})
                        </option>
                      ))}
                    </datalist>
                  </div>

                  {/* Interactive Autocomplete Dropdown */}
                  {showAdIdSuggestions && matchingAdSuggestions.length > 0 && (
                    <div className={`mt-1.5 p-2 rounded-2xl border shadow-xl max-h-48 overflow-y-auto space-y-1 z-20 ${isLight ? 'bg-white border-slate-200' : 'bg-[#181824] border-white/10'}`}>
                      <div className="text-[10px] font-black uppercase text-slate-500 px-2 py-1 flex items-center justify-between">
                        <span>IDs de Anuncio Previos (Clic para Autocompletar):</span>
                        <button type="button" onClick={() => setShowAdIdSuggestions(false)} className="text-slate-400 hover:text-white">✕</button>
                      </div>
                      {matchingAdSuggestions.map(item => (
                        <div
                          key={item.adId}
                          onClick={() => handleSelectKnownAdId(item)}
                          className={`p-2 rounded-xl cursor-pointer transition-all flex items-center justify-between text-left ${
                            isLight ? 'hover:bg-orange-50 hover:border-orange-200' : 'hover:bg-white/5'
                          }`}
                        >
                          <div>
                            <span className="font-mono font-bold text-[13px] text-orange-400 block">
                              #{item.adId}
                            </span>
                            <span className={`text-[12px] font-medium block truncate max-w-[220px] ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                              {item.productName || 'Producto General'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 font-bold block mb-0.5">
                              {item.platform}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-bold">
                              {item.campaignType === 'whatsapp' ? '💬 WhatsApp' : '📲 Página'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. PRODUCT AUTO-PULL SELECTOR */}
                <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-orange-50/60 border-orange-200' : 'bg-orange-500/5 border-orange-500/20'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`text-[12px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-orange-900' : 'text-orange-400'}`}>
                      <Sparkles size={14} className="text-orange-400" />
                      Producto (Jalado en Automático)
                    </label>
                    <span className="text-[10px] text-slate-500 font-bold uppercase font-mono">
                      Calculadora / Investigación
                    </span>
                  </div>

                  <select
                    value={adLogForm.productName}
                    onChange={e => handleSelectProductAutoPull(e.target.value)}
                    className={`w-full border rounded-xl py-2.5 px-3 text-[14px] font-bold focus:outline-none focus:border-orange-500 font-sans cursor-pointer ${
                      isLight ? 'bg-white border-orange-200 text-slate-800' : 'bg-[#15151e] border-white/10 text-white'
                    }`}
                  >
                    <option value="">-- Seleccionar o escribir producto --</option>
                    
                    {calcProducts.length > 0 && (
                      <optgroup label="🧮 Productos de la Calculadora de Ganancia">
                        {calcProducts.map(p => (
                          <option key={p.id} value={p.name}>
                            🧮 {p.name} {p.cpaAds ? `(CPA Meta: $${p.cpaAds})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {researchProducts.length > 0 && (
                      <optgroup label="🔍 Productos de Investigación de Mercado">
                        {researchProducts.map(p => (
                          <option key={p.id} value={p.name}>
                            🔍 {p.name} {p.channel ? `(Canal: ${p.channel === 'whatsapp' ? 'WhatsApp' : 'Página'})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {orders && orders.length > 0 && (
                      <optgroup label="📦 Productos de Pedidos Recientes">
                        {Array.from(new Set(orders.map(o => o.product).filter(Boolean))).slice(0, 15).map(prodName => (
                          <option key={prodName} value={prodName}>
                            📦 {prodName}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  {/* Manual input fallback */}
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="O escribe / personaliza el nombre del producto..."
                      value={adLogForm.productName}
                      onChange={e => setAdLogForm(prev => ({ ...prev, productName: e.target.value, productSource: 'custom' }))}
                      className={`w-full border rounded-xl py-1.5 px-3 text-[13px] focus:outline-none focus:border-orange-500 ${
                        isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#111] border-white/5 text-slate-300'
                      }`}
                    />
                  </div>
                </div>

                {/* 3. DATE & MONTH SECTION */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`text-[12px] font-black uppercase tracking-widest block mb-1 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Fecha de Registro
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-3 text-slate-500" size={15} />
                      <input 
                        type="date"
                        required
                        value={adLogForm.date}
                        onChange={e => {
                          const newDate = e.target.value;
                          setAdLogForm(prev => ({
                            ...prev,
                            date: newDate,
                            month: getMonthKeyFromDate(newDate)
                          }));
                        }}
                        className={`w-full border rounded-xl py-2 px-3.5 pl-10 text-[14px] focus:outline-none focus:border-orange-500 font-sans ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#111] border-white/10 text-white'}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`text-[12px] font-black uppercase tracking-widest block mb-1 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Mes Asignado
                    </label>
                    <div className={`w-full border rounded-xl py-2 px-3.5 text-[14px] font-bold flex items-center justify-between ${isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-[#111] border-white/10 text-orange-400'}`}>
                      <span>📅 {formatMonthLabel(adLogForm.month || getMonthKeyFromDate(adLogForm.date))}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{adLogForm.month || getMonthKeyFromDate(adLogForm.date)}</span>
                    </div>
                  </div>
                </div>

                {/* 4. PLATFORM & CAMPAIGN TYPE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`text-[12px] font-black uppercase tracking-widest block mb-1 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Plataforma
                    </label>
                    <select 
                      value={adLogForm.platform}
                      onChange={e => setAdLogForm({...adLogForm, platform: e.target.value})}
                      className={`w-full border rounded-xl py-2 px-3 text-[14px] focus:outline-none focus:border-orange-500 font-sans cursor-pointer ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#111] border-white/10 text-white'}`}
                    >
                      <option value="TikTok Ads">TikTok Ads</option>
                      <option value="Facebook Ads">Facebook Ads</option>
                      <option value="Instagram Ads">Instagram Ads</option>
                      <option value="Google Ads">Google Ads</option>
                      <option value="Pinterest Ads">Pinterest Ads</option>
                      <option value="WhatsApp Orgánico">WhatsApp Orgánico</option>
                    </select>
                  </div>

                  <div>
                    <label className={`text-[12px] font-black uppercase tracking-widest block mb-1 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Tipo de Campaña
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        type="button"
                        onClick={() => setAdLogForm({...adLogForm, campaignType: 'whatsapp'})}
                        className={`py-2 px-2.5 rounded-xl border text-[13px] font-black uppercase tracking-wider transition-all ${
                          adLogForm.campaignType === 'whatsapp' 
                            ? (isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40') 
                            : (isLight ? 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-800' : 'bg-[#111] text-slate-400 border-white/5 hover:text-white')
                        }`}
                      >
                        💬 WhatsApp
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAdLogForm({...adLogForm, campaignType: 'landing'})}
                        className={`py-2 px-2.5 rounded-xl border text-[13px] font-black uppercase tracking-wider transition-all ${
                          adLogForm.campaignType === 'landing' 
                            ? (isLight ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-blue-500/20 text-blue-400 border-blue-500/40') 
                            : (isLight ? 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-800' : 'bg-[#111] text-slate-400 border-white/5 hover:text-white')
                        }`}
                      >
                        📲 Página
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5. SPEND, SALES & TARGET CPA */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={`text-[11px] font-black uppercase tracking-widest block mb-1 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Gasto ($)
                    </label>
                    <div className="relative">
                      <Coins className="absolute left-2.5 top-2.5 text-slate-500" size={14} />
                      <input 
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={adLogForm.spend}
                        onChange={e => setAdLogForm({...adLogForm, spend: Number(e.target.value)})}
                        className={`w-full border rounded-xl py-2 px-2.5 pl-7 text-[14px] font-bold focus:outline-none focus:border-orange-500 font-sans ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#111] border-white/10 text-white'}`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`text-[11px] font-black uppercase tracking-widest block mb-1 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Ventas (Unds)
                    </label>
                    <input 
                      type="number"
                      min="0"
                      required
                      value={adLogForm.salesCount}
                      onChange={e => setAdLogForm({...adLogForm, salesCount: Number(e.target.value)})}
                      className={`w-full border rounded-xl py-2 px-2.5 text-[14px] font-bold focus:outline-none focus:border-orange-500 font-sans ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#111] border-white/10 text-white'}`}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className={`text-[11px] font-black uppercase tracking-widest block mb-1 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      CPA Meta ($)
                    </label>
                    <div className="relative">
                      <Target className="absolute left-2.5 top-2.5 text-slate-500" size={14} />
                      <input 
                        type="number"
                        min="0"
                        step="any"
                        value={adLogForm.targetCpa || ''}
                        onChange={e => setAdLogForm({...adLogForm, targetCpa: Number(e.target.value)})}
                        className={`w-full border rounded-xl py-2 px-2.5 pl-7 text-[14px] font-bold focus:outline-none focus:border-orange-500 font-sans ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#111] border-white/10 text-orange-400'}`}
                        placeholder="Meta"
                      />
                    </div>
                  </div>
                </div>

                {/* Instant Calculated CPA Preview */}
                <div className={`p-2.5 rounded-xl border flex items-center justify-between text-[12px] font-bold ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/5'}`}>
                  <span className="text-slate-500">CPA Resultante de esta entrada:</span>
                  <span className="font-mono text-emerald-400 font-black text-[14px]">
                    ${adLogForm.salesCount > 0 ? (adLogForm.spend / adLogForm.salesCount).toFixed(2) : '0.00'}
                  </span>
                </div>

                {/* Buttons */}
                <div className="flex gap-2.5 pt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setShowAdIdSuggestions(false);
                    }}
                    className={`flex-1 py-2.5 font-black text-[14px] uppercase tracking-widest transition-all cursor-pointer border rounded-xl ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' : 'bg-white/5 hover:bg-white/10 text-white border-white/5'}`}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-[#ff9100] hover:scale-[1.01] active:scale-[0.99] text-white rounded-xl font-black text-[14px] uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-orange-500/20 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={16} />
                    {editingLogId ? "Guardar Cambios" : "Registrar Pauta"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
