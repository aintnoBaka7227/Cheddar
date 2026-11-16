# Session and all-time counters

## Sub-features

- Session count. A browser-session cookie `cheddar_session` with no expiry. Survives reload and tab close, resets when the browser quits.
- All-time count. One shared total in `App_Data/global-count.json`, served by `GET /api/counts/global` and `POST /api/counts/global/increment`.

## How to get to it (user POV)

The numbers under the cat, labelled "This session" and "All time".

## Driving it with drive.mjs

Five clicks must add exactly 5 to the session count and at least 5 to the all-time count. Both must hold across a reload. A second Chrome with a fresh profile stands in for a restarted browser: its session count must be 0 and its all-time count at least the previous value.

## Gotchas

- The fresh-profile check proves a new browser session. It does not prove what a real browser does on quit when "continue where you left off" restores session cookies.
- To prove the all-time count survives a server restart, note the count, restart the host, and rerun the driver. The first number it reports must not be lower.
