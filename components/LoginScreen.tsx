
import React, { useState } from 'react';
import { User, Role } from '../types';
import { db } from '../services/database';

interface LoginScreenProps {
  onLogin: (u: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initializing, setInitializing] = useState(false);
  const [showDemoLinks, setShowDemoLinks] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
        const user = await db.login(email, password);
        onLogin(user);
    } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de connexion.");
    } finally {
        setLoading(false);
    }
  };

  const handleInit = async () => {
    setInitializing(true);
    try {
        await db.seedDemoData();
        window.location.reload();
    } catch (e) {
        alert("Erreur d'initialisation.");
        setInitializing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-pal-500 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-pal-yellow rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-[450px] relative">
        <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(27,41,111,0.1)] overflow-hidden">
          <div className="p-8 md:p-12">
            <div className="flex justify-center mb-8">
                <img 
                    src="https://www.showroomafrica.com/assets/images/companies/logos/logo-port-autonome-lome_664f8bc1a01af.png" 
                    alt="Logo PAL" 
                    className="w-64 h-auto object-contain"
                />
            </div>

            <div className="text-center mb-8">
                <h1 className="text-2xl font-extrabold text-pal-500 mb-2">Gestion des Carrières</h1>
                <p className="text-sm text-slate-400 font-medium uppercase tracking-widest">Portail Sécurisé Personnel</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-pal-500 uppercase mb-2 tracking-wider">Email Professionnel</label>
                <input 
                  type="email" 
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pal-500 focus:border-pal-500 outline-none transition text-sm font-medium"
                  placeholder="nom.prenom@pal.tg"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-pal-500 uppercase mb-2 tracking-wider">Mot de passe</label>
                <input 
                  type="password" 
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pal-500 focus:border-pal-500 outline-none transition text-sm font-medium"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold border border-red-100 animate-shake flex items-center">
                  <i className="fas fa-exclamation-triangle mr-2"></i> {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-pal-500 hover:bg-pal-600 text-white font-extrabold py-4 rounded-xl shadow-xl shadow-pal-900/10 transition transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <><i className="fas fa-shield-alt"></i> Connexion</>}
              </button>
            </form>

            <div className="mt-8 text-center">
                <button 
                    onClick={() => setShowDemoLinks(!showDemoLinks)}
                    className="text-xs text-slate-400 hover:text-pal-500 font-bold transition"
                >
                    {showDemoLinks ? 'Masquer la démo' : 'Comptes de test (Démo)'}
                </button>

                {showDemoLinks && (
                  <div className="mt-4 grid grid-cols-1 gap-2 animate-fade-in-up">
                    <button onClick={async () => {
                      // Prefer explicit system id match for demo super admin
                      let u = db.getUsers().find(x => x.id === 'u_super_admin');
                      if (!u) u = db.getUsers().find(x => x.email === 'a.agbotse@togoport.tg');
                      if (!u) {
                        await db.seedDemoData();
                        u = db.getUsers().find(x => x.id === 'u_super_admin') || db.getUsers().find(x => x.email === 'a.agbotse@togoport.tg');
                      }
                      if (u) return onLogin(u);
                      setEmail('a.agbotse@togoport.tg'); setPassword('');
                    }} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-pal-500 hover:border-pal-yellow flex justify-between items-center transition">
                      <span>SUPER ADMIN</span>
                      <span className="text-slate-400">a.agbotse@togoport.tg</span>
                    </button>
                    <button onClick={async () => {
                      // Prefer the DRH system id if present
                      let u = db.getUsers().find(x => x.id === 'u_drh');
                      if (!u) u = db.getUsers().find(x => x.email === 'drh@pal.tg');
                      if (!u) {
                        await db.seedDemoData();
                        u = db.getUsers().find(x => x.id === 'u_drh') || db.getUsers().find(x => x.email === 'drh@pal.tg');
                      }
                      if (u) return onLogin(u);
                      setEmail('drh@pal.tg'); setPassword('');
                    }} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-pal-500 hover:border-pal-yellow flex justify-between items-center transition">
                      <span>DRH</span>
                      <span className="text-slate-400">drh@pal.tg</span>
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>

        {db.getUsers().length === 0 && (
            <div className="mt-4 p-4 bg-pal-yellow/10 border border-pal-yellow rounded-2xl text-center">
                <button 
                    onClick={handleInit}
                    className="text-xs font-extrabold text-pal-900"
                >
                    {initializing ? 'Initialisation...' : 'PREMIÈRE UTILISATION : INITIALISER LE SYSTÈME'}
                </button>
            </div>
        )}
        
        <p className="mt-8 text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
          &copy; {new Date().getFullYear()} Port Autonome de Lomé - DSI
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
