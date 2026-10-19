
"use strict";

const $ = id => document.getElementById(id);

const office = $("office");
const flashlight = $("heldFlashlight");
const batterySlot = $("batterySlot");
const carriedWood = $("carriedWood");
const stove = $("stove");
const cameraPanel = $("cameraPanel");

const JOURNAL = {
  intro: {
    title: "Запись №001 — Правила",
    subtitle: "ИНСТРУКЦИЯ ДЕЖУРНОГО",
    body: `
      <p>Ты работаешь в старом здании, где ночью нельзя терять бдительность.</p>
      <h4>Главные правила</h4>
      <p>Следи за огнём в печке. Когда огонь погаснет, смена будет провалена.</p>
      <p>Экономь заряд фонаря. Каждая вспышка расходует 5% заряда.</p>
      <p>Проверяй камеры левого прохода и не забывай про правый проход.</p>
      <p>Дрова лежат под столом. Возьми полено, повернись к печке и перетащи его на неё.</p>
    `
  },

  leftWatcher: {
    title: "Запись №002 — Смотритель",
    subtitle: "ЛЕВЫЙ ПРОХОД",
    body: `
      <p>Существо, замеченное в левом проходе. Его настоящее имя неизвестно.</p>
      <h4>Поведение</h4>
      <p>Оно появляется в темноте и может долго оставаться неподвижным.</p>
      <h4>Наблюдение</h4>
      <p>Проверяй CAM 01, CAM 02 и CAM 03. Камеры помогают заметить его присутствие.</p>
      <h4>Защита</h4>
      <p>Если существо появилось в проходе, посвети фонарём в его сторону.</p>
      <p><i>Не все сведения подтверждены.</i></p>
    `
  },

  rightStalker: {
    title: "Запись №003 — Преследователь",
    subtitle: "ПРАВЫЙ ПРОХОД",
    body: `
      <p>Высокая фигура, которую дежурные замечали справа от офиса.</p>
      <h4>Поведение</h4>
      <p>Появляется неожиданно. Иногда перед этим слышны тяжёлые шаги.</p>
      <h4>Защита</h4>
      <p>Поворачивайся к правому проходу и используй вспышку фонаря.</p>
      <p>Одна вспышка расходует 5% заряда. Когда заряд закончится, вставь новую батарейку.</p>
    `
  },

  fireKeeper: {
    title: "Запись №004 — Хранитель огня",
    subtitle: "СТАРЫЕ ДОКУМЕНТЫ",
    body: `
      <p>В старых документах упоминается существо, связанное с печью.</p>
      <h4>Сведения</h4>
      <p>Его существование пока не подтверждено. Возможно, это всего лишь легенда.</p>
      <p>Однако огонь действительно важен: не позволяй ему погаснуть.</p>
      <p><i>В документах есть упоминание о следующей смене, но подробности отсутствуют.</i></p>
    `
  },

  unknown: {
    title: "Запись №005 — Неизвестный",
    subtitle: "ДАННЫЕ ЗАСЕКРЕЧЕНЫ",
    body: `
      <p>В архиве найдено упоминание ещё одного существа.</p>
      <p>Имя, внешний вид и поведение пока неизвестны.</p>
      <h4>Условие открытия</h4>
      <p>Продолжай проходить смены. Возможно, новые наблюдения помогут раскрыть эту запись.</p>
    `
  }
};

const JOURNAL_ORDER = [
  "intro",
  "leftWatcher",
  "rightStalker",
  "fireKeeper",
  "unknown"
];

let currentShift = 1;
let completedShift = 0;
let unlockedEntries = ["intro"];
let seenEnemies = [];

let running = false;
let gameOver = false;
let seconds = 0;
let view = "front";

let hasFlashlight = false;
let flashlightCharge = 100;
let spareBatteries = 4;

let woodCount = 18;
let hasWood = false;
let fireLevel = 100;

let leftEnemyPresent = false;
let rightEnemyPresent = false;

let selectedCamera = 1;
let selectedJournalEntry = "intro";
let lastReportUnlocks = [];

let gameTimer = null;
let enemyTimer = null;
let fireTimer = null;
let beamTimer = null;
let messageTimer = null;

let swipeStartX = 0;
let swipeStartY = 0;
let swipeStarted = false;

let draggingWood = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragPointerId = null;

let returnScreen = "mainMenu";

// --------------------
// СОХРАНЕНИЕ
// --------------------

function saveProgress() {
  const data = {
    currentShift,
    completedShift,
    unlockedEntries,
    seenEnemies
  };

  try {
    localStorage.setItem("valleyBloodSave", JSON.stringify(data));
  } catch (error) {
    console.warn("Не удалось сохранить прогресс:", error);
  }

  updateMenuProgress();
}

function loadProgress() {
  try {
    const raw = localStorage.getItem("valleyBloodSave");
    if (!raw) return;

    const data = JSON.parse(raw);

    currentShift = Math.max(1, Number(data.currentShift) || 1);
    completedShift = Math.max(0, Number(data.completedShift) || 0);

    unlockedEntries = Array.isArray(data.unlockedEntries)
      ? data.unlockedEntries.filter(id => JOURNAL[id])
      : ["intro"];

    if (!unlockedEntries.includes("intro")) {
      unlockedEntries.unshift("intro");
    }

    seenEnemies = Array.isArray(data.seenEnemies)
      ? data.seenEnemies.filter(id =>
          id === "leftWatcher" || id === "rightStalker"
        )
      : [];
  } catch (error) {
    console.warn("Не удалось загрузить сохранение:", error);
  }
}

function updateMenuProgress() {
  $("menuProgress").textContent =
    `СМЕНА ${currentShift} · ЗАПИСЕЙ: ${unlockedEntries.length}`;

  $("continueButton").disabled = completedShift === 0;
  $("continueButton").style.opacity =
    completedShift === 0 ? ".45" : "1";
}

function unlockEntry(id) {
  if (!JOURNAL[id] || unlockedEntries.includes(id)) return false;

  unlockedEntries.push(id);
  lastReportUnlocks.push(id);
  saveProgress();

  return true;
}

function unlockEnemyRecord(id) {
  unlockEntry(id);

  if (!seenEnemies.includes(id)) {
    seenEnemies.push(id);
    saveProgress();
  }
}

// --------------------
// ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ
// --------------------

function showScreen(id) {
  [
    "mainMenu",
    "journalScreen",
    "shiftReport",
    "settingsScreen",
    "overlay"
  ].forEach(screenId => {
    $(screenId).classList.add("hidden");
  });

  if (id) $(id).classList.remove("hidden");
}

function showMainMenu() {
  stopTimers();
  running = false;
  gameOver = false;
  showScreen("mainMenu");
  updateMenuProgress();
}

function showJournal(backTo) {
  returnScreen = backTo;
  renderJournal();
  showScreen("journalScreen");
}

$("menuJournalButton").addEventListener("click", () => {
  showJournal("mainMenu");
});

$("openJournalDuringGame").addEventListener("click", () => {
  if (!running) return;
  showJournal("game");
});

$("closeJournalButton").addEventListener("click", () => {
  if (returnScreen === "game" && running) {
    showScreen(null);
  } else if (returnScreen === "report") {
    showScreen("shiftReport");
  } else {
    showMainMenu();
  }
});

// --------------------
// ЖУРНАЛ
// --------------------

function renderJournal() {
  const list = $("journalList");
  list.replaceChildren();

  JOURNAL_ORDER.forEach((id, index) => {
    const unlocked = unlockedEntries.includes(id);
    const entry = JOURNAL[id];
    const button = document.createElement("button");

    button.className = "journal-item";
    if (!unlocked) button.classList.add("locked");
    if (selectedJournalEntry === id) button.classList.add("selected");

    button.textContent = unlocked
      ? entry.title
      : `🔒 Запись №${String(index + 1).padStart(3, "0")} — ???`;

    button.addEventListener("click", () => {
      selectedJournalEntry = id;
      renderJournal();
    });

    list.appendChild(button);
  });

  const entry = JOURNAL[selectedJournalEntry];

  if (unlockedEntries.includes(selectedJournalEntry)) {
    $("journalEntry").innerHTML = `
      <div class="menu-subtitle">${entry.subtitle}</div>
      <h3>${entry.title}</h3>
      ${entry.body}
    `;
  } else {
    $("journalEntry").innerHTML = `
      <div class="locked-symbol">?</div>
      <h3>Запись засекречена</h3>
      <p>Информация станет доступна после дальнейшего прохождения.</p>
    `;
  }

  $("journalCounter").textContent =
    `Открыто ${unlockedEntries.length} из ${JOURNAL_ORDER.length} записей`;
}

// --------------------
// НАСТРОЙКИ
// --------------------

$("settingsButton").addEventListener("click", () => {
  showScreen("settingsScreen");
});

$("closeSettingsButton").addEventListener("click", showMainMenu);

$("resetProgressButton").addEventListener("click", () => {
  const confirmed = confirm(
    "Точно сбросить весь прогресс и открыть игру заново?"
  );

  if (!confirmed) return;

  stopTimers();

  try {
    localStorage.removeItem("valleyBloodSave");
  } catch (error) {
    console.warn(error);
  }

  currentShift = 1;
  completedShift = 0;
  unlockedEntries = ["intro"];
  seenEnemies = [];
  selectedJournalEntry = "intro";

  showMainMenu();
});

// --------------------
// СООБЩЕНИЯ И ПОКАЗАТЕЛИ
// --------------------

function notify(text) {
  $("notice").textContent = text;
}

function say(text, duration = 1800) {
  $("message").textContent = text;
  clearTimeout(messageTimer);

  if (duration > 0) {
    messageTimer = setTimeout(() => {
      $("message").textContent = "";
    }, duration);
  }
}

function updateStatus() {
  $("fireValue").textContent = `${fireLevel}%`;
  $("chargeValue").textContent = `${flashlightCharge}%`;
  $("batteryValue").textContent = spareBatteries;
  $("woodValue").textContent = woodCount;

  $("fire").classList.toggle("low", fireLevel <= 35 && fireLevel > 0);
  $("fire").classList.toggle("out", fireLevel <= 0);

  flashlight.classList.toggle("hidden", !hasFlashlight);
  batterySlot.classList.toggle(
    "hidden",
    !hasFlashlight || spareBatteries <= 0
  );

  batterySlot.style.opacity = flashlightCharge <= 0 ? "1" : ".45";

  $("flashCharge").classList.toggle("hidden", !hasFlashlight);
  $("flashChargeFill").style.width = `${flashlightCharge}%`;

  $("flashChargeFill").style.background =
    flashlightCharge <= 20 ? "#c33" : "#d4d47a";

  carriedWood.classList.toggle(
    "hidden",
    !hasWood || view !== "back"
  );

  $("leftEnemy").classList.toggle("visible", leftEnemyPresent);
  $("rightEnemy").classList.toggle("visible", rightEnemyPresent);

  $("shiftLabel").textContent = `СМЕНА ${currentShift}`;

  updateCameraFeed();
}

// --------------------
// ПОВОРОТЫ
// --------------------

function turnTo(nextView) {
  if (!running) return;

  view = nextView;
  office.className = `office ${view}`;

  if (view === "front") {
    notify("Офис. Фонарик и батарейки лежат на столе.");
  } else if (view === "left") {
    notify("Левый проход. Проверь его и камеры.");
  } else if (view === "right") {
    notify("Правый проход. Используй фонарик.");
  } else {
    notify("Печь. Перетащи полено прямо на неё.");
  }

  updateStatus();
}

$("turnLeft").addEventListener("click", () => {
  if (view === "front") turnTo("left");
  else if (view === "left") turnTo("back");
  else if (view === "back") turnTo("right");
  else turnTo("front");
});

$("turnRight").addEventListener("click", () => {
  if (view === "front") turnTo("right");
  else if (view === "right") turnTo("back");
  else if (view === "back") turnTo("left");
  else turnTo("front");
});

$("turnFront").addEventListener("click", () => turnTo("front"));
$("turnBack").addEventListener("click", () => turnTo("back"));

office.addEventListener("pointerdown", event => {
  if (!running) return;
  if (event.target.closest("button")) return;
  if (event.target.closest("#cameraPanel")) return;

  swipeStartX = event.clientX;
  swipeStartY = event.clientY;
  swipeStarted = true;
});

office.addEventListener("pointerup", event => {
  if (!swipeStarted || !running) return;
  swipeStarted = false;

  const dx = event.clientX - swipeStartX;
  const dy = event.clientY - swipeStartY;

  if (Math.abs(dx) < 35 || Math.abs(dx) < Math.abs(dy)) return;

  if (dx < 0) turnTo("right");
  else turnTo("left");
});

office.addEventListener("pointercancel", () => {
  swipeStarted = false;
});

// --------------------
// ФОНАРИК
// --------------------

$("flashlightItem").addEventListener("click", () => {
  if (!running || hasFlashlight || view !== "front") return;

  hasFlashlight = true;
  flashlightCharge = 100;

  $("flashlightItem").classList.add("taken");

  say("Ты взял фонарик.");
  updateStatus();
});

$("batteryItem").addEventListener("click", () => {
  if (!running || view !== "front") return;

  if ($("batteryItem").classList.contains("taken")) return;

  spareBatteries = 4;
  $("batteryItem").classList.add("taken");

  say("Ты забрал четыре запасные батарейки.");
  updateStatus();
});

flashlight.addEventListener("click", () => {
  if (!running || !hasFlashlight) return;

  if (view !== "right" && view !== "left") {
    say("Сначала повернись к одному из проходов.");
    return;
  }

  if (flashlightCharge <= 0) {
    say("Фонарик разряжен. Нажми на значок батарейки.");
    return;
  }

  flashlightCharge = Math.max(0, flashlightCharge - 5);
  $("flashBeam").classList.add("active");

  if (view === "right" && rightEnemyPresent) {
    rightEnemyPresent = false;
    say("Свет отпугнул Преследователя!");
  } else if (view === "left" && leftEnemyPresent) {
    leftEnemyPresent = false;
    say("Существо отступило в темноту!");
  } else {
    say("В проходе никого не видно.");
  }

  updateStatus();

  clearTimeout(beamTimer);
  beamTimer = setTimeout(() => {
    $("flashBeam").classList.remove("active");
  }, 850);
});

batterySlot.addEventListener("click", () => {
  if (!running || !hasFlashlight) return;

  if (flashlightCharge > 0) {
    say("Батарейку можно заменить, когда заряд закончится.");
    return;
  }

  if (spareBatteries <= 0) {
    say("Запасные батарейки закончились!");
    return;
  }

  spareBatteries--;
  flashlightCharge = 100;

  say(`Батарейка заменена. Осталось: ${spareBatteries}.`);
  updateStatus();
});

// --------------------
// ДРОВА
// --------------------

function resetWoodPile() {
  document.querySelectorAll(".log").forEach(log => {
    log.classList.remove("taken");
  });
}

document.querySelectorAll(".log").forEach(log => {
  log.addEventListener("click", () => {
    if (!running) return;

    if (view !== "front") {
      say("Повернись прямо к столу, чтобы взять дрова.");
      return;
    }

    if (hasWood) {
      say("Ты уже держишь полено.");
      return;
    }

    if (woodCount <= 0) {
      say("Дров больше нет!");
      return;
    }

    hasWood = true;
    woodCount--;

    log.classList.add("taken");

    say("Ты взял полено. Повернись к печке.");
    updateStatus();
  });
});

carriedWood.addEventListener("pointerdown", event => {
  if (!running || !hasWood || view !== "back") return;

  draggingWood = true;
  dragPointerId = event.pointerId;

  const rect = carriedWood.getBoundingClientRect();

  dragOffsetX = event.clientX - rect.left;
  dragOffsetY = event.clientY - rect.top;

  carriedWood.classList.add("dragging");
  carriedWood.setPointerCapture(event.pointerId);
  stove.classList.add("drop-ready");

  event.preventDefault();
});

carriedWood.addEventListener("pointermove", event => {
  if (!draggingWood || event.pointerId !== dragPointerId) return;

  const rect = office.getBoundingClientRect();

  carriedWood.style.left =
    `${event.clientX - rect.left - dragOffsetX}px`;

  carriedWood.style.top =
    `${event.clientY - rect.top - dragOffsetY}px`;

  carriedWood.style.bottom = "auto";
});

function resetDraggedWood() {
  draggingWood = false;
  dragPointerId = null;

  carriedWood.classList.remove("dragging");
  stove.classList.remove("drop-ready");

  carriedWood.style.left = "";
  carriedWood.style.top = "";
  carriedWood.style.bottom = "";
}

carriedWood.addEventListener("pointerup", event => {
  if (!draggingWood || event.pointerId !== dragPointerId) return;

  const target = document.elementFromPoint(
    event.clientX,
    event.clientY
  );

  const droppedOnStove = target &&
    (target.closest("#stove") || target.closest("#fire"));

  resetDraggedWood();

  if (droppedOnStove && view === "back" && hasWood) {
    hasWood = false;
    fireLevel = Math.min(100, fireLevel + 55);

    say("Полено добавлено в печку. Огонь усилился!");
    updateStatus();
  } else {
    say("Перетащи полено прямо на печку.");
  }
});

carriedWood.addEventListener("pointercancel", resetDraggedWood);

// --------------------
// КАМЕРЫ
// --------------------

$("openCameras").addEventListener("click", () => {
  if (!running) return;

  cameraPanel.classList.remove("hidden");
  updateCameraFeed();
});

$("closeCameras").addEventListener("click", () => {
  cameraPanel.classList.add("hidden");
});

document.querySelectorAll("[data-camera]").forEach(button => {
  button.addEventListener("click", () => {
    selectedCamera = Number(button.dataset.camera);

    document.querySelectorAll("[data-camera]").forEach(item => {
      item.classList.toggle("selected", item === button);
    });

    updateCameraFeed();
  });
});

function updateCameraFeed() {
  const scene = $("cameraScene");

  scene.classList.toggle("cam2", selectedCamera === 2);
  scene.classList.toggle("cam3", selectedCamera === 3);

  const labels = {
    1: "CAM 01 — ВХОД В ЛЕВЫЙ ПРОХОД",
    2: "CAM 02 — СЕРЕДИНА ПРОХОДА",
    3: "CAM 03 — ДАЛЬНИЙ УГОЛ"
  };

  $("cameraLabel").textContent = labels[selectedCamera];

  $("cameraEnemy").classList.toggle(
    "hidden",
    !leftEnemyPresent
  );
}

// --------------------
// ПРОТИВНИКИ
// --------------------

function spawnEnemy() {
  if (!running || gameOver) return;

  if (!rightEnemyPresent && Math.random() < 0.5) {
    rightEnemyPresent = true;
    unlockEnemyRecord("rightStalker");
    notify("Справа слышны тяжёлые шаги...");
  }

  if (!leftEnemyPresent && Math.random() < 0.5) {
    leftEnemyPresent = true;
    unlockEnemyRecord("leftWatcher");
    notify("Что-то движется в левом проходе...");
  }

  updateStatus();
}

// --------------------
// ЗАПУСК И ЗАВЕРШЕНИЕ СМЕНЫ
// --------------------

function stopTimers() {
  clearInterval(gameTimer);
  clearInterval(enemyTimer);
  clearInterval(fireTimer);

  clearTimeout(beamTimer);
  clearTimeout(messageTimer);

  gameTimer = null;
  enemyTimer = null;
  fireTimer = null;
}

function startShift(shiftNumber) {
  stopTimers();

  currentShift = Math.max(1, shiftNumber);
  seconds = 0;

  running = true;
  gameOver = false;

  hasFlashlight = false;
  flashlightCharge = 100;
  spareBatteries = 4;

  woodCount = 18;
  hasWood = false;
  fireLevel = 100;

  leftEnemyPresent = false;
  rightEnemyPresent = false;

  view = "front";
  selectedCamera = 1;
  lastReportUnlocks = [];

  $("flashlightItem").classList.remove("taken");
  $("batteryItem").classList.remove("taken");
  $("flashBeam").classList.remove("active");
  cameraPanel.classList.add("hidden");

  resetWoodPile();
  resetDraggedWood();

  $("clock").textContent = "12 AM";
  $("shiftLabel").textContent = `СМЕНА ${currentShift}`;

  $("overlay").classList.add("hidden");
  showScreen(null);

  office.className = "office front";
  notify(`Смена ${currentShift} началась. Доживи до 6 AM.`);
  say("Следи за огнём и проверяй проходы.", 3000);

  saveProgress();
  updateStatus();

  gameTimer = setInterval(() => {
    if (!running || gameOver) return;

    seconds++;

    const gameHour = Math.min(6, Math.floor(seconds / 30));

    $("clock").textContent =
      gameHour === 0 ? "12 AM" : `${gameHour} AM`;

    if (seconds >= 180) {
      finishShift();
    }
  }, 1000);

  enemyTimer = setInterval(spawnEnemy, 10000);

  fireTimer = setInterval(() => {
    if (!running || gameOver) return;

    fireLevel = Math.max(0, fireLevel - 2);
    updateStatus();

    if (fireLevel <= 0) {
      finishShift(false);
    } else if (fireLevel <= 20) {
      notify("Огонь почти погас! Срочно принеси дрова.");
    }
  }, 4000);
}

function finishShift(won = true) {
  if (!running || gameOver) return;

  stopTimers();
  running = false;
  gameOver = true;

  if (!won) {
    $("overlayTitle").textContent = "СМЕНА ПРОВАЛЕНА";
    $("overlayText").textContent =
      "Огонь погас. Ты не смог пережить эту смену.";

    showScreen("overlay");
    return;
  }

  completedShift = Math.max(completedShift, currentShift);

  if (currentShift >= 1) {
    unlockEntry("fireKeeper");
  }

  if (currentShift >= 2) {
    unlockEntry("unknown");
  }

  currentShift = completedShift + 1;
  saveProgress();

  $("reportTitle").textContent = "6 AM";
  $("reportText").textContent =
    `Смена ${completedShift} завершена. Ты пережил ещё одну ночь.`;

  if (lastReportUnlocks.length) {
    $("reportUnlocks").innerHTML = lastReportUnlocks
      .map(id => `• ${JOURNAL[id].title}`)
      .join("<br>");
  } else {
    $("reportUnlocks").textContent =
      "Новых записей в этот раз нет.";
  }

  $("nextShiftButton").textContent =
    `НАЧАТЬ СМЕНУ ${currentShift}`;

  showScreen("shiftReport");
}

$("newGameButton").addEventListener("click", () => {
  currentShift = 1;
  completedShift = 0;
  unlockedEntries = ["intro"];
  seenEnemies = [];
  selectedJournalEntry = "intro";

  saveProgress();
  startShift(1);
});

$("continueButton").addEventListener("click", () => {
  if (completedShift <= 0) {
    say("Сначала пройди первую смену.");
    return;
  }

  startShift(currentShift);
});

$("nextShiftButton").addEventListener("click", () => {
  startShift(currentShift);
});

$("reportJournalButton").addEventListener("click", () => {
  showJournal("report");
});

$("reportMenuButton").addEventListener("click", showMainMenu);

$("restart").addEventListener("click", () => {
  startShift(currentShift);
});

$("defeatMenuButton").addEventListener("click", showMainMenu);

// --------------------
// ПЕРВЫЙ ЗАПУСК
// --------------------

loadProgress();
updateMenuProgress();
renderJournal();
showMainMenu();
