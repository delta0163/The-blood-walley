
const $ = id => document.getElementById(id);

const game = {
  started: false,
  ended: false,
  seconds: 0,
  fire: 100,
  wood: 0,
  battery: 100,
  flashlight: false,
  holdingFlashlight: false,
  rightEnemy: false,
  leftEnemy: false,
  rightDanger: 0,
  leftDanger: 0,
  flashCount: 0,
  scared: false,
  hiding: false,
  hideTime: 0,
  view: 0,
  lastFlash: 0,
  lastWood: 0
};

function say(text) {
  $("message").textContent = text;
}

function updateUI() {
  $("fireValue").textContent = Math.ceil(game.fire);
  $("fireMeter").style.width = game.fire + "%";
  $("woodValue").textContent = game.wood;
  $("batteryValue").textContent = Math.ceil(game.battery);

  $("fire").classList.toggle("cold", game.fire <= 0);

  $("rightEnemy").classList.toggle(
    "visible", game.rightEnemy
  );

  $("leftEnemy").classList.toggle(
    "visible", game.leftEnemy
  );

  $("cameraEnemy").classList.toggle(
    "visible", game.leftEnemy
  );

  $("cameraFeed").classList.toggle(
    "danger", game.leftEnemy
  );

  $("cameraStatus").textContent = game.leftEnemy
    ? "ДВИЖЕНИЕ ОБНАРУЖЕНО"
    : "СИГНАЛ СТАБИЛЕН";

  $("clock").textContent =
    String(12 + Math.floor(game.seconds / 30) % 6)
      .padStart(2, "0") + ":" +
    String((game.seconds % 30) * 2)
      .padStart(2, "0") + " AM";
}

function endGame(won, reason) {
  if (game.ended) return;

  game.ended = true;
  game.started = false;

  $("endTitle").textContent = won
    ? "6:00 AM — ТЫ ВЫЖИЛ"
    : "СМЕНА ОКОНЧЕНА";

  $("endReason").textContent = reason;
  $("endPanel").classList.remove("hidden");
}

function turnHead(direction) {
  if (!game.started || game.ended) return;

  game.view = Math.max(-3, Math.min(3, game.view + direction));

  $("office").style.transform =
    `perspective(800px) rotateY(${game.view * 4}deg) scale(1.05)`;

  say(
    game.view < 0 ? "Ты смотришь влево." :
    game.view > 0 ? "Ты смотришь вправо." :
    "Ты смотришь прямо."
  );
}

$("startBtn").addEventListener("click", () => {
  $("startPanel").classList.add("hidden");
  game.started = true;
  say("Смена началась. Следи за огнём и проходами.");
  updateUI();
});

$("restartBtn").addEventListener("click", () => {
  location.reload();
});

// Поворот головы свайпом.
let startX = 0;
let startY = 0;

$("game").addEventListener("touchstart", event => {
  if (event.target.closest("button") ||
      event.target.closest(".panel")) return;

  startX = event.changedTouches[0].clientX;
  startY = event.changedTouches[0].clientY;
}, { passive: true });

$("game").addEventListener("touchend", event => {
  if (!game.started || game.ended) return;

  const dx = event.changedTouches[0].clientX - startX;
  const dy = event.changedTouches[0].clientY - startY;

  if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
    turnHead(dx > 0 ? 1 : -1);
  }
}, { passive: true });

// Поддержка мыши на компьютере.
let mouseX = null;

$("game").addEventListener("mousedown", event => {
  if (event.target.closest("button") ||
      event.target.closest(".panel")) return;
  mouseX = event.clientX;
});

$("game").addEventListener("mouseup", event => {
  if (mouseX === null) return;

  const dx = event.clientX - mouseX;
  mouseX = null;

  if (Math.abs(dx) > 35) {
    turnHead(dx > 0 ? 1 : -1);
  }
});

$("cameraBtn").addEventListener("click", () => {
  if (!game.started || game.ended || game.hiding) return;

  $("cameraPanel").classList.remove("hidden");
});

$("closeCameraBtn").addEventListener("click", () => {
  $("cameraPanel").classList.add("hidden");
});

// Фонарик.
$("flashlightBtn").addEventListener("click", () => {
  if (!game.started || game.ended || game.hiding) return;

  game.holdingFlashlight = !game.holdingFlashlight;

  $("flashlightBtn").textContent = game.holdingFlashlight
    ? "УБРАТЬ ФОНАРИК"
    : "ВЗЯТЬ ФОНАРИК";

  say(game.holdingFlashlight
    ? "Фонарик в руке. Проверь правый проход."
    : "Ты положил фонарик.");
});

$("checkBtn").addEventListener("click", () => {
  if (!game.started || game.ended || game.hiding) return;

  if (!game.holdingFlashlight) {
    say("Сначала возьми фонарик со стола!");
    return;
  }

  $("office").classList.add("shaking");

  setTimeout(() => {
    $("office").classList.remove("shaking");
  }, 700);

  if (game.rightEnemy) {
    say("КТО-ТО В ПРАВОМ ПРОХОДЕ! Включай и выключай фонарик!");
    game.lastFlash = 0;
  } else {
    say("Ты осмотрел правый проход. Пока всё спокойно.");
  }
});

// Включение и выключение фонарика считается отдельным действием.
$("checkBtn").insertAdjacentHTML(
  "afterend",
  '<button id="toggleFlashBtn">ВКЛ./ВЫКЛ. СВЕТ</button>'
);

$("toggleFlashBtn").addEventListener("click", () => {
  if (!game.started || game.ended || game.hiding) return;

  if (!game.holdingFlashlight) {
    say("Сначала возьми фонарик!");
    return;
  }

  game.flashlight = !game.flashlight;

  if (game.flashlight) {
    if (game.battery <= 0) {
      game.flashlight = false;
      say("Фонарик разряжен!");
      return;
    }

    game.battery = Math.max(0, game.battery - 4);

    $("viewFlash").classList.remove("flash");
    void $("viewFlash").offsetWidth;
    $("viewFlash").classList.add("flash");

    if (game.rightEnemy) {
      game.flashCount++;
      game.rightDanger = 0;

      if (game.flashCount >= 3) {
        game.rightEnemy = false;
        game.flashCount = 0;
        say("СУЩЕСТВО ОТСТУПИЛО! Пока ты в безопасности.");
      } else {
        say("Оно ещё здесь! Переключи фонарик ещё раз.");
      }
    } else {
      say("Ты осветил проход. Никого не видно.");
    }
  } else {
    say(game.rightEnemy
      ? "Свет выключен. Включи его снова!"
      : "Фонарик выключен.");
  }

  updateUI();
});

// Дрова и печь.
$("takeWoodBtn").addEventListener("click", () => {
  if (!game.started || game.ended || game.hiding) return;

  if (game.wood >= 3) {
    say("Больше дров взять нельзя — руки заняты.");
    return;
  }

  game.wood++;
  say("Ты взял дрова. Подойди к печи и подкинь их.");
  updateUI();
});

$("stokeBtn").addEventListener("click", () => {
  if (!game.started || game.ended || game.hiding) return;

  if (game.wood <= 0) {
    say("У тебя нет дров! Сначала возьми их.");
    return;
  }

  game.wood--;
  game.fire = Math.min(100, game.fire + 30);

  say("Дрова в печи. Огонь снова разгорается.");
  updateUI();
});

// Камера левого прохода.
$("scareBtn").addEventListener("click", () => {
  if (!game.started || game.ended) return;

  if (!game.leftEnemy) {
    say("На камере никого нет.");
    return;
  }

  game.leftEnemy = false;
  game.scared = true;
  game.leftDanger = 0;

  say("Отпугивание сработало! Теперь быстро спрячься.");
  updateUI();
});

$("hideBtn").addEventListener("click", () => {
  if (!game.started || game.ended) return;

  $("cameraPanel").classList.add("hidden");
  $("hidePanel").classList.remove("hidden");

  game.hiding = true;
  game.hideTime = 0;

  $("hideStatus").textContent =
    "Ты спрятался. Подожди, пока шаги исчезнут.";
});

$("unhideBtn").addEventListener("click", () => {
  if (!game.started || game.ended) return;

  if (game.hideTime < 3) {
    $("hideStatus").textContent =
      "Подожди ещё " + (3 - game.hideTime) + " сек.";
    return;
  }

  game.hiding = false;
  $("hidePanel").classList.add("hidden");
  say("Ты вылез. Проверь печь!");
});

// Ночной цикл.
setInterval(() => {
  if (!game.started || game.ended) return;

  game.seconds++;

  // Огонь постепенно затухает.
  game.fire = Math.max(0, game.fire - 0.65);

  if (game.fire <= 0) {
    endGame(false, "Огонь в печи погас.");
    return;
  }

  // Фонарик постепенно разряжается, если включён.
  if (game.flashlight) {
    game.battery = Math.max(0, game.battery - 1.5);

    if (game.battery <= 0) {
      game.flashlight = false;
      say("Фонарик разрядился!");
    }
  }

  // Появление существ.
  if (!game.hiding && game.seconds % 12 === 0 &&
      !game.rightEnemy && Math.random() < 0.75) {
    game.rightEnemy = true;
    game.rightDanger = 0;
    game.flashCount = 0;
    say("ШОРОХ СПРАВА! Проверь проход фонариком.");
  }

  if (!game.hiding && game.seconds % 17 === 0 &&
      !game.leftEnemy && Math.random() < 0.65) {
    game.leftEnemy = true;
    game.leftDanger = 0;
    say("ДВИЖЕНИЕ СЛЕВА! Проверь камеру.");
  }

  if (game.rightEnemy && !game.hiding) {
    game.rightDanger++;

    if (game.rightDanger >= 15) {
      endGame(false, "Ты не успел прогнать существо из правого прохода.");
      return;
    }
  }

  if (game.leftEnemy && !game.hiding) {
    game.leftDanger++;

    if (game.leftDanger >= 22) {
      endGame(false, "Существо из левого прохода добралось до тебя.");
      return;
    }
  }

  if (game.hiding) {
    game.hideTime++;
  }

  // В этой пробной версии 180 секунд равны одной ночи.
  if (game.seconds >= 180) {
    endGame(true, "Ты продержался до 6 утра!");
    return;
  }

  updateUI();
}, 1000);

updateUI();
