
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/database';
import { User, Role } from '../types';
import { useToast } from '../context/ToastContext';

const DepartmentDetail = ({ user }: { user: User }) => {
    const { deptName } = useParams<{ deptName: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const decodedDeptName = decodeURIComponent(deptName || '');

    const [servicesData, setServicesData] = useState<any[]>([]);
    const [director, setDirector] = useState<User | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    // Admin Add Service State
    const [showAddServiceModal, setShowAddServiceModal] = useState(false);
    const [newServiceName, setNewServiceName] = useState("");

    const fetchData = () => {
        if (!decodedDeptName) return;

        // Récupérer le Directeur du département
        const dir = db.getDirectorByDepartment(decodedDeptName);
        setDirector(dir);

        // Récupérer les services du département
        const services = db.getServicesByDepartment(decodedDeptName);
        
        // Construire les données pour l'affichage (similaire à la vue Directeur)
        const data = services.map(srvName => {
            const chef = db.getChefServiceByService(decodedDeptName, srvName);
            return {
                name: srvName,
                manager: chef,
                agentCount: db.getUsers().filter(u => u.role === Role.AGENT && u.service === srvName && u.departement === decodedDeptName).length
            };
        });

        setServicesData(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [decodedDeptName]);

    const handleNavigateService = (serviceName: string) => {
        navigate(`/team/service/${encodeURIComponent(decodedDeptName)}/${encodeURIComponent(serviceName)}`);
    };

    const handleAddService = () => {
        if (!newServiceName.trim()) {
            showToast("Le nom du service est requis", "error");
            return;
        }
        db.addService(decodedDeptName, newServiceName.trim());
        showToast(`Service "${newServiceName}" ajouté à ${decodedDeptName}`, "success");
        setNewServiceName("");
        setShowAddServiceModal(false);
        fetchData();
    };

    if (loading) return <div className="p-8 text-center text-gray-500"><i className="fas fa-spinner fa-spin mr-2"></i> Chargement...</div>;

    return (
        <div className="space-y-6 animate-fade-in-up">
            <button onClick={() => navigate('/team')} className="flex items-center text-gray-500 hover:text-pal-700 transition mb-4">
                <i className="fas fa-arrow-left mr-2"></i> Retour à l'organisation
            </button>

            <div className="bg-pal-900 text-white p-6 rounded-lg shadow-lg mb-8 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <i className="fas fa-building text-9xl"></i>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center">
                            <i className="fas fa-building mr-3 text-pal-300"></i>
                            {decodedDeptName}
                        </h2>
                        <p className="text-pal-200 mt-1 ml-9">Vue détaillée des services</p>
                    </div>
                    <div className="mt-4 md:mt-0 bg-pal-800 p-3 rounded-lg border border-pal-700 flex items-center shadow-lg">
                         <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-pal-900 font-bold mr-3 border-2 border-pal-300">
                            <i className="fas fa-user-tie"></i>
                         </div>
                         <div>
                             <div className="text-[10px] text-pal-300 uppercase font-black tracking-widest">Directeur</div>
                             <div className="font-bold text-sm">{director ? `${director.nom} ${director.prenom}` : 'Poste Vacant'}</div>
                         </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h3 className="text-xl font-bold text-gray-800">Services ({servicesData.length})</h3>
                {user.role === Role.ADMIN && (
                    <button 
                        onClick={() => setShowAddServiceModal(true)}
                        className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase shadow hover:bg-emerald-600 transition flex items-center gap-2"
                    >
                        <i className="fas fa-plus"></i> Ajouter un Service
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {servicesData.map((item, idx) => (
                    <div key={idx} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden flex flex-col hover:shadow-lg transition group">
                        <div className="p-4 border-b border-pal-100 bg-white group-hover:bg-pal-50 transition">
                            <h3 className="font-bold text-lg leading-tight text-pal-800 flex items-center">
                                <i className="fas fa-network-wired mr-2 text-pal-500"></i>
                                {item.name}
                            </h3>
                        </div>

                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${item.manager ? 'bg-white text-pal-700 shadow-sm' : 'bg-gray-200 text-gray-400'}`}>
                                <i className="fas fa-user-cog"></i>
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Chef de Service</p>
                                {item.manager ? (
                                    <p className="text-sm font-bold text-gray-800 truncate">{item.manager.nom} {item.manager.prenom}</p>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">Poste vacant</p>
                                )}
                            </div>
                            {user.role === Role.DIRECTEUR && (
                                <div className="ml-auto">
                                    <select defaultValue="" className="ml-2 bg-white border border-slate-100 rounded px-2 py-1 text-xs" onChange={async (e) => {
                                        const uid = (e.target as HTMLSelectElement).value;
                                        if (!uid) return;
                                        const users = db.getUsers();
                                        const selected = users.find(u => u.id === uid);
                                        if (selected && selected.service && selected.service !== item.name) {
                                            const ok = window.confirm(`${selected.nom} ${selected.prenom} est déjà affecté au service "${selected.service}". Confirmer la réaffectation vers "${item.name}" ?`);
                                            if (!ok) { (e.target as HTMLSelectElement).value = ''; return; }
                                        }
                                        const target = db.getUsers().find(u => u.id === uid);
                                        if (target) {
                                            await db.updateUser({ ...target, departement: decodedDeptName, service: item.name });
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
                            )}
                        </div>
                        
                        <div className="p-4 flex-1 bg-white flex items-center justify-between text-sm text-gray-600">
                             <span>Effectif Agents</span>
                             <span className="font-bold bg-gray-100 px-2 py-1 rounded">{item.agentCount}</span>
                        </div>

                        <div className="p-3 bg-gray-50 border-t border-gray-100 text-right">
                            <button 
                                onClick={() => handleNavigateService(item.name)}
                                className="text-xs font-bold text-pal-600 hover:text-pal-800 uppercase"
                            >
                                Voir le personnel <i className="fas fa-users ml-1"></i>
                            </button>
                        </div>
                    </div>
                ))}
                {servicesData.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-400 bg-gray-50 rounded border-2 border-dashed">
                        Aucun service configuré pour ce département.
                    </div>
                )}
            </div>

            {/* MODAL AJOUT SERVICE (ADMIN) */}
            {showAddServiceModal && (
                <div className="fixed inset-0 bg-pal-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                        <div className="bg-emerald-600 p-6 text-white">
                            <h3 className="text-lg font-black uppercase tracking-widest">Nouveau Service</h3>
                            <p className="text-emerald-100 text-xs mt-1">Ajout dans : <span className="font-bold text-white">{decodedDeptName}</span></p>
                        </div>
                        <div className="p-6">
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nom du Service</label>
                            <input 
                                type="text" 
                                autoFocus
                                value={newServiceName}
                                onChange={(e) => setNewServiceName(e.target.value)}
                                className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-700"
                                placeholder="Ex: Maintenance Informatique"
                            />
                        </div>
                        <div className="p-4 bg-gray-50 text-right space-x-3">
                            <button 
                                onClick={() => setShowAddServiceModal(false)}
                                className="px-4 py-2 text-xs font-black uppercase text-gray-400 hover:text-gray-600"
                            >
                                Annuler
                            </button>
                            <button 
                                onClick={handleAddService}
                                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-black text-xs uppercase shadow-lg"
                            >
                                Créer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DepartmentDetail;
