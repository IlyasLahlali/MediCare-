# MediCare+ — Ce que VOUS devez faire (le reste est dans le code)

Le projet est prêt côté code. Vous n’éditez pas Node.js sauf si on vous le demande.

---

## Déjà fait pour vous (code)

- Connexion MySQL : `backend/config/db.js`
- Fichier local : `backend/.env` (localhost + `Pharmacie_Garde`)
- Scripts SQL : `BaseDonnee.sql`, `DonneesTest.sql`, `BaseDonnee_railway.sql`, `DonneesTest_railway.sql`
- API, frontend, Dockerfile pour Railway
- Guide : `docs/GUIDE_DEPLOIEMENT_ZERO.md`

---

## 1. Vous — Workbench (LOCAL) — fait ✓

Vous avez déjà importé `BaseDonnee.sql` + `DonneesTest.sql`.

Si le mot de passe MySQL **n’est pas vide**, ouvrez `backend/.env` et mettez-le dans `DB_PASSWORD=`.

---

## 2. Vous — Tester l’app sur le PC

PowerShell :

```powershell
cd C:\Users\ilyas\Desktop\MediCare+\backend
npm start
```

Navigateur :

- http://localhost:3000/api/health  → doit afficher `"ok":true`
- http://localhost:3000/Public/html/index.html

Connexion test : `admin@medicare.ma` / `admin123` (si DonneesTest.sql a bien été exécuté).

---

## 3. Vous — GitHub (connexion à la main)

Git n’est pas dans le PATH Windows de Cursor ; utilisez **Git Bash** :

```bash
cd /c/Users/ilyas/Desktop/MediCare+
git add .
git commit -m "MediCare+ mise a jour"
git push origin main
```

Si le dépôt n’existe pas encore sur GitHub : créez `Medicare-` puis :

```bash
git remote add origin https://github.com/IlyasLahlali/Medicare-.git
git push -u origin main
```

(Login GitHub : navigateur ou token — **vous seul** pouvez vous connecter.)

---

## 4. Vous — Railway MySQL (Workbench connexion « Railway »)

1. railway.app → projet → service **MySQL** → **Connect** → copier host, port, user, password.
2. Workbench → connexion **Railway** → Test Connection.
3. **File → Open SQL Script** → `BaseDonnee_railway.sql` → Execute.
4. Puis `DonneesTest_railway.sql` → Execute.
5. Vérifier : schema **railway** + tables.

---

## 5. Vous — Railway application (site web) — si statut **Crashed**

### A. Variables (service **MediCare-** → **Variables**)

| Variable | Valeur |
|----------|--------|
| `DATABASE_URL` | **Add Reference** → service MySQL → `MYSQL_URL` |
| `JWT_SECRET` | ex. `medicare_jwt_2026_secret_long` |
| `NODE_ENV` | `production` |

Sans `DATABASE_URL`, les logs affichent `localhost` et l’app **Crashed**.

### B. Base importée (Workbench connexion **Railway**)

**Si erreur `Unknown column 'statut'`** (ancienne base sur Railway) :

1. **`Railway_REIMPORT_COMPLET.sql`** → Execute (éclair) — recrée toutes les tables  
2. **`DonneesTest_railway.sql`** → Execute  

Sinon (première fois) :

1. `BaseDonnee_railway.sql` → Execute  
2. `DonneesTest_railway.sql` → Execute  

### C. Nouveau code sur GitHub (Git Bash)

```bash
cd /c/Users/ilyas/Desktop/MediCare+
git add .
git commit -m "Fix deploy Railway"
git push origin main
```

Railway redéploie automatiquement → attendre **Success** (plus **Crashed**).

### D. Vérifier les logs

**Deployments** → **View logs** → doit afficher :  
`Connecté à MySQL ✔ railway` et `MediCare+ → port ...`

Test : `https://VOTRE-URL/api/health`

---

## 6. Vous — Rapport / professeur

Coller dans le rapport :

```
Démo : https://VOTRE-URL-RAILWAY/Public/html/index.html
GitHub : https://github.com/IlyasLahlali/Medicare-
Comptes : admin@medicare.ma | pharma@medicare.ma | user@medicare.ma
```

---

## En cas de problème

| Problème | Vous vérifiez |
|----------|----------------|
| Erreur MySQL local | MySQL démarré, `DB_PASSWORD` dans `.env` |
| `localhost` sur Railway | Variables sur service **MediCare-** |
| `git` introuvable | Utiliser **Git Bash**, pas CMD seul |

Demandez à l’assistant de modifier le **code** ; pour Workbench / Railway / login GitHub, c’est **vous** sur l’interface.
