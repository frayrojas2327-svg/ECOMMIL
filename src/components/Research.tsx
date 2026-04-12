import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  Star, 
  ExternalLink, 
  Trash2, 
  Edit2, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Tag,
  Store,
  Link as LinkIcon,
  DollarSign,
  MessageSquare,
  ChevronDown,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './Auth';

export interface ResearchItem {
  id: string;
  uid: string;
  product_name: string;
  store_name: string;
  product_link: string;
  price: number;
  currency: string;
  angles: string;
  notes: string;
  rating: number;
  opportunity_score: number;
  date_added: any;
}

export default function Research() {
  const { user } = useAuth();
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'rating' | 'price'>('date');
  const [filterPrice, setFilterPrice] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<ResearchItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    product_name: '',
    store_name: '',
    product_link: '',
    price: '',
    currency: 'USD',
    angles: '',
    notes: '',
    rating: 3
  });

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'research'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as ResearchItem[];
      setItems(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'research');
    });

    return () => unsubscribe();
  }, [user]);

  const averagePrice = useMemo(() => {
    if (items.length === 0) return 0;
    return items.reduce((acc, item) => acc + item.price, 0) / items.length;
  }, [items]);

  const calculateOpportunity = (price: number) => {
    if (items.length < 2) return 50; // Default if not enough data
    if (price < averagePrice * 0.8) return 90; // High opportunity
    if (price < averagePrice * 1.1) return 60; // Medium
    return 30; // Low
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const priceNum = parseFloat(formData.price);
    const newItem = {
      uid: user.uid,
      product_name: formData.product_name,
      store_name: formData.store_name,
      product_link: formData.product_link,
      price: priceNum,
      currency: formData.currency,
      angles: formData.angles,
      notes: formData.notes,
      rating: formData.rating,
      opportunity_score: calculateOpportunity(priceNum),
      date_added: Timestamp.now()
    };

    try {
      if (editingItem) {
        await setDoc(doc(db, 'research', editingItem.id), newItem);
      } else {
        await addDoc(collection(db, 'research'), newItem);
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({
        product_name: '',
        store_name: '',
        product_link: '',
        price: '',
        currency: 'USD',
        angles: '',
        notes: '',
        rating: 3
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'research');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este análisis?')) return;
    try {
      await deleteDoc(doc(db, 'research', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'research');
    }
  };

  const filteredItems = useMemo(() => {
    return items
      .filter(item => 
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.store_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .filter(item => filterPrice ? item.price <= filterPrice : true)
      .sort((a, b) => {
        if (sortBy === 'rating') return b.rating - a.rating;
        if (sortBy === 'price') return a.price - b.price;
        return b.date_added?.toMillis() - a.date_added?.toMillis();
      });
  }, [items, searchTerm, sortBy, filterPrice]);

  const getOpportunityBadge = (score: number) => {
    if (score >= 80) return { label: 'Alta Oportunidad', color: 'bg-primary/20 text-primary border-primary/30', icon: TrendingUp };
    if (score >= 50) return { label: 'Oportunidad Media', color: 'bg-secondary/20 text-secondary border-secondary/30', icon: Minus };
    return { label: 'Oportunidad Baja', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: TrendingDown };
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Market Research</h2>
          <p className="text-slate-400 text-[15px]">Analiza productos y detecta oportunidades ganadoras.</p>
        </div>
        <button 
          onClick={() => {
            setEditingItem(null);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-background font-bold py-3 px-6 rounded-2xl transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={20} />
          <span>Nuevo Producto</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text"
            placeholder="Buscar producto o tienda..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-card border border-border rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl p-1">
          {(['date', 'rating', 'price'] as const).map((sort) => (
            <button
              key={sort}
              onClick={() => setSortBy(sort)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                sortBy === sort ? 'bg-primary text-background' : 'text-slate-400 hover:text-white'
              }`}
            >
              {sort === 'date' ? 'Recientes' : sort === 'rating' ? 'Rating' : 'Precio'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredItems.map((item) => {
            const opp = getOpportunityBadge(item.opportunity_score);
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fintech-card p-5 space-y-4 group"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{item.product_name}</h3>
                    <div className="flex items-center gap-2 text-slate-400 text-[13px]">
                      <Store size={14} />
                      <span>{item.store_name}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        setEditingItem(item);
                        setFormData({
                          product_name: item.product_name,
                          store_name: item.store_name,
                          product_link: item.product_link,
                          price: item.price.toString(),
                          currency: item.currency,
                          angles: item.angles,
                          notes: item.notes,
                          rating: item.rating
                        });
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-secondary hover:bg-secondary/10 rounded-lg transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xl font-mono font-bold text-white">
                    {item.currency} {item.price.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        size={14} 
                        className={i < item.rating ? 'fill-gold text-gold' : 'text-slate-600'} 
                      />
                    ))}
                  </div>
                </div>

                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${opp.color}`}>
                  <opp.icon size={16} />
                  <span className="text-[13px] font-bold uppercase tracking-wider">{opp.label}</span>
                </div>

                <div className="space-y-3 pt-2 border-t border-border/50">
                  <div className="flex flex-wrap gap-2">
                    {item.angles.split(',').map((tag, i) => (
                      <span key={i} className="flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-1 rounded-lg text-[11px] font-medium">
                        <Tag size={10} />
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                  <p className="text-[13px] text-slate-400 line-clamp-2 italic">
                    "{item.notes}"
                  </p>
                </div>

                <a 
                  href={item.product_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[13px] font-bold transition-all"
                >
                  <ExternalLink size={14} />
                  Ver Tienda
                </a>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-20 h-20 bg-card border border-border rounded-full flex items-center justify-center text-slate-600">
            <Search size={40} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">No hay resultados</h3>
            <p className="text-slate-400">Comienza agregando productos para analizar el mercado.</p>
          </div>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h3 className="text-xl font-display font-bold text-white">
                  {editingItem ? 'Editar Análisis' : 'Nuevo Análisis de Producto'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[13px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Tag size={14} /> Producto
                    </label>
                    <input 
                      required
                      type="text"
                      value={formData.product_name}
                      onChange={(e) => setFormData({...formData, product_name: e.target.value})}
                      placeholder="Ej: Camiseta Oversize"
                      className="w-full bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Store size={14} /> Tienda
                    </label>
                    <input 
                      required
                      type="text"
                      value={formData.store_name}
                      onChange={(e) => setFormData({...formData, store_name: e.target.value})}
                      placeholder="Ej: Zara, Shopify Store"
                      className="w-full bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <LinkIcon size={14} /> Link del Producto
                  </label>
                  <input 
                    required
                    type="url"
                    value={formData.product_link}
                    onChange={(e) => setFormData({...formData, product_link: e.target.value})}
                    placeholder="https://tienda.com/producto"
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[13px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <DollarSign size={14} /> Precio
                    </label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      placeholder="0.00"
                      className="w-full bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">Rating Inicial</label>
                    <div className="flex items-center gap-2 h-[50px]">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setFormData({...formData, rating: num})}
                          className={`p-2 rounded-lg transition-all ${formData.rating >= num ? 'text-gold' : 'text-slate-600'}`}
                        >
                          <Star size={20} fill={formData.rating >= num ? 'currentColor' : 'none'} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp size={14} /> Ángulos de Venta (tags)
                  </label>
                  <input 
                    type="text"
                    value={formData.angles}
                    onChange={(e) => setFormData({...formData, angles: e.target.value})}
                    placeholder="Ej: Calidad Premium, Envío Gratis, Exclusivo"
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={14} /> Notas de Analista
                  </label>
                  <textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Observaciones sobre el mercado, competencia, etc."
                    rows={3}
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-background font-bold py-4 rounded-2xl transition-all shadow-lg shadow-primary/20 mt-4"
                >
                  {editingItem ? 'Guardar Cambios' : 'Crear Análisis'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
