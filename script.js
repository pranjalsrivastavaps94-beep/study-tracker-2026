             import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// =========================
// FIREBASE CONFIG
// =========================
// YAHAN APNA FIREBASE CONFIG PASTE KARNA HAI
const firebaseConfig = {
  apiKey: "AIzaSyDbcuGVzrtghf00jWfNgtbIbaELHFxQGk",
  authDomain: "study-tracker-2026-71e42.firebaseapp.com",
  projectId: "study-tracker-2026-71e42",
  storageBucket: "study-tracker-2026-71e42.firebasestorage.app",
  messagingSenderId: "1083035958277",
  appId: "1:1083035958277:web:fad1c596c84001cd5ff06c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM
const splash = document.getElementById("splash");
const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");
const showLoginBtn = document.getElementById("showLoginBtn");
const showSignupBtn = document.getElementById("showSignupBtn");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const authMessage = document.getElementById("authMessage");
const logoutBtn = document.getElementById("logoutBtn");
const enableNotificationBtn = document.getElementById("enableNotificationBtn");

const userNameText = document.getElementById("userNameText");
const liveDate = document.getElementById("liveDate");
const liveClock = document.getElementById("liveClock");
const todayDateLabel = document.getElementById("todayDateLabel");
const selectedMonthLabel = document.getElementById("selectedMonthLabel");
const selectedDateLabel = document.getElementById("selectedDateLabel");
const selectedDayHours = document.getElementById("selectedDayHours");
const selectedMonthHours = document.getElementById("selectedMonthHours");
const todayHoursValue = document.getElementById("todayHoursValue");
const selectedDayHoursValue = document.getElementById("selectedDayHoursValue");
const selectedMonthHoursValue = document.getElementById("selectedMonthHoursValue");
const totalCloudHoursValue = document.getElementById("totalCloudHoursValue");
const streakDaysEl = document.getElementById("streakDays");

const monthPicker = document.getElementById("monthPicker");
const datePicker = document.getElementById("datePicker");
const graphMode = document.getElementById("graphMode");
const calendarTitle = document.getElementById("calendarTitle");
const calendarGrid = document.getElementById("calendarGrid");
const graphTitle = document.getElementById("graphTitle");

const stopwatchDisplay = document.getElementById("stopwatchDisplay");
const startStopwatchBtn = document.getElementById("startStopwatchBtn");
const pauseStopwatchBtn = document.getElementById("pauseStopwatchBtn");
const resetStopwatchBtn = document.getElementById("resetStopwatchBtn");
const stopwatchStatus = document.getElementById("stopwatchStatus");

const focusMinutesInput = document.getElementById("focusMinutes");
const breakMinutesInput = document.getElementById("breakMinutes");
const pomodoroDisplay = document.getElementById("pomodoroDisplay");
const startPomodoroBtn = document.getElementById("startPomodoroBtn");
const pausePomodoroBtn = document.getElementById("pausePomodoroBtn");
const resetPomodoroBtn = document.getElementById("resetPomodoroBtn");
const pomodoroStatus = document.getElementById("pomodoroStatus");

const taskNameInput = document.getElementById("taskNameInput");
const taskTargetMinutesInput = document.getElementById("taskTargetMinutesInput");
const addTaskBtn = document.getElementById("addTaskBtn");
const tasksContainer = document.getElementById("tasksContainer");

let currentUser = null;
let userDocCache = null;
let chart = null;

const todayKey = getDateKey(new Date());
let selectedDateKey = todayKey;
let selectedMonthKey = todayKey.slice(0, 7);

let globalStopwatchSeconds = 0;
let globalStopwatchInterval = null;
let isGlobalRunning = false;

let pomodoroInterval = null;
let pomodoroRemaining = 25 * 60;
let pomodoroMode = "focus";
let pomodoroRunning = false;

const activeTaskIntervals = new Map();

function getDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function secondsToHHMMSS(totalSeconds) {
  const sec = Math.max(0, Number(totalSeconds || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function secondsToHM(hoursSeconds) {
  return `${(Number(hoursSeconds || 0) / 3600).toFixed(2)}h`;
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function ensureUserShape(data) {
  return {
    profile: {
      name: data?.profile?.name || currentUser?.displayName || "User",
      email: data?.profile?.email || currentUser?.email || "",
    },
    stats: {
      totalSeconds: Number(data?.stats?.totalSeconds || 0),
      streakDays: Number(data?.stats?.streakDays || 0),
      lastStreakDate: data?.stats?.lastStreakDate || "",
    },
    studyByDate: data?.studyByDate || {},
    tasksByDate: data?.tasksByDate || {},
    updatedAt: data?.updatedAt || null,
  };
}

function getSelectedDateSeconds() {
  return Number(userDocCache?.studyByDate?.[selectedDateKey] || 0);
}

function getTodaySeconds() {
  return Number(userDocCache?.studyByDate?.[todayKey] || 0);
}

function getMonthTotalSeconds(monthKey) {
  const study = userDocCache?.studyByDate || {};
  return Object.entries(study)
    .filter(([dateKey]) => dateKey.startsWith(monthKey))
    .reduce((sum, [, sec]) => sum + Number(sec || 0), 0);
}

function getMonthDayMap(monthKey) {
  const map = {};
  const study = userDocCache?.studyByDate || {};
  for (const [dateKey, sec] of Object.entries(study)) {
    if (dateKey.startsWith(monthKey)) {
      const day = Number(dateKey.slice(-2));
      map[day] = Number(sec || 0);
    }
  }
  return map;
}

function getSelectedTasks() {
  return Array.isArray(userDocCache?.tasksByDate?.[selectedDateKey])
    ? userDocCache.tasksByDate[selectedDateKey]
    : [];
}

async function saveUserDoc() {
  if (!currentUser || !userDocCache) return;
  const ref = doc(db, "studyTrackerUsers", currentUser.uid);
  await setDoc(
    ref,
    {
      ...userDocCache,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

function setAuthMessage(msg, ok = false) {
  authMessage.textContent = msg;
  authMessage.style.color = ok ? "#c9ffd7" : "#ffd1d1";
}

function notifyUser(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "icon-192.png",
      badge: "icon-192.png",
    });
  }
}

function updateLiveClock() {
  const now = new Date();
  liveDate.textContent = now.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  liveClock.textContent = now.toLocaleTimeString();
  todayDateLabel.textContent = now.toLocaleDateString();
}

function updateStopwatchUI() {
  stopwatchDisplay.textContent = secondsToHHMMSS(globalStopwatchSeconds);
  stopwatchStatus.textContent = isGlobalRunning ? "ON" : "OFF";
}

function updatePomodoroUI() {
  const mm = String(Math.floor(pomodoroRemaining / 60)).padStart(2, "0");
  const ss = String(pomodoroRemaining % 60).padStart(2, "0");
  pomodoroDisplay.textContent = `${mm}:${ss}`;
  pomodoroStatus.textContent = pomodoroRunning
    ? pomodoroMode === "focus"
      ? "FOCUS RUNNING"
      : "BREAK RUNNING"
    : pomodoroMode === "focus"
      ? "FOCUS READY"
      : "BREAK READY";
}

function updateSummaryUI() {
  selectedMonthLabel.textContent = monthLabel(selectedMonthKey);
  selectedDateLabel.textContent = selectedDateKey;

  const selectedDaySec = getSelectedDateSeconds();
  const selectedMonthSec = getMonthTotalSeconds(selectedMonthKey);
  const todaySec = getTodaySeconds();
  const totalSec = Number(userDocCache?.stats?.totalSeconds || 0);

  selectedDayHours.textContent = secondsToHM(selectedDaySec);
  selectedMonthHours.textContent = secondsToHM(selectedMonthSec);
  todayHoursValue.textContent = secondsToHM(todaySec);
  selectedDayHoursValue.textContent = secondsToHM(selectedDaySec);
  selectedMonthHoursValue.textContent = secondsToHM(selectedMonthSec);
  totalCloudHoursValue.textContent = secondsToHM(totalSec);
  streakDaysEl.textContent = Number(userDocCache?.stats?.streakDays || 0);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderTasks() {
  const tasks = getSelectedTasks();
  tasksContainer.innerHTML = "";

  if (!tasks.length) {
    tasksContainer.innerHTML = `<div class="task-item"><div class="task-name">No task for ${selectedDateKey}</div><div class="task-meta">Add a task above.</div></div>`;
    return;
  }

  tasks.forEach((task) => {
    const percent = task.targetMinutes > 0
      ? Math.min(100, ((task.trackedSeconds / 60) / task.targetMinutes) * 100)
      : 0;

    const wrapper = document.createElement("div");
    wrapper.className = "task-item";
    wrapper.innerHTML = `
      <div class="task-top">
        <div>
          <div class="task-name">${escapeHtml(task.name)} ${task.done ? "✅" : ""}</div>
          <div class="task-meta">Tracked: ${secondsToHM(task.trackedSeconds)} | Target: ${task.targetMinutes} min</div>
        </div>
        <div class="pill">${secondsToHHMMSS(task.localRunningSeconds || task.trackedSeconds)}</div>
      </div>
      <div class="task-progress"><div style="width:${percent}%"></div></div>
      <div class="task-actions">
        <button class="small-btn success" data-action="start" data-id="${task.id}" type="button">Start</button>
        <button class="small-btn warning" data-action="stop" data-id="${task.id}" type="button">Stop</button>
        <button class="small-btn secondary" data-action="done" data-id="${task.id}" type="button">${task.done ? "Undo" : "Done"}</button>
        <button class="small-btn danger" data-action="delete" data-id="${task.id}" type="button">Delete</button>
      </div>
    `;
    tasksContainer.appendChild(wrapper);
  });
}

function renderCalendar() {
  const [year, month] = selectedMonthKey.split("-").map(Number);
  const firstDayIndex = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthMap = getMonthDayMap(selectedMonthKey);

  calendarTitle.textContent = monthLabel(selectedMonthKey);
  calendarGrid.innerHTML = "";

  for (let i = 0; i < firstDayIndex; i++) {
    const blank = document.createElement("div");
    blank.className = "calendar-day empty";
    calendarGrid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${selectedMonthKey}-${String(day).padStart(2, "0")}`;
    const seconds = Number(monthMap[day] || 0);
    const isToday = dateKey === todayKey;
    const isSelected = dateKey === selectedDateKey;
    const isComplete = seconds >= 4 * 3600;
    const isStreakDay = isComplete;

    const cell = document.createElement("button");
    cell.className = "calendar-day";
    cell.type = "button";
    if (isToday) cell.classList.add("today");
    if (isSelected) cell.classList.add("selected");
    if (isComplete) cell.classList.add("complete");
    if (isStreakDay) cell.classList.add("streak");

    cell.innerHTML = `
      <span class="date-number">${day}</span>
      <span class="date-hours">${(seconds / 3600).toFixed(2)}h</span>
    `;

    cell.addEventListener("click", () => {
      selectedDateKey = dateKey;
      datePicker.value = dateKey;
      updateSummaryUI();
      renderCalendar();
      renderTasks();
    });

    calendarGrid.appendChild(cell);
  }
}

function renderChart() {
  const mode = graphMode.value;
  const targetMonth = mode === "month" ? getDateKey(new Date()).slice(0, 7) : selectedMonthKey;
  const [year, month] = targetMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const map = getMonthDayMap(targetMonth);

  const labels = [];
  const data = [];
  for (let i = 1; i <= daysInMonth; i++) {
    labels.push(String(i));
    data.push(Number(((map[i] || 0) / 3600).toFixed(2)));
  }

  graphTitle.textContent = `${monthLabel(targetMonth)} - Daily Hours`;

  if (chart) {
    chart.destroy();
  }

  const ctx = document.getElementById("studyChart");
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Study Hours",
          data,
          borderRadius: 8,
          backgroundColor: "rgba(65, 133, 255, 0.82)",
          borderColor: "rgba(131, 184, 255, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#e9f0ff",
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#d8e5ff" },
          grid: { color: "rgba(255,255,255,0.06)" },
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#d8e5ff" },
          grid: { color: "rgba(255,255,255,0.06)" },
        },
      },
    },
  });
}

async function refreshAppUI() {
  if (!userDocCache) return;
  updateSummaryUI();
  renderCalendar();
  renderTasks();
  renderChart();
}

function ensureSelectedMonthAndDateInputs() {
  monthPicker.value = selectedMonthKey;
  datePicker.value = selectedDateKey;
}

async function maybeUpdateStreak() {
  const daySeconds = Number(userDocCache.studyByDate[selectedDateKey] || 0);
  if (daySeconds < 4 * 3600) return;

  const last = userDocCache.stats.lastStreakDate || "";
  if (last === selectedDateKey) return;

  const lastDate = last ? new Date(last + "T00:00:00") : null;
  const currentDate = new Date(selectedDateKey + "T00:00:00");

  if (!lastDate) {
    userDocCache.stats.streakDays = 1;
  } else {
    const diffDays = Math.round((currentDate - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      userDocCache.stats.streakDays = Number(userDocCache.stats.streakDays || 0) + 1;
    } else if (diffDays === 0) {
      return;
    } else {
      userDocCache.stats.streakDays = 1;
    }
  }

  userDocCache.stats.lastStreakDate = selectedDateKey;
  streakDaysEl.textContent = userDocCache.stats.streakDays;
}

async function incrementStudySecond() {
  if (!userDocCache) return;
  userDocCache.studyByDate[selectedDateKey] = Number(userDocCache.studyByDate[selectedDateKey] || 0) + 1;
  userDocCache.stats.totalSeconds = Number(userDocCache.stats.totalSeconds || 0) + 1;

  await maybeUpdateStreak();
  updateSummaryUI();
  renderCalendar();
  renderChart();
}

// AUTH
showLoginBtn.addEventListener("click", () => {
  showLoginBtn.classList.add("active");
  showSignupBtn.classList.remove("active");
  loginForm.classList.remove("hidden");
  signupForm.classList.add("hidden");
  setAuthMessage("");
});

showSignupBtn.addEventListener("click", () => {
  showSignupBtn.classList.add("active");
  showLoginBtn.classList.remove("active");
  signupForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
  setAuthMessage("");
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;

  if (!name || !email || !password) {
    setAuthMessage("All signup fields are required.");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });

    const ref = doc(db, "studyTrackerUsers", cred.user.uid);
    const newDoc = ensureUserShape({
      profile: { name, email },
      stats: { totalSeconds: 0, streakDays: 0, lastStreakDate: "" },
      studyByDate: {},
      tasksByDate: {},
    });

    await setDoc(ref, {
      ...newDoc,
      updatedAt: serverTimestamp(),
    });

    setAuthMessage("Account created successfully.", true);
  } catch (err) {
    setAuthMessage(err.message || "Signup failed.");
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    setAuthMessage("Login success.", true);
  } catch (err) {
    setAuthMessage(err.message || "Login failed.");
  }
});

logoutBtn.addEventListener("click", async () => {
  stopGlobalStopwatch(false);
  stopAllTaskTimers();
  pausePomodoro(false);
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    authScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
    userDocCache = null;
    return;
  }

  const ref = doc(db, "studyTrackerUsers", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    userDocCache = ensureUserShape(snap.data());
  } else {
    userDocCache = ensureUserShape({
      profile: {
        name: user.displayName || "User",
        email: user.email || "",
      },
    });

    await setDoc(ref, {
      ...userDocCache,
      updatedAt: serverTimestamp(),
    });
  }

  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  userNameText.textContent = userDocCache.profile.name || user.displayName || "User";

  selectedDateKey = todayKey;
  selectedMonthKey = todayKey.slice(0, 7);
  ensureSelectedMonthAndDateInputs();
  updateStopwatchUI();
  updatePomodoroUI();
  await refreshAppUI();
});

// STOPWATCH
async function startGlobalStopwatch() {
  if (isGlobalRunning) return;
  isGlobalRunning = true;
  updateStopwatchUI();

  globalStopwatchInterval = setInterval(async () => {
    globalStopwatchSeconds += 1;
    updateStopwatchUI();
    await incrementStudySecond();

    if (globalStopwatchSeconds % 15 === 0) {
      await saveUserDoc();
    }
  }, 1000);
}

function stopGlobalStopwatch(keepDisplay = true) {
  isGlobalRunning = false;
  clearInterval(globalStopwatchInterval);
  globalStopwatchInterval = null;
  if (!keepDisplay) {
    globalStopwatchSeconds = 0;
  }
  updateStopwatchUI();
}

startStopwatchBtn.addEventListener("click", startGlobalStopwatch);

pauseStopwatchBtn.addEventListener("click", async () => {
  stopGlobalStopwatch(true);
  await saveUserDoc();
});

resetStopwatchBtn.addEventListener("click", async () => {
  stopGlobalStopwatch(false);
  await saveUserDoc();
});

// POMODORO
function resetPomodoroFromInputs() {
  pomodoroMode = "focus";
  pomodoroRemaining = Number(focusMinutesInput.value || 25) * 60;
  updatePomodoroUI();
}

function startPomodoro() {
  if (pomodoroRunning) return;
  pomodoroRunning = true;
  updatePomodoroUI();

  pomodoroInterval = setInterval(() => {
    pomodoroRemaining -= 1;

    if (pomodoroRemaining <= 0) {
      clearInterval(pomodoroInterval);
      pomodoroInterval = null;
      pomodoroRunning = false;

      if (pomodoroMode === "focus") {
        notifyUser("Focus session complete", "Break time started.");
        pomodoroMode = "break";
        pomodoroRemaining = Number(breakMinutesInput.value || 5) * 60;
      } else {
        notifyUser("Break complete", "Focus session is ready again.");
        pomodoroMode = "focus";
        pomodoroRemaining = Number(focusMinutesInput.value || 25) * 60;
      }

      updatePomodoroUI();
      return;
    }

    updatePomodoroUI();
  }, 1000);
}

function pausePomodoro(update = true) {
  pomodoroRunning = false;
  clearInterval(pomodoroInterval);
  pomodoroInterval = null;
  if (update) updatePomodoroUI();
}

startPomodoroBtn.addEventListener("click", startPomodoro);
pausePomodoroBtn.addEventListener("click", () => pausePomodoro(true));
resetPomodoroBtn.addEventListener("click", () => {
  pausePomodoro(false);
  resetPomodoroFromInputs();
});

focusMinutesInput.addEventListener("change", resetPomodoroFromInputs);
breakMinutesInput.addEventListener("change", resetPomodoroFromInputs);

// NOTIFICATIONS
enableNotificationBtn.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("This browser does not support notifications.");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    notifyUser("Notifications enabled", "Study Tracker notifications are now on.");
  }
});

// TASKS
addTaskBtn.addEventListener("click", async () => {
  const name = taskNameInput.value.trim();
  const targetMinutes = Number(taskTargetMinutesInput.value || 0);

  if (!name || targetMinutes <= 0) {
    alert("Task name and target minutes required.");
    return;
  }

  if (!userDocCache.tasksByDate[selectedDateKey]) {
    userDocCache.tasksByDate[selectedDateKey] = [];
  }

  userDocCache.tasksByDate[selectedDateKey].push({
    id: crypto.randomUUID(),
    name,
    targetMinutes,
    trackedSeconds: 0,
    localRunningSeconds: 0,
    done: false,
  });

  taskNameInput.value = "";
  taskTargetMinutesInput.value = "";
  renderTasks();
  await saveUserDoc();
});

tasksContainer.addEventListener("click", async (e) => {
  const button = e.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;
  const tasks = getSelectedTasks();
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  if (action === "start") {
    startTaskTimer(task.id);
  }

  if (action === "stop") {
    await stopTaskTimer(task.id);
  }

  if (action === "done") {
    task.done = !task.done;
    renderTasks();
    await saveUserDoc();
  }

  if (action === "delete") {
    await stopTaskTimer(task.id);
    userDocCache.tasksByDate[selectedDateKey] = tasks.filter((t) => t.id !== id);
    renderTasks();
    await saveUserDoc();
  }
});

function startTaskTimer(taskId) {
  if (activeTaskIntervals.has(taskId)) return;

  const interval = setInterval(() => {
    const tasks = getSelectedTasks();
    const task = tasks.find((t) => t.id === taskId);

    if (!task) {
      clearInterval(interval);
      activeTaskIntervals.delete(taskId);
      return;
    }

    task.trackedSeconds += 1;
    task.localRunningSeconds = task.trackedSeconds;
    renderTasks();
  }, 1000);

  activeTaskIntervals.set(taskId, interval);
}

async function stopTaskTimer(taskId) {
  const interval = activeTaskIntervals.get(taskId);
  if (interval) {
    clearInterval(interval);
    activeTaskIntervals.delete(taskId);
    renderTasks();
    await saveUserDoc();
  }
}

function stopAllTaskTimers() {
  for (const interval of activeTaskIntervals.values()) {
    clearInterval(interval);
  }
  activeTaskIntervals.clear();
}

// MONTH / DATE
monthPicker.addEventListener("change", () => {
  selectedMonthKey = monthPicker.value;
  if (!selectedDateKey.startsWith(selectedMonthKey)) {
    selectedDateKey = `${selectedMonthKey}-01`;
    datePicker.value = selectedDateKey;
  }
  updateSummaryUI();
  renderCalendar();
  renderTasks();
  renderChart();
});

datePicker.addEventListener("change", () => {
  selectedDateKey = datePicker.value;
  selectedMonthKey = selectedDateKey.slice(0, 7);
  monthPicker.value = selectedMonthKey;
  updateSummaryUI();
  renderCalendar();
  renderTasks();
  renderChart();
});

graphMode.addEventListener("change", renderChart);

// START
window.addEventListener("load", () => {
  setTimeout(() => splash.classList.add("hide"), 1800);
  updateLiveClock();
  setInterval(updateLiveClock, 1000);
  resetPomodoroFromInputs();
  ensureSelectedMonthAndDateInputs();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(console.error);
  }
});

window.addEventListener("beforeunload", async () => {
  try {
    await saveUserDoc();
  } catch (e) {
    console.error(e);
  }
});



