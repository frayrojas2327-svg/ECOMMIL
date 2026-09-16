import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { 
  Truck, TrendingDown, ShieldCheck, Zap, Globe, Search, MapPin, Map, 
  AlertTriangle, AlertCircle, ChevronRight, Sliders, Bot, Sparkles, Loader2,
  X, Filter, Building2, ArrowRight
} from 'lucide-react';
import { Order, CurrencyCode } from '../mockData';
import Markdown from 'react-markdown';
import { getClientGeminiApiKeys } from '../services/aiConfigService';

interface ShippingAnalysisProps {
  orders: Order[];
  formatCurrency: (amount: number) => string;
  currency?: CurrencyCode;
  currencies?: any;
  isConversionActive?: boolean;
}

const ShippingAnalysis: React.FC<ShippingAnalysisProps> = ({ orders, formatCurrency, currency = 'USD', currencies = {}, isConversionActive = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'departamento' | 'ciudad' | 'transportadora'>('departamento');
  const [semaforoFilter, setSemaforoFilter] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState('');
  const [selectedCarrierFilter, setSelectedCarrierFilter] = useState('');
  
  // Tag Filtering states (sin etiqueta / TikTok Orgánico)
  const [tagFilter, setTagFilter] = useState<'all' | 'sin_etiqueta' | 'tiktok_organico'>('all');

  // Product Filtering states
  const [productFilter, setProductFilter] = useState<string>('all');

  // Extract unique products list from orders
  const uniqueProducts = useMemo(() => {
    const productsSet = new Set<string>();
    orders.forEach(o => {
      if (o.product) {
        productsSet.add(o.product);
      }
    });
    return Array.from(productsSet).sort();
  }, [orders]);

  // Ecommil AI Analysis states
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Mobile viewport detection to optimize chart rendering dynamically
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const localFormatCurrency = (amount: number) => {
    const isUSD = !isConversionActive;
    const targetCurrency = isUSD ? 'USD' : currency;
    const rate = currencies[currency]?.rate || 1;
    
    let converted = amount;
    if (!isUSD) {
      converted = amount * rate;
    }
    
    const rounded = Math.round(converted);
    
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: targetCurrency,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(rounded);
  };

  // Memoized filter for upstream orders based on tag filter choice and product filter choice
  const filteredOrders = useMemo(() => {
    let res = orders;
    if (tagFilter === 'sin_etiqueta') {
      res = orders.filter(o => !o.tags || o.tags.trim() === '');
    } else if (tagFilter === 'tiktok_organico') {
      res = orders.filter(o => o.tags?.toLowerCase().includes('tik') && o.tags?.toLowerCase().includes('organ'));
    }
    
    if (productFilter && productFilter !== 'all') {
      if (productFilter === 'sin_producto') {
        res = res.filter(o => !o.product || o.product.trim() === '');
      } else {
        res = res.filter(o => o.product === productFilter);
      }
    }
    
    return res;
  }, [orders, tagFilter, productFilter]);

  const stats = useMemo(() => {
    // Exclude cancelled orders for shipping dynamics and deliverability calculations
    const totalOrdersCount = filteredOrders.length;
    const shippedOrders = filteredOrders.filter(o => o.status !== 'Cancelado');
    
    let totalCharged = 0;
    let totalReal = 0;
    let absorbedLossCount = 0;
    
    // Aggregates
    const deptData: Record<string, { total: number; delivered: number; returned: number; charged: number; real: number; cities: Set<string> }> = {};
    const cityData: Record<string, { total: number; delivered: number; returned: number; dept: string; charged: number; real: number; carriers: Set<string> }> = {};
    const carrierData: Record<string, { total: number; delivered: number; returned: number; active: number; charged: number; real: number; incidentCount: number; depts: Set<string> }> = {};

    shippedOrders.forEach(o => {
      totalCharged += o.shippingCharged;
      totalReal += o.shippingReal;
      
      if (o.shippingCharged < o.shippingReal) {
        absorbedLossCount++;
      }

      const statusLower = (o.status || '').trim().toLowerCase();
      const isDelivered = statusLower === 'entregado' || statusLower === 'exitoso' || statusLower === 'finalizado' || statusLower === 'cod pagado';
      const isReturned = statusLower === 'devuelto' || statusLower === 'devolución' || statusLower === 'devolucion' || statusLower === 'retorno';

      // Dept aggregate
      const deptRaw = o.departamentoDestino || 'No especificado';
      const dept = deptRaw.trim().toUpperCase();
      if (!deptData[dept]) {
        deptData[dept] = { total: 0, delivered: 0, returned: 0, charged: 0, real: 0, cities: new Set() };
      }
      deptData[dept].total++;
      deptData[dept].charged += o.shippingCharged;
      deptData[dept].real += o.shippingReal;
      if (isDelivered) deptData[dept].delivered++;
      else if (isReturned) deptData[dept].returned++;

      // City aggregate
      const cityRaw = o.ciudadDestino || 'No especificada';
      const city = cityRaw.trim().toUpperCase();
      deptData[dept].cities.add(city);
      if (!cityData[city]) {
        cityData[city] = { total: 0, delivered: 0, returned: 0, dept: dept, charged: 0, real: 0, carriers: new Set() };
      }
      cityData[city].total++;
      cityData[city].charged += o.shippingCharged;
      cityData[city].real += o.shippingReal;
      if (isDelivered) cityData[city].delivered++;
      else if (isReturned) cityData[city].returned++;
      if (o.transportadora) {
        cityData[city].carriers.add(o.transportadora.trim().toUpperCase());
      }

      // Carrier aggregate
      const carrierRaw = o.transportadora || 'No especificada';
      const carrier = carrierRaw.trim().toUpperCase();
      if (!carrierData[carrier]) {
        carrierData[carrier] = { total: 0, delivered: 0, returned: 0, active: 0, charged: 0, real: 0, incidentCount: 0, depts: new Set() };
      }
      carrierData[carrier].total++;
      carrierData[carrier].charged += o.shippingCharged;
      carrierData[carrier].real += o.shippingReal;
      if (isDelivered) carrierData[carrier].delivered++;
      else if (isReturned) carrierData[carrier].returned++;
      else {
        carrierData[carrier].active++;
        if (statusLower === 'incidencia' || statusLower === 'novedad') {
          carrierData[carrier].incidentCount++;
        }
      }
      if (o.departamentoDestino) {
        carrierData[carrier].depts.add(o.departamentoDestino.trim().toUpperCase());
      }
    });

    // Lists with Delivery Rate and Semáforo computation
    const deptsList = Object.entries(deptData).map(([name, data]) => {
      const deliveryRate = data.total > 0 ? (data.delivered / data.total) * 100 : 0;
      let status: 'green' | 'yellow' | 'red' = 'yellow';
      if (deliveryRate >= 80) status = 'green';
      else if (deliveryRate < 60) status = 'red';
      
      const loss = data.real - data.charged;

      return {
        name,
        total: data.total,
        delivered: data.delivered,
        returned: data.returned,
        deliveryRate,
        status,
        loss,
        charged: data.charged,
        real: data.real,
        citiesCount: data.cities ? data.cities.size : 0
      };
    }).sort((a, b) => b.total - a.total);

    const citiesList = Object.entries(cityData).map(([name, data]) => {
      const deliveryRate = data.total > 0 ? (data.delivered / data.total) * 100 : 0;
      let status: 'green' | 'yellow' | 'red' = 'yellow';
      if (deliveryRate >= 80) status = 'green';
      else if (deliveryRate < 60) status = 'red';

      const loss = data.real - data.charged;

      return {
        name,
        dept: data.dept,
        total: data.total,
        delivered: data.delivered,
        returned: data.returned,
        deliveryRate,
        status,
        loss,
        charged: data.charged,
        real: data.real,
        carriers: Array.from(data.carriers)
      };
    }).sort((a, b) => b.total - a.total);

    const carriersList = Object.entries(carrierData).map(([name, data]) => {
      const deliveryRate = data.total > 0 ? (data.delivered / data.total) * 100 : 0;
      let status: 'green' | 'yellow' | 'red' = 'yellow';
      if (deliveryRate >= 80) status = 'green';
      else if (deliveryRate < 60) status = 'red';

      const loss = data.real - data.charged;

      return {
        name,
        total: data.total,
        delivered: data.delivered,
        returned: data.returned,
        active: data.active,
        incidentCount: data.incidentCount,
        deliveryRate,
        status,
        loss,
        charged: data.charged,
        real: data.real,
        depts: Array.from(data.depts)
      };
    }).sort((a, b) => b.total - a.total);

    const globalDelivered = shippedOrders.filter(o => {
      const statusLower = (o.status || '').trim().toLowerCase();
      return statusLower === 'entregado' || statusLower === 'exitoso' || statusLower === 'finalizado' || statusLower === 'cod pagado';
    }).length;
    const globalRate = totalOrdersCount > 0 ? (globalDelivered / totalOrdersCount) * 100 : 0;
    
    let globalSemaf: 'green' | 'yellow' | 'red' = 'yellow';
    if (globalRate >= 80) globalSemaf = 'green';
    else if (globalRate < 60) globalSemaf = 'red';

    const absorbedRate = totalOrdersCount > 0 ? (absorbedLossCount / totalOrdersCount) * 100 : 0;
    const totalShippingLoss = totalReal - totalCharged;

    return { 
      totalCharged, 
      totalReal, 
      absorbedRate, 
      totalShippingLoss, 
      globalRate, 
      globalSemaf, 
      totalOrdersCount,
      deptsList, 
      citiesList, 
      carriersList 
    };
  }, [filteredOrders]);

  const runAiDiagnostic = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const apiKeys = getClientGeminiApiKeys();
      const response = await fetch("/api/analisis-fletes-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalCharged: stats.totalCharged,
          totalReal: stats.totalReal,
          totalShippingLoss: stats.totalShippingLoss,
          globalRate: stats.globalRate,
          deptsList: stats.deptsList.slice(0, 8),
          citiesList: stats.citiesList.slice(0, 15),
          carriersList: stats.carriersList,
          tagFilter: tagFilter,
          apiKeys
        })
      });
      if (!response.ok) {
        throw new Error("Ocurrió un problema de comunicación con Ecommil IA.");
      }
      const data = await response.json();
      setAiResult(data.analysisText);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Error al solicitar análisis. Por favor intenta de nuevo.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleDeptFilterChange = (newDept: string) => {
    setSelectedDeptFilter(newDept);
    // If a city is currently selected and does not belong to newDept, reset city
    if (selectedCityFilter && newDept) {
      const cityObj = stats.citiesList.find(c => c.name === selectedCityFilter);
      if (cityObj && cityObj.dept !== newDept) {
        setSelectedCityFilter('');
      }
    }
  };

  const handleCityFilterChange = (newCity: string) => {
    setSelectedCityFilter(newCity);
    if (newCity) {
      const cityObj = stats.citiesList.find(c => c.name === newCity);
      if (cityObj && cityObj.dept) {
        setSelectedDeptFilter(cityObj.dept);
      }
    }
  };

  const clearAllFilters = () => {
    setSelectedDeptFilter('');
    setSelectedCityFilter('');
    setSelectedCarrierFilter('');
    setSemaforoFilter('all');
    setTagFilter('all');
    setProductFilter('all');
    setSearchTerm('');
  };

  // Available cities list for the dropdown - dynamically filtered if a department is selected
  const availableCitiesForFilter = useMemo(() => {
    if (!selectedDeptFilter) {
      return stats.citiesList;
    }
    return stats.citiesList.filter(c => c.dept === selectedDeptFilter);
  }, [stats.citiesList, selectedDeptFilter]);

  // Currently selected department details object
  const currentSelectedDeptObj = useMemo(() => {
    if (!selectedDeptFilter) return null;
    return stats.deptsList.find(d => d.name === selectedDeptFilter) || null;
  }, [stats.deptsList, selectedDeptFilter]);

  // Filter elements computed dynamically
  const filteredDepts = useMemo(() => {
    return stats.deptsList.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSemaforo = semaforoFilter === 'all' || item.status === semaforoFilter;
      const matchDept = !selectedDeptFilter || item.name === selectedDeptFilter;
      return matchSearch && matchSemaforo && matchDept;
    });
  }, [stats.deptsList, searchTerm, semaforoFilter, selectedDeptFilter]);

  const filteredCities = useMemo(() => {
    return stats.citiesList.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.dept.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSemaforo = semaforoFilter === 'all' || item.status === semaforoFilter;
      const matchDept = !selectedDeptFilter || item.dept === selectedDeptFilter;
      const matchCity = !selectedCityFilter || item.name === selectedCityFilter;
      const matchCarrier = !selectedCarrierFilter || item.carriers.includes(selectedCarrierFilter);
      return matchSearch && matchSemaforo && matchDept && matchCity && matchCarrier;
    });
  }, [stats.citiesList, searchTerm, semaforoFilter, selectedDeptFilter, selectedCityFilter, selectedCarrierFilter]);

  const filteredCarriers = useMemo(() => {
    return stats.carriersList.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSemaforo = semaforoFilter === 'all' || item.status === semaforoFilter;
      const matchDept = !selectedDeptFilter || item.depts.includes(selectedDeptFilter);
      return matchSearch && matchSemaforo && matchDept;
    });
  }, [stats.carriersList, searchTerm, semaforoFilter, selectedDeptFilter]);

  // Calculate dynamic dataset for the secondary distribution chart based on selected tab view
  const chartData = useMemo(() => {
    let sourceList: any[] = [];
    let shouldSlice = false;
    let sliceLimit = 6;
    
    if (activeTab === 'departamento') {
      if (selectedDeptFilter) {
        // When a department is selected, show its cities in the chart!
        sourceList = filteredCities;
        shouldSlice = true;
        sliceLimit = 15;
      } else {
        sourceList = filteredDepts;
        shouldSlice = false; // Show all departments
      }
    } else if (activeTab === 'ciudad') {
      sourceList = filteredCities;
      shouldSlice = true;
      sliceLimit = 15; // Allow more cities for better readability if filtered
    } else {
      sourceList = filteredCarriers;
      shouldSlice = false; // Show all carriers
    }

    const itemsToProcess = shouldSlice ? sourceList.slice(0, sliceLimit) : sourceList;

    return itemsToProcess.map(item => ({
      name: item.name,
      'Tasa de Entrega': parseFloat(item.deliveryRate.toFixed(1)),
      total: item.total,
      status: item.status
    }));
  }, [activeTab, selectedDeptFilter, filteredDepts, filteredCities, filteredCarriers]);

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <Truck className="text-emerald-400" size={24} />
            Semáforos de Transportadora
          </h2>
          <p className="text-sm text-slate-500">Métricas avanzadas de distribución, fletes reales vs facturados y efectividad de transportadoras</p>
        </div>
        <div className="flex bg-background/50 rounded-lg p-0.5 border border-border w-fit">
          <div className={`px-3 py-1.5 flex items-center gap-2 text-[10px] font-black tracking-widest ${isConversionActive ? 'text-neon' : 'text-slate-500'}`}>
            <Globe size={14} />
            {isConversionActive ? `MONEDA: ${currency}` : 'MODO USD'}
          </div>
        </div>
      </div>

      {/* Modern Grid metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* SEMÁFORO GLOBAL CARD */}
        <div className={`glass-card p-5 border relative overflow-hidden flex flex-col justify-between ${
          stats.globalSemaf === 'green' ? 'border-emerald-500/20 bg-emerald-500/[0.02]' :
          stats.globalSemaf === 'yellow' ? 'border-amber-500/20 bg-amber-500/[0.02]' :
          'border-red-500/20 bg-red-500/[0.02]'
        }`}>
          <div className="flex justify-between items-start">
            <p className="text-[11px] uppercase font-bold tracking-widest text-slate-500">Semáforo General</p>
            <span className={`w-2.5 h-2.5 rounded-full ring-4 ${
              stats.globalSemaf === 'green' ? 'bg-emerald-500 ring-emerald-500/20 animate-pulse' :
              stats.globalSemaf === 'yellow' ? 'bg-amber-500 ring-amber-500/20 animate-pulse' :
              'bg-red-500 ring-red-500/20 animate-pulse'
            }`} />
          </div>
          <div className="mt-4">
            <h3 className={`text-3xl font-mono font-bold tracking-tight ${
              stats.globalSemaf === 'green' ? 'text-emerald-400' :
              stats.globalSemaf === 'yellow' ? 'text-amber-400' :
              'text-red-400'
            }`}>
              {stats.globalRate.toFixed(1)}%
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {stats.globalSemaf === 'green' ? '🟢 Operación altamente eficiente' :
               stats.globalSemaf === 'yellow' ? '🟡 Rendimiento regular' :
               '🔴 Alerta crítica de logística'}
            </p>
          </div>
        </div>

        {/* FLETE COBRADO TOTAL */}
        <div className="glass-card p-5 border border-slate-900 !bg-black flex flex-col justify-between">
          <p className="text-[11px] uppercase font-bold tracking-widest text-slate-500">Flete Facturado al Cliente</p>
          <div className="mt-4">
            <h3 className="text-3xl font-mono font-bold text-white leading-none">{localFormatCurrency(stats.totalCharged)}</h3>
            <p className="text-xs text-slate-500 mt-1">Recaudado de pedidos consolidados</p>
          </div>
        </div>

        {/* FLETE REAL PAGADO */}
        <div className="glass-card p-5 border border-slate-900 !bg-black flex flex-col justify-between">
          <p className="text-[11px] uppercase font-bold tracking-widest text-slate-500">Flete Real de Envío</p>
          <div className="mt-4">
            <h3 className="text-3xl font-mono font-bold text-slate-300 leading-none">{localFormatCurrency(stats.totalReal)}</h3>
            <p className="text-xs text-slate-500 mt-1">Costo cobrado por transportadoras</p>
          </div>
        </div>

        {/* PÉRDIDA LOGÍSTICA */}
        <div className={`glass-card p-5 border flex flex-col justify-between ${
          stats.totalShippingLoss > 0 ? 'border-red-500/20 bg-red-500/[0.03]' : 'border-emerald-500/20 bg-emerald-500/[0.03]'
        }`}>
          <p className="text-[11px] uppercase font-bold tracking-widest text-slate-500">Déficit / Diferencia Fletes</p>
          <div className="mt-4">
            <h3 className={`text-3xl font-mono font-bold leading-none ${
              stats.totalShippingLoss > 0 ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {localFormatCurrency(stats.totalShippingLoss)}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {stats.totalShippingLoss > 0 
                ? `⚠️ Absorbiendo el ${(stats.absorbedRate || 0).toFixed(1)}% del costo` 
                : '✅ Beneficio a favor en despachos'
              }
            </p>
          </div>
        </div>
      </div>

      {/* INTERACTIVE SEMÁFORO CONTROL / SELECTOR PANEL */}
      <div className="glass-card p-6 border border-slate-900 !bg-black flex flex-col lg:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.01] via-amber-500/[0.01] to-rose-500/[0.01] pointer-events-none" />
        <div className="space-y-1.5 z-10 text-center lg:text-left">
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2 justify-center lg:justify-start">
            <Sliders size={18} className="text-emerald-400" />
            Semáforo Inteligente Interactiva
          </h3>
          <p className="text-xs text-slate-400">
            Filtra de inmediato todas las estadísticas, transportes y ciudades haciendo clic en las luces de alerta.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center justify-center z-10 shrink-0">
          {/* SEMAFORO ALL BUTTON */}
          <button
            onClick={() => setSemaforoFilter('all')}
            className={`px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all duration-200 border cursor-pointer ${
              semaforoFilter === 'all'
                ? 'bg-slate-800 border-slate-700 text-white shadow-lg'
                : 'bg-transparent border-slate-900 text-slate-500 hover:text-slate-300'
            }`}
          >
            Todos ({stats.totalOrdersCount} Envíos)
          </button>

          {/* GREEN OPTION */}
          <button
            onClick={() => setSemaforoFilter(semaforoFilter === 'green' ? 'all' : 'green')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 cursor-pointer ${
              semaforoFilter === 'green'
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.12)] scale-105'
                : 'bg-black border-slate-900 text-slate-400 hover:border-emerald-500/30'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${semaforoFilter === 'green' ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-emerald-400/40'}`} />
            <div className="text-left leading-none">
              <p className="text-[10px] font-bold uppercase tracking-wider">Óptimo</p>
              <p className="text-[9px] text-slate-500 mt-0.5">&gt;= 80% entrega</p>
            </div>
          </button>

          {/* YELLOW OPTION */}
          <button
            onClick={() => setSemaforoFilter(semaforoFilter === 'yellow' ? 'all' : 'yellow')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 cursor-pointer ${
              semaforoFilter === 'yellow'
                ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.12)] scale-105'
                : 'bg-black border-slate-900 text-slate-400 hover:border-amber-500/30'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${semaforoFilter === 'yellow' ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-amber-400/40'}`} />
            <div className="text-left leading-none">
              <p className="text-[10px] font-bold uppercase tracking-wider">Observación</p>
              <p className="text-[9px] text-slate-500 mt-0.5">60% - 79% entrega</p>
            </div>
          </button>

          {/* RED OPTION */}
          <button
            onClick={() => setSemaforoFilter(semaforoFilter === 'red' ? 'all' : 'red')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 cursor-pointer ${
              semaforoFilter === 'red'
                ? 'bg-rose-500/10 border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(239,68,68,0.12)] scale-105'
                : 'bg-black border-slate-900 text-slate-400 hover:border-rose-500/30'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${semaforoFilter === 'red' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-red-400/40'}`} />
            <div className="text-left leading-none">
              <p className="text-[10px] font-bold uppercase tracking-wider">Crítico</p>
              <p className="text-[9px] text-slate-500 mt-0.5">&lt; 60% entrega</p>
            </div>
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER: GRID WITH GRAPHIC & SEARCH DETAILS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN (COL-SPAN 2): INTERACTIVE TABLE DETAILS */}
        <div className="lg:col-span-2 glass-card p-6 border border-slate-900 !bg-black flex flex-col justify-between text-[15px]">
          <div>
            {/* Filters Toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-5 mb-5 w-full">
              {/* Department Dropdown */}
              <div className="relative">
                <select
                  value={selectedDeptFilter}
                  onChange={(e) => handleDeptFilterChange(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg text-[13px] py-1.5 pl-2.5 pr-7 text-slate-300 focus:outline-none focus:border-emerald-500/40 cursor-pointer w-full sm:w-44 occurrence-none appearance-none font-bold truncate"
                >
                  <option value="">📍 Todos los Deptos ({stats.deptsList.length})</option>
                  {stats.deptsList.map(dept => (
                    <option key={dept.name} value={dept.name}>
                      {dept.name} ({dept.total})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500 text-[10px]">
                  ▼
                </div>
              </div>

              {/* City Dropdown (hierarchically filtered by selectedDeptFilter) */}
                <div className="relative">
                  <select
                    value={selectedCityFilter}
                    onChange={(e) => handleCityFilterChange(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg text-[13px] py-1.5 pl-2.5 pr-7 text-slate-300 focus:outline-none focus:border-emerald-500/40 cursor-pointer w-full sm:w-44 occurrence-none appearance-none font-bold truncate"
                  >
                    <option value="">
                      {selectedDeptFilter 
                        ? `🏙️ Ciudades de ${selectedDeptFilter} (${availableCitiesForFilter.length})` 
                        : `🏙️ Todas las Ciudades (${stats.citiesList.length})`}
                    </option>
                    {availableCitiesForFilter.map(city => (
                      <option key={city.name} value={city.name}>
                        {city.name} {!selectedDeptFilter ? `(${city.dept})` : ''} ({city.total})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500 text-[10px]">
                    ▼
                  </div>
                </div>

                {/* Carrier Dropdown */}
                <div className="relative">
                  <select
                    value={selectedCarrierFilter}
                    onChange={(e) => setSelectedCarrierFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg text-[13px] py-1.5 pl-2.5 pr-7 text-slate-300 focus:outline-none focus:border-emerald-500/40 cursor-pointer w-full sm:w-36 occurrence-none appearance-none font-bold truncate"
                  >
                    <option value="">🚚 Todas Carriers ({stats.carriersList.length})</option>
                    {stats.carriersList.map(carrier => (
                      <option key={carrier.name} value={carrier.name}>
                        {carrier.name} ({carrier.total})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500 text-[10px]">
                    ▼
                  </div>
                </div>

                {/* Filtro por Canal / Tag */}
                <div className="relative w-full sm:w-36 shrink-0">
                  <select
                    value={tagFilter}
                    onChange={(e) => {
                      setTagFilter(e.target.value as any);
                      setAiResult(null);
                      setAiError(null);
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-lg text-[13px] py-1.5 pl-2.5 pr-7 text-slate-300 focus:outline-none focus:border-emerald-500/40 cursor-pointer w-full occurrence-none appearance-none font-bold"
                  >
                    <option value="all">Canal: Todos</option>
                    <option value="sin_etiqueta">Sin Etiqueta</option>
                    <option value="tiktok_organico">TikTok Orgánico 🏷️</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500 text-[10px]">
                    ▼
                  </div>
                </div>

                {/* Filtro por Producto */}
                <div className="relative w-full sm:w-40 shrink-0">
                  <select
                    value={productFilter}
                    onChange={(e) => {
                      setProductFilter(e.target.value);
                      setAiResult(null);
                      setAiError(null);
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-lg text-[13px] py-1.5 pl-2.5 pr-7 text-slate-300 focus:outline-none focus:border-emerald-500/40 cursor-pointer w-full occurrence-none appearance-none font-bold truncate"
                  >
                    <option value="all">📦 Todos los Productos</option>
                    <option value="sin_producto">Sin Producto</option>
                    {uniqueProducts.map(p => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500 text-[10px]">
                    ▼
                  </div>
                </div>

                {/* Quick Search */}
                <div className="relative w-full sm:w-36 shrink-0">
                  <Search size={14} className="absolute left-2.5 top-[11px] text-slate-500" />
                  <input
                    type="text"
                    placeholder={`Buscar...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-[13px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40"
                  />
                </div>
              </div>

            {/* ACTIVE FILTERS CHIPS BAR */}
            {(selectedDeptFilter || selectedCityFilter || semaforoFilter !== 'all' || selectedCarrierFilter || tagFilter !== 'all' || productFilter !== 'all' || searchTerm) && (
              <div className="mb-4 flex flex-wrap items-center gap-2 bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-xl text-xs">
                <span className="text-slate-500 font-mono flex items-center gap-1 shrink-0">
                  <Filter size={12} /> Filtros Activos:
                </span>

                {selectedDeptFilter && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                    <span>📍 Depto: {selectedDeptFilter}</span>
                    <button
                      onClick={() => handleDeptFilterChange('')}
                      className="hover:text-white cursor-pointer ml-0.5"
                      title="Eliminar filtro departamento"
                    >
                      <X size={13} />
                    </button>
                  </span>
                )}

                {selectedCityFilter && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold">
                    <span>🏙️ Ciudad: {selectedCityFilter}</span>
                    <button
                      onClick={() => handleCityFilterChange('')}
                      className="hover:text-white cursor-pointer ml-0.5"
                      title="Eliminar filtro ciudad"
                    >
                      <X size={13} />
                    </button>
                  </span>
                )}

                {semaforoFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold">
                    <span>{semaforoFilter === 'green' ? '🟢 Óptimo' : semaforoFilter === 'yellow' ? '🟡 En Observación' : '🔴 Crítico'}</span>
                    <button
                      onClick={() => setSemaforoFilter('all')}
                      className="hover:text-white cursor-pointer ml-0.5"
                      title="Eliminar filtro semáforo"
                    >
                      <X size={13} />
                    </button>
                  </span>
                )}

                {selectedCarrierFilter && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold">
                    <span>🚚 {selectedCarrierFilter}</span>
                    <button
                      onClick={() => setSelectedCarrierFilter('')}
                      className="hover:text-white cursor-pointer ml-0.5"
                    >
                      <X size={13} />
                    </button>
                  </span>
                )}

                {tagFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold">
                    <span>🏷️ {tagFilter === 'tiktok_organico' ? 'TikTok Orgánico' : 'Sin Etiqueta'}</span>
                    <button
                      onClick={() => setTagFilter('all')}
                      className="hover:text-white cursor-pointer ml-0.5"
                    >
                      <X size={13} />
                    </button>
                  </span>
                )}

                {productFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-400 font-bold">
                    <span>📦 {productFilter === 'sin_producto' ? 'Sin Producto' : productFilter}</span>
                    <button
                      onClick={() => setProductFilter('all')}
                      className="hover:text-white cursor-pointer ml-0.5"
                    >
                      <X size={13} />
                    </button>
                  </span>
                )}

                {searchTerm && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-mono">
                    <span>Buscar: "{searchTerm}"</span>
                    <button
                      onClick={() => setSearchTerm('')}
                      className="hover:text-white cursor-pointer ml-0.5"
                    >
                      <X size={13} />
                    </button>
                  </span>
                )}

                <button
                  onClick={clearAllFilters}
                  className="ml-auto text-[11px] text-slate-400 hover:text-white underline cursor-pointer transition-colors"
                >
                  Limpiar todos los filtros
                </button>
              </div>
            )}

            {/* SECTIONS FOR DEPARTMENTS & CITIES */}

            {/* CASE 1: DEPARTMENT TAB WITH SELECTED DEPARTMENT (SPOTLIGHT CARD + ITS CITIES SECTION) */}
            {activeTab === 'departamento' && currentSelectedDeptObj && (
              <div className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-950 border border-emerald-500/30 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Map size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase font-mono tracking-widest text-slate-400">Departamento Filtrado</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                          currentSelectedDeptObj.status === 'green' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          currentSelectedDeptObj.status === 'yellow' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            currentSelectedDeptObj.status === 'green' ? 'bg-emerald-400' :
                            currentSelectedDeptObj.status === 'yellow' ? 'bg-amber-400' :
                            'bg-rose-400'
                          }`} />
                          {currentSelectedDeptObj.status === 'green' ? 'Óptimo' : currentSelectedDeptObj.status === 'yellow' ? 'En Observación' : 'Crítico'}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold font-display text-white mt-0.5">{selectedDeptFilter}</h3>
                    </div>
                  </div>

                  {/* Action */}
                  <div>
                    <button
                      onClick={() => handleDeptFilterChange('')}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-slate-700 shadow-sm"
                    >
                      <X size={14} /> Volver a Todos los Deptos
                    </button>
                  </div>
                </div>

                {/* Summary metrics for this department */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/60 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/50">
                    <span className="text-slate-500 block text-[11px]">Total Pedidos</span>
                    <span className="text-base font-bold font-mono text-white">{currentSelectedDeptObj.total}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/50">
                    <span className="text-slate-500 block text-[11px]">Entregados</span>
                    <span className="text-base font-bold font-mono text-slate-200">
                      {currentSelectedDeptObj.delivered} ({currentSelectedDeptObj.deliveryRate.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/50">
                    <span className="text-slate-500 block text-[11px]">Ciudades Registradas</span>
                    <span className="text-base font-bold font-mono text-cyan-400">{filteredCities.length} ciudades</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/50">
                    <span className="text-slate-500 block text-[11px]">Resultado Flete</span>
                    <span className={`text-base font-bold font-mono ${currentSelectedDeptObj.loss > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {currentSelectedDeptObj.loss > 0 ? `-${localFormatCurrency(currentSelectedDeptObj.loss)}` : localFormatCurrency(Math.abs(currentSelectedDeptObj.loss))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION TITLE WHEN A DEPARTMENT IS FILTERED */}
            {activeTab === 'departamento' && selectedDeptFilter && (
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-cyan-400" />
                  <span className="text-sm font-bold font-display uppercase tracking-wider text-slate-200">
                    Ciudades en {selectedDeptFilter}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {filteredCities.length} ciudades
                  </span>
                </div>
                <span className="text-xs text-slate-500">Semáforo por efectividad local</span>
              </div>
            )}

            {/* TIP NOTICE WHEN BROWSING ALL DEPARTMENTS */}
            {activeTab === 'departamento' && !selectedDeptFilter && (
              <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-900 text-xs text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MapPin size={14} className="text-emerald-400 shrink-0" />
                  <span>Haz clic en cualquier departamento o en <strong>"Explorar Ciudades"</strong> para filtrar y ver únicamente sus ciudades.</span>
                </span>
                <span className="text-slate-500 font-mono text-[11px] hidden sm:inline">{filteredDepts.length} departamentos</span>
              </div>
            )}

            {/* NOTICE IN CITY TAB WHEN A DEPARTMENT IS FILTERED */}
            {activeTab === 'ciudad' && selectedDeptFilter && (
              <div className="mb-4 flex items-center justify-between bg-slate-900/60 border border-emerald-500/20 px-4 py-2.5 rounded-xl">
                <div className="flex items-center gap-2">
                  <Map size={16} className="text-emerald-400 shrink-0" />
                  <span className="text-[14px] text-slate-300">
                    Mostrando ciudades de <strong className="text-white font-bold">{selectedDeptFilter}</strong> ({filteredCities.length} ciudades encontradas)
                  </span>
                </div>
                <button
                  onClick={() => handleDeptFilterChange('')}
                  className="text-xs text-emerald-400 hover:text-white font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <X size={13} /> Ver ciudades de todo el país
                </button>
              </div>
            )}

            {/* Unified Table view */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-950/20 text-[15px] uppercase tracking-wider text-slate-400 font-bold">
                    <th className="px-4 py-3.5 font-display">
                      {activeTab === 'departamento' 
                        ? (selectedDeptFilter ? `Ciudad (${selectedDeptFilter})` : 'Departamento') 
                        : activeTab === 'ciudad' ? 'Ciudad / Depto' : 'Transportadora'}
                    </th>
                    <th className="px-4 py-3.5 font-display text-center">Pedidos</th>
                    <th className="px-4 py-3.5 font-display text-center">Entregas</th>
                    <th className="px-4 py-3.5 font-display">Tasa Entrega</th>
                    <th className="px-4 py-3.5 font-display text-right">Resultado Flete</th>
                    {activeTab === 'departamento' && !selectedDeptFilter && (
                      <th className="px-4 py-3.5 font-display text-center">Ciudades</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {/* Departamento Tab - WHEN NO DEPARTMENT IS FILTERED */}
                  {activeTab === 'departamento' && !selectedDeptFilter && (
                    filteredDepts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[15px] text-slate-500">No se encontraron departamentos con los filtros actuales.</td>
                      </tr>
                    ) : (
                      filteredDepts.map((item) => (
                        <tr 
                          key={item.name} 
                          onClick={() => handleDeptFilterChange(item.name)}
                          className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                        >
                          <td className="px-4 py-4 flex items-center gap-2">
                            <Map className="text-slate-600 group-hover:text-emerald-500 transition-colors shrink-0" size={16} />
                            <span className="text-[15px] font-bold text-slate-200 group-hover:text-emerald-400 transition-colors truncate">
                              {item.name}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center text-[15px] font-mono text-slate-300 font-bold">{item.total}</td>
                          <td className="px-4 py-4 text-center text-[15px] font-mono text-slate-500">{item.delivered}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ring-4 shrink-0 ${
                                item.status === 'green' ? 'bg-emerald-500 ring-emerald-500/10' :
                                item.status === 'yellow' ? 'bg-amber-500 ring-amber-500/10' :
                                'bg-rose-500 ring-rose-500/10'
                              }`} />
                              <span className={`text-[15px] font-mono font-bold ${
                                item.status === 'green' ? 'text-emerald-400' :
                                item.status === 'yellow' ? 'text-amber-400' :
                                'text-rose-400'
                              }`}>
                                {item.deliveryRate.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className={`px-4 py-4 text-right text-[15px] font-mono ${
                            item.loss > 0 ? 'text-red-400' : 'text-emerald-400'
                          }`}>
                            {item.loss > 0 ? `-${localFormatCurrency(item.loss)}` : localFormatCurrency(Math.abs(item.loss))}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeptFilterChange(item.name);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 group-hover:border-emerald-500/40"
                            >
                              <span>Explorar ({item.citiesCount || stats.citiesList.filter(c => c.dept === item.name).length})</span>
                              <ChevronRight size={12} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )
                  )}

                  {/* Departamento Tab - WHEN A DEPARTMENT IS FILTERED (SHOW ITS CITIES) */}
                  {activeTab === 'departamento' && selectedDeptFilter && (
                    filteredCities.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[15px] text-slate-500">
                          No se encontraron ciudades en {selectedDeptFilter} con los filtros actuales.
                        </td>
                      </tr>
                    ) : (
                      filteredCities.map((item) => (
                        <tr key={item.name} className="hover:bg-white/[0.01] transition-colors group">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="text-slate-600 group-hover:text-cyan-400 transition-colors shrink-0" size={16} />
                              <span className="text-[15px] font-bold text-slate-200 truncate">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center text-[15px] font-mono text-slate-300 font-bold">{item.total}</td>
                          <td className="px-4 py-4 text-center text-[15px] font-mono text-slate-500">{item.delivered}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ring-4 shrink-0 ${
                                item.status === 'green' ? 'bg-emerald-500 ring-emerald-500/10' :
                                item.status === 'yellow' ? 'bg-amber-500 ring-amber-500/10' :
                                'bg-rose-500 ring-rose-500/10'
                              }`} />
                              <span className={`text-[15px] font-mono font-bold ${
                                item.status === 'green' ? 'text-emerald-400' :
                                item.status === 'yellow' ? 'text-amber-400' :
                                'text-rose-400'
                              }`}>
                                {item.deliveryRate.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className={`px-4 py-4 text-right text-[15px] font-mono ${
                            item.loss > 0 ? 'text-red-400' : 'text-emerald-400'
                          }`}>
                            {item.loss > 0 ? `-${localFormatCurrency(item.loss)}` : localFormatCurrency(Math.abs(item.loss))}
                          </td>
                        </tr>
                      ))
                    )
                  )}

                  {/* Ciudad Tab */}
                  {activeTab === 'ciudad' && (
                    filteredCities.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[15px] text-slate-500">No se encontraron ciudades con los filtros actuales.</td>
                      </tr>
                    ) : (
                      filteredCities.map((item) => (
                        <tr key={item.name} className="hover:bg-white/[0.01] transition-colors group">
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="text-slate-600 group-hover:text-emerald-500 transition-colors shrink-0" size={16} />
                                <span className="text-[15px] font-bold text-slate-200 truncate">{item.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeptFilterChange(item.dept)}
                                className="text-[11px] font-mono text-slate-500 hover:text-emerald-400 ml-6 text-left cursor-pointer transition-colors mt-0.5 inline-flex items-center gap-1"
                                title={`Filtrar únicamente departamento ${item.dept}`}
                              >
                                📍 Depto: {item.dept}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center text-[15px] font-mono text-slate-300 font-bold">{item.total}</td>
                          <td className="px-4 py-4 text-center text-[15px] font-mono text-slate-500">{item.delivered}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ring-4 shrink-0 ${
                                item.status === 'green' ? 'bg-emerald-500 ring-emerald-500/10' :
                                item.status === 'yellow' ? 'bg-amber-500 ring-amber-500/10' :
                                'bg-rose-500 ring-rose-500/10'
                              }`} />
                              <span className={`text-[15px] font-mono font-bold ${
                                item.status === 'green' ? 'text-emerald-400' :
                                item.status === 'yellow' ? 'text-amber-400' :
                                'text-rose-400'
                              }`}>
                                {item.deliveryRate.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className={`px-4 py-4 text-right text-[15px] font-mono ${
                            item.loss > 0 ? 'text-red-400' : 'text-emerald-400'
                          }`}>
                            {item.loss > 0 ? `-${localFormatCurrency(item.loss)}` : localFormatCurrency(Math.abs(item.loss))}
                          </td>
                        </tr>
                      ))
                    )
                  )}

                  {/* Transportadoras Tab */}
                  {activeTab === 'transportadora' && (
                    filteredCarriers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[15px] text-slate-500">No se encontraron transportadoras con los filtros actuales.</td>
                      </tr>
                    ) : (
                      filteredCarriers.map((item) => (
                        <tr key={item.name} className="hover:bg-white/[0.01] transition-colors group">
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <span className="text-[15px] font-bold text-slate-200 uppercase truncate">{item.name}</span>
                              {item.incidentCount > 0 && (
                                <span className="text-[12px] font-mono text-amber-500 font-bold flex items-center gap-1 mt-0.5">
                                  <AlertCircle size={13} />
                                  {item.incidentCount} incidencias registradas
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center text-[15px] font-mono text-slate-300 font-bold">{item.total}</td>
                          <td className="px-4 py-4 text-center text-[15px] font-mono text-slate-500">{item.delivered}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ring-4 shrink-0 ${
                                item.status === 'green' ? 'bg-emerald-500 ring-emerald-500/10' :
                                item.status === 'yellow' ? 'bg-amber-500 ring-amber-500/10' :
                                'bg-rose-500 ring-rose-500/10'
                              }`} />
                              <span className={`text-[15px] font-mono font-bold ${
                                item.status === 'green' ? 'text-emerald-400' :
                                item.status === 'yellow' ? 'text-amber-400' :
                                'text-rose-400'
                              }`}>
                                {item.deliveryRate.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className={`px-4 py-4 text-right text-[15px] font-mono ${
                            item.loss > 0 ? 'text-red-400' : 'text-emerald-400'
                          }`}>
                            {item.loss > 0 ? `-${localFormatCurrency(item.loss)}` : localFormatCurrency(Math.abs(item.loss))}
                          </td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="text-[13px] text-slate-500 border-t border-slate-900/60 pt-4 mt-4 leading-relaxed">
            * El cálculo de pérdidas y cobros toma en cuenta la diferencia absoluta por despacho. Te sugerimos revisar las regiones clasificadas en estado <strong className="text-red-400 font-bold uppercase">Rojo (&lt;60%)</strong> para optimizar con urgencia tu tarifa de flete básico.
          </div>
        </div>

        {/* RIGHT COLUMN: GRAPHICS & ACTIONABLE TIPS */}
        <div className="space-y-6 flex flex-col justify-between text-[15px]">
          
          {/* PREDICTIVE INSIGHT CARDS */}
          <div className="glass-card p-6 border border-slate-900 bg-slate-950/20 flex flex-col justify-between h-full min-h-[220px]">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <Zap size={16} />
                </div>
                <h4 className="text-[16px] font-bold text-white font-display">Tácticas de Mitigación</h4>
              </div>
              <p className="text-[15px] text-slate-400 leading-relaxed mb-4">
                El flete real consolidado excede tu facturación promedio nacional. Para contrarrestar el impacto negativo de las devoluciones, aplica:
              </p>

              <div className="space-y-3.5">
                <div className="flex gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                  <div>
                    <h5 className="text-[15px] font-bold text-slate-200">Incremento Logístico Recomendado</h5>
                    <p className="text-[14px] text-slate-400 mt-0.5">Incrementar flete cobrado un <span className="text-emerald-400 font-bold">12%</span> reduce la brecha de pérdida en {localFormatCurrency(stats.totalShippingLoss * 0.45)}/mes.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  <div>
                    <h5 className="text-[15px] font-bold text-slate-200">Auditoría Preventiva Express</h5>
                    <p className="text-[14px] text-slate-400 mt-0.5">Asignar validador de dirección automática en ciudades con semáforo <span className="text-amber-400 font-bold">Amarillo o Rojo</span>.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 p-3 rounded-xl border border-slate-900 bg-slate-950">
              <p className="text-[13px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                <ShieldCheck size={13} />
                Recomendación de Transportadora
              </p>
              <p className="text-[15px] text-slate-400 italic">
                "Servientrega y Envía entregan mejor en Cundinamarca, mientras que Interrapidisimo destaca en Antioquia con el costo flete más eficiente."
              </p>
            </div>
          </div>

        </div>

        {/* DELIVERY RATES CHART (FULL WIDTH UNDERNEATH THE METRIC / TABLE CONTENT) */}
        <div className="lg:col-span-3 glass-card p-4 sm:p-6 border border-slate-900 !bg-black">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
            <h3 className="text-[17px] font-display font-bold text-white uppercase tracking-wide">Efectividad de Entrega %</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold w-fit">
              {activeTab === 'departamento' ? 'Sección: Departamentos' : activeTab === 'ciudad' ? 'Sección: Ciudades' : 'Sección: Transportadoras'}
            </span>
          </div>
          <p className="text-[15px] text-slate-500 mb-6">Gráfica comparativa de tasa de éxito de los líderes en esta vista</p>
          
          {chartData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-[15px] text-slate-600 bg-slate-950/20 rounded-xl border border-slate-900">
              Filtros actuales excluyen todos los datos gráficos.
            </div>
          ) : (
            <div 
              className="w-full"
              style={{ height: isMobile ? `${Math.max(320, chartData.length * 32)}px` : '380px' }}
            >
              <ResponsiveContainer width="100%" height="100%">
                {isMobile ? (
                  /* Mobile: Vertical list (Horizontal bars going right) with all labels forced with interval={0} */
                  <BarChart data={chartData} layout="vertical" margin={{ left: -10, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#101015" horizontal={false} vertical={true} />
                    <XAxis type="number" domain={[0, 100]} stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      width={110} 
                      tickLine={false} 
                      axisLine={false} 
                      interval={0} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                      contentStyle={{ backgroundColor: '#000000', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff', fontSize: '13px', fontFamily: 'DM Mono' }}
                    />
                    <Bar dataKey="Tasa de Entrega" radius={[0, 4, 4, 0]} barSize={13}>
                      {chartData.map((entry, index) => {
                        const barColor = entry.status === 'green' ? '#10b981' : entry.status === 'yellow' ? '#f59e0b' : '#ef4444';
                        return <Cell key={`cell-${index}`} fill={barColor} />;
                      })}
                    </Bar>
                  </BarChart>
                ) : (
                  /* Desktop: Grid columns (Vertical bars going up) with rotated, fully visible labels and interval={0} */
                  <BarChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 65 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#101015" horizontal={true} vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#94a3b8" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={65}
                    />
                    <YAxis type="number" domain={[0, 100]} stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                      contentStyle={{ backgroundColor: '#000000', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff', fontSize: '13px', fontFamily: 'DM Mono' }}
                    />
                    <Bar dataKey="Tasa de Entrega" radius={[4, 4, 0, 0]} barSize={28}>
                      {chartData.map((entry, index) => {
                        const barColor = entry.status === 'green' ? '#10b981' : entry.status === 'yellow' ? '#f59e0b' : '#ef4444';
                        return <Cell key={`cell-${index}`} fill={barColor} />;
                      })}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          {/* BOTÓN GRANDE DE DIAGNÓSTICO CON IA CON TODOS SUS DETALLES */}
          <div className="mt-8 pt-6 border-t border-slate-900/60 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-left">
              <h4 className="text-[15px] font-bold text-white flex items-center gap-1.5">
                <Sparkles className="text-emerald-400 animate-pulse" size={16} />
                Diagnóstico Logístico Avanzado con IA
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                Nuestra Inteligencia Artificial analizará en segundos las tasas de éxito de tus transportadoras, pérdidas ocultas de fletes, ciudades críticas en Guatemala y te proporcionará recomendaciones estratégicas accionables.
              </p>
            </div>
            <button
              onClick={runAiDiagnostic}
              disabled={aiLoading}
              className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-black font-black text-xs px-6 py-3.5 rounded-xl flex items-center justify-center gap-2.5 cursor-pointer shadow-[0_0_25px_rgba(16,185,129,0.2)] hover:shadow-[0_0_35px_rgba(16,185,129,0.35)] transition-all duration-300 hover:scale-[1.02] active:scale-95 whitespace-nowrap"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="animate-spin text-black shrink-0" size={16} />
                  <span>Analizando Métricas...</span>
                </>
              ) : (
                <>
                  <Sparkles className="text-black animate-pulse shrink-0" size={16} />
                  <span>GENERAR DIAGNÓSTICO EXPERTO</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* AI ANALYSIS EXPANSION PANEL INDEPENDIENTE */}
      {aiResult && (
        <div className="glass-card p-6 border border-neon/20 !bg-[#050505] shadow-[0_0_30px_rgba(34,197,94,0.08)] rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300 mt-6 animate-out fade-out duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-6 font-bold">
            <div className="flex items-center gap-2.5">
              <Bot className="text-neon" size={20} />
              <div>
                <h4 className="text-xs uppercase tracking-widest text-slate-500 font-display font-bold">Respuesta de IA Completada</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm font-bold text-white">Ecommil LOGISTIC SPECIALIST</span>
                  <span className="bg-neon/10 text-neon text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded border border-neon/20">PRO ENGINE</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setAiResult(null)}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-900 border border-slate-800 font-bold"
            >
              Cerrar Diagnóstico [X]
            </button>
          </div>

          <div className="markdown-body text-slate-300 prose prose-invert max-w-none text-[15px] leading-relaxed space-y-4">
            <Markdown>{aiResult}</Markdown>
          </div>
        </div>
      )}

      {aiError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3 text-[15px] mt-6">
          <AlertCircle size={16} />
          {aiError}
        </div>
      )}

    </div>
  );
};

export default ShippingAnalysis;
