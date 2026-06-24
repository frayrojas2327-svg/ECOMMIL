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
  Activity,
  FileText,
  Image as ImageIcon,
  FileUp,
  File,
  Paperclip,
  Download,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage, handleFirestoreError, OperationType, isFirebaseConfigValid } from '../firebase';
import { useAuth } from './Auth';
import { CurrencyCode } from '../mockData';

interface SalePeriod {
  id: string;
  uid: string;
  month: string;
  startDate: string;
  endDate: string;
  withdrawalDropi: number;
  originalWithdrawalDropi?: number;
  withdrawalBankName?: string;
  commission: number;
  withdrawalBank: number;
  originalWithdrawalBank?: number;
  adsSpend: number;
  originalAdsSpend?: number;
  fbAdsSpend?: number;
  tiktokAdsSpend?: number;
  googleAdsSpend?: number;
  otherAdsSpend?: number;
  platformExpenses: number;
  originalPlatformExpenses?: number;
  originalCurrency?: string;
  shopifyOrders?: number;
  cancelledOrders?: number;
  dropiOrders?: number;
  tiktokOrders?: number;
  dropiCancelled?: number;
  returnedOrders?: number;
  deliveredOrders?: number;
  manualCancelRate?: number;
  manualConfirmRate?: number;
  manualDeliveredRate?: number;
  manualReturnRate?: number;
  manualDropiCancelRate?: number;
  manualTikTokRate?: number;
  tags?: string;
  notes: string;
  createdAt?: any;
  updatedAt?: any;
}

interface FinancialFile {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface FinancialReport {
  id: string;
  uid: string;
  title: string;
  category: string;
  date: string;
  notes: string;
  files: FinancialFile[];
  createdAt: any;
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
  const [activeTab, setActiveTab] = useState<'finance' | 'orders' | 'reports'>('finance');
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [reports, setReports] = useState<FinancialReport[]>([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [reportFormData, setReportFormData] = useState({
    title: '',
    category: 'Resumen Shopify',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    files: [] as File[],
    existingFiles: [] as FinancialFile[]
  });
  const [isUploading, setIsUploading] = useState(false);
  const [zoomedReport, setZoomedReport] = useState<{url: string, notes?: string, title: string, category?: string} | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [quickAddData, setQuickAddData] = useState({ title: '', notes: '', category: 'Factura' });
  const [reportCategories, setReportCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('reportCategories');
    return saved ? JSON.parse(saved) : [
      'Resumen Shopify', 
      'Resumen Dropi', 
      'Resumen TikTok', 
      'Estado de Cuenta', 
      'Factura', 
      'Captura Pantalla',
      'Recibo',
      'Otros'
    ];
  });
  const [newCatName, setNewCatName] = useState('');
  const [showNewCatInput, setShowNewCatInput] = useState(false);

  // Persist categories
  useEffect(() => {
    localStorage.setItem('reportCategories', JSON.stringify(reportCategories));
  }, [reportCategories]);

  const addCategory = () => {
    if (newCatName.trim() && !reportCategories.includes(newCatName.trim())) {
      setReportCategories([...reportCategories, newCatName.trim()]);
      setNewCatName('');
      setShowNewCatInput(false);
    }
  };

  // Handle zoom on scroll
  const handleWheel = (e: React.WheelEvent) => {
    if (!zoomedReport) return;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoomScale(prev => Math.min(Math.max(1, prev + delta), 4));
  };

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
    fbAdsSpend: 0,
    tiktokAdsSpend: 0,
    googleAdsSpend: 0,
    otherAdsSpend: 0,
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

      const mockReports: FinancialReport[] = [
        {
          id: 'r1',
          uid: user.uid,
          title: 'Reporte Mensual Enero',
          category: 'Resumen Shopify',
          date: '2026-01-31',
          notes: 'Ventas estables durante el periodo.',
          files: [
            { name: 'factura_1.jpg', url: 'https://images.unsplash.com/photo-1554224155-1696413565d3?auto=format&fit=crop&q=80&w=400', type: 'image/jpeg', size: 102400 }
          ],
          createdAt: new Date()
        }
      ];

      setPeriods(mockPeriods);
      setReports(mockReports);
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

    // Fetch Financial Reports
    const qr = query(collection(db, 'financialReports'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribeReports = onSnapshot(qr, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FinancialReport[];
      setReports(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'financialReports');
    });

    return () => {
      unsubscribe();
      unsubscribeReports();
    };
  }, [user, isDemoMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Convert values BACK to USD (base) if conversion is active
    const rate = isConversionActive ? (currencies[currency]?.rate || 1) : 1;
    
    const adsTotal = (Number(formData.fbAdsSpend) || 0) + 
                     (Number(formData.tiktokAdsSpend) || 0) + 
                     (Number(formData.googleAdsSpend) || 0) + 
                     (Number(formData.otherAdsSpend) || 0);

    const baseData = {
      ...formData,
      withdrawalDropi: (Number(formData.withdrawalDropi) || 0) / rate,
      originalWithdrawalDropi: Number(formData.withdrawalDropi) || 0,
      withdrawalBankName: formData.withdrawalBankName || '',
      withdrawalBank: (Number(formData.withdrawalBank) || 0) / rate,
      originalWithdrawalBank: Number(formData.withdrawalBank) || 0,
      adsSpend: (adsTotal || Number(formData.adsSpend) || 0) / rate,
      originalAdsSpend: adsTotal || Number(formData.adsSpend) || 0,
      fbAdsSpend: (Number(formData.fbAdsSpend) || 0) / rate,
      tiktokAdsSpend: (Number(formData.tiktokAdsSpend) || 0) / rate,
      googleAdsSpend: (Number(formData.googleAdsSpend) || 0) / rate,
      otherAdsSpend: (Number(formData.otherAdsSpend) || 0) / rate,
      platformExpenses: (Number(formData.platformExpenses) || 0) / rate,
      originalPlatformExpenses: Number(formData.platformExpenses) || 0,
      originalCurrency: currency,
      shopifyOrders: Number(formData.shopifyOrders) || 0,
      cancelledOrders: Number(formData.cancelledOrders) || 0,
      dropiOrders: Number(formData.dropiOrders) || 0,
      tiktokOrders: Number(formData.tiktokOrders) || 0,
      dropiCancelled: Number(formData.dropiCancelled) || 0,
      returnedOrders: Number(formData.returnedOrders) || 0,
      deliveredOrders: Number(formData.deliveredOrders) || 0,
      manualCancelRate: formData.manualCancelRate === '' ? null : Number(formData.manualCancelRate),
      manualConfirmRate: formData.manualConfirmRate === '' ? null : Number(formData.manualConfirmRate),
      manualDeliveredRate: formData.manualDeliveredRate === '' ? null : Number(formData.manualDeliveredRate),
      manualReturnRate: formData.manualReturnRate === '' ? null : Number(formData.manualReturnRate),
      manualDropiCancelRate: formData.manualDropiCancelRate === '' ? null : Number(formData.manualDropiCancelRate),
      manualTikTokRate: formData.manualTikTokRate === '' ? null : Number(formData.manualTikTokRate),
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
        fbAdsSpend: 0,
        tiktokAdsSpend: 0,
        googleAdsSpend: 0,
        otherAdsSpend: 0,
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

  const handleDeleteReport = async (id: string) => {
    try {
      if (isDemoMode) {
        setReports(prev => prev.filter(r => r.id !== id));
      } else {
        await deleteDoc(doc(db, 'financialReports', id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'financialReports');
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Factura': '#22c55e',
      'Recibo': '#eab308',
      'Resumen Shopify': '#3b82f6',
      'Resumen Dropi': '#22c55e',
      'Resumen TikTok': '#ff0050',
      'Estado de Cuenta': '#8b5cf6',
      'Captura Pantalla': '#ec4899',
      'Otros': '#94a3b8'
    };
    return colors[category] || '#22c55e';
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUploading(true);

    try {
      const uploadedFiles: FinancialFile[] = [];

      // Only upload new files if they are not already FinancialFile objects (for edit mode)
      // Actually, my current reportFormData.files is File[], and edit might want to keep old ones.
      // Let's adjust reportFormData to handle existing files too.
      
      for (const file of reportFormData.files) {
        if (isDemoMode) {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          
          uploadedFiles.push({
            name: file.name,
            url: base64,
            type: file.type,
            size: file.size
          });
        } else {
          try {
            const fileRef = ref(storage, `financial_reports/${user.uid}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(fileRef, file);
            const url = await getDownloadURL(snapshot.ref);
            uploadedFiles.push({
              name: file.name,
              url,
              type: file.type,
              size: file.size
            });
          } catch (storageErr) {
            console.error("Error subiendo a Storage:", storageErr);
          }
        }
      }

      // If editing, we want to merge or replace files. 
      // For now, let's assume we replace or we need a way to track existing files.
      // I'll modify the form to handle this better in the next step if needed.
      // For simplicity, let's handle the data creation first.

      const reportData: any = {
        uid: user.uid,
        title: reportFormData.title,
        category: reportFormData.category,
        date: reportFormData.date,
        notes: reportFormData.notes,
        files: uploadedFiles,
        updatedAt: serverTimestamp()
      };

      if (editingReportId) {
        if (isDemoMode) {
          setReports(prev => prev.map(r => r.id === editingReportId ? { ...r, ...reportData, files: [...reportFormData.existingFiles, ...uploadedFiles] } : r));
        } else {
          // If editing, we want to merge remaining existing files with new ones
          const finalFiles = [...reportFormData.existingFiles, ...uploadedFiles];
          await setDoc(doc(db, 'financialReports', editingReportId), { ...reportData, files: finalFiles }, { merge: true });
        }
      } else {
        reportData.createdAt = serverTimestamp();
        if (isDemoMode) {
          const newReport = { ...reportData, id: Math.random().toString(36).substr(2, 9), createdAt: new Date() } as FinancialReport;
          setReports(prev => [newReport, ...prev]);
        } else {
          await addDoc(collection(db, 'financialReports'), reportData);
        }
      }

      setReportFormData({
        title: '',
        category: 'Resumen Shopify',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        files: [],
        existingFiles: []
      });
      setShowReportForm(false);
      setEditingReportId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'financialReports');
    } finally {
      setIsUploading(false);
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
    const isSameCurrency = period.originalCurrency === currency;

    const clearZero = (val: any) => {
      if (val === 0 || val === '0') return '';
      return val;
    };

    setFormData({
      month: period.month,
      startDate: period.startDate,
      endDate: period.endDate,
      withdrawalDropi: clearZero(isSameCurrency && period.originalWithdrawalDropi !== undefined ? period.originalWithdrawalDropi : Number((period.withdrawalDropi * rate).toFixed(2))),
      withdrawalBankName: period.withdrawalBankName || '',
      commission: period.commission * rate,
      withdrawalBank: clearZero(isSameCurrency && period.originalWithdrawalBank !== undefined ? period.originalWithdrawalBank : Number((period.withdrawalBank * rate).toFixed(2))),
      adsSpend: clearZero(isSameCurrency && period.originalAdsSpend !== undefined ? period.originalAdsSpend : Number((period.adsSpend * rate).toFixed(2))),
      fbAdsSpend: clearZero(period.fbAdsSpend !== undefined ? Number((period.fbAdsSpend * rate).toFixed(2)) : 0),
      tiktokAdsSpend: clearZero(period.tiktokAdsSpend !== undefined ? Number((period.tiktokAdsSpend * rate).toFixed(2)) : 0),
      googleAdsSpend: clearZero(period.googleAdsSpend !== undefined ? Number((period.googleAdsSpend * rate).toFixed(2)) : 0),
      otherAdsSpend: clearZero(period.otherAdsSpend !== undefined ? Number((period.otherAdsSpend * rate).toFixed(2)) : 0),
      platformExpenses: clearZero(isSameCurrency && period.originalPlatformExpenses !== undefined ? period.originalPlatformExpenses : Number((period.platformExpenses * rate).toFixed(2))),
      shopifyOrders: clearZero(period.shopifyOrders || 0),
      cancelledOrders: clearZero(period.cancelledOrders || 0),
      dropiOrders: clearZero(period.dropiOrders || 0),
      tiktokOrders: clearZero(period.tiktokOrders || 0),
      dropiCancelled: clearZero(period.dropiCancelled || 0),
      returnedOrders: clearZero(period.returnedOrders || 0),
      deliveredOrders: clearZero(period.deliveredOrders || 0),
      manualCancelRate: (period.manualCancelRate !== undefined && period.manualCancelRate !== null) ? period.manualCancelRate : '',
      manualConfirmRate: (period.manualConfirmRate !== undefined && period.manualConfirmRate !== null) ? period.manualConfirmRate : '',
      manualDeliveredRate: (period.manualDeliveredRate !== undefined && period.manualDeliveredRate !== null) ? period.manualDeliveredRate : '',
      manualReturnRate: (period.manualReturnRate !== undefined && period.manualReturnRate !== null) ? period.manualReturnRate : '',
      manualDropiCancelRate: (period.manualDropiCancelRate !== undefined && period.manualDropiCancelRate !== null) ? period.manualDropiCancelRate : '',
      manualTikTokRate: (period.manualTikTokRate !== undefined && period.manualTikTokRate !== null) ? period.manualTikTokRate : '',
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

  const getEffectiveRate = (p: SalePeriod, type: 'cancel' | 'confirm' | 'dropiCancel' | 'delivered' | 'return' | 'tiktok') => {
    let manualRate: number | undefined;
    let units = 0;
    
    switch(type) {
      case 'cancel': manualRate = p.manualCancelRate; units = p.cancelledOrders || 0; break;
      case 'confirm': manualRate = p.manualConfirmRate; units = p.dropiOrders || 0; break;
      case 'dropiCancel': manualRate = p.manualDropiCancelRate; units = p.dropiCancelled || 0; break;
      case 'delivered': manualRate = p.manualDeliveredRate; units = p.deliveredOrders || 0; break;
      case 'return': manualRate = p.manualReturnRate; units = p.returnedOrders || 0; break;
      case 'tiktok': manualRate = p.manualTikTokRate; units = p.tiktokOrders || 0; break;
    }
    
    if (manualRate !== undefined && manualRate !== null) {
      return manualRate;
    }
    return p.shopifyOrders ? (units / p.shopifyOrders) * 100 : 0;
  };

  const stats = useMemo(() => {
    const { 
      totalShopify, 
      totalWithdrawalDropi, 
      totalWithdrawalBank, 
      totalAds, 
      totalExpenses, 
      totalCommission 
    } = displayPeriods.reduce((acc, p) => {
      acc.totalShopify += (p.shopifyOrders || 0);
      acc.totalWithdrawalDropi += (p.withdrawalDropi || 0);
      acc.totalWithdrawalBank += (p.withdrawalBank || 0);
      acc.totalAds += (p.adsSpend || 0);
      acc.totalExpenses += (p.platformExpenses || 0);
      acc.totalCommission += (p.commission || 0);
      return acc;
    }, {
      totalShopify: 0,
      totalWithdrawalDropi: 0,
      totalWithdrawalBank: 0,
      totalAds: 0,
      totalExpenses: 0,
      totalCommission: 0
    });
    
    const cancelRate = totalShopify > 0 
      ? (displayPeriods.reduce((acc, p) => acc + (getEffectiveRate(p, 'cancel') * (p.shopifyOrders || 0)), 0) / totalShopify) 
      : 0;
    
    const confirmRate = totalShopify > 0 
      ? (displayPeriods.reduce((acc, p) => acc + (getEffectiveRate(p, 'confirm') * (p.shopifyOrders || 0)), 0) / totalShopify) 
      : 0;
    
    const dropiCancelRate = totalShopify > 0 
      ? (displayPeriods.reduce((acc, p) => acc + (getEffectiveRate(p, 'dropiCancel') * (p.shopifyOrders || 0)), 0) / totalShopify) 
      : 0;

    const tiktokRate = totalShopify > 0 
      ? (displayPeriods.reduce((acc, p) => acc + (getEffectiveRate(p, 'tiktok') * (p.shopifyOrders || 0)), 0) / totalShopify) 
      : 0;
    
    const deliveredRate = totalShopify > 0 
      ? (displayPeriods.reduce((acc, p) => acc + (getEffectiveRate(p, 'delivered') * (p.shopifyOrders || 0)), 0) / totalShopify) 
      : 0;
    
    const returnRate = totalShopify > 0 
      ? (displayPeriods.reduce((acc, p) => acc + (getEffectiveRate(p, 'return') * (p.shopifyOrders || 0)), 0) / totalShopify) 
      : 0;

    // Net profit estimation: Bank Withdrawal - Ads - Expenses
    const estimatedNetProfit = totalWithdrawalBank - totalAds - totalExpenses;

    const chartData = [...displayPeriods].reverse().map(p => ({
      name: p.month,
      'Retiro Dropi': p.withdrawalDropi,
      'Retiro Banco': p.withdrawalBank,
      'Publicidad Total': p.adsSpend,
      'Facebook Ads': p.fbAdsSpend || 0,
      'TikTok Ads': p.tiktokAdsSpend || 0,
      'Google Ads': p.googleAdsSpend || 0,
      'Otros Ads': p.otherAdsSpend || 0,
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
      totalShopify,
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
      tiktokRate,
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
      <div className="flex border-b border-white/10 gap-8 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('finance')}
          className={`pb-4 px-2 text-sm font-black uppercase tracking-[0.2em] transition-all relative whitespace-nowrap ${activeTab === 'finance' ? 'text-neon' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Dashboard Financiero
          {activeTab === 'finance' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon shadow-[0_0_10px_rgba(34,197,94,0.5)]" />}
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={`pb-4 px-2 text-sm font-black uppercase tracking-[0.2em] transition-all relative whitespace-nowrap ${activeTab === 'orders' ? 'text-neon' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Historial Pedidos
          {activeTab === 'orders' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon shadow-[0_0_10px_rgba(34,197,94,0.5)]" />}
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`pb-4 px-2 text-sm font-black uppercase tracking-[0.2em] transition-all relative whitespace-nowrap ${activeTab === 'reports' ? 'text-neon' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Resumen Financiero (Docs)
          {activeTab === 'reports' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon shadow-[0_0_10px_rgba(34,197,94,0.5)]" />}
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
                      <Bar dataKey="Facebook Ads" stackId="ads" fill="#1877F2" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="TikTok Ads" stackId="ads" fill="#ff0050" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Google Ads" stackId="ads" fill="#34A853" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Otros Ads" stackId="ads" fill="#94a3b8" radius={[4, 4, 0, 0]} />
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
                        isAnimationActive={false}
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
                            <p className="text-[18px] font-display font-bold text-white tracking-widest uppercase">{period.month}</p>
                            <p className="text-[18px] text-slate-500 font-mono mt-1">{period.startDate} / {period.endDate}</p>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => handleEdit(period)} className="p-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold hover:text-black transition-colors"><Edit2 size={12} /></button>
                             <button onClick={() => setDeleteConfirmId(period.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"><Trash2 size={12} /></button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center pb-2 border-b border-white/5">
                            <span className="text-[18px] text-slate-500 uppercase font-black">Banco</span>
                            <span className="text-[18px] text-slate-300 font-black">{period.withdrawalBankName || '—'}</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/5">
                            <span className="text-[18px] text-slate-500 uppercase font-black">Dropi</span>
                            <span className="text-[18px] font-mono text-neon font-bold">{formatCurrency(period.withdrawalDropi)}</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/5">
                            <span className="text-[18px] text-slate-500 uppercase font-black">Recibido</span>
                            <span className="text-[18px] font-mono text-gold font-bold">{formatCurrency(period.withdrawalBank)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[18px] text-slate-500 uppercase font-black">Profit Neto</span>
                            <span className={`text-[18px] font-mono font-bold ${period.withdrawalBank - period.adsSpend - period.platformExpenses >= 0 ? "text-positive-green" : "text-negative-red"}`}>{formatCurrency(period.withdrawalBank - period.adsSpend - period.platformExpenses)}</span>
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
                        <th className="px-6 py-4 text-[18px] uppercase tracking-tighter font-black text-slate-500">Periodo</th>
                        <th className="px-4 py-4 text-[18px] uppercase tracking-tighter font-black text-slate-500 text-right">Retiro Dropi</th>
                        <th className="px-4 py-4 text-[18px] uppercase tracking-tighter font-black text-slate-500 text-right">Comisión</th>
                        <th className="px-4 py-4 text-[18px] uppercase tracking-tighter font-black text-slate-500 text-right">Banco</th>
                        <th className="px-4 py-4 text-[18px] uppercase tracking-tighter font-black text-slate-500 text-right">Recibido (Banco)</th>
                        <th className="px-4 py-4 text-[18px] uppercase tracking-tighter font-black text-slate-500 text-right">ADS / Gastos</th>
                        <th className="px-4 py-4 text-[18px] uppercase tracking-tighter font-black text-white text-right">Profit Neto</th>
                        <th className="px-6 py-4 text-[18px] uppercase tracking-tighter font-black text-slate-500 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {displayPeriods.map(period => {
                        const isInlineEditing = inlineEditingId === period.id;
                        const rate = isConversionActive ? (currencies[currency]?.rate || 1) : 1;
                        const netProfit = (period.withdrawalBank - period.adsSpend - period.platformExpenses) * rate;
                        const symbol = currency === 'PEN' ? 'S/' : 'Q';

                        return (
                          <tr key={period.id} className="hover:bg-white/[0.01] transition-colors group">
                            <td className="px-6 py-4">
                              <p className="text-[18px] font-black text-neon uppercase">{period.month}</p>
                              <p className="text-[18px] text-slate-500 font-mono">{period.startDate} / {period.endDate}</p>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className="font-mono text-[18px] text-neon font-bold">
                                {formatCurrency(period.withdrawalDropi)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className="font-mono text-[18px] text-amber-500/70">
                                {formatCurrency(period.commission)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className="text-[18px] text-slate-400 font-black uppercase tracking-tighter">{period.withdrawalBankName || '—'}</span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className="font-mono text-[18px] text-gold font-bold">
                                {formatCurrency(period.withdrawalBank)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-mono text-[18px] text-slate-500 font-bold">
                                  -{formatCurrency(period.adsSpend + period.platformExpenses)}
                                </span>
                                {(period.fbAdsSpend || period.tiktokAdsSpend || period.googleAdsSpend || period.otherAdsSpend) ? (
                                  <div className="flex flex-wrap gap-1 justify-end max-w-[120px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {period.fbAdsSpend ? <span className="text-[14px] px-1 bg-[#1877F2]/10 text-[#1877F2] rounded">FB</span> : null}
                                    {period.tiktokAdsSpend ? <span className="text-[14px] px-1 bg-[#ff0050]/10 text-[#ff0050] rounded">TK</span> : null}
                                    {period.googleAdsSpend ? <span className="text-[14px] px-1 bg-[#34A853]/10 text-[#34A853] rounded">GG</span> : null}
                                    {period.otherAdsSpend ? <span className="text-[14px] px-1 bg-slate-500/10 text-slate-400 rounded">OT</span> : null}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className={`px-2 py-1 rounded font-mono text-[18px] font-black ${((period.withdrawalBank - period.adsSpend - period.platformExpenses)) >= 0 ? 'bg-positive-green-10 text-positive-green' : 'bg-negative-red-10 text-negative-red'}`}>
                                {formatCurrency(period.withdrawalBank - period.adsSpend - period.platformExpenses)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center gap-2">
                                <button 
                                  onClick={() => handleEdit(period, true)} 
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
      ) : activeTab === 'reports' ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-neon/10 rounded-lg text-neon">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-white tracking-tighter uppercase">
                  Resumen y Documentación
                </h3>
                <p className="text-slate-500 text-[18px] italic">Sube tus comprobantes, fotos de facturas o capturas de pantalla.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowReportForm(true)}
              className="px-6 py-2 bg-zinc-800 text-white font-black rounded-xl hover:bg-zinc-700 transition-all text-xs uppercase tracking-widest flex items-center gap-2"
            >
              <FileUp size={16} /> Subir Reporte
            </button>
          </div>

          <AnimatePresence>
            {showReportForm && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <form onSubmit={handleReportSubmit} className="glass-card p-6 bg-zinc-950/50 border-neon/20 space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-neon font-black uppercase text-xs tracking-widest">
                      {editingReportId ? 'Editar Reporte' : 'Nuevo Reporte'}
                    </h4>
                    {editingReportId && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setEditingReportId(null);
                          setReportFormData({
                            title: '',
                            category: 'Resumen Shopify',
                            date: new Date().toISOString().split('T')[0],
                            notes: '',
                            files: [],
                            existingFiles: []
                          });
                        }}
                        className="text-[10px] text-red-500 font-bold uppercase hover:underline"
                      >
                        Cancelar Edición
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[18px] text-slate-500 font-bold uppercase">Título del Reporte</label>
                      <input 
                        required
                        type="text"
                        value={reportFormData.title}
                        onChange={(e) => setReportFormData({ ...reportFormData, title: e.target.value })}
                        placeholder="Ejem: Mar-2026"
                        className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-sm text-white focus:border-neon outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[18px] text-slate-500 font-bold uppercase">Tipo de Documento</label>
                      <div className="flex gap-2">
                        <select 
                          value={reportFormData.category}
                          onChange={(e) => {
                            if (e.target.value === 'ADD_NEW') {
                              setShowNewCatInput(true);
                            } else {
                              setReportFormData({ ...reportFormData, category: e.target.value });
                            }
                          }}
                          className="flex-1 bg-black border border-zinc-800 rounded-lg p-2 text-sm text-white focus:border-neon outline-none"
                        >
                          {reportCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          <option value="ADD_NEW" className="text-neon font-bold">+ Agregar Nueva...</option>
                        </select>
                      </div>
                      
                      <AnimatePresence>
                        {showNewCatInput && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="mt-2 flex gap-2"
                          >
                            <input 
                              type="text"
                              placeholder="Nueva categoría..."
                              value={newCatName}
                              onChange={(e) => setNewCatName(e.target.value)}
                              className="flex-1 bg-zinc-900 border border-neon/30 rounded-lg p-2 text-sm text-white outline-none focus:border-neon"
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                if (newCatName.trim()) {
                                  const name = newCatName.trim();
                                  if (!reportCategories.includes(name)) {
                                    setReportCategories([...reportCategories, name]);
                                  }
                                  setReportFormData({ ...reportFormData, category: name });
                                  setNewCatName('');
                                  setShowNewCatInput(false);
                                }
                              }}
                              className="px-3 bg-neon text-background rounded-lg text-xs font-black"
                            >
                              Add
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                if (reportFormData.category && reportFormData.category !== 'Otros' && reportCategories.includes(reportFormData.category)) {
                                  const filtered = reportCategories.filter(c => c !== reportFormData.category);
                                  setReportCategories(filtered);
                                  setReportFormData({ ...reportFormData, category: filtered[0] || 'Otros' });
                                }
                              }}
                              className="px-3 bg-red-500/20 text-red-500 rounded-lg text-xs font-black hover:bg-red-500 hover:text-white transition-all"
                              title="Eliminar categoría actual"
                            >
                              <Trash2 size={12} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => setShowNewCatInput(false)}
                              className="p-2 text-slate-500"
                            >
                              <X size={14} />
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[18px] text-slate-500 font-bold uppercase">Fecha</label>
                      <input 
                        required
                        type="date"
                        value={reportFormData.date}
                        onChange={(e) => setReportFormData({ ...reportFormData, date: e.target.value })}
                        className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-sm text-white focus:border-neon outline-none font-mono"
                      />
                    </div>
                  </div>

                  {reportFormData.existingFiles.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pl-1">Archivos Guardados (Toca para eliminar)</label>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 p-4 bg-black/40 rounded-2xl border border-white/5">
                        {reportFormData.existingFiles.map((file, i) => (
                          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group bg-zinc-950">
                            <img 
                              src={file.url} 
                              alt="Stored" 
                              className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" 
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                const updated = reportFormData.existingFiles.filter((_, idx) => idx !== i);
                                setReportFormData({ ...reportFormData, existingFiles: updated });
                              }}
                              className="absolute inset-0 flex items-center justify-center bg-red-600/0 hover:bg-red-600/40 transition-all group/btn"
                            >
                              <Trash2 size={24} className="text-white opacity-0 group-hover/btn:opacity-100 transition-opacity drop-shadow-lg" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[18px] text-slate-500 font-bold uppercase">Notas</label>
                    <textarea 
                      value={reportFormData.notes}
                      onChange={(e) => setReportFormData({ ...reportFormData, notes: e.target.value })}
                      placeholder="Observaciones financieras..."
                      rows={2}
                      className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-sm text-white focus:border-neon outline-none resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[18px] text-slate-500 font-bold uppercase">Adjuntar Comprobantes (Fotos)</label>
                    <div className="flex items-center justify-center w-full">
                      <label 
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-800 rounded-xl cursor-pointer hover:bg-white/[0.02] hover:border-neon/30 transition-all"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.dataTransfer.files) {
                            const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                            if (newFiles.length > 0) {
                              setPendingFiles(newFiles);
                              setShowQuickAdd(true);
                              setQuickAddData({
                                title: `Reporte ${new Date().toLocaleDateString()}`,
                                notes: '',
                                category: 'Factura'
                              });
                            }
                          }
                        }}
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <FileUp className="w-8 h-8 mb-3 text-slate-500" />
                          <p className="mb-2 text-[18px] text-slate-400 font-medium"><span className="font-bold">Haz clic o arrastra fotos</span></p>
                          <p className="text-[14px] text-slate-600 uppercase tracking-tighter">JPG, PNG, WEBP (Max 5MB)</p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          multiple 
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files) {
                              const newFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
                              if (newFiles.length < e.target.files.length) {
                                alert("Solo se permiten archivos de imagen (JPG, PNG, WEBP)");
                              }
                              if (newFiles.length > 0) {
                                setPendingFiles(newFiles);
                                setShowQuickAdd(true);
                                setQuickAddData({
                                  title: `Reporte ${new Date().toLocaleDateString()}`,
                                  notes: '',
                                  category: 'Factura'
                                });
                              }
                            }
                          }}
                        />
                      </label>
                    </div>
                    {reportFormData.files.length > 0 && (
                      <div className="max-h-[220px] overflow-y-auto pr-2 mt-4 custom-scrollbar">
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                          {reportFormData.files.map((f, i) => (
                            <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 group">
                              <FilePreview file={f} />
                              <button 
                                type="button"
                                onClick={() => {
                                  const updated = reportFormData.files.filter((_, idx) => idx !== i);
                                  setReportFormData({ ...reportFormData, files: updated });
                                }}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                              >
                                <X size={10} />
                              </button>
                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 z-10">
                                <span className="text-[7px] text-white/70 block truncate font-mono">
                                  {(f.size / 1024).toFixed(0)} KB
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setShowReportForm(false)}
                      className="px-4 py-2 text-[18px] font-bold text-slate-500 hover:text-white uppercase tracking-widest"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={isUploading}
                      className="px-6 py-2 bg-neon text-background font-black rounded-lg text-[18px] uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-3 h-3 border-2 border-background/20 border-t-background rounded-full animate-spin" />
                          Subiendo...
                        </>
                      ) : (
                        'Guardar Reporte'
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reports.length === 0 ? (
              <div className="col-span-full py-20 text-center text-slate-500 font-mono text-sm">
                No hay reportes financieros archivados.
              </div>
            ) : (
              reports.map(report => (
                <div key={report.id} className="glass-card p-5 bg-zinc-900/30 border-white/5 hover:border-white/10 transition-all flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span 
                          className="px-1.5 py-0.5 text-[8px] font-black uppercase rounded border"
                          style={{ 
                            backgroundColor: `${getCategoryColor(report.category)}20`, 
                            color: getCategoryColor(report.category),
                            borderColor: `${getCategoryColor(report.category)}40`
                          }}
                        >
                          {report.category || 'Otros'}
                        </span>
                      </div>
                      <h4 className="text-white font-bold text-lg leading-tight">{report.title}</h4>
                      <p className="text-[18px] text-slate-500 font-mono mt-1">{report.date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setEditingReportId(report.id);
                          setReportFormData({
                            title: report.title,
                            category: report.category || 'Otros',
                            date: report.date,
                            notes: report.notes,
                            files: [],
                            existingFiles: report.files || []
                          });
                          setShowReportForm(true);
                        }}
                        className="p-1.5 text-zinc-700 hover:text-neon transition-colors"
                        title="Editar reporte"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteReport(report.id)}
                        className="p-1.5 text-zinc-700 hover:text-red-500 transition-colors"
                        title="Eliminar reporte"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {report.notes && (
                    <p 
                      className="text-[18px] text-slate-400 font-serif italic border-l-4 pl-4 py-2"
                      style={{ borderLeftColor: getCategoryColor(report.category) }}
                    >
                      {report.notes}
                    </p>
                  )}

                  <div className={`grid ${report.files.length === 1 ? 'grid-cols-1' : report.files.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-2 mt-auto`}>
                    {report.files.slice(0, 6).map((file, i) => {
                      return (
                        <button 
                          key={i}
                          onClick={() => {
                            setZoomedReport({ url: file.url, notes: report.notes, title: report.title, category: report.category });
                            setZoomScale(1);
                            setPanOffset({ x: 0, y: 0 });
                          }}
                          className="relative aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-neon/50 transition-all group group/img bg-zinc-900"
                        >
                          <img 
                            src={file.url} 
                            alt={file.name} 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://placehold.co/400x400/000000/22c55e?text=Error+Carga';
                            }}
                            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-500"
                          />
                          {i === 5 && report.files.length > 6 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <span className="text-white font-bold text-sm">+{report.files.length - 6}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                            <Plus size={24} className="text-neon drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1">
                            <span className="text-[8px] text-white/70 font-mono truncate block">
                              {(file.size / 1024).toFixed(0)} KB
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
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
                      <th className="px-6 py-4 text-center whitespace-nowrap">Etiquetas / Tags</th>
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
                       <span className="text-[18px] font-black text-white">{period.month}</span>
                       <span className="block text-[18px] text-slate-500 mt-0.5">{period.startDate} a {period.endDate}</span>
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
                           className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[18px] text-white text-center"
                         />
                       ) : (
                         <span className="text-[18px] font-bold text-white">{period.shopifyOrders || 0}</span>
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
                         <div className="flex flex-col items-center gap-1">
                           <input 
                             type="number"
                             value={formData.cancelledOrders}
                             onChange={(e) => {
                               const val = e.target.value === '' ? '' : Number(e.target.value);
                               setFormData({ ...formData, cancelledOrders: val });
                             }}
                             className="w-20 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[18px] text-red-400 text-center outline-none"
                             placeholder="uds"
                           />
                           <div className="flex items-center gap-0.5">
                             <input 
                               type="number"
                               value={formData.manualCancelRate}
                               onChange={(e) => {
                                 const rate = e.target.value === '' ? '' : Number(e.target.value);
                                 setFormData({ ...formData, manualCancelRate: rate });
                               }}
                               className="w-20 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[15px] text-zinc-500 text-center outline-none"
                               placeholder="%"
                             />
                             <span className="text-[12px] text-zinc-600">%</span>
                           </div>
                         </div>
                       ) : (
                         <div className="flex items-center justify-center h-full">
                           <span className="text-[18px] font-bold text-red-400">{period.cancelledOrders || 0}</span>
                         </div>
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
                         <div className="flex flex-col items-center gap-1">
                           <input 
                             type="number"
                             value={formData.dropiOrders}
                             onChange={(e) => {
                               const val = e.target.value === '' ? '' : Number(e.target.value);
                               setFormData({ ...formData, dropiOrders: val });
                             }}
                             className="w-20 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[18px] text-neon text-center outline-none"
                             placeholder="uds"
                           />
                           <div className="flex items-center gap-0.5">
                             <input 
                               type="number"
                               value={formData.manualConfirmRate}
                               onChange={(e) => {
                                 const rate = e.target.value === '' ? '' : Number(e.target.value);
                                 setFormData({ ...formData, manualConfirmRate: rate });
                               }}
                               className="w-20 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[15px] text-zinc-500 text-center outline-none"
                               placeholder="%"
                             />
                             <span className="text-[12px] text-zinc-600">%</span>
                           </div>
                         </div>
                       ) : (
                         <div className="flex items-center justify-center h-full">
                           <span className="text-[18px] font-black text-neon">{period.dropiOrders || 0}</span>
                         </div>
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
                         <div className="flex flex-col items-center gap-1">
                           <input 
                             type="number"
                             value={formData.tiktokOrders}
                             onChange={(e) => setFormData({ ...formData, tiktokOrders: e.target.value === '' ? '' : Number(e.target.value) })}
                             className="w-20 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[18px] text-sky-400 text-center"
                             placeholder="uds"
                           />
                           <div className="flex items-center gap-0.5">
                             <input 
                               type="number"
                               value={formData.manualTikTokRate}
                               onChange={(e) => {
                                 const rate = e.target.value === '' ? '' : Number(e.target.value);
                                 setFormData({ ...formData, manualTikTokRate: rate });
                               }}
                               className="w-20 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[15px] text-zinc-500 text-center outline-none"
                               placeholder="%"
                             />
                             <span className="text-[12px] text-zinc-600">%</span>
                           </div>
                         </div>
                       ) : (
                         <div className="flex items-center justify-center h-full">
                           <span className="text-[18px] font-bold text-sky-400">{period.tiktokOrders || 0}</span>
                         </div>
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
                         <div className="flex flex-col items-center gap-1">
                           <input 
                             type="number"
                             value={formData.dropiCancelled}
                             onChange={(e) => {
                               const val = e.target.value === '' ? '' : Number(e.target.value);
                               setFormData({ ...formData, dropiCancelled: val });
                             }}
                             className="w-20 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[18px] text-orange-400 text-center outline-none"
                             placeholder="uds"
                           />
                           <div className="flex items-center gap-0.5">
                             <input 
                               type="number"
                               value={formData.manualDropiCancelRate}
                               onChange={(e) => {
                                 const rate = e.target.value === '' ? '' : Number(e.target.value);
                                 setFormData({ ...formData, manualDropiCancelRate: rate });
                               }}
                               className="w-20 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[15px] text-zinc-500 text-center outline-none"
                               placeholder="%"
                             />
                             <span className="text-[12px] text-zinc-600">%</span>
                           </div>
                         </div>
                       ) : (
                         <div className="flex items-center justify-center h-full">
                           <span className="text-[18px] font-bold text-orange-400">{period.dropiCancelled || 0}</span>
                         </div>
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
                         <div className="flex flex-col items-center gap-1">
                           <input 
                             type="number"
                             value={formData.deliveredOrders}
                             onChange={(e) => {
                               const val = e.target.value === '' ? '' : Number(e.target.value);
                               setFormData({ ...formData, deliveredOrders: val });
                             }}
                             className="w-20 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[18px] text-green-400 text-center outline-none"
                             placeholder="uds"
                           />
                           <div className="flex items-center gap-0.5">
                             <input 
                               type="number"
                               value={formData.manualDeliveredRate}
                               onChange={(e) => {
                                 const rate = e.target.value === '' ? '' : Number(e.target.value);
                                 setFormData({ ...formData, manualDeliveredRate: rate });
                               }}
                               className="w-20 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[15px] text-zinc-500 text-center outline-none"
                               placeholder="%"
                             />
                             <span className="text-[12px] text-zinc-600">%</span>
                           </div>
                         </div>
                       ) : (
                         <div className="flex items-center justify-center h-full">
                           <span className="text-[18px] font-bold text-green-400">{period.deliveredOrders || 0}</span>
                         </div>
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
                         <div className="flex flex-col items-center gap-1">
                           <input 
                             type="number"
                             value={formData.returnedOrders}
                             onChange={(e) => {
                               const val = e.target.value === '' ? '' : Number(e.target.value);
                               setFormData({ ...formData, returnedOrders: val });
                             }}
                             className="w-20 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[18px] text-amber-500 text-center outline-none"
                             placeholder="uds"
                           />
                           <div className="flex items-center gap-0.5">
                             <input 
                               type="number"
                               value={formData.manualReturnRate}
                               onChange={(e) => {
                                 const rate = e.target.value === '' ? '' : Number(e.target.value);
                                 setFormData({ ...formData, manualReturnRate: rate });
                               }}
                               className="w-20 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[15px] text-zinc-500 text-center outline-none"
                               placeholder="%"
                             />
                             <span className="text-[12px] text-zinc-600">%</span>
                           </div>
                         </div>
                       ) : (
                         <div className="flex items-center justify-center h-full">
                           <span className="text-[18px] font-bold text-amber-500">{period.returnedOrders || 0}</span>
                         </div>
                       )}
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex flex-wrap gap-2 justify-center">
                          {period.tags?.split(',').map((tag, i) => (
                            <span key={i} className="px-2 py-1 rounded bg-zinc-800 text-[11px] text-white font-bold uppercase hover:bg-neon hover:text-black transition-colors cursor-default">
                              {tag.trim()}
                            </span>
                          )) || <span className="text-[12px] text-zinc-700 italic">—</span>}
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
                    <td className="px-6 py-4 text-[12px] text-slate-500 uppercase">Totales</td>
                    <td className="px-4 py-4 text-center text-white text-[18px]">{displayPeriods.reduce((acc, p) => acc + (p.shopifyOrders || 0), 0)}</td>
                    <td className="px-4 py-4 text-center text-red-400 text-[18px]">{displayPeriods.reduce((acc, p) => acc + (p.cancelledOrders || 0), 0)}</td>
                    <td className="px-4 py-4 text-center text-neon text-[18px]">{displayPeriods.reduce((acc, p) => acc + (p.dropiOrders || 0), 0)}</td>
                    <td className="px-4 py-4 text-center text-sky-400 text-[18px]">{displayPeriods.reduce((acc, p) => acc + (p.tiktokOrders || 0), 0)}</td>
                    <td className="px-4 py-4 text-center text-orange-400 text-[18px]">{displayPeriods.reduce((acc, p) => acc + (p.dropiCancelled || 0), 0)}</td>
                    <td className="px-4 py-4 text-center text-green-400 text-[18px] border-r border-white/5 bg-green-500/5">{displayPeriods.reduce((acc, p) => acc + (p.deliveredOrders || 0), 0)}</td>
                    <td className="px-4 py-4 text-center text-amber-500 text-[18px] border-r border-white/5 bg-amber-500/5">{displayPeriods.reduce((acc, p) => acc + (p.returnedOrders || 0), 0)}</td>
                    <td className="px-6 py-4"></td>
                    <td className="px-4 py-4"></td>
                  </tr>
                  <tr className="border-t border-white/10 bg-white/[0.02]">
                    <td className="px-6 py-3 text-[12px] text-zinc-400 uppercase font-black">Ratio Operativo (Real)</td>
                    <td className="px-4 py-3 text-center border-r border-white/5">
                      <span className="text-slate-400 text-[18px] font-black">100%</span>
                    </td>
                    <td className="px-4 py-3 text-center border-r border-white/5">
                      <span className="text-red-100 text-[18px] font-bold">{stats.cancelRate.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-3 text-center border-r border-white/5">
                      <span className="text-neon text-[18px] font-black">{stats.confirmRate.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-3 text-center border-r border-white/5">
                      <span className="text-sky-400 text-[18px] font-black">
                        {stats.tiktokRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center border-r border-white/5">
                      <span className="text-orange-200 text-[18px] font-bold">{stats.dropiCancelRate.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-3 text-center border-r border-white/5">
                      <span className="text-green-400 font-black text-[18px]">{stats.deliveredRate.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-3 text-center border-r border-white/5">
                      <span className="text-amber-200 text-[18px] font-bold">{stats.returnRate.toFixed(1)}%</span>
                    </td>
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

                <div className="p-6 bg-zinc-950/50 border border-border/50 rounded-2xl space-y-4">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Megaphone size={14} className="text-blue-500" /> Desglose de Publicidad
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Facebook / Instagram</label>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
                        <input 
                          type="number"
                          step="0.01"
                          value={formData.fbAdsSpend}
                          onChange={(e) => setFormData({ ...formData, fbAdsSpend: e.target.value === '' ? '' : Number(e.target.value) })}
                          className="w-full bg-background border border-border rounded-xl p-2 pl-7 text-white focus:border-[#1877F2] outline-none transition-all font-mono text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">TikTok Ads</label>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
                        <input 
                          type="number"
                          step="0.01"
                          value={formData.tiktokAdsSpend}
                          onChange={(e) => setFormData({ ...formData, tiktokAdsSpend: e.target.value === '' ? '' : Number(e.target.value) })}
                          className="w-full bg-background border border-border rounded-xl p-2 pl-7 text-white focus:border-[#ff0050] outline-none transition-all font-mono text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Google Ads</label>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
                        <input 
                          type="number"
                          step="0.01"
                          value={formData.googleAdsSpend}
                          onChange={(e) => setFormData({ ...formData, googleAdsSpend: e.target.value === '' ? '' : Number(e.target.value) })}
                          className="w-full bg-background border border-border rounded-xl p-2 pl-7 text-white focus:border-[#34A853] outline-none transition-all font-mono text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Otras Redes</label>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
                        <input 
                          type="number"
                          step="0.01"
                          value={formData.otherAdsSpend}
                          onChange={(e) => setFormData({ ...formData, otherAdsSpend: e.target.value === '' ? '' : Number(e.target.value) })}
                          className="w-full bg-background border border-border rounded-xl p-2 pl-7 text-white focus:border-slate-500 outline-none transition-all font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <span className="text-[10px] text-slate-500 uppercase font-black">Inversión Total Ads</span>
                    <span className="text-sm font-mono text-neon font-black">
                      {formatCurrency((Number(formData.fbAdsSpend) || 0) + (Number(formData.tiktokAdsSpend) || 0) + (Number(formData.googleAdsSpend) || 0) + (Number(formData.otherAdsSpend) || 0))}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                     <CreditCard size={14} className="text-purple-500" /> Gasto Plataforma (Shopify / Otros)
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
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Cancelados (%)</label>
                      <div className="flex gap-2">
                        <input 
                          type="number"
                          placeholder="uds"
                          value={formData.cancelledOrders}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setFormData({ ...formData, cancelledOrders: val });
                          }}
                          className="flex-1 bg-background border border-border rounded-xl p-2 text-white focus:border-red-500 outline-none transition-all font-mono sm:text-sm text-xs"
                        />
                        <input 
                          type="number"
                          placeholder="%"
                          value={formData.manualCancelRate}
                          onChange={(e) => {
                            const rate = e.target.value === '' ? '' : Number(e.target.value);
                            setFormData({ ...formData, manualCancelRate: rate });
                          }}
                          className="w-20 bg-background border border-border rounded-xl p-2 text-slate-400 focus:border-red-500 outline-none transition-all font-mono text-[15px]"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Confirmados (%)</label>
                      <div className="flex gap-2">
                        <input 
                          type="number"
                          placeholder="uds"
                          value={formData.dropiOrders}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setFormData({ ...formData, dropiOrders: val });
                          }}
                          className="flex-1 bg-background border border-border rounded-xl p-2 text-white focus:border-neon outline-none transition-all font-mono sm:text-sm text-xs"
                        />
                        <input 
                          type="number"
                          placeholder="%"
                          value={formData.manualConfirmRate}
                          onChange={(e) => {
                            const rate = e.target.value === '' ? '' : Number(e.target.value);
                            setFormData({ ...formData, manualConfirmRate: rate });
                          }}
                          className="w-20 bg-background border border-border rounded-xl p-2 text-slate-400 focus:border-neon outline-none transition-all font-mono text-[15px]"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">TikTok Orders (%)</label>
                      <div className="flex gap-2">
                        <input 
                          type="number"
                          placeholder="uds"
                          value={formData.tiktokOrders}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setFormData({ ...formData, tiktokOrders: val });
                          }}
                          className="flex-1 bg-background border border-border rounded-xl p-2 text-white focus:border-sky-400 outline-none transition-all font-mono sm:text-sm text-xs"
                        />
                        <input 
                          type="number"
                          placeholder="%"
                          value={formData.manualTikTokRate}
                          onChange={(e) => {
                            const rate = e.target.value === '' ? '' : Number(e.target.value);
                            setFormData({ ...formData, manualTikTokRate: rate });
                          }}
                          className="w-20 bg-background border border-border rounded-xl p-2 text-slate-400 focus:border-sky-400 outline-none transition-all font-mono text-[15px]"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Canc. Dropi (%)</label>
                      <div className="flex gap-2">
                        <input 
                          type="number"
                          placeholder="uds"
                          value={formData.dropiCancelled}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setFormData({ ...formData, dropiCancelled: val });
                          }}
                          className="flex-1 bg-background border border-border rounded-xl p-2 text-white focus:border-orange-500 outline-none transition-all font-mono sm:text-sm text-xs"
                        />
                        <input 
                          type="number"
                          placeholder="%"
                          value={formData.manualDropiCancelRate}
                          onChange={(e) => {
                            const rate = e.target.value === '' ? '' : Number(e.target.value);
                            setFormData({ ...formData, manualDropiCancelRate: rate });
                          }}
                          className="w-20 bg-background border border-border rounded-xl p-2 text-slate-400 focus:border-orange-500 outline-none transition-all font-mono text-[15px]"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Entregas (%)</label>
                      <div className="flex gap-2">
                        <input 
                          type="number"
                          placeholder="uds"
                          value={formData.deliveredOrders}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setFormData({ ...formData, deliveredOrders: val });
                          }}
                          className="flex-1 bg-background border border-border rounded-xl p-2 text-white focus:border-green-500 outline-none transition-all font-mono sm:text-sm text-xs"
                        />
                        <input 
                          type="number"
                          placeholder="%"
                          value={formData.manualDeliveredRate}
                          onChange={(e) => {
                            const rate = e.target.value === '' ? '' : Number(e.target.value);
                            setFormData({ ...formData, manualDeliveredRate: rate });
                          }}
                          className="w-20 bg-background border border-border rounded-xl p-2 text-slate-400 focus:border-green-500 outline-none transition-all font-mono text-[15px]"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Devueltos (%)</label>
                      <div className="flex gap-2">
                        <input 
                          type="number"
                          placeholder="uds"
                          value={formData.returnedOrders}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setFormData({ ...formData, returnedOrders: val });
                          }}
                          className="flex-1 bg-background border border-border rounded-xl p-2 text-white focus:border-amber-500 outline-none transition-all font-mono sm:text-sm text-xs"
                        />
                        <input 
                          type="number"
                          placeholder="%"
                          value={formData.manualReturnRate}
                          onChange={(e) => {
                            const rate = e.target.value === '' ? '' : Number(e.target.value);
                            setFormData({ ...formData, manualReturnRate: rate });
                          }}
                          className="w-20 bg-background border border-border rounded-xl p-2 text-slate-400 focus:border-amber-500 outline-none transition-all font-mono text-[15px]"
                        />
                      </div>
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

      {/* Visor de Imágenes Pro (Zoom) */}
      <AnimatePresence>
        {zoomedReport && (
          <div 
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 bg-black/98 backdrop-blur-2xl"
            onWheel={handleWheel}
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 cursor-zoom-out"
              onClick={() => setZoomedReport(null)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full h-full flex flex-col items-center justify-between py-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Info (Top) */}
              <div className="text-center space-y-3 z-[100] w-full px-4 mb-4">
                <div className="flex items-center justify-center gap-3">
                  <span 
                    className="px-3 py-1 text-[10px] font-black uppercase rounded-full border shadow-lg"
                    style={{ 
                      backgroundColor: `${getCategoryColor(zoomedReport.category || 'Otros')}20`, 
                      color: getCategoryColor(zoomedReport.category || 'Otros'),
                      borderColor: `${getCategoryColor(zoomedReport.category || 'Otros')}60`
                    }}
                  >
                    {zoomedReport.category || 'Otros'}
                  </span>
                  <h3 className="text-2xl md:text-4xl font-display font-bold text-white tracking-widest uppercase drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]">
                    {zoomedReport.title}
                  </h3>
                </div>
                {zoomedReport.notes && (
                  <div className="max-w-3xl mx-auto py-2">
                    <p 
                      className="text-[20px] md:text-[24px] text-slate-300 font-medium text-center leading-tight drop-shadow-md border-l-4 pl-4 inline-block italic"
                      style={{ borderLeftColor: getCategoryColor(zoomedReport.category || 'Otros') }}
                    >
                      {zoomedReport.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Main Image Container (Full Screen) */}
              <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden cursor-move">
                <motion.img 
                  src={zoomedReport.url} 
                  alt="Documento Ampliado" 
                  referrerPolicy="no-referrer"
                  animate={{ 
                    scale: zoomScale,
                    x: panOffset.x,
                    y: panOffset.y
                  }}
                  onClick={() => {
                    if (zoomScale > 1) {
                      setZoomScale(1);
                      setPanOffset({ x: 0, y: 0 });
                    } else {
                      setZoomScale(2);
                    }
                  }}
                  drag={zoomScale > 1}
                  dragMomentum={false}
                  onDrag={(e, info) => {
                    setPanOffset(prev => ({
                      x: prev.x + info.delta.x,
                      y: prev.y + info.delta.y
                    }));
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/800x800/000000/22c55e?text=Error+Carga';
                  }}
                  className="max-w-[95%] max-h-full object-contain rounded-lg shadow-[0_40px_100px_rgba(0,0,0,0.9)] cursor-zoom-in pointer-events-auto border border-white/10"
                />
              </div>

              {/* Controles de Zoom Flotantes (Bottom) */}
              <div className="mt-8 flex items-center gap-3 p-3 bg-zinc-900/80 backdrop-blur-3xl rounded-3xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[100]">
                <button 
                  onClick={() => {
                    setZoomScale(prev => Math.max(1, prev - 0.5));
                    if (zoomScale <= 1.5) setPanOffset({ x: 0, y: 0 });
                  }}
                  className="p-4 hover:bg-white/10 rounded-2xl transition-colors text-white"
                >
                  <ZoomOut size={28} />
                </button>
                <div className="w-20 text-center text-white font-mono font-bold text-xl">
                  {zoomScale.toFixed(1)}x
                </div>
                <button 
                  onClick={() => setZoomScale(prev => Math.min(4, prev + 0.5))}
                  className="p-4 hover:bg-white/10 rounded-2xl transition-colors text-white"
                >
                  <ZoomIn size={28} />
                </button>
                <div className="w-px h-8 bg-white/20 mx-2" />
                <button 
                  onClick={() => { setZoomScale(1); setPanOffset({ x: 0, y: 0 }); }}
                  className="px-6 py-3 hover:bg-white hover:text-black rounded-2xl transition-all text-xs text-white uppercase font-black tracking-[0.2em] bg-white/5 active:scale-95"
                >
                  Reset
                </button>
                <button 
                  onClick={() => setZoomedReport(null)}
                  className="px-6 py-3 bg-red-600 text-white rounded-2xl transition-all text-xs uppercase font-black tracking-[0.2em] hover:bg-red-700 active:scale-95 shadow-lg shadow-red-600/30"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Add Modal (Notificación) */}
      <AnimatePresence>
        {showQuickAdd && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/90 backdrop-blur-md"
              onClick={() => setShowQuickAdd(false)}
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.9 }}
              className="relative bg-zinc-900 border border-neon/30 p-8 rounded-[2rem] shadow-[0_0_100px_rgba(34,197,94,0.15)] max-w-xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-neon/10 rounded-2xl text-neon shadow-[0_0_20px_rgba(34,197,94,0.1)]">
                  <FileUp size={32} />
                </div>
                <div>
                  <h4 className="text-2xl font-display font-bold text-white uppercase tracking-tighter">Nueva Imagen Cargada</h4>
                  <p className="text-slate-400 text-sm">Completa los detalles para guardar el registro.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest pl-1">Título del Documento</label>
                    <input 
                      autoFocus
                      type="text"
                      value={quickAddData.title}
                      onChange={(e) => setQuickAddData({ ...quickAddData, title: e.target.value })}
                      placeholder="Ej: Comprobante Dropi"
                      className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-neon outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest pl-1">Categoría</label>
                    <div className="flex flex-col gap-2">
                      <select 
                        value={quickAddData.category}
                        onChange={(e) => {
                          if (e.target.value === 'ADD_NEW') {
                            setShowNewCatInput(true);
                          } else {
                            setQuickAddData({ ...quickAddData, category: e.target.value });
                          }
                        }}
                        className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-neon outline-none"
                      >
                        {reportCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="ADD_NEW" className="text-neon font-bold">+ Agregar Nueva...</option>
                      </select>

                      <AnimatePresence>
                        {showNewCatInput && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex gap-2 p-2 bg-black/30 rounded-xl border border-neon/20"
                          >
                            <input 
                              type="text"
                              placeholder="Nombre de categoría..."
                              value={newCatName}
                              onChange={(e) => setNewCatName(e.target.value)}
                              className="flex-1 bg-transparent text-sm text-white outline-none px-2"
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                if (newCatName.trim()) {
                                  const name = newCatName.trim();
                                  if (!reportCategories.includes(name)) {
                                    setReportCategories([...reportCategories, name]);
                                  }
                                  setQuickAddData({ ...quickAddData, category: name });
                                  setNewCatName('');
                                  setShowNewCatInput(false);
                                }
                              }}
                              className="px-4 py-2 bg-neon text-background rounded-lg text-[10px] font-black uppercase tracking-widest"
                            >
                              Agregar
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                if (quickAddData.category && quickAddData.category !== 'Otros' && reportCategories.includes(quickAddData.category)) {
                                  const filtered = reportCategories.filter(c => c !== quickAddData.category);
                                  setReportCategories(filtered);
                                  setQuickAddData({ ...quickAddData, category: filtered[0] || 'Otros' });
                                }
                              }}
                              className="px-4 py-2 bg-red-500/20 text-red-500 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                              title="Eliminar categoría actual"
                            >
                              <Trash2 size={12} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => setShowNewCatInput(false)}
                              className="p-2 text-slate-500"
                            >
                              <X size={16} />
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest pl-1">Notas / Observaciones</label>
                  <textarea 
                    value={quickAddData.notes}
                    onChange={(e) => setQuickAddData({ ...quickAddData, notes: e.target.value })}
                    placeholder="Agrega una nota para recordar este gasto..."
                    rows={3}
                    className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-neon outline-none resize-none transition-all"
                  />
                </div>

                <div className="space-y-3">
                   <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest pl-1 block text-center">Vista Previa del Documento ({pendingFiles.length})</label>
                   <div className="flex flex-wrap justify-center gap-3 py-4 bg-black/60 rounded-[2rem] border border-white/5 min-h-[260px] items-center">
                     {pendingFiles.map((file, i) => (
                       <div key={i} className={`${pendingFiles.length === 1 ? 'w-full max-w-[320px] h-[320px]' : 'w-40 h-40'} rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative group`}>
                         <FilePreview file={file} />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <span className="text-[10px] text-white font-mono">{(file.size / 1024).toFixed(0)} KB</span>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowQuickAdd(false);
                      setPendingFiles([]);
                    }}
                    disabled={isUploading}
                    className="flex-1 px-4 py-4 bg-zinc-800 text-slate-400 font-black rounded-2xl hover:bg-zinc-700 transition-all text-sm uppercase tracking-widest"
                  >
                    Descartar
                  </button>
                  <button 
                    type="button"
                    onClick={async () => {
                      setIsUploading(true);
                      try {
                        const uploadedFiles: FinancialFile[] = [];
                        for (const file of pendingFiles) {
                          const base64 = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(file);
                          });
                          uploadedFiles.push({
                            name: file.name,
                            url: base64,
                            type: file.type,
                            size: file.size
                          });
                        }

                        const reportData = {
                          uid: user?.uid || 'demo',
                          title: quickAddData.title,
                          category: quickAddData.category,
                          date: new Date().toISOString().split('T')[0],
                          notes: quickAddData.notes,
                          files: uploadedFiles,
                          createdAt: serverTimestamp()
                        };

                        if (isDemoMode) {
                          const newReport = { ...reportData, id: Math.random().toString(36).substr(2, 9), createdAt: new Date() } as FinancialReport;
                          setReports(prev => [newReport, ...prev]);
                        } else {
                          await addDoc(collection(db, 'financialReports'), reportData);
                        }
                        
                        setShowQuickAdd(false);
                        setPendingFiles([]);
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsUploading(false);
                      }
                    }}
                    disabled={isUploading}
                    className="flex-[2] px-4 py-4 bg-neon text-background font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest shadow-lg shadow-neon/20 flex items-center justify-center gap-2"
                  >
                    {isUploading ? <div className="w-5 h-5 border-2 border-background/20 border-t-background rounded-full animate-spin" /> : <Save size={18} />}
                    {isUploading ? 'Guardando...' : 'Confirmar y Guardar'}
                  </button>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white"
              >
                <X size={20} />
              </button>
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
        <p className="text-[18px] uppercase tracking-widest text-slate-500 font-bold mb-1">{title}</p>
        <p className="text-2xl font-mono font-bold text-white tracking-tighter">{value}</p>
        {subValue && <p className="text-[18px] text-slate-500 mt-1">{subValue}</p>}
        {extra}
      </div>
    </div>
  );
};

const FilePreview = ({ file }: { file: File | string }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof file === 'string') {
      setUrl(file);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return <div className="w-full h-full bg-zinc-900 animate-pulse" />;

  return (
    <img 
      src={url} 
      alt="Preview" 
      className="w-full h-full object-contain bg-zinc-950"
    />
  );
};

export default SalesManagement;
