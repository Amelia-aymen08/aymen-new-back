CREATE TABLE IF NOT EXISTS `concours_batitec_applications` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `category` ENUM('HOTEL','VILLA') NOT NULL,
  `lastName` VARCHAR(255) NOT NULL,
  `firstName` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `studentCardPath` VARCHAR(512) NOT NULL,
  `studentCardMime` VARCHAR(100) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_concours_batitec_category` (`category`),
  KEY `idx_concours_batitec_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lecture des candidatures (toutes)
-- SELECT * FROM `concours_batitec_applications` ORDER BY `createdAt` DESC;

-- Lecture par catégorie
-- SELECT * FROM `concours_batitec_applications` WHERE `category`='HOTEL' ORDER BY `createdAt` DESC;
-- SELECT * FROM `concours_batitec_applications` WHERE `category`='VILLA' ORDER BY `createdAt` DESC;

