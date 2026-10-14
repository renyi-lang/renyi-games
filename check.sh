#!/bin/sh
# The gate of every game, run by CI and by hand: `sh check.sh [<renyi binary>]`.
# Each game directory holds `<name>.ry` as its main file; it must check
# clean under `--strict`, be in canonical layout, pass its examples and
# tests, and its demo must end with the line of `demo.expected`.
set -e
RENYI="${1:-renyi}"
export RENYI_NO_CACHE=1
status=0
for game in snake blocks sokoban mines; do
  echo "== $game"
  (cd "$game" && "$RENYI" check --strict ./*.ry && "$RENYI" format --check ./*.ry && "$RENYI" test "$game.ry")
  last=$(cd "$game" && "$RENYI" run "$game.ry" demo | tail -n 1)
  expected=$(cat "$game/demo.expected")
  if [ "$last" = "$expected" ]; then
    echo "demo: $last"
  else
    echo "demo differs: got '$last', expected '$expected'"
    status=1
  fi
done
exit $status
