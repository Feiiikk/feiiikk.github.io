'use strict';

const STUDY_DATA_VERSION = 9;

const STUDY_AREAS = {
  bnef: {label:'BNEF', defaultType:'Article', types:['Article','Podcast','Video','Report','Book','Newsletter','Course','Other']},
  french: {label:'French', prefix:'fr', defaultType:'Other', titleHint:'e.g. Coffee Break French — episode 5'},
  japanese: {label:'Japanese', prefix:'ja', defaultType:'Other', titleHint:'e.g. Japanese listening practice — episode 5'}
};
const LANGUAGE_TYPES = ['Course','Podcast','Video','Book','Article','App','Class','Conversation','Flashcards','Other'];
const LANGUAGE_SKILLS = [
  ['listening','Listening','🎧','industry','#2196f3'],
  ['speaking','Speaking','💬','finance','#ffc107'],
  ['reading','Reading','📖','energy','#4caf50'],
  ['writing','Writing','✍️','writing','#009688'],
  ['grammar','Grammar','🧩','data','#9c27b0'],
  ['vocabulary','Vocabulary','🗂️','custom','#7355a5'],
  ['mixed','Mixed practice','🎯','custom','#54666c']
];
const LANGUAGE_TARGETS = {targetDate:'',weeklyHours:0,catTargets:{}};

function knownStudyArea(value) {
  return typeof value==='string'&&Object.hasOwn(STUDY_AREAS,value);
}
function studyAreaOf(raw) {
  return knownStudyArea(raw?.studyArea)?raw.studyArea:'bnef';
}
function areaRecords(records,area) {
  return records.filter(row=>studyAreaOf(row)===area);
}
function replaceAreaRecords(records,updated,area) {
  return [...records.filter(row=>studyAreaOf(row)!==area),
    ...updated.map(row=>area==='bnef'?row:{...row,studyArea:area})];
}
function builtInSkills(area) {
  const {prefix}=STUDY_AREAS[area];
  return LANGUAGE_SKILLS.map(([key,label,icon,chipClass,barColor])=>({id:`${prefix}_${key}`,label,icon,chipClass,barColor}));
}
function recentMaterials(logs, limit=6) {
  const names=new Set();
  const result=[];
  for (const log of [...logs].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id)) {
    if (log.type==='Course'||!log.title?.trim()) continue;
    const key=JSON.stringify([log.type,log.title.trim().toLowerCase(),log.publisher?.trim().toLowerCase()]);
    if (names.has(key)) continue;
    names.add(key);
    result.push(log);
    if (result.length===limit) break;
  }
  return result;
}
