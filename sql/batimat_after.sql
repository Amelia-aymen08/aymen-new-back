-- =============================================================================
-- INSCRIPTIONS « BATIMAT AFTER » (rencontre Paris, 3 & 4 octobre 2026)
--
-- Au redémarrage du backend, Sequelize (`sync`) crée cette table si elle n'existe
-- pas. Ce script permet de le faire à la main (Plesk / phpMyAdmin).
--
-- `qr_token` est encodé dans le QR code du badge ; `checked_in_at` /
-- `checked_out_at` sont destinés à l'application de scan.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `batimat_after_registrations` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `first_name`        VARCHAR(255) NOT NULL,
  `last_name`         VARCHAR(255) NOT NULL,
  `email`             VARCHAR(255) NOT NULL,
  `phone`             VARCHAR(50)  NOT NULL,
  `visit_day`         VARCHAR(20)  NOT NULL,
  `newsletter_opt_in` TINYINT(1)   NOT NULL DEFAULT 0,
  `consent`           TINYINT(1)   NOT NULL DEFAULT 0,
  `qr_token`          VARCHAR(32)  NOT NULL,
  `badge_sent_at`     DATETIME     NULL,
  `checked_in_at`     DATETIME     NULL,
  `checked_out_at`    DATETIME     NULL,
  `qr_campaign`       VARCHAR(60)  NULL,
  `qr_source`         VARCHAR(60)  NULL,
  `ip_address`        VARCHAR(45)  NULL,
  `created_at`        DATETIME     NOT NULL,
  `updated_at`        DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `batimat_after_registrations_qr_token` (`qr_token`),
  UNIQUE KEY `batimat_after_registrations_email_phone_unique` (`email`, `phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
