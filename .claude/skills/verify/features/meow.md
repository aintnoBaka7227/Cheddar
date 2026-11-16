# Meow

Each click plays `public/Augustine St.m4a` through Web Audio, one new sound per click.

## Sub-features

- The file is fetched and decoded once at page load.
- A suspended AudioContext is resumed inside the click.

## How to get to it (user POV)

Click the cat with sound on.

## Driving it with drive.mjs

The driver fetches `/assets/Augustine%20St.m4a` in the page and decodes it. Success is a duration above 0 (4.71s today).

## Gotchas

- Headless Chrome proves the file serves as `audio/mp4` and decodes. It cannot prove audible playback. For that, a human clicks once in a real browser.
- The clip is 4.7s long, so fast clicks overlap meows.
