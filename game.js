
const $ = id => document.getElementById(id);

const office = $("office");
const message = $("message");
const notice = $("notice");
const beam = $("flashBeam");
const flashlight = $("heldFlashlight");
const batterySlot = $("batterySlot");
const carriedWood = $("carriedWood");
const stove = $("stove");

let view = "front";
let running = true;
let hasFlashlight = false;
let spareBatteries = 0;
let flashlightCharge = 100;
let hasWood = false;
let fireLevel = 100;
let enemyPresent = false;
let seconds = 0;
let swipeStartX = 0;
let swipeStartY = 0;
let swipeStarted = false;
let draggingWood = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let beamTimer = null;

function notify(text) {
  notice.textContent = text;
}

function say(text, duration = 1800) {
  message.textContent = text;

  if (duration > 0) {
    setTimeout(() => {
      if (message.textContent === text) {
        message.textContent = "";
      }
    }, duration);
  }
}

function updateStatus() {
  $("flashStatus").textContent = hasFlashlight
    ? `в руке (${flashlightCharge}%)`
    : "на столе";

  $("batteryStatus").textContent = `${spareBatteries} батареек`;

  $("woodStatus").textContent = hasWood
    ? "в руках"
    : $("woodItem").classList.contains("taken")
      ? "в печке"
      : "на столе";

  $("fireStatus").textContent =
    fireLevel > 65 ? "горит хорошо" :
    fireLevel > 25 ? "слабеет" :
    "почти погас";

  $("fire").classList.toggle(
    "low",
    fireLevel <= 35 && fireLevel > 0
  );

  $("fire").classList.toggle("out", fireLevel <= 0);

  flashlight.classList.toggle("hidden", !hasFlashlight);

  batterySlot.classList.toggle(
    "hidden",
    !hasFlashlight || spareBatteries <= 0
  );

  batterySlot.style.opacity =
    flashlightCharge <= 0 ? "1" : ".45";

  $("flashCharge").classList.toggle("hidden", !hasFlashlight);

  $("flashChargeFill").style.width = flashlightCharge + "%";

  $("flashChargeFill").style.background =
    flashlightCharge <= 20 ? "#c33" : "#d4d47a";

  carriedWood.classList.toggle(
    "hidden",
    !hasWood || view !== "back"
  );
}

function turnTo(nextView) {
  if (!running) return;

  view = nextView;
  office.className = "office " + view;

  if (view === "front") {
    notify("Ты смотришь прямо на стол.");
  } else if (view === "left") {
    notify("Левый проход. Прислушайся...");
  } else if (view === "right") {
    notify("Правый проход. Нажми на фонарик в руке.");
  } else {
    notify("Печь позади тебя. Перетащи дрова на печку.");
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

// Поворот свайпом на телефоне.
office.addEventListener("pointerdown", event => {
  if (event.target.closest("button")) return;

  swipeStartX = event.clientX;
  swipeStartY = event.clientY;
  swipeStarted = true;
});

office.addEventListener("pointerup", event => {
  if (!swipeStarted || !running) return;

  swipeStarted = false;

  const dx = event.clientX - swipeStartX;
  const dy = event.clientY - swipeStartY;

  if (Math.abs(dx) < 35 || Math.abs(dx) < Math.abs(dy)) {
    return;
  }

  if (dx < 0) turnTo("right");
  else turnTo("left");
});

office.addEventListener("pointercancel", () => {
  swipeStarted = false;
});

// Взять фонарик нажатием непосредственно на него.
$("flashlightItem").addEventListener("click", () => {
  if (!running || hasFlashlight || view !== "front") return;

  hasFlashlight = true;
  flashlightCharge = 100;

  $("flashlightItem").classList.add("taken");

  say("Ты взял фонарик.");
  updateStatus();

  setTimeout(() => {
    if (running) turnTo("right");
  }, 100);
});

// Забрать четыре запасные батарейки.
$("batteryItem").addEventListener("click", () => {
  if (!running || spareBatteries > 0 || view !== "front") {
    return;
  }

  spareBatteries = 4;
  $("batteryItem").classList.add("taken");

  say("Ты забрал 4 запасные батарейки.");
  updateStatus();
});

// Нажатие непосредственно на фонарик в руке.
flashlight.addEventListener("click", () => {
  if (!running || !hasFlashlight) return;

  if (view !== "right") {
    say("Повернись к правому проходу.");
    return;
  }

  if (flashlightCharge <= 0) {
    say("Фонарик разряжен. Нажми на значок батарейки, чтобы заменить её.");
    return;
  }

  // Один раз — минус 5% заряда.
  flashlightCharge = Math.max(0, flashlightCharge - 5);

  beam.classList.add("active");

  if (enemyPresent) {
    enemyPresent = false;

    $("rightEnemy").classList.remove("visible", "scared");
    office.classList.add("shaking");

    say("Свет отпугнул противника!");

    setTimeout(() => {
      office.classList.remove("shaking");
    }, 450);
  } else {
    say("В проходе никого нет.");
  }

  updateStatus();

  clearTimeout(beamTimer);

  beamTimer = setTimeout(() => {
    beam.classList.remove("active");
  }, 850);
});

// Ручная замена разряженной батарейки.
batterySlot.addEventListener("click", () => {
  if (!running || !hasFlashlight) return;

  if (flashlightCharge > 0) {
    say("Замени батарейку, когда заряд закончится.");
    return;
  }

  if (spareBatteries <= 0) {
    say("Запасные батарейки закончились!");
    return;
  }

  spareBatteries--;
  flashlightCharge = 100;

  say(`Новая батарейка вставлена. Осталось: ${spareBatteries}.`);

  updateStatus();
});

// Взять дрова со стола.
$("woodItem").addEventListener("click", () => {
  if (!running || hasWood || view !== "front") return;

  hasWood = true;
  $("woodItem").classList.add("taken");

  say("Ты схватил дрова. Повернись к печке и перетащи их туда.");

  updateStatus();
});

// Перетаскивание дров на печку.
carriedWood.addEventListener("pointerdown", event => {
  if (!running || !hasWood || view !== "back") return;

  draggingWood = true;

  const rect = carriedWood.getBoundingClientRect();

  dragOffsetX = event.clientX - rect.left;
  dragOffsetY = event.clientY - rect.top;

  carriedWood.classList.add("dragging");
  carriedWood.setPointerCapture(event.pointerId);

  stove.classList.add("drop-ready");

  event.preventDefault();
});

carriedWood.addEventListener("pointermove", event => {
  if (!draggingWood) return;

  const rect = office.getBoundingClientRect();

  carriedWood.style.left =
    `${event.clientX - rect.left - dragOffsetX}px`;

  carriedWood.style.top =
    `${event.clientY - rect.top - dragOffsetY}px`;

  carriedWood.style.bottom = "auto";
  carriedWood.style.transform = "none";
});

carriedWood.addEventListener("pointerup", event => {
  if (!draggingWood) return;

  draggingWood = false;

  carriedWood.classList.remove("dragging");
  stove.classList.remove("drop-ready");

  const target = document.elementFromPoint(
    event.clientX,
    event.clientY
  );

  const droppedOnStove = target &&
    (target.closest(".stove") || target.closest(".fire"));

  carriedWood.style.left = "";
  carriedWood.style.top = "";
  carriedWood.style.bottom = "";
  carriedWood.style.transform = "";

  if (droppedOnStove && view === "back" && hasWood) {
    hasWood = false;
    fireLevel = Math.min(100, fireLevel + 55);

    say("Дрова в печке! Огонь разгорелся.");

    updateStatus();

    setTimeout(() => {
      if (running) turnTo("front");
    }, 650);
  } else {
    say("Перетащи дрова прямо на печку.");
  }
});

carriedWood.addEventListener("pointercancel", () => {
  draggingWood = false;

  carriedWood.classList.remove("dragging");
  stove.classList.remove("drop-ready");

  carriedWood.style.left = "";
  carriedWood.style.top = "";
  carriedWood.style.bottom = "";
  carriedWood.style.transform = "";
});

// Появление противника.
function spawnEnemy() {
  if (!running || enemyPresent) return;

  if (Math.random() < 0.65) {
    enemyPresent = true;

    $("rightEnemy").classList.add("visible");

    notify("Ты слышишь шаги справа...");
  }
}

function stopTimers() {
  clearInterval(gameTimer);
  clearInterval(enemyTimer);
  clearInterval(fireTimer);
  clearTimeout(beamTimer);
}

// Завершение смены.
function finishGame(won) {
  if (!running) return;

  running = false;
  stopTimers();

  $("overlayTitle").textContent =
    won ? "6 AM" : "КОНЕЦ СМЕНЫ";

  $("overlayText").textContent = won
    ? "Ты пережил смену в The Valley of Blood."
    : "Попробуй пережить смену ещё раз.";

  $("overlay").classList.remove("hidden");
}

$("restart").addEventListener("click", () => {
  location.reload();
});

// Игровое время: 3 минуты до 6 AM.
const gameTimer = setInterval(() => {
  if (!running) return;

  seconds++;

  const gameHour = Math.min(6, Math.floor(seconds / 30));

  $("clock").textContent =
    gameHour === 0 ? "12 AM" : `${gameHour} AM`;

  if (seconds >= 180) finishGame(true);
}, 1000);

// Проверка появления противника каждые 10 секунд.
const enemyTimer = setInterval(spawnEnemy, 10000);

// Огонь постепенно гаснет.
const fireTimer = setInterval(() => {
  if (!running) return;

  fireLevel = Math.max(0, fireLevel - 2);

  updateStatus();

  if (fireLevel <= 0) {
    notify("Огонь погас! Принеси дрова.");
  }
}, 4000);

// Начальное состояние.
turnTo("front");
updateStatus();
notify("12 AM — смена началась.");
