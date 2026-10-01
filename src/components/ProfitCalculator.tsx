import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Trash2, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  DollarSign, 
  Download, 
  Save, 
  Tag, 
  Calendar, 
  Globe, 
  Calculator as CalcIcon, 
  Info,
  ChevronRight,
  HelpCircle,
  FileText,
  Edit2,
  X,
  Check,
  Copy,
  Target,
  ShoppingBag,
  Zap,
  Flame,
  ArrowRight,
  Clock,
  Coins,
  BarChart3,
  ArrowLeftRight,
  RotateCcw,
  FileSpreadsheet,
  Play,
  Upload,
  PackageCheck,
  PackageX,
  Truck,
  Layers,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { CURRENCIES, CurrencyCode, Order, DropiFileRecord, calculateOrderProfit } from '../mockData';
import { fetchExchangeRates } from '../services/currencyService';

interface FixedExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
}

interface VariableExpense {
  id: string;
  name: string;
  amount: number;
}

interface SavedProduct {
  id: string;
  productId: string;
  name: string;
  url?: string;
  notes?: string;
  currency: CurrencyCode;
  timestamp: number;
  // new COD model inputs
  sizeAmount?: string;
  sizeUnit?: string;
  packUnits?: string;
  costPerUnit?: string;
  shippingBase?: string;
  deliveryDispatchPercent?: string;
  adminCosts?: string;
  fulfillment?: string;
  cpaAds?: string;
  finalDeliveryPercent?: string;
  desiredProfitPercent?: string;
  // compatibility for old structure
  inputs?: {
    price: number;
    cost: number;
    shippingCharged: number;
    shippingReal: number;
    adsCost: number;
    platformFee: number;
    confirmationRate: number;
    cancellationRate: number;
    returnRate: number;
    returnShippingCost: number;
    fixedExpenses?: FixedExpense[];
    variableExpenses?: VariableExpense[];
  };
  results?: {
    netProfit: number;
    margin: number;
    roi: number;
    breakEven: number;
    status: string;
    totalFixedExpenses?: number;
    totalVariableExpenses?: number;
  };
}

interface ProfitCalculatorProps {
  formatCurrency: (amount: number) => string;
  currencySymbol: string;
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  isConversionActive: boolean;
  currencies: any;
  orders?: Order[];
  activeExecutedBatchId?: string;
}

const ProfitCalculator: React.FC<ProfitCalculatorProps> = ({ 
  formatCurrency: globalFormat, 
  currencySymbol: globalSymbol,
  currency,
  setCurrency,
  isConversionActive,
  currencies,
  orders,
  activeExecutedBatchId
}) => {
  // Font Size Control state (12px to 18px)
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('ecommil_calc_font_size');
    return saved ? parseInt(saved) : 15;
  });

  const decreaseFontSize = () => setFontSize(prev => Math.max(12, prev - 1));
  const increaseFontSize = () => setFontSize(prev => Math.min(18, prev + 1));

  useEffect(() => {
    localStorage.setItem('ecommil_calc_font_size', String(fontSize));
  }, [fontSize]);

  const [showConfirm, setShowConfirm] = useState<{ type: 'deleteSelected' | 'deleteAll' | 'deleteOne', count?: number, id?: string } | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const calculatorTopRef = useRef<HTMLDivElement>(null);

  // Core COD inputs initialized with beautiful screenshot defaults
  const [inputs, setInputs] = useState({
    name: 'G-Fouk Limpiador Nasal x 2',
    sizeAmount: '15',
    sizeUnit: 'ml',
    currency: currency,
    packUnits: '1',
    costPerUnit: '16000',
    shippingBase: '19000',
    deliveryDispatchPercent: '80', // % Entrega despacho
    adminCosts: '4000', // Costos administrativos
    fulfillment: '0', // Fulfillment
    cpaAds: '14000', // CPA Ads Manager
    finalDeliveryPercent: '70', // % Tasa entrega final
    desiredProfitPercent: '20', // Utilidad deseada %
  });

  // Sync inputs.currency when prop currency changes
  useEffect(() => {
    setInputs(prev => ({ ...prev, currency: currency }));
  }, [currency]);

  // Target Profit & Sales Planner Simulator State
  const [simulationMode, setSimulationMode] = useState<'targetToSales' | 'salesToProfit'>('targetToSales');
  const [targetProfitInput, setTargetProfitInput] = useState<string>(() => {
    if (currency === 'COP') return '5000000';
    if (currency === 'CLP') return '1500000';
    if (currency === 'MXN') return '30000';
    if (currency === 'PEN') return '5000';
    if (currency === 'GTQ') return '10000';
    return '3000';
  });
  const [targetPeriod, setTargetPeriod] = useState<'monthly' | 'biweekly' | 'weekly' | 'daily'>('monthly');
  const [plannedSalesInput, setPlannedSalesInput] = useState<string>('15');
  const [plannedSalesUnit, setPlannedSalesUnit] = useState<'day' | 'month'>('day');

  // Live Currency Converter State (Soles PEN ⇄ Quetzales GTQ)
  const [liveCurrencies, setLiveCurrencies] = useState<any>(currencies || CURRENCIES);
  const [isRefreshingRates, setIsRefreshingRates] = useState(false);
  const [lastRatesUpdate, setLastRatesUpdate] = useState<string>(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [converterAmount, setConverterAmount] = useState<string>('100');
  const [converterDirection, setConverterDirection] = useState<'PEN_TO_GTQ' | 'GTQ_TO_PEN'>('PEN_TO_GTQ');
  const [showLiveConverter, setShowLiveConverter] = useState(true);

  // Sync when prop currencies updates
  useEffect(() => {
    if (currencies) {
      setLiveCurrencies(currencies);
    }
  }, [currencies]);

  const handleManualRefreshRates = async () => {
    setIsRefreshingRates(true);
    try {
      const freshRates = await fetchExchangeRates();
      if (freshRates) {
        setLiveCurrencies((prev: any) => {
          const updated = { ...prev };
          Object.keys(updated).forEach(code => {
            if (freshRates[code]) {
              updated[code] = {
                ...updated[code],
                rate: freshRates[code]
              };
            }
          });
          return updated;
        });
        setLastRatesUpdate(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (e) {
      console.warn('Error refreshing live rates:', e);
    } finally {
      setTimeout(() => setIsRefreshingRates(false), 500);
    }
  };

  // Live Exchange Rates: Soles (PEN) & Quetzales (GTQ)
  const penRate = liveCurrencies?.PEN?.rate || 3.43;
  const gtqRate = liveCurrencies?.GTQ?.rate || 7.73;
  const ratePENtoGTQ = gtqRate / penRate;
  const rateGTQtoPEN = penRate / gtqRate;

  // Convert all numbers in the calculator to another currency
  const convertEntireCalculator = (targetCurrency: CurrencyCode) => {
    const fromCurr = inputs.currency;
    if (fromCurr === targetCurrency) {
      setSaveFeedback(`La calculadora ya se encuentra en ${targetCurrency}.`);
      setTimeout(() => setSaveFeedback(null), 3000);
      return;
    }

    const fromRate = liveCurrencies?.[fromCurr]?.rate || CURRENCIES[fromCurr]?.rate || 1;
    const toRate = liveCurrencies?.[targetCurrency]?.rate || CURRENCIES[targetCurrency]?.rate || 1;
    const factor = toRate / fromRate;

    const convertNum = (valStr: string) => {
      if (!valStr || isNaN(Number(valStr))) return valStr;
      const num = Number(valStr);
      if (num === 0) return '0';
      const converted = num * factor;
      return converted >= 100 ? String(Math.round(converted)) : String(Number(converted.toFixed(2)));
    };

    setInputs(prev => ({
      ...prev,
      currency: targetCurrency,
      costPerUnit: convertNum(prev.costPerUnit),
      shippingBase: convertNum(prev.shippingBase),
      adminCosts: convertNum(prev.adminCosts),
      fulfillment: convertNum(prev.fulfillment),
      cpaAds: convertNum(prev.cpaAds)
    }));

    setCurrency(targetCurrency);

    setTargetProfitInput(prev => {
      if (!prev || isNaN(Number(prev))) return prev;
      const num = Number(prev);
      const converted = num * factor;
      return String(Math.round(converted));
    });

    setSaveFeedback(
      `⚡ ¡Toda la calculadora ha sido convertida a ${targetCurrency === 'PEN' ? 'Soles (S/)' : targetCurrency === 'GTQ' ? 'Quetzales (Q)' : targetCurrency} con la tasa en vivo!`
    );
    setTimeout(() => setSaveFeedback(null), 4000);
  };

  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>(() => {
    const saved = localStorage.getItem('ecommil_saved_products');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('ecommil_saved_products', JSON.stringify(savedProducts));
  }, [savedProducts]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // If currency dropdown changed, automatically convert all calculator inputs using the exchange rate!
    if (name === 'currency') {
      convertEntireCalculator(value as CurrencyCode);
      return;
    }

    setInputs(prev => ({ ...prev, [name]: value }));
  };

  const clearInputs = () => {
    setEditingId(null);
    setInputs({
      name: '',
      sizeAmount: '15',
      sizeUnit: 'ml',
      currency: currency,
      packUnits: '1',
      costPerUnit: '',
      shippingBase: '',
      deliveryDispatchPercent: '100',
      adminCosts: '',
      fulfillment: '',
      cpaAds: '',
      finalDeliveryPercent: '100',
      desiredProfitPercent: '20',
    });
  };

  // Load a saved product calculation into the calculator inputs for editing
  const handleEditProduct = (p: SavedProduct) => {
    setEditingId(p.id);

    if (p.costPerUnit !== undefined) {
      // New COD Model structure
      setInputs({
        name: p.name || '',
        sizeAmount: p.sizeAmount || '15',
        sizeUnit: p.sizeUnit || 'ml',
        currency: p.currency || currency,
        packUnits: p.packUnits || '1',
        costPerUnit: p.costPerUnit || '',
        shippingBase: p.shippingBase || '',
        deliveryDispatchPercent: p.deliveryDispatchPercent || '100',
        adminCosts: p.adminCosts || '',
        fulfillment: p.fulfillment || '0',
        cpaAds: p.cpaAds || '',
        finalDeliveryPercent: p.finalDeliveryPercent || '100',
        desiredProfitPercent: p.desiredProfitPercent || '20',
      });
    } else {
      // Compatibility Fallback
      setInputs({
        name: p.name || '',
        sizeAmount: '15',
        sizeUnit: 'ml',
        currency: p.currency || currency,
        packUnits: '1',
        costPerUnit: p.inputs?.cost !== undefined ? String(p.inputs.cost) : '',
        shippingBase: p.inputs?.shippingReal !== undefined ? String(p.inputs.shippingReal) : '',
        deliveryDispatchPercent: p.inputs?.confirmationRate !== undefined ? String(p.inputs.confirmationRate) : '100',
        adminCosts: p.inputs?.platformFee !== undefined ? String(p.inputs.platformFee) : '',
        fulfillment: '0',
        cpaAds: p.inputs?.adsCost !== undefined ? String(p.inputs.adsCost) : '',
        finalDeliveryPercent: '100',
        desiredProfitPercent: p.results?.margin !== undefined ? String(Math.round(p.results.margin)) : '20',
      });
    }

    if (p.currency) {
      setCurrency(p.currency);
    }

    // Smooth scroll to top of calculator
    if (calculatorTopRef.current) {
      calculatorTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const sliderRef = useRef<HTMLDivElement>(null);

  const handleSliderInteraction = (clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const offsetX = Math.min(rect.width, Math.max(0, clientX - rect.left));
    const percentage = Math.round((offsetX / rect.width) * 40);
    setInputs(prev => ({ ...prev, desiredProfitPercent: String(percentage) }));
  };

  const handleSliderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    handleSliderInteraction(e.clientX);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleSliderInteraction(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSliderTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    handleSliderInteraction(e.touches[0].clientX);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      handleSliderInteraction(moveEvent.touches[0].clientX);
    };

    const handleTouchEnd = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  // Mathematical Model computations
  const computed = useMemo(() => {
    const packUnits = parseFloat(inputs.packUnits) || 1;
    const costPerUnit = parseFloat(inputs.costPerUnit) || 0;
    const shippingBase = parseFloat(inputs.shippingBase) || 0;
    const deliveryDispatchPercent = parseFloat(inputs.deliveryDispatchPercent) || 100;
    const adminCosts = parseFloat(inputs.adminCosts) || 0;
    const fulfillment = parseFloat(inputs.fulfillment) || 0;
    const cpaAds = parseFloat(inputs.cpaAds) || 0;
    const finalDeliveryPercent = parseFloat(inputs.finalDeliveryPercent) || 100;
    const desiredProfitPercent = parseFloat(inputs.desiredProfitPercent) || 0;

    // 1. Proveedor cost = costPerUnit * packUnits
    const proveedor = costPerUnit * packUnits;

    // 2. Flete con devoluciones = Flete base / (% entrega despacho / 100)
    const deliveryDispatchRate = deliveryDispatchPercent / 100;
    const fleteDev = deliveryDispatchRate > 0 ? shippingBase / deliveryDispatchRate : shippingBase;

    // 3. CPA costeado = CPA Ads / (% entrega final / 100)
    const finalDeliveryRate = finalDeliveryPercent / 100;
    const cpaCosteado = finalDeliveryRate > 0 ? cpaAds / finalDeliveryRate : cpaAds;

    // 4. Admin
    const admin = adminCosts;

    // 5. Fulfillment
    const fullfill = fulfillment;

    // 6. Costos totales (CT) = Proveedor + Flete c/dev + CPA costeado + Admin + Fulfillment
    const costosTotales = proveedor + fleteDev + cpaCosteado + admin + fullfill;

    // 7. Precio de venta (PV) = Costos totales / (1 - % utilidad deseada / 100)
    const profitRate = desiredProfitPercent / 100;
    const precioVenta = profitRate < 1 ? costosTotales / (1 - profitRate) : costosTotales;

    // 8. Utilidad ($) = Precio de venta - Costos totales
    const utilidadAbsoluta = precioVenta - costosTotales;

    // 9. Precio comparación (x2) = Precio de venta * 2
    const precioComparacion = precioVenta * 2;

    // Percentages over PV
    const proveedorPercentPV = precioVenta > 0 ? (proveedor / precioVenta) * 100 : 0;
    const fleteDevPercentPV = precioVenta > 0 ? (fleteDev / precioVenta) * 100 : 0;
    const cpaCosteadoPercentPV = precioVenta > 0 ? (cpaCosteado / precioVenta) * 100 : 0;
    const adminPercentPV = precioVenta > 0 ? (admin / precioVenta) * 100 : 0;
    const fullfillPercentPV = precioVenta > 0 ? (fullfill / precioVenta) * 100 : 0;
    const costosTotalesPercentPV = precioVenta > 0 ? (costosTotales / precioVenta) * 100 : 0;
    const utilidadPercentPV = precioVenta > 0 ? (utilidadAbsoluta / precioVenta) * 100 : 0;

    // Percentages over CT
    const proveedorPercentCT = costosTotales > 0 ? (proveedor / costosTotales) * 100 : 0;
    const fleteDevPercentCT = costosTotales > 0 ? (fleteDev / costosTotales) * 100 : 0;
    const cpaCosteadoPercentCT = costosTotales > 0 ? (cpaCosteado / costosTotales) * 100 : 0;
    const adminPercentCT = costosTotales > 0 ? (admin / costosTotales) * 100 : 0;
    const fullfillPercentCT = costosTotales > 0 ? (fullfill / costosTotales) * 100 : 0;

    return {
      proveedor,
      fleteDev,
      cpaCosteado,
      admin,
      fullfill,
      costosTotales,
      precioVenta,
      utilidadAbsoluta,
      precioComparacion,

      proveedorPercentPV,
      fleteDevPercentPV,
      cpaCosteadoPercentPV,
      adminPercentPV,
      fullfillPercentPV,
      costosTotalesPercentPV,
      utilidadPercentPV,

      proveedorPercentCT,
      fleteDevPercentCT,
      cpaCosteadoPercentCT,
      adminPercentCT,
      fullfillPercentCT,

      // Convenience aliases for Dropi liquidation & simulators
      costoProducto: proveedor,
      fleteReal: fleteDev,
      cpaReal: cpaCosteado,
      utilidadValor: utilidadAbsoluta,
      margenPercent: utilidadPercentPV
    };
  }, [inputs]);

  // Handle saving or updating the current calculation
  const handleSaveToHistory = () => {
    if (editingId) {
      // Update existing calculation
      setSavedProducts(prev => prev.map(p => {
        if (p.id === editingId) {
          return {
            ...p,
            name: inputs.name || 'Producto sin nombre',
            currency: currency,
            timestamp: Date.now(),
            sizeAmount: inputs.sizeAmount,
            sizeUnit: inputs.sizeUnit,
            packUnits: inputs.packUnits,
            costPerUnit: inputs.costPerUnit,
            shippingBase: inputs.shippingBase,
            deliveryDispatchPercent: inputs.deliveryDispatchPercent,
            adminCosts: inputs.adminCosts,
            fulfillment: inputs.fulfillment,
            cpaAds: inputs.cpaAds,
            finalDeliveryPercent: inputs.finalDeliveryPercent,
            desiredProfitPercent: inputs.desiredProfitPercent,
          };
        }
        return p;
      }));
      setSaveFeedback('¡Cálculo actualizado con éxito!');
      setTimeout(() => setSaveFeedback(null), 3000);
      setEditingId(null);
    } else {
      // Create new calculation
      const newProduct: SavedProduct = {
        id: Math.random().toString(36).substr(2, 9),
        productId: 'N/A',
        name: inputs.name || 'Producto sin nombre',
        currency: currency,
        timestamp: Date.now(),
        sizeAmount: inputs.sizeAmount,
        sizeUnit: inputs.sizeUnit,
        packUnits: inputs.packUnits,
        costPerUnit: inputs.costPerUnit,
        shippingBase: inputs.shippingBase,
        deliveryDispatchPercent: inputs.deliveryDispatchPercent,
        adminCosts: inputs.adminCosts,
        fulfillment: inputs.fulfillment,
        cpaAds: inputs.cpaAds,
        finalDeliveryPercent: inputs.finalDeliveryPercent,
        desiredProfitPercent: inputs.desiredProfitPercent,
      };

      setSavedProducts([newProduct, ...savedProducts]);
      setSaveFeedback('¡Cálculo guardado en el historial!');
      setTimeout(() => setSaveFeedback(null), 3000);
    }
  };

  // Save current inputs as a new separate entry even during edit mode
  const handleSaveAsNew = () => {
    const newProduct: SavedProduct = {
      id: Math.random().toString(36).substr(2, 9),
      productId: 'N/A',
      name: inputs.name || 'Producto sin nombre',
      currency: currency,
      timestamp: Date.now(),
      sizeAmount: inputs.sizeAmount,
      sizeUnit: inputs.sizeUnit,
      packUnits: inputs.packUnits,
      costPerUnit: inputs.costPerUnit,
      shippingBase: inputs.shippingBase,
      deliveryDispatchPercent: inputs.deliveryDispatchPercent,
      adminCosts: inputs.adminCosts,
      fulfillment: inputs.fulfillment,
      cpaAds: inputs.cpaAds,
      finalDeliveryPercent: inputs.finalDeliveryPercent,
      desiredProfitPercent: inputs.desiredProfitPercent,
    };

    setSavedProducts([newProduct, ...savedProducts]);
    setEditingId(null);
    setSaveFeedback('¡Guardado como nuevo cálculo!');
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const handleDeleteOne = (id: string) => {
    setShowConfirm({ type: 'deleteOne', id });
  };

  const confirmDelete = () => {
    if (!showConfirm) return;
    if (showConfirm.type === 'deleteSelected') {
      setSavedProducts(savedProducts.filter(p => !selectedProductIds.includes(p.id)));
      setSelectedProductIds([]);
    } else if (showConfirm.type === 'deleteAll') {
      setSavedProducts([]);
      setSelectedProductIds([]);
    } else if (showConfirm.type === 'deleteOne' && showConfirm.id) {
      setSavedProducts(savedProducts.filter(p => p.id !== showConfirm.id));
      setSelectedProductIds(prev => prev.filter(selectedId => selectedId !== showConfirm.id));
    }
    setShowConfirm(null);
  };

  // Dynamic status badge details based on net profit margin rate
  const getMarginRating = (margin: number) => {
    if (margin < 10) {
      return {
        badge: '❌ Crítico - margen inviable para escalar',
        color: 'text-red-400 border-red-500/20 bg-red-500/5',
        sliderPos: Math.min(100, Math.max(0, (margin / 40) * 100))
      };
    } else if (margin >= 10 && margin < 18) {
      return {
        badge: '⚠️ Ajustado - margen de cuidado, optimiza CPA o flete',
        color: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
        sliderPos: Math.min(100, Math.max(0, (margin / 40) * 100))
      };
    } else if (margin >= 18 && margin < 30) {
      return {
        badge: '👍 Óptimo - margen saludable para escalar',
        color: 'text-[#00df9a] border-[#00df9a]/20 bg-[#00df9a]/5',
        sliderPos: Math.min(100, Math.max(0, (margin / 40) * 100))
      };
    } else {
      return {
        badge: '🔥 Excelente - margen ideal, ¡escalar fuerte!',
        color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
        sliderPos: Math.min(100, Math.max(0, (margin / 40) * 100))
      };
    }
  };

  const activeRating = getMarginRating(parseFloat(inputs.desiredProfitPercent) || 0);

  // Helper for formatting local currencies on-screen
  const formatValue = (amount: number, currCode: CurrencyCode = currency) => {
    const symbol = CURRENCIES[currCode]?.symbol || '$';
    return `${symbol} ${Math.round(amount).toLocaleString()}`;
  };

  // Export history list to Excel/CSV using the exact xlsx system
  const handleExportHistory = () => {
    const dataToExport = savedProducts.map(p => {
      // If it's a new COD record
      if (p.costPerUnit !== undefined) {
        const sizeAmount = parseFloat(p.sizeAmount || '0');
        const sizeUnit = p.sizeUnit || 'ml';
        const packUnits = parseFloat(p.packUnits || '1');
        const costPerUnit = parseFloat(p.costPerUnit || '0');
        const shippingBase = parseFloat(p.shippingBase || '0');
        const deliveryDispatchPercent = parseFloat(p.deliveryDispatchPercent || '100');
        const adminCosts = parseFloat(p.adminCosts || '0');
        const fulfillment = parseFloat(p.fulfillment || '0');
        const cpaAds = parseFloat(p.cpaAds || '0');
        const finalDeliveryPercent = parseFloat(p.finalDeliveryPercent || '100');
        const desiredProfitPercent = parseFloat(p.desiredProfitPercent || '0');

        const proveedor = costPerUnit * packUnits;
        const deliveryDispatchRate = deliveryDispatchPercent / 100;
        const fleteDev = deliveryDispatchRate > 0 ? shippingBase / deliveryDispatchRate : shippingBase;
        const finalDeliveryRate = finalDeliveryPercent / 100;
        const cpaCosteado = finalDeliveryRate > 0 ? cpaAds / finalDeliveryRate : cpaAds;
        const admin = adminCosts;
        const fullfill = fulfillment;
        const costosTotales = proveedor + fleteDev + cpaCosteado + admin + fullfill;
        const profitRate = desiredProfitPercent / 100;
        const precioVenta = profitRate < 1 ? costosTotales / (1 - profitRate) : costosTotales;
        const utilidadAbsoluta = precioVenta - costosTotales;

        return {
          'Fecha': new Date(p.timestamp).toLocaleDateString(),
          'Producto': p.name,
          'Presentación': `${sizeAmount} ${sizeUnit}`,
          'Moneda': p.currency,
          'Unidades pack': packUnits,
          'Costo Unidad': costPerUnit,
          'Proveedor Tot.': proveedor,
          'Flete Base': shippingBase,
          'Flete c/Devoluciones': fleteDev,
          'CPA Costeado': cpaCosteado,
          'Admin': admin,
          'Fulfillment': fullfill,
          'Costos Totales': costosTotales,
          'Margen Utilidad %': `${desiredProfitPercent}%`,
          'Utilidad Absoluta': utilidadAbsoluta,
          'Precio Venta': precioVenta
        };
      } else {
        // Fallback for old system records
        return {
          'Fecha': new Date(p.timestamp).toLocaleDateString(),
          'Producto': p.name,
          'Presentación': 'N/A',
          'Moneda': p.currency,
          'Unidades pack': 1,
          'Costo Unidad': p.inputs?.cost || 0,
          'Proveedor Tot.': p.inputs?.cost || 0,
          'Flete Base': p.inputs?.shippingReal || 0,
          'Flete c/Devoluciones': p.inputs?.shippingReal || 0,
          'CPA Costeado': p.inputs?.adsCost || 0,
          'Admin': p.inputs?.platformFee || 0,
          'Fulfillment': 0,
          'Costos Totales': p.inputs?.cost + p.inputs?.shippingReal + p.inputs?.adsCost,
          'Margen Utilidad %': `${p.results?.margin || 0}%`,
          'Utilidad Absoluta': p.results?.netProfit || 0,
          'Precio Venta': p.inputs?.price || 0
        };
      }
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial COD");
    XLSX.writeFile(wb, `ECOMMIL_Calculos_COD_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedProductIds.length === savedProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(savedProducts.map(p => p.id));
    }
  };

  // Presets of target profit based on the active currency
  const getPresetsForCurrency = (curr: CurrencyCode) => {
    switch (curr) {
      case 'COP':
        return [
          { label: '$1M', value: '1000000' },
          { label: '$3M', value: '3000000' },
          { label: '$5M', value: '5000000' },
          { label: '$10M', value: '10000000' },
          { label: '$20M', value: '20000000' }
        ];
      case 'CLP':
        return [
          { label: '$500K', value: '500000' },
          { label: '$1M', value: '1000000' },
          { label: '$2M', value: '2000000' },
          { label: '$3.5M', value: '3500000' },
          { label: '$5M', value: '5000000' }
        ];
      case 'MXN':
        return [
          { label: '$10K', value: '10000' },
          { label: '$25K', value: '25000' },
          { label: '$50K', value: '50000' },
          { label: '$75K', value: '75000' },
          { label: '$100K', value: '100000' }
        ];
      case 'PEN':
        return [
          { label: 'S/ 2,000', value: '2000' },
          { label: 'S/ 5,000', value: '5000' },
          { label: 'S/ 8,000', value: '8000' },
          { label: 'S/ 12,000', value: '12000' },
          { label: 'S/ 20,000', value: '20000' }
        ];
      case 'GTQ':
        return [
          { label: 'Q 3,000', value: '3000' },
          { label: 'Q 5,000', value: '5000' },
          { label: 'Q 10,000', value: '10000' },
          { label: 'Q 15,000', value: '15000' },
          { label: 'Q 25,000', value: '25000' }
        ];
      default:
        return [
          { label: '$1,000', value: '1000' },
          { label: '$2,500', value: '2500' },
          { label: '$5,000', value: '5000' },
          { label: '$10,000', value: '10000' },
          { label: '$20,000', value: '20000' }
        ];
    }
  };

  // Compute how many sales you need to earn X amount
  const targetSimulation = useMemo(() => {
    const profitPerUnit = computed.utilidadAbsoluta;
    const targetAmount = parseFloat(targetProfitInput) || 0;
    const days = targetPeriod === 'monthly' ? 30 : targetPeriod === 'biweekly' ? 15 : targetPeriod === 'weekly' ? 7 : 1;
    const finalDeliveryPercent = parseFloat(inputs.finalDeliveryPercent) || 70;
    const deliveryRate = Math.max(0.01, finalDeliveryPercent / 100);

    const isViable = profitPerUnit > 0;

    if (!isViable || targetAmount <= 0) {
      return {
        isViable,
        profitPerUnit,
        targetAmount,
        days,
        deliveredNeeded: 0,
        dispatchedNeeded: 0,
        dispatchedPerDay: 0,
        deliveredPerDay: 0,
        totalRevenue: 0,
        adsBudgetTotal: 0,
        adsBudgetDaily: 0,
        supplierCostTotal: 0,
        shippingCostTotal: 0,
        adminCostTotal: 0,
        estimatedReturns: 0
      };
    }

    // Number of delivered orders needed to hit exact target profit
    const deliveredNeeded = Math.ceil(targetAmount / profitPerUnit);
    
    // Total dispatched orders required considering return rate
    const dispatchedNeeded = Math.ceil(deliveredNeeded / deliveryRate);
    const estimatedReturns = Math.max(0, dispatchedNeeded - deliveredNeeded);
    const returnRate = Math.max(0, 100 - finalDeliveryPercent);

    const dispatchedPerDay = parseFloat((dispatchedNeeded / days).toFixed(1));
    const deliveredPerDay = parseFloat((deliveredNeeded / days).toFixed(1));
    const returnedPerDay = parseFloat((estimatedReturns / days).toFixed(1));

    const totalRevenue = dispatchedNeeded * computed.precioVenta;
    const dailyDeliveredRevenue = deliveredPerDay * computed.precioVenta;
    const cpa = parseFloat(inputs.cpaAds) || 0;
    const adsBudgetTotal = dispatchedNeeded * cpa;
    const adsBudgetDaily = adsBudgetTotal / days;

    const supplierCostTotal = dispatchedNeeded * computed.proveedor;
    const shippingBase = parseFloat(inputs.shippingBase) || 0;
    const shippingCostTotal = dispatchedNeeded * shippingBase;
    const dailyReturnLoss = returnedPerDay * shippingBase;
    const totalReturnLoss = estimatedReturns * shippingBase;
    const adminCostTotal = dispatchedNeeded * (parseFloat(inputs.adminCosts) || 0);

    return {
      isViable: true,
      profitPerUnit,
      targetAmount,
      days,
      deliveredNeeded,
      dispatchedNeeded,
      dispatchedPerDay,
      deliveredPerDay,
      returnedPerDay,
      returnRate,
      dailyDeliveredRevenue,
      dailyReturnLoss,
      totalReturnLoss,
      totalRevenue,
      adsBudgetTotal,
      adsBudgetDaily,
      supplierCostTotal,
      shippingCostTotal,
      adminCostTotal,
      estimatedReturns
    };
  }, [computed, targetProfitInput, targetPeriod, inputs]);

  // Compute how much profit you make if you sell N orders
  const salesSimulation = useMemo(() => {
    const profitPerUnit = computed.utilidadAbsoluta;
    const rawSales = parseFloat(plannedSalesInput) || 0;
    const isPerDay = plannedSalesUnit === 'day';
    const finalDeliveryPercent = parseFloat(inputs.finalDeliveryPercent) || 70;
    const deliveryRate = Math.max(0.01, finalDeliveryPercent / 100);
    const returnRate = Math.max(0, 100 - finalDeliveryPercent);

    const monthlyDispatched = isPerDay ? rawSales * 30 : rawSales;
    const dailyDispatched = isPerDay ? rawSales : rawSales / 30;

    const monthlyDelivered = Math.round(monthlyDispatched * deliveryRate);
    const dailyDelivered = parseFloat((monthlyDelivered / 30).toFixed(1));

    const monthlyReturned = Math.max(0, Math.round(monthlyDispatched - monthlyDelivered));
    const dailyReturned = parseFloat((monthlyReturned / 30).toFixed(1));

    const monthlyProfit = monthlyDelivered * profitPerUnit;
    const dailyProfit = monthlyProfit / 30;

    const monthlyRevenue = monthlyDispatched * computed.precioVenta;
    const dailyDeliveredRevenue = dailyDelivered * computed.precioVenta;

    const cpa = parseFloat(inputs.cpaAds) || 0;
    const monthlyAdsBudget = monthlyDispatched * cpa;
    const dailyAdsBudget = monthlyAdsBudget / 30;
    const monthlySupplierCost = monthlyDispatched * computed.proveedor;
    
    const shippingBase = parseFloat(inputs.shippingBase) || 0;
    const dailyReturnLoss = dailyReturned * shippingBase;
    const monthlyReturnLoss = monthlyReturned * shippingBase;

    return {
      isViable: profitPerUnit > 0,
      profitPerUnit,
      rawSales,
      isPerDay,
      returnRate,
      monthlyDispatched: Math.round(monthlyDispatched),
      dailyDispatched: parseFloat(dailyDispatched.toFixed(1)),
      monthlyDelivered,
      dailyDelivered,
      monthlyReturned,
      dailyReturned,
      dailyDeliveredRevenue,
      dailyReturnLoss,
      monthlyReturnLoss,
      monthlyProfit,
      dailyProfit,
      monthlyRevenue,
      monthlyAdsBudget,
      dailyAdsBudget,
      monthlySupplierCost
    };
  }, [computed, plannedSalesInput, plannedSalesUnit, inputs]);

  const getScaleTier = (dailyDispatched: number) => {
    if (dailyDispatched <= 5) {
      return {
        name: 'Fase de Testeo / Inicial',
        desc: 'Escala ligera, fácil de operar sin equipo. Presupuesto publicitario accesible.',
        badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        progress: Math.min(100, Math.max(10, (dailyDispatched / 5) * 25))
      };
    } else if (dailyDispatched <= 20) {
      return {
        name: 'Fase de Validación / Consolidada',
        desc: 'Excelente ritmo comercial. Requiere control riguroso de novedades y seguimiento.',
        badgeColor: 'bg-[#00df9a]/10 text-[#00df9a] border-[#00df9a]/30',
        progress: 25 + Math.min(25, ((dailyDispatched - 5) / 15) * 25)
      };
    } else if (dailyDispatched <= 50) {
      return {
        name: 'Fase de Crecimiento Acelerado',
        desc: 'Escalamiento fuerte. Asegura inventario con el proveedor y suficiente liquidez para Ads.',
        badgeColor: 'bg-[#ff9100]/10 text-[#ff9100] border-[#ff9100]/30',
        progress: 50 + Math.min(25, ((dailyDispatched - 20) / 30) * 25)
      };
    } else {
      return {
        name: 'Fase Gran Escala (Top Seller)',
        desc: 'Nivel avanzado. Requiere equipo de soporte, acuerdos especiales con transportadoras y alto volumen.',
        badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        progress: 100
      };
    }
  };

  const convertedValue = useMemo(() => {
    const amt = parseFloat(converterAmount) || 0;
    if (converterDirection === 'PEN_TO_GTQ') {
      return amt * ratePENtoGTQ;
    } else {
      return amt * rateGTQtoPEN;
    }
  }, [converterAmount, converterDirection, ratePENtoGTQ, rateGTQtoPEN]);

  // Helper to convert any amount in current currency to both Soles and Quetzales
  const formatSolesAndQuetzales = (amountInActiveCurrency: number) => {
    const activeRate = liveCurrencies?.[currency]?.rate || CURRENCIES[currency]?.rate || 1;
    const amountInUSD = amountInActiveCurrency / activeRate;
    const soles = amountInUSD * penRate;
    const quetzales = amountInUSD * gtqRate;
    return {
      soles: `S/ ${soles.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      quetzales: `Q ${quetzales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      solesRaw: soles,
      quetzalesRaw: quetzales
    };
  };

  // Dropi Executed Files Integration State
  const [selectedDropiBatchId, setSelectedDropiBatchId] = useState<string>(() => {
    return activeExecutedBatchId || localStorage.getItem('ecommil_active_executed_batch_id') || 'all';
  });

  useEffect(() => {
    if (activeExecutedBatchId) {
      setSelectedDropiBatchId(activeExecutedBatchId);
    }
  }, [activeExecutedBatchId]);

  const dropiFiles = useMemo<DropiFileRecord[]>(() => {
    let files: DropiFileRecord[] = [];
    try {
      const saved = localStorage.getItem('ecommil_dropi_file_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          files = parsed;
        }
      }
    } catch (e) {}

    // Check orders prop to discover any executed files
    if (orders && orders.length > 0) {
      const batchMap = new Map<string, { fileName: string; count: number }>();
      orders.forEach(o => {
        if (o.uploadBatchId && o.uploadBatchId !== 'all') {
          if (!batchMap.has(o.uploadBatchId)) {
            batchMap.set(o.uploadBatchId, {
              fileName: o.uploadFileName || 'Lote Dropi ' + o.uploadBatchId.slice(-6),
              count: 0
            });
          }
          batchMap.get(o.uploadBatchId)!.count++;
        }
      });

      batchMap.forEach((val, id) => {
        if (!files.some(f => f.id === id)) {
          files.push({
            id,
            fileName: val.fileName,
            uploadDate: new Date().toLocaleDateString(),
            uploadDateOnly: new Date().toISOString().split('T')[0],
            uploadTimestamp: Date.now(),
            orderCount: val.count,
            totalRevenue: 0,
            deliveredCount: 0,
            returnedCount: 0,
            inTransitCount: 0,
            status: 'ejecutado',
            platform: 'Dropi'
          });
        }
      });
    }

    if (files.length === 0) {
      files = [
        {
          id: 'batch_demo_dropi_guatemala',
          fileName: 'Dropi_Guatemala_Lote_Limpiador_Nasal.xlsx',
          uploadDate: '2026-09-28 16:45',
          uploadDateOnly: '2026-09-28',
          uploadTimestamp: Date.now() - 86400000 * 3,
          orderCount: 248,
          totalRevenue: 28520,
          deliveredCount: 186,
          returnedCount: 42,
          inTransitCount: 20,
          cancelledCount: 0,
          status: 'ejecutado',
          platform: 'Dropi'
        },
        {
          id: 'batch_demo_dropi_peru',
          fileName: 'Dropi_Peru_Envios_Soles_Septiembre.xlsx',
          uploadDate: '2026-09-25 11:20',
          uploadDateOnly: '2026-09-25',
          uploadTimestamp: Date.now() - 86400000 * 6,
          orderCount: 310,
          totalRevenue: 26350,
          deliveredCount: 232,
          returnedCount: 58,
          inTransitCount: 20,
          cancelledCount: 0,
          status: 'ejecutado',
          platform: 'Dropi'
        }
      ];
    }

    return files;
  }, [orders]);

  const selectedDropiStats = useMemo(() => {
    // 1. If orders array has matching items
    if (orders && orders.length > 0) {
      const relevantOrders = selectedDropiBatchId === 'all'
        ? orders
        : orders.filter(o => o.uploadBatchId === selectedDropiBatchId);

      if (relevantOrders.length > 0) {
        const totalOrders = relevantOrders.length;
        const deliveredOrders = relevantOrders.filter(o => o.status === 'Entregado');
        const returnedOrders = relevantOrders.filter(o => o.status === 'Devuelto');
        const inTransitOrders = relevantOrders.filter(o => o.status === 'En tránsito' || o.status === 'Guía Generada' || o.status === 'Recolectado');
        const cancelledOrders = relevantOrders.filter(o => o.status === 'Cancelado');

        const deliveredCount = deliveredOrders.length;
        const returnedCount = returnedOrders.length;
        const inTransitCount = inTransitOrders.length;
        const cancelledCount = cancelledOrders.length;

        const effectiveTotal = deliveredCount + returnedCount;
        const deliveryRate = effectiveTotal > 0 ? (deliveredCount / effectiveTotal) * 100 : (totalOrders > 0 ? (deliveredCount / totalOrders) * 100 : 75);
        const returnRate = effectiveTotal > 0 ? (returnedCount / effectiveTotal) * 100 : (100 - deliveryRate);

        const totalDeliveredRevenue = deliveredOrders.reduce((sum, o) => sum + (o.price || 0), 0);
        const totalDeliveredCost = deliveredOrders.reduce((sum, o) => sum + (o.cost || 0), 0);
        const totalDeliveredShipping = deliveredOrders.reduce((sum, o) => sum + (o.shippingReal || 0), 0);
        const totalDeliveredAds = deliveredOrders.reduce((sum, o) => sum + (o.adsCost || 0), 0);

        const realProfitDelivered = deliveredOrders.reduce((sum, o) => {
          const calc = calculateOrderProfit(o);
          return sum + calc.netProfit;
        }, 0);

        const returnedShippingLoss = returnedOrders.reduce((sum, o) => sum + (o.shippingReal || o.costoDevolucionFlete || (parseFloat(inputs.shippingBase) || 20)), 0);
        const realNetProfit = realProfitDelivered - returnedShippingLoss;

        const avgPrice = deliveredCount > 0 ? totalDeliveredRevenue / deliveredCount : (computed.precioVenta || 115);
        const avgCost = deliveredCount > 0 ? totalDeliveredCost / deliveredCount : (computed.proveedor || 35);
        const avgShipping = deliveredCount > 0 ? totalDeliveredShipping / deliveredCount : (parseFloat(inputs.shippingBase) || 20);
        const avgAds = deliveredCount > 0 ? totalDeliveredAds / deliveredCount : (parseFloat(inputs.cpaAds) || 15);
        const avgProfitPerDelivered = deliveredCount > 0 ? realNetProfit / deliveredCount : (avgPrice - avgCost - avgShipping - avgAds);

        // Product names
        const productCounts: Record<string, number> = {};
        relevantOrders.forEach(o => {
          if (o.product) productCounts[o.product] = (productCounts[o.product] || 0) + 1;
        });
        const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Producto Dropi';

        // Calculate days span in this batch
        let daysCount = 30;
        const dates = relevantOrders.map(o => o.date ? new Date(o.date).getTime() : null).filter(Boolean) as number[];
        if (dates.length > 1) {
          const minD = Math.min(...dates);
          const maxD = Math.max(...dates);
          const diff = Math.round((maxD - minD) / 86400000);
          if (diff > 0) daysCount = Math.max(1, diff);
        }

        const dailyDelivered = parseFloat((deliveredCount / daysCount).toFixed(1));
        const dailyReturned = parseFloat((returnedCount / daysCount).toFixed(1));
        const dailyDeliveredRevenue = totalDeliveredRevenue / daysCount;
        const dailyNetProfit = realNetProfit / daysCount;
        const dailyReturnLoss = returnedShippingLoss / daysCount;
        const marginOnDelivered = totalDeliveredRevenue > 0 ? (realNetProfit / totalDeliveredRevenue) * 100 : 0;

        return {
          fileName: selectedDropiBatchId === 'all' ? 'Todos los Pedidos Dropi' : (relevantOrders[0]?.uploadFileName || 'Archivo Dropi'),
          totalOrders,
          deliveredCount,
          returnedCount,
          inTransitCount,
          cancelledCount,
          deliveryRate: parseFloat(deliveryRate.toFixed(1)),
          returnRate: parseFloat(returnRate.toFixed(1)),
          totalRevenue: totalDeliveredRevenue,
          realNetProfit,
          avgProfitPerDelivered,
          avgPrice,
          avgCost,
          avgShipping,
          avgAds,
          topProduct,
          returnedShippingLoss,
          daysCount,
          dailyDelivered,
          dailyReturned,
          dailyDeliveredRevenue,
          dailyNetProfit,
          dailyReturnLoss,
          marginOnDelivered
        };
      }
    }

    // 2. Fallback to DropiFileRecord from history
    const matchingFile = dropiFiles.find(f => f.id === selectedDropiBatchId) || dropiFiles[0];
    const totalOrders = matchingFile.orderCount || 240;
    const deliveredCount = matchingFile.deliveredCount || Math.round(totalOrders * 0.75);
    const returnedCount = matchingFile.returnedCount || Math.round(totalOrders * 0.20);
    const inTransitCount = matchingFile.inTransitCount || (totalOrders - deliveredCount - returnedCount);
    const cancelledCount = matchingFile.cancelledCount || 0;
    const effective = deliveredCount + returnedCount;
    const deliveryRate = effective > 0 ? (deliveredCount / effective) * 100 : 75;
    const returnRate = 100 - deliveryRate;

    const avgPrice = computed.precioVenta > 0 ? computed.precioVenta : 115;
    const avgCost = computed.proveedor > 0 ? computed.proveedor : 35;
    const avgShipping = parseFloat(inputs.shippingBase) || 20;
    const avgAds = parseFloat(inputs.cpaAds) || 15;

    const totalRevenue = matchingFile.totalRevenue > 0 ? matchingFile.totalRevenue : deliveredCount * avgPrice;
    const returnedShippingLoss = returnedCount * avgShipping;
    const realNetProfit = (deliveredCount * (avgPrice - avgCost - avgShipping - avgAds)) - returnedShippingLoss;
    const avgProfitPerDelivered = deliveredCount > 0 ? realNetProfit / deliveredCount : 0;
    const daysCount = 30;
    const dailyDelivered = parseFloat((deliveredCount / daysCount).toFixed(1));
    const dailyReturned = parseFloat((returnedCount / daysCount).toFixed(1));
    const dailyDeliveredRevenue = totalRevenue / daysCount;
    const dailyNetProfit = realNetProfit / daysCount;
    const dailyReturnLoss = returnedShippingLoss / daysCount;
    const marginOnDelivered = totalRevenue > 0 ? (realNetProfit / totalRevenue) * 100 : 0;

    return {
      fileName: matchingFile.fileName,
      totalOrders,
      deliveredCount,
      returnedCount,
      inTransitCount,
      cancelledCount,
      deliveryRate: parseFloat(deliveryRate.toFixed(1)),
      returnRate: parseFloat(returnRate.toFixed(1)),
      totalRevenue,
      realNetProfit,
      avgProfitPerDelivered,
      avgPrice,
      avgCost,
      avgShipping,
      avgAds,
      topProduct: inputs.name || 'Producto Dropi',
      returnedShippingLoss,
      daysCount,
      dailyDelivered,
      dailyReturned,
      dailyDeliveredRevenue,
      dailyNetProfit,
      dailyReturnLoss,
      marginOnDelivered
    };
  }, [orders, selectedDropiBatchId, dropiFiles, computed, inputs]);

  // Mode: Native Dropi Data vs Calculator Data ("Sacar con datos de calculadora")
  const [dropiCalculationSource, setDropiCalculationSource] = useState<'dropi' | 'calculator'>('dropi');

  const activeDropiMetrics = useMemo(() => {
    const deliveredCount = selectedDropiStats.deliveredCount;
    const returnedCount = selectedDropiStats.returnedCount;
    const pv = computed.precioVenta > 0 ? computed.precioVenta : (selectedDropiStats.avgPrice || 115);
    const unitProfit = computed.utilidadValor;
    const calculatorRevenue = deliveredCount * pv;
    const calculatorNetProfit = deliveredCount * unitProfit;
    const calculatorProductCost = deliveredCount * computed.costoProducto;
    const calculatorShippingCost = deliveredCount * computed.fleteReal;
    const calculatorAdsCost = deliveredCount * computed.cpaReal;
    const calculatorTotalCost = deliveredCount * computed.costosTotales;

    const revenueDifference = calculatorRevenue - selectedDropiStats.totalRevenue;
    const profitDifference = calculatorNetProfit - selectedDropiStats.realNetProfit;

    const daysCount = selectedDropiStats.daysCount || 30;

    if (dropiCalculationSource === 'calculator') {
      const marginOnDelivered = calculatorRevenue > 0 ? (calculatorNetProfit / calculatorRevenue) * 100 : (parseFloat(inputs.desiredProfitPercent) || 0);
      const dailyDeliveredRevenue = calculatorRevenue / daysCount;
      const dailyNetProfit = calculatorNetProfit / daysCount;

      return {
        isCalculatorData: true,
        totalRevenue: calculatorRevenue,
        realNetProfit: calculatorNetProfit,
        avgProfitPerDelivered: unitProfit,
        marginOnDelivered,
        dailyDeliveredRevenue,
        dailyNetProfit,
        dailyReturnLoss: selectedDropiStats.dailyReturnLoss,
        unitPrice: pv,
        unitCost: computed.costosTotales,
        unitProfit,
        calculatorRevenue,
        calculatorNetProfit,
        calculatorProductCost,
        calculatorShippingCost,
        calculatorAdsCost,
        calculatorTotalCost,
        revenueDifference,
        profitDifference
      };
    }

    return {
      isCalculatorData: false,
      totalRevenue: selectedDropiStats.totalRevenue,
      realNetProfit: selectedDropiStats.realNetProfit,
      avgProfitPerDelivered: selectedDropiStats.avgProfitPerDelivered,
      marginOnDelivered: selectedDropiStats.marginOnDelivered,
      dailyDeliveredRevenue: selectedDropiStats.dailyDeliveredRevenue,
      dailyNetProfit: selectedDropiStats.dailyNetProfit,
      dailyReturnLoss: selectedDropiStats.dailyReturnLoss,
      unitPrice: selectedDropiStats.avgPrice,
      unitCost: selectedDropiStats.avgCost,
      unitProfit: selectedDropiStats.avgProfitPerDelivered,
      calculatorRevenue,
      calculatorNetProfit,
      calculatorProductCost,
      calculatorShippingCost,
      calculatorAdsCost,
      calculatorTotalCost,
      revenueDifference,
      profitDifference
    };
  }, [dropiCalculationSource, selectedDropiStats, computed, inputs]);

  const dropiFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingDropiFile, setIsUploadingDropiFile] = useState<boolean>(false);

  const handleDropiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDropiFile(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'array', cellDates: true, raw: false });
        let targetSheetName = wb.SheetNames[0];
        for (const name of wb.SheetNames) {
          const s = wb.Sheets[name];
          if (s && Object.keys(s).some(k => !k.startsWith('!'))) {
            targetSheetName = name;
            break;
          }
        }
        const ws = wb.Sheets[targetSheetName];
        const rows = XLSX.utils.sheet_to_json(ws) as any[];

        if (rows && rows.length > 0) {
          let delivered = 0;
          let returned = 0;
          let inTransit = 0;
          let cancelled = 0;
          let rev = 0;

          rows.forEach(r => {
            const statusStr = String(r['Estado'] || r['ESTADO'] || r['Status'] || r['status'] || '').toLowerCase();
            const priceVal = parseFloat(String(r['Total'] || r['VALOR TOTAL'] || r['Precio'] || r['precio'] || r['price'] || 0).replace(/[^0-9.-]/g, '')) || 0;

            if (statusStr.includes('entregad') || statusStr.includes('delivered') || statusStr.includes('exitos')) {
              delivered++;
              rev += priceVal;
            } else if (statusStr.includes('devuelt') || statusStr.includes('retornad') || statusStr.includes('devoluc')) {
              returned++;
            } else if (statusStr.includes('cancel') || statusStr.includes('anulad')) {
              cancelled++;
            } else {
              inTransit++;
            }
          });

          const newBatchId = `batch_dropi_calc_${Date.now()}`;
          const newRecord: DropiFileRecord = {
            id: newBatchId,
            fileName: file.name,
            uploadDate: new Date().toLocaleString(),
            uploadDateOnly: new Date().toISOString().split('T')[0],
            uploadTimestamp: Date.now(),
            orderCount: rows.length,
            totalRevenue: rev || (delivered * (computed.precioVenta || 115)),
            deliveredCount: delivered,
            returnedCount: returned,
            inTransitCount: inTransit,
            cancelledCount: cancelled,
            status: 'ejecutado',
            platform: 'Dropi'
          };

          const existingHistory: DropiFileRecord[] = JSON.parse(localStorage.getItem('ecommil_dropi_file_history') || '[]');
          const updatedHistory = [newRecord, ...existingHistory.filter(f => f.id !== newRecord.id)];
          localStorage.setItem('ecommil_dropi_file_history', JSON.stringify(updatedHistory));

          setSelectedDropiBatchId(newRecord.id);
          setSaveFeedback(`🎉 Archivo Dropi "${file.name}" cargado y ejecutado con éxito: ${delivered} pedidos entregados.`);
          setTimeout(() => setSaveFeedback(null), 5000);
        }
      } catch (err) {
        console.error('Error al procesar archivo Dropi:', err);
        setSaveFeedback('❌ Error al procesar el archivo Excel. Verifica el formato.');
        setTimeout(() => setSaveFeedback(null), 4000);
      } finally {
        setIsUploadingDropiFile(false);
        if (dropiFileInputRef.current) dropiFileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleLoadDropiStatsIntoCalculator = () => {
    setInputs(prev => ({
      ...prev,
      name: selectedDropiStats.topProduct || prev.name,
      costPerUnit: selectedDropiStats.avgCost > 0 ? String(Math.round(selectedDropiStats.avgCost)) : prev.costPerUnit,
      shippingBase: selectedDropiStats.avgShipping > 0 ? String(Math.round(selectedDropiStats.avgShipping)) : prev.shippingBase,
      cpaAds: selectedDropiStats.avgAds > 0 ? String(Math.round(selectedDropiStats.avgAds)) : prev.cpaAds,
      deliveryDispatchPercent: String(Math.round(selectedDropiStats.deliveryRate)),
      finalDeliveryPercent: String(Math.round(selectedDropiStats.deliveryRate))
    }));

    // In simulation mode B, load the real order count!
    setPlannedSalesInput(String(selectedDropiStats.totalOrders));
    setPlannedSalesUnit('month');

    setSaveFeedback(`⚡ ¡Datos jalados de "${selectedDropiStats.fileName}" cargados en la calculadora con éxito!`);
    setTimeout(() => setSaveFeedback(null), 4000);
  };

  const handleExecuteDropiInSimulator = () => {
    handleLoadDropiStatsIntoCalculator();
    setSimulationMode('salesToProfit');
    const el = document.getElementById('seccion-ventas-por-pedidos');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div ref={calculatorTopRef} className="max-w-full mx-auto space-y-6 px-4" style={{ fontSize: `${fontSize}px` }}>
      
      {/* Save / Update Feedback Notification */}
      <AnimatePresence>
        {saveFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-xs font-bold font-mono flex items-center justify-between shadow-lg shadow-emerald-500/10"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>{saveFeedback}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setSaveFeedback(null)} 
              className="text-emerald-400/60 hover:text-emerald-300 p-0.5 cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Edit Mode Notification Banner */}
      <AnimatePresence>
        {editingId && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-gradient-to-r from-amber-500/15 via-[#ff5500]/10 to-amber-500/15 border border-amber-500/40 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-amber-300 shadow-lg shadow-amber-500/10"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <Edit2 size={15} className="text-amber-400 shrink-0" />
              <span className="text-xs font-bold">
                MODO EDICIÓN: Editando cálculo de <span className="text-white font-mono underline font-extrabold">{inputs.name || 'Producto'}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveToHistory}
                className="bg-gradient-to-r from-[#ff5500] to-[#ff7700] hover:brightness-110 text-white rounded-lg py-1.5 px-3 text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-[#ff5500]/20 cursor-pointer"
              >
                <Check size={13} />
                <span>Actualizar</span>
              </button>
              <button
                type="button"
                onClick={handleSaveAsNew}
                className="bg-white/10 hover:bg-white/15 text-white rounded-lg py-1.5 px-3 text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer border border-white/10"
                title="Guardar como una copia adicional separada"
              >
                <Copy size={13} />
                <span>Guardar como nuevo</span>
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-all text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              >
                <X size={13} />
                <span>Cancelar</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-white/5 pb-6">
        <div>

          <h2 className="text-3xl font-display font-black tracking-tight text-white flex items-center gap-1">
            CALCULADORA DE <span className="text-[#ff5500]">PRECIOS COD</span>
          </h2>
          <p className="text-[12px] text-slate-400 max-w-2xl mt-1.5 leading-relaxed">
            El modelo real: el flete se divide por la entrega de despacho y el CPA por la entrega final. 
            Te arma el precio de venta, la utilidad, la distribución del costo y el precio ancla.
          </p>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Font Size Adjuster */}
          <div className="flex items-center gap-3 bg-[#111] border border-white/5 rounded-xl px-4 py-2 text-white">
            <button 
              onClick={decreaseFontSize}
              className="text-[11px] font-black hover:text-[#00df9a] transition-colors"
              title="Disminuir letra"
            >
              A-
            </button>
            <input 
              type="range" 
              min="12" 
              max="18" 
              value={fontSize} 
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="w-16 accent-[#ff5500] cursor-pointer"
            />
            <button 
              onClick={increaseFontSize}
              className="text-[11px] font-black hover:text-[#00df9a] transition-colors"
              title="Aumentar letra"
            >
              A+
            </button>
            <span className="text-[11px] font-bold text-slate-500 min-w-[30px] text-right">
              {fontSize}px
            </span>
          </div>

          {/* Clean Fields Button */}
          <button 
            onClick={clearInputs}
            className="flex items-center gap-2 bg-[#111] border border-white/5 hover:bg-slate-900 text-white rounded-xl py-2 px-4 text-[13px] font-bold transition-all cursor-pointer"
          >
            <RefreshCw size={14} className="text-slate-400" />
            Limpiar
          </button>

          {/* Save / Update to History Button */}
          {editingId ? (
            <div className="flex items-center gap-2">
              <button 
                onClick={handleSaveToHistory}
                className="flex items-center gap-2 bg-gradient-to-r from-[#ff5500] to-[#ff7700] hover:brightness-110 text-white rounded-xl py-2 px-5 text-[13px] font-bold transition-all shadow-lg shadow-[#ff5500]/20 cursor-pointer ring-2 ring-[#ff5500]/40"
              >
                <Check size={14} />
                Actualizar cálculo
              </button>
            </div>
          ) : (
            <button 
              onClick={handleSaveToHistory}
              className="flex items-center gap-2 bg-gradient-to-r from-[#ff5500] to-[#ff7700] hover:brightness-110 text-white rounded-xl py-2 px-5 text-[13px] font-bold transition-all shadow-lg shadow-[#ff5500]/20 cursor-pointer"
            >
              <Save size={14} />
              Guardar en historial
            </button>
          )}
        </div>
      </div>

      {/* MODULO DE CONVERSIÓN EN VIVO: SOLES (PEN) ⇄ QUETZALES (GTQ) */}
      <div className="bg-gradient-to-r from-amber-500/10 via-[#111] to-emerald-500/10 border-2 border-amber-500/30 hover:border-amber-500/50 rounded-2xl p-5 shadow-2xl relative overflow-hidden transition-all">
        {/* Glow Effects */}
        <div className="absolute top-0 right-10 w-48 h-20 bg-emerald-500/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-48 h-20 bg-amber-500/10 blur-2xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-4 relative z-10">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-black flex items-center justify-center font-black shrink-0 shadow-lg shadow-amber-500/20">
              <ArrowLeftRight size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Conversión en Vivo
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">
                  🇵🇪 Soles (PEN) ⇄ 🇬🇹 Quetzales (GTQ)
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  Actualizado: {lastRatesUpdate}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-display font-black text-white mt-0.5">
                TIPO DE CAMBIO EN VIVO: PERÚ & GUATEMALA
              </h3>
            </div>
          </div>

          {/* Quick Rates Info & Refresh Button & One-Click Full Calculator Converter */}
          <div className="flex items-center gap-2.5 flex-wrap self-end lg:self-center">
            <div className="flex items-center gap-2 bg-black/60 border border-white/10 px-3 py-1.5 rounded-xl font-mono text-xs">
              <span className="text-slate-400">1 PEN =</span>
              <span className="text-[#00df9a] font-bold">Q {ratePENtoGTQ.toFixed(4)}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">1 GTQ =</span>
              <span className="text-amber-400 font-bold">S/ {rateGTQtoPEN.toFixed(4)}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => convertEntireCalculator('PEN')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer border shadow-sm active:scale-95 ${
                  inputs.currency === 'PEN'
                    ? 'bg-amber-500 text-black border-amber-500 shadow-amber-500/20 ring-2 ring-amber-400/50'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
                title="Convierte todos los costos y precios de la calculadora a Soles peruanos"
              >
                <span>🇵🇪 A Soles</span>
              </button>
              <button
                type="button"
                onClick={() => convertEntireCalculator('GTQ')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer border shadow-sm active:scale-95 ${
                  inputs.currency === 'GTQ'
                    ? 'bg-[#00df9a] text-black border-[#00df9a] shadow-[#00df9a]/20 ring-2 ring-[#00df9a]/50'
                    : 'bg-[#00df9a]/10 hover:bg-[#00df9a]/20 text-[#00df9a] border-[#00df9a]/30'
                }`}
                title="Convierte todos los costos y precios de la calculadora a Quetzales guatemaltecos"
              >
                <span>🇬🇹 A Quetzales</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleManualRefreshRates}
              disabled={isRefreshingRates}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              title="Refrescar tasas de cambio en vivo desde el servidor financiero"
            >
              <RefreshCw size={13} className={isRefreshingRates ? "animate-spin text-amber-400" : "text-slate-400"} />
              <span>{isRefreshingRates ? '...' : 'Tasa en vivo'}</span>
            </button>
          </div>
        </div>

        {/* Live Interactive Converter Box */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-4 relative z-10">
          
          {/* Source Input */}
          <div className="md:col-span-5 bg-black/50 border border-white/10 rounded-xl p-3.5 space-y-1.5 focus-within:border-amber-500/50 transition-all">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>{converterDirection === 'PEN_TO_GTQ' ? '🇵🇪 Soles (PEN)' : '🇬🇹 Quetzales (GTQ)'}</span>
              <span className="text-[10px] font-mono text-amber-400">Monto a Convertir</span>
            </div>
            <div className="relative flex items-center">
              <span className="text-lg font-black text-amber-400 font-mono mr-2">
                {converterDirection === 'PEN_TO_GTQ' ? 'S/' : 'Q'}
              </span>
              <input
                type="number"
                value={converterAmount}
                onChange={(e) => setConverterAmount(e.target.value)}
                placeholder="100"
                className="w-full bg-transparent text-2xl font-mono font-black text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Switch Direction Button */}
          <div className="md:col-span-2 flex flex-col items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => setConverterDirection(prev => prev === 'PEN_TO_GTQ' ? 'GTQ_TO_PEN' : 'PEN_TO_GTQ')}
              className="w-12 h-12 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-amber-500/10 active:scale-90 group"
              title="Cambiar dirección de conversión (PEN ⇄ GTQ)"
            >
              <ArrowLeftRight size={20} className="group-hover:rotate-180 transition-transform duration-300" />
            </button>
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">Invertir</span>
          </div>

          {/* Target Converted Output */}
          <div className="md:col-span-5 bg-black/50 border border-[#00df9a]/30 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>{converterDirection === 'PEN_TO_GTQ' ? '🇬🇹 Quetzales (GTQ)' : '🇵🇪 Soles (PEN)'}</span>
              <span className="text-[10px] font-mono text-[#00df9a]">Resultado en Vivo</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-[#00df9a] font-mono">
                {converterDirection === 'PEN_TO_GTQ' ? 'Q' : 'S/'}
              </span>
              <span className="text-2xl sm:text-3xl font-mono font-black text-[#00df9a] tracking-tight">
                {convertedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Instant Apply Button */}
            <button
              type="button"
              onClick={() => convertEntireCalculator(converterDirection === 'PEN_TO_GTQ' ? 'GTQ' : 'PEN')}
              className="w-full py-1.5 px-3 rounded-lg bg-[#00df9a]/15 hover:bg-[#00df9a]/25 border border-[#00df9a]/35 text-[#00df9a] text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
              title="Convertir todos los costos, precios y márgenes de la calculadora a esta moneda"
            >
              <Zap size={13} fill="currentColor" />
              <span>Convertir toda la calculadora a {converterDirection === 'PEN_TO_GTQ' ? 'Quetzales (GTQ)' : 'Soles (PEN)'}</span>
            </button>
          </div>

        </div>

        {/* Quick Conversions Pocket Table */}
        <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap relative z-10">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>⚡ Conversiones rápidas:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {[10, 20, 50, 100, 200, 500].map((val) => {
              const inGTQ = val * ratePENtoGTQ;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setConverterDirection('PEN_TO_GTQ');
                    setConverterAmount(String(val));
                  }}
                  className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/30 text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1 group"
                >
                  <span className="text-slate-300 font-bold group-hover:text-amber-300">S/ {val}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-[#00df9a] font-bold">Q {inGTQ.toFixed(1)}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* TWO COLUMN GRID: INPUTS & OUTPUTS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: PRODUCT INPUTS */}
        <div className="bg-[#090909] border border-white/5 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="text-[12px] font-black text-[#ff5500] uppercase tracking-[0.2em]">PRODUCTO</h3>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">CALCULATOR INPUTS</span>
          </div>

          <div className="space-y-4">
            
            {/* Nombre del Producto */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Nombre del Producto
              </label>
              <input 
                type="text" 
                name="name" 
                value={inputs.name} 
                onChange={handleInputChange}
                placeholder="Ej: G-Fouk Limpiador Nasal x 2"
                className="w-full bg-[#111] border border-white/5 rounded-xl py-2.5 px-4 text-[14px] text-white focus:outline-none focus:border-[#ff5500]/40 transition-all font-medium"
              />
            </div>

            {/* Tamaño / Presentación */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Tamaño / Presentación
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    name="sizeAmount" 
                    value={inputs.sizeAmount} 
                    onChange={handleInputChange}
                    placeholder="15"
                    className="w-full bg-[#111] border border-white/5 rounded-xl py-2.5 px-4 text-[14px] text-white font-mono focus:outline-none focus:border-[#ff5500]/40 transition-all"
                  />
                  <select 
                    name="sizeUnit" 
                    value={inputs.sizeUnit} 
                    onChange={handleInputChange}
                    className="bg-[#111] border border-white/5 rounded-xl py-2.5 px-3 text-[13px] text-white focus:outline-none focus:border-[#ff5500]/40 transition-all font-bold cursor-pointer"
                  >
                    <option value="ml">ml</option>
                    <option value="gr">gr</option>
                    <option value="unidades">unidades</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
                <p className="text-[9px] text-slate-500 font-bold tracking-wider uppercase mt-1">Ej: 15 ml, 50 gr, etc.</p>
              </div>

              {/* Unidades por Pack */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Unidades por pack
                </label>
                <input 
                  type="number" 
                  name="packUnits" 
                  value={inputs.packUnits} 
                  onChange={handleInputChange}
                  placeholder="1"
                  className="w-full bg-[#111] border border-white/5 rounded-xl py-2.5 px-4 text-[14px] text-white font-mono focus:outline-none focus:border-[#ff5500]/40 transition-all"
                />
              </div>
            </div>

            {/* Moneda select dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Moneda
              </label>
              <select 
                name="currency" 
                value={inputs.currency} 
                onChange={handleInputChange}
                className="w-full bg-[#111] border border-white/5 rounded-xl py-2.5 px-4 text-[14px] text-white focus:outline-none focus:border-[#ff5500]/40 transition-all font-bold cursor-pointer"
              >
                <option value="COP">COP $ - Peso colombiano - Colombia</option>
                <option value="USD">USD $ - Dólar estadounidense - EE.UU.</option>
                <option value="MXN">MXN $ - Peso mexicano - México</option>
                <option value="CLP">CLP $ - Peso chileno - Chile</option>
                <option value="PEN">PEN S/ - Sol peruano - Perú</option>
                <option value="GTQ">GTQ Q - Quetzal guatemalteco - Guatemala</option>
                <option value="EUR">EUR € - Euro - Europa</option>
                <option value="BRL">BRL R$ - Real brasileño - Brasil</option>
                <option value="ARS">ARS $ - Peso argentino - Argentina</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              
              {/* Costo por Unidad */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Costo por unidad
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[13px]">
                    {CURRENCIES[currency]?.symbol || '$'}
                  </span>
                  <input 
                    type="number" 
                    name="costPerUnit" 
                    value={inputs.costPerUnit} 
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full bg-[#111] border border-white/5 rounded-xl py-2.5 pl-8 pr-4 text-[14px] text-white font-mono focus:outline-none focus:border-[#ff5500]/40 transition-all"
                  />
                </div>
                <p className="text-[9px] text-slate-500 font-bold tracking-wider uppercase mt-1">Precio de compra</p>
              </div>

              {/* Flete Base */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Flete base
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[13px]">
                    {CURRENCIES[currency]?.symbol || '$'}
                  </span>
                  <input 
                    type="number" 
                    name="shippingBase" 
                    value={inputs.shippingBase} 
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full bg-[#111] border border-white/5 rounded-xl py-2.5 pl-8 pr-4 text-[14px] text-white font-mono focus:outline-none focus:border-[#ff5500]/40 transition-all"
                  />
                </div>
                <p className="text-[9px] text-slate-500 font-bold tracking-wider uppercase mt-1">Costo envío inicial</p>
              </div>

              {/* % Entrega despacho */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  % Entrega despacho
                </label>
                <div className="relative">
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[13px]">%</span>
                  <input 
                    type="number" 
                    name="deliveryDispatchPercent" 
                    value={inputs.deliveryDispatchPercent} 
                    onChange={handleInputChange}
                    placeholder="80"
                    className="w-full bg-[#111] border border-white/5 rounded-xl py-2.5 pl-4 pr-8 text-[14px] text-white font-mono focus:outline-none focus:border-[#ff5500]/40 transition-all"
                  />
                </div>
                <p className="text-[9px] text-slate-500 font-bold tracking-wider uppercase mt-1">Tasa efectividad de entrega</p>
              </div>

              {/* Costos Administrativos */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Costos administrativos
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[13px]">
                    {CURRENCIES[currency]?.symbol || '$'}
                  </span>
                  <input 
                    type="number" 
                    name="adminCosts" 
                    value={inputs.adminCosts} 
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full bg-[#111] border border-white/5 rounded-xl py-2.5 pl-8 pr-4 text-[14px] text-white font-mono focus:outline-none focus:border-[#ff5500]/40 transition-all"
                  />
                </div>
                <p className="text-[9px] text-slate-500 font-bold tracking-wider uppercase mt-1">Plataforma, personal, fijos</p>
              </div>

              {/* Fulfillment */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Fulfillment
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[13px]">
                    {CURRENCIES[currency]?.symbol || '$'}
                  </span>
                  <input 
                    type="number" 
                    name="fulfillment" 
                    value={inputs.fulfillment} 
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full bg-[#111] border border-white/5 rounded-xl py-2.5 pl-8 pr-4 text-[14px] text-white font-mono focus:outline-none focus:border-[#ff5500]/40 transition-all"
                  />
                </div>
                <p className="text-[9px] text-slate-500 font-bold tracking-wider uppercase mt-1">Bodegaje, empaque, etc.</p>
              </div>

              {/* CPA Ads Manager */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  CPA Ads Manager
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[13px]">
                    {CURRENCIES[currency]?.symbol || '$'}
                  </span>
                  <input 
                    type="number" 
                    name="cpaAds" 
                    value={inputs.cpaAds} 
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full bg-[#111] border border-white/5 rounded-xl py-2.5 pl-8 pr-4 text-[14px] text-white font-mono focus:outline-none focus:border-[#ff5500]/40 transition-all"
                  />
                </div>
                <p className="text-[9px] text-slate-500 font-bold tracking-wider uppercase mt-1">Costo adquisición por campaña</p>
              </div>

              {/* % Tasa entrega final */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  % Tasa entrega final
                </label>
                <div className="relative">
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[13px]">%</span>
                  <input 
                    type="number" 
                    name="finalDeliveryPercent" 
                    value={inputs.finalDeliveryPercent} 
                    onChange={handleInputChange}
                    placeholder="70"
                    className="w-full bg-[#111] border border-white/5 rounded-xl py-2.5 pl-4 pr-8 text-[14px] text-white font-mono focus:outline-none focus:border-[#ff5500]/40 transition-all"
                  />
                </div>
                <p className="text-[9px] text-slate-500 font-bold tracking-wider uppercase mt-1">Efectividad de entrega final</p>
              </div>

              {/* Utilidad deseada */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Utilidad deseada
                </label>
                <div className="relative">
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[13px]">%</span>
                  <input 
                    type="number" 
                    name="desiredProfitPercent" 
                    value={inputs.desiredProfitPercent} 
                    onChange={handleInputChange}
                    placeholder="20"
                    className="w-full bg-[#111] border border-white/5 rounded-xl py-2.5 pl-4 pr-8 text-[14px] text-white font-mono focus:outline-none focus:border-[#ff5500]/40 transition-all"
                  />
                </div>
                <p className="text-[9px] text-slate-500 font-bold tracking-wider uppercase mt-1">Margen neto de ganancia</p>
              </div>

            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: ANALYSIS RESULTS */}
        <div className="bg-[#090909] border border-[#00df9a]/10 hover:border-[#00df9a]/20 transition-all rounded-2xl p-6 space-y-6 shadow-2xl shadow-[#00df9a]/2">
          
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="text-[12px] font-black text-[#00df9a] uppercase tracking-[0.2em]">
              RESULTADOS DE ANÁLISIS
            </h3>
            <span className="flex items-center gap-1 bg-[#00df9a]/10 border border-[#00df9a]/20 text-[#00df9a] rounded-full py-0.5 px-2 text-[9px] font-black tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00df9a] animate-pulse" />
              VIVOS
            </span>
          </div>

          <div className="space-y-4">
            
            {/* ROW: Proveedor */}
            <div className="flex items-center justify-between py-2 border-b border-white/5 text-[14px]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-300">Proveedor</span>
                <span className="bg-[#111] border border-white/5 text-slate-400 py-0.5 px-2 rounded-lg text-[10px] font-mono">
                  x{inputs.packUnits || 1}
                </span>
                <span className="bg-[#111] border border-[#ff5500]/20 text-[#ff5500] py-0.5 px-2 rounded-lg text-[10px] font-bold">
                  {inputs.sizeAmount || 0} {inputs.sizeUnit}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#ff5500] font-mono font-bold text-[12px]">
                  {computed.proveedorPercentPV.toFixed(1)}% <span className="text-[10px] text-slate-500">PV</span>
                </span>
                <span className="text-slate-600">|</span>
                <span className="font-mono font-black text-white">
                  {formatValue(computed.proveedor)}
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-[#00df9a] font-mono font-bold text-[12px]">
                  {computed.proveedorPercentCT.toFixed(1)}% <span className="text-[10px] text-slate-500">CT</span>
                </span>
              </div>
            </div>

            {/* ROW: Flete c/dev */}
            <div className="flex items-center justify-between py-2 border-b border-white/5 text-[14px]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-300">Flete c/dev</span>
                <span className="bg-[#ff5500]/10 border border-[#ff5500]/20 text-[#ff5500] py-0.5 px-1.5 rounded text-[8px] font-black tracking-widest">
                  AUTO
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#ff5500] font-mono font-bold text-[12px]">
                  {computed.fleteDevPercentPV.toFixed(1)}% <span className="text-[10px] text-slate-500">PV</span>
                </span>
                <span className="text-slate-600">|</span>
                <span className="font-mono font-black text-white">
                  {formatValue(computed.fleteDev)}
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-[#00df9a] font-mono font-bold text-[12px]">
                  {computed.fleteDevPercentCT.toFixed(1)}% <span className="text-[10px] text-slate-500">CT</span>
                </span>
              </div>
            </div>

            {/* ROW: CPA costeado */}
            <div className="flex items-center justify-between py-2 border-b border-white/5 text-[14px]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-300">CPA costeado</span>
                <span className="bg-[#ff5500]/10 border border-[#ff5500]/20 text-[#ff5500] py-0.5 px-1.5 rounded text-[8px] font-black tracking-widest">
                  AUTO
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#ff5500] font-mono font-bold text-[12px]">
                  {computed.cpaCosteadoPercentPV.toFixed(1)}% <span className="text-[10px] text-slate-500">PV</span>
                </span>
                <span className="text-slate-600">|</span>
                <span className="font-mono font-black text-white">
                  {formatValue(computed.cpaCosteado)}
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-[#00df9a] font-mono font-bold text-[12px]">
                  {computed.cpaCosteadoPercentCT.toFixed(1)}% <span className="text-[10px] text-slate-500">CT</span>
                </span>
              </div>
            </div>

            {/* ROW: Admin */}
            <div className="flex items-center justify-between py-2 border-b border-white/5 text-[14px]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-300">Admin</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#ff5500] font-mono font-bold text-[12px]">
                  {computed.adminPercentPV.toFixed(1)}% <span className="text-[10px] text-slate-500">PV</span>
                </span>
                <span className="text-slate-600">|</span>
                <span className="font-mono font-black text-white">
                  {formatValue(computed.admin)}
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-[#00df9a] font-mono font-bold text-[12px]">
                  {computed.adminPercentCT.toFixed(1)}% <span className="text-[10px] text-slate-500">CT</span>
                </span>
              </div>
            </div>

            {/* ROW: Fulfillment */}
            <div className="flex items-center justify-between py-2 border-b border-white/5 text-[14px]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-300">Fulfillment</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#ff5500] font-mono font-bold text-[12px]">
                  {computed.fullfillPercentPV.toFixed(1)}% <span className="text-[10px] text-slate-500">PV</span>
                </span>
                <span className="text-slate-600">|</span>
                <span className="font-mono font-black text-white">
                  {formatValue(computed.fullfill)}
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-[#00df9a] font-mono font-bold text-[12px]">
                  {computed.fullfillPercentCT.toFixed(1)}% <span className="text-[10px] text-slate-500">CT</span>
                </span>
              </div>
            </div>

            {/* SEPARATOR AND BAR CHART */}
            <div className="py-4 space-y-3">
              <h4 className="text-[9px] font-black text-center text-slate-500 uppercase tracking-[0.25em]">
                DISTRIBUCIÓN DEL PRECIO DE VENTA
              </h4>
              <div className="flex h-3.5 w-full rounded-full overflow-hidden bg-[#111] border border-white/5 shadow-inner">
                <div 
                  style={{ width: `${computed.proveedorPercentPV}%` }} 
                  className="bg-amber-500 hover:brightness-110 transition-all duration-300 cursor-pointer" 
                  title={`Proveedor: ${computed.proveedorPercentPV.toFixed(1)}%`} 
                />
                <div 
                  style={{ width: `${computed.fleteDevPercentPV}%` }} 
                  className="bg-orange-600 hover:brightness-110 transition-all duration-300 cursor-pointer" 
                  title={`Flete con dev: ${computed.fleteDevPercentPV.toFixed(1)}%`} 
                />
                <div 
                  style={{ width: `${computed.cpaCosteadoPercentPV}%` }} 
                  className="bg-[#ffaa00] hover:brightness-110 transition-all duration-300 cursor-pointer" 
                  title={`CPA costeado: ${computed.cpaCosteadoPercentPV.toFixed(1)}%`} 
                />
                <div 
                  style={{ width: `${computed.adminPercentPV}%` }} 
                  className="bg-slate-500 hover:brightness-110 transition-all duration-300 cursor-pointer" 
                  title={`Admin: ${computed.adminPercentPV.toFixed(1)}%`} 
                />
                {computed.fullfillPercentPV > 0 && (
                  <div 
                    style={{ width: `${computed.fullfillPercentPV}%` }} 
                    className="bg-indigo-500 hover:brightness-110 transition-all duration-300 cursor-pointer" 
                    title={`Fulfillment: ${computed.fullfillPercentPV.toFixed(1)}%`} 
                  />
                )}
                <div 
                  style={{ width: `${computed.utilidadPercentPV}%` }} 
                  className="bg-[#00df9a] hover:brightness-110 transition-all duration-300 cursor-pointer animate-pulse" 
                  title={`Utilidad: ${computed.utilidadPercentPV.toFixed(1)}%`} 
                />
              </div>

              {/* Legends */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Proveedor
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-600" /> Flete
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#ffaa00]" /> CPA
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-500" /> Admin
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#00df9a]" /> Utilidad
                </span>
              </div>
            </div>

            {/* COSTOS TOTALES & UTILIDAD SUMMARIES */}
            <div className="pt-2 border-t border-white/5 space-y-3">
              
              {/* Costos totales */}
              <div className="flex items-center justify-between text-[15px]">
                <span className="font-bold text-slate-300">Costos totales</span>
                <div className="flex items-center gap-3">
                  <span className="text-[#ff5500] font-mono font-bold text-[12px]">
                    {computed.costosTotalesPercentPV.toFixed(1)}% <span className="text-[10px] text-slate-500">PV</span>
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="font-mono font-black text-slate-300">
                    {formatValue(computed.costosTotales)}
                  </span>
                </div>
              </div>

              {/* Utilidad */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[15px]">
                  <span className="font-black text-white">
                    Utilidad ({parseFloat(inputs.desiredProfitPercent || '0').toFixed(1)}%)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[#ff5500] font-mono font-bold text-[12px]">
                      {computed.utilidadPercentPV.toFixed(1)}% <span className="text-[10px] text-slate-500">PV</span>
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="font-mono font-black text-[#00df9a]">
                      {formatValue(computed.utilidadAbsoluta)}
                    </span>
                  </div>
                </div>
                {/* Live currency equivalent for profit */}
                <div className="flex justify-end text-[10px] font-mono text-slate-400">
                  {currency === 'PEN' ? (
                    <span>🇬🇹 Utilidad en Quetzales: <strong className="text-amber-300">Q {(computed.utilidadAbsoluta * ratePENtoGTQ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                  ) : currency === 'GTQ' ? (
                    <span>🇵🇪 Utilidad en Soles: <strong className="text-amber-300">S/ {(computed.utilidadAbsoluta * rateGTQtoPEN).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                  ) : null}
                </div>
              </div>

            </div>

            {/* MARGIN RATIO SLIDER WITH contextual pointer and rating badge */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Semáforo de Rentabilidad
                </span>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                  ¡Haz clic o arrastra para ajustar!
                </span>
              </div>
              <div 
                ref={sliderRef}
                onMouseDown={handleSliderMouseDown}
                onTouchStart={handleSliderTouchStart}
                className="relative h-3 w-full rounded-full bg-gradient-to-r from-red-600 via-amber-500 to-[#00df9a] border border-white/5 mt-2 cursor-pointer select-none"
              >
                {/* Knob */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-black border-2 border-white shadow-md -ml-2.5 transition-all duration-150 flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110"
                  style={{ left: `${activeRating.sliderPos}%` }}
                >
                  <span className="w-2 h-2 rounded-full bg-[#00df9a]" />
                </div>
              </div>
              <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold tracking-widest uppercase px-1">
                <span>0%</span>
                <span>10%</span>
                <span>20%</span>
                <span>30%</span>
                <span>40%+</span>
              </div>

              {/* Status Badge */}
              <div className={`border rounded-xl py-2.5 px-4 text-center text-[12px] font-bold tracking-wide transition-all ${activeRating.color} flex items-center justify-center gap-2 mt-2`}>
                {activeRating.badge}
              </div>
            </div>

            {/* PRECIO DE VENTA GLOWING BOX */}
            <div className="bg-[#00df9a]/5 border border-[#00df9a]/20 hover:border-[#00df9a]/40 transition-all rounded-xl p-5 shadow-lg shadow-[#00df9a]/2 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[11px] font-black text-[#00df9a] uppercase tracking-[0.2em]">
                    PRECIO DE VENTA
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Precio recomendado al público
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-display font-black tracking-tight text-[#00df9a] drop-shadow-[0_0_15px_rgba(0,223,154,0.3)]">
                    {formatValue(computed.precioVenta)}
                  </span>
                </div>
              </div>

              {/* Live Soles ⇄ Quetzales conversion tag */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono">
                <span className="text-slate-400 font-bold flex items-center gap-1">
                  <ArrowLeftRight size={12} className="text-amber-400" />
                  Equivalencia en vivo:
                </span>
                <div className="flex items-center gap-2">
                  {currency === 'PEN' ? (
                    <span className="text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                      🇬🇹 Quetzales: Q {(computed.precioVenta * ratePENtoGTQ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ) : currency === 'GTQ' ? (
                    <span className="text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                      🇵🇪 Soles: S/ {(computed.precioVenta * rateGTQtoPEN).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                        🇵🇪 {formatSolesAndQuetzales(computed.precioVenta).soles}
                      </span>
                      <span className="text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        🇬🇹 {formatSolesAndQuetzales(computed.precioVenta).quetzales}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ANCHOR / COMPARISON PRICE */}
            <div className="flex items-center justify-between text-[11px] font-bold px-1 text-slate-500">
              <span>Precio comparación (x2)</span>
              <span className="line-through text-red-500 tracking-wider font-mono">
                {formatValue(computed.precioComparacion)}
              </span>
            </div>

          </div>

        </div>

      </div>

      {/* MÓDULO DE INTEGRACIÓN DE ARCHIVOS DROPI: EJECUTAR Y ANALIZAR ENTREGADOS */}
      <div className="bg-[#090909] border-2 border-emerald-500/30 hover:border-emerald-500/50 transition-all rounded-2xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Glow Ambient Effects */}
        <div className="absolute top-0 right-10 w-96 h-28 bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-96 h-28 bg-amber-500/10 blur-3xl pointer-events-none" />

        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-5 relative z-10">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-[#00df9a] text-black flex items-center justify-center font-black shrink-0 shadow-lg shadow-emerald-500/20">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <PackageCheck size={11} />
                  Archivos Dropi Ejecutados
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  🇵🇪 Soles ⇄ 🇬🇹 Quetzales en Vivo
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {selectedDropiStats.totalOrders} pedidos analizados
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-black tracking-tight text-white flex items-center gap-2">
                LIQUIDACIÓN DROPI: <span className="text-[#00df9a]">¿CUÁNTO SALIÓ CON LOS ENTREGADOS?</span>
              </h3>
              <p className="text-[12px] text-slate-400 mt-1 max-w-3xl leading-relaxed">
                Jala tus reportes de pedidos ejecutados en Dropi para ver con precisión matemática la facturación cobrada, la ganancia neta real conseguida y la dinámica de entregas vs devoluciones por día.
              </p>
            </div>
          </div>

          {/* Quick Currency Toggles */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => convertEntireCalculator('PEN')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer border shadow-sm active:scale-95 ${
                currency === 'PEN'
                  ? 'bg-amber-500 text-black border-amber-500 shadow-amber-500/20'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}
              title="Ver liquidación en Soles"
            >
              <span>🇵🇪 En Soles</span>
            </button>
            <button
              type="button"
              onClick={() => convertEntireCalculator('GTQ')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer border shadow-sm active:scale-95 ${
                currency === 'GTQ'
                  ? 'bg-[#00df9a] text-black border-[#00df9a] shadow-[#00df9a]/20'
                  : 'bg-[#00df9a]/10 hover:bg-[#00df9a]/20 text-[#00df9a] border-[#00df9a]/30'
              }`}
              title="Ver liquidación en Quetzales"
            >
              <span>🇬🇹 En Quetzales</span>
            </button>
          </div>
        </div>

        {/* File Selector & Upload Controls & SACAR CON DATOS DE CALCULADORA */}
        <div className="bg-[#111] border-2 border-white/10 hover:border-emerald-500/30 rounded-2xl p-5 flex flex-col gap-4 relative z-10 transition-all shadow-xl">
          {/* Top Row: File Selector & Upload & Refresh */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <Layers size={15} className="text-[#00df9a]" />
                Seleccionar Archivo Dropi:
              </label>
              <div className="relative flex-1">
                <select
                  value={selectedDropiBatchId}
                  onChange={(e) => setSelectedDropiBatchId(e.target.value)}
                  className="w-full bg-[#181818] border-2 border-emerald-500/40 focus:border-emerald-500 rounded-xl py-2 px-3 text-xs sm:text-sm font-mono font-bold text-white focus:outline-none transition-all cursor-pointer shadow-inner"
                >
                  <option value="all">📦 Todos los Pedidos Dropi ({orders?.length || 0} pedidos acumulados)</option>
                  {dropiFiles.map((file) => (
                    <option key={file.id} value={file.id}>
                      📄 {file.fileName} — {file.orderCount} pedidos ({file.uploadDate || file.uploadDateOnly})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Upload Button */}
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="file"
                ref={dropiFileInputRef}
                onChange={handleDropiFileUpload}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => dropiFileInputRef.current?.click()}
                disabled={isUploadingDropiFile}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 text-white border border-white/15 hover:border-emerald-500/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Upload size={14} className="text-emerald-400" />
                <span>{isUploadingDropiFile ? 'Procesando...' : 'Subir Archivo Dropi'}</span>
              </button>
            </div>
          </div>

          {/* DEDICATED SECTION: SACAR CON LOS DATOS DE CALCULADORA */}
          <div className="pt-4 border-t border-white/10 flex flex-col gap-3.5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CalcIcon size={15} />
                  Modo de Liquidación: ¿Cómo quieres calcular este lote?
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Alterna entre los valores históricos del Excel o calcula automáticamente la liquidación usando tus precios y costos de la calculadora.
                </p>
              </div>

              {/* Segmented Switcher */}
              <div className="flex items-center gap-2 bg-[#161616] p-1.5 rounded-xl border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setDropiCalculationSource('dropi')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    dropiCalculationSource === 'dropi'
                      ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-extrabold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet size={13} />
                  <span>1. Datos Reales Dropi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDropiCalculationSource('calculator')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                    dropiCalculationSource === 'calculator'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-lg shadow-amber-500/25 font-extrabold ring-2 ring-amber-400/50'
                      : 'text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30'
                  }`}
                  title="Calcular este archivo Dropi con el precio de venta, costos y utilidad configurados arriba en la calculadora"
                >
                  <Zap size={13} className={dropiCalculationSource === 'calculator' ? 'fill-black' : 'fill-amber-400 text-amber-400'} />
                  <span>2. Sacar con Datos de Calculadora</span>
                </button>
              </div>
            </div>

            {/* CONDITIONAL BANNER & COMPARISON: SACAR CON DATOS DE CALCULADORA ACTIVE */}
            {dropiCalculationSource === 'calculator' ? (
              <div className="bg-gradient-to-r from-amber-500/10 via-[#181818] to-emerald-500/10 border-2 border-amber-500/40 rounded-xl p-4 space-y-3.5 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                    <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                      ⚡ Liquidación Calculada con Parámetros de Tu Calculadora COD
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-300 bg-black/50 px-2.5 py-0.5 rounded-lg border border-white/10">
                    Producto: <span className="text-white underline">{inputs.name || 'Producto Actual'}</span>
                  </span>
                </div>

                {/* Values Taken from Calculator */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs font-mono">
                  <div className="bg-black/50 p-2.5 rounded-lg border border-white/5 space-y-0.5">
                    <span className="text-[10px] uppercase text-slate-400 font-sans block">Precio Venta (PV)</span>
                    <span className="text-sm font-bold text-[#00df9a]">{formatValue(computed.precioVenta)}</span>
                  </div>
                  <div className="bg-black/50 p-2.5 rounded-lg border border-white/5 space-y-0.5">
                    <span className="text-[10px] uppercase text-slate-400 font-sans block">Costo Proveedor</span>
                    <span className="text-sm font-bold text-slate-200">{formatValue(computed.costoProducto)}</span>
                  </div>
                  <div className="bg-black/50 p-2.5 rounded-lg border border-white/5 space-y-0.5">
                    <span className="text-[10px] uppercase text-slate-400 font-sans block">Flete Real COD</span>
                    <span className="text-sm font-bold text-slate-200">{formatValue(computed.fleteReal)}</span>
                  </div>
                  <div className="bg-black/50 p-2.5 rounded-lg border border-white/5 space-y-0.5">
                    <span className="text-[10px] uppercase text-slate-400 font-sans block">CPA Publicidad</span>
                    <span className="text-sm font-bold text-slate-200">{formatValue(computed.cpaReal)}</span>
                  </div>
                  <div className="bg-amber-500/15 p-2.5 rounded-lg border border-amber-500/30 space-y-0.5">
                    <span className="text-[10px] uppercase text-amber-300 font-sans font-bold block">Utilidad / Entrega</span>
                    <span className="text-sm font-bold text-amber-300">{formatValue(computed.utilidadValor)}</span>
                  </div>
                </div>

                {/* Comparative Box: Dropi vs Calculadora */}
                <div className="bg-black/70 border border-white/10 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                      📊 Comparación para {selectedDropiStats.deliveredCount} pedidos entregados:
                    </span>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
                      <div>
                        <span className="text-slate-500">Facturación Dropi: </span>
                        <span className="text-slate-300 line-through">{formatValue(selectedDropiStats.totalRevenue)}</span>
                        <span className="text-slate-500"> ➔ Con Calculadora: </span>
                        <strong className="text-[#00df9a]">{formatValue(activeDropiMetrics.calculatorRevenue)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Ganancia Dropi: </span>
                        <span className="text-slate-300 line-through">{formatValue(selectedDropiStats.realNetProfit)}</span>
                        <span className="text-slate-500"> ➔ Con Calculadora: </span>
                        <strong className="text-amber-300">{formatValue(activeDropiMetrics.calculatorNetProfit)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-3 py-1.5 rounded-xl font-mono text-xs font-black border ${
                      activeDropiMetrics.profitDifference >= 0
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border-red-500/40'
                    }`}>
                      Diferencia: {activeDropiMetrics.profitDifference >= 0 ? '+' : ''}{formatValue(activeDropiMetrics.profitDifference)}
                    </span>
                  </div>
                </div>

                {/* Quick Actions Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleLoadDropiStatsIntoCalculator}
                    className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    title="Carga el costo, flete y CPA de este lote a los campos de la calculadora"
                  >
                    <Download size={13} className="text-emerald-400" />
                    <span>Jalar costos de este archivo a los campos de la calculadora</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteDropiInSimulator}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    title="Llevar estos pedidos a proyectar en el Simulador de Metas (Modo B)"
                  >
                    <Play size={13} className="text-emerald-400" />
                    <span>Simular en Proyección de Ventas (Modo B)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDropiCalculationSource('dropi')}
                    className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-300 text-xs transition-colors ml-auto underline cursor-pointer"
                  >
                    Volver a datos históricos de Dropi
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-slate-500">ℹ️</span>
                  <span>
                    Estás viendo la liquidación histórica según los precios registrados en el archivo Dropi. 
                    ¿Deseas saber cuánto saldría con tu Precio de Venta y Margen de la calculadora?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDropiCalculationSource('calculator')}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-500/10 hover:from-amber-500/30 hover:to-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm active:scale-95"
                >
                  <Zap size={13} className="fill-amber-400 text-amber-400" />
                  <span>Sacar con Datos de Calculadora</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 4 HERO KPI CARDS: ¿CUÁNTO SALIÓ CON LOS ENTREGADOS? */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          
          {/* KPI 1: Pedidos Entregados & Efectividad */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-emerald-500/10 to-[#111] border-2 border-emerald-500/30 space-y-2 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                <PackageCheck size={13} />
                PEDIDOS ENTREGADOS
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-black">
                {selectedDropiStats.deliveryRate}% ÉXITO
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-black text-white tracking-tight">
                {selectedDropiStats.deliveredCount}
              </span>
              <span className="text-xs font-bold text-slate-400">
                / {selectedDropiStats.totalOrders} pedidos
              </span>
            </div>

            {/* Visual Delivery / Return Bar */}
            <div className="space-y-1 pt-1">
              <div className="h-2 w-full rounded-full bg-black/60 border border-white/10 overflow-hidden flex">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${selectedDropiStats.deliveryRate}%` }}
                  title={`Entregados: ${selectedDropiStats.deliveryRate}%`}
                />
                <div 
                  className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${selectedDropiStats.returnRate}%` }}
                  title={`Devueltos: ${selectedDropiStats.returnRate}%`}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-0.5">
                <span className="text-emerald-400 font-bold">🟢 {selectedDropiStats.deliveredCount} entregados</span>
                <span className="text-red-400 font-bold">🔴 {selectedDropiStats.returnedCount} devueltos</span>
              </div>
            </div>
          </div>

          {/* KPI 2: Facturación Total Cobrada (GMV Real) */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-blue-500/10 to-[#111] border-2 border-blue-500/30 space-y-2 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider flex items-center gap-1">
                <DollarSign size={13} />
                FACTURACIÓN COBRADA
              </span>
              <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-black ${
                dropiCalculationSource === 'calculator' 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                  : 'bg-blue-500/20 text-blue-300'
              }`}>
                {dropiCalculationSource === 'calculator' ? 'CALCULADORA' : 'TOTAL ENTREGADOS'}
              </span>
            </div>

            <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
              {formatValue(activeDropiMetrics.totalRevenue)}
            </div>

            {/* Live Soles ⇄ Quetzales conversion */}
            <div className="pt-2 border-t border-blue-500/20 text-[11px] font-mono">
              {currency === 'PEN' ? (
                <div className="text-amber-300 font-bold flex justify-between items-center">
                  <span>🇬🇹 En Quetzales:</span>
                  <span>Q {(activeDropiMetrics.totalRevenue * ratePENtoGTQ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ) : currency === 'GTQ' ? (
                <div className="text-amber-300 font-bold flex justify-between items-center">
                  <span>🇵🇪 En Soles:</span>
                  <span>S/ {(activeDropiMetrics.totalRevenue * rateGTQtoPEN).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ) : (
                <div className="text-slate-300 text-[10px] space-y-0.5">
                  <div>🇵🇪 {formatSolesAndQuetzales(activeDropiMetrics.totalRevenue).soles}</div>
                  <div>🇬🇹 {formatSolesAndQuetzales(activeDropiMetrics.totalRevenue).quetzales}</div>
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-400">
              {dropiCalculationSource === 'calculator' 
                ? `Cobro estimado con tu Precio de Venta recomendado (${formatValue(computed.precioVenta)})`
                : 'Monto total recaudado en efectivo contra entrega por transportadora.'}
            </p>
          </div>

          {/* KPI 3: Ganancia Neta Limpia Real (Profit) */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-[#00df9a]/20 via-[#111] to-[#111] border-2 border-[#00df9a]/50 space-y-2 relative overflow-hidden shadow-xl shadow-[#00df9a]/5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-[#00df9a] tracking-wider flex items-center gap-1">
                <TrendingUp size={13} />
                GANANCIA NETA REAL
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#00df9a]/20 text-[#00df9a] font-mono text-[10px] font-black">
                {activeDropiMetrics.marginOnDelivered.toFixed(1)}% MARGEN
              </span>
            </div>

            <div className="text-2xl sm:text-3xl font-display font-black text-[#00df9a] tracking-tight">
              {formatValue(activeDropiMetrics.realNetProfit)}
            </div>

            {/* Live Soles ⇄ Quetzales conversion */}
            <div className="pt-2 border-t border-[#00df9a]/20 text-[11px] font-mono">
              {currency === 'PEN' ? (
                <div className="text-amber-300 font-bold flex justify-between items-center bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <span>🇬🇹 En Quetzales:</span>
                  <span>Q {(activeDropiMetrics.realNetProfit * ratePENtoGTQ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ) : currency === 'GTQ' ? (
                <div className="text-amber-300 font-bold flex justify-between items-center bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <span>🇵🇪 En Soles:</span>
                  <span>S/ {(activeDropiMetrics.realNetProfit * rateGTQtoPEN).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ) : (
                <div className="text-slate-300 text-[10px] space-y-0.5">
                  <div>🇵🇪 {formatSolesAndQuetzales(activeDropiMetrics.realNetProfit).soles}</div>
                  <div>🇬🇹 {formatSolesAndQuetzales(activeDropiMetrics.realNetProfit).quetzales}</div>
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-400">
              {dropiCalculationSource === 'calculator'
                ? `Ganancia neta libre basada en tu utilidad unitaria de calculadora (${formatValue(computed.utilidadValor)})`
                : 'Ganancia líquida libre descontando costo producto, fletes, devoluciones y CPA.'}
            </p>
          </div>

          {/* KPI 4: Ganancia Neta por Cada Entrega */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-purple-500/10 to-[#111] border-2 border-purple-500/30 space-y-2 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider flex items-center gap-1">
                <Coins size={13} />
                UTILIDAD POR ENTREGA
              </span>
              <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-black ${
                dropiCalculationSource === 'calculator'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-purple-500/20 text-purple-300'
              }`}>
                {dropiCalculationSource === 'calculator' ? 'CALCULADORA' : 'UNITARIO LIBRE'}
              </span>
            </div>

            <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
              {formatValue(activeDropiMetrics.avgProfitPerDelivered)}
            </div>

            {/* Live Soles ⇄ Quetzales conversion */}
            <div className="pt-2 border-t border-purple-500/20 text-[11px] font-mono">
              {currency === 'PEN' ? (
                <div className="text-amber-300 font-bold flex justify-between items-center">
                  <span>🇬🇹 En Quetzales:</span>
                  <span>Q {(activeDropiMetrics.avgProfitPerDelivered * ratePENtoGTQ).toFixed(2)} / ent.</span>
                </div>
              ) : currency === 'GTQ' ? (
                <div className="text-amber-300 font-bold flex justify-between items-center">
                  <span>🇵🇪 En Soles:</span>
                  <span>S/ {(activeDropiMetrics.avgProfitPerDelivered * rateGTQtoPEN).toFixed(2)} / ent.</span>
                </div>
              ) : (
                <div className="text-slate-300 text-[10px] space-y-0.5">
                  <div>🇵🇪 {formatSolesAndQuetzales(activeDropiMetrics.avgProfitPerDelivered).soles} / ent.</div>
                  <div>🇬🇹 {formatSolesAndQuetzales(activeDropiMetrics.avgProfitPerDelivered).quetzales} / ent.</div>
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-400">
              {dropiCalculationSource === 'calculator'
                ? `Utilidad fijada en la calculadora con tu margen del ${computed.margenPercent.toFixed(1)}%`
                : 'Dinero que ingresó a tu bolsillo por cada paquete entregado exitosamente.'}
            </p>
          </div>

        </div>

        {/* SUBPANEL: DINÁMICA DIARIA DEL ARCHIVO DROPI (CUÁNTO SE ENTREGA Y SE DEVUELVE POR DÍA) */}
        <div className="bg-black/50 border border-white/10 rounded-xl p-5 space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>RITMO DIARIO DEL ARCHIVO: ¿CUÁNTO SE ENTREGA Y SE DEVUELVE POR DÍA?</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                  {selectedDropiStats.daysCount} días analizados
                </span>
                {dropiCalculationSource === 'calculator' && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    ⚡ Con Datos Calculadora
                  </span>
                )}
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Desglose operativo promedio por día con conversiones en vivo en Soles peruanos y Quetzales guatemaltecos.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                🟢 ~{selectedDropiStats.dailyDelivered} entregas / día
              </span>
              <span className="text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">
                🔴 ~{selectedDropiStats.dailyReturned} devueltos / día
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. SE ENTREGA POR DÍA EN ESTE ARCHIVO */}
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  SE ENTREGA POR DÍA EN ESTE LOTE
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-black">
                  EFECTIVIDAD {selectedDropiStats.deliveryRate}%
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-display font-black text-white">
                  ~{selectedDropiStats.dailyDelivered}
                </span>
                <span className="text-xs font-bold text-emerald-400 uppercase">pedidos entregados / día</span>
              </div>

              <div className="space-y-1.5 text-xs font-mono pt-1">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Facturación cobrada diaria:</span>
                  <strong className="text-emerald-400 font-bold">{formatValue(activeDropiMetrics.dailyDeliveredRevenue)} / día</strong>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Ganancia neta diaria real:</span>
                  <strong className="text-[#00df9a] font-bold">{formatValue(activeDropiMetrics.dailyNetProfit)} / día</strong>
                </div>

                {/* Live currency conversion for daily delivered metrics */}
                <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-amber-300">
                  <span>Equivalente en vivo:</span>
                  {currency === 'PEN' ? (
                    <span className="font-bold">🇬🇹 Q {(activeDropiMetrics.dailyDeliveredRevenue * ratePENtoGTQ).toFixed(2)} fact. | Q {(activeDropiMetrics.dailyNetProfit * ratePENtoGTQ).toFixed(2)} ganancia / día</span>
                  ) : currency === 'GTQ' ? (
                    <span className="font-bold">🇵🇪 S/ {(activeDropiMetrics.dailyDeliveredRevenue * rateGTQtoPEN).toFixed(2)} fact. | S/ {(activeDropiMetrics.dailyNetProfit * rateGTQtoPEN).toFixed(2)} ganancia / día</span>
                  ) : (
                    <span>🇵🇪 {formatSolesAndQuetzales(activeDropiMetrics.dailyDeliveredRevenue).soles} | 🇬🇹 {formatSolesAndQuetzales(activeDropiMetrics.dailyDeliveredRevenue).quetzales}</span>
                  )}
                </div>
              </div>
            </div>

            {/* 2. SE DEVUELVE POR DÍA EN ESTE ARCHIVO */}
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-red-400 tracking-wider flex items-center gap-1.5">
                  <RotateCcw size={14} />
                  SE DEVUELVE POR DÍA EN ESTE LOTE
                </span>
                <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 font-mono text-[10px] font-black">
                  TASA {selectedDropiStats.returnRate}%
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-display font-black text-white">
                  ~{selectedDropiStats.dailyReturned}
                </span>
                <span className="text-xs font-bold text-red-400 uppercase">pedidos devueltos / día</span>
              </div>

              <div className="space-y-1.5 text-xs font-mono pt-1">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Costo flete perdido por día:</span>
                  <strong className="text-red-400 font-bold">{formatValue(selectedDropiStats.dailyReturnLoss)} / día</strong>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Pérdida acumulada en fletes devueltos:</span>
                  <strong className="text-red-400 font-bold">{formatValue(selectedDropiStats.returnedShippingLoss)}</strong>
                </div>

                {/* Live currency conversion for daily return metrics */}
                <div className="pt-2 border-t border-red-500/20 flex items-center justify-between text-[11px] text-amber-300">
                  <span>Equivalente en vivo:</span>
                  {currency === 'PEN' ? (
                    <span className="font-bold">🇬🇹 Q {(selectedDropiStats.dailyReturnLoss * ratePENtoGTQ).toFixed(2)} flete devuelto / día</span>
                  ) : currency === 'GTQ' ? (
                    <span className="font-bold">🇵🇪 S/ {(selectedDropiStats.dailyReturnLoss * rateGTQtoPEN).toFixed(2)} flete devuelto / día</span>
                  ) : (
                    <span>🇵🇪 {formatSolesAndQuetzales(selectedDropiStats.dailyReturnLoss).soles} | 🇬🇹 {formatSolesAndQuetzales(selectedDropiStats.dailyReturnLoss).quetzales}</span>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ACTION BUTTONS: CARGAR A LA CALCULADORA & EJECUTAR EN SIMULADOR */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 relative z-10">
          <div className="text-xs text-slate-400">
            Producto detectado: <strong className="text-white">{selectedDropiStats.topProduct}</strong> | Costo prom: <strong className="text-white">{formatValue(selectedDropiStats.avgCost)}</strong> | Flete prom: <strong className="text-white">{formatValue(selectedDropiStats.avgShipping)}</strong>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleLoadDropiStatsIntoCalculator}
              className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all flex items-center gap-2 cursor-pointer shadow-md active:scale-95"
            >
              <Zap size={14} className="text-amber-400" />
              <span>Cargar Costos a la Calculadora</span>
            </button>

            <button
              type="button"
              onClick={handleExecuteDropiInSimulator}
              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-[#00df9a] hover:from-emerald-400 hover:to-[#00df9a] text-black font-black transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <Play size={14} className="fill-black" />
              <span>Ejecutar Simulación con estos Entregados</span>
            </button>
          </div>
        </div>

      </div>

      {/* SECCIÓN MEJORADA: SIMULADOR DE META DE GANANCIAS (¿Cuántas ventas necesitas para ganar tanto?) */}
      <div id="seccion-ventas-por-pedidos" className="bg-[#090909] border border-white/5 hover:border-white/10 transition-all rounded-2xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-1/4 w-96 h-28 bg-gradient-to-b from-[#ff5500]/10 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-1/4 w-96 h-28 bg-gradient-to-b from-[#00df9a]/10 to-transparent blur-3xl pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-[#ff5500] to-[#ff7700] text-white shadow-md shadow-[#ff5500]/20 flex items-center gap-1">
                <Target size={11} />
                Planificador de Metas
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                INVERSE REVENUE CALCULATOR
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-display font-black tracking-tight text-white flex items-center gap-2">
              ¿CUÁNTAS VENTAS NECESITAS PARA <span className="text-[#00df9a]">GANAR TU META</span>?
            </h3>
            <p className="text-[12px] text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Ingresa la ganancia neta libre que deseas alcanzar y el sistema calculará exactamente cuántos pedidos debes despachar y entregar considerando tu efectividad real de entrega y costos operativos.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-[#111] p-1 rounded-xl border border-white/5 shrink-0 self-start lg:self-center">
            <button
              type="button"
              onClick={() => setSimulationMode('targetToSales')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                simulationMode === 'targetToSales'
                  ? 'bg-gradient-to-r from-[#ff5500] to-[#ff7700] text-white shadow-md shadow-[#ff5500]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Target size={13} />
              <span>Quiero ganar $X</span>
            </button>
            <button
              type="button"
              onClick={() => setSimulationMode('salesToProfit')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                simulationMode === 'salesToProfit'
                  ? 'bg-gradient-to-r from-[#00df9a] to-[#00c589] text-black shadow-md shadow-[#00df9a]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShoppingBag size={13} />
              <span>Si vendo N pedidos</span>
            </button>
          </div>
        </div>

        {/* Viability Warning if profit per delivered order is negative or zero */}
        {!targetSimulation.isViable && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-sm text-red-200">Margen de ganancia unitario no viable ({formatValue(computed.utilidadAbsoluta)})</p>
              <p className="mt-1 text-slate-300 leading-relaxed">
                Actualmente tus costos totales son mayores o iguales al precio de venta configurado. Para poder simular tu meta de ganancias, incrementa el margen deseado en la calculadora o reduce los costos de proveedor, flete o CPA en los campos superiores.
              </p>
            </div>
          </div>
        )}

        {/* MODE A: TARGET TO SALES (Quiero ganar $X -> ¿Cuántas ventas necesito?) */}
        {simulationMode === 'targetToSales' && (
          <div className="space-y-6 relative z-10">
            {/* Input Controls: Target Amount & Time Period */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
              {/* Target Profit Input */}
              <div className="lg:col-span-7 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Coins size={14} className="text-[#00df9a]" />
                    ¿Cuánto dinero quieres ganar limpio? (Meta Neta)
                  </label>
                  <span className="text-[10px] font-mono font-bold text-[#00df9a]">
                    Moneda activa: {currency}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00df9a] font-mono text-lg font-black">
                    {CURRENCIES[currency]?.symbol || '$'}
                  </span>
                  <input
                    type="number"
                    value={targetProfitInput}
                    onChange={(e) => setTargetProfitInput(e.target.value)}
                    placeholder="5000000"
                    className="w-full bg-[#111] border-2 border-[#00df9a]/40 focus:border-[#00df9a] rounded-xl py-3 pl-10 pr-4 text-xl sm:text-2xl font-mono font-black text-white focus:outline-none transition-all shadow-inner"
                  />
                </div>

                {/* Live currency conversion tag under input */}
                <div className="flex items-center justify-between text-[11px] font-mono pt-0.5">
                  <div className="flex items-center gap-1.5 text-slate-400 flex-wrap">
                    <ArrowLeftRight size={12} className="text-amber-400 shrink-0" />
                    <span>Equivalente en vivo:</span>
                    {currency === 'PEN' ? (
                      <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        🇬🇹 Q {((parseFloat(targetProfitInput) || 0) * ratePENtoGTQ).toLocaleString(undefined, { maximumFractionDigits: 0 })} Quetzales
                      </span>
                    ) : currency === 'GTQ' ? (
                      <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        🇵🇪 S/ {((parseFloat(targetProfitInput) || 0) * rateGTQtoPEN).toLocaleString(undefined, { maximumFractionDigits: 0 })} Soles
                      </span>
                    ) : (
                      <span className="text-slate-300 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                        🇵🇪 {formatSolesAndQuetzales(parseFloat(targetProfitInput) || 0).soles} | 🇬🇹 {formatSolesAndQuetzales(parseFloat(targetProfitInput) || 0).quetzales}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Presets Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                    Metas rápidas:
                  </span>
                  {getPresetsForCurrency(currency).map((preset) => {
                    const isActive = targetProfitInput === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setTargetProfitInput(preset.value)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer border ${
                          isActive
                            ? 'bg-[#00df9a] text-black border-[#00df9a] shadow-sm shadow-[#00df9a]/30'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 hover:border-white/20'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Period Selector */}
              <div className="lg:col-span-5 space-y-2">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={14} className="text-[#ff5500]" />
                  Plazo para lograr esta meta
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'monthly', label: 'Mensual', days: '30 días' },
                    { id: 'biweekly', label: 'Quincenal', days: '15 días' },
                    { id: 'weekly', label: 'Semanal', days: '7 días' },
                    { id: 'daily', label: 'Diario', days: '1 día' }
                  ].map((p) => {
                    const isSelected = targetPeriod === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setTargetPeriod(p.id as any)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-[#ff5500]/15 border-[#ff5500] text-white shadow-md shadow-[#ff5500]/10'
                            : 'bg-[#111] border-white/5 hover:border-white/15 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="text-xs font-black uppercase tracking-wider">{p.label}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5">{p.days}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* HERO KPI CARDS: Pedidos necesarios & Dinámica Comercial */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              
              {/* KPI 1: Pedidos a Despachar Totales */}
              <div className="bg-gradient-to-b from-[#ff5500]/15 via-[#111] to-[#111] border-2 border-[#ff5500]/40 rounded-2xl p-5 relative overflow-hidden shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#ff5500] flex items-center gap-1">
                    <Flame size={12} fill="currentColor" />
                    DESPACHOS TOTALES
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#ff5500]/20 text-[#ff5500] text-[10px] font-black font-mono">
                    {targetPeriod === 'monthly' ? '30 días' : targetPeriod === 'biweekly' ? '15 días' : targetPeriod === 'weekly' ? '7 días' : '1 día'}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="text-3xl sm:text-4xl font-display font-black text-white tracking-tight flex items-baseline gap-1.5">
                    <span>{targetSimulation.dispatchedNeeded.toLocaleString()}</span>
                    <span className="text-sm font-bold text-slate-400">pedidos</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#ff5500] text-black text-xs font-black tracking-wider uppercase flex items-center gap-1 shadow-sm">
                      <Zap size={12} fill="currentColor" />
                      {targetSimulation.dispatchedPerDay} al día
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-white/5 leading-relaxed">
                  Volumen total a generar en campañas para compensar cancelaciones y devoluciones.
                </p>
              </div>

              {/* KPI 2: Pedidos Entregados Reales */}
              <div className="bg-gradient-to-b from-[#00df9a]/15 via-[#111] to-[#111] border-2 border-[#00df9a]/40 rounded-2xl p-5 relative overflow-hidden shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#00df9a] flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    ENTREGAS EFECTIVAS
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#00df9a]/20 text-[#00df9a] text-[10px] font-black font-mono">
                    Tasa: {inputs.finalDeliveryPercent}%
                  </span>
                </div>

                <div className="mt-3">
                  <div className="text-3xl sm:text-4xl font-display font-black text-[#00df9a] tracking-tight flex items-baseline gap-1.5">
                    <span>{targetSimulation.deliveredNeeded.toLocaleString()}</span>
                    <span className="text-sm font-bold text-slate-400">entregados</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="px-2 py-0.5 rounded-lg bg-[#00df9a]/20 border border-[#00df9a]/40 text-[#00df9a] text-[11px] font-black tracking-wider uppercase flex items-center gap-1">
                      <Check size={11} />
                      {targetSimulation.deliveredPerDay} entregados / día
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-[11px] font-black tracking-wider uppercase flex items-center gap-1">
                      <RotateCcw size={11} />
                      {targetSimulation.returnedPerDay} devueltos / día
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-white/5 leading-relaxed">
                  Pedidos pagados que generan los <strong className="text-white">{formatValue(targetSimulation.profitPerUnit)}</strong> de ganancia unitaria neta.
                </p>
              </div>

              {/* KPI 3: Ganancia Neta Asegurada */}
              <div className="bg-[#111] border border-white/10 rounded-2xl p-5 relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                    <DollarSign size={12} />
                    GANANCIA NETA LIBRE
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    100% UTILIDAD
                  </span>
                </div>

                <div className="mt-3">
                  <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
                    {formatValue(targetSimulation.targetAmount)}
                  </div>
                  <p className="text-[11px] text-[#00df9a] font-bold mt-1.5 flex items-center gap-1">
                    <span>Utilidad por pedido:</span>
                    <span className="font-mono font-black">{formatValue(targetSimulation.profitPerUnit)}</span>
                  </p>
                </div>

                <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-white/5 leading-relaxed">
                  Dinero limpio directo a tu cuenta bancaria después de pagar proveedor, fletes, devoluciones y publicidad.
                </p>
              </div>

              {/* KPI 4: Facturación Bruta Requerida (GMV) */}
              <div className="bg-[#111] border border-white/10 rounded-2xl p-5 relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                    <BarChart3 size={12} />
                    FACTURACIÓN BRUTA
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    PV: {formatValue(computed.precioVenta)}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
                    {formatValue(targetSimulation.totalRevenue)}
                  </div>
                  <p className="text-[11px] text-slate-400 font-bold mt-1.5">
                    Volumen bruto transaccionado en la tienda
                  </p>
                </div>

                <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-white/5 leading-relaxed">
                  Total de ventas que pasarán por tu pasarela / transportadora durante el período.
                </p>
              </div>

            </div>

            {/* PLAN DE ACCIÓN FINANCIERO: Presupuestos e Inversión Requerida */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#ff5500]/15 text-[#ff5500] flex items-center justify-center font-black">
                    💼
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">
                      Presupuesto de Operación e Inversión Requerida
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Capital de trabajo necesario para ejecutar los {targetSimulation.dispatchedNeeded} pedidos y cumplir la meta
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">COSTO OPERATIVO TOTAL</span>
                  <span className="text-base font-mono font-black text-slate-200">
                    {formatValue(targetSimulation.adsBudgetTotal + targetSimulation.supplierCostTotal + targetSimulation.shippingCostTotal + targetSimulation.adminCostTotal)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {/* 1. Presupuesto Publicidad */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider flex items-center gap-1">
                    📢 Inversión en Ads (Meta/TikTok)
                  </span>
                  <div className="text-lg font-mono font-black text-white">
                    {formatValue(targetSimulation.adsBudgetTotal)}
                  </div>
                  <div className="text-[11px] text-blue-300 font-bold bg-blue-500/10 px-2 py-0.5 rounded-md inline-block">
                    {formatValue(targetSimulation.adsBudgetDaily)} / día
                  </div>
                  <p className="text-[10px] text-slate-500">CPA base: {formatValue(parseFloat(inputs.cpaAds) || 0)}</p>
                </div>

                {/* 2. Inversión en Mercancía / Proveedor */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1">
                    📦 Proveedor (Mercancía)
                  </span>
                  <div className="text-lg font-mono font-black text-white">
                    {formatValue(targetSimulation.supplierCostTotal)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Costo x pack: {formatValue(computed.proveedor)}
                  </div>
                  <p className="text-[10px] text-slate-500">Stock: {targetSimulation.dispatchedNeeded * (parseFloat(inputs.packUnits) || 1)} unidades</p>
                </div>

                {/* 3. Costo Fletes y Envíos */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider flex items-center gap-1">
                    🚚 Fletes y Devoluciones
                  </span>
                  <div className="text-lg font-mono font-black text-white">
                    {formatValue(targetSimulation.shippingCostTotal)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Flete base: {formatValue(parseFloat(inputs.shippingBase) || 0)}
                  </div>
                  <p className="text-[10px] text-slate-500">~{targetSimulation.estimatedReturns} devoluciones amortizadas</p>
                </div>

                {/* 4. Costos Administrativos y Fulfillment */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                    🏢 Admin & Fulfillment
                  </span>
                  <div className="text-lg font-mono font-black text-white">
                    {formatValue(targetSimulation.adminCostTotal)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {formatValue(parseFloat(inputs.adminCosts) || 0)} por despacho
                  </div>
                  <p className="text-[10px] text-slate-500">Plataformas, equipo y logística</p>
                </div>
              </div>
            </div>

            {/* TERMÓMETRO DE ESCALA: Nivel de exigencia operativa */}
            {(() => {
              const tier = getScaleTier(targetSimulation.dispatchedPerDay);
              return (
                <div className="bg-[#111] border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Nivel de Escala Requerido:
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase border ${tier.badgeColor}`}>
                        {tier.name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 max-w-xl">
                      {tier.desc}
                    </p>
                  </div>

                  <div className="w-full sm:w-64 space-y-1.5 shrink-0">
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                      <span>Ritmo diario</span>
                      <span className="text-white font-mono">{targetSimulation.dispatchedPerDay} despachos/día</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-black/60 border border-white/10 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 via-[#00df9a] to-[#ff5500] rounded-full transition-all duration-300"
                        style={{ width: `${tier.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {/* MODE B: SALES TO PROFIT (Si vendo N pedidos -> ¿Cuánto voy a ganar?) */}
        {simulationMode === 'salesToProfit' && (
          <div className="space-y-6 relative z-10">
            {/* Mode B Header Bar with One-Click Currency Converter & Dropi Selector */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-white/5 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-[#00df9a] tracking-widest flex items-center gap-1">
                  <TrendingUp size={12} />
                  PROYECCIÓN POR VOLUMEN DE VENTAS
                </span>
                <p className="text-xs text-slate-400">
                  Simula tus resultados según el ritmo diario o mensual de pedidos despachados.
                </p>
              </div>

              {/* Controls: Dropi Batch Selector + Currency Toggles */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Quick Dropi Batch Selector */}
                <div className="flex items-center gap-1.5 bg-[#111] border border-white/10 px-2.5 py-1 rounded-xl">
                  <FileSpreadsheet size={13} className="text-[#00df9a]" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Lote Dropi:</span>
                  <select
                    value={selectedDropiBatchId}
                    onChange={(e) => {
                      setSelectedDropiBatchId(e.target.value);
                      const matching = dropiFiles.find(f => f.id === e.target.value);
                      if (matching) {
                        setPlannedSalesInput(String(matching.orderCount));
                        setPlannedSalesUnit('month');
                      }
                    }}
                    className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none cursor-pointer max-w-[150px] sm:max-w-[190px] truncate"
                  >
                    <option value="all" className="bg-[#181818]">Todos los Pedidos Dropi</option>
                    {dropiFiles.map(f => (
                      <option key={f.id} value={f.id} className="bg-[#181818]">
                        {f.fileName} ({f.orderCount} ped.)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleLoadDropiStatsIntoCalculator}
                    className="text-[10px] font-black uppercase text-[#00df9a] hover:text-emerald-300 transition-colors flex items-center gap-0.5 cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30"
                    title="Cargar costos de este archivo a la simulación"
                  >
                    <Zap size={10} />
                    <span>Jalar</span>
                  </button>
                </div>

                {/* One-click Soles ⇄ Quetzales conversion buttons for Mode B */}
                <button
                  type="button"
                  onClick={() => convertEntireCalculator('PEN')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer border shadow-sm active:scale-95 ${
                    currency === 'PEN'
                      ? 'bg-amber-500 text-black border-amber-500 shadow-amber-500/20 ring-2 ring-amber-400/50'
                      : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                  title="Ver y calcular en Soles peruanos"
                >
                  <span>🇵🇪 Soles</span>
                </button>
                <button
                  type="button"
                  onClick={() => convertEntireCalculator('GTQ')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer border shadow-sm active:scale-95 ${
                    currency === 'GTQ'
                      ? 'bg-[#00df9a] text-black border-[#00df9a] shadow-[#00df9a]/20 ring-2 ring-[#00df9a]/50'
                      : 'bg-[#00df9a]/10 hover:bg-[#00df9a]/20 text-[#00df9a] border-[#00df9a]/30'
                  }`}
                  title="Ver y calcular en Quetzales guatemaltecos"
                >
                  <span>🇬🇹 Quetzales</span>
                </button>
              </div>
            </div>

            {/* Sales Volume Input */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
              <div className="md:col-span-7 space-y-2">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag size={14} className="text-[#00df9a]" />
                  ¿Cuántos pedidos planeas despachar?
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={plannedSalesInput}
                    onChange={(e) => setPlannedSalesInput(e.target.value)}
                    placeholder="15"
                    className="w-full bg-[#111] border-2 border-[#00df9a]/40 focus:border-[#00df9a] rounded-xl py-3 px-4 text-xl sm:text-2xl font-mono font-black text-white focus:outline-none transition-all shadow-inner"
                  />
                  <select
                    value={plannedSalesUnit}
                    onChange={(e) => setPlannedSalesUnit(e.target.value as any)}
                    className="bg-[#111] border-2 border-white/10 focus:border-[#00df9a] rounded-xl px-4 text-sm font-black text-white uppercase tracking-wider focus:outline-none cursor-pointer"
                  >
                    <option value="day">Pedidos / Día</option>
                    <option value="month">Pedidos / Mes</option>
                  </select>
                </div>

                {/* Preset suggestions */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                    Volúmenes comunes:
                  </span>
                  {[
                    { label: '5 al día', val: '5', unit: 'day' },
                    { label: '15 al día', val: '15', unit: 'day' },
                    { label: '30 al día', val: '30', unit: 'day' },
                    { label: '50 al día', val: '50', unit: 'day' },
                    { label: '100 al día', val: '100', unit: 'day' },
                    { label: '500 al mes', val: '500', unit: 'month' },
                    { label: '1,000 al mes', val: '1000', unit: 'month' }
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPlannedSalesInput(preset.val);
                        setPlannedSalesUnit(preset.unit as any);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-5 p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Efectividad de Entrega
                </span>
                <p className="text-sm font-black text-white">
                  {inputs.finalDeliveryPercent}% entrega final estimada
                </p>
                <p className="text-[11px] text-slate-500">
                  De {salesSimulation.monthlyDispatched} despachos al mes, se cobrarán ~{salesSimulation.monthlyDelivered} pedidos entregados.
                </p>
              </div>
            </div>

            {/* Results Grid for Mode B with Live Soles ⇄ Quetzales conversion */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Ganancia Mensual Proyectada */}
              <div className="bg-gradient-to-b from-[#00df9a]/15 via-[#111] to-[#111] border-2 border-[#00df9a]/40 rounded-2xl p-5 shadow-xl space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#00df9a] flex items-center gap-1">
                  <DollarSign size={13} />
                  GANANCIA NETA MENSUAL (30 DÍAS)
                </span>
                <div className="text-3xl sm:text-4xl font-display font-black text-[#00df9a] tracking-tight">
                  {formatValue(salesSimulation.monthlyProfit)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-[#00df9a]/20 border border-[#00df9a]/40 text-[#00df9a] text-xs font-black uppercase">
                    {formatValue(salesSimulation.dailyProfit)} / día
                  </span>
                </div>

                {/* Live currency conversion tag */}
                <div className="pt-2 border-t border-white/5 text-[11px] font-mono">
                  {currency === 'PEN' ? (
                    <div className="text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg flex items-center justify-between">
                      <span>🇬🇹 En Quetzales:</span>
                      <span>Q {(salesSimulation.monthlyProfit * ratePENtoGTQ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ) : currency === 'GTQ' ? (
                    <div className="text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg flex items-center justify-between">
                      <span>🇵🇪 En Soles:</span>
                      <span>S/ {(salesSimulation.monthlyProfit * rateGTQtoPEN).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ) : (
                    <div className="text-slate-300 text-[10px] space-y-0.5">
                      <div>🇵🇪 {formatSolesAndQuetzales(salesSimulation.monthlyProfit).soles} / mes</div>
                      <div>🇬🇹 {formatSolesAndQuetzales(salesSimulation.monthlyProfit).quetzales} / mes</div>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Utilidad neta calculada sobre los {salesSimulation.monthlyDelivered} pedidos efectivamente entregados.
                </p>
              </div>

              {/* Facturación Bruta (GMV) */}
              <div className="bg-[#111] border border-white/10 rounded-2xl p-5 shadow-lg space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                  <BarChart3 size={13} />
                  FACTURACIÓN MENSUAL BRUTA
                </span>
                <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
                  {formatValue(salesSimulation.monthlyRevenue)}
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  {salesSimulation.monthlyDispatched} pedidos despachados @ {formatValue(computed.precioVenta)}
                </p>

                {/* Live currency conversion tag */}
                <div className="pt-2 border-t border-white/5 text-[11px] font-mono">
                  {currency === 'PEN' ? (
                    <div className="text-slate-300 bg-white/5 border border-white/10 px-2 py-1 rounded-lg flex items-center justify-between">
                      <span>🇬🇹 En Quetzales:</span>
                      <span className="text-[#00df9a] font-bold">Q {(salesSimulation.monthlyRevenue * ratePENtoGTQ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ) : currency === 'GTQ' ? (
                    <div className="text-slate-300 bg-white/5 border border-white/10 px-2 py-1 rounded-lg flex items-center justify-between">
                      <span>🇵🇪 En Soles:</span>
                      <span className="text-amber-300 font-bold">S/ {(salesSimulation.monthlyRevenue * rateGTQtoPEN).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-[10px]">
                      🇵🇪 {formatSolesAndQuetzales(salesSimulation.monthlyRevenue).soles} | 🇬🇹 {formatSolesAndQuetzales(salesSimulation.monthlyRevenue).quetzales}
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-slate-500">
                  Ingreso total bruto que circulará por tu operación comercial en 30 días.
                </p>
              </div>

              {/* Presupuesto Publicitario Requerido */}
              <div className="bg-[#111] border border-white/10 rounded-2xl p-5 shadow-lg space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-1">
                  📢 PRESUPUESTO PUBLICIDAD (ADS)
                </span>
                <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
                  {formatValue(salesSimulation.monthlyAdsBudget)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-mono font-bold">
                    {formatValue(salesSimulation.dailyAdsBudget)} / día en Ads
                  </span>
                </div>

                {/* Live currency conversion tag */}
                <div className="pt-2 border-t border-white/5 text-[11px] font-mono">
                  {currency === 'PEN' ? (
                    <div className="text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg flex items-center justify-between">
                      <span>🇬🇹 En Quetzales:</span>
                      <span className="font-bold">Q {(salesSimulation.monthlyAdsBudget * ratePENtoGTQ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Q {(salesSimulation.dailyAdsBudget * ratePENtoGTQ).toFixed(1)}/d)</span>
                    </div>
                  ) : currency === 'GTQ' ? (
                    <div className="text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg flex items-center justify-between">
                      <span>🇵🇪 En Soles:</span>
                      <span className="font-bold">S/ {(salesSimulation.monthlyAdsBudget * rateGTQtoPEN).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (S/ {(salesSimulation.dailyAdsBudget * rateGTQtoPEN).toFixed(1)}/d)</span>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-[10px]">
                      🇵🇪 {formatSolesAndQuetzales(salesSimulation.monthlyAdsBudget).soles} | 🇬🇹 {formatSolesAndQuetzales(salesSimulation.monthlyAdsBudget).quetzales}
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-slate-500">
                  Presupuesto diario indispensable en Facebook o TikTok Ads para generar tu ritmo de ventas.
                </p>
              </div>

            </div>

            {/* SECCIÓN SOLICITADA: CUÁNTO SE ENTREGA Y SE DEVUELVE POR DÍA */}
            <div className="bg-gradient-to-r from-emerald-500/5 via-[#111] to-red-500/5 border-2 border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-red-500/20 border border-white/10 flex items-center justify-center text-white font-black">
                    📊
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <span>DINÁMICA DIARIA: ¿CUÁNTO SE ENTREGA Y SE DEVUELVE POR DÍA?</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-bold">
                        {salesSimulation.dailyDispatched} despachos / día
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Desglose operativo entre paquetes cobrados con éxito vs devoluciones que generan costo de flete.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                    🟢 {inputs.finalDeliveryPercent}% Entrega
                  </span>
                  <span className="text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">
                    🔴 {salesSimulation.returnRate}% Devolución
                  </span>
                </div>
              </div>

              {/* Cards Grid: Entregas Diarias vs Devoluciones Diarias */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. SE ENTREGA POR DÍA */}
                <div className="p-4 rounded-xl bg-emerald-500/5 border-2 border-emerald-500/30 space-y-3 relative overflow-hidden shadow-lg shadow-emerald-500/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 size={15} />
                      SE ENTREGA POR DÍA
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-black">
                      COBRADO AL CLIENTE
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-display font-black text-white tracking-tight">
                      ~{salesSimulation.dailyDelivered}
                    </span>
                    <span className="text-sm font-bold text-emerald-400 uppercase">pedidos entregados / día</span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono pt-1">
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Volumen en 30 días:</span>
                      <strong className="text-white font-bold">~{salesSimulation.monthlyDelivered} entregas</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Facturación diaria cobrada:</span>
                      <strong className="text-emerald-400 font-bold">{formatValue(salesSimulation.dailyDeliveredRevenue)} / día</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Ganancia neta limpia por día:</span>
                      <strong className="text-[#00df9a] font-bold">{formatValue(salesSimulation.dailyProfit)} / día</strong>
                    </div>

                    {/* Live conversion for daily delivered amount */}
                    <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-amber-300">
                      <span>Equivalente en vivo:</span>
                      {currency === 'PEN' ? (
                        <span className="font-bold">🇬🇹 Q {(salesSimulation.dailyDeliveredRevenue * ratePENtoGTQ).toFixed(2)} facturado / día</span>
                      ) : currency === 'GTQ' ? (
                        <span className="font-bold">🇵🇪 S/ {(salesSimulation.dailyDeliveredRevenue * rateGTQtoPEN).toFixed(2)} facturado / día</span>
                      ) : (
                        <span>🇵🇪 {formatSolesAndQuetzales(salesSimulation.dailyDeliveredRevenue).soles} | 🇬🇹 {formatSolesAndQuetzales(salesSimulation.dailyDeliveredRevenue).quetzales}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. SE DEVUELVE POR DÍA */}
                <div className="p-4 rounded-xl bg-red-500/5 border-2 border-red-500/30 space-y-3 relative overflow-hidden shadow-lg shadow-red-500/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-red-400 tracking-wider flex items-center gap-1.5">
                      <RotateCcw size={15} />
                      SE DEVUELVE POR DÍA
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 font-mono text-[10px] font-black">
                      LOGÍSTICA INVERSA
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-display font-black text-white tracking-tight">
                      ~{salesSimulation.dailyReturned}
                    </span>
                    <span className="text-sm font-bold text-red-400 uppercase">pedidos devueltos / día</span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono pt-1">
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Devoluciones en 30 días:</span>
                      <strong className="text-red-400 font-bold">~{salesSimulation.monthlyReturned} paquetes</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Costo flete perdido por día:</span>
                      <strong className="text-red-400 font-bold">{formatValue(salesSimulation.dailyReturnLoss)} / día</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Gasto mensual en devoluciones:</span>
                      <strong className="text-slate-200 font-bold">{formatValue(salesSimulation.monthlyReturnLoss)} / mes</strong>
                    </div>

                    {/* Live conversion for daily returned cost */}
                    <div className="pt-2 border-t border-red-500/20 flex items-center justify-between text-[11px] text-amber-300">
                      <span>Equivalente en vivo:</span>
                      {currency === 'PEN' ? (
                        <span className="font-bold">🇬🇹 Q {(salesSimulation.dailyReturnLoss * ratePENtoGTQ).toFixed(2)} flete devuelto / día</span>
                      ) : currency === 'GTQ' ? (
                        <span className="font-bold">🇵🇪 S/ {(salesSimulation.dailyReturnLoss * rateGTQtoPEN).toFixed(2)} flete devuelto / día</span>
                      ) : (
                        <span>🇵🇪 {formatSolesAndQuetzales(salesSimulation.dailyReturnLoss).soles} | 🇬🇹 {formatSolesAndQuetzales(salesSimulation.dailyReturnLoss).quetzales}</span>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Proportional Balance Bar */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Entregas: {salesSimulation.dailyDelivered} al día ({inputs.finalDeliveryPercent}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    Devoluciones: {salesSimulation.dailyReturned} al día ({salesSimulation.returnRate}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-black/60 border border-white/10 overflow-hidden flex">
                  <div 
                    className="h-full bg-[#00df9a] transition-all duration-300"
                    style={{ width: `${inputs.finalDeliveryPercent}%` }}
                    title={`Entregas: ${inputs.finalDeliveryPercent}%`}
                  />
                  <div 
                    className="h-full bg-red-500 transition-all duration-300"
                    style={{ width: `${salesSimulation.returnRate}%` }}
                    title={`Devoluciones: ${salesSimulation.returnRate}%`}
                  />
                </div>
                <p className="text-[10px] text-slate-500 pt-0.5">
                  💡 <strong>Nota del modelo:</strong> El flete y el CPA de los paquetes devueltos ya están costeados dentro de tu costo total, por lo que tu ganancia neta proyectada de {formatValue(salesSimulation.dailyProfit)} al día es 100% libre.
                </p>

                {/* Executive Daily Balance Summary */}
                <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                      ⚖️
                    </div>
                    <div>
                      <span className="text-white font-black block text-[11px] uppercase tracking-wider">
                        Balanza Diaria de Dinero (Entregas vs Devoluciones):
                      </span>
                      <p className="text-slate-400 text-[11px]">
                        Cobras <strong className="text-emerald-400">{formatValue(salesSimulation.dailyDeliveredRevenue)}/día</strong> (~{salesSimulation.dailyDelivered} pedidos) y pierdes <strong className="text-red-400">{formatValue(salesSimulation.dailyReturnLoss)}/día</strong> en fletes devueltos (~{salesSimulation.dailyReturned} pedidos).
                      </p>
                    </div>
                  </div>
                  <div className="sm:text-right shrink-0 bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">
                      Ganancia Neta en Bolsillo:
                    </span>
                    <span className="text-base font-black text-[#00df9a]">
                      +{formatValue(salesSimulation.dailyProfit)} / día
                    </span>
                    {currency === 'PEN' ? (
                      <span className="text-[10px] text-amber-300 block font-bold">
                        🇬🇹 +Q {(salesSimulation.dailyProfit * ratePENtoGTQ).toFixed(2)} / día
                      </span>
                    ) : currency === 'GTQ' ? (
                      <span className="text-[10px] text-amber-300 block font-bold">
                        🇵🇪 +S/ {(salesSimulation.dailyProfit * rateGTQtoPEN).toFixed(2)} / día
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
      <div className="bg-[#090909] border border-white/5 rounded-2xl p-6 space-y-6">
        <div>
          <h3 className="text-lg font-display font-black tracking-tight text-white uppercase">
            FÓRMULAS CLAVE <span className="text-[#ff5500]">DEL MODELO</span>
          </h3>
          <p className="text-[12px] text-slate-400 mt-1">
            Comprende los pilares matemáticos que sostienen el modelo de negocio COD.
          </p>
        </div>

        {/* Quick high level model badges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-white/5 pb-6">
          <div className="bg-[#111] border border-white/5 rounded-xl p-4 flex gap-4 items-start">
            <span className="bg-[#ff5500]/10 border border-[#ff5500]/20 text-[#ff5500] px-2 py-1 rounded font-black text-[12px]">PV</span>
            <div>
              <h4 className="text-[13px] font-black text-white">Precio de Venta</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Precio final facturado al cliente. Incluye todos los costos operativos más la utilidad neta deseada.
              </p>
            </div>
          </div>
          <div className="bg-[#111] border border-white/5 rounded-xl p-4 flex gap-4 items-start">
            <span className="bg-[#00df9a]/10 border border-[#00df9a]/20 text-[#00df9a] px-2 py-1 rounded font-black text-[12px]">CT</span>
            <div>
              <h4 className="text-[13px] font-black text-white">Costos Totales</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Suma total de egresos (Proveedor + Flete con devoluciones + CPA + Admin + Fulfillment) antes de margen.
              </p>
            </div>
          </div>
        </div>

        {/* Core Formula Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          
          {/* Card 1 */}
          <div className="bg-[#111] border border-white/5 hover:border-white/10 transition-all rounded-xl p-4 space-y-3">
            <h4 className="text-[12px] font-black text-white uppercase tracking-wider">Flete con devoluciones</h4>
            <div className="bg-black/50 border border-white/5 text-[#ff5500] py-2 px-3 rounded-lg text-center font-mono text-[12px] font-bold">
              Flete base / % entrega despacho
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Calcula el costo real de envío ponderando los despachos fallidos y devoluciones.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-[#111] border border-white/5 hover:border-white/10 transition-all rounded-xl p-4 space-y-3">
            <h4 className="text-[12px] font-black text-white uppercase tracking-wider">CPA costeado</h4>
            <div className="bg-black/50 border border-white/5 text-[#ff5500] py-2 px-3 rounded-lg text-center font-mono text-[12px] font-bold">
              CPA Ads Manager / % entrega final
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Ajusta tu costo por adquisición de publicidad sobre las órdenes entregadas reales.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-[#111] border border-white/5 hover:border-white/10 transition-all rounded-xl p-4 space-y-3">
            <h4 className="text-[12px] font-black text-white uppercase tracking-wider">Costos totales (CT)</h4>
            <div className="bg-black/50 border border-white/5 text-[#ff5500] py-2 px-3 rounded-lg text-center font-mono text-[11px] font-bold whitespace-normal break-all">
              Proveedor + Flete c/dev + Admin + Fulfillment + CPA costeado
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Representa la suma absoluta de egresos e inversiones antes de aplicar el margen.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-[#111] border border-white/5 hover:border-white/10 transition-all rounded-xl p-4 space-y-3">
            <h4 className="text-[12px] font-black text-white uppercase tracking-wider">Precio de venta (PV)</h4>
            <div className="bg-black/50 border border-white/5 text-[#ff5500] py-2 px-3 rounded-lg text-center font-mono text-[12px] font-bold">
              Costos totales / (1 - % utilidad)
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Determina el precio ideal de venta para asegurar tu porcentaje de margen neto.
            </p>
          </div>

          {/* Card 5 */}
          <div className="bg-[#111] border border-white/5 hover:border-white/10 transition-all rounded-xl p-4 space-y-3">
            <h4 className="text-[12px] font-black text-white uppercase tracking-wider">Utilidad ($)</h4>
            <div className="bg-black/50 border border-white/5 text-[#ff5500] py-2 px-3 rounded-lg text-center font-mono text-[12px] font-bold">
              Precio de venta - Costos totales
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Muestra la ganancia neta absoluta generada por cada venta o pack entregado.
            </p>
          </div>

          {/* Card 6 */}
          <div className="bg-[#111] border border-white/5 hover:border-white/10 transition-all rounded-xl p-4 space-y-3">
            <h4 className="text-[12px] font-black text-white uppercase tracking-wider">Precio comparación</h4>
            <div className="bg-black/50 border border-white/5 text-[#ff5500] py-2 px-3 rounded-lg text-center font-mono text-[12px] font-bold">
              Precio de venta * 2 (ancla 50% OFF)
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Establece un precio de referencia alto para detonar gatillos mentales de descuento.
            </p>
          </div>

          {/* Card 7 */}
          <div className="bg-[#111] border border-white/5 hover:border-white/10 transition-all rounded-xl p-4 space-y-3">
            <h4 className="text-[12px] font-black text-white uppercase tracking-wider">% sobre PV</h4>
            <div className="bg-black/50 border border-white/5 text-[#ff5500] py-2 px-3 rounded-lg text-center font-mono text-[12px] font-bold">
              (Valor del costo / Precio de venta) * 100
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Porcentaje que representa cada costo individual respecto al precio final de venta.
            </p>
          </div>

          {/* Card 8 */}
          <div className="bg-[#111] border border-white/5 hover:border-white/10 transition-all rounded-xl p-4 space-y-3">
            <h4 className="text-[12px] font-black text-white uppercase tracking-wider">% sobre CT</h4>
            <div className="bg-black/50 border border-white/5 text-[#ff5500] py-2 px-3 rounded-lg text-center font-mono text-[12px] font-bold">
              (Valor del costo / Costos totales) * 100
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Porcentaje que representa cada costo individual respecto al costo total acumulado.
            </p>
          </div>

        </div>

      </div>

      {/* HISTORIAL DE CALCULOS */}
      <div className="bg-[#090909] border border-white/5 rounded-2xl p-6 space-y-6 text-[15px]" style={{ fontSize: '15px' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-display font-black tracking-tight text-white uppercase">
              HISTORIAL DE CÁLCULOS
            </h3>
            <p className="text-[15px] text-slate-400 mt-1">
              Revisa tus simulaciones guardadas, compáralas o expórtalas.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {savedProducts.length > 0 && (
              <button 
                onClick={() => setShowConfirm({ type: 'deleteAll' })}
                className="bg-red-500/10 border border-red-500/20 text-red-400 px-3.5 py-2.5 rounded-xl text-[14px] sm:text-[15px] font-bold uppercase tracking-wider hover:bg-red-500/20 transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
              >
                <Trash2 size={15} />
                Limpiar Todo
              </button>
            )}
            <button 
              onClick={handleExportHistory}
              disabled={savedProducts.length === 0}
              className="bg-[#111] border border-white/10 text-slate-200 disabled:opacity-40 hover:bg-slate-900 px-4 py-2.5 rounded-xl text-[14px] sm:text-[15px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
            >
              <Download size={15} />
              CSV historial
            </button>
          </div>
        </div>

        {/* Calculations Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[13px] sm:text-[14px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-4">FECHA</th>
                <th className="py-4 px-4">PRODUCTO</th>
                <th className="py-4 px-4 text-center">MON.</th>
                <th className="py-4 px-4 text-center">UNID</th>
                <th className="py-4 px-4 text-right">COSTOS TOT.</th>
                <th className="py-4 px-4 text-right">UTILIDAD %</th>
                <th className="py-4 px-4 text-right text-[#00df9a]">UTILIDAD $</th>
                <th className="py-4 px-4 text-right text-[#ff5500]">PRECIO VENTA</th>
                <th className="py-4 px-4 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {savedProducts.map((p) => {
                // Compute parameters on the fly
                let presentationText = 'N/A';
                let currencySymbol = '$';
                let packUnits = '1';
                let totalCostFormatted = '$ 0';
                let utilityPercentFormatted = '0%';
                let utilityAbsFormatted = '$ 0';
                let pvFormatted = '$ 0';

                if (p.costPerUnit !== undefined) {
                  // COD Record style
                  const sizeAmount = parseFloat(p.sizeAmount || '0');
                  const sizeUnit = p.sizeUnit || 'ml';
                  presentationText = `Tamaño: ${sizeAmount} ${sizeUnit}`;
                  
                  currencySymbol = CURRENCIES[p.currency]?.symbol || '$';
                  packUnits = p.packUnits || '1';

                  const uUnits = parseFloat(p.packUnits || '1') || 1;
                  const cUnit = parseFloat(p.costPerUnit || '0') || 0;
                  const sBase = parseFloat(p.shippingBase || '0') || 0;
                  const dDispatch = parseFloat(p.deliveryDispatchPercent || '100') || 100;
                  const admin = parseFloat(p.adminCosts || '0') || 0;
                  const fulfillment = parseFloat(p.fulfillment || '0') || 0;
                  const cpa = parseFloat(p.cpaAds || '0') || 0;
                  const fDelivery = parseFloat(p.finalDeliveryPercent || '100') || 100;
                  const profitPct = parseFloat(p.desiredProfitPercent || '0') || 0;

                  const proveedor = cUnit * uUnits;
                  const fleteDev = dDispatch > 0 ? sBase / (dDispatch / 100) : sBase;
                  const cpaCosteado = fDelivery > 0 ? cpa / (fDelivery / 100) : cpa;
                  const totalCost = proveedor + fleteDev + cpaCosteado + admin + fulfillment;
                  
                  const pv = profitPct < 100 ? totalCost / (1 - (profitPct / 100)) : totalCost;
                  const netProfitVal = pv - totalCost;

                  totalCostFormatted = formatValue(totalCost, p.currency);
                  utilityPercentFormatted = `${profitPct.toFixed(1)}%`;
                  utilityAbsFormatted = formatValue(netProfitVal, p.currency);
                  pvFormatted = formatValue(pv, p.currency);
                } else {
                  // Compatibility Fallback
                  presentationText = 'N/A';
                  currencySymbol = CURRENCIES[p.currency]?.symbol || '$';
                  packUnits = '1';
                  
                  const cost = p.inputs?.cost || 0;
                  const ship = p.inputs?.shippingReal || 0;
                  const ads = p.inputs?.adsCost || 0;
                  const totalCost = cost + ship + ads;

                  totalCostFormatted = formatValue(totalCost, p.currency);
                  utilityPercentFormatted = `${Math.round(p.results?.margin || 0)}%`;
                  utilityAbsFormatted = formatValue(p.results?.netProfit || 0, p.currency);
                  pvFormatted = formatValue(p.inputs?.price || 0, p.currency);
                }

                const isCurrentlyEditing = editingId === p.id;

                return (
                  <tr 
                    key={p.id} 
                    className={`text-[15px] transition-colors ${
                      isCurrentlyEditing 
                        ? 'bg-[#ff5500]/10 text-white border-l-4 border-l-[#ff5500]' 
                        : 'text-slate-300 hover:bg-white/2'
                    }`}
                  >
                    <td className="py-4 px-4 font-mono text-[14px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-500" />
                        {new Date(p.timestamp).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        type="button"
                        onClick={() => handleEditProduct(p)}
                        className="text-left font-bold text-white hover:text-[#ff5500] transition-colors flex items-center gap-1.5 group cursor-pointer text-[15px]"
                        title="Haz clic para cargar y editar este cálculo"
                      >
                        <span>{p.name}</span>
                        <Edit2 size={13} className="opacity-0 group-hover:opacity-100 text-[#ff5500] transition-opacity shrink-0" />
                      </button>
                      <div className="text-[12px] text-slate-400 font-bold uppercase mt-0.5">{presentationText}</div>
                    </td>
                    <td className="py-4 px-4 text-center font-mono font-bold text-slate-300 text-[15px]">
                      {currencySymbol}
                    </td>
                    <td className="py-4 px-4 text-center font-mono font-black text-white text-[15px]">
                      {packUnits}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-slate-300 text-[15px]">
                      {totalCostFormatted}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-white font-bold text-[15px]">
                      {utilityPercentFormatted}
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-black text-[#00df9a] text-[15px]">
                      {utilityAbsFormatted}
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-black text-[#ff5500] text-[15px]">
                      {pvFormatted}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          type="button"
                          onClick={() => handleEditProduct(p)}
                          className={`px-3 py-1.5 rounded-lg text-[14px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isCurrentlyEditing 
                              ? 'bg-[#ff5500] text-white shadow-md shadow-[#ff5500]/30 ring-1 ring-[#ff7700]' 
                              : 'bg-white/5 hover:bg-[#ff5500]/15 text-slate-300 hover:text-[#ff5500] border border-white/10 hover:border-[#ff5500]/30'
                          }`}
                          title="Editar este cálculo en la calculadora"
                        >
                          <Edit2 size={14} />
                          <span>Editar</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteOne(p.id)}
                          className="text-slate-500 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar cálculo"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {savedProducts.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 font-bold uppercase tracking-wider text-[15px]">
                    No hay cálculos guardados en el historial
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 max-w-sm w-full space-y-4 border-red-500/20"
            >
              <div className="flex items-center gap-3 text-red-400">
                <AlertTriangle size={24} />
                <h4 className="text-lg font-display font-bold text-white">¿Confirmar Acción?</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {showConfirm.type === 'deleteSelected' 
                  ? `¿Estás seguro de que deseas eliminar ${showConfirm.count} productos seleccionados?`
                  : showConfirm.type === 'deleteAll'
                  ? '¿Estás seguro de que deseas eliminar TODOS los productos registrados en tu historial de cálculos? Esta acción no se puede deshacer.'
                  : '¿Estás seguro de que deseas eliminar este producto?'}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl border border-white/5 text-slate-400 hover:text-white transition-all text-[12px] font-bold uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all text-[12px] font-bold uppercase tracking-widest"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ProfitCalculator;
