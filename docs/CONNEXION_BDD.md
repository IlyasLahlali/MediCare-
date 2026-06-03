# Connexion base de données — MediCare+

Le **code de connexion** est déjà dans le projet :

- `backend/config/db.js` — pool MySQL (`mysql2`)
- `backend/server.js` — charge `.env` et teste la DB au démarrage
- Routes API — utilisent `require("../config/db")`

Ce qu’il faut **configurer à la main** : les **paramètres** (fichier `.env` ou variables Railway).

---

## 1. En local (sur ton PC)

### Étape A — MySQL

1. Ouvre **MySQL Workbench**.
2. **File → Open SQL Script** → `BaseDonnee.sql` → Execute (éclair).
3. Même chose pour `DonneesTest.sql`.
4. La base s’appelle **`Pharmacie_Garde`**.

### Étape B — Fichier `backend/.env`

1. Va dans le dossier `backend`.
2. Copie `.env.example` vers `.env` (s’il n’existe pas).
3. Remplis (exemple) :

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=TON_MOT_DE_PASSE_MYSQL
DB_NAME=Pharmacie_Garde
PORT=3000
JWT_SECRET=medicare_dev_secret_changez_moi
```

> `DB_PASSWORD` vide seulement si MySQL root n’a pas de mot de passe.

### Étape C — Démarrer l’application

```powershell
cd C:\Users\ilyas\Desktop\MediCare+\backend
npm install
npm start
```

### Étape D — Vérifier

Navigateur : `http://localhost:3000/api/health`

Réponse attendue :

```json
{ "ok": true, "database": "connected" }
```

Terminal : `Connecté à MySQL ✔ Pharmacie_Garde`

---

## 2. En ligne (Railway)

### Étape A — Base sur Railway

1. Projet Railway : service **MySQL** + service **MediCare-**.
2. Workbench connecté au host **public** Railway (onglet Connect du MySQL).
3. Exécute **`BaseDonnee_railway.sql`** puis **`DonneesTest_railway.sql`**.
4. Base utilisée : **`railway`** (pas `Pharmacie_Garde` — Railway interdit `CREATE DATABASE`).

### Étape B — Variables sur le service **MediCare-** (pas MySQL)

Onglet **Variables** → ajouter :

**Option recommandée** — une seule variable :

| Nom | Valeur |
|-----|--------|
| `DATABASE_URL` | Référence `${{MySQL.MYSQL_URL}}` ou URL copiée depuis MySQL |
| `JWT_SECRET` | Chaîne longue aléatoire |
| `NODE_ENV` | `production` |

**Option manuelle** :

| Nom | Valeur |
|-----|--------|
| `DB_HOST` | Host MySQL (ex. `xxxx.proxy.rlwy.net`) |
| `DB_PORT` | Port Railway |
| `DB_USER` | Utilisateur |
| `DB_PASSWORD` | Mot de passe |
| `DB_NAME` | `railway` |
| `DB_SSL` | `true` |
| `JWT_SECRET` | Clé secrète |

### Étape C — Déployer

**Deploy** sur MediCare- → logs sans `localhost` :

```
Connecté à MySQL ✔ railway
```

### Étape D — Vérifier

`https://TON-DOMAINE-RAILWAY/api/health` → `ok: true`

---

## 3. Pour le rapport PFE (paragraphe type)

> La couche d’accès aux données repose sur le module `backend/config/db.js`, qui instancie un pool de connexions **mysql2** vers MySQL. Les paramètres (hôte, port, utilisateur, mot de passe, nom de la base) sont lus depuis des variables d’environnement (fichier `.env` en développement, variables Railway en production), ce qui évite de stocker les identifiants dans le code source. Au démarrage, le serveur Express exécute un test `SELECT 1` et expose la route `/api/health` pour valider la disponibilité de la base.

---

## Dépannage

| Symptôme | Cause | Action |
|----------|--------|--------|
| `DB cible : localhost` sur Railway | Pas de variables DB sur MediCare- | Ajouter `DATABASE_URL` ou `DB_*` |
| `Base de données indisponible` | MySQL arrêté ou mauvais mot de passe | Vérifier `.env` / Railway |
| Tables introuvables | SQL non importé | Exécuter les scripts `.sql` |
| `Pharmacie_Garde` sur Railway | Mauvais nom de base | Utiliser `DB_NAME=railway` |
