
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/database';
import { User, Role, Evaluation, EvaluationStatus, DEPARTEMENTS } from '../types';

const Validations = ({ user }: { user: User }) => {
    const navigate = useNavigate();
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    
    // Détermination du statut par défaut selon le rôle
    const getDefaultStatus = () => {
        if (user.role === Role.CHEF_SERVICE) return EvaluationStatus.SOUMIS;
        if (user.role === Role.DIRECTEUR) return EvaluationStatus.VALIDE_SERVICE;
        return EvaluationStatus.VALIDE_DIRECTEUR; 
    };

    const [statusFilter, setStatusFilter] = useState<string>(getDefaultStatus());
    const [deptFilter, setDeptFilter] = useState<string>('ALL');

    useEffect(() => {
        setEvaluations(db.getEvaluations());
    }, []);

    const isDRH = user.role === Role.DRH || user.role === Role.ADMIN;

    // Filtrage avancé des données
    const filteredEvals = useMemo(() => {
        return evaluations.filter(ev => {
            const agent = db.getUserById(ev.agentId);
            if (!agent) return false;
            if (ev.annee !== selectedYear) return false;
            
            // Filtre de périmètre (Hiérarchie)
            if (user.role === Role.CHEF_SERVICE && agent.service !== user.service) return false;
            if (user.role === Role.DIRECTEUR && agent.departement !== user.departement) return false;
            
            // Filtre par Statut (Workflow)
            if (ev.statut === EvaluationStatus.BROUILLON) return false; // Jamais de brouillon ici
            if (statusFilter !== 'ALL' && ev.statut !== statusFilter) return false;
            
            // Filtre par Direction (DRH uniquement)
            if (isDRH && deptFilter !== 'ALL' && agent.departement !== deptFilter) return false;
            
            // Filtre par Recherche (Nom/Matricule)
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                const fullName = `${agent.nom} ${agent.prenom}`.toLowerCase();
                return fullName.includes(search) || agent.matricule.toLowerCase().includes(search);
            }
            
            return true;
        });
    }, [evaluations, user, selectedYear, statusFilter, deptFilter, isDRH, searchTerm]);

    // Groupement par département pour la vue DRH
    const groupedData = useMemo(() => {
        if (!isDRH) return null;
        
        const groups: Record<string, { evals: Evaluation[], avgScore: number }> = {};
        
        filteredEvals.forEach(ev => {
            const agent = db.getUserById(ev.agentId);
            if (!agent) return;
            const dept = agent.departement;
            
            if (!groups[dept]) groups[dept] = { evals: [], avgScore: 0 };
            groups[dept].evals.push(ev);
        });

        Object.keys(groups).forEach(dept => {
            const group = groups[dept];
            group.evals.sort((a, b) => b.noteGlobale - a.noteGlobale);
            const sum = group.evals.reduce((acc, curr) => acc + curr.noteGlobale, 0);
            group.avgScore = parseFloat((sum / group.evals.length).toFixed(1));
        });

        return groups;
    }, [filteredEvals, isDRH]);

    const getStatusInfo = (status: EvaluationStatus) => {
        switch (status) {
            case EvaluationStatus.SOUMIS: 
                return { label: 'Attente Chef Service', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'fa-user-clock' };
            case EvaluationStatus.VALIDE_SERVICE: 
                return { label: 'Attente Directeur', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: 'fa-signature' };
            case EvaluationStatus.VALIDE_DIRECTEUR: 
                return { label: 'Attente DRH', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: 'fa-check-double' };
            case EvaluationStatus.VALIDE_DRH: 
                return { label: 'Validé Final', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'fa-award' };
            case EvaluationStatus.REJETE: 
                return { label: 'Rejeté', color: 'bg-red-100 text-red-700 border-red-200', icon: 'fa-times-circle' };
            default: 
                return { label: status, color: 'bg-gray-100 text-gray-700 border-gray-200', icon: 'fa-file' };
        }
    };

    const renderEvalCard = (ev: Evaluation) => {
        const agent = db.getUserById(ev.agentId);
        if (!agent) return null;
        
        const scoreColor = ev.noteGlobale >= 85 ? 'text-emerald-600' : ev.noteGlobale >= 70 ? 'text-pal-500' : 'text-amber-600';
        const { label, color, icon } = getStatusInfo(ev.statut);
        const isActionRequired = ev.statut === getDefaultStatus();

        return (
            <div key={ev.id} className={`bg-white rounded-[2rem] shadow-xl border overflow-hidden group hover:border-pal-500 transition-all duration-300 flex flex-col relative ${isActionRequired ? 'border-pal-500/30 ring-2 ring-pal-500/5' : 'border-slate-100'}`}>
                {isActionRequired && (
                    <div className="absolute top-0 right-0 bg-pal-yellow text-pal-900 text-[8px] font-black px-4 py-1 rounded-bl-2xl shadow-sm uppercase tracking-tighter">
                        <i className="fas fa-bolt mr-1"></i> Action Requise
                    </div>
                )}
                
                <div className="p-6 pt-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-pal-500 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-pal-500/20">
                            {agent.nom[0]}
                        </div>
                        <div className="overflow-hidden">
                            <h3 className="font-black text-slate-800 text-sm truncate leading-tight">{agent.nom} {agent.prenom}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{agent.matricule}</p>
                        </div>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-2 text-slate-500">
                            <i className="fas fa-briefcase text-[10px] w-4"></i>
                            <span className="text-[11px] font-bold truncate">{agent.fonction}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                            <i className="fas fa-sitemap text-[10px] w-4"></i>
                            <span className="text-[10px] font-medium truncate">{agent.service || agent.departement}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Score /100</p>
                            <p className={`text-2xl font-black ${scoreColor}`}>{ev.noteGlobale}</p>
                        </div>
                        <button 
                            onClick={() => navigate(`/evaluation/${ev.id}`)} 
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all duration-300 shadow-md ${isActionRequired ? 'bg-pal-500 text-white hover:bg-pal-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                        >
                            Examiner <i className="fas fa-chevron-right ml-2"></i>
                        </button>
                    </div>
                </div>
                
                <div className={`px-6 py-2 border-t text-[9px] font-black uppercase flex items-center gap-2 ${color}`}>
                    <i className={`fas ${icon}`}></i> {label}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-fade-in-up pb-20">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-extrabold text-pal-500 tracking-tight">Espace de Validation</h2>
                    <p className="text-slate-400 font-medium italic">Traitement des dossiers du personnel • Port Autonome de Lomé</p>
                </div>

                <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
                    {[selectedYear - 1, selectedYear].map(year => (
                        <button 
                            key={year}
                            onClick={() => setSelectedYear(year)}
                            className={`px-5 py-2 rounded-xl text-xs font-black transition ${selectedYear === year ? 'bg-pal-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {year}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    {/* Search Input */}
                    <div className="relative flex-1 w-full">
                        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                        <input 
                            type="text" 
                            placeholder="Rechercher un collaborateur par nom ou matricule..." 
                            className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm text-slate-700 transition"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Department Select (DRH) */}
                    {isDRH && (
                        <div className="w-full md:w-64">
                            <select 
                                value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-pal-500 font-black text-xs uppercase text-slate-500 appearance-none cursor-pointer"
                            >
                                <option value="ALL">Toutes Directions</option>
                                {DEPARTEMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {/* Status Chips Selector */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mr-2">Filtrer par statut :</span>
                    {[
                        { val: getDefaultStatus(), label: 'À Traiter' },
                        { val: 'ALL', label: 'Tout voir' },
                        { val: EvaluationStatus.SOUMIS, label: 'Soumis' },
                        { val: EvaluationStatus.VALIDE_SERVICE, label: 'Validé Service' },
                        { val: EvaluationStatus.VALIDE_DIRECTEUR, label: 'Validé Direction' },
                        { val: EvaluationStatus.VALIDE_DRH, label: 'Finalisés' },
                        { val: EvaluationStatus.REJETE, label: 'Dossiers Rejetés' },
                    ].map((status) => (
                        <button
                            key={`${status.val}-${status.label}`}
                            onClick={() => setStatusFilter(status.val)}
                            className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-tight transition-all duration-300 border ${
                                statusFilter === status.val 
                                ? 'bg-pal-500 text-white border-pal-500 shadow-lg scale-105' 
                                : 'bg-white text-slate-400 border-slate-100 hover:border-pal-500/30'
                            }`}
                        >
                            {status.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results Section */}
            {isDRH && groupedData && Object.keys(groupedData).length > 0 ? (
                <div className="space-y-12">
                    {Object.entries(groupedData).map(([dept, group]: [string, { evals: Evaluation[], avgScore: number }]) => (
                        <div key={dept} className="animate-fade-in-up">
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-pal-500 text-white flex items-center justify-center text-xl shadow-lg">
                                        <i className="fas fa-layer-group"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{dept}</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-2 h-2 bg-pal-yellow rounded-full animate-pulse"></span>
                                            {group.evals.length} Dossiers trouvés
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Moyenne Direction</p>
                                    <p className="text-3xl font-black text-pal-500">{group.avgScore}<span className="text-xs opacity-40 ml-1">/100</span></p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {group.evals.map(renderEvalCard)}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredEvals.map(renderEvalCard)}
                    {filteredEvals.length === 0 && (
                        <div className="col-span-full py-32 text-center bg-white rounded-[4rem] border-2 border-dashed border-slate-100 animate-pulse">
                            <i className="fas fa-search text-slate-100 text-8xl mb-8"></i>
                            <h4 className="text-2xl font-black text-slate-400 uppercase tracking-widest">Aucun résultat</h4>
                            <p className="text-slate-300 font-medium italic mt-2">Essayez de modifier vos filtres ou vos termes de recherche.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Validations;
