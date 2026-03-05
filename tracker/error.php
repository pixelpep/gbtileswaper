<?php
// ============================================================
// GB Tile Swapper — JS Error Tracker Endpoint
// POST /tracker/error.php
//
// Body (JSON):
// {
//   "session_id": "uuid-v4",
//   "message":    "Uncaught TypeError: ...",
//   "stack":      "at foo (ui.js:123:4)\n...",
//   "url":        "https://gbtileswaper.pixelpep.com/ui.js",
//   "line":       123,
//   "col":        4
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
$session_id = isset($data['session_id']) ? substr(trim($data['session_id']), 0, 36)   : '';
$message    = isset($data['message'])    ? substr(strip_tags(trim($data['message'])), 0, 1024)  : null;
$stack      = isset($data['stack'])      ? substr(strip_tags(trim($data['stack'])),    0, 65535) : null;
$url        = isset($data['url'])        ? substr(trim($data['url']),        0, 512)   : null;
$line       = isset($data['line'])       ? (int)$data['line']  : null;
$col        = isset($data['col'])        ? (int)$data['col']   : null;
$user_agent = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 512);

if ($session_id === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing session_id']);
    exit;
}

try {
    $pdo  = get_db();
    $stmt = $pdo->prepare(
        'INSERT INTO gbts_errors (session_id, message, stack, url, line, col, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$session_id, $message, $stack, $url, $line, $col, $user_agent]);
    echo json_encode(['ok' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB error']);
}
