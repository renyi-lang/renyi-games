# Blocks

A falling-blocks game written in [Renyi](https://renyi-lang.org): the seven
tetrominoes fall into a well of 10 by 20 cells; slide and turn them to fill
rows, and a full row clears. Every ten rows cleared raise the level, and each
level makes the pieces fall faster (800 ms a row at level 1, 70 ms less per
level, never under 100 ms). The game ends when a new piece cannot be placed.

The frame is drawn on `std.screen`'s logical screen of 320 by 200 pixels as
rectangles and labels: the well in the middle in cells of 9 pixels, the next
piece, the score, the lines and the level on its right, the keys on its left.

## Keys

| Key (browser) | Console letter | Action |
|---------------|----------------|--------|
| Left, A       | `a` | slide left (once per press; held, it repeats after 150 ms) |
| Right, D      | `d` | slide right (likewise) |
| Up, W         | `w` | turn clockwise, kicking one cell left or right against a wall |
| Down, S       | `s` | soft drop: one row per frame while held, one point a row |
| Space, F      | `f` | hard drop: to the bottom at once, two points a row; on the title or after the end, a new game |
| Escape, Q     | `q` | quit |

A cleared row scores 100, two 300, three 500 and four 800, times the level.

## Commands

```
renyi run blocks.ry play [seed]     # play at the host's screen, from the title
renyi run blocks.ry demo            # a scripted game: every 10th frame as text, then the summary
renyi run blocks.ry steps L3 F1 S1  # play a script and print the final summary line
renyi run blocks.ry                 # the first frame as text
renyi test blocks.ry                # every example and test of every module
```

`renyi run` draws the frame as text in the terminal and reads one line per
frame whose letters are the keys held (`w s a d f q`); a key typed on two
lines in a row counts as held, so it acts once. In the browser the page holds
real keys.

A script is a list of moves, each a key letter and a frame count of 50 ms
frames: `F` turn, `B` soft drop, `L` left, `R` right, `S` hard drop, `Q` quit,
`W` wait. `L3` holds left for three frames (one slide); `L1 W1 L1` presses it
twice. The demo's last line is in `demo.expected`:

```
blocks: score 596, lines 3, level 1, frames 131
```

## Reproducible runs

The order of the pieces comes from a linear congruential generator written in
the program (`game.next_seed`: `seed * 1103515245 + 12345` modulo 2^31, the
kind from the upper bits). `play` takes the seed as its argument, 1 by
default; the same seed and the same keys give the same game, frame for frame.
The program uses neither `std.random` nor `std.time`: the only clock is each
frame's `elapsed_ms`.

## Design

Every frame is a pure function: `game.step(state, input)` returns the next
state and `view.render(state)` its list of shapes; only `main` touches the
screen, the console and the arguments. The tests drive `step` with scripted
inputs and read frames through `text_view`, which samples the shapes into a
grid of 35 by 22 characters, one per cell of the well, a piece's cells drawn
with its letter (`I O T S Z J L`).

| Module | Content |
|--------|---------|
| `pieces.ry` | the seven kinds, their cells in each rotation, colours, letters and codes |
| `well.ry` | the well as a list of codes: what fits, filling cells, clearing full rows |
| `game.ry` | the state, the generator, `new_game`, `title`, `step` and the rules, with their tests |
| `view.ry` | the frame as `std.screen` shapes |
| `text_view.ry` | the frame as text |
| `blocks.ry` | `main`: the modes, the script notation, the demo |
