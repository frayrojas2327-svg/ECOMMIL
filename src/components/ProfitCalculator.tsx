import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Calculator as CalcIcon, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  DollarSign, 
  Save, 
  Trash2, 
  ExternalLink,
  Tag,
  Link as LinkIcon,
  FileText,
  Hash,
  Layout,
  Table as TableIcon,
  Download,
  Upload,
  CheckSquare,
  Square,
  Package,
  Plus,
  X,
  Calendar,
  CreditCard,
  Wallet,
  Megaphone,
  Receipt,
  Globe
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
  url: string;
  notes: string;
  currency: CurrencyCode;
  inputs: {
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
    fixedExpenses: FixedExpense[];
    variableExpenses: VariableExpense[];
  };
  results: {
    netProfit: number;
    margin: number;
    roi: number;
    breakEven: number;
    status: string;
    totalFixedExpenses: number;
    totalVariableExpenses: number;
  };
  timestamp: number;
}

interface ProfitCalculatorProps {
  formatCurrency: (amount: number) => string;
  currencySymbol: string;
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  isConversionActive: boolean;
  currencies: any;
}

const EXPENSE_CATEGORIES = ['Software', 'Publicidad', 'Servicios', 'Personal', 'Suscripciones', 'Otros'];

const ProfitCalculator: React.FC<ProfitCalculatorProps> = ({ 
  formatCurrency: globalFormat, 
  currencySymbol: globalSymbol,
  currency,
  setCurrency,
  isConversionActive,
  currencies
}) => {
  const [viewMode, setViewMode] = useState<'form' | 'excel'>(() => {
    const saved = localStorage.getItem('ecommil_view_mode');
    return (saved === 'form' || saved === 'excel') ? saved : 'form';
  });
  const [projectionOrders, setProjectionOrders] = useState<number>(() => {
    const saved = localStorage.getItem('ecommil_projection_orders');
    return saved ? parseInt(saved) : 100;
  });
  const [isProjectionActive, setIsProjectionActive] = useState<boolean>(() => {
    const saved = localStorage.getItem('ecommil_projection_active');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('ecommil_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('ecommil_projection_active', String(isProjectionActive));
  }, [isProjectionActive]);

  useEffect(() => {
    localStorage.setItem('ecommil_projection_orders', String(projectionOrders));
  }, [projectionOrders]);
  const prevCurrencyRef = useRef<CurrencyCode>(currency);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState<{ type: 'deleteSelected' | 'deleteAll' | 'deleteOne', count?: number, id?: string } | null>(null);
  const [inputs, setInputs] = useState({
    name: '',
    productId: '',
    url: '',
    notes: '',
    price: '99',
    cost: '35',
    shippingCharged: '',
    shippingReal: '12.5',
    adsCost: '15',
    returnShippingCost: '6',
    platformFee: '3',
    confirmationRate: '90',
    cancellationRate: '5',
    returnRate: '8',
  });

  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>(() => {
    const saved = localStorage.getItem('ecommil_fixed_expenses');
    return saved ? JSON.parse(saved) : [];
  });
  const [variableExpenses, setVariableExpenses] = useState<VariableExpense[]>(() => {
    const saved = localStorage.getItem('ecommil_variable_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  // Sync with localStorage if changed elsewhere
  useEffect(() => {
    const handleStorage = () => {
      const savedFixed = localStorage.getItem('ecommil_fixed_expenses');
      const savedVar = localStorage.getItem('ecommil_variable_expenses');
      if (savedFixed) setFixedExpenses(JSON.parse(savedFixed));
      if (savedVar) setVariableExpenses(JSON.parse(savedVar));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Real-time conversion logic
  useEffect(() => {
    if (isConversionActive && prevCurrencyRef.current !== currency) {
      const oldRate = currencies[prevCurrencyRef.current].rate;
      const newRate = currencies[currency].rate;
      const ratio = newRate / oldRate;

      setInputs(prev => ({
        ...prev,
        price: Number((parseFloat(prev.price) * ratio).toFixed(2)).toString(),
        cost: Number((parseFloat(prev.cost) * ratio).toFixed(2)).toString(),
        shippingCharged: prev.shippingCharged ? Number((parseFloat(prev.shippingCharged) * ratio).toFixed(2)).toString() : '',
        shippingReal: Number((parseFloat(prev.shippingReal) * ratio).toFixed(2)).toString(),
        adsCost: Number((parseFloat(prev.adsCost) * ratio).toFixed(2)).toString(),
        returnShippingCost: prev.returnShippingCost ? Number((parseFloat(prev.returnShippingCost) * ratio).toFixed(2)).toString() : '',
      }));
    }
    prevCurrencyRef.current = currency;
  }, [currency, isConversionActive]);

  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>(() => {
    const saved = localStorage.getItem('ecommil_saved_products');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('ecommil_saved_products', JSON.stringify(savedProducts));
  }, [savedProducts]);

  const currencyInfo = currencies[currency];

  const formatLocalCurrency = (amount: number, curr: CurrencyCode = currency) => {
    const isUSD = !isConversionActive;
    const targetCurrency = isUSD ? 'USD' : curr;
    
    // Internal values are stored in USD
    let converted = amount;
    if (!isUSD) {
      const rate = currencies[curr]?.rate || 1;
      converted = amount * rate;
    }
    
    const rounded = Math.round(converted * 100) / 100;
    
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: targetCurrency,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(rounded);
  };

  const calculateResults = (
    price: number, 
    cost: number, 
    shippingCharged: number, 
    shippingReal: number, 
    adsCost: number, 
    returnShippingCost: number,
    platformFee: number,
    confirmationRate: number = 90,
    cancellationRate: number = 5,
    returnRate: number = 8,
    expenses: FixedExpense[] = [],
    varExpenses: VariableExpense[] = []
  ) => {
    // Pro Calculation Model (Based on 100 potential orders/leads)
    const baseOrders = 100;
    const confirmedOrders = baseOrders * (confirmationRate / 100);
    const shippedOrders = confirmedOrders * (1 - cancellationRate / 100);
    const deliveredOrders = shippedOrders * (1 - returnRate / 100);
    const returnedOrders = shippedOrders * (returnRate / 100);

    const unitVarExpenses = varExpenses.reduce((acc, exp) => acc + exp.amount, 0);

    const totalRevenue = deliveredOrders * (price + shippingCharged);
    const totalProductCost = shippedOrders * cost;
    const totalShippingCost = shippedOrders * shippingReal;
    const totalReturnCost = returnedOrders * returnShippingCost; 
    const totalAdsCost = baseOrders * adsCost;
    const totalPlatformFee = deliveredOrders * price * (platformFee / 100);
    const totalVariableExpenses = shippedOrders * unitVarExpenses;

    const totalNetProfit = totalRevenue - totalProductCost - totalShippingCost - totalReturnCost - totalAdsCost - totalPlatformFee - totalVariableExpenses;
    
    const netProfit = totalNetProfit / baseOrders;
    const margin = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;
    const totalInvestment = totalAdsCost + totalProductCost + totalShippingCost + totalReturnCost + totalVariableExpenses;
    const roi = totalInvestment > 0 ? (totalNetProfit / totalInvestment) * 100 : 0;
    
    const breakEven = (1 - (platformFee / 100)) !== 0 
      ? (cost + shippingReal + adsCost + unitVarExpenses - shippingCharged) / (1 - (platformFee / 100))
      : 0;

    const totalFixedExpenses = expenses.reduce((acc, exp) => {
      if (exp.frequency === 'monthly') return acc + exp.amount;
      if (exp.frequency === 'yearly') return acc + (exp.amount / 12);
      return acc;
    }, 0);

    let status: 'profitable' | 'limit' | 'loss' = 'profitable';
    if (netProfit < 0) status = 'loss';
    else if (margin < 15) status = 'limit';

    return { netProfit, margin, roi, breakEven, status, totalFixedExpenses, totalVariableExpenses: unitVarExpenses };
  };

  const results = useMemo(() => {
    return calculateResults(
      parseFloat(inputs.price) || 0,
      parseFloat(inputs.cost) || 0,
      parseFloat(inputs.shippingCharged) || 0,
      parseFloat(inputs.shippingReal) || 0,
      parseFloat(inputs.adsCost) || 0,
      parseFloat(inputs.returnShippingCost) || 0,
      parseFloat(inputs.platformFee) || 0,
      parseFloat(inputs.confirmationRate) || 0,
      parseFloat(inputs.cancellationRate) || 0,
      parseFloat(inputs.returnRate) || 0,
      fixedExpenses,
      variableExpenses
    );
  }, [inputs, fixedExpenses, variableExpenses]);

  const removeExpense = (id: string) => {
    setFixedExpenses(prev => prev.filter(exp => exp.id !== id));
  };

  const addExpense = () => {
    const newExpense: FixedExpense = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      category: 'Software',
      amount: 0,
      frequency: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      endDate: ''
    };
    setFixedExpenses([...fixedExpenses, newExpense]);
  };

  const updateExpense = (id: string, field: keyof FixedExpense, value: any) => {
    setFixedExpenses(prev => prev.map(exp => exp.id === id ? { ...exp, [field]: value } : exp));
  };

  const addVariableExpense = () => {
    const newExpense: VariableExpense = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      amount: 0
    };
    setVariableExpenses([...variableExpenses, newExpense]);
  };

  const removeVariableExpense = (id: string) => {
    setVariableExpenses(prev => prev.filter(exp => exp.id !== id));
  };

  const updateVariableExpense = (id: string, field: keyof VariableExpense, value: any) => {
    setVariableExpenses(prev => prev.map(exp => exp.id === id ? { ...exp, [field]: value } : exp));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    const numericInputs = {
      price: parseFloat(inputs.price) || 0,
      cost: parseFloat(inputs.cost) || 0,
      shippingCharged: parseFloat(inputs.shippingCharged) || 0,
      shippingReal: parseFloat(inputs.shippingReal) || 0,
      adsCost: parseFloat(inputs.adsCost) || 0,
      returnShippingCost: parseFloat(inputs.returnShippingCost) || 0,
      platformFee: parseFloat(inputs.platformFee) || 0,
      confirmationRate: parseFloat(inputs.confirmationRate) || 0,
      cancellationRate: parseFloat(inputs.cancellationRate) || 0,
      returnRate: parseFloat(inputs.returnRate) || 0,
      fixedExpenses: [...fixedExpenses],
      variableExpenses: [...variableExpenses],
    };

    const newProduct: SavedProduct = {
      id: Math.random().toString(36).substr(2, 9),
      productId: inputs.productId || 'N/A',
      name: inputs.name || 'Producto sin nombre',
      url: inputs.url,
      notes: inputs.notes,
      currency: currency,
      inputs: numericInputs,
      results: { ...results },
      timestamp: Date.now(),
    };
    setSavedProducts([newProduct, ...savedProducts]);
    // Reset basic info and expenses
    setInputs(prev => ({ ...prev, name: '', productId: '', url: '', notes: '', returnShippingCost: prev.returnShippingCost }));
    setFixedExpenses([]);
    setVariableExpenses([]);
  };

  const handleDelete = (id: string) => {
    setShowConfirm({ type: 'deleteOne', id });
  };

  const handleDeleteSelected = () => {
    if (selectedProductIds.length === 0) return;
    setShowConfirm({ type: 'deleteSelected', count: selectedProductIds.length });
  };

  const handleDeleteAll = () => {
    if (savedProducts.length === 0) return;
    setShowConfirm({ type: 'deleteAll' });
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

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === savedProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(savedProducts.map(p => p.id));
    }
  };

  const exportToExcel = () => {
    const dataToExport = savedProducts.map(p => ({
      'ID/SKU': p.productId,
      'Nombre': p.name,
      'Moneda': p.currency,
      'Precio Venta': p.inputs.price,
      'Costo': p.inputs.cost,
      'Flete Cobrado': p.inputs.shippingCharged,
      'Flete Real': p.inputs.shippingReal,
      'Flete Devolución': p.inputs.returnShippingCost || (p.inputs.shippingReal * 0.5),
      'Costo Ads': p.inputs.adsCost,
      'Comisión %': p.inputs.platformFee,
      'Confirmación %': p.inputs.confirmationRate,
      'Cancelación %': p.inputs.cancellationRate,
      'Devolución %': p.inputs.returnRate,
      'Ganancia Neta': p.results.netProfit,
      'Margen %': p.results.margin,
      'ROI %': p.results.roi,
      'Punto Equilibrio': p.results.breakEven,
      'Notas': p.notes,
      'URL': p.url,
      'Fecha': new Date(p.timestamp).toLocaleString()
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, `ECOMMIL_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const importFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const parseMoney = (val: any) => {
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'number') return val;
      let str = String(val).trim();
      if (!str) return 0;
      // Specialized cleaning for GTQ and common OCR/Formatting errors
      str = str.replace(/GTQ|TQ|6TQ|Q/gi, '').replace(/[$\s]/g, '');
      const lastComma = str.lastIndexOf(',');
      const lastDot = str.lastIndexOf('.');
      if (lastComma !== -1 && lastDot !== -1) {
        if (lastComma > lastDot) str = str.replace(/\./g, '').replace(',', '.');
        else str = str.replace(/,/g, '');
      } else if (lastComma !== -1) {
        const parts = str.split(',');
        if (parts.length > 2 || parts[parts.length - 1].length > 2) str = str.replace(/,/g, '');
        else str = str.replace(',', '.');
      } else if (lastDot !== -1) {
        const parts = str.split('.');
        if (parts.length > 2 || parts[parts.length - 1].length > 2) str = str.replace(/\./g, '');
      }
      const cleaned = str.replace(/[^0-9.-]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const importedProducts: SavedProduct[] = data.map(row => {
        // Dropi mapping or generic mapping
        const name = row['Nombre'] || row['Nombre del producto'] || row['Producto'] || row['Item'] || 'Importado';
        const price = parseMoney(row['Precio Venta'] || row['Precio de venta'] || row['Precio'] || row['Venta']);
        const cost = parseMoney(row['Costo'] || row['Costo del producto'] || row['Costo Unitario'] || row['Compra']);
        const shippingCharged = parseMoney(row['Flete Cobrado'] || row['Envío cobrado'] || row['Envío Cliente']);
        const shippingReal = parseMoney(row['Flete Real'] || row['Costo de envío'] || row['Flete'] || row['Envío Real']);
        const adsCost = parseMoney(row['Costo Ads'] || row['Publicidad'] || row['CPA']);
        const returnShippingCost = parseMoney(row['Flete Devolución'] || row['Costo Devolución Flete'] || row['Devolución Flete'] || (shippingReal * 0.5));
        const platformFee = parseMoney(row['Comisión %'] || row['Comisión'] || row['Fee'] || 3);
        const confirmationRate = parseMoney(row['Confirmación %'] || row['Confirmación'] || 90);
        const cancellationRate = parseMoney(row['Cancelación %'] || row['Cancelación'] || 5);
        const returnRate = parseMoney(row['Devolución %'] || row['Devolución'] || 8);
        const productId = row['ID/SKU'] || row['SKU'] || row['Referencia'] || row['Código'] || 'N/A';
        const notes = row['Notas'] || row['Descripción'] || row['Comentario'] || '';
        const url = row['URL'] || row['Link'] || '';
        const curr = (row['Moneda'] || currency) as CurrencyCode;

        // Calculate results for imported row using the new pro model
        const results = calculateResults(price, cost, shippingCharged, shippingReal, adsCost, returnShippingCost, platformFee, confirmationRate, cancellationRate, returnRate);

        return {
          id: Math.random().toString(36).substr(2, 9),
          productId,
          name,
          url,
          notes,
          currency: curr,
          inputs: { price, cost, shippingCharged, shippingReal, adsCost, returnShippingCost, platformFee, confirmationRate, cancellationRate, returnRate, fixedExpenses: [], variableExpenses: [] },
          results: { ...results, totalFixedExpenses: 0, totalVariableExpenses: 0 },
          timestamp: Date.now()
        };
      });

      setSavedProducts(prev => [...importedProducts, ...prev]);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset input
  };

  const loadProduct = (product: SavedProduct) => {
    setCurrency(product.currency);
    setFixedExpenses(product.inputs.fixedExpenses || []);
    setVariableExpenses(product.inputs.variableExpenses || []);
    setInputs({
      name: product.name,
      productId: product.productId,
      url: product.url,
      notes: product.notes,
      price: product.inputs.price.toString(),
      cost: product.inputs.cost.toString(),
      shippingCharged: product.inputs.shippingCharged.toString(),
      shippingReal: product.inputs.shippingReal.toString(),
      adsCost: product.inputs.adsCost.toString(),
      returnShippingCost: (product.inputs.returnShippingCost || (product.inputs.shippingReal * 0.5)).toString(),
      platformFee: product.inputs.platformFee.toString(),
      confirmationRate: product.inputs.confirmationRate.toString(),
      cancellationRate: product.inputs.cancellationRate.toString(),
      returnRate: product.inputs.returnRate.toString(),
    });
    // Removed automatic setViewMode('form') to respect user request
    if (viewMode === 'form') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const viewInExcel = (productId: string) => {
    setViewMode('excel');
    setHighlightedProductId(productId);
    setTimeout(() => {
      const element = document.getElementById(`row-${productId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    setTimeout(() => setHighlightedProductId(null), 3000);
  };

  return (
    <div className="max-w-full mx-auto space-y-3 px-4">
      <datalist id="expense-categories">
        <option value="Software" />
        <option value="Marketing" />
        <option value="Publicidad" />
        <option value="Suscripciones" />
        <option value="Servicios" />
        <option value="Personal" />
        <option value="Otros" />
      </datalist>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-white">Calculadora de Rentabilidad Pro</h2>
          <p className="text-[13px] text-slate-500">Simulación avanzada con registro de productos y análisis horizontal</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-background/50 rounded-lg p-0.5 border border-border">
            <div className={`px-3 py-1.5 flex items-center gap-2 text-[10px] font-black tracking-widest ${isConversionActive ? 'text-neon' : 'text-slate-500'}`}>
              <Globe size={14} />
              {isConversionActive ? `MONEDA: ${currency}` : 'MODO USD'}
            </div>
          </div>
          {selectedProductIds.length > 0 && (
            <button 
              onClick={handleDeleteSelected}
              className="bg-red-500 text-white px-3 py-1.5 rounded-xl text-[12px] font-bold uppercase tracking-widest hover:bg-red-600 transition-all flex items-center gap-2 shadow-lg shadow-red-500/20"
            >
              <Trash2 size={12} />
              Borrar ({selectedProductIds.length})
            </button>
          )}
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Proyección</span>
            <button 
              onClick={() => setIsProjectionActive(!isProjectionActive)}
              className={`relative w-8 h-4 rounded-full transition-colors duration-300 focus:outline-none ${isProjectionActive ? 'bg-neon' : 'bg-slate-700'}`}
              title={isProjectionActive ? "Desactivar Proyección" : "Activar Proyección"}
            >
              <motion.div 
                animate={{ x: isProjectionActive ? 16 : 2 }}
                className="absolute top-0.5 left-0 w-3 h-3 bg-white rounded-full shadow-sm"
              />
            </button>
            {isProjectionActive && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border group">
                <Package size={12} className="text-neon group-hover:scale-110 transition-transform" />
                <div className="relative">
                  <input 
                    type="number"
                    value={projectionOrders}
                    onChange={(e) => setProjectionOrders(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-16 bg-background/50 border border-neon/20 rounded px-1.5 py-0.5 text-white font-mono text-[13px] focus:outline-none focus:border-neon transition-all"
                    title="Cantidad de pedidos para proyección"
                  />
                  <div className="absolute -top-3 left-0 text-[8px] text-slate-500 uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity">Pedidos</div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center bg-card border border-border rounded-xl p-1">
            <button 
              onClick={() => setViewMode('form')}
              className={`p-1.5 rounded-lg transition-all flex items-center gap-2 text-[13px] font-bold uppercase tracking-widest ${viewMode === 'form' ? 'bg-neon text-background' : 'text-slate-500 hover:text-white'}`}
            >
              <Layout size={14} />
              <span className="hidden sm:inline">Formulario</span>
            </button>
            <button 
              onClick={() => setViewMode('excel')}
              className={`p-1.5 rounded-lg transition-all flex items-center gap-2 text-[13px] font-bold uppercase tracking-widest ${viewMode === 'excel' ? 'bg-neon text-background' : 'text-slate-500 hover:text-white'}`}
            >
              <TableIcon size={14} />
              <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl p-1 shadow-inner">
            <div className="flex bg-background rounded-lg p-0.5 border border-border/50">
              <button 
                onClick={() => setCurrency('USD')}
                className={`px-3 py-1 rounded-md text-[11px] font-black tracking-widest transition-all ${
                  currency === 'USD' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                USD
              </button>
              <button 
                onClick={() => {
                  if (currency === 'USD') setCurrency('COP'); // Default to COP if current is USD
                }}
                className={`px-3 py-1 rounded-md text-[11px] font-black tracking-widest transition-all ${
                  currency !== 'USD' ? 'bg-neon text-background shadow-lg shadow-neon/20' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                LOCAL
              </button>
            </div>

            {currency !== 'USD' && (
              <div className="flex gap-1 ml-1 pl-1 border-l border-border/50">
                {(Object.keys(currencies) as CurrencyCode[]).filter(c => c !== 'USD').map((code) => (
                  <button
                    key={code}
                    onClick={() => setCurrency(code)}
                    className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
                      currency === code ? 'text-neon bg-neon/10' : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button 
            onClick={() => setInputs({ name: '', productId: '', url: '', notes: '', price: '', cost: '', shippingCharged: '', shippingReal: '', adsCost: '', returnShippingCost: '', platformFee: '', confirmationRate: '90', cancellationRate: '5', returnRate: '8' })}
            className="p-2 text-slate-500 hover:text-neon transition-colors"
            title="Limpiar campos"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Calculator View Switcher */}
      {viewMode === 'form' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Left Column: Inputs */}
          <div className="xl:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Info Section */}
              <div className="glass-card p-4 space-y-4 border-border/50">
                <h3 className="text-[13px] uppercase tracking-widest text-slate-500 font-display flex items-center gap-2">
                  <Tag size={12} /> Información del Producto
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[13px] uppercase tracking-widest text-slate-500 font-bold">Nombre</label>
                      <div className="relative">
                        <input 
                          type="text" name="name" value={inputs.name} onChange={handleInputChange} placeholder="Ej: Smartwatch X"
                          className="w-full bg-background border border-border rounded-lg py-1.5 px-3 text-white text-[15px] focus:outline-none focus:border-neon"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[13px] uppercase tracking-widest text-slate-500 font-bold">ID / SKU</label>
                      <div className="relative">
                        <Hash size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input 
                          type="text" name="productId" value={inputs.productId} onChange={handleInputChange} placeholder="SKU-001"
                          className="w-full bg-background border border-border rounded-lg py-1.5 pl-8 pr-3 text-white text-[15px] font-mono focus:outline-none focus:border-neon"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[13px] uppercase tracking-widest text-slate-500 font-bold">URL del Producto</label>
                    <div className="relative">
                      <LinkIcon size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input 
                        type="text" name="url" value={inputs.url} onChange={handleInputChange} placeholder="https://..."
                        className="w-full bg-background border border-border rounded-lg py-1.5 pl-8 pr-3 text-white text-[15px] focus:outline-none focus:border-neon"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[13px] uppercase tracking-widest text-slate-500 font-bold">Notas</label>
                    <textarea 
                      name="notes" value={inputs.notes} onChange={handleInputChange} placeholder="Detalles adicionales..."
                      className="w-full bg-background border border-border rounded-lg py-1.5 px-3 text-white text-[15px] h-20 resize-none focus:outline-none focus:border-neon"
                    />
                  </div>
                </div>
              </div>

              {/* Operational Metrics Section */}
              <div className="glass-card p-4 space-y-4 border-border/50">
                <h3 className="text-[13px] uppercase tracking-widest text-slate-500 font-display flex items-center gap-2">
                  <RefreshCw size={12} /> Métricas de Operación
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <label className="text-[13px] uppercase tracking-widest text-slate-500 font-bold">Confirmación</label>
                    <div className="relative">
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[15px]">%</span>
                      <input 
                        type="number" name="confirmationRate" value={inputs.confirmationRate} onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg py-1.5 pl-3 pr-8 text-white font-mono text-[15px] focus:outline-none focus:border-neon"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[13px] uppercase tracking-widest text-slate-500 font-bold">Cancelación</label>
                    <div className="relative">
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[15px]">%</span>
                      <input 
                        type="number" name="cancellationRate" value={inputs.cancellationRate} onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg py-1.5 pl-3 pr-8 text-white font-mono text-[15px] focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[13px] uppercase tracking-widest text-slate-500 font-bold">Devolución</label>
                    <div className="relative">
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[15px]">%</span>
                      <input 
                        type="number" name="returnRate" value={inputs.returnRate} onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg py-1.5 pl-3 pr-8 text-white font-mono text-[15px] focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Financial Inputs Section */}
              <div className="glass-card p-4 space-y-4 border-border/50 bg-slate-900/40">
                <h3 className="text-[13px] uppercase tracking-widest text-slate-500 font-display flex items-center gap-2">
                  <DollarSign size={12} className="text-neon" /> Parámetros de Venta
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[13px] uppercase tracking-widest text-slate-500 font-bold">Precio Venta</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neon font-mono text-[13px]">{currencyInfo.symbol}</span>
                      <input 
                        type="number" name="price" value={inputs.price} onChange={handleInputChange} placeholder="0"
                        className="w-full bg-background border border-border rounded-lg py-1.5 pl-8 pr-3 text-white font-mono text-[15px] focus:outline-none focus:border-neon"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[13px] uppercase tracking-widest text-slate-500 font-bold">Costo Producto</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gold font-mono text-[13px]">{currencyInfo.symbol}</span>
                      <input 
                        type="number" name="cost" value={inputs.cost} onChange={handleInputChange} placeholder="0"
                        className="w-full bg-background border border-border rounded-lg py-1.5 pl-8 pr-3 text-white font-mono text-[15px] focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[13px] uppercase tracking-widest text-slate-500 font-bold">Flete Cobrado</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[13px]">{currencyInfo.symbol}</span>
                      <input 
                        type="number" name="shippingCharged" value={inputs.shippingCharged} onChange={handleInputChange} placeholder="0"
                        className="w-full bg-background border border-border rounded-lg py-1.5 pl-8 pr-3 text-white font-mono text-[15px] focus:outline-none focus:border-neon"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[13px] uppercase tracking-widest text-slate-500 font-bold">Flete Real</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[13px]">{currencyInfo.symbol}</span>
                      <input 
                        type="number" name="shippingReal" value={inputs.shippingReal} onChange={handleInputChange} placeholder="0"
                        className="w-full bg-background border border-border rounded-lg py-1.5 pl-8 pr-3 text-white font-mono text-[15px] focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[13px] uppercase tracking-widest text-slate-500 font-bold">Flete Devolución</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[13px]">{currencyInfo.symbol}</span>
                      <input 
                        type="number" name="returnShippingCost" value={inputs.returnShippingCost} onChange={handleInputChange} placeholder="0"
                        className="w-full bg-background border border-border rounded-lg py-1.5 pl-8 pr-3 text-white font-mono text-[15px] focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[13px] uppercase tracking-widest text-slate-500 font-bold">Comisión Pasarela (%)</label>
                    <div className="relative">
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[13px]">%</span>
                      <input 
                        type="number" name="platformFee" value={inputs.platformFee} onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg py-1.5 pl-3 pr-8 text-white font-mono text-[15px] focus:outline-none focus:border-neon"
                      />
                    </div>
                  </div>
                </div>
              </div>

                          {/* Publicidad Section */}
                <div className="glass-card p-4 space-y-3 border-border/50 bg-slate-900/40">
                  <h3 className="text-[13px] uppercase tracking-widest text-slate-500 font-display flex items-center gap-2">
                    <Megaphone size={12} className="text-neon" /> Publicidad
                  </h3>
                  <div className="space-y-1">
                    <label className="text-[13px] uppercase tracking-widest text-slate-500 font-bold">Costo Ads (CPA)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[13px]">{currencyInfo.symbol}</span>
                      <input 
                        type="number" name="adsCost" value={inputs.adsCost} onChange={handleInputChange} placeholder="0"
                        className="w-full bg-background border border-border rounded-lg py-1.5 pl-8 pr-3 text-white font-mono text-[15px] focus:outline-none focus:border-neon"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 italic">Inversión por cada venta (CPA)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Results */}
            <div className="xl:col-span-1">
            <div className="sticky top-4 space-y-4">
              {/* Results Section */}
              <div className="glass-card p-4 flex flex-col justify-between relative overflow-hidden border-neon/20 bg-neon/5 min-h-[400px]">

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] uppercase tracking-widest text-slate-500 font-display">Análisis y Ajustes</h3>
                <div className={`flex items-center gap-2 px-2 py-0.5 rounded-full border text-[13px] font-bold uppercase tracking-widest ${
                  results.status === 'profitable' ? 'bg-neon/10 text-neon border-neon/20' : 
                  results.status === 'limit' ? 'bg-gold/10 text-gold border-gold/20' : 
                  'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {results.status === 'profitable' ? 'Rentable' : results.status === 'limit' ? 'Límite' : 'Pérdida'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[13px] uppercase tracking-widest text-slate-500 mb-0.5">Ganancia Neta (Unidad)</p>
                  <p className={`text-3xl font-mono font-bold ${results.netProfit >= 0 ? 'text-white' : 'text-red-400'}`}>
                    {formatLocalCurrency(results.netProfit)}
                  </p>
                </div>
                <div>
                  <p className="text-[13px] uppercase tracking-widest text-slate-500 mb-0.5">Margen Neto</p>
                  <p className={`text-3xl font-mono font-bold ${results.margin > 15 ? 'text-neon' : results.margin > 0 ? 'text-gold' : 'text-red-400'}`}>
                    {Math.round(results.margin || 0)}%
                  </p>
                </div>
                <div>
                  <p className="text-[13px] uppercase tracking-widest text-slate-500 mb-0.5">ROI Estimado</p>
                  <p className="text-2xl font-mono font-bold text-white">
                    {Math.round(results.roi || 0)}%
                  </p>
                </div>
                <div>
                  <p className="text-[13px] uppercase tracking-widest text-slate-500 mb-0.5">Punto Equilibrio</p>
                  <p className="text-2xl font-mono font-bold text-gold">
                    {formatLocalCurrency(results.breakEven)}
                  </p>
                </div>
              </div>

              {isProjectionActive && (
                <div className="pt-3 border-t border-border/30 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-[13px] uppercase tracking-widest text-slate-500 mb-1 font-bold">N° Pedidos Proyectados</p>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={projectionOrders} 
                          onChange={(e) => setProjectionOrders(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full bg-background/50 border border-neon/30 rounded-lg py-1.5 px-3 text-white font-mono text-[15px] focus:outline-none focus:border-neon transition-all shadow-inner"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neon/50 pointer-events-none">
                          <Package size={14} />
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-[13px] uppercase tracking-widest text-neon mb-1 font-bold">Ganancia Total</p>
                      <p className={`text-2xl font-mono font-bold ${results.netProfit * projectionOrders - results.totalFixedExpenses >= 0 ? 'text-neon' : 'text-red-400'}`}>
                        {formatLocalCurrency(results.netProfit * projectionOrders - results.totalFixedExpenses)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 text-[13px] text-slate-400 italic">
                  <TrendingUp size={12} className="text-neon" />
                  <span>Sugerido (20%): <span className="text-white font-mono">{formatLocalCurrency(results.breakEven * 1.25)}</span></span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button 
                onClick={handleSave}
                className="flex-1 bg-neon text-background font-bold py-2 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-all shadow-lg shadow-neon/20 text-[13px]"
              >
                <Save size={16} /> Guardar Producto
              </button>
              <button 
                onClick={handleDeleteAll}
                className="px-3 bg-slate-800 text-slate-400 hover:bg-red-500 hover:text-white rounded-xl transition-all flex items-center justify-center border border-slate-700"
                title="Borrar todos los registros"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="glass-card overflow-hidden border-border/50">
      <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-card/50 border-b border-border">
                  <th className="p-2 text-[15px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={toggleSelectAll} 
                        className="p-1 hover:text-neon transition-colors flex items-center gap-2" 
                        title="Seleccionar Todo"
                      >
                        {selectedProductIds.length === savedProducts.length && savedProducts.length > 0 ? <CheckSquare size={16} className="text-neon" /> : <Square size={16} />}
                        <span className="hidden sm:inline">Todo</span>
                      </button>
                    </div>
                  </th>
                  <th className="p-2 text-[15px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">Producto / SKU</th>
                  <th className="p-2 text-[15px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">Precio Venta</th>
                  <th className="p-2 text-[15px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">Costo Prod.</th>
                  <th className="p-1.5 text-[15px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">Flete Cob.</th>
                  <th className="p-1.5 text-[15px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">Flete Real</th>
                  <th className="p-1.5 text-[15px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">Flete Dev</th>
                  <th className="p-1.5 text-[15px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">Ads (CPA)</th>
                  <th className="p-1.5 text-[15px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">Métricas %</th>
                  <th className="p-1.5 text-[15px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">Comis. %</th>
                  <th className="p-1.5 text-[15px] uppercase tracking-widest text-neon font-bold whitespace-nowrap">Ganancia</th>
                  <th className="p-1.5 text-[15px] uppercase tracking-widest text-neon font-bold whitespace-nowrap">Margen</th>
                  {isProjectionActive && <th className="p-1.5 text-[15px] uppercase tracking-widest text-neon font-bold whitespace-nowrap">Total ({projectionOrders})</th>}
                  <th className="p-1.5 text-[15px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">Acción</th>
                </tr>
              </thead>
              <tbody>
                {/* Live Simulation Row */}
                <tr className="border-b border-border/30 bg-neon/5 hover:bg-neon/10 transition-colors">
                  <td className="p-1.5"></td>
                  <td className="p-1.5 space-y-1 min-w-[180px]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" />
                      <span className="text-[14px] font-bold text-neon uppercase tracking-tighter">Simulación en Vivo</span>
                    </div>
                    <input 
                      type="text" name="name" value={inputs.name} onChange={handleInputChange} placeholder="Nombre"
                      className="w-full bg-background/50 border border-border rounded-lg px-2 py-0.5 text-white text-[15px] focus:outline-none focus:border-neon"
                    />
                    <input 
                      type="text" name="productId" value={inputs.productId} onChange={handleInputChange} placeholder="SKU"
                      className="w-full bg-background/50 border border-border rounded-lg px-2 py-0.5 text-slate-400 text-[15px] font-mono focus:outline-none focus:border-neon"
                    />
                  </td>
                  <td className="p-1.5 min-w-[100px]">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neon font-mono text-[13px]">{currencyInfo.symbol}</span>
                      <input 
                        type="number" name="price" value={inputs.price} onChange={handleInputChange}
                        className="w-full bg-background/50 border border-border rounded-lg py-0.5 pl-6 pr-2 text-white font-mono text-[15px] focus:outline-none"
                      />
                    </div>
                  </td>
                  <td className="p-1.5 min-w-[100px]">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gold font-mono text-[13px]">{currencyInfo.symbol}</span>
                      <input 
                        type="number" name="cost" value={inputs.cost} onChange={handleInputChange}
                        className="w-full bg-background/50 border border-border rounded-lg py-0.5 pl-6 pr-2 text-white font-mono text-[15px] focus:outline-none"
                      />
                    </div>
                  </td>
                  <td className="p-1.5 min-w-[80px]">
                    <input 
                      type="number" name="shippingCharged" value={inputs.shippingCharged} onChange={handleInputChange}
                      className="w-full bg-background/50 border border-border rounded-lg py-0.5 px-2 text-white font-mono text-[15px] focus:outline-none"
                    />
                  </td>
                  <td className="p-1.5 min-w-[80px]">
                    <input 
                      type="number" name="shippingReal" value={inputs.shippingReal} onChange={handleInputChange}
                      className="w-full bg-background/50 border border-border rounded-lg py-0.5 px-2 text-white font-mono text-[15px] focus:outline-none"
                    />
                  </td>
                  <td className="p-1.5 min-w-[80px]">
                    <input 
                      type="number" name="returnShippingCost" value={inputs.returnShippingCost} onChange={handleInputChange}
                      className="w-full bg-background/50 border border-border rounded-lg py-0.5 px-2 text-white font-mono text-[15px] focus:outline-none"
                    />
                  </td>
                  <td className="p-1.5 min-w-[80px]">
                    <input 
                      type="number" name="adsCost" value={inputs.adsCost} onChange={handleInputChange}
                      className="w-full bg-background/50 border border-border rounded-lg py-0.5 px-2 text-white font-mono text-[15px] focus:outline-none"
                    />
                  </td>
                  <td className="p-1.5 min-w-[140px]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[12px] text-slate-500 uppercase font-bold">Conf</span>
                        <div className="relative">
                          <input type="number" name="confirmationRate" value={inputs.confirmationRate} onChange={handleInputChange} className="w-16 bg-background/50 border border-border rounded px-1 pr-4 text-[15px] text-white font-mono text-right" />
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[12px] text-slate-500 uppercase font-bold">Canc</span>
                        <div className="relative">
                          <input type="number" name="cancellationRate" value={inputs.cancellationRate} onChange={handleInputChange} className="w-16 bg-background/50 border border-border rounded px-1 pr-4 text-[15px] text-red-400 font-mono text-right" />
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[12px] text-slate-500 uppercase font-bold">Dev</span>
                        <div className="relative">
                          <input type="number" name="returnRate" value={inputs.returnRate} onChange={handleInputChange} className="w-16 bg-background/50 border border-border rounded px-1 pr-4 text-[15px] text-gold font-mono text-right" />
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">%</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-1.5 min-w-[60px]">
                    <input 
                      type="number" name="platformFee" value={inputs.platformFee} onChange={handleInputChange}
                      className="w-full bg-background/50 border border-border rounded-lg py-0.5 px-2 text-white font-mono text-[15px] focus:outline-none"
                    />
                  </td>
                  <td className="p-1.5">
                    <p className={`font-mono font-bold text-[15px] ${results.netProfit >= 0 ? 'text-white' : 'text-red-400'}`}>
                      {formatLocalCurrency(results.netProfit)}
                    </p>
                  </td>
                  <td className="p-1.5">
                    <p className={`font-mono font-bold text-[15px] ${results.margin > 15 ? 'text-neon' : 'text-gold'}`}>
                      {Math.round(results.margin || 0)}%
                    </p>
                  </td>
                  {isProjectionActive && (
                    <td className="p-1.5">
                      <p className={`font-mono font-bold text-[15px] ${results.netProfit * projectionOrders - results.totalFixedExpenses >= 0 ? 'text-neon' : 'text-red-400'}`}>
                        {formatLocalCurrency(results.netProfit * projectionOrders - results.totalFixedExpenses)}
                      </p>
                    </td>
                  )}
                  <td className="p-1.5">
                    <button 
                      onClick={handleSave}
                      className="bg-neon text-background p-1 rounded-lg hover:scale-110 transition-all"
                      title="Guardar"
                    >
                      <Save size={12} />
                    </button>
                  </td>
                </tr>

                {/* Saved Products Rows */}
                {savedProducts.map((product) => (
                  <tr 
                    key={product.id} 
                    id={`row-${product.id}`}
                    className={`border-b border-border/30 hover:bg-white/5 transition-all duration-500 ${highlightedProductId === product.id ? 'bg-neon/20' : ''} ${selectedProductIds.includes(product.id) ? 'bg-neon/5' : ''}`}
                  >
                    <td className="p-2">
                      <button onClick={() => toggleSelectProduct(product.id)} className="p-1 hover:text-neon transition-colors text-slate-500">
                        {selectedProductIds.includes(product.id) ? <CheckSquare size={14} className="text-neon" /> : <Square size={14} />}
                      </button>
                    </td>
                    <td className="p-2 min-w-[200px]">
                      <div className="flex flex-col">
                        <span className="text-white text-[15px] font-bold truncate max-w-[180px]">{product.name}</span>
                        <span className="text-slate-500 text-[15px] font-mono">{product.productId}</span>
                      </div>
                    </td>
                    <td className="p-2 text-[15px] font-mono text-white">
                      {formatLocalCurrency(product.inputs.price, product.currency)}
                    </td>
                    <td className="p-2 text-[15px] font-mono text-white">
                      {formatLocalCurrency(product.inputs.cost, product.currency)}
                    </td>
                    <td className="p-2 text-[15px] font-mono text-slate-400">
                      {formatLocalCurrency(product.inputs.shippingCharged, product.currency)}
                    </td>
                    <td className="p-2 text-[15px] font-mono text-slate-400">
                      {formatLocalCurrency(product.inputs.shippingReal, product.currency)}
                    </td>
                    <td className="p-2 text-[15px] font-mono text-slate-400">
                      {formatLocalCurrency(product.inputs.returnShippingCost || (product.inputs.shippingReal * 0.5), product.currency)}
                    </td>
                    <td className="p-2 text-[15px] font-mono text-slate-400">
                      {formatLocalCurrency(product.inputs.adsCost, product.currency)}
                    </td>
                    <td className="p-2 min-w-[120px]">
                      <div className="flex flex-col text-[15px] font-mono">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-[12px] uppercase font-bold">C:</span>
                          <span className="text-white">{product.inputs.confirmationRate}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-[12px] uppercase font-bold">X:</span>
                          <span className="text-red-400">{product.inputs.cancellationRate}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-[12px] uppercase font-bold">D:</span>
                          <span className="text-gold">{product.inputs.returnRate}%</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 text-[15px] font-mono text-slate-400">
                      {product.inputs.platformFee}%
                    </td>
                    <td className="p-2">
                      <p className={`font-mono font-bold text-[15px] ${product.results.netProfit >= 0 ? 'text-neon' : 'text-red-400'}`}>
                        {formatLocalCurrency(product.results.netProfit, product.currency)}
                      </p>
                    </td>
                    <td className="p-2">
                      <p className={`font-mono font-bold text-[15px] ${product.results.margin > 15 ? 'text-neon' : 'text-gold'}`}>
                        {Math.round(product.results.margin || 0)}%
                      </p>
                    </td>
                    {isProjectionActive && (
                      <td className="p-2">
                        <p className={`font-mono font-bold text-[15px] ${product.results.netProfit * projectionOrders - product.results.totalFixedExpenses >= 0 ? 'text-neon' : 'text-red-400'}`}>
                          {formatLocalCurrency(product.results.netProfit * projectionOrders - product.results.totalFixedExpenses, product.currency)}
                        </p>
                      </td>
                    )}
                    <td className="p-2">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => loadProduct(product)}
                        className="px-2 py-1 bg-neon/10 hover:bg-neon text-neon hover:text-black border border-neon/20 rounded-lg transition-all flex items-center gap-1"
                        title="Editar"
                      >
                        <CalcIcon size={14} />
                        <span className="text-[13px] font-bold uppercase">Editar</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(product.id)}
                        className="px-2 py-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-lg transition-all flex items-center gap-1"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                        <span className="text-[13px] font-bold uppercase">Eliminar</span>
                      </button>
                    </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-2 bg-neon/5 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-[15px] text-slate-400 italic">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-neon" />
                <span>Punto Equilibrio: <span className="text-white font-mono">{formatLocalCurrency(results.breakEven)}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-neon" />
                <span>ROI: <span className="text-white font-mono">{Math.round(results.roi || 0)}%</span></span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {selectedProductIds.length > 0 && (
                <button 
                  onClick={handleDeleteSelected}
                  className="bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-lg text-[13px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                >
                  <Trash2 size={12} />
                  Borrar Seleccionados ({selectedProductIds.length})
                </button>
              )}
              <button 
                onClick={handleDeleteAll}
                className="bg-slate-800 border border-slate-700 px-3 py-1 rounded-lg text-[13px] font-bold uppercase tracking-widest text-slate-400 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
              >
                <Trash2 size={12} />
                Borrar Todo
              </button>
              <div className="text-[13px] text-slate-500 font-mono ml-2">
                {savedProducts.length} registros
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Products List */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <FileText className="text-neon" size={18} /> Productos Registrados
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={handleDeleteSelected}
              disabled={selectedProductIds.length === 0}
              className={`px-4 py-2 rounded-xl text-[13px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl ${
                selectedProductIds.length > 0 
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/40 scale-105' 
                : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Trash2 size={16} />
              Eliminar Seleccionados {selectedProductIds.length > 0 && `(${selectedProductIds.length})`}
            </button>
            <button 
              onClick={toggleSelectAll}
              className={`bg-card border border-border px-3 py-2 rounded-xl text-[13px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${selectedProductIds.length === savedProducts.length && savedProducts.length > 0 ? 'text-neon border-neon/50' : 'text-slate-400 hover:text-white hover:border-neon/30'}`}
            >
              {selectedProductIds.length === savedProducts.length && savedProducts.length > 0 ? <CheckSquare size={14} /> : <Square size={14} />}
              {selectedProductIds.length === savedProducts.length && savedProducts.length > 0 ? 'Deseleccionar' : 'Seleccionar Todo'}
            </button>
            <label className="cursor-pointer bg-card border border-border hover:border-neon/50 px-3 py-2 rounded-xl text-[13px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center gap-2">
              <Upload size={14} className="text-neon" />
              Importar
              <input type="file" accept=".xlsx, .xls" onChange={importFromExcel} className="hidden" />
            </label>
            <button 
              onClick={exportToExcel}
              className="bg-card border border-border hover:border-neon/50 px-3 py-2 rounded-xl text-[13px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center gap-2"
            >
              <Download size={14} className="text-neon" />
              Exportar
            </button>
            <button 
              onClick={handleDeleteAll}
              className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl text-[13px] font-bold uppercase tracking-widest text-slate-400 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
            >
              <Trash2 size={14} />
              Borrar Todo
            </button>
            <span className="text-[13px] text-slate-500 font-mono ml-2">{savedProducts.length} registros</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {savedProducts.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`glass-card p-3 space-y-2 group hover:border-neon/30 transition-all relative ${selectedProductIds.includes(product.id) ? 'border-neon/50 bg-neon/5' : ''}`}
              >
                <button 
                  onClick={() => toggleSelectProduct(product.id)}
                  className="absolute top-2 left-2 p-1 text-slate-500 hover:text-neon transition-colors z-10"
                >
                  {selectedProductIds.includes(product.id) ? <CheckSquare size={14} className="text-neon" /> : <Square size={14} />}
                </button>
                <div className="flex justify-between items-start pl-8 pr-2">
                  <div className="space-y-0.5">
                    <h4 className="text-[15px] font-bold text-white truncate max-w-[180px]">{product.name}</h4>
                    <p className="text-[15px] font-mono text-slate-500">{product.productId}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {product.url && (
                      <a href={product.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-500 hover:text-neon hover:bg-neon/10 rounded-lg transition-all" title="Ver enlace">
                        <ExternalLink size={12} />
                      </a>
                    )}
                    <button 
                      onClick={() => handleDelete(product.id)} 
                      className="px-2 py-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-lg transition-all flex items-center gap-1"
                      title="Eliminar este pedido"
                    >
                      <Trash2 size={12} />
                      <span className="text-[13px] font-bold uppercase">Eliminar</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 py-1.5 border-y border-border/50">
                  <div className="space-y-1">
                    <p className="text-[13px] uppercase tracking-widest text-slate-500">Métricas Op.</p>
                    <div className="flex flex-col gap-0.5 text-[15px] font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[12px] uppercase font-bold">Conf:</span>
                        <span className="text-white">{product.inputs.confirmationRate}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[12px] uppercase font-bold">Canc:</span>
                        <span className="text-red-400">{product.inputs.cancellationRate}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[12px] uppercase font-bold">Dev:</span>
                        <span className="text-gold">{product.inputs.returnRate}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[13px] uppercase tracking-widest text-slate-500">Ganancia</p>
                    <p className={`text-[15px] font-mono font-bold ${product.results.netProfit >= 0 ? 'text-neon' : 'text-red-400'}`}>
                      {formatLocalCurrency(product.results.netProfit, product.currency)}
                    </p>
                    <p className="text-[13px] uppercase tracking-widest text-slate-500">Margen</p>
                    <p className={`text-[15px] font-mono font-bold ${product.results.margin > 15 ? 'text-neon' : 'text-gold'}`}>
                      {Math.round(product.results.margin || 0)}%
                    </p>
                  </div>
                </div>

                {product.notes && (
                  <p className="text-[13px] text-slate-400 line-clamp-2 italic">"{product.notes}"</p>
                )}

                {isProjectionActive && (
                  <div className="py-2 border-t border-border/30">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <Package size={10} className="text-slate-500" />
                        <span className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">x{projectionOrders} Pedidos:</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-[14px] font-mono font-bold ${product.results.netProfit * projectionOrders - product.results.totalFixedExpenses >= 0 ? 'text-neon' : 'text-red-400'}`}>
                          {formatLocalCurrency(product.results.netProfit * projectionOrders - product.results.totalFixedExpenses, product.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => viewInExcel(product.id)}
                    className="flex-1 py-1 text-[13px] font-bold uppercase tracking-widest text-slate-500 hover:text-neon border border-border hover:border-neon/30 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <TableIcon size={10} /> Ver
                  </button>
                  <button 
                    onClick={() => loadProduct(product)}
                    className="flex-1 py-1 text-[13px] font-bold uppercase tracking-widest text-slate-500 hover:text-neon border border-border hover:border-neon/30 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <CalcIcon size={10} /> Editar
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {savedProducts.length === 0 && (
            <div className="col-span-full py-8 flex flex-col items-center justify-center text-slate-500 border border-dashed border-border rounded-2xl">
              <CalcIcon size={32} className="mb-2 opacity-20" />
              <p className="text-[13px]">No hay productos guardados aún.</p>
              <p className="text-[13px]">Realiza una simulación y haz clic en "Guardar Producto".</p>
            </div>
          )}
        </div>
      </div>
      {/* Floating Selection Bar (Shopify Style) */}
      <AnimatePresence>
        {selectedProductIds.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-2xl"
          >
            <div className="bg-slate-900/90 backdrop-blur-md border border-neon/30 rounded-2xl p-4 shadow-2xl shadow-neon/20 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-neon/20 p-2 rounded-lg">
                  <CheckSquare size={18} className="text-neon" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{selectedProductIds.length} seleccionados</p>
                  <p className="text-slate-400 text-[13px] uppercase tracking-widest">Acciones en lote</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleSelectAll}
                  className="px-4 py-2 rounded-xl text-[13px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-all"
                >
                  Deseleccionar
                </button>
                <button 
                  onClick={handleDeleteSelected}
                  className="bg-red-500 text-white px-6 py-2 rounded-xl text-[13px] font-bold uppercase tracking-widest hover:bg-red-600 transition-all flex items-center gap-2 shadow-lg shadow-red-500/20"
                >
                  <Trash2 size={14} />
                  Eliminar Selección
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 max-w-sm w-full space-y-4 border-neon/30"
            >
              <div className="flex items-center gap-3 text-gold">
                <AlertTriangle size={24} />
                <h4 className="text-lg font-display font-bold text-white">¿Confirmar Acción?</h4>
              </div>
              <p className="text-sm text-slate-400">
                {showConfirm.type === 'deleteSelected' 
                  ? `¿Estás seguro de que deseas eliminar ${showConfirm.count} productos seleccionados?`
                  : showConfirm.type === 'deleteAll'
                  ? '¿Estás seguro de que deseas eliminar TODOS los productos registrados? Esta acción no se puede deshacer.'
                  : '¿Estás seguro de que deseas eliminar este producto?'}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 py-2 rounded-xl border border-border text-slate-400 hover:text-white transition-all text-[13px] font-bold uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all text-[13px] font-bold uppercase tracking-widest"
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
