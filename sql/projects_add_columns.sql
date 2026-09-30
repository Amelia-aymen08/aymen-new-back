-- =============================================================================
-- COLONNES MANQUANTES SUR LA TABLE `Projects` (production)
--
-- Le modèle Sequelize (src/models/project.js) attend `shortDescription` et
-- `progressPercent`. `sync({ alter: false })` ne les ajoute jamais à une table
-- déjà existante : d'où l'erreur « Unknown column 'shortDescription' » lors de
-- `node scripts/seedFromCatalogJson.js` (et sur l'API catalogue mobile).
--
-- 1. Vérifier d'abord ce qui manque :
--      SHOW COLUMNS FROM `Projects`;
-- 2. Exécuter uniquement les lignes des colonnes absentes. Si MySQL répond
--    « Duplicate column name », la colonne existe déjà : passer à la suivante.
-- =============================================================================

ALTER TABLE `Projects` ADD COLUMN `shortDescription` VARCHAR(280) NULL;
ALTER TABLE `Projects` ADD COLUMN `progressPercent` INT NULL;

-- `deliveryDate` existe déjà en production (elle n'a pas été signalée en erreur).
-- Si besoin : ALTER TABLE `Projects` ADD COLUMN `deliveryDate` DATE NULL;
