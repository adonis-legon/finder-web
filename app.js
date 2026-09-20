/* ==========================================================================
   Buscador de Objetos - Lógica principal
   Flujo: elegir libro -> elegir jugador -> jugar (wizard de escenas).
   Progreso guardado por libro + jugador en localStorage.
   ========================================================================== */

const STORAGE_KEY = "finder.state.v2"; // { players: { name: { books: { bookId: { found: { sceneId: [items] } } } } } }
const CURRENT_BOOK_KEY = "finder.currentBook";
const CURRENT_PLAYER_KEY = "finder.currentPlayer";

const BOOK_ICONS = {
  "harry-potter": "⚡",
};
const DEFAULT_BOOK_ICON = "📖";

let catalog = null;      // contenido de books.json
let currentBook = null;  // objeto libro seleccionado
let gameData = null;     // escenas del libro actual
let state = null;        // estado de jugadores
let currentPlayer = null;
let sceneIndex = 0;      // índice de escena en el wizard

/* ---------- Referencias al DOM ---------- */
const el = {
  appTitle: document.getElementById("appTitle"),
  appSubtitle: document.getElementById("appSubtitle"),
  contextBar: document.getElementById("contextBar"),
  contextInfo: document.getElementById("contextInfo"),
  backToBooksBtn: document.getElementById("backToBooksBtn"),
  changePlayerBtn: document.getElementById("changePlayerBtn"),

  bookScreen: document.getElementById("bookScreen"),
  bookList: document.getElementById("bookList"),

  playerScreen: document.getElementById("playerScreen"),
  backToBooksFromPlayer: document.getElementById("backToBooksFromPlayer"),
  playerList: document.getElementById("playerList"),
  newPlayerInput: document.getElementById("newPlayerInput"),
  addPlayerBtn: document.getElementById("addPlayerBtn"),

  gameScreen: document.getElementById("gameScreen"),
  sceneCard: document.getElementById("sceneCard"),
  prevSceneBtn: document.getElementById("prevSceneBtn"),
  nextSceneBtn: document.getElementById("nextSceneBtn"),
  sceneDots: document.getElementById("sceneDots"),
  globalProgressFill: document.getElementById("globalProgressFill"),
  globalProgressText: document.getElementById("globalProgressText"),
  resetProgressBtn: document.getElementById("resetProgressBtn"),
};

/* ---------- Persistencia ---------- */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : { players: {} };
  } catch (e) {
    state = { players: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- Tema por libro ---------- */
function applyTheme(theme) {
  if (!theme) return;
  Object.entries(theme).forEach(([varName, value]) => {
    document.documentElement.style.setProperty(varName, value);
  });
}

/* ---------- Acceso al progreso (libro + jugador) ---------- */
function ensurePlayerBook(name, bookId) {
  if (!state.players[name]) state.players[name] = { books: {} };
  if (!state.players[name].books[bookId]) {
    state.players[name].books[bookId] = { found: {} };
  }
  return state.players[name].books[bookId];
}

function getBookProgressFor(name, bookId) {
  const player = state.players[name];
  if (!player || !player.books[bookId]) return { found: {} };
  return player.books[bookId];
}

function getFoundSet(sceneId) {
  const bp = getBookProgressFor(currentPlayer, currentBook.id);
  return new Set(bp.found[sceneId] || []);
}

function setFound(sceneId, item, isFound) {
  const bp = ensurePlayerBook(currentPlayer, currentBook.id);
  if (!bp.found[sceneId]) bp.found[sceneId] = [];
  const list = bp.found[sceneId];
  const idx = list.indexOf(item);
  if (isFound && idx === -1) list.push(item);
  if (!isFound && idx !== -1) list.splice(idx, 1);
  saveState();
}

/* ---------- Conteos ---------- */
function countSceneProgressFor(name, bookId, scene, scenes) {
  const bp = getBookProgressFor(name, bookId);
  const found = new Set(bp.found[scene.id] || []);
  const done = scene.items.filter((i) => found.has(i)).length;
  return { done, total: scene.items.length };
}

function countGlobalFor(name, bookId, scenes) {
  let done = 0;
  let total = 0;
  scenes.forEach((scene) => {
    const p = countSceneProgressFor(name, bookId, scene, scenes);
    done += p.done;
    total += p.total;
  });
  return { done, total };
}

/* ---------- Pantalla 1: libros ---------- */
function renderBookList() {
  el.bookList.innerHTML = "";
  catalog.books.forEach((book) => {
    const card = document.createElement("div");
    card.className = "book-card";

    const icon = document.createElement("span");
    icon.className = "book-icon";
    icon.textContent = BOOK_ICONS[book.id] || DEFAULT_BOOK_ICON;

    const name = document.createElement("div");
    name.className = "book-name";
    name.textContent = book.name;
    name.style.color = book.theme["--accent"] || "var(--accent)";

    const subtitle = document.createElement("div");
    subtitle.className = "book-subtitle";
    subtitle.textContent = book.subtitle || "";

    const swatch = document.createElement("span");
    swatch.className = "book-swatch";
    swatch.style.background = book.theme["--accent"] || "var(--accent)";

    card.appendChild(icon);
    card.appendChild(name);
    card.appendChild(subtitle);
    card.appendChild(swatch);

    card.addEventListener("click", () => selectBook(book.id));
    el.bookList.appendChild(card);
  });
}

async function selectBook(bookId) {
  const book = catalog.books.find((b) => b.id === bookId);
  if (!book) return;

  // cargar escenas del libro
  try {
    const res = await fetch(book.dataFile);
    if (!res.ok) throw new Error("No se pudo cargar " + book.dataFile);
    gameData = await res.json();
  } catch (e) {
    alert("Error al cargar el libro. Revisá que exista " + book.dataFile);
    console.error(e);
    return;
  }

  currentBook = book;
  localStorage.setItem(CURRENT_BOOK_KEY, bookId);
  applyTheme(book.theme);

  el.appTitle.textContent = book.name;
  el.appSubtitle.textContent = book.subtitle || "";

  showPlayerScreen();
}

/* ---------- Pantalla 2: jugadores ---------- */
function renderPlayerList() {
  el.playerList.innerHTML = "";
  const names = Object.keys(state.players);

  if (names.length === 0) {
    const empty = document.createElement("p");
    empty.style.textAlign = "center";
    empty.style.color = "var(--text-dim)";
    empty.textContent = "Todavía no hay jugadores. ¡Creá el primero!";
    el.playerList.appendChild(empty);
    return;
  }

  names.forEach((name) => {
    const item = document.createElement("div");
    item.className = "player-item";

    const info = document.createElement("div");
    const nameEl = document.createElement("div");
    nameEl.className = "p-name";
    nameEl.textContent = name;

    // progreso de este jugador EN EL LIBRO ACTUAL
    const gp = countGlobalFor(name, currentBook.id, gameData.scenes);

    const progEl = document.createElement("div");
    progEl.className = "p-progress";
    progEl.textContent = `${gp.done} / ${gp.total} en este libro`;

    info.appendChild(nameEl);
    info.appendChild(progEl);

    const delBtn = document.createElement("button");
    delBtn.className = "p-delete";
    delBtn.textContent = "🗑";
    delBtn.title = "Eliminar jugador";
    delBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (confirm(`¿Eliminar a "${name}" y todo su progreso (en todos los libros)?`)) {
        delete state.players[name];
        saveState();
        renderPlayerList();
      }
    });

    item.appendChild(info);
    item.appendChild(delBtn);
    item.addEventListener("click", () => selectPlayer(name));
    el.playerList.appendChild(item);
  });
}

function addPlayer() {
  const name = el.newPlayerInput.value.trim();
  if (!name) return;
  if (state.players[name]) {
    alert("Ya existe un jugador con ese nombre.");
    return;
  }
  state.players[name] = { books: {} };
  saveState();
  el.newPlayerInput.value = "";
  selectPlayer(name);
}

function selectPlayer(name) {
  currentPlayer = name;
  localStorage.setItem(CURRENT_PLAYER_KEY, name);
  ensurePlayerBook(name, currentBook.id);
  saveState();
  showGameScreen();
}

/* ---------- Pantalla 3: juego (wizard) ---------- */
function renderScene() {
  const scene = gameData.scenes[sceneIndex];
  const found = getFoundSet(scene.id);

  el.sceneCard.innerHTML = "";
  el.sceneCard.className = "scene-card"; // reset (por si venía "complete")

  // header
  const header = document.createElement("div");
  header.className = "scene-header";

  const title = document.createElement("span");
  title.className = "scene-title";
  title.textContent = scene.name;

  const count = document.createElement("span");
  count.className = "scene-count";

  header.appendChild(title);
  header.appendChild(count);
  el.sceneCard.appendChild(header);

  // barra de progreso de la escena
  const sceneProgress = document.createElement("div");
  sceneProgress.className = "scene-progress";
  const sceneBar = document.createElement("div");
  sceneBar.className = "scene-progress-bar";
  const sceneFill = document.createElement("div");
  sceneFill.className = "scene-progress-fill";
  sceneBar.appendChild(sceneFill);
  sceneProgress.appendChild(sceneBar);
  el.sceneCard.appendChild(sceneProgress);

  // descripción
  if (scene.description) {
    const desc = document.createElement("p");
    desc.className = "scene-desc";
    desc.textContent = scene.description;
    el.sceneCard.appendChild(desc);
  }

  // lista de objetos
  const list = document.createElement("ul");
  list.className = "items-list";

  scene.items.forEach((itemName) => {
    const li = document.createElement("li");
    li.className = "item" + (found.has(itemName) ? " found" : "");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = found.has(itemName);
    const cbId = `${scene.id}__${itemName}`.replace(/\s+/g, "_");
    cb.id = cbId;

    const label = document.createElement("label");
    label.htmlFor = cbId;
    label.textContent = itemName;

    cb.addEventListener("change", () => {
      setFound(scene.id, itemName, cb.checked);
      li.classList.toggle("found", cb.checked);
      refreshSceneUI(scene, count, sceneFill);
      updateGlobalProgress();
      updateDots();
    });

    li.appendChild(cb);
    li.appendChild(label);
    list.appendChild(li);
  });

  el.sceneCard.appendChild(list);

  // estado inicial de contador, barra y "completa"
  refreshSceneUI(scene, count, sceneFill);

  // estado de los botones
  el.prevSceneBtn.disabled = sceneIndex === 0;
  el.nextSceneBtn.disabled = sceneIndex === gameData.scenes.length - 1;
}

// Actualiza contador, barra y estado "completa" de la escena visible.
function refreshSceneUI(scene, countEl, fillEl) {
  const found = getFoundSet(scene.id);
  const total = scene.items.length;
  const done = scene.items.filter((i) => found.has(i)).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  countEl.textContent = `${done} / ${total} · ${pct}%`;
  fillEl.style.width = pct + "%";

  const isComplete = total > 0 && done === total;
  el.sceneCard.classList.toggle("complete", isComplete);
}

function renderDots() {
  el.sceneDots.innerHTML = "";
  gameData.scenes.forEach((scene, i) => {
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.title = scene.name;
    dot.addEventListener("click", () => {
      sceneIndex = i;
      renderScene();
      updateDots();
    });
    el.sceneDots.appendChild(dot);
  });
  updateDots();
}

function updateDots() {
  const dots = el.sceneDots.querySelectorAll(".dot");
  dots.forEach((dot, i) => {
    const scene = gameData.scenes[i];
    const p = countSceneProgressFor(currentPlayer, currentBook.id, scene, gameData.scenes);
    dot.classList.toggle("active", i === sceneIndex);
    dot.classList.toggle("complete", p.total > 0 && p.done === p.total);
  });
}

function goPrev() {
  if (sceneIndex > 0) {
    sceneIndex--;
    renderScene();
    updateDots();
  }
}

function goNext() {
  if (sceneIndex < gameData.scenes.length - 1) {
    sceneIndex++;
    renderScene();
    updateDots();
  }
}

function updateGlobalProgress() {
  const gp = countGlobalFor(currentPlayer, currentBook.id, gameData.scenes);
  const pct = gp.total === 0 ? 0 : Math.round((gp.done / gp.total) * 100);
  el.globalProgressFill.style.width = pct + "%";
  let text = `${gp.done} de ${gp.total} objetos encontrados (${pct}%)`;
  if (gp.done === gp.total && gp.total > 0) {
    text = `🎉 ¡Completaste "${currentBook.name}", ${currentPlayer}! (${gp.done}/${gp.total})`;
  }
  el.globalProgressText.textContent = text;
}

function resetProgress() {
  if (!confirm(`¿Reiniciar el progreso de "${currentPlayer}" en "${currentBook.name}"?`)) return;
  const bp = ensurePlayerBook(currentPlayer, currentBook.id);
  bp.found = {};
  saveState();
  renderScene();
  updateDots();
  updateGlobalProgress();
}

/* ---------- Navegación entre pantallas ---------- */
function showBookScreen() {
  el.playerScreen.classList.add("hidden");
  el.gameScreen.classList.add("hidden");
  el.bookScreen.classList.remove("hidden");
  el.contextBar.classList.add("hidden");
  renderBookList();
}

function showPlayerScreen() {
  el.bookScreen.classList.add("hidden");
  el.gameScreen.classList.add("hidden");
  el.playerScreen.classList.remove("hidden");
  el.contextBar.classList.add("hidden");
  renderPlayerList();
}

function showGameScreen() {
  el.bookScreen.classList.add("hidden");
  el.playerScreen.classList.add("hidden");
  el.gameScreen.classList.remove("hidden");
  el.contextBar.classList.remove("hidden");
  el.contextInfo.textContent = `${currentBook.name} · ${currentPlayer}`;

  sceneIndex = 0;
  renderDots();
  renderScene();
  updateGlobalProgress();
}

/* ---------- Inicialización ---------- */
async function init() {
  loadState();

  try {
    const res = await fetch("books.json");
    if (!res.ok) throw new Error("No se pudo cargar books.json");
    catalog = await res.json();
  } catch (e) {
    document.body.innerHTML =
      "<p style='color:#c0392b;text-align:center;margin-top:40px'>" +
      "Error al cargar el catálogo de libros. Si abriste el archivo directamente, " +
      "necesitás un servidor local (ver README).</p>";
    console.error(e);
    return;
  }

  if (catalog.appTitle) {
    el.appTitle.textContent = catalog.appTitle;
    document.title = catalog.appTitle;
  }

  // eventos
  el.addPlayerBtn.addEventListener("click", addPlayer);
  el.newPlayerInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addPlayer();
  });
  el.backToBooksBtn.addEventListener("click", showBookScreen);
  el.backToBooksFromPlayer.addEventListener("click", showBookScreen);
  el.changePlayerBtn.addEventListener("click", showPlayerScreen);
  el.resetProgressBtn.addEventListener("click", resetProgress);
  el.prevSceneBtn.addEventListener("click", goPrev);
  el.nextSceneBtn.addEventListener("click", goNext);

  // teclas de flecha para el wizard
  document.addEventListener("keydown", (e) => {
    if (el.gameScreen.classList.contains("hidden")) return;
    if (e.key === "ArrowLeft") goPrev();
    if (e.key === "ArrowRight") goNext();
  });

  // ¿restaurar sesión anterior?
  const savedBook = localStorage.getItem(CURRENT_BOOK_KEY);
  const savedPlayer = localStorage.getItem(CURRENT_PLAYER_KEY);
  const book = savedBook && catalog.books.find((b) => b.id === savedBook);

  if (book) {
    try {
      const res = await fetch(book.dataFile);
      gameData = await res.json();
      currentBook = book;
      applyTheme(book.theme);
      el.appTitle.textContent = book.name;
      el.appSubtitle.textContent = book.subtitle || "";

      if (savedPlayer && state.players[savedPlayer]) {
        currentPlayer = savedPlayer;
        ensurePlayerBook(currentPlayer, currentBook.id);
        showGameScreen();
        return;
      }
      showPlayerScreen();
      return;
    } catch (e) {
      console.error(e);
    }
  }

  showBookScreen();
}

init();
