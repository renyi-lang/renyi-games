// The page of the Renyi games. The Renyi toolchain's module for
// WebAssembly (crates/renyi_web of the Renyi repository, served by
// renyi-lang.org) checks and runs a program in the browser. A game is a
// directory of Renyi sources beside this page, its main file first in
// its index.json (tools/index.py writes both). Its files are handed to
// the module with the argument `play`, and the game runs at the page's
// screen: the program hands each frame to the page through
// screen.present and suspends, the page draws the shapes and resumes it
// with the keys held and the time elapsed. The games draw rectangles,
// labels and columns only and play no sounds. Nothing leaves the page
// but the request for the module. This is the frame loop of the main
// site's docs/assets/play.js, cut down to what these games use.

(() => {
  "use strict";

  const canvas = document.getElementById("screen");
  const startButton = document.getElementById("start");
  const statusLine = document.getElementById("status");
  const rate = document.getElementById("rate");
  const gameButtons = [...document.querySelectorAll("button[data-game]")];
  if (!canvas || !startButton || !statusLine || !rate) return;

  // The statuses of the module's C ABI (crates/renyi_web/src/lib.rs).
  const FINISHED = 0;
  const EXITED = 3;
  const SUSPENDED = 6;
  const ENDINGS = ["finished", "main failed", "crashed", "exited", "does not check",
    "refused: main needs what the page cannot serve", "suspended"];
  // The logical screen of std.screen, drawn at the canvas's scale.
  const WIDTH = 320;
  const HEIGHT = 200;
  const SCALE = canvas.width / WIDTH;
  // A frame after a pause (the tab in the background) counts as this long.
  const LONGEST_FRAME_MS = 100;
  // The module: the site's copy first, then one beside this page.
  const MODULES = ["https://renyi-lang.org/assets/renyi_web.wasm", "assets/renyi_web.wasm"];
  // The keys held, by the key of the event (a letter in lower case).
  const KEYS = {
    ArrowUp: "forward", w: "forward", ArrowDown: "backward", s: "backward",
    ArrowLeft: "turn_left", a: "turn_left", ArrowRight: "turn_right", d: "turn_right",
    " ": "fire", f: "fire", Escape: "quit", q: "quit",
  };
  const NAMES = { snake: "Snake", blocks: "Blocks", sokoban: "Sokoban", mines: "Mines" };
  const context = canvas.getContext("2d");

  // The module behind a few functions. Every text crosses as bytes in
  // the module's memory; a view is taken after each allocation, which
  // may grow the memory and detach earlier views.
  class Toolchain {
    constructor(instance) {
      this.exports = instance.exports;
      this.encoder = new TextEncoder();
      this.decoder = new TextDecoder();
    }

    put(text) {
      const bytes = this.encoder.encode(text);
      const pointer = this.exports.renyi_alloc(bytes.length);
      new Uint8Array(this.exports.memory.buffer, pointer, bytes.length).set(bytes);
      return [pointer, bytes.length];
    }

    call(name, text) {
      const [pointer, length] = this.put(text);
      const result = this.exports[name](pointer, length);
      this.exports.renyi_free(pointer, length);
      return result;
    }

    read(pointer, length) {
      return this.decoder.decode(new Uint8Array(this.exports.memory.buffer, pointer, length));
    }

    file(name, text) {
      const [namePointer, nameLength] = this.put(name);
      const [textPointer, textLength] = this.put(text);
      this.exports.renyi_file(namePointer, nameLength, textPointer, textLength);
      this.exports.renyi_free(namePointer, nameLength);
      this.exports.renyi_free(textPointer, textLength);
    }

    clear() { this.exports.renyi_clear(); }
    argument(text) { this.call("renyi_argument", text); }
    run(name) { return this.call("renyi_run", name); }

    resume(keys, elapsed) {
      return this.exports.renyi_resume(+keys.forward, +keys.backward, +keys.turn_left,
        +keys.turn_right, +keys.fire, +keys.quit, elapsed);
    }

    text() { return this.read(this.exports.renyi_text(), this.exports.renyi_text_len()); }
    frame() { return this.read(this.exports.renyi_frame(), this.exports.renyi_frame_len()); }
    exitCode() { return this.exports.renyi_exit_code(); }
  }

  // The module from the first place that answers. The streaming compile
  // needs the type application/wasm; a server that says otherwise gets
  // the bytes compiled whole.
  async function load() {
    const imports = { env: { renyi_host_now_ms: () => Date.now() } };
    const failures = [];
    for (const url of MODULES) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`answered ${response.status}`);
        const streamed = "instantiateStreaming" in WebAssembly
          && (response.headers.get("content-type") || "").startsWith("application/wasm");
        const { instance } = streamed
          ? await WebAssembly.instantiateStreaming(response, imports)
          : await WebAssembly.instantiate(await response.arrayBuffer(), imports);
        return new Toolchain(instance);
      } catch (error) {
        failures.push(`${url}: ${error && error.message ? error.message : error}`);
      }
    }
    throw new Error(failures.join("; "));
  }

  // A game's sources, the main file first, fetched a few at a time: a
  // small server's listen queue (the one `python -m http.server` keeps)
  // overflows when many requests arrive at once. Each game is fetched
  // once and kept; a failure is forgotten, so that a later choice of the
  // game tries again.
  const AT_ONCE = 4;
  const sources = new Map();
  function gameFiles(game) {
    if (!sources.has(game)) {
      const loading = (async () => {
        const response = await fetch(`${game}/index.json`);
        if (!response.ok) throw new Error(`its index answered ${response.status}`);
        const names = await response.json();
        const texts = new Array(names.length);
        let next = 0;
        const worker = async () => {
          while (next < names.length) {
            const at = next;
            next += 1;
            const file = await fetch(`${game}/${names[at]}`);
            if (!file.ok) throw new Error(`${names[at]} answered ${file.status}`);
            texts[at] = await file.text();
          }
        };
        await Promise.all(Array.from({ length: Math.min(AT_ONCE, names.length) }, worker));
        return names.map((name, at) => [name, texts[at]]);
      })();
      loading.catch(() => sources.delete(game));
      sources.set(game, loading);
    }
    return sources.get(game);
  }

  let toolchain = null;
  let game = "snake";
  let live = false;
  // Every run gets a number; a tick of an earlier run, still queued
  // when that run was stopped, sees a different number and does nothing.
  let run = 0;
  let keys = held();
  let last = 0;
  // The measure of the last second: the frames and the time in the VM.
  let frames = 0;
  let inside = 0;
  let since = 0;

  function held() {
    return { forward: false, backward: false, turn_left: false, turn_right: false,
      fire: false, quit: false };
  }

  // The frame as the module gives it, one shape per line:
  // `column x top bottom r g b`, `rectangle x y width height r g b`,
  // `label x y r g b text`. A column is one pixel wide from its top row
  // to its bottom row, both included; a label's text is drawn from its
  // top left corner in a monospace font 8 logical pixels tall.
  function draw(frame) {
    context.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#000";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.font = "8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    context.textBaseline = "top";
    for (const line of frame.split("\n")) {
      const parts = line.split(" ");
      if (parts[0] === "column") {
        const [x, top, bottom, red, green, blue] = parts.slice(1).map(Number);
        context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        context.fillRect(x, top, 1, bottom - top + 1);
      } else if (parts[0] === "rectangle") {
        const [x, y, width, height, red, green, blue] = parts.slice(1).map(Number);
        context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        context.fillRect(x, y, width, height);
      } else if (parts[0] === "label") {
        const [x, y, red, green, blue] = parts.slice(1, 6).map(Number);
        context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        context.fillText(parts.slice(6).join(" "), x, y);
      }
    }
  }

  // What the program printed: its last line in the status, in place of
  // the page's own "Playing" line, which `placeholder` marks.
  let placeholder = false;
  function report(text) {
    if (!text || !text.trim()) return;
    const lines = text.trim().split("\n");
    statusLine.textContent = lines[lines.length - 1];
    placeholder = false;
  }

  // A run that ended: the status keeps the program's last line and says
  // how it ended unless it finished or exited with 0, with the exit code
  // when it exited.
  function ended(status) {
    live = false;
    startButton.textContent = "Play again";
    if (placeholder) statusLine.textContent = "";
    if (status === FINISHED || (status === EXITED && toolchain.exitCode() === 0)) {
      if (!statusLine.textContent) statusLine.textContent = "Finished.";
      return;
    }
    const ending = status === EXITED
      ? `exited with ${toolchain.exitCode()}`
      : ENDINGS[status] || `status ${status}`;
    statusLine.textContent = statusLine.textContent
      ? `${statusLine.textContent} (${ending})`
      : `The game ${ending}.`;
  }

  // One frame: the run resumed with the keys held and the time since the
  // previous frame, the next frame drawn, the measure once a second.
  function tick(now, number) {
    if (!live || number !== run) return;
    const elapsed = Math.max(1, Math.min(LONGEST_FRAME_MS, Math.round(now - last)));
    last = now;
    const before = performance.now();
    const status = toolchain.resume(keys, elapsed);
    inside += performance.now() - before;
    frames += 1;
    report(toolchain.text());
    if (status !== SUSPENDED) {
      ended(status);
      return;
    }
    draw(toolchain.frame());
    if (now - since >= 1000) {
      rate.textContent = `${Math.round((frames * 1000) / (now - since))} frames a second, `
        + `${(inside / frames).toFixed(2)} ms a frame in the VM`;
      frames = 0;
      inside = 0;
      since = now;
    }
    requestAnimationFrame((time) => tick(time, number));
  }

  // A run started: ended at once (a game that does not check, say), or
  // suspended at its first frame and then driven by the ticks.
  function begin(status) {
    report(toolchain.text());
    if (status !== SUSPENDED) {
      ended(status);
      return;
    }
    live = true;
    run += 1;
    const number = run;
    keys = held();
    last = performance.now();
    frames = 0;
    inside = 0;
    since = last;
    draw(toolchain.frame());
    startButton.textContent = "Stop";
    if (!statusLine.textContent) {
      statusLine.textContent = `Playing ${NAMES[game]}.`;
      placeholder = true;
    }
    canvas.focus({ preventScroll: true });
    requestAnimationFrame((time) => tick(time, number));
  }

  // The run stopped by the page: the module forgets it and its files.
  function stop(say) {
    live = false;
    run += 1;
    if (toolchain) toolchain.clear();
    startButton.textContent = "Start";
    statusLine.textContent = say;
  }

  async function start() {
    startButton.disabled = true;
    const chosen = game;
    let files;
    try {
      files = await gameFiles(chosen);
    } catch (error) {
      startButton.disabled = false;
      statusLine.textContent = `${NAMES[chosen]} could not be loaded (${error.message}).`;
      return;
    }
    startButton.disabled = false;
    // Another game chosen while the files came: that choice wins.
    if (chosen !== game) return;
    toolchain.clear();
    for (const [name, text] of files) toolchain.file(name, text);
    toolchain.argument("play");
    statusLine.textContent = "";
    placeholder = false;
    rate.textContent = "";
    begin(toolchain.run(files[0][0]));
  }

  // The keys: the whole window listens while a game runs, so that the
  // arrows and Space move the game and not the page.
  const keyOf = (event) => KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
  window.addEventListener("keydown", (event) => {
    const key = keyOf(event);
    if (!key || !live || event.target instanceof HTMLInputElement) return;
    keys[key] = true;
    event.preventDefault();
  });
  window.addEventListener("keyup", (event) => {
    const key = keyOf(event);
    if (!key) return;
    keys[key] = false;
    if (live) event.preventDefault();
  });
  window.addEventListener("blur", () => { keys = held(); });

  startButton.addEventListener("click", () => {
    if (live) stop("Stopped.");
    else start();
  });

  // A game chosen: the running one stopped, the screen cleared, the new
  // game's files fetched ahead of its start.
  for (const button of gameButtons) {
    button.addEventListener("click", () => {
      const chosen = button.dataset.game;
      for (const other of gameButtons) other.setAttribute("aria-pressed", String(other === button));
      if (chosen === game && live) return;
      game = chosen;
      stop(toolchain ? `${NAMES[chosen]}: press Start.` : "");
      rate.textContent = "";
      draw("");
      gameFiles(chosen).catch((error) => {
        if (game === chosen) {
          statusLine.textContent = `${NAMES[chosen]} could not be loaded (${error.message}).`;
        }
      });
    });
  }

  // The page at its start: the screen black, the module and the first
  // game's files fetched together.
  draw("");
  gameFiles(game).catch(() => {});
  (async () => {
    try {
      toolchain = await load();
    } catch (error) {
      startButton.textContent = "Not available";
      statusLine.textContent = `The toolchain's module could not be loaded (${error.message}).`;
      return;
    }
    startButton.textContent = "Start";
    startButton.disabled = false;
    if (!statusLine.textContent || statusLine.textContent.endsWith("press Start.")) {
      statusLine.textContent = `Ready: ${NAMES[game]}, press Start.`;
    }
  })();
})();
