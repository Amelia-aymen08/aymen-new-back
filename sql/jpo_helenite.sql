-- =============================================================================
-- INSCRIPTIONS « AVANT-PREMIÈRE HÉLÉNITE » (JPO du 23 au 29 octobre 2026, Said Hamdine)
--
-- Page : https://aymenpromotion-dz.com/jpo_helenite
--
-- Au redémarrage du backend, Sequelize (`sync`) crée cette table si elle n'existe
-- pas. Ce script permet de le faire à la main (Plesk / phpMyAdmin).
--
-- `visit_date` : date ISO (2026-10-23 … 2026-10-29). `time_slot` : « 15h - 16h »…
-- `status` : suivi interne (nouveau / confirme / annule) — VARCHAR volontairement
-- (pas d'ENUM : pas de blocage si on ajoute une valeur plus tard).
-- Le bloc « Préciser mon projet » est facultatif : profile / typology / horizon /
-- message peuvent être NULL.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `jpo_helenite_registrations` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `first_name`        VARCHAR(100) NOT NULL,
  `last_name`         VARCHAR(100) NOT NULL,
  `email`             VARCHAR(255) NOT NULL,
  `phone`             VARCHAR(50)  NOT NULL,
  `visit_date`        VARCHAR(10)  NOT NULL,
  `time_slot`         VARCHAR(20)  NOT NULL,
  `profile`           VARCHAR(60)  NULL,
  `typology`          VARCHAR(60)  NULL,
  `horizon`           VARCHAR(60)  NULL,
  `message`           TEXT         NULL,
  `newsletter_opt_in` TINYINT(1)   NOT NULL DEFAULT 0,
  `consent`           TINYINT(1)   NOT NULL DEFAULT 0,
  `status`            VARCHAR(20)  NOT NULL DEFAULT 'nouveau',
  `qr_campaign`       VARCHAR(60)  NULL,
  `qr_source`         VARCHAR(60)  NULL,
  `ip_address`        VARCHAR(45)  NULL,
  `created_at`        DATETIME     NOT NULL,
  `updated_at`        DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `jpo_helenite_registrations_email_phone_unique` (`email`, `phone`),
  KEY `jpo_helenite_registrations_visit` (`visit_date`, `time_slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
