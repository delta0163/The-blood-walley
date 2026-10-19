
const $ = id => document.getElementById(id);

const office = $("office");
const flashlight = $("heldFlashlight");
const batterySlot = $("batterySlot");
const carriedWood = $("carriedWood");
const stove = $("stove");
const cameraPanel = $("cameraPanel");

let view = "front";
let running = true;

let hasFlashlight = false;
let flashlightCharge = 100;
let spareBatteries = 4;

let woodCount = 12;
let hasWood = false;
let fireLevel = 100;

let leftEnemyPresent = false;
let rightEnemyPresent = false;

let seconds = 0;
let selectedCamera = 1;

let swipeStartX = 0;
let swipeStartY = 0;
let swipeStarted = false;

let draggingWood = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

let beamTimer = null;
let messageTimer = null;

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
  $("flashChargeFill").style.width = flashlightCharge + "%";

  $("flashChargeFill").style.background =
    flashlightCharge <= 20 ? "#c33" : "#d4d47a";

  carriedWood.classList.toggle(
    "hidden",
    !hasWood || view !== "back"
  );

  $("leftEnemy").classList.toggle("visible", leftEnemyPresent);
  $("rightEnemy").classList.toggle("visible", rightEnemyPresent);

  updateCameraFeed();
}

function turnTo(nextView) {
  if (!running) return;

  view = nextView;
  office.className = "office " + view;

  if (view === "front") {
    notify("Ты в офисе. Дрова лежат под столом.");
  } else if (view === "left") {
    notify("Левый проход. Проверь его и камеры.");
  } else if (view === "right") {
    notify("Правый проход. Нажми на фонарик, чтобы осветить его.");
  } else {
    notify("Ты у печки. Перетащи дрова на её корпус.");
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

// Поворот быстрым свайпом.
office.addEventListener("pointerdown", event => {
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

// Взять фонарик со стола.
$("flashlightItem").addEventListener("click", () => {
  if (!running || hasFlashlight || view !== "front") return;

  hasFlashlight = true;
  flashlightCharge = 100;

  $("flashlightItem").classList.add("taken");

  say("Ты взял фонарик.");
  updateStatus();
});

// Забрать четыре запасные батарейки.
$("batteryItem").addEventListener("click", () => {
  if (!running || view !== "front") return;

  if ($("batteryItem").classList.contains("taken")) return;

  spareBatteries = 4;
  $("batteryItem").classList.add("taken");

  say("Ты забрал 4 запасные батарейки.");
  updateStatus();
});

// Нажатие непосредственно на фонарик.
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
    say("Свет отпугнул противника справа!");
  } else if (view === "left" && leftEnemyPresent) {
    leftEnemyPresent = false;
    say("Противник отступил в темноту!");
  } else {
    say("В проходе никого не видно.");
  }

  updateStatus();

  clearTimeout(beamTimer);
  beamTimer = setTimeout(() => {
    $("flashBeam").classList.remove("active");
  }, 850);
});

// Батарейку можно заменить, когда заряд достигнет нуля.
batterySlot.addEventListener("click", () => {
  if (!running || !hasFlashlight) return;

  if (flashlightCharge > 0) {
    say("Сначала полностью израсходуй заряд.");
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

// Дрова под столом: каждую поленья можно взять отдельно.
document.querySelectorAll(".log").forEach(log => {
  log.addEventListener("click", () => {
    if (!running || view !== "front") {
      say("Чтобы взять дрова, повернись прямо к столу.");
      return;
    }

    if (hasWood) {
      say("Ты уже держишь одно полено.");
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

// Перетаскивание полена на печку.
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

function resetDraggedWood() {
  draggingWood = false;

  carriedWood.classList.remove("dragging");
  stove.classList.remove("drop-ready");

  carriedWood.style.left = "";
  carriedWood.style.top = "";
  carriedWood.style.bottom = "";
  carriedWood.style.transform = "";
}

carriedWood.addEventListener("pointerup", event => {
  if (!draggingWood) return;

  const target = document.elementFromPoint(
    event.clientX,
    event.clientY
  );

  const droppedOnStove =
    target &&
    (target.closest("#stove") || target.closest("#fire"));

  resetDraggedWood();

  if (droppedOnStove && view === "back" && hasWood) {
    hasWood = false;
    fireLevel = Math.min(100, fireLevel + 55);

    say("Полено в печке! Огонь усилился.");
    updateStatus();
  } else {
    say("Перетащи полено прямо на печку.");
  }
});

carriedWood.addEventListener("pointercancel", resetDraggedWood);

// Камеры.
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

  // Камеры показывают, есть ли противник в левом проходе.
  $("cameraEnemy").classList.toggle(
    "hidden",
    !leftEnemyPresent
  );
}

// Появление противников.
function spawnEnemy() {
  if (!running) return;

  if (!rightEnemyPresent && Math.random() < 0.5) {
    rightEnemyPresent = true;
    notify("Справа слышны тяжёлые шаги...");
  }

  if (!leftEnemyPresent && Math.random() < 0.5) {
    leftEnemyPresent = true;
    notify("Что-то движется в левом проходе...");
  }

  updateStatus();
}

function stopTimers() {
  clearInterval(gameTimer);
  clearInterval(enemyTimer);
  clearInterval(fireTimer);
  clearTimeout(beamTimer);
  clearTimeout(messageTimer);
}

function finishGame(won) {
  if (!running) return;

  running = false;
  stopTimers();

  $("overlayTitle").textContent = won ? "6 AM" : "КОНЕЦ СМЕНЫ";

  $("overlayText").textContent = won
    ? "Ты пережил смену в The Valley of Blood."
    : "Попробуй пережить смену ещё раз.";

  $("overlay").classList.remove("hidden");
}

$("restart").addEventListener("click", () => {
  location.reload();
});

// Продвижение времени: смена длится 3 минуты.
const gameTimer = setInterval(() => {
  if (!running) return;

  seconds++;

  const gameHour = Math.min(6, Math.floor(seconds / 30));

  $("clock").textContent =
    gameHour === 0 ? "12 AM" : `${gameHour} AM`;

  if (seconds >= 180) finishGame(true);
}, 1000);

// Противники появляются периодически.
const enemyTimer = setInterval(spawnEnemy, 10000);

// Огонь постепенно угасает.
const fireTimer = setInterval(() => {
  if (!running) return;

  fireLevel = Math.max(0, fireLevel - 2);

  updateStatus();

  if (fireLevel <= 0) {
    notify("Огонь погас! Нужно принести дрова.");
  }
}, 4000);

turnTo("front");
updateStatus();
notify("12 AM — смена началась.");
