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
  try {
    const saved = JSON.parse(localStorage.getItem(key)) ?? structuredClone(demo);
    saved.starMissions ??= [];
    saved.starAwards ??= [];
    return saved;
  }
  catch { return {...structuredClone(demo),starMissions:[],starAwards:[]}; }
}
let data = load();
const tabs = admin ? [['games','게임 결과'],['types','게임 종류'],['bingo','월간 빙고'],['stars','회원 별 관리'],['members','회원 관리'],['stats','매장 통계']] :
  [['ranking','주간 랭킹'],['bingo','월간 빙고'],['stars','회원 별']];
let tab = tabs.some(([id])=>id===location.hash.slice(1)) ? location.hash.slice(1) : tabs[0][0];
let month = currentMonth;
let member = data.members[0];
let mission = 0;
let notice = '';
let statsMonth = currentMonth;

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
function rankOptions(count,rank){
  return options(Array.from({length:count},(_,index)=>[index+1,`${index+1}위`]),rank);
}
function refreshRanks(){
  const rows = [...document.querySelector('#results').children];
  rows.forEach((row,index)=>{
    const input = row.querySelector('[name=rank]');
    input.innerHTML = rankOptions(rows.length,index+1);
    input.dataset.rank = index+1;
  });
}
function gameRow(rank){
  return `<div class="result-row"><label class="field">순위<select name="rank" aria-label="순위">${rankOptions(3,rank)}</select></label>
    <label class="field">회원 닉네임<input name="name" list="members" placeholder="기존 회원 검색 또는 신규 입력" maxlength="30" required></label>
    <button class="secondary" type="button" data-action="remove-row" aria-label="참가자 행 삭제">삭제</button></div>`;
}
function games(){
  return `<div class="grid"><section class="panel"><h2>게임 결과 등록</h2><form class="stack" data-form="game">
  <div class="row"><label class="field grow">경기일<input name="day" type="date" value="${today}" required></label>
  <label class="field grow">게임 종류<select name="type" required>${options(data.types.map(type=>[type.id,type.name]))}</select></label></div>
  <div class="pill" id="scoring"></div><small class="muted">순위를 터치해 선택하면 기존 참가자와 순위가 바뀝니다.</small><div class="stack" id="results">${[1,2,3].map(gameRow).join('')}</div>
  <datalist id="members">${memberOptions()}</datalist>
  <div class="row"><button class="secondary" type="button" data-action="add-row">＋ 참가자 추가</button><button class="primary" type="submit">결과 저장</button></div>
  </form></section><div>${leaderboard()}<section class="panel"><h2>경기 기록</h2>
  ${data.games.slice().reverse().map(game=>`<div class="record"><div><strong>${esc(game.type)}</strong><small class="muted">${game.results.map(result=>`${result.rank}위 ${esc(result.name)} (${result.points}점)`).join(' · ')}</small></div><span class="pill">${esc(game.day)}</span></div>`).join('')}</section></div></div>`;
}
function pointRow(rank){
  return `<label class="field point-row"><span class="pill">${rank}위</span><input name="points" type="number" min="0" step="1" inputmode="numeric" aria-label="${rank}위 점수" value="0" required><span>점</span></label>`;
}
function types(){
  return `<div class="grid"><section class="panel"><h2>게임 종류 추가</h2><form class="stack" data-form="type">
    <label class="field">게임 이름<input name="name" placeholder="예: 주말 토너먼트" maxlength="30" required></label>
    <label class="row"><input type="checkbox" name="unscored"> 랭킹 점수 없는 게임</label>
    <div id="point-settings" class="stack"><div id="point-rows" class="stack">${[1,2].map(pointRow).join('')}</div>
    <div class="row"><button class="secondary" type="button" data-action="add-point">＋ 배점 추가</button><button class="secondary" type="button" data-action="remove-point">마지막 배점 삭제</button></div></div>
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
    <div class="bingo public-board">${entry.missions.map((label,index)=>`<article class="tile ${result.done[index]?'done':''}">
      <strong>${esc(label)}</strong><ul aria-label="달성 회원">${entry.done[index].map(name=>`<li class="${name===member?'selected':''}">${esc(name)}</li>`).join('') || '<li class="empty">달성 회원 없음</li>'}</ul>
    </article>`).join('')}</div>
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
  if(!admin){
    const levels = Array.from({length:20},()=>[]);
    for(const name of data.members){
      const count = stars(name);
      if(count>=1 && count<=20) levels[count-1].push(name);
    }
    return `<section class="panel"><h2>별 모으기 랭킹</h2>
    <ol class="star-ranking" reversed start="20">${levels.reverse().map((members,index)=>`<li>
      <span class="pill gold">★ ${20-index}개</span>
      <div class="star-members">${members.sort((a,b)=>a.localeCompare(b,'ko')).map(name=>`<span>${esc(name)}</span>`).join('') || '<small class="muted">해당 회원 없음</small>'}</div>
    </li>`).join('')}</ol></section>`;
  }
  const count = stars(member);
  const balance = `<section class="panel"><div class="row headrow"><h2>회원 별 모으기</h2><span class="pill gold">★ ${count} / 20</span></div>
  <label class="field">회원<select id="member">${memberOptions()}</select></label>
  <div class="stars" role="img" aria-label="별 20개 중 ${count}개">${Array.from({length:20},(_,index)=>index<count?'<span class="on">★</span>':'<span>☆</span>').join('')}</div>
  ${admin && data.starMissions.length?`<form class="stack" data-form="award">
    <label class="field">지급 미션<select name="reward">${options(data.starMissions.map(item=>[item.id,`${item.name} · ★ ${item.count}개`]))}</select></label>
    <div><button class="primary" ${count===20?'disabled':''}>미션 별 지급</button></div></form>`:''}</section>`;
  return `<div class="grid"><div>${balance}<section class="panel"><h2>별 지급 이력</h2>
  ${data.starAwards.slice().reverse().map(item=>`<div class="record"><div><strong>${esc(item.member)} · ${esc(item.mission)}</strong><small class="muted">${esc(item.day)}</small></div><span class="pill gold">★ +${item.count}</span></div>`).join('') || '<p class="muted">기록된 미션 지급이 없습니다.</p>'}</section></div>
  <section class="panel"><h2>별 미션 등록</h2><form class="stack" data-form="star-mission">
  <label class="field">미션 이름<input name="name" maxlength="40" required></label>
  <label class="field">지급 별 개수<input name="count" type="number" min="1" max="20" value="1" required></label>
  <div><button class="primary">별 미션 등록</button></div></form>
  ${data.starMissions.map(item=>`<div class="record"><strong>${esc(item.name)}</strong><span class="pill gold">★ ${item.count}개</span></div>`).join('')}</section></div>`;
}
function memberStats(games){
  const records = new Map(data.members.map(name=>[name,{games:0,wins:0,days:new Set(),last:''}]));
  for(const game of games){
    for(const result of game.results){
      const stats = records.get(result.name);
      stats.games++;
      if(result.rank===1) stats.wins++;
      stats.days.add(game.day);
      if(game.day>stats.last) stats.last=game.day;
    }
  }
  return records;
}
function statTable(headers,rows){
  return `<div class="table-wrap"><table><thead><tr>${headers.map(label=>`<th scope="col">${label}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(([label,...cells])=>`<tr><th scope="row">${esc(label)}</th>${cells.map(value=>`<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const winRate = record => record.games ? `${(record.wins / record.games * 100).toFixed(1)}%` : '—';
function members(){
  const weekly = memberStats(data.games.filter(game=>game.day>=week[0] && game.day<=week[1]));
  const monthly = memberStats(data.games.filter(game=>game.day.startsWith(currentMonth)));
  const all = memberStats(data.games);
  return `<section class="panel"><div class="row headrow"><h2>전체 회원</h2><span class="pill">${data.members.length}명</span></div>
  <p class="muted">이번 주 ${week.join(' ~ ')} · 이번 달 ${currentMonth}<br>승률은 1위 횟수 ÷ 참가 게임 수이며, 방문은 경기 기록이 있는 날짜를 기준으로 집계합니다.</p>
  ${statTable(['회원','주간 참가','주간 승률','주간 방문','월간 참가','월간 승률','월간 방문','마지막 방문'],data.members.map(name=>{
    const w=weekly.get(name), m=monthly.get(name);
    return [name,w.games,winRate(w),w.days.size,m.games,winRate(m),m.days.size,all.get(name).last || '—'];
  }))}</section>`;
}
function storeStats(){
  const counts = new Map([[statsMonth,0]]);
  for(const game of data.games){
    const period = game.day.slice(0,7);
    counts.set(period,(counts.get(period) ?? 0)+1);
  }
  const monthly = memberStats(data.games.filter(game=>game.day.startsWith(statsMonth)));
  return `<div class="grid"><section class="panel"><h2>월별 전체 게임</h2>
  ${statTable(['월','게임 횟수'],[...counts].sort(([a],[b])=>b.localeCompare(a)))}</section>
  <section class="panel"><h2>회원별 월간 통계</h2>
  <label class="field">집계 월<input type="month" id="stats-month" value="${statsMonth}"></label>
  <p class="muted">방문 일수는 같은 날 여러 게임에 참가해도 1일로 계산합니다.</p>
  ${statTable(['회원','게임 횟수','방문 일수'],[...monthly].sort(([,a],[,b])=>b.games-a.games).map(([name,record])=>[name,record.games,record.days.size]))}</section></div>`;
}
function render(){
  const menu = `<nav aria-label="화면 메뉴">${tabs.map(([id,label])=>`<button data-tab="${id}" ${id===tab?'aria-current="page"':''}>${label}</button>`).join('')}</nav>`;
  const brand = `<div class="brand"><i aria-hidden="true">♠</i><div>OCEANS PUB<small>${admin?'STORE MANAGEMENT':'HOLD’EM PUB'}</small></div></div>`;
  const heading = admin?{games:['게임 결과','회원과 순위를 입력하면 이번 주 점수가 자동으로 집계됩니다.'],types:['게임 종류','매장에서 운영하는 게임과 순위별 배점을 등록하세요.'],bingo:['월간 빙고','월별 미션과 프라이즈를 설정하고 회원의 달성을 기록하세요.'],stars:['회원 별 관리','매장 미션을 달성한 회원에게 별을 지급하세요.'],members:['회원 관리','회원별 참여와 방문 기록을 확인하세요.'],stats:['매장 통계','월별 경기와 회원별 활동을 확인하세요.']}:
    {ranking:['주간 랭킹','이번 주 오션스펍에서 획득한 점수를 확인하세요.'],bingo:['월간 빙고','미션을 달성하고 빙고 프라이즈에 도전하세요.'],stars:['회원 별 모으기','오션스펍에서 모은 별을 확인하세요.']};
  const switcher = admin ? '<a class="switch" href="guest.html">손님 화면 보기 ↗</a>' :
    `<button class="switch fullscreen" type="button" data-action="fullscreen" ${document.fullscreenEnabled?'':'hidden'}>${document.fullscreenElement?'전체 화면 종료':'전체 화면'}</button>`;
  const main = `<main class="${!admin && tab==='bingo'?'bingo-main':''}"><div class="hero"><div class="eyebrow">${admin?'오션스펍 매장 관리':'오션스펍'}</div><h1>${heading[tab][0]}</h1><p>${heading[tab][1]}</p></div>
  <p class="status" role="status">${esc(notice)}</p>
  ${({games,types,bingo,stars:starPage,ranking:leaderboard,members,stats:storeStats})[tab]()}</main>`;
  app.innerHTML = admin?`<div class="shell"><aside class="sidebar">${brand}${menu}${switcher}</aside>${main}</div>`:
    `<header class="guestbar"><div>${brand}${menu}${switcher}</div></header>${main}`;
  showScoring();
  if(tab==='games') refreshRanks();
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
  if(action==='fullscreen'){
    const toggle = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    toggle.catch(()=>{document.querySelector('.status').textContent='이 브라우저에서 전체 화면을 열 수 없습니다.';});
  }
  if(action==='add-row'){
    const results=document.querySelector('#results');
    const rank=Math.max(0,...Array.from(results.querySelectorAll('[name=rank]'),input=>Number(input.value)))+1;
    results.insertAdjacentHTML('beforeend',gameRow(rank));
    refreshRanks();
    results.lastElementChild.querySelector('[name=name]').focus();
  }
  if(action==='remove-row' && document.querySelectorAll('.result-row').length>1){
    button.closest('.result-row').remove();
    refreshRanks();
  }
  if(action==='add-point'){
    const rows=document.querySelector('#point-rows');
    rows.insertAdjacentHTML('beforeend',pointRow(rows.children.length+1));
    rows.lastElementChild.querySelector('input').focus();
  }
  if(action==='remove-point'){
    const rows=document.querySelector('#point-rows');
    if(rows.children.length>1) rows.lastElementChild.remove();
  }
  if(action==='undo'){
    board().done[mission]=board().done[mission].filter(name=>name!==button.dataset.name);
    save('달성 기록을 취소했습니다.');
  }

});
app.addEventListener('change',event=>{
  const input=event.target;
  if(input.name==='type') showScoring();
  if(input.name==='rank'){
    const results=document.querySelector('#results');
    const previous=input.dataset.rank;
    const other=[...results.querySelectorAll('[name=rank]')].find(select=>select.dataset.rank===input.value);
    if(other && other!==input){
      other.value=previous;
      const rows=[...results.children].sort((a,b)=>a.querySelector('[name=rank]').value-b.querySelector('[name=rank]').value);
      results.append(...rows);
      refreshRanks();
      input.focus();
      document.querySelector('.status').textContent=`${previous}위와 ${input.value}위의 순위를 바꿨습니다.`;
    }
  }
  if(input.name==='unscored'){
    const settings=document.querySelector('#point-settings');
    settings.hidden=input.checked;
    for(const control of settings.querySelectorAll('input,button')) control.disabled=input.checked;
  }
  if(input.id==='stats-month' && input.value){statsMonth=input.value;render();document.querySelector('#stats-month').focus();}

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
    const points=fields.getAll('points').map(Number);
    if(!name || data.types.some(type=>type.name===name)) return fail('등록된 이름과 다른 게임 이름을 입력하세요.');
    if(points.some(point=>!Number.isSafeInteger(point) || point<0)) return fail('점수는 0 이상의 정수로 입력하세요.');
    data.types.push({id:crypto.randomUUID(),name,points});
    save('게임 종류를 추가했습니다.');
  }
  if(form.dataset.form==='star-mission'){
    const name=fields.get('name').trim();
    const count=Number(fields.get('count'));
    if(!name || data.starMissions.some(item=>item.name===name)) return fail('등록된 미션과 다른 이름을 입력하세요.');
    if(!Number.isInteger(count) || count<1 || count>20) return fail('별은 1~20개 사이로 입력하세요.');
    data.starMissions.push({id:crypto.randomUUID(),name,count});
    save('별 지급 미션을 등록했습니다.');
  }
  if(form.dataset.form==='award'){
    const reward=data.starMissions.find(item=>item.id===fields.get('reward'));
    if(!reward) return fail('지급 미션을 선택하세요.');
    const balance=stars(member)+reward.count;
    if(balance>20) return fail(`현재 별 ${stars(member)}개입니다. 이 미션을 지급하면 20개를 초과합니다.`);
    data.stars={...data.stars,[member]:balance};
    data.starAwards.push({member,mission:reward.name,count:reward.count,day:date()});
    save(`${member} 회원에게 ${reward.name} 미션으로 별 ${reward.count}개를 지급했습니다.`);
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
document.addEventListener('fullscreenchange',()=>{
  const button=document.querySelector('[data-action=fullscreen]');
  if(button) button.textContent=document.fullscreenElement?'전체 화면 종료':'전체 화면';
});
window.addEventListener('storage',event=>{
  if(event.key!==key && event.key!==null) return;
  data=load();
  if(!data.members.includes(member)) member=data.members[0];
  if(!admin) render();
});
render();
