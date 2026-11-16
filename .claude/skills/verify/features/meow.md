# Meow

Each click plays `public/Augustine St.m4a` through Web Audio, one new sound per click.

## Sub-features

- The file is fetched and decoded once at page load.
- At load the page finds the first loud sample and the peak. Each click plays from 50ms before that point through a gain that puts the peak near full volume. The current recording is 3.5s of near-silence with a meow peaking at 3.7% of full scale, so without this a click is silent.
- A suspended AudioContext is resumed inside the click.

## How to get to it (user POV)

Click the cat with sound on.

## Driving it with drive.mjs

The driver taps every connection to the audio destination with an AnalyserNode. After one click, the signal reaching the speakers must pass 0.2 of full scale within 300ms. It also counts one source start per click and decodes the file.

## Gotchas

- The tap measures the signal sent to the speakers, not the room. Device volume and a muted tab are outside what it can see.
- A file that decodes and starts can still be inaudible. Before the loudness check existed, a 3.5s silent lead-in passed every audio check.
