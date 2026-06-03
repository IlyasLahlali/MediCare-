# Railway — Corriger « DB cible : localhost » (Crashed)

Les logs montrent :

```
DB cible : localhost 3306 Pharmacie_Garde
```

→ Le service **MediCare-** n’a **pas** la connexion MySQL Railway. Ce n’est **pas** Workbench : c’est l’onglet **Variables** sur Railway.

---

## À faire sur railway.app (5 minutes)

### 1. Ouvrir le bon service

- Projet MediCare
- Clique sur **MediCare-** (l’application Node, **pas** MySQL)

### 2. Onglet **Variables**

Supprime les variables incorrectes si tu les vois :

- `DB_HOST=localhost`
- `DB_NAME=Pharmacie_Garde` (sans host Railway)

### 3. Ajouter ces variables

| Nom | Comment remplir |
|-----|-----------------|
| **DATABASE_URL** | **Add Reference** (ou Variable Reference) → Service : **MySQL** → Variable : **MYSQL_URL** |
| **JWT_SECRET** | Tape une longue chaîne, ex. `medicare_production_jwt_2026_secret` |
| **NODE_ENV** | `production` |
| **GOOGLE_CLIENT_ID** | `1011224579860-8udm6jio641o2o4a6ribtcjffi10tv7r.apps.googleusercontent.com` |
| **GOOGLE_CLIENT_SECRET** | Code secret actuel (Google Cloud → Clients) — **ne pas** mettre `GOOGLE_OAUTH_RELAX_TLS` en prod |
| **PUBLIC_APP_URL** | URL publique **https** de l’app, ex. `https://medicare-xxxx.up.railway.app` (Settings → Networking → domaine généré) |

Optionnel si pas de référence :

| Nom | Valeur (copier depuis MySQL → Connect) |
|-----|----------------------------------------|
| DB_HOST | host `xxx.proxy.rlwy.net` |
| DB_PORT | port affiché |
| DB_USER | utilisateur |
| DB_PASSWORD | mot de passe |
| DB_NAME | **railway** |
| DB_SSL | **true** |

### 4. Enregistrer et redéployer

- **Apply changes** ou le déploiement redémarre tout seul
- **Deployments** → attendre **Active** (plus Crashed)

### 5. Logs attendus

```
Connecté à MySQL ✔ railway
MediCare+ → port xxxx (0.0.0.0)
```

**Plus** `localhost` ni `Pharmacie_Garde`.

### 6. Tester

`https://TON-DOMAINE-RAILWAY/api/health`

---

## Connexion Google (app en ligne)

### A. Google Cloud Console

Client OAuth **Application Web** → **Origines JavaScript autorisées** et **URI de redirection** (remplacez par **votre** domaine Railway) :

| Champ | Valeur |
|--------|--------|
| Origine JavaScript | `https://VOTRE-DOMAINE.up.railway.app` |
| URI de redirection | `https://VOTRE-DOMAINE.up.railway.app/api/auth/google/callback` |

Gardez aussi `http://localhost:3000` et `http://localhost:3000/api/auth/google/callback` si vous testez en local.

### B. Variables Railway (service MediCare-, pas MySQL)

Mêmes `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` qu’en local.  
`PUBLIC_APP_URL` = **exactement** l’URL https affichée par Railway (sans `/` à la fin).

### C. Base Railway

Au redémarrage, l’app ajoute `google_id` et `notifications.lien` si besoin.  
Sinon dans Workbench sur la base `railway` : réexécuter `Railway_REIMPORT_COMPLET.sql` ou :

```bash
cd backend
npm run migrate:google-auth
npm run migrate:notifications
```

(avec `DATABASE_URL` Railway dans les variables locales ou via Workbench.)

### D. Déployer le code

```bash
git add .
git commit -m "Google OAuth production Railway"
git push origin main
```

Railway redéploie → test :  
`https://VOTRE-DOMAINE/Utilisateur/html/login.html` → **Continuer avec Google**.

---

## Git (code mis à jour)

Dans **Git Bash** :

```bash
cd /c/Users/ilyas/Desktop/MediCare+
git add .
git commit -m "Fix Railway DB config"
git push origin main
```

Sans `git push`, Railway garde l’ancien code (« Initial commit »).

---

## Base de données

Workbench → Railway → déjà fait :

1. `Railway_REIMPORT_COMPLET.sql`
2. `DonneesTest_railway.sql`
