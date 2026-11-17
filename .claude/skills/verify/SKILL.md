---
name: verify
description: Launch the Cheddar web app (ASP.NET Core host + Blazor WebAssembly page at http://localhost:5080) and drive it in headless Chrome to prove the head-only sniff, the meow, and the session and all-time counters work. Use after any change to the page, its CSS or JS, the Counting module, or the host, and before calling such a change done.
---

# Verify Cheddar

Cheddar is one web page. A user clicks the cat; pressing reaches the head toward the viewer into the sniff pose and plays a meow, holding freezes it there, and releasing settles it back and counts once on both counters. The proof is `scripts/drive.mjs`, a dependency-free Node script that drives system Google Chrome over the DevTools protocol.

## Launch

From the repo root:

```bash
dotnet run --project src/Cheddar.Host
```

Run it as a background process and note its PID. Ready means the log prints `Now listening on: http://localhost:5080`. The first build takes up to a minute. The page itself is interactive only after the WebAssembly runtime loads; the driver waits for `document.documentElement.dataset.cheddarReady === 'true'`.

By default the all-time count lives in `src/Cheddar.Host/App_Data/global-count.json` (gitignored). Verification clicks add to this local count. Delete that file before launch for a count that starts at 0. Never run two hosts from one checkout in file mode: each caches the count in memory and they would overwrite each other's file.

To run against Redis instead, as production does:

```bash
docker run -d --rm -p 6379:6379 --name cheddar-redis redis:7-alpine
Counting__Redis=localhost:6379 dotnet run --project src/Cheddar.Host
```

`GET /healthz` reports `"counter":"redis"` or `"file"`. Stop Redis with `docker rm -f cheddar-redis`.

## Doctor

```bash
lsof -ti tcp:5080          # must print the PID you started, nothing else
curl -sf localhost:5080/api/counts/global   # {"count":<n>}
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' localhost:5080/assets/cat_normal.JPG   # 200 image/jpeg
```

If port 5080 belongs to a process you did not start, stop and report it. Do not kill it.

## Drive

```bash
node .claude/skills/verify/scripts/drive.mjs --url http://localhost:5080/ --out .verify-evidence
```

It runs every journey in [features/](features/README.md), prints one `PASS`/`FAIL` line per check, and exits 1 if any check fails. Options: `--url`, `--out`, `--port` (DevTools port, default 9333). Set `CHROME` to use a different Chrome binary. With `CI` set, Chrome gets `--no-sandbox`.

The driver depends on these page hooks. Keep them when changing the markup:

- `button.cheddar` is the cat; `button.cheddar img.base` is the normal photo; `.head` is the sniff layer.
- `#session-count` and `#global-count` hold bare digits.
- `dataset.cheddarReady = 'true'` on `<html>` once handlers are live and the first counts loaded.
- The sniff runs as Web Animations on `.head` (opacity) and `.head img` (transform). Holding the press freezes it at the peak, so the driver screenshots the peak by holding the mouse down.

## Evidence

The `--out` directory gets `at-rest.png`, `held-sniff.png`, `held-matte.png` (the head cut-out in white), `after-clicks.png`, and `results.json`. A proof shows both screenshots plus the check lines. Read the screenshots yourself: the checks measure pixels and geometry, and a broken page once passed every pixel check before the frame-fit check existed.

What each check proves is in the feature files. The sniff is proven by a real mouse press through CDP, not by adding the CSS class. Audio is proven by decoding the real file in the page; headless Chrome cannot prove you heard it.

## Cleanup

Kill the host by the PID you noted (`kill <pid>`), then confirm `lsof -ti tcp:5080` prints nothing. The driver quits the Chrome instances it started and deletes their temp profile. Keep `.verify-evidence/` (gitignored); it is the proof.
