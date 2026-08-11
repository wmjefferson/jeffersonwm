-- Run widget-schema.sql first inside the new JeffersonWM widget database.
-- Replace NEW_WIDGET_DATABASE with the cPanel database name you create.

INSERT IGNORE INTO NEW_WIDGET_DATABASE.widget_fonts (name, weight, probability)
SELECT name, COALESCE(weight, 2), COALESCE(probability, 1)
FROM jeffers4_fonts.fonts;

INSERT INTO NEW_WIDGET_DATABASE.widget_special_dates (name, description, date, end_date, is_public)
SELECT name, description, date, end_date, 1
FROM jeffers4_dates.events;

-- Legacy cleanup candidates after verification:
-- jeffers4_dates
-- jeffers4_fonts
-- jeffers4_jefferson
