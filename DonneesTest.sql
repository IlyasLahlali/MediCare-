-- Données de test (après BaseDonnee.sql) — mot de passe : admin123
USE Pharmacie_Garde;

INSERT IGNORE INTO utilisateurs (nom, email, mot_de_passe, role, statut) VALUES
('Admin MediCare', 'admin@medicare.ma',
 '$2b$10$YbdWz/ykM/8WNR87A5JlSunVLKD/myrkz4R418Lx0IYdCv31E7BM2', 'ADMIN', 'VALIDE'),
('Pharmacien Demo', 'pharma@medicare.ma',
 '$2b$10$YbdWz/ykM/8WNR87A5JlSunVLKD/myrkz4R418Lx0IYdCv31E7BM2', 'PHARMACIEN', 'VALIDE'),
('Utilisateur Demo', 'user@medicare.ma',
 '$2b$10$YbdWz/ykM/8WNR87A5JlSunVLKD/myrkz4R418Lx0IYdCv31E7BM2', 'UTILISATEUR', 'VALIDE');

SET @id_pharma = (SELECT id FROM utilisateurs WHERE email = 'pharma@medicare.ma' LIMIT 1);
SET @id_user = (SELECT id FROM utilisateurs WHERE email = 'user@medicare.ma' LIMIT 1);

INSERT IGNORE INTO pharmacies (nom, adresse, quartier, ville, latitude, longitude, telephone,
  est_ouverte, est_de_garde, est_active, id_pharmacien) VALUES
('Pharmacie Al Amal', '12 Av. Mohammed V', 'Guéliz', 'Marrakech', 31.6295, -7.9811, '0524000001', true, false, true, @id_pharma),
('Pharmacie de Garde Centre', '45 Bd Zerktouni', 'Centre', 'Marrakech', 31.6340, -7.9990, '0524000002', true, true, true, @id_pharma);

INSERT IGNORE INTO medicaments (nom, description, prix) VALUES
('Paracétamol 500mg', 'Antalgique', 25.00),
('Ibuprofène 400mg', 'Anti-inflammatoire', 35.00),
('Amoxicilline 500mg', 'Antibiotique', 45.00);

INSERT IGNORE INTO stock_pharmacie (id_pharmacie, id_medicament, quantite)
SELECT p.id, m.id, 50
FROM pharmacies p
CROSS JOIN medicaments m
WHERE p.nom = 'Pharmacie Al Amal';
