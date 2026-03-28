import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Truck, TrendingDown, ShieldCheck, Zap } from 'lucide-react';
import { Order } from '../mockData';

interface ShippingAnalysisProps {
  orders: Order[];
  formatCurrency: (amount: number) => string;
}

const ShippingAnalysis: React.FC<ShippingAnalysisProps> = ({ orders, formatCurrency }) => {
  const stats = useMemo(() => {
    const validOrders = orders.filter(o => o.status !== 'Cancelado');
    
    let totalCharged = 0;
    let totalReal = 0;
    let absorbedLossCount = 0;
    const zoneData: Record<string, { charged: number; real: number; count: number }> = {};

    validOrders.forEach(o => {
      totalCharged += o.shippingCharged;
      totalReal += o.shippingReal;
      
      if (o.shippingCharged < o.shippingReal) {
        absorbedLossCount++;
      }

      if (!zoneData[o.country]) {
        zoneData[o.country] = { charged: 0, real: 0, count: 0 };
      }
      zoneData[o.country].charged += o.shippingCharged;
      zoneData[o.country].real += o.shippingReal;
      zoneData[o.country].count += 1;
    });

    const chartData = Object.entries(zoneData).map(([country, data]) => ({
      name: country,
      Cobrado: Math.round(data.charged / data.count),
      Real: Math.round(data.real / data.count),
      diff: Math.round((data.charged - data.real) / data.count)
    }));

    const absorbedRate = validOrders.length > 0 ? (absorbedLossCount / validOrders.length) * 100 : 0;
    const totalShippingLoss = totalReal - totalCharged;

    return { totalCharged, totalReal, absorbedRate, totalShippingLoss, chartData };
  }, [orders]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-display font-bold text-white">Análisis de Fletes</h2>
        <p className="text-sm text-slate-500">Comparativa de logística y eficiencia en envíos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Flete Cobrado Total</p>
          <h3 className="text-2xl font-mono font-bold text-white">{formatCurrency(stats.totalCharged)}</h3>
        </div>
        <div className="glass-card p-6">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Flete Real Pagado</p>
          <h3 className="text-2xl font-mono font-bold text-white">{formatCurrency(stats.totalReal)}</h3>
        </div>
        <div className="glass-card p-6 border-red-500/20 bg-red-500/5">
          <p className="text-[10px] uppercase tracking-widest text-red-400 mb-1">Pérdida Logística</p>
          <h3 className="text-2xl font-mono font-bold text-red-400">{formatCurrency(stats.totalShippingLoss)}</h3>
        </div>
        <div className="glass-card p-6">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">% Flete Absorbido</p>
          <h3 className="text-2xl font-mono font-bold text-gold">{(stats.absorbedRate || 0).toFixed(1)}%</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-8">
          <h3 className="text-xl font-display font-bold text-white mb-8">Comparativa por Zona (Promedio)</h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px', fontFamily: 'DM Mono' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', textTransform: 'uppercase' }} />
                <Bar dataKey="Cobrado" fill="#f5c842" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Real" fill="#00ff88" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-8 flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-display font-bold text-white mb-4">Proyección de Ahorro</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Si ajustas tus tarifas de envío un <span className="text-gold font-bold">15%</span> en las zonas con mayor déficit, podrías recuperar:
            </p>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-neon/10 flex items-center justify-center text-neon">
                  <Zap size={20} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Ahorro Mensual</p>
                  <p className="text-xl font-mono font-bold text-white">{formatCurrency(stats.totalShippingLoss * 0.4)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Impacto en Margen</p>
                  <p className="text-xl font-mono font-bold text-white">+2.4%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-background rounded-xl border border-border">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Sugerencia ECOMMIL</p>
            <p className="text-xs text-slate-300 leading-relaxed italic">
              "Tus envíos a Colombia están perdiendo un promedio de $4.20 por pedido. Considera aumentar el flete cobrado o buscar un proveedor local."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShippingAnalysis;
