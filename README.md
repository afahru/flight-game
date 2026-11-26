# Kancil Air: Merapi Run

[![make.fun bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![make.fun rank](https://make.fun/badge/best-flight-game-20261126-0057/afahru/flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![make.fun reward](https://make.fun/badge/best-flight-game-20261126-0057/afahru/flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A chase-view flight game that plays offline in a desktop browser. Fly the mail plane through six rings over an island, then land on the Merapi strip. Built for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057).

## How to play

- Arrows steer (bank and pitch), W/S throttle, mouse steers while moving.
- Space starts, P pauses, click confirms.
- Fly through all six rings, then land on the strip. Rings give 100 points and 3 fuel.
- Fuel drains with throttle, so full throttle the whole way runs dry. Empty fuel means an engine-out glide, and a dead-stick landing still counts.
- Landings are judged on strip position, speed, vertical speed and heading, with a named reason for each crash.

## Run it

Serve the folder with any static server and open `game/index.html`, for example:

```
python3 -m http.server 8000
```

Then open http://localhost:8000/game/index.html

No build step, no network request, no library. All source is under `game/`.

## Entry

- Competition: best-flight-game-20261126-0057 (Make the best flight game)
- Program: `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.

Built with Muse. Referral: https://make.fun/r/ff542mb1
