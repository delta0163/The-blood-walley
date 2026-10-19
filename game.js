"use strict";

const $ = id => document.getElementById(id);
const screens = ["menu", "office", "journal", "settings", "result"];
const scene = $("officeScene");

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
let gameInterval = null;
let messageTimeout = null;
let scareTimeout = null;

let cameraOpen = false;
let alarmBroken = false;
let alarmActive = false;
let alarmCooldown = 0;
let alarmDuration = 0;
let repairTime = 0;
let selectedCamera = 1;

let nemka = {
  active: false,
  side: null,
  danger: 0,
  moveTimer: 8
};

let nene = {
  active: false,
  danger: 0,
  moveTimer: 14
};

/* Тилл / Дельта */
let delta = {
  active: false,
  entered: false,
  defeated: false,
  moveTimer: 20,
  breachTimer: 0,
  danger: 0
};

/* Дробовик: 2 патрона заряжено, 4 запасных */
let shotgunOwned = false;
let aiming = false;
let ammoLoaded = 2;
let ammoReserve = 4;
let crosshairX = 50;
let crosshairY = 50;

let draggingWood = false;
let dragId = null;
let dragX = 0;
let dragY = 0;

const journal = [
  {
    shift: 1,
    title: "Запись 1 — Проходы",
    text: "Немка появляется в левом или правом проходе. Направь на неё вспышку фонаря."
  },
  {
    shift: 2,
    title: "Запись 2 — НеНе",
    text: "НеНе держится слева и не боится фонарика. Используй сигнализацию в меню камер."
  },
  {
    shift: 2,
    title: "Запись 3 — Сигнализация",
    text: "Сигнализация перезаряжается. Если сломается, открой второй ноутбук и ремонтируй её 20 секунд."
  },
  {
    shift: 3,
    title: "Запись 4 — Тилл / Дельта",
    text: "С третьей смены Тилл / Дельта лезет через центральное окно. Когда он окажется внутри, повернись к печке, возьми дробовик, наведи прицел на него и стреляй. В дробовике 2 патрона и 4 запасных."
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
  }, 2500);
}

function save() {
  try {
    localStorage.setItem("valleyBloodSave", JSON.stringify({
      shift,
      woodCount
    }));
  } catch (e) {}
}

function load() {
  try {
    const data = JSON.parse(
      localStorage.getItem("valleyBloodSave") || "null"
    );

    if (data) {
      shift = Math.max(1, Math.min(13, Number(data.shift) || 1));
      woodCount = Number(data.woodCount) || 18;
    }
  } catch (e) {}
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

  delta = {
    active: false,
    entered: false,
    defeated: false,
    moveTimer: 20,
    breachTimer: 0,
    danger: 0
  };

  shotgunOwned = false;
  aiming = false;
  ammoLoaded = 2;
  ammoReserve = 4;

  $("aimPanel").classList.add("hidden");
}

function updateJournal() {
  const container = $("journalEntries");
  container.innerHTML = "";

  journal.forEach(entry => {
    const unlocked = shift >= entry.shift;
    const article = document.createElement("article");
    const heading = document.createElement("b");
    const paragraph = document.createElement("p");

    article.className =
      "journal-entry" + (unlocked ? "" : " locked");

    heading.textContent = unlocked
      ? entry.title
      : "??? — запись закрыта";

    paragraph.textContent = unlocked
      ? entry.text
      : "Откроется после следующих смен.";

    article.append(heading, paragraph);
    container.appendChild(article);
  });
}

function updateAlarm() {
  const button = $("alarmButton");

  if (alarmBroken) {
    $("alarmStatus").textContent = repairTime
      ? "РЕМОНТ"
      : "СЛОМАНА";

    button.textContent = "СИГНАЛИЗАЦИЯ НЕ РАБОТАЕТ";
    button.disabled = true;
    $("alarmHint").textContent =
      "Открой второй ноутбук для ремонта.";
  } else if (alarmActive) {
    $("alarmStatus").textContent = "РАБОТАЕТ";
    button.textContent = "СИГНАЛИЗАЦИЯ ВКЛЮЧЕНА";
    button.disabled = true;
    $("alarmHint").textContent =
      "Сигнализация отпугивает НеНе.";
  } else if (alarmCooldown > 0) {
    $("alarmStatus").textContent = "ПЕРЕЗАРЯДКА";
    button.textContent = "ПЕРЕЗАРЯДКА: " + alarmCooldown + " сек.";
    button.disabled = true;
  } else {
    $("alarmStatus").textContent = "ГОТОВА";
    button.textContent = "ВКЛЮЧИТЬ СИГНАЛИЗАЦИЮ";
    button.disabled = false;
    $("alarmHint").textContent =
      "Отпугивает НеНе в левом проходе.";
  }

  $("repairStatus").textContent = alarmBroken
    ? "Состояние: " + (repairTime ? "идёт ремонт" : "сломана")
    : "Состояние: исправна";

  $("startRepairButton").disabled =
    !alarmBroken || repairTime > 0;
}

function updateCameras() {
  const descriptions = {
    1: "КАМЕРА 01 — ГЛАВНЫЙ КОРИДОР",
    2: "КАМЕРА 02 — ЛЕВЫЙ ПРОХОД",
    3: "КАМЕРА 03 — ПРАВЫЙ ПРОХОД",
    4: "КАМЕРА 04 — ПЕЧКА",
    5: "КАМЕРА 05 — ЦЕНТРАЛЬНОЕ ОКНО"
  };

  $("cameraFeedText").textContent = descriptions[selectedCamera];

  let enemyText = "";

  if (selectedCamera === 2 && nene.active) {
    enemyText = "НЕНе: 👁";
  } else if (
    selectedCamera === 2 &&
    nemka.active &&
    nemka.side === "left"
  ) {
    enemyText = "НЕМКА: ☠";
  } else if (
    selectedCamera === 3 &&
    nemka.active &&
    nemka.side === "right"
  ) {
    enemyText = "НЕМКА: ☠";
  } else if (selectedCamera === 4 && fireLevel < 30) {
    enemyText = "ОГОНЬ СЛАБЕЕТ";
  } else if (selectedCamera === 5 && delta.active) {
    enemyText = "ТИЛЛ / ДЕЛЬТА У ОКНА";
  }

  $("cameraEnemy").textContent = enemyText;

  document.querySelectorAll(".camera-tile").forEach(button => {
    button.classList.toggle(
      "selected",
      Number(button.dataset.camera) === selectedCamera
    );
  });
}

function update() {
  $("shiftLabel").textContent = "Смена " + shift;
  $("batteryLabel").textContent = Math.ceil(battery) + "%";
  $("fireLabel").textContent = Math.ceil(fireLevel) + "%";

  const hours = Math.min(
    6,
    Math.floor(elapsed / shiftDuration * 6)
  );

  $("timeLabel").textContent =
    hours === 0 ? "12 AM" : hours + " AM";

  $("fire").style.opacity = Math.max(.15, fireLevel / 100);

  $("woodPile").textContent = woodCount > 0
    ? "🪵 ".repeat(Math.min(4, woodCount))
    : "Пусто";

  $("leftEnemy").classList.toggle(
    "visible",
    (nemka.active && nemka.side === "left") || nene.active
  );

  $("leftEnemy").classList.toggle("nene", nene.active);

  $("rightEnemy").classList.toggle(
    "visible",
    nemka.active && nemka.side === "right"
  );

  $("deltaAtWindow").classList.toggle(
    "visible",
    delta.active && !delta.entered
  );

  $("deltaWindow").classList.toggle(
    "threatened",
    delta.active && !delta.entered
  );

  $("shotgunPickup").classList.toggle(
    "hidden",
    !(running && !paused && view === "back" &&
      delta.entered && !shotgunOwned)
  );

  $("ammoLoaded").textContent = ammoLoaded;
  $("ammoReserve").textContent = ammoReserve;

  updateAlarm();
  updateCameras();
  updateJournal();
}

function startShift() {
  clearInterval(gameInterval);
  clearTimeout(scareTimeout);

  running = true;
  paused = false;
  elapsed = 0;

  battery = 100;
  fireLevel = 70;
  hasWood = false;

  alarmBroken = false;
  alarmActive = false;
  alarmCooldown = 0;
  alarmDuration = 0;
  repairTime = 0;

  cameraOpen = false;

  resetEnemies();

  $("cameraPanel").classList.add("hidden");
  $("repairPanel").classList.add("hidden");
  $("pausePanel").classList.add("hidden");
  $("jumpscare").classList.add("hidden");
  $("carriedWood").style.display = "none";

  setView("front");
  showScreen("office");
  update();

  say("Смена " + shift + ". Продержись до 6 AM.");

  gameInterval = setInterval(tick, 1000);
}

function tick() {
  if (!running || paused) return;

  elapsed++;

  /* НЕМКА */
  nemka.moveTimer--;

  if (nemka.moveTimer <= 0) {
    if (!nemka.active) {
      nemka.active = true;
      nemka.side = Math.random() < .5 ? "left" : "right";
      nemka.danger = 0;

      say("Ты слышишь шаги в одном из проходов...");
    } else {
      nemka.danger++;

      if (nemka.danger >= 9) {
        lose("НЕМКА");
        return;
      }
    }

    nemka.moveTimer = nemka.active
      ? 4 + Math.random() * 3
      : 8 + Math.random() * 7;
  }

  /* НЕНе */
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
          lose("НЕНЕ");
          return;
        }
      }

      nene.moveTimer = nene.active
        ? 4
        : 12 + Math.random() * 10;
    }
  }

  /* ТИЛЛ / ДЕЛЬТА — ТОЛЬКО С ТРЕТЬЕЙ СМЕНЫ */
  if (shift >= 3 && !delta.defeated) {
    if (!delta.active && !delta.entered) {
      delta.moveTimer--;

      if (delta.moveTimer <= 0) {
        delta.active = true;
        delta.breachTimer = 7;

        say("ТИЛЛ / ДЕЛЬТА ЛЕЗЕТ ЧЕРЕЗ ЦЕНТРАЛЬНОЕ ОКНО!");
      }
    } else if (delta.active && !delta.entered) {
      delta.breachTimer--;

      if (delta.breachTimer <= 0) {
        delta.active = false;
        delta.entered = true;
        delta.danger = 0;

        say(
          "ТИЛЛ / ДЕЛЬТА ПРОБРАЛСЯ ВНУТРЬ! " +
          "Повернись к печке и возьми дробовик!"
        );
      }
    } else if (delta.entered && !aiming) {
      delta.danger++;

      if (delta.danger >= 12) {
        lose("ТИЛЛ / ДЕЛЬТА");
        return;
      }
    }
  }

  /* БАТАРЕЯ И ОГОНЬ */
  battery = Math.max(0, battery - .08);
  fireLevel = Math.max(0, fireLevel - .11);

  if (fireLevel <= 0 && elapsed % 8 === 0) {
    say("Огонь почти погас! Возьми дрова.");
  }

  /* ПЕРЕЗАРЯДКА СИГНАЛИЗАЦИИ */
  if (alarmCooldown > 0) {
    alarmCooldown--;
  }

  if (alarmDuration > 0) {
    alarmDuration--;

    if (alarmDuration <= 0) {
      alarmActive = false;
      say("Сигнализация закончила работу.");
    }
  }

  /* РЕМОНТ */
  if (repairTime > 0) {
    repairTime--;

    $("repairProgress").style.width =
      ((20 - repairTime) / 20 * 100) + "%";

    if (repairTime <= 0) {
      alarmBroken = false;
      alarmCooldown = 0;

      say("Сигнализация восстановлена!");
    }
  }

  /* СИГНАЛИЗАЦИЯ ОТПУГИВАЕТ НЕНе */
  if (alarmActive && nene.active) {
    nene.active = false;
    nene.danger = 0;
    nene.moveTimer = 15;

    say("Сигнализация отпугнула НеНе!");
  }

  /* НЕНе МОЖЕТ СЛОМАТЬ СИГНАЛИЗАЦИЮ */
  if (
    nene.active &&
    nene.danger >= 4 &&
    !alarmActive &&
    !alarmBroken &&
    Math.random() < .08
  ) {
    alarmBroken = true;
    say("Сигнализация сломалась! Открой второй ноутбук.");
  }

  if (elapsed >= shiftDuration) {
    win();
    return;
  }

  update();
}

function setView(nextView) {
  view = nextView;
  scene.className = "office-scene view-" + nextView;

  $("carriedWood").style.display = hasWood ? "block" : "none";

  if (hasWood && !draggingWood) {
    $("carriedWood").style.left = "10%";
    $("carriedWood").style.top = "50%";
  }

  update();
}

function flashlight() {
  if (!running || paused) return;

  if (battery <= 0) {
    say("Батарея разряжена!");
    return;
  }

  if (view !== "left" && view !== "right") {
    say("Направь фонарь в проход.");
    return;
  }

  battery = Math.max(0, battery - 8);

  const flash = $("flashEffect");
  flash.classList.remove("flash");
  void flash.offsetWidth;
  flash.classList.add("flash");

  if (nemka.active && nemka.side === view) {
    nemka.active = false;
    nemka.side = null;
    nemka.danger = 0;
    nemka.moveTimer = 12;

    say("Немка отступила от света.");
  } else if (nene.active && view === "left") {
    say("НеНе не боится фонарика! Используй сигнализацию.");
  } else {
    say("Вспышка осветила проход.");
  }

  update();
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

  $("carriedWood").style.display = "block";
  $("carriedWood").style.left = "10%";
  $("carriedWood").style.top = "50%";

  say("Перетащи полено на печку.");
  update();
}

/* ПЕРЕТАСКИВАНИЕ ДРОВ */
const wood = $("carriedWood");

wood.addEventListener("pointerdown", event => {
  if (!running || paused || !hasWood || view !== "back") return;

  draggingWood = true;
  dragId = event.pointerId;

  const rect = wood.getBoundingClientRect();

  dragX = event.clientX - rect.left;
  dragY = event.clientY - rect.top;

  wood.classList.add("dragging");

  try {
    wood.setPointerCapture(event.pointerId);
  } catch (e) {}

  event.preventDefault();
});

wood.addEventListener("pointermove", event => {
  if (!draggingWood || event.pointerId !== dragId) return;

  const rect = scene.getBoundingClientRect();

  wood.style.left =
    (event.clientX - rect.left - dragX) + "px";

  wood.style.top =
    (event.clientY - rect.top - dragY) + "px";
});

wood.addEventListener("pointerup", () => {
  if (!draggingWood) return;

  draggingWood = false;
  dragId = null;
  wood.classList.remove("dragging");

  const a = wood.getBoundingClientRect();
  const b = $("stove").getBoundingClientRect();

  const droppedOnStove =
    a.right > b.left - 40 &&
    a.left < b.right + 40 &&
    a.bottom > b.top - 40 &&
    a.top < b.bottom + 40;

  if (view === "back" && hasWood && droppedOnStove) {
    hasWood = false;
    wood.style.display = "none";

    fireLevel = Math.min(100, fireLevel + 45);

    say("Полено попало в печку! Огонь усилился.");
  } else {
    wood.style.left = "10%";
    wood.style.top = "50%";

    say("Отпусти полено на печку.");
  }

  update();
});

wood.addEventListener("pointercancel", () => {
  draggingWood = false;
  dragId = null;
  wood.classList.remove("dragging");

  if (hasWood) {
    wood.style.left = "10%";
    wood.style.top = "50%";
  }
});

/* КАМЕРЫ */
function openCameras() {
  if (!running || paused) return;

  cameraOpen = true;

  $("repairPanel").classList.add("hidden");
  $("cameraPanel").classList.remove("hidden");

  updateCameras();
}

function closeCameras() {
  $("cameraPanel").classList.add("hidden");
  cameraOpen = false;
}

function openRepair() {
  if (!running || paused) return;

  $("cameraPanel").classList.add("hidden");
  $("repairPanel").classList.remove("hidden");
}

function closeRepair() {
  $("repairPanel").classList.add("hidden");
}

/* СИГНАЛИЗАЦИЯ */
function alarm() {
  if (
    !running ||
    paused ||
    $("cameraPanel").classList.contains("hidden")
  ) {
    return;
  }

  if (alarmBroken || repairTime > 0) {
    say("Сигнализация сломана.");
    return;
  }

  if (alarmCooldown > 0 || alarmActive) {
    say("Сигнализация ещё не готова.");
    return;
  }

  alarmActive = true;
  alarmDuration = 4;
  alarmCooldown = 12;

  if (nene.active) {
    nene.active = false;
    nene.danger = 0;
    nene.moveTimer = 15;

    say("Сигнализация отпугнула НеНе!");
  } else {
    say("Сигнализация включена.");
  }

  update();
}

function repair() {
  if (!alarmBroken) {
    say("Сигнализация исправна.");
    return;
  }

  if (repairTime > 0) {
    say("Ремонт уже идёт.");
    return;
  }

  alarmActive = false;
  alarmCooldown = 0;
  repairTime = 20;

  $("repairProgress").style.width = "0%";

  say("Ремонт запущен. Подожди 20 секунд.");
  update();
}

/* ПРОИГРЫШ */
function lose(name) {
  if (!running) return;

  running = false;
  clearInterval(gameInterval);
  aiming = false;

  $("aimPanel").classList.add("hidden");
  $("scareName").textContent = name;
  $("jumpscare").classList.remove("hidden");

  if (navigator.vibrate) {
    navigator.vibrate([100, 60, 180]);
  }

  scareTimeout = setTimeout(() => {
    $("jumpscare").classList.add("hidden");

    $("resultTitle").textContent = "ТЫ ПРОИГРАЛ";
    $("resultText").textContent =
      name + " добралась до офиса. Попробуй ещё раз.";

    $("resultContinue").textContent = "Повторить смену";
    showScreen("result");
  }, 1700);
}

/* ПОБЕДА */
function win() {
  running = false;
  clearInterval(gameInterval);

  const completedShift = shift;
  shift = Math.min(13, shift + 1);

  save();

  $("resultTitle").textContent = "6 AM — СМЕНА ЗАВЕРШЕНА";

  $("resultText").textContent = completedShift >= 13
    ? "Ты пережил все смены. Но что-то всё ещё наблюдает за тобой..."
    : "Ты пережил смену " + completedShift +
      ". В следующую ночь появятся новые опасности.";

  $("resultContinue").textContent =
    completedShift >= 13 ? "Начать заново" : "Следующая смена";

  showScreen("result");
}

/* ВЗЯТЬ ДРОБОВИК */
$("shotgunPickup").addEventListener("click", () => {
  if (
    !running ||
    paused ||
    view !== "back" ||
    !delta.entered
  ) {
    return;
  }

  shotgunOwned = true;
  aiming = true;

  crosshairX = 50;
  crosshairY = 50;

  $("aimPanel").classList.remove("hidden");
  $("crosshair").style.left = "50%";
  $("crosshair").style.top = "50%";

  say("Наведи прицел на Тилла / Дельту!");
});

/* УПРАВЛЕНИЕ ПРИЦЕЛОМ */
function moveAim(event) {
  const rect = $("aimScene").getBoundingClientRect();

  crosshairX = Math.max(
    3,
    Math.min(97, (event.clientX - rect.left) / rect.width * 100)
  );

  crosshairY = Math.max(
    5,
    Math.min(90, (event.clientY - rect.top) / rect.height * 100)
  );

  $("crosshair").style.left = crosshairX + "%";
  $("crosshair").style.top = crosshairY + "%";
}

$("aimScene").addEventListener("pointerdown", event => {
  if (!aiming) return;

  moveAim(event);

  try {
    $("aimScene").setPointerCapture(event.pointerId);
  } catch (e) {}

  event.preventDefault();
});

$("aimScene").addEventListener("pointermove", event => {
  if (aiming && (event.pointerType !== "mouse" || event.buttons)) {
    moveAim(event);
  }
});

/* ВЫСТРЕЛ */
$("shootButton").addEventListener("click", () => {
  if (!aiming || !running || paused) return;

  if (ammoLoaded <= 0) {
    say("Патроны закончились! Перезаряди дробовик.");
    return;
  }

  ammoLoaded--;

  /*
    Тилл / Дельта находится примерно в центре-справа.
    Прицел должен попасть в область его фигуры.
  */
  const hit =
    crosshairX >= 56 &&
    crosshairX <= 80 &&
    crosshairY >= 28 &&
    crosshairY <= 62;

  if (hit) {
    delta.entered = false;
    delta.active = false;
    delta.defeated = true;
    delta.danger = 0;

    aiming = false;
    shotgunOwned = false;

    $("aimPanel").classList.add("hidden");

    say("ПОПАДАНИЕ! Тилл / Дельта отступил.");
    update();
  } else {
    say("Промах! Наведи прицел на фигуру в окне.");
  }

  update();
});

/* ПЕРЕЗАРЯДКА */
$("reloadButton").addEventListener("click", () => {
  if (!aiming) return;

  if (ammoLoaded >= 2) {
    say("Дробовик уже заряжен.");
    return;
  }

  if (ammoReserve <= 0) {
    say("Запасные патроны закончились!");
    return;
  }

  const amount = Math.min(
    2 - ammoLoaded,
    ammoReserve
  );

  ammoLoaded += amount;
  ammoReserve -= amount;

  say("Дробовик перезаряжен.");
  update();
});

/* ОПУСТИТЬ ДРОБОВИК */
$("lowerShotgunButton").addEventListener("click", () => {
  aiming = false;
  $("aimPanel").classList.add("hidden");

  if (delta.entered) {
    say("Тилл / Дельта всё ещё в офисе!");
  }
});

/* МЕНЮ */
$("newGame").onclick = () => {
  shift = 1;
  woodCount = 18;
  save();
  startShift();
};

$("continueGame").onclick = () => {
  load();
  startShift();
};

$("openJournal").onclick = () => {
  updateJournal();
  showScreen("journal");
};

$("openSettings").onclick = () => showScreen("settings");
$("journalBack").onclick = () => showScreen("menu");
$("settingsBack").onclick = () => showScreen("menu");

$("lookLeft").onclick = () => {
  if (running && !paused) setView("left");
};

$("lookRight").onclick = () => {
  if (running && !paused) setView("right");
};

$("lookFront").onclick = () => {
  if (running && !paused) setView("front");
};

$("lookBack").onclick = () => {
  if (running && !paused) setView("back");
};

$("flashlightButton").onclick = flashlight;
$("takeWoodButton").onclick = takeWood;
$("cameraButton").onclick = openCameras;
$("camerasButton").onclick = openCameras;
$("closeCameras").onclick = closeCameras;

$("repairLaptopButton").onclick = openRepair;
$("closeRepair").onclick = closeRepair;
$("startRepairButton").onclick = repair;
$("alarmButton").onclick = alarm;

document.querySelectorAll(".camera-tile").forEach(button => {
  button.onclick = () => {
    selectedCamera = Number(button.dataset.camera);
    updateCameras();
  };
});

$("pauseButton").onclick = () => {
  if (!running) return;

  paused = true;
  $("pausePanel").classList.remove("hidden");
};

$("resumeButton").onclick = () => {
  paused = false;
  $("pausePanel").classList.add("hidden");
};

$("quitButton").onclick = () => {
  running = false;
  paused = false;
  clearInterval(gameInterval);

  $("pausePanel").classList.add("hidden");
  $("cameraPanel").classList.add("hidden");
  $("repairPanel").classList.add("hidden");

  showScreen("menu");
};

$("resultContinue").onclick = () => {
  if (shift >= 14) {
    shift = 1;
    woodCount = 18;
  }

  startShift();
};

$("resultMenu").onclick = () => {
  running = false;
  clearInterval(gameInterval);
  showScreen("menu");
};

$("journalButton").onclick = () => {
  updateJournal();
  showScreen("journal");
};

$("shiftLength").onchange = event => {
  shiftDuration = Number(event.target.value) || 150;
};

$("volumeSetting").oninput = event => {
  event.target.title = "Громкость: " + event.target.value + "%";
};

/* ПЕРВЫЙ ЗАПУСК */
load();
updateJournal();
update();
showScreen("menu");
