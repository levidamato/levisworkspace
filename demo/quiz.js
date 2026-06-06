const root = document.querySelector("#game-root");

const directions = ["north", "east", "south", "west"];
const directionGlyphs = {
  north: "^",
  east: ">",
  south: "v",
  west: "<",
};

const commands = [
  {
    id: "move",
    label: "move()",
    description: "Step forward one tile.",
  },
  {
    id: "left",
    label: "turnLeft()",
    description: "Rotate 90 degrees left.",
  },
  {
    id: "right",
    label: "turnRight()",
    description: "Rotate 90 degrees right.",
  },
  {
    id: "fix",
    label: "fixBug()",
    description: "Patch a bug on the current tile.",
  },
];

const levels = [
  {
    name: "Syntax Street",
    objective: "Patch the bug, then reach the deploy portal.",
    width: 5,
    height: 5,
    start: { x: 0, y: 4, direction: "east" },
    portal: { x: 4, y: 0 },
    bugs: [{ x: 2, y: 4 }],
    blockers: [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 3 },
    ],
    commandLimit: 12,
    hint: "Queue move(), fixBug(), and turn commands. The robot must stand on a bug to patch it.",
  },
  {
    name: "Loop Lagoon",
    objective: "Collect both bugs before deploying.",
    width: 6,
    height: 5,
    start: { x: 0, y: 0, direction: "east" },
    portal: { x: 5, y: 4 },
    bugs: [
      { x: 4, y: 0 },
      { x: 1, y: 3 },
    ],
    blockers: [
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 4, y: 2 },
    ],
    commandLimit: 18,
    hint: "Think in chunks: drive east to the first bug, turn around the wall, then patch the second.",
  },
  {
    name: "Release Ridge",
    objective: "Navigate the blockers, fix every bug, and deploy.",
    width: 7,
    height: 6,
    start: { x: 0, y: 5, direction: "north" },
    portal: { x: 6, y: 0 },
    bugs: [
      { x: 0, y: 2 },
      { x: 3, y: 3 },
      { x: 6, y: 1 },
    ],
    blockers: [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 3 },
      { x: 5, y: 4 },
    ],
    commandLimit: 26,
    hint: "Every turn matters. Patch the left-side bug first, then cross the middle before heading to the portal.",
  },
];

let state = createInitialState(0);

function createInitialState(levelIndex) {
  const level = levels[levelIndex];

  return {
    levelIndex,
    robot: { ...level.start },
    fixedBugs: [],
    queue: [],
    activeCommandIndex: null,
    isRunning: false,
    status: "Plan your program, then run it.",
    statusType: "info",
  };
}

function renderGame() {
  const level = levels[state.levelIndex];
  const fixedCount = state.fixedBugs.length;
  const bugCount = level.bugs.length;
  const commandMarkup = commands
    .map((command) => {
      return `
        <button class="command-button" type="button" data-command="${command.id}" ${
        state.isRunning || state.queue.length >= level.commandLimit ? "disabled" : ""
      }>
          <span>${command.label}</span>
          <small>${command.description}</small>
        </button>
      `;
    })
    .join("");

  root.innerHTML = `
    <div class="hero">
      <p class="eyebrow">Code Runner</p>
      <h1>Debug Quest</h1>
      <p>
        Program Byte, the tiny release robot. Queue commands, run your code,
        patch every bug, and ship through the deploy portal.
      </p>
    </div>

    <div class="dashboard" aria-label="Game status">
      <span>Level ${state.levelIndex + 1}/${levels.length}: ${escapeHtml(level.name)}</span>
      <span>Bugs fixed: ${fixedCount}/${bugCount}</span>
      <span>Commands: ${state.queue.length}/${level.commandLimit}</span>
    </div>

    <section class="game-layout">
      <div>
        <div class="board" style="--columns: ${level.width};" aria-label="Game board">
          ${renderBoard(level)}
        </div>
        <p class="legend">
          <span><b class="legend-robot">B</b> Byte</span>
          <span><b class="legend-bug">!</b> bug</span>
          <span><b class="legend-portal">D</b> deploy</span>
          <span><b class="legend-blocker">#</b> blocker</span>
        </p>
      </div>

      <aside class="control-panel">
        <div class="panel-section">
          <h2>Mission</h2>
          <p>${escapeHtml(level.objective)}</p>
          <p class="hint">${escapeHtml(level.hint)}</p>
        </div>

        <div class="panel-section">
          <h2>Command library</h2>
          <div class="command-grid">${commandMarkup}</div>
        </div>

        <div class="panel-section">
          <div class="queue-heading">
            <h2>Your program</h2>
            <button class="text-button" type="button" data-clear ${state.isRunning ? "disabled" : ""}>
              Clear
            </button>
          </div>
          <ol class="program-list">
            ${renderProgramQueue()}
          </ol>
        </div>

        <div class="actions">
          <button class="primary-button" type="button" data-run ${
            state.isRunning || state.queue.length === 0 ? "disabled" : ""
          }>
            Run program
          </button>
          <button class="secondary-button" type="button" data-reset ${state.isRunning ? "disabled" : ""}>
            Reset level
          </button>
        </div>

        <p class="status ${state.statusType}" role="status">${escapeHtml(state.status)}</p>
      </aside>
    </section>
  `;

  bindControls();
}

function renderBoard(level) {
  const cells = [];

  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const position = { x, y };
      const cellTypes = ["cell"];
      let label = "";

      if (isSamePosition(position, level.portal)) {
        cellTypes.push("portal");
        label = "D";
      }

      if (hasPosition(level.blockers, position)) {
        cellTypes.push("blocker");
        label = "#";
      }

      const bugIndex = level.bugs.findIndex((bug) => isSamePosition(bug, position));
      if (bugIndex !== -1 && !state.fixedBugs.includes(bugIndex)) {
        cellTypes.push("bug");
        label = "!";
      }

      if (isSamePosition(position, state.robot)) {
        cellTypes.push("robot");
        label = `B${directionGlyphs[state.robot.direction]}`;
      }

      cells.push(`
        <div class="${cellTypes.join(" ")}" aria-label="${describeCell(position, level)}">
          ${label}
        </div>
      `);
    }
  }

  return cells.join("");
}

function renderProgramQueue() {
  if (state.queue.length === 0) {
    return `<li class="empty-program">Add commands to write your program.</li>`;
  }

  return state.queue
    .map((commandId, index) => {
      const command = commands.find((item) => item.id === commandId);
      const activeClass = state.activeCommandIndex === index ? "active" : "";

      return `
        <li class="${activeClass}">
          <code>${index + 1}. ${command.label}</code>
          <button class="remove-command" type="button" data-remove="${index}" ${
        state.isRunning ? "disabled" : ""
      } aria-label="Remove ${command.label}">
            x
          </button>
        </li>
      `;
    })
    .join("");
}

function bindControls() {
  root.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      addCommand(button.dataset.command);
    });
  });

  root.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      removeCommand(Number(button.dataset.remove));
    });
  });

  root.querySelector("[data-clear]").addEventListener("click", clearProgram);
  root.querySelector("[data-reset]").addEventListener("click", resetLevel);
  root.querySelector("[data-run]").addEventListener("click", runProgram);
}

function addCommand(commandId) {
  const level = levels[state.levelIndex];

  if (state.queue.length >= level.commandLimit) {
    updateStatus("Command memory is full. Remove a step or run the program.", "warning");
    return;
  }

  state.queue.push(commandId);
  updateStatus("Command added. Keep building your program.", "info");
}

function removeCommand(index) {
  state.queue.splice(index, 1);
  updateStatus("Command removed.", "info");
}

function clearProgram() {
  state.queue = [];
  updateStatus("Program cleared. Start a new solution.", "info");
}

function resetLevel() {
  state = createInitialState(state.levelIndex);
  renderGame();
}

async function runProgram() {
  const level = levels[state.levelIndex];

  state.robot = { ...level.start };
  state.fixedBugs = [];
  state.isRunning = true;
  state.status = "Running your program...";
  state.statusType = "info";
  renderGame();

  for (let index = 0; index < state.queue.length; index += 1) {
    state.activeCommandIndex = index;
    renderGame();
    await wait(420);

    const result = executeCommand(state.queue[index], level);

    if (!result.ok) {
      state.isRunning = false;
      state.activeCommandIndex = null;
      state.status = result.message;
      state.statusType = "error";
      renderGame();
      return;
    }

    renderGame();
    await wait(300);
  }

  state.isRunning = false;
  state.activeCommandIndex = null;
  finishRun(level);
}

function executeCommand(commandId, level) {
  if (commandId === "move") {
    return moveRobot(level);
  }

  if (commandId === "left" || commandId === "right") {
    turnRobot(commandId);
    return { ok: true };
  }

  if (commandId === "fix") {
    return fixCurrentBug(level);
  }

  return { ok: false, message: "Unknown command. Reset and try again." };
}

function moveRobot(level) {
  const nextPosition = getForwardPosition(state.robot);

  if (
    nextPosition.x < 0 ||
    nextPosition.x >= level.width ||
    nextPosition.y < 0 ||
    nextPosition.y >= level.height
  ) {
    return { ok: false, message: "Crash! Byte tried to leave the grid." };
  }

  if (hasPosition(level.blockers, nextPosition)) {
    return { ok: false, message: "Crash! A blocker stopped Byte's program." };
  }

  state.robot.x = nextPosition.x;
  state.robot.y = nextPosition.y;
  return { ok: true };
}

function turnRobot(commandId) {
  const currentDirectionIndex = directions.indexOf(state.robot.direction);
  const offset = commandId === "left" ? -1 : 1;
  const nextDirectionIndex = (currentDirectionIndex + offset + directions.length) % directions.length;

  state.robot.direction = directions[nextDirectionIndex];
}

function fixCurrentBug(level) {
  const bugIndex = level.bugs.findIndex((bug) => isSamePosition(bug, state.robot));

  if (bugIndex === -1) {
    return { ok: false, message: "fixBug() ran on an empty tile. Stand on a bug first." };
  }

  if (state.fixedBugs.includes(bugIndex)) {
    return { ok: false, message: "That bug was already patched. Remove the extra fixBug()." };
  }

  state.fixedBugs.push(bugIndex);
  return { ok: true };
}

function finishRun(level) {
  const fixedEveryBug = state.fixedBugs.length === level.bugs.length;
  const reachedPortal = isSamePosition(state.robot, level.portal);

  if (fixedEveryBug && reachedPortal) {
    renderLevelComplete();
    return;
  }

  if (!fixedEveryBug) {
    state.status = "Program finished, but there are still bugs to patch.";
    state.statusType = "warning";
  } else {
    state.status = "All bugs are fixed. Now finish on the deploy portal.";
    state.statusType = "warning";
  }

  renderGame();
}

function renderLevelComplete() {
  const level = levels[state.levelIndex];
  const hasNextLevel = state.levelIndex < levels.length - 1;

  root.innerHTML = `
    <div class="completion-card">
      <p class="eyebrow">Build passed</p>
      <h1>${escapeHtml(level.name)} complete!</h1>
      <p>
        Byte fixed every bug and deployed in ${state.queue.length}
        ${state.queue.length === 1 ? "command" : "commands"}.
      </p>
      <div class="actions">
        <button class="primary-button" type="button" data-next-level>
          ${hasNextLevel ? "Next level" : "Play again"}
        </button>
        <button class="secondary-button" type="button" data-retry>
          Replay this level
        </button>
      </div>
    </div>
  `;

  root.querySelector("[data-next-level]").addEventListener("click", () => {
    const nextLevelIndex = hasNextLevel ? state.levelIndex + 1 : 0;
    state = createInitialState(nextLevelIndex);
    renderGame();
  });

  root.querySelector("[data-retry]").addEventListener("click", () => {
    state = createInitialState(state.levelIndex);
    renderGame();
  });
}

function updateStatus(message, type) {
  state.status = message;
  state.statusType = type;
  renderGame();
}

function getForwardPosition(robot) {
  const nextPosition = { x: robot.x, y: robot.y };

  if (robot.direction === "north") {
    nextPosition.y -= 1;
  } else if (robot.direction === "east") {
    nextPosition.x += 1;
  } else if (robot.direction === "south") {
    nextPosition.y += 1;
  } else if (robot.direction === "west") {
    nextPosition.x -= 1;
  }

  return nextPosition;
}

function describeCell(position, level) {
  const labels = [`Column ${position.x + 1}`, `row ${position.y + 1}`];

  if (isSamePosition(position, state.robot)) {
    labels.push(`Byte facing ${state.robot.direction}`);
  }

  if (hasPosition(level.blockers, position)) {
    labels.push("blocker");
  }

  if (isSamePosition(position, level.portal)) {
    labels.push("deploy portal");
  }

  const bugIndex = level.bugs.findIndex((bug) => isSamePosition(bug, position));
  if (bugIndex !== -1 && !state.fixedBugs.includes(bugIndex)) {
    labels.push("bug");
  }

  return labels.join(", ");
}

function hasPosition(items, position) {
  return items.some((item) => isSamePosition(item, position));
}

function isSamePosition(first, second) {
  return first.x === second.x && first.y === second.y;
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

renderGame();
