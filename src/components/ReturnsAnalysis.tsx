import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { AlertTriangle, RotateCcw, XCircle, TrendingDown, Globe, Brain, Sparkles, Cpu, Loader2, BarChart3, TrendingUp, CheckCircle, ArrowRight } from 'lucide-react';
import { Order, calculateOrderProfit, CurrencyCode } from '../mockData';
import Markdown from 'react-markdown';

interface ReturnsAnalysisProps {
  orders: Order[];
  formatCurrency: (amount: number) => string;
  currency?: CurrencyCode;
  currencies?: any;
  isConversionActive?: boolean;
}

const ReturnsAnalysis: React.FC<ReturnsAnalysisProps> = ({ orders, formatCurrency, currency = 'USD', currencies = {}, isConversionActive = false }) => {
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

  const stats = useMemo(() => {
    const returns = orders.filter(o => o.status === 'Devuelto');
    const cancellations = orders.filter(o => o.status === 'Cancelado');
    
    const returnRate = orders.length > 0 ? (returns.length / orders.length) * 100 : 0;
    const cancelRate = orders.length > 0 ? (cancellations.length / orders.length) * 100 : 0;

    // Cost of returns: shipping real (out) + shipping real (back) + ads
    const totalReturnCost = returns.reduce((acc, o) => acc + (o.shippingReal * 1.5 + o.adsCost), 0);

    // Cancellation reasons
    const reasons: Record<string, number> = {};
    cancellations.forEach(o => {
      if (o.cancellationReason) {
        reasons[o.cancellationReason] = (reasons[o.cancellationReason] || 0) + 1;
      }
    });

    const pieData = Object.entries(reasons).map(([name, value]) => ({ name, value }));

    return { returnRate, cancelRate, totalReturnCost, pieData, returnsCount: returns.length, cancellationsCount: cancellations.length };
  }, [orders]);

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

  const COLORS = ['#00ff88', '#f5c842', '#ef4444', '#3b82f6', '#8b5cf6'];
  const AI_CHART_COLORS = {
    entregas: '#22c55e',
    devoluciones: '#f97316',
    cancelaciones: '#ef4444',
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Análisis de Devoluciones y Cancelaciones</h2>
          <p className="text-base text-slate-500">Impacto financiero de pedidos no completados</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-background/50 rounded-lg p-0.5 border border-border">
            <div className={`px-3 py-1.5 flex items-center gap-2 text-[10px] font-black tracking-widest ${isConversionActive ? 'text-neon' : 'text-slate-500'}`}>
              <Globe size={14} />
               {isConversionActive ? `MONEDA: ${currency}` : 'MODO USD'}
            </div>
          </div>
          {stats.returnRate > 8 && (
            <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-base font-bold animate-pulse">
              <AlertTriangle size={18} />
              Alerta: Tasa de devolución crítica ({(stats.returnRate || 0).toFixed(1)}%)
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="glass-card p-8 flex flex-col justify-center items-center text-center">
          <RotateCcw size={48} className="text-orange-400 mb-4 opacity-20" />
          <p className="text-[15px] uppercase tracking-widest text-slate-500 mb-1">Tasa de Devolución</p>
          <h3 className="text-5xl font-mono font-bold text-white mb-2">{(stats.returnRate || 0).toFixed(1)}%</h3>
          <p className="text-base text-slate-500">{stats.returnsCount} pedidos devueltos de {orders.length}</p>
          
          <div className="mt-8 w-full pt-8 border-t border-border">
            <p className="text-[15px] uppercase tracking-widest text-slate-500 mb-4">Costo Absorbido</p>
            <p className="text-3xl font-mono font-bold text-red-400">{localFormatCurrency(stats.totalReturnCost)}</p>
            <p className="text-[15px] text-slate-500 mt-2 italic">Flete ida/vuelta + Ads perdidos</p>
          </div>
        </div>

        <div className="lg:col-span-2 glass-card p-8">
          <h3 className="text-xl font-display font-bold text-white mb-6">Motivos de Cancelación</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff', fontSize: '15px', fontFamily: 'DM Mono' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="overflow-hidden border border-border rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background border-b border-border">
                    <th className="px-4 py-3 text-[15px] uppercase tracking-widest text-slate-500 font-display">Motivo</th>
                    <th className="px-4 py-3 text-[15px] uppercase tracking-widest text-slate-500 font-display text-right">Pedidos</th>
                    <th className="px-4 py-3 text-[15px] uppercase tracking-widest text-slate-500 font-display text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.pieData.map((entry, index) => (
                    <tr key={entry.name} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-base text-slate-300 truncate">{entry.name}</span>
                      </td>
                      <td className="px-4 py-3 text-base font-mono font-bold text-white text-right">{entry.value}</td>
                      <td className="px-4 py-3 text-base font-mono text-slate-500 text-right">
                        {(stats.cancellationsCount > 0 ? (entry.value / stats.cancellationsCount) * 100 : 0).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-8">
        <h3 className="text-xl font-display font-bold text-white mb-6">Impacto en Rentabilidad Acumulada</h3>
        <div className="flex flex-col md:flex-row items-stretch gap-8">
          <div className="flex-1 p-6 bg-background rounded-xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-display text-slate-500 uppercase">Pérdida por Cancelaciones</span>
              <XCircle size={16} className="text-red-500" />
            </div>
            <p className="text-2xl font-mono font-bold text-white">{localFormatCurrency(stats.cancellationsCount * 10)}</p>
            <p className="text-[15px] text-slate-500 mt-1 italic">*Estimado de $10 USD en ads por cada cancelación</p>
          </div>
          <div className="flex-1 p-6 bg-background rounded-xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-display text-slate-500 uppercase">Pérdida por Devoluciones</span>
              <RotateCcw size={16} className="text-orange-400" />
            </div>
            <p className="text-2xl font-mono font-bold text-white">{localFormatCurrency(stats.totalReturnCost)}</p>
            <p className="text-[15px] text-slate-500 mt-1 italic">*Incluye logística inversa y costo de adquisición</p>
          </div>
          <div className="flex-1 p-6 bg-neon/5 rounded-xl border border-neon/20">
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-display text-neon uppercase">Impacto Total</span>
              <TrendingDown size={16} className="text-red-500" />
            </div>
            <p className="text-3xl font-mono font-bold text-red-400">{localFormatCurrency(stats.totalReturnCost + (stats.cancellationsCount * 10))}</p>
            <p className="text-[15px] text-slate-500 mt-1 italic">Capital drenado este mes</p>
          </div>
        </div>
      </div>

      {/* AI PRO LOGISTICS ANALYST DASHBOARD SECTOR (DEBAJO DE TODO) */}
      <div id="ai-logistics-analyst-panel" className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl overflow-hidden p-8 space-y-6 shadow-2xl relative">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
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

export default ReturnsAnalysis;
