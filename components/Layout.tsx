
import React, { useMemo } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { User, Permission, Role } from '../types';
import { db } from '../services/database';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  unreadCount: number;
  onRefresh?: () => Promise<void>;
}

type NavItem = {
  path: string;
  label: string;
  icon: string;
  requiredPermission?: Permission;
  anyOfPermissions?: Permission[];
  isNotification?: boolean;
};

const NAVIGATION_CONFIG: NavItem[] = [
  { path: '/', label: 'Tableau de bord', icon: 'fas fa-chart-pie' },
  { path: '/notifications', label: 'Notifications', icon: 'fas fa-bell', isNotification: true },
  { path: '/stats', label: 'Pilotage & Stats', icon: 'fas fa-chart-line', anyOfPermissions: [Permission.VIEW_ALL_TEAMS] },
  { path: '/my-evaluation', label: 'Mon Évaluation', icon: 'fas fa-file-contract', requiredPermission: Permission.FILL_EVALUATION },
  { path: '/profile-editor', label: 'Éditeur Photo IA', icon: 'fas fa-wand-magic-sparkles', requiredPermission: Permission.USE_AI_TOOLS },
  { path: '/team', label: 'Organisation', icon: 'fas fa-sitemap', anyOfPermissions: [Permission.VIEW_SERVICE_TEAM, Permission.VIEW_DEPT_TEAM, Permission.VIEW_ALL_TEAMS] },
  { path: '/validations', label: 'Dossiers à Valider', icon: 'fas fa-clipboard-check', requiredPermission: Permission.VALIDATE_EVALUATIONS },
  { path: '/history', label: 'Historique', icon: 'fas fa-archive', requiredPermission: Permission.VIEW_HISTORY },
  { path: '/campaigns', label: 'Campagnes', icon: 'fas fa-bullhorn', requiredPermission: Permission.MANAGE_CAMPAIGNS },
  { path: '/admin', label: 'Administration', icon: 'fas fa-cog', requiredPermission: Permission.ACCESS_ADMIN }
];

const Layout: React.FC<LayoutProps> = ({ user, onLogout, unreadCount, onRefresh }) => {
  // Défensive: si `user` est manquant côté initialisation, afficher un placeholder
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">Chargement...</div>
      </div>
    );
  }
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path + '/'));

  const visibleNavItems = useMemo(() => {
    return NAVIGATION_CONFIG.filter((item) => {
      if (user.role === Role.ADMIN && item.path === '/') return false;
      if (item.requiredPermission && !db.hasPermission(user.role, item.requiredPermission)) return false;
      if (item.anyOfPermissions && !db.hasAnyPermission(user.role, item.anyOfPermissions)) return false;
      return true;
    });
  }, [user.role]);

  // Helper pour le titre de la page
  const getPageTitle = () => {
      if (location.pathname === '/') return 'Tableau de bord';
      if (location.pathname.startsWith('/notifications')) return 'Centre de Notifications';
      if (location.pathname.startsWith('/stats')) return 'Pilotage Stratégique';
      if (location.pathname.startsWith('/my-evaluation')) return 'Mon Évaluation';
      if (location.pathname.startsWith('/profile-editor')) return 'Studio IA';
      if (location.pathname.startsWith('/team')) return 'Organisation';
      if (location.pathname.startsWith('/validations')) return 'Validation des Dossiers';
      if (location.pathname.startsWith('/history')) return 'Archives';
      if (location.pathname.startsWith('/campaigns')) return 'Campagnes';
      if (location.pathname.startsWith('/admin')) return 'Administration';
      return 'Portail RH';
  };

  return (
    <div className="flex bg-slate-50 min-h-screen">
      {/* Sidebar - Institutionnelle Bleu PAL */}
      <aside className="w-72 bg-pal-500 text-white flex flex-col fixed left-0 top-0 h-full shadow-2xl z-20 print:hidden">
        <div className="p-8 border-b border-white/10 flex flex-col items-center">
          <div className="bg-white p-2 rounded-2xl shadow-lg mb-4">
              <img 
                src="https://www.showroomafrica.com/assets/images/companies/logos/logo-port-autonome-lome_664f8bc1a01af.png" 
                alt="PAL Logo" 
                className="w-24 h-auto"
              />
          </div>
          <h1 className="font-extrabold text-lg tracking-tight">RH EVALUATION</h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1 mt-4">
          {visibleNavItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link 
                key={item.path}
                to={item.path} 
                className={`
                  flex items-center justify-between p-4 rounded-2xl transition duration-200 group
                  ${active ? 'bg-pal-yellow text-pal-900 shadow-lg shadow-pal-yellow/20' : 'text-white/70 hover:bg-white/5 hover:text-white'}
                `}
              >
                <span className="flex items-center font-bold text-sm">
                  <i className={`${item.icon} w-8 text-lg ${active ? 'text-pal-900' : 'text-pal-yellow/60 group-hover:text-pal-yellow'}`}></i> 
                  {item.label}
                </span>
                
                {item.isNotification && unreadCount > 0 && (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${active ? 'bg-pal-500 text-white' : 'bg-pal-yellow text-pal-900'}`}>
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
            <button onClick={onLogout} className="flex items-center w-full p-4 rounded-2xl text-sm font-bold text-white/50 hover:bg-red-500 hover:text-white transition group">
                <i className="fas fa-power-off w-8 text-lg group-hover:animate-pulse"></i> 
                Déconnexion
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-72 flex-1 flex flex-col h-screen overflow-hidden">
         {/* Top Navbar */}
         <header className="bg-white border-b border-slate-100 h-20 px-8 flex items-center justify-between sticky top-0 z-10 shadow-sm print:hidden">
            {/* Page Title */}
            <div>
                <h2 className="text-xl font-black text-slate-800 capitalize tracking-tight">
                    {getPageTitle()}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Espace de travail numérique</p>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-6">
              {/* Refresh Button */}
              <button onClick={async () => { if (onRefresh) { try { await onRefresh(); } catch(e){ console.warn('Refresh handler error', e); } } }} title="Actualiser" className="group">
                <div className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-pal-50 flex items-center justify-center text-slate-400 hover:text-pal-500 transition duration-300 border border-slate-100 hover:border-pal-200">
                  <i className={`fas fa-sync-alt text-lg`}></i>
                </div>
              </button>
                {/* Notification Bell */}
                <Link to="/notifications" className="relative group">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-pal-50 flex items-center justify-center text-slate-400 hover:text-pal-500 transition duration-300 border border-slate-100 hover:border-pal-200">
                        <i className={`fas fa-bell text-lg ${unreadCount > 0 ? 'animate-swing' : ''}`}></i>
                    </div>
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-bounce">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Link>

                <div className="h-8 w-px bg-slate-100 mx-2"></div>

                {/* User Profile */}
                <div className="flex items-center gap-3">
                     <div className="text-right hidden md:block">
                         <p className="text-sm font-bold text-slate-800 leading-none">{user.nom} {user.prenom}</p>
                         <p className="text-[10px] font-bold text-pal-500 uppercase mt-1 tracking-wider">{user.role}</p>
                     </div>
                     <div className="w-10 h-10 rounded-xl bg-pal-500 text-white flex items-center justify-center text-sm font-black border-2 border-white shadow-lg shadow-pal-500/20">
                       {((user.nom && user.nom.length > 0) ? user.nom[0] : (user.prenom && user.prenom.length > 0 ? user.prenom[0] : (user.email && user.email.length > 0 ? user.email[0] : 'U'))).toUpperCase()}
                     </div>
                </div>
            </div>
         </header>

         <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <Outlet />
         </div>
      </main>
    </div>
  );
};

export default Layout;
