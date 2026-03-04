
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { User, Role, Notification, Permission } from './types';
import { db } from './services/database';
import { registerCharts } from './services/chartSetup';
import { ToastProvider } from './context/ToastContext';

// Components
import Layout from './components/Layout';
import LoginScreen from './components/LoginScreen';

// Pages
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import Team from './pages/Team';
import DepartmentDetail from './pages/DepartmentDetail'; 
import ServiceDetail from './pages/ServiceDetail'; 
import Validations from './pages/Validations';
import MyEvaluation from './pages/MyEvaluation';
import EvaluationDetail from './pages/EvaluationDetail';
import ProfileEditor from './pages/ProfileEditor';
import History from './pages/History';
import AdminDashboard from './pages/AdminDashboard';
import Notifications from './pages/Notifications';
import Statistics from './pages/Statistics'; // Nouveau

registerCharts();

const AppContent = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isSessionChecking, setIsSessionChecking] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
      const initSession = async () => {
          const existingUser = await db.checkSession();
          if (existingUser) {
              setUser(existingUser);
          }
          setIsSessionChecking(false);
      };
      initSession();
  }, []);

  useEffect(() => {
      if (user) {
          setNotifications(db.getNotifications());
          const interval = setInterval(() => {
              setNotifications(db.getNotifications());
          }, 3000);
          return () => clearInterval(interval);
      }
  }, [user]);

  const handleLogin = (u: User) => setUser(u);
  
  const handleLogout = async () => {
      await db.logout();
      setUser(null);
  };

  const handleRefresh = async () => {
      // Refresh remote caches and re-check session without a full page reload
      try {
          await db.refreshFromServer();
          const existingUser = await db.checkSession();
          if (existingUser) setUser(existingUser);
          setNotifications(db.getNotifications());
      } catch (e) { console.warn('Refresh failed:', e); }
  };

  const handleNotificationClick = (n: Notification) => {
      db.markNotificationRead(n.id);
      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
      if (n.linkToEvalId) {
          navigate(`/evaluation/${n.linkToEvalId}`);
      }
  };

  const handleSilentMarkRead = (id: string) => {
      db.markNotificationRead(id);
      setNotifications(prev => prev.map(item => item.id === id ? { ...item, read: true } : item));
  };

  const handleMarkAllRead = () => {
      if (!user) return;
      db.markAllNotificationsRead(user.id);
      setNotifications(prev => prev.map(item => item.userId === user.id ? { ...item, read: true } : item));
  };

  const handleMarkByTypeRead = (type: 'INFO' | 'ACTION' | 'SUCCESS' | 'ERROR') => {
      if (!user) return;
      db.markNotificationsByTypeRead(user.id, type);
      setNotifications(prev => prev.map(item => (item.userId === user.id && item.type === type) ? { ...item, read: true } : item));
  };

  if (isSessionChecking) {
      return (
          <div className="flex items-center justify-center min-h-screen text-pal-600">
              <i className="fas fa-circle-notch fa-spin text-3xl"></i>
          </div>
      );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const myNotifications = notifications.filter(n => n.userId === user.id);
  const unreadCount = myNotifications.filter(n => !n.read).length;

  return (
        <Routes>
            <Route path="/" element={<Layout user={user} onLogout={handleLogout} onRefresh={handleRefresh} unreadCount={unreadCount} />}>
        <Route index element={
            user.role === Role.ADMIN 
            ? <Navigate to="/admin" replace /> 
            : <Dashboard user={user} />
        } />
        <Route path="stats" element={
            db.hasAnyPermission(user.role, [Permission.VIEW_ALL_TEAMS]) 
            ? <Statistics user={user} /> : <Navigate to="/" />
        } />
        <Route path="team" element={
            db.hasAnyPermission(user.role, [Permission.VIEW_SERVICE_TEAM, Permission.VIEW_DEPT_TEAM, Permission.VIEW_ALL_TEAMS]) 
            ? <Team user={user} /> : <Navigate to="/" />
        } />
        <Route path="team/department/:deptName" element={<DepartmentDetail user={user} />} />
        <Route path="team/service/:deptName/:serviceName" element={<ServiceDetail user={user} />} />
        <Route path="validations" element={
            db.hasPermission(user.role, Permission.VALIDATE_EVALUATIONS) 
            ? <Validations user={user} /> : <Navigate to="/" />
        } />
        <Route path="my-evaluation" element={
            db.hasPermission(user.role, Permission.FILL_EVALUATION)
            ? <MyEvaluation user={user} /> : <Navigate to="/" />
        } />
        <Route path="evaluation/:id" element={<EvaluationDetail currentUser={user} />} />
        <Route path="profile-editor" element={
            db.hasPermission(user.role, Permission.USE_AI_TOOLS)
            ? <ProfileEditor user={user} /> : <Navigate to="/" />
        } />
        <Route path="history" element={
            db.hasPermission(user.role, Permission.VIEW_HISTORY)
            ? <History user={user} /> : <Navigate to="/" />
        } />
        <Route path="campaigns" element={
            db.hasPermission(user.role, Permission.MANAGE_CAMPAIGNS)
            ? <Campaigns user={user} /> : <Navigate to="/" />
        } />
        <Route path="admin" element={
            db.hasPermission(user.role, Permission.ACCESS_ADMIN)
            ? <AdminDashboard /> : <Navigate to="/" />
        } />
        <Route path="notifications" element={
            <Notifications 
                user={user} 
                notifications={notifications} 
                onMarkRead={handleNotificationClick} 
                onMarkAllRead={handleMarkAllRead}
                onSilentMarkRead={handleSilentMarkRead}
                onMarkByTypeRead={handleMarkByTypeRead}
            />
        } />
        <Route path="*" element={<div className="p-8 text-center text-gray-500">Page non trouvée.</div>} />
      </Route>
    </Routes>
  );
};

const App = () => {
  return (
    <HashRouter>
      <ToastProvider>
        <AppContent />
            </ToastProvider>
        </HashRouter>
  );
};

export default App;
