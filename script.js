/********document.addEventListener("DOMContentLoaded", () => {
  const todayTextEl = document.getElementById("todayText");
  if (todayTextEl) todayTextEl.textContent = prettyDate(TODAY_YMD);

  buildMonthBar();
  normalizeSelectionIntoRange();
  ensureDayRecord(getSelectedYMD());
  renderAll();
});***************
 * CONFIG / STATE
 ***********************/
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// Fixed app range: current month ... Dec 2026
const NOW = new Date();
const NOW_YEAR = NOW.getFullYear();
const NOW_MONTH = NOW.getMonth();
const TODAY_YMD = formatYMD(NOW_YEAR, NOW_MONTH, NOW.getDate());

// Data structure in localStorage:
// {
//   days: {
//     "YYYY-MM-DD": {
//       globalSeconds: number,
//       tasks: [{id,title,targetMin,remainingSec,initialSec,isRunning,done,completedAt}]
//     }
//   }
// }
let appData = loadAppData();

// UI selection (default = today if <=2026 else Jan 2026)
let selectedYear = (NOW_YEAR <= 2026 ? NOW_YEAR : 2026);
let selectedMonth = (NOW_YEAR <= 2026 ? NOW_MONTH : 0);
let selectedDate = (NOW_YEAR <= 2026 ? NOW.getDate() : 1);

// Global stopwatch runtime state
let globalInterval = null;
let isGlobalRunning = false;

// Task intervals map (by task id) for selected date only
const taskIntervals = {};

// Runtime date tracking for streak reset rule
let activeGlobalDayKey = null;

/***********************
 * INIT
 ***********************/
document.addEventListener("DOMContentLoaded", () => {
  const todayTextEl = document.getElementById("todayText");
  if (todayTextEl) todayTextEl.textContent = prettyDate(TODAY_YMD);

  buildMonthBar();
  normalizeSelectionIntoRange();
  ensureDayRecord(getSelectedYMD());
  renderAll();
});

/***********************
 * HELPERS
 ***********************/
function loadAppData(){
  try{
    const raw = localStorage.getItem("pranjalStudyTracker2026");
    if(!raw) return { days:{} };
    const parsed = JSON.parse(raw);
    if(!parsed || typeof parsed !== "object") return { days:{} };
    if(!parsed.days) parsed.days = {};
    return parsed;
  }catch(e){
    return { days:{} };
  }
}

function saveAppData(){
  localStorage.setItem("pranjalStudyTracker2026", JSON.stringify(appData));
}

function formatYMD(y,m,d){
  const mm = String(m+1).padStart(2,"0");
  const dd = String(d).padStart(2,"0");
  return y + "-" + mm + "-" + dd;
}

function parseYMD(ymd){
  const [y,m,d] = ymd.split("-").map(Number);
  return { y, m: m-1, d };
}

function prettyDate(ymd){
  const {y,m,d} = parseYMD(ymd);
  return d + " " + MONTHS[m] + " " + y;
}

function getDaysInMonth(y,m){
  return new Date(y, m+1, 0).getDate();
}

function ensureDayRecord(ymd){
  if(!appData.days[ymd]){
    appData.days[ymd] = {
      globalSeconds: 0,
      tasks: []
    };
  }
  if(!Array.isArray(appData.days[ymd].tasks)) appData.days[ymd].tasks = [];
  if(typeof appData.days[ymd].globalSeconds !== "number") appData.days[ymd].globalSeconds = 0;
  return appData.days[ymd];
}

function getSelectedYMD(){
  return formatYMD(selectedYear, selectedMonth, selectedDate);
}

function getSelectedDayRecord(){
  return ensureDayRecord(getSelectedYMD());
}

function secondsToHMS(sec){
  sec = Math.max(0, Math.floor(sec||0));
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  const s = sec%60;
  return {
    h,m,s,
    text: `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
  };
}

function secondsToShort(sec){
  sec = Math.max(0, Math.floor(sec||0));
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  const s = sec%60;
  if(h>0) return `${h}h ${m}m ${s}s`;
  if(m>0) return `${m}m ${s}s`;
  return `${s}s`;
}

function minutesToSeconds(min){
  return Math.max(0, Math.floor(Number(min)||0)) * 60;
}

function clampSelectedDate(){
  const dim = getDaysInMonth(selectedYear, selectedMonth);
  if(selectedDate > dim) selectedDate = dim;
  if(selectedDate < 1) selectedDate = 1;
}

function normalizeSelectionIntoRange(){
  // App supports current month .. Dec 2026
  if(selectedYear > 2026){ selectedYear = 2026; selectedMonth = 11; selectedDate = 31; }
  if(NOW_YEAR <= 2026){
    if(selectedYear < NOW_YEAR || (selectedYear===NOW_YEAR && selectedMonth < NOW_MONTH)){
      selectedYear = NOW_YEAR; selectedMonth = NOW_MONTH;
    }
  } else {
    if(selectedYear < 2026){ selectedYear = 2026; selectedMonth = 0; }
  }
  clampSelectedDate();
}

function getMonthRangeForBar(){
  const list = [];
  let y = (NOW_YEAR <= 2026 ? NOW_YEAR : 2026);
  let m = (NOW_YEAR <= 2026 ? NOW_MONTH : 0);

  while(y < 2026 || (y === 2026 && m <= 11)){
    list.push({ y, m });
    m++;
    if(m > 11){ m=0; y++; }
  }

  if(list.length===0){
    for(let i=0;i<12;i++) list.push({ y:2026, m:i });
  }
  return list;
}

function has4Hours(ymd){
  const rec = ensureDayRecord(ymd);
  return (rec.globalSeconds || 0) >= 4*3600;
}

function totalDoneTasks(ymd){
  const rec = ensureDayRecord(ymd);
  return rec.tasks.filter(t=>t.done).length;
}

function getConsecutiveStreakEndingAt(ymd){
  let count = 0;
  let d = new Date(ymd + "T00:00:00");
  while(true){
    const key = formatYMD(d.getFullYear(), d.getMonth(), d.getDate());
    if(has4Hours(key)){
      count++;
      d.setDate(d.getDate()-1);
    } else {
      break;
    }
  }
  return count;
}

function clearAllTaskIntervalsForView(){
  Object.keys(taskIntervals).forEach(id=>{
    clearInterval(taskIntervals[id]);
    delete taskIntervals[id];
  });
}

/***********************
 * MONTH BAR
 ***********************/
function buildMonthBar(){
  const bar = document.getElementById("monthBar");
  if (!bar) return;
  bar.innerHTML = "";
  const range = getMonthRangeForBar();

  range.forEach((item) => {
    const btn = document.createElement("button");
    btn.className = "month-btn";
    btn.textContent = `${MONTHS[item.m]} ${item.y}`;
    const active = (item.y===selectedYear && item.m===selectedMonth);
    btn.classList.add(active ? "active" : "inactive");

    btn.onclick = () => {
      clearAllTaskIntervalsForView();
      selectedYear = item.y;
      selectedMonth = item.m;
      clampSelectedDate();
      ensureDayRecord(getSelectedYMD());
      renderAll();
    };
    bar.appendChild(btn);
  });
}

/***********************
 * CALENDAR RENDER
 ***********************/
function renderCalendar(){
  const grid = document.getElementById("calendarGrid");
  if (!grid) return;
  grid.innerHTML = "";

  // Week headers
  WEEKDAYS.forEach(w=>{
    const h = document.createElement("div");
    h.className = "weekday";
    h.textContent = w;
    grid.appendChild(h);
  });

  const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
  const dim = getDaysInMonth(selectedYear, selectedMonth);

  for(let i=0; i<firstDay; i++){
    const e = document.createElement("div");
    e.className = "date-cell empty";
    grid.appendChild(e);
  }

  for(let d=1; d<=dim; d++){
    const ymd = formatYMD(selectedYear, selectedMonth, d);
    const rec = ensureDayRecord(ymd);

    const cell = document.createElement("div");
    cell.className = "date-cell";
    if(d === selectedDate) cell.classList.add("selected");

    const num = document.createElement("div");
    num.className = "date-num";
    num.textContent = d;

    const tags = document.createElement("div");
    tags.className = "date-tags";

    // Today dot
    if(ymd === TODAY_YMD){
      const dotToday = document.createElement("span");
      dotToday.className = "dot today";
      tags.appendChild(dotToday);

      const tb = document.createElement("div");
      tb.className = "today-badge";
      tb.textContent = "Today";
      cell.appendChild(tb);
    }

    // 4h done dot
    if((rec.globalSeconds||0) >= 4*3600){
      const dotDone = document.createElement("span");
      dotDone.className = "dot done";
      tags.appendChild(dotDone);
    }

    // streak day indicator
    if((rec.globalSeconds||0) >= 4*3600){
      const dotStreak = document.createElement("span");
      dotStreak.className = "dot streak";
      tags.appendChild(dotStreak);
    }

    const hrs = document.createElement("div");
    hrs.className = "date-hours";
    hrs.textContent = ((rec.globalSeconds||0)/3600).toFixed(2) + "h";

    cell.appendChild(num);
    cell.appendChild(tags);
    cell.appendChild(hrs);

    cell.onclick = () => {
      clearAllTaskIntervalsForView();
      selectedDate = d;
      ensureDayRecord(getSelectedYMD());
      renderAll();
    };

    grid.appendChild(cell);
  }
}

/***********************
 * TOP INFO RENDER
 ***********************/
function renderSelectedInfo(){
  const monthEl = document.getElementById("selectedMonthText");
  const dateEl = document.getElementById("selectedDateText");
  const hrsEl = document.getElementById("selectedDayHoursText");

  const ymd = getSelectedYMD();
  const rec = getSelectedDayRecord();

  if(monthEl) monthEl.textContent = `${MONTHS[selectedMonth]} ${selectedYear}`;
  if(dateEl) dateEl.textContent = prettyDate(ymd);
  if(hrsEl) hrsEl.textContent = ((rec.globalSeconds||0)/3600).toFixed(2) + "h";
}

/***********************
 * GLOBAL STOPWATCH
 ***********************/
function syncGlobalDisplayFromSelectedDay(){
  const rec = getSelectedDayRecord();
  const hms = secondsToHMS(rec.globalSeconds || 0);
  const timeEl = document.getElementById("timeDisplay");
  if (timeEl) timeEl.textContent = hms.text;
}

function renderGlobalState(){
  const el = document.getElementById("globalStateText");
  if(!el) return;
  el.innerHTML = `Global Stopwatch: ${
    isGlobalRunning ? '<span class="on">ON</span>' : '<span class="off">OFF</span>'
  }`;
}

function startGlobalStopwatch(){
  if(isGlobalRunning) return;

  isGlobalRunning = true;
  activeGlobalDayKey = getSelectedYMD();
  renderGlobalState();

  globalInterval = setInterval(() => {
    // If user changed date while stopwatch running → stop automatically
    const currentSelected = getSelectedYMD();
    if(currentSelected !== activeGlobalDayKey){
      stopGlobalStopwatch();
      return;
    }

    const rec = ensureDayRecord(activeGlobalDayKey);
    rec.globalSeconds = (rec.globalSeconds || 0) + 1;
    saveAppData();

    syncGlobalDisplayFromSelectedDay();
    renderStreakBox();
    updateSelectedDayHoursChip();

    // update visible calendar cell labels/dots lightly by rerendering calendar every minute-ish OR each second for simplicity
    renderCalendar();

    // Tick task timers only if global stopwatch ON
    tickRunningTaskTimers();
  }, 1000);
}

function stopGlobalStopwatch(){
  if(globalInterval){
    clearInterval(globalInterval);
    globalInterval = null;
  }

  isGlobalRunning = false;
  renderGlobalState();

  // stop all running task timers when global stopwatch stops
  stopAllTaskTimersRuntimeOnly();
  renderTaskList();
}

function resetGlobalStopwatch(){
  // reset selected day's global stopwatch time
  stopGlobalStopwatch();
  const rec = getSelectedDayRecord();
  rec.globalSeconds = 0;
  saveAppData();
  syncGlobalDisplayFromSelectedDay();
  renderStreakBox();
  updateSelectedDayHoursChip();
  renderCalendar();
}

function updateSelectedDayHoursChip(){
  const hrsEl = document.getElementById("selectedDayHoursText");
  const rec = getSelectedDayRecord();
  if(hrsEl) hrsEl.textContent = ((rec.globalSeconds||0)/3600).toFixed(2) + "h";
}

/***********************
 * STREAK
 ***********************/
function renderStreakBox(){
  const ymd = getSelectedYMD();
  const streakCount = getConsecutiveStreakEndingAt(ymd);

  const countEl = document.getElementById("streakCount");
  const subEl = document.getElementById("streakSubText");
  const heartEl = document.getElementById("heartIcon");
  const tickEl = document.getElementById("streakTick");

  if(countEl) countEl.textContent = streakCount;
  if(!subEl || !heartEl || !tickEl) return;

  const rec = getSelectedDayRecord();
  const done4h = (rec.globalSeconds||0) >= 4*3600;

  if(done4h){
    heartEl.classList.add("beat");
    tickEl.classList.add("show");
    subEl.textContent = `✅ 4 hours complete on ${prettyDate(ymd)}${streakCount>1 ? ` • Streak ${streakCount} days` : ""}`;
  } else {
    heartEl.classList.remove("beat");
    tickEl.classList.remove("show");
    const remain = Math.max(0, 4*3600 - (rec.globalSeconds||0));
    subEl.textContent = `Need ${secondsToShort(remain)} more to complete 4h on this day`;
  }
}

/***********************
 * TASKS (Timer only)
 ***********************/
function addTask(){
  const nameInput = document.getElementById("taskNameInput");
  const minInput = document.getElementById("taskTimerMinInput");
  if(!nameInput || !minInput) return;

  const title = (nameInput.value || "").trim();
  const targetMin = Math.floor(Number(minInput.value) || 0);

  if(!title){
    alert("Task name likho.");
    return;
  }
  if(targetMin <= 0){
    alert("Task timer minutes set karo (1 ya usse zyada).");
    return;
  }

  const rec = getSelectedDayRecord();
  const sec = targetMin * 60;

  rec.tasks.unshift({
    id: "t_" + Date.now() + "_" + Math.floor(Math.random()*1000),
    title,
    targetMin,
    remainingSec: sec,
    initialSec: sec,
    isRunning: false,
    done: false,
    completedAt: null
  });

  saveAppData();
  nameInput.value = "";
  minInput.value = "";
  renderTaskList();
  renderCalendar();
}

function stopAllTaskTimersRuntimeOnly(){
  const rec = getSelectedDayRecord();
  rec.tasks.forEach(t => t.isRunning = false);
  Object.keys(taskIntervals).forEach(id=>{
    clearInterval(taskIntervals[id]);
    delete taskIntervals[id];
  });
  saveAppData();
}

function startTaskTimer(taskId){
  if(!isGlobalRunning){
    alert("Task timer start karne ke liye pehle Global Stopwatch Start karo.");
    return;
  }

  const rec = getSelectedDayRecord();
  const task = rec.tasks.find(t => t.id === taskId);
  if(!task) return;
  if(task.done) return;
  if(task.remainingSec <= 0){
    alert("Task timer already complete.");
    return;
  }

  // Pause all other task timers (optional, cleaner UX)
  rec.tasks.forEach(t => {
    if(t.id !== taskId) t.isRunning = false;
  });
  task.isRunning = true;

  saveAppData();
  renderTaskList();
}

function stopTaskTimer(taskId){
  const rec = getSelectedDayRecord();
  const task = rec.tasks.find(t => t.id === taskId);
  if(!task) return;
  task.isRunning = false;
  saveAppData();
  renderTaskList();
}

function tickRunningTaskTimers(){
  const rec = getSelectedDayRecord();
  let changed = false;

  rec.tasks.forEach(task => {
    if(task.isRunning && !task.done && task.remainingSec > 0){
      task.remainingSec -= 1;
      changed = true;

      if(task.remainingSec <= 0){
        task.remainingSec = 0;
        task.isRunning = false;
        alert(`⏰ Task timer complete: "${task.title}" (Timer was ${task.targetMin} min)`);
      }
    }
  });

  if(changed){
    saveAppData();
    renderTaskList();
  }
}

function toggleTaskDone(taskId){
  const rec = getSelectedDayRecord();
  const task = rec.tasks.find(t => t.id === taskId);
  if(!task) return;

  task.done = !task.done;
  if(task.done){
    task.completedAt = Date.now();
    task.isRunning = false;
  }else{
    task.completedAt = null;
  }

  saveAppData();
  renderTaskList();
  renderCalendar();
}

function deleteTask(taskId){
  const rec = getSelectedDayRecord();
  rec.tasks = rec.tasks.filter(t => t.id !== taskId);
  saveAppData();
  renderTaskList();
  renderCalendar();
}

function renderTaskList(){
  const list = document.getElementById("taskList");
  if(!list) return;
  list.innerHTML = "";

  const rec = getSelectedDayRecord();

  if(rec.tasks.length === 0){
    const empty = document.createElement("li");
    empty.className = "task-item";
    empty.innerHTML = `
      <div class="task-left">
        <div class="task-title">No task for this date</div>
        <div class="task-meta"><span class="mini-chip">Add task + timer minutes</span></div>
      </div>
    `;
    list.appendChild(empty);
    return;
  }

  rec.tasks.forEach(task => {
    const li = document.createElement("li");
    li.className = "task-item" + (task.done ? " done" : "");

    const left = document.createElement("div");
    left.className = "task-left";

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;

    const meta = document.createElement("div");
    meta.className = "task-meta";

    const target = document.createElement("span");
    target.className = "mini-chip";
    target.textContent = `Target: ${task.targetMin} min`;

    const remain = document.createElement("span");
    remain.className = "mini-chip";
    remain.textContent = `Left: ${secondsToShort(task.remainingSec)}`;

    const status = document.createElement("span");
    status.className = "mini-chip";
    if(task.done){
      status.textContent = "Done ✔";
    }else if(task.isRunning && isGlobalRunning){
      status.textContent = "Running ⏳";
    }else{
      status.textContent = "Paused";
    }

    meta.appendChild(target);
    meta.appendChild(remain);
    meta.appendChild(status);

    left.appendChild(title);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className = "task-right";

    const bStart = document.createElement("button");
    bStart.className = "tbtn tstart";
    bStart.textContent = "▶";
    bStart.title = "Start Task Timer";
    bStart.onclick = () => startTaskTimer(task.id);

    const bStop = document.createElement("button");
    bStop.className = "tbtn tstop";
    bStop.textContent = "■";
    bStop.title = "Stop Task Timer";
    bStop.onclick = () => stopTaskTimer(task.id);

    const bDone = document.createElement("button");
    bDone.className = "tbtn tdone" + (task.done ? " done-state" : "");
    bDone.textContent = task.done ? "↺" : "✔";
    bDone.title = task.done ? "Undo Complete" : "Mark Complete";
    bDone.onclick = () => toggleTaskDone(task.id);

    const bDelete = document.createElement("button");
    bDelete.className = "tbtn tdelete";
    bDelete.textContent = "✕";
    bDelete.title = "Delete Task";
    bDelete.onclick = () => deleteTask(task.id);

    right.appendChild(bStart);
    right.appendChild(bStop);
    right.appendChild(bDone);
    right.appendChild(bDelete);

    li.appendChild(left);
    li.appendChild(right);
    list.appendChild(li);
  });
}

/***********************
 * MAIN RENDER
 ***********************/
function renderAll(){
  clampSelectedDate();
  ensureDayRecord(getSelectedYMD());

  // If switching day/month while stopwatch ON -> auto stop for safety
  if(isGlobalRunning && activeGlobalDayKey !== getSelectedYMD()){
    stopGlobalStopwatch();
  }

  buildMonthBar();
  renderSelectedInfo();
  renderCalendar();
  syncGlobalDisplayFromSelectedDay();
  renderGlobalState();
  renderStreakBox();
  renderTaskList();
}if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js");
}if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}