<?php
// ============================================================
// GB Tile Swapper — Event Tracker Endpoint
// POST /tracker/event.php
//
// Body (JSON):
// {
//   "session_id": "uuid-v4",
//   "event_name": "feature_used",
//   "payload": { ... }     // optional
// }
// ============================================================
require_once __DIR__ . '/db.php';

send_cors_headers();
handle_preflight();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$ip_hash = hash_ip($_SERVER['REMOTE_ADDR'] ?? '');

if (is_rate_limited($ip_hash)) {
    http_response_code(429);
    echo json_encode(['error' => 'Too many requests']);
    exit;
}

$data       = get_json_body();
$session_id = isset($data['session_id']) ? substr(trim($data['session_id']), 0, 36) : '';
$event_name = isset($data['event_name']) ? substr(trim($data['event_name']), 0, 64) : '';
$payload    = isset($data['payload']) && is_array($data['payload'])
                ? json_encode($data['payload'])
                : null;
$user_agent = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 512);

if ($session_id === '' || $event_name === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing session_id or event_name']);
    exit;
}

try {
    $pdo  = get_db();
    $stmt = $pdo->prepare(
        'INSERT INTO gbts_events (session_id, event_name, payload, ip_hash, user_agent)
         VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([$session_id, $event_name, $payload, $ip_hash, $user_agent]);
    echo json_encode(['ok' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB error']);
}
