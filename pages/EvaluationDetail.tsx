
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/database';
import { User, Evaluation, EvaluationStatus, Note, PlanActions, Role, ValidationStep } from '../types';
import EvaluationForm, { OFFICIAL_FORM_STRUCTURE } from '../components/EvaluationForm';
import { useToast } from '../context/ToastContext';
import { Radar, Bar } from 'react-chartjs-2';

const EvaluationDetail = ({ currentUser }: { currentUser: User }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast(); 
    const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
    const [targetAgent, setTargetAgent] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Données pour l'analyse
    const [allScopeEvaluations, setAllScopeEvaluations] = useState<Evaluation[]>([]);
    const [scopeAverageData, setScopeAverageData] = useState<number[]>([]);

    useEffect(() => {
        if (id) {
            const ev = db.getEvaluations().find(e => e.id === id);
            if (ev) {
                setEvaluation(ev);
                const agent = db.getUserById(ev.agentId);
                setTargetAgent(agent || null);
            }
        }
        setLoading(false);
    }, [id]);

    // CALCUL DES DONNÉES COMPARATIVES
    useEffect(() => {
        if (evaluation && targetAgent) {
            const allUsers = db.getUsers();
            const allEvals = db.getEvaluations();
            
            const scope = currentUser.role === Role.CHEF_SERVICE ? 'SERVICE' : 'DEPARTEMENT';
            
            const scopeEvals = allEvals.filter(e => {
                if (e.annee !== evaluation.annee) return false;
                const ag = allUsers.find(u => u.id === e.agentId);
                if (!ag) return false;
                
                if (scope === 'SERVICE') return ag.service === targetAgent.service;
                return ag.departement === targetAgent.departement;
            });
            
            setAllScopeEvaluations(scopeEvals);

            const radarGroups = OFFICIAL_FORM_STRUCTURE.filter(g => !g.isManagerOnly); 
            
            const avgs = radarGroups.map(group => {
                const scores = scopeEvals.map(e => {
                     const subIds = group.subCriteres.map(s => s.id);
                     const groupNotes = e.notes?.filter(n => subIds.includes(n.critereId)) || [];
                     const sum = groupNotes.reduce((acc, curr) => acc + curr.valeur, 0);
                     const maxRaw = group.subCriteres.length * 6;
                     return maxRaw > 0 ? (sum / maxRaw) * group.maxScore : 0;
                });
                const total = scores.reduce((a, b) => a + b, 0);
                return scores.length > 0 ? parseFloat((total / scores.length).toFixed(2)) : 0;
            });
            
            setScopeAverageData(avgs);
        }
    }, [evaluation, targetAgent, currentUser.role]);

    // CHARTS CONFIGURATION
    const radarData = useMemo(() => {
        if (!evaluation || scopeAverageData.length === 0) return null;

        const radarGroups = OFFICIAL_FORM_STRUCTURE.filter(g => !g.isManagerOnly);
        const labels = radarGroups.map(g => g.label.split('.')[1] || g.label.substring(0, 15) + '...');
        
        const agentScores = radarGroups.map(group => {
            const subIds = group.subCriteres.map(s => s.id);
            const groupNotes = evaluation.notes?.filter(n => subIds.includes(n.critereId)) || [];
            const sum = groupNotes.reduce((acc, curr) => acc + curr.valeur, 0);
            const maxRaw = group.subCriteres.length * 6;
            return maxRaw > 0 ? (sum / maxRaw) * group.maxScore : 0;
        });

        return {
            labels,
            datasets: [
                {
                    label: 'Agent',
                    data: agentScores,
                    backgroundColor: 'rgba(14, 165, 233, 0.2)',
                    borderColor: '#0ea5e9',
                    pointBackgroundColor: '#0ea5e9',
                },
                {
                    label: 'Moyenne Service/Dpt',
                    data: scopeAverageData,
                    backgroundColor: 'rgba(156, 163, 175, 0.2)',
                    borderColor: '#9ca3af',
                    pointBackgroundColor: '#9ca3af',
                    borderDash: [5, 5]
                }
            ]
        };
    }, [evaluation, scopeAverageData]);

    const distributionData = useMemo(() => {
        if (allScopeEvaluations.length === 0) return null;
        const ranges = ['0-50', '50-60', '60-70', '70-80', '80-90', '90-100'];
        const counts = [0, 0, 0, 0, 0, 0];
        let agentBucketIndex = -1;

        allScopeEvaluations.forEach(ev => {
            const score = ev.noteGlobale;
            let idx = score < 50 ? 0 : score < 60 ? 1 : score < 70 ? 2 : score < 80 ? 3 : score < 90 ? 4 : 5;
            counts[idx]++;
            if (ev.id === evaluation?.id) agentBucketIndex = idx;
        });

        return {
            labels: ranges,
            datasets: [{
                label: 'Nombre d\'agents',
                data: counts,
                backgroundColor: counts.map((_, i) => i === agentBucketIndex ? '#0ea5e9' : '#e5e7eb'),
                borderRadius: 4,
            }]
        };
    }, [allScopeEvaluations, evaluation]);


    // --- GESTION DE LA SAUVEGARDE ET SOUMISSION ---
    const handleSave = (notes: Note[], rappel: string, actions: PlanActions, appreciation: string, noteGlobale: number, isSubmission: boolean, isAutoSave: boolean = false) => {
        if (!evaluation || !targetAgent) return;
        
        const changes: string[] = [];
        
        if (!isAutoSave) {
            if (evaluation.noteGlobale !== noteGlobale) {
                 changes.push(`Note Globale: ${evaluation.noteGlobale} -> ${noteGlobale}`);
            } else {
                 changes.push("Mise à jour du contenu (notes/commentaires)");
            }
        }

        let newStatus = evaluation.statut;
        // Si c'est une soumission, on passe à l'état SOUMIS
        if (isSubmission && (evaluation.statut === EvaluationStatus.BROUILLON || evaluation.statut === EvaluationStatus.REJETE)) {
            newStatus = EvaluationStatus.SOUMIS;
            changes.push("Soumission du dossier pour validation");
        }

        const updatedEval: Evaluation = {
            ...evaluation,
            notes,
            rappelObjectifs: rappel,
            planActions: actions,
            appreciationFinale: appreciation,
            noteGlobale,
            statut: newStatus
        };

        db.updateEvaluation(updatedEval);
        
        // Log Audit
        if (changes.length > 0) {
            db.addAuditLog({
                userId: currentUser.id,
                userRole: currentUser.role,
                targetId: evaluation.id,
                targetName: `Eval ${evaluation.annee} - ${targetAgent.nom} ${targetAgent.prenom}`,
                action: isSubmission ? 'SOUMISSION' : 'MODIFICATION',
                details: changes.join('; ')
            });
        }

        setEvaluation(updatedEval); 
        
        // --- LOGIQUE DE NOTIFICATION DE SOUMISSION ---
        if (isSubmission && newStatus === EvaluationStatus.SOUMIS) {
            // 1. Chercher le Chef de Service (Manager direct)
            let manager = db.getManagerForAgent(targetAgent!, Role.CHEF_SERVICE);
            
            // 2. Fallback: Si pas de chef de service, chercher le Directeur
            if (!manager) {
                console.warn("Pas de Chef de Service trouvé, escalade au Directeur...");
                manager = db.getManagerForAgent(targetAgent!, Role.DIRECTEUR);
            }

            if (manager) {
                db.addNotification({
                    id: `n_${Date.now()}`,
                    userId: manager.id,
                    type: 'ACTION',
                    message: `Nouvelle évaluation soumise par ${targetAgent?.nom} ${targetAgent?.prenom}.`,
                    date: new Date().toISOString(),
                    read: false,
                    linkToEvalId: evaluation.id
                });
                showToast(`Soumis avec succès ! Notification envoyée à ${manager.nom} ${manager.prenom}.`, 'success', 5000);
            } else {
                // Cas critique : Aucun N+1 ou N+2 trouvé
                db.addNotification({
                     id: `n_err_${Date.now()}`,
                     userId: currentUser.id, // On se notifie soi-même du problème
                     type: 'ERROR',
                     message: "Dossier soumis mais aucun manager n'a été trouvé pour la validation. Contactez la DRH.",
                     date: new Date().toISOString(),
                     read: false
                });
                showToast("Soumis, mais aucun validateur n'a été trouvé. Veuillez contacter l'admin.", 'warning', 8000);
            }
            
            navigate(-1);
        } else if (isAutoSave) {
            showToast("Sauvegarde automatique...", 'info', 1500);
        } else {
            showToast("Sauvegardé avec succès.", 'success');
        }
    };

    // --- GESTION DE LA VALIDATION ---
    const handleValidate = (decision: 'VALIDE' | 'REJETE', comment: string) => {
        if (!evaluation || !targetAgent) return;

        let newStatus = evaluation.statut;
        
        // Logique de changement de statut
        if (decision === 'REJETE') {
            newStatus = EvaluationStatus.REJETE;
        } else {
             if (currentUser.role === Role.CHEF_SERVICE) newStatus = EvaluationStatus.VALIDE_SERVICE;
             else if (currentUser.role === Role.DIRECTEUR) newStatus = EvaluationStatus.VALIDE_DIRECTEUR;
             // L'Admin valide au même niveau que le DRH (Final)
             else if (currentUser.role === Role.DRH || currentUser.role === Role.ADMIN) newStatus = EvaluationStatus.VALIDE_DRH;
        }

        const newValidation: ValidationStep = {
            role: currentUser.role,
            date: new Date().toISOString(),
            validateurId: currentUser.id,
            commentaire: comment,
            decision
        };

        const updatedEval = {
            ...evaluation,
            statut: newStatus,
            validations: [...(evaluation.validations || []), newValidation]
        };

        db.updateEvaluation(updatedEval);
        
        db.addAuditLog({
            userId: currentUser.id,
            userRole: currentUser.role,
            targetId: evaluation.id,
            targetName: `Eval ${evaluation.annee} - ${targetAgent.nom} ${targetAgent.prenom}`,
            action: decision,
            details: `Décision: ${decision}. Statut passé à ${newStatus}. Commentaire: "${comment}"`
        });

        setEvaluation(updatedEval);

        // 1. Notifier l'agent du résultat
        const isFinalValidation = newStatus === EvaluationStatus.VALIDE_DRH;
        
        db.addNotification({
            id: `n_res_${Date.now()}`,
            userId: targetAgent.id,
            type: decision === 'VALIDE' ? 'SUCCESS' : 'ERROR',
            message: decision === 'VALIDE' 
                ? (isFinalValidation 
                    ? `Félicitations ! Votre évaluation ${evaluation.annee} est clôturée. Note finale : ${evaluation.noteGlobale}/100.` 
                    : `Votre évaluation a été validée par ${currentUser.role}.`)
                : `Votre évaluation a été rejetée par ${currentUser.role}. Voir les commentaires.`,
            date: new Date().toISOString(),
            read: false,
            linkToEvalId: evaluation.id
        });

        // 2. Si VALIDÉ, notifier le validateur suivant
        if (decision === 'VALIDE') {
            let nextValidator: User | undefined;
            let nextRoleLabel = "";

            if (newStatus === EvaluationStatus.VALIDE_SERVICE) {
                 nextValidator = db.getManagerForAgent(targetAgent, Role.DIRECTEUR);
                 nextRoleLabel = "Directeur";
            } else if (newStatus === EvaluationStatus.VALIDE_DIRECTEUR) {
                 nextValidator = db.getManagerForAgent(targetAgent, Role.DRH);
                 nextRoleLabel = "DRH";
            }

            if (nextValidator) {
                db.addNotification({
                    id: `n_val_${Date.now()}`,
                    userId: nextValidator.id,
                    type: 'ACTION',
                    message: `Validation requise : Dossier de ${targetAgent.nom} (Validé par ${currentUser.role})`,
                    date: new Date().toISOString(),
                    read: false,
                    linkToEvalId: evaluation.id
                });
                showToast(`Validé ! Le dossier a été transmis au ${nextRoleLabel} (${nextValidator.nom}).`, 'success', 4000);
            } else if (newStatus !== EvaluationStatus.VALIDE_DRH) {
                // Si ce n'est pas la fin du process mais qu'on ne trouve personne
                showToast(`Validé, mais le validateur suivant (${nextRoleLabel}) est introuvable.`, 'warning', 5000);
            } else {
                // Fin du process (DRH ou ADMIN)
                showToast("Dossier clôturé et archivé avec succès.", 'success', 4000);
            }
        } else {
            showToast("Dossier rejeté et renvoyé à l'agent.", 'info');
        }

        navigate('/validations');
    };

    if (loading) return <div>Chargement...</div>;
    if (!evaluation || !targetAgent) return <div>Dossier introuvable.</div>;

    const showAnalytics = currentUser.role !== Role.AGENT && radarData && distributionData;

    return (
        <div className="pb-12">
            <EvaluationForm 
                user={currentUser}
                targetAgent={targetAgent}
                evalData={evaluation}
                onSave={handleSave}
                onValidate={handleValidate}
                onBack={() => navigate(-1)}
            />

            {/* SECTION ANALYTICS */}
            {showAnalytics && (
                <div className="max-w-5xl mx-auto mt-8 px-4 md:px-0 print:hidden animate-fade-in-up">
                    <div className="bg-white rounded-lg shadow-lg border-l-4 border-indigo-500 overflow-hidden mb-8">
                         <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-indigo-900 flex items-center">
                                <i className="fas fa-chart-line text-indigo-600 mr-2"></i> Analyse Comparative
                            </h3>
                            <span className="text-xs font-semibold text-indigo-600 bg-white px-2 py-1 rounded border border-indigo-200">
                                Aide à la décision
                            </span>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col items-center">
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-4">Profil de compétences vs Moyenne</h4>
                                <div className="w-full max-w-sm h-64 relative">
                                    <Radar 
                                        data={radarData!} 
                                        options={{ 
                                            maintainAspectRatio: false,
                                            scales: { r: { min: 0, max: 12, ticks: { display: false }, pointLabels: { font: { size: 10 } } } },
                                            plugins: { legend: { position: 'bottom' } }
                                        }} 
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col items-center">
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-4">Positionnement dans l'équipe</h4>
                                <div className="w-full h-64 relative">
                                    <Bar 
                                        data={distributionData!}
                                        options={{
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: false } },
                                            scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* HISTORIQUE */}
            <div className="max-w-5xl mx-auto mt-8 px-4 md:px-0 print:hidden">
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center">
                            <i className="fas fa-history text-pal-600 mr-2"></i> Historique des validations
                        </h3>
                    </div>
                    {(!evaluation.validations || evaluation.validations.length === 0) ? (
                        <div className="p-8 text-center text-gray-500 italic">
                            Aucune validation ou rejet enregistré pour le moment.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {evaluation.validations.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((val, idx) => (
                                <div key={idx} className="p-6 flex items-start hover:bg-gray-50 transition duration-150">
                                    <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mr-4 shadow-sm border ${val.decision === 'VALIDE' ? 'bg-green-100 text-green-600 border-green-200' : 'bg-red-100 text-red-600 border-red-200'}`}>
                                        <i className={`fas ${val.decision === 'VALIDE' ? 'fa-check' : 'fa-times'}`}></i>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-gray-800 text-sm md:text-base">{val.role}</span>
                                            <span className="text-xs text-gray-400 font-mono">
                                                {new Date(val.date).toLocaleDateString()} à {new Date(val.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                        <div className="text-sm mb-2">
                                            Action : <span className={`font-bold px-2 py-0.5 rounded text-xs uppercase tracking-wider ${val.decision === 'VALIDE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{val.decision}</span>
                                        </div>
                                        {val.commentaire && (
                                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm text-gray-700 italic relative">
                                                <i className="fas fa-quote-left text-gray-300 absolute top-2 left-2 text-xs"></i>
                                                <span className="pl-4 block">{val.commentaire}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EvaluationDetail;
