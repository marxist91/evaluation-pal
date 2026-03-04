
import React, { useState, useEffect, useMemo } from 'react';
import { User, Evaluation, EvaluationStatus, Campaign, Role, DEPARTEMENTS } from '../types';
import { db } from '../services/database';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';

const Dashboard = ({ user }: { user: User }) => {
    const navigate = useNavigate();
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);

    useEffect(() => {
        setEvaluations(db.getEvaluations());
        setCampaigns(db.getCampaigns());
        setAllUsers(db.getUsers());
    }, []);

    const isDRH = user.role === Role.DRH || user.role === Role.ADMIN;
    const isAgent = user.role === Role.AGENT;
    const isDirecteur = user.role === Role.DIRECTEUR;
    const isChefService = user.role === Role.CHEF_SERVICE;

    const activeCampaign = useMemo(() => campaigns.find(c => c.statut === 'ACTIVE'), [campaigns]);
    const currentYear = useMemo(() => activeCampaign?.annee || new Date().getFullYear(), [activeCampaign]);

    // 1. Périmètre de données restreint
    const visibleEvaluations = useMemo(() => {
        if (isDRH) return evaluations;
        if (isDirecteur) return evaluations.filter(ev => allUsers.find(u => u.id === ev.agentId)?.departement === user.departement);
        if (isChefService) return evaluations.filter(ev => allUsers.find(u => u.id === ev.agentId)?.service === user.service);
        return evaluations.filter(e => e.agentId === user.id);
    }, [evaluations, allUsers, user, isDRH, isDirecteur, isChefService]);

    const actionRequiredCount = useMemo(() => {
        if (isChefService) return evaluations.filter(ev => allUsers.find(u => u.id === ev.agentId)?.service === user.service && ev.statut === EvaluationStatus.SOUMIS).length;
        if (isDirecteur) return evaluations.filter(ev => allUsers.find(u => u.id === ev.agentId)?.departement === user.departement && ev.statut === EvaluationStatus.VALIDE_SERVICE).length;
        if (isDRH) return evaluations.filter(ev => ev.statut === EvaluationStatus.VALIDE_DIRECTEUR).length;
        if (isAgent) return evaluations.filter(ev => ev.agentId === user.id && (ev.statut === EvaluationStatus.BROUILLON || ev.statut === EvaluationStatus.REJETE)).length;
        return 0;
    }, [evaluations, allUsers, user, isChefService, isDirecteur, isDRH, isAgent]);

    const myCurrentEval = useMemo(() => evaluations.find(e => e.agentId === user.id && e.annee === currentYear), [evaluations, user, currentYear]);

    // 2. Statistiques de Pilotage par Direction (Pour DRH)
    const detailedDeptStats = useMemo(() => {
        if (!isDRH) return [];
        return DEPARTEMENTS.map(dept => {
            const deptUsers = allUsers.filter(u => u.departement === dept);
            const deptEvals = evaluations.filter(e => {
                const u = allUsers.find(usr => usr.id === e.agentId);
                return u && u.departement === dept && e.annee === currentYear;
            });

            return {
                name: dept,
                totalStaff: deptUsers.length,
                totalEvals: deptEvals.length,
                finalized: deptEvals.filter(e => e.statut === EvaluationStatus.VALIDE_DRH).length,
                avgScore: deptEvals.length > 0 ? parseFloat((deptEvals.reduce((a, b) => a + b.noteGlobale, 0) / deptEvals.length).toFixed(1)) : 0,
                progress: deptUsers.length > 0 ? Math.round((deptEvals.length / deptUsers.length) * 100) : 0
            };
        }).sort((a, b) => b.totalStaff - a.totalStaff);
    }, [allUsers, evaluations, isDRH, currentYear]);

    // 3. Statistiques par Service (Pour Directeur)
    const detailedServiceStats = useMemo(() => {
        if (!isDirecteur) return [];
        const myServices = db.getServicesByDepartment(user.departement);
        return myServices.map(srv => {
            const srvEvals = evaluations.filter(e => {
                const u = allUsers.find(usr => usr.id === e.agentId);
                return u && u.departement === user.departement && u.service === srv && e.annee === currentYear;
            });
            const avg = srvEvals.length > 0 ? (srvEvals.reduce((a, b) => a + b.noteGlobale, 0) / srvEvals.length) : 0;
            return { name: srv, avgScore: parseFloat(avg.toFixed(1)) };
        });
    }, [allUsers, evaluations, isDirecteur, user.departement, currentYear]);

    // 4. Statistiques par Agent (Pour Chef de Service)
    const detailedAgentStats = useMemo(() => {
        if (!isChefService) return [];
        const myAgentsEvals = evaluations.filter(e => {
            const u = allUsers.find(usr => usr.id === e.agentId);
            return u && u.service === user.service && e.annee === currentYear;
        });
        return myAgentsEvals.map(e => {
            const ag = allUsers.find(u => u.id === e.agentId);
            return { name: ag ? ag.nom : 'Inconnu', score: e.noteGlobale };
        }).sort((a,b) => b.score - a.score);
    }, [allUsers, evaluations, isChefService, user.service, currentYear]);

    // 5. Configuration Graphique Principal
    const mainChartData = useMemo(() => {
        if (isAgent) {
            const myHistory = evaluations.filter(e => e.agentId === user.id).sort((a,b) => a.annee - b.annee);
            return {
                type: 'line' as const,
                title: 'Ma Progression (Note Globale)',
                data: {
                    labels: myHistory.map(e => e.annee.toString()),
                    datasets: [{
                        label: 'Ma Note',
                        data: myHistory.map(e => e.noteGlobale),
                        borderColor: '#1B296F',
                        backgroundColor: 'rgba(27, 41, 111, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                }
            };
        }

        if (isChefService) {
            return {
                type: 'bar' as const,
                title: `Performance du Service : ${user.service}`,
                data: {
                    labels: detailedAgentStats.map(a => a.name),
                    datasets: [{
                        label: 'Note /100',
                        data: detailedAgentStats.map(a => a.score),
                        backgroundColor: '#1B296F',
                        borderRadius: 8
                    }]
                }
            };
        }

        if (isDirecteur) {
            return {
                type: 'bar' as const,
                title: `Performance par Service - Direction : ${user.departement}`,
                data: {
                    labels: detailedServiceStats.map(s => s.name),
                    datasets: [{
                        label: 'Moyenne /100',
                        data: detailedServiceStats.map(s => s.avgScore),
                        backgroundColor: '#1B296F',
                        borderRadius: 8
                    }]
                }
            };
        }

        // DRH / Admin
        return {
            type: 'bar' as const,
            title: 'Performance Comparée des Directions (PAL)',
            data: {
                labels: detailedDeptStats.slice(0, 8).map(d => d.name),
                datasets: [{
                    label: 'Moyenne /100',
                    data: detailedDeptStats.slice(0, 8).map(d => d.avgScore),
                    backgroundColor: '#1B296F',
                    borderRadius: 8
                }]
            }
        };
    }, [user, evaluations, isAgent, isChefService, isDirecteur, detailedAgentStats, detailedServiceStats, detailedDeptStats]);

    const doughnutData = {
        labels: ['Brouillon', 'Soumis', 'Validé Service', 'Validé Dir.', 'Finalisé', 'Rejeté'],
        datasets: [{
            data: [
                visibleEvaluations.filter(e => e.statut === EvaluationStatus.BROUILLON).length,
                visibleEvaluations.filter(e => e.statut === EvaluationStatus.SOUMIS).length,
                visibleEvaluations.filter(e => e.statut === EvaluationStatus.VALIDE_SERVICE).length,
                visibleEvaluations.filter(e => e.statut === EvaluationStatus.VALIDE_DIRECTEUR).length,
                visibleEvaluations.filter(e => e.statut === EvaluationStatus.VALIDE_DRH).length,
                visibleEvaluations.filter(e => e.statut === EvaluationStatus.REJETE).length,
            ],
            backgroundColor: ['#cbd5e1', '#3b82f6', '#6366f1', '#a855f7', '#10b981', '#ef4444'],
            borderWidth: 0,
        }]
    };

    const renderWorkflowTracker = () => {
        if (!myCurrentEval) return null;
        const s = myCurrentEval.statut;
        let activeIdx = 0;
        if (s === EvaluationStatus.SOUMIS) activeIdx = 1;
        else if (s === EvaluationStatus.VALIDE_SERVICE) activeIdx = 2;
        else if (s === EvaluationStatus.VALIDE_DIRECTEUR) activeIdx = 3;
        else if (s === EvaluationStatus.VALIDE_DRH) activeIdx = 4;
        
        return (
            <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-pal-500/5 mb-8 border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <i className="fas fa-anchor text-8xl text-pal-500"></i>
                </div>
                <h3 className="text-xl font-extrabold text-pal-500 mb-8 flex items-center">
                    <i className="fas fa-ship mr-3"></i> Parcours de mon évaluation {myCurrentEval.annee}
                </h3>
                <div className="relative">
                    <div className="absolute top-5 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 rounded-full"></div>
                    <div className="absolute top-5 left-0 h-1 bg-pal-500 -translate-y-1/2 rounded-full transition-all duration-700" style={{ width: `${(activeIdx / 4) * 100}%` }}></div>
                    <div className="relative flex justify-between">
                        {['Rédaction', 'C. Service', 'Directeur', 'Finalisation', 'Dossier Clos'].map((label, idx) => (
                            <div key={idx} className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 border-4 transition ${idx < activeIdx ? 'bg-pal-500 text-white border-pal-500' : idx === activeIdx ? 'bg-pal-yellow text-pal-900 border-white ring-4 ring-pal-yellow/20' : 'bg-white text-slate-300 border-slate-100'}`}>
                                    <i className={`fas ${idx === 0 ? 'fa-pencil-alt' : idx === 1 ? 'fa-user-check' : idx === 2 ? 'fa-signature' : idx === 3 ? 'fa-check-double' : 'fa-award'} text-xs`}></i>
                                </div>
                                <p className="mt-4 text-[10px] font-black uppercase text-center max-w-[80px] text-slate-400">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderCongratsPanel = () => {
        if (!isAgent || !myCurrentEval || myCurrentEval.statut !== EvaluationStatus.VALIDE_DRH) return null;

        return (
            <div className="bg-gradient-to-br from-pal-yellow to-amber-300 p-8 rounded-[2.5rem] shadow-2xl shadow-pal-yellow/20 mb-8 border border-white/50 relative overflow-hidden animate-fade-in-up">
                <div className="absolute top-0 right-0 p-10 opacity-10">
                    <i className="fas fa-medal text-[12rem] text-pal-900 rotate-12"></i>
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                    <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center text-4xl text-pal-900 shadow-xl border-4 border-white">
                        <i className="fas fa-trophy"></i>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-2xl font-black text-pal-900 uppercase tracking-tight italic mb-2">Félicitations, {user.prenom} !</h3>
                        <p className="text-pal-900/70 font-bold max-w-lg leading-relaxed">
                            Votre évaluation de l'année <span className="font-black underline">{myCurrentEval.annee}</span> est maintenant terminée et validée par la Direction Générale.
                        </p>
                    </div>
                    <div className="bg-white/40 backdrop-blur-md p-6 rounded-[2rem] border border-white flex flex-col items-center min-w-[150px]">
                        <p className="text-[10px] font-black text-pal-900/50 uppercase tracking-widest mb-1">Note Finale</p>
                        <p className="text-5xl font-black text-pal-900">{myCurrentEval.noteGlobale}<span className="text-sm opacity-50">/100</span></p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-fade-in-up pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-pal-500 tracking-tight">Bonjour, {user.prenom}</h2>
                    <p className="text-slate-400 font-medium italic">
                        {isAgent ? "Espace Personnel • Consultant" : isChefService ? `Management Service : ${user.service}` : isDirecteur ? `Direction : ${user.departement}` : "Pilotage Stratégique des Ressources Humaines"}
                    </p>
                </div>
                <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-2">
                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse ml-2"></span>
                    <span className="text-xs font-black text-pal-500 uppercase mr-2 tracking-tighter">Suivi en Temps Réel</span>
                </div>
            </header>

            {isAgent && renderCongratsPanel()}
            {isAgent && renderWorkflowTracker()}

            {/* KPI Stratégiques du périmètre */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div 
                    onClick={() => navigate(isAgent ? '/my-evaluation' : '/validations')}
                    className={`p-6 rounded-[2rem] shadow-xl transition transform hover:scale-[1.02] cursor-pointer relative overflow-hidden ${actionRequiredCount > 0 ? 'bg-pal-yellow shadow-pal-yellow/20' : 'bg-white border border-slate-100'}`}
                >
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actions en attente</p>
                            <h4 className={`text-4xl font-black mt-2 ${actionRequiredCount > 0 ? 'text-pal-900' : 'text-pal-500'}`}>{actionRequiredCount}</h4>
                        </div>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${actionRequiredCount > 0 ? 'bg-pal-900 text-pal-yellow' : 'bg-pal-50 text-pal-500'}`}>
                            <i className="fas fa-clipboard-list"></i>
                        </div>
                    </div>
                </div>
                {[
                    { label: 'Dossiers périmètre', val: visibleEvaluations.length, icon: 'fa-file-invoice', color: 'bg-blue-50 text-blue-500' },
                    { label: 'Taux Complétion', val: `${visibleEvaluations.length > 0 ? Math.round((visibleEvaluations.filter(e => e.statut === EvaluationStatus.VALIDE_DRH).length / visibleEvaluations.length) * 100) : 0}%`, icon: 'fa-chart-line', color: 'bg-emerald-50 text-emerald-500' },
                    { label: 'Moyenne Section', val: visibleEvaluations.length > 0 ? (visibleEvaluations.reduce((a,b) => a + b.noteGlobale, 0) / visibleEvaluations.length).toFixed(1) : '0.0', icon: 'fa-star', color: 'bg-amber-50 text-amber-500' }
                ].map((kpi, i) => (
                    <div key={i} className="p-6 rounded-[2rem] shadow-xl bg-white border border-slate-100 group transition hover:border-pal-500/20">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{kpi.label}</p>
                                <h4 className="text-4xl font-black text-pal-500 mt-2">{kpi.val}</h4>
                            </div>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${kpi.color}`}>
                                <i className={`fas ${kpi.icon}`}></i>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* État des dossiers du périmètre */}
                <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                    <h3 className="text-lg font-black text-pal-500 mb-8 border-b pb-4 uppercase tracking-tighter italic">Workflow Périmètre</h3>
                    <div className="h-64 flex justify-center items-center relative">
                        <Doughnut data={doughnutData} options={{ cutout: '70%', plugins: { legend: { display: false } } }} />
                        <div className="absolute text-center">
                            <p className="text-3xl font-black text-pal-500 leading-none">{visibleEvaluations.length}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Dossiers</p>
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                         <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-pal-500"></span><span className="text-[9px] font-bold text-slate-500 uppercase">Validés</span></div>
                         <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500"></span><span className="text-[9px] font-bold text-slate-500 uppercase">En cours</span></div>
                    </div>
                </div>

                {/* Graphique Dynamique selon le rôle */}
                <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                    <h3 className="text-lg font-black text-pal-500 mb-8 border-b pb-4 flex justify-between items-center uppercase tracking-tighter italic">
                        <span>{mainChartData.title}</span>
                    </h3>
                    <div className="h-80">
                        {mainChartData.type === 'line' ? (
                            <Line data={mainChartData.data as any} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                        ) : (
                            <Bar data={mainChartData.data as any} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
