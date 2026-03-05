<?php
// ============================================================
// GB Tile Swapper — Tracker Config
// ============================================================

// Database
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'gbtstracker');
define('DB_USER', 'YOUR_DB_USER');      // ← remplacer
define('DB_PASS', 'YOUR_DB_PASSWORD');  // ← remplacer
define('DB_PORT', 3306);

// CORS — domaine autorisé à envoyer des données
define('ALLOWED_ORIGIN', 'https://gbtileswaper.pixelpep.com');

// Rate limiting — max requêtes par IP par minute
define('RATE_LIMIT', 20);

// Version de l'app (pour les rapports de feedback)
define('APP_VERSION', '2.0');
