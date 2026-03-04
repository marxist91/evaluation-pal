
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/database';
import { User, Role, DEPARTEMENTS } from '../types';
import { useToast } from '../context/ToastContext';

const Team = ({ user }: { user: User }) => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    
    // States for List View (Chef de Service & Agents)
    const [team, setTeam] = useState<User[]>([]);
    
    // States for Structure View (DRH & Directeurs & Admin)
    const [structureData, setStructureData] = useState<any[]>([]); // Depts or Services
    const [loading, setLoading] = useState(true);
    
    // Modals States
    const [showAddModal, setShowAddModal] = useState(false); // Add Service
    const [showAddDeptModal, setShowAddDeptModal] = useState(false); // Add Dept (Admin)
    const [newServiceName, setNewServiceName] = useState("");
    const [newDeptName, setNewDeptName] = useState("");

    const fetchData = () => {
        setLoading(true);
        const isAdmin = user.role === Role.ADMIN;
        const isDRH = user.role === Role.DRH;

        if (isDRH || isAdmin) {
            // Vue globale : Liste des Départements + Directeur + Liste Services
            const depts = db.getDepartmentsList();
            const data = depts.map(deptName => {
                const director = db.getDirectorByDepartment(deptName);
                const services = db.getServicesByDepartment(deptName);
                return {
                    name: deptName,
                    manager: director,
                    subItems: services
                };
            });
            setStructureData(data);
        } else if (user.role === Role.DIRECTEUR) {
            // DIRECTEUR : Liste des Services de son département + Chef de Service
            const services = db.getServicesByDepartment(user.departement);
            const data = services.map(srvName => {
                const chef = db.getChefServiceByService(user.departement, srvName);
                return {
                    name: srvName,
                    manager: chef,
                    subItems: []
                };
            });
            setStructureData(data);
        } else {
            // CHEF SERVICE & AGENTS : Liste des personnes (Agents)
            const allUsers = db.getUsers();
            const myTeam = allUsers.filter(u => {
                if (u.id === user.id) return false;
                if (u.role !== Role.AGENT) return false;
                if (user.role === Role.CHEF_SERVICE) return u.service === user.service;
                return false;
            });
            setTeam(myTeam);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const handleAddService = () => {
        if (!newServiceName.trim()) return;
        db.addService(user.departement, newServiceName.trim());
        showToast(`Service "${newServiceName}" créé avec succès`, "success");
        setNewServiceName("");
        setShowAddModal(false);
        fetchData();
    };

    const handleAddDept = () => {
        if (!newDeptName.trim()) return;
        db.addDepartment(newDeptName.trim());
        showToast(`Direction "${newDeptName}" ajoutée avec succès`, "success");
        setNewDeptName("");
        setShowAddDeptModal(false);
        fetchData();
    };

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

    const handleNavigateDetail = (item: any) => {
        const isAdmin = user.role === Role.ADMIN;
        const isDRH = user.role === Role.DRH;

        if (isDRH || isAdmin) {
            navigate(`/team/department/${encodeURIComponent(item.name)}`);
        } else if (user.role === Role.DIRECTEUR) {
            navigate(`/team/service/${encodeURIComponent(user.departement)}/${encodeURIComponent(item.name)}`);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500"><i className="fas fa-spinner fa-spin mr-2"></i> Chargement de l'organigramme...</div>;

    if (user.role === Role.CHEF_SERVICE || user.role === Role.AGENT) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">
                    Mon Équipe <span className="text-sm font-normal text-gray-500">({user.service})</span>
                </h2>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Collaborateur</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Poste</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {team.map(member => (
                                <tr key={member.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 rounded-full bg-pal-100 flex items-center justify-center text-pal-700 font-bold mr-3 relative">
                                                {member.prenom[0]}
                                                {member.isEncadrant && (
                                                    <span className="absolute -bottom-1 -right-1 bg-yellow-400 border-2 border-white rounded-full w-4 h-4 flex items-center justify-center text-[8px]" title="Encadrant">
                                                        <i className="fas fa-crown text-white"></i>
                                                    </span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 flex items-center">
                                                    {member.nom} {member.prenom}
                                                    {member.isEncadrant && (
                                                        <span className="ml-2 bg-indigo-50 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded border border-indigo-200 uppercase font-bold">
                                                            {member.fonction.includes('Division') ? 'Chef Div.' : (member.fonction.includes('Section') ? 'Chef Sec.' : 'Encadrant')}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500">{member.matricule}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{member.fonction}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleAccessEvaluation(member.id)} className="text-pal-600 hover:text-pal-900 bg-pal-50 px-3 py-1 rounded transition">
                                            <i className="fas fa-eye mr-2"></i> Dossier
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {team.length === 0 && (
                                <tr><td colSpan={3} className="p-8 text-center text-gray-500">Aucun collaborateur trouvé dans ce service.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    const isGlobalView = user.role === Role.DRH || user.role === Role.ADMIN;
    
    return (
        <div className="space-y-6 animate-fade-in-up pb-20">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">
                    {isGlobalView ? "Organisation du Port" : `Ma Direction : ${user.departement}`}
                </h2>
                
                <div className="flex gap-2">
                    {user.role === Role.ADMIN && isGlobalView && (
                        <button onClick={() => setShowAddDeptModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded shadow-lg flex items-center text-xs font-black uppercase">
                            <i className="fas fa-plus-circle mr-2"></i> Nouvelle Direction
                        </button>
                    )}
                    {user.role === Role.DIRECTEUR && (
                        <button onClick={() => setShowAddModal(true)} className="bg-pal-600 hover:bg-pal-700 text-white px-4 py-2 rounded shadow flex items-center text-xs font-black uppercase">
                            <i className="fas fa-plus mr-2"></i> Nouveau Service
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {structureData.map((item, idx) => (
                    <div key={idx} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden flex flex-col hover:shadow-lg transition">
                        <div className={`p-4 border-b ${isGlobalView ? 'bg-pal-900 text-white' : 'bg-white border-pal-100'}`}>
                            <h3 className={`font-bold text-lg leading-tight ${isGlobalView ? 'text-white' : 'text-pal-800'}`}>
                                {isGlobalView ? <i className="fas fa-building mr-2 opacity-70"></i> : <i className="fas fa-network-wired mr-2 text-pal-500"></i>}
                                {item.name}
                            </h3>
                        </div>

                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${item.manager ? 'bg-white text-pal-700 shadow-sm' : 'bg-gray-200 text-gray-400'}`}>
                                <i className={`fas ${isGlobalView ? 'fa-user-tie' : 'fa-user-cog'}`}></i>
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">{isGlobalView ? "Directeur" : "Chef de Service"}</p>
                                {item.manager ? (
                                    <p className="text-sm font-bold text-gray-800 truncate">{item.manager.nom} {item.manager.prenom}</p>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">Poste vacant</p>
                                )}
                            </div>
                        </div>

                        {isGlobalView && (
                            <div className="p-4 flex-1 bg-white">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Services rattachés ({item.subItems.length})</p>
                                <div className="flex flex-wrap gap-2">
                                    {item.subItems.length > 0 ? (
                                        item.subItems.slice(0, 4).map((sub: string, i: number) => {
                                            const serviceAgents = db.getUsers().filter((u: User) => u.service === sub && u.departement === item.name);
                                            return (
                                                <div key={i} className="inline-block bg-pal-50 text-pal-700 text-[10px] font-bold px-2 py-1 rounded border border-pal-100 mr-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate max-w-[120px]">{sub}</span>
                                                        <select defaultValue="" className="ml-2 bg-white border border-slate-100 rounded px-2 py-0.5 text-xs" onChange={async (e) => {
                                                            const uid = e.target.value;
                                                            if (!uid) return;
                                                            const users = db.getUsers();
                                                            const selected = users.find(u => u.id === uid);
                                                            if (selected && selected.service && selected.service !== sub) {
                                                                const ok = window.confirm(`${selected.nom} ${selected.prenom} est déjà affecté au service \"${selected.service}\". Confirmer la réaffectation vers \"${sub}\" ?`);
                                                                if (!ok) { (e.target as HTMLSelectElement).value = ''; return; }
                                                            }
                                                            // perform update
                                                            const target = db.getUsers().find(u => u.id === uid);
                                                            if (target) {
                                                                await db.updateUser({ ...target, departement: item.name, service: sub });
                                                                showToast('Affectation réalisée', 'success');
                                                                fetchData();
                                                            }
                                                            (e.target as HTMLSelectElement).value = '';
                                                        }}>
                                                            <option value="">Affecter...</option>
                                                            {db.getUsers().filter((u: User) => [Role.AGENT, Role.CHEF_SERVICE, Role.DIRECTEUR].includes(u.role)).map(u => (
                                                                <option key={u.id} value={u.id}>{`${u.nom} ${u.prenom} — ${u.service ? u.service : 'Non affecté'}`}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <span className="text-[10px] text-gray-400 italic">Aucun service défini</span>
                                    )}
                                    {item.subItems.length > 4 && (
                                        <span className="inline-block bg-gray-100 text-gray-500 text-[10px] px-2 py-1 rounded">
                                            +{item.subItems.length - 4}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        <div className="p-3 bg-gray-50 border-t border-gray-100 text-right">
                            <button onClick={() => handleNavigateDetail(item)} className="text-xs font-black text-pal-600 hover:text-pal-800 uppercase flex items-center justify-end w-full">
                                Voir détails <i className="fas fa-chevron-right ml-2"></i>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* MODAL AJOUT DIRECTION (Admin) */}
            {showAddDeptModal && (
                <div className="fixed inset-0 bg-pal-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                        <div className="bg-emerald-600 p-6 text-white">
                            <h3 className="text-lg font-black uppercase tracking-widest">Nouvelle Direction</h3>
                        </div>
                        <div className="p-6">
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nom de la Direction</label>
                            <input type="text" autoFocus value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-700" placeholder="Ex: Direction de l'Innovation" />
                        </div>
                        <div className="p-4 bg-gray-50 text-right space-x-3">
                            <button onClick={() => setShowAddDeptModal(false)} className="px-4 py-2 text-xs font-black uppercase text-gray-400 hover:text-gray-600">Annuler</button>
                            <button onClick={handleAddDept} disabled={!newDeptName.trim()} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-black text-xs uppercase shadow-lg disabled:opacity-50">Ajouter</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL AJOUT SERVICE (Directeur) */}
            {showAddModal && (
                <div className="fixed inset-0 bg-pal-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                        <div className="bg-pal-600 p-6 text-white">
                            <h3 className="text-lg font-black uppercase tracking-widest">Nouveau Service</h3>
                        </div>
                        <div className="p-6">
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nom du Service</label>
                            <input type="text" autoFocus value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-pal-500 outline-none font-bold text-slate-700" placeholder="Ex: Maintenance Informatique" />
                        </div>
                        <div className="p-4 bg-gray-50 text-right space-x-3">
                            <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-black uppercase text-gray-400 hover:text-gray-600">Annuler</button>
                            <button onClick={handleAddService} disabled={!newServiceName.trim()} className="px-6 py-2 bg-pal-600 text-white rounded-lg hover:bg-pal-700 font-black text-xs uppercase shadow-lg disabled:opacity-50">Créer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Team;
