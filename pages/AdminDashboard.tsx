
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/database';
import { User, Role, Permission, AuditLog, Evaluation, Campaign, EvaluationStatus } from '../types';
import { useToast } from '../context/ToastContext';
import { Bar, Doughnut } from 'react-chartjs-2';

type Tab = 'STATS' | 'USERS' | 'STRUCTURE' | 'ROLES' | 'AUDIT' | 'SYSTEM' | 'SECURITE';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('STATS');
    const { showToast } = useToast();
    
    const [users, setUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [rolePermissions, setRolePermissions] = useState<Record<Role, Permission[]>>({} as any);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState<Partial<User>>({});

    // Password management states
    const [userPasswords, setUserPasswords] = useState<Record<string, { password: string; setAt: string; setBy: string }>>({});
    const [passwordSearch, setPasswordSearch] = useState("");
    const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
    const [showSetPasswordModal, setShowSetPasswordModal] = useState<User | null>(null);
    const [newPasswordInput, setNewPasswordInput] = useState("");
    const [resetConfirm, setResetConfirm] = useState<string | null>(null);
    
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("ALL");
    const [deptFilterUsers, setDeptFilterUsers] = useState<string>("ALL");
    const [sortKey, setSortKey] = useState<string>("name_asc");
    
    const [auditSearch, setAuditSearch] = useState("");
    const [newDeptName, setNewDeptName] = useState("");
    const [newServiceName, setNewServiceName] = useState("");
    const [selectedDept, setSelectedDept] = useState<string | null>(null);
    const [selectedService, setSelectedService] = useState<string | null>(null);
    const [showNominationModal, setShowNominationModal] = useState<{ type: 'DIRECTEUR' | 'CHEF_SERVICE', dept: string, service?: string } | null>(null);
    const [assignmentSearch, setAssignmentSearch] = useState("");

    useEffect(() => {
        refreshData();
    }, []);

    const refreshData = () => {
        setUsers(db.getUsers());
        setDepartments(db.getDepartmentsList());
        setRolePermissions(db.getRolePermissions());
        setAuditLogs(db.getAuditLogs());
        setEvaluations(db.getEvaluations());
        setCampaigns(db.getCampaigns());
        setUserPasswords(db.getUserPasswords());
    };

    const togglePasswordVisibility = (userId: string) => {
        setVisiblePasswords(prev => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const handleSetPassword = async (user: User) => {
        if (!newPasswordInput || newPasswordInput.length < 6) {
            showToast("Le mot de passe doit contenir au moins 6 caractères", "error");
            return;
        }
        const ok = await db.setUserPassword(user.id, newPasswordInput, 'ADMIN');
        if (ok) {
            showToast(`Mot de passe défini pour ${user.nom} ${user.prenom}`, "success");
            setShowSetPasswordModal(null);
            setNewPasswordInput("");
            refreshData();
        } else {
            showToast("Erreur lors de la définition du mot de passe", "error");
        }
    };

    const handleResetPassword = async (user: User) => {
        const result = await db.resetUserPassword(user.id, 'ADMIN');
        if (result.success) {
            showToast(`Mot de passe réinitialisé pour ${user.nom}: ${result.newPassword}`, "success");
            setResetConfirm(null);
            refreshData();
        } else {
            showToast("Erreur lors de la réinitialisation", "error");
        }
    };

    const handleSendResetEmail = async (user: User) => {
        const ok = await db.sendPasswordResetEmail(user.id, 'ADMIN');
        if (ok) {
            showToast(`Email de réinitialisation envoyé à ${user.email}`, "success");
        } else {
            showToast("Erreur d'envoi. Vérifiez que l'email est configuré.", "error");
        }
    };

    const filteredPasswordUsers = useMemo(() => {
        const s = passwordSearch.toLowerCase();
        return users.filter(u => {
            if (!s) return true;
            return `${u.nom} ${u.prenom}`.toLowerCase().includes(s) ||
                   u.matricule.toLowerCase().includes(s) ||
                   (u.email && u.email.toLowerCase().includes(s));
        });
    }, [users, passwordSearch]);

    const handleNominate = async (userId: string) => {
        if (!showNominationModal) return;
        const targetUser = users.find(u => u.id === userId);
        if (!targetUser) return;
        
        const updatedUser = { ...targetUser };
        if (showNominationModal.type === 'DIRECTEUR') {
            updatedUser.role = Role.DIRECTEUR;
            updatedUser.departement = showNominationModal.dept;
            updatedUser.service = "";
            updatedUser.fonction = `Directeur de Département (${showNominationModal.dept})`;
            updatedUser.isEncadrant = true;
        } else {
            updatedUser.role = Role.CHEF_SERVICE;
            updatedUser.departement = showNominationModal.dept;
            updatedUser.service = showNominationModal.service;
            updatedUser.fonction = `Chef de Service (${showNominationModal.service})`;
            updatedUser.isEncadrant = true;
        }
        await db.updateUser(updatedUser);
        showToast("Nomination effectuée", "success");
        setShowNominationModal(null);
        refreshData();
    };

    const handleAssignAgent = async (userId: string, dept?: string, service?: string) => {
        const targetUser = users.find(u => u.id === userId);
        if (!targetUser) return;
        const updatedUser = { ...targetUser, departement: dept || targetUser.departement, service: service || targetUser.service };
        await db.updateUser(updatedUser);
        showToast(`Agent affecté`, "success");
        refreshData();
    };

    const handleToggleRoleExtension = async (user: User, type: 'DIVISION' | 'SECTION' | 'AGENT') => {
        const updatedUser = { ...user };
        const baseFonction = user.fonction?.replace(/Chef de (Division|Section) - /g, "") || "";
        if (type === 'DIVISION') { updatedUser.fonction = `Chef de Division - ${baseFonction}`; updatedUser.isEncadrant = true; }
        else if (type === 'SECTION') { updatedUser.fonction = `Chef de Section - ${baseFonction}`; updatedUser.isEncadrant = true; }
        else { updatedUser.fonction = baseFonction; updatedUser.isEncadrant = false; }
        await db.updateUser(updatedUser);
        showToast("Mise à jour effectuée", "success");
        refreshData();
    };

    const handleOpenUserModal = (user: User | null = null) => {
      if (user) {
          setEditingUser(user);
          setFormData({ ...user });
      } else {
          setEditingUser(null);
          setFormData({
              role: Role.AGENT,
              departement: departments[0] || "",
              isEncadrant: false,
              dateEntree: new Date().toISOString().split('T')[0]
          });
      }
      setShowUserModal(true);
    };

    const filteredAndSortedUsers = useMemo(() => {
        let result = users.filter(u => {
            const search = searchTerm.toLowerCase();
            const fullName = `${u.nom} ${u.prenom}`.toLowerCase();
            const matchesSearch = fullName.includes(search) || 
                                 u.matricule.toLowerCase().includes(search) ||
                                 (u.email && u.email.toLowerCase().includes(search));
            const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
            const matchesDept = deptFilterUsers === "ALL" || u.departement === deptFilterUsers;
            return matchesSearch && matchesRole && matchesDept;
        });
        result.sort((a, b) => {
            const sa = (s: string | null | undefined) => (s ?? "");
            switch (sortKey) {
                case "name_asc": return sa(a.nom).localeCompare(sa(b.nom));
                case "name_desc": return sa(b.nom).localeCompare(sa(a.nom));
                case "role": return sa(a.role).localeCompare(sa(b.role));
                case "dept": return sa(a.departement).localeCompare(sa(b.departement));
                case "mat": return sa(a.matricule).localeCompare(sa(b.matricule));
                default: return 0;
            }
        });
        return result;
    }, [users, searchTerm, roleFilter, deptFilterUsers, sortKey]);

    const activeCampaign = useMemo(() => campaigns.find(c => c.statut === 'ACTIVE'), [campaigns]);
    const currentYear = useMemo(() => activeCampaign?.annee || new Date().getFullYear(), [activeCampaign]);

    const stats = useMemo(() => {
        const statusCounts = evaluations.reduce((acc, ev) => {
            if (ev.annee === currentYear) acc[ev.statut] = (acc[ev.statut] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return { totalUsers: users.length, totalEvals: evaluations.length, activeCamps: campaigns.filter(c => c.statut === 'ACTIVE').length, statusCounts };
    }, [users, evaluations, campaigns, currentYear]);

    const detailedDeptStats = useMemo(() => {
        return departments.map(dept => {
            const deptUsers = users.filter(u => u.departement === dept);
            const deptEvals = evaluations.filter(e => {
                const u = users.find(usr => usr.id === e.agentId);
                return u && u.departement === dept && e.annee === currentYear;
            });
            return {
                name: dept,
                totalStaff: deptUsers.length,
                avgScore: deptEvals.length > 0 ? parseFloat((deptEvals.reduce((a, b) => a + b.noteGlobale, 0) / deptEvals.length).toFixed(1)) : 0
            };
        }).sort((a, b) => b.totalStaff - a.totalStaff);
    }, [users, evaluations, currentYear, departments]);

    const topPerformers = useMemo(() => {
        return evaluations
            .filter(e => e.annee === currentYear && e.statut === EvaluationStatus.VALIDE_DRH)
            .sort((a, b) => b.noteGlobale - a.noteGlobale)
            .slice(0, 5)
            .map(e => {
                const agent = users.find(u => u.id === e.agentId);
                return {
                    name: agent ? `${agent.nom} ${agent.prenom}` : 'Anonyme',
                    score: e.noteGlobale,
                    dept: agent?.departement || 'N/A'
                };
            });
    }, [evaluations, currentYear, users]);

    const handleSaveUser = async () => {
        if (!formData.nom || !formData.matricule || !formData.role || !formData.email) return showToast("Champs obligatoires manquants", "error");
        const userToSave: User = {
            id: editingUser ? editingUser.id : `u_${Date.now()}`,
            matricule: formData.matricule!, email: formData.email!, nom: formData.nom!, prenom: formData.prenom || "",
            role: formData.role!, departement: formData.departement || "", service: formData.service || "",
            fonction: formData.fonction || "", categorie: formData.categorie || "",
            dateEntree: formData.dateEntree || new Date().toISOString().split('T')[0], isEncadrant: formData.isEncadrant || false,
        };
        editingUser ? await db.updateUser(userToSave) : await db.addUser(userToSave);
        showToast("Utilisateur enregistré", "success");
        setShowUserModal(false);
        refreshData();
    };

    const togglePermission = (role: Role, perm: Permission) => {
        const current = rolePermissions[role] || [];
        const updated = current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm];
        setRolePermissions({ ...rolePermissions, [role]: updated });
    };

    const filteredAudit = useMemo(() => {
        const s = auditSearch.toLowerCase();
        return auditLogs.filter(l => 
            l.action.toLowerCase().includes(s) || 
            l.details.toLowerCase().includes(s) || 
            l.userRole.toLowerCase().includes(s) ||
            (l.targetName && l.targetName.toLowerCase().includes(s))
        );
    }, [auditLogs, auditSearch]);

    return (
        <div className="space-y-8 animate-fade-in-up pb-20">
            <header className="flex justify-between items-center gap-4">
                <div><h2 className="text-3xl font-extrabold text-pal-500 tracking-tight italic">Administration Système</h2><p className="text-slate-400 font-medium italic">Tableau de bord de pilotage • DSI PAL</p></div>
                <div className="flex items-center gap-2">
                    <button onClick={refreshData} className="w-10 h-10 bg-white border rounded-xl hover:bg-slate-50 transition flex items-center justify-center shadow-sm"><i className="fas fa-sync-alt text-slate-400"></i></button>
                    <button onClick={async () => {
                        showToast('Lancement du backfill des campagnes...', 'info');
                        try {
                            await db.syncActiveCampaignsForAllUsers();
                            showToast('Backfill des campagnes terminé', 'success');
                            refreshData();
                        } catch (e) {
                            console.error(e);
                            showToast('Erreur durant le backfill', 'error');
                        }
                    }} title="Sync campagnes pour tous" className="px-4 py-2 bg-pal-500 text-white rounded-xl text-xs font-black hover:bg-pal-600 transition">Sync campagnes</button>
                </div>
            </header>

            <nav className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 w-full md:w-fit overflow-x-auto no-scrollbar">
                {[
                    { id: 'STATS', icon: 'fa-chart-pie', label: 'Dashboard' },
                    { id: 'STRUCTURE', icon: 'fa-sitemap', label: 'Structure' },
                    { id: 'USERS', icon: 'fa-users', label: 'Utilisateurs' },
                    { id: 'ROLES', icon: 'fa-user-shield', label: 'Permissions' },
                    { id: 'AUDIT', icon: 'fa-fingerprint', label: 'Audit Log' },
                    { id: 'SECURITE', icon: 'fa-key', label: 'Mots de passe' },
                    { id: 'SYSTEM', icon: 'fa-server', label: 'Maintenance' },
                ].map((t) => (
                    <button key={t.id} onClick={() => setActiveTab(t.id as Tab)} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2 whitespace-nowrap ${activeTab === t.id ? 'bg-pal-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><i className={`fas ${t.icon}`}></i> {t.label}</button>
                ))}
            </nav>

            {activeTab === 'STATS' && (
                <div className="space-y-8 animate-fade-in-up">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[
                            { label: 'Personnel', val: stats.totalUsers, icon: 'fa-users', col: 'bg-pal-500' },
                            { label: 'Fiches', val: stats.totalEvals, icon: 'fa-file-signature', col: 'bg-emerald-500' },
                            { label: 'Campagnes', val: stats.activeCamps, icon: 'fa-bullhorn', col: 'bg-pal-yellow text-pal-900' },
                            { label: 'Actions Audit', val: auditLogs.length, icon: 'fa-history', col: 'bg-indigo-500' },
                        ].map((k, i) => (
                            <div key={i} className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-50 flex items-center justify-between">
                                <div><p className="text-[10px] font-black uppercase text-slate-400">{k.label}</p><h4 className="text-3xl font-black">{k.val}</h4></div>
                                <div className={`w-14 h-14 rounded-2xl ${k.col} text-white flex items-center justify-center text-xl shadow-lg`}><i className={`fas ${k.icon}`}></i></div>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                             <h3 className="text-sm font-black text-pal-500 mb-8 uppercase tracking-widest italic border-b pb-4">État des Dossiers {currentYear}</h3>
                             <div className="h-64 flex justify-center items-center relative">
                                <Doughnut data={{ labels: Object.keys(stats.statusCounts), datasets: [{ data: Object.values(stats.statusCounts), backgroundColor: ['#cbd5e1', '#3b82f6', '#6366f1', '#a855f7', '#10b981', '#ef4444'], borderWidth: 0 }] }} options={{ cutout: '75%', plugins: { legend: { position: 'bottom', labels: { font: { size: 9, weight: 'bold' } } } } }} />
                                <div className="absolute text-center"><p className="text-3xl font-black text-pal-500">{stats.totalEvals}</p><p className="text-[8px] font-bold text-slate-400 uppercase">Total</p></div>
                             </div>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                             <h3 className="text-sm font-black text-pal-500 mb-8 uppercase tracking-widest italic border-b pb-4">Moyennes par Direction</h3>
                             <div className="h-64"><Bar data={{ labels: detailedDeptStats.slice(0,6).map(d => d.name.substring(0,10)+'...'), datasets: [{ label: 'Score', data: detailedDeptStats.slice(0,6).map(d => d.avgScore), backgroundColor: '#1B296F', borderRadius: 4 }] }} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }} /></div>
                        </div>
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                        <div className="flex justify-between items-center mb-8 border-b pb-4">
                            <h3 className="text-sm font-black text-pal-500 uppercase tracking-widest italic">Top Performance Collaborateurs</h3>
                            <span className="text-[10px] font-black bg-pal-yellow text-pal-900 px-3 py-1 rounded-full uppercase">Campagne {currentYear}</span>
                        </div>
                        {topPerformers.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                {topPerformers.map((agent, i) => (
                                    <div key={i} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col items-center text-center group hover:bg-pal-500 transition-all duration-300">
                                        <div className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center text-sm font-black text-pal-500 mb-3 group-hover:bg-pal-yellow group-hover:text-pal-900 transition-colors">{i + 1}</div>
                                        <p className="text-xs font-black text-slate-800 group-hover:text-white mb-1 truncate w-full">{agent.name}</p>
                                        <p className="text-[8px] font-bold text-slate-400 group-hover:text-white/60 uppercase mb-4 truncate w-full">{agent.dept}</p>
                                        <div className="mt-auto bg-white/20 px-4 py-2 rounded-xl">
                                            <p className="text-xl font-black text-pal-500 group-hover:text-pal-yellow">{agent.score}<span className="text-[8px] opacity-50 ml-1">/100</span></p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-slate-300 italic text-sm font-medium">Aucun dossier finalisé pour cette campagne.</div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'STRUCTURE' && (
                <div className="space-y-8 animate-fade-in-up">
                    <div className="bg-pal-50 p-8 rounded-[2rem] border border-pal-100 flex gap-4 items-center">
                        <i className="fas fa-plus-circle text-pal-500 text-3xl"></i>
                        <input type="text" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="Ajouter une direction (ex: Direction Générale)" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold" />
                        <button onClick={() => { if(newDeptName) { db.addDepartment(newDeptName); refreshData(); setNewDeptName(""); showToast("Direction ajoutée"); } }} className="bg-pal-500 text-white px-8 py-3 rounded-xl font-black uppercase text-xs">Ajouter</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {departments.map(dept => {
                            const director = users.find(u => u.departement === dept && u.role === Role.DIRECTEUR);
                            const services = db.getServicesByDepartment(dept);
                            return (
                                <div key={dept} className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col group">
                                    <div className="p-5 bg-slate-50 border-b flex justify-between items-center">
                                        <div className="overflow-hidden"><h4 className="font-black text-slate-800 text-[10px] uppercase tracking-widest truncate">{dept}</h4><p className="text-[9px] font-bold text-slate-400 italic truncate mt-1">{director ? `${director.nom} ${director.prenom}` : 'Directeur non nommé'}</p></div>
                                        <div className="flex gap-2">
                                            <button onClick={() => navigate(`/team/department/${encodeURIComponent(dept)}`)} className="text-[10px] text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition" title="Voir le département en détail"><i className="fas fa-external-link-alt"></i></button>
                                            <button onClick={() => setShowNominationModal({ type: 'DIRECTEUR', dept })} className="text-[10px] text-pal-500 p-2"><i className="fas fa-user-edit"></i></button>
                                            <button onClick={() => { if(window.confirm("Supprimer?")) { db.deleteDepartment(dept); refreshData(); } }} className="text-slate-300 hover:text-red-500 p-2"><i className="fas fa-trash-alt"></i></button>
                                        </div>
                                    </div>
                                    <div className="p-5 flex-1 space-y-3">
                                        <div className="flex justify-between items-center"><span className="text-[9px] font-black text-slate-400 uppercase">Services ({services.length})</span><button onClick={() => setSelectedDept(selectedDept === dept ? null : dept)} className="text-pal-500"><i className={`fas ${selectedDept === dept ? 'fa-minus-square' : 'fa-plus-square'}`}></i></button></div>
                                        {selectedDept === dept && (
                                            <div className="flex gap-2 animate-slide-in"><input type="text" className="flex-1 bg-slate-50 border rounded-lg px-2 text-xs py-2 font-bold outline-none" placeholder="Nom service..." value={newServiceName} onChange={e => setNewServiceName(e.target.value)} /><button onClick={() => { if(newServiceName) { db.addService(dept, newServiceName); refreshData(); setNewServiceName(""); } }} className="bg-emerald-500 text-white px-3 rounded-lg text-[10px] font-black uppercase">Ok</button></div>
                                        )}
                                        <div className="space-y-2">
                                            {services.map(s => {
                                                const isSrvExpanded = selectedService === `${dept}:${s}`;
                                                const serviceChef = users.find(u => u.service === s && u.role === Role.CHEF_SERVICE);
                                                const serviceAgents = users.filter(u => u.service === s && u.departement === dept && u.role === Role.AGENT);
                                                return (
                                                    <div key={s} className="bg-slate-50 rounded-xl overflow-hidden border border-transparent hover:border-slate-200 transition-all">
                                                        <div className="p-3 flex justify-between items-center group/srv">
                                                            <div onClick={() => setSelectedService(isSrvExpanded ? null : `${dept}:${s}`)} className="overflow-hidden cursor-pointer flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-[10px] font-black text-slate-700 truncate">{s}</p>
                                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${serviceAgents.length === 0 ? 'bg-slate-100 text-slate-400' : 'bg-pal-50 text-pal-500'}`}>
                                                                        {serviceAgents.length === 0 ? 'Non affecté' : (serviceAgents.length === 1 ? (
                                                                            <button title="Voir la fiche" onClick={() => handleOpenUserModal(serviceAgents[0])} className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-pal-50 text-pal-500 cursor-pointer" aria-label={`Ouvrir la fiche de ${serviceAgents[0].prenom} ${serviceAgents[0].nom}`}>
                                                                                {`${serviceAgents[0].prenom} ${serviceAgents[0].nom}`}
                                                                            </button>
                                                                        ) : `${serviceAgents.length} agents`)}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[8px] text-slate-400 font-bold truncate">Chef: {serviceChef?.nom || 'Non défini'}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={() => setShowNominationModal({ type: 'CHEF_SERVICE', dept, service: s })} className="text-pal-500"><i className="fas fa-user-tag text-xs"></i></button>
                                                                <i className={`fas fa-chevron-${isSrvExpanded ? 'up' : 'down'} text-[8px] text-slate-300`}></i>
                                                            </div>
                                                        </div>
                                                        {isSrvExpanded && (
                                                            <div className="bg-white border-t border-slate-100 p-3 space-y-3 animate-fade-in-up">
                                                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Affecter</label>
                                                                <select className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none font-bold text-sm" defaultValue="" onChange={async (e) => {
                                                                    const uid = e.target.value;
                                                                    if (!uid) return;
                                                                    const selectedUser = users.find(u => u.id === uid);
                                                                    if (selectedUser && selectedUser.service && selectedUser.service !== s) {
                                                                        const ok = window.confirm(`${selectedUser.nom} ${selectedUser.prenom} est déjà affecté au service "${selectedUser.service}". Confirmer la réaffectation vers "${s}" ?`);
                                                                        if (!ok) {
                                                                            (e.target as HTMLSelectElement).value = '';
                                                                            return;
                                                                        }
                                                                    }
                                                                    await handleAssignAgent(uid, dept, s);
                                                                    showToast('Agent affecté', 'success');
                                                                    refreshData();
                                                                    // reset select
                                                                    (e.target as HTMLSelectElement).value = '';
                                                                }}>
                                                                    <option value="">Sélectionner un agent...</option>
                                                                    {users.filter(u => [Role.AGENT, Role.CHEF_SERVICE, Role.DIRECTEUR].includes(u.role)).map(u => (
                                                                        <option key={u.id} value={u.id}>{`${u.nom} ${u.prenom} — ${u.service ? u.service : 'Non affecté'} (${u.email || u.matricule || ''})`}</option>
                                                                    ))}
                                                                </select>
                                                                <div className="space-y-1">
                                                                    {serviceAgents.map(ag => (
                                                                        <div key={ag.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 group/ag">
                                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                                <div className="w-6 h-6 bg-pal-500 text-white flex items-center justify-center rounded-md text-[8px] font-black">{ag.nom?.[0] ?? '?'}</div>
                                                                                <div className="overflow-hidden">
                                                                                    <p className="text-[9px] font-bold text-slate-800 truncate">{ag.nom} {ag.prenom}</p>
                                                                                    <p className="text-[7px] text-slate-400 font-medium uppercase truncate">{ag.fonction}</p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex gap-1 opacity-0 group-hover/ag:opacity-100 transition">
                                                                                <button onClick={() => handleToggleRoleExtension(ag, 'DIVISION')} className="p-1 bg-indigo-50 text-indigo-600 rounded text-[7px] font-black uppercase">DIV</button>
                                                                                <button onClick={() => handleToggleRoleExtension(ag, 'SECTION')} className="p-1 bg-emerald-50 text-emerald-600 rounded text-[7px] font-black uppercase">SEC</button>
                                                                                <button onClick={() => handleToggleRoleExtension(ag, 'AGENT')} className="p-1 bg-slate-100 text-slate-400 rounded text-[7px]"><i className="fas fa-undo"></i></button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'USERS' && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                            <div className="lg:col-span-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Recherche Libre</label>
                                <div className="relative">
                                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                                    <input type="text" placeholder="Nom, matricule..." className="w-full bg-slate-50 border-none rounded-xl pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Filtrer par Rôle</label>
                                <select className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                                    <option value="ALL">Tous les rôles</option>
                                    {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Filtrer par Direction</label>
                                <select className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm" value={deptFilterUsers} onChange={e => setDeptFilterUsers(e.target.value)}>
                                    <option value="ALL">Toutes Directions</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Trier par</label>
                                    <select className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm" value={sortKey} onChange={e => setSortKey(e.target.value)}>
                                        <option value="name_asc">Nom (A-Z)</option>
                                        <option value="name_desc">Nom (Z-A)</option>
                                        <option value="mat">Matricule</option>
                                        <option value="role">Rôle</option>
                                        <option value="dept">Direction</option>
                                    </select>
                                </div>
                                <button onClick={() => handleOpenUserModal()} className="h-[46px] bg-pal-500 text-white px-6 rounded-xl font-black uppercase text-xs shadow-lg flex items-center gap-2 hover:bg-pal-600 transition"><i className="fas fa-plus"></i></button>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                    <tr><th className="px-8 py-5">Personnel</th><th className="px-8 py-5">Rôle & Poste</th><th className="px-8 py-5">Affectation</th><th className="px-8 py-5 text-right">Actions</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredAndSortedUsers.map(u => (
                                        <tr key={u.id} className="hover:bg-pal-50/20 transition group">
                                            <td className="px-8 py-5 flex items-center gap-4">
                                                <div className="w-12 h-12 bg-pal-500 text-white flex items-center justify-center rounded-2xl font-black flex-shrink-0 uppercase shadow-sm">{u.nom?.[0] ?? '?'}</div>
                                                <div className="overflow-hidden"><p className="font-black text-slate-800 text-sm truncate">{u.nom} {u.prenom}</p><p className="text-[9px] font-mono text-slate-400 truncate uppercase">{u.matricule}</p></div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border ${u.role === Role.ADMIN || u.role === Role.DRH ? 'bg-pal-yellow text-pal-900 border-pal-yellow' : 'bg-pal-50 text-pal-500 border-pal-100'}`}>{u.role}</span>
                                                <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase truncate max-w-[180px]">{u.fonction}</p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-[11px] font-black text-slate-700 uppercase truncate max-w-[200px]">{u.departement}</p>
                                                <p className="text-[9px] text-slate-400 font-bold italic truncate mt-1 flex items-center gap-1"><i className="fas fa-long-arrow-alt-right text-slate-200"></i> {u.service || 'Non affecté'}</p>
                                            </td>
                                            <td className="px-8 py-5 text-right space-x-3">
                                                <button onClick={() => handleOpenUserModal(u)} className="text-slate-300 hover:text-pal-500 transition-colors p-2 rounded-lg hover:bg-pal-50"><i className="fas fa-edit"></i></button>
                                                <button onClick={() => { if(window.confirm("Action irréversible. Confirmer ?")) { db.deleteUser(u.id); refreshData(); } }} className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"><i className="fas fa-trash-alt"></i></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'ROLES' && (
                <div className="space-y-8 animate-fade-in-up">
                    <div className="bg-pal-500 p-12 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
                        <h3 className="text-2xl font-black uppercase tracking-[0.2em] mb-4">Matrice des Permissions</h3>
                        <p className="text-white/60 text-sm max-w-md italic font-medium leading-relaxed">Ajustez les accès par défaut pour chaque profil utilisateur. Les changements sont appliqués en temps réel sur le cloud.</p>
                        <i className="fas fa-shield-alt absolute -right-10 -bottom-10 text-[15rem] text-white/5"></i>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {Object.values(Role).map(role => (
                            <div key={role} className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8 flex flex-col group hover:border-pal-500/30 transition duration-300">
                                <div className="flex items-center justify-between mb-8"><span className="text-[11px] font-black text-pal-500 uppercase tracking-widest">{role}</span><i className="fas fa-lock text-slate-100 group-hover:text-pal-500 transition"></i></div>
                                <div className="space-y-4">
                                    {Object.values(Permission).map(perm => {
                                        const active = (rolePermissions[role] || []).includes(perm);
                                        return (
                                            <div key={perm} className="flex justify-between items-center group/p">
                                                <span className={`text-[9px] font-bold uppercase transition ${active ? 'text-slate-700' : 'text-slate-300'}`}>{perm.replace(/_/g, ' ')}</span>
                                                <div onClick={() => togglePermission(role, perm)} className={`w-8 h-4 rounded-full relative transition cursor-pointer border ${active ? 'bg-pal-500 border-pal-500' : 'bg-slate-100 border-slate-200'}`}><div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${active ? 'left-5' : 'left-0.5'}`}></div></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end pt-4"><button onClick={() => { db.updateRolePermissions(rolePermissions); showToast("Matrice sauvegardée", "success"); }} className="bg-pal-yellow text-pal-900 px-12 py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-pal-yellow/20 hover:scale-105 transition">Appliquer les Modifications</button></div>
                </div>
            )}

            {activeTab === 'AUDIT' && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center shadow-sm">
                        <i className="fas fa-filter text-pal-500 mr-4"></i>
                        <input type="text" placeholder="Filtrer l'audit par action, acteur ou détails..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 outline-none font-bold text-sm text-slate-700 placeholder-slate-300" />
                    </div>
                    <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                                    <tr><th className="px-8 py-5">Horodatage</th><th className="px-8 py-5">Acteur / Rôle</th><th className="px-8 py-5">Événement</th><th className="px-8 py-5">Informations</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredAudit.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 group">
                                            <td className="px-8 py-5 font-mono text-[9px] text-slate-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                            <td className="px-8 py-5"><span className="text-[10px] font-black text-pal-500 block">{log.userId}</span><span className="text-[8px] font-bold text-slate-300 uppercase">{log.userRole}</span></td>
                                            <td className="px-8 py-5"><span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md text-[9px] font-black uppercase border border-indigo-100">{log.action}</span></td>
                                            <td className="px-8 py-5"><p className="text-[10px] font-bold text-slate-700 leading-relaxed mb-1">{log.targetName || 'Système'}</p><p className="text-[9px] text-slate-400 italic max-w-sm truncate group-hover:whitespace-normal transition-all">{log.details}</p></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'SECURITE' && (
                <div className="space-y-8 animate-fade-in-up">
                    {/* Header */}
                    <div className="bg-pal-500 p-12 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
                        <h3 className="text-2xl font-black uppercase tracking-[0.2em] mb-4">Gestion des Mots de Passe</h3>
                        <p className="text-white/60 text-sm max-w-lg italic font-medium leading-relaxed">Consultez les mots de passe définis pour chaque utilisateur. Réinitialisez-les en cas d'oubli ou de perte d'accès.</p>
                        <i className="fas fa-user-lock absolute -right-10 -bottom-10 text-[15rem] text-white/5"></i>
                    </div>

                    {/* Stats cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-50 flex items-center justify-between">
                            <div><p className="text-[10px] font-black uppercase text-slate-400">Utilisateurs</p><h4 className="text-3xl font-black">{users.length}</h4></div>
                            <div className="w-14 h-14 rounded-2xl bg-pal-500 text-white flex items-center justify-center text-xl shadow-lg"><i className="fas fa-users"></i></div>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-50 flex items-center justify-between">
                            <div><p className="text-[10px] font-black uppercase text-slate-400">MDP Définis</p><h4 className="text-3xl font-black">{Object.keys(userPasswords).length}</h4></div>
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-xl shadow-lg"><i className="fas fa-lock"></i></div>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-50 flex items-center justify-between">
                            <div><p className="text-[10px] font-black uppercase text-slate-400">Sans MDP</p><h4 className="text-3xl font-black text-amber-500">{users.length - Object.keys(userPasswords).length}</h4></div>
                            <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shadow-lg"><i className="fas fa-exclamation-triangle"></i></div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center shadow-sm gap-4">
                        <i className="fas fa-search text-pal-500"></i>
                        <input type="text" placeholder="Rechercher un utilisateur par nom, matricule ou email..." value={passwordSearch} onChange={e => setPasswordSearch(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 outline-none font-bold text-sm text-slate-700 placeholder-slate-300" />
                    </div>

                    {/* Users password table */}
                    <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                    <tr>
                                        <th className="px-8 py-5">Utilisateur</th>
                                        <th className="px-8 py-5">Email</th>
                                        <th className="px-8 py-5">Mot de passe</th>
                                        <th className="px-8 py-5">Défini le</th>
                                        <th className="px-8 py-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredPasswordUsers.map(u => {
                                        const pwData = userPasswords[u.id];
                                        const isVisible = visiblePasswords.has(u.id);
                                        return (
                                            <tr key={u.id} className="hover:bg-pal-50/20 transition group">
                                                <td className="px-8 py-5 flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-pal-500 text-white flex items-center justify-center rounded-xl font-black flex-shrink-0 uppercase shadow-sm text-xs">{u.nom?.[0] ?? '?'}</div>
                                                    <div className="overflow-hidden">
                                                        <p className="font-black text-slate-800 text-sm truncate">{u.nom} {u.prenom}</p>
                                                        <p className="text-[9px] font-mono text-slate-400 truncate uppercase">{u.matricule}</p>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <p className="text-xs font-bold text-slate-600">{u.email || <span className="text-slate-300 italic">Non défini</span>}</p>
                                                </td>
                                                <td className="px-8 py-5">
                                                    {pwData ? (
                                                        <div className="flex items-center gap-2">
                                                            <code className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold ${isVisible ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400'}`}>
                                                                {isVisible ? pwData.password : '••••••••••'}
                                                            </code>
                                                            <button onClick={() => togglePasswordVisibility(u.id)} className="text-slate-300 hover:text-pal-500 transition p-1" title={isVisible ? 'Masquer' : 'Afficher'}>
                                                                <i className={`fas ${isVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                                            </button>
                                                            {isVisible && (
                                                                <button onClick={() => { navigator.clipboard.writeText(pwData.password); showToast('Mot de passe copié', 'success'); }} className="text-slate-300 hover:text-pal-500 transition p-1" title="Copier">
                                                                    <i className="fas fa-copy"></i>
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-amber-50 text-amber-500 border border-amber-100">Non défini</span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-5">
                                                    {pwData ? (
                                                        <div>
                                                            <p className="text-[10px] font-bold text-slate-500">{new Date(pwData.setAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                                            <p className="text-[8px] font-medium text-slate-300 uppercase">Par: {pwData.setBy}</p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-200">—</span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => { setShowSetPasswordModal(u); setNewPasswordInput(''); }} className="px-3 py-2 bg-pal-50 text-pal-500 rounded-xl text-[9px] font-black uppercase hover:bg-pal-100 transition" title="Définir un mot de passe">
                                                            <i className="fas fa-pen mr-1"></i> Définir
                                                        </button>
                                                        <button onClick={() => setResetConfirm(u.id)} className="px-3 py-2 bg-amber-50 text-amber-600 rounded-xl text-[9px] font-black uppercase hover:bg-amber-100 transition" title="Réinitialiser">
                                                            <i className="fas fa-redo mr-1"></i> Reset
                                                        </button>
                                                        {u.email && (
                                                            <button onClick={() => handleSendResetEmail(u)} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase hover:bg-blue-100 transition" title="Envoyer email de réinitialisation">
                                                                <i className="fas fa-envelope mr-1"></i> Email
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Légende */}
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Légende des Actions</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-pal-50 text-pal-500 rounded-lg flex items-center justify-center"><i className="fas fa-pen text-xs"></i></div>
                                <div><p className="text-xs font-bold text-slate-700">Définir</p><p className="text-[9px] text-slate-400">Saisir manuellement un mot de passe</p></div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center"><i className="fas fa-redo text-xs"></i></div>
                                <div><p className="text-xs font-bold text-slate-700">Reset</p><p className="text-[9px] text-slate-400">Générer automatiquement un nouveau MDP temporaire</p></div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center"><i className="fas fa-envelope text-xs"></i></div>
                                <div><p className="text-xs font-bold text-slate-700">Email</p><p className="text-[9px] text-slate-400">Envoyer un lien de réinitialisation par email</p></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'SYSTEM' && (
                <div className="space-y-8 animate-fade-in-up">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col justify-center items-center text-center">
                            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center text-2xl mb-4 border border-blue-100"><i className="fas fa-database"></i></div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Base de Données</h4>
                            <p className="text-3xl font-black text-slate-800">Local DB</p>
                            <p className="text-[10px] font-bold text-emerald-500 uppercase mt-2 italic"><i className="fas fa-check-circle mr-1"></i> Intégrité Validée</p>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col justify-center items-center text-center">
                            <div className="w-16 h-16 bg-pal-50 text-pal-500 rounded-3xl flex items-center justify-center text-2xl mb-4 border border-pal-100"><i className="fas fa-cloud-upload-alt"></i></div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cloud Sync</h4>
                            <p className="text-3xl font-black text-slate-800">Supabase</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 italic">Connecté (Auto-sync)</p>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col justify-center items-center text-center">
                            <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-3xl flex items-center justify-center text-2xl mb-4 border border-indigo-100"><i className="fas fa-shield-virus"></i></div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sécurité</h4>
                            <p className="text-3xl font-black text-slate-800">AES-256</p>
                            <p className="text-[10px] font-bold text-pal-500 uppercase mt-2 italic tracking-tighter">Certifié PAL - DSI</p>
                        </div>
                    </div>
                    <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
                         <h3 className="text-sm font-black text-pal-500 mb-10 border-b pb-4 uppercase tracking-widest italic">Statistiques Système du Dépôt</h3>
                         <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
                            {[
                                { l: 'Comptes', c: users.length, i: 'fa-users', m: 500 },
                                { l: 'Dossiers', c: evaluations.length, i: 'fa-file-invoice', m: 1000 },
                                { l: 'Archives', c: auditLogs.length, i: 'fa-fingerprint', m: 5000 },
                                { l: 'Sessions', c: campaigns.length, i: 'fa-history', m: 10 }
                            ].map((s, idx) => (
                                <div key={idx} className="flex flex-col">
                                    <div className="flex items-center gap-3 mb-2"><i className={`fas ${s.i} text-slate-200`}></i><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.l}</span></div>
                                    <p className="text-4xl font-black text-slate-800 tracking-tighter">{s.c}</p>
                                    <div className="w-full h-1 bg-slate-50 rounded-full mt-3 overflow-hidden"><div className="h-full bg-pal-500 transition-all duration-1000" style={{ width: `${(s.c / s.m) * 100}%` }}></div></div>
                                </div>
                            ))}
                         </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center flex flex-col items-center">
                            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center text-3xl mb-6 shadow-sm"><i className="fas fa-file-archive"></i></div>
                            <h4 className="text-xl font-black text-slate-800 mb-2 italic">Exportation Master</h4>
                            <p className="text-slate-400 text-xs font-medium mb-8 leading-relaxed max-w-xs uppercase tracking-tighter">Téléchargez l'intégralité du dépôt local au format JSON.</p>
                            <button onClick={() => { const b = db.getBackupData(); const blob = new Blob([b], {type: 'application/json'}); const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download=`PAL_EXPORT_${Date.now()}.json`; a.click(); showToast("Exportation terminée"); }} className="w-full bg-pal-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-pal-600 transition">Télécharger (.json)</button>
                        </div>
                        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center flex flex-col items-center">
                            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center text-3xl mb-6 shadow-sm"><i className="fas fa-radiation"></i></div>
                            <h4 className="text-xl font-black text-red-600 mb-2 italic">Reset Critique</h4>
                            <p className="text-slate-400 text-xs font-medium mb-8 leading-relaxed max-w-xs uppercase tracking-tighter">Réinitialise le stockage local du navigateur.</p>
                            <button onClick={() => db.resetSystem()} className="w-full border-2 border-red-100 text-red-500 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-red-50 transition">Réinitialiser</button>
                        </div>
                    </div>
                </div>
            )}

            {showUserModal && (
                <div className="fixed inset-0 bg-pal-900/70 backdrop-blur-xl flex items-center justify-center z-[200] p-4">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up">
                        <div className="bg-pal-500 p-8 text-white flex justify-between items-center"><div><h3 className="text-xl font-black uppercase tracking-widest">{editingUser ? 'Fiche Collaborateur' : 'Nouveau Staff'}</h3><p className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-1 tracking-tighter italic">Port Autonome de Lomé - Dossier Individuel</p></div><button onClick={() => setShowUserModal(false)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><i className="fas fa-times"></i></button></div>
                        <div className="p-10 grid grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <div className="col-span-1"><label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Matricule</label><input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold" value={formData.matricule || ''} onChange={e => setFormData({...formData, matricule: e.target.value})} /></div>
                            <div className="col-span-1"><label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Email PAL</label><input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                            <div className="col-span-1"><label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nom</label><input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold uppercase" value={formData.nom || ''} onChange={e => setFormData({...formData, nom: e.target.value?.toUpperCase() || ''})} /></div>
                            <div className="col-span-1"><label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Prénom</label><input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold" value={formData.prenom || ''} onChange={e => setFormData({...formData, prenom: e.target.value})} /></div>
                            <div className="col-span-1"><label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Rôle Système</label><select className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold" value={formData.role || Role.AGENT} onChange={e => setFormData({...formData, role: e.target.value as Role})}>{Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                            <div className="col-span-1"><label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Direction</label><select className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold" value={formData.departement || ''} onChange={e => setFormData({...formData, departement: e.target.value})}><option value="">Sélectionner...</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                            <div className="col-span-2"><label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Fonction / Intitulé de poste</label><input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold" value={formData.fonction || ''} onChange={e => setFormData({...formData, fonction: e.target.value})} /></div>
                        </div>
                        <div className="p-8 bg-slate-50 border-t flex justify-end gap-4"><button onClick={() => setShowUserModal(false)} className="px-6 py-3 font-black text-slate-400 uppercase text-[10px]">Annuler</button><button onClick={handleSaveUser} className="bg-pal-500 text-white px-10 py-3 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-pal-500/20">Valider Fiche</button></div>
                    </div>
                </div>
            )}

            {showNominationModal && (
                <div className="fixed inset-0 bg-pal-900/70 backdrop-blur-xl flex items-center justify-center z-[250] p-4">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                        <div className="bg-pal-500 p-8 text-white"><h3 className="text-xl font-black uppercase tracking-widest">Nommer un {showNominationModal.type === 'DIRECTEUR' ? 'Directeur' : 'Chef de Service'}</h3><p className="text-white/60 text-[9px] font-black uppercase italic mt-1">{showNominationModal.dept} {showNominationModal.service ? `> ${showNominationModal.service}` : ''}</p></div>
                        <div className="p-8 space-y-4">
                            <input type="text" placeholder="Chercher par nom..." className="w-full border-b border-slate-200 p-2 outline-none focus:border-pal-500 font-bold mb-4" value={assignmentSearch} onChange={e => setAssignmentSearch(e.target.value)} />
                            <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                                {users.filter(u => `${u.nom} ${u.prenom}`.toLowerCase().includes(assignmentSearch.toLowerCase())).slice(0, 10).map(u => (
                                    <button key={u.id} onClick={() => handleNominate(u.id)} className="w-full flex items-center justify-between p-4 hover:bg-pal-50 rounded-2xl transition border border-transparent hover:border-pal-100 text-left"><div><p className="font-bold text-slate-800 text-sm">{u.nom} {u.prenom}</p><p className="text-[9px] text-slate-400 font-bold uppercase truncate">{u.fonction} | {u.departement}</p></div><i className="fas fa-chevron-right text-slate-200 text-xs"></i></button>
                                ))}
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 text-right"><button onClick={() => setShowNominationModal(null)} className="px-6 py-2 text-[10px] font-black uppercase text-slate-400">Annuler</button></div>
                    </div>
                </div>
            )}

            {/* Modal: Définir un mot de passe */}
            {showSetPasswordModal && (
                <div className="fixed inset-0 bg-pal-900/70 backdrop-blur-xl flex items-center justify-center z-[300] p-4">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="bg-pal-500 p-8 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-widest">Définir le Mot de Passe</h3>
                                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-1 italic">{showSetPasswordModal.nom} {showSetPasswordModal.prenom}</p>
                            </div>
                            <button onClick={() => setShowSetPasswordModal(null)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><i className="fas fa-times"></i></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email</label>
                                <p className="text-sm font-bold text-slate-600">{showSetPasswordModal.email || 'Non défini'}</p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nouveau Mot de Passe</label>
                                <div className="relative">
                                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-mono font-bold text-sm pr-12" placeholder="Min. 6 caractères..." value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} />
                                    <button onClick={() => {
                                        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
                                        let gen = 'PAL_';
                                        for (let i = 0; i < 8; i++) gen += chars.charAt(Math.floor(Math.random() * chars.length));
                                        setNewPasswordInput(gen);
                                    }} className="absolute right-2 top-1/2 -translate-y-1/2 text-pal-500 hover:text-pal-600 transition p-2" title="Générer automatiquement">
                                        <i className="fas fa-magic"></i>
                                    </button>
                                </div>
                                <p className="text-[9px] text-slate-400 mt-2"><i className="fas fa-info-circle mr-1"></i> Ce mot de passe sera stocké et visible dans le panneau admin.</p>
                            </div>
                            {userPasswords[showSetPasswordModal.id] && (
                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                                    <p className="text-[10px] font-black text-amber-600 uppercase mb-1"><i className="fas fa-exclamation-triangle mr-1"></i> Mot de passe actuel</p>
                                    <code className="text-xs font-mono font-bold text-amber-700">{userPasswords[showSetPasswordModal.id].password}</code>
                                    <p className="text-[8px] text-amber-400 mt-1">Défini le {new Date(userPasswords[showSetPasswordModal.id].setAt).toLocaleString('fr-FR')}</p>
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 border-t flex justify-end gap-3">
                            <button onClick={() => setShowSetPasswordModal(null)} className="px-6 py-3 font-black text-slate-400 uppercase text-[10px]">Annuler</button>
                            <button onClick={() => handleSetPassword(showSetPasswordModal)} className="bg-pal-500 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-pal-500/20 hover:bg-pal-600 transition">
                                <i className="fas fa-save mr-2"></i>Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Confirmation de réinitialisation */}
            {resetConfirm && (() => {
                const targetUser = users.find(u => u.id === resetConfirm);
                if (!targetUser) return null;
                return (
                    <div className="fixed inset-0 bg-pal-900/70 backdrop-blur-xl flex items-center justify-center z-[300] p-4">
                        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                            <div className="p-10 text-center">
                                <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-[2rem] flex items-center justify-center text-3xl mx-auto mb-6 border border-amber-100">
                                    <i className="fas fa-redo"></i>
                                </div>
                                <h3 className="text-lg font-black text-slate-800 mb-2">Réinitialiser le mot de passe ?</h3>
                                <p className="text-sm text-slate-400 font-medium mb-2">{targetUser.nom} {targetUser.prenom}</p>
                                <p className="text-xs text-slate-400 italic">Un nouveau mot de passe temporaire sera généré automatiquement.</p>
                            </div>
                            <div className="p-6 bg-slate-50 border-t flex justify-center gap-4">
                                <button onClick={() => setResetConfirm(null)} className="px-8 py-3 font-black text-slate-400 uppercase text-[10px] hover:bg-slate-100 rounded-xl transition">Annuler</button>
                                <button onClick={() => handleResetPassword(targetUser)} className="bg-amber-500 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] shadow-lg hover:bg-amber-600 transition">
                                    <i className="fas fa-redo mr-2"></i>Confirmer
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
            
        </div>
    );
};

export default AdminDashboard;
