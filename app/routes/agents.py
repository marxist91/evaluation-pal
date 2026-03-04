from flask import Blueprint, render_template, request, redirect, url_for, flash
from datetime import date
from ..models import Agent
from .. import db

agents_bp = Blueprint("agents", __name__)


@agents_bp.route("/")
def liste():
    q = request.args.get("q", "").strip()
    service = request.args.get("service", "").strip()
    actif = request.args.get("actif", "1")

    query = Agent.query
    if actif == "1":
        query = query.filter_by(actif=True)
    elif actif == "0":
        query = query.filter_by(actif=False)

    if q:
        like = f"%{q}%"
        query = query.filter(
            db.or_(
                Agent.nom.ilike(like),
                Agent.prenom.ilike(like),
                Agent.matricule.ilike(like),
                Agent.poste.ilike(like),
            )
        )
    if service:
        query = query.filter(Agent.service.ilike(f"%{service}%"))

    agents = query.order_by(Agent.nom, Agent.prenom).all()
    services = db.session.query(Agent.service).distinct().order_by(Agent.service).all()
    services = [s[0] for s in services]

    return render_template(
        "agents/liste.html",
        agents=agents,
        services=services,
        q=q,
        service=service,
        actif=actif,
    )


@agents_bp.route("/nouveau", methods=["GET", "POST"])
def nouveau():
    if request.method == "POST":
        matricule = request.form.get("matricule", "").strip()
        nom = request.form.get("nom", "").strip()
        prenom = request.form.get("prenom", "").strip()
        poste = request.form.get("poste", "").strip()
        service = request.form.get("service", "").strip()
        categorie = request.form.get("categorie", "").strip()
        email = request.form.get("email", "").strip()
        telephone = request.form.get("telephone", "").strip()
        date_embauche_str = request.form.get("date_embauche", "").strip()

        errors = []
        if not matricule:
            errors.append("Le matricule est obligatoire.")
        elif Agent.query.filter_by(matricule=matricule).first():
            errors.append("Ce matricule existe déjà.")
        if not nom:
            errors.append("Le nom est obligatoire.")
        if not prenom:
            errors.append("Le prénom est obligatoire.")
        if not poste:
            errors.append("Le poste est obligatoire.")
        if not service:
            errors.append("Le service est obligatoire.")

        date_embauche = None
        if date_embauche_str:
            try:
                date_embauche = date.fromisoformat(date_embauche_str)
            except ValueError:
                errors.append("Date d'embauche invalide.")

        if errors:
            for e in errors:
                flash(e, "danger")
            return render_template("agents/formulaire.html", action="nouveau", form=request.form)

        agent = Agent(
            matricule=matricule,
            nom=nom,
            prenom=prenom,
            poste=poste,
            service=service,
            categorie=categorie,
            email=email,
            telephone=telephone,
            date_embauche=date_embauche,
        )
        db.session.add(agent)
        db.session.commit()
        flash(f"Agent {agent.nom_complet} créé avec succès.", "success")
        return redirect(url_for("agents.detail", agent_id=agent.id))

    return render_template("agents/formulaire.html", action="nouveau", form={})


@agents_bp.route("/<int:agent_id>")
def detail(agent_id):
    agent = Agent.query.get_or_404(agent_id)
    evaluations = sorted(agent.evaluations, key=lambda e: (e.annee, e.periode), reverse=True)
    return render_template("agents/detail.html", agent=agent, evaluations=evaluations)


@agents_bp.route("/<int:agent_id>/modifier", methods=["GET", "POST"])
def modifier(agent_id):
    agent = Agent.query.get_or_404(agent_id)

    if request.method == "POST":
        matricule = request.form.get("matricule", "").strip()
        nom = request.form.get("nom", "").strip()
        prenom = request.form.get("prenom", "").strip()
        poste = request.form.get("poste", "").strip()
        service = request.form.get("service", "").strip()
        categorie = request.form.get("categorie", "").strip()
        email = request.form.get("email", "").strip()
        telephone = request.form.get("telephone", "").strip()
        date_embauche_str = request.form.get("date_embauche", "").strip()

        errors = []
        if not matricule:
            errors.append("Le matricule est obligatoire.")
        else:
            existing = Agent.query.filter_by(matricule=matricule).first()
            if existing and existing.id != agent.id:
                errors.append("Ce matricule est déjà utilisé par un autre agent.")
        if not nom:
            errors.append("Le nom est obligatoire.")
        if not prenom:
            errors.append("Le prénom est obligatoire.")
        if not poste:
            errors.append("Le poste est obligatoire.")
        if not service:
            errors.append("Le service est obligatoire.")

        date_embauche = agent.date_embauche
        if date_embauche_str:
            try:
                date_embauche = date.fromisoformat(date_embauche_str)
            except ValueError:
                errors.append("Date d'embauche invalide.")

        if errors:
            for e in errors:
                flash(e, "danger")
            return render_template("agents/formulaire.html", action="modifier", agent=agent, form=request.form)

        agent.matricule = matricule
        agent.nom = nom
        agent.prenom = prenom
        agent.poste = poste
        agent.service = service
        agent.categorie = categorie
        agent.email = email
        agent.telephone = telephone
        agent.date_embauche = date_embauche
        db.session.commit()
        flash("Agent mis à jour avec succès.", "success")
        return redirect(url_for("agents.detail", agent_id=agent.id))

    return render_template("agents/formulaire.html", action="modifier", agent=agent, form=agent)


@agents_bp.route("/<int:agent_id>/desactiver", methods=["POST"])
def desactiver(agent_id):
    agent = Agent.query.get_or_404(agent_id)
    agent.actif = not agent.actif
    db.session.commit()
    etat = "réactivé" if agent.actif else "désactivé"
    flash(f"Agent {agent.nom_complet} {etat}.", "success")
    return redirect(url_for("agents.detail", agent_id=agent.id))


@agents_bp.route("/<int:agent_id>/supprimer", methods=["POST"])
def supprimer(agent_id):
    agent = Agent.query.get_or_404(agent_id)
    nom = agent.nom_complet
    db.session.delete(agent)
    db.session.commit()
    flash(f"Agent {nom} supprimé.", "info")
    return redirect(url_for("agents.liste"))
