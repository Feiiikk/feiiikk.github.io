'use strict';

function syncEqual(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length &&
    keys.every(key => Object.hasOwn(right, key) && syncEqual(left[key], right[key]));
}

function mergeStudySnapshots(base, local, remote, defaultTargets) {
  const conflicts = [];
  const recordConflict = (path, localValue, cloudValue) => {
    conflicts.push({path, local:localValue ?? null, cloud:cloudValue ?? null});
  };

  function mergeValue(before, left, right, path) {
    if (syncEqual(left,right)) return right;
    if (syncEqual(before,left)) return right;
    if (syncEqual(before,right)) return left;
    if (left === undefined || right === undefined) {
      recordConflict(path,left,right);
      return left ?? right;
    }
    if (left && right && typeof left === 'object' && typeof right === 'object' &&
        !Array.isArray(left) && !Array.isArray(right)) {
      const keys = new Set([...Object.keys(right),...Object.keys(left)]);
      return Object.fromEntries([...keys].flatMap(key => {
        const value = mergeValue(before?.[key],left[key],right[key],[...path,key]);
        return value === undefined ? [] : [[key,value]];
      }));
    }
    recordConflict(path,left,right);
    return right;
  }

  function mergeRecords(before, left, right, key, path, merge = mergeValue) {
    const index = rows => new Map((rows || []).map(row => [row[key],row]));
    const old = index(before), a = index(left), b = index(right);
    return [...new Set([...b.keys(),...a.keys()])].flatMap(id => {
      const record = merge(old.get(id),a.get(id),b.get(id),[...path,id]);
      return record === undefined ? [] : [record];
    });
  }

  const logs = mergeRecords(base?.logs,local.logs,remote.logs,'id',['logs'])
    .sort((a,b) => b.date.localeCompare(a.date) || b.id-a.id);
  const unitsByCourse = rows => {
    const units = new Map();
    for (const row of rows || []) {
      if (row.courseId) units.set(row.courseId,(units.get(row.courseId)||0)+(Number(row.courseUnits)||0));
    }
    return units;
  };
  const oldUnits = unitsByCourse(base?.logs), localUnits = unitsByCourse(local.logs);
  const cloudUnits = unitsByCourse(remote.logs), mergedUnits = unitsByCourse(logs);
  const boundedProgress = (done, total) => Math.max(0,total>0?Math.min(total,done):done);

  function mergeCourse(before, left, right, path) {
    if (!left || !right) return mergeValue(before,left,right,path);
    const {links:leftLinks,completed:leftDone,...leftFields} = left;
    const {links:rightLinks,completed:rightDone,...rightFields} = right;
    const {links:oldLinks,completed:oldDone,...oldFields} = before || {};
    const course = mergeValue(oldFields,leftFields,rightFields,path);
    const id = course.id;
    const links = mergeRecords(oldLinks,leftLinks,rightLinks,'id',[...path,'links']);
    let completed;
    if (before) {
      const expected = (units,total) => boundedProgress((Number(oldDone)||0)+(units.get(id)||0)-(oldUnits.get(id)||0),total);
      const localAdjustment = (Number(leftDone)||0)-expected(localUnits,left.total);
      const cloudAdjustment = (Number(rightDone)||0)-expected(cloudUnits,right.total);
      const adjustment = mergeValue(0,localAdjustment,cloudAdjustment,[...path,'progressAdjustment']);
      completed = expected(mergedUnits,course.total)+adjustment;
    } else {
      completed = mergeValue(undefined,leftDone,rightDone,[...path,'completed']);
    }
    return {...course,links,completed:boundedProgress(Number(completed)||0,course.total)};
  }

  const courses = mergeRecords(base?.courses,local.courses,remote.courses,'id',['courses'],mergeCourse);
  const customCats = mergeRecords(base?.customCats,local.customCats,remote.customCats,'id',['customCats']);
  const knownCategories = new Set(customCats.map(cat => cat.id));
  const references = new Set([...logs.map(log=>log.category),...courses.map(course=>course.cat)]);
  for (const cat of [...remote.customCats,...local.customCats,...(base?.customCats || [])]) {
    if (references.has(cat.id) && !knownCategories.has(cat.id)) {
      customCats.push(cat);
      knownCategories.add(cat.id);
    }
  }

  const publishers=mergeRecords(
    base?.publishers?.map(name=>({name})),
    local.publishers.map(name=>({name})),
    remote.publishers.map(name=>({name})),
    'name',['publishers']
  ).map(row=>row.name);
  return {
    data:{
      version:STUDY_DATA_VERSION,
      logs,courses,customCats,publishers,
      categoryOverrides:mergeValue(base?.categoryOverrides,local.categoryOverrides,remote.categoryOverrides,['categoryOverrides']),
      targets:mergeValue(base?.targets || defaultTargets,local.targets,remote.targets,['targets']),
      syntheses:mergeRecords(base?.syntheses,local.syntheses,remote.syntheses,'key',['syntheses'])
        .sort((a,b)=>String(b.key).localeCompare(String(a.key)))
    },
    conflicts
  };
}
