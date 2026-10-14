# Renyi games

Four small games written in [Renyi](https://renyi-lang.org), the scripting
language of AI agents, each a few hundred lines over the library's
`std.screen`: the program hands every frame to the host as a list of
shapes and gets the keys held back. The same program plays at the
terminal under `renyi run`, where the frames are drawn as text, and in
the browser, where the page is the host and the Renyi toolchain built for
WebAssembly checks, compiles and runs it: [play them here](https://renyi-lang.github.io/renyi-games/).

| Game | Directory | What it is |
|------|-----------|------------|
| Snake | [`snake/`](snake/) | the snake eats, grows and speeds up on a field of 32 by 18 cells |
| Blocks | [`blocks/`](blocks/) | the seven falling pieces in a well of 10 by 20, rotation with a wall kick, line clears and levels |
| Sokoban | [`sokoban/`](sokoban/) | five original levels of crates pushed onto targets, with undo |
| Mines | [`mines/`](mines/) | a field of 16 by 12 cells with 20 mines, a safe first reveal, a flood from every zero |

Every game follows the showcase game of the main repository: every
frame is a pure function of the state and the input (`step(state,
input)` and `render(state)`), there is no randomness outside the
program (a small generator seeded by an argument, so that a run is
reproducible), and every module carries examples and tests. Each
directory's README gives the keys and the commands; the common ones are

```
renyi run <game>/<game>.ry play        # at the terminal: w s a d f q, enter per frame
renyi run <game>/<game>.ry             # the first frame as text
renyi run <game>/<game>.ry demo        # a scripted game, every 10th frame as text
renyi run <game>/<game>.ry steps F3 R1 # a script of moves, the final frame and a summary
renyi test <game>/<game>.ry            # every example and test of every module
```

The keys are the six fields of `std.screen`'s `Input`: `forward` and
`backward` (W and S, or the up and down arrows), `turn_left` and
`turn_right` (A and D, or the left and right arrows), `fire` (F or
Space) and `quit` (Q or Escape). Each game says what it does with them.
In the browser a key is read as held during a frame, so hold it for a
moment; a tap shorter than a frame is lost.

## The gate

`sh check.sh [<renyi binary>]` runs what CI runs on every push: every
game checks clean under `renyi check --strict`, is in the formatter's
canonical layout, passes `renyi test`, and its demo ends with the line of
its `demo.expected`. CI installs the released toolchain through the main
repository's `install.sh`.

## The page

`site/` is the page: `index.html` and `games.js` load the toolchain's
module from the main site and a game's sources from the page's own
directory, and drive the frame loop as the main site's game page does.
`python tools/index.py .` writes each game's `index.json` (its files, the
main one first) and copies the sources under `site/<game>/`, which is
what GitHub Pages serves.

The games were written by Claude Code subagents from the language's
skill file, the cheat sheet and the showcase game, and reviewed in
sessions with the owner; see the main repository's
`docs/design/01-decisions.md`, decision AW45, for the record.

## License

Apache 2.0, as the main repository.
