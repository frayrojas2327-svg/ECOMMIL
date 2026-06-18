import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Target, 
  ShoppingBag, 
  Users, 
  Truck, 
  AlertCircle,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Zap,
  Globe,
  Megaphone,
  Brain,
  Sparkles,
  Cpu,
  Loader2,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import Markdown from 'react-markdown';
import { Order, calculateOrderProfit, CurrencyCode } from '../mockData';

interface KPIPanelProps {
  orders: Order[];
  stats: any;
  formatCurrency: (amount: number) => string;
  currency?: CurrencyCode;
  currencies?: any;
  isConversionActive?: boolean;
  manualAdSpend?: number;
  setManualAdSpend?: (val: number) => void;
}

const MetricCard = ({ title, value, subValue, trend, icon: Icon, description, color = 'neon', onClick }: any) => (
  <div 
    onClick={onClick}
    className={`border border-border bg-card/50 p-6 relative overflow-hidden group ${onClick ? 'cursor-pointer hover:border-primary transition-all' : ''}`}
  >
    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
      <Icon size={64} />
    </div>
    
    <div className="flex items-center gap-2 mb-4">
      <div className={`p-2 rounded-lg bg-${color}/10 text-${color}`}>
        <Icon size={18} />
      </div>
      <span className="text-[15px] font-mono uppercase tracking-widest text-slate-500">{title}</span>
    </div>

    <div className="flex items-baseline gap-3">
      <h3 className="text-3xl font-mono font-bold text-white tracking-tighter">{value}</h3>
      {trend !== undefined && (
        <div className={`flex items-center gap-0.5 text-[15px] font-mono ${trend >= 0 ? 'text-neon' : 'text-red-500'}`}>
          {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    
    <div className="mt-4 space-y-1">
      <p className="text-base text-slate-400 font-medium">{subValue}</p>
      <p className="text-[15px] text-slate-600 italic leading-tight">{description}</p>
    </div>

    {/* Technical Grid Accent */}
    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-border to-transparent opacity-20" />
  </div>
);

const KPIPanel: React.FC<KPIPanelProps> = ({ 
  orders: parentOrders, 
  stats: parentStats, 
  formatCurrency, 
  currency = 'USD', 
  currencies = {}, 
  isConversionActive = false,
  manualAdSpend = 0,
  setManualAdSpend
}) => {
  const [tagFilterPro, setTagFilterPro] = useState('TODOS');

  // Dynamically extract other tags from actual orders in alphabetical order
  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    parentOrders.forEach(o => {
      if (o.tags && o.tags.trim() !== '') {
        const rawTags = o.tags.split(',');
        rawTags.forEach(raw => {
          const clean = raw.trim();
          if (clean !== '') {
            const lowerClean = clean.toLowerCase();
            if (
              lowerClean !== 'tik tok organico' && 
              lowerClean !== 'tiktok organico' && 
              lowerClean !== 'sin etiqueta' &&
              lowerClean !== 'sin_etiqueta'
            ) {
              tagsSet.add(clean);
            }
          }
        });
      }
    });
    return Array.from(tagsSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [parentOrders]);

  const orders = useMemo(() => {
    return parentOrders.filter(o => {
      const orderTagLower = o.tags?.toLowerCase() || '';
      if (tagFilterPro === 'SIN ETIQUETA') {
        return !o.tags || o.tags.trim() === '';
      }
      if (tagFilterPro === 'TIK_TOK_ORGANICO') {
        return orderTagLower.includes('tik tok organico') || orderTagLower.includes('tiktok organico') || (orderTagLower.includes('tik') && orderTagLower.includes('organ'));
      }
      if (tagFilterPro !== 'TODOS') {
        const targetLower = tagFilterPro.toLowerCase();
        const individualTags = orderTagLower.split(',').map(t => t.trim());
        return individualTags.includes(targetLower) || orderTagLower.includes(targetLower);
      }
      return true;
    });
  }, [parentOrders, tagFilterPro]);

  const stats = useMemo(() => {
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

    const rate = isConversionActive ? (currencies[currency]?.rate || 1) : 1;
    const manualAdSpendInUSD = manualAdSpend > 0 ? (manualAdSpend / rate) : 0;

    const applyManualAds = manualAdSpend > 0 && (tagFilterPro === 'TODOS' || tagFilterPro === 'SIN ETIQUETA');
    const usedAds = applyManualAds ? manualAdSpendInUSD : sumAds;
    const finalNetProfit = applyManualAds 
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
  }, [orders, tagFilterPro, manualAdSpend, isConversionActive, currency, currencies]);

  const currencySymbol = currencies[currency]?.symbol || '$';

  const localFormatCurrency = (amount: number) => {
    const isUSD = !isConversionActive;
    const targetCurrency = isUSD ? 'USD' : currency;
    const rate = currencies[currency]?.rate || 1;
    
    let converted = amount;
    if (!isUSD) {
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

  const kpis = useMemo(() => {
    const totalOrders = orders.length;
    const confirmedOrders = orders.filter(o => o.status !== 'Cancelado').length;
    const totalAds = orders.reduce((acc, o) => acc + o.adsCost, 0);
    const totalShipping = orders.reduce((acc, o) => acc + o.shippingReal, 0);
    
    const aov = totalOrders > 0 ? stats.totalRevenue / totalOrders : 0;
    const cac = confirmedOrders > 0 ? totalAds / confirmedOrders : 0;
    const returnedCount = orders.filter(o => o.status === 'Devuelto').length;
    const returnRate = totalOrders > 0 ? (returnedCount / totalOrders) * 100 : 0;
    const cancelledCount = orders.filter(o => o.status === 'Cancelado').length;
    const cancelRate = totalOrders > 0 ? (cancelledCount / totalOrders) * 100 : 0;
    const shippingEfficiency = stats.totalRevenue > 0 ? (totalShipping / stats.totalRevenue) * 100 : 0;
    const deliveredCount = orders.filter(o => o.status === 'Entregado').length;
    const deliveryRate = totalOrders > 0 ? (deliveredCount / totalOrders) * 100 : 0;

    return { aov, cac, returnRate, cancelRate, shippingEfficiency, deliveredCount, deliveryRate, returnedCount, cancelledCount };
  }, [orders, stats]);

  const rate = isConversionActive ? (currencies[currency]?.rate || 1) : 1;
  const displayedAdSpend = manualAdSpend > 0 ? manualAdSpend : '';

  const { cpaDelivered, cpaShipped, cpoTotal, profitPerDelivered } = useMemo(() => {
    const totalOrdersCount = orders.length;
    const deliveredCount = kpis.deliveredCount || 0;
    const returnedCount = kpis.returnedCount || 0;
    const shippedCount = deliveredCount + returnedCount;
    const currentAdSpend = stats.totalAds || 0;

    const cpaDelivered = deliveredCount > 0 ? currentAdSpend / deliveredCount : 0;
    const cpaShipped = shippedCount > 0 ? currentAdSpend / shippedCount : 0;
    const cpoTotal = totalOrdersCount > 0 ? currentAdSpend / totalOrdersCount : 0;
    
    // Profit per delivered order
    const profitPerDelivered = deliveredCount > 0 ? stats.totalNetProfit / deliveredCount : 0;

    return { cpaDelivered, cpaShipped, cpoTotal, profitPerDelivered };
  }, [orders, kpis, stats]);

  // AI Analysis States
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  const loadingMessages = [
    "Consolidando base de datos histórica de la tienda...",
    "Evaluando causales y motivos de cancelación registrados...",
    "Filtrando entregas exitosas y devoluciones por ciudades y departamentos...",
    "Ejecutando algoritmos analíticos con Gemini PRO Inteligencia Artificial...",
    "Estructurando planes de optimización logística y mitigación de costos..."
  ];

  useEffect(() => {
    let interval: any;
    if (aiLoading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 3000);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [aiLoading]);

  // Consolidate dataset on client-side to keep tokens optimized and secure
  const aiPreparedData = useMemo(() => {
    const cancellations = orders.filter(o => o.status === 'Cancelado');
    const cancellationReasons: Record<string, number> = {};
    cancellations.forEach(o => {
      if (o.cancellationReason) {
        cancellationReasons[o.cancellationReason] = (cancellationReasons[o.cancellationReason] || 0) + 1;
      }
    });

    const returns = orders.filter(o => o.status === 'Devuelto');
    const returnsInfo: Record<string, number> = {};
    returns.forEach(o => {
      const reason = o.novedad || o.observacion || o.ultimoMovimiento || "Sin registrar / Reclamo de logística";
      returnsInfo[reason] = (returnsInfo[reason] || 0) + 1;
    });

    // Count city and department performance
    const cityMap: Record<string, { name: string, entregas: number, devoluciones: number, cancelaciones: number }> = {};
    orders.forEach(o => {
      const city = o.ciudadDestino || "No especificada";
      if (!cityMap[city]) {
        cityMap[city] = { name: city, entregas: 0, devoluciones: 0, cancelaciones: 0 };
      }
      if (o.status === 'Entregado') cityMap[city].entregas++;
      else if (o.status === 'Devuelto') cityMap[city].devoluciones++;
      else if (o.status === 'Cancelado') cityMap[city].cancelaciones++;
    });

    const deptMap: Record<string, { name: string, entregas: number, devoluciones: number, cancelaciones: number }> = {};
    orders.forEach(o => {
      const dept = o.departamentoDestino || "No especificado";
      if (!deptMap[dept]) {
        deptMap[dept] = { name: dept, entregas: 0, devoluciones: 0, cancelaciones: 0 };
      }
      if (o.status === 'Entregado') deptMap[dept].entregas++;
      else if (o.status === 'Devuelto') deptMap[dept].devoluciones++;
      else if (o.status === 'Cancelado') deptMap[dept].cancelaciones++;
    });

    // Take top 8 cities and departments sorted by volume to guarantee focused analysis
    const cityData = Object.values(cityMap)
      .sort((a, b) => (b.devoluciones + b.cancelaciones) - (a.devoluciones + a.cancelaciones))
      .slice(0, 8);

    const departmentData = Object.values(deptMap)
      .sort((a, b) => (b.devoluciones + b.cancelaciones) - (a.devoluciones + a.cancelaciones))
      .slice(0, 8);

    return {
      cancellationReasons,
      returnsInfo,
      cityData,
      departmentData,
      totalOrders: orders.length
    };
  }, [orders]);

  const handleAIAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch("/api/analisis-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiPreparedData)
      });
      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Ocurrió un error al procesar el análisis de Inteligencia Artificial.");
      }
      const data = await response.json();
      setAiResult(data);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "La conexión con el proveedor de IA falló en este momento.");
    } finally {
      setAiLoading(false);
    }
  };

  const AI_CHART_COLORS = {
    entregas: '#22c55e',
    devoluciones: '#f97316',
    cancelaciones: '#ef4444',
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-white tracking-tight flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-neon/20 blur-xl rounded-full animate-pulse" />
              <Activity className="relative text-neon drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]" size={32} />
            </div>
            Panel de Análisis Pro
          </h2>
          <p className="text-slate-500 text-base mt-1">Métricas clave de rendimiento y eficiencia operativa.</p>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-[15px] font-mono text-slate-500 uppercase tracking-widest">
          {/* Advertising Control */}
          <div className="flex items-center gap-3 pr-6 border-r border-white/5">
            <div className="flex flex-col items-end gap-1">
              <div className="text-[9px] uppercase tracking-widest text-slate-500 font-black flex items-center gap-1.5">
                <Megaphone size={10} className="text-gold" />
                ADS
              </div>
              <input 
                type="number"
                value={displayedAdSpend}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                  setManualAdSpend?.(val);
                }}
                placeholder="0.00"
                className="bg-black/40 border border-white/10 rounded-md py-1 px-2 text-[11px] text-white font-mono w-[80px] focus:border-gold outline-none transition-all text-right h-7"
              />
            </div>
            <div className="text-[9px] text-slate-600 font-bold uppercase leading-none border-l border-white/5 pl-3">
              AUTO:<br/>
              {formatCurrency(stats.autoAds || 0)}
            </div>
          </div>

          {/* Filtro de Etiquetas */}
          <div className="flex items-center gap-2 animate-in fade-in duration-300">
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-black">ETIQUETAS:</span>
            <div className="flex bg-background/50 rounded-lg p-0.5 border border-border focus-within:border-gold transition-all">
              <select 
                value={tagFilterPro}
                onChange={(e) => setTagFilterPro(e.target.value)}
                className="bg-transparent border-none py-1 px-2 text-[10px] font-black tracking-widest text-gold uppercase focus:outline-none focus:ring-0 cursor-pointer h-7"
              >
                <optgroup label="PRINCIPALES" className="bg-[#111] text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                  <option value="TODOS" className="bg-[#111] text-white">TODAS</option>
                  <option value="SIN ETIQUETA" className="bg-[#111] text-[#ef4444]">SIN ETIQUETA</option>
                  <option value="TIK_TOK_ORGANICO" className="bg-[#111] text-neon">TIK TOK ORGANICO</option>
                </optgroup>
                {availableTags.length > 0 && (
                  <optgroup label="OTRAS ETIQUETAS" className="bg-[#111] text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                    {availableTags.map(tag => (
                      <option key={tag} value={tag} className="bg-[#111] text-sky-400">
                        {tag.toUpperCase()}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          <div className="flex bg-background/50 rounded-lg p-0.5 border border-border">
            <div className={`px-2 py-1 flex items-center gap-2 text-[10px] font-black tracking-widest ${isConversionActive ? 'text-neon' : 'text-slate-500'}`}>
              <Globe size={12} />
              {isConversionActive ? `Métricas en ${currency}` : 'Métricas en USD'}
            </div>
          </div>
          <span className="hidden lg:flex items-center gap-1"><Zap size={10} className="text-neon" /> Actualizado: Real</span>
        </div>
      </div>

      {/* Primary Financial KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
        <MetricCard 
          title="Ingresos (Gross)"
          value={localFormatCurrency(stats.totalRevenue)}
          subValue="Facturación bruta total"
          description="Suma de precio + envío cobrado de todos los pedidos."
          trend={14.2}
          icon={DollarSign}
        />
        <MetricCard 
          title="Ganancia (Net)"
          value={localFormatCurrency(stats.totalNetProfit)}
          subValue="Utilidad después de gastos"
          description="Ingresos menos costo de producto, fletes, ads y fees."
          trend={9.8}
          icon={Target}
          color="gold"
        />
        <MetricCard 
          title="Margen Neto"
          value={`${(stats.margin || 0).toFixed(1)}%`}
          subValue="Eficiencia de rentabilidad"
          description="Porcentaje de cada dólar que se convierte en ganancia."
          trend={2.4}
          icon={Percent}
        />
        <MetricCard 
          title="ROAS (Ads)"
          value={`${(stats.roas || 0).toFixed(2)}x`}
          subValue="Retorno de inversión publicitaria"
          description="Ingresos generados por cada dólar invertido en anuncios."
          trend={18.5}
          icon={Zap}
          color="gold"
        />
      </div>

      {/* Operational Efficiency KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <MetricCard 
          title="Porcentaje de Entrega"
          value={`${(kpis.deliveryRate || 0).toFixed(1)}%`}
          subValue={`${kpis.deliveredCount} entregados`}
          description="Porcentaje de pedidos que fueron completados."
          trend={3.5}
          icon={CheckCircle}
          color="neon"
        />
        <MetricCard 
          title="Ganancia por Entrega"
          value={localFormatCurrency(profitPerDelivered)}
          subValue="Por pedido entregado"
          description="Utilidad neta real promedio por cada pedido entregado exitosamente."
          trend={4.8}
          icon={DollarSign}
          color="gold"
        />
        <MetricCard 
          title="Tasa de Devolución"
          value={`${(kpis.returnRate || 0).toFixed(1)}%`}
          subValue={`${kpis.returnedCount || 0} devueltos`}
          description="Porcentaje de pedidos que terminan en devolución."
          trend={1.2}
          icon={Truck}
          color="red-500"
        />
        <MetricCard 
          title="Tasa de Cancelación"
          value={`${(kpis.cancelRate || 0).toFixed(1)}%`}
          subValue={`${kpis.cancelledCount || 0} cancelados`}
          description="Pedidos cancelados antes de ser procesados."
          trend={-0.8}
          icon={AlertCircle}
          color="red-500"
        />
        <MetricCard 
          title="AOV (Ticket Promedio)"
          value={localFormatCurrency(kpis.aov)}
          subValue="Average Order Value"
          description="Monto promedio facturado por cada pedido realizado."
          trend={5.2}
          icon={ShoppingBag}
        />
        <MetricCard 
          title="CPA (Real)"
          value={localFormatCurrency(cpaDelivered)}
          subValue={`CPO Total: ${localFormatCurrency(cpoTotal)}`}
          description={`Costo de anuncios por entrega real. Por despacho físico (Entregados + Devueltos): ${localFormatCurrency(cpaShipped)}.`}
          trend={-3.1}
          icon={Users}
          color="gold"
        />
      </div>

      {/* Advanced Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8 border-t border-border">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <BarChart3 size={20} className="text-neon" /> Análisis de Eficiencia Logística
          </h3>
          
          <div className="glass-card p-8 border-neon/10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-[15px] uppercase tracking-widest text-slate-500 font-mono">Logistics Cost Ratio</p>
                <h4 className="text-2xl font-mono font-bold text-white">{(kpis.shippingEfficiency || 0).toFixed(1)}%</h4>
              </div>
              <div className="text-right">
                <p className="text-[15px] uppercase tracking-widest text-slate-500 font-mono">Benchmark</p>
                <p className="text-base text-neon font-mono">Ideal: &lt; 15%</p>
              </div>
            </div>
            
            <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden border border-border p-0.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${kpis.shippingEfficiency || 0}%` }}
                className={`h-full rounded-full ${kpis.shippingEfficiency < 15 ? 'bg-neon' : kpis.shippingEfficiency < 25 ? 'bg-gold' : 'bg-red-500'}`}
              />
            </div>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-white/5 border border-border rounded-lg">
                <p className="text-[15px] uppercase text-slate-500 mb-1">Costo Flete</p>
                <p className="text-lg font-mono font-bold text-white">{localFormatCurrency(orders.reduce((acc, o) => acc + o.shippingReal, 0))}</p>
              </div>
              <div className="p-4 bg-white/5 border border-border rounded-lg">
                <p className="text-[15px] uppercase text-slate-500 mb-1">Costo Producto</p>
                <p className="text-lg font-mono font-bold text-white">{localFormatCurrency(orders.reduce((acc, o) => acc + o.cost, 0))}</p>
              </div>
              <div className="p-4 bg-white/5 border border-border rounded-lg">
                <p className="text-[15px] uppercase text-slate-500 mb-1">Costo Ads</p>
                <p className="text-lg font-mono font-bold text-white">{localFormatCurrency(orders.reduce((acc, o) => acc + o.adsCost, 0))}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Target size={20} className="text-gold" /> Objetivos de Rendimiento
          </h3>
          
          <div className="space-y-4">
            {[
              { label: 'Margen Neto', current: stats.margin, target: 25, color: 'neon' },
              { label: 'ROAS', current: stats.roas, target: 4, color: 'gold' },
              { label: 'ROI', current: stats.roi, target: 100, color: 'neon' },
              { label: 'Tasa Entrega', current: 100 - kpis.returnRate, target: 92, color: 'gold' }
            ].map((goal) => (
              <div key={goal.label} className="glass-card p-4 border-border/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-base font-mono text-slate-300">{goal.label}</span>
                  <span className="text-base font-mono text-slate-500">Meta: {goal.target}{goal.label.includes('ROAS') ? 'x' : '%'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, ((goal.current || 0) / (goal.target || 1)) * 100)}%` }}
                      className={`h-full bg-${goal.color}`}
                    />
                  </div>
                  <span className={`text-base font-mono font-bold text-${goal.color}`}>
                    {(goal.current || 0).toFixed(1)}{goal.label.includes('ROAS') ? 'x' : '%'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI PRO LOGISTICS & PERFORMANCE PANEL */}
      <div id="ai-logistics-analyst-panel" className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl overflow-hidden p-8 space-y-6 shadow-2xl relative mt-8">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Brain size={180} className="text-emerald-400" />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
              <Sparkles size={16} className="animate-spin" style={{ animationDuration: '6s' }} />
              <span className="text-xs tracking-wider uppercase font-mono">IA PRO Inteligencia Logística</span>
            </div>
            <h3 className="text-2xl font-display font-extrabold text-white">Análisis Avanzado con Gemini PRO</h3>
            <p className="text-[15px] text-slate-400">Analiza en profundidad causas raíces de cancelaciones, devoluciones e incidencias por demografía (direcciones, ciudades y departamentos) de inmediato.</p>
          </div>
          
          <button
            onClick={handleAIAnalysis}
            disabled={aiLoading}
            id="ai-generate-reports-btn"
            className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            {aiLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Cpu size={18} />
            )}
            <span>{aiResult ? "Volver a Analizar con IA Pro" : "Iniciar Análisis Inteligente Pro"}</span>
          </button>
        </div>

        {/* Loading Indicator with Reassurance Steps */}
        {aiLoading && (
          <div className="mt-6 p-8 bg-black/60 rounded-xl border border-emerald-500/25 flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 size={40} className="text-emerald-400 animate-spin" />
            <div>
              <p className="text-[17px] font-semibold text-white tracking-wide">Analizando comportamiento logístico...</p>
              <p className="text-sm text-slate-400 mt-1 italic animate-pulse">"{loadingMessages[loadingStep]}"</p>
            </div>
            <div className="w-1/3 bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-400 h-full transition-all duration-500" 
                style={{ width: `${((loadingStep + 1) / loadingMessages.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error State */}
        {aiError && (
          <div className="mt-6 p-6 bg-red-950/40 border border-red-500/20 rounded-xl text-red-200">
            <div className="flex items-center gap-3 mb-2 font-bold text-red-400">
              <AlertTriangle size={20} />
              <span>Ocurrió un inconveniente</span>
            </div>
            <p className="text-[15px]">{aiError}</p>
            <p className="text-xs text-slate-500 mt-2">Nota: Asegúrate de habilitar tus credenciales en Ajustes &gt; Secretos para habilitar las consultas de IA.</p>
          </div>
        )}

        {/* AI Result Report Panel with Real-time Recharts charts generated entirely from the intelligent analysis */}
        {aiResult && !aiLoading && (
          <div className="mt-8 space-y-8 animate-fade-in divide-y divide-border/60">
            
            {/* Markdown Report Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 col-span-1">
              <div className="glass-card p-8 bg-black/30 border-emerald-500/10 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 font-bold mb-4">
                    <Brain size={18} />
                    <span className="text-sm tracking-wider uppercase font-mono">Reporte Analítico Copiloto</span>
                  </div>
                  
                  <div className="prose prose-invert max-w-none text-slate-300 text-[15px] leading-relaxed space-y-4">
                    <Markdown>{aiResult.analysisText}</Markdown>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-emerald-500/15 flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>MODELO: gemini-3.5-flash-pro</span>
                  <span>PREDICTIVO: ALTO RANGO</span>
                </div>
              </div>

              {/* Recommendations Score Dashboard */}
              <div className="glass-card p-8 bg-black/30 border-emerald-500/10 space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                    <CheckCircle size={18} />
                    <span className="text-sm tracking-wider uppercase font-mono">Plan de Acción & Urgencia</span>
                  </div>
                  <p className="text-xs text-slate-500">Métricas de impacto correctivo calculadas dinámicamente por la IA</p>
                </div>

                <div className="space-y-5">
                  {aiResult.charts?.recommendations?.map((rec: any, idx: number) => {
                    const barColors = ['bg-emerald-500', 'bg-orange-500', 'bg-sky-500', 'bg-teal-500', 'bg-amber-500'];
                    const colorClass = barColors[idx % barColors.length];
                    return (
                      <div key={idx} className="space-y-1.5 p-3 rounded-lg border border-border bg-black/20 hover:border-emerald-500/20 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-base font-medium text-white">{rec.aspect}</span>
                          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            Impacto: {rec.score}%
                          </span>
                        </div>
                        <p className="text-[13px] text-slate-500 italic">Estrategia: {rec.label}</p>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                          <div className={`h-full ${colorClass}`} style={{ width: `${rec.score}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  
                  {(!aiResult.charts?.recommendations || aiResult.charts.recommendations.length === 0) && (
                    <p className="text-sm text-slate-600">No se recuperaron metas recomendadas en este rango.</p>
                  )}
                </div>
              </div>
            </div>

            {/* REAL GRAPHICS DEBAJO DE TODO */}
            <div className="pt-8 space-y-8">
              <div>
                <h4 className="text-xl font-display font-medium text-white">Visualizaciones Logísticas Estructuradas por IA</h4>
                <p className="text-sm text-slate-500">Representaciones gráficas basadas en el cruce de datos analizado por la Inteligencia Artificial.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Chart 1: Cities Deliveries vs Returns */}
                <div className="glass-card p-6 bg-slate-950/20 border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-[15px] font-bold text-white uppercase tracking-wider font-display">Tasa de Devolución e Incidencias por Ciudad</h5>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Top 5 Ciudades</span>
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiResult.charts?.cities || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} />
                        <YAxis stroke="#888" fontSize={12} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
                        />
                        <Legend />
                        <Bar dataKey="entregas" fill={AI_CHART_COLORS.entregas} name="Entregas Exitosas" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="devoluciones" fill={AI_CHART_COLORS.devoluciones} name="Devoluciones (Flete)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="cancelaciones" fill={AI_CHART_COLORS.cancelaciones} name="Cancelaciones Pre-despacho" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Departments Deliveries vs Returns */}
                <div className="glass-card p-6 bg-slate-950/20 border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-[15px] font-bold text-white uppercase tracking-wider font-display">Distribución Logística por Departamento</h5>
                    <span className="text-[11px] font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">Zonas Geográficas</span>
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiResult.charts?.departments || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} />
                        <YAxis stroke="#888" fontSize={12} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
                        />
                        <Legend />
                        <Bar dataKey="entregas" fill={AI_CHART_COLORS.entregas} name="Pedidos Entregados" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="devoluciones" fill={AI_CHART_COLORS.devoluciones} name="Pedidos Devueltos" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="cancelaciones" fill={AI_CHART_COLORS.cancelaciones} name="Cancelaciones" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 3: Frequent Causes (Causales) */}
                <div className="glass-card p-6 bg-slate-950/20 border-border lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-[15px] font-bold text-white uppercase tracking-wider font-display">Principales Causales de Pérdida Financiera</h5>
                    <span className="text-[11px] font-mono text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">Detección de Fricción</span>
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiResult.charts?.causes || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis type="number" stroke="#888" fontSize={12} tickLine={false} />
                        <YAxis dataKey="name" type="category" stroke="#888" fontSize={12} tickLine={false} width={150} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
                        />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#f5c842" name="Volumen de Casos" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default KPIPanel;
