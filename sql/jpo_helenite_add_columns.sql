-- =============================================================================
-- JPO HÉLÉNITE — colonnes ajoutées pour le dashboard
--
-- À EXÉCUTER UNE FOIS dans phpMyAdmin (onglet SQL) SI la table
-- `jpo_helenite_registrations` existe déjà, AVANT de redémarrer le backend.
-- (`sync({ alter: false })` n'ajoute jamais de colonne à une table existante : sans
-- ce script, les inscriptions échouent avec « Unknown column ».)
--
--   qr_medium     : utm_medium du lien d'arrivée (social, email, qr, link…)
--   badge_sent_at : date d'envoi du badge par e-mail (NULL = pas envoyé)
-- =============================================================================

ALTER TABLE `jpo_helenite_registrations`
  ADD COLUMN `qr_medium`     VARCHAR(60) NULL AFTER `qr_source`,
  ADD COLUMN `badge_sent_at` DATETIME    NULL AFTER `qr_medium`;
