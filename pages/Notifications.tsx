
import React, { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/database';
import { User, Notification } from '../types';

interface NotificationsProps {
    user: User;
    notifications: Notification[];
    onMarkRead: (n: Notification) => void;
    onMarkAllRead: () => void;
    onSilentMarkRead: (id: string) => void;
    onMarkByTypeRead: (type: 'INFO' | 'ACTION' | 'SUCCESS' | 'ERROR') => void;
}

// Sous-composant pour gérer le cycle de vie et le timer de chaque notification
const NotificationItem: React.FC<{ n: Notification, onMarkRead: (n: Notification) => void, onSilentMarkRead: (id: string) => void }> = ({ n, onMarkRead, onSilentMarkRead }) => {
    
    // Auto-mark read after 15s if unread
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (!n.read) {
            timer = setTimeout(() => {
                onSilentMarkRead(n.id);
            }, 15000);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [n.read, n.id, onSilentMarkRead]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'SUCCESS': return <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-xl shadow-sm"><i className="fas fa-check-circle"></i></div>;
            case 'ERROR': return <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center text-xl shadow-sm"><i className="fas fa-exclamation-circle"></i></div>;
            case 'ACTION': return <div className="w-12 h-12 rounded-2xl bg-pal-yellow/20 text-pal-900 flex items-center justify-center text-xl shadow-sm animate-pulse"><i className="fas fa-bell"></i></div>;
            default: return <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center text-xl shadow-sm"><i className="fas fa-info-circle"></i></div>;
        }
    };

    return (
        <div 
            onClick={() => onMarkRead(n)}
            className={`
                group p-5 rounded-[2rem] border transition duration-300 cursor-pointer flex items-center gap-5 relative overflow-hidden
                ${n.read ? 'bg-white border-slate-100 hover:border-pal-500/30' : 'bg-white border-pal-500 shadow-xl shadow-pal-500/5 ring-1 ring-pal-500/10'}
            `}
        >
            {!n.read && (
                <div className="absolute top-0 left-0 w-1 h-full bg-pal-500"></div>
            )}
            <div className="flex-shrink-0">
                {getIcon(n.type)}
            </div>
            <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-start">
                    <p className={`text-sm leading-relaxed ${n.read ? 'text-slate-600 font-medium' : 'text-slate-900 font-black'}`}>
                        {n.message}
                    </p>
                    {!n.read && (
                        <div className="flex flex-col items-end gap-1">
                             <span className="w-2 h-2 bg-pal-yellow rounded-full shadow-sm"></span>
                        </div>
                    )}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-black uppercase tracking-tighter">
                    <i className="far fa-clock mr-1"></i> {new Date(n.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {!n.read && <span className="ml-2 text-pal-500 opacity-60 italic normal-case font-normal">(Auto-lecture dans 15s)</span>}
                </p>
            </div>
            {n.linkToEvalId && (
                <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <i className="fas fa-chevron-right"></i>
                </div>
            )}
        </div>
    );
};

const Notifications = ({ user, notifications, onMarkRead, onMarkAllRead, onSilentMarkRead, onMarkByTypeRead }: NotificationsProps) => {
    const myNotifications = useMemo(() => 
        notifications.filter(n => n.userId === user.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    , [notifications, user]);

    const unreadCount = myNotifications.filter(n => !n.read).length;

    const unreadByType = useMemo(() => {
        return {
            INFO: myNotifications.filter(n => !n.read && n.type === 'INFO').length,
            ACTION: myNotifications.filter(n => !n.read && n.type === 'ACTION').length,
            SUCCESS: myNotifications.filter(n => !n.read && n.type === 'SUCCESS').length,
            ERROR: myNotifications.filter(n => !n.read && n.type === 'ERROR').length
        };
    }, [myNotifications]);

    const groupedNotifications = useMemo(() => {
        const now = new Date();
        const groups: { [key: string]: Notification[] } = {
            "Aujourd'hui": [],
            "Hier": [],
            "Plus ancien": []
        };

        myNotifications.forEach(n => {
            const date = new Date(n.date);
            const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
            
            if (diffDays === 0) groups["Aujourd'hui"].push(n);
            else if (diffDays === 1) groups["Hier"].push(n);
            else groups["Plus ancien"].push(n);
        });

        return groups;
    }, [myNotifications]);

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up pb-20">
            <header className="flex justify-between items-end border-b border-slate-200 pb-6">
                <div>
                    <h2 className="text-3xl font-black text-pal-500 tracking-tight uppercase italic">Centre de Messagerie</h2>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
                        {unreadCount} messages non lus sur un total de {myNotifications.length}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button 
                        onClick={onMarkAllRead}
                        className="bg-pal-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-pal-600 transition shadow-lg shadow-pal-500/20"
                    >
                        Tout marquer comme lu
                    </button>
                )}
            </header>

            {/* QUICK ACTIONS BY TYPE */}
            {unreadCount > 0 && (
                <div className="flex flex-wrap gap-2 animate-fade-in-up">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-full mb-1">Actions rapides par type :</p>
                    {unreadByType.ACTION > 0 && (
                        <button 
                            onClick={() => onMarkByTypeRead('ACTION')}
                            className="bg-pal-yellow text-pal-900 border border-pal-yellow px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-95 transition flex items-center gap-2"
                        >
                            <i className="fas fa-bell"></i> Marquer Actions ({unreadByType.ACTION})
                        </button>
                    )}
                    {unreadByType.INFO > 0 && (
                        <button 
                            onClick={() => onMarkByTypeRead('INFO')}
                            className="bg-blue-50 text-blue-600 border border-blue-100 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-100 transition flex items-center gap-2"
                        >
                            <i className="fas fa-info-circle"></i> Marquer Infos ({unreadByType.INFO})
                        </button>
                    )}
                    {unreadByType.SUCCESS > 0 && (
                        <button 
                            onClick={() => onMarkByTypeRead('SUCCESS')}
                            className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition flex items-center gap-2"
                        >
                            <i className="fas fa-check-circle"></i> Marquer Succès ({unreadByType.SUCCESS})
                        </button>
                    )}
                    {unreadByType.ERROR > 0 && (
                        <button 
                            onClick={() => onMarkByTypeRead('ERROR')}
                            className="bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition flex items-center gap-2"
                        >
                            <i className="fas fa-exclamation-circle"></i> Marquer Erreurs ({unreadByType.ERROR})
                        </button>
                    )}
                </div>
            )}

            {myNotifications.length === 0 ? (
                <div className="py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200 text-4xl">
                        <i className="fas fa-bell-slash"></i>
                    </div>
                    <h4 className="text-xl font-black text-slate-400 uppercase tracking-widest">Boîte de réception vide</h4>
                    <p className="text-slate-300 font-medium italic">Vous n'avez aucune notification pour le moment.</p>
                </div>
            ) : (
                <div className="space-y-10">
                    {Object.entries(groupedNotifications).map(([label, items]: [string, Notification[]]) => items.length > 0 && (
                        <div key={label} className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">{label}</h3>
                            <div className="space-y-3">
                                {items.map(n => (
                                    <NotificationItem 
                                        key={n.id} 
                                        n={n} 
                                        onMarkRead={onMarkRead} 
                                        onSilentMarkRead={onSilentMarkRead} 
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Notifications;
