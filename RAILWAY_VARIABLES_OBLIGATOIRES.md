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
