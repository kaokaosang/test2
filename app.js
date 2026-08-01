let currentDate = new Date().toISOString().split('T')[0];
let currentTab = 'diary';

window.onload = async () => {
  updateDateDisplay();
  await loadDayData();
};

/* ---------- 日期导航 ---------- */
function updateDateDisplay() {
  document.getElementById('dateDisplay').textContent = currentDate;
}

function changeDate(delta) {
  const d = new Date(currentDate);
  d.setDate(d.getDate() + delta);
  currentDate = d.toISOString().split('T')[0];
  updateDateDisplay();
  loadDayData();
}

function goToToday() {
  currentDate = new Date().toISOString().split('T')[0];
  updateDateDisplay();
  loadDayData();
}

/* ---------- 标签切换 ---------- */
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const tabs = ['diary','finance','weight','history'];
  document.querySelector(`.tab:nth-child(${tabs.indexOf(tab)+1})`).classList.add('active');
  document.getElementById(tab+'Panel').classList.add('active');
  if (tab === 'history') renderHistory();
  else if (tab === 'weight') { loadDayData(); drawWeightChart(); }
  else if (tab === 'finance') { loadDayData(); updateTotalSavings(); }
  else loadDayData();
}

/* ---------- 数据读写 ---------- */
async function getDayData(date) {
  return await dbGet(date);
}

async function saveDayData(date, data) {
  await dbPut(date, data);
}

async function loadDayData() {
  const data = await getDayData(currentDate) || {};

  // 日记
  if (currentTab === 'diary') {
    document.getElementById('editor').innerHTML = data.diary || '';
  }

  // 记账
  if (currentTab === 'finance') {
    const fin = data.finance || {};
    document.getElementById('savedMoney').value = fin.saved ?? '';
    document.getElementById('savedMoney2').value = fin.economized ?? '';
    document.getElementById('breakfastCost').value = fin.breakfast ?? '';
    document.getElementById('lunchCost').value = fin.lunch ?? '';
    document.getElementById('dinnerCost').value = fin.dinner ?? '';
    // 原始积累
    document.getElementById('initialSavings').value = getInitialSavings();
    updateTotalSavings();
  }

  // 体重
  if (currentTab === 'weight') {
    document.getElementById('weightInput').value = data.weight ?? '';
    document.getElementById('targetWeight').value = getTargetWeight();
    drawWeightChart();
  }
}

/* ---------- 富文本编辑 ---------- */
function formatDoc(command) {
  document.execCommand(command, false, null);
  document.getElementById('editor').focus();
}

function setTextColor() {
  const color = document.getElementById('textColor').value;
  document.execCommand('foreColor', false, color);
  document.getElementById('editor').focus();
}

function setBgColor() {
  const color = document.getElementById('bgColor').value;
  document.execCommand('backColor', false, color);
  document.getElementById('editor').focus();
}

function insertPhoto() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';   // 不加capture，默认从相册/文件选择
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const img = new Image();
      img.src = ev.target.result;
      img.onload = async () => {
        // 压缩
        const canvas = document.createElement('canvas');
        const maxW = 600;
        const scale = maxW / img.width;
        canvas.width = maxW;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        // 插入到编辑器
        const editor = document.getElementById('editor');
        editor.focus();
        const sel = window.getSelection();
        if (sel.rangeCount) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const imgEl = document.createElement('img');
          imgEl.src = compressed;
          imgEl.style.maxWidth = '100%';
          range.insertNode(imgEl);
          range.collapse(false);
        } else {
          // 直接追加
          editor.innerHTML += `<img src="${compressed}" style="max-width:100%">`;
        }
      };
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

/* ---------- 保存日记 ---------- */
async function saveDiary() {
  const html = document.getElementById('editor').innerHTML;
  let data = await getDayData(currentDate) || {};
  data.diary = html;
  await saveDayData(currentDate, data);
  alert('日记已保存');
}

/* ---------- 记账与总存款 ---------- */
function getInitialSavings() {
  return parseFloat(localStorage.getItem('initialSavings') || '0');
}

function setInitialSavings(value) {
  localStorage.setItem('initialSavings', value);
}

function saveInitialSavings() {
  const val = document.getElementById('initialSavings').value;
  setInitialSavings(val || '0');
  updateTotalSavings();
}

async function updateTotalSavings() {
  const all = await dbGetAll();
  let sumSaved = 0;
  all.forEach(rec => {
    if (rec.finance && rec.finance.saved) sumSaved += rec.finance.saved;
  });
  const total = getInitialSavings() + sumSaved;
  document.getElementById('totalSavings').textContent = total.toFixed(2);
}

async function saveFinance() {
  const saved = document.getElementById('savedMoney').value;
  const economized = document.getElementById('savedMoney2').value;
  const breakfast = document.getElementById('breakfastCost').value;
  const lunch = document.getElementById('lunchCost').value;
  const dinner = document.getElementById('dinnerCost').value;

  let data = await getDayData(currentDate) || {};
  data.finance = {
    saved: saved ? parseFloat(saved) : undefined,
    economized: economized ? parseFloat(economized) : undefined,
    breakfast: breakfast ? parseFloat(breakfast) : undefined,
    lunch: lunch ? parseFloat(lunch) : undefined,
    dinner: dinner ? parseFloat(dinner) : undefined
  };
  Object.keys(data.finance).forEach(k => {
    if (data.finance[k] === undefined) delete data.finance[k];
  });
  await saveDayData(currentDate, data);
  updateTotalSavings();
  alert('账目已保存');
}

/* ---------- 体重与曲线 ---------- */
function getTargetWeight() {
  return parseFloat(localStorage.getItem('targetWeight') || '0');
}

function setTargetWeight(value) {
  localStorage.setItem('targetWeight', value);
}

function saveTargetWeight() {
  const val = document.getElementById('targetWeight').value;
  setTargetWeight(val || '0');
  drawWeightChart();
}

async function saveWeight() {
  const w = document.getElementById('weightInput').value;
  let data = await getDayData(currentDate) || {};
  data.weight = w ? parseFloat(w) : undefined;
  await saveDayData(currentDate, data);
  drawWeightChart();
  alert('体重已记录');
}

async function drawWeightChart() {
  const canvas = document.getElementById('weightChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const all = await dbGetAll();
  const weights = [];
  all.forEach(rec => {
    if (rec.weight) {
      weights.push({ date: rec.date, weight: rec.weight });
    }
  });
  weights.sort((a,b) => a.date.localeCompare(b.date));
  // 只取最近30条
  const recent = weights.slice(-30);
  if (recent.length === 0) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.font = '14px sans-serif';
    ctx.fillText('暂无体重数据', 10, 50);
    return;
  }
  const target = getTargetWeight();
  const padding = 30;
  const w = canvas.width, h = canvas.height;
  const plotW = w - padding*2, plotH = h - padding*2;
  const minW = Math.min(...recent.map(d=>d.weight), target || Infinity) - 2;
  const maxW = Math.max(...recent.map(d=>d.weight), target || 0) + 2;
  const range = maxW - minW || 1;

  // 清空
  ctx.clearRect(0,0,w,h);
  // 画坐标轴
  ctx.beginPath();
  ctx.strokeStyle = '#ccc';
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, h-padding);
  ctx.lineTo(w-padding, h-padding);
  ctx.stroke();

  // 画点线
  ctx.beginPath();
  ctx.strokeStyle = '#4A90D9';
  ctx.lineWidth = 2;
  const stepX = plotW / (recent.length-1 || 1);
  recent.forEach((pt, i) => {
    const x = padding + i * stepX;
    const y = h - padding - ((pt.weight - minW) / range) * plotH;
    if (i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // 画点
  ctx.fillStyle = '#4A90D9';
  recent.forEach((pt, i) => {
    const x = padding + i * stepX;
    const y = h - padding - ((pt.weight - minW) / range) * plotH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 2*Math.PI);
    ctx.fill();
  });

  // 目标线
  if (target > 0) {
    const yTarget = h - padding - ((target - minW) / range) * plotH;
    ctx.beginPath();
    ctx.strokeStyle = '#E94F4F';
    ctx.setLineDash([5,3]);
    ctx.moveTo(padding, yTarget);
    ctx.lineTo(w-padding, yTarget);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#E94F4F';
    ctx.font = '10px sans-serif';
    ctx.fillText('目标 '+target, w-padding-50, yTarget-5);
  }

  // 简单日期标签
  ctx.fillStyle = '#333';
  ctx.font = '9px sans-serif';
  const labelCount = Math.min(recent.length, 5);
  for (let i=0; i<labelCount; i++) {
    const idx = Math.floor(i * (recent.length-1) / (labelCount-1 || 1));
    const x = padding + idx * stepX;
    ctx.fillText(recent[idx].date.slice(5), x-15, h-padding+15);
  }
}

/* ---------- 历史面板 ---------- */
async function renderHistory() {
  const all = await dbGetAll();
  const container = document.getElementById('historyContent');
  if (!all.length) {
    container.innerHTML = '<p>暂无记录。</p>';
    return;
  }
  all.sort((a, b) => b.date.localeCompare(a.date));
  let html = '';
  for (let item of all) {
    html += `<div class="history-date">📅 ${item.date}</div>`;
    // 日记摘要（纯文本，最多80字）
    if (item.diary) {
      const temp = document.createElement('div');
      temp.innerHTML = item.diary;
      const text = temp.textContent || temp.innerText || '';
      const summary = text.length > 80 ? text.substring(0,80)+'…' : text;
      // 统计图片数量
      const imgCount = (item.diary.match(/<img /g) || []).length;
      html += `<div class="history-item">📝 ${summary}`;
      if (imgCount > 0) html += ` <span style="color:#888;">[${imgCount}张图]</span>`;
      html += `</div>`;
    }
    if (item.finance && Object.keys(item.finance).length) {
      const f = item.finance;
      html += `<div class="history-item">💰 存${f.saved||0} 省${f.economized||0} | 餐: ${f.breakfast||0}/${f.lunch||0}/${f.dinner||0}</div>`;
    }
    if (item.weight) {
      html += `<div class="history-item">⚖️ ${item.weight} kg</div>`;
    }
    html += '<hr style="margin:4px 0">';
  }
  container.innerHTML = html;
}
