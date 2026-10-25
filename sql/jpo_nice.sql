-- =============================================================================
-- INSCRIPTIONS « NICE, ON ARRIVE » (rencontres Aymen Promotion à Nice,
-- samedi 31 octobre et dimanche 1er novembre 2026 — Sheraton Nice)
--
-- Page : https://aymenpromotion-dz.com/jpo_nice
--
-- Au redémarrage du backend, Sequelize (`sync`) crée cette table si elle n'existe pas :
-- ce script permet de le faire à la main (Plesk / phpMyAdmin).
--
-- `qr_token`     : jeton aléatoire encodé dans le QR code du badge (+ prénom et nom).
-- `visit_day`    : samedi | dimanche | flexible
-- `time_pref`    : matin | apres_midi | flexible | a_confirmer
-- `status`       : suivi interne (nouveau / confirme / annule) — VARCHAR, pas d'ENUM.
-- `checked_*`    : renseignés par une éventuelle application de scan à l'accueil.
-- `qr_*`         : source du lien d'arrivée (utm_source / utm_medium / utm_campaign).
-- Le bloc « profil / objectif / typologie / horizon / question » est facultatif (NULL possible).
-- =============================================================================

CREATE TABLE IF NOT EXISTS `jpo_nice_registrations` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `first_name`        VARCHAR(100) NOT NULL,
  `last_name`         VARCHAR(100) NOT NULL,
  `email`             VARCHAR(255) NOT NULL,
  `phone`             VARCHAR(50)  NOT NULL,
  `visit_day`         VARCHAR(20)  NOT NULL,
  `time_pref`         VARCHAR(20)  NOT NULL DEFAULT 'a_confirmer',
  `residence_country` VARCHAR(100) NULL,
  `city`              VARCHAR(100) NULL,
  `profile`           VARCHAR(60)  NULL,
  `objective`         VARCHAR(60)  NULL,
  `typology`          VARCHAR(60)  NULL,
  `horizon`           VARCHAR(60)  NULL,
  `message`           TEXT         NULL,
  `newsletter_opt_in` TINYINT(1)   NOT NULL DEFAULT 0,
  `consent`           TINYINT(1)   NOT NULL DEFAULT 0,
  `status`            VARCHAR(20)  NOT NULL DEFAULT 'nouveau',
  `qr_token`          VARCHAR(32)  NOT NULL,
  `badge_sent_at`     DATETIME     NULL,
  `checked_in_at`     DATETIME     NULL,
  `checked_out_at`    DATETIME     NULL,
  `qr_campaign`       VARCHAR(60)  NULL,
  `qr_source`         VARCHAR(60)  NULL,
  `qr_medium`         VARCHAR(60)  NULL,
  `ip_address`        VARCHAR(45)  NULL,
  `created_at`        DATETIME     NOT NULL,
  `updated_at`        DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `jpo_nice_registrations_qr_token` (`qr_token`),
  UNIQUE KEY `jpo_nice_registrations_email_phone_unique` (`email`, `phone`),
  KEY `jpo_nice_registrations_visit` (`visit_day`, `time_pref`),
  KEY `jpo_nice_registrations_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
