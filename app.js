/* Keep the browser bundle self-contained so the prototype also works when
   index.html is opened directly from disk, where ES module imports are blocked. */
function dayBounds(day) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function overlapMsForDay(session, day, end = new Date()) {
  const { start, end: dayEnd } = dayBounds(day);
  const sessionStart = new Date(session.startedAt).getTime();
  const sessionEnd = new Date(session.endedAt || end).getTime();
  return Math.max(0, Math.min(sessionEnd, dayEnd.getTime()) - Math.max(sessionStart, start.getTime()));
}

function placeCategoryInSlot(assignments, slot, categoryId) {
  if (!Array.isArray(assignments) || !Number.isInteger(slot) || slot < 0 || slot >= assignments.length) throw new Error("Invalid Active 4 slot");
  const next = [...assignments];
  const duplicateSlot = next.indexOf(categoryId);
  if (duplicateSlot !== -1 && duplicateSlot !== slot) [next[slot], next[duplicateSlot]] = [next[duplicateSlot], next[slot]];
  else next[slot] = categoryId;
  return next;
}

function applyActiveAssignments(currentState, assignments) {
  if (!currentState || !Array.isArray(currentState.categories) || !Array.isArray(currentState.sessions)) throw new Error("Invalid Rhythm Hero state");
  if (!Array.isArray(assignments) || assignments.length !== currentState.assignments.length || new Set(assignments).size !== assignments.length) throw new Error("Active 4 assignments must be unique");
  const categoryIds = new Set(currentState.categories.map((category) => category.id));
  if (assignments.some((id) => !categoryIds.has(id))) throw new Error("Unknown Category assignment");
  const activeIds = new Set(assignments);
  return {
    ...currentState,
    assignments: [...assignments],
    categories: currentState.categories.map((category) => activeIds.has(category.id) && category.status === "archived" ? { ...category, status: "active" } : category),
    sessions: currentState.sessions,
  };
}

/* Rhythm Hero prototype. Local storage is the offline source of truth; a local beta API mirrors it when available. */
const STORAGE_KEY = "habit-toy-state-v1";
const CLIENT_ID_KEY = "habit-toy-client-id-v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const memoryStorage = new Map();

function readStoredValue(key) {
  try { return localStorage.getItem(key); } catch (_) { return memoryStorage.get(key) || null; }
}

function writeStoredValue(key, value) {
  try { localStorage.setItem(key, value); } catch (_) { memoryStorage.set(key, value); }
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isoAt(daysAgo, hour, minute, durationMinutes) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  const end = new Date(date.getTime() + durationMinutes * 60_000);
  return { startedAt: date.toISOString(), endedAt: end.toISOString() };
}

function createDefaultState() {
  const categories = [
    { id: "move", name: "운동", color: "#E7A08E", goal: 60, status: "active" },
    { id: "read", name: "독서", color: "#8EB5E8", goal: 60, status: "active" },
    { id: "music", name: "음악", color: "#B49ACC", goal: 45, status: "active" },
    { id: "project", name: "프로젝트", color: "#79BFAF", goal: 90, status: "active" },
  ];
  const seed = [
    [0, "move", 7, 15, 35], [0, "read", 21, 5, 42], [0, "project", 14, 20, 39],
    [1, "read", 21, 20, 54], [1, "music", 19, 10, 18], [1, "project", 10, 0, 63],
    [2, "move", 18, 45, 57], [2, "read", 22, 10, 23], [2, "project", 13, 30, 92],
    [3, "move", 7, 5, 25], [3, "music", 20, 15, 41], [3, "project", 15, 0, 48],
    [4, "read", 20, 50, 67], [4, "music", 18, 30, 16], [4, "project", 11, 20, 74],
    [5, "move", 18, 10, 62], [5, "read", 21, 0, 31], [5, "project", 14, 45, 45],
    [6, "move", 8, 0, 20], [6, "read", 21, 15, 48], [6, "music", 19, 0, 30],
  ].map(([daysAgo, categoryId, hour, minute, duration], index) => ({
    id: `seed-${index}`,
    categoryId,
    ...isoAt(daysAgo, hour, minute, duration),
    source: "device",
    status: "completed",
  }));
  return { categories, assignments: ["move", "read", "music", "project"], sessions: seed, activeSession: null, historyRange: 7, reflectionRange: 7, aiReflection: null, updatedAt: new Date().toISOString() };
}

let hadPersistedState = false;
function normalizeState(parsed) {
  parsed.categories.forEach((category) => { if (!category.status) category.status = "active"; });
  parsed.sessions ||= [];
  parsed.historyRange ||= 7;
  parsed.reflectionRange = parsed.reflectionRange === 30 ? 30 : 7;
  if (parsed.aiReflection && !parsed.aiReflection.factSnapshot) parsed.aiReflection = null;
  parsed.aiReflection ||= null;
  parsed.updatedAt ||= new Date().toISOString();
  return parsed;
}

function loadState() {
  try {
    const parsed = JSON.parse(readStoredValue(STORAGE_KEY));
    if (parsed?.categories?.length) {
      hadPersistedState = true;
      return normalizeState(parsed);
    }
  } catch (_) { /* reset below */ }
  const initial = createDefaultState();
  writeStoredValue(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

let state = loadState();
let toastTimer;
const serialDevice = { port: null, reader: null, writer: null, connected: false, buffer: "", lastPayload: "" };
let serialWriteQueue = Promise.resolve();
const clientId = (() => {
  const existing = readStoredValue(CLIENT_ID_KEY);
  if (existing) return existing;
  const next = randomId().replaceAll("-", "");
  writeStoredValue(CLIENT_ID_KEY, next);
  return next;
})();
let remoteReady = false;
let syncTimer;
let syncInFlight = false;
let active4Draft = [];
let categoryDetailId = null;
let categoryEditingId = null;

function saveState() {
  state.updatedAt = new Date().toISOString();
  writeStoredValue(STORAGE_KEY, JSON.stringify(state));
  if (remoteReady) scheduleRemoteSync();
}

function setSyncStatus(message) {
  const element = $("#sync-status");
  if (element) element.textContent = message;
}

function scheduleRemoteSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncToServer, 650);
}

async function syncToServer() {
  if (!navigator.onLine || syncInFlight) { setSyncStatus("로컬에 저장됨"); return; }
  syncInFlight = true;
  setSyncStatus("동기화 중…");
  try {
    const response = await fetch(`/api/state/${clientId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }) });
    if (!response.ok) throw new Error("State sync failed");
    setSyncStatus("안전하게 동기화됨");
  } catch (_) {
    setSyncStatus("로컬에 저장됨");
  } finally {
    syncInFlight = false;
  }
}

async function restoreRemoteState() {
  if (!navigator.onLine) { setSyncStatus("오프라인 · 로컬 기록"); return; }
  setSyncStatus("기록 확인 중…");
  try {
    const response = await fetch(`/api/state/${clientId}`);
    if (response.status === 404) {
      remoteReady = true;
      await syncToServer();
      return;
    }
    if (!response.ok) throw new Error("State restore failed");
    const { state: remoteState } = await response.json();
    if (remoteState?.categories?.length && (!hadPersistedState || new Date(remoteState.updatedAt || 0) > new Date(state.updatedAt || 0))) {
      state = normalizeState(remoteState);
      writeStoredValue(STORAGE_KEY, JSON.stringify(state));
      render();
    }
    remoteReady = true;
    setSyncStatus("안전하게 동기화됨");
    if (hadPersistedState && new Date(state.updatedAt || 0) >= new Date(remoteState?.updatedAt || 0)) scheduleRemoteSync();
  } catch (_) {
    setSyncStatus("로컬에 저장됨");
  }
}
function categoryById(id) { return state.categories.find((category) => category.id === id); }
function selectableCategories() { return state.categories.filter((category) => category.status !== "archived"); }
function durationMs(session, end = new Date()) {
  if (Number.isFinite(session.dayDurationMs)) return session.dayDurationMs;
  return new Date(session.endedAt || end).getTime() - new Date(session.startedAt).getTime();
}
function formatMinutes(minutes) {
  const rounded = Math.max(0, Math.floor(minutes));
  if (rounded < 1) return "1분 미만";
  if (rounded < 60) return `${rounded}분`;
  return `${Math.floor(rounded / 60)}시간${rounded % 60 ? ` ${rounded % 60}분` : ""}`;
}
function formatClock(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((value) => String(value).padStart(2, "0")).join(":");
}
function sameLocalDay(a, b = new Date()) {
  const left = new Date(a); const right = new Date(b);
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}
function dayKey(value) { const d = new Date(value); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function localDateInput(value) { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function localTimeInput(value) { const d = new Date(value); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
function safeColor(value) { return /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : "#8EB5E8"; }
function sessionsForDay(day) {
  return state.sessions
    .filter((session) => session.status === "completed")
    .map((session) => ({ ...session, dayDurationMs: overlapMsForDay(session, day) }))
    .filter((session) => session.dayDurationMs > 0);
}
function minutesFor(categoryId, sessions) { return sessions.filter((session) => session.categoryId === categoryId).reduce((sum, session) => sum + durationMs(session) / 60_000, 0); }
function todaySessions() { return sessionsForDay(new Date()); }
function allCompleted() { return state.sessions.filter((session) => session.status === "completed"); }

function todayMinutes(categoryId) {
  const completed = minutesFor(categoryId, todaySessions());
  if (state.activeSession?.categoryId === categoryId) return completed + overlapMsForDay(state.activeSession, new Date()) / 60_000;
  return completed;
}

function showToast(message) {
  const toast = $("#toast");
  $("#toast-text").textContent = message;
  if (!toast.open) toast.show();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.close(), 2400);
}

function renderTodayDate() {
  $("#today-date").textContent = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
}

function renderToday() {
  const activeCategory = state.activeSession ? categoryById(state.activeSession.categoryId) : null;
  const isRunning = Boolean(activeCategory);
  document.body.classList.toggle("is-running", isRunning);
  const navigation = $(".bottom-nav");
  navigation?.classList.toggle("has-active-session", isRunning);
  navigation?.setAttribute("aria-label", activeCategory ? `주요 메뉴 · ${activeCategory.name} 기록 중` : "주요 메뉴");
  const manualStart = $("#manual-start");
  $("#manual-start-icon").textContent = isRunning ? "●" : "＋";
  $("#manual-start-label").textContent = isRunning ? "현재 기록 보기" : "앱에서 기록 시작";
  manualStart.setAttribute("aria-label", activeCategory ? `${activeCategory.name} 현재 기록 보기` : "앱에서 기록 시작");
  $("#today-hero").dataset.state = isRunning ? "running" : "idle";
  renderTodayDate();
  const total = state.categories.reduce((sum, category) => sum + todayMinutes(category.id), 0);
  $("#today-total").textContent = formatMinutes(total);
  const activeCategoryCount = state.categories.filter((category) => todayMinutes(category.id) > 0).length;
  $("#today-meta").textContent = activeCategory ? `${activeCategory.name} 시간을 함께 쌓고 있어요.` : activeCategoryCount ? `${activeCategoryCount}개 영역에서 시간이 쌓였어요.` : "아직 기록을 기다리고 있어요.";
  const grid = $("#category-grid");
  grid.innerHTML = state.assignments.map((id, index) => {
    const category = categoryById(id);
    const minutes = todayMinutes(id);
    const percentage = category.goal ? Math.min((minutes / category.goal) * 100, 100) : Math.min(minutes, 100);
    const running = state.activeSession?.categoryId === id;
    const categoryColor = safeColor(category.color);
    return `<button class="category-card ${running ? "running" : ""}" data-button-index="${index + 1}" style="--category:${categoryColor};--category-soft:${categoryColor}33" type="button" aria-pressed="${running}">
      <span class="card-top"><span class="button-index">${index + 1}</span><span class="card-status">${running ? "기록 중" : "시작"}</span></span>
      <span class="category-content"><strong class="category-name">${escapeHtml(category.name)}</strong><span class="category-time">${formatMinutes(minutes)}</span></span>
      <span class="progress-track"><span class="progress-fill" style="width:${percentage}%"></span></span>
      <span class="category-goal">${category.goal ? `오늘 목표 ${escapeHtml(category.goal)}분` : "목표 없이 기록 중"}</span>
    </button>`;
  }).join("");
  grid.querySelectorAll("[data-button-index]").forEach((button) => button.addEventListener("click", () => pressButton(Number(button.dataset.buttonIndex))));

  const now = $("#now-card");
  now.dataset.sessionState = isRunning ? "running" : "idle";
  if (state.activeSession) {
    now.classList.remove("hidden");
    $("#now-category").textContent = activeCategory.name;
    $("#now-duration").textContent = formatClock(durationMs(state.activeSession));
    $("#stop-session").setAttribute("aria-label", `${activeCategory.name} 기록 종료`);
  } else now.classList.add("hidden");
  if (!isRunning || !$("#mini-insight-text").textContent) $("#mini-insight-text").textContent = getReflections()[0].message;
}

function getDays(range = state.historyRange) {
  return Array.from({ length: range }, (_, index) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (range - 1 - index)); return d; });
}

function renderHistory() {
  const days = getDays();
  const rangeLabel = `최근 ${state.historyRange}일`;
  const heatmapMinWidth = 64 + state.historyRange * 32;
  $("#activity-map-scroll").dataset.range = String(state.historyRange);
  $("#history-title").textContent = rangeLabel;
  $$(".segmented button[data-range]").forEach((button) => {
    const selected = Number(button.dataset.range) === state.historyRange;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  $("#week-labels").innerHTML = `<div class="week-labels-row" style="--days:${state.historyRange};min-width:${heatmapMinWidth}px"><span></span>${days.map((day) => `<span>${state.historyRange === 7 ? new Intl.DateTimeFormat("ko-KR", { weekday: "narrow" }).format(day) : new Intl.DateTimeFormat("ko-KR", { day: "numeric" }).format(day)}</span>`).join("")}</div>`;
  $("#heatmap").innerHTML = state.categories.map((category) => {
    const cells = days.map((day) => {
      const minutes = minutesFor(category.id, sessionsForDay(day));
      const ratio = category.goal ? minutes / category.goal : minutes / 60;
      const level = minutes === 0 ? "" : ratio < .3 ? "l1" : ratio < .65 ? "l2" : ratio < 1 ? "l3" : "l4";
      const today = sameLocalDay(day) ? "today" : "";
      const label = `${category.name} ${new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(day)} ${minutes ? formatMinutes(minutes) : "기록 없음"}`;
      return `<span class="heat-cell ${level} ${today}" style="background-color:${minutes ? safeColor(category.color) : ""}" title="${escapeHtml(label)}" role="img" aria-label="${escapeHtml(label)}"></span>`;
    }).join("");
    return `<div class="heatmap-row" style="--days:${state.historyRange};min-width:${heatmapMinWidth}px"><span class="heatmap-name">${escapeHtml(category.name)}</span>${cells}</div>`;
  }).join("");
  const periodSessions = days.flatMap((day) => sessionsForDay(day));
  const total = state.categories.reduce((sum, category) => sum + minutesFor(category.id, periodSessions), 0);
  $("#week-total").textContent = formatMinutes(total);
  $("#history-period-label").textContent = state.historyRange === 7 ? "이번 주 누적" : "최근 30일 누적";
  $("#active-days").textContent = `${days.filter((day) => sessionsForDay(day).length > 0).length}일`;
  const most = state.categories.map((category) => ({ category, minutes: minutesFor(category.id, periodSessions) })).sort((a, b) => b.minutes - a.minutes)[0];
  $("#week-summary").textContent = most.minutes ? `${most.category.name}에 가장 많은 시간을 썼어요.` : "아직 기록이 없어요.";
  const recent = [...allCompleted()].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)).slice(0, 8);
  $("#session-list").innerHTML = recent.map((session) => {
    const category = categoryById(session.categoryId);
    const from = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(session.startedAt));
    return `<button class="session-item" data-session-id="${escapeHtml(session.id)}" style="--category:${safeColor(category.color)}" type="button"><span class="session-color"></span><span class="session-info"><strong>${escapeHtml(category.name)}</strong><span>${from} 시작 · ${session.source === "device" ? "버튼 기록" : "앱 기록"}${session.memo ? " · 메모 있음" : ""}</span></span><span class="session-duration">${formatMinutes(durationMs(session) / 60_000)}</span></button>`;
  }).join("") || `<p class="page-intro">아직 완료된 기록이 없어요.</p>`;
  $$("[data-session-id]").forEach((item) => item.addEventListener("click", () => openSessionDialog(item.dataset.sessionId)));
  renderCategoryLibrary();
}

function alignHistoryViewport() {
  const historyScroller = $("#activity-map-scroll");
  if (!historyScroller) return;
  const align = () => {
    historyScroller.scrollLeft = state.historyRange === 30 ? Math.max(0, historyScroller.scrollWidth - historyScroller.clientWidth) : 0;
  };
  align();
  requestAnimationFrame(align);
}

function categoryStats(categoryId) {
  const sessions = allCompleted().filter((session) => session.categoryId === categoryId).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  return {
    sessions,
    totalMinutes: sessions.reduce((sum, session) => sum + durationMs(session) / 60_000, 0),
    activeDays: new Set(sessions.map((session) => dayKey(session.startedAt))).size,
    lastSession: sessions[0] || null,
  };
}

function renderCategoryLibrary() {
  const ordered = [...state.categories].sort((left, right) => {
    const leftSlot = state.assignments.indexOf(left.id); const rightSlot = state.assignments.indexOf(right.id);
    if (leftSlot !== -1 || rightSlot !== -1) return (leftSlot === -1 ? 99 : leftSlot) - (rightSlot === -1 ? 99 : rightSlot);
    if (left.status !== right.status) return left.status === "archived" ? 1 : -1;
    return categoryStats(right.id).totalMinutes - categoryStats(left.id).totalMinutes;
  });
  $("#category-library-copy").textContent = `${state.categories.length}개의 Category · Active 4에서 내려도 기록은 유지됩니다.`;
  $("#category-library").innerHTML = ordered.map((category) => {
    const stats = categoryStats(category.id);
    const slot = state.assignments.indexOf(category.id);
    const status = slot !== -1 ? `Button ${slot + 1} · Active 4` : category.status === "archived" ? "보관 중" : stats.lastSession ? `마지막 기록 ${new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(stats.lastSession.startedAt))}` : "아직 기록 없음";
    return `<button class="category-library-item" data-category-detail="${escapeHtml(category.id)}" style="--category:${safeColor(category.color)}" type="button"><span class="category-library-color"></span><span class="category-library-info"><strong>${escapeHtml(category.name)}</strong><span>${escapeHtml(status)}</span></span><span class="category-library-total">${formatMinutes(stats.totalMinutes)}</span><span class="category-library-arrow" aria-hidden="true">›</span></button>`;
  }).join("");
  $$("[data-category-detail]").forEach((button) => button.addEventListener("click", () => openCategoryDetail(button.dataset.categoryDetail)));
}

function updateCategoryReplacementCopy() {
  const category = categoryById(categoryDetailId);
  if (!category) return;
  const slot = Number($("#category-detail-target-slot").value || 0);
  const previous = categoryById(state.assignments[slot]);
  $("#category-detail-replacement-copy").textContent = `Button ${slot + 1}의 ${previous.name}을 ${category.name}으로 교체합니다. ${previous.name}의 기존 기록은 그대로 유지됩니다.`;
}

function openCategoryDetail(id) {
  const category = categoryById(id);
  if (!category) return;
  categoryDetailId = id;
  const stats = categoryStats(id);
  const slot = state.assignments.indexOf(id);
  $("#category-detail-title").textContent = category.name;
  $("#category-detail-color").style.backgroundColor = safeColor(category.color);
  $("#category-detail-status").textContent = slot !== -1 ? `Button ${slot + 1} · Active 4에서 사용 중` : category.status === "archived" ? "보관 중인 Category" : "전체 Category 기록";
  $("#category-detail-meta").textContent = stats.lastSession ? `마지막 기록 ${new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(stats.lastSession.startedAt))}` : "첫 번째 시간을 기록하면 이곳에 쌓이기 시작합니다.";
  $("#category-detail-total").textContent = formatMinutes(stats.totalMinutes);
  $("#category-detail-days").textContent = `${stats.activeDays}일`;
  $("#category-detail-sessions").textContent = `${stats.sessions.length}개`;
  const days = getDays(28);
  $("#category-detail-heatmap").innerHTML = days.map((day) => {
    const minutes = minutesFor(id, sessionsForDay(day));
    const ratio = category.goal ? minutes / category.goal : minutes / 60;
    const level = minutes === 0 ? "" : ratio < .3 ? "l1" : ratio < .65 ? "l2" : ratio < 1 ? "l3" : "l4";
    const label = `${category.name} ${new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(day)} ${minutes ? formatMinutes(minutes) : "기록 없음"}`;
    return `<span class="detail-heat-cell ${level}" style="${minutes ? `background-color:${safeColor(category.color)}` : ""}" title="${escapeHtml(label)}" role="img" aria-label="${escapeHtml(label)}"></span>`;
  }).join("");
  $("#category-detail-session-list").innerHTML = stats.sessions.slice(0, 5).map((session) => `<div class="detail-session-row"><span><strong>${new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(session.startedAt))}</strong><small>${new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(session.startedAt))} 시작${session.memo ? ` · ${escapeHtml(session.memo)}` : ""}</small></span><b>${formatMinutes(durationMs(session) / 60_000)}</b></div>`).join("") || `<p class="detail-empty">아직 완료된 Session이 없어요.</p>`;
  const controls = $("#category-detail-active4-controls");
  controls.classList.toggle("hidden", slot !== -1);
  if (slot === -1) {
    $("#category-detail-target-slot").innerHTML = state.assignments.map((assignedId, index) => `<option value="${index}">Button ${index + 1} · ${escapeHtml(categoryById(assignedId).name)}</option>`).join("");
    updateCategoryReplacementCopy();
  }
  $("#category-detail-dialog").showModal();
}

function addDetailCategoryToActive4() {
  if (state.activeSession) return showToast("진행 중인 기록을 종료한 뒤 Active 4를 변경해주세요.");
  const category = categoryById(categoryDetailId);
  if (!category || state.assignments.includes(category.id)) return;
  const slot = Number($("#category-detail-target-slot").value || 0);
  const previous = categoryById(state.assignments[slot]);
  state = applyActiveAssignments(state, placeCategoryInSlot(state.assignments, slot, category.id));
  saveState(); render(); $("#category-detail-dialog").close();
  showToast(`${category.name}을 Button ${slot + 1}에 연결했어요. ${previous.name} 기록은 유지됩니다.`);
}

function reflectionPeriodBounds(range = state.reflectionRange, offsetPeriods = 0) {
  const safeRange = range === 30 ? 30 : 7;
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1 - safeRange * offsetPeriods);
  const start = new Date(end);
  start.setDate(start.getDate() - safeRange);
  return { start, end, range: safeRange };
}

function overlapMsForPeriod(session, bounds) {
  const sessionStart = new Date(session.startedAt).getTime();
  const sessionEnd = new Date(session.endedAt || session.startedAt).getTime();
  return Math.max(0, Math.min(sessionEnd, bounds.end.getTime()) - Math.max(sessionStart, bounds.start.getTime()));
}

function formatReflectionPeriod(bounds) {
  const inclusiveEnd = new Date(bounds.end);
  inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
  const formatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" });
  return `${formatter.format(bounds.start)}–${formatter.format(inclusiveEnd)}`;
}

function formatReflectionMinutes(minutes) { return minutes > 0 ? formatMinutes(minutes) : "0분"; }

function getReflectionPeriodStats(range, offsetPeriods = 0) {
  const bounds = reflectionPeriodBounds(range, offsetPeriods);
  const completed = allCompleted();
  const sessions = completed.filter((session) => overlapMsForPeriod(session, bounds) > 0);
  const categories = state.categories.map((category) => {
    const categorySessions = sessions.filter((session) => session.categoryId === category.id);
    const minutes = categorySessions.reduce((sum, session) => sum + overlapMsForPeriod(session, bounds) / 60_000, 0);
    return { category, minutes, sessionCount: new Set(categorySessions.map((session) => session.id)).size };
  }).sort((left, right) => right.minutes - left.minutes);
  const totalMinutes = categories.reduce((sum, item) => sum + item.minutes, 0);
  const days = Array.from({ length: bounds.range }, (_, index) => {
    const day = new Date(bounds.start);
    day.setDate(day.getDate() + index);
    return day;
  });
  const activeDays = days.filter((day) => completed.some((session) => overlapMsForDay(session, day) > 0)).length;
  const uniqueSessions = [...new Map(sessions.map((session) => [session.id, session])).values()];
  const startedSessions = uniqueSessions.filter((session) => {
    const startedAt = new Date(session.startedAt).getTime();
    return startedAt >= bounds.start.getTime() && startedAt < bounds.end.getTime();
  });
  return {
    bounds,
    periodLabel: formatReflectionPeriod(bounds),
    totalMinutes,
    activeDays,
    activeDayAverage: activeDays ? totalMinutes / activeDays : 0,
    sessionCount: uniqueSessions.length,
    startedSessions,
    categories,
  };
}

function createReflectionFingerprint(facts) {
  const value = JSON.stringify(facts.map(({ key, message, evidence }) => ({ key, message, evidence })));
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `reflection-v1-${(hash >>> 0).toString(36)}`;
}

function getReflectionReport() {
  const range = state.reflectionRange === 30 ? 30 : 7;
  const current = getReflectionPeriodStats(range);
  const previous = getReflectionPeriodStats(range, 1);
  const periodEvidence = `${current.periodLabel} · ${range}일`;
  const facts = [];

  if (!current.totalMinutes) {
    facts.push({
      key: "comparison",
      type: "최근 대비",
      message: "선택한 기간에는 완료된 기록이 없어 직전 기간과의 변화를 계산하지 않았어요.",
      description: "첫 완료 Session이 생기면 같은 길이의 직전 기간과 비교합니다.",
      evidence: `${periodEvidence} · 현재 0분 · 이전 ${formatReflectionMinutes(previous.totalMinutes)}`,
      evidenceItems: [
        { label: "현재", value: "0분" },
        { label: "이전", value: formatReflectionMinutes(previous.totalMinutes) },
        { label: "기간", value: `${range}일` },
      ],
      insufficient: true,
    });
  } else if (!previous.totalMinutes) {
    facts.push({
      key: "comparison",
      type: "최근 대비",
      message: `선택한 기간에는 ${formatReflectionMinutes(current.totalMinutes)}이 쌓였고, 직전 같은 기간에는 비교할 기록이 없어요.`,
      description: "변화율 대신 확인 가능한 두 기간의 시간을 그대로 보여드립니다.",
      evidence: `${periodEvidence} · 현재 ${formatReflectionMinutes(current.totalMinutes)} · 이전 0분`,
      evidenceItems: [
        { label: "현재", value: formatReflectionMinutes(current.totalMinutes) },
        { label: "이전", value: "0분" },
        { label: "고유 Session", value: `${current.sessionCount}개` },
      ],
      insufficient: true,
    });
  } else {
    const difference = current.totalMinutes - previous.totalMinutes;
    const differencePercent = Math.round((difference / previous.totalMinutes) * 100);
    const message = Math.abs(difference) < 1
      ? "직전 같은 기간과 거의 같은 만큼의 시간이 기록됐어요."
      : `직전 같은 기간보다 ${formatReflectionMinutes(Math.abs(difference))} ${difference > 0 ? "더" : "덜"} 기록됐어요.`;
    facts.push({
      key: "comparison",
      type: "최근 대비",
      message,
      description: "같은 길이의 연속된 두 기간에서 완료된 시간을 비교했습니다.",
      evidence: `${periodEvidence} · 현재 ${formatReflectionMinutes(current.totalMinutes)} · 이전 ${formatReflectionMinutes(previous.totalMinutes)} · ${differencePercent > 0 ? "+" : ""}${differencePercent}%`,
      evidenceItems: [
        { label: "현재", value: formatReflectionMinutes(current.totalMinutes) },
        { label: "이전", value: formatReflectionMinutes(previous.totalMinutes) },
        { label: "변화", value: `${differencePercent > 0 ? "+" : ""}${differencePercent}%` },
      ],
    });
  }

  const leading = current.categories.find((item) => item.minutes > 0);
  if (leading) {
    const share = Math.round((leading.minutes / current.totalMinutes) * 100);
    facts.push({
      key: "top-share",
      type: "Category 비율",
      message: `${leading.category.name}에 ${formatReflectionMinutes(leading.minutes)}이 쌓여 전체의 ${share}%를 차지했어요.`,
      description: "선택한 기간의 총 기록 시간에서 Category가 차지한 비율입니다.",
      evidence: `${periodEvidence} · ${leading.category.name} ${formatReflectionMinutes(leading.minutes)} / 전체 ${formatReflectionMinutes(current.totalMinutes)} · Session ${leading.sessionCount}개`,
      evidenceItems: [
        { label: "Category", value: leading.category.name },
        { label: "시간", value: formatReflectionMinutes(leading.minutes) },
        { label: "비율", value: `${share}%` },
      ],
    });
  } else {
    facts.push({
      key: "top-share",
      type: "Category 비율",
      message: "Category 분포를 계산하려면 완료된 기록이 필요해요.",
      description: "첫 기록이 끝나면 Category별 시간과 비율을 나눠 보여드립니다.",
      evidence: `${periodEvidence} · 완료 Session 0개`,
      evidenceItems: [{ label: "완료 Session", value: "0개" }, { label: "기간", value: `${range}일` }],
      insufficient: true,
    });
  }

  const timeBands = [
    { label: "새벽", start: 0, end: 6, count: 0 },
    { label: "오전", start: 6, end: 12, count: 0 },
    { label: "오후", start: 12, end: 18, count: 0 },
    { label: "저녁", start: 18, end: 24, count: 0 },
  ];
  current.startedSessions.forEach((session) => {
    const hour = new Date(session.startedAt).getHours();
    const band = timeBands.find((item) => hour >= item.start && hour < item.end);
    if (band) band.count += 1;
  });
  const bandEvidence = timeBands.map((item) => `${item.label} ${item.count}개`).join(" · ");
  if (current.startedSessions.length < 3) {
    const needed = 3 - current.startedSessions.length;
    facts.push({
      key: "rhythm",
      type: "시작 리듬",
      message: `시작 시간의 리듬을 보려면 완료 Session이 ${needed}개 더 필요해요.`,
      description: "완료 Session 3개부터 시작 시간대의 분포를 관찰합니다.",
      evidence: `${periodEvidence} · 기간 안에서 시작한 Session ${current.startedSessions.length}개 · ${bandEvidence}`,
      evidenceItems: [
        { label: "시작 Session", value: `${current.startedSessions.length}개` },
        { label: "필요한 기록", value: `${needed}개` },
        { label: "기준", value: "완료 3개" },
      ],
      insufficient: true,
    });
  } else {
    const maxCount = Math.max(...timeBands.map((item) => item.count));
    const leaders = timeBands.filter((item) => item.count === maxCount);
    const message = leaders.length === 1
      ? `${leaders[0].label}에 시작한 Session이 ${maxCount}개로 가장 많았어요.`
      : `Session 시작이 ${leaders.map((item) => item.label).join("·")} 시간대에 고르게 나타났어요.`;
    facts.push({
      key: "rhythm",
      type: "시작 리듬",
      message,
      description: "완료 Session의 시작 시각을 네 시간대로 나눠 관찰했습니다.",
      evidence: `${periodEvidence} · ${bandEvidence}`,
      evidenceItems: timeBands.map((item) => ({ label: item.label, value: `${item.count}개` })),
    });
  }

  return { range, current, previous, periodLabel: `${current.periodLabel} · ${range}일`, facts, fingerprint: createReflectionFingerprint(facts) };
}

function getReflections() { return getReflectionReport().facts; }

function renderReflectionEvidence(items = []) {
  return `<dl class="reflection-evidence-grid">${items.map((item) => `<div class="reflection-evidence-item"><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join("")}</dl>`;
}

function renderReflections() {
  const report = getReflectionReport();
  const { current, facts } = report;
  $("#reflection-period-label").textContent = report.periodLabel;
  $$("#reflection-range-controls [data-reflection-range]").forEach((button) => {
    const selected = Number(button.dataset.reflectionRange) === report.range;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  $("#reflection-total").textContent = formatReflectionMinutes(current.totalMinutes);
  $("#reflection-active-days").textContent = `${current.activeDays}일`;
  $("#reflection-session-count").textContent = `${current.sessionCount}개`;
  $("#reflection-active-day-average").textContent = formatReflectionMinutes(current.activeDayAverage);

  const distribution = current.categories.filter((item) => item.minutes > 0);
  $("#reflection-distribution").innerHTML = distribution.length ? distribution.map((item) => {
    const share = Math.round((item.minutes / current.totalMinutes) * 100);
    return `<div class="reflection-distribution-row" style="--category:${safeColor(item.category.color)};--share:${share}%"><div class="reflection-distribution-heading"><strong>${escapeHtml(item.category.name)}</strong><span>${formatReflectionMinutes(item.minutes)} · ${share}%</span></div><span class="reflection-distribution-track" aria-hidden="true"><span class="reflection-distribution-fill"></span></span></div>`;
  }).join("") : `<p class="reflection-empty">이 기간에는 완료된 기록이 없어요. 첫 Session이 끝나면 분포가 나타납니다.</p>`;

  const ai = state.aiReflection;
  const snapshot = ai?.factSnapshot;
  const snapshotSource = snapshot?.fingerprint === report.fingerprint ? "현재 기록 스냅샷" : snapshot?.periodLabel || "생성 당시 스냅샷";
  const aiCard = snapshot?.message ? `<article class="reflection-card ai-generated"><div class="reflection-top"><span class="reflection-type">AI 보조</span><span class="reflection-source">${escapeHtml(snapshotSource)}</span></div><h2>${escapeHtml(ai.headline)}</h2><p>${escapeHtml(snapshot.message)}</p><div class="evidence">${renderReflectionEvidence(Array.isArray(snapshot.evidenceItems) ? snapshot.evidenceItems : [{ label: "근거", value: snapshot.evidence || "생성 당시 기록" }])}</div></article>` : "";
  const factCards = facts.map((reflection) => `<article class="reflection-card ${reflection.insufficient ? "insufficient" : ""}"><div class="reflection-top"><span class="reflection-type">${escapeHtml(reflection.type)}</span><span class="reflection-source">${escapeHtml(report.periodLabel)}</span></div><h2>${escapeHtml(reflection.message)}</h2><p>${escapeHtml(reflection.description)}</p><div class="evidence">${renderReflectionEvidence(reflection.evidenceItems)}</div></article>`).join("");
  $("#reflection-list").innerHTML = aiCard + factCards;
  const aiButton = $("#refresh-ai");
  aiButton.disabled = current.sessionCount === 0;
  aiButton.textContent = current.sessionCount === 0 ? "기록이 더 필요해요" : "AI 리플렉션 만들기";
}

function renderSettings() {
  $("#assignment-list").innerHTML = state.assignments.map((id, index) => {
    const category = categoryById(id);
    const options = selectableCategories().map((option) => `<option value="${escapeHtml(option.id)}" ${option.id === id ? "selected" : ""}>${escapeHtml(option.name)}</option>`).join("");
    return `<div class="assignment-row" style="--category:${safeColor(category.color)}"><b>${index + 1}</b><select data-assignment="${index}" aria-label="${index + 1}번 버튼 Category">${options}</select></div>`;
  }).join("");
  $$("[data-assignment]").forEach((select) => select.addEventListener("change", () => {
    const index = Number(select.dataset.assignment); const next = select.value;
    if (state.activeSession) {
      select.value = state.assignments[index];
      showToast("진행 중인 기록을 종료한 뒤 Active 4를 변경해주세요.");
      return;
    }
    const duplicateIndex = state.assignments.indexOf(next);
    if (duplicateIndex !== -1 && duplicateIndex !== index) [state.assignments[index], state.assignments[duplicateIndex]] = [state.assignments[duplicateIndex], state.assignments[index]];
    else state.assignments[index] = next;
    saveState(); render(); showToast("버튼 배치를 저장했어요.");
  }));
  $("#goal-list").innerHTML = state.categories.map((category) => `<div class="goal-row"><label for="goal-${escapeHtml(category.id)}">${escapeHtml(category.name)}</label><input id="goal-${escapeHtml(category.id)}" data-goal="${escapeHtml(category.id)}" type="number" inputmode="numeric" min="0" max="720" value="${escapeHtml(category.goal || 0)}"/><span>분</span></div>`).join("");
  $$("[data-goal]").forEach((input) => input.addEventListener("change", () => { const category = categoryById(input.dataset.goal); category.goal = Math.max(0, Math.min(720, Number(input.value) || 0)); saveState(); render(); showToast(`${category.name} 목표를 저장했어요.`); }));
  $("#category-manager").innerHTML = state.categories.map((category) => {
    const recordCount = allCompleted().filter((session) => session.categoryId === category.id).length;
    const assigned = state.assignments.includes(category.id);
    const archived = category.status === "archived";
    return `<div class="category-manager-row ${archived ? "archived" : ""}" style="--category:${safeColor(category.color)}"><span class="category-color"></span><button class="category-manager-edit" data-edit-category="${escapeHtml(category.id)}" type="button" aria-label="${escapeHtml(category.name)} Category 이름 편집"><span class="category-manager-info"><strong>${escapeHtml(category.name)}</strong><span>${archived ? "보관됨" : assigned ? "Active 4에 연결됨" : `기록 ${recordCount}개`}</span></span><span class="category-manager-edit-icon" aria-hidden="true">✎</span></button><button class="button secondary" data-archive-category="${escapeHtml(category.id)}" type="button">${archived ? "복원" : "보관"}</button></div>`;
  }).join("");
  $$('[data-edit-category]').forEach((button) => button.addEventListener("click", () => openCategoryEditor(button.dataset.editCategory)));
  $$("[data-archive-category]").forEach((button) => button.addEventListener("click", () => toggleArchiveCategory(button.dataset.archiveCategory)));
  const deleted = state.sessions.filter((session) => session.status === "deleted" && Date.now() - new Date(session.deletedAt || session.updatedAt || session.endedAt).getTime() < 30 * 24 * 60 * 60_000);
  $("#deleted-section").hidden = deleted.length === 0;
  $("#deleted-session-list").innerHTML = deleted.map((session) => {
    const category = categoryById(session.categoryId);
    return `<div class="category-manager-row" style="--category:${safeColor(category.color)}"><span class="category-color"></span><div class="category-manager-info"><strong>${escapeHtml(category.name)} · ${formatMinutes(durationMs(session) / 60_000)}</strong><span>${localDateInput(session.startedAt)}에 삭제됨</span></div><button class="button secondary" data-restore-session="${escapeHtml(session.id)}" type="button">복구</button></div>`;
  }).join("");
  $$("[data-restore-session]").forEach((button) => button.addEventListener("click", () => restoreSession(button.dataset.restoreSession)));
}

function renderManualOptions() { $("#manual-category").innerHTML = selectableCategories().map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join(""); }

function renderActive4Editor() {
  const options = state.categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}${category.status === "archived" ? " · 보관 중" : ""}</option>`).join("");
  $("#active4-editor-list").innerHTML = active4Draft.map((id, index) => {
    const category = categoryById(id);
    return `<label class="active4-editor-row" style="--category:${safeColor(category.color)}"><span class="active4-slot">${index + 1}</span><span class="active4-row-copy"><strong>Button ${index + 1}</strong><span>현재 ${escapeHtml(category.name)}</span></span><select data-active4-slot="${index}" aria-label="Button ${index + 1} Category">${options}</select></label>`;
  }).join("");
  $$('[data-active4-slot]').forEach((select) => {
    const index = Number(select.dataset.active4Slot);
    select.value = active4Draft[index];
    select.addEventListener("change", () => {
      const next = select.value;
      active4Draft = placeCategoryInSlot(active4Draft, index, next);
      renderActive4Editor();
    });
  });
}

function openActive4Editor() {
  if (state.activeSession) return showToast("진행 중인 기록을 종료한 뒤 Active 4를 편집해주세요.");
  active4Draft = [...state.assignments];
  renderActive4Editor();
  $("#active4-dialog").showModal();
}

function saveActive4Editor() {
  if (state.activeSession) return showToast("진행 중인 기록을 먼저 종료해주세요.");
  state = applyActiveAssignments(state, active4Draft);
  saveState(); render(); $("#active4-dialog").close();
  showToast("Active 4를 변경했어요. 이전 기록은 그대로 유지됩니다.");
}

function renderDeviceStatus() {
  const connected = serialDevice.connected;
  $("#device-status-text").textContent = connected ? "USB 기기 연결됨" : "데모 기기 연결됨";
  $("#device-panel-status").textContent = connected ? "USB Serial 연결됨" : "데모 모드";
  $("#device-panel-copy").textContent = connected ? "보드 버튼 이벤트와 LED 상태를 동기화하고 있어요." : "키보드 1–4 또는 화면 버튼으로 테스트할 수 있어요.";
  $("#connection-state").textContent = connected ? "현재: USB Serial 연결됨 · 115200 baud" : "현재: 데모 모드";
  $("#serial-connect").classList.toggle("hidden", connected);
  $("#serial-disconnect").classList.toggle("hidden", !connected);
}
function render() { renderToday(); renderHistory(); renderReflections(); renderSettings(); renderManualOptions(); renderDeviceStatus(); syncDeviceLights(); }

function revealActiveSession() {
  const activeCategory = state.activeSession ? categoryById(state.activeSession.categoryId) : null;
  if (!activeCategory) return false;
  if ($("#record-dialog").open) $("#record-dialog").close();
  switchTab("today");
  requestAnimationFrame(() => {
    const now = $("#now-card");
    now.scrollIntoView({ behavior: "smooth", block: "center" });
    now.focus({ preventScroll: true });
  });
  showToast(`${activeCategory.name} 기록이 이미 진행 중이에요.`);
  return true;
}

function startSession(categoryId, source = "device", { notify = true } = {}) {
  const category = categoryById(categoryId);
  if (!category) return false;
  if (state.activeSession) return revealActiveSession();
  state.activeSession = { id: randomId(), categoryId, startedAt: new Date().toISOString(), source, status: "running" };
  saveState(); render();
  if (notify) showToast(`${category.name} 기록을 시작했어요.`);
  return true;
}

function stopSession({ notify = true } = {}) {
  if (!state.activeSession) return;
  const session = { ...state.activeSession, endedAt: new Date().toISOString(), status: "completed" };
  state.sessions.push(session); state.activeSession = null; saveState(); render();
  if (notify) showToast(`${categoryById(session.categoryId).name} ${formatMinutes(durationMs(session) / 60_000)}을 기록했어요.`);
}

function pressButton(index) {
  const categoryId = state.assignments[index - 1];
  if (!categoryId) return showToast("아직 연결되지 않은 버튼이에요.");
  if (!state.activeSession) return startSession(categoryId, "device");
  if (state.activeSession.categoryId === categoryId) return stopSession();
  const previous = categoryById(state.activeSession.categoryId).name;
  stopSession({ notify: false }); startSession(categoryId, "device", { notify: false });
  showToast(`${previous}을 끝내고 ${categoryById(categoryId).name}을 시작했어요.`);
}

function openSessionDialog(id) {
  const session = state.sessions.find((item) => item.id === id);
  if (!session) return;
  $("#session-id").value = session.id;
  $("#session-category").innerHTML = state.categories.map((category) => `<option value="${escapeHtml(category.id)}" ${session.categoryId === category.id ? "selected" : ""}>${escapeHtml(category.name)}${category.status === "archived" ? " (보관됨)" : ""}</option>`).join("");
  $("#session-date").value = localDateInput(session.startedAt);
  $("#session-time").value = localTimeInput(session.startedAt);
  $("#session-duration").value = Math.max(1, Math.round(durationMs(session) / 60_000));
  $("#session-memo").value = session.memo || "";
  $("#session-dialog").showModal();
}

function saveSessionFromDialog() {
  const id = $("#session-id").value;
  const session = state.sessions.find((item) => item.id === id);
  if (!session) return;
  const started = new Date(`${$("#session-date").value}T${$("#session-time").value}:00`);
  const requestedMinutes = Number($("#session-duration").value);
  if (Number.isNaN(started.getTime()) || !Number.isFinite(requestedMinutes) || requestedMinutes < 1) return showToast("날짜와 시간을 다시 확인해주세요.");
  const minutes = Math.min(720, requestedMinutes);
  session.categoryId = $("#session-category").value;
  session.startedAt = started.toISOString();
  session.endedAt = new Date(started.getTime() + minutes * 60_000).toISOString();
  session.memo = $("#session-memo").value.trim();
  session.updatedAt = new Date().toISOString();
  saveState(); render(); $("#session-dialog").close(); showToast("기록을 수정했어요.");
}

function deleteSessionFromDialog() {
  const id = $("#session-id").value;
  const session = state.sessions.find((item) => item.id === id);
  if (!session) return;
  session.status = "deleted";
  session.deletedAt = new Date().toISOString();
  saveState(); render(); $("#session-dialog").close(); showToast("기록을 삭제했어요. 30일 안에 복구할 수 있어요.");
}

function restoreSession(id) {
  const session = state.sessions.find((item) => item.id === id);
  if (!session || session.status !== "deleted") return;
  session.status = "completed";
  delete session.deletedAt;
  session.updatedAt = new Date().toISOString();
  saveState(); render(); showToast("기록을 복구했어요.");
}

function toggleArchiveCategory(id) {
  const category = categoryById(id);
  if (!category) return;
  if (category.status !== "archived" && state.assignments.includes(id)) return showToast("Active 4에서 먼저 다른 Category로 바꿔주세요.");
  category.status = category.status === "archived" ? "active" : "archived";
  saveState(); render(); showToast(`${category.name}을 ${category.status === "archived" ? "보관" : "복원"}했어요.`);
}

function setCategoryNameError(message = "") {
  const input = $("#new-category-name");
  const error = $("#category-name-error");
  input.setCustomValidity(message);
  input.setAttribute("aria-invalid", String(Boolean(message)));
  error.textContent = message;
  error.hidden = !message;
}

function openCategoryEditor(id = null) {
  const category = id ? categoryById(id) : null;
  if (id && !category) return showToast("Category를 찾지 못했어요.");
  categoryEditingId = category?.id || null;
  $("#category-form").reset();
  setCategoryNameError();
  $("#category-dialog-eyebrow").textContent = category ? "Category 편집" : "새 Category";
  $("#category-dialog-title").textContent = category ? `${category.name}을 다듬으세요` : "남기고 싶은 시간을 추가하세요";
  $("#save-category").textContent = category ? "변경사항 저장" : "Category 추가";
  if (category) {
    $("#new-category-name").value = category.name;
    $("#new-category-color").value = safeColor(category.color);
    $("#new-category-goal").value = Math.max(0, Math.min(720, Number(category.goal) || 0));
  }
  $("#category-dialog").showModal();
  requestAnimationFrame(() => {
    $("#new-category-name").focus();
    $("#new-category-name").select();
  });
}

function focusCategoryManagement(id) {
  requestAnimationFrame(() => {
    const editButton = $$("[data-edit-category]").find((button) => button.dataset.editCategory === id);
    const libraryButton = $$("[data-category-detail]").find((button) => button.dataset.categoryDetail === id);
    const target = $("#view-settings").classList.contains("active") ? editButton : libraryButton;
    (target || $("#add-category")).focus();
  });
}

function saveCategoryFromDialog() {
  const name = $("#new-category-name").value.trim();
  if (!name || name.length > 20) {
    setCategoryNameError(name ? "Category 이름은 20자 이하로 입력해주세요." : "Category 이름을 입력해주세요.");
    $("#new-category-name").focus();
    return;
  }
  const normalizedName = name.toLocaleLowerCase("ko-KR");
  const duplicate = state.categories.some((category) => category.id !== categoryEditingId && category.name.trim().toLocaleLowerCase("ko-KR") === normalizedName);
  if (duplicate) {
    setCategoryNameError("같은 이름의 Category가 이미 있어요.");
    $("#new-category-name").focus();
    return;
  }
  const color = safeColor($("#new-category-color").value);
  const goal = Math.max(0, Math.min(720, Number($("#new-category-goal").value) || 0));
  let category = categoryEditingId ? categoryById(categoryEditingId) : null;
  const edited = Boolean(category);
  if (categoryEditingId && !category) {
    setCategoryNameError("Category를 찾지 못했어요. 창을 닫고 다시 시도해주세요.");
    return;
  }
  if (category) {
    category.name = name;
    category.color = color;
    category.goal = goal;
    state.aiReflection = null;
  } else {
    category = { id: randomId(), name, color, goal, status: "active" };
    state.categories.push(category);
  }
  const categoryId = category.id;
  $("#category-dialog").close();
  $("#category-form").reset();
  categoryEditingId = null;
  setCategoryNameError();
  saveState();
  $("#mini-insight-text").textContent = "";
  render();
  focusCategoryManagement(categoryId);
  showToast(edited ? `${name} Category를 수정했어요.` : `${name} Category를 추가했어요.`);
}

function exportData() {
  const payload = { exportedAt: new Date().toISOString(), product: "Rhythm Hero", data: state };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = `rhythm-hero-${localDateInput(new Date())}.json`; link.click(); URL.revokeObjectURL(url);
  showToast("데이터를 내보냈어요.");
}

function parseHardwareLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return;
  const shorthand = trimmed.match(/^BUTTON\s*:\s*([1-4])$/i);
  if (shorthand) return pressButton(Number(shorthand[1]));
  try {
    const event = JSON.parse(trimmed);
    if (event?.type === "button" && Number.isInteger(Number(event.index)) && Number(event.index) >= 1 && Number(event.index) <= 4) pressButton(Number(event.index));
  } catch (_) {
    console.warn("Rhythm Hero ignored an unknown serial line", trimmed);
  }
}

async function queueSerialWrite(payload) {
  if (!serialDevice.connected || !serialDevice.writer) return;
  const line = `${JSON.stringify(payload)}\n`;
  serialWriteQueue = serialWriteQueue.then(() => serialDevice.writer.write(new TextEncoder().encode(line))).catch((error) => {
    console.warn("Rhythm Hero serial write failed", error);
    disconnectSerial(false);
  });
  return serialWriteQueue;
}

function syncDeviceLights() {
  if (!serialDevice.connected) return;
  const buttons = state.assignments.map((id, index) => {
    const category = categoryById(id);
    return {
      index: index + 1,
      color: safeColor(category.color),
      progress: category.goal ? Math.min(1, todayMinutes(id) / category.goal) : Math.min(1, todayMinutes(id) / 60),
      running: state.activeSession?.categoryId === id,
    };
  });
  const payload = { type: "led", buttons };
  const fingerprint = JSON.stringify(payload);
  if (fingerprint === serialDevice.lastPayload) return;
  serialDevice.lastPayload = fingerprint;
  queueSerialWrite(payload);
}

async function readSerialLoop() {
  const decoder = new TextDecoder();
  try {
    while (serialDevice.port?.readable && serialDevice.connected) {
      serialDevice.reader = serialDevice.port.readable.getReader();
      try {
        while (serialDevice.connected) {
          const { value, done } = await serialDevice.reader.read();
          if (done) break;
          serialDevice.buffer += decoder.decode(value, { stream: true });
          const lines = serialDevice.buffer.split(/\r?\n/);
          serialDevice.buffer = lines.pop() || "";
          lines.forEach(parseHardwareLine);
        }
      } finally {
        serialDevice.reader.releaseLock();
        serialDevice.reader = null;
      }
      break;
    }
  } catch (error) {
    if (serialDevice.connected) { console.warn("Rhythm Hero serial read failed", error); await disconnectSerial(false); }
  }
}

async function connectSerial() {
  if (!("serial" in navigator)) return showToast("이 브라우저는 USB Serial을 지원하지 않아요. Chrome에서 열어주세요.");
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    serialDevice.port = port;
    serialDevice.writer = port.writable.getWriter();
    serialDevice.connected = true;
    serialDevice.lastPayload = "";
    renderDeviceStatus(); syncDeviceLights(); readSerialLoop();
    showToast("Rhythm Hero USB 보드를 연결했어요.");
  } catch (error) {
    if (error?.name !== "NotFoundError") showToast("USB 기기 연결에 실패했어요.");
  }
}

async function disconnectSerial(showMessage = true) {
  const { port, reader, writer } = serialDevice;
  serialDevice.connected = false;
  serialDevice.lastPayload = "";
  try { await reader?.cancel(); } catch (_) { /* reader may already be closed */ }
  try { writer?.releaseLock(); } catch (_) { /* writer may already be released */ }
  serialDevice.reader = null; serialDevice.writer = null;
  try { await port?.close(); } catch (_) { /* browser closes some ports automatically */ }
  serialDevice.port = null;
  renderDeviceStatus();
  if (showMessage) showToast("USB 기기 연결을 해제했어요.");
}

async function requestAiReflection() {
  const button = $("#refresh-ai");
  const report = getReflectionReport();
  if (!report.current.sessionCount) return showToast("완료된 기록이 생기면 AI 리플렉션을 만들 수 있어요.");
  const facts = report.facts.map(({ message, evidence }) => ({ message, evidence }));
  button.disabled = true;
  button.textContent = "생성 중…";
  try {
    const response = await fetch("/api/reflection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facts }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Reflection request failed");
    const selectedFact = report.facts[result.factIndex];
    if (!selectedFact) throw new Error("Reflection fact snapshot is unavailable");
    state.aiReflection = {
      headline: result.headline,
      factIndex: result.factIndex,
      factSnapshot: {
        key: selectedFact.key,
        type: selectedFact.type,
        message: selectedFact.message,
        description: selectedFact.description,
        evidence: selectedFact.evidence,
        evidenceItems: selectedFact.evidenceItems,
        range: report.range,
        periodLabel: report.periodLabel,
        fingerprint: report.fingerprint,
      },
      createdAt: new Date().toISOString(),
    };
    saveState(); renderReflections(); showToast("OpenAI 리플렉션을 만들었어요.");
  } catch (error) {
    if (error.message === "OPENAI_API_KEY is not configured") showToast("API 키를 설정하면 OpenAI 리플렉션을 만들 수 있어요.");
    else showToast("리플렉션을 만들지 못했어요. 근거 기반 카드로 계속 볼 수 있어요.");
  } finally {
    button.disabled = false;
    button.textContent = "AI 리플렉션 만들기";
  }
}

function switchTab(tab) {
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${tab}`));
  $$(".nav-item").forEach((item) => {
    const selected = item.dataset.tab === tab;
    item.classList.toggle("active", selected);
    item.setAttribute("aria-current", selected ? "page" : "false");
  });
  if (tab === "history") alignHistoryViewport();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Keep navigation resilient even when the visible shell is refreshed by the PWA cache.
document.addEventListener("click", (event) => {
  const eventTarget = event.target instanceof Element ? event.target : null;
  const tabButton = eventTarget?.closest("[data-tab]");
  if (tabButton) {
    if (tabButton.matches("a")) event.preventDefault();
    switchTab(tabButton.dataset.tab);
  }
});

function wireEvents() {
  $$(".bottom-nav .nav-item").forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    switchTab(button.dataset.tab);
  }));
  $$(".segmented button[data-range]").forEach((button) => button.addEventListener("click", () => { state.historyRange = Number(button.dataset.range); saveState(); renderHistory(); alignHistoryViewport(); }));
  $$("#reflection-range-controls [data-reflection-range]").forEach((button) => button.addEventListener("click", () => {
    state.reflectionRange = Number(button.dataset.reflectionRange) === 30 ? 30 : 7;
    saveState();
    renderReflections();
    $("#mini-insight-text").textContent = getReflections()[0].message;
  }));
  $("#edit-active4").addEventListener("click", openActive4Editor);
  $("#active4-form").addEventListener("submit", (event) => { if (event.submitter?.id === "save-active4") { event.preventDefault(); saveActive4Editor(); } });
  $("#category-detail-target-slot").addEventListener("change", updateCategoryReplacementCopy);
  $("#category-detail-add-active4").addEventListener("click", addDetailCategoryToActive4);
  $("#edit-category-detail").addEventListener("click", () => {
    const id = categoryDetailId;
    $("#category-detail-dialog").close();
    openCategoryEditor(id);
  });
  $("#stop-session").addEventListener("click", () => stopSession());
  $("#manual-start").addEventListener("click", () => {
    if (state.activeSession) return revealActiveSession();
    $("#record-dialog").showModal();
  });
  $("#record-form").addEventListener("submit", (event) => {
    if (event.submitter?.id !== "manual-confirm") return;
    event.preventDefault();
    if (state.activeSession) return revealActiveSession();
    const categoryId = $("#manual-category").value;
    $("#record-dialog").close();
    startSession(categoryId, "app");
  });
  $("#session-form").addEventListener("submit", (event) => {
    if (event.submitter?.id === "save-session") { event.preventDefault(); saveSessionFromDialog(); }
    if (event.submitter?.id === "delete-session") { event.preventDefault(); deleteSessionFromDialog(); }
  });
  $("#add-category").addEventListener("click", () => openCategoryEditor());
  $("#new-category-name").addEventListener("input", () => setCategoryNameError());
  $("#new-category-name").addEventListener("invalid", (event) => {
    event.preventDefault();
    setCategoryNameError("Category 이름을 입력해주세요.");
    $("#new-category-name").focus();
  });
  $("#category-dialog").addEventListener("close", () => { categoryEditingId = null; setCategoryNameError(); });
  $("#category-form").addEventListener("submit", (event) => { if (event.submitter?.id === "save-category") { event.preventDefault(); saveCategoryFromDialog(); } });
  $("#export-data").addEventListener("click", exportData);
  $("#refresh-ai").addEventListener("click", requestAiReflection);
  $("#reset-demo").addEventListener("click", () => { state = createDefaultState(); saveState(); render(); showToast("데모 데이터를 다시 불러왔어요."); });
  $("#test-hardware").addEventListener("click", () => { switchTab("today"); setTimeout(() => pressButton(1), 250); });
  $("#device-status").addEventListener("click", () => $("#device-dialog").showModal());
  $("#connect-device").addEventListener("click", () => $("#device-dialog").showModal());
  $("#serial-connect").addEventListener("click", connectSerial);
  $("#serial-disconnect").addEventListener("click", () => disconnectSerial());
  if ("serial" in navigator) navigator.serial.addEventListener("disconnect", (event) => { if (event.target === serialDevice.port) disconnectSerial(false); });
  window.addEventListener("keydown", (event) => {
    const target = event.target;
    const editing = target instanceof HTMLElement && (target.matches("input, select, textarea") || target.isContentEditable);
    if (editing || $("dialog[open]") || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key >= "1" && event.key <= "4") pressButton(Number(event.key));
  });
  setInterval(() => { if (state.activeSession) renderToday(); }, 1000);
}

// Firmware bridge: an embedded client can call window.habitToy.pressButton(1..4).
window.habitToy = { pressButton, getState: () => structuredClone(state) };

render(); wireEvents();
window.addEventListener("online", () => { if (remoteReady) syncToServer(); else restoreRemoteState(); });
window.addEventListener("offline", () => setSyncStatus("오프라인 · 로컬 기록"));
restoreRemoteState();
if ("serviceWorker" in navigator) {
  let refreshingForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshingForUpdate) return;
    refreshingForUpdate = true;
    window.location.reload();
  });
  navigator.serviceWorker.register("sw.js?v=20", { updateViaCache: "none" }).then((registration) => registration.update()).catch(() => {});
}
