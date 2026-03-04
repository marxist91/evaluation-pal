
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/database';
import { User, Role } from '../types';
import { useToast } from '../context/ToastContext';

const ServiceDetail = ({ user }: { user: User }) => {
    const { deptName, serviceName } = useParams<{ deptName: string, serviceName: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const decodedDeptName = decodeURIComponent(deptName || '');
    const decodedServiceName = decodeURIComponent(serviceName || '');

    const [agents, setAgents] = useState<User[]>([]);
    const [chefService, setChefService] = useState<User | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    // Admin Add User State
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [formData, setFormData] = useState<Partial<User>>({});
    // Directeur: Assign existing user state
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedAssignUser, setSelectedAssignUser] = useState<string>("");
    // Chef assign
    const [showChefAssignModal, setShowChefAssignModal] = useState(false);
    const [selectedChefUser, setSelectedChefUser] = useState<string>("");

    const fetchData = () => {
        if (!decodedServiceName) return;

        // Récupérer le Chef de Service
        const chef = db.getChefServiceByService(decodedDeptName, decodedServiceName);
        setChefService(chef);

        // Récupérer les agents du service
        const allUsers = db.getUsers();
        const serviceAgents = allUsers.filter(u => 
            u.role === Role.AGENT && 
            u.service === decodedServiceName && 
            u.departement === decodedDeptName
        );
        setAgents(serviceAgents);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [decodedDeptName, decodedServiceName]);

    const handleAccessEvaluation = (agentId: string) => {
        const evals = db.getEvaluations();
        const currentYear = new Date().getFullYear();
        const targetEval = evals.find(e => e.agentId === agentId && e.annee === currentYear) || evals.find(e => e.agentId === agentId);
        
        if (targetEval) {
            navigate(`/evaluation/${targetEval.id}`);
        } else {
            showToast("Aucune évaluation en cours pour cet agent.", "warning");
        }
    };

    const handleBack = () => {
        if (user.role === Role.DRH) {
            navigate(`/team/department/${encodeURIComponent(decodedDeptName)}`);
        } else {
            navigate('/team');
        }
    };

    const handleOpenAddUser = () => {
        if (user.role === Role.DIRECTEUR) {
            setSelectedAssignUser("");
            setShowAssignModal(true);
            return;
        }

        setFormData({
            matricule: '',
            nom: '',
            prenom: '',
            email: '',
            fonction: '',
            role: Role.AGENT,
            // Pre-filled context
            departement: decodedDeptName,
            service: decodedServiceName,
            isEncadrant: false
        });
        setShowAddUserModal(true);
    };

    const handleAssignSubmit = async () => {
        if (!selectedAssignUser) {
            showToast('Veuillez sélectionner un utilisateur', 'error');
            return;
        }
        const users = db.getUsers();
        const selected = users.find(u => u.id === selectedAssignUser);
        if (!selected) return;

        if (selected.service && selected.service !== decodedServiceName) {
            const ok = window.confirm(`${selected.nom} ${selected.prenom} est déjà affecté au service "${selected.service}". Confirmer la réaffectation vers "${decodedServiceName}" ?`);
            if (!ok) return;
        }

        await db.updateUser({ ...selected, departement: decodedDeptName, service: decodedServiceName });
        showToast('Affectation réalisée', 'success');
        setShowAssignModal(false);
        fetchData();
    };

    const handleSaveUser = async () => {
        if (!formData.nom || !formData.matricule || !formData.email) {
            showToast("Champs obligatoires manquants", "error");
            return;
        }

        const newUser: User = {
            id: `u_${Date.now()}`,
            matricule: formData.matricule!,
            email: formData.email!,
            nom: formData.nom!.toUpperCase(),
            prenom: formData.prenom || "",
            role: formData.role || Role.AGENT,
            departement: decodedDeptName,
            service: decodedServiceName,
            fonction: formData.fonction || "Agent",
            categorie: "IV",
            isEncadrant: formData.isEncadrant || false,
            dateEntree: new Date().toISOString().split('T')[0]
        };

        await db.addUser(newUser);
        showToast("Collaborateur ajouté avec succès", "success");
        setShowAddUserModal(false);
        fetchData();
    };

    if (loading) return <div className="p-8 text-center text-gray-500"><i className="fas fa-spinner fa-spin mr-2"></i> Chargement...</div>;

    return (
        <div className="space-y-6 animate-fade-in-up">
            <button onClick={handleBack} className="flex items-center text-gray-500 hover:text-pal-700 transition mb-4">
                <i className="fas fa-arrow-left mr-2"></i> Retour
            </button>

            <div className="bg-white p-6 rounded-[2rem] shadow-xl border-l-8 border-pal-500 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                        <i className="fas fa-users mr-3 text-pal-500"></i>
                        Service : {decodedServiceName}
                    </h2>
                    <p className="text-gray-500 mt-1 ml-9 font-medium">Département : <span className="font-bold text-pal-700">{decodedDeptName}</span></p>
                </div>
                <div className="mt-4 md:mt-0 flex items-center bg-pal-50 px-5 py-3 rounded-2xl border border-pal-100 shadow-sm relative z-10">
                     <div className="w-12 h-12 rounded-full bg-white text-pal-500 flex items-center justify-center font-bold mr-4 text-xl shadow-md">
                        <i className="fas fa-user-cog"></i>
                     </div>
                     <div>
                         <div className="text-[10px] text-pal-400 uppercase font-black tracking-widest">Chef de Service</div>
                         <div className="font-bold text-gray-800 text-sm">{chefService ? `${chefService.nom} ${chefService.prenom}` : 'Non assigné'}</div>
                     </div>
                     {(user.role === Role.ADMIN || user.role === Role.DIRECTEUR) && (
                         <div className="ml-4">
                             <button onClick={() => { setSelectedChefUser(chefService ? chefService.id : ''); setShowChefAssignModal(true); }} className="text-xs px-3 py-1 bg-pal-600 text-white rounded-lg hover:bg-pal-700 transition">
                                 Affecter
                             </button>
                         </div>
                     )}
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
                <div className="px-8 py-6 border-b border-gray-100 bg-white flex justify-between items-center">
                    <h3 className="font-black text-gray-800 uppercase tracking-tight">Liste du personnel ({agents.length})</h3>
                    {user.role === Role.ADMIN && (
                        <button 
                            onClick={handleOpenAddUser}
                            className="bg-pal-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-pal-600 transition flex items-center gap-2"
                        >
                            <i className="fas fa-user-plus"></i> Ajouter un Agent
                        </button>
                    )}

                    {user.role === Role.DIRECTEUR && (
                        <button 
                            onClick={() => { setSelectedAssignUser(''); setShowAssignModal(true); }}
                            className="bg-pal-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-pal-600 transition flex items-center gap-2"
                        >
                            <i className="fas fa-user-plus"></i> Affecter du personnel
                        </button>
                    )}
                </div>
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Collaborateur</th>
                            <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Poste</th>
                            <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                        {agents.map(member => (
                            <tr key={member.id} className="hover:bg-pal-50/30 transition group">
                                <td className="px-8 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="h-10 w-10 rounded-xl bg-pal-100 flex items-center justify-center text-pal-700 font-bold mr-4 relative shadow-sm">
                                            {member.prenom[0]}
                                            {member.isEncadrant && (
                                                <span className="absolute -bottom-1 -right-1 bg-yellow-400 border-2 border-white rounded-full w-4 h-4 flex items-center justify-center text-[8px]" title="Encadrant">
                                                    <i className="fas fa-crown text-white"></i>
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-900 flex items-center">
                                                {member.nom} {member.prenom}
                                                {member.isEncadrant && (
                                                    <span className="ml-2 bg-indigo-50 text-indigo-700 text-[9px] px-2 py-0.5 rounded-lg border border-indigo-100 uppercase font-black tracking-tighter">
                                                        {member.fonction.includes('Division') ? 'Chef Div.' : (member.fonction.includes('Section') ? 'Chef Sec.' : 'Encadrant')}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] font-mono text-gray-400 uppercase">{member.matricule}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-4 whitespace-nowrap text-xs font-bold text-gray-500 uppercase">{member.fonction}</td>
                                <td className="px-8 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button 
                                        onClick={() => handleAccessEvaluation(member.id)}
                                        className="text-pal-500 hover:text-white bg-pal-50 hover:bg-pal-500 border border-pal-100 hover:border-pal-500 px-4 py-2 rounded-xl transition text-[10px] font-black uppercase shadow-sm"
                                    >
                                        <i className="fas fa-folder-open mr-2"></i> Dossier
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {agents.length === 0 && (
                            <tr><td colSpan={3} className="p-12 text-center text-gray-400 italic font-medium">Aucun agent trouvé dans ce service.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL AJOUT UTILISATEUR (ADMIN) */}
            {showAddUserModal && (
                <div className="fixed inset-0 bg-pal-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                        <div className="bg-pal-500 p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-widest">Nouveau Collaborateur</h3>
                                <p className="text-pal-200 text-[10px] mt-1 font-medium">Affectation directe : {decodedServiceName}</p>
                            </div>
                            <button onClick={() => setShowAddUserModal(false)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"><i className="fas fa-times"></i></button>
                        </div>
                        
                        <div className="p-8 grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <div className="col-span-1">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Matricule</label>
                                <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm" value={formData.matricule} onChange={e => setFormData({...formData, matricule: e.target.value})} placeholder="Mle..." />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Rôle</label>
                                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as Role})}>
                                    <option value={Role.AGENT}>Agent</option>
                                    <option value={Role.CHEF_SERVICE}>Chef de Service</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Email</label>
                                <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@pal.tg" />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nom</label>
                                <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm uppercase" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Prénom</label>
                                <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm" value={formData.prenom} onChange={e => setFormData({...formData, prenom: e.target.value})} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Fonction</label>
                                <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm" value={formData.fonction} onChange={e => setFormData({...formData, fonction: e.target.value})} placeholder="Intitulé du poste" />
                            </div>
                            
                            <div className="col-span-2 mt-2">
                                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl bg-slate-50 cursor-pointer hover:bg-white hover:border-pal-300 transition">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.isEncadrant} 
                                        onChange={e => setFormData({...formData, isEncadrant: e.target.checked})}
                                        className="w-5 h-5 text-pal-500 rounded focus:ring-pal-500" 
                                    />
                                    <div>
                                        <span className="block text-xs font-bold text-slate-700">Encadrant (Chef Division/Section)</span>
                                        <span className="block text-[9px] text-slate-400">Active le critère de gestion d'équipe dans l'évaluation</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setShowAddUserModal(false)} className="px-6 py-3 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-slate-200 transition">Annuler</button>
                            <button onClick={handleSaveUser} className="px-8 py-3 rounded-xl bg-pal-500 text-white text-[10px] font-black uppercase shadow-lg hover:bg-pal-600 hover:scale-105 transition">Confirmer l'ajout</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL AFFECTATION (DIRECTEUR) */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-pal-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="bg-pal-500 p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-widest">Affecter du personnel</h3>
                                <p className="text-pal-200 text-[10px] mt-1 font-medium">Affectation directe : {decodedServiceName}</p>
                            </div>
                            <button onClick={() => setShowAssignModal(false)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"><i className="fas fa-times"></i></button>
                        </div>

                        <div className="p-6">
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Sélectionner un utilisateur</label>
                            <select value={selectedAssignUser} onChange={e => setSelectedAssignUser(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm">
                                <option value="">-- Choisir --</option>
                                {db.getUsers().filter((u: User) => [Role.AGENT, Role.CHEF_SERVICE, Role.DIRECTEUR].includes(u.role)).map(u => (
                                    <option key={u.id} value={u.id}>{`${u.nom} ${u.prenom} — ${u.service ? u.service : 'Non affecté'}`}</option>
                                ))}
                            </select>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setShowAssignModal(false)} className="px-6 py-3 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-slate-200 transition">Annuler</button>
                            <button onClick={handleAssignSubmit} className="px-8 py-3 rounded-xl bg-pal-500 text-white text-[10px] font-black uppercase shadow-lg hover:bg-pal-600 hover:scale-105 transition">Affecter</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL AFFECTATION CHEF DE SERVICE */}
            {showChefAssignModal && (
                <div className="fixed inset-0 bg-pal-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="bg-pal-500 p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-widest">Affecter un Chef de Service</h3>
                                <p className="text-pal-200 text-[10px] mt-1 font-medium">Affectation directe : {decodedServiceName}</p>
                            </div>
                            <button onClick={() => setShowChefAssignModal(false)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"><i className="fas fa-times"></i></button>
                        </div>

                        <div className="p-6">
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Sélectionner un utilisateur</label>
                            <select value={selectedChefUser} onChange={e => setSelectedChefUser(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm">
                                <option value="">-- Choisir --</option>
                                {db.getUsers().filter((u: User) => [Role.AGENT, Role.CHEF_SERVICE].includes(u.role) || u.role === Role.DIRECTEUR).map(u => (
                                    <option key={u.id} value={u.id}>{`${u.nom} ${u.prenom} — ${u.service ? u.service : 'Non affecté'}`}</option>
                                ))}
                            </select>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setShowChefAssignModal(false)} className="px-6 py-3 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-slate-200 transition">Annuler</button>
                            <button onClick={async () => {
                                if (!selectedChefUser) { showToast('Veuillez sélectionner un utilisateur', 'error'); return; }
                                const users = db.getUsers();
                                const selected = users.find(u => u.id === selectedChefUser);
                                if (!selected) return;

                                // Demote previous chef if exists
                                if (chefService && chefService.id !== selected.id) {
                                    await db.updateUser({ ...chefService, role: Role.AGENT, isEncadrant: false });
                                }

                                // Promote selected to Chef de Service
                                await db.updateUser({ ...selected, role: Role.CHEF_SERVICE, departement: decodedDeptName, service: decodedServiceName, isEncadrant: true });
                                showToast('Chef de Service affecté', 'success');
                                setShowChefAssignModal(false);
                                fetchData();
                            }} className="px-8 py-3 rounded-xl bg-pal-500 text-white text-[10px] font-black uppercase shadow-lg hover:bg-pal-600 hover:scale-105 transition">Affecter</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServiceDetail;
