import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, ChevronDown, CheckCircle2, Truck, RotateCcw, XCircle, Clock, Trash2, Square, CheckSquare, AlertTriangle } from 'lucide-react';
import { Order, calculateOrderProfit, OrderStatus } from '../mockData';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface OrderManagementProps {
  orders: Order[];
  formatCurrency: (amount: number) => string;
  onDeleteOrders?: (ids: string[]) => void;
}

const StatusBadge = ({ status }: { status: OrderStatus }) => {
  const styles = {
    'Confirmado': 'bg-neon/10 text-neon border-neon/20',
    'En tránsito': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Devuelto': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'Cancelado': 'bg-red-500/10 text-red-400 border-red-500/20',
    'Pendiente': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

  const icons = {
    'Confirmado': <CheckCircle2 size={12} />,
    'En tránsito': <Truck size={12} />,
    'Devuelto': <RotateCcw size={12} />,
    'Cancelado': <XCircle size={12} />,
    'Pendiente': <Clock size={12} />,
  };

  return (
    <span className={`px-2 py-1 rounded-md text-[15px] font-bold border flex items-center gap-1.5 w-fit ${styles[status]}`}>
      {icons[status]}
      {status.toUpperCase()}
    </span>
  );
};

const OrderManagement: React.FC<OrderManagementProps> = ({ orders, formatCurrency, onDeleteOrders }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'All'>('All');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState<{ type: 'selected' | 'all' } | null>(null);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           order.product.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedOrderIds.length === 0) return;
    setShowConfirm({ type: 'selected' });
  };

  const confirmDelete = () => {
    if (!showConfirm || !onDeleteOrders) return;
    
    if (showConfirm.type === 'selected') {
      onDeleteOrders(selectedOrderIds);
      setSelectedOrderIds([]);
    }
    setShowConfirm(null);
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Fecha', 'Producto', 'Costo', 'Precio', 'Flete', 'Ganancia', 'Status'];
    const rows = filteredOrders.map(o => {
      const { netProfit } = calculateOrderProfit(o);
      return [
        o.id,
        format(o.date, 'yyyy-MM-dd'),
        o.product,
        o.cost.toFixed(2),
        o.price.toFixed(2),
        o.shippingReal.toFixed(2),
        netProfit.toFixed(2),
        o.status
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `ecommil_orders_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Gestión de Pedidos</h2>
          <p className="text-[15px] text-slate-500">Visualiza y filtra cada transacción en detalle</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedOrderIds.length > 0 && (
            <button 
              onClick={handleDeleteSelected}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
            >
              <Trash2 size={18} /> Borrar Seleccionados ({selectedOrderIds.length})
            </button>
          )}
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-neon text-background rounded-xl font-bold text-sm hover:bg-neon/90 transition-all"
          >
            <Download size={18} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="glass-card">
        {/* Filters Bar */}
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-4 bg-white/5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por ID o producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-[15px] text-white focus:outline-none focus:border-neon"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-display text-slate-500 uppercase">Estado:</span>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-background border border-border rounded-lg py-2 px-3 text-[15px] text-white focus:outline-none focus:border-neon"
            >
              <option value="All">Todos los estados</option>
              <option value="Confirmado">Confirmado</option>
              <option value="En tránsito">En tránsito</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Devuelto">Devuelto</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background/50 text-[15px] uppercase tracking-widest text-slate-500 font-display">
                <th className="p-4 font-medium border-b border-border w-10">
                  <button 
                    onClick={toggleSelectAll}
                    className="p-1 hover:text-neon transition-colors"
                  >
                    {selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0 ? <CheckSquare size={16} className="text-neon" /> : <Square size={16} />}
                  </button>
                </th>
                <th className="p-4 font-medium border-b border-border">Orden ID</th>
                <th className="p-4 font-medium border-b border-border">Fecha</th>
                <th className="p-4 font-medium border-b border-border">Producto</th>
                <th className="p-4 font-medium border-b border-border text-right">Costo</th>
                <th className="p-4 font-medium border-b border-border text-right">Venta</th>
                <th className="p-4 font-medium border-b border-border text-right">Flete</th>
                <th className="p-4 font-medium border-b border-border text-right">Ganancia</th>
                <th className="p-4 font-medium border-b border-border text-center">Margen</th>
                <th className="p-4 font-medium border-b border-border">Estado</th>
              </tr>
            </thead>
            <tbody className="text-[15px] font-mono">
              {filteredOrders.map((order) => {
                const { netProfit, margin } = calculateOrderProfit(order);
                const isSelected = selectedOrderIds.includes(order.id);
                return (
                  <tr key={order.id} className={`hover:bg-white/5 transition-colors group ${isSelected ? 'bg-neon/5' : ''}`}>
                    <td className="p-4 border-b border-border">
                      <button 
                        onClick={() => toggleSelectOrder(order.id)}
                        className="p-1 hover:text-neon transition-colors"
                      >
                        {isSelected ? <CheckSquare size={16} className="text-neon" /> : <Square size={16} />}
                      </button>
                    </td>
                    <td className="p-4 border-b border-border font-bold text-white">{order.id}</td>
                    <td className="p-4 border-b border-border text-slate-500 text-[15px]">{format(order.date, 'MMM dd, yyyy')}</td>
                    <td className="p-4 border-b border-border text-slate-300 truncate max-w-[180px]">{order.product}</td>
                    <td className="p-4 border-b border-border text-right text-slate-400">{formatCurrency(order.cost)}</td>
                    <td className="p-4 border-b border-border text-right text-white font-bold">{formatCurrency(order.price)}</td>
                    <td className="p-4 border-b border-border text-right text-slate-400">{formatCurrency(order.shippingReal)}</td>
                    <td className={`p-4 border-b border-border text-right font-bold ${netProfit > 0 ? 'text-neon' : netProfit < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {formatCurrency(netProfit)}
                    </td>
                    <td className="p-4 border-b border-border text-center">
                      <span className={`text-[15px] px-1.5 py-0.5 rounded ${margin > 20 ? 'bg-neon/10 text-neon' : margin > 0 ? 'bg-gold/10 text-gold' : 'bg-red-500/10 text-red-400'}`}>
                        {Math.round(margin || 0)}%
                      </span>
                    </td>
                    <td className="p-4 border-b border-border">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-slate-500 italic">No se encontraron pedidos con los filtros aplicados.</p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 max-w-sm w-full space-y-4 border-neon/30"
            >
              <div className="flex items-center gap-3 text-gold">
                <AlertTriangle size={24} />
                <h4 className="text-lg font-display font-bold text-white">¿Confirmar Acción?</h4>
              </div>
              <p className="text-[15px] text-slate-400">
                ¿Estás seguro de que deseas eliminar {selectedOrderIds.length} pedidos seleccionados? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 py-2 rounded-xl border border-border text-slate-400 hover:text-white transition-all text-[12px] font-bold uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all text-[12px] font-bold uppercase tracking-widest"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrderManagement;
