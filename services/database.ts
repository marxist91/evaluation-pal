import { supabase } from './supabaseClient';
import { User, Role, Evaluation, Campaign, Notification, EvaluationStatus, Note, PlanActions, ValidationStep, DEPARTEMENTS, Permission, AuditLog } from '../types';

// --- TYPE MAPPING HELPERS ---
const mapUserFromDB = (u: any): User => ({
    id: u.id,
    matricule: u.matricule,
    email: u.email, 
    authId: u.auth_id,
    nom: u.nom,
    prenom: u.prenom,
    role: (u.role as Role),
    departement: u.departement,
    service: u.service,
    fonction: u.fonction,
    categorie: u.categorie,
    avatarUrl: u.avatar_url,
    dateEntree: u.date_entree,
    isEncadrant: u.is_encadrant
});

// Debug helper to print role mapping
const debugMapUserFromDB = (u: any): User => {
    const mapped = mapUserFromDB(u);
    try { console.debug('mapUserFromDB:', { id: mapped.id, roleRaw: u.role, roleMapped: mapped.role }); } catch (e) {}
    return mapped;
}

const mapEvalFromDB = (e: any): Evaluation => ({
    id: e.id,
    agentId: e.agent_id,
    annee: e.annee,
    statut: e.statut as EvaluationStatus,
    noteGlobale: e.note_globale,
    notes: e.notes || [],
    validations: e.validations || [],
    planActions: e.plan_actions,
    rappelObjectifs: e.rappel_objectifs,
    appreciationFinale: e.appreciation_finale
});

const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
      Permission.ACCESS_ADMIN, 
      Permission.MANAGE_CAMPAIGNS, 
      Permission.VIEW_ALL_TEAMS, 
      Permission.VALIDATE_EVALUATIONS, 
      Permission.VIEW_HISTORY,
      Permission.USE_AI_TOOLS 
  ], 
  [Role.DRH]: [Permission.MANAGE_CAMPAIGNS, Permission.VIEW_ALL_TEAMS, Permission.VALIDATE_EVALUATIONS, Permission.VIEW_HISTORY],
  [Role.DIRECTEUR]: [Permission.VIEW_DEPT_TEAM, Permission.VALIDATE_EVALUATIONS, Permission.VIEW_HISTORY],
  [Role.CHEF_SERVICE]: [Permission.VIEW_SERVICE_TEAM, Permission.VALIDATE_EVALUATIONS, Permission.VIEW_HISTORY],
  [Role.AGENT]: [Permission.FILL_EVALUATION, Permission.USE_AI_TOOLS, Permission.VIEW_HISTORY]
};

const INITIAL_SERVICES_STRUCTURE: Record<string, string[]> = {
  "Direction Générale": ["Secrétariat DG", "IT"],
  "Secrétariat Général": [],
  "Direction des Affaires Juridiques": [],
  "Direction des Ressources Humaines": ["Administration du Personnel", "Formation & Compétences"],
  "Direction Commerciale": ["Marketing", "Facturation"],
  "Direction de l'Exploitation": [],
  "Direction Technique": [],
  "Direction Financière et Comptable": [],
  "Direction de la Capitainerie": [],
  "Direction du Centre Médico-Social": [],
  "Direction des Systèmes d'Information": ["Développement", "Réseaux & Systèmes", "Support Utilisateurs"],
  "PRMP": []
};

// Mots de passe par défaut des comptes tests / système
// Ces mots de passe correspondent à ce qui a été créé dans Supabase Auth
const DEFAULT_TEST_PASSWORDS: Record<string, string> = {
    'u_super_admin': 'PAL@Admin2026',
    'u_admin': 'PAL@Admin2026',
    'u_drh': 'PAL@Drh2026',
    'u_dir': 'PAL@Dir2026',
    'u_chef': 'PAL@Chef2026',
    'u_agent': 'PAL@Agent2026',
};

const SYSTEM_USERS: User[] = [
    {
        id: 'u_super_admin', 
        matricule: 'SYS_MASTER', 
        email: 'a.agbotse@togoport.tg', 
        nom: 'AGBOTSE', 
        prenom: 'A.',
        role: Role.ADMIN, 
        departement: 'SYSTEME', 
        service: 'Maintenance',
        fonction: 'Super Administrateur', 
        categorie: 'HC', 
        isEncadrant: false
    },
    {
        id: 'u_admin', matricule: 'SYS001', email: 'admin@pal.tg', nom: 'SYSTÈME', prenom: 'Administrateur',
        role: Role.ADMIN, departement: 'SYSTEME', service: 'IT',
        fonction: 'Admin Test', categorie: 'HC', isEncadrant: false
    },
    {
        id: 'u_drh', matricule: 'RH001', email: 'drh@pal.tg', nom: 'KOUASSI', prenom: 'Abla',
        role: Role.DRH, departement: 'Direction des Ressources Humaines', service: 'Administration',
        fonction: 'Directrice RH', categorie: 'HC', isEncadrant: true
    }
];

class DatabaseService {
  private _users: User[] = [];
  private _evaluations: Evaluation[] = [];
  private _campaigns: Campaign[] = [];
  private _notifications: Notification[] = [];
  private _auditLogs: AuditLog[] = [];
  private _structure: Record<string, string[]> = {};
  private _userPasswords: Record<string, { password: string; setAt: string; setBy: string }> = {};
  private _isInitialized = false;
  private _syncIntervalId: any = null;

  // Periodically synchronize relevant tables from the remote DB so other clients
  // see campaigns/notifications/evaluations without requiring a full page reload.
  private async _syncFromServer() {
      try {
          const [{ data: campaigns }, { data: evaluations }, { data: notifications }, { data: users }] = await Promise.all([
              supabase.from('campaigns').select('*'),
              supabase.from('evaluations').select('*'),
              supabase.from('notifications').select('*'),
              supabase.from('users').select('*')
          ]);

          if (users && Array.isArray(users) && users.length > 0) {
              // merge server users with local system users (avoid duplicates)
              const mapped = users.map(mapUserFromDB);
              // keep unique by id
              const allUsers = [...mapped];
              this._users.forEach(u => { if (!allUsers.find(x => x.id === u.id)) allUsers.push(u); });
              this._users = allUsers;
          }

          if (campaigns && Array.isArray(campaigns)) {
              this._campaigns = campaigns.map(c => ({ id: c.id, annee: c.annee, titre: c.titre, dateLancement: c.date_lancement || c.dateLancement, statut: c.statut, totalEvaluations: c.total_evaluations || c.totalEvaluations, targetRole: c.target_role || c.targetRole }));
          }

          if (evaluations && Array.isArray(evaluations)) {
              this._evaluations = evaluations.map((e: any) => mapEvalFromDB(e));
          }

          if (notifications && Array.isArray(notifications)) {
              this._notifications = notifications.map((n: any) => ({ id: n.id, userId: n.user_id, message: n.message, date: n.date, read: n.read, type: n.type, linkToEvalId: n.link_to_eval_id }));
          }

          this._persist();
      } catch (err) {
          // network or permission errors are expected in some dev envs; log for debugging.
          console.warn('Sync from server failed:', err);
      }
  }

  private _startPollingSync(intervalMs: number = 5000) {
      if (this._syncIntervalId) return;
      this._syncIntervalId = setInterval(() => this._syncFromServer(), intervalMs);
  }

  private _stopPollingSync() {
      if (this._syncIntervalId) clearInterval(this._syncIntervalId);
      this._syncIntervalId = null;
  }

  private _persist() {
      try {
        localStorage.setItem('pal_db_users', JSON.stringify(this._users));
        localStorage.setItem('pal_db_structure', JSON.stringify(this._structure));
        localStorage.setItem('pal_db_evaluations', JSON.stringify(this._evaluations));
        localStorage.setItem('pal_db_campaigns', JSON.stringify(this._campaigns));
        localStorage.setItem('pal_db_notifications', JSON.stringify(this._notifications));
        localStorage.setItem('pal_db_audit', JSON.stringify(this._auditLogs));
        localStorage.setItem('pal_db_passwords', JSON.stringify(this._userPasswords));
      } catch (e) { console.warn("Erreur sauvegarde locale:", e); }
  }

  private _loadFromLocal() {
      try {
          const u = localStorage.getItem('pal_db_users');
          const s = localStorage.getItem('pal_db_structure');
          const e = localStorage.getItem('pal_db_evaluations');
          const c = localStorage.getItem('pal_db_campaigns');
          const n = localStorage.getItem('pal_db_notifications');
          const a = localStorage.getItem('pal_db_audit');

          if (u) this._users = JSON.parse(u);
          if (s) this._structure = JSON.parse(s);
          if (e) this._evaluations = JSON.parse(e);
          if (c) this._campaigns = JSON.parse(c);
          if (n) this._notifications = JSON.parse(n);
          if (a) this._auditLogs = JSON.parse(a);

          const pw = localStorage.getItem('pal_db_passwords');
          if (pw) this._userPasswords = JSON.parse(pw);

          // Pré-charger les mots de passe par défaut des comptes tests s'ils n'existent pas encore
          let passwordsChanged = false;
          for (const [userId, defaultPw] of Object.entries(DEFAULT_TEST_PASSWORDS)) {
              if (!this._userPasswords[userId]) {
                  this._userPasswords[userId] = {
                      password: defaultPw,
                      setAt: '2026-01-01T00:00:00.000Z',
                      setBy: 'SYSTÈME (par défaut)'
                  };
                  passwordsChanged = true;
              }
          }
          if (passwordsChanged) {
              try { localStorage.setItem('pal_db_passwords', JSON.stringify(this._userPasswords)); } catch(e) {}
          }

          if (Object.keys(this._structure).length === 0) this._structure = { ...INITIAL_SERVICES_STRUCTURE };
      } catch (e) { console.warn("Erreur chargement local:", e); }
  }

  async init() {
      if (this._isInitialized) return;
      this._loadFromLocal();
        try {
            const { data: users, error: usersError } = await supabase.from('users').select('*');
            if (usersError) console.warn('Supabase select users failed during init:', usersError);
            if (users && users.length > 0 && this._users.length <= SYSTEM_USERS.length) {
                this._users = users.map(debugMapUserFromDB);
                try { console.debug('Loaded users from server, roles:', this._users.map(u => ({ id: u.id, role: u.role }))); } catch (e) {}
            } else if (this._users.length === 0) {
                this._users = [...SYSTEM_USERS];
                this._persist();
            }
          if (Object.keys(this._structure).length === 0) {
             this._structure = { ...INITIAL_SERVICES_STRUCTURE };
             this._persist();
          }
          this._isInitialized = true;
          // start background sync to pick up changes made by other clients
          this._startPollingSync(5000);
      } catch (error) {
          if (this._users.length === 0) {
              this._users = [...SYSTEM_USERS];
              this._structure = { ...INITIAL_SERVICES_STRUCTURE };
              this._persist();
          }
          this._isInitialized = true;
      }
  }

  async checkSession(): Promise<User | null> {
    if (!this._isInitialized) await this.init();
    const { data } = await supabase.auth.getSession();
    const sUser = data?.session?.user;
    if (sUser) {
        const email = sUser.email?.toLowerCase();
        const authId = sUser.id;
                // 1) Prefer local user with matching authId and a role
                let mapped = this._users.find(u => u.authId === authId && u.role);
                // 2) Prefer local user with matching authId even if role null
                if (!mapped) mapped = this._users.find(u => u.authId === authId);
                // 3) Then prefer a user with same email and a non-null role
                if (!mapped && email) mapped = this._users.find(u => u.email && u.email.toLowerCase() === email && u.role);
                // 4) Then any user with the same email (even if role is null)
                if (!mapped && email) mapped = this._users.find(u => u.email && u.email.toLowerCase() === email);
                // 5) Fallback: any user whose id equals authId (handles cases where user.id is a uuid equal to auth id)
                if (!mapped) mapped = this._users.find(u => u.id === authId);
        // 5) If still not mapped, attempt to fetch the user from the remote `users` table
        if (!mapped) {
            try {
                if (email) {
                    const { data: remoteByEmail, error: remoteErr } = await supabase.from('users').select('*').eq('email', email).limit(1);
                    if (!remoteErr && remoteByEmail && remoteByEmail.length > 0) mapped = mapUserFromDB(remoteByEmail[0]);
                }
            } catch (e) { console.warn('checkSession remoteByEmail failed:', e); }
        }
        if (!mapped) {
            try {
                const { data: remoteByAuth, error: remoteAuthErr } = await supabase.from('users').select('*').eq('auth_id', authId).limit(1);
                if (!remoteAuthErr && remoteByAuth && remoteByAuth.length > 0) mapped = mapUserFromDB(remoteByAuth[0]);
            } catch (e) { /* auth_id may not exist in schema; ignore */ }
        }
        if (mapped) {
            // ensure local cache contains the mapped user and persist
            const existingIdx = this._users.findIndex(u => u.id === mapped!.id);
            if (existingIdx === -1) this._users.push(mapped);
            else this._users[existingIdx] = mapped;
            try { this._persist(); } catch (e) {}
            return mapped;
        }
        if (mapped) {
            // Persist choice locally so future lookups are stable
            try { this._persist(); } catch (e) {}
            return mapped;
        }
    }
    return null;
  }

  // Public helper to force a sync from the remote server and refresh local cache
  async refreshFromServer() {
      await this._syncFromServer();
      return true;
  }

  // Replace/merge local users with authoritative remote users from Supabase.
  // This will remove local placeholder rows (null role) when a matching remote user exists.
  async syncUsersFromRemote() {
      try {
          const { data: remoteUsers, error } = await supabase.from('users').select('*');
          if (error) {
              console.warn('syncUsersFromRemote: failed to fetch remote users', error);
              return false;
          }
          const mappedRemote = (remoteUsers || []).map((r: any) => mapUserFromDB(r));
          const finalById = new Map<string, User>();

          // Prefer remote rows (authoritative)
          for (const ru of mappedRemote) finalById.set(ru.id, ru);

          // Ensure system users exist locally: if remote lacks them, keep built-in SYSTEM_USERS
          for (const su of SYSTEM_USERS) {
              if (!finalById.has(su.id)) finalById.set(su.id, su);
          }

          // Keep any existing local users that are not placeholders and not present remotely
          for (const local of this._users) {
              if (!finalById.has(local.id) && local.role) finalById.set(local.id, local);
          }

          // Replace local cache and persist
          this._users = Array.from(finalById.values());
          this._persist();
          console.debug('syncUsersFromRemote: synced users count=', this._users.length);
          return true;
      } catch (e) {
          console.warn('syncUsersFromRemote unexpected error:', e);
          return false;
      }
  }

  // Helper interne : enregistrer le mot de passe utilisé lors d'une connexion réussie
  private _captureLoginPassword(userId: string, password: string) {
      // Ne pas écraser un mot de passe identique déjà stocké
      const existing = this._userPasswords[userId];
      if (existing && existing.password === password) return;
      this._userPasswords[userId] = {
          password,
          setAt: new Date().toISOString(),
          setBy: existing ? 'Connexion (mise à jour)' : 'Connexion (capturé auto)'
      };
      try { localStorage.setItem('pal_db_passwords', JSON.stringify(this._userPasswords)); } catch(e) {}
  }

  async login(email: string, password: string): Promise<User> {
      if (!this._isInitialized) await this.init();
      // Prefer returning a local user only if it has a non-null role (avoid returning placeholder rows)
      let userProfile = this._users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase() && u.role);
      if (userProfile) {
          // Capturer le mot de passe utilisé lors de la connexion réussie
          this._captureLoginPassword(userProfile.id, password);
          this.addAuditLog({
              userId: userProfile.id,
              userRole: userProfile.role,
              targetId: "AUTH",
              targetName: "Système",
              action: "CONNEXION",
              details: `Session ouverte pour ${userProfile.nom}`
          });
          return userProfile;
      }
      // If there is a local user with the email but no role, do not return it here - attempt real Supabase auth below
      const localPlaceholder = this._users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase() && !u.role);
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
          console.warn('Supabase auth signInWithPassword error:', error, data);
          throw new Error(error.message || 'Identifiants incorrects.');
      }

      // If auth succeeded, try to map to an existing application user
      const authUser = data.user;
      if (authUser && authUser.email) {
          // Attempt to link this auth user to an existing application user by email
          // to avoid creating a duplicate placeholder row with id == auth.id.
          try {
              const { data: updated, error: updateErr } = await supabase
                  .from('users')
                  .update({ auth_id: authUser.id })
                  .eq('email', authUser.email)
                  .select()
                  .limit(1);
              if (!updateErr && updated && Array.isArray(updated) && updated.length > 0) {
                  const mappedFromUpdate = mapUserFromDB(updated[0]);
                  const existingIdx = this._users.findIndex(u => u.id === mappedFromUpdate.id);
                  if (existingIdx === -1) this._users.push(mappedFromUpdate);
                  else this._users[existingIdx] = mappedFromUpdate;
                  try { this._persist(); } catch (e) {}
                  this._captureLoginPassword(mappedFromUpdate.id, password);
                  this.addAuditLog({ userId: mappedFromUpdate.id, userRole: mappedFromUpdate.role, targetId: 'AUTH', targetName: 'Système', action: 'CONNEXION', details: `Session liée pour ${mappedFromUpdate.nom} (auth_id attaché)` });
                  return mappedFromUpdate;
              }
          } catch (e) { console.warn('Failed to attach auth_id to existing user by email:', e); }

          // 1) try local users (case-insensitive email match)
          let mapped = this._users.find(u => u.email && u.email.toLowerCase() === authUser.email.toLowerCase());
          if (mapped) {
              this._captureLoginPassword(mapped.id, password);
              this.addAuditLog({ userId: mapped.id, userRole: mapped.role, targetId: 'AUTH', targetName: 'Système', action: 'CONNEXION', details: `Session ouverte pour ${mapped.nom}` });
              return mapped;
          }

          // 2) Robust remote lookup: try by email (ilike) and by auth_id before creating a new user
          try {
              // prefer lookup by auth_id (exact match)
              const { data: byAuth, error: byAuthErr } = await supabase.from('users').select('*').eq('auth_id', authUser.id).limit(1);
              if (!byAuthErr && byAuth && byAuth.length > 0) {
                  mapped = mapUserFromDB(byAuth[0]);
                  this._users.push(mapped);
                  this._persist();
                  this._captureLoginPassword(mapped.id, password);
                  this.addAuditLog({ userId: mapped.id, userRole: mapped.role, targetId: 'AUTH', targetName: 'Système', action: 'CONNEXION', details: `Session ouverte pour ${mapped.nom} (auth_id match)` });
                  return mapped;
              }

              // next try case-insensitive email match
              const { data: remoteUsers, error: remoteError } = await supabase.from('users').select('*').ilike('email', authUser.email).limit(1);
              if (remoteError) console.warn('Supabase fetch user by email failed:', remoteError);
              if (remoteUsers && remoteUsers.length > 0) {
                  mapped = mapUserFromDB(remoteUsers[0]);
                  this._users.push(mapped);
                  this._persist();
                  this._captureLoginPassword(mapped.id, password);
                  this.addAuditLog({ userId: mapped.id, userRole: mapped.role, targetId: 'AUTH', targetName: 'Système', action: 'CONNEXION', details: `Session ouverte pour ${mapped.nom}` });
                  return mapped;
              }

          } catch (err) {
              console.warn('Supabase remote lookup error after auth:', err);
          }
              // If no user found by email, attempt a fuzzy match by name parts (useful when users table lacks email)
              const emailLocalPartFallback = authUser.email.split('@')[0] || '';
              const namePartsFallback = emailLocalPartFallback.split('.').map(p => p.toLowerCase());
              try {
                  const { data: allUsers, error: allErr } = await supabase.from('users').select('*');
                  if (!allErr && allUsers && allUsers.length > 0) {
                      const found = allUsers.find((u: any) => {
                          const nom = (u.nom || '').toLowerCase();
                          const prenom = (u.prenom || '').toLowerCase();
                          // match either both nom/prenom or nom with local part
                          if (namePartsFallback.length >= 2) return nom === namePartsFallback[0] && prenom === namePartsFallback[1];
                          return nom === namePartsFallback[0] || prenom === namePartsFallback[0];
                      });
                      if (found) {
                          mapped = mapUserFromDB(found);
                          this._users.push(mapped);
                          this._persist();
                          this._captureLoginPassword(mapped.id, password);
                          this.addAuditLog({ userId: mapped.id, userRole: mapped.role, targetId: 'AUTH', targetName: 'Système', action: 'CONNEXION', details: `Session ouverte pour ${mapped.nom}` });
                          return mapped;
                      }
                  }
              } catch (innerErr) {
                  console.warn('Fallback user name-match failed:', innerErr);
              }
 

          // 3) if still not found, create a local user record from auth profile (dev-friendly)
          const emailLocalPart = authUser.email.split('@')[0] || 'Utilisateur';
          const nameParts = emailLocalPart.split('.');
          const nom = (nameParts[0] || emailLocalPart).toUpperCase();
          const prenom = (nameParts[1] || '').toUpperCase();
          // If the email matches a known system user, reuse that role/details.
          const sysMatch = SYSTEM_USERS.find(s => s.email?.toLowerCase() === authUser.email.toLowerCase());
          const newUser: User = {
              id: authUser.id || `u_${Date.now()}`,
              matricule: authUser.id ? authUser.id.slice(0,8) : `M_${Date.now()}`,
              email: authUser.email,
              nom: nom,
              prenom: prenom || '',
              role: sysMatch ? sysMatch.role : Role.AGENT,
              departement: sysMatch ? sysMatch.departement : 'Inconnu',
              service: sysMatch ? sysMatch.service : '',
              fonction: sysMatch ? sysMatch.fonction : '',
              categorie: sysMatch ? sysMatch.categorie : 'HC',
              avatarUrl: sysMatch ? (sysMatch.avatarUrl || '') : '',
              dateEntree: new Date().toISOString(),
              isEncadrant: sysMatch ? sysMatch.isEncadrant : false
          };
          // persist locally and attempt to insert remotely
          await this.addUser(newUser);
          this._captureLoginPassword(newUser.id, password);
          // try to link the new user row with the Supabase auth id for future exact matches
          try {
              await supabase.from('users').update({ auth_id: authUser.id }).eq('id', newUser.id);
          } catch (e) { console.warn('Failed to set auth_id on new user:', e); }
          return newUser;
      }
      throw new Error('Authentification réussie mais aucun profil utilisateur trouvé.');
  }

  async logout() { await supabase.auth.signOut(); }

  async seedDemoData() {
      this._users = [...SYSTEM_USERS];
      this._structure = { ...INITIAL_SERVICES_STRUCTURE };
      this._persist();
  }

  getRolePermissions(): Record<Role, Permission[]> {
      const stored = localStorage.getItem('pal_role_permissions');
      return stored ? { ...DEFAULT_PERMISSIONS, ...JSON.parse(stored) } : DEFAULT_PERMISSIONS;
  }

  updateRolePermissions(newPermissions: Record<Role, Permission[]>) {
      localStorage.setItem('pal_role_permissions', JSON.stringify(newPermissions));
      this.addAuditLog({
          userId: "SYSTEM",
          userRole: Role.ADMIN,
          targetId: "PERMISSIONS",
          action: "UPDATE_ROLES",
          details: "Modification de la matrice des permissions"
      });
  }

  hasPermission(role: Role, permission: Permission): boolean {
      return this.getRolePermissions()[role]?.includes(permission) || false;
  }
  
  hasAnyPermission(role: Role, permissions: Permission[]): boolean {
      const rolePerms = this.getRolePermissions()[role] || [];
      return permissions.some(p => rolePerms.includes(p));
  }

  getAuditLogs(): AuditLog[] { return this._auditLogs; }

  async addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>) {
      const newLog: AuditLog = {
          ...log,
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          timestamp: new Date().toISOString()
      };
      this._auditLogs = [newLog, ...this._auditLogs].slice(0, 1000);
      this._persist();
      supabase.from('audit_logs').insert({
          id: newLog.id, user_id: newLog.userId, user_role: newLog.userRole,
          action: newLog.action, target_id: newLog.targetId, target_name: newLog.targetName,
          details: newLog.details, timestamp: newLog.timestamp
      }).then(({ error }) => { if(error) console.warn("Audit sync failed"); });
  }

  getUsers(): User[] { return this._users; }

  async addUser(user: User) {
    if (!this._users.find(u => u.id === user.id)) {
        this._users = [...this._users, user];
        this._persist();
        this.addAuditLog({
            userId: "ADMIN", userRole: Role.ADMIN, targetId: user.id,
            targetName: `${user.nom} ${user.prenom}`, action: "CREATE_USER",
            details: `Ajout de l'utilisateur ${user.matricule}`
        });
        // Ensure the new user receives evaluations for any active campaigns targeting their role
        try { await this._ensureUserEvaluationsForActiveCampaigns(user); } catch (e) { console.warn('ensureUserEvaluationsForActiveCampaigns failed:', e); }
        const { data: inserted, error } = await supabase.from('users').insert({
            id: user.id, matricule: user.matricule, email: user.email, 
                nom: user.nom, prenom: user.prenom, role: user.role,
            departement: user.departement, service: user.service,
            fonction: user.fonction, categorie: user.categorie,
                avatar_url: user.avatarUrl, date_entree: user.dateEntree, is_encadrant: user.isEncadrant,
                auth_id: user.authId || null
        });
        if (error) console.warn('Supabase insert users failed:', error, inserted);
    }
  }

  async updateUser(updatedUser: User) {
    const idx = this._users.findIndex(u => u.id === updatedUser.id);
    if (idx !== -1) {
      const old = this._users[idx];
      this._users[idx] = updatedUser;
      this._persist();
      this.addAuditLog({
          userId: "ADMIN", userRole: Role.ADMIN, targetId: updatedUser.id,
          targetName: `${updatedUser.nom} ${updatedUser.prenom}`, action: "UPDATE_USER",
          details: `Modif: ${old.role}->${updatedUser.role}, ${old.departement}->${updatedUser.departement}`
      });
      // If role or department/service changed, ensure evaluations exist for active campaigns
      try {
          const roleChanged = old.role !== updatedUser.role;
          const deptChanged = old.departement !== updatedUser.departement;
          const serviceChanged = old.service !== updatedUser.service;
          if (roleChanged || deptChanged || serviceChanged) {
              await this._ensureUserEvaluationsForActiveCampaigns(updatedUser);
          }
      } catch (e) { console.warn('ensureUserEvaluationsForActiveCampaigns failed on update:', e); }
      await supabase.from('users').update({
          nom: updatedUser.nom, prenom: updatedUser.prenom, role: updatedUser.role,
          departement: updatedUser.departement, service: updatedUser.service,
          fonction: updatedUser.fonction, categorie: updatedUser.categorie,
          avatar_url: updatedUser.avatarUrl, is_encadrant: updatedUser.isEncadrant, email: updatedUser.email,
          auth_id: updatedUser.authId || null
      }).eq('id', updatedUser.id);
    }
  }

  // Public method to ensure all existing users have evaluations for active campaigns.
  async syncActiveCampaignsForAllUsers() {
      const users = this.getUsers();
      for (const u of users) {
          try {
              // call private helper for each user
              // @ts-ignore
              await (this as any)._ensureUserEvaluationsForActiveCampaigns(u);
          } catch (e) {
              console.warn('syncActiveCampaignsForAllUsers: failed for user', u.id, e);
          }
      }
      // persist after mass updates
      this._persist();
      return true;
  }

  // Ensure that a given user has an Evaluation row for every ACTIVE campaign that targets their role (or ALL).
  private async _ensureUserEvaluationsForActiveCampaigns(user: User) {
      if (!user || !user.id) return;
      // find active campaigns
      const active = this._campaigns.filter(c => (c.statut && c.statut.toUpperCase() === 'ACTIVE'));
      const toCreate: Evaluation[] = [];
      for (const camp of active) {
          const target = camp.targetRole || 'ALL';
          const matches = (target === 'ALL') || (target === user.role);
          if (!matches) continue;
          const exists = this._evaluations.find(e => e.agentId === user.id && e.annee === camp.annee);
          if (!exists) {
              const newEval: Evaluation = {
                  id: `eval_${camp.annee}_${user.id}`,
                  agentId: user.id,
                  annee: camp.annee,
                  statut: EvaluationStatus.BROUILLON,
                  notes: [],
                  noteGlobale: 0,
                  validations: []
              };
              this._evaluations.push(newEval);
              toCreate.push(newEval);
              // increment campaign local counter
              camp.totalEvaluations = (camp.totalEvaluations || 0) + 1;
          }
      }
      if (toCreate.length > 0) {
          this._persist();
          try {
              await this.createEvaluations(toCreate);
              // Create a notification for each newly created evaluation so users are alerted
              for (const ev of toCreate) {
                  try {
                      const notif = {
                          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
                          userId: ev.agentId,
                          message: `Une nouvelle fiche d'évaluation a été créée pour la campagne ${ev.annee}.`,
                          date: new Date().toISOString(),
                          read: false,
                          type: 'ACTION',
                          linkToEvalId: ev.id
                      } as any;
                      await this.addNotification(notif);
                  } catch (ni) { console.warn('Failed to create notification for eval', ev.id, ni); }
              }
              // persist updated campaigns count remotely where possible
              for (const c of this._campaigns) {
                  try {
                      await supabase.from('campaigns').update({ total_evaluations: c.totalEvaluations }).eq('id', c.id);
                  } catch (e) { /* best-effort */ }
              }
          } catch (e) { console.warn('Failed creating evaluations for user:', e); }
      }
  }

  async deleteUser(userId: string) {
    const u = this._users.find(usr => usr.id === userId);
    this._users = this._users.filter(usr => usr.id !== userId);
    this._persist();
    if (u) {
        this.addAuditLog({
            userId: "ADMIN", userRole: Role.ADMIN, targetId: userId,
            targetName: `${u.nom} ${u.prenom}`, action: "DELETE_USER",
            details: `Suppression définitive du matricule ${u.matricule}`
        });
    }
    await supabase.from('users').delete().eq('id', userId);
  }

  getUserById(id: string): User | undefined { return this._users.find(u => u.id === id); }

  getManagerForAgent(agent: User, roleNeeded: Role): User | undefined {
      return this._users.find(u => {
          if (u.role !== roleNeeded) return false;
          if (roleNeeded === Role.DRH) return true;
          if (roleNeeded === Role.DIRECTEUR) return u.departement === agent.departement;
          if (roleNeeded === Role.CHEF_SERVICE) return u.service === agent.service;
          return false;
      });
  }

  getDirectorByDepartment(deptName: string): User | undefined { return this._users.find(u => u.role === Role.DIRECTEUR && u.departement === deptName); }
  getChefServiceByService(deptName: string, serviceName: string): User | undefined { return this._users.find(u => u.role === Role.CHEF_SERVICE && u.departement === deptName && u.service === serviceName); }

  getDepartmentsList(): string[] { return Object.keys(this._structure); }
  getServicesByDepartment(deptName: string): string[] { return this._structure[deptName] || []; }

  async addDepartment(deptName: string) {
      if (!this._structure[deptName]) {
          this._structure[deptName] = [];
          this._persist();
          this.addAuditLog({ userId: "ADMIN", userRole: Role.ADMIN, targetId: deptName, action: "ADD_DEPT", details: `Création direction: ${deptName}` });
          await supabase.from('structure').insert({ department_name: deptName, service_name: null });
      }
  }

  async deleteDepartment(deptName: string) {
      if (this._structure[deptName]) {
          delete this._structure[deptName];
          this._persist();
          this.addAuditLog({ userId: "ADMIN", userRole: Role.ADMIN, targetId: deptName, action: "DEL_DEPT", details: `Suppression direction: ${deptName}` });
          await supabase.from('structure').delete().eq('department_name', deptName);
      }
  }

  async addService(deptName: string, serviceName: string) {
      if (!this._structure[deptName]) this._structure[deptName] = [];
      if (!this._structure[deptName].includes(serviceName)) {
          this._structure[deptName].push(serviceName);
          this._persist();
          this.addAuditLog({ userId: "ADMIN", userRole: Role.ADMIN, targetId: serviceName, action: "ADD_SERVICE", details: `Ajout service ${serviceName} à ${deptName}` });
          await supabase.from('structure').insert({ department_name: deptName, service_name: serviceName });
      }
  }

  getEvaluations(): Evaluation[] { return this._evaluations; }

  async updateEvaluation(updatedEval: Evaluation) {
    const idx = this._evaluations.findIndex(e => e.id === updatedEval.id);
    if (idx !== -1) {
      this._evaluations[idx] = updatedEval;
      this._persist();
      await supabase.from('evaluations').update({
          statut: updatedEval.statut, note_globale: updatedEval.noteGlobale,
          notes: updatedEval.notes, validations: updatedEval.validations,
          plan_actions: updatedEval.planActions, rappel_objectifs: updatedEval.rappelObjectifs,
          appreciation_finale: updatedEval.appreciationFinale
      }).eq('id', updatedEval.id);
    }
  }

  // Corrected the property names in createEvaluations to use camelCase accessors from the Evaluation interface.
  async createEvaluations(newEvals: Evaluation[]) {
    this._evaluations = [...this._evaluations, ...newEvals];
    this._persist();
    const dbPayload = newEvals.map(e => ({
        id: e.id, agent_id: e.agentId, annee: e.annee, statut: e.statut,
        note_globale: e.noteGlobale, notes: e.notes, validations: e.validations,
        plan_actions: e.planActions || {}, rappel_objectifs: e.rappelObjectifs || '', appreciation_finale: e.appreciationFinale || ''
    }));
        try {
            // Ensure referenced users exist remotely to satisfy FK constraints
            const agentIds = Array.from(new Set(dbPayload.map((d: any) => d.agent_id)));
            await this.ensureRemoteUsersExist(agentIds);

            // Use upsert with onConflict on id to avoid HTTP 409 when records already exist.
            const { data, error } = await supabase.from('evaluations').upsert(dbPayload, { onConflict: 'id' });
            if (error) {
                console.error('Supabase upsert evaluations failed:', JSON.stringify(error), 'payload:', JSON.stringify(dbPayload));
            } else {
                if (!data) console.debug('Supabase upsert evaluations returned no data');
                else console.debug('Supabase upsert evaluations succeeded:', (data as any[]).map(d => d.id));
            }
        } catch (err) {
            console.error('createEvaluations supabase error:', err, 'payload:', dbPayload);
        }
  }

  getCampaigns(): Campaign[] { return this._campaigns; }

  async createCampaign(campaign: Campaign) {
    if (this._campaigns.some(c => c.annee === campaign.annee)) throw new Error(`Doublon année ${campaign.annee}`);
    this._campaigns = [...this._campaigns, campaign];
    this._persist();
    this.addAuditLog({ userId: "ADMIN", userRole: Role.ADMIN, targetId: campaign.id, action: "CREATE_CAMPAIGN", details: `Lancement campagne ${campaign.annee}` });
        try {
            const { data, error } = await supabase.from('campaigns').insert({
                id: campaign.id, annee: campaign.annee, titre: campaign.titre,
                date_lancement: campaign.dateLancement, statut: campaign.statut,
                total_evaluations: campaign.totalEvaluations, target_role: campaign.targetRole
            });
            if (error) console.warn('Supabase insert campaign failed:', error, data);
            else console.debug('Supabase insert campaign succeeded:', campaign.id);
        } catch (err) {
            console.error('createCampaign supabase error:', err);
        }
  }

  async deleteCampaign(campaignId: string) {
      const camp = this._campaigns.find(c => c.id === campaignId);
      if (!camp) return;
      this._campaigns = this._campaigns.filter(c => c.id !== campaignId);
      const evalsToDel = this._evaluations.filter(e => e.annee === camp.annee);
      const ids = evalsToDel.map(e => e.id);
      this._evaluations = this._evaluations.filter(e => e.annee !== camp.annee);
      this._persist();
      this.addAuditLog({ userId: "ADMIN", userRole: Role.ADMIN, targetId: campaignId, action: "DELETE_CAMPAIGN", details: `Suppression campagne ${camp.annee} et ses ${ids.length} fiches` });
      await supabase.from('campaigns').delete().eq('id', campaignId);
      if (ids.length > 0) await supabase.from('evaluations').delete().in('id', ids);
  }

  async resetCampaign(campaignId: string): Promise<number> {
    const camp = this._campaigns.find(c => c.id === campaignId);
    if (!camp) return 0;

    const evalsToDel = this._evaluations.filter(e => e.annee === camp.annee);
    const ids = evalsToDel.map(e => e.id);
    this._evaluations = this._evaluations.filter(e => e.annee !== camp.annee);
    if (ids.length > 0) {
        await supabase.from('evaluations').delete().in('id', ids);
    }

    const users = this.getUsers().filter(u => {
        if (u.role === Role.ADMIN) return false;
        if (camp.targetRole === 'ALL') return true;
        return u.role === camp.targetRole;
    });

    const newEvals: Evaluation[] = users.map(agent => ({
        id: `eval_${camp.annee}_${agent.id}`,
        agentId: agent.id,
        annee: camp.annee,
        statut: EvaluationStatus.BROUILLON,
        notes: [],
        noteGlobale: 0,
        validations: []
    }));

    await this.createEvaluations(newEvals);
    this._persist();
    
    this.addAuditLog({ 
        userId: "ADMIN", userRole: Role.ADMIN, targetId: campaignId, 
        action: "RESET_CAMPAIGN", details: `Réinitialisation de la campagne ${camp.annee} (${newEvals.length} fiches)` 
    });

    return newEvals.length;
  }

  getNotifications(): Notification[] { return this._notifications; }

  // Ensure a list of user ids exist in the remote `users` table. If some are missing,
  // attempt to insert corresponding rows from the local cache (or minimal placeholders).
  private async ensureRemoteUsersExist(userIds: string[]) {
      const ids = Array.from(new Set(userIds.filter(Boolean)));
      if (ids.length === 0) return;
      try {
          const { data: existing, error: selErr } = await supabase.from('users').select('id').in('id', ids);
          if (selErr) {
              console.warn('ensureRemoteUsersExist select failed:', selErr);
              return;
          }
          const existingIds = (existing || []).map((r: any) => r.id);
          const missing = ids.filter(i => !existingIds.includes(i));
          if (missing.length === 0) return;

          // Build payloads from local cache when available, otherwise minimal placeholder
          const toInsert = missing.map(mid => {
              const local = this._users.find(u => u.id === mid);
              if (local) {
                  return {
                      id: local.id, matricule: local.matricule || null, email: local.email || null,
                      nom: local.nom || null, prenom: local.prenom || null, role: local.role || null,
                      departement: local.departement || null, service: local.service || null,
                      fonction: local.fonction || null, categorie: local.categorie || null,
                      avatar_url: local.avatarUrl || null, date_entree: local.dateEntree || null, is_encadrant: local.isEncadrant || false,
                      auth_id: local.authId || null
                  };
              }
              // fallback minimal row
              return { id: mid, matricule: mid, nom: 'Utilisateur', prenom: '', role: Role.AGENT };
          });

          // Upsert missing users so FK constraints are satisfied.
          const { data: upsertedUsers, error: insErr } = await supabase.from('users').upsert(toInsert, { onConflict: 'id' });
          if (insErr) console.warn('ensureRemoteUsersExist upsert failed:', insErr, 'payload:', toInsert);
          else console.debug('ensureRemoteUsersExist upserted users:', (upsertedUsers || []).map((u: any) => u.id));
      } catch (err) {
          console.warn('ensureRemoteUsersExist unexpected error:', err);
      }
  }

  async addNotification(notif: Notification) {
    this._notifications = [notif, ...this._notifications];
    this._persist();
        try {
            const payload = [{ id: notif.id, user_id: notif.userId, message: notif.message, date: notif.date, read: notif.read, type: notif.type, link_to_eval_id: notif.linkToEvalId }];
            // Ensure the recipient exists remotely to avoid FK constraint errors
            await this.ensureRemoteUsersExist([notif.userId]);
            const { data, error } = await supabase.from('notifications').upsert(payload, { onConflict: 'id' });
            if (error) {
                console.error('Supabase upsert notification failed:', JSON.stringify(error), 'payload:', JSON.stringify(payload));
            } else {
                console.debug('Supabase upsert notification succeeded:', payload.map(p => p.id));
            }
        } catch (err) {
            console.error('addNotification supabase error:', err, 'notif:', notif);
        }
  }

  async markNotificationRead(id: string) {
    this._notifications = this._notifications.map(n => n.id === id ? { ...n, read: true } : n);
    this._persist();
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  }

  async markAllNotificationsRead(userId: string) {
    this._notifications = this._notifications.map(n => n.userId === userId ? { ...n, read: true } : n);
    this._persist();
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
  }

  async markNotificationsByTypeRead(userId: string, type: string) {
    this._notifications = this._notifications.map(n => (n.userId === userId && n.type === type) ? { ...n, read: true } : n);
    this._persist();
    await supabase.from('notifications').update({ read: true }).match({ user_id: userId, type: type });
  }

  resetSystem() {
      if(window.confirm("RESET TOTAL ?")) {
        this.addAuditLog({ userId: "SYSTEM", userRole: Role.ADMIN, targetId: "DB", action: "PURGE_COMPLETE", details: "Remise à zéro de la base locale" });
        localStorage.clear();
        window.location.reload();
      }
  }

  getBackupData(): string {
      return JSON.stringify({ users: this._users, evaluations: this._evaluations, campaigns: this._campaigns, structure: this._structure, audit: this._auditLogs }, null, 2);
  }

  // --- PASSWORD MANAGEMENT (Admin Système) ---

  getUserPasswords(): Record<string, { password: string; setAt: string; setBy: string }> {
      return { ...this._userPasswords };
  }

  getPasswordForUser(userId: string): { password: string; setAt: string; setBy: string } | null {
      return this._userPasswords[userId] || null;
  }

  async setUserPassword(userId: string, password: string, adminId: string): Promise<boolean> {
      const user = this._users.find(u => u.id === userId);
      if (!user) return false;

      // Store password locally for admin visibility
      this._userPasswords[userId] = {
          password,
          setAt: new Date().toISOString(),
          setBy: adminId
      };
      this._persist();

      // Try to update password in Supabase Auth
      if (user.email) {
          try {
              // Use Supabase admin API if available (requires service_role key)
              // With anon key, we can only send a reset email
              const { error } = await supabase.auth.admin.updateUserById(
                  user.authId || userId,
                  { password }
              );
              if (error) {
                  console.warn('Supabase admin updateUserById failed (may need service_role key):', error);
                  // Fallback: try to sign up / update via other means
              }
          } catch (e) {
              console.warn('Password update via Supabase admin failed:', e);
          }
      }

      this.addAuditLog({
          userId: adminId,
          userRole: Role.ADMIN,
          targetId: userId,
          targetName: user ? `${user.nom} ${user.prenom}` : userId,
          action: 'SET_PASSWORD',
          details: `Mot de passe défini/modifié pour ${user.nom} ${user.prenom} (${user.email || user.matricule})`
      });

      return true;
  }

  async resetUserPassword(userId: string, adminId: string): Promise<{ success: boolean; newPassword: string }> {
      const user = this._users.find(u => u.id === userId);
      if (!user) return { success: false, newPassword: '' };

      // Generate a temporary password
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      let newPassword = 'PAL_';
      for (let i = 0; i < 8; i++) newPassword += chars.charAt(Math.floor(Math.random() * chars.length));

      // Store locally
      this._userPasswords[userId] = {
          password: newPassword,
          setAt: new Date().toISOString(),
          setBy: adminId
      };
      this._persist();

      // Try to update in Supabase Auth
      if (user.authId || user.email) {
          try {
              const { error } = await supabase.auth.admin.updateUserById(
                  user.authId || userId,
                  { password: newPassword }
              );
              if (error) {
                  console.warn('Supabase admin password reset failed:', error);
              }
          } catch (e) {
              console.warn('Password reset via Supabase admin failed:', e);
          }
      }

      this.addAuditLog({
          userId: adminId,
          userRole: Role.ADMIN,
          targetId: userId,
          targetName: `${user.nom} ${user.prenom}`,
          action: 'RESET_PASSWORD',
          details: `Réinitialisation du mot de passe pour ${user.nom} ${user.prenom} (${user.email || user.matricule})`
      });

      return { success: true, newPassword };
  }

  async sendPasswordResetEmail(userId: string, adminId: string): Promise<boolean> {
      const user = this._users.find(u => u.id === userId);
      if (!user || !user.email) return false;

      try {
          const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
              redirectTo: window.location.origin
          });
          if (error) {
              console.warn('Send password reset email failed:', error);
              return false;
          }

          this.addAuditLog({
              userId: adminId,
              userRole: Role.ADMIN,
              targetId: userId,
              targetName: `${user.nom} ${user.prenom}`,
              action: 'SEND_RESET_EMAIL',
              details: `Email de réinitialisation envoyé à ${user.email}`
          });

          return true;
      } catch (e) {
          console.warn('sendPasswordResetEmail error:', e);
          return false;
      }
  }
}

export const db = new DatabaseService();

// Expose for debugging in the browser console during development
try {
    if (typeof window !== 'undefined') (window as any).db = db;
} catch (e) {
    // ignore
}

// Debug helpers exposed for console diagnostics
if (typeof window !== 'undefined') {
    (window as any).db_getRawAuthSession = async () => {
        try { return await supabase.auth.getSession(); } catch (e) { console.warn('getRawAuthSession failed', e); return null; }
    };
    (window as any).db_queryRemoteUsersByEmail = async (email: string) => {
        try { const { data, error } = await supabase.from('users').select('*').ilike('email', email); if (error) { console.warn('queryRemoteUsersByEmail error', error); return null; } return data; } catch (e) { console.warn('queryRemoteUsersByEmail failed', e); return null; }
    };
    (window as any).db_trySignIn = async (email: string, password: string) => {
        try {
            const res = await supabase.auth.signInWithPassword({ email: email.trim(), password });
            console.debug('db_trySignIn result', res);
            try { console.debug('session after signIn:', await supabase.auth.getSession()); } catch(e){}
            return res;
        } catch (e) { console.warn('db_trySignIn failed', e); return { error: e }; }
    };
}