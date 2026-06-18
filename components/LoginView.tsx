
import React, { useState } from 'react';
import { UserAccount } from '../types';
import { ShieldCheck, Lock, User, LogIn, AlertCircle, ArrowRight } from 'lucide-react';

interface LoginViewProps {
  users: UserAccount[];
  onLogin: (user: UserAccount) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ users, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
      
      if (user) {
        if (!user.active) {
          setError("Esta conta está inativa. Contate o administrador.");
          setIsLoading(false);
          return;
        }
        onLogin(user);
      } else {
        setError("Credenciais inválidas. Verifique usuário e senha.");
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
      
      <div className="w-full max-w-[440px] z-10">
        <div className="text-center mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-2xl shadow-blue-500/20 mb-6 group transition-transform hover:scale-105">
            <ShieldCheck size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">RISKFLOW</h1>
          <p className="text-slate-400 font-medium">Portal de Análise de Risco</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[2.5rem] shadow-2xl animate-in fade-in zoom-in-95 duration-500">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Usuário</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                <input 
                  type="text" 
                  required
                  placeholder="Seu usuário" 
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-white font-bold placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Senha</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                <input 
                  type="password" 
                  required
                  placeholder="••••••••" 
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-white font-bold placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs font-bold animate-in slide-in-from-left-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Entrar no Sistema <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            RiskFlow &copy; 2025
          </p>
        </div>
      </div>
    </div>
  );
};
