
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, Evaluation, EvaluationStatus, Note, PlanActions, Role, CritereGroupDefinition } from '../types';

// --- CONFIGURATION STRICTE SELON PDF RHM-IDC-01-PAL17 ---
export const OFFICIAL_FORM_STRUCTURE: CritereGroupDefinition[] = [
  {
    id: 'c1',
    label: 'Critère n°1. Qualité du travail accompli',
    maxScore: 12, 
    subCriteres: [
      { id: 'c1_minutie', label: 'Minutie et soin apportés au travail (Précision, rigueur, fiabilité)', max: 6 },
      { id: 'c1_methode', label: 'Méthode (Ordre, organisation, logique)', max: 6 },
      { id: 'c1_quantite', label: 'Quantité/Qualité de travail (Efficacité, rapidité, respect des exigences)', max: 6 },
    ]
  },
  {
    id: 'c2',
    label: 'Critère n°2. Compétences',
    maxScore: 12,
    subCriteres: [
      { id: 'c2_tech', label: 'Possède les compétences pour accomplir son travail (Connaissances théoriques & pratiques)', max: 6 },
      { id: 'c2_adapt', label: 'Faculté d\'adaptation (Polyvalence, assimilation, esprit critique)', max: 6 },
    ]
  },
  {
    id: 'c3',
    label: 'Critère n°3. Efficacité',
    maxScore: 12,
    subCriteres: [
      { id: 'c3_auto', label: 'Autonomie (Fonctionner sans aide constante)', max: 6 },
      { id: 'c3_motiv', label: 'Motivation (Détermination, satisfaction au travail)', max: 6 },
      { id: 'c3_delais', label: 'Respect des délais (Volume et rythme)', max: 6 },
      { id: 'c3_prio', label: 'Gestion des priorités (Habileté à choisir selon l\'urgence)', max: 6 },
    ]
  },
  {
    id: 'c4',
    label: 'Critère n°4. Civilité',
    maxScore: 12,
    subCriteres: [
      { id: 'c4_rel', label: 'Relations Interpersonnelles (Respect, courtoisie, empathie)', max: 6 },
      { id: 'c4_pres', label: 'Présence au travail (Ponctualité, assiduité)', max: 6 },
    ]
  },
  {
    id: 'c5',
    label: 'Critère n°5. Déontologie',
    maxScore: 12,
    subCriteres: [
      { id: 'c5_droit', label: 'Droiture (Réserve, respect des réglementations, loyauté)', max: 6 },
      { id: 'c5_resp', label: 'Respect (Hiérarchie, code d\'éthique)', max: 6 },
      { id: 'c5_att', label: 'Attitude positive (Dynamisme, volonté d\'évoluer)', max: 6 },
    ]
  },
  {
    id: 'c6',
    label: 'Critère n°6. Initiative',
    maxScore: 10,
    subCriteres: [
      { id: 'c6_decis', label: 'Prise de décisions / d\'initiatives (Améliorant la qualité du travail)', max: 6 },
      { id: 'c6_impr', label: 'Capacité à faire face à une situation imprévue', max: 6 },
    ]
  },
  {
    id: 'c7',
    label: 'Critère n°7. Investissement professionnel',
    maxScore: 10,
    subCriteres: [
      { id: 'c7_inv', label: 'Capacité à s\'investir (Maintien du niveau de performance)', max: 6 },
      { id: 'c7_niv', label: 'Capacité à mettre à niveau ses compétences et créativité', max: 6 },
    ]
  },
  {
    id: 'c8',
    label: 'Critère n°8. Communication',
    maxScore: 10,
    subCriteres: [
      { id: 'c8_expr', label: 'Capacité à s\'exprimer (Orale et écrite, clarté)', max: 6 },
      { id: 'c8_com', label: 'Capacité à communiquer (Echange d\'idées, tact, confidentialité)', max: 6 },
    ]
  },
  {
    id: 'c9',
    label: 'Critère n°9. Collaboration',
    maxScore: 10,
    subCriteres: [
      { id: 'c9_part', label: 'Capacité à partager et organiser des tâches (Projets communs)', max: 6 },
      { id: 'c9_disp', label: 'Disponibilité vis-à-vis des autres membres du service', max: 6 },
    ]
  },
  {
    id: 'c10',
    label: '10. Gestion d\'équipe* (Encadrement)',
    maxScore: 35,
    isManagerOnly: true,
    subCriteres: [
      { id: 'c10_plan', label: 'Planification (Fixer des étapes appropriées)', max: 6 },
      { id: 'c10_org', label: 'Organisation (Fixer priorités, coordonner moyens)', max: 6 },
      { id: 'c10_dir', label: 'Direction (Conduire ses collaborateurs)', max: 6 },
      { id: 'c10_ped', label: 'Pédagogie (Faire émerger les compétences)', max: 6 },
      { id: 'c10_eval', label: 'Evaluation (Capacité à évaluer justement)', max: 6 },
      { id: 'c10_enc', label: 'Encadrement (Soutenir ses collaborateurs)', max: 6 },
      { id: 'c10_stim', label: 'Stimulation (Faire adhérer à un projet)', max: 6 },
      { id: 'c10_sec', label: 'Sécurité (Faire appliquer les mesures)', max: 6 },
    ]
  },
];

const APPRECIATIONS = ['Excellente', 'Très positive', 'Positive', 'Satisfaisante', 'A améliorer', 'Insuffisante'];

interface EvaluationFormProps {
    user: User;
    targetAgent: User;
    evalData: Evaluation;
    onSave: (notes: Note[], rappel: string, actions: PlanActions, appreciation: string, noteGlobale: number, isSubmission: boolean, isAutoSave?: boolean) => void;
    onValidate: (decision: 'VALIDE' | 'REJETE', comment: string) => void;
    onBack?: () => void;
}

const EvaluationForm: React.FC<EvaluationFormProps> = ({ user, targetAgent, evalData, onSave, onValidate, onBack }) => {
    // Permission Logic
    const isOwner = user.id === targetAgent.id;
    const isDraft = evalData.statut === EvaluationStatus.BROUILLON || evalData.statut === EvaluationStatus.REJETE;
    const canEdit = isOwner && isDraft;
    
    // Modification: L'Admin peut valider comme un DRH
    const canValidate = (
        (user.role === Role.CHEF_SERVICE && evalData.statut === EvaluationStatus.SOUMIS) ||
        (user.role === Role.DIRECTEUR && evalData.statut === EvaluationStatus.VALIDE_SERVICE) ||
        ((user.role === Role.DRH || user.role === Role.ADMIN) && evalData.statut === EvaluationStatus.VALIDE_DIRECTEUR)
    );

    // State
    const [notes, setNotes] = useState<Note[]>(evalData.notes || []);
    const [rappelObjectifs, setRappelObjectifs] = useState(evalData.rappelObjectifs || "");
    const [planActions, setPlanActions] = useState<PlanActions>(evalData.planActions || { objectifs: '', mesures: '', delais: '', formation: '' });
    const [appreciationFinale, setAppreciationFinale] = useState(evalData.appreciationFinale || "");
    const [validationComment, setValidationComment] = useState("");
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

    // Auto-Save State
    const [isDirty, setIsDirty] = useState(false);
    const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

    // Workflow Stepper Logic
    const getStepIndex = (status: EvaluationStatus) => {
        switch (status) {
            case EvaluationStatus.BROUILLON: return 0;
            case EvaluationStatus.SOUMIS: return 1;
            case EvaluationStatus.VALIDE_SERVICE: return 2;
            case EvaluationStatus.VALIDE_DIRECTEUR: return 3;
            case EvaluationStatus.VALIDE_DRH: return 4;
            case EvaluationStatus.REJETE: return 1; // Show at submission level but with red
            default: return 0;
        }
    };

    const currentStepIdx = getStepIndex(evalData.statut);
    const workflowSteps = [
        { label: 'Rédaction', role: 'Agent' },
        { label: 'Soumission', role: 'Attente Chef Service' },
        { label: 'Validation Service', role: 'Attente Directeur' },
        { label: 'Approbation Direction', role: 'Attente DRH' },
        { label: 'Validation Finale', role: 'Dossier Clos' }
    ];

    // LOGIQUE DE VISIBILITÉ DU CRITÈRE 10 :
    const isChefDivision = targetAgent.role === Role.AGENT && 
                           targetAgent.isEncadrant && 
                           (targetAgent.fonction || "").toLowerCase().includes('division');
                           
    const isHierarchicalRole = targetAgent.role !== Role.AGENT;
    const showManagementCriteria = isHierarchicalRole || isChefDivision;

    // Calculs de pondération
    const calculatedScores = useMemo(() => {
        let totalGlobal = 0;
        const categoryScores: Record<string, number> = {};
        let maxTotalPossible = 0;
        
        OFFICIAL_FORM_STRUCTURE.forEach(group => {
          if (group.isManagerOnly && !showManagementCriteria) return;
          
          const subIds = group.subCriteres.map(s => s.id);
          const groupNotes = notes.filter(n => subIds.includes(n.critereId));
          const sumUserSubScores = groupNotes.reduce((acc, curr) => acc + curr.valeur, 0);
          
          const maxRawScore = group.subCriteres.length * 6;
          let weightedScore = 0;
          if (maxRawScore > 0) {
              weightedScore = (sumUserSubScores / maxRawScore) * group.maxScore;
          }
          
          const roundedScore = parseFloat(weightedScore.toFixed(2));
          categoryScores[group.id] = roundedScore;
          totalGlobal += roundedScore;
          maxTotalPossible += group.maxScore;
        });
        
        return { categoryScores, totalGlobal: parseFloat(totalGlobal.toFixed(2)), maxTotalPossible };
    }, [notes, showManagementCriteria]);

    // --- LOGIQUE DE SAUVEGARDE ---

    const triggerSave = useCallback((isSubmission: boolean, isAutoSave: boolean = false) => {
        if (!canEdit && !isSubmission) return;

        onSave(notes, rappelObjectifs, planActions, appreciationFinale, calculatedScores.totalGlobal, isSubmission, isAutoSave);
        
        if (!isSubmission) {
            setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            setIsDirty(false);
        }
        setShowSubmitConfirm(false);
    }, [notes, rappelObjectifs, planActions, appreciationFinale, calculatedScores.totalGlobal, canEdit, onSave]);

    // Auto-Save Interval (30 secondes)
    useEffect(() => {
        if (!canEdit) return;

        const interval = setInterval(() => {
            if (isDirty) {
                triggerSave(false, true); // Auto-save
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [isDirty, canEdit, triggerSave]);

    // Handlers
    const markDirty = () => {
        if (canEdit && !isDirty) setIsDirty(true);
    };

    const handleBlur = () => {
        if (canEdit && isDirty) {
            triggerSave(false, true); // Auto-save on blur
        }
    };

    const handleNoteChange = (critereId: string, val: number) => {
        if (!canEdit) return;
        setNotes(prev => {
            const idx = prev.findIndex(n => n.critereId === critereId);
            if (idx >= 0) {
                const copy = [...prev]; copy[idx] = { ...copy[idx], valeur: val }; return copy;
            }
            return [...prev, { critereId, valeur: val }];
        });
        markDirty();
    };

    const handleCommentChange = (critereId: string, comment: string) => {
         if (!canEdit) return;
         setNotes(prev => {
            const idx = prev.findIndex(n => n.critereId === critereId);
            if (idx >= 0) {
                const copy = [...prev]; copy[idx] = { ...copy[idx], commentaire: comment }; return copy;
            }
            return [...prev, { critereId, valeur: 0, commentaire: comment }];
        });
        markDirty();
    };

    const getGroupComment = (groupId: string) => {
        return notes.find(n => n.critereId === groupId)?.commentaire || "";
    };

    return (
        <div className="max-w-5xl mx-auto pb-24 font-serif text-gray-900 relative">
            
            {/* CONFIRMATION MODAL */}
            {showSubmitConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                        <h3 className="text-xl font-bold mb-4 text-pal-800">Confirmer la soumission</h3>
                        <p className="text-gray-600 mb-6">
                            Êtes-vous sûr de vouloir soumettre votre évaluation ? <br/>
                            Une fois soumise, vous ne pourrez plus la modifier et elle sera transmise à votre responsable pour validation.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button 
                                onClick={() => setShowSubmitConfirm(false)}
                                className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                            >
                                Annuler
                            </button>
                            <button 
                                onClick={() => triggerSave(true)}
                                className="px-4 py-2 bg-pal-600 text-white rounded hover:bg-pal-700 font-bold"
                            >
                                Confirmer & Soumettre
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ACTIONS HEADER */}
            <div className="flex items-center justify-between mb-8 print:hidden">
                <button onClick={onBack} className="text-gray-500 hover:text-gray-700 flex items-center font-sans font-bold text-sm">
                    <i className="fas fa-arrow-left mr-2"></i> Retour
                </button>
                <div className="flex items-center space-x-3 font-sans">
                     <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${evalData.statut === EvaluationStatus.REJETE ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-pal-100 text-pal-800'}`}>
                        {evalData.statut}
                     </span>
                     <button 
                        onClick={() => window.print()} 
                        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded shadow-sm hover:bg-gray-50 text-sm font-bold transition flex items-center"
                        title="Générer un PDF via l'impression"
                     >
                        <i className="fas fa-file-pdf mr-2 text-red-600 text-lg"></i> Exporter en PDF
                     </button>
                </div>
            </div>

            {/* WORKFLOW PROGRESS TRACKER (NEW) */}
            <div className="bg-white p-6 rounded-[2rem] shadow-xl mb-8 border border-slate-100 print:hidden font-sans">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-pal-500 uppercase tracking-tighter">Étape de validation actuelle</h3>
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${evalData.statut === EvaluationStatus.REJETE ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{evalData.statut}</span>
                    </div>
                </div>
                <div className="relative">
                    <div className="absolute top-5 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 rounded-full"></div>
                    <div className={`absolute top-5 left-0 h-1 -translate-y-1/2 rounded-full transition-all duration-700 ${evalData.statut === EvaluationStatus.REJETE ? 'bg-red-500' : 'bg-pal-500'}`} style={{ width: `${(currentStepIdx / 4) * 100}%` }}></div>
                    <div className="relative flex justify-between">
                        {workflowSteps.map((step, idx) => {
                            const isCompleted = idx < currentStepIdx;
                            const isCurrent = idx === currentStepIdx;
                            const isRejet = evalData.statut === EvaluationStatus.REJETE && isCurrent;

                            return (
                                <div key={idx} className="flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 border-4 transition ${
                                        isCompleted ? 'bg-pal-500 text-white border-pal-500' : 
                                        isCurrent ? (isRejet ? 'bg-red-500 text-white border-white ring-4 ring-red-100' : 'bg-pal-yellow text-pal-900 border-white ring-4 ring-pal-yellow/20') : 
                                        'bg-white text-slate-300 border-slate-100'
                                    }`}>
                                        <i className={`fas ${
                                            isCompleted ? 'fa-check' : 
                                            isRejet ? 'fa-times' :
                                            idx === 0 ? 'fa-pencil-alt' : 
                                            idx === 1 ? 'fa-user-check' : 
                                            idx === 2 ? 'fa-signature' : 
                                            idx === 3 ? 'fa-check-double' : 
                                            'fa-award'
                                        } text-[10px]`}></i>
                                    </div>
                                    <p className={`mt-3 text-[9px] font-black uppercase text-center max-w-[80px] transition ${isCurrent ? 'text-pal-500' : 'text-slate-400'}`}>
                                        {step.label}
                                    </p>
                                    <p className="text-[8px] font-bold text-slate-300 uppercase mt-1 leading-tight text-center max-w-[80px]">
                                        {isCurrent ? step.role : ''}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* DOCUMENT PAPER CONTAINER */}
            <div className="bg-white shadow-2xl p-8 md:p-12 min-h-screen border-t-8 border-pal-700 print:shadow-none print:border-none print:p-0">
                
                {/* HEADER / LOGOS */}
                <div className="flex justify-between items-stretch border border-black mb-6">
                     <div className="w-1/4 p-2 flex flex-col items-center justify-center border-r border-black">
                         {/* Placeholder Logo */}
                         <div className="text-center font-bold text-xs">
                             <i className="fas fa-anchor text-4xl mb-2"></i><br/>PORT AUTONOME DE LOMÉ
                         </div>
                     </div>
                     <div className="w-1/4 border-r border-black flex flex-col">
                         <div className="border-b border-black p-1 text-xs font-bold">RHM-IDC-01-PAL17</div>
                         <div className="border-b border-black p-1 text-xs">Date : 16/12/2019</div>
                         <div className="flex-1 p-1 text-xs">Version : 02</div>
                     </div>
                     <div className="w-1/4 border-r border-black flex items-center justify-center p-2 text-center font-bold text-sm bg-gray-50">
                         GESTION DES RESSOURCES HUMAINES
                     </div>
                     <div className="w-1/4 flex items-center justify-center p-2 text-center font-bold text-lg uppercase bg-pal-50">
                         Fiche d'Evaluation du Personnel
                     </div>
                </div>

                {/* I. IDENTIFICATION */}
                <h3 className="text-center font-bold uppercase text-lg mb-4 underline">Identification de l'Agent</h3>
                <div className="border-2 border-gray-800 p-4 mb-8 text-sm grid grid-cols-2 gap-x-8 gap-y-4">
                     <div className="flex">
                         <span className="font-bold w-32">Nom et prénoms :</span>
                         <span className="border-b border-dotted border-gray-400 flex-1">{targetAgent.nom} {targetAgent.prenom}</span>
                     </div>
                     <div className="flex">
                         <span className="font-bold w-24">N° Mle :</span>
                         <span className="border-b border-dotted border-gray-400 flex-1">{targetAgent.matricule}</span>
                     </div>
                     
                     <div className="flex">
                         <span className="font-bold w-32">Date de naissance :</span>
                         <span className="border-b border-dotted border-gray-400 flex-1">-</span>
                     </div>
                     <div className="flex">
                         <span className="font-bold w-24">Catégorie :</span>
                         <span className="border-b border-dotted border-gray-400 flex-1">{targetAgent.categorie || 'IV'}</span>
                     </div>

                     <div className="flex col-span-2">
                         <span className="font-bold w-32">Fonction :</span>
                         <span className="border-b border-dotted border-gray-400 flex-1">{targetAgent.fonction}</span>
                     </div>
                     
                     <div className="flex col-span-2">
                         <span className="font-bold w-32">Direction :</span>
                         <span className="border-b border-dotted border-gray-400 flex-1">{targetAgent.departement}</span>
                     </div>

                     <div className="flex col-span-2">
                         <span className="font-bold w-48">Date de l'évaluation actuelle :</span>
                         <span className="border-b border-dotted border-gray-400 flex-1">{new Date().toLocaleDateString()}</span>
                     </div>
                </div>

                {/* RAPPEL DES OBJECTIFS */}
                <div className="border-2 border-gray-800 p-1 mb-8">
                     <div className="font-bold text-center border-b border-gray-800 bg-gray-100 p-1 uppercase">
                         Rappel des Objectifs et/ou Activités de l'Agent
                     </div>
                     {canEdit ? (
                         <textarea 
                             className="w-full h-40 p-2 outline-none resize-none font-handwriting text-blue-900"
                             value={rappelObjectifs}
                             onChange={e => { setRappelObjectifs(e.target.value); markDirty(); }}
                             onBlur={handleBlur}
                             placeholder="Saisir ici..."
                         />
                     ) : (
                         <div className="w-full h-40 p-2 font-handwriting text-blue-900 whitespace-pre-wrap">
                             {rappelObjectifs}
                         </div>
                     )}
                </div>

                {/* CRITERES */}
                <div className="mb-8">
                     <div className="bg-pal-700 text-white font-bold p-2 text-center uppercase mb-4 shadow">Critères de l'évaluation</div>
                     <p className="text-xs italic mb-4 text-gray-600">
                        * Notation sur 6 pour chaque sous-critère. Le total est pondéré selon le maximum de la section.
                        <br/>(0-1: Mauvais, 1-2.4: Médiocre, 2.5-3: Moyen, 3.1-4: Bon, &gt;4: Très bon, &gt;5: Excellent)
                     </p>

                     <div className="space-y-6">
                        {OFFICIAL_FORM_STRUCTURE.map(group => {
                            if (group.isManagerOnly && !showManagementCriteria) return null;
                            return (
                                <div key={group.id} className="border-2 border-gray-800 break-inside-avoid">
                                     {/* Header Critère */}
                                     <div className="bg-pal-100 border-b-2 border-gray-800 p-2 flex justify-between items-center">
                                         <h4 className="font-bold text-pal-900 uppercase">{group.label}</h4>
                                         <div className="border-2 border-black bg-white px-3 py-1 font-bold text-lg">
                                             {calculatedScores.categoryScores[group.id]} <span className="text-xs text-gray-500">/{group.maxScore}</span>
                                         </div>
                                     </div>

                                     {/* Sous-critères */}
                                     <div className="p-4 space-y-3">
                                         {group.subCriteres.map(sub => (
                                             <div key={sub.id} className="flex justify-between items-center border-b border-dotted border-gray-300 pb-2">
                                                 <div className="pr-4 text-sm font-medium w-3/4">{sub.label}</div>
                                                 <div className="w-1/4 flex justify-end items-center">
                                                     {canEdit ? (
                                                         <input 
                                                            type="number" min="0" max="6" step="0.5"
                                                            value={notes.find(n => n.critereId === sub.id)?.valeur || 0}
                                                            onChange={e => handleNoteChange(sub.id, parseFloat(e.target.value))}
                                                            className="w-16 border border-gray-400 p-1 text-center font-bold"
                                                         />
                                                     ) : (
                                                         <span className="font-bold text-lg">{notes.find(n => n.critereId === sub.id)?.valeur || 0}</span>
                                                     )}
                                                     <span className="text-xs text-gray-500 ml-1">/6</span>
                                                 </div>
                                             </div>
                                         ))}
                                     </div>

                                     {/* Commentaires */}
                                     <div className="bg-gray-50 border-t border-gray-800 p-2">
                                         <label className="text-xs font-bold uppercase text-gray-500">Remarque(s) éventuelle(s) / Améliorations :</label>
                                         {canEdit ? (
                                             <textarea 
                                                className="w-full bg-transparent border-b border-gray-300 outline-none text-sm p-1 h-12"
                                                value={getGroupComment(group.id)}
                                                onChange={e => handleCommentChange(group.id, e.target.value)}
                                                onBlur={handleBlur}
                                             />
                                         ) : (
                                             <p className="text-sm p-1 min-h-[2rem] text-blue-900">{getGroupComment(group.id) || "RAS"}</p>
                                         )}
                                     </div>
                                </div>
                            );
                        })}
                     </div>
                </div>

                {/* TABLEAU RECAPITULATIF (Forcé sur une nouvelle page) */}
                <div className="mt-8" style={{ pageBreakBefore: 'always' }}>
                    <div className="bg-pal-700 text-white font-bold p-2 text-center uppercase mb-0 shadow">Evaluation globale</div>
                    <div className="border-2 border-gray-800 p-4">
                        <p className="font-bold mb-2">Appréciation d'ensemble pour la fonction actuelle de l'agent :</p>
                        
                        <table className="w-full border-collapse border border-gray-800 text-sm mb-6">
                            <thead>
                                <tr className="bg-gray-200">
                                    <th className="border border-gray-800 p-2 text-left">Critère d'évaluation</th>
                                    <th className="border border-gray-800 p-2 text-center w-32">Points attribués</th>
                                </tr>
                            </thead>
                            <tbody>
                                {OFFICIAL_FORM_STRUCTURE.map(group => {
                                    if (group.isManagerOnly && !showManagementCriteria) return null;
                                    return (
                                        <tr key={group.id}>
                                            <td className="border border-gray-800 p-1 pl-2 font-medium">{group.label.split('.')[1] || group.label}</td>
                                            <td className="border border-gray-800 p-1 text-center font-bold">
                                                {calculatedScores.categoryScores[group.id]} <span className="text-xs font-normal">/{group.maxScore}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-gray-100 border-t-2 border-black">
                                    <td className="border border-gray-800 p-2 font-bold text-right uppercase">Total des points</td>
                                    <td className="border border-gray-800 p-2 text-center text-xl font-bold text-pal-800">
                                        {calculatedScores.totalGlobal} <span className="text-sm text-gray-500">/{calculatedScores.maxTotalPossible}</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* APPRECIATION FINALE */}
                        <div className="mb-6">
                            <p className="font-bold mb-2 underline">Evaluation Finale de l'agent :</p>
                            <div className="grid grid-cols-3 gap-2">
                                {APPRECIATIONS.map(app => (
                                    <label key={app} className="flex items-center space-x-2 p-2 border border-gray-300 rounded hover:bg-gray-50 cursor-pointer">
                                        {canEdit ? (
                                            <input 
                                                type="radio" 
                                                name="appreciation" 
                                                checked={appreciationFinale === app} 
                                                onChange={() => { setAppreciationFinale(app); markDirty(); }}
                                                className="w-4 h-4 text-pal-600"
                                            />
                                        ) : (
                                            <div className={`w-4 h-4 rounded-full border border-gray-500 ${appreciationFinale === app ? 'bg-pal-600' : 'bg-white'}`}></div>
                                        )}
                                        <span className={`text-sm ${appreciationFinale === app ? 'font-bold text-pal-800' : ''}`}>{app}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* PLAN D'ACTIONS */}
                        <div className="bg-pal-700 text-white font-bold p-1 text-center uppercase mb-0">Plan d'actions</div>
                        <div className="border border-gray-800 p-4 space-y-4">
                            <div>
                                <label className="font-bold text-sm">Objectifs à atteindre :</label>
                                {canEdit ? (
                                    <textarea className="w-full border-b border-gray-400 outline-none p-1 h-16 resize-none" value={planActions.objectifs} onChange={e => { setPlanActions({...planActions, objectifs: e.target.value}); markDirty(); }} onBlur={handleBlur} />
                                ) : <p className="border-b border-gray-400 min-h-[2rem] text-blue-900">{planActions.objectifs}</p>}
                            </div>
                            <div>
                                <label className="font-bold text-sm">Mesures à mettre en œuvre :</label>
                                {canEdit ? (
                                    <textarea className="w-full border-b border-gray-400 outline-none p-1 h-16 resize-none" value={planActions.mesures} onChange={e => { setPlanActions({...planActions, mesures: e.target.value}); markDirty(); }} onBlur={handleBlur} />
                                ) : <p className="border-b border-gray-400 min-h-[2rem] text-blue-900">{planActions.mesures}</p>}
                            </div>
                            <div>
                                <label className="font-bold text-sm">Délais :</label>
                                {canEdit ? (
                                    <input type="text" className="w-full border-b border-gray-400 outline-none p-1" value={planActions.delais} onChange={e => { setPlanActions({...planActions, delais: e.target.value}); markDirty(); }} onBlur={handleBlur} />
                                ) : <p className="border-b border-gray-400 min-h-[1.5rem] text-blue-900">{planActions.delais}</p>}
                            </div>
                            <div>
                                <label className="font-bold text-sm">Perspective de formation :</label>
                                {canEdit ? (
                                    <textarea className="w-full border-b border-gray-400 outline-none p-1 h-16 resize-none" value={planActions.formation} onChange={e => { setPlanActions({...planActions, formation: e.target.value}); markDirty(); }} onBlur={handleBlur} />
                                ) : <p className="border-b border-gray-400 min-h-[2rem] text-blue-900">{planActions.formation}</p>}
                            </div>
                        </div>

                        {/* SIGNATURES (Empêcher le saut de page à l'intérieur) */}
                        <div className="grid grid-cols-2 gap-8 mt-8 border-t-2 border-gray-800 pt-8 break-inside-avoid">
                            <div className="border border-gray-400 h-32 p-2 relative">
                                <span className="font-bold text-xs uppercase">Signature de l'Agent</span>
                                <span className="absolute bottom-2 right-2 text-xs">Date: ......................</span>
                            </div>
                            <div className="border border-gray-400 h-32 p-2 relative">
                                <span className="font-bold text-xs uppercase">Signature du Chef de Service</span>
                                <span className="absolute bottom-2 right-2 text-xs">Date: ......................</span>
                                {evalData.statut === EvaluationStatus.VALIDE_SERVICE || evalData.statut === EvaluationStatus.VALIDE_DIRECTEUR || evalData.statut === EvaluationStatus.VALIDE_DRH ? (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-green-600 border-2 border-green-600 px-4 py-1 rounded rotate-[-15deg] font-bold text-xl opacity-70">VALIDÉ</span>
                                    </div>
                                ) : null}
                            </div>
                            <div className="border border-gray-400 h-32 p-2 relative col-span-2">
                                <span className="font-bold text-xs uppercase">Signature du Directeur</span>
                                <span className="absolute bottom-2 right-2 text-xs">Date: ......................</span>
                                {evalData.statut === EvaluationStatus.VALIDE_DIRECTEUR || evalData.statut === EvaluationStatus.VALIDE_DRH ? (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-purple-600 border-2 border-purple-600 px-4 py-1 rounded rotate-[-5deg] font-bold text-xl opacity-70">APPROUVÉ</span>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                    </div>
                </div>

            </div>

            {/* FLOATING ACTION BAR */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-between items-center z-50 md:pl-72 print:hidden font-sans">
                 {/* Auto-save Status Indicator */}
                 <div className="text-xs text-gray-500 italic pl-4">
                     {isDirty ? (
                         <span className="text-orange-500"><i className="fas fa-pen mr-1"></i> Modifications non enregistrées...</span>
                     ) : (
                         lastSavedTime && <span className="text-green-600"><i className="fas fa-check mr-1"></i> Enregistré à {lastSavedTime}</span>
                     )}
                 </div>

                 <div className="flex items-center space-x-4">
                     {canEdit && (
                         <>
                            <button 
                                onClick={() => triggerSave(false)} 
                                className="bg-gray-100 text-gray-700 border border-gray-300 px-4 py-2 rounded shadow-sm hover:bg-gray-200 font-bold transition text-xs uppercase"
                            >
                                <i className="fas fa-save mr-2"></i> Enregistrer
                            </button>
                            <button 
                                onClick={() => setShowSubmitConfirm(true)} 
                                className="bg-pal-600 text-white px-6 py-2 rounded shadow hover:bg-pal-700 font-bold flex items-center transform active:scale-95 transition text-xs uppercase"
                            >
                                <i className="fas fa-paper-plane mr-2"></i> Soumettre
                            </button>
                         </>
                     )}
                     {canValidate && (
                         <div className="flex items-center space-x-2">
                             <input 
                                type="text" 
                                placeholder="Motif / Commentaire..." 
                                className="border rounded-xl p-2 w-64 shadow-inner text-sm font-medium"
                                value={validationComment}
                                onChange={e => setValidationComment(e.target.value)}
                             />
                             <button onClick={() => onValidate('REJETE', validationComment)} className="bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 shadow text-xs font-black uppercase">Rejeter</button>
                             <button onClick={() => onValidate('VALIDE', validationComment)} className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 shadow font-black text-xs uppercase">Valider</button>
                         </div>
                     )}
                 </div>
            </div>
        </div>
    );
};

export default EvaluationForm;
