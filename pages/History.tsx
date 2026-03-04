
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/database';
import { User, Evaluation, Role, EvaluationStatus } from '../types';
import { Line, Bar } from 'react-chartjs-2';

const History = ({ user }: { user: User }) => {
    const navigate = useNavigate();
    
    // TABS
    const [activeTab, setActiveTab] = useState<'MY_HISTORY' | 'ARCHIVES'>('MY_HISTORY');
    
    // DATA
    const [myHistory, setMyHistory] = useState<Evaluation[]>([]);
    const [archives, setArchives] = useState<Evaluation[]>([]);
    const [usersMap, setUsersMap] = useState<Record<string, User>>({});

    // FILTERS
    const [archiveSearch, setArchiveSearch] = useState("");
    const [archiveYear, setArchiveYear] = useState<string>('ALL');

    // L'Admin a aussi le droit de voir les archives
    const canViewArchives = [Role.DRH, Role.DIRECTEUR, Role.CHEF_SERVICE, Role.ADMIN].includes(user.role);

    useEffect(() => {
        const allUsers = db.getUsers();
        const userMap: Record<string, User> = {};
        allUsers.forEach(u => userMap[u.id] = u);
        setUsersMap(userMap);

        const allEvals = db.getEvaluations();

        // 1. Mon Historique
        const mine = allEvals.filter(e => e.agentId === user.id && e.noteGlobale > 0).sort((a,b) => b.annee - a.annee);
        setMyHistory(mine);

        // Si l'utilisateur n'a pas d'historique perso mais a accès aux archives, on switch par défaut (UX)
        if (mine.length === 0 && canViewArchives) {
            setActiveTab('ARCHIVES');
        }

        // 2. Archives (Pour Managers/DRH/Admin)
        if (canViewArchives) {
            const archivedEvals = allEvals.filter(e => {
                // On ne montre que les dossiers terminés/validés dans les archives
                // Ou au moins validés par le service pour avoir de la donnée pertinente
                if (e.statut !== EvaluationStatus.VALIDE_DRH && e.statut !== EvaluationStatus.VALIDE_DIRECTEUR && e.statut !== EvaluationStatus.VALIDE_SERVICE) return false;
                
                const agent = userMap[e.agentId];
                if (!agent) return false;

                // Scope Filter
                if (user.role === Role.DRH || user.role === Role.ADMIN) return true; // Tout voir
                if (user.role === Role.DIRECTEUR) return agent.departement === user.departement;
                if (user.role === Role.CHEF_SERVICE) return agent.service === user.service;
                
                return false;
            }).sort((a,b) => b.annee - a.annee);
            
            setArchives(archivedEvals);
        }

    }, [user, canViewArchives]);

    // Données Charts (Mon Historique)
    const lineChartData = {
        labels: [...myHistory].reverse().map(e => e.annee),
        datasets: [{
            label: 'Ma Note Globale',
            data: [...myHistory].reverse().map(e => e.noteGlobale),
            borderColor: '#0ea5e9',
            backgroundColor: 'rgba(14, 165, 233, 0.2)',
            tension: 0.3,
            fill: true
        }]
    };

    const barChartData = useMemo(() => {
        const APPRECIATION_ORDER = ['Excellente', 'Très positive', 'Positive', 'Satisfaisante', 'A améliorer', 'Insuffisante'];
        const counts: Record<string, number> = {};
        myHistory.forEach(ev => {
            if (ev.appreciationFinale) counts[ev.appreciationFinale] = (counts[ev.appreciationFinale] || 0) + 1;
        });
        const sortedLabels = Object.keys(counts).sort((a, b) => {
            const idxA = APPRECIATION_ORDER.indexOf(a);
            const idxB = APPRECIATION_ORDER.indexOf(b);
            if (idxA === -1) return 1; if (idxB === -1) return -1;
            return idxA - idxB;
        });

        return {
            labels: sortedLabels,
            datasets: [{
                label: "Fréquence",
                data: sortedLabels.map(l => counts[l]),
                backgroundColor: ['#10b981', '#34d399', '#60a5fa', '#fbbf24', '#f87171', '#ef4444', '#9ca3af'],
                borderRadius: 4,
                barPercentage: 0.6
            }]
        };
    }, [myHistory]);

    // Filtered Archives
    const filteredArchives = archives.filter(ev => {
        const agent = usersMap[ev.agentId];
        const searchMatch = !archiveSearch || 
            (agent && (
                agent.nom.toLowerCase().includes(archiveSearch.toLowerCase()) || 
                agent.prenom.toLowerCase().includes(archiveSearch.toLowerCase()) ||
                agent.matricule.toLowerCase().includes(archiveSearch.toLowerCase())
            ));
        const yearMatch = archiveYear === 'ALL' || ev.annee === parseInt(archiveYear);
        return searchMatch && yearMatch;
    });
    
    const availableArchiveYears = Array.from(new Set(archives.map(a => a.annee))).sort((a: number, b: number) => b - a);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">
                    {activeTab === 'MY_HISTORY' ? 'Mon Dossier Personnel' : 'Archives & Historique Équipe'}
                </h2>
                {canViewArchives && (
                    <div className="flex bg-gray-200 rounded-lg p-1">
                        <button 
                            onClick={() => setActiveTab('MY_HISTORY')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition ${activeTab === 'MY_HISTORY' ? 'bg-white text-pal-700 shadow' : 'text-gray-600 hover:text-gray-800'}`}
                        >
                            <i className="fas fa-user mr-2"></i> Mon Historique
                        </button>
                        <button 
                            onClick={() => setActiveTab('ARCHIVES')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition ${activeTab === 'ARCHIVES' ? 'bg-white text-pal-700 shadow' : 'text-gray-600 hover:text-gray-800'}`}
                        >
                            <i className="fas fa-database mr-2"></i> Archives {(user.role === Role.DRH || user.role === Role.ADMIN) ? 'Globales' : 'Service'}
                        </button>
                    </div>
                )}
            </div>
            
            {/* VUE: MON HISTORIQUE */}
            {activeTab === 'MY_HISTORY' && (
                <div className="space-y-6 animate-fade-in-up">
                    {/* Statistiques Résumées (Bandeau) */}
                    <div className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 md:space-x-8">
                        <div className="flex items-center space-x-3">
                             <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                 <i className="fas fa-folder-open"></i>
                             </div>
                             <div>
                                 <p className="text-xs text-gray-500 uppercase font-bold">Dossiers archivés</p>
                                 <p className="text-xl font-bold text-gray-800">{myHistory.length}</p>
                             </div>
                        </div>
                        <div className="flex items-center space-x-3">
                             <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                 <i className="fas fa-chart-line"></i>
                             </div>
                             <div>
                                 <p className="text-xs text-gray-500 uppercase font-bold">Moyenne Globale</p>
                                 <p className="text-xl font-bold text-pal-600">
                                     {myHistory.length > 0 ? (myHistory.reduce((a,b) => a + b.noteGlobale, 0) / myHistory.length).toFixed(1) : '-'} <span className="text-sm text-gray-400">/100</span>
                                 </p>
                             </div>
                        </div>
                        <div className="flex items-center space-x-3">
                             <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                 <i className="fas fa-star"></i>
                             </div>
                             <div>
                                 <p className="text-xs text-gray-500 uppercase font-bold">Meilleure Année</p>
                                 <p className="text-xl font-bold text-purple-700">
                                     {myHistory.length > 0 ? Math.max(...myHistory.map(e => e.noteGlobale)) : '-'}
                                 </p>
                             </div>
                        </div>
                    </div>

                    {/* Zone Graphiques (2 colonnes) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="font-bold mb-4 text-gray-700 flex items-center">
                                <i className="fas fa-chart-area mr-2 text-pal-500"></i> Progression de la Note
                            </h3>
                            <div className="h-64">
                                 {myHistory.length > 0 ? (
                                    <Line data={lineChartData} options={{ maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }} />
                                 ) : <div className="h-full flex items-center justify-center text-gray-400">Aucune donnée</div>}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="font-bold mb-4 text-gray-700 flex items-center">
                                <i className="fas fa-chart-bar mr-2 text-purple-500"></i> Distribution des Appréciations
                            </h3>
                            <div className="h-64">
                                {myHistory.length > 0 ? (
                                    <Bar 
                                        data={barChartData} 
                                        options={{ 
                                            maintainAspectRatio: false,
                                            indexAxis: 'y', // Barres horizontales
                                            scales: { x: { grid: { display: false }, ticks: { stepSize: 1 } } },
                                            plugins: { legend: { display: false } }
                                        }} 
                                    />
                                ) : <div className="h-full flex items-center justify-center text-gray-400">Aucune donnée</div>}
                            </div>
                        </div>
                    </div>

                    {/* Tableau Liste */}
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Année</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Appréciation</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {myHistory.map(ev => (
                                    <tr key={ev.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-bold">{ev.annee}</td>
                                        <td className="px-6 py-4 font-bold text-pal-700">{ev.noteGlobale}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                ev.appreciationFinale?.includes('Excellente') ? 'bg-green-100 text-green-800' :
                                                ev.appreciationFinale?.includes('Positive') ? 'bg-blue-100 text-blue-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {ev.appreciationFinale || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => navigate(`/evaluation/${ev.id}`)} className="text-pal-600 hover:text-pal-900 font-medium">
                                                Consulter
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                 {myHistory.length === 0 && (
                                    <tr><td colSpan={4} className="p-8 text-center text-gray-500">Aucun historique personnel disponible.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* VUE: ARCHIVES (DRH/MANAGERS/ADMIN) */}
            {activeTab === 'ARCHIVES' && canViewArchives && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <input 
                                type="text" 
                                placeholder="Rechercher un agent (Nom, Matricule)..."
                                value={archiveSearch}
                                onChange={e => setArchiveSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-full text-sm focus:ring-2 focus:ring-pal-500 outline-none"
                            />
                            <i className="fas fa-search absolute left-3 top-2.5 text-gray-400 text-xs"></i>
                        </div>
                        <div className="w-full md:w-48 relative">
                             <select 
                                value={archiveYear}
                                onChange={e => setArchiveYear(e.target.value)}
                                className="w-full appearance-none bg-gray-50 border border-gray-300 text-gray-700 py-2 px-3 pr-8 rounded-full leading-tight focus:outline-none focus:bg-white focus:border-pal-500 text-sm font-bold"
                            >
                                <option value="ALL">Toutes les années</option>
                                {availableArchiveYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <i className="fas fa-calendar-alt absolute right-3 top-3 text-xs text-gray-500 pointer-events-none"></i>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Agent</th>
                                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Année</th>
                                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Affectation</th>
                                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Note</th>
                                    <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredArchives.map(ev => {
                                    const agent = usersMap[ev.agentId];
                                    if(!agent) return null;
                                    return (
                                        <tr key={ev.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{agent.nom} {agent.prenom}</div>
                                                <div className="text-xs text-gray-500">{agent.matricule}</div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-gray-600">{ev.annee}</td>
                                            <td className="px-6 py-4 text-gray-600">
                                                <div className="font-medium">{agent.departement}</div>
                                                <div className="text-xs text-gray-400">{agent.service || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-pal-700">{ev.noteGlobale}</span>
                                                <span className="text-xs text-gray-400">/100</span>
                                                <div className="text-xs text-gray-500">{ev.appreciationFinale}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => navigate(`/evaluation/${ev.id}`)} className="text-pal-600 hover:text-pal-900 bg-pal-50 px-3 py-1 rounded text-xs font-bold transition">
                                                    Voir dossier
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredArchives.length === 0 && (
                                    <tr><td colSpan={5} className="p-12 text-center text-gray-500 italic">Aucun dossier archivé trouvé pour ces critères.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default History;
