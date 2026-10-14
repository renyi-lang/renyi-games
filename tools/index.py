"""Write each game's file index and copy the games beside the page.

A game is a directory of the repository holding `<name>.ry`, where
`<name>` is the directory's own name: that file is the game's main file
and the other `.ry` files beside it are its modules. For every game this
script writes `<game>/index.json`, the list of the game's file names with
the main file first and the rest sorted, which `site/games.js` reads to
know what to hand to the toolchain's module; then it copies the game's
`.ry` files and the index into `site/<game>/`, so that the site directory
can be served as it is. A game removed since the last run leaves its copy
in `site/` until it is deleted by hand.

    python tools/index.py <repository root>
"""

import json
import shutil
import sys
from pathlib import Path


def games(root):
    """The game directories of the repository, by name."""
    found = []
    for directory in sorted(root.iterdir()):
        if not directory.is_dir() or directory.name in ("site", "tools"):
            continue
        if (directory / f"{directory.name}.ry").is_file():
            found.append(directory)
    return found


def index(directory):
    """The game's files: the main file first, then its modules sorted."""
    main = f"{directory.name}.ry"
    modules = sorted(p.name for p in directory.glob("*.ry") if p.name != main)
    return [main] + modules


def main(arguments):
    if len(arguments) != 1:
        print("usage: python tools/index.py <repository root>", file=sys.stderr)
        return 64
    root = Path(arguments[0]).resolve()
    site = root / "site"
    for directory in games(root):
        names = index(directory)
        text = json.dumps(names, indent=2) + "\n"
        # Written with "\n" line ends on every system, so that the index
        # reads the same on Windows and in CI.
        (directory / "index.json").write_bytes(text.encode("utf-8"))
        target = site / directory.name
        target.mkdir(parents=True, exist_ok=True)
        # The old copies go first, so that a module renamed or removed
        # does not linger beside the page.
        for old in target.glob("*.ry"):
            old.unlink()
        for name in names:
            shutil.copyfile(directory / name, target / name)
        shutil.copyfile(directory / "index.json", target / "index.json")
        print(f"{directory.name}: {len(names)} files")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
