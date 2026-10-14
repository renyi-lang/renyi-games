# Sokoban

The warehouse puzzle, written in Renyi over `std.screen`: push every
crate onto a target. The player pushes one crate at a time and never
pulls, so a crate in a corner stays there. Five original levels, from
a warm-up of six moves to one of 145.

## Keys

| Key | Browser | Console (`renyi run`) | Action |
|-----|---------|-----------------------|--------|
| forward | Up, W | `w` | step up |
| backward | Down, S | `s` | step down |
| turn left | Left, A | `a` | step left |
| turn right | Right, D | `d` | step right |
| fire | Space, F | `f` | undo the last move; held for a second, restart the level; on the title or the end screen, start |
| quit | Escape, Q | `q` | end the program |

A direction steps once per press, and again every 200 milliseconds
while it is held. A solved level stays on screen for a second, then
the next one starts. The console host reads one line per frame, whose
letters are the keys held during that frame; an empty line is a frame
with nothing held.

## Commands

```
renyi run sokoban.ry play            # at the host's screen, from the title
renyi run sokoban.ry demo            # levels 1 and 2 solved by script, every 10th frame as text
renyi run sokoban.ry steps R2 F1     # a script of moves; prints the final summary line
renyi run sokoban.ry                 # the first frame of level 1 as text
renyi test sokoban.ry                # every example and test, the five solutions among them
```

A script move is a key letter and a frame count: `F` up, `B` down,
`L` left, `R` right, `S` fire, `Q` quit, `W` wait; `R2` holds right
for two frames of 50 milliseconds. The demo's last line is in
`demo.expected`:

```
sokoban: level 3, moves 5, pushes 0, frames 130
```

## Levels

`levels.ry` holds each level as text rows in the usual notation, at
most 16 by 12 cells:

| Symbol | Cell |
|--------|------|
| `#` | wall |
| ` ` | floor (outside the walls it is not drawn) |
| `.` | target |
| `$` | crate |
| `*` | crate on a target |
| `@` | player |
| `+` | player on a target |

Each level carries a solution as a move string, `u d l r` with a push
in upper case; a test per level plays it and checks that every step is
legal and the level ends solved. The levels were made for this game
and their solutions found by a breadth-first search over pushes.

## Modules

| File | Content |
|------|---------|
| `levels.ry` | the five levels and their solutions |
| `game.ry` | the state and the rules: parsing a level, a move, undo, restart, the key timers, `step`, and the tests |
| `view.ry` | `render`: the board centred with cells of 12 pixels, the level, moves and pushes as labels, the title and end screens |
| `text_view.ry` | a frame of rectangles and labels as 53 by 16 characters, two characters to a cell |
| `sokoban.ry` | `main` and its modes, the script notation, the summary line |

## Design

Every frame is a pure function: `game.step(state, input)` returns the
next `State`, and `view.render(state)` returns its `List of Shape`;
there is no randomness and no clock, the time coming only from the
input's `elapsed_ms`. Undo is a history of positions: every move pushes
the position it left, and fire pops one. The text frames sample the
same shapes the screen draws, each colour mapped to its level symbol,
so the demo and the tests read the board as the level format writes it.
