-- Scallions Widget DB Schema

CREATE TABLE IF NOT EXISTS scallions_items (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category ENUM('fruit', 'vegetable', 'sport') NOT NULL,
  start_month TINYINT NOT NULL,
  start_day TINYINT NOT NULL,
  end_month TINYINT NOT NULL,
  end_day TINYINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
