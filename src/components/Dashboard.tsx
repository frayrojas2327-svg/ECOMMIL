import React, { useMemo, useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, DollarSign, Percent, Target, ShoppingBag, Globe, Megaphone, Users } from 'lucide-react';
import { Order, calculateOrderProfit, CurrencyCode } from '../mockData';
import { format, startOfDay, eachDayOfInterval, subDays, isSameDay } from 'date-fns';

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

const KPICard = ({ title, value, subValue, icon: Icon, trend, color = 'primary', onClick }: any) => (
  <motion.div 
    whileHover={{ y: -5 }}
    onClick={onClick}
    className={`fintech-card p-6 relative group ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-${color}`}>
      <Icon size={48} />
    </div>
    <p className="text-[15px] font-display uppercase tracking-widest text-slate-500 mb-2">{title}</p>
    <div className="flex items-end gap-3">
      <h3 className="text-3xl font-mono font-bold text-white">{value}</h3>
      {trend && (
        <div className={`flex items-center gap-1 text-[15px] mb-1.5 ${trend > 0 ? 'text-primary' : 'text-red-500'}`}>
          {trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </div>
    <p className="text-[15px] text-slate-500 mt-2 font-mono">{subValue}</p>
  </motion.div>
);

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
  const [isLocalConversionActive, setIsLocalConversionActive] = useState(isConversionActive);

  const deliveredOrders = orders.filter(o => o.status === 'Entregado').length;
  const totalOrders = orders.length;
  
  const cpa = totalOrders > 0 ? (stats.totalAds / totalOrders) : 0;
  const cpaDelivered = deliveredOrders > 0 ? (stats.totalAds / deliveredOrders) : 0;

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

  // Chart Data: Profit by Day
  const chartData = useMemo(() => {
    const last30Days = eachDayOfInterval({
      start: subDays(new Date(), 29),
      end: new Date()
    });

    return last30Days.map(day => {
      const dayOrders = orders.filter(o => isSameDay(o.date, day));
      let dayProfit = 0;
      let dayRevenue = 0;
      
      dayOrders.forEach(o => {
        const { revenue, netProfit } = calculateOrderProfit(o);
        dayProfit += netProfit;
        dayRevenue += revenue;
      });

      return {
        date: format(day, 'MMM dd'),
        profit: Math.round(dayProfit),
        revenue: Math.round(dayRevenue)
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
                onChange={(e) => setManualAdSpend?.(Number(e.target.value))}
                placeholder="0.00"
                className="bg-black/40 border border-white/10 rounded-md py-1 px-2 text-[11px] text-white font-mono w-[80px] focus:border-gold outline-none transition-all text-right"
              />
              <div className="text-[9px] text-slate-600 font-bold uppercase leading-none">
                AUTO:<br/>
                {formatCurrency(stats.autoAds || 0)}
              </div>
            </div>
          </div>

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
        <div className="lg:col-span-2 fintech-card p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-display font-bold text-white">Rentabilidad Diaria</h3>
              <p className="text-[15px] text-slate-500">Histórico de ingresos vs ganancias (30 días)</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary/40" />
                <span className="text-[15px] font-mono text-slate-400">Ingresos</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-[15px] font-mono text-slate-400">Ganancia</span>
              </div>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
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
                  fontSize={15} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#475569" 
                  fontSize={15} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000000', border: '1px solid #1a1a1a', borderRadius: '12px' }}
                  itemStyle={{ color: '#22c55e', fontSize: '15px', fontFamily: 'DM Mono' }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '15px' }}
                  formatter={(value: number) => localFormatCurrency(value)}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#22c55e" 
                  strokeOpacity={0.2}
                  fill="transparent" 
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#22c55e" 
                  fillOpacity={1} 
                  fill="url(#colorProfit)" 
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top/Bottom Products */}
        <div className="fintech-card p-8 flex flex-col">
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
        <div className="lg:col-span-3 fintech-card p-8">
          <h3 className="text-xl font-display font-bold text-white mb-6">Mapa de Calor de Rentabilidad</h3>
          <div className="grid grid-cols-7 gap-2">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
              <div key={day} className="text-center text-[15px] uppercase text-slate-500 font-display">{day}</div>
            ))}
            {Array.from({ length: 28 }).map((_, i) => {
              const day = subDays(new Date(), 27 - i);
              const dayOrders = orders.filter(o => isSameDay(o.date, day));
              const dayProfit = dayOrders.reduce((acc, o) => acc + calculateOrderProfit(o).netProfit, 0);
              
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
                  title={`${format(day, 'MMM dd')}: ${localFormatCurrency(dayProfit)}`}
                />
              );
            })}
          </div>
          <div className="mt-6 flex items-center justify-end gap-4">
            <span className="text-[15px] text-slate-500 uppercase font-display">Menos</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-sm bg-[#0a0a0a]" />
              <div className="w-3 h-3 rounded-sm bg-[#15803d]" />
              <div className="w-3 h-3 rounded-sm bg-[#16a34a]" />
              <div className="w-3 h-3 rounded-sm bg-[#22c55e]" />
            </div>
            <span className="text-[15px] text-slate-500 uppercase font-display">Más</span>
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
