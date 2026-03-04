from datetime import date
from flask import Blueprint, render_template, request, redirect, url_for, flash
from ..models import Agent, Evaluation, DetailEvaluation, Critere
from .. import db

evaluations_bp = Blueprint("evaluations", __name__)

PERIODES = ["T1 (1er trimestre)", "T2 (2ème trimestre)", "T3 (3ème trimestre)", "T4 (4ème trimestre)",
            "S1 (1er semestre)", "S2 (2ème semestre)", "Annuelle"]


@evaluations_bp.route("/")
def liste():
    annee = request.args.get("annee", "").strip()
    agent_id = request.args.get("agent_id", "").strip()
    statut = request.args.get("statut", "").strip()

    query = Evaluation.query
    if annee:
        try:
            query = query.filter_by(annee=int(annee))
        except ValueError:
            pass
    if agent_id:
        try:
            query = query.filter_by(agent_id=int(agent_id))
        except ValueError:
            pass
    if statut:
        query = query.filter_by(statut=statut)

    evaluations = query.order_by(Evaluation.annee.desc(), Evaluation.id.desc()).all()
    agents = Agent.query.filter_by(actif=True).order_by(Agent.nom, Agent.prenom).all()
    annees = db.session.query(Evaluation.annee).distinct().order_by(Evaluation.annee.desc()).all()
    annees = [a[0] for a in annees]

    return render_template(
        "evaluations/liste.html",
        evaluations=evaluations,
        agents=agents,
        annees=annees,
        annee=annee,
        agent_id=agent_id,
        statut=statut,
    )


@evaluations_bp.route("/nouvelle", methods=["GET", "POST"])
def nouvelle():
    agents = Agent.query.filter_by(actif=True).order_by(Agent.nom, Agent.prenom).all()
    criteres = Critere.query.filter_by(actif=True).order_by(Critere.categorie, Critere.libelle).all()

    if request.method == "POST":
        agent_id = request.form.get("agent_id", "").strip()
        annee_str = request.form.get("annee", "").strip()
        periode = request.form.get("periode", "").strip()
        evaluateur = request.form.get("evaluateur", "").strip()
        date_eval_str = request.form.get("date_evaluation", "").strip()
        commentaire_general = request.form.get("commentaire_general", "").strip()
        action = request.form.get("action", "brouillon")

        errors = []
        if not agent_id:
            errors.append("Veuillez sélectionner un agent.")
        if not periode:
            errors.append("La période est obligatoire.")
        if not evaluateur:
            errors.append("Le nom de l'évaluateur est obligatoire.")

        annee = None
        if annee_str:
            try:
                annee = int(annee_str)
            except ValueError:
                errors.append("Année invalide.")
        else:
            errors.append("L'année est obligatoire.")

        date_eval = date.today()
        if date_eval_str:
            try:
                date_eval = date.fromisoformat(date_eval_str)
            except ValueError:
                errors.append("Date d'évaluation invalide.")

        if errors:
            for e in errors:
                flash(e, "danger")
            return render_template(
                "evaluations/formulaire.html",
                agents=agents,
                criteres=criteres,
                periodes=PERIODES,
                form=request.form,
                action="nouvelle",
            )

        eval_obj = Evaluation(
            agent_id=int(agent_id),
            annee=annee,
            periode=periode,
            evaluateur=evaluateur,
            date_evaluation=date_eval,
            commentaire_general=commentaire_general,
            statut="Finalisée" if action == "finaliser" else "Brouillon",
        )
        db.session.add(eval_obj)
        db.session.flush()

        for critere in criteres:
            note_str = request.form.get(f"note_{critere.id}", "").strip()
            commentaire = request.form.get(f"commentaire_{critere.id}", "").strip()
            note = None
            if note_str:
                try:
                    note = float(note_str)
                    note = max(0.0, min(20.0, note))
                except ValueError:
                    pass
            detail = DetailEvaluation(
                evaluation_id=eval_obj.id,
                critere_id=critere.id,
                note=note,
                commentaire=commentaire,
            )
            db.session.add(detail)

        db.session.commit()
        flash("Évaluation enregistrée avec succès.", "success")
        return redirect(url_for("evaluations.detail", eval_id=eval_obj.id))

    return render_template(
        "evaluations/formulaire.html",
        agents=agents,
        criteres=criteres,
        periodes=PERIODES,
        form={},
        action="nouvelle",
    )


@evaluations_bp.route("/<int:eval_id>")
def detail(eval_id):
    evaluation = Evaluation.query.get_or_404(eval_id)
    return render_template("evaluations/detail.html", evaluation=evaluation)


@evaluations_bp.route("/<int:eval_id>/modifier", methods=["GET", "POST"])
def modifier(eval_id):
    evaluation = Evaluation.query.get_or_404(eval_id)
    agents = Agent.query.filter_by(actif=True).order_by(Agent.nom, Agent.prenom).all()
    criteres = Critere.query.filter_by(actif=True).order_by(Critere.categorie, Critere.libelle).all()

    # Build existing notes map
    notes_map = {d.critere_id: d for d in evaluation.details}

    if request.method == "POST":
        evaluateur = request.form.get("evaluateur", "").strip()
        date_eval_str = request.form.get("date_evaluation", "").strip()
        commentaire_general = request.form.get("commentaire_general", "").strip()
        action = request.form.get("action", "brouillon")

        errors = []
        if not evaluateur:
            errors.append("Le nom de l'évaluateur est obligatoire.")

        date_eval = evaluation.date_evaluation
        if date_eval_str:
            try:
                date_eval = date.fromisoformat(date_eval_str)
            except ValueError:
                errors.append("Date d'évaluation invalide.")

        if errors:
            for e in errors:
                flash(e, "danger")
            return render_template(
                "evaluations/formulaire.html",
                agents=agents,
                criteres=criteres,
                periodes=PERIODES,
                form=request.form,
                evaluation=evaluation,
                notes_map=notes_map,
                action="modifier",
            )

        evaluation.evaluateur = evaluateur
        evaluation.date_evaluation = date_eval
        evaluation.commentaire_general = commentaire_general
        evaluation.statut = "Finalisée" if action == "finaliser" else "Brouillon"

        for critere in criteres:
            note_str = request.form.get(f"note_{critere.id}", "").strip()
            commentaire = request.form.get(f"commentaire_{critere.id}", "").strip()
            note = None
            if note_str:
                try:
                    note = float(note_str)
                    note = max(0.0, min(20.0, note))
                except ValueError:
                    pass

            if critere.id in notes_map:
                notes_map[critere.id].note = note
                notes_map[critere.id].commentaire = commentaire
            else:
                db.session.add(DetailEvaluation(
                    evaluation_id=evaluation.id,
                    critere_id=critere.id,
                    note=note,
                    commentaire=commentaire,
                ))

        db.session.commit()
        flash("Évaluation mise à jour.", "success")
        return redirect(url_for("evaluations.detail", eval_id=evaluation.id))

    return render_template(
        "evaluations/formulaire.html",
        agents=agents,
        criteres=criteres,
        periodes=PERIODES,
        form=evaluation,
        evaluation=evaluation,
        notes_map=notes_map,
        action="modifier",
    )


@evaluations_bp.route("/<int:eval_id>/supprimer", methods=["POST"])
def supprimer(eval_id):
    evaluation = Evaluation.query.get_or_404(eval_id)
    db.session.delete(evaluation)
    db.session.commit()
    flash("Évaluation supprimée.", "info")
    return redirect(url_for("evaluations.liste"))


@evaluations_bp.route("/<int:eval_id>/finaliser", methods=["POST"])
def finaliser(eval_id):
    evaluation = Evaluation.query.get_or_404(eval_id)
    evaluation.statut = "Finalisée"
    db.session.commit()
    flash("Évaluation finalisée.", "success")
    return redirect(url_for("evaluations.detail", eval_id=evaluation.id))
