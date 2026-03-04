-- Script d'insertion / upsert des utilisateurs pour la table public.users
-- Exécuter dans l'éditeur SQL de Supabase (ou via psql) pour créer/mettre à jour les lignes
-- Modèles fournis : u_admin, u_drh, u_dir, u_chef, u_agent

BEGIN;

-- Ajustez la liste des colonnes si votre schéma diffère.
INSERT INTO public.users (
	id,
	matricule,
	email,
	nom,
	prenom,
	role,
	departement,
	service,
	fonction,
	categorie,
	avatar_url,
	date_entree,
	is_encadrant,
	created_at
) VALUES
	('u_admin','SYS001', NULL, 'SYSTÈME','Administrateur','Administrateur Système','Direction Générale','IT','Super Admin','HC', NULL, NULL, false, '2026-01-21T19:27:14.440744+00:00'),
	('u_drh','RH001', NULL, 'KOUASSI','Abla','DRH','Direction des Ressources Humaines','Administration','Directrice RH','HC', NULL, NULL, true, '2026-01-21T19:27:14.781828+00:00'),
	('u_dir','DIR001', NULL, 'LAWSON','Tévi','Directeur de Département','Direction des Systèmes d''Information', NULL, 'Directeur DSI','HC', NULL, NULL, true, '2026-01-21T19:27:15.095832+00:00'),
	('u_chef','CH001', NULL, 'DOSSEH','Kossi','Chef de Service','Direction des Systèmes d''Information','Développement','Chef Service Dev','C1', NULL, NULL, true, '2026-01-21T19:27:15.452243+00:00'),
	('u_agent','AG001','kodjo@pal.tg','MENSAH','Kodjo','Agent','Direction des Systèmes d''Information','Développement','Développeur Fullstack','B1', NULL, NULL, false, '2026-01-21T19:27:15.777218+00:00')
ON CONFLICT (id) DO UPDATE SET
	matricule = EXCLUDED.matricule,
	email = EXCLUDED.email,
	nom = EXCLUDED.nom,
	prenom = EXCLUDED.prenom,
	role = EXCLUDED.role,
	departement = EXCLUDED.departement,
	service = EXCLUDED.service,
	fonction = EXCLUDED.fonction,
	categorie = EXCLUDED.categorie,
	avatar_url = EXCLUDED.avatar_url,
	date_entree = EXCLUDED.date_entree,
	is_encadrant = EXCLUDED.is_encadrant;

COMMIT;

-- Notes:
-- 1) Si votre table `users` utilise d'autres noms de colonnes (ex: "departmentement" faute de frappe), adaptez la liste des colonnes ci-dessus.
 
-- ------------------------------------------------------------
-- Fonction utilitaire : public.sync_auth_roles()
-- But : lier les UID d'`auth.users` aux lignes `public.users` par email,
--       recopier le rôle depuis `auth.users.raw_app_meta_data` vers `public.users.role`
--       et neutraliser les placeholders (doublons sans rôle) de manière conservatrice.
-- Usage : SELECT public.sync_auth_roles();
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_auth_roles()
RETURNS void
LANGUAGE plpgsql
AS $func$
BEGIN
	-- 1) assurer la colonne auth_id
	PERFORM 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_id';
	IF NOT FOUND THEN
		EXECUTE 'ALTER TABLE public.users ADD COLUMN auth_id uuid';
	END IF;

	-- 2) préparer une table temporaire des users Auth
	EXECUTE 'CREATE TEMP TABLE tmp_auth_map ON COMMIT DROP AS '
		|| 'SELECT id AS auth_id, lower(email) AS email, (raw_app_meta_data->>''role'') AS auth_role, '
		|| '(raw_user_meta_data->>''role'') AS user_meta_role FROM auth.users';

	-- 3) associer auth_id par email lorsque manquant ou différent
	UPDATE public.users p
	SET auth_id = t.auth_id
	FROM tmp_auth_map t
	WHERE lower(p.email) = t.email
		AND (p.auth_id IS NULL OR p.auth_id <> t.auth_id);

	-- 4) copier/normaliser le rôle depuis raw_app_meta_data/raw_user_meta_data
	UPDATE public.users p
	SET role = CASE lower(coalesce(t.auth_role, t.user_meta_role))
			WHEN 'admin' THEN 'Administrateur Système'
			WHEN 'administrateur' THEN 'Administrateur Système'
			WHEN 'drh' THEN 'DRH'
			WHEN 'chef_service' THEN 'Chef de Service'
			WHEN 'chef de service' THEN 'Chef de Service'
			WHEN 'directeur' THEN 'Directeur de Département'
			WHEN 'agent' THEN 'Agent'
			ELSE p.role
		END
	FROM tmp_auth_map t
	WHERE p.auth_id = t.auth_id
		AND (t.auth_role IS NOT NULL OR t.user_meta_role IS NOT NULL);

	-- 5) neutraliser auth_id sur les placeholders (role IS NULL) s'il existe
	--    une autre ligne (keeper) avec le même email et role non-null.
	WITH keepers AS (
		SELECT lower(email) AS email, min(id) AS keeper_id
		FROM public.users
		WHERE role IS NOT NULL
		GROUP BY lower(email)
	)
	UPDATE public.users p
	SET auth_id = NULL
	FROM keepers k
	WHERE lower(p.email) = k.email
		AND p.role IS NULL;

	-- 6) attribuer un rôle par défaut 'Agent' aux lignes liées à auth_id mais sans role
	UPDATE public.users
	SET role = 'Agent'
	WHERE role IS NULL AND auth_id IS NOT NULL;

END;
$func$;

-- Exemple d'appel :
-- SELECT public.sync_auth_roles();