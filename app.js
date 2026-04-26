const clockEl = document.getElementById('clock');
const alarmTimeEl = document.getElementById('alarmTime');
const setBtn = document.getElementById('setBtn');
const alarmListEl = document.getElementById('alarmList');
const ringingEl = document.getElementById('ringing');
const stopBtn = document.getElementById('stopBtn');

let alarms = [];
let audioCtx = null;
let ringingNodes = [];

function pad(n) {
  return String(n).padStart(2, '0');
}

function nowHHMM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function updateClock() {
  const d = new Date();
  clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function startAlarmSound() {
  const ctx = getAudioContext();
  const freqs = [880, 1100, 880, 1100];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.2);
    osc.start(ctx.currentTime + i * 0.25);
    osc.stop(ctx.currentTime + i * 0.25 + 0.25);
    ringingNodes.push(osc);
  });

  // repeat every 1.5s while ringing
  ringingNodes._interval = setInterval(() => {
    freqs.forEach((freq, i) => {
      const ctx2 = getAudioContext();
      const osc = ctx2.createOscillator();
      const gain = ctx2.createGain();
      osc.connect(gain);
      gain.connect(ctx2.destination);
      osc.frequency.value = freq;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.15, ctx2.currentTime + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + i * 0.25 + 0.2);
      osc.start(ctx2.currentTime + i * 0.25);
      osc.stop(ctx2.currentTime + i * 0.25 + 0.25);
    });
  }, 1500);
}

function stopAlarmSound() {
  if (ringingNodes._interval) {
    clearInterval(ringingNodes._interval);
    ringingNodes._interval = null;
  }
  ringingNodes = [];
}

function renderAlarms() {
  alarmListEl.innerHTML = '';
  alarms.forEach((alarm, idx) => {
    const item = document.createElement('div');
    item.className = `alarm-item ${alarm.triggered ? 'triggered' : 'active'}`;
    item.innerHTML = `
      <span>${alarm.time}</span>
      <button data-idx="${idx}">削除</button>
    `;
    alarmListEl.appendChild(item);
  });

  alarmListEl.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      alarms.splice(Number(btn.dataset.idx), 1);
      renderAlarms();
    });
  });
}

function checkAlarms() {
  const now = nowHHMM();
  alarms.forEach(alarm => {
    if (!alarm.triggered && alarm.time === now) {
      alarm.triggered = true;
      triggerAlarm();
      renderAlarms();
    }
  });
}

function triggerAlarm() {
  ringingEl.classList.remove('hidden');
  startAlarmSound();
}

setBtn.addEventListener('click', () => {
  const time = alarmTimeEl.value;
  if (!time) return;
  if (alarms.find(a => a.time === time && !a.triggered)) {
    alert('同じ時刻のアラームがすでにセットされています。');
    return;
  }
  alarms.push({ time, triggered: false });
  alarms.sort((a, b) => a.time.localeCompare(b.time));
  renderAlarms();
  alarmTimeEl.value = '';
});

stopBtn.addEventListener('click', () => {
  ringingEl.classList.add('hidden');
  stopAlarmSound();
});

setInterval(updateClock, 1000);
setInterval(checkAlarms, 5000);
updateClock();
