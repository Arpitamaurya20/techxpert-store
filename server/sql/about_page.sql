-- About the company: mission, facts and values. Run against techxpertstore.
-- Safe to run again. Starts empty: staff write the page later.
-- The app keeps its own About copy until it reads GET /cms/about.

CREATE TABLE IF NOT EXISTS about_page (
  ID TINYINT NOT NULL PRIMARY KEY,
  MissionTitle VARCHAR(80) NOT NULL DEFAULT '',
  MissionBody VARCHAR(600) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO about_page (ID) VALUES (1);

CREATE TABLE IF NOT EXISTS about_facts (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  FactValue VARCHAR(16) NOT NULL,
  FactLabel VARCHAR(32) NOT NULL,
  Position INT NOT NULL,
  INDEX idx_about_facts_position (Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS about_values (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Icon VARCHAR(40) NOT NULL,
  Title VARCHAR(40) NOT NULL,
  Body VARCHAR(240) NOT NULL,
  Position INT NOT NULL,
  INDEX idx_about_values_position (Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE portal_audit_logs
  MODIFY entity ENUM(
    'banner','section','bulk_tier','product','publish','order','category','delivery','access','store','help','about'
  ) NOT NULL;
