<?php
// ============================================================
// GB Tile Swapper — DB Migration
// Run ONCE then DELETE from server
// ============================================================
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: text/plain');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

$pdo = get_db();
echo "Connected to DB: " . DB_NAME . "\n\n";

$migrations = [
    // Add country_code to events
    "country_code on gbts_events" => function($pdo) {
        $exists = $pdo->query(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME   = 'gbts_events'
               AND COLUMN_NAME  = 'country_code'"
        )->fetchColumn();
        if ($exists) { echo "  ✓ Already exists — skipped\n"; return; }
        $pdo->exec("ALTER TABLE gbts_events ADD COLUMN country_code CHAR(2) NULL DEFAULT NULL AFTER user_agent");
        echo "  ✓ Added country_code CHAR(2) to gbts_events\n";
    },
];

foreach ($migrations as $label => $fn) {
    echo "Migration: {$label}\n";
    try { $fn($pdo); } catch (Exception $e) { echo "  ✗ ERROR: " . $e->getMessage() . "\n"; }
}

echo "\nDone. DELETE this file from the server.\n";
