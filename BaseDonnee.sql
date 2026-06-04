CREATE DATABASE Pharmacie_Garde;
USE Pharmacie_Garde;

-- =========================================================
-- TABLE : utilisateurs
-- =========================================================

CREATE TABLE utilisateurs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    google_id VARCHAR(255) UNIQUE NULL,
    mot_de_passe VARCHAR(255) NULL,

    role ENUM('UTILISATEUR', 'PHARMACIEN', 'ADMIN')
    DEFAULT 'UTILISATEUR',

    statut ENUM('EN_ATTENTE', 'VALIDE', 'REFUSE')
    DEFAULT 'EN_ATTENTE',

    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- TABLE : pharmacies
-- =========================================================

CREATE TABLE pharmacies (
    id INT PRIMARY KEY AUTO_INCREMENT,

    nom VARCHAR(150) NOT NULL,
    adresse TEXT NOT NULL,
    quartier VARCHAR(100),
    ville VARCHAR(100),

    latitude DOUBLE,
    longitude DOUBLE,

    telephone VARCHAR(30),

    image VARCHAR(255),

    est_de_garde BOOLEAN DEFAULT false,
    statut_admin ENUM('en_attente', 'valide', 'refuse') NOT NULL DEFAULT 'en_attente',

    id_pharmacien INT,

    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_pharmacien)
    REFERENCES utilisateurs(id)
    ON DELETE CASCADE
);

-- =========================================================
-- TABLE : horaires_normaux (1 ligne par jour / pharmacie)
-- =========================================================

CREATE TABLE horaires_normaux (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_pharmacie INT NOT NULL,
    jour ENUM('lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche') NOT NULL,
    est_ferme TINYINT(1) NOT NULL DEFAULT 0,
    heure_ouverture TIME NULL,
    heure_fermeture TIME NULL,
    UNIQUE KEY uk_horaires_normaux_pharmacie_jour (id_pharmacie, jour),
    FOREIGN KEY (id_pharmacie) REFERENCES pharmacies(id) ON DELETE CASCADE
);

-- =========================================================
-- TABLE : horaires_exceptionnels (jours fériés, fermetures, horaires spéciaux)
-- =========================================================

CREATE TABLE horaires_exceptionnels (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_pharmacie INT NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    est_ferme TINYINT(1) NOT NULL DEFAULT 0,
    heure_ouverture TIME NULL,
    heure_fermeture TIME NULL,
    motif VARCHAR(200) NULL,
    KEY idx_horaires_exc_pharmacie_dates (id_pharmacie, date_debut, date_fin),
    FOREIGN KEY (id_pharmacie) REFERENCES pharmacies(id) ON DELETE CASCADE
);

-- =========================================================
-- TABLE : medicaments
-- =========================================================

CREATE TABLE medicaments (
    id INT PRIMARY KEY AUTO_INCREMENT,

    nom VARCHAR(150) NOT NULL,
    description TEXT,

    prix DECIMAL(10,2),

    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- TABLE : stock_pharmacie
-- Relation entre pharmacies et médicaments
-- =========================================================

CREATE TABLE stock_pharmacie (
    id INT PRIMARY KEY AUTO_INCREMENT,

    id_pharmacie INT NOT NULL,
    id_medicament INT NOT NULL,

    prix DECIMAL(10, 2) NULL,
    disponible TINYINT(1) NOT NULL DEFAULT 1,

    date_mise_a_jour TIMESTAMP
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

    -- empêcher doublons
    UNIQUE(id_pharmacie, id_medicament),

    FOREIGN KEY (id_pharmacie)
    REFERENCES pharmacies(id)
    ON DELETE CASCADE,

    FOREIGN KEY (id_medicament)
    REFERENCES medicaments(id)
    ON DELETE CASCADE
);

-- =========================================================
-- TABLE : planning_garde
-- =========================================================

CREATE TABLE planning_garde (
    id INT PRIMARY KEY AUTO_INCREMENT,

    id_pharmacie INT NOT NULL,

    date_debut DATETIME NOT NULL,
    date_fin DATETIME NOT NULL,

    est_actif BOOLEAN DEFAULT true,

    FOREIGN KEY (id_pharmacie)
    REFERENCES pharmacies(id)
    ON DELETE CASCADE
);

-- =========================================================
-- TABLE : notifications
-- =========================================================

CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,

    id_utilisateur INT NOT NULL,

    titre VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,

    type ENUM('SYSTEM', 'GARDE', 'STOCK', 'FAVORI', 'INFO', 'ALERT', 'AVIS', 'STATS') NOT NULL DEFAULT 'INFO',
    lien VARCHAR(255) NULL,

    est_lu BOOLEAN DEFAULT false,

    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_utilisateur)
    REFERENCES utilisateurs(id)
    ON DELETE CASCADE
);

-- =========================================================
-- TABLE : favoris_pharmacie
-- =========================================================

CREATE TABLE favoris_pharmacie (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_utilisateur INT NOT NULL,
    id_pharmacie INT NOT NULL,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_utilisateur, id_pharmacie),
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (id_pharmacie) REFERENCES pharmacies(id) ON DELETE CASCADE
);

-- =========================================================
-- TABLE : avis_pharmacie
-- =========================================================

CREATE TABLE avis_pharmacie (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_utilisateur INT NOT NULL,
    id_pharmacie INT NOT NULL,
    note TINYINT NOT NULL,
    commentaire TEXT,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_utilisateur, id_pharmacie),
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (id_pharmacie) REFERENCES pharmacies(id) ON DELETE CASCADE,
    CHECK (note >= 1 AND note <= 5)
);

-- =========================================================
-- TABLE : statistiques_pharmacie (vues, appels, recherches)
-- =========================================================

CREATE TABLE statistiques_pharmacie (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_pharmacie INT NOT NULL,
    type ENUM('VUE', 'APPEL', 'RECHERCHE') NOT NULL,
    date_jour DATE NOT NULL,
    total INT NOT NULL DEFAULT 0,
    UNIQUE(id_pharmacie, type, date_jour),
    FOREIGN KEY (id_pharmacie) REFERENCES pharmacies(id) ON DELETE CASCADE
);