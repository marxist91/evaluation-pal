
export enum Role {
  AGENT = 'Agent',
  CHEF_SERVICE = 'Chef de Service',
  DIRECTEUR = 'Directeur de Département',
  DRH = 'DRH', // Admin RH
  ADMIN = 'Administrateur Système' // Super Admin IT
}

export enum Permission {
  ACCESS_ADMIN = 'ACCESS_ADMIN',         // Accès au dashboard Admin
  MANAGE_CAMPAIGNS = 'MANAGE_CAMPAIGNS', // Créer/Gérer les campagnes (DRH)
  VIEW_ALL_TEAMS = 'VIEW_ALL_TEAMS',     // Vue globale organigramme (DRH)
  VIEW_DEPT_TEAM = 'VIEW_DEPT_TEAM',     // Vue Direction (Directeur)
  VIEW_SERVICE_TEAM = 'VIEW_SERVICE_TEAM', // Vue Service (Chef Service)
  VALIDATE_EVALUATIONS = 'VALIDATE_EVALUATIONS', // Accès module Validations
  FILL_EVALUATION = 'FILL_EVALUATION',   // Accès "Mon Évaluation"
  USE_AI_TOOLS = 'USE_AI_TOOLS',         // Accès éditeur IA
  VIEW_HISTORY = 'VIEW_HISTORY'          // Accès historique
}

export enum EvaluationStatus {
  BROUILLON = 'Brouillon',
  SOUMIS = 'Soumis',
  VALIDE_SERVICE = 'Validé (Service)',
  VALIDE_DIRECTEUR = 'Validé (Directeur)',
  VALIDE_DRH = 'Validé (Final)',
  REJETE = 'Rejeté'
}

export interface User {
  id: string;
  matricule: string;
  email?: string; // Nouveau champ pour l'authentification
  authId?: string; // id côté Supabase Auth (lien facultatif)
  nom: string;
  prenom: string;
  role: Role;
  departement: string;
  service?: string;
  avatarUrl?: string;
  dateEntree?: string;
  categorie?: string;
  fonction?: string;
  isEncadrant?: boolean; // Pour Chef Division / Chef Section qui sont Agents mais évalués sur la gestion d'équipe
}

export interface Critere {
  id: string;
  libelle: string;
  coefficient?: number; // Legacy, optional now
}

export interface SubCritereDefinition {
  id: string;
  label: string;
  max: number; // usually 6
}

export interface CritereGroupDefinition {
  id: string;
  label: string;
  maxScore: number; // e.g., 12 or 10 or 35
  subCriteres: SubCritereDefinition[];
  isManagerOnly?: boolean;
}

export interface Note {
  critereId: string;
  valeur: number;
  commentaire?: string;
}

export interface ValidationStep {
  role: Role;
  date: string;
  validateurId: string;
  commentaire: string;
  decision: 'VALIDE' | 'REJETE';
}

export interface PlanActions {
  objectifs: string;
  mesures: string;
  delais: string;
  formation: string;
}

export interface Evaluation {
  id: string;
  agentId: string;
  annee: number;
  statut: EvaluationStatus;
  notes: Note[];
  noteGlobale: number;
  validations: ValidationStep[];
  
  // New Official Fields
  rappelObjectifs?: string;
  planActions?: PlanActions;
  appreciationFinale?: string; // e.g. "Excellente", "Positive"
}

export interface Campaign {
  id: string;
  annee: number;
  titre: string;
  dateLancement: string;
  statut: 'ACTIVE' | 'CLOTUREE';
  totalEvaluations: number;
  targetRole?: Role | 'ALL'; // Cible de la campagne
}

export interface Notification {
  id: string;
  userId: string; // Destinataire
  message: string;
  date: string;
  read: boolean;
  type: 'INFO' | 'ACTION' | 'SUCCESS' | 'ERROR';
  linkToEvalId?: string; // Pour redirection rapide
}

// --- NEW AUDIT LOG INTERFACE ---
export interface AuditLog {
  id: string;
  userId: string;       // L'acteur de l'action
  userRole: Role;       // Son rôle au moment de l'action
  action: string;       // ex: "MODIFICATION_NOTE", "VALIDATION", "CONNEXION"
  targetId: string;     // ID de l'objet concerné (ex: eval_2024_u1)
  targetName?: string;  // Nom lisible de l'objet (ex: Evaluation Koffi Jean)
  details: string;      // ex: "Critère Qualité: 4 -> 5"
  timestamp: string;
}

export const DEPARTEMENTS = [
  "Direction Générale",
  "Secrétariat Général",
  "Direction des Affaires Juridiques",
  "Direction des Ressources Humaines",
  "Direction Commerciale",
  "Direction de l'Exploitation",
  "Direction Technique",
  "Direction Financière et Comptable",
  "Direction de la Capitainerie",
  "Direction du Centre Médico-Social",
  "Direction des Systèmes d'Information",
  "PRMP"
];
