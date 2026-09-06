import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  StickyNote, 
  Plus, 
  Search, 
  ExternalLink, 
  Copy, 
  Check, 
  Trash2, 
  Edit3, 
  Link as LinkIcon, 
  X, 
  Save, 
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { db, isFirebaseConfigValid } from '../firebase';
import { useAuth } from './Auth';

export interface SimpleNote {
  id: string;
  uid?: string;
  title: string;
  note: string;
  urls: string[];
  url?: string; // backwards compatibility
  createdAt: number;
  updatedAt: number;
}

const INITIAL_NOTES: SimpleNote[] = [
  {
    id: 'note-1',
    title: 'Ad Library de la Competencia (Ganador)',
    note: 'Anuncios activos del corrector de postura. Oferta 2x1 con flete gratis y pago contra entrega.',
    urls: [
      'https://www.facebook.com/ads/library',
      'https://ads.tiktok.com/business/creativecenter'
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24
  },
  {
    id: 'note-2',
    title: 'Carpeta de Creativos y Videos UGC',
    note: 'Videos editados en formato 9:16 con ganchos de 3 segundos listos para pautar en TikTok y Meta.',
    urls: [
      'https://drive.google.com'
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 12,
    updatedAt: Date.now() - 1000 * 60 * 60 * 12
  },
  {
    id: 'note-3',
    title: 'Contacto de Proveedor (Stock Lima)',
    note: 'Coordinación directa de reposición de 100 unidades y garantía por cambio inmediato.',
    urls: [
      'https://wa.me/51999999999',
      'https://dropi.co'
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
    updatedAt: Date.now() - 1000 * 60 * 60 * 2
  }
];

const formatUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

interface NotesSectionProps {
  theme?: string;
}

export const NotesSection: React.FC<NotesSectionProps> = ({ theme }) => {
  const { user, isDemoMode } = useAuth();

  // Notes state
  const [notes, setNotes] = useState<SimpleNote[]>(() => {
    const saved = localStorage.getItem('ecommil_simple_notes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            ...item,
            urls: Array.isArray(item.urls) 
              ? item.urls 
              : (item.url ? [item.url] : [])
          }));
        }
      } catch (e) {
        console.error('Error loading notes:', e);
      }
    }
    return INITIAL_NOTES;
  });

  // Form Fields: Título, Nota, URLs dinámicas
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [urls, setUrls] = useState<string[]>(['']);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Search filter
  const [search, setSearch] = useState('');

  // Feedbacks
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saveAlert, setSaveAlert] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  // LocalStorage persistence
  useEffect(() => {
    localStorage.setItem('ecommil_simple_notes', JSON.stringify(notes));
  }, [notes]);

  // Firestore sync
  useEffect(() => {
    if (!user || isDemoMode || !isFirebaseConfigValid || !db) return;

    const q = query(collection(db, 'simple_notes'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const firestoreNotes: SimpleNote[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            ...data,
            id: docSnap.id,
            urls: Array.isArray(data.urls) ? data.urls : (data.url ? [data.url] : [])
          } as SimpleNote;
        });
        setNotes(firestoreNotes);
      }
    }, (err) => {
      console.warn('Firestore notes sync notice:', err);
    });

    return () => unsubscribe();
  }, [user, isDemoMode]);

  // Dynamic URLs handlers
  const handleUrlChange = (index: number, value: string) => {
    setUrls(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleAddUrlField = () => {
    setUrls(prev => [...prev, '']);
  };

  const handleRemoveUrlField = (index: number) => {
    setUrls(prev => {
      if (prev.length <= 1) return [''];
      return prev.filter((_, i) => i !== index);
    });
  };

  // Handle Save (Create or Update)
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanTitle = title.trim();
    const cleanNote = note.trim();
    const cleanUrls = urls
      .map(u => formatUrl(u))
      .filter(Boolean);

    if (!cleanTitle && !cleanNote && cleanUrls.length === 0) return;

    const now = Date.now();

    if (editingId) {
      // Update
      const updatedNotes = notes.map(n => {
        if (n.id === editingId) {
          return {
            ...n,
            title: cleanTitle || 'Nota sin título',
            note: cleanNote,
            urls: cleanUrls,
            url: cleanUrls[0] || '',
            updatedAt: now
          };
        }
        return n;
      });

      setNotes(updatedNotes);

      if (user && isFirebaseConfigValid && db) {
        try {
          await setDoc(doc(db, 'simple_notes', editingId), {
            title: cleanTitle || 'Nota sin título',
            note: cleanNote,
            urls: cleanUrls,
            url: cleanUrls[0] || '',
            updatedAt: now,
            uid: user.uid
          }, { merge: true });
        } catch (err) {
          console.warn('Firestore update error:', err);
        }
      }

      setSaveAlert('¡Nota actualizada con éxito!');
      setEditingId(null);
    } else {
      // New note
      const newId = 'note_' + Math.random().toString(36).substr(2, 9);
      const newNote: SimpleNote = {
        id: newId,
        uid: user?.uid,
        title: cleanTitle || 'Nota sin título',
        note: cleanNote,
        urls: cleanUrls,
        url: cleanUrls[0] || '',
        createdAt: now,
        updatedAt: now
      };

      setNotes([newNote, ...notes]);

      if (user && isFirebaseConfigValid && db) {
        try {
          await setDoc(doc(db, 'simple_notes', newId), newNote);
        } catch (err) {
          console.warn('Firestore create error:', err);
        }
      }

      setSaveAlert('¡Nota guardada!');
    }

    // Reset fields
    setTitle('');
    setNote('');
    setUrls(['']);
    setTimeout(() => setSaveAlert(null), 2500);
  };

  // Start editing a note
  const handleEdit = (n: SimpleNote) => {
    setEditingId(n.id);
    setTitle(n.title);
    setNote(n.note);
    const existingUrls = Array.isArray(n.urls) && n.urls.length > 0 
      ? n.urls 
      : (n.url ? [n.url] : ['']);
    setUrls(existingUrls.length > 0 ? existingUrls : ['']);

    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setNote('');
    setUrls(['']);
  };

  // Delete note
  const handleDelete = async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    setDeleteConfirmId(null);
    if (editingId === id) {
      handleCancelEdit();
    }

    if (user && isFirebaseConfigValid && db) {
      try {
        await deleteDoc(doc(db, 'simple_notes', id));
      } catch (err) {
        console.warn('Firestore delete error:', err);
      }
    }
  };

  // Copy URL or Note to clipboard
  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter notes
  const filteredNotes = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter(n => {
      const titleMatch = n.title.toLowerCase().includes(q);
      const noteMatch = n.note.toLowerCase().includes(q);
      const urlsMatch = (n.urls || []).some(u => u.toLowerCase().includes(q)) || (n.url || '').toLowerCase().includes(q);
      return titleMatch || noteMatch || urlsMatch;
    });
  }, [notes, search]);

  const hasFormContent = title.trim() || note.trim() || urls.some(u => u.trim());
  const isLight = theme === 'theme-light-white';

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      
      {/* HEADER */}
      <div className={`p-5 md:p-6 rounded-2xl border transition-all ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#111] border-white/5'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neon/15 border border-neon/30 flex items-center justify-center text-neon shadow-[0_0_15px_rgba(34,197,94,0.15)] shrink-0">
              <StickyNote size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Notas</h2>
              <p className="text-xs text-slate-400">Guarda título, notas y múltiples URLs de forma simple y rápida.</p>
            </div>
          </div>

          <div className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 flex items-center gap-2 self-start sm:self-auto">
            <span>Total:</span>
            <span className="text-neon">{notes.length} {notes.length === 1 ? 'nota' : 'notas'}</span>
          </div>
        </div>
      </div>

      {/* ALERT FEEDBACK */}
      <AnimatePresence>
        {saveAlert && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold font-mono flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Check size={16} />
              <span>{saveAlert}</span>
            </div>
            <button onClick={() => setSaveAlert(null)} className="text-emerald-400/70 hover:text-emerald-300">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FORM: TÍTULO, NOTA, MULTI-URLS */}
      <div 
        ref={formRef} 
        className={`p-5 md:p-6 rounded-2xl border transition-all ${
          editingId 
            ? 'bg-amber-500/5 border-amber-500/30 ring-1 ring-amber-500/20' 
            : isLight ? 'bg-white border-slate-200' : 'bg-[#121212] border-white/5'
        }`}
      >
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            {editingId ? (
              <>
                <Edit3 size={16} className="text-amber-400" />
                <h3 className="text-sm font-bold text-amber-400">Editando Nota</h3>
              </>
            ) : (
              <>
                <Plus size={16} className="text-neon" />
                <h3 className="text-sm font-bold text-white">Nueva Nota</h3>
              </>
            )}
          </div>
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
            >
              <X size={14} /> Cancelar edición
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* TÍTULO */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Ad Library Competidor, Proveedor de Lima, Enlace TikTok..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#181818] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-neon transition-all"
            />
          </div>

          {/* NOTA */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Nota
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Escribe aquí los detalles, ángulos, acuerdos, precios o notas..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#181818] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-neon transition-all resize-y"
            />
          </div>

          {/* SECCIÓN MULTI-URLS */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <LinkIcon size={12} className="text-neon" />
                URLs / Enlaces
                {urls.length > 1 && (
                  <span className="text-[10px] font-mono text-slate-400">({urls.length})</span>
                )}
              </label>
              <button
                type="button"
                onClick={handleAddUrlField}
                className="text-xs font-bold text-neon hover:text-neon/80 flex items-center gap-1 transition-colors cursor-pointer py-1 px-2.5 rounded-lg bg-neon/10 hover:bg-neon/15 border border-neon/20 active:scale-95"
              >
                <Plus size={13} />
                <span>Agregar otra URL</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {urls.map((urlItem, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={urlItem}
                      onChange={(e) => handleUrlChange(index, e.target.value)}
                      placeholder={
                        index === 0 
                          ? "https://facebook.com/ads/library, https://drive.google.com..." 
                          : `URL ${index + 1} (ej. https://...)`
                      }
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#181818] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-neon transition-all font-mono text-xs"
                    />
                    {urlItem.trim() && (
                      <a
                        href={formatUrl(urlItem)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir enlace"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-neon transition-colors"
                      >
                        <ExternalLink size={15} />
                      </a>
                    )}
                  </div>

                  {urls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveUrlField(index)}
                      title="Eliminar esta URL"
                      className="p-2.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors shrink-0 cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {urls.length === 1 && (
              <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                <span>¿Necesitas guardar más enlaces? Haz clic en</span>
                <button
                  type="button"
                  onClick={handleAddUrlField}
                  className="text-neon hover:underline font-semibold cursor-pointer"
                >
                  + Agregar otra URL
                </button>
              </p>
            )}
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            {hasFormContent && !editingId && (
              <button
                type="button"
                onClick={() => { setTitle(''); setNote(''); setUrls(['']); }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Limpiar
              </button>
            )}

            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            )}

            <button
              type="submit"
              disabled={!hasFormContent}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                editingId
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
                  : 'bg-neon hover:bg-neon/90 text-black shadow-neon/20'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {editingId ? <Check size={14} /> : <Save size={14} />}
              <span>{editingId ? 'Actualizar Nota' : 'Guardar Nota'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* SEARCH BAR */}
      {notes.length > 0 && (
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, nota o enlaces..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#121212] border border-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-neon transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* LISTA DE NOTAS */}
      <div className="space-y-3">
        {filteredNotes.length === 0 ? (
          <div className="p-10 text-center rounded-2xl border border-white/5 bg-[#121212]">
            <StickyNote size={28} className="mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-bold text-white">
              {search ? 'No se encontraron notas con esa búsqueda' : 'No tienes notas guardadas'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? 'Prueba con otros términos' : 'Escribe arriba el título, nota y URLs para agregar la primera.'}
            </p>
          </div>
        ) : (
          filteredNotes.map((item) => {
            const isEditingThis = editingId === item.id;
            const allUrls: string[] = Array.isArray(item.urls) && item.urls.length > 0 
              ? item.urls 
              : (item.url ? [item.url] : []);

            return (
              <div
                key={item.id}
                className={`p-4 md:p-5 rounded-2xl border transition-all ${
                  isEditingThis 
                    ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20' 
                    : isLight ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-[#131313] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  
                  {/* CONTENIDO PRINCIPAL */}
                  <div className="space-y-2.5 flex-1 min-w-0">
                    
                    {/* TÍTULO */}
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-white tracking-tight break-words">
                        {item.title}
                      </h4>
                    </div>

                    {/* NOTA */}
                    {item.note && (
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line break-words">
                        {item.note}
                      </p>
                    )}

                    {/* MULTI-URLS */}
                    {allUrls.length > 0 && (
                      <div className="pt-1.5 space-y-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                          <LinkIcon size={12} className="text-neon" />
                          {allUrls.length > 1 ? `URLs (${allUrls.length}):` : 'URL:'}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {allUrls.map((urlStr, uIdx) => (
                            <div 
                              key={uIdx} 
                              className="inline-flex items-center gap-1.5 bg-neon/10 border border-neon/20 px-2.5 py-1.5 rounded-xl hover:bg-neon/15 transition-colors max-w-full"
                            >
                              <a
                                href={formatUrl(urlStr)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-mono text-neon hover:underline truncate max-w-[240px] sm:max-w-xs md:max-w-md inline-flex items-center gap-1"
                                title={`Abrir: ${urlStr}`}
                              >
                                <span className="truncate">{urlStr}</span>
                                <ExternalLink size={11} className="shrink-0 text-neon" />
                              </a>

                              <button
                                type="button"
                                onClick={() => handleCopy(urlStr, `url-${item.id}-${uIdx}`)}
                                title="Copiar enlace"
                                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                              >
                                {copiedId === `url-${item.id}-${uIdx}` ? (
                                  <Check size={12} className="text-neon" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* FECHA */}
                    <div className="pt-1 flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                      <Clock size={10} />
                      <span>{new Date(item.updatedAt || item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* BOTONES ACCIÓN */}
                  <div className="flex items-center gap-1.5 self-end md:self-start shrink-0 pt-2 md:pt-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        isEditingThis
                          ? 'bg-amber-500 text-black'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
                      }`}
                      title="Editar esta nota"
                    >
                      <Edit3 size={12} />
                      <span>Editar</span>
                    </button>

                    {deleteConfirmId === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Eliminar nota"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default NotesSection;
