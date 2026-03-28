import React, { useState, createContext, useContext, useEffect, ReactNode } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, Mail, Lock, User as UserIcon, Loader2, AlertCircle, LogOut, Chrome, Globe, Eye, EyeOff } from 'lucide-react';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setIsAdmin(userDoc.data().role === 'admin');
          } else {
            // If user exists in Auth but not in Firestore, create a basic client profile
            const userData = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || 'Usuario',
              role: 'client'
            };
            await setDoc(doc(db, 'users', currentUser.uid), userData);
            setIsAdmin(false);
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          // Don't throw here to avoid crashing the whole app on auth check
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Ingresa tu correo para restablecer la contraseña.');
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Se ha enviado un correo para restablecer tu contraseña.');
    } catch (err: any) {
      setError('Error al enviar el correo de restablecimiento. Verifica el email.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Google Auth error:', err);
      setError('Error al iniciar sesión con Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        
        // Create user document in Firestore
        const userData = {
          uid: userCredential.user.uid,
          email,
          displayName,
          role: 'client' // Default role
        };
        
        try {
          await setDoc(doc(db, 'users', userCredential.user.uid), userData);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${userCredential.user.uid}`);
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let message = 'Ocurrió un error inesperado.';
      if (err.code === 'auth/user-not-found') message = 'Usuario no encontrado.';
      if (err.code === 'auth/wrong-password') message = 'Contraseña incorrecta.';
      if (err.code === 'auth/email-already-in-use') message = 'El correo ya está registrado.';
      if (err.code === 'auth/weak-password') message = 'La contraseña es muy débil.';
      if (err.code === 'auth/invalid-email') message = 'Correo inválido.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-neon/10 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-card border border-border rounded-3xl p-8 shadow-2xl shadow-neon/5 relative z-10"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl bg-neon/10 border border-neon/20">
              <Globe className="text-neon" size={32} />
            </div>
          </div>
          <h1 className="text-4xl font-display font-bold text-white tracking-tighter mb-2">
            ECOMM<span className="text-neon">IL</span>
          </h1>
          <p className="text-slate-400 text-sm">
            {isLogin ? 'Bienvenido de nuevo a tu centro logístico' : 'Crea tu cuenta profesional hoy'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5"
              >
                <label className="text-xs font-display uppercase tracking-widest text-slate-500 ml-1">Nombre Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-white focus:border-neon focus:ring-1 focus:ring-neon/20 transition-all outline-none"
                    placeholder="Tu nombre"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <label className="text-xs font-display uppercase tracking-widest text-slate-500 ml-1">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-white focus:border-neon focus:ring-1 focus:ring-neon/20 transition-all outline-none"
                placeholder="correo@ejemplo.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-display uppercase tracking-widest text-slate-500 ml-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-12 text-white focus:border-neon focus:ring-1 focus:ring-neon/20 transition-all outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-neon transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs"
            >
              <AlertCircle size={14} />
              {error}
            </motion.div>
          )}

          {message && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 p-3 rounded-xl bg-neon/10 border border-neon/20 text-neon text-xs"
            >
              <AlertCircle size={14} />
              {message}
            </motion.div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-[10px] font-mono uppercase tracking-widest text-slate-500 hover:text-neon transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-neon text-background font-bold py-3 rounded-xl hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
                {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
              </>
            )}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-slate-500">O continúa con</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white/5 border border-border text-white font-medium py-3 rounded-xl hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
        >
          <Chrome size={20} className="text-neon" />
          Google
        </button>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-slate-400 hover:text-neon transition-colors"
          >
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
