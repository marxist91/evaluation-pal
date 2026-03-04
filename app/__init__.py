import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def create_app():
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production"),
        SQLALCHEMY_DATABASE_URI=os.environ.get(
            "DATABASE_URL",
            f"sqlite:///{os.path.join(app.instance_path, 'evaluation_pal.db')}",
        ),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )

    os.makedirs(app.instance_path, exist_ok=True)

    db.init_app(app)

    from .routes.main import main_bp
    from .routes.agents import agents_bp
    from .routes.criteres import criteres_bp
    from .routes.evaluations import evaluations_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(agents_bp, url_prefix="/agents")
    app.register_blueprint(criteres_bp, url_prefix="/criteres")
    app.register_blueprint(evaluations_bp, url_prefix="/evaluations")

    with app.app_context():
        db.create_all()
        _seed_criteres_defaults()

    return app


def _seed_criteres_defaults():
    from .models import Critere

    if Critere.query.count() > 0:
        return

    defaults = [
        ("Ponctualité et assiduité", "Respect des horaires et présence régulière au poste", 15, "Comportement"),
        ("Qualité du travail", "Précision, rigueur et qualité des tâches réalisées", 20, "Performance"),
        ("Rendement et productivité", "Quantité de travail accompli dans les délais impartis", 20, "Performance"),
        ("Initiative et créativité", "Capacité à proposer des solutions et à innover", 10, "Compétences"),
        ("Esprit d'équipe", "Collaboration, entraide et communication avec les collègues", 15, "Comportement"),
        ("Respect des consignes", "Application des règles, procédures et instructions", 10, "Comportement"),
        ("Compétences techniques", "Maîtrise des outils et techniques liés au poste", 10, "Compétences"),
    ]

    for libelle, description, ponderation, categorie in defaults:
        db.session.add(
            Critere(
                libelle=libelle,
                description=description,
                ponderation=ponderation,
                categorie=categorie,
            )
        )
    db.session.commit()
