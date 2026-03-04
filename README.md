# Évaluation PAL – Port Autonome de Lomé

Application web de gestion des évaluations du personnel du Port Autonome de Lomé (PAL).

## Fonctionnalités

- **Gestion des agents** : ajout, modification, désactivation, recherche/filtre par service
- **Grille de critères** : critères paramétrables avec pondération (7 critères prédéfinis)
- **Évaluations** : création de fiches d'évaluation par période (trimestrielle, semestrielle, annuelle)
- **Notes et appréciations** : calcul automatique de la note globale pondérée (sur 20), appréciation textuelle
- **Tableau de bord** : statistiques globales, dernières évaluations, actions rapides
- **Impression** : mise en page d'impression de la fiche d'évaluation

## Prérequis

- Python 3.10+
- pip

## Installation

```bash
# 1. Cloner le dépôt
git clone https://github.com/marxist91/evaluation-pal.git
cd evaluation-pal

# 2. Créer et activer un environnement virtuel
python3 -m venv venv
source venv/bin/activate   # Linux/macOS
venv\Scripts\activate      # Windows

# 3. Installer les dépendances
pip install -r requirements.txt

# 4. Lancer l'application
python run.py
```

L'application est accessible sur <http://127.0.0.1:5000>.

## Structure du projet

```
evaluation-pal/
├── app/
│   ├── __init__.py          # Fabrique Flask, initialisation DB
│   ├── models.py            # Modèles SQLAlchemy (Agent, Critere, Evaluation…)
│   ├── routes/
│   │   ├── main.py          # Tableau de bord
│   │   ├── agents.py        # CRUD agents
│   │   ├── criteres.py      # CRUD critères
│   │   └── evaluations.py   # CRUD évaluations
│   └── templates/
│       ├── base.html
│       ├── dashboard.html
│       ├── agents/
│       ├── criteres/
│       └── evaluations/
├── instance/                # Base de données SQLite (gitignorée)
├── run.py                   # Point d'entrée
└── requirements.txt
```

## Critères d'évaluation par défaut

| Critère | Pondération |
|---|---|
| Qualité du travail | 20 % |
| Rendement et productivité | 20 % |
| Ponctualité et assiduité | 15 % |
| Esprit d'équipe | 15 % |
| Initiative et créativité | 10 % |
| Respect des consignes | 10 % |
| Compétences techniques | 10 % |

## Barème d'appréciation

| Note /20 | Appréciation |
|---|---|
| ≥ 18 | Exceptionnel |
| 15 – 17 | Très bien |
| 12 – 14 | Bien |
| 10 – 11 | Assez bien |
| 7 – 9 | Insuffisant |
| < 7 | Très insuffisant |
