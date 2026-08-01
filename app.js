let currentDate = new Date().toISOString().split('T')[0];
let currentTab = 'diary';

window.onload = async () => {
  updateDateDisplay();
  await loadDayData();
};

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

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.tab:nth-child(${['diary','photos','finance','weight','history'].indexOf(tab)+1})`).classList.add('active');
  const panelMap = {
    diary: 'diaryPanel', photos: 'photosPanel', finance: 'financePanel',
    weight: 'weightPanel', history: 'historyPanel'
  };
  document.getElementById(panelMap[tab]).classList.add('active');
  if (tab === 'history') renderHistory();
  else loadDayData();
}

async function getDayData(date) {
  return await dbGet(date);
}

async function saveDayData(date, data) {
  await dbPut(date, data);
}

async function loadDayData() {
  const data = await getDayData(currentDate) || {};
  document.getElementById('diaryText').value = data.diary || '';
  const diaryPrev = document.getElementById('diaryPreview');
  if (data.diary) {
    diaryPrev.style.display = 'block';
    diaryPrev.innerHTML = `<strong>今日笔记：</strong><br>${data.diary.replace(/\n/g, '<br>')}`;
  } else {
    diaryPrev.style.display = 'none';
  }

  const photoContainer = document.getElementById('photoContainer');
  photoContainer.innerHTML = '';
  if (data.photos && data.photos.length) {
    data.photos.forEach((b64, idx) => {
      const img = document.createElement('img');
      img.src = b64;
      img.onclick = () => {
        if (confirm('删除这张照片？')) {
          data.photos.splice(idx, 1);
          saveDayData(currentDate, data);
          loadDayData();
        }
      };
      photoContainer.appendChild(img);
    });
  }

  const fin = data.finance || {};
  document.getElementById('savedMoney').value = fin.saved ?? '';
  document.getElementById('savedMoney2').value = fin.economized ?? '';
  document.getElementById('breakfastCost').value = fin.breakfast ?? '';
  document.getElementById('lunchCost').value = fin.lunch ?? '';
  document.getElementById('dinnerCost').value = fin.dinner ?? '';
  const finPrev = document.getElementById('financePreview');
  if (Object.keys(fin).length) {
    finPrev.style.display = 'block';
    finPrev.innerHTML = `
      💰 存钱：${fin.saved || 0} 元 &nbsp;|&nbsp; 🏷️ 省钱：${fin.economized || 0} 元 <br>
      🥣 早餐：${fin.breakfast || 0} 元 &nbsp; 午餐：${fin.lunch || 0} 元 &nbsp; 晚餐：${fin.dinner || 0} 元
    `;
  } else {
    finPrev.style.display = 'none';
  }

  document.getElementById('weightInput').value = data.weight ?? '';
  const weightPrev = document.getElementById('weightPreview');
  if (data.weight) {
    weightPrev.style.display = 'block';
    weightPrev.innerHTML = `⚖️ 今日体重：${data.weight} kg`;
  } else {
    weightPrev.style.display = 'none';
  }
}

async function saveDiary() {
  const text = document.getElementById('diaryText').value.trim();
  let data = await getDayData(currentDate) || {};
  data.diary = text;
  await saveDayData(currentDate, data);
  loadDayData();
}

function addPhotos() {
  const files = document.getElementById('photoInput').files;
  if (!files.length) return;
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxW = 800;
        const scale = maxW / img.width;
        canvas.width = maxW;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        let data = await getDayData(currentDate) || {};
        data.photos = data.photos || [];
        data.photos.push(compressed);
        await saveDayData(currentDate, data);
        loadDayData();
      };
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('photoInput').value = '';
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
  loadDayData();
}

async function saveWeight() {
  const w = document.getElementById('weightInput').value;
  let data = await getDayData(currentDate) || {};
  data.weight = w ? parseFloat(w) : undefined;
  await saveDayData(currentDate, data);
  loadDayData();
}

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
    if (item.diary) html += `<div class="history-item">📝 ${item.diary.substring(0,50)}…</div>`;
    if (item.photos && item.photos.length) html += `<div class="history-item">🖼️ ${item.photos.length} 张照片</div>`;
    if (item.finance && Object.keys(item.finance).length) {
      const f = item.finance;
      html += `<div class="history-item">💰 存${f.saved||0} 省${f.economized||0} | 餐费: ${f.breakfast||0}/${f.lunch||0}/${f.dinner||0}</div>`;
    }
    if (item.weight) html += `<div class="history-item">⚖️ ${item.weight} kg</div>`;
    html += '<hr style="margin:4px 0">';
  }
  container.innerHTML = html;
}
