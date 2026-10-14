# Snake

The classic game, written in Renyi over `std.screen`. A snake crawls
around a field of 32 by 18 cells under a status line; it eats the food,
grows by one cell and speeds up with every point, and dies on the wall
or on itself. The status line shows the score, the snake's length and
the best length so far.

## Keys

| Key (browser) | Console letter | Action |
|---------------|----------------|--------|
| forward (up) | `w` | turn up |
| backward (down) | `s` | turn down |
| turn left | `a` | turn left |
| turn right | `d` | turn right |
| fire | `f` | start from the title, play again after a death |
| quit | `q` | end the program |

A turn straight back onto the snake's neck is ignored. The console host
of `renyi run` reads one line per frame; the letters on the line are the
keys held during that frame.

## Commands

```
renyi run snake.ry                    # the title screen as text
renyi run snake.ry play [seed]        # play at the host's screen
renyi run snake.ry demo [seed]        # the pilot plays 600 frames; every 10th frame as text
renyi run snake.ry steps R5 F3 L3     # a script of moves from a new game; the final frame
renyi test snake.ry                   # every example and test of every module
```

A script move is a letter and a frame count: `F` forward (up), `B`
backward (down), `L` left, `R` right, `S` fire, `Q` quit, `W` wait; `R5`
holds right for five frames of 50 milliseconds. The last line of a demo
or a script is the summary, `snake: score 12, length 15, frames 600` for
the demo with seed 1 (`demo.expected`).

## The seed

Food is placed by a linear congruential generator written in the
program (`board.next_seed`, C's `rand` constants modulo 2^31), never by
`std.random`: each draw advances the seed and picks one of the free
cells, so food never lands on the snake. The seed is an argument
(default 1), and the game reads no clock either: the snake moves by the
milliseconds each frame's input reports. The same seed and the same
inputs give the same game, frame for frame.

## Design

`game.step(state, input)` is a pure function from one frame's state and
input to the next; `view.render(state)` turns a state into a list of
rectangles and labels. `text_view` samples such a frame into a grid of
characters, one per cell, which the tests, the demo and the `steps`
mode print. Modules: `board.ry` (cells, directions, the generator),
`game.ry` (the state and the rules), `keys.ry` (scripted inputs),
`pilot.ry` (the demo's driver), `view.ry`, `text_view.ry`, and
`snake.ry` (`main`).
