# Session and all-time counters

## Sub-features

- Session count. A browser-session cookie `cheddar_session` with no expiry. Survives reload and tab close, resets when the browser quits.
- All-time count. One shared total, served by `GET /api/counts/global` and `POST /api/counts/global/increment`. It lives in Redis (key `cheddar:global-count`) when `Counting:Redis` is set, else in `App_Data/global-count.json`.

## How to get to it (user POV)

The numbers under the cat, labelled "This session" and "All time".

## Driving it with drive.mjs

Five clicks must add exactly 5 to the session count and at least 5 to the all-time count. Both must hold across a reload. Further checks:

- A cookie value written as another tab would (`cheddar_session=N+10`) plus one click must give N+11, so tabs add up instead of overwriting each other.
- Holding Enter or Space (one press plus three auto-repeats) counts once each.
- A bare `element.click()` (detail 0), as assistive tech sends, counts once.
- With the increment POST failed through the DevTools Fetch domain, the shown all-time count must equal the server's count.
- With the initial count GET failed, the all-time count must show "–", never 0. A 0 there once made a broken Redis connection look like a reset.
- Chrome is quit with `Browser.close` and relaunched on the same profile. The session count must be 0 and the all-time count at least the previous value. A graceful quit matters. A killed Chrome loses persistent cookies too, which would hide a cookie that wrongly never expires.

## Gotchas

- The relaunch check proves a plain quit. It does not prove what a browser does when "continue where you left off" restores session cookies.
- To prove the all-time count survives a server restart, note the count, restart the host, and rerun the driver. The first number it reports must not be lower.
