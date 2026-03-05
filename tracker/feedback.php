<?php
// ============================================================
// GB Tile Swapper — Feedback Endpoint
// POST /tracker/feedback.php
//
// Body (JSON):
// {
//   "session_id":   "uuid-v4",
//   "type":         "rating" | "suggestion" | "bug_report",
//   "rating":       4,             // only for type=rating (1-5)
//   "message":      "Great tool!", // required
//   "browser_info": { ... }        // optional, auto-filled by JS
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

$data       = get_json_body();
$session_id = isset($data['session_id']) ? substr(trim($data['session_id']), 0, 36) : '';
$type       = isset($data['type'])       ? trim($data['type'])                       : '';
$message    = isset($data['message'])    ? strip_tags(trim($data['message']))        : '';
$rating     = null;
$browser_info = null;

$allowed_types = ['rating', 'suggestion', 'bug_report'];

if ($session_id === '' || !in_array($type, $allowed_types, true) || $message === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid fields']);
    exit;
}

if ($type === 'rating') {
    $r = isset($data['rating']) ? (int)$data['rating'] : 0;
    if ($r < 1 || $r > 5) {
        http_response_code(400);
        echo json_encode(['error' => 'Rating must be 1-5']);
        exit;
    }
    $rating = $r;
}

if (isset($data['browser_info']) && is_array($data['browser_info'])) {
    $browser_info = json_encode($data['browser_info']);
}

// Truncate message to TEXT limit sanity check
$message = substr($message, 0, 10000);

try {
    $pdo  = get_db();
    $stmt = $pdo->prepare(
        'INSERT INTO gbts_feedback (session_id, type, rating, message, app_version, browser_info)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$session_id, $type, $rating, $message, APP_VERSION, $browser_info]);
    echo json_encode(['ok' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB error']);
}
