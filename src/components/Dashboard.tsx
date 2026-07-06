import React, { useMemo, useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ComposedChart, Line
} from 'recharts';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, DollarSign, Percent, Target, ShoppingBag, Globe, Megaphone, Users } from 'lucide-react';
import { Order, calculateOrderProfit, CurrencyCode } from '../mockData';
import { format, startOfDay, eachDayOfInterval, subDays, isSameDay, parseISO } from 'date-fns';

const parseFlexibleDate = (dateStr: string | undefined): Date | null => {
  if (!dateStr) return null;
  if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
    const d = parseISO(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  if (dateStr.includes('/')) {
    const parts = dateStr.split(' ')[0].split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

const getOrderTargetDate = (o: Order): Date => {
  if (o.status === 'Entregado' || o.status === 'Devuelto') {
    if (o.fechaEntregaDevolucion && o.fechaEntregaDevolucion !== '---') {
      const parsed = parseFlexibleDate(o.fechaEntregaDevolucion);
      if (parsed) return parsed;
    }
  }
  return o.date;
};

interface DashboardProps {
  orders: Order[];
  stats: any;
  formatCurrency: (amount: number) => string;
  currencySymbol: string;
  currency?: CurrencyCode;
  currencies?: any;
  isConversionActive?: boolean;
  manualAdSpend?: number;
  setManualAdSpend?: (val: number) => void;
}

const KPICard = ({ title, value, subValue, icon: Icon, trend, color = 'primary', onClick }: any) => {
  const isProfitKPI = title.toLowerCase().includes('ganancia') || 
                      title.toLowerCase().includes('profit') || 
                      title.toLowerCase().includes('margen') || 
                      title.toLowerCase().includes('utilidad') || 
                      title.toLowerCase().includes('roi');
  
  const isNegative = typeof value === 'string' && (value.trim().startsWith('-') || value.trim().includes('-%'));

  const valueColorClass = isProfitKPI 
    ? (isNegative ? 'text-negative-red' : 'text-positive-green')
    : 'text-white';

  const iconColorClass = isProfitKPI
    ? (isNegative ? 'text-negative-red' : 'text-positive-green')
    : `text-${color}`;

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      onClick={onClick}
      className={`fintech-card p-6 relative group ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${iconColorClass}`}>
        <Icon size={48} />
      </div>
      <p className="text-[15px] font-display uppercase tracking-widest text-slate-500 mb-2">{title}</p>
      <div className="flex items-end gap-3">
        <h3 className={`text-3xl font-mono font-bold ${valueColorClass}`}>{value}</h3>
        {trend && (
          <div className={`flex items-center gap-1 text-[15px] mb-1.5 ${trend > 0 ? 'text-positive-green' : 'text-negative-red'}`}>
            {trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <p className="text-[15px] text-slate-500 mt-2 font-mono">{subValue}</p>
    </motion.div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ 
  orders, 
  stats, 
  formatCurrency, 
  currencySymbol,
  currency = 'USD',
  currencies = {},
  isConversionActive = false,
  manualAdSpend = 0,
  setManualAdSpend
}) => {
  const deliveredOrders = orders.filter(o => o.status === 'Entregado').length;
  const totalOrders = orders.length;
  
  const cpa = totalOrders > 0 ? (stats.totalAds / totalOrders) : 0;
  const cpaDelivered = deliveredOrders > 0 ? (stats.totalAds / deliveredOrders) : 0;

  // 28-day summary totals for the heatmap
  const { totalEntregados28, totalDevueltos28, totalProfit28 } = useMemo(() => {
    const twentyEightDaysAgo = subDays(new Date(), 27);
    const last28DaysOrders = orders.filter(o => {
      const targetDate = getOrderTargetDate(o);
      return startOfDay(targetDate).getTime() >= startOfDay(twentyEightDaysAgo).getTime() && 
             startOfDay(targetDate).getTime() <= startOfDay(new Date()).getTime();
    });
    
    return {
      totalEntregados28: last28DaysOrders.filter(o => o.status === 'Entregado').length,
      totalDevueltos28: last28DaysOrders.filter(o => o.status === 'Devuelto').length,
      totalProfit28: last28DaysOrders.reduce((acc, o) => acc + calculateOrderProfit(o).netProfit, 0)
    };
  }, [orders]);

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

  // Chart Data: Profit by Day
  const chartData = useMemo(() => {
    const last30Days = eachDayOfInterval({
      start: subDays(new Date(), 29),
      end: new Date()
    });

    return last30Days.map(day => {
      const dayOrders = orders.filter(o => isSameDay(getOrderTargetDate(o), day));
      let dayProfit = 0;
      let dayRevenue = 0;
      let entregadosCount = 0;
      let devueltosCount = 0;
      
      dayOrders.forEach(o => {
        const { revenue, netProfit } = calculateOrderProfit(o);
        dayProfit += netProfit;
        dayRevenue += revenue;
        if (o.status === 'Entregado') {
          entregadosCount++;
        } else if (o.status === 'Devuelto') {
          devueltosCount++;
        }
      });

      return {
        date: format(day, 'MMM dd'),
        profit: Math.round(dayProfit),
        revenue: Math.round(dayRevenue),
        entregados: entregadosCount,
        devueltos: devueltosCount
      };
    });
  }, [orders]);

  // Top Products Data
  const productPerformance = useMemo(() => {
    const performance: Record<string, { profit: number; count: number }> = {};
    orders.forEach(o => {
      const { netProfit } = calculateOrderProfit(o);
      if (!performance[o.product]) performance[o.product] = { profit: 0, count: 0 };
      performance[o.product].profit += netProfit;
      performance[o.product].count += 1;
    });

    return Object.entries(performance)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.profit - a.profit);
  }, [orders]);

  const top5 = productPerformance.slice(0, 5);
  const bottom5 = [...productPerformance].sort((a, b) => a.profit - b.profit).slice(0, 5);

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Tablero de Control</h2>
          <p className="text-[15px] text-slate-500">Visualización de métricas críticas y rendimiento diario</p>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Advertising Control */}
          <div className="flex flex-col items-end gap-1 px-4 border-r border-white/5">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 font-black flex items-center gap-2">
              <Megaphone size={10} className="text-gold" />
              ADS MANUAL
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="number"
                value={manualAdSpend || ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                  setManualAdSpend?.(val);
                }}
                placeholder="0.00"
                className="bg-black/40 border border-white/10 rounded-md py-1 px-2 text-[11px] text-white font-mono w-[80px] focus:border-gold outline-none transition-all text-right"
              />
              <div className="text-[9px] text-slate-600 font-bold uppercase leading-none">
                AUTO:<br/>
                {formatCurrency(stats.autoAds || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard 
          title="Venta Bruta" 
          value={localFormatCurrency(stats.totalRevenue)} 
          subValue={`${totalOrders} Pedidos`}
          icon={DollarSign}
          color="primary"
        />
        <KPICard 
          title="Utilidad Neta" 
          value={localFormatCurrency(stats.totalNetProfit)} 
          subValue={`${deliveredOrders} Entregados`}
          icon={Target}
          color="gold"
        />
        <KPICard 
          title="Costo Publicidad" 
          value={localFormatCurrency(stats.totalAds)} 
          subValue={manualAdSpend > 0 ? "Gasto Manual" : "Suma Automática"}
          icon={Megaphone}
          color="gold"
        />
        <KPICard 
          title="ROAS Global" 
          value={`${(stats.roas || 0).toFixed(2)}x`} 
          subValue="Eficiencia publicitaria"
          icon={ShoppingBag}
          trend={15.0}
          color="primary"
        />
      </div>

      {/* CPA Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <KPICard 
          title="CPA Real" 
          value={localFormatCurrency(cpa)} 
          subValue={`Ticket: ${formatCurrency(stats.totalRevenue / (orders.length || 1))}`}
          icon={Users}
          color="secondary"
        />
        <KPICard 
          title="ROI Promedio" 
          value={`${Math.round(stats.roi || 0)}%`} 
          subValue="Retorno sobre inversión"
          icon={TrendingUp}
          trend={-2.1}
          color="secondary"
        />
        <KPICard 
          title="Margen Neto" 
          value={`${Math.round(stats.margin || 0)}%`} 
          subValue="Eficiencia del negocio"
          icon={Percent}
          trend={4.3}
          color="neon"
        />
      </div>

      {/* Main Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 fintech-card p-8 bg-black">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h3 className="text-xl font-display font-bold text-white font-sans">Rentabilidad Diaria</h3>
              <p className="text-[14px] text-slate-500">Ingresos, ganancias, entregados y devueltos agrupados por su día de entrega/devolución</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/30" />
                <span className="text-[13px] font-mono text-slate-400">Ingresos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[13px] font-mono text-slate-400">Ganancias</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                <span className="text-[13px] font-mono text-slate-400">Entregados (u.)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-[13px] font-mono text-slate-400">Devueltos (u.)</span>
              </div>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#475569" 
                  fontSize={13} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="#475569" 
                  fontSize={13} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#475569" 
                  fontSize={13} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `${value} u.`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000000', border: '1px solid #1a1a1a', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '13px', fontFamily: 'DM Mono' }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '13px' }}
                  formatter={(value: any, name: string) => {
                    if (name === 'revenue') {
                      return [localFormatCurrency(Number(value)), 'Ingresos'];
                    }
                    if (name === 'profit') {
                      return [localFormatCurrency(Number(value)), 'Ganancia Neta'];
                    }
                    if (name === 'entregados') {
                      return [`${value} unidades`, 'Pedidos Entregados'];
                    }
                    if (name === 'devueltos') {
                      return [`${value} unidades`, 'Pedidos Devueltos'];
                    }
                    return [value, name];
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  name="revenue"
                  yAxisId="left"
                  stroke="#22c55e" 
                  strokeOpacity={0.2}
                  fill="transparent" 
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  name="profit"
                  yAxisId="left"
                  stroke="#22c55e" 
                  fillOpacity={1} 
                  fill="url(#colorProfit)" 
                  strokeWidth={3}
                />
                <Line
                  type="monotone"
                  dataKey="entregados"
                  name="entregados"
                  yAxisId="right"
                  stroke="#2dd4bf"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="devueltos"
                  name="devueltos"
                  yAxisId="right"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top/Bottom Products */}
        <div className="fintech-card p-8 flex flex-col bg-black">
          <h3 className="text-xl font-display font-bold text-white mb-6">Ranking de Productos</h3>
          
          <div className="space-y-6 flex-1">
            <div>
              <p className="text-[15px] uppercase tracking-widest text-primary font-bold mb-3">Top 5 Rentables</p>
              <div className="space-y-3">
                {top5.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <span className="text-[15px] font-mono text-slate-600">0{i+1}</span>
                      <span className="text-[15px] text-slate-300 group-hover:text-white transition-colors truncate max-w-[150px]">{p.name}</span>
                    </div>
                    <span className="text-[15px] font-mono font-bold text-primary">{localFormatCurrency(p.profit)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-border">
              <p className="text-[15px] uppercase tracking-widest text-red-500 font-bold mb-3">Menos Rentables</p>
              <div className="space-y-3">
                {bottom5.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <span className="text-[15px] font-mono text-slate-600">0{i+1}</span>
                      <span className="text-[15px] text-slate-300 group-hover:text-white transition-colors truncate max-w-[150px]">{p.name}</span>
                    </div>
                    <span className="text-[15px] font-mono font-bold text-red-400">{localFormatCurrency(p.profit)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap & Goal Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 fintech-card p-8 bg-black">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-display font-bold text-white font-sans">Mapa de Calor de Rentabilidad</h3>
              <p className="text-[13px] text-slate-500">Rentabilidad, entregados y devueltos agrupados por su día de entrega/devolución (últimos 28 días)</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[13px] text-slate-500 uppercase font-display">Menos</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-sm bg-[#0a0a0a]" />
                <div className="w-3 h-3 rounded-sm bg-[#15803d]" />
                <div className="w-3 h-3 rounded-sm bg-[#16a34a]" />
                <div className="w-3 h-3 rounded-sm bg-[#22c55e]" />
              </div>
              <span className="text-[13px] text-slate-500 uppercase font-display">Más</span>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
              <div key={day} className="text-center text-[14px] uppercase text-slate-500 font-display">{day}</div>
            ))}
            {Array.from({ length: 28 }).map((_, i) => {
              const day = subDays(new Date(), 27 - i);
              const dayOrders = orders.filter(o => isSameDay(getOrderTargetDate(o), day));
              const dayProfit = dayOrders.reduce((acc, o) => acc + calculateOrderProfit(o).netProfit, 0);
              const entregadosCount = dayOrders.filter(o => o.status === 'Entregado').length;
              const devueltosCount = dayOrders.filter(o => o.status === 'Devuelto').length;
              
              const maxProfit = 500; 
              const intensity = Math.min(1, Math.max(0, dayProfit / maxProfit));
              
              return (
                <div 
                  key={i} 
                  className="aspect-square rounded-lg transition-all hover:scale-110 cursor-pointer border border-white/5"
                  style={{ 
                    backgroundColor: intensity > 0.8 ? '#22c55e' : intensity > 0.5 ? '#16a34a' : intensity > 0.2 ? '#15803d' : '#0a0a0a',
                    opacity: intensity + 0.2
                  }}
                  title={`${format(day, 'EEEE dd/MM/yyyy')}\nRentabilidad: ${localFormatCurrency(dayProfit)}\nPedidos Entregados: ${entregadosCount}\nPedidos Devueltos: ${devueltosCount}`}
                />
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 grid grid-cols-3 gap-4 text-center">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display block">Rentabilidad 28d</span>
              <span className={`text-base font-mono font-bold ${totalProfit28 >= 0 ? 'text-positive-green' : 'text-negative-red'}`}>
                {localFormatCurrency(totalProfit28)}
              </span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display block">Entregados 28d</span>
              <span className="text-base font-mono font-bold text-teal-400">
                {totalEntregados28} u.
              </span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display block">Devueltos 28d</span>
              <span className="text-base font-mono font-bold text-red-400">
                {totalDevueltos28} u.
              </span>
            </div>
          </div>
        </div>

        <div className="fintech-card p-8 bg-primary/5 border-primary/20">
          <h3 className="text-xl font-display font-bold text-white mb-4 italic">¿Cuánto necesito vender?</h3>
          <p className="text-[15px] text-slate-400 mb-6">Calcula las unidades necesarias para alcanzar tu meta de ganancia neta.</p>
          
          <div className="space-y-4">
            <div>
              <label className="text-[15px] uppercase tracking-widest text-slate-500 block mb-2">Meta de Ganancia</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-mono">{currencySymbol}</span>
                <input 
                  type="number" 
                  defaultValue={5000}
                  className="w-full bg-background border border-border rounded-xl py-2 pl-8 pr-4 text-white font-mono text-[15px] focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="pt-4 border-t border-border">
              <p className="text-[15px] uppercase tracking-widest text-slate-500 mb-2">Unidades Necesarias</p>
              <p className="text-4xl font-mono font-bold text-white">248 <span className="text-base text-primary font-display uppercase">u.</span></p>
              <p className="text-[15px] text-slate-500 mt-2 italic">*Basado en margen promedio actual ({Math.round(stats.margin || 0)}%)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
