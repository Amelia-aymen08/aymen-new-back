-- =============================================================================
-- JPO HÉLÉNITE — application de scan des commerciaux (prospects, scans, comptes)
--
-- Au redémarrage du backend, Sequelize (`sync`) crée ces 5 tables si elles n'existent pas :
-- ce script permet de le faire à la main (phpMyAdmin). Aucune table existante n'est modifiée.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `jpo_helenite_agents` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(150) NOT NULL,
  `email`         VARCHAR(255) NOT NULL,
  `role`          VARCHAR(20)  NOT NULL DEFAULT 'commercial',
  `password_hash` VARCHAR(255) NOT NULL,
  `active`        TINYINT(1)   NOT NULL DEFAULT 1,
  `last_login_at` DATETIME     NULL,
  `created_at`    DATETIME     NOT NULL,
  `updated_at`    DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `jpo_helenite_agents_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `jpo_helenite_leads` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `registration_id`  INT UNSIGNED NOT NULL,
  `agent_id`         INT UNSIGNED NOT NULL,
  `first_scanned_at` DATETIME     NOT NULL,
  `last_scanned_at`  DATETIME     NOT NULL,
  `scan_count`       INT          NOT NULL DEFAULT 1,
  `temperature`      VARCHAR(10)  NULL,
  `rating`           TINYINT UNSIGNED NULL,
  `status`           VARCHAR(30)  NOT NULL DEFAULT 'a_contacter',
  `note`             TEXT         NULL,
  `next_action`      VARCHAR(255) NULL,
  `follow_up_at`     DATETIME     NULL,
  `treated_at`       DATETIME     NULL,
  `created_at`       DATETIME     NOT NULL,
  `updated_at`       DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `jpo_helenite_leads_registration_id` (`registration_id`),
  KEY `jpo_helenite_leads_agent` (`agent_id`),
  KEY `jpo_helenite_leads_status` (`status`),
  KEY `jpo_helenite_leads_follow_up` (`follow_up_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `jpo_helenite_scans` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `registration_id` INT UNSIGNED NOT NULL,
  `lead_id`         INT UNSIGNED NOT NULL,
  `agent_id`        INT UNSIGNED NOT NULL,
  `is_duplicate`    TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`      DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jpo_helenite_scans_registration` (`registration_id`),
  KEY `jpo_helenite_scans_agent` (`agent_id`),
  KEY `jpo_helenite_scans_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Arrivées des visiteurs (poste « accueil » ou 1er scan d'un commercial).
CREATE TABLE IF NOT EXISTS `jpo_helenite_checkins` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `registration_id` INT UNSIGNED NOT NULL,
  `agent_id`        INT UNSIGNED NOT NULL,
  `checked_in_at`   DATETIME     NOT NULL,
  `scan_count`      INT          NOT NULL DEFAULT 1,
  `created_at`      DATETIME     NOT NULL,
  `updated_at`      DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `jpo_helenite_checkins_registration_id` (`registration_id`),
  KEY `jpo_helenite_checkins_at` (`checked_in_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Journal des entrées / sorties enregistrées par le poste accueil (état = dernier passage).
CREATE TABLE IF NOT EXISTS `jpo_helenite_passages` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `registration_id` INT UNSIGNED NOT NULL,
  `agent_id`        INT UNSIGNED NOT NULL,
  `direction`       VARCHAR(3)   NOT NULL,
  `created_at`      DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jpo_helenite_passages_registration` (`registration_id`),
  KEY `jpo_helenite_passages_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
