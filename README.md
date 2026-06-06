# levisworkspace

## Code Runner: Debug Quest

This repository now includes a small browser-based coding game. In **Code
Runner: Debug Quest**, players program Byte, a tiny release robot, by queuing
commands such as `move()`, `turnLeft()` and `fixBug()`. The goal is to patch
every bug on the grid and finish on the deploy portal.

The game includes:

- Three hand-authored levels with blockers, bugs and deploy targets.
- A command queue that feels like writing a tiny program.
- Animated program execution with crash, warning and success states.
- Responsive styling for desktop and mobile browsers.

The original America 250 quiz content remains in `content/` and `data/` as
reference material, but the playable demo in `demo/` is now the coding game.

## Run the game locally

From the repository root:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/demo/
```
