<?php
// ============================================================
// GB Tile Swapper — Tracker Config
// ============================================================

// Database
define('DB_HOST', 'localhost');
define('DB_NAME', 'gbtstracker');
define('DB_USER', 'gbts');
define('DB_PASS', 'elbHNkrxP8eR9qsnCZLq');
define('DB_PORT', 3306);

// CORS — domaine autorisé à envoyer des données
define('ALLOWED_ORIGIN', 'https://gbtileswaper.pixelpep.com');

// Rate limiting — max requêtes par IP par minute
define('RATE_LIMIT', 20);

// Version de l'app (pour les rapports de feedback)
define('APP_VERSION', '2.0');

// Dashboard — mot de passe d'accès
define('DASHBOARD_PASS', 'm0nnomcestBouette');
