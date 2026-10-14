# Minesweeper

Minesweeper written in [Renyi](https://renyi-lang.org), drawn on the
logical screen of `std.screen` (320 by 200): a field of 16 by 12 cells
with 20 mines, a highlighted cursor, the mines left and the seconds
played above it. Reveal every cell without a mine to win; reveal a mine
and every mine is shown.

The mines are placed at the first reveal, never on the cell revealed, so
the first click is always safe. Revealing a cell with no mine around it
opens its neighbours, and theirs, until numbered cells bound the opening.

## Keys

| Key (console) | Input field | Does |
|---------------|-------------|------|
| `w` | `forward` | cursor up |
| `s` | `backward` | cursor down |
| `a` | `turn_left` | cursor left |
| `d` | `turn_right` | cursor right |
| `f` | `fire` | short press: reveal; long press: flag |
| `q` | `quit` | quit |

An arrow moves the cursor one cell when pressed and again every 150 ms
while it stays held.

Fire released within 400 ms reveals the cursor's cell (on the release).
Fire held for 400 ms flags the cell, or takes its flag away, at the
moment the 400 ms pass; the release that follows does nothing. A flagged
cell is not revealed, by a press or by an opening. On the title screen or
after a game has ended, a press of fire starts a new game.

## Commands

```
renyi run mines.ry play [seed]     # at the host's screen, from the title
renyi run mines.ry demo            # a scripted game, every 10th frame as text
renyi run mines.ry steps R3 B2 S1  # a script; prints the final summary line
renyi run mines.ry                 # the first frame as text
renyi test mines.ry                # every example and test of every module
```

`renyi run` is the console host: it draws each frame as text and reads a
line per frame whose letters are the keys held (`f` then an empty line is
a short press). In the browser the page is the host and holds real keys.

A script is a list of moves, each a key letter and a frame count: `F`
(up), `B` (down), `L` (left), `R` (right), `S` (fire), `Q` (quit) and `W`
(wait); `R3` holds right for three frames. A scripted frame lasts 160 ms,
past the repeat delay, so a held arrow moves the cursor every frame and
`S4` (640 ms) is a long press while `S1` to `S2` are short. A script ends
with one idle frame, which releases a key still held. `demo` and `steps`
play on seed 1; `demo.expected` holds the demo's last line, which CI can
compare.

## Seeds

The mines come from a linear congruential generator written in the
program (`field.next_seed`, the constants of C's `rand`), seeded by the
argument of `play` (1 by default). The same seed and the same keys give
the same field and the same game, every time; a new game after the end
continues from the generator's state, so it gets a new field.

## Design

`game.step(state, input)` is a pure function from one frame's state and
input to the next, and `view.render(state)` a pure function from a state
to the list of shapes; only `main` touches the screen, the console and
the arguments. No `std.random`, no `std.time`: the clock is the sum of the
frames' `elapsed_ms`. That makes every frame testable without a host:
the tests drive `step` with inputs, and `text_view` samples a frame into
characters for the demo and for reading a frame in a terminal.

| Module | Holds |
|--------|-------|
| `field.ry` | the cells, the generator, the placement, the flood |
| `game.ry` | the state, the keys' timing, the rules |
| `view.ry` | the shapes of the title and of the field |
| `text_view.ry` | a frame as text |
| `mines.ry` | `main`, the scripts, the summary line |
