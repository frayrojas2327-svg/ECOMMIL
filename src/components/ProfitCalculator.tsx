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
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { CURRENCIES, CurrencyCode } from '../mockData';

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
}

const ProfitCalculator: React.FC<ProfitCalculatorProps> = ({ 
  formatCurrency: globalFormat, 
  currencySymbol: globalSymbol,
  currency,
  setCurrency,
  isConversionActive,
  currencies
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

  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>(() => {
    const saved = localStorage.getItem('ecommil_saved_products');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('ecommil_saved_products', JSON.stringify(savedProducts));
  }, [savedProducts]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
    
    // If currency selector changed, sync with parent state
    if (name === 'currency') {
      setCurrency(value as CurrencyCode);
    }
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
      fullfillPercentCT
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
            <div className="bg-[#00df9a]/5 border border-[#00df9a]/20 hover:border-[#00df9a]/40 transition-all rounded-xl p-5 flex items-center justify-between shadow-lg shadow-[#00df9a]/2">
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

      {/* FORMULAS DE MODELO KEYSECTION */}
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
      <div className="bg-[#090909] border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-display font-black tracking-tight text-white uppercase">
              HISTORIAL DE CÁLCULOS
            </h3>
            <p className="text-[12px] text-slate-400 mt-1">
              Revisa tus simulaciones guardadas, compáralas o expórtalas.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {savedProducts.length > 0 && (
              <button 
                onClick={() => setShowConfirm({ type: 'deleteAll' })}
                className="bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-2 rounded-xl text-[12px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center gap-2"
              >
                <Trash2 size={13} />
                Limpiar Todo
              </button>
            )}
            <button 
              onClick={handleExportHistory}
              disabled={savedProducts.length === 0}
              className="bg-[#111] border border-white/5 text-slate-300 disabled:opacity-40 hover:bg-slate-900 px-4 py-2 rounded-xl text-[12px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <Download size={13} />
              CSV historial
            </button>
          </div>
        </div>

        {/* Calculations Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <th className="py-3.5 px-4">FECHA</th>
                <th className="py-3.5 px-4">PRODUCTO</th>
                <th className="py-3.5 px-4 text-center">MON.</th>
                <th className="py-3.5 px-4 text-center">UNID</th>
                <th className="py-3.5 px-4 text-right">COSTOS TOT.</th>
                <th className="py-3.5 px-4 text-right">UTILIDAD %</th>
                <th className="py-3.5 px-4 text-right text-[#00df9a]">UTILIDAD $</th>
                <th className="py-3.5 px-4 text-right text-[#ff5500]">PRECIO VENTA</th>
                <th className="py-3.5 px-4 text-center">ACCIONES</th>
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
                    className={`text-[13px] transition-colors ${
                      isCurrentlyEditing 
                        ? 'bg-[#ff5500]/10 text-white border-l-4 border-l-[#ff5500]' 
                        : 'text-slate-300 hover:bg-white/2'
                    }`}
                  >
                    <td className="py-4 px-4 font-mono text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-slate-600" />
                        {new Date(p.timestamp).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        type="button"
                        onClick={() => handleEditProduct(p)}
                        className="text-left font-bold text-white hover:text-[#ff5500] transition-colors flex items-center gap-1.5 group cursor-pointer"
                        title="Haz clic para cargar y editar este cálculo"
                      >
                        <span>{p.name}</span>
                        <Edit2 size={11} className="opacity-0 group-hover:opacity-100 text-[#ff5500] transition-opacity shrink-0" />
                      </button>
                      <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{presentationText}</div>
                    </td>
                    <td className="py-4 px-4 text-center font-mono font-bold text-slate-400">
                      {currencySymbol}
                    </td>
                    <td className="py-4 px-4 text-center font-mono font-black text-white">
                      {packUnits}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-slate-400">
                      {totalCostFormatted}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-slate-400 font-bold">
                      {utilityPercentFormatted}
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-black text-[#00df9a]">
                      {utilityAbsFormatted}
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-black text-[#ff5500]">
                      {pvFormatted}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          type="button"
                          onClick={() => handleEditProduct(p)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isCurrentlyEditing 
                              ? 'bg-[#ff5500] text-white shadow-md shadow-[#ff5500]/30 ring-1 ring-[#ff7700]' 
                              : 'bg-white/5 hover:bg-[#ff5500]/15 text-slate-300 hover:text-[#ff5500] border border-white/10 hover:border-[#ff5500]/30'
                          }`}
                          title="Editar este cálculo en la calculadora"
                        >
                          <Edit2 size={12} />
                          <span>Editar</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteOne(p.id)}
                          className="text-slate-500 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar cálculo"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {savedProducts.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-bold uppercase tracking-wider">
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
