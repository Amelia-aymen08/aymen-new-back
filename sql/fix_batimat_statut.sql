-- =============================================================================
-- CORRECTIF : le statut des préinscriptions BATIMAT revient à sa valeur initiale
-- après chaque actualisation du dashboard.
--
-- Cause : la colonne `statut` est un ENUM MySQL. `sync({ alter: false })` ne met
-- jamais un ENUM à jour, et MySQL (mode non strict) remplace silencieusement une
-- valeur ENUM invalide par '' -> à la relecture le dashboard réaffiche "Nouveau".
--
-- Solution : passer la colonne en VARCHAR utf8mb4 et nettoyer les lignes cassées.
-- À exécuter une seule fois dans phpMyAdmin (base admin_newsite).
-- =============================================================================

-- 1. Diagnostic (facultatif) — regarder la définition actuelle de la colonne :
--    SHOW CREATE TABLE batimat_preinscriptions;

-- 2. Convertir l'ENUM en VARCHAR.
ALTER TABLE `batimat_preinscriptions`
  MODIFY COLUMN `statut` VARCHAR(20)
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  NOT NULL DEFAULT 'nouveau';

-- 3. Réparer les lignes dont le statut a été perdu (‘’, NULL ou valeur inconnue).
UPDATE `batimat_preinscriptions`
SET `statut` = 'nouveau'
WHERE `statut` IS NULL
   OR `statut` = ''
   OR `statut` NOT IN ('nouveau', 'confirmé', 'annulé');

-- 4. Vérification.
-- SELECT statut, COUNT(*) FROM batimat_preinscriptions GROUP BY statut;
