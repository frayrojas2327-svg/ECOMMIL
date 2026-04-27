import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { AlertTriangle, RotateCcw, XCircle, TrendingDown, Globe } from 'lucide-react';
import { Order, calculateOrderProfit, CurrencyCode } from '../mockData';

interface ReturnsAnalysisProps {
  orders: Order[];
  formatCurrency: (amount: number) => string;
  currency?: CurrencyCode;
  currencies?: any;
  isConversionActive?: boolean;
}

const ReturnsAnalysis: React.FC<ReturnsAnalysisProps> = ({ orders, formatCurrency, currency = 'USD', currencies = {}, isConversionActive = false }) => {
  const [isLocalConversionActive, setIsLocalConversionActive] = useState(isConversionActive);

  useEffect(() => {
    setIsLocalConversionActive(isConversionActive);
  }, [isConversionActive]);

  const localFormatCurrency = (amount: number) => {
    const isUSD = !isLocalConversionActive;
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

  const COLORS = ['#00ff88', '#f5c842', '#ef4444', '#3b82f6', '#8b5cf6'];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Análisis de Devoluciones y Cancelaciones</h2>
          <p className="text-base text-slate-500">Impacto financiero de pedidos no completados</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsLocalConversionActive(!isLocalConversionActive)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-black text-[10px] tracking-widest transition-all ${
              isLocalConversionActive 
                ? 'bg-neon text-background shadow-lg shadow-neon/20' 
                : 'bg-card border border-border text-slate-500 hover:text-slate-300'
            }`}
          >
            <Globe size={14} /> {isLocalConversionActive ? 'CONVERSIÓN ACTIVA' : 'MODO USD'}
          </button>
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
        <div className="flex items-center gap-8">
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
    </div>
  );
};

export default ReturnsAnalysis;
