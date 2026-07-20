USE `newsite_admin`;

-- Uniformiser les donnÃ©es avant d'ajouter la contrainte d'unicitÃ©.
UPDATE `offres_ete_leads`
SET
  `email` = LOWER(TRIM(`email`)),
  `phone` = REPLACE(REPLACE(TRIM(`phone`), ' ', ''), '+213+213', '+213');

ALTER TABLE `offres_ete_leads`
  DROP COLUMN `notes`,
  MODIFY COLUMN `phone` VARCHAR(50) NOT NULL,
  ADD CONSTRAINT `offres_ete_leads_email_phone_unique`
    UNIQUE (`email`, `phone`);
