
const $ = id => document.getElementById(id);

const office = $("office");
const message = $("message");
const notice = $("notice");

let view = "front";
let hasFlashlight = false;
let hasWood = false;
let enemyPresent = false;
let enemyScared = false;
let fireLevel = 100;
let seconds = 0;
let running = true;
let flashlightReady = false;
let gameTimer = null;
let enemyTimer = null;
let fireTimer = null;

const views = ["front", "right", "back", "left"];

function setNotice(text) {
  notice.textContent = text;
}

function showMessage(text, duration = 1800) {
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
  $("flashStatus").textContent =
    hasFlashlight ? "в руке" : "на столе";

  $("woodStatus").textContent =
    hasWood ? "в руках" :
    $("woodItem").classList.contains("taken") ? "в печке" :
    "на столе";

  $("fireStatus").textContent =
    fireLevel > 65 ? "горит хорошо" :
    fireLevel > 25 ? "слабеет" : "почти погас";

  $("fire").classList.toggle("low", fireLevel <= 35);
  $("fire").classList.toggle("out", fireLevel <= 0);

  $("useFlashlight").disabled =
    !hasFlashlight || view !== "right";

  $("putWood").disabled =
    !hasWood || view !== "back";
}

function turnTo(nextView) {
  if (!running) return;

  view = nextView;
  office.className = "office " + view;

  // Поворот мгновенный, без медленной анимации.
  office.style.transform = "none";

  if (view === "front") {
    setNotice("Ты смотришь прямо на стол.");
  } else if (view === "left") {
    setNotice("Левый проход. Прислушайся...");
  } else if (view === "right") {
    setNotice(hasFlashlight
      ? "Правый проход. Проверь его фонариком."
      : "Правый проход почти полностью скрыт во тьме.");
  } else if (view === "back") {
    setNotice("Печь находится позади тебя.");
  }

  updateStatus();
}

function turnLeft() {
  if (!running) return;

  if (view === "front") turnTo("left");
  else if (view === "left") turnTo("back");
  else if (view === "back") turnTo("right");
  else turnTo("front");
}

function turnRight() {
  if (!running) return;

  if (view === "front") turnTo("right");
  else if (view === "right") turnTo("back");
  else if (view === "back") turnTo("left");
  else turnTo("front");
}

$("turnLeft").addEventListener("click", turnLeft);
$("turnRight").addEventListener("click", turnRight);
$("turnFront").addEventListener("click", () => turnTo("front"));
$("turnBack").addEventListener("click", () => turnTo("back"));

// Фонарик: забираем со стола и сразу поворачиваемся вправо.
$("flashlightItem").addEventListener("click", () => {
  if (!running || hasFlashlight || view !== "front") return;

  hasFlashlight = true;
  flashlightReady = true;
  $("flashlightItem").classList.add("taken");

  showMessage("Ты взял фонарик.");
  updateStatus();

  // Сразу смотрим в правый проход.
  setTimeout(() => {
    if (!running) return;
    turnTo("right");
    showMessage("Проверь проход светом.", 2200);
  }, 100);
});

// Дрова можно забрать только со стола, когда смотришь прямо.
$("woodItem").addEventListener("click", () => {
  if (!running || hasWood || view !== "front") return;

  hasWood = true;
  $("woodItem").classList.add("taken");

  showMessage("Ты взял дрова. Отнеси их к печке.");
  updateStatus();
});

// Проверка правого прохода фонариком.
$("useFlashlight").addEventListener("click", () => {
  if (!running || !hasFlashlight || view !== "right") return;

  const beam = $("flashBeam");
  beam.classList.add("active");

  if (enemyPresent && !enemyScared) {
    enemyScared = true;
    const enemy = $("rightEnemy");

    enemy.classList.add("scared");
    showMessage("ОНО ОТСТУПАЕТ! Возвращайся к столу!");

    office.classList.add("shaking");

    setTimeout(() => {
      enemy.classList.remove("visible", "scared");
      enemyPresent = false;
      enemyScared = false;
      office.classList.remove("shaking");
    }, 350);
  } else {
    showMessage("В проходе никого нет.");
  }

  updateStatus();

  // Фонарик гаснет, затем игрок возвращается к столу.
  setTimeout(() => {
    beam.classList.remove("active");

    if (running) {
      turnTo("front");
    }
  }, 900);
});

// Положить дрова в печку.
$("putWood").addEventListener("click", () => {
  if (!running || !hasWood || view !== "back") return;

  hasWood = false;
  fireLevel = Math.min(100, fireLevel + 55);

  $("woodItem").classList.add("taken");

  showMessage("Ты подбросил дрова. Огонь разгорается!");
  updateStatus();

  setTimeout(() => {
    if (running) turnTo("front");
  }, 700);
});

// Время: 12 AM — 6 AM за три минуты.
function updateClock() {
  const totalMinutes = Math.floor(seconds / 30);
  const hour = 12 + Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  // В этой короткой смене каждые 30 секунд = один игровой час.
  const gameHour = Math.min(6, Math.floor(seconds / 30));

  $("clock").textContent =
    gameHour === 0 ? "12 AM" : `${gameHour} AM`;

  if (seconds >= 180) {
    winGame();
  }
}

function spawnEnemy() {
  if (!running || enemyPresent || enemyScared) return;

  // Противник появляется не каждый раз.
  if (Math.random() < 0.65) {
    enemyPresent = true;
    $("rightEnemy").classList.add("visible");
    setNotice("Ты слышишь шаги справа...");
  }
}

function startEnemyEvents() {
  enemyTimer = setInterval(() => {
    if (!running) return;

    // Противник может появиться в правом проходе.
    if (!enemyPresent && Math.random() < 0.5) {
      spawnEnemy();
    }

    // Если игрок долго не проверяет проход, опасность растёт.
    if (enemyPresent && view === "right" && !hasFlashlight) {
      setNotice("В темноте что-то движется...");
    }
  }, 10000);
}

function winGame() {
  if (!running) return;

  running = false;
  stopTimers();

  $("overlayTitle").textContent = "6 AM";
  $("overlayText").textContent =
    "Ты пережил смену в The Valley of Blood.";
  $("overlay").classList.remove("hidden");
}

function loseGame() {
  if (!running) return;

  running = false;
  stopTimers();

  $("overlayTitle").textContent = "ТЫ НЕ ВЫЖИЛ";
  $("overlayText").textContent =
    "Опасность добралась до офиса. Попробуй ещё раз.";
  $("overlay").classList.remove("hidden");
}

function stopTimers() {
  clearInterval(gameTimer);
  clearInterval(enemyTimer);
  clearInterval(fireTimer);
}

$("restart").addEventListener("click", () => {
  location.reload();
});

// Огонь постепенно слабеет.
function startFire() {
  fireTimer = setInterval(() => {
    if (!running) return;

    fireLevel = Math.max(0, fireLevel - 2);
    updateStatus();

    if (fireLevel <= 0) {
      setNotice("Огонь погас! Нужно принести дрова.");
    }
  }, 4000);
}

// Запуск смены.
function startGame() {
  turnTo("front");
  updateStatus();

  gameTimer = setInterval(() => {
    if (!running) return;

    seconds++;
    updateClock();
  }, 1000);

  startEnemyEvents();
  startFire();

  setNotice("12 AM — смена началась.");
}

startGame();
