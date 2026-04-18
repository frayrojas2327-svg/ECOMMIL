import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Plus, 
  Trash2,
  Edit2,
  Save,
  Check,
  Table as TableIcon
} from 'lucide-react';
import { CurrencyCode } from '../mockData';

interface FixedExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
}

interface VariableExpense {
  id: string;
  name: string;
  amount: number;
  startDate: string;
  endDate: string;
}

interface PlatformExpensesProps {
  formatCurrency: (amount: number) => string;
  currencySymbol: string;
  currency: CurrencyCode;
  currencies: any;
}

const EXPENSE_CATEGORIES = ['Software', 'Publicidad', 'Servicios', 'Personal', 'Suscripciones', 'Otros'];

const PlatformExpenses: React.FC<PlatformExpensesProps> = ({ 
  formatCurrency, 
  currencySymbol,
  currency,
  currencies
}) => {
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>(() => {
    const saved = localStorage.getItem('ecommil_fixed_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  const [variableExpenses, setVariableExpenses] = useState<VariableExpense[]>(() => {
    const saved = localStorage.getItem('ecommil_variable_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  const [isSaved, setIsSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // New Expense Form States
  const [newFixed, setNewFixed] = useState<Omit<FixedExpense, 'id'>>({
    name: '',
    category: 'Software',
    amount: 0,
    frequency: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });

  const [newVariable, setNewVariable] = useState<Omit<VariableExpense, 'id'>>({
    name: '',
    amount: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });

  useEffect(() => {
    localStorage.setItem('ecommil_fixed_expenses', JSON.stringify(fixedExpenses));
  }, [fixedExpenses]);

  useEffect(() => {
    localStorage.setItem('ecommil_variable_expenses', JSON.stringify(variableExpenses));
  }, [variableExpenses]);

  const addExpense = () => {
    const info = currencies[currency];
    const amountToSave = newFixed.amount / info.rate;
    
    const newExpense: FixedExpense = {
      ...newFixed,
      amount: amountToSave,
      id: Math.random().toString(36).substr(2, 9)
    };
    setFixedExpenses([...fixedExpenses, newExpense]);
    // Reset form
    setNewFixed({
      name: '',
      category: 'Software',
      amount: 0,
      frequency: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      endDate: ''
    });
  };

  const addVariableExpense = () => {
    const info = currencies[currency];
    const amountToSave = newVariable.amount / info.rate;

    const newExpense: VariableExpense = {
      ...newVariable,
      amount: amountToSave,
      id: Math.random().toString(36).substr(2, 9)
    };
    setVariableExpenses([...variableExpenses, newExpense]);
    // Reset form
    setNewVariable({
      name: '',
      amount: 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: ''
    });
  };

  const removeExpense = (id: string) => {
    setFixedExpenses(fixedExpenses.filter(e => e.id !== id));
  };

  const updateExpense = (id: string, field: keyof FixedExpense, value: any) => {
    setFixedExpenses(fixedExpenses.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const removeVariableExpense = (id: string) => {
    setVariableExpenses(variableExpenses.filter(e => e.id !== id));
  };

  const updateVariableExpense = (id: string, field: keyof VariableExpense, value: any) => {
    setVariableExpenses(variableExpenses.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const totalMonthlyFixed = fixedExpenses.reduce((acc, curr) => {
    return acc + (curr.frequency === 'monthly' ? curr.amount : curr.amount / 12);
  }, 0);

  const totalVariable = variableExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  const handleSave = () => {
    localStorage.setItem('ecommil_fixed_expenses', JSON.stringify(fixedExpenses));
    localStorage.setItem('ecommil_variable_expenses', JSON.stringify(variableExpenses));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    
    // Scroll to table view
    const tableView = document.getElementById('excel-table-view');
    if (tableView) {
      tableView.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
            <CreditCard className="text-neon" size={28} /> Gastos de Plataforma
          </h2>
          <p className="text-slate-400 mt-1">Configura tus costos y visualiza el impacto en la tabla inferior.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 bg-card border border-border p-4 rounded-2xl">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Total Fijo Mensual</p>
              <p className="text-[15px] font-mono font-bold text-neon">{formatCurrency(totalMonthlyFixed)}</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Total Variable (Unidad)</p>
              <p className="text-[15px] font-mono font-bold text-gold">{formatCurrency(totalVariable)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Forms Section (The "Cuadros") */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Fixed Expense Form */}
        <div className="glass-card p-6 space-y-4 border-neon/20 bg-slate-900/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-neon/5 blur-2xl -mr-16 -mt-16 pointer-events-none" />
          <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <Plus size={16} className="text-neon" /> Nuevo Gasto Fijo
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Categoría</label>
              <select 
                value={newFixed.category}
                onChange={(e) => setNewFixed({...newFixed, category: e.target.value})}
                className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-neon"
              >
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Nombre</label>
              <input 
                type="text" 
                value={newFixed.name}
                onChange={(e) => setNewFixed({...newFixed, name: e.target.value})}
                placeholder="Ej: Shopify"
                className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-neon"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Monto ({currencySymbol})</label>
              <input 
                type="number" 
                value={newFixed.amount || ''}
                onChange={(e) => setNewFixed({...newFixed, amount: parseFloat(e.target.value) || 0})}
                className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white font-mono text-[15px] focus:outline-none focus:border-neon"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Ciclo</label>
              <div className="flex p-1 bg-background border border-border rounded-xl">
                <button 
                  onClick={() => setNewFixed({...newFixed, frequency: 'monthly'})}
                  className={`flex-1 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${newFixed.frequency === 'monthly' ? 'bg-neon text-background' : 'text-slate-500'}`}
                >
                  Mes
                </button>
                <button 
                  onClick={() => setNewFixed({...newFixed, frequency: 'yearly'})}
                  className={`flex-1 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${newFixed.frequency === 'yearly' ? 'bg-neon text-background' : 'text-slate-500'}`}
                >
                  Año
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Fecha Inicio</label>
              <input 
                type="date" 
                value={newFixed.startDate}
                onChange={(e) => setNewFixed({...newFixed, startDate: e.target.value})}
                className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-neon [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Fecha Fin (Opcional)</label>
              <input 
                type="date" 
                value={newFixed.endDate}
                onChange={(e) => setNewFixed({...newFixed, endDate: e.target.value})}
                className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-neon [color-scheme:dark]"
              />
            </div>
          </div>

          <button 
            onClick={addExpense}
            disabled={!newFixed.name || !newFixed.amount}
            className="w-full py-2.5 bg-neon/10 text-neon hover:bg-neon hover:text-background disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all text-[10px] font-black uppercase tracking-widest border border-neon/20"
          >
            Agregar a la Lista
          </button>
        </div>

        {/* Variable Expense Form */}
        <div className="glass-card p-6 space-y-4 border-gold/20 bg-slate-900/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 blur-2xl -mr-16 -mt-16 pointer-events-none" />
          <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <Plus size={16} className="text-gold" /> Nuevo Gasto Variable
          </h3>
          
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Concepto / Gasto</label>
            <input 
              type="text" 
              value={newVariable.name}
              onChange={(e) => setNewVariable({...newVariable, name: e.target.value})}
              placeholder="Ej: Empaque"
              className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-gold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Monto por Unidad ({currencySymbol})</label>
            <input 
              type="number" 
              value={newVariable.amount || ''}
              onChange={(e) => setNewVariable({...newVariable, amount: parseFloat(e.target.value) || 0})}
              className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white font-mono text-[15px] focus:outline-none focus:border-gold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Fecha Inicio</label>
              <input 
                type="date" 
                value={newVariable.startDate}
                onChange={(e) => setNewVariable({...newVariable, startDate: e.target.value})}
                className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-gold [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Fecha Fin (Opcional)</label>
              <input 
                type="date" 
                value={newVariable.endDate}
                onChange={(e) => setNewVariable({...newVariable, endDate: e.target.value})}
                className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-gold [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="pt-2">
            <button 
              onClick={addVariableExpense}
              disabled={!newVariable.name || !newVariable.amount}
              className="w-full py-2.5 bg-gold/10 text-gold hover:bg-gold hover:text-background disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all text-[10px] font-black uppercase tracking-widest border border-gold/20"
            >
              Agregar a la Lista
            </button>
          </div>
        </div>
      </div>

      {/* Excel-like Table View (History Interface) */}
      <div id="excel-table-view" className="glass-card overflow-hidden border-border/50 bg-slate-900/20">
        <div className="p-4 border-b border-border bg-card/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon/10 rounded-lg">
              <TableIcon size={18} className="text-neon" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Historial de Gastos</h3>
              <p className="text-[10px] text-slate-500 font-medium">Registro detallado de todos los costos operativos</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon" />
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Fijos: {fixedExpenses.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gold" />
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Variables: {variableExpenses.length}</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-800/30">
                <th className="p-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-black">Tipo</th>
                <th className="p-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-black">Concepto / Plataforma</th>
                <th className="p-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-black">Categoría</th>
                <th className="p-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-black">Monto</th>
                <th className="p-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-black">Ciclo / Frecuencia</th>
                <th className="p-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-black">Fechas (Inicio - Fin)</th>
                <th className="p-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-black">Impacto Mensual</th>
                <th className="p-3 text-center text-[10px] uppercase tracking-widest text-slate-500 font-black">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {/* Fixed Expenses Rows */}
              {fixedExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-neon/5 transition-colors group">
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-md bg-neon/10 text-neon text-[10px] font-bold uppercase">Fijo</span>
                  </td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <input 
                        type="text"
                        value={expense.name}
                        onChange={(e) => updateExpense(expense.id, 'name', e.target.value)}
                        className="w-full bg-background border border-border rounded-lg py-1 px-2 text-sm text-white focus:outline-none focus:border-neon"
                      />
                    ) : (
                      <span className="text-sm text-white font-medium">{expense.name}</span>
                    )}
                  </td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <select 
                        value={expense.category}
                        onChange={(e) => updateExpense(expense.id, 'category', e.target.value)}
                        className="w-full bg-background border border-border rounded-lg py-1 px-2 text-sm text-white focus:outline-none focus:border-neon"
                      >
                        {EXPENSE_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-slate-400">{expense.category}</span>
                    )}
                  </td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-mono text-xs">{currencySymbol}</span>
                        <input 
                          type="number"
                          value={currencies[currency].rate !== 1 ? (expense.amount * currencies[currency].rate).toFixed(2) : expense.amount}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateExpense(expense.id, 'amount', val / currencies[currency].rate);
                          }}
                          className="w-24 bg-background border border-border rounded-lg py-1 px-2 text-sm font-mono text-white focus:outline-none focus:border-neon"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-mono text-white">{formatCurrency(expense.amount)}</span>
                        <button 
                          onClick={() => setEditingId(expense.id)}
                          className="p-1 text-slate-500 hover:text-neon transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <select 
                        value={expense.frequency}
                        onChange={(e) => updateExpense(expense.id, 'frequency', e.target.value as any)}
                        className="w-full bg-background border border-border rounded-lg py-1 px-2 text-sm text-white focus:outline-none focus:border-neon"
                      >
                        <option value="monthly">Mensual</option>
                        <option value="yearly">Anual</option>
                      </select>
                    ) : (
                      <span className="text-sm text-slate-400 uppercase tracking-tighter">
                        {expense.frequency === 'monthly' ? 'Mensual' : 'Anual'}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <div className="flex items-center gap-2">
                        <input 
                          type="date"
                          value={expense.startDate}
                          onChange={(e) => updateExpense(expense.id, 'startDate', e.target.value)}
                          className="bg-background border border-border rounded-lg py-1 px-2 text-[11px] text-white focus:outline-none focus:border-neon [color-scheme:dark]"
                        />
                        <input 
                          type="date"
                          value={expense.endDate}
                          onChange={(e) => updateExpense(expense.id, 'endDate', e.target.value)}
                          className="bg-background border border-border rounded-lg py-1 px-2 text-[11px] text-white focus:outline-none focus:border-neon [color-scheme:dark]"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                        <span>{expense.startDate}</span>
                        {expense.endDate && (
                          <>
                            <span className="text-slate-700">-</span>
                            <span>{expense.endDate}</span>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-[15px] font-mono text-neon font-bold">
                    {formatCurrency(expense.frequency === 'monthly' ? expense.amount : expense.amount / 12)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => setEditingId(editingId === expense.id ? null : expense.id)}
                        className={`p-1.5 transition-colors ${editingId === expense.id ? 'text-green-500 hover:text-green-400' : 'text-slate-600 hover:text-neon'}`}
                        title={editingId === expense.id ? "Guardar" : "Editar"}
                      >
                        {editingId === expense.id ? <Check size={14} /> : <Edit2 size={14} />}
                      </button>
                      <button 
                        onClick={() => removeExpense(expense.id)}
                        className="p-1.5 text-slate-600 hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {/* Variable Expenses Rows */}
              {variableExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gold/5 transition-colors group">
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-md bg-gold/10 text-gold text-[10px] font-bold uppercase">Variable</span>
                  </td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <input 
                        type="text"
                        value={expense.name}
                        onChange={(e) => updateVariableExpense(expense.id, 'name', e.target.value)}
                        className="w-full bg-background border border-border rounded-lg py-1 px-2 text-sm text-white focus:outline-none focus:border-gold"
                      />
                    ) : (
                      <span className="text-sm text-white font-medium">{expense.name}</span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-slate-500 italic">Costo por Unidad</td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-mono text-xs">{currencySymbol}</span>
                        <input 
                          type="number"
                          value={currencies[currency].rate !== 1 ? (expense.amount * currencies[currency].rate).toFixed(2) : expense.amount}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateVariableExpense(expense.id, 'amount', val / currencies[currency].rate);
                          }}
                          className="w-24 bg-background border border-border rounded-lg py-1 px-2 text-sm font-mono text-white focus:outline-none focus:border-gold"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-mono text-white">{formatCurrency(expense.amount)}</span>
                        <button 
                          onClick={() => setEditingId(expense.id)}
                          className="p-1 text-slate-500 hover:text-gold transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-sm text-slate-500 uppercase tracking-tighter">Por Venta</td>
                  <td className="p-3">
                    {editingId === expense.id ? (
                      <div className="flex items-center gap-2">
                        <input 
                          type="date"
                          value={expense.startDate}
                          onChange={(e) => updateVariableExpense(expense.id, 'startDate', e.target.value)}
                          className="bg-background border border-border rounded-lg py-1 px-2 text-[11px] text-white focus:outline-none focus:border-gold [color-scheme:dark]"
                        />
                        <input 
                          type="date"
                          value={expense.endDate}
                          onChange={(e) => updateVariableExpense(expense.id, 'endDate', e.target.value)}
                          className="bg-background border border-border rounded-lg py-1 px-2 text-[11px] text-white focus:outline-none focus:border-gold [color-scheme:dark]"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                        <span>{expense.startDate}</span>
                        {expense.endDate && (
                          <>
                            <span className="text-slate-700">-</span>
                            <span>{expense.endDate}</span>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-[15px] font-mono text-gold font-bold">
                    {formatCurrency(expense.amount)} <span className="text-[10px] text-slate-500 font-normal">(Unitario)</span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => setEditingId(editingId === expense.id ? null : expense.id)}
                        className={`p-1.5 transition-colors ${editingId === expense.id ? 'text-green-500 hover:text-green-400' : 'text-slate-600 hover:text-gold'}`}
                        title={editingId === expense.id ? "Guardar" : "Editar"}
                      >
                        {editingId === expense.id ? <Check size={14} /> : <Edit2 size={14} />}
                      </button>
                      <button 
                        onClick={() => removeVariableExpense(expense.id)}
                        className="p-1.5 text-slate-600 hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {fixedExpenses.length === 0 && variableExpenses.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <TableIcon size={40} className="text-slate-700" />
                      <p className="text-slate-500 uppercase tracking-widest font-bold text-xs">No hay gastos en el historial</p>
                      <p className="text-[10px] text-slate-600">Utiliza los formularios superiores para registrar nuevos gastos</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {(fixedExpenses.length > 0 || variableExpenses.length > 0) && (
              <tfoot>
                <tr className="bg-card/50 border-t border-border font-bold">
                  <td colSpan={6} className="p-3 text-right text-[11px] uppercase tracking-widest text-slate-500">Total Operativo Mensual (Fijos):</td>
                  <td className="p-3 text-[15px] font-mono text-neon">{formatCurrency(totalMonthlyFixed)}</td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default PlatformExpenses;
