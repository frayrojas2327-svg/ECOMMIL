import React, { useState } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  ShieldAlert, 
  Database, 
  HardDrive, 
  Bot,
  CheckCircle2,
  Loader2,
  Globe,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CURRENCIES } from '../mockData';

interface SettingsProps {
  onResetData: () => Promise<void>;
  onClearAllData: () => Promise<void>;
  onClearAIConfig: () => void;
  currency: string;
  setCurrency: (currency: any) => void;
  isConversionActive: boolean;
  setIsConversionActive: (active: boolean) => void;
  currencies: any;
}

const Settings: React.FC<SettingsProps> = ({ 
  onResetData, 
  onClearAllData, 
  onClearAIConfig,
  currency,
  setCurrency,
  isConversionActive,
  setIsConversionActive,
  currencies
}) => {
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAction = async (action: () => Promise<void>, message: string) => {
    setIsLoading(true);
    try {
      await action();
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error performing action:", error);
    } finally {
      setIsLoading(false);
      setIsConfirmingReset(false);
      setIsConfirmingClear(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h2 className="text-3xl font-display font-bold text-white tracking-tight flex items-center gap-3">
          <Database className="text-neon" /> Gestión de Datos
        </h2>
        <p className="text-slate-400 mt-2">Controla el almacenamiento de tu cuenta y la configuración del sistema.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reset Data Card */}
        <div className="glass-card p-6 border-gold/20 bg-gold/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gold/10 rounded-lg text-gold">
                <RotateCcw size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Reiniciar Datos</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Esta acción eliminará todos tus pedidos actuales y los reemplazará con datos de ejemplo (Mock Data). 
              Ideal para pruebas o para ver cómo funciona el sistema.
            </p>
          </div>
          
          <button
            onClick={() => setIsConfirmingReset(true)}
            className="w-full py-3 bg-gold/10 border border-gold/30 text-gold rounded-xl font-bold hover:bg-gold/20 transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw size={18} />
            Reiniciar a Valores Iniciales
          </button>
        </div>

        {/* Clear All Data Card */}
        <div className="glass-card p-6 border-red-500/20 bg-red-500/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
                <Trash2 size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Borrar Todo</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Elimina permanentemente todos los pedidos de la base de datos y limpia los productos guardados en la calculadora. 
              <span className="text-red-500 font-bold"> Esta acción no se puede deshacer.</span>
            </p>
          </div>
          
          <button
            onClick={() => setIsConfirmingClear(true)}
            className="w-full py-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl font-bold hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Trash2 size={18} />
            Borrar Todos los Datos
          </button>
        </div>
      </div>

      <div className="glass-card p-6 border-border bg-card/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-neon/10 rounded-2xl text-neon">
              <Globe size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Configuración de Moneda</h3>
              <p className="text-sm text-slate-500">Personaliza cómo se visualizan los valores monetarios en toda la plataforma.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Moneda Predeterminada</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.keys(currencies).map((code) => (
                <button
                  key={code}
                  onClick={() => setCurrency(code)}
                  className={`py-2 px-3 rounded-xl border text-sm font-mono transition-all flex flex-col items-center gap-1 ${
                    currency === code 
                      ? 'bg-neon/10 border-neon text-neon font-bold shadow-lg shadow-neon/10' 
                      : 'bg-white/5 border-border text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <span className="text-xs opacity-60">{currencies[code].symbol}</span>
                  {code}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 italic">
              * La moneda seleccionada se guardará automáticamente y persistirá en tus próximas sesiones.
            </p>
          </div>

          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-white/5 border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isConversionActive ? 'bg-neon/20 text-neon' : 'bg-slate-800 text-slate-500'}`}>
                    <RefreshCw size={18} className={isConversionActive ? 'animate-spin-slow' : ''} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Conversión en Tiempo Real</h4>
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] text-slate-500">Activa el cálculo automático basado en tasas de cambio.</p>
                      {isConversionActive && currency !== 'USD' && (
                        <span className="text-[10px] font-mono text-neon bg-neon/10 px-1.5 py-0.5 rounded border border-neon/20">
                          1 USD = {currencies[currency].rate.toFixed(2)} {currency}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsConversionActive(!isConversionActive)}
                  className={`w-12 h-6 rounded-full relative transition-all ${isConversionActive ? 'bg-neon' : 'bg-slate-700'}`}
                >
                  <motion.div
                    animate={{ x: isConversionActive ? 24 : 0 }}
                    className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <div className="text-[12px] text-slate-400 leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5">
                {isConversionActive ? (
                  <p>
                    <span className="text-neon font-bold">MODO ACTIVO:</span> Los valores se multiplican por la tasa de cambio de la moneda seleccionada (Base: USD). 
                    Ejemplo: 100 USD → {currencies[currency].symbol} {(100 * currencies[currency].rate).toLocaleString()}
                  </p>
                ) : (
                  <p>
                    <span className="text-slate-300 font-bold">MODO MANUAL:</span> Los valores se muestran tal cual están en la base de datos, cambiando únicamente el símbolo.
                    Ejemplo: 100 → {currencies[currency].symbol} 100
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 border-border bg-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-neon/10 rounded-2xl text-neon">
              <Bot size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Configuración de IA</h3>
              <p className="text-sm text-slate-500">Limpia las llaves API y las instrucciones personalizadas guardadas localmente.</p>
            </div>
          </div>
          <button
            onClick={onClearAIConfig}
            className="px-6 py-2 bg-white/5 border border-border text-slate-400 rounded-xl hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
          >
            Limpiar Configuración IA
          </button>
        </div>
      </div>

      {/* Success Message Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 bg-neon text-background px-6 py-3 rounded-2xl font-bold shadow-2xl flex items-center gap-3 z-50"
          >
            <CheckCircle2 size={20} />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modals */}
      <AnimatePresence>
        {(isConfirmingReset || isConfirmingClear) && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md w-full bg-card border border-border rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center gap-4 text-red-500 mb-6">
                <div className="p-3 bg-red-500/10 rounded-2xl">
                  <ShieldAlert size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">¿Estás absolutamente seguro?</h3>
                  <p className="text-sm text-slate-500">Esta acción es irreversible.</p>
                </div>
              </div>

              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                {isConfirmingReset 
                  ? "Se borrarán todos tus pedidos actuales y se cargarán los datos de demostración. Perderás cualquier información real que hayas ingresado."
                  : "Se eliminarán permanentemente todos los registros de pedidos y productos guardados. Tu cuenta quedará totalmente vacía."}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsConfirmingReset(false);
                    setIsConfirmingClear(false);
                  }}
                  className="flex-1 py-3 bg-white/5 border border-border text-white rounded-xl font-bold hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  disabled={isLoading}
                  onClick={() => {
                    if (isConfirmingReset) handleAction(onResetData, "Datos reiniciados correctamente");
                    else handleAction(onClearAllData, "Todos los datos han sido borrados");
                  }}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Sí, confirmar"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Settings;
