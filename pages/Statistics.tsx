
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/database';
import { User, Evaluation, EvaluationStatus, Role, DEPARTEMENTS } from '../types';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useToast } from '../context/ToastContext';

const Statistics = ({ user }: { user: User }) => {
    const { showToast } = useToast();
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);

    // FILTRES
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [deptFilter, setDeptFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        setEvaluations(db.getEvaluations());
        setUsers(db.getUsers());
        setCampaigns(db.getCampaigns());
    }, []);

    const years = useMemo(() => Array.from(new Set(evaluations.map(e => e.annee))).sort((a: number, b: number) => b - a), [evaluations]);

    // FILTRAGE DES DONNÉES
    const filteredData = useMemo(() => {
        return evaluations.filter(ev => {
            const agent = users.find(u => u.id === ev.agentId);
            if (!agent) return false;
            
            const matchYear = ev.annee === selectedYear;
            const matchDept = deptFilter === 'ALL' || agent.departement === deptFilter;
            const matchStatus = statusFilter === 'ALL' || ev.statut === statusFilter;
            const matchSearch = !searchTerm || 
                `${agent.nom} ${agent.prenom}`.toLowerCase().includes(searchTerm.toLowerCase()) || 
                agent.matricule.toLowerCase().includes(searchTerm.toLowerCase());

            return matchYear && matchDept && matchStatus && matchSearch;
        });
    }, [evaluations, users, selectedYear, deptFilter, statusFilter, searchTerm]);

    // CALCULS KPI
    const kpis = useMemo(() => {
        const total = filteredData.length;
        const finalized = filteredData.filter(e => e.statut === EvaluationStatus.VALIDE_DRH).length;
        const avg = total > 0 ? (filteredData.reduce((acc, curr) => acc + curr.noteGlobale, 0) / total).toFixed(1) : "0.0";
        const completionRate = total > 0 ? Math.round((finalized / total) * 100) : 0;
        
        return { total, finalized, avg, completionRate };
    }, [filteredData]);

    // GRAPH: RÉPARTITION PAR STATUT
    const statusChartData = {
        labels: ['Brouillon', 'Soumis', 'En Validation', 'Finalisé', 'Rejeté'],
        datasets: [{
            data: [
                filteredData.filter(e => e.statut === EvaluationStatus.BROUILLON).length,
                filteredData.filter(e => e.statut === EvaluationStatus.SOUMIS).length,
                filteredData.filter(e => e.statut === EvaluationStatus.VALIDE_SERVICE || e.statut === EvaluationStatus.VALIDE_DIRECTEUR).length,
                filteredData.filter(e => e.statut === EvaluationStatus.VALIDE_DRH).length,
                filteredData.filter(e => e.statut === EvaluationStatus.REJETE).length,
            ],
            backgroundColor: ['#cbd5e1', '#3b82f6', '#818cf8', '#10b981', '#ef4444'],
            borderWidth: 0,
        }]
    };

    // GRAPH: MOYENNES PAR DIRECTION
    const deptComparisonData = useMemo(() => {
        const stats = DEPARTEMENTS.map(dept => {
            const deptEvals = evaluations.filter(e => {
                const u = users.find(usr => usr.id === e.agentId);
                return u && u.departement === dept && e.annee === selectedYear;
            });
            const avg = deptEvals.length > 0 ? (deptEvals.reduce((a, b) => a + b.noteGlobale, 0) / deptEvals.length) : 0;
            return { name: dept, avg: parseFloat(avg.toFixed(1)) };
        }).sort((a,b) => b.avg - a.avg);

        return {
            labels: stats.map(s => s.name.length > 15 ? s.name.substring(0, 12) + '...' : s.name),
            datasets: [{
                label: 'Note Moyenne /100',
                data: stats.map(s => s.avg),
                backgroundColor: '#1B296F',
                borderRadius: 4
            }]
        };
    }, [evaluations, users, selectedYear]);

    // EXPORT CSV
    const exportToCSV = () => {
        if (filteredData.length === 0) return showToast("Aucune donnée à exporter", "warning");

        const headers = ["Matricule", "Nom", "Prénom", "Direction", "Service", "Année", "Score", "Statut", "Appréciation"];
        const rows = filteredData.map(ev => {
            const agent = users.find(u => u.id === ev.agentId);
            return [
                agent?.matricule || "",
                agent?.nom || "",
                agent?.prenom || "",
                agent?.departement || "",
                agent?.service || "",
                ev.annee,
                ev.noteGlobale,
                ev.statut,
                ev.appreciationFinale || ""
            ];
        });

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `PAL_STATS_${selectedYear}_${deptFilter.replace(/\s/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Export CSV généré avec succès");
    };

    return (
        <div className="space-y-8 animate-fade-in-up pb-20">
            <header className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-6">
                <div>
                    <h2 className="text-3xl font-black text-pal-500 tracking-tight uppercase italic">Pilotage RH & Décisionnel</h2>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Données consolidées du Port Autonome de Lomé</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={exportToCSV}
                        className="bg-emerald-500 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                    >
                        <i className="fas fa-file-excel"></i> Export Excel (CSV)
                    </button>
                    <button 
                        onClick={() => window.print()}
                        className="bg-white text-slate-500 border border-slate-200 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition flex items-center gap-2"
                    >
                        <i className="fas fa-print"></i> Rapport PDF
                    </button>
                </div>
            </header>

            {/* FILTRES STRATÉGIQUES */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Année Fiscale</label>
                    <select 
                        value={selectedYear} 
                        onChange={e => setSelectedYear(parseInt(e.target.value))}
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm appearance-none"
                    >
                        {years.length > 0 ? years.map(y => <option key={y} value={y}>{y}</option>) : <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Direction / Unité</label>
                    <select 
                        value={deptFilter} 
                        onChange={e => setDeptFilter(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm appearance-none"
                    >
                        <option value="ALL">Tout le Port</option>
                        {DEPARTEMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Statut Dossiers</label>
                    <select 
                        value={statusFilter} 
                        onChange={e => setStatusFilter(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm appearance-none"
                    >
                        <option value="ALL">Tous les statuts</option>
                        {Object.values(EvaluationStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Recherche Rapide</label>
                    <div className="relative">
                        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                        <input 
                            type="text" 
                            placeholder="Nom ou Matricule..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-5 py-3.5 outline-none focus:ring-2 focus:ring-pal-500 font-bold text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Effectif Cible', val: kpis.total, icon: 'fa-users', color: 'bg-blue-500' },
                    { label: 'Taux de Complétion', val: `${kpis.completionRate}%`, icon: 'fa-check-double', color: 'bg-emerald-500' },
                    { label: 'Performance Moy.', val: kpis.avg, icon: 'fa-star', color: 'bg-pal-500' },
                    { label: 'Dossiers Finalisés', val: kpis.finalized, icon: 'fa-award', color: 'bg-pal-yellow text-pal-900' },
                ].map((k, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-50 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{k.label}</p>
                            <h4 className="text-3xl font-black mt-2">{k.val}</h4>
                        </div>
                        <div className={`w-14 h-14 rounded-2xl ${k.color} ${!k.color.includes('text') ? 'text-white' : ''} flex items-center justify-center text-xl shadow-lg`}>
                            <i className={`fas ${k.icon}`}></i>
                        </div>
                    </div>
                ))}
            </div>

            {/* CHART ANALYTICS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                    <h3 className="text-sm font-black text-pal-500 mb-8 border-b pb-4 uppercase tracking-[0.2em] italic">Progression Workflow</h3>
                    <div className="h-64 flex justify-center items-center relative">
                        <Doughnut data={statusChartData} options={{ cutout: '75%', plugins: { legend: { display: false } } }} />
                        <div className="absolute text-center">
                            <p className="text-3xl font-black text-pal-500 leading-none">{kpis.total}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Total</p>
                        </div>
                    </div>
                    <div className="mt-8 grid grid-cols-2 gap-3">
                         {statusChartData.labels.map((l, i) => (
                             <div key={i} className="flex items-center gap-2">
                                 <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusChartData.datasets[0].backgroundColor[i] }}></span>
                                 <span className="text-[9px] font-bold text-slate-500 uppercase truncate">{l}</span>
                             </div>
                         ))}
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                    <h3 className="text-sm font-black text-pal-500 mb-8 border-b pb-4 uppercase tracking-[0.2em] italic">Benchmark Inter-Directions {selectedYear}</h3>
                    <div className="h-80">
                        <Bar 
                            data={deptComparisonData} 
                            options={{ 
                                maintainAspectRatio: false, 
                                plugins: { legend: { display: false } },
                                scales: { 
                                    y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' } },
                                    x: { grid: { display: false } }
                                } 
                            }} 
                        />
                    </div>
                </div>
            </div>

            {/* DETAILED DATA TABLE */}
            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                    <h3 className="text-sm font-black text-pal-500 uppercase tracking-[0.2em] italic">Rapport de Performance Détaillé</h3>
                    <span className="text-[10px] font-black bg-slate-50 text-slate-400 px-4 py-1 rounded-full uppercase">{filteredData.length} Dossiers filtrés</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                            <tr>
                                <th className="px-8 py-5">Personnel</th>
                                <th className="px-8 py-5">Affectation</th>
                                <th className="px-8 py-5 text-center">Score</th>
                                <th className="px-8 py-5">Statut</th>
                                <th className="px-8 py-5">Appréciation</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredData.map(ev => {
                                const agent = users.find(u => u.id === ev.agentId);
                                if (!agent) return null;
                                return (
                                    <tr key={ev.id} className="hover:bg-slate-50/50 transition group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-pal-500 text-white flex items-center justify-center text-[10px] font-black uppercase">{agent.nom[0]}</div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-800">{agent.nom} {agent.prenom}</p>
                                                    <p className="text-[9px] font-mono text-slate-400 uppercase">{agent.matricule}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-[10px] font-black text-slate-700 uppercase">{agent.departement}</p>
                                            <p className="text-[9px] text-slate-400 font-bold italic mt-0.5">{agent.service || '-'}</p>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`text-sm font-black ${ev.noteGlobale >= 80 ? 'text-emerald-500' : ev.noteGlobale >= 50 ? 'text-pal-500' : 'text-red-500'}`}>
                                                {ev.noteGlobale}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase border ${
                                                ev.statut === EvaluationStatus.VALIDE_DRH ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                                ev.statut === EvaluationStatus.REJETE ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                                            }`}>
                                                {ev.statut}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-[10px] font-bold text-slate-500 italic">{ev.appreciationFinale || '-'}</p>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center text-slate-300 italic font-medium">Aucune donnée correspondant aux filtres sélectionnés.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Statistics;
