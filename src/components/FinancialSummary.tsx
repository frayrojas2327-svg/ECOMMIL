import React, { useMemo, useRef, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowUpRight, ArrowDownRight, FileText, Download, ChevronDown, ArrowUp, Globe } from 'lucide-react';
import { Order, calculateOrderProfit, CurrencyCode } from '../mockData';

interface FinancialSummaryProps {
  orders: Order[];
  formatCurrency: (amount: number) => string;
  currency?: CurrencyCode;
  currencies?: any;
  isConversionActive?: boolean;
}

const FinancialSummary: React.FC<FinancialSummaryProps> = ({ orders, formatCurrency, currency = 'USD', currencies = {}, isConversionActive = false }) => {
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

  const topRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const financialData = useMemo(() => {
    let revenue = 0;
    let cogs = 0;
    let shipping = 0;
    let ads = 0;
    let fees = 0;
    let returnsLoss = 0;

    orders.forEach(o => {
      const { revenue: r, netProfit } = calculateOrderProfit(o);
      revenue += r;
      
      if (o.status !== 'Cancelado') {
        cogs += o.cost;
        shipping += o.shippingReal;
        ads += o.adsCost;
        fees += o.price * o.platformFee;
      }
      
      if (o.status === 'Devuelto') {
        // Returns loss was already factored into netProfit in mockData, 
        // but here we break it down for P&L
        returnsLoss += (o.shippingReal * 0.5); // extra cost for return shipping
      }
    });

    const grossProfit = revenue - cogs;
    const ebitda = grossProfit - shipping - ads - fees - returnsLoss;

    const chartData = [
      { name: 'Ingresos', value: revenue, color: '#00ff88' },
      { name: 'COGS', value: -cogs, color: '#f5c842' },
      { name: 'Fletes', value: -shipping, color: '#3b82f6' },
      { name: 'Ads', value: -ads, color: '#8b5cf6' },
      { name: 'Comisiones', value: -fees, color: '#64748b' },
      { name: 'Devoluciones', value: -returnsLoss, color: '#ef4444' },
    ];

    return { revenue, cogs, shipping, ads, fees, returnsLoss, grossProfit, ebitda, chartData };
  }, [orders]);

  return (
    <div className="space-y-8">
      <div ref={topRef} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Resumen Financiero Mensual</h2>
          <p className="text-base text-slate-500">Estado de resultados (P&L) y desglose de gastos</p>
        </div>
        <div className="flex items-center gap-3">
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
          <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-slate-400 font-bold text-base hover:text-white hover:bg-white/5 transition-all">
            <Download size={18} /> Descargar PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* P&L Table */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="p-6 border-b border-border bg-white/5 flex items-center justify-between">
            <h3 className="text-base font-display font-bold text-white flex items-center gap-2">
              <FileText size={16} className="text-neon" /> Profit & Loss Statement
            </h3>
            <span className="text-[15px] text-slate-500 font-mono">MARZO 2026</span>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-base text-slate-300">Ingresos Totales</span>
              <span className="text-base font-mono font-bold text-white">{localFormatCurrency(financialData.revenue)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-base text-slate-400">(-) Costo de Mercadería (COGS)</span>
              <span className="text-base font-mono text-red-400">({localFormatCurrency(financialData.cogs)})</span>
            </div>
            <div className="flex justify-between items-center py-3 bg-neon/5 px-4 rounded-lg">
              <span className="text-base font-bold text-neon">Utilidad Bruta</span>
              <span className="text-base font-mono font-bold text-neon">{localFormatCurrency(financialData.grossProfit)}</span>
            </div>
            
            <div className="space-y-2 pt-4">
              <div className="flex justify-between items-center py-2">
                <span className="text-base text-slate-400">(-) Gastos de Envío</span>
                <span className="text-base font-mono text-slate-300">{localFormatCurrency(financialData.shipping)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-base text-slate-400">(-) Marketing & Ads</span>
                <span className="text-base font-mono text-slate-300">{localFormatCurrency(financialData.ads)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-base text-slate-400">(-) Comisiones de Plataforma</span>
                <span className="text-base font-mono text-slate-300">{localFormatCurrency(financialData.fees)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-base text-slate-400">(-) Logística de Devoluciones</span>
                <span className="text-base font-mono text-slate-300">{localFormatCurrency(financialData.returnsLoss)}</span>
              </div>
            </div>

            <div className="mt-6 p-6 bg-card border border-neon/30 rounded-xl flex justify-between items-center neon-glow">
              <div>
                <p className="text-[15px] uppercase tracking-widest text-neon font-bold mb-1">Ganancia Neta Final</p>
                <p className="text-3xl font-mono font-bold text-white">{localFormatCurrency(financialData.ebitda)}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-neon text-base font-bold mb-1">
                  <ArrowUpRight size={14} /> 14.2%
                </div>
                <p className="text-[15px] text-slate-500 uppercase">vs mes anterior</p>
              </div>
            </div>
          </div>
        </div>

        {/* Expense Breakdown Chart */}
        <div className="glass-card p-8">
          <h3 className="text-xl font-display font-bold text-white mb-8">Estructura de Costos</h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialData.chartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="#475569" 
                  fontSize={15} 
                  tickLine={false} 
                  axisLine={false}
                  width={80}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1f1f2e', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '15px', fontFamily: 'DM Mono' }}
                  formatter={(value: number) => localFormatCurrency(Math.abs(value))}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {financialData.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-8 space-y-4">
            <div className="p-4 bg-background rounded-xl border border-border">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[15px] uppercase text-slate-500">Break-even Point</span>
                <span className="text-base font-mono text-white">{localFormatCurrency(financialData.revenue * 0.65)}</span>
              </div>
              <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-gold w-[65%]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Scroll to Top Button */}
      <button 
        onClick={scrollToTop}
        className="fixed bottom-8 right-8 p-3 bg-neon text-background rounded-full shadow-2xl shadow-neon/40 hover:scale-110 transition-all z-50"
      >
        <ArrowUp size={24} />
      </button>
    </div>
  );
};

export default FinancialSummary;
