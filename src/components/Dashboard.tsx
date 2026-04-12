import React, { useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, DollarSign, Percent, Target, ShoppingBag } from 'lucide-react';
import { Order, calculateOrderProfit } from '../mockData';
import { format, startOfDay, eachDayOfInterval, subDays, isSameDay } from 'date-fns';

interface DashboardProps {
  orders: Order[];
  stats: any;
  formatCurrency: (amount: number) => string;
  currencySymbol: string;
}

const KPICard = ({ title, value, subValue, icon: Icon, trend, color = 'primary' }: any) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="fintech-card p-6 relative group"
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

const Dashboard: React.FC<DashboardProps> = ({ orders, stats, formatCurrency, currencySymbol }) => {
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
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <KPICard 
          title="Ingresos Brutos" 
          value={formatCurrency(stats.totalRevenue)} 
          subValue="Total facturado 30D"
          icon={DollarSign}
          trend={12.5}
          color="primary"
        />
        <KPICard 
          title="Ganancia Neta" 
          value={formatCurrency(stats.totalNetProfit)} 
          subValue="Después de costos y ads"
          icon={Target}
          trend={8.2}
          color="gold"
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
        <KPICard 
          title="ROAS Global" 
          value={`${(stats.roas || 0).toFixed(2)}x`} 
          subValue="Efectividad de anuncios"
          icon={ShoppingBag}
          trend={15.0}
          color="primary"
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
                  itemStyle={{ color: '#22c55e', fontSize: '15px', fontFamily: 'JetBrains Mono' }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '15px' }}
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
                    <span className="text-[15px] font-mono font-bold text-primary">{formatCurrency(p.profit)}</span>
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
                    <span className="text-[15px] font-mono font-bold text-red-400">{formatCurrency(p.profit)}</span>
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
                  title={`${format(day, 'MMM dd')}: ${formatCurrency(dayProfit)}`}
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
