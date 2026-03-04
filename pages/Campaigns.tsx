
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/database';
import { Campaign, Role, Evaluation, EvaluationStatus, Notification, User } from '../types';
import { useToast } from '../context/ToastContext';

// MODAL DE CONFIRMATION PERSONNALISÉE
interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    type: 'DELETE' | 'RESET' | 'INFO';
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, type, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    const isDanger = type === 'DELETE' || type === 'RESET';
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-fade-in-up">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
                <div className={`p-6 ${isDanger ? 'bg-red-50' : 'bg-blue-50'} border-b ${isDanger ? 'border-red-100' : 'border-blue-100'} flex items-center gap-4`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-sm ${isDanger ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        <i className={`fas ${type === 'DELETE' ? 'fa-trash-alt' : type === 'RESET' ? 'fa-sync-alt' : 'fa-info'}`}></i>
                    </div>
                    <div>
                        <h3 className={`text-lg font-black uppercase tracking-tight ${isDanger ? 'text-red-800' : 'text-blue-800'}`}>{title}</h3>
                    </div>
                </div>
                <div className="p-6">
                    <p className="text-gray-600 font-medium leading-relaxed whitespace-pre-line">{message}</p>
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-3">
                    <button 
                        onClick={onCancel}
                        className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={onConfirm}
                        className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-lg transform active:scale-95 transition ${isDanger ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        Confirmer
                    </button>
                </div>
            </div>
        </div>
    );
};

const Campaigns = ({ user }: { user: User }) => {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const { showToast } = useToast();
    
    // Custom Confirm Modal State
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        type: 'DELETE' | 'RESET' | 'INFO';
        title: string;
        message: string;
        targetCampaign: Campaign | null;
    }>({
        isOpen: false,
        type: 'INFO',
        title: '',
        message: '',
        targetCampaign: null
    });
    
    // Filters State
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [yearFilter, setYearFilter] = useState<string>('ALL');
    
    // Form State
    const [newYear, setNewYear] = useState(new Date().getFullYear());
    const [title, setTitle] = useState(`Campagne d'évaluation ${new Date().getFullYear()}`);
    const [targetPopulation, setTargetPopulation] = useState<'AGENTS' | 'ALL'>('AGENTS');

    useEffect(() => {
        setCampaigns(db.getCampaigns());
    }, []);

    const availableYears = useMemo(() => {
        return Array.from(new Set(campaigns.map(c => c.annee))).sort((a: number, b: number) => b - a);
    }, [campaigns]);

    const filteredCampaigns = useMemo(() => {
        return campaigns.filter(c => {
            const matchStatus = statusFilter === 'ALL' || c.statut === statusFilter;
            const matchYear = yearFilter === 'ALL' || c.annee === parseInt(yearFilter);
            return matchStatus && matchYear;
        });
    }, [campaigns, statusFilter, yearFilter]);

    const handleLaunch = async () => {
        // SECURITY CHECK: Empêcher les doublons d'année
        if (campaigns.some(c => c.annee === newYear)) {
            showToast(`ERREUR: Une campagne existe déjà pour l'année ${newYear}.`, 'error');
            return;
        }

        // 1. Préparer les données
        const users = db.getUsers();
        
        // Sélection des utilisateurs éligibles selon le choix
        const eligibleUsers = users.filter(u => {
            if (u.role === Role.ADMIN) return false; // Exclure l'admin système
            if (targetPopulation === 'AGENTS') return u.role === Role.AGENT;
            return true; // 'ALL' inclut tout le monde sauf admin
        });
        
        const existingEvals = db.getEvaluations();
        const newEvals: Evaluation[] = [];
        const newNotifs: Notification[] = [];

        eligibleUsers.forEach(agent => {
            const exists = existingEvals.some(e => e.agentId === agent.id && e.annee === newYear);
            if (!exists) {
                const evalId = `eval_${newYear}_${agent.id}`;
                newEvals.push({
                    id: evalId,
                    agentId: agent.id,
                    annee: newYear,
                    statut: EvaluationStatus.BROUILLON,
                    notes: [],
                    noteGlobale: 0,
                    validations: []
                });
                newNotifs.push({
                    id: `notif_c_${Date.now()}_${agent.id}`,
                    userId: agent.id,
                    message: `Lancement: ${title}. Veuillez compléter votre fiche.`,
                    date: new Date().toISOString(),
                    read: false,
                    type: 'ACTION',
                    linkToEvalId: evalId
                });
            }
        });

        // 2. Créer la Campagne avec le bon compte
        // IMPORTANT: On utilise newEvals.length ici pour s'assurer que le compteur n'est pas 0
        const newCampaign: Campaign = {
            id: `camp_${Date.now()}`,
            annee: newYear,
            titre: title,
            dateLancement: new Date().toISOString(),
            statut: 'ACTIVE',
            totalEvaluations: newEvals.length, 
            targetRole: targetPopulation === 'ALL' ? 'ALL' : Role.AGENT
        };
        
        try {
            await db.createCampaign(newCampaign);
            await db.createEvaluations(newEvals);
            for (const n of newNotifs) {
                await db.addNotification(n);
            }
        } catch (error) {
            console.error('Erreur création campagne / notifications:', error);
            showToast("Erreur lors de la création ou de la notification.", "error");
            return;
        }

        // Update local state
        setCampaigns([...db.getCampaigns()]); // Force new array ref
        setShowCreateModal(false);
        showToast(`Campagne lancée avec succès ! ${newEvals.length} fiches générées.`, 'success', 5000);
    };

    // --- HANDLERS D'OUVERTURE DE MODALE ---

    const openDeleteModal = (campaign: Campaign) => {
        setConfirmState({
            isOpen: true,
            type: 'DELETE',
            targetCampaign: campaign,
            title: 'Suppression Définitive',
            message: `ATTENTION: Vous êtes sur le point de supprimer la campagne "${campaign.titre}".\n\nCela effacera DÉFINITIVEMENT toutes les évaluations, notes et validations associées à l'année ${campaign.annee}.\n\nCette action est irréversible.`
        });
    };

    const openResetModal = (campaign: Campaign) => {
        setConfirmState({
            isOpen: true,
            type: 'RESET',
            targetCampaign: campaign,
            title: 'Réinitialisation Campagne',
            message: `RÉINITIALISATION: Vous allez supprimer toutes les évaluations existantes de "${campaign.titre}" et les régénérer pour le personnel actuel.\n\nLes données déjà saisies par les agents seront PERDUES.\n\nSouhaitez-vous continuer ?`
        });
    };

    // --- EXECUTION REELLE ---

    const executeConfirmAction = async () => {
        const { type, targetCampaign } = confirmState;
        if (!targetCampaign) return;

        if (type === 'DELETE') {
            await db.deleteCampaign(targetCampaign.id);
            setCampaigns([...db.getCampaigns()]); // Force refresh
            showToast(`Campagne "${targetCampaign.titre}" supprimée.`, 'warning');
        } else if (type === 'RESET') {
            const count = await db.resetCampaign(targetCampaign.id);
            setCampaigns([...db.getCampaigns()]); // Force refresh
            showToast(`Campagne réinitialisée. ${count} fiches ont été régénérées.`, 'success');
        }

        // Close modal
        setConfirmState({ ...confirmState, isOpen: false });
    };

    const canManage = user.role === Role.DRH || user.role === Role.ADMIN;

    return (
        <div className="space-y-6 animate-fade-in-up pb-20">
            
            {/* MODALE DE CONFIRMATION (REMPLACE WINDOW.CONFIRM) */}
            <ConfirmModal 
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                type={confirmState.type}
                onConfirm={executeConfirmAction}
                onCancel={() => setConfirmState({ ...confirmState, isOpen: false })}
            />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800">Gestion des Campagnes</h2>
                <button 
                    onClick={() => setShowCreateModal(true)} 
                    className="bg-pal-600 hover:bg-pal-700 text-white px-4 py-2 rounded shadow flex items-center whitespace-nowrap"
                >
                    <i className="fas fa-plus mr-2"></i> Nouvelle Campagne
                </button>
            </div>

            {/* FILTRES */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Statut de la campagne</label>
                    <div className="relative">
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-300 text-gray-700 py-2 px-3 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-pal-500 text-sm font-medium"
                        >
                            <option value="ALL">Tous les statuts</option>
                            <option value="ACTIVE">Active</option>
                            <option value="CLOTUREE">Clôturée</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <i className="fas fa-filter text-xs"></i>
                        </div>
                    </div>
                </div>

                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Année</label>
                    <div className="relative">
                        <select 
                            value={yearFilter}
                            onChange={(e) => setYearFilter(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-300 text-gray-700 py-2 px-3 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-pal-500 text-sm font-medium"
                        >
                            <option value="ALL">Toutes les années</option>
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <i className="fas fa-calendar-alt text-xs"></i>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de création */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md animate-fade-in-up">
                        <h3 className="text-xl font-bold mb-4 border-b pb-2">Lancer une campagne</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Année</label>
                                <input type="number" value={newYear} onChange={e => setNewYear(parseInt(e.target.value))} className="w-full border rounded p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded p-2" />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Population Cible</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        type="button"
                                        onClick={() => setTargetPopulation('AGENTS')}
                                        className={`p-2 rounded border text-sm font-medium ${targetPopulation === 'AGENTS' ? 'bg-pal-600 text-white border-pal-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                                    >
                                        <i className="fas fa-users mr-1"></i> Agents Uniquement
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setTargetPopulation('ALL')}
                                        className={`p-2 rounded border text-sm font-medium ${targetPopulation === 'ALL' ? 'bg-pal-600 text-white border-pal-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                                    >
                                        <i className="fas fa-building mr-1"></i> Tout le personnel
                                    </button>
                                </div>
                            </div>

                            <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 border border-blue-200">
                                <i className="fas fa-info-circle mr-2"></i>
                                {targetPopulation === 'AGENTS' ? (
                                    <span>Concerne : Agents, Chefs de Division et Chefs de Section.</span>
                                ) : (
                                    <span>Concerne : <strong>TOUS</strong> les collaborateurs (y compris Directeurs et DRH).</span>
                                )}
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700 px-4 py-2">Annuler</button>
                                <button onClick={handleLaunch} className="bg-pal-600 text-white px-4 py-2 rounded hover:bg-pal-700 font-bold">Confirmer</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Liste des campagnes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCampaigns.map(camp => (
                  <div key={camp.id} className={`bg-white p-6 rounded-lg shadow border-l-4 ${camp.statut === 'ACTIVE' ? 'border-pal-500' : 'border-gray-400'} relative overflow-hidden transition hover:shadow-md group flex flex-col justify-between min-h-[220px]`}>
                     <div>
                         <div className="absolute right-4 top-4 text-pal-100 opacity-20 text-6xl font-bold">{camp.annee}</div>
                         <div className="flex justify-between items-start mb-2 relative z-10">
                            <h3 className="text-xl font-bold text-gray-800 truncate pr-8" title={camp.titre}>{camp.titre}</h3>
                         </div>
                         <div className="mb-2 relative z-10">
                            <span className={`text-xs px-2 py-1 rounded font-bold uppercase whitespace-nowrap ${camp.targetRole === 'ALL' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                {camp.targetRole === 'ALL' ? 'Global' : 'Agents'}
                            </span>
                         </div>
                         <p className="text-xs text-gray-500 mb-4 relative z-10">Lancée le {new Date(camp.dateLancement).toLocaleDateString()}</p>
                     </div>
                     
                     {/* Boutons d'action toujours visibles mais stylisés */}
                     {canManage && (
                         <div className="flex justify-end gap-2 mb-4 relative z-20">
                             <button 
                                 onClick={(e) => { e.stopPropagation(); openResetModal(camp); }}
                                 className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 px-3 py-2 rounded-lg transition shadow-sm"
                                 title="Réinitialiser les évaluations (Recréer)"
                             >
                                 <i className="fas fa-sync-alt"></i> Réinitialiser
                             </button>
                             <button 
                                 onClick={(e) => { e.stopPropagation(); openDeleteModal(camp); }}
                                 className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 px-3 py-2 rounded-lg transition shadow-sm"
                                 title="Supprimer définitivement la campagne"
                             >
                                 <i className="fas fa-trash-alt"></i> Supprimer
                             </button>
                         </div>
                     )}

                     <div className="flex justify-between items-end relative z-10 border-t pt-3 border-gray-100">
                       <div>
                           <span className={`text-3xl font-bold ${camp.statut === 'ACTIVE' ? 'text-pal-700' : 'text-gray-500'}`}>{camp.totalEvaluations || 0}</span>
                           <span className="text-sm text-gray-500 block">Évaluations</span>
                       </div>
                       <span className={`px-2 py-1 rounded text-xs font-bold ${camp.statut === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{camp.statut}</span>
                     </div>
                  </div>
                ))}
                {filteredCampaigns.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-gray-50 rounded border-2 border-dashed border-gray-200 text-gray-400">
                        <i className="fas fa-folder-open text-4xl mb-3"></i>
                        <p>Aucune campagne ne correspond aux critères.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Campaigns;
