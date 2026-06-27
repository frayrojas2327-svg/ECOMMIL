import React, { useState, useEffect } from 'react';
import { Calendar, Coins, TrendingUp, Trash2, Search, Filter, AlertTriangle, TrendingDown, Sparkles, X, Plus, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface AdDailyLog {
  id: string;
  date: string;
  platform: string;
  campaignType: 'whatsapp' | 'landing';
  spend: number;
  salesCount: number;
}

export default function AdPanel({ theme = 'theme-dark-green' }: { theme?: string }) {
  const isLight = theme === 'theme-light-white';

  const [adDailyLogs, setAdDailyLogs] = useState<AdDailyLog[]>(() => {
    const saved = localStorage.getItem('profit_os_ad_daily_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 'log-1', date: format(new Date(), 'yyyy-MM-dd'), platform: 'TikTok Ads', campaignType: 'whatsapp', spend: 120, salesCount: 15 },
      { id: 'log-2', date: format(new Date(), 'yyyy-MM-dd'), platform: 'Facebook Ads', campaignType: 'landing', spend: 250, salesCount: 22 },
      { id: 'log-3', date: format(new Date(), 'yyyy-MM-dd'), platform: 'Instagram Ads', campaignType: 'landing', spend: 180, salesCount: 18 }
    ];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [adLogForm, setAdLogForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    platform: 'TikTok Ads',
    campaignType: 'landing' as 'whatsapp' | 'landing',
    spend: 100,
    salesCount: 10
  });

  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterCampaign, setFilterCampaign] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('profit_os_ad_daily_logs', JSON.stringify(adDailyLogs));
  }, [adDailyLogs]);

  const handleAddAdLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLogId) {
      setAdDailyLogs(prev => prev.map(log => {
        if (log.id === editingLogId) {
          return {
            ...log,
            date: adLogForm.date || format(new Date(), 'yyyy-MM-dd'),
            platform: adLogForm.platform,
            campaignType: adLogForm.campaignType,
            spend: Number(adLogForm.spend) || 0,
            salesCount: Number(adLogForm.salesCount) || 0
          };
        }
        return log;
      }));
      setEditingLogId(null);
    } else {
      const newLog: AdDailyLog = {
        id: `log-${Date.now()}`,
        date: adLogForm.date || format(new Date(), 'yyyy-MM-dd'),
        platform: adLogForm.platform,
        campaignType: adLogForm.campaignType,
        spend: Number(adLogForm.spend) || 0,
        salesCount: Number(adLogForm.salesCount) || 0
      };
      setAdDailyLogs(prev => [newLog, ...prev]);
    }
    setIsModalOpen(false); // Close modal on submit
    
    // Reset form fields while retaining date and platform
    setAdLogForm(prev => ({
      ...prev,
      spend: 100,
      salesCount: 10
    }));
  };

  const handleEditAdLog = (log: AdDailyLog) => {
    setEditingLogId(log.id);
    setAdLogForm({
      date: log.date,
      platform: log.platform,
      campaignType: log.campaignType,
      spend: log.spend,
      salesCount: log.salesCount
    });
    setIsModalOpen(true);
  };

  const handleDeleteAdLog = (id: string) => {
    setAdDailyLogs(prev => prev.filter(log => log.id !== id));
    if (editingLogId === id) {
      setEditingLogId(null);
    }
  };

  const filteredLogs = adDailyLogs.filter(log => {
    const matchPlatform = filterPlatform === 'all' || log.platform === filterPlatform;
    const matchCampaign = filterCampaign === 'all' || log.campaignType === filterCampaign;
    const matchStartDate = !filterStartDate || log.date >= filterStartDate;
    const matchEndDate = !filterEndDate || log.date <= filterEndDate;
    return matchPlatform && matchCampaign && matchStartDate && matchEndDate;
  });

  // Calculate totals for filtered logs
  const totalSpend = filteredLogs.reduce((sum, log) => sum + log.spend, 0);
  const totalSalesCount = filteredLogs.reduce((sum, log) => sum + log.salesCount, 0);
  const averageCpa = totalSalesCount > 0 ? totalSpend / totalSalesCount : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/5 rounded-3xl p-6 shadow-2xl backdrop-blur-md relative overflow-hidden ${isLight ? 'bg-[#fffbfb]' : 'bg-[#0f0f15]/80'}`}>
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#00df9a]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div>
          <h2 className={`text-4xl font-display font-black tracking-tighter uppercase leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>
            PANEL <span className="text-[#00df9a]">ADS</span>
          </h2>
          <p className={`text-xs mt-2 font-sans max-w-xl ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Herramienta independiente para registrar inversión diaria, segmentar por plataforma o tipo de campaña, y obtener el CPA exacto en tiempo real.
          </p>
        </div>

        {/* Global summary stats */}
        <div className="flex flex-wrap gap-3">
          <div className={`border rounded-2xl px-5 py-3 min-w-[120px] ${isLight ? 'bg-[#ffffff] border-slate-200 text-left' : 'border-white/5 bg-white/[0.02] text-right'}`}>
            <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-widest font-sans">Inversión Total</span>
            <span className={`text-lg font-black tabular-nums block ${isLight ? 'text-slate-900 text-left' : 'text-white'}`}>${totalSpend.toLocaleString('en-US')}</span>
          </div>
          <div className={`border rounded-2xl px-5 py-3 min-w-[120px] ${isLight ? 'bg-[#ffffff] border-slate-200 text-left' : 'border-white/5 bg-white/[0.02] text-right'}`}>
            <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-widest font-sans">Ventas Totales</span>
            <span className={`font-black tabular-nums block ${isLight ? 'text-[19px] text-emerald-600 text-left' : 'text-lg text-[#00df9a]'}`}>{totalSalesCount}</span>
          </div>
          <div className={`border rounded-2xl px-5 py-3 text-right min-w-[120px] ${isLight ? 'bg-orange-50 border-orange-200' : 'bg-orange-500/10 border border-orange-500/20'}`}>
            <span className={`text-[9px] font-bold block uppercase tracking-widest font-sans ${isLight ? 'text-orange-700' : 'text-orange-400'}`}>CPA Promedio</span>
            <span className={`text-lg font-black tabular-nums ${isLight ? 'text-orange-600' : 'text-orange-400'}`}>${averageCpa.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Main Full-Width Area */}
      <div className={`border rounded-3xl p-6 shadow-xl space-y-6 ${isLight ? 'bg-[#ffffff] border-slate-200 shadow-slate-100' : 'bg-[#0f0f15]/90 border border-white/5'}`}>
        
        {/* Upper Action Bar with filters and "Registrar Pauta" button */}
        <div className={`flex flex-wrap items-center justify-between gap-4 border-b pb-5 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={15} className={isLight ? 'text-slate-500' : 'text-slate-400'} />
              <h4 className={`text-[15px] font-black uppercase tracking-widest font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Filtrar Datos
              </h4>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <select 
                value={filterPlatform}
                onChange={e => setFilterPlatform(e.target.value)}
                className={`border rounded-xl px-4 py-2 text-[15px] focus:outline-none focus:border-orange-500 cursor-pointer ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#111] border-white/5 text-slate-300'}`}
              >
                <option value="all">Todas las plataformas</option>
                <option value="TikTok Ads">TikTok Ads</option>
                <option value="Facebook Ads">Facebook Ads</option>
                <option value="Instagram Ads">Instagram Ads</option>
                <option value="Google Ads">Google Ads</option>
                <option value="Pinterest Ads">Pinterest Ads</option>
                <option value="WhatsApp Orgánico">WhatsApp Orgánico</option>
              </select>

              <select 
                value={filterCampaign}
                onChange={e => setFilterCampaign(e.target.value)}
                className={`border rounded-xl px-4 py-2 text-[15px] focus:outline-none focus:border-orange-500 cursor-pointer ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#111] border-white/5 text-slate-300'}`}
              >
                <option value="all">Todos los tipos</option>
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="landing">📲 Página</option>
              </select>

              {/* Fecha Inicio Filter */}
              <div className={`flex items-center gap-2 border rounded-xl px-4 py-2 text-[15px] ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111] border-white/5'}`}>
                <span className="text-slate-500 text-[11px] font-black uppercase tracking-wider font-sans">Desde</span>
                <input 
                  type="date"
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                  className={`bg-transparent text-[14px] focus:outline-none cursor-pointer ${isLight ? 'text-slate-800' : 'text-slate-300 focus:text-white'}`}
                />
                {filterStartDate && (
                  <button 
                    type="button"
                    onClick={() => setFilterStartDate('')}
                    className="text-slate-500 hover:text-white font-bold ml-1 text-sm"
                    title="Limpiar fecha"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Fecha Fin Filter */}
              <div className={`flex items-center gap-2 border rounded-xl px-4 py-2 text-[15px] ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111] border-white/5'}`}>
                <span className="text-slate-500 text-[11px] font-black uppercase tracking-wider font-sans">Hasta</span>
                <input 
                  type="date"
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                  className={`bg-transparent text-[14px] focus:outline-none cursor-pointer ${isLight ? 'text-slate-800' : 'text-slate-300 focus:text-white'}`}
                />
                {filterEndDate && (
                  <button 
                    type="button"
                    onClick={() => setFilterEndDate('')}
                    className="text-slate-500 hover:text-white font-bold ml-1 text-sm"
                    title="Limpiar fecha"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action button triggers the beautiful modal overlay */}
          <button
            type="button"
            onClick={() => {
              setEditingLogId(null);
              setAdLogForm({
                date: format(new Date(), 'yyyy-MM-dd'),
                platform: 'TikTok Ads',
                campaignType: 'landing',
                spend: 100,
                salesCount: 10
              });
              setIsModalOpen(true);
            }}
            className={`px-6 py-3 bg-gradient-to-r from-orange-500 to-[#ff9100] hover:scale-[1.02] active:scale-[0.98] rounded-xl font-black text-[15px] uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-orange-500/10 flex items-center gap-2 ${
              isLight ? 'border border-[#d9e5f1] text-[#f6f9ff]' : 'text-white'
            }`}
          >
            <Plus size={15} />
            Registrar Pauta
          </button>
        </div>

        {/* Full-width Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`border-b ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                <th className="py-3.5 text-[15px] font-black text-slate-500 uppercase tracking-widest font-sans">Fecha</th>
                <th className="py-3.5 text-[15px] font-black text-slate-500 uppercase tracking-widest font-sans">Plataforma</th>
                <th className="py-3.5 text-[15px] font-black text-slate-500 uppercase tracking-widest font-sans">Campaña</th>
                <th className={`py-3.5 text-[15px] font-black text-slate-500 uppercase tracking-widest font-sans ${isLight ? 'text-center' : ''}`}>Gasto Total</th>
                <th className={`py-3.5 text-[15px] font-black text-slate-500 uppercase tracking-widest font-sans ${isLight ? 'text-center' : ''}`}>Ventas</th>
                <th className="py-3.5 text-[15px] font-black text-slate-500 uppercase tracking-widest font-sans text-right">CPA Calculado</th>
                <th className="py-3.5 text-[15px] font-black text-slate-500 uppercase tracking-widest font-sans text-center w-12">Acción</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-white/[0.02]'}`}>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[15px] text-slate-500 italic font-sans">
                    No se encontraron registros para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const logCpa = log.salesCount > 0 ? log.spend / log.salesCount : 0;
                  
                  let cpaBadgeColor = "text-emerald-400 bg-emerald-50/5 border-emerald-500/20";
                  if (logCpa > 25) {
                    cpaBadgeColor = isLight 
                      ? "text-rose-700 bg-rose-50 border-rose-200" 
                      : "text-rose-400 bg-rose-500/5 border-rose-500/20";
                  } else if (logCpa > 15) {
                    cpaBadgeColor = isLight 
                      ? "text-amber-700 bg-amber-50 border-amber-200" 
                      : "text-amber-400 bg-amber-500/5 border-amber-500/20";
                  } else if (isLight) {
                    cpaBadgeColor = "text-[#0a392d] bg-emerald-50 border-emerald-200";
                  }

                  return (
                    <tr key={log.id} className={`${isLight ? 'hover:bg-slate-50/50' : 'hover:bg-white/[0.01]'} transition-colors group`}>
                      <td className={`py-4 text-[15px] font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{log.date}</td>
                      <td className={`py-4 text-[15px] font-black font-sans ${isLight ? 'text-slate-800' : 'text-white'}`}>{log.platform}</td>
                      <td className="py-4">
                        <span className={`px-3 py-1 rounded-full text-[15px] font-black border uppercase tracking-wider font-sans ${
                          log.campaignType === 'whatsapp' 
                            ? (isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20') 
                            : (isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/10 text-blue-400 border-blue-500/20')
                        }`}>
                          {log.campaignType === 'whatsapp' ? '💬 wtsap' : '📲 pagina'}
                        </span>
                      </td>
                      <td className={`py-4 text-[15px] tabular-nums font-sans ${isLight ? 'text-center font-bold text-slate-800' : 'font-medium text-slate-300'}`}>${log.spend.toFixed(2)}</td>
                      <td className={`py-4 text-[15px] tabular-nums font-sans ${isLight ? 'text-center font-bold text-slate-800' : 'font-medium text-slate-300'}`}>{log.salesCount}</td>
                      <td className="py-4 text-[15px] text-right font-black tabular-nums font-mono">
                        <span className={`px-3 py-1.5 rounded-xl border font-mono ${cpaBadgeColor}`}>
                          ${logCpa.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            type="button"
                            onClick={() => handleEditAdLog(log)}
                            className={`p-1.5 rounded-lg transition-all active:scale-90 ${isLight ? 'text-slate-500 hover:text-orange-600 hover:bg-orange-50' : 'text-slate-400 hover:text-orange-400 hover:bg-orange-500/10'}`}
                            title="Editar registro"
                          >
                            <Pencil size={15} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteAdLog(log.id)}
                            className={`p-1.5 rounded-lg transition-all active:scale-90 ${isLight ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'}`}
                            title="Eliminar registro"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {adDailyLogs.length > 0 && (
          <div className={`flex justify-between items-center mt-6 border-t pt-4 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
            <span className="text-[15px] text-slate-500 font-bold uppercase tracking-wider font-sans">
              Mostrando {filteredLogs.length} de {adDailyLogs.length} registros diarios
            </span>
            <button 
              type="button"
              onClick={() => {
                if (confirm('¿Estás seguro de que quieres borrar todos los registros del historial?')) {
                  setAdDailyLogs([]);
                }
              }}
              className={`px-4 py-2 border rounded-xl text-[15px] font-bold uppercase tracking-widest transition-all active:scale-95 font-sans ${isLight ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-300' : 'bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 hover:border-red-500/30 text-red-400'}`}
            >
              🗑️ Limpiar Historial Ads
            </button>
          </div>
        )}
      </div>

      {/* Modal Overlay Dialog */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Dialog Card */}
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className={`relative w-full max-w-md border rounded-3xl p-6 shadow-2xl overflow-hidden backdrop-blur-lg ${isLight ? 'bg-white border-slate-200' : 'bg-[#0f0f15]/95 border border-white/10'}`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#00df9a]/5 rounded-full blur-2xl pointer-events-none" />

              {/* Close Button */}
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className={`absolute top-4 right-4 p-1.5 rounded-lg transition-all ${isLight ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <X size={16} />
              </button>

              <form onSubmit={handleAddAdLog} className="space-y-5 relative">
                <div className={`flex items-center gap-2 border-b pb-3 pr-8 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                  <span className="text-xl">{editingLogId ? "✏️" : "✍️"}</span>
                  <div>
                    <h4 className={`text-[15px] font-black uppercase tracking-wider font-sans ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {editingLogId ? "Editar Día de Pauta" : "Registrar Día de Pauta"}
                    </h4>
                    <p className={`text-[15px] font-sans mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {editingLogId ? "Modifica las métricas de este registro." : "Introduce las métricas reales de tus anuncios."}
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className={`text-[15px] font-black uppercase tracking-widest block mb-1.5 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Fecha de Registro</label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-3 text-slate-500" size={15} />
                    <input 
                      type="date"
                      required
                      value={adLogForm.date}
                      onChange={e => setAdLogForm({...adLogForm, date: e.target.value})}
                      className={`w-full border rounded-xl py-2 px-3.5 pl-10 text-[15px] focus:outline-none focus:border-orange-500 font-sans ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#111] border-white/10 text-white'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`text-[15px] font-black uppercase tracking-widest block mb-1.5 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Plataforma</label>
                  <select 
                    value={adLogForm.platform}
                    onChange={e => setAdLogForm({...adLogForm, platform: e.target.value})}
                    className={`w-full border rounded-xl py-2 px-3 text-[15px] focus:outline-none focus:border-orange-500 font-sans cursor-pointer ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#111] border-white/10 text-white'}`}
                  >
                    <option value="TikTok Ads">TikTok Ads</option>
                    <option value="Facebook Ads">Facebook Ads</option>
                    <option value="Instagram Ads">Instagram Ads</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="Pinterest Ads">Pinterest Ads</option>
                    <option value="WhatsApp Orgánico">WhatsApp Orgánico</option>
                  </select>
                </div>

                <div>
                  <label className={`text-[15px] font-black uppercase tracking-widest block mb-1.5 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Tipo de Campaña</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => setAdLogForm({...adLogForm, campaignType: 'whatsapp'})}
                      className={`py-2 px-3 rounded-xl border text-[15px] font-black uppercase tracking-wider transition-all ${
                        adLogForm.campaignType === 'whatsapp' 
                          ? (isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40') 
                          : (isLight ? 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-800' : 'bg-[#111] text-slate-400 border-white/5 hover:text-white')
                      }`}
                    >
                      💬 WhatsApp
                    </button>
                    <button 
                      type="button"
                      onClick={() => setAdLogForm({...adLogForm, campaignType: 'landing'})}
                      className={`py-2 px-3 rounded-xl border text-[15px] font-black uppercase tracking-wider transition-all ${
                        adLogForm.campaignType === 'landing' 
                          ? (isLight ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-blue-500/20 text-blue-400 border-blue-500/40') 
                          : (isLight ? 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-800' : 'bg-[#111] text-slate-400 border-white/5 hover:text-white')
                      }`}
                    >
                      📲 Página
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`text-[15px] font-black uppercase tracking-widest block mb-1.5 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Gasto Total ($)</label>
                    <div className="relative">
                      <Coins className="absolute left-3 top-3 text-slate-500" size={15} />
                      <input 
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={adLogForm.spend}
                        onChange={e => setAdLogForm({...adLogForm, spend: Number(e.target.value)})}
                        className={`w-full border rounded-xl py-2 px-3 pl-8 text-[15px] focus:outline-none focus:border-orange-500 font-sans ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#111] border-white/10 text-white'}`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`text-[15px] font-black uppercase tracking-widest block mb-1.5 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Ventas del Día</label>
                    <input 
                      type="number"
                      min="0"
                      required
                      value={adLogForm.salesCount}
                      onChange={e => setAdLogForm({...adLogForm, salesCount: Number(e.target.value)})}
                      className={`w-full border rounded-xl py-2 px-3 text-[15px] focus:outline-none focus:border-orange-500 font-sans ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#111] border-white/10 text-white'}`}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className={`flex-1 py-3 font-black text-[15px] uppercase tracking-widest transition-all cursor-pointer border ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' : 'bg-white/5 hover:bg-white/10 text-white border-white/5'}`}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-[#ff9100] hover:scale-[1.01] active:scale-[0.99] text-white rounded-xl font-black text-[15px] uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-orange-500/10 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={15} />
                    {editingLogId ? "Guardar" : "Registrar"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
