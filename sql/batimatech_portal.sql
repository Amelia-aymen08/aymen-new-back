CREATE TABLE IF NOT EXISTS `sales_agents` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `fullName` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_sales_agents_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `batimatech_leads` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `salesAgentId` INT NOT NULL,
  `salesAgentName` VARCHAR(255) NOT NULL,
  `prospectLastName` VARCHAR(255) NOT NULL,
  `prospectFirstName` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL,
  `projectName` TEXT NULL,
  `appointmentDate` DATE NULL,
  `appointmentSlot` VARCHAR(20) NULL,
  `note` VARCHAR(1200) NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'nouveau',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_batimatech_leads_sales_agent` (`salesAgentId`),
  CONSTRAINT `fk_batimatech_leads_sales_agent`
    FOREIGN KEY (`salesAgentId`) REFERENCES `sales_agents` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Empêcher deux rendez-vous sur le même créneau (par commercial)
-- Si la table existe déjà, exécuter cet ALTER:
-- ALTER TABLE `batimatech_leads`
--   ADD UNIQUE KEY `uniq_batimatech_leads_slot` (`salesAgentId`, `appointmentDate`, `appointmentSlot`);

-- Exemple d'insertion d'un commercial autorisé:
-- INSERT INTO `sales_agents` (`fullName`, `email`, `isActive`)
-- VALUES ('Nom Prénom', 'commercial@batimatech.dz', 1);
