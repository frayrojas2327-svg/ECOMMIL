import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  Link as LinkIcon, 
  Video, 
  FileText, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './Auth';

interface MarketResearchEntry {
  id: string;
  uid: string;
  productName: string;
  storeUrls: string[];
  notes: string;
  videoUrls: string[];
  timestamp: number;
}

export default function MarketResearch() {
  const { user } = useAuth();
  const [researchList, setResearchList] = useState<MarketResearchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    productName: '',
    storeUrls: [''],
    notes: '',
    videoUrls: ['']
  });

  // Fetch research from Firestore
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'market_research'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as MarketResearchEntry[];
      
      setResearchList(data.sort((a, b) => b.timestamp - a.timestamp));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'market_research');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddUrl = (type: 'store' | 'video') => {
    if (type === 'store') {
      if (formData.storeUrls.length < 20) {
        setFormData({ ...formData, storeUrls: [...formData.storeUrls, ''] });
      }
    } else {
      setFormData({ ...formData, videoUrls: [...formData.videoUrls, ''] });
    }
  };

  const handleUrlChange = (index: number, value: string, type: 'store' | 'video') => {
    if (type === 'store') {
      const newUrls = [...formData.storeUrls];
      newUrls[index] = value;
      setFormData({ ...formData, storeUrls: newUrls });
    } else {
      const newUrls = [...formData.videoUrls];
      newUrls[index] = value;
      setFormData({ ...formData, videoUrls: newUrls });
    }
  };

  const handleRemoveUrl = (index: number, type: 'store' | 'video') => {
    if (type === 'store') {
      const newUrls = formData.storeUrls.filter((_, i) => i !== index);
      setFormData({ ...formData, storeUrls: newUrls.length ? newUrls : [''] });
    } else {
      const newUrls = formData.videoUrls.filter((_, i) => i !== index);
      setFormData({ ...formData, videoUrls: newUrls.length ? newUrls : [''] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const newEntry = {
        uid: user.uid,
        productName: formData.productName,
        storeUrls: formData.storeUrls.filter(url => url.trim() !== ''),
        notes: formData.notes,
        videoUrls: formData.videoUrls.filter(url => url.trim() !== ''),
        timestamp: Date.now()
      };

      await addDoc(collection(db, 'market_research'), newEntry);
      
      setShowAddForm(false);
      setFormData({
        productName: '',
        storeUrls: [''],
        notes: '',
        videoUrls: ['']
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'market_research');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'market_research', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'market_research');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-neon/20 border-t-neon rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
            <Search className="text-neon" /> Investigación de Mercado
          </h2>
          <p className="text-slate-500 text-sm">Analiza la competencia y recopila referencias para tus productos</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="bg-neon text-background font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-neon/20"
        >
          <Plus size={18} /> Nueva Investigación
        </button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-6 border-neon/30 bg-card/60 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-neon" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <Plus className="text-neon" size={20} /> Registrar Investigación
              </h3>
              <button 
                onClick={() => setShowAddForm(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Nombre del Producto</label>
                <div className="relative">
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input 
                    type="text"
                    required
                    placeholder="Ej: Smartwatch Pro X"
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    className="w-full bg-background/50 border border-border/50 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:border-neon/50 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">URLs de Tiendas (Competencia - Máx 20)</label>
                  <button 
                    type="button"
                    onClick={() => handleAddUrl('store')}
                    disabled={formData.storeUrls.length >= 20}
                    className="text-xs text-neon hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <Plus size={12} /> Agregar URL
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {formData.storeUrls.map((url, idx) => (
                    <div key={idx} className="relative flex items-center gap-2">
                      <LinkIcon className="absolute left-3 text-slate-500" size={12} />
                      <input 
                        type="url"
                        placeholder="https://tienda.com/producto"
                        value={url}
                        onChange={(e) => handleUrlChange(idx, e.target.value, 'store')}
                        className="w-full bg-background/50 border border-border/50 rounded-lg py-2 pl-9 pr-10 text-xs text-white focus:border-neon/50 outline-none transition-all"
                      />
                      {formData.storeUrls.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => handleRemoveUrl(idx, 'store')}
                          className="absolute right-3 text-slate-500 hover:text-red-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">URLs de Videos (Referencias)</label>
                  <button 
                    type="button"
                    onClick={() => handleAddUrl('video')}
                    className="text-xs text-neon hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} /> Agregar URL
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {formData.videoUrls.map((url, idx) => (
                    <div key={idx} className="relative flex items-center gap-2">
                      <Video className="absolute left-3 text-slate-500" size={12} />
                      <input 
                        type="url"
                        placeholder="https://youtube.com/watch?v=..."
                        value={url}
                        onChange={(e) => handleUrlChange(idx, e.target.value, 'video')}
                        className="w-full bg-background/50 border border-border/50 rounded-lg py-2 pl-9 pr-10 text-xs text-white focus:border-neon/50 outline-none transition-all"
                      />
                      {formData.videoUrls.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => handleRemoveUrl(idx, 'video')}
                          className="absolute right-3 text-slate-500 hover:text-red-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Notas y Observaciones</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 text-slate-500" size={14} />
                  <textarea 
                    placeholder="Escribe aquí tus notas sobre el producto, puntos fuertes, debilidades de la competencia, etc."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="w-full bg-background/50 border border-border/50 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:border-neon/50 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-neon text-background font-bold py-3 rounded-xl hover:brightness-110 transition-all shadow-lg shadow-neon/20"
              >
                Guardar Investigación
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {researchList.length === 0 ? (
          <div className="glass-card p-12 text-center border-dashed border-border">
            <Search size={48} className="mx-auto text-slate-700 mb-4" />
            <p className="text-slate-500 italic">No has registrado ninguna investigación aún.</p>
          </div>
        ) : (
          researchList.map((item) => (
            <div key={item.id} className="glass-card border-border/50 bg-card/30 overflow-hidden">
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-neon/10 rounded-lg">
                    <Package size={20} className="text-neon" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{item.productName}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <LinkIcon size={10} /> {item.storeUrls.length} Tiendas
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Video size={10} /> {item.videoUrls.length} Videos
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                    className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                  {expandedId === item.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                </div>
              </div>

              <AnimatePresence>
                {expandedId === item.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border/30 bg-black/20"
                  >
                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h4 className="text-xs font-display uppercase tracking-widest text-neon font-bold flex items-center gap-2">
                            <LinkIcon size={14} /> Tiendas Encontradas
                          </h4>
                          <div className="space-y-2">
                            {item.storeUrls.map((url, idx) => (
                              <a 
                                key={idx} 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-border/30 hover:border-neon/50 transition-all group"
                              >
                                <span className="text-xs text-slate-300 truncate max-w-[250px]">{url}</span>
                                <ExternalLink size={12} className="text-slate-500 group-hover:text-neon" />
                              </a>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-xs font-display uppercase tracking-widest text-blue-400 font-bold flex items-center gap-2">
                            <Video size={14} /> Videos de Referencia
                          </h4>
                          <div className="space-y-2">
                            {item.videoUrls.map((url, idx) => (
                              <a 
                                key={idx} 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-border/30 hover:border-blue-400/50 transition-all group"
                              >
                                <span className="text-xs text-slate-300 truncate max-w-[250px]">{url}</span>
                                <ExternalLink size={12} className="text-slate-500 group-hover:text-blue-400" />
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>

                      {item.notes && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-display uppercase tracking-widest text-gold font-bold flex items-center gap-2">
                            <FileText size={14} /> Notas y Análisis
                          </h4>
                          <div className="p-4 rounded-xl bg-white/5 border border-border/30 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {item.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
