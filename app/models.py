from datetime import date
from . import db


class Agent(db.Model):
    __tablename__ = "agents"

    id = db.Column(db.Integer, primary_key=True)
    matricule = db.Column(db.String(20), unique=True, nullable=False)
    nom = db.Column(db.String(100), nullable=False)
    prenom = db.Column(db.String(100), nullable=False)
    poste = db.Column(db.String(150), nullable=False)
    service = db.Column(db.String(150), nullable=False)
    categorie = db.Column(db.String(50))
    date_embauche = db.Column(db.Date)
    email = db.Column(db.String(200))
    telephone = db.Column(db.String(30))
    actif = db.Column(db.Boolean, default=True)
    evaluations = db.relationship("Evaluation", backref="agent", lazy=True, cascade="all, delete-orphan")

    @property
    def nom_complet(self):
        return f"{self.prenom} {self.nom}"

    def __repr__(self):
        return f"<Agent {self.matricule} – {self.nom_complet}>"


class Critere(db.Model):
    __tablename__ = "criteres"

    id = db.Column(db.Integer, primary_key=True)
    libelle = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    ponderation = db.Column(db.Integer, default=10)  # percentage weight
    categorie = db.Column(db.String(100), default="Général")
    actif = db.Column(db.Boolean, default=True)
    details = db.relationship("DetailEvaluation", backref="critere", lazy=True)

    def __repr__(self):
        return f"<Critere {self.libelle}>"


class Evaluation(db.Model):
    __tablename__ = "evaluations"

    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey("agents.id"), nullable=False)
    annee = db.Column(db.Integer, nullable=False)
    periode = db.Column(db.String(30), nullable=False)  # e.g. "T1", "T2", "S1", "Annuelle"
    date_evaluation = db.Column(db.Date, default=date.today)
    evaluateur = db.Column(db.String(200), nullable=False)
    commentaire_general = db.Column(db.Text)
    statut = db.Column(db.String(20), default="Brouillon")  # Brouillon | Finalisée
    details = db.relationship("DetailEvaluation", backref="evaluation", lazy=True, cascade="all, delete-orphan")

    @property
    def note_globale(self):
        if not self.details:
            return 0
        total_poids = sum(d.critere.ponderation for d in self.details if d.critere)
        if total_poids == 0:
            return 0
        total_note = sum(
            d.note * d.critere.ponderation for d in self.details if d.critere and d.note is not None
        )
        return round(total_note / total_poids, 2)

    @property
    def appreciation(self):
        note = self.note_globale
        if note >= 18:
            return "Exceptionnel"
        elif note >= 15:
            return "Très bien"
        elif note >= 12:
            return "Bien"
        elif note >= 10:
            return "Assez bien"
        elif note >= 7:
            return "Insuffisant"
        else:
            return "Très insuffisant"

    def __repr__(self):
        return f"<Evaluation agent={self.agent_id} {self.annee} {self.periode}>"


class DetailEvaluation(db.Model):
    __tablename__ = "details_evaluation"

    id = db.Column(db.Integer, primary_key=True)
    evaluation_id = db.Column(db.Integer, db.ForeignKey("evaluations.id"), nullable=False)
    critere_id = db.Column(db.Integer, db.ForeignKey("criteres.id"), nullable=False)
    note = db.Column(db.Float)  # 0–20
    commentaire = db.Column(db.Text)

    def __repr__(self):
        return f"<Detail eval={self.evaluation_id} critere={self.critere_id} note={self.note}>"
