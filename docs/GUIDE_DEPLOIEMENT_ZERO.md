# MediCare+ — Guide complet depuis zéro (Workbench + GitHub + Railway)

Ordre : **PC (MySQL)** → **application locale** → **GitHub** → **Railway (MySQL + app)** → **lien public**.

---

## Phase 0 — Prérequis (une fois)

| Outil | Lien | Pourquoi |
|-------|------|----------|
| MySQL + Workbench | https://dev.mysql.com/downloads/workbench/ | Base de données |
| Node.js 18+ | https://nodejs.org | Serveur MediCare+ |
| Git | https://git-scm.com/download/win | Envoyer le code sur GitHub |
| Compte GitHub | https://github.com | Héberger le code |
| Compte Railway | https://railway.app | MySQL cloud + app en ligne |

Dossier du projet : `C:\Users\ilyas\Desktop\MediCare+`

---

## Phase 1 — Base de données en local (Workbench)

### 1.1 Démarrer MySQL

- Si tu utilises **XAMPP/WAMP** : démarre **MySQL**.
- Sinon : service MySQL Windows démarré.

### 1.2 Ouvrir Workbench

1. Lance **MySQL Workbench**.
2. Connexion **Local instance MySQL** (souvent `root` @ `localhost`).
3. Entre ton mot de passe MySQL (souvent vide sur XAMPP).

### 1.3 Créer la base MediCare+

1. Menu **File → Open SQL Script**.
2. Choisis : `C:\Users\ilyas\Desktop\MediCare+\BaseDonnee.sql`
3. Clique l’**éclair** (Execute) — toute la script doit passer au vert.
4. Résultat : base **`Pharmacie_Garde`** + toutes les tables.

### 1.4 Données de test (comptes démo)

1. **File → Open SQL Script** → `DonneesTest.sql`
2. **Execute**.
3. Comptes créés :
   - Admin : `admin@medicare.ma`
   - Pharmacien : `pharma@medicare.ma`
   - Utilisateur : `user@medicare.ma`  
   (mot de passe = celui défini à l’import ; souvent `admin123` si tu l’as utilisé en local)

### 1.5 Vérifier

Dans Workbench, panneau gauche → **Schemas** → `Pharmacie_Garde` → **Tables**  
Tu dois voir : `utilisateurs`, `pharmacies`, `medicaments`, etc.

---

## Phase 2 — Lancer l’application sur ton PC

### 2.1 Fichier de connexion `.env`

1. Va dans `C:\Users\ilyas\Desktop\MediCare+\backend\`
2. Copie `.env.example` → renomme en **`.env`**
3. Édite `.env` :

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=TON_MOT_DE_PASSE_MYSQL
DB_NAME=Pharmacie_Garde
PORT=3000
JWT_SECRET=medicare_cle_secrete_2026
```

> `DB_PASSWORD` vide seulement si MySQL n’a pas de mot de passe.

### 2.2 Installer et démarrer

PowerShell :

```powershell
cd C:\Users\ilyas\Desktop\MediCare+\backend
npm install
npm start
```

Tu dois voir : `Connecté à MySQL ✔ Pharmacie_Garde` et `MediCare+ → http://localhost:3000`

### 2.3 Tests navigateur

| Test | URL |
|------|-----|
| API + base | http://localhost:3000/api/health |
| Accueil | http://localhost:3000/Public/html/index.html |
| Admin | http://localhost:3000/Admin/html/login.html |

`api/health` → `{"ok":true,"database":"connected"}`

Si erreur : MySQL arrêté, mauvais `.env`, ou SQL non exécuté → reprendre Phase 1.

---

## Phase 3 — Mettre le code sur GitHub

### 3.1 Créer le dépôt sur GitHub

1. https://github.com → **New repository**
2. Nom : `Medicare-` (ou `MediCare-Plus`)
3. **Public**
4. Ne coche pas « Add README » si le projet existe déjà sur le PC.
5. **Create repository**

### 3.2 Envoyer le projet (première fois)

PowerShell :

```powershell
cd C:\Users\ilyas\Desktop\MediCare+

git init
git add .
git status
git commit -m "MediCare+ - projet initial"
git branch -M main
git remote add origin https://github.com/IlyasLahlali/Medicare-.git
git push -u origin main
```

> Remplace l’URL par **ton** repo si le nom est différent.  
> `backend/.env` n’est **pas** envoyé (dans `.gitignore`) — c’est normal.

### 3.3 Mises à jour plus tard

```powershell
git add .
git commit -m "Description de la modification"
git push
```

---

## Phase 4 — MySQL sur Railway

### 4.1 Créer le projet

1. https://railway.app → connexion **GitHub**
2. **New Project**
3. **Provision MySQL** (ajoute un service base de données)

Tu as maintenant un service **MySQL** dans le projet.

### 4.2 Connexion Workbench → Railway

1. Clique sur le service **MySQL** (pas l’app).
2. Onglet **Connect** ou **Variables**.
3. Note (exemples de noms Railway) :
   - Host public : `xxxx.proxy.rlwy.net`
   - Port : `12345` (souvent pas 3306)
   - User / Password / Database : souvent base **`railway`**

4. Dans **Workbench** → **+** nouvelle connexion :
   - Hostname : host Railway
   - Port : port Railway
   - Username / Password : ceux de Railway
   - Test Connection → OK

### 4.3 Importer le schéma MediCare+ (fichiers Railway)

1. **File → Open SQL Script** →  
   `C:\Users\ilyas\Desktop\MediCare+\BaseDonnee_railway.sql`
2. **Execute** (éclair).
3. Puis **File → Open SQL Script** →  
   `DonneesTest_railway.sql`
4. **Execute**.

> Ces fichiers utilisent `USE railway;` — c’est le nom de base fourni par Railway, **pas** HôtelFacile (même nom par défaut, mais **serveur différent**).

5. Vérifie : schema **`railway`** → tables `utilisateurs`, `pharmacies`, …

---

## Phase 5 — Application sur Railway (lien en ligne)

### 5.1 Ajouter l’application au projet

1. Dans le **même** projet Railway : **+ New** → **GitHub Repo**
2. Choisis **`IlyasLahlali/Medicare-`** (ou ton repo).
3. Railway crée le service **MediCare-** (ton app Node).

Tu dois voir **2 services** : **MySQL** + **MediCare-**.

### 5.2 Variables de connexion (obligatoire)

Clique sur **MediCare-** → **Variables**.

**Méthode A (recommandée)** — référence MySQL :

1. **+ New Variable** → **Add Reference** (ou équivalent)
2. Service source : **MySQL**
3. Variable : **`MYSQL_URL`**
4. Nom dans l’app : **`DATABASE_URL`**

**Méthode B** — à la main :

| Variable | Valeur |
|----------|--------|
| `DB_HOST` | Host public MySQL |
| `DB_PORT` | Port |
| `DB_USER` | User |
| `DB_PASSWORD` | Password |
| `DB_NAME` | `railway` |
| `DB_SSL` | `true` |
| `JWT_SECRET` | Longue chaîne aléatoire |
| `NODE_ENV` | `production` |

Ajoute aussi **`JWT_SECRET`** (obligatoire pour la connexion utilisateur).

### 5.3 Déployer

1. **Apply changes** / **Deploy** si demandé.
2. Onglet **Deployments** → attendre **Success**.
3. **View logs** : tu dois voir **`Connecté à MySQL ✔ railway`**  
   **Pas** `localhost`.

### 5.4 Obtenir l’URL publique

1. Service **MediCare-** → **Settings** → **Networking**
2. **Generate Domain** si besoin.
3. Copie l’URL : `https://medicare-xxxx.up.railway.app`

### 5.5 Tester en ligne

| Test | URL |
|------|-----|
| Santé API | `https://TON-DOMAINE/api/health` |
| Accueil | `https://TON-DOMAINE/Public/html/index.html` |

Connexion admin : `admin@medicare.ma` (après `DonneesTest_railway.sql`).

---

## Phase 6 — Résumé schéma

```
[Workbench local]  →  Pharmacie_Garde  →  npm start  →  localhost:3000
        ↓
[GitHub]  IlyasLahlali/Medicare-
        ↓
[Railway MySQL]  →  railway  (BaseDonnee_railway.sql)
        ↓
[Railway App]  →  DATABASE_URL  →  https://....railway.app
```

---

## Dépannage rapide

| Problème | Solution |
|----------|----------|
| `localhost` dans les logs Railway | Variables DB manquantes sur **MediCare-** |
| `api/health` false | MySQL Railway non importé ou mauvais `DB_NAME` |
| `git push` refusé | Connexion GitHub (token ou Git Bash) |
| Login ne marche pas | Réexécuter `DonneesTest_railway.sql` |
| Page lente au 1er clic | Normal (veille serveur gratuit) |

---

## Phase 7 — Pour le rapport / le prof

```
Application : MediCare+
GitHub : https://github.com/IlyasLahlali/Medicare-
Démo : https://TON-DOMAINE/Public/html/index.html

Comptes : admin@medicare.ma / pharma@medicare.ma / user@medicare.ma
```

Capture d’écran de l’accueil **en ligne** (avec la barre d’adresse visible).
