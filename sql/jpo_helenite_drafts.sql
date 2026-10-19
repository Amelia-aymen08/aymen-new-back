-- =============================================================================
-- JPO HÉLÉNITE — suivi des visiteurs et des formulaires non validés
--
-- Une ligne par visiteur (identifiant aléatoire stocké dans son navigateur), mise à jour au fil
-- de la saisie. Au redémarrage du backend, Sequelize (`sync`) crée cette table si elle n'existe
-- pas : ce script permet de le faire à la main (phpMyAdmin) si besoin.
-- `submitted_at` / `registration_id` : renseignés quand l'inscription est validée.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `jpo_helenite_drafts` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `visitor_id`        VARCHAR(40)  NOT NULL,
  `first_name`        VARCHAR(100) NULL,
  `last_name`         VARCHAR(100) NULL,
  `email`             VARCHAR(255) NULL,
  `country_code`      VARCHAR(4)   NULL,
  `phone`             VARCHAR(50)  NULL,
  `visit_date`        VARCHAR(10)  NULL,
  `time_slot`         VARCHAR(20)  NULL,
  `profile`           VARCHAR(60)  NULL,
  `typology`          VARCHAR(60)  NULL,
  `horizon`           VARCHAR(60)  NULL,
  `message`           TEXT         NULL,
  `newsletter_opt_in` TINYINT(1)   NOT NULL DEFAULT 0,
  `consent`           TINYINT(1)   NOT NULL DEFAULT 0,
  `last_field`        VARCHAR(30)  NULL,
  `qr_campaign`       VARCHAR(60)  NULL,
  `qr_source`         VARCHAR(60)  NULL,
  `qr_medium`         VARCHAR(60)  NULL,
  `referrer`          VARCHAR(255) NULL,
  `is_mobile`         TINYINT(1)   NOT NULL DEFAULT 0,
  `is_bot`            TINYINT(1)   NOT NULL DEFAULT 0,
  `submitted_at`      DATETIME     NULL,
  `registration_id`   INT UNSIGNED NULL,
  `created_at`        DATETIME     NOT NULL,
  `updated_at`        DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `jpo_helenite_drafts_visitor_id` (`visitor_id`),
  KEY `jpo_helenite_drafts_updated` (`updated_at`),
  KEY `jpo_helenite_drafts_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
