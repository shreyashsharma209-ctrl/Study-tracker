/* Study Tracker: tasks, stats, theme and Pomodoro timer. Data lives in localStorage. */
'use strict';

const $ = (s) => document.querySelector(s);
const KEY = 'studyTracker.v1';

/* ---------- Storage ---------- */
const defaults = () => ({ tasks: [], minutes: 0, sessions: 0, theme: null });
function load() {
  try { return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY)) }; }
  catch { return defaults(); }              // corrupted or blocked storage: start fresh
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
}
const state = load();

/* ---------- Theme (dark/light via CSS variables on <html data-theme>) ---------- */
function applyTheme() {
  const dark = state.theme ? state.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#themeBtn').textContent = dark ? 'Light mode' : 'Dark mode';
}
$('#themeBtn').addEventListener('click', () => {
  state.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  save(); applyTheme();
});

/* ---------- Helpers ---------- */
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parseDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDue = (iso) => iso ? parseDate(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : 'No due date';
function isLate(t) {
  if (t.done || !t.due) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return parseDate(t.due) < today;
}

/* ---------- Dashboard stats ---------- */
function renderStats() {
  $('#statTotal').textContent = state.tasks.length;
  $('#statDone').textContent = state.tasks.filter((t) => t.done).length;
  $('#statHours').textContent = (state.minutes / 60).toFixed(1);
  $('#statSessions').textContent = state.sessions;
}

/* ---------- Tasks ---------- */
let statusFilter = 'all', courseFilter = 'all';

function renderCourses() {
  const courses = [...new Set(state.tasks.map((t) => t.course))].sort();
  if (courseFilter !== 'all' && !courses.includes(courseFilter)) courseFilter = 'all';
  $('#courseFilter').innerHTML = '<option value="all">All courses</option>' +
    courses.map((c) => `<option value="${esc(c)}"${c === courseFilter ? ' selected' : ''}>${esc(c)}</option>`).join('');
  $('#courseList').innerHTML = courses.map((c) => `<option value="${esc(c)}">`).join('');  // autocomplete in the form
}

function renderTasks() {
  const items = state.tasks
    .filter((t) => statusFilter === 'all' || (statusFilter === 'done' ? t.done : !t.done))
    .filter((t) => courseFilter === 'all' || t.course === courseFilter)
    .sort((a, b) => a.done - b.done || (a.due || '9999').localeCompare(b.due || '9999'));  // pending first, soonest due first

  $('#taskList').innerHTML = items.length ? items.map((t) => `
    <li class="task prio-${t.prio}${t.done ? ' done' : ''}" data-id="${t.id}">
      <button class="check" type="button" aria-label="Mark complete" aria-pressed="${t.done}">
        <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1"/></svg>
      </button>
      <div class="body">
        <div class="title">${esc(t.title)}</div>
        <div class="chips">
          <span class="chip">${esc(t.course)}</span>
          <span class="chip${isLate(t) ? ' late' : ''}">${isLate(t) ? 'Overdue: ' : ''}${fmtDue(t.due)}</span>
          <span class="chip">${t.prio[0].toUpperCase() + t.prio.slice(1)} priority</span>
        </div>
      </div>
      <button class="del" type="button" aria-label="Delete task">&times;</button>
    </li>`).join('')
    : `<li class="empty">${state.tasks.length ? 'No tasks match these filters.' : 'No tasks yet. Add your first assignment above.'}</li>`;
}

function refresh() { renderStats(); renderCourses(); renderTasks(); }

$('#taskForm').addEventListener('submit', (e) => {
  e.preventDefault();
  state.tasks.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: $('#fTitle').value.trim(),
    course: $('#fCourse').value.trim(),
    due: $('#fDue').value,
    prio: $('#fPrio').value,
    done: false,
  });
  save(); e.target.reset(); $('#fPrio').value = 'medium'; refresh(); $('#fTitle').focus();
});

// One listener handles every checkmark and delete button (event delegation)
$('#taskList').addEventListener('click', (e) => {
  const li = e.target.closest('.task'); if (!li) return;
  const task = state.tasks.find((t) => t.id === li.dataset.id);
  if (e.target.closest('.check')) {
    task.done = !task.done; save();
    li.classList.toggle('done', task.done);        // plays the check and strike-through animation
    renderStats();
    setTimeout(renderTasks, 450);                  // then re-sort after the animation finishes
  } else if (e.target.closest('.del')) {
    state.tasks = state.tasks.filter((t) => t.id !== task.id); save(); refresh();
  }
});

document.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
  statusFilter = b.dataset.status;
  document.querySelectorAll('[data-status]').forEach((x) => x.classList.toggle('on', x === b));
  renderTasks();
}));
$('#courseFilter').addEventListener('change', (e) => { courseFilter = e.target.value; renderTasks(); });

/* ---------- Pomodoro timer ---------- */
const MODES = { work: { label: 'Focus', secs: 25 * 60 }, break: { label: 'Break', secs: 5 * 60 } };
const CIRC = 2 * Math.PI * 88;                    // ring circumference (matches r=88 in the SVG)
let mode = 'work', remaining = MODES.work.secs, endAt = 0, ticker = null;

function renderTimer() {
  const m = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  $('#clock').textContent = `${m}:${s}`;
  $('#modeLabel').textContent = MODES[mode].label;
  $('#ring').style.strokeDashoffset = CIRC * (1 - remaining / MODES[mode].secs);
  $('.timer').classList.toggle('is-break', mode === 'break');
  $('#startBtn').disabled = !!ticker;
  $('#pauseBtn').disabled = !ticker;
  document.title = ticker ? `${m}:${s} ${MODES[mode].label} | Study Tracker` : 'Study Tracker';
}

function tick() {
  // Based on a fixed end time, so the clock stays accurate even if the tab is throttled
  remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  if (remaining === 0) return finish();
  renderTimer();
}
function start() { if (ticker) return; endAt = Date.now() + remaining * 1000; ticker = setInterval(tick, 250); renderTimer(); }
function pause() { clearInterval(ticker); ticker = null; renderTimer(); }
function reset() { pause(); remaining = MODES[mode].secs; renderTimer(); }
function setMode(m) {
  mode = m; pause(); remaining = MODES[m].secs;
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  renderTimer();
}
function finish() {
  if (mode === 'work') { state.minutes += MODES.work.secs / 60; state.sessions++; save(); renderStats(); }
  beep();
  setMode(mode === 'work' ? 'break' : 'work');    // switch automatically; press Start for the next round
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.value = 660; gain.gain.value = 0.1;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
  } catch { /* audio not available */ }
}

$('#startBtn').addEventListener('click', start);
$('#pauseBtn').addEventListener('click', pause);
$('#resetBtn').addEventListener('click', reset);
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

/* ---------- Init ---------- */
applyTheme(); refresh(); renderTimer();
