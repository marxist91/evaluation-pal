from flask import Blueprint, render_template, request, redirect, url_for, flash
from ..models import Critere
from .. import db

criteres_bp = Blueprint("criteres", __name__)


@criteres_bp.route("/")
def liste():
    criteres = Critere.query.order_by(Critere.categorie, Critere.libelle).all()
    total_poids = sum(c.ponderation for c in criteres if c.actif)
    return render_template("criteres/liste.html", criteres=criteres, total_poids=total_poids)


@criteres_bp.route("/nouveau", methods=["GET", "POST"])
def nouveau():
    if request.method == "POST":
        libelle = request.form.get("libelle", "").strip()
        description = request.form.get("description", "").strip()
        ponderation_str = request.form.get("ponderation", "10").strip()
        categorie = request.form.get("categorie", "").strip()

        errors = []
        if not libelle:
            errors.append("Le libellé est obligatoire.")

        ponderation = 10
        try:
            ponderation = int(ponderation_str)
            if not (1 <= ponderation <= 100):
                errors.append("La pondération doit être entre 1 et 100.")
        except ValueError:
            errors.append("La pondération doit être un entier.")

        if errors:
            for e in errors:
                flash(e, "danger")
            return render_template("criteres/formulaire.html", action="nouveau", form=request.form)

        critere = Critere(libelle=libelle, description=description, ponderation=ponderation, categorie=categorie)
        db.session.add(critere)
        db.session.commit()
        flash("Critère créé avec succès.", "success")
        return redirect(url_for("criteres.liste"))

    return render_template("criteres/formulaire.html", action="nouveau", form={})


@criteres_bp.route("/<int:critere_id>/modifier", methods=["GET", "POST"])
def modifier(critere_id):
    critere = Critere.query.get_or_404(critere_id)

    if request.method == "POST":
        libelle = request.form.get("libelle", "").strip()
        description = request.form.get("description", "").strip()
        ponderation_str = request.form.get("ponderation", "10").strip()
        categorie = request.form.get("categorie", "").strip()

        errors = []
        if not libelle:
            errors.append("Le libellé est obligatoire.")

        ponderation = critere.ponderation
        try:
            ponderation = int(ponderation_str)
            if not (1 <= ponderation <= 100):
                errors.append("La pondération doit être entre 1 et 100.")
        except ValueError:
            errors.append("La pondération doit être un entier.")

        if errors:
            for e in errors:
                flash(e, "danger")
            return render_template("criteres/formulaire.html", action="modifier", critere=critere, form=request.form)

        critere.libelle = libelle
        critere.description = description
        critere.ponderation = ponderation
        critere.categorie = categorie
        db.session.commit()
        flash("Critère mis à jour.", "success")
        return redirect(url_for("criteres.liste"))

    return render_template("criteres/formulaire.html", action="modifier", critere=critere, form=critere)


@criteres_bp.route("/<int:critere_id>/supprimer", methods=["POST"])
def supprimer(critere_id):
    critere = Critere.query.get_or_404(critere_id)
    critere.actif = not critere.actif
    db.session.commit()
    etat = "activé" if critere.actif else "désactivé"
    flash(f"Critère « {critere.libelle} » {etat}.", "info")
    return redirect(url_for("criteres.liste"))
