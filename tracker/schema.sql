-- ============================================================
-- GB Tile Swapper — Tracker Database Schema
-- MySQL / MariaDB
--
-- STEP 1 — Create the database (skip if using an existing one):
--   CREATE DATABASE gbts_tracker
--       DEFAULT CHARACTER SET utf8mb4
--       COLLATE utf8mb4_unicode_ci;
--
-- STEP 2 — Run the tables:
--   mysql -u YOUR_USER -p YOUR_DATABASE < schema.sql
--
-- Or paste everything below into phpMyAdmin → SQL tab.
--
-- All tables are prefixed with `gbts_` to avoid conflicts.
-- ============================================================


-- ------------------------------------------------------------
-- 1. EVENTS  (automatic, silent — user never sees this)
--    Tracks: page views, features used, project save/load, etc.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbts_events` (
    `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `session_id`  VARCHAR(36)   NOT NULL COMMENT 'UUID generated client-side per page load',
    `event_name`  VARCHAR(64)   NOT NULL COMMENT 'e.g. page_view, feature_used, project_save, project_load',
    `payload`     JSON          NULL     COMMENT 'Extra data — set count, group count, feature name, etc.',
    `ip_hash`     CHAR(64)      NULL     COMMENT 'SHA-256(IP + current date) — daily rotating, non-reversible',
    `user_agent`  VARCHAR(512)  NULL,
    `created_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_events_name`    (`event_name`),
    INDEX `idx_events_session` (`session_id`),
    INDEX `idx_events_created` (`created_at`),
    INDEX `idx_events_ip`      (`ip_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 2. ERRORS  (automatic, silent — user never sees this)
--    JS crashes and unhandled promise rejections caught by
--    window.onerror and window.onunhandledrejection.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbts_errors` (
    `id`          INT UNSIGNED   NOT NULL AUTO_INCREMENT,
    `session_id`  VARCHAR(36)    NOT NULL,
    `message`     VARCHAR(1024)  NULL     COMMENT 'Error message',
    `stack`       TEXT           NULL     COMMENT 'Full stack trace',
    `url`         VARCHAR(512)   NULL     COMMENT 'Script URL where the error occurred',
    `line`        SMALLINT UNSIGNED NULL  COMMENT 'Line number',
    `col`         SMALLINT UNSIGNED NULL  COMMENT 'Column number',
    `user_agent`  VARCHAR(512)   NULL,
    `created_at`  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_errors_session` (`session_id`),
    INDEX `idx_errors_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 3. FEEDBACK  (user-submitted via in-app modal)
--    Covers three types in one table:
--
--    type = 'rating'      → Star rating (1-5) + optional comment
--    type = 'suggestion'  → Feature request or improvement idea
--    type = 'bug_report'  → User-described bug (NOT the auto crash log)
--
--    rating is NULL for suggestions and bug reports.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbts_feedback` (
    `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `session_id`   VARCHAR(36)   NOT NULL,
    `type`         ENUM('rating', 'suggestion', 'bug_report')
                                 NOT NULL DEFAULT 'rating',
    `rating`       TINYINT UNSIGNED NULL  COMMENT '1 to 5 stars — only set when type = rating',
    `message`      TEXT          NOT NULL COMMENT 'User text — comment, suggestion, or bug description',
    `app_version`  VARCHAR(32)   NULL     COMMENT 'App version string at time of submission',
    `browser_info` JSON          NULL     COMMENT 'Browser name, version, OS, screen size (auto-filled)',
    `created_at`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_feedback_type`    (`type`),
    INDEX `idx_feedback_rating`  (`rating`),
    INDEX `idx_feedback_created` (`created_at`),

    CONSTRAINT `chk_rating_range` CHECK (`rating` IS NULL OR (`rating` BETWEEN 1 AND 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
