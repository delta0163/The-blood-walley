
"use strict";

const $ = id => document.getElementById(id);

const screens = ["menu", "office", "journal", "settings", "result"];
const officeScene = $("officeScene");

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
let lastTick = 0;
let messageTimeout = null;

let cameraOpen = false;
let repairOpen = false;
let selectedCamera = 1;

let alarmReady = true;
let alarmBroken = false;
let alarmActive = false;
let alarmCooldown = 0;
let repairTime = 0;
let alarmDuration = 0;

let nemka = {
  active: false,
  side: null,
  danger: 0,
  moveTimer: 0
};

let nene = {
  active: false,
  danger: 0,
  moveTimer: 0
};

let draggingWood = false;
let dragPointerId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let gameInterval = null;
let scareTimeout = null;
let alarmRepairUsed = false;

const journal = [
  {
    shift: 1,
    title: "Запись 1 — Правый проход",
    text: "В проходах иногда появляется Немка. Она не любит яркий свет. Если заметишь её рядом, направь на неё вспышку фонарика. Но не трать батарею без необходимости."
  },
  {
    shift: 2,
    title: "Запись 2 — Левый проход",
    text: "Появилась НеНе. Она держится только в левом проходе. Обычная вспышка на неё не действует. Используй сигнализацию через камеры."
  },
  {
    shift: 2,
    title: "Запись 3 — Сигнализация",
    text: "Сигнализация не может работать бесконечно. После включения ей требуется время на перезарядку. Иногда она выходит из строя. Тогда открой второй ноутбук и запусти ремонт. На восстановление нужно около двадцати секунд."
  },
  {
    shift: 3,
    title: "Запись 4 — Наблюдение",
    text: "Пока доступна только часть записей. Продержись ещё несколько смен, чтобы узнать больше."
  }
];

function showScreen(id) {
  screens.forEach(name => $(name).classList.toggle("active", name === id));
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
      battery,
      fireLevel,
      woodCount
    }));
  } catch (e) {}
}

function loadProgress() {
  try {
    const data = JSON.parse(localStorage.getItem("valleyBloodSave") || "null");
    if (!data) return;

    shift = Math.max(1, Math.min(13, Number(data.shift) || 1));
    battery = Number.isFinite(data.battery) ? data.battery : 100;
    fireLevel = Number.isFinite(data.fireLevel) ? data.fireLevel : 70;
    woodCount = Number.isFinite(data.woodCount) ? data.woodCount : 18;
  } catch (e) {}
}

function updateStatus() {
  $("shiftLabel").textContent = "Смена " + shift;
  $("batteryLabel").textContent = Math.max(0, Math.ceil(battery)) + "%";
  $("fireLabel").textContent = Math.max(0, Math.ceil(fireLevel)) + "%";

  const hours = Math.min(6, Math.floor(elapsed / shiftDuration * 6));
  $("timeLabel").textContent = hours === 0 ? "12 AM" : hours + " AM";

  $("fire").style.opacity = String(Math.max(.15, fireLevel / 100));
  $("fire").style.filter = `drop-shadow(0 0 ${Math.max(1, fireLevel / 5)}px #ff4d0a)`;

  $("woodPile").textContent = woodCount > 0
    ? "🪵 ".repeat(Math.min(4, woodCount))
    : "Пусто";

  $("leftEnemy").classList.toggle("visible",
    nemka.active && nemka.side === "left" || nene.active);

  $("rightEnemy").classList.toggle("visible",
    nemka.active && nemka.side === "right");

  $("leftEnemy").classList.toggle("nene", nene.active);
  $("rightEnemy").classList.remove("nene");

  updateAlarmUI();
  updateJournal();
}

function updateJournal() {
  const container = $("journalEntries");
  container.innerHTML = "";

  journal.forEach(entry => {
    const unlocked = shift >= entry.shift;
    const article = document.createElement("article");
    article.className = "journal-entry" + (unlocked ? "" : " locked");

    const heading = document.createElement("strong");
    heading.textContent = unlocked ? entry.title : "??? — запись закрыта";

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
    moveTimer: 7 + Math.random() * 7
  };

  nene = {
    active: false,
    danger: 0,
    moveTimer: 13 + Math.random() * 7
  };
}

function startShift() {
  clearInterval(gameInterval);
  clearTimeout(scareTimeout);

  running = true;
  paused = false;
  elapsed = 0;
  lastTick = Date.now();

  battery = 100;
  fireLevel = 70;
  hasWood = false;

  alarmReady = true;
  alarmBroken = false;
  alarmActive = false;
  alarmCooldown = 0;
  repairTime = 0;
  alarmDuration = 0;
  alarmRepairUsed = false;

  cameraOpen = false;
  repairOpen = false;

  $("cameraPanel").classList.add("hidden");
  $("repairPanel").classList.add("hidden");
  $("pausePanel").classList.add("hidden");
  $("jumpscare").classList.add("hidden");
  $("carriedWood").style.display = "none";

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

  // Немка может появиться в любом из двух проходов.
  nemka.moveTimer--;

  if (nemka.moveTimer <= 0) {
    if (!nemka.active) {
      nemka.active = true;
      nemka.side = Math.random() < .5 ? "left" : "right";
      nemka.danger = 0;
      say("Ты слышишь шаги в одном из проходов...");
    } else {
      // Если Немка уже появилась, она приближается.
      nemka.danger += 1;

      if (nemka.danger >= 9) {
        loseGame("НЕМКА");
        return;
      }
    }

    nemka.moveTimer = nemka.active
      ? 4 + Math.random() * 3
      : 8 + Math.random() * 7;
  }

  // НеНе появляется только со второй смены и только слева.
  if (shift >= 2) {
    nene.moveTimer--;

    if (nene.moveTimer <= 0) {
      if (!nene.active) {
        nene.active = true;
        nene.danger = 0;
        say("Слева раздался странный звук. Проверь камеры!");
      } else {
        nene.danger++;

        if (nene.danger >= 8) {
          loseGame("НЕНЕ");
          return;
        }
      }

      nene.moveTimer = nene.active
        ? 4
        : 12 + Math.random() * 10;
    }
  }

  // Фонарь расходует батарею понемногу.
  battery = Math.max(0, battery - .08);

  // Огонь постепенно гаснет.
  fireLevel = Math.max(0, fireLevel - .11);

  if (fireLevel <= 0) {
    say("Огонь почти погас! Возьми дрова и добавь их в печку.");
  }

  if (alarmCooldown > 0) {
    alarmCooldown--;
    if (alarmCooldown <= 0 && !alarmBroken) {
      alarmReady = true;
    }
  }

  if (alarmDuration > 0) {
    alarmDuration--;
    if (alarmDuration <= 0) {
      alarmActive = false;
      say("Сигнализация закончила работу.");
    }
  }

  // Починка занимает ровно 20 игровых секунд.
  if (repairTime > 0) {
    repairTime--;

    const percent = ((20 - repairTime) / 20) * 100;
    $("repairProgress").style.width = percent + "%";

    if (repairTime <= 0) {
      alarmBroken = false;
      alarmReady = true;
      alarmCooldown = 0;
      alarmRepairUsed = false;
      say("Сигнализация восстановлена!");
    }
  }

  // Сигнализация отгоняет НеНе, если она активна.
  if (alarmActive && nene.active) {
    nene.active = false;
    nene.danger = 0;
    nene.moveTimer = 15 + Math.random() * 8;
    say("Сигнализация отпугнула НеНе!");
  }

  // Если НеНе долго остаётся рядом, сигнализация может сломаться.
  if (nene.active && nene.danger >= 4 && !alarmActive && !alarmBroken) {
    if (Math.random() < .08) {
      alarmBroken = true;
      alarmReady = false;
      say("Сигнализация вышла из строя! Открой второй ноутбук.");
    }
  }

  if (elapsed >= shiftDuration) {
    winShift();
    return;
  }

  updateStatus();
}

function setView(nextView) {
  view = nextView;
  officeScene.className = "office-scene view-" + nextView;
  $("carriedWood").style.display = hasWood ? "block" : "none";

  if (hasWood && !draggingWood) {
    $("carriedWood").style.left = "10%";
    $("carriedWood").style.top = "50%";
  }
}

function flashlight() {
  if (!running || paused) return;

  if (battery <= 0) {
    say("Батарея разряжена!");
    return;
  }

  if (view !== "left" && view !== "right") {
    say("Направь фонарь в один из проходов.");
    return;
  }

  battery = Math.max(0, battery - 8);

  const flash = $("flashEffect");
  flash.classList.remove("flash");
  void flash.offsetWidth;
  flash.classList.add("flash");

  const nemkaInView = nemka.active && nemka.side === view;

  if (nemkaInView) {
    nemka.active = false;
    nemka.side = null;
    nemka.danger = 0;
    nemka.moveTimer = 10 + Math.random() * 8;
    say("Немка отступила от яркого света.");
  } else if (nene.active && view === "left") {
    say("НеНе не боится фонарика! Используй сигнализацию.");
  } else {
    say("Вспышка осветила проход.");
  }

  updateStatus();
}

function takeWood() {
  if (!running || paused) return;

  if (view !== "back") {
    say("Сначала повернись к печке.");
    return;
  }

  if (hasWood) {
    say("Ты уже держишь полено.");
    return;
  }

  if (woodCount <= 0) {
    say("Дров больше нет.");
    return;
  }

  hasWood = true;
  woodCount--;

  const wood = $("carriedWood");
  wood.style.display = "block";
  wood.style.left = "10%";
  wood.style.top = "50%";

  say("Перетащи полено на печку.");
  updateStatus();
}

function rectsOverlap(a, b) {
  return a.left < b.right &&
         a.right > b.left &&
         a.top < b.bottom &&
         a.bottom > b.top;
}

function resetDraggedWood() {
  draggingWood = false;
  dragPointerId = null;
  $("carriedWood").classList.remove("dragging");
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

  const sceneRect = officeScene.getBoundingClientRect();

  const x = event.clientX - sceneRect.left - dragOffsetX;
  const y = event.clientY - sceneRect.top - dragOffsetY;

  carriedWood.style.left = x + "px";
  carriedWood.style.top = y + "px";
  event.preventDefault();
});

carriedWood.addEventListener("pointerup", event => {
  if (!draggingWood || event.pointerId !== dragPointerId) return;

  const stoveRect = $("stove").getBoundingClientRect();
  const fireRect = $("fire").getBoundingClientRect();
  const woodRect = carriedWood.getBoundingClientRect();

  // Проверяем пересечение всего полена с печкой, а не только точку пальца.
  const stoveTarget = {
    left: stoveRect.left - 45,
    right: stoveRect.right + 45,
    top: stoveRect.top - 45,
    bottom: stoveRect.bottom + 45
  };

  const fireTarget = {
    left: fireRect.left - 45,
    right: fireRect.right + 45,
    top: fireRect.top - 45,
    bottom: fireRect.bottom + 45
  };

  const droppedOnStove =
    rectsOverlap(woodRect, stoveTarget) ||
    rectsOverlap(woodRect, fireTarget);

  resetDraggedWood();

  if (running && hasWood && view === "back" && droppedOnStove) {
    hasWood = false;
    carriedWood.style.display = "none";
    fireLevel = Math.min(100, fireLevel + 45);
    say("Полено попало в печку! Огонь усилился.");
    updateStatus();
  } else if (view !== "back") {
    carriedWood.style.left = "10%";
    carriedWood.style.top = "50%";
    say("Сначала повернись к печке.");
  } else {
    carriedWood.style.left = "10%";
    carriedWood.style.top = "50%";
    say("Отпусти полено на большую область печки.");
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

  let enemyText = "";

  if (selectedCamera === 2 && nene.active) {
    enemyText = "👁️";
  } else if (selectedCamera === 2 && nemka.active && nemka.side === "left") {
    enemyText = "☠️";
  } else if (selectedCamera === 3 && nemka.active && nemka.side === "right") {
    enemyText = "☠️";
  } else if (selectedCamera === 4 && fireLevel < 30) {
    enemyText = "🔥";
  }

  $("cameraEnemy").textContent = enemyText;

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
    hint.textContent = "Подожди завершения ремонта.";
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
    hint.textContent = "Дождись окончания перезарядки.";
  } else {
    status.textContent = "ГОТОВА";
    button.textContent = "ВКЛЮЧИТЬ СИГНАЛИЗАЦИЮ";
    button.className = "";
    button.disabled = false;
    hint.textContent = "Отпугивает НеНе в левом проходе.";
  }

  $("repairStatus").textContent = alarmBroken
    ? (repairTime > 0 ? "Состояние: идёт ремонт" : "Состояние: сломана")
    : "Состояние: исправна";

  $("startRepairButton").disabled = !alarmBroken || repairTime > 0;
}

function activateAlarm() {
  if (!running || paused || !cameraOpen) return;

  if (alarmBroken || repairTime > 0) {
    say("Сигнализация неисправна. Нужен ремонт.");
    return;
  }

  if (!alarmReady || alarmCooldown > 0 || alarmActive) {
    say("Сигнализация пока не готова.");
    return;
  }

  alarmReady = false;
  alarmActive = true;
  alarmDuration = 4;
  alarmCooldown = 12;

  // НеНе отступает сразу после сигнала.
  if (nene.active) {
    nene.active = false;
    nene.danger = 0;
    nene.moveTimer = 15 + Math.random() * 7;
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
  repairTime = 20;
  alarmRepairUsed = true;

  $("repairProgress").style.width = "0%";
  say("Ремонт запущен. Нужно подождать 20 секунд.");
  updateAlarmUI();
}

function loseGame(enemyName) {
  if (!running) return;

  running = false;
  clearInterval(gameInterval);

  $("scareName").textContent = enemyName;
  $("jumpscare").classList.remove("hidden");

  if (navigator.vibrate) {
    navigator.vibrate([100, 60, 180, 60, 250]);
  }

  scareTimeout = setTimeout(() => {
    $("jumpscare").classList.add("hidden");

    $("resultTitle").textContent = "ТЫ ПРОИГРАЛ";
    $("resultText").textContent =
      enemyName + " добралась до офиса. Попробуй ещё раз и следи за проходами.";
    $("resultContinue").textContent = "Повторить смену";
    showScreen("result");
  }, 1800);
}

function winShift() {
  running = false;
  clearInterval(gameInterval);

  const completedShift = shift;
  shift = Math.min(13, shift + 1);
  saveProgress();

  $("resultTitle").textContent = "6 AM — СМЕНА ЗАВЕРШЕНА";
  $("resultText").textContent = completedShift >= 13
    ? "Ты пережил все смены. Но что-то всё ещё наблюдает за тобой..."
    : "Ты пережил смену " + completedShift + ". В следующую ночь появятся новые опасности.";

  $("resultContinue").textContent = completedShift >= 13
    ? "Начать заново"
    : "Следующая смена";

  showScreen("result");
}

function continueFromResult() {
  if (shift > 13) shift = 1;

  if (shift >= 14) {
    shift = 1;
  }

  startShift();
}

function pauseGame() {
  if (!running) return;

  paused = true;
  $("pausePanel").classList.remove("hidden");
}

function resumeGame() {
  paused = false;
  $("pausePanel").classList.add("hidden");
  lastTick = Date.now();
}

function returnToMenu() {
  running = false;
  paused = false;
  clearInterval(gameInterval);
  clearTimeout(scareTimeout);

  $("pausePanel").classList.add("hidden");
  $("cameraPanel").classList.add("hidden");
  $("repairPanel").classList.add("hidden");
  $("jumpscare").classList.add("hidden");

  saveProgress();
  showScreen("menu");
}

$("newGame").addEventListener("click", () => {
  shift = 1;
  woodCount = 18;
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

$("openSettings").addEventListener("click", () => showScreen("settings"));
$("journalBack").addEventListener("click", () => showScreen("menu"));
$("settingsBack").addEventListener("click", () => showScreen("menu"));

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

$("resultContinue").addEventListener("click", () => {
  if (shift > 13) {
    shift = 1;
    woodCount = 18;
  }
  startShift();
});

$("resultMenu").addEventListener("click", returnToMenu);

$("shiftLength").addEventListener("change", event => {
  shiftDuration = Number(event.target.value) || 150;
});

$("volumeSetting").addEventListener("input", event => {
  // Уровень звука можно подключить к аудиоэффектам позже.
  event.target.title = "Громкость: " + event.target.value + "%";
});

loadProgress();
updateJournal();
updateStatus();
showScreen("menu");
