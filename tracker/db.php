<?php
// ============================================================
// GB Tile Swapper — Database connection (PDO)
// ============================================================
require_once __DIR__ . '/config.php';

function get_db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT
             . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

// Hash l'IP avec la date du jour comme sel — non-réversible, rotation quotidienne
function hash_ip(string $ip): string {
    return hash('sha256', $ip . '|' . date('Y-m-d'));
}

// Vérifie le rate limit — retourne true si la limite est dépassée
function is_rate_limited(string $ip_hash): bool {
    try {
        $pdo  = get_db();
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM gbts_events
              WHERE ip_hash = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)'
        );
        $stmt->execute([$ip_hash]);
        return (int)$stmt->fetchColumn() >= RATE_LIMIT;
    } catch (Exception $e) {
        return false; // En cas d'erreur DB, on laisse passer
    }
}

// Headers CORS + JSON communs à tous les endpoints
function send_cors_headers(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === ALLOWED_ORIGIN) {
        header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
    }
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Content-Type: application/json; charset=utf-8');
}

// Réponse rapide aux preflight OPTIONS
function handle_preflight(): void {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// Retourne le body JSON de la requête décodé, ou [] si invalide
function get_json_body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
