"use strict";

const $ = id => document.getElementById(id);

const screens = ["menu", "office", "journal", "settings", "result"];

let shift = 1;
let running = false;
let paused = false;
let view = "front";

let battery = 100;
let fireLevel = 70;
let hasWood = false;
let woodCount = 18;

let elapsed = 0;
let shiftDuration = 150;
let messageTimeout = null;
let gameInterval = null;
let scareTimeout = null;

let cameraOpen = false;
let repairOpen = false;
let selectedCamera = 1;
let completedAllShifts = false;

let alarmReady = true;
let alarmBroken = false;
let alarmActive = false;
let alarmCooldown = 0;
let repairTime = 0;
let alarmDuration = 0;

let nemka = {};
let nene = {};

let draggingWood = false;
let dragPointerId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

const journal = [
  {
    shift: 1,
    title: "Запись 1 — Правый проход",
    text: "В проходах иногда появляется Немка. Она не любит яркий свет. Если заметишь её рядом, направь на неё вспышку фонарика. Не трать батарею без необходимости."
  },
  {
    shift: 2,
    title: "Запись 2 — Левый проход",
    text: "Появилась НеНе. Она держится только в левом проходе. Обычная вспышка на неё не действует. Используй сигнализацию через камеры."
  },
  {
    shift: 2,
    title: "Запись 3 — Сигнализация",
    text: "Сигнализация работает недолго и перезаряжается. Иногда она ломается. Открой второй ноутбук и запусти ремонт. Он займёт двадцать секунд."
  },
  {
    shift: 3,
    title: "Запись 4 — Наблюдение",
    text: "Не теряй бдительности. Следи за проходами, проверяй камеры и поддерживай огонь в печке."
  }
];

function showScreen(id) {
  screens.forEach(name => {
    $(name).classList.toggle("active", name === id);
  });
}

function say(text) {
  const box = $("message");
  box.textContent = text;
  box.classList.add("show");

  clearTimeout(messageTimeout);

  messageTimeout = setTimeout(() => {
    box.classList.remove("show");
  }, 2300);
}

function saveProgress() {
  try {
    localStorage.setItem("valleyBloodSave", JSON.stringify({
      shift,
      woodCount
    }));
  } catch (e) {}
}

function loadProgress() {
  try {
    const data = JSON.parse(
      localStorage.getItem("valleyBloodSave") || "null"
    );

    if (!data) return;

    shift = Math.max(1, Math.min(13, Number(data.shift) || 1));
    woodCount = Math.max(
      0,
      Math.min(18, Number.isFinite(data.woodCount) ? data.woodCount : 18)
    );
  } catch (e) {}
}

function updateMenu() {
  $("menuProgress").textContent = "Последняя смена: " + shift;
}

function updateJournal() {
  const container = $("journalEntries");
  container.innerHTML = "";

  journal.forEach(entry => {
    const unlocked = shift >= entry.shift;
    const article = document.createElement("article");
    article.className = "journal-entry" + (unlocked ? "" : " locked");

    const heading = document.createElement("strong");
    heading.textContent = unlocked
      ? entry.title
      : "??? — запись закрыта";

    const paragraph = document.createElement("p");
    paragraph.textContent = unlocked
      ? entry.text
      : "Информация откроется после прохождения следующих смен.";

    article.append(heading, paragraph);
    container.appendChild(article);
  });
}

function resetEnemies() {
  nemka = {
    active: false,
    side: null,
    danger: 0,
    moveTimer: 6 + Math.random() * 5
  };

  nene = {
    active: false,
    danger: 0,
    moveTimer: 11 + Math.random() * 7
  };
}

function updateStatus() {
  $("shiftLabel").textContent = "Смена " + shift;
  $("batteryLabel").textContent = Math.ceil(battery) + "%";
  $("fireLabel").textContent = Math.ceil(fireLevel) + "%";

  const hour = Math.min(6, Math.floor(elapsed / shiftDuration * 6));
  $("timeLabel").textContent = hour === 0 ? "12 AM" : hour + " AM";

  $("fire").style.opacity = String(Math.max(.08, fireLevel / 100));
  $("fire").classList.toggle("low", fireLevel > 0 && fireLevel < 25);
  $("fire").classList.toggle("out", fireLevel <= 0);

  $("woodPile").textContent = woodCount > 0
    ? "🪵 ".repeat(Math.min(6, woodCount))
    : "Пусто";

  $("leftEnemy").classList.toggle(
    "visible",
    (nemka.active && nemka.side === "left") || nene.active
  );

  $("rightEnemy").classList.toggle(
    "visible",
    nemka.active && nemka.side === "right"
  );

  $("leftEnemy").classList.toggle("nene", nene.active);
  $("rightEnemy").classList.remove("nene");

  $("leftEnemy").setAttribute(
    "aria-label",
    nene.active ? "НеНе" : "Немка"
  );

  updateAlarmUI();
  updateCameraFeed();
  updateMenu();
}

function startShift() {
  clearInterval(gameInterval);
  clearTimeout(scareTimeout);
  clearTimeout(messageTimeout);

  running = true;
  paused = false;
  elapsed = 0;

  battery = 100;
  fireLevel = 70;
  hasWood = false;

  alarmReady = true;
  alarmBroken = false;
  alarmActive = false;
  alarmCooldown = 0;
  repairTime = 0;
  alarmDuration = 0;

  cameraOpen = false;
  repairOpen = false;

  draggingWood = false;
  dragPointerId = null;

  $("cameraPanel").classList.add("hidden");
  $("repairPanel").classList.add("hidden");
  $("pausePanel").classList.add("hidden");
  $("jumpscare").classList.add("hidden");
  $("jumpscare").classList.remove("nene-scare");
  $("carriedWood").style.display = "none";
  $("carriedWood").classList.remove("dragging");

  $("repairProgress").style.width = "0%";

  resetEnemies();
  setView("front");

  showScreen("office");
  updateStatus();

  say("Смена " + shift + ". Продержись до 6 AM.");

  gameInterval = setInterval(tick, 1000);
}

function tick() {
  if (!running || paused) return;

  elapsed++;

  // НЕМКА: появляется в левом или правом проходе.
  nemka.moveTimer--;

  if (nemka.moveTimer <= 0) {
    if (!nemka.active) {
      nemka.active = true;
      nemka.side = Math.random() < .5 ? "left" : "right";
      nemka.danger = 0;

      say("В одном из проходов послышались шаги!");
    } else {
      nemka.danger++;

      if (nemka.danger >= 8) {
        loseGame("НЕМКА");
        return;
      }
    }

    nemka.moveTimer = nemka.active
      ? 3 + Math.random() * 2
      : 7 + Math.random() * 6;
  }

  // НЕНЕ: появляется только со второй смены, только слева.
  if (shift >= 2) {
    nene.moveTimer--;

    if (nene.moveTimer <= 0) {
      if (!nene.active) {
        nene.active = true;
        nene.danger = 0;

        say("Слева слышен странный звук. Проверь камеры!");
      } else {
        nene.danger++;

        if (nene.danger >= 7) {
          loseGame("НЕНЕ");
          return;
        }
      }

      nene.moveTimer = nene.active
        ? 3
        : 10 + Math.random() * 8;
    }
  }

  // Батарея медленно расходуется.
  battery = Math.max(0, battery - .06);

  // Печь постепенно остывает.
  fireLevel = Math.max(0, fireLevel - .12);

  if (fireLevel <= 0 && elapsed % 8 === 0) {
    say("Огонь погасает! Возьми дрова и положи их в печку.");
  }

  // Перезарядка сигнализации.
  if (alarmCooldown > 0) {
    alarmCooldown--;

    if (alarmCooldown <= 0 && !alarmBroken) {
      alarmReady = true;
    }
  }

  // Сигнализация работает ограниченное время.
  if (alarmDuration > 0) {
    alarmDuration--;

    if (alarmDuration <= 0) {
      alarmActive = false;
      say("Сигнализация закончила работу.");
    }
  }

  // РЕМОНТ — 20 игровых секунд.
  if (repairTime > 0) {
    repairTime--;

    const percent = ((20 - repairTime) / 20) * 100;
    $("repairProgress").style.width = percent + "%";

    if (repairTime <= 0) {
      alarmBroken = false;
      alarmReady = true;
      alarmCooldown = 0;
      alarmActive = false;
      alarmDuration = 0;

      say("Сигнализация восстановлена!");
    }
  }

  // Активная сигнализация отгоняет НеНе.
  if (alarmActive && nene.active) {
    nene.active = false;
    nene.danger = 0;
    nene.moveTimer = 12 + Math.random() * 7;

    say("Сигнализация отпугнула НеНе!");
  }

  // НеНе может повредить сигнализацию, если её игнорировать.
  if (
    nene.active &&
    nene.danger >= 3 &&
    !alarmActive &&
    !alarmBroken &&
    Math.random() < .10
  ) {
    alarmBroken = true;
    alarmReady = false;
    alarmCooldown = 0;

    say("Сигнализация сломалась! Используй второй ноутбук.");
  }

  if (elapsed >= shiftDuration) {
    winShift();
    return;
  }

  updateStatus();
}

function setView(nextView) {
  view = nextView;

  const scene = $("officeScene");
  scene.classList.remove(
    "view-front", "view-left", "view-right", "view-back"
  );
  scene.classList.add("view-" + nextView);

  const wood = $("carriedWood");
  wood.style.display = hasWood ? "block" : "none";

  if (hasWood && !draggingWood) {
    wood.style.left = "10%";
    wood.style.top = "50%";
  }

  $("notice").textContent = {
    front: "ОФИС",
    left: "ЛЕВЫЙ ПРОХОД",
    right: "ПРАВЫЙ ПРОХОД",
    back: "КОМНАТА С ПЕЧКОЙ"
  }[nextView];

  $("stove").classList.remove("drop-ready");
  updateCameraFeed();
}

function flashlight() {
  if (!running || paused) return;

  if (battery < 8) {
    say("Недостаточно заряда для вспышки!");
    return;
  }

  if (view !== "left" && view !== "right") {
    say("Сначала посмотри в один из проходов.");
    return;
  }

  battery = Math.max(0, battery - 8);

  const beam = $("flashBeam");
  beam.classList.remove("active");
  void beam.offsetWidth;
  beam.classList.add("active");

  const flash = $("flashEffect");
  flash.classList.remove("flash");
  void flash.offsetWidth;
  flash.classList.add("flash");

  if (nemka.active && nemka.side === view) {
    nemka.active = false;
    nemka.side = null;
    nemka.danger = 0;
    nemka.moveTimer = 8 + Math.random() * 7;

    say("Немка испугалась вспышки и отступила!");
  } else if (nene.active && view === "left") {
    say("НеНе не боится фонарика! Включи сигнализацию.");
  } else {
    say("Вспышка осветила проход.");
  }

  updateStatus();
}

function takeWood() {
  if (!running || paused) return;

  if (view !== "back") {
    say("Повернись к печке, чтобы взять дрова.");
    return;
  }

  if (hasWood) {
    say("Ты уже держишь полено. Перетащи его на печку.");
    return;
  }

  if (woodCount <= 0) {
    say("Запас дров закончился.");
    return;
  }

  hasWood = true;
  woodCount--;

  const wood = $("carriedWood");
  wood.style.display = "block";
  wood.style.left = "10%";
  wood.style.top = "50%";

  say("Зажми полено и перетащи его на печку.");
  updateStatus();
}

function rectsOverlap(a, b) {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  );
}

function resetDraggedWood() {
  draggingWood = false;
  dragPointerId = null;

  $("carriedWood").classList.remove("dragging");
  $("stove").classList.remove("drop-ready");
}

const carriedWood = $("carriedWood");

carriedWood.addEventListener("pointerdown", event => {
  if (!running || paused || !hasWood || view !== "back") return;

  draggingWood = true;
  dragPointerId = event.pointerId;

  const rect = carriedWood.getBoundingClientRect();
  dragOffsetX = event.clientX - rect.left;
  dragOffsetY = event.clientY - rect.top;

  carriedWood.classList.add("dragging");

  try {
    carriedWood.setPointerCapture(event.pointerId);
  } catch (e) {}

  event.preventDefault();
});

carriedWood.addEventListener("pointermove", event => {
  if (!draggingWood || event.pointerId !== dragPointerId) return;

  const sceneRect = $("officeScene").getBoundingClientRect();

  const x = event.clientX - sceneRect.left - dragOffsetX;
  const y = event.clientY - sceneRect.top - dragOffsetY;

  carriedWood.style.left = x + "px";
  carriedWood.style.top = y + "px";

  const stoveRect = $("stove").getBoundingClientRect();
  const woodRect = carriedWood.getBoundingClientRect();

  const target = {
    left: stoveRect.left - 65,
    right: stoveRect.right + 65,
    top: stoveRect.top - 65,
    bottom: stoveRect.bottom + 65
  };

  $("stove").classList.toggle(
    "drop-ready",
    rectsOverlap(woodRect, target)
  );

  event.preventDefault();
});

carriedWood.addEventListener("pointerup", event => {
  if (!draggingWood || event.pointerId !== dragPointerId) return;

  const stoveRect = $("stove").getBoundingClientRect();
  const woodRect = carriedWood.getBoundingClientRect();

  // Большая зона сброса вокруг печки помогает на телефоне.
  const target = {
    left: stoveRect.left - 75,
    right: stoveRect.right + 75,
    top: stoveRect.top - 65,
    bottom: stoveRect.bottom + 65
  };

  const droppedOnStove = rectsOverlap(woodRect, target);

  resetDraggedWood();

  if (running && hasWood && view === "back" && droppedOnStove) {
    hasWood = false;
    carriedWood.style.display = "none";

    fireLevel = Math.min(100, fireLevel + 45);

    say("Полено попало в печку! Огонь усилился.");
    updateStatus();
  } else {
    carriedWood.style.left = "10%";
    carriedWood.style.top = "50%";

    if (view !== "back") {
      say("Сначала повернись к печке.");
    } else {
      say("Перетащи полено прямо на печку и отпусти.");
    }
  }

  event.preventDefault();
});

carriedWood.addEventListener("pointercancel", () => {
  resetDraggedWood();

  if (hasWood) {
    carriedWood.style.left = "10%";
    carriedWood.style.top = "50%";
  }
});

/* КАМЕРЫ */

function openCameras() {
  if (!running || paused) return;

  cameraOpen = true;
  repairOpen = false;

  $("repairPanel").classList.add("hidden");
  $("cameraPanel").classList.remove("hidden");

  updateCameraFeed();
  updateAlarmUI();
}

function closeCameras() {
  cameraOpen = false;
  $("cameraPanel").classList.add("hidden");
}

function updateCameraFeed() {
  const descriptions = {
    1: "КАМЕРА 01 — ГЛАВНЫЙ КОРИДОР",
    2: "КАМЕРА 02 — ЛЕВЫЙ ПРОХОД",
    3: "КАМЕРА 03 — ПРАВЫЙ ПРОХОД",
    4: "КАМЕРА 04 — КОМНАТА С ПЕЧКОЙ"
  };

  $("cameraFeedText").textContent = descriptions[selectedCamera];

  const enemy = $("cameraEnemy");
  enemy.textContent = "";
  enemy.style.color = "";

  if (selectedCamera === 2 && nene.active) {
    enemy.textContent = "◉";
    enemy.style.color = "#c77bff";
  } else if (
    selectedCamera === 2 &&
    nemka.active &&
    nemka.side === "left"
  ) {
    enemy.textContent = "☠";
    enemy.style.color = "#ff6969";
  } else if (
    selectedCamera === 3 &&
    nemka.active &&
    nemka.side === "right"
  ) {
    enemy.textContent = "☠";
    enemy.style.color = "#ff6969";
  } else if (selectedCamera === 4 && fireLevel > 0) {
    enemy.textContent = fireLevel < 25 ? "🔥" : "";
  }

  document.querySelectorAll(".camera-tile").forEach(button => {
    button.classList.toggle(
      "selected",
      Number(button.dataset.camera) === selectedCamera
    );
  });
}

function updateAlarmUI() {
  const button = $("alarmButton");
  const status = $("alarmStatus");
  const hint = $("alarmHint");

  button.className = "";

  if (alarmBroken) {
    status.textContent = repairTime > 0 ? "РЕМОНТ" : "СЛОМАНА";
    button.textContent = "СИГНАЛИЗАЦИЯ НЕ РАБОТАЕТ";
    button.className = "broken";
    button.disabled = true;
    hint.textContent = "Открой второй ноутбук и запусти ремонт.";
  } else if (repairTime > 0) {
    status.textContent = "РЕМОНТ";
    button.textContent = "ИДЁТ РЕМОНТ";
    button.className = "broken";
    button.disabled = true;
    hint.textContent = "Дождись завершения ремонта.";
  } else if (alarmActive) {
    status.textContent = "РАБОТАЕТ";
    button.textContent = "СИГНАЛИЗАЦИЯ ВКЛЮЧЕНА";
    button.className = "active-alarm";
    button.disabled = true;
    hint.textContent = "Сигнализация отпугивает НеНе.";
  } else if (alarmCooldown > 0) {
    status.textContent = "ПЕРЕЗАРЯДКА";
    button.textContent = "ПЕРЕЗАРЯДКА: " + alarmCooldown + " сек.";
    button.className = "recharging";
    button.disabled = true;
    hint.textContent = "Подожди окончания перезарядки.";
  } else {
    status.textContent = "ГОТОВА";
    button.textContent = "ВКЛЮЧИТЬ СИГНАЛИЗАЦИЮ";
    button.disabled = false;
    hint.textContent = "Отпугивает НеНе в левом проходе.";
  }

  $("repairStatus").textContent = alarmBroken
    ? (repairTime > 0 ? "Состояние: идёт ремонт" : "Состояние: сломана")
    : "Состояние: исправна";

  $("startRepairButton").disabled =
    !alarmBroken || repairTime > 0;
}

function activateAlarm() {
  if (!running || paused || !cameraOpen) return;

  if (alarmBroken || repairTime > 0) {
    say("Сигнализация сломана. Нужен ремонт.");
    return;
  }

  if (alarmCooldown > 0 || alarmActive || !alarmReady) {
    say("Сигнализация пока не готова.");
    return;
  }

  alarmReady = false;
  alarmActive = true;
  alarmDuration = 4;
  alarmCooldown = 12;

  if (nene.active) {
    nene.active = false;
    nene.danger = 0;
    nene.moveTimer = 12 + Math.random() * 7;

    say("Сигнализация сработала! НеНе отступила.");
  } else {
    say("Сигнализация включена.");
  }

  updateStatus();
}

function openRepair() {
  if (!running || paused) return;

  repairOpen = true;
  cameraOpen = false;

  $("cameraPanel").classList.add("hidden");
  $("repairPanel").classList.remove("hidden");

  updateAlarmUI();
}

function closeRepair() {
  repairOpen = false;
  $("repairPanel").classList.add("hidden");
}

function startRepair() {
  if (!running || paused) return;

  if (!alarmBroken) {
    say("Сигнализация исправна, ремонт не требуется.");
    return;
  }

  if (repairTime > 0) {
    say("Ремонт уже идёт.");
    return;
  }

  alarmActive = false;
  alarmReady = false;
  alarmCooldown = 0;
  alarmDuration = 0;
  repairTime = 20;

  $("repairProgress").style.width = "0%";

  say("Ремонт запущен. Подожди 20 секунд.");
  updateAlarmUI();
}

/* ПОБЕДА И ПОРАЖЕНИЕ */

function loseGame(enemyName) {
  if (!running) return;

  running = false;
  clearInterval(gameInterval);

  const jumpscare = $("jumpscare");
  const isNene = enemyName === "НЕНЕ";

  $("scareName").textContent = enemyName;
  $("scareCaption").textContent = isNene
    ? "ТЫ НЕ УСЛЫШАЛ СИГНАЛ..."
    : "ТЫ НЕ УСПЕЛ...";
  jumpscare.classList.toggle("nene-scare", isNene);
  jumpscare.classList.remove("hidden");

  if (navigator.vibrate) {
    navigator.vibrate([100, 60, 180, 60, 250]);
  }

  scareTimeout = setTimeout(() => {
    jumpscare.classList.add("hidden");

    $("resultTitle").textContent = "ТЫ ПРОИГРАЛ";
    $("resultText").textContent = isNene
      ? "НеНе добралась до офиса. Следи за сигнализацией и не забывай ремонтировать её."
      : "Немка добралась до офиса. Следи за проходами и используй вспышку.";

    $("resultContinue").textContent = "Повторить смену";
    showScreen("result");
  }, 1800);
}

function winShift() {
  running = false;
  clearInterval(gameInterval);

  const finishedShift = shift;

  if (finishedShift >= 13) {
    completedAllShifts = true;
    $("resultTitle").textContent = "6 AM — ВСЕ СМЕНЫ ПРОЙДЕНЫ";
    $("resultText").textContent =
      "Ты пережил все тринадцать смен. Но что-то всё ещё наблюдает за тобой...";
    $("resultContinue").textContent = "Начать заново";
  } else {
    shift = finishedShift + 1;
    completedAllShifts = false;

    $("resultTitle").textContent = "6 AM — СМЕНА ЗАВЕРШЕНА";
    $("resultText").textContent =
      "Ты пережил смену " + finishedShift +
      ". В следующую ночь опасность станет сильнее.";

    $("resultContinue").textContent = "Следующая смена";
  }

  saveProgress();
  updateJournal();
  updateMenu();
  showScreen("result");
}

function continueFromResult() {
  if (completedAllShifts) {
    shift = 1;
    woodCount = 18;
    completedAllShifts = false;
    saveProgress();
  }

  startShift();
}

/* ПАУЗА И МЕНЮ */

function pauseGame() {
  if (!running || paused) return;

  paused = true;
  $("pausePanel").classList.remove("hidden");
}

function resumeGame() {
  paused = false;
  $("pausePanel").classList.add("hidden");
}

function returnToMenu() {
  running = false;
  paused = false;

  clearInterval(gameInterval);
  clearTimeout(scareTimeout);
  clearTimeout(messageTimeout);

  $("pausePanel").classList.add("hidden");
  $("cameraPanel").classList.add("hidden");
  $("repairPanel").classList.add("hidden");
  $("jumpscare").classList.add("hidden");

  saveProgress();
  updateMenu();
  showScreen("menu");
}

/* КНОПКИ */

$("newGame").addEventListener("click", () => {
  shift = 1;
  woodCount = 18;
  completedAllShifts = false;

  saveProgress();
  startShift();
});

$("continueGame").addEventListener("click", () => {
  loadProgress();
  startShift();
});

$("openJournal").addEventListener("click", () => {
  updateJournal();
  showScreen("journal");
});

$("openSettings").addEventListener("click", () => {
  showScreen("settings");
});

$("journalBack").addEventListener("click", () => {
  showScreen("menu");
});

$("settingsBack").addEventListener("click", () => {
  showScreen("menu");
});

$("journalButton").addEventListener("click", () => {
  updateJournal();
  showScreen("journal");
});

$("lookLeft").addEventListener("click", () => {
  if (running && !paused) setView("left");
});

$("lookRight").addEventListener("click", () => {
  if (running && !paused) setView("right");
});

$("lookFront").addEventListener("click", () => {
  if (running && !paused) setView("front");
});

$("lookBack").addEventListener("click", () => {
  if (running && !paused) setView("back");
});

$("flashlightButton").addEventListener("click", flashlight);
$("takeWoodButton").addEventListener("click", takeWood);

$("cameraButton").addEventListener("click", openCameras);
$("camerasButton").addEventListener("click", openCameras);
$("closeCameras").addEventListener("click", closeCameras);

$("repairLaptopButton").addEventListener("click", openRepair);
$("closeRepair").addEventListener("click", closeRepair);
$("startRepairButton").addEventListener("click", startRepair);
$("alarmButton").addEventListener("click", activateAlarm);

document.querySelectorAll(".camera-tile").forEach(button => {
  button.addEventListener("click", () => {
    selectedCamera = Number(button.dataset.camera);
    updateCameraFeed();
  });
});

$("pauseButton").addEventListener("click", pauseGame);
$("resumeButton").addEventListener("click", resumeGame);
$("quitButton").addEventListener("click", returnToMenu);

$("resultContinue").addEventListener("click", continueFromResult);
$("resultMenu").addEventListener("click", returnToMenu);

$("shiftLength").addEventListener("change", event => {
  shiftDuration = Number(event.target.value) || 150;
});

$("volumeSetting").addEventListener("input", event => {
  event.target.title = "Громкость: " + event.target.value + "%";
});

/* ЗАПУСК */

loadProgress();
updateJournal();
updateStatus();
updateMenu();
showScreen("menu");
