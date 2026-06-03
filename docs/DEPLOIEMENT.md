# Déploiement GitHub + Render — MediCare+

Guide pour obtenir un **lien public** à partager avec votre professeur (comme HôtelFacile Smart).

---

## Vue d'ensemble

```
[Votre PC] → GitHub (code) → Render (Node.js) → MySQL cloud (Railway / Aiven)
```

**URLs finales (exemple avec `medicare-plus`) :**

| Zone | URL |
|------|-----|
| Accueil public | `https://medicare-plus.onrender.com/` |
| Utilisateur | `https://medicare-plus.onrender.com/Utilisateur/html/login.html` |
| Pharmacien | `https://medicare-plus.onrender.com/Pharmacien/html/login.html` |
| Admin | `https://medicare-plus.onrender.com/Admin/html/login.html` |

---

## Étape 1 — GitHub

1. Installer Git : https://git-scm.com/download/win
2. Créer un repo **public** sur GitHub : `MediCare-Plus`
3. Pousser le code :

```powershell
cd C:\Users\ilyas\Desktop\MediCare+

git init
git add .
git commit -m "MediCare+ - rendu projet"

git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/MediCare-Plus.git
git push -u origin main
```

> `backend/.env` n'est **pas** envoyé (`.gitignore`).

---

## Étape 2 — MySQL dans le cloud (Workbench + Railway)

Même principe que **gestion-hotel** : base locale dans **MySQL Workbench**, copie vers **Railway**, app sur **Render**.

### Railway demande une carte bancaire ?

Depuis 2024–2025, Railway peut exiger une **carte** pour activer l’essai (crédit gratuit ~5 $). En général :
- **Pas de débit** tant que tu restes dans le crédit gratuit
- Tu peux mettre une carte **prépayée** si tu en as une

**Si tu ne veux pas de carte** → utilise **Aiven** (option B) plus bas.

---

### Option A — Railway (comme gestion-hotel)

1. https://railway.app → connexion **GitHub**
2. **New Project** → **Provision MySQL**
3. Clique sur le service **MySQL** → onglet **Variables** ou **Connect**
4. Note ces valeurs (noms Railway → Render) :

| Railway | Variable Render |
|---------|-----------------|
| `MYSQLHOST` | `DB_HOST` |
| `MYSQLPORT` | `DB_PORT` |
| `MYSQLUSER` | `DB_USER` |
| `MYSQLPASSWORD` | `DB_PASSWORD` |
| `MYSQLDATABASE` | `DB_NAME` |

5. Onglet **Connect** → copie aussi **Public Network** / **TCP Proxy** (host du type `xxx.proxy.rlwy.net`) → c’est celui-là qu’on met dans Workbench et dans `DB_HOST` sur Render.
6. Sur Render, ajoute **`DB_SSL=true`**.

---

### Option B — Aiven (sans Railway, si pas de carte)

1. https://aiven.io → compte gratuit → **MySQL**
2. Récupère host, port, user, password, database
3. Sur Render : mêmes variables `DB_*` + **`DB_SSL=true`**

---

### Importer la base avec MySQL Workbench

#### A. Exporter depuis ton PC (base locale `Pharmacie_Garde`)

1. Ouvre **MySQL Workbench**
2. Connexion locale (ex. `root` @ `localhost`)
3. Menu **Server** → **Data Export**
4. Sélectionne la schema **`Pharmacie_Garde`**
5. Coche **Export to Self-Contained File**
6. Fichier : `Pharmacie_Garde.sql`
7. **Start Export**

> Si la base locale est vide, exécute d’abord `BaseDonnee.sql` dans Workbench (File → Open SQL Script → Run).

#### B. Importer vers Railway (ou Aiven)

1. Workbench → **Database** → **Connect to Database…**
2. **New connection** :
   - **Hostname** : host Railway (`xxx.proxy.rlwy.net`) ou Aiven
   - **Port** : celui fourni (souvent `3306` ou un port Railway type `12345`)
   - **Username** / **Password** : variables Railway
   - **Default Schema** : `Pharmacie_Garde` (ou crée-la avant)
3. Pour Railway : onglet **SSL** → utiliser SSL si demandé
4. **Test Connection** → OK
5. Menu **Server** → **Data Import**
6. **Import from Self-Contained File** → choisis `Pharmacie_Garde.sql`
7. **Default Target Schema** : `Pharmacie_Garde` (crée la schema si besoin : clic droit → Create Schema)
8. **Start Import**

#### C. Vérifier

Dans Workbench, sur la connexion cloud :

```sql
USE Pharmacie_Garde;
SHOW TABLES;
SELECT email, role FROM utilisateurs LIMIT 5;
```

Tu dois voir tes tables et comptes de démo (admin, etc.).

---

### Ligne de commande (alternative à Workbench)

```powershell
mysqldump -u root Pharmacie_Garde > Pharmacie_Garde.sql
mysql -h VOTRE_HOST -P VOTRE_PORT -u VOTRE_USER -p Pharmacie_Garde < Pharmacie_Garde.sql
```

---

## Étape 3 — Déployer sur Render

1. https://render.com → **Get Started** → GitHub
2. **New +** → **Web Service** → repo `MediCare-Plus`
3. Configuration :

| Champ | Valeur |
|--------|--------|
| **Name** | `medicare-plus` |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free |

4. **Environment variables** :

| Clé | Valeur |
|-----|--------|
| `JWT_SECRET` | Chaîne aléatoire longue (64 caractères) |
| `DB_HOST` | Host MySQL Railway |
| `DB_PORT` | `3306` |
| `DB_USER` | Utilisateur MySQL |
| `DB_PASSWORD` | Mot de passe |
| `DB_NAME` | `Pharmacie_Garde` |
| `DB_SSL` | `true` si Railway proxy public |

5. **Create Web Service** → attendre 5–10 min
6. URL : `https://medicare-plus.onrender.com`

---

## Étape 4 — Tester

- Ouvrir `https://VOTRE-APP.onrender.com/`
- Connexion admin / pharmacien / utilisateur
- API : `https://VOTRE-APP.onrender.com/api/health` → `{ "ok": true }`

---

## Étape 5 — Partager avec le professeur

```
Application : MediCare+
GitHub : https://github.com/VOTRE_USERNAME/MediCare-Plus
Démo en ligne : https://medicare-plus.onrender.com/

Comptes de démonstration :
- Admin : admin@medicare.ma / ******
- Pharmacien : pharmacien@... / ******
- Utilisateur : user@... / ******

Parcours suggéré :
1. Accueil public → recherche pharmacie
2. Connexion utilisateur → favoris et avis
3. Connexion pharmacien → gestion stock et garde
4. Connexion admin → validation pharmacies
```

---

## Mises à jour

```powershell
git add .
git commit -m "Correction après retour prof"
git push
```

Render redéploie automatiquement en 2–5 minutes. Le prof voit la **nouvelle version** s'il rafraîchit le lien.

---

## Limitations plan gratuit Render

- Serveur en **veille** après ~15 min → 30–50 s au 1er clic
- Images uploadées peuvent disparaître au redéploiement
- MySQL hébergé séparément (Railway)

Pour un projet académique, c'est en général suffisant.

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Erreur DB | Vérifier `DB_*` sur Render, `DB_SSL=true` |
| API failed | F12 → Network : URL doit être `/api/...` sur le même domaine |
| 502 Bad Gateway | Logs Render → erreur Node ou MySQL |
