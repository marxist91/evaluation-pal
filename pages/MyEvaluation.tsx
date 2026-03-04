
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/database';
import { User, EvaluationStatus } from '../types';

const MyEvaluation = ({ user }: { user: User }) => {
    const navigate = useNavigate();

    useEffect(() => {
        const evals = db.getEvaluations();
        const currentYear = new Date().getFullYear();
        
        // Try to find current year's eval
        const myEval = evals.find(e => e.agentId === user.id && e.annee === currentYear);

        if (myEval) {
            // Redirect to the detail page
            navigate(`/evaluation/${myEval.id}`, { replace: true });
        }
    }, [user, navigate]);

    return (
        <div className="p-8 text-center">
            <div className="bg-white p-8 rounded shadow max-w-lg mx-auto">
                <i className="fas fa-spinner fa-spin text-4xl text-pal-500 mb-4"></i>
                <h2 className="text-xl font-bold">Chargement de votre dossier...</h2>
                <p className="text-gray-500 mt-2">Si rien ne se passe, vérifiez qu'une campagne est en cours.</p>
            </div>
        </div>
    );
};

export default MyEvaluation;
