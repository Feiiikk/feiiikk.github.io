function normalizeMove(text) {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

const importAliases = [
  ['Barbell RDL', 'rmn', 'rdl', 'bb rdl', '罗马尼亚硬拉', '罗马尼亚', '杠铃rdl'],
  ['Dumbbell RDL', 'db rdl', '哑铃rdl'],
  ['Smith RDL', '史密斯rdl'],
  ['Straight arm pulldown', '直臂下压', 'straight-arm pull-down', 'sapd'],
  ['Face pull', '绳索面拉', 'fp'],
  ['Assisted pull-up', '辅助引体', 'assisted pullups', 'apu'],
  ['Pull-up', '引体', '引体向上', 'pullups'],
  ['Lat pulldown', '绳索下拉', 'lat pd', 'lat pull-down'],
  ['Lateral raise', '哑铃侧平举', '侧举', 'lat raise', 'lat raises', 'lateral raises'],
  ['Y-raise', 'y字', 'y字举', 'y字上举', 'y raise', 'y raises'],
  ['Lunge-stance DB row', '弓步哑铃划船', '弓步划船'],
  ['Single-arm DB row', '单臂划船', '单手划船', '单边哑铃划船', '1-arm db row'],
  ['Seated DB shoulder press', '哑铃推肩', '哑铃肩推', 'db shoulder press', 'db ohp'],
  ['Barbell overhead press', 'ohp', 'bb ohp', '杠铃推肩'],
  ['Smith bench press', 'smith卧推', '史密斯卧推', 'smith bench'],
  ['Smith split squat', 'smith单腿蹲', '史密斯单腿蹲', '史密斯分腿蹲', 'smith ss'],
  ['Barbell bench press', '杠铃卧推', '平板杠铃卧推', 'bb bench', 'bb bp'],
  ['Flat DB bench press', '哑铃卧推', 'db bench', 'db bp'],
  ['Barbell back squat', '杠铃深蹲', '杠铃背蹲', 'bb squat'],
  ['Bulgarian split squat', '保加利亚蹲', '保加利亚单腿蹲', 'bss'],
  ['Barbell hip thrust', '杠铃臀推', 'bb ht'],
  ['Hip abductor machine', 'abductor', 'hip abduction', '髋外展', '外展机'],
  ['Hip adductor machine', 'adductor', 'hip adduction', '髋内收', '内收机'],
  ['Stairmaster', '爬楼', '楼梯机', 'stair climber', 'stair stepper'],
  ['Elliptical steady state', '椭圆机', 'elliptical'],
  ['Incline treadmill walk', '爬坡热身', '爬坡', '跑步机爬坡', 'incline walk'],
];
const savedMoveNames = new Map(Object.values(EX).flatMap(group =>
  group.exs.flatMap(move => [[normalizeMove(move.en), move], [normalizeMove(move.cn), move]])));
for (const [name, ...aliases] of importAliases) {
  const move = exerciseMeta(name);
  if (move) aliases.forEach(alias => savedMoveNames.set(normalizeMove(alias), move));
}

function resolveMove(name) {
  return savedMoveNames.get(normalizeMove(name));
}

function importCustomName(name) {
  const key = normalizeMove(name);
  const lisa = key.match(/^(?:lisa|丽莎)(背部?|肩部?)(哑铃|杠铃片)?$/);
  const standard = lisa ? `Lisa ${lisa[1][0] === '背' ? '背部' : '肩部'}${lisa[2] ? ' · ' + lisa[2] : ''}` : name;
  return customExDB.find(move => normalizeMove(move.en) === normalizeMove(standard))?.en || standard;
}

function validImportDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(date + 'T12:00:00');
  return !Number.isNaN(+value) && value.getFullYear() === +date.slice(0, 4) &&
    value.getMonth() + 1 === +date.slice(5, 7) && value.getDate() === +date.slice(8, 10);
}

function parseTrainingText(text, fallbackDate) {
  const days = new Map();
  const warnings = [];
  let date = fallbackDate;
  const day = () => {
    if (!days.has(date)) days.set(date, {date, rows: [], duration: ''});
    return days.get(date);
  };

  for (const source of text.split(/\r?\n/)) {
    const line = source.normalize('NFKC')
      .replace(/^[\s#>*•·–—-]+|\*+\s*$/g, '').trim()
      .replace(/(\p{Script=Han})\s+(?=\p{Script=Han})/gu, '$1')
      .replace(/[×✕✖]/g, '*');
    if (!line || /^(?:training\s*log|workout\s*(?:log|notes)|训练(?:日志|记录|笔记)|健身(?:日志|记录))[\s\p{P}\p{S}]*$/iu.test(line)) continue;

    const heading = line.match(/^(?:(\d{4})\s*[.\/-年]\s*)?(\d{1,2})\s*[.\/-月]\s*(\d{1,2})(?![\d.])\s*(?:日|号)?(?:\s|[:：\p{Script=Han}]|$)/u);
    if (heading && !/^\d+[.]\d+\s*(?:kg|lb|公斤|千克|磅|min|分钟|s\b|秒)/i.test(line)) {
      const [, year = fallbackDate.slice(0, 4), month, number] = heading;
      const candidate = `${year}-${month.padStart(2, '0')}-${number.padStart(2, '0')}`;
      if (validImportDate(candidate)) date = candidate;
      else warnings.push(`日期「${line}」无效，后面的动作归入 ${date}，请核对日期。`);
      continue;
    }

    const duration = line.match(/^(?:总时长|训练时长|total(?: duration)?|duration)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:mins?|minutes?|分钟)$/i);
    if (duration) {
      day().duration = duration[1];
      continue;
    }

    const parts = line.split(/\s+\+\s*(?=[\p{L}])/u);
    const rows = parts.map(part => parseTrainingMove(part, source.trim())).filter(Boolean);
    if (rows.length > 1) {
      rows.forEach(row => { row.ss = rows.filter(other => other !== row).map(other => other.en).join(' + '); });
    }
    if (rows.length) day().rows.push(...rows);
  }

  return {days: [...days.values()].filter(item => item.rows.length), warnings: [...new Set(warnings)]};
}

function parseTrainingMove(line, source) {
  const notes = [];
  let w = '', s = '', r = '';
  let rest = line.replace(/\b(?:sps|superset)\b|超级组/gi, () => {
    notes.push('原文标记为超级组。');
    return ' ';
  });
  const weight = rest.match(/([+-]?\s*\d+(?:\.\d+)?)\s*(kg|lbs?|公斤|千克|磅)(?![a-z])/i);
  const time = rest.match(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|分钟|seconds?|secs?|秒)(?![a-z])/i);
  if (weight) {
    w = weight[1].replace(/\s/g, '');
    const suffix = rest.slice(weight.index + weight[0].length);
    const dumbbellCount = suffix.match(/^\s*[*xX]\s*2(?!\d)(?!\s*(?:组|次|sets?|reps?))/i);
    if (dumbbellCount) notes.push('两只哑铃，重量按每只记录。');
    rest = rest.slice(0, weight.index) + ' ' + suffix.slice(dumbbellCount?.[0].length || 0);
  }
  if (time) rest = rest.replace(time[0], ' ');

  const explicitSets = rest.match(/(\d+)\s*(?:组|sets?\b)/i);
  const explicitReps = rest.match(/(\d+(?:\s*[/、]\s*\d+)*)\s*(?:次|reps?\b)/i);
  if (explicitSets) s = explicitSets[1];
  if (explicitReps) r = explicitReps[1].replace(/\s*[/、]\s*/g, '/');
  const pair = rest.match(/(\d+)\s*[*xX]\s*(\d+)/);
  if (pair) {
    const [, a, b] = pair;
    const reverse = +a > 8 && +b <= 8;
    s ||= reverse ? b : a;
    r ||= reverse ? a : b;
    if (reverse && !explicitSets && !explicitReps) notes.push('按次数×组数读取，请核对。');
    rest = rest.replace(pair[0], ' ');
  }
  if (explicitSets) rest = rest.replace(explicitSets[0], ' ');
  if (explicitReps) rest = rest.replace(explicitReps[0], ' ');
  const bareReps = weight && !time && !s && !r && rest.match(/\s+(\d+(?:[\s/、,]+\d+)*)\s*$/);
  if (bareReps) {
    const reps = bareReps[1].split(/[\s/、,]+/);
    if (reps.length > 1) {
      s = String(reps.length);
      r = reps.join('/');
      rest = rest.slice(0, bareReps.index);
    }
  }
  const equipment = rest.match(/\s+(杠铃片|哑铃)\s*$/);
  const cardioDetails = time && rest.match(/\s*((?:\d+\s*)?(?:\d+(?:\.\d+)?\s*(?:k?cal|ckal))?)\s*$/i);
  let name = rest.replace(/[+*]/g, ' ').replace(/^[\s:：,，.]+|[\s:：,，.]+$/g, '').replace(/\s+/g, ' ');
  let meta = resolveMove(name);
  if (['单臂划船', '绳索下拉'].includes(normalizeMove(name))) notes.push('简称可能对应不同器械，请核对动作。');
  if (!meta && cardioDetails?.[1].trim()) {
    const candidate = rest.slice(0, cardioDetails.index).trim();
    const move = resolveMove(candidate);
    if (move?.mode === 'timed') {
      name = candidate;
      meta = move;
      notes.push('原文附加数据：' + cardioDetails[1].trim());
    }
  }
  if (!/\p{L}/u.test(name)) return null;
  if (weight && /lb|磅/i.test(weight[2])) {
    if (meta && /kg/.test(meta.unit)) {
      w = String(Math.round(Number(w) / 2.2046226218 * 100) / 100);
      notes.push('已将磅换算为 kg，请核对。');
    } else {
      notes.push('原单位为磅，请核对。');
    }
  }
  if (weight && weight[1].includes('+') && !meta?.unit.includes('added')) notes.push('原文带 +，请核对加片重量和含杆总重。');
  if (time && meta?.mode === 'timed') {
    const seconds = /sec|秒/i.test(time[2]);
    const minutes = Number(time[1]) / (seconds ? 60 : 1);
    w = String(meta.unit === 'sec' ? minutes * 60 : Math.round(minutes * 100) / 100);
  } else if (time) {
    notes.push('原时长：' + time[0]);
  }
  if (!meta && /^lisa\s*肩/i.test(name) && !equipment && /两只哑铃/.test(notes.join(''))) name += ' 哑铃';
  const en = meta?.en || importCustomName(name);
  if (!meta && !/^Lisa (?:背部|肩部)/.test(en) && !customExDB.some(move => move.en === en)) notes.push('未匹配动作库，请核对名称。');
  if (meta?.mode === 'timed') {
    if (!w) notes.push('请填写时长。');
  } else {
    if (!s) notes.push('组数未识别。');
    if (!r) notes.push('次数未识别。');
  }
  return {en, w, s, r, ss: '', n: notes.join(' '), source, mode: meta?.mode, unit: meta?.unit, sid: meta?.sid};
}
const importStatus = document.getElementById('session-parse-status');
const importDate = document.getElementById('session-import-date');
const importDayChoice = document.getElementById('session-import-day-choice');
const importDay = document.getElementById('session-import-day');
const importDuration = document.getElementById('session-import-duration');
const importText = document.getElementById('session-raw');
const importPreview = document.getElementById('session-preview');
const importApply = document.getElementById('session-apply');
let parsedSession = null;

function resetTrainingImportPreview() {
  parsedSession = null;
  importDayChoice.hidden = true;
  importPreview.replaceChildren();
  importApply.disabled = true;
  importStatus.textContent = '';
}

function previewTrainingImport(fromImage = false) {
  resetTrainingImportPreview();
  const fallback = importDate.value || inputValue('td') || today();
  const result = parseTrainingText(importText.value, fallback);
  if (!result.days.length) {
    importStatus.textContent = fromImage
      ? '截图已读取，未找到动作。可在上方更正文字，再点「解析文字」。'
      : '未找到动作。请粘贴训练内容，例如「RMN 3×10 +15kg」，每行一个动作。';
    return;
  }
  parsedSession = result;
  importDay.replaceChildren(...result.days.map(day => new Option(`${day.date} · ${day.rows.length} 个动作`, day.date)));
  importDay.value = result.days.some(day => day.date === fallback) ? fallback : result.days[0].date;
  importDayChoice.hidden = result.days.length < 2;
  showImportDay(fromImage);
}

function showImportDay(fromImage = false) {
  const day = parsedSession?.days.find(item => item.date === importDay.value);
  if (!day) return;
  const {rows, date, duration} = day;
  importDate.value = date;
  importDuration.value = duration;
  const summary = [
    fromImage ? '已从截图读取文字。' : '',
    parsedSession.days.length > 1 ? `找到 ${parsedSession.days.length} 天的训练，可切换日期逐天确认。` : '',
    ...parsedSession.warnings,
    day.applied ? `${date} 的动作已填入草稿。核对后请点「保存训练」。` : `${date} 识别出 ${rows.length} 个动作。请核对后填入草稿。`
  ];
  importStatus.textContent = summary.filter(Boolean).join(' ');
  importPreview.innerHTML = rows.map((row, i) => {
    const meta = resolveMove(row.en);
    const englishName = safeHTML(row.en);
    const title = meta ? `${safeHTML(meta.cn)} <span class="muted">${englishName}</span>` : englishName;
    const fields = [
      ['w', meta ? exerciseLoadLabel(meta) : '重量／时长', ' inputmode="decimal"'],
      ['s', '组数', ' inputmode="numeric"'],
      ['r', '每组次数', ''],
      ['ss', '超级组配对', '']
    ];
    return `<div class="section-card">
      <label class="performed"><input type="checkbox" id="imp-use-${i}" checked> ${title}</label>
      <label>动作名称<input id="imp-name-${i}" list="exercise-name-options" value="${englishName}"></label>
      <div class="editor-grid">${fields.map(([key, label, options]) =>
        `<label>${label}<input id="imp-${key}-${i}"${options} value="${safeHTML(row[key])}"></label>`).join('')}</div>
      <label>备注<input id="imp-n-${i}" value="${safeHTML(row.n)}"></label>
      <div class="muted">原文：${safeHTML(row.source)}</div>
    </div>`;
  }).join('');
  importApply.disabled = Boolean(day.applied);
}

function applyTrainingImport() {
  const day = parsedSession?.days.find(item => item.date === importDay.value);
  if (!day || day.applied) return;
  const date = importDate.value;
  if (!validImportDate(date)) {
    importStatus.textContent = '请选择有效的训练日期。';
    return;
  }
  const rows = [];
  for (let i = 0; i < day.rows.length; i++) {
    if (!document.getElementById(`imp-use-${i}`).checked) continue;
    const name = inputValue(`imp-name-${i}`).trim();
    const meta = resolveMove(name);
    const values = Object.fromEntries(['w', 's', 'r', 'ss', 'n'].map(key => [key, inputValue(`imp-${key}-${i}`).trim()]));
    if (!name || values.s && (!Number.isInteger(Number(values.s)) || Number(values.s) <= 0)) {
      importStatus.textContent = '动作名不能为空，组数须为正整数或留空。';
      return;
    }
    rows.push({...values, en: meta?.en || importCustomName(name), sid: meta?.sid, mode: meta?.mode, unit: meta?.unit, done: true});
  }
  if (!rows.length) {
    importStatus.textContent = '请勾选至少一个要填入的动作。';
    return;
  }
  document.getElementById('td').value = date;
  loadTrainingDate();
  const draft = trainingDrafts[date];
  for (const row of rows) {
    if (row.sid && !draft.ex[row.en]?.done) draft.ex[row.en] = row;
    else draft.cx.push({...row, id: cxId++});
    if (row.sid) selSess.add(row.sid);
  }
  if (importDuration.value) {
    draft.dur = importDuration.value;
    document.getElementById('tdur').value = draft.dur;
  }
  draft.dirty = true;
  draft.sess = [...selSess];
  cxRows = draft.cx.map(row => ({...row}));
  recentExercisesOnly = false;
  document.getElementById('exercise-search').value = '';
  loadingTraining = true;
  drawExs();
  drawCxRows();
  renderSessChips();
  loadingTraining = false;
  updBurn();
  day.applied = true;
  importApply.disabled = true;
  importStatus.textContent = `已填入 ${date} 的训练草稿，共 ${rows.length} 个动作。核对后请点「保存训练」。`;
  showToast(importStatus.textContent);
}

const importImage = document.getElementById('session-image');
const cancelImage = document.getElementById('session-ocr-cancel');
let activeOCR = null;

async function loadOCRLibrary() {
  if (window.Tesseract) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './vendor/ocr/tesseract.min.js';
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error('无法加载识别组件，请联网后重试。'));
    };
    document.head.append(script);
  });
}

async function decodeImportImage(file) {
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('无法打开这张图片，请换一张 PNG 或 JPEG 截图。'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', {alpha: false});
    if (!context) throw new Error('这张图片无法在设备上处理，请裁剪后重试。');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const resized = await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('无法处理这张图片，请裁剪后重试。'));
      }, 'image/png');
    });
    return new Uint8Array(await resized.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function recognizeSessionImage(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file || activeOCR) return;
  if (file.size > 15 * 1024 * 1024) {
    importStatus.textContent = '图片超过 15 MB，请裁剪到训练文字区域后重试。';
    return;
  }
  resetTrainingImportPreview();
  const task = {worker: null, cancelled: false, fail: null};
  activeOCR = task;
  importImage.disabled = true;
  cancelImage.hidden = false;
  const stopped = new Promise((_, reject) => { task.fail = reject; });
  const timeout = setTimeout(() => task.fail(new Error('截图识别超时。请检查网络，或裁剪到训练文字区域后重试。')), 60000);
  const ocrURL = path => new URL('./vendor/ocr/' + path, document.baseURI).href;
  let failure = '无法读取图片，请换一张截图。';
  try {
    importStatus.textContent = '正在打开截图…';
    const image = await Promise.race([decodeImportImage(file), stopped]);
    failure = '无法加载中英文识别模型，请联网后重试。';
    importStatus.textContent = '正在加载中英文识别模型，第一次需要联网…';
    await Promise.race([loadOCRLibrary(), stopped]);
    const pendingWorker = window.Tesseract.createWorker(['chi_sim', 'eng'], 1, {
      workerPath: ocrURL('worker.min.js'),
      corePath: ocrURL('tesseract-core-lstm.wasm.js'),
      langPath: ocrURL('lang'),
      gzip: false,
      workerBlobURL: false,
      cacheMethod: 'none',
      errorHandler: () => task.fail(new Error(failure)),
      logger: message => {
        if (activeOCR !== task || message.status !== 'recognizing text') return;
        importStatus.textContent = `正在识别截图… ${Math.round(message.progress * 100)}%`;
      }
    }).then(worker => {
      if (activeOCR !== task) return worker.terminate().then(() => null);
      task.worker = worker;
      return worker;
    });
    const worker = await Promise.race([pendingWorker, stopped]);
    failure = '识别这张截图时出错，请裁剪到训练文字区域后重试。';
    const result = await Promise.race([worker.recognize(image), stopped]);
    const extracted = result.data.text.trim();
    if (!extracted) {
      importStatus.textContent = '截图中没有读到清晰文字。请裁剪到训练日志区域后重试。';
      return;
    }
    importText.value = extracted;
    previewTrainingImport(true);
  } catch (error) {
    if (!task.cancelled) importStatus.textContent = error instanceof Error ? failureForOCR(error, failure) : failure;
  } finally {
    clearTimeout(timeout);
    activeOCR = null;
    importImage.disabled = false;
    cancelImage.hidden = true;
    task.worker?.terminate().catch(() => {});
  }
}

function failureForOCR(error, fallback) {
  return /^[\p{Script=Han}]/u.test(error.message) ? error.message : fallback;
}

function cancelSessionOCR() {
  if (!activeOCR) return;
  activeOCR.cancelled = true;
  activeOCR.fail(new Error('已取消截图识别。'));
  importStatus.textContent = '已取消截图识别。';
}

importDate.value = inputValue('td') || today();
document.getElementById('exercise-name-options').innerHTML = Object.values(EX).flatMap(group => group.exs)
  .map(move => `<option value="${safeHTML(move.en)}">${safeHTML(move.cn)}</option>`).join('');
document.getElementById('session-import-panel').addEventListener('toggle', event => {
  if (event.target.open && !parsedSession) importDate.value = inputValue('td') || today();
});
importText.addEventListener('input', resetTrainingImportPreview);
importDay.addEventListener('change', () => showImportDay());
