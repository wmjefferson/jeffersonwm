-- JeffersonWM widget database promotion helper.
-- Run this in phpMyAdmin after creating the target database in cPanel:
--   jeffers4_jeffwm_widget
--
-- Source:
--   jeffers4_jeffwm_widget_dev
--
-- This script assumes the target tables do not already contain data.

CREATE TABLE IF NOT EXISTS `jeffers4_jeffwm_widget`.`widget_defaults`
  LIKE `jeffers4_jeffwm_widget_dev`.`widget_defaults`;
INSERT INTO `jeffers4_jeffwm_widget`.`widget_defaults`
  SELECT * FROM `jeffers4_jeffwm_widget_dev`.`widget_defaults`;

CREATE TABLE IF NOT EXISTS `jeffers4_jeffwm_widget`.`widget_fonts`
  LIKE `jeffers4_jeffwm_widget_dev`.`widget_fonts`;
INSERT INTO `jeffers4_jeffwm_widget`.`widget_fonts`
  SELECT * FROM `jeffers4_jeffwm_widget_dev`.`widget_fonts`;

CREATE TABLE IF NOT EXISTS `jeffers4_jeffwm_widget`.`widget_special_dates`
  LIKE `jeffers4_jeffwm_widget_dev`.`widget_special_dates`;
INSERT INTO `jeffers4_jeffwm_widget`.`widget_special_dates`
  SELECT * FROM `jeffers4_jeffwm_widget_dev`.`widget_special_dates`;

CREATE TABLE IF NOT EXISTS `jeffers4_jeffwm_widget`.`user_widget_preferences`
  LIKE `jeffers4_jeffwm_widget_dev`.`user_widget_preferences`;
INSERT INTO `jeffers4_jeffwm_widget`.`user_widget_preferences`
  SELECT * FROM `jeffers4_jeffwm_widget_dev`.`user_widget_preferences`;

CREATE TABLE IF NOT EXISTS `jeffers4_jeffwm_widget`.`user_widget_special_dates`
  LIKE `jeffers4_jeffwm_widget_dev`.`user_widget_special_dates`;
INSERT INTO `jeffers4_jeffwm_widget`.`user_widget_special_dates`
  SELECT * FROM `jeffers4_jeffwm_widget_dev`.`user_widget_special_dates`;
