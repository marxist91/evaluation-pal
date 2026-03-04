from flask import Blueprint, render_template
from sqlalchemy import func
from ..models import Agent, Evaluation, Critere
from .. import db

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def dashboard():
    nb_agents = Agent.query.filter_by(actif=True).count()
    nb_evaluations = Evaluation.query.count()
    nb_finalisees = Evaluation.query.filter_by(statut="Finalisée").count()
    nb_criteres = Critere.query.filter_by(actif=True).count()

    # Recent evaluations
    recent = (
        Evaluation.query.order_by(Evaluation.id.desc()).limit(5).all()
    )

    # Evaluations per year
    stats_annee = (
        db.session.query(Evaluation.annee, func.count(Evaluation.id))
        .group_by(Evaluation.annee)
        .order_by(Evaluation.annee.desc())
        .limit(5)
        .all()
    )

    return render_template(
        "dashboard.html",
        nb_agents=nb_agents,
        nb_evaluations=nb_evaluations,
        nb_finalisees=nb_finalisees,
        nb_criteres=nb_criteres,
        recent=recent,
        stats_annee=stats_annee,
    )
