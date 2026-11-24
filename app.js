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
function prizeText({buyIn=0,ticket=0}){
  return [buyIn && `바인권 ${buyIn}개`,ticket && `오션스 티켓 ${ticket}개`].filter(Boolean).join(' · ');
}
function typePrizeText(type){
  return (type.prizes ?? []).map((prize,index)=>{
    const label=prizeText(prize);
    return label ? `${index+1}위 ${label}` : '';
  }).filter(Boolean).join(' / ');
}
function gameRecord(day,type,participants){
  const results = participants.map(({rank,name})=>({
    rank,name,points:type.points[rank-1] ?? 0,
    buyIn:type.prizes?.[rank-1]?.buyIn ?? 0,
    ticket:type.prizes?.[rank-1]?.ticket ?? 0
  }));
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
let memberRange = monthRange(currentMonth);
let statsMonth = currentMonth;
let statsDay = today;
let statsPeriod = 'month';
let starPageIndex = 0;
const prizeCost = 20;
let editingType = '';

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
  ${data.games.slice().reverse().map(game=>`<div class="record"><div><strong>${esc(game.type)}</strong><small class="muted">${game.results.map(result=>`${result.rank}위 ${esc(result.name)} (${result.points}점${prizeText(result)?' · '+prizeText(result):''})`).join(' · ')}</small></div><span class="pill">${esc(game.day)}</span></div>`).join('')}</section></div></div>`;
}
function pointRow(rank,type){
  const prize=type?.prizes?.[rank-1];
  return `<div class="prize-row"><span class="pill">${rank}위</span>
  <label class="field">점수<input name="points" type="number" min="0" step="1" inputmode="numeric" aria-label="${rank}위 점수" value="${type?.points[rank-1] ?? 0}" required></label>
  <label class="field">바인권<input name="buyIn" type="number" min="0" step="1" inputmode="numeric" aria-label="${rank}위 바인권" value="${prize?.buyIn ?? 0}" required></label>
  <label class="field">오션스 티켓<input name="ticket" type="number" min="0" step="1" inputmode="numeric" aria-label="${rank}위 오션스 티켓" value="${prize?.ticket ?? 0}" required></label></div>`;
}
function types(){
  const type=data.types.find(item=>item.id===editingType);
  const size=Math.max(2,type?.points.length ?? 0,type?.prizes?.length ?? 0);
  return `<div class="grid"><section class="panel"><h2>${type?'게임 종류 수정':'게임 종류 추가'}</h2><form class="stack" data-form="type">
    <label class="field">게임 이름<input name="name" placeholder="예: 주말 토너먼트" maxlength="30" value="${esc(type?.name)}" ${type?'readonly':''} required></label>
    <label class="row"><input type="checkbox" name="unscored" ${type && !type.points.length?'checked':''}> 랭킹 점수 없는 게임</label>
    <p class="muted">순위마다 바인권과 오션스 티켓 수량을 입력하세요. 새 설정은 앞으로 저장할 경기에 적용됩니다.</p>
    <div id="point-rows" class="stack">${Array.from({length:size},(_,index)=>pointRow(index+1,type)).join('')}</div>
    <div class="row"><button class="secondary" type="button" data-action="add-point">＋ 순위 추가</button><button class="secondary" type="button" data-action="remove-point">마지막 순위 삭제</button></div>
    <div class="row"><button class="primary">${type?'변경 저장':'게임 종류 추가'}</button>${type?'<button class="secondary" type="button" data-action="cancel-type">취소</button>':''}</div></form></section>
    <section class="panel"><h2>등록된 게임 종류</h2>${data.types.map(item=>`<div class="record"><div><strong>${esc(item.name)}</strong><small class="muted">${scoringText(item)}</small>
    <small class="muted">${typePrizeText(item) || '프라이즈 없음'}</small></div><button class="secondary" type="button" data-action="edit-type" data-id="${esc(item.id)}" aria-label="${esc(item.name)} 설정 수정">수정</button></div>`).join('')}</section></div>`;
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
function starRanking(){
  const levels = new Map();
  for(const name of data.members){
    const count = stars(name);
    if(count<1) continue;
    if(!levels.has(count)) levels.set(count,[]);
    levels.get(count).push(name);
  }
  const max = Math.max(0,...levels.keys());
  if(!max) return '<section class="panel"><h2>별 모으기 랭킹</h2><p>아직 별을 모은 회원이 없습니다.</p></section>';
  const pageSize = 100;
  starPageIndex = Math.min(starPageIndex,Math.floor((max-1)/pageSize));
  const top = max-starPageIndex*pageSize;
  const bottom = Math.max(1,top-pageSize+1);
  const rows = Array.from({length:top-bottom+1},(_,index)=>{
    const count = top-index;
    const members = levels.get(count) ?? [];
    return `<li><span class="pill gold">★ ${count}개</span><div class="star-members">
      ${members.sort((a,b)=>a.localeCompare(b,'ko')).map(name=>`<span>${esc(name)}</span>`).join('') || '<small class="muted">해당 회원 없음</small>'}</div></li>`;
  });
  return `<section class="panel"><h2>별 모으기 랭킹</h2>
  <ol class="star-ranking" style="--rank-rows:${Math.ceil(rows.length/2)}" reversed start="${top}">${rows.join('')}</ol>
  ${max>pageSize?`<div class="row rank-pagination"><button class="secondary" data-action="stars-prev" ${starPageIndex===0?'disabled':''}>높은 구간</button>
  <span>★ ${top}개 ~ ${bottom}개</span><button class="secondary" data-action="stars-next" ${bottom===1?'disabled':''}>낮은 구간</button></div>`:''}</section>`;
}
function starPage(){
  if(!admin) return starRanking();
  const count = stars(member);
  const available = data.starMissions.filter(item=>!item.archived);
  const balance = `<section class="panel"><div class="row headrow"><h2>회원 별 모으기</h2><span class="pill gold">★ ${count}개</span></div>
  <label class="field">회원<select id="member">${memberOptions()}</select></label>
  ${available.length?`<form class="stack star-form" data-form="award">
    <div class="row"><label class="field grow">지급 미션<select name="reward">${options(available.map(item=>[item.id,item.name]))}</select></label>
    <label class="field">지급할 별 개수<input name="count" type="number" min="1" step="1" value="1" required></label></div>
    <div><button class="primary">미션 별 지급</button></div></form>`:'<p class="muted">지급에 사용할 미션을 먼저 등록하세요.</p>'}
  <form class="row prize-form" data-form="redeem"><span class="grow muted">프라이즈를 지급한 뒤 별 ${prizeCost}개를 차감하세요.</span>
  <button class="secondary" ${count<prizeCost?'disabled':''}>프라이즈 지급 · 별 ${prizeCost}개 차감</button></form></section>`;
  return `<div class="grid"><div>${balance}<section class="panel"><h2>별 지급·차감 이력</h2>
  ${data.starAwards.slice().reverse().map(item=>`<div class="record"><div><strong>${esc(item.member)} · ${esc(item.mission)}</strong><small class="muted">${esc(item.day)}</small></div><span class="pill ${item.count<0?'deduction':'gold'}">★ ${item.count>0?'+':''}${item.count}</span></div>`).join('') || '<p class="muted">기록된 지급이나 차감이 없습니다.</p>'}</section></div>
  <section class="panel"><h2>별 미션 등록</h2><form class="stack" data-form="star-mission">
  <label class="field">미션 이름<input name="name" maxlength="40" required></label>
  <div><button class="primary">별 미션 등록</button></div></form>
  ${available.map(item=>`<div class="record"><strong>${esc(item.name)}</strong><button class="secondary" data-action="delete-star-mission" data-id="${esc(item.id)}" aria-label="${esc(item.name)} 미션 삭제">삭제</button></div>`).join('')}</section></div>`;
}
function memberStats(games){
  const records = new Map(data.members.map(name=>[name,{games:0,wins:0,finishTotal:0,paidGames:0,buyIn:0,ticket:0,days:new Set(),last:''}]));
  for(const game of games){
    for(const result of game.results){
      const stats = records.get(result.name);
      stats.games++;
      stats.finishTotal += result.rank / game.results.length;
      stats.buyIn += result.buyIn ?? 0;
      stats.ticket += result.ticket ?? 0;
      if(result.buyIn>0 || result.ticket>0) stats.paidGames++;
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
  const [start,end] = memberRange;
  const selected = memberStats(data.games.filter(game=>game.day>=start && game.day<=end));
  const all = memberStats(data.games);
  return `<section class="panel"><h2>회원 통계 조회</h2><form class="row" data-form="member-period">
  <button class="secondary" type="button" data-action="member-week">이번 주</button>
  <button class="secondary" type="button" data-action="member-month">이번 달</button>
  <label class="field">시작일<input type="date" name="start" value="${esc(start)}" required></label>
  <label class="field">종료일<input type="date" name="end" value="${esc(end)}" required></label>
  <button class="primary" type="submit">조회</button></form></section>
  <section class="panel"><div class="row headrow"><h2>전체 회원</h2><span class="pill">${esc(start)} ~ ${esc(end)} · ${data.members.length}명</span></div>
  <p class="muted">상위 비율은 경기별 순위 ÷ 기록된 참가자 수의 평균입니다. 숫자가 작을수록 성적이 높습니다.<br>승률은 1위 횟수 ÷ 참가 게임 수이며, 같은 날 여러 게임에 참가해도 방문은 1일로 집계합니다.<br>인머니는 프라이즈를 받은 경기 수 ÷ 전체 참가 경기 수입니다.</p>
  ${statTable(['회원','참가 횟수','승률','평균 상위 비율','바인권 획득','오션스 티켓 획득','인머니 비율','방문 일수','마지막 방문일 (전체 기간)'],data.members.map(name=>{
    const record=selected.get(name);
    const finish=record.games ? `상위 ${(record.finishTotal / record.games * 100).toFixed(1)}%` : '—';
    const itm=record.games ? `${(record.paidGames / record.games * 100).toFixed(1)}%` : '—';
    return [name,record.games,winRate(record),finish,record.buyIn,record.ticket,itm,record.days.size,all.get(name).last || '—'];
  }))}</section>`;
}
function monthRange(month){
  const [year,monthNumber]=month.split('-').map(Number);
  const lastDay=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
  return [month+'-01',month+'-'+lastDay];
}
function shiftDate(day,amount){
  const value = new Date(day+'T12:00:00+09:00');
  value.setUTCDate(value.getUTCDate()+amount);
  return date(value);
}
function statsRange(){
  if(statsPeriod==='day') return [statsDay,statsDay];
  if(statsPeriod==='week'){
    const weekday=new Date(statsDay+'T12:00:00+09:00').getUTCDay();
    const start=shiftDate(statsDay,-((weekday+6)%7));
    return [start,shiftDate(start,6)];
  }
  return monthRange(statsMonth);
}
function barChart(rows,unit){
  const max=Math.max(1,...rows.map(([,value])=>value));
  return `<ul class="bar-chart">${rows.map(([label,value])=>`<li><span>${esc(label)}</span>
  <span class="bar-track" aria-hidden="true"><span style="width:${value/max*100}%"></span></span>
  <strong>${value}${unit}</strong></li>`).join('')}</ul>`;
}
function storeStats(){
  const [start,end]=statsRange();
  const selected=data.games.filter(game=>game.day>=start && game.day<=end);
  const types=new Map(data.types.map(type=>[type.name,0]));
  const daily=new Map();
  const months=new Map();
  for(let day=start;day<=end;day=shiftDate(day,1)) daily.set(day,0);
  for(const game of selected){
    types.set(game.type,(types.get(game.type) ?? 0)+1);
    daily.set(game.day,daily.get(game.day)+1);
  }
  for(const game of data.games){
    const month=game.day.slice(0,7);
    months.set(month,(months.get(month) ?? 0)+1);
  }
  const records=[...memberStats(selected)].sort(([,a],[,b])=>b.games-a.games);
  const active=records.filter(([,record])=>record.games>0);
  return `<section class="panel"><div class="row headrow"><h2>조회 기간</h2><span class="pill">${start}${start===end?'':' ~ '+end}</span></div>
  <div class="row"><label class="field">집계 단위<select id="stats-period">${options([['month','월간'],['week','주간'],['day','일간']],statsPeriod)}</select></label>
  ${statsPeriod==='month'?`<label class="field">집계 월<input type="month" id="stats-month" min="1000-01" max="9998-12" value="${statsMonth}"></label>`:
  `<label class="field">${statsPeriod==='week'?'해당 주의 날짜':'조회 날짜'}<input type="date" id="stats-day" min="1000-01-01" max="9998-12-31" value="${statsDay}"></label>`}</div>
  <div class="stat-cards"><div>전체 게임<strong>${selected.length}회</strong></div><div>참가 회원<strong>${active.length}명</strong></div><div>게임 진행일<strong>${[...daily.values()].filter(Boolean).length}일</strong></div></div></section>
  <div class="grid stats-grid"><section class="panel"><h2>게임 종류별 횟수</h2>${barChart([...types].sort(([,a],[,b])=>b-a),'회')}</section>
  <section class="panel"><h2>날짜별 경기 추이</h2>${barChart([...daily].map(([day,count])=>[day.slice(5),count]),'회')}</section>
  <section class="panel"><h2>회원별 게임 참가</h2>${active.length?barChart(active.map(([name,record])=>[name,record.games]),'회'):'<p class="muted">이 기간에 참가 회원이 없습니다.</p>'}</section>
  <section class="panel"><h2>회원별 방문 일수</h2>${active.length?barChart(active.map(([name,record])=>[name,record.days.size]).sort(([,a],[,b])=>b-a),'일'):'<p class="muted">이 기간에 방문 기록이 없습니다.</p>'}</section></div>
  <section class="panel"><h2>회원별 상세 통계</h2>${statTable(['회원','게임 횟수','승률','방문 일수'],records.map(([name,record])=>[name,record.games,winRate(record),record.days.size]))}</section>
  <details class="panel"><summary>월별 전체 게임 기록</summary>${statTable(['월','게임 횟수'],[...months].sort(([a],[b])=>b.localeCompare(a)))}</details>`;
}
function render(){
  const menu = `<nav aria-label="화면 메뉴">${tabs.map(([id,label])=>`<button data-tab="${id}" ${id===tab?'aria-current="page"':''}>${label}</button>`).join('')}</nav>`;
  const brand = `<div class="brand"><i aria-hidden="true">♠</i><div>OCEANS PUB<small>${admin?'STORE MANAGEMENT':'HOLD’EM PUB'}</small></div></div>`;
  const heading = admin?{games:['게임 결과','회원과 순위를 입력하면 이번 주 점수가 자동으로 집계됩니다.'],types:['게임 종류','매장에서 운영하는 게임과 순위별 배점을 등록하세요.'],bingo:['월간 빙고','월별 미션과 프라이즈를 설정하고 회원의 달성을 기록하세요.'],stars:['회원 별 관리','매장 미션을 달성한 회원에게 별을 지급하세요.'],members:['회원 관리','회원별 참여와 방문 기록을 확인하세요.'],stats:['매장 통계','기간별 경기와 회원별 활동을 확인하세요.']}:
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
  if(tab==='types') syncPointFields();
}
function showScoring(){
  const element = document.querySelector('#scoring');
  if(!element) return;
  const id = document.querySelector('select[name=type]').value;
  const type=data.types.find(type=>type.id===id);
  element.textContent = [scoringText(type),typePrizeText(type)].filter(Boolean).join(' | ');
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
  if(action==='member-week' || action==='member-month'){
    memberRange=action==='member-week' ? week : monthRange(currentMonth);
    notice='';
    render();
    document.querySelector(`[data-action="${action}"]`).focus();
  }
  if(action==='stars-prev' || action==='stars-next'){
    starPageIndex += action==='stars-prev'?-1:1;
    render();
  }
  if(action==='delete-star-mission'){
    const missionToDelete=data.starMissions.find(item=>item.id===button.dataset.id);
    missionToDelete.archived=true;
    save('별 미션을 삭제했습니다. 기존 지급 이력은 유지됩니다.');
  }
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
  if(action==='edit-type' || action==='cancel-type'){
    editingType=action==='edit-type' ? button.dataset.id : '';
    notice='';
    render();
    document.querySelector('[data-form=type] input:not([readonly])').focus();
  }
  if(action==='add-point'){
    const rows=document.querySelector('#point-rows');
    rows.insertAdjacentHTML('beforeend',pointRow(rows.children.length+1));
    syncPointFields();
    rows.lastElementChild.querySelector('input:not(:disabled)').focus();
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
  if(input.name==='unscored') syncPointFields();
  if(input.id==='stats-period' || (['stats-month','stats-day'].includes(input.id) && input.value && input.validity.valid)){
    if(input.id==='stats-period') statsPeriod=input.value;
    if(input.id==='stats-month') statsMonth=input.value;
    if(input.id==='stats-day') statsDay=input.value;
    render();
    document.getElementById(input.id).focus();
  }

  if(input.id==='month' && input.value){month=input.value;mission=0;notice='';render();}
  if(input.id==='mission'){mission=Number(input.value);notice='';render();}
  if(input.id==='member'){member=input.value;notice='';render();}
});
function syncPointFields(){
  const form=document.querySelector('[data-form=type]');
  for(const input of form.querySelectorAll('[name=points]')) input.disabled=form.elements.unscored.checked;
}
function recordStarChange(missionName,count,message){
  data.stars={...data.stars,[member]:stars(member)+count};
  data.starAwards.push({member,mission:missionName,count,day:date()});
  save(message);
}
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
    const type=data.types.find(item=>item.id===editingType);
    const name=fields.get('name').trim();
    const points=fields.getAll('points').map(Number);
    const tickets=fields.getAll('ticket').map(Number);
    const prizes=fields.getAll('buyIn').map((value,index)=>({buyIn:Number(value),ticket:tickets[index]}));
    if(!name || data.types.some(item=>item!==type && item.name===name)) return fail('등록된 이름과 다른 게임 이름을 입력하세요.');
    const amounts=[...points,...prizes.flatMap(item=>[item.buyIn,item.ticket])];
    if(amounts.some(value=>!Number.isSafeInteger(value) || value<0)) return fail('점수와 프라이즈 수량은 0 이상의 정수로 입력하세요.');
    while(points.length && points.at(-1)===0) points.pop();
    while(prizes.length && !prizeText(prizes.at(-1))) prizes.pop();
    if(type) Object.assign(type,{points,prizes});
    else data.types.push({id:crypto.randomUUID(),name,points,prizes});
    editingType='';
    save(type?'게임 설정을 저장했습니다.':'게임 종류를 추가했습니다.');
  }
  if(form.dataset.form==='member-period'){
    const start=fields.get('start');
    const end=fields.get('end');
    if(start>end) return fail('종료일은 시작일과 같거나 그 이후여야 합니다.');
    memberRange=[start,end];
    notice='';
    render();
    document.querySelector('[data-form=member-period] button[type=submit]').focus();
  }
  if(form.dataset.form==='star-mission'){
    const name=fields.get('name').trim();
    if(!name || data.starMissions.some(item=>!item.archived && item.name===name)) return fail('등록된 미션과 다른 이름을 입력하세요.');
    data.starMissions.push({id:crypto.randomUUID(),name});
    save('별 지급 미션을 등록했습니다.');
  }
  if(form.dataset.form==='award'){
    const reward=data.starMissions.find(item=>!item.archived && item.id===fields.get('reward'));
    if(!reward) return fail('지급 미션을 선택하세요.');
    const count=Number(fields.get('count'));
    if(!Number.isSafeInteger(count) || count<1 || !Number.isSafeInteger(stars(member)+count)) return fail('별 개수는 계산 가능한 양의 정수로 입력하세요.');
    recordStarChange(reward.name,count,`${member} 회원에게 ${reward.name} 미션으로 별 ${count}개를 지급했습니다.`);
  }
  if(form.dataset.form==='redeem'){
    if(stars(member)<prizeCost) return fail(`별이 ${prizeCost}개 이상 있어야 차감할 수 있습니다.`);
    recordStarChange('프라이즈 지급',-prizeCost,`${member} 회원의 별 ${prizeCost}개를 차감했습니다.`);
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
