-- Home "Try searching" ideas. Run against techxpertstore.
-- Safe to run again. Starts empty: staff type the chips later.
-- The app keeps its own list until it reads GET /cms/search-suggestions.

CREATE TABLE IF NOT EXISTS search_suggestions (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Phrase VARCHAR(40) NOT NULL,
  Position INT NOT NULL,
  INDEX idx_search_suggestions_position (Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
