-- Home category shortcuts and shop-by-project tiles. Run against techxpertstore.
-- Safe to run again. Starts empty: staff pick real categories later.
-- The app adds a "More" tile after the shortcuts, so this table holds at most 7.

CREATE TABLE IF NOT EXISTS home_shortcuts (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  CategoryID INT NOT NULL,
  Label VARCHAR(24) NOT NULL DEFAULT '',
  Position INT NOT NULL,
  INDEX idx_home_shortcuts_position (Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS home_projects (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Title VARCHAR(60) NOT NULL,
  Subtitle VARCHAR(80) NOT NULL DEFAULT '',
  ImageURL VARCHAR(1000) NOT NULL DEFAULT '',
  Calculator VARCHAR(16) NOT NULL DEFAULT '',
  Position INT NOT NULL,
  INDEX idx_home_projects_position (Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS home_project_categories (
  ProjectID INT NOT NULL,
  CategoryID INT NOT NULL,
  Position INT NOT NULL,
  PRIMARY KEY (ProjectID, CategoryID),
  INDEX idx_home_project_categories_order (ProjectID, Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
