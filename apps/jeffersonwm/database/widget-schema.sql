CREATE TABLE IF NOT EXISTS widget_defaults (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  default_location_label VARCHAR(255) NOT NULL DEFAULT 'San Francisco, California',
  default_latitude DECIMAL(10, 7) NOT NULL DEFAULT 37.7811000,
  default_longitude DECIMAL(10, 7) NOT NULL DEFAULT -122.4883000,
  weather_unit ENUM('fahrenheit', 'celsius') NOT NULL DEFAULT 'fahrenheit',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS widget_fonts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  round TINYINT UNSIGNED NULL DEFAULT 1,
  weight TINYINT UNSIGNED NOT NULL DEFAULT 2,
  probability TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY widget_fonts_name_unique (name),
  KEY widget_fonts_round_index (round)
);

CREATE TABLE IF NOT EXISTS widget_special_dates (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  date DATE NOT NULL,
  end_date DATE NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY widget_special_dates_date_index (date)
);

CREATE TABLE IF NOT EXISTS user_widget_preferences (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  auth_user_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NULL,
  location_label VARCHAR(255) NULL,
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  weather_unit ENUM('fahrenheit', 'celsius') NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY user_widget_preferences_auth_user_unique (auth_user_id)
);

CREATE TABLE IF NOT EXISTS user_widget_special_dates (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  auth_user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  date DATE NOT NULL,
  end_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY user_widget_special_dates_auth_user_index (auth_user_id),
  KEY user_widget_special_dates_date_index (date)
);

INSERT INTO widget_defaults (id, default_location_label, default_latitude, default_longitude, weather_unit)
VALUES (1, 'San Francisco, California', 37.7811000, -122.4883000, 'fahrenheit')
ON DUPLICATE KEY UPDATE id = id;
