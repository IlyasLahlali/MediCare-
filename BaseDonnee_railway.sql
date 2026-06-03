-- Railway : pas de CREATE DATABASE. Exécuter dans Workbench (connexion Railway).
-- Puis DonneesTest_railway.sql

USE railway;

CREATE TABLE IF NOT EXISTS utilisateurs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    google_id VARCHAR(255) UNIQUE NULL,
    mot_de_passe VARCHAR(255) NULL,
    role ENUM('UTILISATEUR', 'PHARMACIEN', 'ADMIN') DEFAULT 'UTILISATEUR',
    statut ENUM('EN_ATTENTE', 'VALIDE', 'REFUSE') DEFAULT 'EN_ATTENTE',
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pharmacies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(150) NOT NULL,
    adresse TEXT NOT NULL,
    quartier VARCHAR(100),
    ville VARCHAR(100),
    latitude DOUBLE,
    longitude DOUBLE,
    telephone VARCHAR(30),
    heure_ouverture TIME,
    heure_fermeture TIME,
    image VARCHAR(255),
    est_ouverte BOOLEAN DEFAULT false,
    est_de_garde BOOLEAN DEFAULT false,
    est_active BOOLEAN DEFAULT false,
    id_pharmacien INT,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_pharmacien) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medicaments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(150) NOT NULL,
    description TEXT,
    prix DECIMAL(10,2),
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_pharmacie (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_pharmacie INT NOT NULL,
    id_medicament INT NOT NULL,
    prix DECIMAL(10, 2) NULL,
    disponible TINYINT(1) NOT NULL DEFAULT 1,
    date_mise_a_jour TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE(id_pharmacie, id_medicament),
    FOREIGN KEY (id_pharmacie) REFERENCES pharmacies(id) ON DELETE CASCADE,
    FOREIGN KEY (id_medicament) REFERENCES medicaments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS planning_garde (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_pharmacie INT NOT NULL,
    date_debut DATETIME NOT NULL,
    date_fin DATETIME NOT NULL,
    est_actif BOOLEAN DEFAULT true,
    FOREIGN KEY (id_pharmacie) REFERENCES pharmacies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_utilisateur INT NOT NULL,
    titre VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('SYSTEM', 'GARDE', 'STOCK', 'FAVORI', 'INFO', 'ALERT', 'AVIS', 'STATS') NOT NULL DEFAULT 'INFO',
    lien VARCHAR(255) NULL,
    est_lu BOOLEAN DEFAULT false,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favoris_pharmacie (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_utilisateur INT NOT NULL,
    id_pharmacie INT NOT NULL,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_utilisateur, id_pharmacie),
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (id_pharmacie) REFERENCES pharmacies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS avis_pharmacie (
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

CREATE TABLE IF NOT EXISTS statistiques_pharmacie (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_pharmacie INT NOT NULL,
    type ENUM('VUE', 'APPEL', 'RECHERCHE') NOT NULL,
    date_jour DATE NOT NULL,
    total INT NOT NULL DEFAULT 0,
    UNIQUE(id_pharmacie, type, date_jour),
    FOREIGN KEY (id_pharmacie) REFERENCES pharmacies(id) ON DELETE CASCADE
);
