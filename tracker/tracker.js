// GB Tile Swapper — Client-side Tracker
// Fire-and-forget — never blocks the UI, never throws.
// Exposes: window.GbtsTracker.trackEvent(name, payload?)
//          window.GbtsTracker.trackError(data)
//          window.GbtsTracker.sessionId

(function () {
    const BASE = '/tracker/';

    // UUID v4 — one per page load, never stored
    function uuid4() {
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function (c) {
            return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
        });
    }

    const SESSION_ID = uuid4();

    function post(endpoint, body) {
        try {
            fetch(BASE + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                keepalive: true
            }).catch(function () {}); // silent network fail
        } catch (e) {}
    }

    function trackEvent(name, payload) {
        post('event.php', {
            session_id: SESSION_ID,
            event_name: name,
            payload: payload || null
        });
    }

    function trackError(data) {
        post('error.php', Object.assign({ session_id: SESSION_ID }, data));
    }

    // ── Auto-capture JS errors ────────────────────────────────────────────────

    window.addEventListener('error', function (e) {
        trackError({
            message: e.message  || String(e),
            stack:   e.error && e.error.stack ? e.error.stack : null,
            url:     e.filename || null,
            line:    e.lineno   || null,
            col:     e.colno    || null
        });
    });

    window.addEventListener('unhandledrejection', function (e) {
        var reason = e.reason;
        trackError({
            message: reason instanceof Error ? reason.message : String(reason),
            stack:   reason instanceof Error && reason.stack ? reason.stack : null,
            url:     null,
            line:    null,
            col:     null
        });
    });

    // ── Page view ─────────────────────────────────────────────────────────────

    window.addEventListener('DOMContentLoaded', function () {
        trackEvent('page_view', {
            referrer: document.referrer || null,
            screen:   screen.width + 'x' + screen.height
        });
    });

    // ── Expose ────────────────────────────────────────────────────────────────

    window.GbtsTracker = { trackEvent: trackEvent, trackError: trackError, sessionId: SESSION_ID };

})();
