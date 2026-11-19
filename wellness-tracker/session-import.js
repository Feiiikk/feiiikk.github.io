function normalizeMove(s){return String(s).toLowerCase().replace(/[\s\-_,，：:()（）]/g,'');}
function resolveMove(name){
 const all=Object.values(EX).flatMap(g=>g.exs),key=normalizeMove(name);
 const exact=all.find(x=>[x.en,x.cn].some(n=>normalizeMove(n)===key));if(exact)return exact;
 const aliases=[['直臂下压','Straight arm pulldown'],['直臂下拉','Straight arm pulldown'],['面拉','Face pull'],['辅助引体','Assisted pull-up'],['高位下拉','Lat pulldown'],['侧平举','Lateral raise'],['y字','Y-raise'],['弓步哑铃划船','Lunge-stance DB row'],['哑铃推肩','Seated DB shoulder press'],['smith卧推','Smith bench press'],['smith单腿蹲','Smith split squat'],['杠铃罗马尼亚硬拉','Barbell RDL'],['abductor','Hip abductor machine'],['髋外展','Hip abductor machine'],['爬楼机','Stairmaster'],['椭圆机','Elliptical steady state'],['爬坡热身','Incline treadmill walk']];
 const alias=aliases.find(([a])=>normalizeMove(a)===key);return alias?all.find(x=>x.en===alias[1]):null;
}
function validImportDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;const d=new Date(date+'T12:00:00');return !Number.isNaN(+d)&&d.getFullYear()===Number(date.slice(0,4))&&d.getMonth()+1===Number(date.slice(5,7))&&d.getDate()===Number(date.slice(8,10));}
function parseTrainingText(text,fallbackDate){
 const rows=[],warnings=[],dates=[];let duration='';
 const lines=String(text).replace(/[×✕＊]/g,'*').replace(/\r/g,'').split('\n').flatMap(line=>line.split(/\s+\+\s+(?=[A-Za-z\u4e00-\u9fff])/));
 for(let line of lines){
  line=line.replace(/^\s*[-*•·]+\s*/,'').trim();if(!line)continue;
  const dateMatch=line.match(/^(?:(\d{4})[.\/-])?(\d{1,2})[.\/-](\d{1,2})(?:\s*日)?$/);
  if(dateMatch){const year=dateMatch[1]||fallbackDate.slice(0,4);dates.push(`${year}-${dateMatch[2].padStart(2,'0')}-${dateMatch[3].padStart(2,'0')}`);if(!dateMatch[1])warnings.push('日期没有年份，暂按所选年份补全，请核对。');continue;}
  const total=line.match(/^(?:总时长|训练时长|total(?: duration)?|duration)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:min|分钟|mins)$/i);
  if(total){duration=total[1];continue;}
  const notes=[],weight=line.match(/([+\-]?\d+(?:\.\d+)?)\s*(kg|公斤|千克|lb|lbs|磅)/i),time=line.match(/(\d+(?:\.\d+)?)\s*(min(?:utes|s)?|分钟|sec(?:onds|s)?|秒)/i);
  let rest=line,w='',s='',r='',ss='',explicitSets=line.match(/(\d+)\s*组/),explicitReps=line.match(/(\d+(?:\s*[/、]\s*\d+)*)\s*(?:次|reps)/i);
  if(weight){w=weight[1];rest=rest.replace(weight[0],' ');if(/lb|磅/i.test(weight[2]))notes.push('原单位为lb／磅，未转成kg；请在填入前确认单位。');if(weight[1].startsWith('+'))notes.push('加片／总重口径未明确，请确认是否含杆。');}
  const pair=rest.match(/(\d+)\s*[*xX]\s*(\d+)/);
  if(pair){let a=Number(pair[1]),b=Number(pair[2]);if(a>8&&b<=8){s=String(b);r=String(a);notes.push('按“次数×组数”解析，请核对。');}else{s=String(a);r=String(b);}rest=rest.replace(pair[0],' ');}
  if(explicitSets)s=explicitSets[1];if(explicitReps)r=explicitReps[1];
  if(weight&&/\*\s*2/.test(rest)&&!pair)notes.push('原文可能是两只哑铃；重量按原值保留。');
  rest=rest.replace(/\*\s*2/g,' ').replace(/\d+\s*组/g,' ').replace(/\d+(?:\s*[/、]\s*\d+)*\s*(?:次|reps)/gi,' ').replace(/\b(?:sps|superset|ss)\b|超级组/gi,()=>{ss='超级组（请填写配对动作）';return ' ';});
  if(time)rest=rest.replace(time[0],' ');
  let name=rest.replace(/[+*]/g,' ').replace(/\s+/g,' ').trim(),meta=resolveMove(name);
  if(!meta){const matches=Object.values(EX).flatMap(g=>g.exs).filter(x=>normalizeMove(name).length>2&&[x.en,x.cn].some(n=>normalizeMove(n).includes(normalizeMove(name))));if(matches.length===1)meta=matches[0];}
  if(weight&&/lb|磅/i.test(weight[2])&&meta&&/kg/.test(meta.unit)){w=String(Math.round(Number(weight[1])/2.2046226218*100)/100);const old=notes.findIndex(n=>n.includes('原单位为lb'));if(old>=0)notes[old]='已将原文'+weight[0]+'换算成'+w+'kg，请核对。';}
  if(meta?.mode==='timed'&&time){const seconds=/sec|秒/i.test(time[2]);w=String(meta.unit==='sec'?(seconds?Number(time[1]):Number(time[1])*60):(seconds?Number(time[1])/60:Number(time[1])));}
  else if(time)notes.push('原时长：'+time[0]);
  if(!name){warnings.push('有一行缺少动作名称，已跳过：'+line);continue;}
  if(!meta)notes.push('动作未精确匹配，将按自定义动作保留。');
  if(!s&&meta?.mode!=='timed')notes.push('组数未识别。');if(!r&&meta?.mode!=='timed')notes.push('次数未识别。');
  rows.push({en:meta?.en||name,w,s,r,ss,n:notes.join(' '),source:line,mode:meta?.mode,unit:meta?.unit,sid:meta?.sid});
 }
 const unique=[...new Set(dates)];if(unique.length>1)warnings.push('检测到多个日期：请一次只解析一天的训练。');const date=unique[0]||fallbackDate;if(!validImportDate(date))warnings.push('日期无效，请修改后重新解析。');
 return {rows,date,duration,warnings,blocked:unique.length>1||!validImportDate(date)};
}
let parsedSession=null,ocrWorker=null,ocrBusy=false,ocrCancel=false;
function previewTrainingImport(){
 parsedSession=parseTrainingText(inputValue('session-raw'),inputValue('session-import-date'));
 const status=document.getElementById('session-parse-status');status.textContent=[...parsedSession.warnings,`识别 ${parsedSession.rows.length} 个动作；下方内容可修改，尚未保存。`].join(' ');
 document.getElementById('session-import-date').value=parsedSession.date;document.getElementById('session-import-duration').value=parsedSession.duration;
 document.getElementById('session-preview').innerHTML=parsedSession.rows.map((row,i)=>`<div class="section-card"><label class="performed"><input type="checkbox" id="imp-use-${i}" checked> 填入这个动作</label><label>动作<input id="imp-name-${i}" list="exercise-name-options" value="${safeHTML(row.en)}"></label><div class="editor-grid">${[['w','重量／时长'],['s','组数'],['r','每组次数'],['ss','超级组配对']].map(([key,label])=>`<label>${label}<input id="imp-${key}-${i}" value="${safeHTML(row[key])}"></label>`).join('')}</div><label>待确认事项／备注<input id="imp-n-${i}" value="${safeHTML(row.n)}"></label><div class="muted">原文：${safeHTML(row.source)}</div></div>`).join('');
 document.getElementById('session-apply').disabled=parsedSession.blocked||!parsedSession.rows.length;
}
function applyTrainingImport(){
 if(!parsedSession||parsedSession.blocked)return;
 const date=inputValue('session-import-date');if(!validImportDate(date)){document.getElementById('session-parse-status').textContent='请核对日期。';return;}
 const rows=[];
 for(let i=0;i<parsedSession.rows.length;i++){
  if(!document.getElementById(`imp-use-${i}`).checked)continue;
  const en=inputValue(`imp-name-${i}`).trim(),s=inputValue(`imp-s-${i}`),meta=resolveMove(en);if(!en||s&&(!Number.isInteger(Number(s))||Number(s)<=0)){document.getElementById('session-parse-status').textContent='动作名不能为空，组数须为正整数或留空。';return;}
  rows.push({...Object.fromEntries(['w','s','r','ss','n'].map(key=>[key,inputValue(`imp-${key}-${i}`)])),en:meta?.en||en,sid:meta?.sid,mode:meta?.mode,unit:meta?.unit,done:true});
 }
 if(!rows.length)return;
 captureTrainingForm();document.getElementById('td').value=date;loadTrainingDate();const draft=trainingDrafts[date];
 for(const row of rows){if(exerciseMeta(row.en)&&!draft.ex[row.en]?.done)draft.ex[row.en]=row;else draft.cx.push({...row,id:cxId++});}
 if(inputValue('session-import-duration')){draft.dur=inputValue('session-import-duration');document.getElementById('tdur').value=draft.dur;}
 draft.dirty=true;cxRows=draft.cx.map(x=>({...x}));selSess=new Set([...selSess,...rows.map(x=>x.sid).filter(Boolean)]);draft.sess=[...selSess];recentExercisesOnly=false;document.getElementById('exercise-search').value='';loadingTraining=true;drawExs();drawCxRows();renderSessChips();loadingTraining=false;updBurn();
 document.getElementById('session-parse-status').textContent=`已追加 ${rows.length} 个动作到 ${date} 的草稿；请检查后点击“保存训练”。原训练内容未覆盖。`;document.getElementById('session-apply').disabled=true;parsedSession=null;
}
async function loadOCRLibrary(){if(window.Tesseract)return;await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='./vendor/ocr/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('识别组件无法加载，请联网重试。'));document.head.append(script);});}
async function recognizeSessionImage(event){
 const file=event.target.files?.[0];if(!file||ocrBusy)return;
 const status=document.getElementById('session-parse-status');if(file.size>15*1024*1024){status.textContent='图片太大，请选择15MB以内的截图。';return;}
 ocrBusy=true;ocrCancel=false;document.getElementById('session-ocr-cancel').hidden=false;status.textContent='正在本机加载中英文识别模型；首次使用需下载组件。';let bitmap;
 try{
  await loadOCRLibrary();if(ocrCancel)return;
  ocrWorker=await Tesseract.createWorker(['eng','chi_sim'],1,{workerPath:new URL('./vendor/ocr/worker.min.js',location.href).href,corePath:new URL('./vendor/ocr/tesseract-core-lstm.wasm.js',location.href).href,langPath:new URL('./vendor/ocr/lang/',location.href).href,gzip:false,workerBlobURL:false,cacheMethod:'none',logger:m=>{if(!ocrCancel)status.textContent=`设备内识别：${m.status} ${Math.round((m.progress||0)*100)}%`;}});
  if(ocrCancel)return;bitmap=await createImageBitmap(file);const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  const result=await ocrWorker.recognize(canvas);if(ocrCancel)return;document.getElementById('session-raw').value=result.data.text;previewTrainingImport();status.textContent='截图已在设备内识别，请核对文字、重量、组次和日期后再填入。 '+status.textContent;
 }catch(e){if(!ocrCancel)status.textContent='无法完成截图识别，可重试清晰截图，或用iPhone照片的“实况文本”复制文字后粘贴。';}
 finally{bitmap?.close();if(ocrWorker)await ocrWorker.terminate().catch(()=>{});ocrWorker=null;ocrBusy=false;document.getElementById('session-ocr-cancel').hidden=true;event.target.value='';}
}
function cancelSessionOCR(){ocrCancel=true;if(ocrWorker)ocrWorker.terminate().catch(()=>{});document.getElementById('session-parse-status').textContent='已取消识别。';}

document.getElementById('session-import-date').value=today();document.getElementById('exercise-name-options').innerHTML=Object.values(EX).flatMap(g=>g.exs).map(x=>`<option value="${safeHTML(x.en)}">${safeHTML(x.cn)}</option>`).join('');
