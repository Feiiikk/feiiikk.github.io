function normalizeMove(text) {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

const importAliases = [
  ['Barbell RDL', 'rmn', 'rmn 杠铃硬拉', 'rdl 杠铃硬拉', 'rdl', 'bb rdl', '罗马尼亚硬拉', '罗马尼亚', '杠铃rdl'],
  ['Dumbbell RDL', 'db rdl', '哑铃rdl'],
  ['Smith RDL', '史密斯rdl'],
  ['Straight arm pulldown', '直臂下压', 'straight-arm pull-down', 'sapd'],
  ['Hyperextension', '山羊挺身', '山羊挺', '背伸'],
  ['Smith hip thrust', 'smith 臀推', '史密斯臀推'],
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

const importWeight=/([+-]?\s*\d+(?:\.\d+)?)\s*(kg|lbs?|公斤|千克|磅)(?![a-z])(?:\s*(每侧|单侧|每边|per\s+side|each\s+side|\/side|\btotal\b|总重|合计))?/i;
function parseLoadGroups(line,source) {
  const weights=[...line.matchAll(new RegExp(importWeight.source,'gi'))];
  const first=parseTrainingMove(line.slice(0,weights[1]?.index),source);
  if (!first) return [];
  const groups=[first];
  for (let index=1;index<weights.length;index++) {
    const segment=line.slice(weights[index].index,weights[index+1]?.index).trim();
    const group=parseTrainingMove(first.en+' '+segment,source);
    if (!group) continue;
    if (!weights[index][3]&&groups.at(-1).unit==='kg added/side') {
      group.unit='kg added/side';
      group.n=[group.n,'Uses the same per-side basis as the previous group. Check before saving.'].filter(Boolean).join(' ');
    }
    groups.push(group);
  }
  return groups;
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
      .replace(/[×✕✖]/g, '*').replace(/\\(?=[*xX])/g,'');
    if (!line || /^(?:training\s*log|workout\s*(?:log|notes)|训练(?:日志|记录|笔记)|健身(?:日志|记录))[\s\p{P}\p{S}]*$/iu.test(line)) continue;

    const heading = line.match(/^(?:(\d{4})\s*[.\/-年]\s*)?(\d{1,2})\s*[.\/-月]\s*(\d{1,2})(?![\d.])\s*(?:日|号)?(?:\s|[:：\p{Script=Han}]|$)/u);
    if (heading && !/^\d+[.]\d+\s*(?:kg|lb|公斤|千克|磅|min|分钟|s\b|秒)/i.test(line)) {
      const [, year = fallbackDate.slice(0, 4), month, number] = heading;
      const candidate = `${year}-${month.padStart(2, '0')}-${number.padStart(2, '0')}`;
      if (validImportDate(candidate)) date = candidate;
      else warnings.push(`Invalid date “${line}”. Check the suggested date ${date}.`);
      continue;
    }

    const duration = line.match(/^(?:总时长|训练时长|total(?: duration)?|gym (?:time|minutes)|duration)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:mins?|minutes?|分钟)$/i);
    if (duration) {
      day().duration = duration[1];
      continue;
    }

    const parts = line.split(/\s+\+\s*(?=[\p{L}])/u);
    const groups=parts.map(part=>parseLoadGroups(part,source.trim())).filter(rows=>rows.length);
    if (groups.length>1) groups.forEach((rows,index)=>{
      const partners=[...new Set(groups.filter((_,i)=>i!==index).map(group=>group[0].en))].join(' + ');
      rows.forEach(row=>{row.ss=partners;});
    });
    if (groups.length) day().rows.push(...groups.flat());
  }

  return {days: [...days.values()].filter(item => item.rows.length), warnings: [...new Set(warnings)]};
}

function parseTrainingMove(line, source) {
  const notes = [];
  let w='',s='',r='',pairedDumbbells=false;
  let rest = line.replace(/\b(?:sps|superset)\b|超级组/gi, () => {
    notes.push('Marked as a superset.');
    return ' ';
  });
  const weight=rest.match(importWeight);
  const perSide=weight?.[3]&&!/total|总重|合计/i.test(weight[3]);
  const time = rest.match(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|分钟|seconds?|secs?|秒)(?![a-z])/i);
  if (weight) {
    w = weight[1].replace(/\s/g, '');
    const suffix = rest.slice(weight.index + weight[0].length);
    const dumbbellCount = suffix.match(/^\s*[*xX]\s*2(?!\d)(?!\s*(?:组|次|sets?|reps?))/i);
    if (dumbbellCount) pairedDumbbells=true;
    if (pairedDumbbells) notes.push('Weight recorded per dumbbell.');
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
    if (reverse && !explicitSets && !explicitReps) notes.push('Read as reps × sets. Please check.');
    rest = rest.replace(pair[0], ' ');
  }
  if (explicitSets) rest = rest.replace(explicitSets[0], ' ');
  if (explicitReps) rest = rest.replace(explicitReps[0], ' ');
  const bareReps = weight && !time && !s && !r && rest.match(/\s+(\d+(?:[\s/、,]+\d+)*)\s*$/);
  if (bareReps) {
    const reps = bareReps[1].split(/[\s/、,]+/);
    s=String(reps.length);
    r=reps.join('/');
    rest=rest.slice(0,bareReps.index);
  }
  const equipment = rest.match(/\s+(杠铃片|哑铃)\s*$/);
  const cardioDetails = time && rest.match(/\s*((?:\d+\s*)?(?:\d+(?:\.\d+)?\s*(?:k?cal|ckal))?)\s*$/i);
  let name = rest.replace(/[+*]/g, ' ').replace(/^[\s:：,，.]+|[\s:：,，.]+$/g, '').replace(/\s+/g, ' ');
  let meta = resolveMove(name);
  if (['单臂划船', '绳索下拉'].includes(normalizeMove(name))) notes.push('This shorthand can refer to different equipment. Check the exercise.');
  if (!meta && cardioDetails?.[1].trim()) {
    const candidate = rest.slice(0, cardioDetails.index).trim();
    const move = resolveMove(candidate);
    if (move?.mode === 'timed') {
      name = candidate;
      meta = move;
      notes.push('Extra details from the log: ' + cardioDetails[1].trim());
    }
  }
  if (!/\p{L}/u.test(name)) return null;
  if (weight && /lb|磅/i.test(weight[2])) {
    if (meta && /kg/.test(meta.unit)) {
      w = String(Math.round(Number(w) / 2.2046226218 * 100) / 100);
      notes.push('Converted pounds to kilograms. Please check.');
    } else {
      notes.push('Original weight is in pounds. Please check.');
    }
  }
  if (weight && weight[1].includes('+') && !weight[3] && !meta?.unit.includes('added')) notes.push('The log has a + sign. Check whether the weight includes the bar.');
  if (time && meta?.mode === 'timed') {
    const seconds = /sec|秒/i.test(time[2]);
    const minutes = Number(time[1]) / (seconds ? 60 : 1);
    w = String(meta.unit === 'sec' ? minutes * 60 : Math.round(minutes * 100) / 100);
  } else if (time) {
    notes.push('Duration from the log: ' + time[0]);
  }
  if (!meta && /^lisa\s*肩/i.test(name) && !equipment && pairedDumbbells) name += ' 哑铃';
  const en = meta?.en || importCustomName(name);
  if (!meta && !/^Lisa (?:背部|肩部)/.test(en) && !customExDB.some(move => move.en === en)) notes.push('Custom exercise. Check the name.');
  if (meta?.mode === 'timed') {
    if (!w) notes.push('Enter the duration.');
  } else {
    if (!s) notes.push('Check the number of sets.');
    if (!r) notes.push('Check the reps.');
  }
  return {en, w, s, r, ss: '', n: notes.join(' '), source, mode: meta?.mode, unit: perSide && meta ? 'kg added/side' : meta?.unit, sid: meta?.sid};
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
      ? 'No exercises found in the screenshot. Edit the text above and choose Parse text.'
      : 'No exercises found. Enter one exercise per line, e.g. RMN 3×10 +15 kg.';
    return;
  }
  parsedSession = result;
  importDay.replaceChildren(...result.days.map(day => new Option(`${day.date} · ${day.rows.length} rows`, day.date)));
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
    fromImage ? 'Text extracted from the screenshot.' : '',
    parsedSession.days.length > 1 ? `Found ${parsedSession.days.length} workout dates. Import one date at a time.` : '',
    ...parsedSession.warnings,
    day.applied ? `Added to the draft for ${date}. Review and save the workout.` : `Found ${rows.length} rows for ${date}. Review them before importing.`
  ];
  importStatus.textContent = summary.filter(Boolean).join(' ');
  importPreview.innerHTML = rows.map((row, i) => {
    const meta = resolveMove(row.en);
    const englishName = safeHTML(row.en);
    const title = meta ? `${englishName} <span class="muted">${safeHTML(meta.cn)}</span>` : englishName;
    const fields = [
      ['w', meta ? exerciseLoadLabel({...meta,unit:row.unit||meta.unit}) : 'Load / duration', ' inputmode="decimal"'],
      ['s', 'Sets', ' inputmode="numeric"'],
      ['r', 'Reps per set', ''],
      ['ss', 'Superset partner', '']
    ];
    return `<div class="section-card">
      <label class="performed"><input type="checkbox" id="imp-use-${i}" checked> ${title}</label>
      <label>Exercise<input id="imp-name-${i}" list="exercise-name-options" value="${englishName}"></label>
      <div class="editor-grid">${fields.map(([key, label, options]) =>
        `<label>${label}<input id="imp-${key}-${i}"${options} value="${safeHTML(row[key])}"></label>`).join('')}</div>
      <label>Notes<input id="imp-n-${i}" value="${safeHTML(row.n)}"></label>
      <div class="muted">Original: ${safeHTML(row.source)}</div>
    </div>`;
  }).join('');
  importApply.disabled = Boolean(day.applied);
}

function applyTrainingImport() {
  const day = parsedSession?.days.find(item => item.date === importDay.value);
  if (!day || day.applied) return;
  const date = importDate.value;
  if (!validImportDate(date)) {
    importStatus.textContent = 'Choose a valid workout date.';
    return;
  }
  const rows = [];
  for (let i = 0; i < day.rows.length; i++) {
    if (!document.getElementById(`imp-use-${i}`).checked) continue;
    const name = inputValue(`imp-name-${i}`).trim();
    const meta = resolveMove(name);
    const values = Object.fromEntries(['w', 's', 'r', 'ss', 'n'].map(key => [key, inputValue(`imp-${key}-${i}`).trim()]));
    if (!name || values.s && (!Number.isInteger(Number(values.s)) || Number(values.s) <= 0)) {
      importStatus.textContent = 'Enter an exercise name and use whole numbers for sets.';
      return;
    }
    const original=day.rows[i];
    rows.push({...values, en: meta?.en || importCustomName(name), sid: meta?.sid, mode: meta?.mode,
      unit:meta?.en===original.en?original.unit:meta?.unit, done:true});
  }
  if (!rows.length) {
    importStatus.textContent = 'Select at least one exercise to import.';
    return;
  }
  document.getElementById('td').value = date;
  loadTrainingDate();
  const draft = trainingDrafts[date];
  for (const row of rows) {
    addExerciseDraftRow(draft,row);
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
  importStatus.textContent = `Added ${rows.length} rows to ${date}. Review and save the workout.`;
  showToast(importStatus.textContent);
}

const importImage = document.getElementById('session-image');
const cancelImage = document.getElementById('session-ocr-cancel');
let activeOCR = null;

class OCRStatusError extends Error {}

async function loadOCRLibrary() {
  if (window.Tesseract) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './vendor/ocr/tesseract.min.js';
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new OCRStatusError('Could not load the scan tool. Try again online.'));
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
      image.onerror = () => reject(new OCRStatusError('Could not open the image. Try a PNG or JPEG screenshot.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', {alpha: false});
    if (!context) throw new OCRStatusError('Could not process the image. Crop it and try again.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const resized = await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new OCRStatusError('Could not process the image. Crop it and try again.'));
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
    importStatus.textContent = 'Images must be under 15 MB. Crop to the workout text and try again.';
    return;
  }
  resetTrainingImportPreview();
  const task = {worker: null, cancelled: false, fail: null};
  activeOCR = task;
  importImage.disabled = true;
  cancelImage.hidden = false;
  const stopped = new Promise((_, reject) => { task.fail = reject; });
  const timeout = setTimeout(() => task.fail(new OCRStatusError('The scan timed out. Check your connection or crop to the workout text.')), 60000);
  const ocrURL = path => new URL('./vendor/ocr/' + path, document.baseURI).href;
  let failure = 'Could not read the image. Try another screenshot.';
  try {
    importStatus.textContent = 'Opening screenshot…';
    const image = await Promise.race([decodeImportImage(file), stopped]);
    failure = 'Could not load the English and Chinese scan models. Try again online.';
    importStatus.textContent = 'Loading English and Chinese scan models…';
    await Promise.race([loadOCRLibrary(), stopped]);
    const pendingWorker = window.Tesseract.createWorker(['chi_sim', 'eng'], 1, {
      workerPath: ocrURL('worker.min.js'),
      corePath: ocrURL('tesseract-core-lstm.wasm.js'),
      langPath: ocrURL('lang'),
      gzip: false,
      workerBlobURL: false,
      cacheMethod: 'none',
      errorHandler: () => task.fail(new OCRStatusError(failure)),
      logger: message => {
        if (activeOCR !== task || message.status !== 'recognizing text') return;
        importStatus.textContent = `Scanning screenshot… ${Math.round(message.progress * 100)}%`;
      }
    }).then(worker => {
      if (activeOCR !== task) return worker.terminate().then(() => null);
      task.worker = worker;
      return worker;
    });
    const worker = await Promise.race([pendingWorker, stopped]);
    failure = 'Could not scan this image. Crop it to the workout text and try again.';
    const result = await Promise.race([worker.recognize(image), stopped]);
    const extracted = result.data.text.trim();
    if (!extracted) {
      importStatus.textContent = 'No readable text. Crop to the workout log and try again.';
      return;
    }
    importText.value = extracted;
    previewTrainingImport(true);
  } catch (error) {
    if (!task.cancelled) importStatus.textContent = error instanceof OCRStatusError ? error.message : failure;
  } finally {
    clearTimeout(timeout);
    activeOCR = null;
    importImage.disabled = false;
    cancelImage.hidden = true;
    task.worker?.terminate().catch(() => {});
  }
}

function cancelSessionOCR() {
  if (!activeOCR) return;
  activeOCR.cancelled = true;
  activeOCR.fail(new OCRStatusError('Scan cancelled.'));
  importStatus.textContent = 'Scan cancelled.';
}

importDate.value = inputValue('td') || today();
document.getElementById('exercise-name-options').innerHTML = Object.values(EX).flatMap(group => group.exs)
  .map(move => `<option value="${safeHTML(move.en)}">${safeHTML(move.cn)}</option>`).join('');
document.getElementById('session-import-panel').addEventListener('toggle', event => {
  if (event.target.open && !parsedSession) importDate.value = inputValue('td') || today();
});
importText.addEventListener('input', resetTrainingImportPreview);
importDay.addEventListener('change', () => showImportDay());
