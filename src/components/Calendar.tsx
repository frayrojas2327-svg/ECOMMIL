import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, calculateOrderProfit } from '../mockData';

interface CalendarProps {
  orders: Order[];
  formatCurrency: (amount: number) => string;
}

export default function Calendar({ orders, formatCurrency }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Padding for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // Days of current month
    for (let i = 1; i <= lastDate; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [currentDate]);

  const monthOrders = useMemo(() => {
    return orders.filter(order => {
      const orderDate = new Date(order.date);
      return orderDate.getMonth() === currentDate.getMonth() && 
             orderDate.getFullYear() === currentDate.getFullYear();
    });
  }, [orders, currentDate]);

  const getDayStats = (date: Date) => {
    const dayOrders = orders.filter(order => {
      const orderDate = new Date(order.date);
      return orderDate.getDate() === date.getDate() &&
             orderDate.getMonth() === date.getMonth() &&
             orderDate.getFullYear() === date.getFullYear();
    });

    let revenue = 0;
    let profit = 0;
    dayOrders.forEach(o => {
      const { revenue: r, netProfit: p } = calculateOrderProfit(o);
      revenue += r;
      profit += p;
    });

    return { revenue, profit, count: dayOrders.length };
  };

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const monthName = currentDate.toLocaleString('es-ES', { month: 'long' });
  const year = currentDate.getFullYear();

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white capitalize">{monthName} {year}</h2>
          <p className="text-slate-400 text-[15px]">Vista mensual de rendimiento financiero.</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl p-1">
          <button onClick={prevMonth} className="p-2 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-[13px] font-bold text-primary hover:bg-primary/10 rounded-lg transition-all">
            Hoy
          </button>
          <button onClick={nextMonth} className="p-2 text-slate-400 hover:text-white transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="fintech-card overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-800/50 border-b border-border">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
            <div key={day} className="py-3 text-center text-[13px] font-bold text-slate-400 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7">
          {daysInMonth.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} className="h-32 border-b border-r border-border/30 bg-background/20" />;
            
            const stats = getDayStats(date);
            const isToday = new Date().toDateString() === date.toDateString();
            
            return (
              <div key={date.toISOString()} className={`h-32 border-b border-r border-border/30 p-2 transition-colors hover:bg-white/5 relative group ${isToday ? 'bg-primary/5' : ''}`}>
                <span className={`text-[13px] font-mono font-bold ${isToday ? 'text-primary' : 'text-slate-500'}`}>
                  {date.getDate()}
                </span>
                
                {stats.count > 0 && (
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-neon">
                      <TrendingUp size={10} />
                      {formatCurrency(stats.revenue)}
                    </div>
                    <div className={`flex items-center gap-1 text-[11px] font-bold ${stats.profit >= 0 ? 'text-secondary' : 'text-red-400'}`}>
                      {stats.profit >= 0 ? <DollarSign size={10} /> : <TrendingDown size={10} />}
                      {formatCurrency(stats.profit)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {stats.count} pedidos
                    </div>
                  </div>
                )}
                
                {isToday && (
                  <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Month Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="fintech-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">Ventas Mes</p>
            <p className="text-xl font-mono font-bold text-white">
              {formatCurrency(monthOrders.reduce((acc, o) => acc + calculateOrderProfit(o).revenue, 0))}
            </p>
          </div>
        </div>
        <div className="fintech-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-secondary/20 flex items-center justify-center text-secondary">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">Utilidad Mes</p>
            <p className="text-xl font-mono font-bold text-white">
              {formatCurrency(monthOrders.reduce((acc, o) => acc + calculateOrderProfit(o).netProfit, 0))}
            </p>
          </div>
        </div>
        <div className="fintech-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400">
            <CalendarIcon size={24} />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">Total Pedidos</p>
            <p className="text-xl font-mono font-bold text-white">{monthOrders.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
