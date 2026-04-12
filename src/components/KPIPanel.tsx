import React, { useMemo } from 'react';
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
  Zap
} from 'lucide-react';
import { Order, calculateOrderProfit } from '../mockData';

interface KPIPanelProps {
  orders: Order[];
  stats: any;
  formatCurrency: (amount: number) => string;
}

const MetricCard = ({ title, value, subValue, trend, icon: Icon, description, color = 'neon' }: any) => (
  <div className="border border-border bg-card/50 p-6 relative overflow-hidden group">
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

const KPIPanel: React.FC<KPIPanelProps> = ({ orders, stats, formatCurrency }) => {
  const kpis = useMemo(() => {
    const totalOrders = orders.length;
    const confirmedOrders = orders.filter(o => o.status !== 'Cancelado').length;
    const totalAds = orders.reduce((acc, o) => acc + o.adsCost, 0);
    const totalShipping = orders.reduce((acc, o) => acc + o.shippingReal, 0);
    
    const aov = totalOrders > 0 ? stats.totalRevenue / totalOrders : 0;
    const cac = confirmedOrders > 0 ? totalAds / confirmedOrders : 0;
    const returnRate = totalOrders > 0 ? (orders.filter(o => o.status === 'Devuelto').length / totalOrders) * 100 : 0;
    const cancelRate = totalOrders > 0 ? (orders.filter(o => o.status === 'Cancelado').length / totalOrders) * 100 : 0;
    const shippingEfficiency = stats.totalRevenue > 0 ? (totalShipping / stats.totalRevenue) * 100 : 0;

    return { aov, cac, returnRate, cancelRate, shippingEfficiency };
  }, [orders, stats]);

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
        <div className="flex items-center gap-4 text-[15px] font-mono text-slate-500 uppercase tracking-widest">
          <span className="flex items-center gap-1"><Zap size={10} className="text-neon" /> Actualizado: Tiempo Real</span>
          <span className="w-1 h-1 rounded-full bg-slate-700" />
          <span>Periodo: Últimos 30 Días</span>
        </div>
      </div>

      {/* Primary Financial KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
        <MetricCard 
          title="Ingresos (Gross)"
          value={formatCurrency(stats.totalRevenue)}
          subValue="Facturación bruta total"
          description="Suma de precio + envío cobrado de todos los pedidos."
          trend={14.2}
          icon={DollarSign}
        />
        <MetricCard 
          title="Ganancia (Net)"
          value={formatCurrency(stats.totalNetProfit)}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <MetricCard 
            title="AOV (Ticket Promedio)"
            value={formatCurrency(kpis.aov)}
            subValue="Average Order Value"
            description="Monto promedio facturado por cada pedido realizado."
            trend={5.2}
            icon={ShoppingBag}
          />
          <MetricCard 
            title="CAC (Adquisición)"
            value={formatCurrency(kpis.cac)}
            subValue="Customer Acquisition Cost"
            description="Costo promedio de marketing para obtener un pedido confirmado."
            trend={-3.1}
            icon={Users}
            color="gold"
          />
        </div>
        
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <MetricCard 
            title="Tasa de Devolución"
            value={`${(kpis.returnRate || 0).toFixed(1)}%`}
            subValue="Return Rate"
            description="Porcentaje de pedidos que terminan en devolución."
            trend={1.2}
            icon={Truck}
            color="red-500"
          />
          <MetricCard 
            title="Tasa de Cancelación"
            value={`${(kpis.cancelRate || 0).toFixed(1)}%`}
            subValue="Cancellation Rate"
            description="Pedidos cancelados antes de ser procesados."
            trend={-0.8}
            icon={AlertCircle}
            color="red-500"
          />
        </div>
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
                <p className="text-lg font-mono font-bold text-white">{formatCurrency(orders.reduce((acc, o) => acc + o.shippingReal, 0))}</p>
              </div>
              <div className="p-4 bg-white/5 border border-border rounded-lg">
                <p className="text-[15px] uppercase text-slate-500 mb-1">Costo Producto</p>
                <p className="text-lg font-mono font-bold text-white">{formatCurrency(orders.reduce((acc, o) => acc + o.cost, 0))}</p>
              </div>
              <div className="p-4 bg-white/5 border border-border rounded-lg">
                <p className="text-[15px] uppercase text-slate-500 mb-1">Costo Ads</p>
                <p className="text-lg font-mono font-bold text-white">{formatCurrency(orders.reduce((acc, o) => acc + o.adsCost, 0))}</p>
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
    </div>
  );
};

export default KPIPanel;
