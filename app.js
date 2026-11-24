const key = 'oceanspub-poc-v2';
const admin = document.body.dataset.view === 'admin';
const app = document.querySelector('#app');
const date = (value = new Date()) => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul'}).format(value);
const today = date();
const currentMonth = today.slice(0,7);
const monday = new Date(today + 'T12:00:00+09:00');
monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
const sunday = new Date(+monday + 6 * 86400000);
const week = [date(monday), date(sunday)];
const names = ['산체스','유로','노유킹','나옹이','형동이','명찬이','예진이'];
const gameTypes = [
  {id:'first',name:'첫 게임',points:[]},
  {id:'daily',name:'데일리',points:[2,1]},
  {id:'deep',name:'딥랭크',points:[5,3]},
  {id:'mtt',name:'MTT',points:[100,65,40,25,15]}
];
function gameRecord(day,type,participants){
  const results = participants.map(({rank,name})=>({rank,name,points:type.points[rank-1] ?? 0}));
  return {day,type:type.name,results:results.sort((a,b)=>a.rank-b.rank)};
}
function demoGame(id,participants){
  const type = gameTypes.find(type=>type.id===id);
  return gameRecord(today,type,participants.map((name,index)=>({rank:index+1,name})));
}
function scoringText(type){
  return type.points.map((point,index)=>`${index+1}위 ${point}점`).join(' · ') || '랭킹 점수 없음';
}
const missions = ['첫 게임 참가','데일리 입상','딥랭크 참가','포켓 페어로 승리','MTT 참가','쇼다운 승리','친구와 함께 방문','주간 랭킹 진입','데일리 우승'];
const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const demo = {
  members:names,
  types:gameTypes,
  games:[
    demoGame('first',[names[2],names[3],names[4]]),
    demoGame('daily',[names[0],names[1],names[2]]),
    demoGame('deep',[names[5],names[0],names[6]])
  ],
  boards:{[currentMonth]:{missions, three:'음료 1잔', full:'매장 이용권', done:[[names[0],names[1]],[names[0]],[names[0]],[],[names[0]],[],[],[],[]]}},
  stars:{[names[0]]:12,[names[1]]:7,[names[2]]:4}
};
function load(){
  try { return JSON.parse(localStorage.getItem(key)) ?? structuredClone(demo); }
  catch { return structuredClone(demo); }
}
let data = load();
const tabs = admin ? [['games','게임 결과'],['types','게임 종류'],['bingo','월간 빙고'],['stars','회원 별 관리']] :
  [['ranking','주간 랭킹'],['bingo','월간 빙고'],['stars','회원 별']];
let tab = tabs.some(([id])=>id===location.hash.slice(1)) ? location.hash.slice(1) : tabs[0][0];
let month = currentMonth;
let member = data.members[0];
let mission = 0;
let notice = '';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const options = (items, selected) => items.map(([value,label])=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`).join('');
const memberOptions = () => options(data.members.map(name=>[name,name]),member);
const board = () => Object.hasOwn(data.boards,month) ? data.boards[month] : null;
const stars = name => Object.hasOwn(data.stars,name) ? data.stars[name] : 0;
const progress = (entry,name) => {
  const done = entry.done.map(members=>members.includes(name));
  return {done, completed:done.filter(Boolean).length, rows:lines.filter(line=>line.every(index=>done[index])).length};
};
function save(message){
  localStorage.setItem(key,JSON.stringify(data));
  notice = message;
  render();
}
function ranking(){
  const totals = new Map();
  for(const game of data.games.filter(game=>game.day>=week[0] && game.day<=week[1])){
    for(const result of game.results){
      if(result.points>0) totals.set(result.name,(totals.get(result.name) ?? 0) + result.points);
    }
  }
  let previous, rank;
  return [...totals].sort(([a,x],[b,y])=>y-x || a.localeCompare(b,'ko')).map(([name,points],index)=>{
    if(points!==previous) rank=index+1;
    previous=points;
    return {name,points,rank};
  });
}
function leaderboard(){
  return `<section class="panel"><div class="row headrow"><h2>주간 랭킹</h2><span class="pill">${week[0]} ~ ${week[1]}</span></div>
  ${ranking().map(({name,points,rank})=>`<div class="leader"><span class="rank">${rank}</span><strong>${esc(name)}</strong><span class="score">${points}점</span></div>`).join('') || '<p class="muted">이번 주에 점수를 획득한 회원이 없습니다.</p>'}</section>`;
}
function gameRow(rank){
  return `<div class="result-row"><label class="field">순위<input name="rank" type="number" min="1" value="${rank}" required></label>
    <label class="field">회원 닉네임<input name="name" list="members" placeholder="기존 회원 검색 또는 신규 입력" maxlength="30" required></label>
    <button class="secondary" type="button" data-action="remove-row" aria-label="참가자 행 삭제">삭제</button></div>`;
}
function games(){
  return `<div class="grid"><section class="panel"><h2>게임 결과 등록</h2><form class="stack" data-form="game">
  <div class="row"><label class="field grow">경기일<input name="day" type="date" value="${today}" required></label>
  <label class="field grow">게임 종류<select name="type" required>${options(data.types.map(type=>[type.id,type.name]))}</select></label></div>
  <div class="pill" id="scoring"></div><div class="stack" id="results">${[1,2,3].map(gameRow).join('')}</div>
  <datalist id="members">${memberOptions()}</datalist>
  <div class="row"><button class="secondary" type="button" data-action="add-row">＋ 참가자 추가</button><button class="primary" type="submit">결과 저장</button></div>
  </form></section><div>${leaderboard()}<section class="panel"><h2>경기 기록</h2>
  ${data.games.slice().reverse().map(game=>`<div class="record"><div><strong>${esc(game.type)}</strong><small class="muted">${game.results.map(result=>`${result.rank}위 ${esc(result.name)} (${result.points}점)`).join(' · ')}</small></div><span class="pill">${esc(game.day)}</span></div>`).join('')}</section></div></div>`;
}
function types(){
  return `<div class="grid"><section class="panel"><h2>게임 종류 추가</h2><form class="stack" data-form="type">
    <label class="field">게임 이름<input name="name" placeholder="예: 주말 토너먼트" maxlength="30" required></label>
    <label class="field">순위별 점수<input name="points" placeholder="예: 60, 40, 25" required></label>
    <span class="muted">1위부터 순서대로 쉼표로 구분해 입력하세요. 점수가 지정되지 않은 순위는 0점입니다.</span>
    <div><button class="primary">게임 종류 추가</button></div></form></section>
    <section class="panel"><h2>등록된 게임 종류</h2>${data.types.map(type=>`<div class="record"><div><strong>${esc(type.name)}</strong><small class="muted">${scoringText(type)}</small></div></div>`).join('')}</section></div>`;
}
function bingo(){
  const entry = board();
  const selection = `<label class="field">기준 월<input type="month" id="month" value="${month}"></label>`;
  if(!admin){
    if(!entry) return `<section class="panel">${selection}<p>이 달의 빙고 미션이 아직 등록되지 않았습니다.</p></section>`;
    const result = progress(entry,member);
    return `<section class="panel"><div class="row headrow"><h2>월간 빙고</h2><span class="pill">${result.completed}/9칸 · ${result.rows}줄</span></div>
    <div class="row">${selection}<label class="field">회원<select id="member">${memberOptions()}</select></label></div>
    <div class="bingo">${entry.missions.map((label,index)=>`<div class="tile ${result.done[index]?'done':''}">${esc(label)}${result.done[index]?'<small>✓ 달성</small>':''}</div>`).join('')}</div>
    <div class="row"><span class="pill ${result.rows>=3?'gold':''}">3줄 · ${esc(entry.three)}${result.rows>=3?' ✓':''}</span><span class="pill ${result.completed===9?'gold':''}">전체 · ${esc(entry.full)}${result.completed===9?' ✓':''}</span></div></section>`;
  }
  return `<div class="grid"><section class="panel"><h2>월별 미션 설정</h2>${selection}<form data-form="board" class="stack"><div class="bingo">
  ${Array.from({length:9},(_,index)=>`<label class="field">${index+1}번<input class="cell" name="mission" value="${esc(entry?.missions[index])}" maxlength="40" required></label>`).join('')}</div>
  <label class="field">3줄 프라이즈<input name="three" value="${esc(entry?.three)}" maxlength="50" required></label>
  <label class="field">전체 달성 프라이즈<input name="full" value="${esc(entry?.full)}" maxlength="50" required></label>
  <div><button class="primary">월간 빙고 저장</button></div></form></section><div>
  <section class="panel"><h2>미션 달성 기록</h2>${entry?`<form class="stack" data-form="completion">
  <label class="field">미션<select id="mission">${options(entry.missions.map((label,index)=>[index,label]),mission)}</select></label>
  <label class="field">회원<select id="member">${memberOptions()}</select></label>
  <div><button class="primary">달성 등록</button></div>
  <div class="records">${entry.done[mission].map(name=>`<div class="record"><strong>${esc(name)}</strong><button class="secondary" type="button" data-action="undo" data-name="${esc(name)}">달성 취소</button></div>`).join('') || '<span class="muted">아직 이 미션을 달성한 회원이 없습니다.</span>'}</div></form>`:'<p class="muted">이 달의 미션을 저장하면 달성 기록을 등록할 수 있습니다.</p>'}</section>
  ${entry?`<section class="panel"><h2>회원별 달성 현황</h2>${data.members.map(name=>{
    const result=progress(entry,name);
    return `<div class="record"><strong>${esc(name)}</strong><span class="pill ${result.rows>=3?'gold':''}">${result.completed}/9칸 · ${result.rows}줄${result.completed===9?' · 전체 프라이즈':result.rows>=3?' · 3줄 프라이즈':''}</span></div>`;
  }).join('')}</section>`:''}</div></div>`;
}
function starPage(){
  const count = stars(member);
  return `<section class="panel"><div class="row headrow"><h2>회원 별 모으기</h2><span class="pill gold">★ ${count} / 20</span></div>
  <label class="field">회원<select id="member">${memberOptions()}</select></label>
  <div class="stars" role="img" aria-label="별 20개 중 ${count}개">${Array.from({length:20},(_,index)=>index<count?'<span class="on">★</span>':'<span>☆</span>').join('')}</div>
  <p class="muted">별은 기간 제한 없이 회원별로 최대 20개까지 쌓입니다.</p>
  ${admin?`<button class="primary" data-action="star" ${count>=20?'disabled':''}>별 1개 지급</button>`:''}</section>`;
}
function render(){
  const menu = `<nav aria-label="화면 메뉴">${tabs.map(([id,label])=>`<button data-tab="${id}" ${id===tab?'aria-current="page"':''}>${label}</button>`).join('')}</nav>`;
  const brand = `<div class="brand"><i aria-hidden="true">♠</i><div>OCEANS PUB<small>${admin?'STORE MANAGEMENT':'HOLD’EM PUB'}</small></div></div>`;
  const heading = admin?{games:['게임 결과','회원과 순위를 입력하면 이번 주 점수가 자동으로 집계됩니다.'],types:['게임 종류','매장에서 운영하는 게임과 순위별 배점을 등록하세요.'],bingo:['월간 빙고','월별 미션과 프라이즈를 설정하고 회원의 달성을 기록하세요.'],stars:['회원 별 관리','매장 미션을 달성한 회원에게 별을 지급하세요.']}:
    {ranking:['주간 랭킹','이번 주 오션스펍에서 획득한 점수를 확인하세요.'],bingo:['월간 빙고','미션을 달성하고 빙고 프라이즈에 도전하세요.'],stars:['회원 별 모으기','오션스펍에서 모은 별을 확인하세요.']};
  const switcher = `<a class="switch" href="${admin?'guest':'admin'}.html">${admin?'손님 화면 보기':'관리자 목업'} ↗</a>`;
  const main = `<main><div class="hero"><div class="eyebrow">${admin?'오션스펍 매장 관리':'오션스펍'}</div><h1>${heading[tab][0]}</h1><p>${heading[tab][1]}</p></div>
  <p class="status" role="status">${esc(notice)}</p>
  ${({games,types,bingo,stars:starPage,ranking:leaderboard})[tab]()}</main>`;
  app.innerHTML = admin?`<div class="shell"><aside class="sidebar">${brand}${menu}${switcher}</aside>${main}</div>`:
    `<header class="guestbar"><div>${brand}${menu}${switcher}</div></header>${main}`;
  showScoring();
}
function showScoring(){
  const element = document.querySelector('#scoring');
  if(!element) return;
  const id = document.querySelector('select[name=type]').value;
  element.textContent = scoringText(data.types.find(type=>type.id===id));
}
app.addEventListener('click',event=>{
  const button = event.target.closest('button');
  if(!button) return;
  if(button.dataset.tab){
    tab=button.dataset.tab;
    history.replaceState(null,'','#'+tab);
    notice='';
    render();
    document.querySelector('[aria-current=page]').focus();
  }
  const action = button.dataset.action;
  if(action==='add-row'){
    const results=document.querySelector('#results');
    const rank=Math.max(0,...Array.from(results.querySelectorAll('[name=rank]'),input=>Number(input.value)))+1;
    results.insertAdjacentHTML('beforeend',gameRow(rank));
    results.lastElementChild.querySelector('[name=name]').focus();
  }
  if(action==='remove-row' && document.querySelectorAll('.result-row').length>1) button.closest('.result-row').remove();
  if(action==='undo'){
    board().done[mission]=board().done[mission].filter(name=>name!==button.dataset.name);
    save('달성 기록을 취소했습니다.');
  }
  if(action==='star' && stars(member)<20){
    data.stars={...data.stars,[member]:stars(member)+1};
    save(`${member} 회원에게 별 1개를 지급했습니다.`);
  }
});
app.addEventListener('change',event=>{
  const input=event.target;
  if(input.name==='type') showScoring();
  if(input.id==='month' && input.value){month=input.value;mission=0;notice='';render();}
  if(input.id==='mission'){mission=Number(input.value);notice='';render();}
  if(input.id==='member'){member=input.value;notice='';render();}
});
app.addEventListener('submit',event=>{
  event.preventDefault();
  const form=event.target;
  const fields=new FormData(form);
  const fail=message=>{document.querySelector('.status').textContent=message;};
  if(form.dataset.form==='game'){
    const type=data.types.find(item=>item.id===fields.get('type'));
    const ranks=fields.getAll('rank').map(Number);
    const participants=fields.getAll('name').map(name=>name.trim());
    if(participants.some(name=>!name) || new Set(participants).size!==participants.length) return fail('중복 없이 참가자 닉네임을 입력하세요.');
    if(new Set(ranks).size!==ranks.length) return fail('한 경기에서 같은 순위를 중복 입력할 수 없습니다.');
    const newMembers=participants.filter(name=>!data.members.includes(name));
    data.members.push(...newMembers);
    data.games.push(gameRecord(fields.get('day'),type,participants.map((name,index)=>({name,rank:ranks[index]}))));
    save(newMembers.length?`경기 결과를 저장하고 신규 회원 ${newMembers.length}명을 등록했습니다.`:'경기 결과를 저장했습니다.');
  }
  if(form.dataset.form==='type'){
    const name=fields.get('name').trim();
    const raw=fields.get('points').split(',').map(point=>point.trim());
    if(!name || data.types.some(type=>type.name===name)) return fail('등록된 이름과 다른 게임 이름을 입력하세요.');
    if(raw.some(point=>!/^\d+$/.test(point) || !Number.isSafeInteger(Number(point)))) return fail('점수는 0 이상의 정수로 입력하세요.');
    data.types.push({id:'type-'+Date.now(),name,points:raw.map(Number)});
    save('게임 종류를 추가했습니다.');
  }
  if(form.dataset.form==='board'){
    const labels=fields.getAll('mission').map(label=>label.trim());
    const three=fields.get('three').trim();
    const full=fields.get('full').trim();
    if(labels.some(label=>!label) || !three || !full) return fail('미션 9개와 프라이즈 2개를 모두 입력하세요.');
    const previous=board();
    data.boards[month]={missions:labels,three,full,done:labels.map((label,index)=>previous?.done[index] ?? [])};
    save('월간 빙고를 저장했습니다.');
  }
  if(form.dataset.form==='completion'){
    const completed=board().done[mission];
    if(completed.includes(member)) return fail('이미 달성으로 기록된 회원입니다.');
    completed.push(member);
    save('미션 달성을 등록했습니다.');
  }
});
window.addEventListener('storage',event=>{
  if(event.key!==key && event.key!==null) return;
  data=load();
  if(!data.members.includes(member)) member=data.members[0];
  if(!admin) render();
});
render();
