<?php
// ============================================================
// GB Tile Swapper — Analytics Dashboard
// Access: /tracker/dashboard.php  (not linked publicly)
// ============================================================
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// ── Auth ────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['logout'])) {
    session_destroy();
    header('Location: ' . $_SERVER['PHP_SELF']);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    if ($_POST['password'] === DASHBOARD_PASS) {
        $_SESSION['gbts_dash'] = true;
        header('Location: ' . $_SERVER['PHP_SELF']);
        exit;
    }
    $login_error = true;
}
$authed = !empty($_SESSION['gbts_dash']);

// ── Login page ───────────────────────────────────────────────
if (!$authed) { ?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GBTS Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}
body{margin:0;background:#000;color:#00ff00;font-family:'Source Sans Pro',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}
.login-box{border:2px solid #00ff00;padding:40px;width:340px;box-shadow:0 0 30px rgba(0,255,0,.4)}
h1{margin:0 0 6px;font-size:16px;letter-spacing:2px;text-shadow:0 0 10px #00ff00}
.sub{font-size:10px;color:#009900;margin-bottom:28px;letter-spacing:1px;text-transform:uppercase}
label{font-size:10px;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:6px}
input[type=password]{width:100%;background:#000;border:1px solid #00ff00;color:#00ff00;padding:8px 12px;font-size:13px;font-family:inherit;outline:none}
input[type=password]:focus{box-shadow:0 0 10px rgba(0,255,0,.4)}
.btn{margin-top:16px;width:100%;background:#000;color:#00ff00;border:1px solid #00ff00;padding:9px;font-size:11px;font-family:inherit;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:.2s}
.btn:hover{background:#00ff00;color:#000}
.err{color:#ff0066;font-size:10px;margin-top:10px;letter-spacing:1px}
</style>
</head>
<body>
<div class="login-box">
    <h1>GB TILE SWAPPER</h1>
    <div class="sub">Analytics Dashboard</div>
    <form method="POST">
        <label>Password</label>
        <input type="password" name="password" autofocus>
        <button class="btn" type="submit">ACCESS</button>
        <?php if (!empty($login_error)): ?>
        <div class="err">✗ Incorrect password</div>
        <?php endif; ?>
    </form>
</div>
</body>
</html>
<?php exit; }

// ── Data queries ─────────────────────────────────────────────
try { $pdo = get_db(); $db_ok = true; } catch (Exception $e) { $db_ok = false; }

function q(string $sql, array $params = []): array {
    try {
        $stmt = get_db()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    } catch (Exception $e) { return []; }
}
function q1(string $sql, array $params = []): mixed {
    $rows = q($sql, $params);
    return $rows ? array_values($rows[0])[0] : null;
}

// Overview stats
$sessions_today  = q1("SELECT COUNT(DISTINCT session_id) FROM gbts_events WHERE DATE(created_at)=CURDATE()");
$sessions_week   = q1("SELECT COUNT(DISTINCT session_id) FROM gbts_events WHERE created_at >= DATE_SUB(NOW(),INTERVAL 7 DAY)");
$sessions_month  = q1("SELECT COUNT(DISTINCT session_id) FROM gbts_events WHERE created_at >= DATE_SUB(NOW(),INTERVAL 30 DAY)");
$events_today    = q1("SELECT COUNT(*) FROM gbts_events WHERE DATE(created_at)=CURDATE()");
$errors_week     = q1("SELECT COUNT(*) FROM gbts_errors WHERE created_at >= DATE_SUB(NOW(),INTERVAL 7 DAY)");
$feedback_total  = q1("SELECT COUNT(*) FROM gbts_feedback");
$avg_rating      = q1("SELECT ROUND(AVG(rating),1) FROM gbts_feedback WHERE rating IS NOT NULL");

// Chart: daily unique sessions last 14 days
$daily_sessions  = q("SELECT DATE(created_at) as d, COUNT(DISTINCT session_id) as n
                       FROM gbts_events WHERE created_at >= DATE_SUB(NOW(),INTERVAL 14 DAY)
                       GROUP BY DATE(created_at) ORDER BY d");

// Chart: top events last 7 days
$top_events      = q("SELECT event_name, COUNT(*) as n
                       FROM gbts_events WHERE created_at >= DATE_SUB(NOW(),INTERVAL 7 DAY)
                       GROUP BY event_name ORDER BY n DESC LIMIT 10");

// Country stats (last 30 days)
$country_data    = q("SELECT country_code, COUNT(DISTINCT session_id) as sessions, COUNT(*) as events
                       FROM gbts_events
                       WHERE country_code IS NOT NULL AND created_at >= DATE_SUB(NOW(),INTERVAL 30 DAY)
                       GROUP BY country_code ORDER BY sessions DESC LIMIT 30");

// Calendar heatmap (last 365 days — daily unique sessions)
$calendar_raw    = q("SELECT DATE(created_at) as d, COUNT(DISTINCT session_id) as n
                       FROM gbts_events WHERE created_at >= DATE_SUB(NOW(),INTERVAL 365 DAY)
                       GROUP BY DATE(created_at)");
$calendar_map = [];
foreach ($calendar_raw as $r) $calendar_map[$r['d']] = (int)$r['n'];

// Check if country_code column exists (migration-safe)
$has_country_col = (bool)q1(
    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gbts_events' AND COLUMN_NAME='country_code'"
);
$ev_select = $has_country_col
    ? "SELECT session_id, event_name, payload, country_code, created_at FROM gbts_events"
    : "SELECT session_id, event_name, payload, NULL as country_code, created_at FROM gbts_events";

// Events table
$events_filter   = isset($_GET['ev']) ? trim($_GET['ev']) : '';
$recent_events   = $events_filter !== ''
    ? q("{$ev_select} WHERE event_name=? ORDER BY created_at DESC LIMIT 100", [$events_filter])
    : q("{$ev_select} ORDER BY created_at DESC LIMIT 100");
$event_names     = q("SELECT DISTINCT event_name FROM gbts_events ORDER BY event_name");

// Errors table
$recent_errors   = q("SELECT session_id, message, url, line, col, user_agent, created_at FROM gbts_errors ORDER BY created_at DESC LIMIT 50");

// Feedback table
$recent_feedback = q("SELECT type, rating, message, browser_info, created_at FROM gbts_feedback ORDER BY created_at DESC LIMIT 50");

// Build line chart data (14 days)
$chart_days = []; $chart_sess = [];
$sess_map = [];
foreach ($daily_sessions as $r) $sess_map[$r['d']] = $r['n'];
for ($i = 13; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-{$i} days"));
    $chart_days[] = date('M j', strtotime($d));
    $chart_sess[] = $sess_map[$d] ?? 0;
}
$chart_ev_labels = array_column($top_events, 'event_name');
$chart_ev_data   = array_column($top_events, 'n');

// Build map values: { "us": 42, "ca": 10, ... }
$map_values = [];
foreach ($country_data as $c) {
    if ($c['country_code']) $map_values[strtolower($c['country_code'])] = (int)$c['sessions'];
}

// Helpers
function fmt_dt(string $dt): string { return date('M j, H:i', strtotime($dt)); }
function short_id(string $id): string { return substr($id, 0, 8) . '…'; }

// Country name lookup (compact list)
$country_names = [
    'AD'=>'Andorra','AE'=>'UAE','AF'=>'Afghanistan','AG'=>'Antigua','AL'=>'Albania',
    'AM'=>'Armenia','AO'=>'Angola','AR'=>'Argentina','AT'=>'Austria','AU'=>'Australia',
    'AZ'=>'Azerbaijan','BA'=>'Bosnia','BB'=>'Barbados','BD'=>'Bangladesh','BE'=>'Belgium',
    'BF'=>'Burkina Faso','BG'=>'Bulgaria','BH'=>'Bahrain','BI'=>'Burundi','BJ'=>'Benin',
    'BN'=>'Brunei','BO'=>'Bolivia','BR'=>'Brazil','BS'=>'Bahamas','BT'=>'Bhutan',
    'BW'=>'Botswana','BY'=>'Belarus','BZ'=>'Belize','CA'=>'Canada','CD'=>'DR Congo',
    'CF'=>'C. African Rep.','CG'=>'Congo','CH'=>'Switzerland','CI'=>'Côte d\'Ivoire',
    'CL'=>'Chile','CM'=>'Cameroon','CN'=>'China','CO'=>'Colombia','CR'=>'Costa Rica',
    'CU'=>'Cuba','CV'=>'Cape Verde','CY'=>'Cyprus','CZ'=>'Czechia','DE'=>'Germany',
    'DJ'=>'Djibouti','DK'=>'Denmark','DM'=>'Dominica','DO'=>'Dominican Rep.','DZ'=>'Algeria',
    'EC'=>'Ecuador','EE'=>'Estonia','EG'=>'Egypt','ER'=>'Eritrea','ES'=>'Spain',
    'ET'=>'Ethiopia','FI'=>'Finland','FJ'=>'Fiji','FM'=>'Micronesia','FR'=>'France',
    'GA'=>'Gabon','GB'=>'UK','GD'=>'Grenada','GE'=>'Georgia','GH'=>'Ghana',
    'GM'=>'Gambia','GN'=>'Guinea','GQ'=>'Eq. Guinea','GR'=>'Greece','GT'=>'Guatemala',
    'GW'=>'Guinea-Bissau','GY'=>'Guyana','HN'=>'Honduras','HR'=>'Croatia','HT'=>'Haiti',
    'HU'=>'Hungary','ID'=>'Indonesia','IE'=>'Ireland','IL'=>'Israel','IN'=>'India',
    'IQ'=>'Iraq','IR'=>'Iran','IS'=>'Iceland','IT'=>'Italy','JM'=>'Jamaica',
    'JO'=>'Jordan','JP'=>'Japan','KE'=>'Kenya','KG'=>'Kyrgyzstan','KH'=>'Cambodia',
    'KI'=>'Kiribati','KM'=>'Comoros','KN'=>'St. Kitts','KP'=>'North Korea','KR'=>'South Korea',
    'KW'=>'Kuwait','KZ'=>'Kazakhstan','LA'=>'Laos','LB'=>'Lebanon','LC'=>'St. Lucia',
    'LI'=>'Liechtenstein','LK'=>'Sri Lanka','LR'=>'Liberia','LS'=>'Lesotho','LT'=>'Lithuania',
    'LU'=>'Luxembourg','LV'=>'Latvia','LY'=>'Libya','MA'=>'Morocco','MC'=>'Monaco',
    'MD'=>'Moldova','ME'=>'Montenegro','MG'=>'Madagascar','MH'=>'Marshall Is.','MK'=>'N. Macedonia',
    'ML'=>'Mali','MM'=>'Myanmar','MN'=>'Mongolia','MR'=>'Mauritania','MT'=>'Malta',
    'MU'=>'Mauritius','MV'=>'Maldives','MW'=>'Malawi','MX'=>'Mexico','MY'=>'Malaysia',
    'MZ'=>'Mozambique','NA'=>'Namibia','NE'=>'Niger','NG'=>'Nigeria','NI'=>'Nicaragua',
    'NL'=>'Netherlands','NO'=>'Norway','NP'=>'Nepal','NR'=>'Nauru','NZ'=>'New Zealand',
    'OM'=>'Oman','PA'=>'Panama','PE'=>'Peru','PG'=>'Papua New Guinea','PH'=>'Philippines',
    'PK'=>'Pakistan','PL'=>'Poland','PT'=>'Portugal','PW'=>'Palau','PY'=>'Paraguay',
    'QA'=>'Qatar','RO'=>'Romania','RS'=>'Serbia','RU'=>'Russia','RW'=>'Rwanda',
    'SA'=>'Saudi Arabia','SB'=>'Solomon Is.','SC'=>'Seychelles','SD'=>'Sudan','SE'=>'Sweden',
    'SG'=>'Singapore','SI'=>'Slovenia','SK'=>'Slovakia','SL'=>'Sierra Leone','SM'=>'San Marino',
    'SN'=>'Senegal','SO'=>'Somalia','SR'=>'Suriname','SS'=>'South Sudan','ST'=>'São Tomé',
    'SV'=>'El Salvador','SY'=>'Syria','SZ'=>'Eswatini','TD'=>'Chad','TG'=>'Togo',
    'TH'=>'Thailand','TJ'=>'Tajikistan','TL'=>'Timor-Leste','TM'=>'Turkmenistan','TN'=>'Tunisia',
    'TO'=>'Tonga','TR'=>'Turkey','TT'=>'Trinidad','TV'=>'Tuvalu','TZ'=>'Tanzania',
    'UA'=>'Ukraine','UG'=>'Uganda','US'=>'United States','UY'=>'Uruguay','UZ'=>'Uzbekistan',
    'VA'=>'Vatican','VC'=>'St. Vincent','VE'=>'Venezuela','VN'=>'Vietnam','VU'=>'Vanuatu',
    'WS'=>'Samoa','YE'=>'Yemen','ZA'=>'South Africa','ZM'=>'Zambia','ZW'=>'Zimbabwe',
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GBTS Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/jsvectormap@1.5.3/dist/css/jsvectormap.min.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jsvectormap@1.5.3/dist/js/jsvectormap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jsvectormap@1.5.3/dist/maps/world.js"></script>
<style>
/* ── Reset + Base ─────────────────────────────────────────── */
*{box-sizing:border-box;margin:0;padding:0}
body{background:#000;color:#00ff00;font-family:'Source Sans Pro',sans-serif;min-height:100vh;font-size:13px}
a{color:#00ff00;text-decoration:none}

/* ── Header ──────────────────────────────────────────────── */
.header{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-bottom:1px solid #003300}
.header h1{font-size:16px;letter-spacing:2px;text-shadow:0 0 10px #00ff00;white-space:nowrap}
.header-sub{font-size:9px;color:#009900;letter-spacing:1px;text-transform:uppercase;margin-left:12px}
.header-left{display:flex;align-items:baseline}
.logout-btn{background:#000;border:1px solid #333;color:#555;padding:4px 12px;font-size:9px;font-family:inherit;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;transition:.2s}
.logout-btn:hover{border-color:#ff0066;color:#ff0066}

/* ── Tab nav ─────────────────────────────────────────────── */
.tab-nav{display:flex;padding:10px 20px 0;border-bottom:1px solid #333}
.tab-btn{background:#000;color:#00ff00;border:1px solid #00ff00;border-right:none;padding:5px 18px;font-size:9px;font-family:inherit;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;transition:.15s}
.tab-btn:first-child{border-radius:2px 0 0 2px}
.tab-btn:last-child{border-right:1px solid #00ff00;border-radius:0 2px 2px 0}
.tab-btn:hover{background:#001100;box-shadow:inset 0 0 10px rgba(0,255,0,.2)}
.tab-btn.active{background:#00ff00;color:#000}

/* ── Tab content ─────────────────────────────────────────── */
.tab-pane{display:none;padding:20px}
.tab-pane.active{display:block}

/* ── Stat cards ──────────────────────────────────────────── */
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px}
.stat-card{border:1px solid #003300;background:#001100;padding:16px 20px;text-align:center;transition:.2s}
.stat-card:hover{border-color:#00ff00;box-shadow:0 0 15px rgba(0,255,0,.2)}
.stat-card .val{font-size:36px;font-weight:700;color:#00ff00;text-shadow:0 0 15px rgba(0,255,0,.6);line-height:1}
.stat-card .lbl{font-size:9px;color:#009900;letter-spacing:1px;text-transform:uppercase;margin-top:6px}
.stat-card.warn .val{color:#ffcc00;text-shadow:0 0 15px rgba(255,204,0,.6)}
.stat-card.warn{border-color:#332200}
.stat-card.info .val{color:#00ccff;text-shadow:0 0 15px rgba(0,204,255,.4)}
.stat-card.info{border-color:#002233}

/* ── Charts grid ─────────────────────────────────────────── */
.chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.chart-grid-3{display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:24px}
.chart-box{border:1px solid #003300;background:#000;padding:16px;position:relative}
.chart-box h3{font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#009900;margin-bottom:12px}
.chart-box canvas{max-height:200px}
@media(max-width:800px){.chart-grid,.chart-grid-3{grid-template-columns:1fr}}

/* ── World map ───────────────────────────────────────────── */
#worldMap{height:280px;background:#000}
.jvm-tooltip{background:#001100!important;border:1px solid #00ff00!important;color:#00ff00!important;font-family:'Source Sans Pro',sans-serif!important;font-size:11px!important;padding:4px 10px!important;border-radius:0!important;box-shadow:0 0 10px rgba(0,255,0,.3)!important}
.jvm-zoom-btn{background:#000!important;border:1px solid #333!important;color:#555!important;font-family:inherit!important;transition:.15s!important}
.jvm-zoom-btn:hover{border-color:#00ff00!important;color:#00ff00!important}

/* ── Calendar heatmap ────────────────────────────────────── */
.cal-wrap{overflow-x:auto;padding-bottom:4px}
.cal-grid{display:flex;gap:3px;align-items:flex-start}
.cal-col{display:flex;flex-direction:column;gap:3px}
.cal-cell{width:12px;height:12px;border-radius:1px;cursor:default;transition:opacity .15s}
.cal-cell:hover{opacity:.7}
.cal-months{display:flex;padding-left:22px;margin-bottom:4px;font-size:9px;color:#555;letter-spacing:.5px;height:14px;position:relative}
.cal-month-label{position:absolute;font-size:9px;color:#555;letter-spacing:.5px;text-transform:uppercase}
.cal-days{display:flex;flex-direction:column;gap:3px;margin-right:4px;font-size:8px;color:#444;text-transform:uppercase}
.cal-day-label{height:12px;line-height:12px;width:18px;text-align:right}
.cal-legend{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:9px;color:#555}
.cal-legend-cells{display:flex;gap:3px}
.cal-legend-cell{width:12px;height:12px;border-radius:1px}

/* ── Country table ───────────────────────────────────────── */
.country-list{list-style:none;display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto}
.country-row{display:flex;align-items:center;gap:8px;font-size:11px}
.country-flag{font-size:14px;width:22px;text-align:center;line-height:1}
.country-name{flex:1;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.country-bar-wrap{width:80px;height:4px;background:#111;border-radius:2px}
.country-bar{height:4px;border-radius:2px;background:#00ff00;box-shadow:0 0 4px rgba(0,255,0,.5);min-width:2px}
.country-count{color:#00ff00;font-weight:700;font-size:11px;min-width:24px;text-align:right}

/* ── Section title ───────────────────────────────────────── */
.section-title{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#009900;border-bottom:1px solid #003300;padding-bottom:6px;margin-bottom:12px}
.section-gap{margin-top:24px}

/* ── Tables ──────────────────────────────────────────────── */
.tbl-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:11px}
th{font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#009900;padding:6px 10px;border-bottom:1px solid #003300;text-align:left;white-space:nowrap}
td{padding:5px 10px;border-bottom:1px solid #0a0a0a;vertical-align:top;color:#aaa}
tr:hover td{background:#040f04;color:#00ff00}
.mono{font-family:monospace;font-size:10px}
.tag{display:inline-block;padding:1px 6px;border:1px solid #003300;font-size:9px;letter-spacing:.5px;text-transform:uppercase}
.tag-green{border-color:#003300;color:#009900}
.tag-blue{border-color:#002233;color:#0099cc}
.tag-red{border-color:#330011;color:#cc0044}
.tag-yellow{border-color:#332200;color:#cc8800}
.none{color:#333;font-style:italic}

/* ── Filter bar ──────────────────────────────────────────── */
.filter-bar{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.filter-bar label{font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#009900}
.filter-bar select{background:#000;border:1px solid #333;color:#00ff00;padding:4px 8px;font-size:10px;font-family:inherit;outline:none;cursor:pointer}
.filter-bar select:focus{border-color:#00ff00}
.clear-link{border:1px solid #333;color:#555;padding:4px 10px;font-size:9px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;transition:.15s;text-decoration:none}
.clear-link:hover{border-color:#00ff00;color:#00ff00}

/* ── Feedback ────────────────────────────────────────────── */
.fb-message{max-width:340px;white-space:pre-wrap;word-break:break-word;color:#ccc;font-size:11px}
.stars{color:#ffcc00;font-size:13px;letter-spacing:2px}

/* ── Misc ────────────────────────────────────────────────── */
.no-data{padding:40px;text-align:center;color:#333;font-size:11px;letter-spacing:1px;text-transform:uppercase}
.db-error{padding:20px;border:1px solid #ff0066;color:#ff0066;font-size:11px;margin:20px}
</style>
</head>
<body>

<div class="header">
    <div class="header-left">
        <h1>GB TILE SWAPPER</h1>
        <span class="header-sub">&nbsp;/ Analytics</span>
    </div>
    <form method="POST" style="margin:0">
        <button class="logout-btn" name="logout" value="1">Logout</button>
    </form>
</div>

<div class="tab-nav">
    <button class="tab-btn active" onclick="showTab('overview',this)">Overview</button>
    <button class="tab-btn" onclick="showTab('events',this)">Events</button>
    <button class="tab-btn" onclick="showTab('errors',this)">Errors</button>
    <button class="tab-btn" onclick="showTab('feedback',this)">Feedback</button>
</div>

<?php if (!$db_ok): ?>
<div class="db-error">✗ Database connection failed. Check config.php credentials.</div>
<?php endif; ?>

<!-- ═══════════════════════════════════════════════════════════
     TAB: OVERVIEW
══════════════════════════════════════════════════════════════ -->
<div class="tab-pane active" id="tab-overview">

    <!-- Stat Cards -->
    <div class="stat-grid">
        <div class="stat-card">
            <div class="val"><?= (int)$sessions_today ?></div>
            <div class="lbl">Sessions today</div>
        </div>
        <div class="stat-card">
            <div class="val"><?= (int)$sessions_week ?></div>
            <div class="lbl">Sessions (7 days)</div>
        </div>
        <div class="stat-card">
            <div class="val"><?= (int)$sessions_month ?></div>
            <div class="lbl">Sessions (30 days)</div>
        </div>
        <div class="stat-card">
            <div class="val"><?= (int)$events_today ?></div>
            <div class="lbl">Events today</div>
        </div>
        <div class="stat-card warn">
            <div class="val"><?= (int)$errors_week ?></div>
            <div class="lbl">Errors (7 days)</div>
        </div>
        <div class="stat-card info">
            <div class="val"><?= (int)$feedback_total ?></div>
            <div class="lbl">Total feedbacks</div>
        </div>
        <?php if ($avg_rating): ?>
        <div class="stat-card info">
            <div class="val"><?= $avg_rating ?>/5</div>
            <div class="lbl">Avg. rating</div>
        </div>
        <?php endif; ?>
    </div>

    <!-- Sessions + Events Charts -->
    <div class="chart-grid">
        <div class="chart-box">
            <h3>Daily Unique Sessions — 14 days</h3>
            <canvas id="chartSessions"></canvas>
        </div>
        <div class="chart-box">
            <h3>Top Events — 7 days</h3>
            <canvas id="chartEvents"></canvas>
        </div>
    </div>

    <!-- Calendar Heatmap -->
    <div class="section-title section-gap">Activity Calendar — 365 days</div>
    <div class="chart-box" style="margin-bottom:24px;padding:16px 20px">
        <div class="cal-months" id="calMonths"></div>
        <div style="display:flex">
            <div class="cal-days">
                <div class="cal-day-label"></div>
                <div class="cal-day-label">Mon</div>
                <div class="cal-day-label"></div>
                <div class="cal-day-label">Wed</div>
                <div class="cal-day-label"></div>
                <div class="cal-day-label">Fri</div>
                <div class="cal-day-label"></div>
            </div>
            <div class="cal-wrap">
                <div class="cal-grid" id="calGrid"></div>
            </div>
        </div>
        <div class="cal-legend">
            <span>Less</span>
            <div class="cal-legend-cells">
                <div class="cal-legend-cell" style="background:#111"></div>
                <div class="cal-legend-cell" style="background:#003300"></div>
                <div class="cal-legend-cell" style="background:#006600"></div>
                <div class="cal-legend-cell" style="background:#00aa00"></div>
                <div class="cal-legend-cell" style="background:#00ff00"></div>
            </div>
            <span>More</span>
        </div>
    </div>

    <!-- World Map + Country List -->
    <div class="section-title">Visitors by Country — 30 days</div>
    <div class="chart-grid-3" style="margin-bottom:24px">
        <div class="chart-box">
            <h3>World Map</h3>
            <div id="worldMap"></div>
        </div>
        <div class="chart-box">
            <h3>Top Countries</h3>
            <?php if (empty($country_data)): ?>
            <div style="color:#333;font-size:10px;padding:20px 0;text-align:center">No country data yet<br><span style="font-size:9px">(requires Cloudflare or GeoIP)</span></div>
            <?php else:
                $max_sess = max(array_column($country_data,'sessions'));
            ?>
            <ul class="country-list">
            <?php foreach ($country_data as $c):
                $cc  = strtoupper($c['country_code']);
                $name = $country_names[$cc] ?? $cc;
                $pct  = $max_sess > 0 ? round($c['sessions']/$max_sess*100) : 0;
                // Flag emoji from country code
                $flag = mb_convert_encoding(
                    '&#' . (0x1F1E6 + ord($cc[0]) - ord('A')) . ';&#' . (0x1F1E6 + ord($cc[1]) - ord('A')) . ';',
                    'UTF-8', 'HTML-ENTITIES'
                );
            ?>
            <li class="country-row">
                <span class="country-flag"><?= $flag ?></span>
                <span class="country-name" title="<?= htmlspecialchars($name) ?>"><?= htmlspecialchars($name) ?></span>
                <div class="country-bar-wrap"><div class="country-bar" style="width:<?= $pct ?>%"></div></div>
                <span class="country-count"><?= $c['sessions'] ?></span>
            </li>
            <?php endforeach; ?>
            </ul>
            <?php endif; ?>
        </div>
    </div>

    <!-- Top Events Table -->
    <div class="section-title">Top Events (7 days)</div>
    <?php if (empty($top_events)): ?>
    <div class="no-data">No events recorded yet</div>
    <?php else: ?>
    <div class="tbl-wrap">
        <table>
            <thead><tr><th>Event</th><th>Count</th><th>Bar</th></tr></thead>
            <tbody>
            <?php
            $max_n = max(array_column($top_events,'n'));
            foreach ($top_events as $ev):
                $pct = $max_n > 0 ? round($ev['n']/$max_n*100) : 0;
            ?>
            <tr>
                <td class="mono"><?= htmlspecialchars($ev['event_name']) ?></td>
                <td style="color:#00ff00;font-weight:700"><?= $ev['n'] ?></td>
                <td style="width:200px">
                    <div style="background:#003300;height:6px;width:<?= $pct ?>%;min-width:2px;box-shadow:0 0 6px rgba(0,255,0,.5)"></div>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
</div>

<!-- ═══════════════════════════════════════════════════════════
     TAB: EVENTS
══════════════════════════════════════════════════════════════ -->
<div class="tab-pane" id="tab-events">
    <div class="filter-bar">
        <label>Filter:</label>
        <form method="GET" style="display:flex;gap:8px;align-items:center">
            <input type="hidden" name="tab" value="events">
            <select name="ev" onchange="this.form.submit()">
                <option value="">All events</option>
                <?php foreach ($event_names as $en): ?>
                <option value="<?= htmlspecialchars($en['event_name']) ?>"
                    <?= $events_filter === $en['event_name'] ? 'selected' : '' ?>>
                    <?= htmlspecialchars($en['event_name']) ?>
                </option>
                <?php endforeach; ?>
            </select>
            <?php if ($events_filter): ?>
            <a href="?tab=events" class="clear-link">✕ Clear</a>
            <?php endif; ?>
        </form>
        <span style="font-size:9px;color:#333">(last 100)</span>
    </div>
    <?php if (empty($recent_events)): ?>
    <div class="no-data">No events recorded yet</div>
    <?php else: ?>
    <div class="tbl-wrap">
        <table>
            <thead><tr><th>Time</th><th>Session</th><th>Event</th><th>Country</th><th>Payload</th></tr></thead>
            <tbody>
            <?php foreach ($recent_events as $ev): ?>
            <tr>
                <td style="white-space:nowrap;color:#555"><?= fmt_dt($ev['created_at']) ?></td>
                <td class="mono" style="color:#444"><?= short_id($ev['session_id']) ?></td>
                <td><span class="tag tag-green"><?= htmlspecialchars($ev['event_name']) ?></span></td>
                <td style="font-size:11px;color:#555"><?= htmlspecialchars($ev['country_code'] ?? '—') ?></td>
                <td class="mono" style="color:#555;font-size:10px;max-width:300px;word-break:break-all">
                    <?= $ev['payload'] ? htmlspecialchars($ev['payload']) : '<span class="none">—</span>' ?>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
</div>

<!-- ═══════════════════════════════════════════════════════════
     TAB: ERRORS
══════════════════════════════════════════════════════════════ -->
<div class="tab-pane" id="tab-errors">
    <?php if (empty($recent_errors)): ?>
    <div class="no-data" style="color:#00ff00">✓ No errors recorded — all clear!</div>
    <?php else: ?>
    <div class="tbl-wrap">
        <table>
            <thead><tr><th>Time</th><th>Session</th><th>Message</th><th>Location</th><th>User Agent</th></tr></thead>
            <tbody>
            <?php foreach ($recent_errors as $err): ?>
            <tr>
                <td style="white-space:nowrap;color:#555"><?= fmt_dt($err['created_at']) ?></td>
                <td class="mono" style="color:#444"><?= short_id($err['session_id']) ?></td>
                <td style="color:#ff6688;max-width:280px;word-break:break-word;font-size:11px">
                    <?= htmlspecialchars($err['message'] ?? '—') ?>
                </td>
                <td class="mono" style="white-space:nowrap;font-size:10px;color:#555">
                    <?php if ($err['url']): ?>
                    <?= htmlspecialchars(basename($err['url'])) ?>:<?= (int)$err['line'] ?>:<?= (int)$err['col'] ?>
                    <?php else: ?><span class="none">—</span><?php endif; ?>
                </td>
                <td style="max-width:220px;word-break:break-word;font-size:10px;color:#444">
                    <?= htmlspecialchars(substr($err['user_agent'] ?? '', 0, 80)) ?>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
</div>

<!-- ═══════════════════════════════════════════════════════════
     TAB: FEEDBACK
══════════════════════════════════════════════════════════════ -->
<div class="tab-pane" id="tab-feedback">
    <?php if ($avg_rating): ?>
    <div style="margin-bottom:16px;font-size:11px;color:#009900;letter-spacing:1px">
        Average rating: <strong style="color:#ffcc00;font-size:18px"><?= $avg_rating ?>/5</strong>
        &nbsp;·&nbsp; <?= (int)$feedback_total ?> total submissions
    </div>
    <?php endif; ?>
    <?php if (empty($recent_feedback)): ?>
    <div class="no-data">No feedback submitted yet</div>
    <?php else: ?>
    <div class="tbl-wrap">
        <table>
            <thead><tr><th>Time</th><th>Type</th><th>Rating</th><th>Message</th><th>Browser</th></tr></thead>
            <tbody>
            <?php foreach ($recent_feedback as $fb):
                $type_cls = match($fb['type']) {
                    'bug_report' => 'tag-red', 'suggestion' => 'tag-blue', default => 'tag-yellow'
                };
                $stars = $fb['rating']
                    ? str_repeat('★',(int)$fb['rating']) . str_repeat('☆',5-(int)$fb['rating'])
                    : null;
            ?>
            <tr>
                <td style="white-space:nowrap;color:#555"><?= fmt_dt($fb['created_at']) ?></td>
                <td><span class="tag <?= $type_cls ?>"><?= htmlspecialchars($fb['type']) ?></span></td>
                <td><?= $stars ? "<span class='stars'>{$stars}</span>" : '<span class="none">—</span>' ?></td>
                <td class="fb-message"><?= htmlspecialchars($fb['message'] ?? '') ?: '<span class="none">—</span>' ?></td>
                <td style="max-width:180px;word-break:break-word;font-size:10px;color:#444">
                    <?= htmlspecialchars(substr($fb['browser_info'] ?? '', 0, 60)) ?: '<span class="none">—</span>' ?>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
</div>

<!-- ── Scripts ──────────────────────────────────────────────── -->
<script>
// Tab switching
function showTab(name, btn) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    btn.classList.add('active');
}

// Chart.js defaults
Chart.defaults.color = '#009900';
Chart.defaults.font.family = "'Source Sans Pro', sans-serif";
Chart.defaults.font.size = 10;

const GREEN      = '#00ff00';
const GREEN_GLOW = 'rgba(0,255,0,0.15)';
const GREEN_DIM  = 'rgba(0,255,0,0.6)';

// Daily sessions line chart
new Chart(document.getElementById('chartSessions'), {
    type: 'line',
    data: {
        labels: <?= json_encode($chart_days) ?>,
        datasets: [{
            data: <?= json_encode($chart_sess) ?>,
            borderColor: GREEN, backgroundColor: GREEN_GLOW,
            borderWidth: 2, pointBackgroundColor: GREEN,
            pointRadius: 3, fill: true, tension: 0.3,
        }]
    },
    options: {
        responsive: true, plugins: { legend: { display: false } },
        scales: {
            x: { grid: { color: '#111' }, ticks: { color: '#009900' } },
            y: { grid: { color: '#111' }, ticks: { color: '#009900' }, beginAtZero: true }
        }
    }
});

// Top events bar chart
new Chart(document.getElementById('chartEvents'), {
    type: 'bar',
    data: {
        labels: <?= json_encode($chart_ev_labels) ?>,
        datasets: [{
            data: <?= json_encode($chart_ev_data) ?>,
            backgroundColor: GREEN_DIM, borderColor: GREEN, borderWidth: 1,
        }]
    },
    options: {
        indexAxis: 'y', responsive: true, plugins: { legend: { display: false } },
        scales: {
            x: { grid: { color: '#111' }, ticks: { color: '#009900' }, beginAtZero: true },
            y: { grid: { color: '#0a0a0a' }, ticks: { color: '#009900', font: { size: 9 } } }
        }
    }
});

// ── Calendar Heatmap ─────────────────────────────────────────
(function() {
    const data = <?= json_encode($calendar_map) ?>;
    const grid   = document.getElementById('calGrid');
    const months = document.getElementById('calMonths');
    if (!grid) return;

    // Color scale
    function cellColor(n) {
        if (!n) return '#111';
        if (n === 1) return '#003300';
        if (n <= 3)  return '#006600';
        if (n <= 7)  return '#00aa00';
        return '#00ff00';
    }

    const today  = new Date();
    today.setHours(0,0,0,0);

    // Start from 364 days ago, then walk back to the previous Sunday/Monday
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    // Align to Monday (isoWeekday 1)
    const dayOfWeek = (start.getDay() + 6) % 7; // 0=Mon
    start.setDate(start.getDate() - dayOfWeek);

    const WEEK_CELL = 15; // cell + gap
    let weekIdx = 0;
    let col = null;
    let lastMonth = -1;

    const cur = new Date(start);
    while (cur <= today) {
        const dow = (cur.getDay() + 6) % 7; // 0=Mon
        if (dow === 0) {
            col = document.createElement('div');
            col.className = 'cal-col';
            grid.appendChild(col);
            weekIdx++;
        }
        const ds = cur.toISOString().slice(0,10);
        const n  = data[ds] || 0;
        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        cell.style.background = cellColor(n);
        cell.title = ds + ': ' + n + ' session' + (n !== 1 ? 's' : '');
        col.appendChild(cell);

        // Month label
        const m = cur.getMonth();
        if (m !== lastMonth && dow === 0) {
            const lbl = document.createElement('span');
            lbl.className = 'cal-month-label';
            lbl.style.left = ((weekIdx - 1) * WEEK_CELL + 22) + 'px';
            lbl.textContent = cur.toLocaleString('en',{month:'short'});
            months.appendChild(lbl);
            lastMonth = m;
        }

        cur.setDate(cur.getDate() + 1);
    }
})();

// ── World Map ────────────────────────────────────────────────
(function() {
    const el = document.getElementById('worldMap');
    if (!el || typeof jsVectorMap === 'undefined') return;

    const values = <?= json_encode($map_values) ?>;

    new jsVectorMap({
        selector: '#worldMap',
        map: 'world',
        backgroundColor: '#000',
        zoomOnScroll: false,
        regionStyle: {
            initial: { fill: '#111', stroke: '#222', strokeWidth: 0.3 },
            hover:   { fill: '#003300', stroke: '#00ff00', strokeWidth: 0.5, cursor: 'pointer' },
        },
        labels: { markers: { render: () => '' } },
        series: {
            regions: [{
                values,
                scale: ['#002200', '#00ff00'],
                normalizeFunction: 'polynomial',
                attribute: 'fill',
            }]
        },
        onRegionTooltipShow(event, tooltip, code) {
            const n = values[code] || 0;
            tooltip.text(
                tooltip.text() + (n ? ' — <strong>' + n + ' session' + (n !== 1 ? 's' : '') + '</strong>' : ''),
                true
            );
        },
    });
})();
</script>
</body>
</html>
