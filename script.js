const tg = window.Telegram?.WebApp || {initDataUnsafe:{},close:()=>{},MainButton:{setText:()=>{},show:()=>{},onClick:()=>{}}};
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const nextButton=$('#nextButton'), submitVotes=$('#submitVotes'), clickSound=$('#clickSound'), transitionSound=$('#transitionSound');
const backgroundMusic=$('#backgroundMusic'), musicControl=$('#musicControl');
const musicControlButton=$('#musicControlButton'), musicControlMenu=$('#musicControlMenu'), selectedNominees={};
const nominationOrder=['Самый Ходящий','Главный прогульщик','Флешбэк года','Заводчанин года','Прилежный студент','Машина года','Король Группы'];
const TOTAL_NOMS = nominationOrder.length; // 7
const VIDEO_SETTINGS = {
intro: 'videos/intro.mp4',
transitionAfter: {
'Самый Ходящий': 'videos/2.mp4',
'Главный прогульщик': 'videos/2.mp4',
'Флешбэк года': 'videos/2.mp4',
'Заводчанин года': 'videos/2.mp4',
'Прилежный студент': 'videos/2.mp4',
'Машина года': 'videos/2.mp4',
'Король Группы': 'videos/2.mp4'
},
outro: 'videos/2.mp4',
loaderMusic: { default: 'audio/loader.mp3', byIndex: {}, volume: 0.9, startAt: 0 },
loaderMs: 4800,   // длительность загрузки, мс
candidates: {
// Общее видео (если нет data-video и нет ключа с |номинацией)
'Кирилл': 'videos/candidates/kirill.mp4',
// Пример разного видео для одной персоны в разных номинациях:
// 'Кирилл|Ходящий': 'videos/candidates/kirill-hodyashiy.mp4',
// 'Кирилл|Воздухан': 'videos/candidates/kirill-vozduhan.mp4',
// 'Ролдугин|Прогульщик': 'videos/candidates/roldugin-skip.mp4',
// 'Ролдугин|Спокойный': 'videos/candidates/roldugin-calm.mp4',
}
};
function resolveCandidateVideo(nomineeEl){
if(!nomineeEl) return '';
const fromAttr = (nomineeEl.dataset.video || '').trim();
if(fromAttr) return fromAttr;
const name = (nomineeEl.dataset.nominee || '').trim();
const row  = (nomineeEl.dataset.row || '').trim();
const map  = VIDEO_SETTINGS.candidates || {};
if(name && row && map[name + '|' + row]) return map[name + '|' + row];
if(name && map[name]) return map[name];
return '';
}
const menuButton=$('.menu-button'), menu=$('.menu'), infoPanel=$('.info-panel'), infoText=$('#info-text'), closeInfo=$('.close-info'), thankYou=$('#thankYou');
const frames=$$('.nomination-frame');
let currentNominationIndex=0, transitionBusy=false;
function playSound(sound){if(sound && sound.querySelector('source')?.getAttribute('src')){sound.currentTime=0;sound.play().catch(()=>{});}}
function switchTab(id){$$('.tab').forEach(t=>t.classList.remove('active'));$('#'+id)?.classList.add('active');}
function changeMusic(src){if(src){backgroundMusic.src=src;backgroundMusic.play().catch(()=>{});}else{backgroundMusic.pause();backgroundMusic.removeAttribute('src');}if(musicControlMenu)musicControlMenu.style.display='none';}
function showNomination(index){currentNominationIndex=index;frames.forEach((f,i)=>{f.classList.toggle('current',i===index);f.classList.toggle('completed',i<index);});const counter=$('#currentStep'),fill=$('#progressFill'),hint=$('#votingHint');if(counter)counter.textContent=String(Math.min(index+1,TOTAL_NOMS)).padStart(2,'0');if(fill)fill.style.width=`${Math.min((index+1)/TOTAL_NOMS*100,100)}%`;if(hint)hint.textContent=`Номинация ${String(index+1).padStart(2,'0')} из ${String(TOTAL_NOMS).padStart(2,'0')} · Открой кандидата, изучи историю и выбери одного.`;const tab=$('#tab3');if(tab)tab.scrollTo({top:0,behavior:'instant'});window.scrollTo({top:0,behavior:'instant'});if(typeof onNominationShown==='function')onNominationShown(index);}
let videoDone = null, videoFallbackTimer = null, scLeadTimer = null, scMeta = {};
const scFmt = t => (isFinite(t) && t > 0) ? String((t / 60) | 0).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0') : '00:00';
function ensureVideoOverlay(){
let overlay = $('#videoInterstitial'); if(overlay) return overlay;
overlay = document.createElement('div');
overlay.id = 'videoInterstitial'; overlay.className = 'sc'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
const ticks = Array.from({length: TOTAL_NOMS}, () => '<i></i>').join('');
overlay.innerHTML = `
<div class="sc-beam" aria-hidden="true"></div>
<div class="sc-deco" id="scDeco" aria-hidden="true"></div>
<div class="sc-wrap">
<header class="sc-top">
<span class="sc-brand">Премия <b>2027</b><i>спецпоказ</i></span>
<button type="button" id="skipVideo" class="sc-skip">Пропустить <span>→</span></button>
</header>
<div class="sc-prog" aria-hidden="true">${ticks}</div>
<div class="sc-head">
<span class="sc-kick" id="scKick">Сеанс</span>
<h2 class="sc-title" id="videoCaption"></h2>
<p class="sc-sub" id="scSub"></p>
</div>
<div class="sc-screen">
<i class="sc-perf l"></i><i class="sc-perf r"></i>
<div class="sc-frame" id="scFrame">
<video id="interstitialVideo" playsinline webkit-playsinline preload="auto"></video>
<div class="sc-loading" id="videoLoading">
<div class="sc-leader"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="30"/><path d="M50 2v96M2 50h96"/></svg><i class="sweep"></i><b id="scNum">3</b></div>
<span id="scLoadTxt">Подготавливаем показ…</span>
</div>
<button type="button" class="sc-play" id="scPlay" aria-label="Пауза / продолжить"><span></span></button>
<i class="sc-cur l"></i><i class="sc-cur r"></i>
<i class="sc-c tl"></i><i class="sc-c tr"></i><i class="sc-c bl"></i><i class="sc-c br"></i>
</div>
</div>
<div class="sc-ctl">
<time id="scTime">00:00 / 00:00</time>
<div class="sc-bar"><i id="scBarFill"></i></div>
<button type="button" id="videoSound" class="sc-sound">Звук</button>
</div>
<div class="sc-foot"><span class="sc-status"><i></i><em id="videoStatus">Подготовка…</em></span><span class="sc-stub" id="scStub" hidden></span></div>
<p class="sc-note" id="videoNote"></p>
</div>`;
document.body.appendChild(overlay);
const v = $('#interstitialVideo', overlay), fill = $('#scBarFill', overlay), tm = $('#scTime', overlay);
$('#skipVideo', overlay).addEventListener('click', finishVideo);
const sound = $('#videoSound', overlay);
const syncSound = () => { sound.textContent = v.muted ? 'Включить звук' : 'Звук включён'; sound.classList.toggle('on', !v.muted); };
sound.addEventListener('click', () => { v.muted = !v.muted; v.volume = 1; syncSound(); if(v.paused) v.play().catch(() => {}); });
const toggle = () => { if(!v.currentSrc && !v.getAttribute('src')) return; v.paused ? v.play().catch(() => {}) : v.pause(); };
$('#scPlay', overlay).addEventListener('click', e => { e.stopPropagation(); toggle(); });
$('#scFrame', overlay).addEventListener('click', toggle);
v.addEventListener('play', () => overlay.classList.remove('paused'));
v.addEventListener('pause', () => { if(!v.ended) overlay.classList.add('paused'); });
v.addEventListener('timeupdate', () => { const d = v.duration || 0; fill.style.width = d ? (v.currentTime / d * 100) + '%' : '0'; tm.textContent = scFmt(v.currentTime) + ' / ' + scFmt(d); });
v.addEventListener('loadedmetadata', () => { tm.textContent = '00:00 / ' + scFmt(v.duration); });
v.addEventListener('volumechange', syncSound);
document.addEventListener('keydown', e => { if(e.key === 'Escape' && overlay.classList.contains('visible')) finishVideo(); });
return overlay;
}
function finishVideo(){
const overlay = $('#videoInterstitial'), video = $('#interstitialVideo');
if(!overlay?.classList.contains('visible')) return;
if(videoFallbackTimer){ clearTimeout(videoFallbackTimer); videoFallbackTimer = null; }
if(scLeadTimer){ clearInterval(scLeadTimer); scLeadTimer = null; }
if(video){ video.pause(); video.onended = null; video.onerror = null; video.onplaying = null; video.removeAttribute('src'); try{ video.load(); }catch(_){} }
overlay.classList.add('leaving');
setTimeout(() => { overlay.classList.remove('visible', 'leaving', 'paused'); overlay.style.display = 'none'; }, 220);
const done = videoDone; videoDone = null; if(done) done();
}
function playInterstitial(src, caption, done, meta){
meta = meta || {}; scMeta = meta;
const overlay = ensureVideoOverlay(), video = $('#interstitialVideo');
videoDone = done;
const pad = v => String(v).padStart(2, '0'), kind = meta.kind || 'next';
const setLoad = (txt, show = true) => { $('#scLoadTxt').textContent = txt; $('#videoLoading').classList.toggle('hidden', !show); };
$('#videoCaption').textContent = meta.title || caption;
$('#scKick').textContent = kind === 'intro' ? 'Открытие церемонии' : kind === 'outro' ? 'Финал' : 'Сеанс ' + pad(meta.index + 1) + ' из ' + pad(TOTAL_NOMS);
$('#scSub').textContent = meta.sub || (kind === 'next' ? 'Следующая номинация' : '');
if(typeof scApplyTheme === 'function') scApplyTheme(overlay, meta, kind);
$$('.sc-prog i', overlay).forEach((t, i) => { t.className = kind === 'outro' ? 'done' : kind === 'next' ? (i < meta.index ? 'done' : i === meta.index ? 'now' : '') : ''; });
const stub = $('#scStub'); if(meta.choice){ stub.hidden = false; stub.innerHTML = '<small>твой выбор</small><b></b>'; $('b', stub).textContent = meta.choice; } else stub.hidden = true;
$('#videoStatus').textContent = 'Загрузка ролика…';
$('#videoNote').textContent = 'Показ начнётся сам. Нажми на экран — пауза, «Пропустить» — сразу дальше.';
$('#scBarFill').style.width = '0'; $('#scTime').textContent = '00:00 / 00:00';
overlay.classList.remove('paused', 'leaving'); overlay.classList.remove('visible'); void overlay.offsetWidth;
setLoad('Подготавливаем показ…');
overlay.style.display = 'flex'; overlay.classList.add('visible');
if(scLeadTimer) clearInterval(scLeadTimer);
let n = 3; $('#scNum').textContent = n;
scLeadTimer = setInterval(() => { n = n === 1 ? 3 : n - 1; $('#scNum').textContent = n; }, 800);
const stopLead = () => { if(scLeadTimer){ clearInterval(scLeadTimer); scLeadTimer = null; } };
video.onended = finishVideo;
video.onerror = () => {
stopLead(); setLoad('Видео не найдено — продолжаем'); $('#videoStatus').textContent = 'Ролик отсутствует или путь указан неверно'; $('#videoNote').textContent = 'Автоматически открываем следующий экран.';
if(videoFallbackTimer) clearTimeout(videoFallbackTimer);
videoFallbackTimer = setTimeout(() => { if(overlay.classList.contains('visible')) finishVideo(); }, 350);
};
video.pause(); video.removeAttribute('src'); video.load();
if(!src){
stopLead(); setLoad('Видео пока не добавлено — продолжаем'); $('#videoStatus').textContent = 'Ролик не указан'; $('#videoNote').textContent = 'Следующий экран откроется автоматически.';
videoFallbackTimer = setTimeout(() => { if(overlay.classList.contains('visible')) finishVideo(); }, 700); return;
}
video.src = src; video.playsInline = true; video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', ''); video.muted = false; video.volume = 1; video.load();
const ok = txt => { stopLead(); setLoad('', false); $('#videoStatus').textContent = txt; };
const attempt = video.play();
if(attempt && attempt.then) attempt.then(() => ok('Идёт показ')).catch(() => {
video.muted = true;
video.play().then(() => { ok('Идёт показ без звука'); $('#videoNote').textContent = 'Браузер разрешил автозапуск только без звука — нажми «Включить звук».'; })
.catch(() => { stopLead(); setLoad('Нажми ▶, чтобы запустить'); $('#videoStatus').textContent = 'Ожидает запуска'; $('#videoNote').textContent = 'Автозапуск заблокирован браузером — нажми ▶ на экране.'; overlay.classList.add('paused'); });
});
video.onplaying = () => { stopLead(); setLoad('', false); };
}
function startVoting(){if(typeof alreadyVoted==='function'&&alreadyVoted()){switchTab('tab5');if(thankYou){thankYou.textContent='Ты уже проголосовал. Спасибо!';thankYou.style.display='block';}return;}switchTab('tab3');if(musicControl)musicControl.style.display='block';{const p=typeof loadProgress==='function'?loadProgress():null;if(p){restoreProgress(p);return;}}playInterstitial(VIDEO_SETTINGS.intro,'Добро пожаловать на премию',()=>{transitionBusy=true;try{playNominationLoader(0,()=>{transitionBusy=false;showNomination(0);},'Первая номинация');}catch(e){transitionBusy=false;showNomination(0);}},{kind:'intro',title:'Добро пожаловать на премию',sub:(['','','','Три','Четыре','Пять','Шесть','Семь','Восемь'][TOTAL_NOMS]||TOTAL_NOMS)+' номинаций. Один голос в каждой.'});}
if(menuButton)menuButton.addEventListener('click',()=>{menu.style.display=menu.style.display==='block'?'none':'block';});
$$('.menu-item').forEach(item=>item.addEventListener('click',()=>{infoText.textContent=item.dataset.info==='about'?'Разработчик — Литнарович. Ведущие — Литнарович и Лукин!':'Выбери одного номинанта в каждой категории. После последнего выбора отправь свой голос.';infoPanel.style.display='flex';menu.style.display='none';}));
if(closeInfo)closeInfo.addEventListener('click',()=>infoPanel.style.display='none');
if(nextButton)nextButton.addEventListener('click',()=>{playSound(clickSound);startVoting();});
if(musicControlButton)musicControlButton.addEventListener('click',()=>{musicControlMenu.style.display=musicControlMenu.style.display==='block'?'none':'block';});
$$('.music-control-menu .track-option').forEach(option=>option.addEventListener('click',()=>changeMusic(option.dataset.track)));
function voteFor(nominee){
if(transitionBusy || nominee.classList.contains('selected')) return;
const row = (nominee.dataset.row || '').trim();
const nomineeName = nominee.dataset.nominee || '';
selectedNominees[row] = nomineeName; window._sfName = nomineeName;
try{ saveProgress(); }catch(_){}
nominee.classList.add('selected');
nominee.classList.remove('flipped');
$$('.nominee', nominee.closest('.nomination-frame')).forEach(n => {
if(n !== nominee){
n.style.pointerEvents = 'none';
n.style.opacity = '.38';
}
});
// Ориентируемся на активный экран, а не на текст data-row:
// так несовпадение регистра или пробелов не пропустит видео.
const nextIndex = currentNominationIndex + 1;
transitionBusy = true;
const continueToNext = () => {
if(nextIndex < frames.length){
try{ playNominationLoader(nextIndex, () => { transitionBusy = false; showNomination(nextIndex); }); }
catch(err){ console.error('loader', err); transitionBusy = false; showNomination(nextIndex); }
} else { transitionBusy = false; showCompletion(); }
};
// После последней номинации показываем финальный ролик.
if(nextIndex >= frames.length){
sendThenPlay(VIDEO_SETTINGS.outro, 'Спасибо за участие', continueToNext, {kind:'outro', title:'Спасибо за участие', sub:'Все номинации пройдены. Твой голос засчитан.', choice: nomineeName});
return;
}
const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ');
const currentTitle = nominationOrder[currentNominationIndex] || row;
const transitionEntry = Object.entries(VIDEO_SETTINGS.transitionAfter).find(([key]) =>
normalize(key) === normalize(row) || normalize(key) === normalize(currentTitle)
);
// Резервный путь гарантирует показ ролика после каждой промежуточной номинации.
const transitionSrc = transitionEntry?.[1] || 'videos/2.mp4';
sendThenPlay(transitionSrc, `Следующая номинация · ${nominationOrder[nextIndex] || ''}`, continueToNext, {kind:'next', index:nextIndex, title:nominationOrder[nextIndex] || '', sub:'Следующая номинация', choice: nomineeName});
}
let activeCandidate=null;
const candidateModal=$('#candidateModal'), candidateVideo=$('#candidateVideo');
function scGear(n, r1, r2){ let d = ''; const st = Math.PI * 2 / n; for(let i = 0; i < n; i++){ const a = i * st, f = (r, k) => [(50 + r * Math.cos(a + st * k)).toFixed(1), (50 + r * Math.sin(a + st * k)).toFixed(1)]; d += (i ? 'L' : 'M') + f(r1, 0) + 'L' + f(r2, .12) + 'L' + f(r2, .38) + 'L' + f(r1, .5); } return d + 'Z'; }
const SC_THEMES = {
1: { key: 'wanted', kick: 'Дело № 0204 · розыск', sub: 'Кого сегодня снова нет на парах?',
deco: `<i class="w-scrap a"></i><i class="w-scrap b"></i><i class="w-scrap c"></i><div class="w-stamp"><b>РОЗЫСК</b><small>не найден на паре</small></div>` },
2: { key: 'flash', kick: '▶ PLAY · кассета № 03', sub: 'Перематываем назад — на старую видеокассету',
deco: `<i class="f-scan"></i><i class="f-trk"></i><div class="f-osd"><b>▶ PLAY</b><span>SP · 0:00:03</span></div><div class="f-date">ОКТ. 2026</div>` },
3: { key: 'zavod', kick: 'Пересменка · смена № 3', sub: 'Каски надеть. Проходная открыта.',
deco: `<i class="z-haz t"></i><i class="z-haz b"></i><svg class="z-gear a" viewBox="0 0 100 100"><path d="${scGear(14, 48, 38)}"/><circle cx="50" cy="50" r="14"/></svg><svg class="z-gear b" viewBox="0 0 100 100"><path d="${scGear(10, 48, 38)}"/><circle cx="50" cy="50" r="14"/></svg>${Array.from({ length: 9 }, (_, k) => `<i class="z-sp" style="left:${8 + k * 10}%;--d:${1.4 + (k % 4) * .5}s;--w:${-(k * .37).toFixed(2)}s"></i>`).join('')}<i class="z-belt"></i>` },
4: { key: 'student', kick: 'Тетрадь № 4 · чистый лист', sub: 'Откроем тетради. Ручки наготове.',
deco: `<i class="s-margin"></i><i class="s-ring"></i><svg class="s-doodle" viewBox="0 0 120 40"><path d="M4 30c20-26 34 12 56-8s36-10 56-6" /></svg><i class="s-star a">★</i><i class="s-star b">★</i>` },
5: { key: 'garage', kick: 'Заезд № 5 · гараж', sub: 'Заводим двигатель. Пристегнись.',
deco: `<i class="g-road"></i><i class="g-beam l"></i><i class="g-beam r"></i><svg class="g-gauge" viewBox="0 0 120 80"><path class="arc" d="M12 70A48 48 0 0 1 108 70"/><path class="red" d="M84 30A48 48 0 0 1 108 70"/>${Array.from({ length: 9 }, (_, k) => { const a = Math.PI + k * Math.PI / 8; return `<line x1="${(60 + 40 * Math.cos(a)).toFixed(1)}" y1="${(70 + 40 * Math.sin(a)).toFixed(1)}" x2="${(60 + 47 * Math.cos(a)).toFixed(1)}" y2="${(70 + 47 * Math.sin(a)).toFixed(1)}"/>`; }).join('')}<g class="needle"><path d="M60 70L24 70" /><circle cx="60" cy="70" r="4"/></g></svg>` },
6: { key: 'king', kick: 'Тронный зал · финал', sub: 'Рыцари поднимаются к трону. Корону носит один.',
deco: `<i class="k-rays"></i><i class="k-flag l"></i><i class="k-flag r"></i><svg class="k-crown" viewBox="0 0 120 84"><defs><linearGradient id="kcG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b8"/><stop offset=".5" stop-color="#e4b647"/><stop offset="1" stop-color="#8f6416"/></linearGradient></defs><path d="M10 70 4 22l26 20L60 6l30 36 26-20-6 48z" fill="url(#kcG)" stroke="#5b3f0d" stroke-width="2"/><rect x="10" y="68" width="100" height="12" rx="3" fill="url(#kcG)" stroke="#5b3f0d" stroke-width="2"/><circle cx="60" cy="52" r="6" fill="#e0314b"/></svg>${Array.from({ length: 12 }, (_, k) => `<i class="k-em" style="left:${(k * 83 + 11) % 100}%;--d:${5 + (k * 3) % 5}s;--w:${-(k * 1.1).toFixed(1)}s"></i>`).join('')}` }
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
function scLaurel(side){
// ветвь лавра по дуге радиуса 60: от низа (φ=22°) вверх до φ=150°; листья веером по обе стороны от дуги
let out = ''; const n = 10, R = 60;
for(let i = 0; i < n; i++){
const t = i / (n - 1), f = (22 + t * 128) * Math.PI / 180;
const x = 100 + side * R * Math.sin(f), y = 100 + R * Math.cos(f);
const al = Math.atan2(side * Math.cos(f), Math.sin(f)) * 180 / Math.PI;
const len = 13 - t * 4, w = 4.6 - t * 1.2;
const leaf = (rot, op) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)})" opacity="${op}"><path d="M0 0C${w} ${-len * .3} ${w} ${-len * .75} 0 ${-len}C${-w} ${-len * .75} ${-w} ${-len * .3} 0 0Z" fill="url(#gdG)"/><path d="M0 -1V${(-len + 2).toFixed(1)}" stroke="#4a3610" stroke-width=".45" opacity=".55"/></g>`;
out += leaf(al + side * 38, 1) + leaf(al - side * 38, .8);
}
out += `<path d="M${(100 + side * R * Math.sin(22 * Math.PI / 180)).toFixed(1)} ${(100 + R * Math.cos(22 * Math.PI / 180)).toFixed(1)}A${R} ${R} 0 0 ${side > 0 ? 0 : 1} ${(100 + side * R * Math.sin(150 * Math.PI / 180)).toFixed(1)} ${(100 + R * Math.cos(150 * Math.PI / 180)).toFixed(1)}" fill="none" stroke="url(#gdG)" stroke-width="1.1"/>`;
return out;
}
function scGalaMedal(){
return `<div class="g-medal" aria-hidden="true">
<svg viewBox="0 0 200 200">
<defs>
<linearGradient id="gdG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#e2b95a"/><stop offset="1" stop-color="#8a6a22"/></linearGradient>
<radialGradient id="gdD" cx=".5" cy=".38" r=".7"><stop offset="0" stop-color="#2b2214"/><stop offset="1" stop-color="#0a0806"/></radialGradient>
<path id="gdRing" d="M100 100m-79 0a79 79 0 1 1 158 0a79 79 0 1 1-158 0"/>
</defs>
<circle cx="100" cy="100" r="97" fill="none" stroke="url(#gdG)" stroke-width="1.4"/>
<circle cx="100" cy="100" r="93" fill="none" stroke="#8a6a22" stroke-width=".5" stroke-dasharray="1.2 3.4" class="g-dots"/>
<g class="g-spin"><text font-size="10.5" fill="url(#gdG)" font-family="'Cormorant SC','Playfair Display SC',Georgia,serif" font-weight="700"><textPath href="#gdRing" startOffset="0" textLength="486" lengthAdjust="spacing">ПРЕМИЯ ✦ ГОЛОСОВАНИЕ ✦ ПРЕМИЯ ✦ ГОЛОСОВАНИЕ ✦</textPath></text></g>
<circle cx="100" cy="100" r="68" fill="none" stroke="url(#gdG)" stroke-width=".8" opacity=".8"/>
${scLaurel(1)}${scLaurel(-1)}
<circle cx="100" cy="100" r="45" fill="url(#gdD)" stroke="url(#gdG)" stroke-width="2"/>
<circle cx="100" cy="100" r="40" fill="none" stroke="#8a6a22" stroke-width=".6"/>
<path d="M100 66l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="url(#gdG)" transform="translate(0 -2) scale(1)"/>
<text x="100" y="112" text-anchor="middle" font-size="27" font-weight="900" fill="url(#gdG)" font-family="'Playfair Display SC','Playfair Display',Georgia,serif" letter-spacing="1">2027</text>
<path d="M78 119h44" stroke="url(#gdG)" stroke-width=".8"/>
<text x="100" y="130" text-anchor="middle" font-size="7.4" letter-spacing="3" fill="#d9bd78" font-family="'Cormorant SC',Georgia,serif" font-weight="700">ГРУППА</text>
</svg><i class="g-sheen"></i></div>`;
}
function scGalaProgram(){
const names = (typeof nominationOrder !== 'undefined' ? nominationOrder : []);
return `<section class="g-program" aria-label="Программа вечера">
<h3><i></i><span>Программа вечера</span><i></i></h3>
<ol>${names.map((n, i) => `<li style="--i:${i}"><b>${ROMAN[i] || i + 1}</b><span>${n}</span></li>`).join('')}</ol>
</section>`;
}
const SC_GALA = { key: 'gala', kick: 'Открытие церемонии', sub: '',
deco: `<i class="g-rays"></i><i class="g-vig"></i><i class="g-spot l"></i><i class="g-spot r"></i>
<svg class="g-corner gc-tl" viewBox="0 0 80 80"><path d="M2 78V2h76M10 70V10h60M18 62V18h44"/><path class="d" d="M2 2l12 12"/></svg>
<svg class="g-corner gc-tr" viewBox="0 0 80 80"><path d="M2 78V2h76M10 70V10h60M18 62V18h44"/><path class="d" d="M2 2l12 12"/></svg>
<svg class="g-corner gc-bl" viewBox="0 0 80 80"><path d="M2 78V2h76M10 70V10h60M18 62V18h44"/><path class="d" d="M2 2l12 12"/></svg>
<svg class="g-corner gc-br" viewBox="0 0 80 80"><path d="M2 78V2h76M10 70V10h60M18 62V18h44"/><path class="d" d="M2 2l12 12"/></svg>
<div class="g-dust">${Array.from({ length: 18 }, (_, k) => `<b style="--x:${(k * 53 % 100)}%;--d:${(k * 0.7 % 6).toFixed(1)}s;--t:${(7 + k % 5 * 1.6).toFixed(1)}s;--s:${(2 + k % 3)}px"></b>`).join('')}</div>` };
function scPremiereProgram(kind){
const names = (typeof nominationOrder !== 'undefined' ? nominationOrder : []);
return `<section class="pr-prog" aria-label="Программа вечера">
<header><span>${kind === 'outro' ? 'Пройдено' : 'Программа вечера'}</span><span>${String(names.length).padStart(2, '0')}</span></header>
<ol>${names.map((n, i) => `<li style="--i:${i}"><b>${String(i + 1).padStart(2, '0')}</b><span>${n}</span><em>${kind === 'outro' ? '✓' : ROMAN[i] || ''}</em></li>`).join('')}</ol>
</section>`;
}
const SC_PREMIERE = { key: 'premiere',
deco: `<i class="pr-grid"></i><span class="pr-side l">ИС-41 — Премия — MMXXVII</span><span class="pr-side r">Последний танец — Выпуск IV</span>` };
function scApplyTheme(overlay, meta, kind){
const th = kind === 'next' ? SC_THEMES[meta.index] : SC_PREMIERE, deco = $('#scDeco', overlay);
overlay.dataset.th = th ? th.key : 'cinema'; if(deco) deco.innerHTML = th ? th.deco : '';
$$('.g-medal, .g-program, .pr-prog', overlay).forEach(e => e.remove());
const brand = $('.sc-brand', overlay);
if(th === SC_PREMIERE){
if(brand) brand.innerHTML = `<b>ИС-41</b><i>${kind === 'outro' ? 'Финал' : 'Премьера'}</i>`;
$('.sc-foot', overlay).insertAdjacentHTML('afterend', scPremiereProgram(kind));
$('#scKick').textContent = kind === 'outro' ? 'Финал церемонии' : 'Открытие церемонии';
if(kind === 'intro'){ $('#videoCaption').textContent = 'Добро пожаловать на премию'; }
return;
}
if(brand) brand.innerHTML = 'Премия <b>2027</b><i>спецпоказ</i>';
if(th){ $('#scKick').textContent = th.kick; const sb = $('#scSub'); if(!meta.sub || meta.sub === 'Следующая номинация') sb.textContent = th.sub; }
}
const NL_NS = 'http://www.w3.org/2000/svg';
const nlRnd = seed => { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
const nlClamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const nlSeg = (p, a, b) => nlClamp((p - a) / (b - a));           // доля прогресса внутри отрезка [a,b]
const nlEase = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const nlPt = (cx, cy, r, deg) => { const a = (deg - 90) * Math.PI / 180; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
function nlGauge(cx, cy, r, a0, a1, major, minor, labels, redFrom, opt = {}){
let s = `<circle cx="${cx}" cy="${cy}" r="${r + 6}" class="g-bz"/><circle cx="${cx}" cy="${cy}" r="${r + 2}" class="g-face"/>`;
const n = major * minor;
for(let i = 0; i <= n; i++){
const v = i / n, ang = a0 + (a1 - a0) * v, big = i % minor === 0, p1 = nlPt(cx, cy, r - (big ? 11 : 6), ang), p2 = nlPt(cx, cy, r - 1, ang);
s += `<line x1="${p1[0].toFixed(1)}" y1="${p1[1].toFixed(1)}" x2="${p2[0].toFixed(1)}" y2="${p2[1].toFixed(1)}" class="g-t${big ? ' b' : ''}${redFrom != null && v >= redFrom ? ' r' : ''}"/>`;
if(big && labels){ const lp = nlPt(cx, cy, r - 22, ang); s += `<text x="${lp[0].toFixed(1)}" y="${(lp[1] + 3).toFixed(1)}" class="g-n">${labels(i / minor)}</text>`; }
}
if(opt.unit) s += `<text x="${cx}" y="${cy + r * .5}" class="g-u">${opt.unit}</text>`;
s += `<g class="g-nd" data-a0="${a0}" data-a1="${a1}" transform="rotate(${a0} ${cx} ${cy})"><path d="M${cx - 5} ${cy}L${cx} ${cy - r + 8}L${cx + 5} ${cy}Z"/></g><circle cx="${cx}" cy="${cy}" r="6" class="g-hub"/>`;
return s;
}
function nlGear(cx, cy, r, teeth, depth){
let d = ''; const n = teeth * 4;
for(let i = 0; i < n; i++){ const a = i / n * Math.PI * 2, k = i % 4, rr = (k === 1 || k === 2) ? r + depth : r; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); }
return d + 'Z';
}
function nlTrackPos(u, R, S){
const L = 2 * S + 2 * Math.PI * R; let d = ((u % 1) + 1) % 1 * L;
if(d < S) return [-S / 2 + d, -R]; d -= S;
if(d < Math.PI * R){ const a = -Math.PI / 2 + d / R; return [S / 2 + Math.cos(a) * R, Math.sin(a) * R]; } d -= Math.PI * R;
if(d < S) return [S / 2 - d, R]; d -= S;
const a = Math.PI / 2 + d / R; return [-S / 2 + Math.cos(a) * R, Math.sin(a) * R];
}
const NL_SCENES = [
{
dur: 6400, a: '#d4f53c', b: '#efeae0', kick: 'Номинация 01', tag: 'Четыре года. Ни одного пропуска.', st: ['Строим маршрут…', 'Считаем шаги…', 'Фиксируем приход…'],
bg: () => {
const stops = [['07:41', 'Общежитие'], ['07:52', 'Остановка'], ['08:03', 'Метро'], ['08:21', 'Проходная'], ['08:29', 'Аудитория 214']];
return `<canvas class="s0-3d"></canvas><i class="s0-shade"></i>
<div class="s0-hud">
<div class="s0-h l"><small>Время</small><b class="s0-num s0-clk">07:41</b><span class="s0-sub">До звонка <i class="s0-left">00:49</i></span></div>
<div class="s0-h r"><small>Шагов</small><b class="s0-num s0-odo">0</b><span class="s0-sub"><i class="s0-km">0,00</i> км</span></div>
<ol class="s0-stops">${stops.map(([t, n], i) => `<li data-i="${i}"><i></i><b>${t}</b><span>${n}</span></li>`).join('')}</ol>
</div>`;
},
mid: () => '',
init(el){
this.el = el; this.cv = $('.s0-3d', el); this.c = this.cv.getContext('2d');
this.clk = $('.s0-clk', el); this.odo = $('.s0-odo', el); this.last = {};
this.km = $('.s0-km', el); this.left = $('.s0-left', el); this.stopsEl = $$('.s0-stops li', el);
this.pts = [[100, 1000], [100, 800], [300, 800], [300, 700], [600, 700], [600, 400], [700, 400], [700, 200], [500, 200]];
this.wp = [[0, '07:41', 'ОБЩЕЖИТИЕ'], [2, '07:52', 'ОСТАНОВКА'], [4, '08:03', 'МЕТРО'], [6, '08:21', 'ПРОХОДНАЯ'], [8, '08:29', 'АУДИТОРИЯ 214']];
this.cum = [0]; for(let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.pts[i][0] - this.pts[i - 1][0], this.pts[i][1] - this.pts[i - 1][1])); this.L = this.cum[this.cum.length - 1];
const r = nlRnd(91); this.box = [];
const nearRoute = (x, z) => { for(let i = 1; i < this.pts.length; i++){ const [ax, az] = this.pts[i - 1], [bx, bz] = this.pts[i]; const minx = Math.min(ax, bx) - 60, maxx = Math.max(ax, bx) + 60, minz = Math.min(az, bz) - 60, maxz = Math.max(az, bz) + 60; if(x > minx && x < maxx && z > minz && z < maxz) return true; } return false; };
for(let cx = -3; cx < 12; cx++) for(let cz = -2; cz < 14; cz++){
const k = r(); if(k < .14) continue;
const x0 = cx * 100 + 16, z0 = cz * 100 + 16, near = nearRoute(x0 + 34, z0 + 34);
const split = r() < .45, h = () => (near ? 7 + r() * 14 : 12 + r() * 40) * (r() < .07 ? 1.9 : 1);
if(split){ this.box.push([x0, z0, 32, 68, h()], [x0 + 36, z0, 32, 68, h()]); } else this.box.push([x0, z0, 68, 68, h()]);
}
this.cam = null;
},
pos(d){ d = nlClamp(d, 0, this.L); let i = 1; while(i < this.cum.length - 1 && this.cum[i] < d) i++; const u = (d - this.cum[i - 1]) / (this.cum[i] - this.cum[i - 1] || 1), A = this.pts[i - 1], B = this.pts[i]; return [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, Math.atan2(B[1] - A[1], B[0] - A[0])]; },
tick(p, t){
const el = this.el, cv = this.cv, c = this.c, W = el.clientWidth, H = el.clientHeight;
const dpr = Math.min(2, window.devicePixelRatio || 1, Math.sqrt((W > 900 ? 1.5e6 : 2.4e6) / Math.max(1, W * H)));
if(cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)){ cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#0b0b0a'; c.fillRect(0, 0, W, H);
const ACC = '#d4f53c', INK = '239,234,224', sm = (a, b, x) => { const u = nlClamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const g = nlClamp((p - .12) / .76), d = this.L * (g < .5 ? 2 * g * g : 1 - Math.pow(-2 * g + 2, 2) / 2) * .0 + this.L * g, [wx, wz, wa] = this.pos(d);
const inA = sm(.02, .2, p), outA = sm(.86, .99, p), mid = [400, 600];
const fx = wx + Math.cos(wa) * 40, fz = wz + Math.sin(wa) * 40;
let tx = mid[0] + (fx - mid[0]) * inA, tz = mid[1] + (fz - mid[1]) * inA; tx += (mid[0] - tx) * outA; tz += (mid[1] - tz) * outA;
const wide = W / H > 1 ? 1.55 : 1; let dist = (1250 + (330 - 1250) * inA) * wide, hgt = (1050 + (260 - 1050) * inA) * wide, yaw = -1.1 + (-.55 + g * 1.15 + 1.1) * inA;
dist += (1150 * wide - dist) * outA; hgt += (1350 * wide - hgt) * outA; yaw += (.35 - yaw) * outA;
const C = [tx + Math.sin(yaw) * dist, hgt, tz + Math.cos(yaw) * dist], T = [tx, 0, tz];
let f = [T[0] - C[0], T[1] - C[1], T[2] - C[2]]; const fl = Math.hypot(...f); f = f.map(v => v / fl);
let r = [f[2], 0, -f[0]]; const rl = Math.hypot(...r); r = r.map(v => v / rl); r = [-r[0], 0, -r[2]];
const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
const F = Math.min(W, H) * 1.15, CX = W / 2, CY = H * (W < 700 ? .44 : .47);
const P = (x, y, z) => { const vx = x - C[0], vy = y - C[1], vz = z - C[2], zc = vx * f[0] + vy * f[1] + vz * f[2]; if(zc < 20) return null; return [CX + (vx * r[0] + vy * r[1] + vz * r[2]) * F / zc, CY - (vx * u[0] + vy * u[1] + vz * u[2]) * F / zc, zc]; };
const fog = z => nlClamp(1.35 - z / 1900);
c.lineWidth = 1;
for(let i = -3; i <= 12; i++) for(let j = -2; j <= 13; j++){
const a1 = P(i * 100, 0, j * 100), a2 = P(i * 100, 0, j * 100 + 100), b2 = P(i * 100 + 100, 0, j * 100);
if(a1 && a2){ const al = fog((a1[2] + a2[2]) / 2) * .13; if(al > .01){ c.strokeStyle = `rgba(${INK},${al})`; c.beginPath(); c.moveTo(a1[0], a1[1]); c.lineTo(a2[0], a2[1]); c.stroke(); } }
if(a1 && b2){ const al = fog((a1[2] + b2[2]) / 2) * .13; if(al > .01){ c.strokeStyle = `rgba(${INK},${al})`; c.beginPath(); c.moveTo(a1[0], a1[1]); c.lineTo(b2[0], b2[1]); c.stroke(); } }
}
const seg = (d0, d1, style, w, dash) => { c.strokeStyle = style; c.lineWidth = w; c.setLineDash(dash || []); c.beginPath(); let first = true; for(let s = d0; s <= d1 + .01; s += 8){ const [x, z] = this.pos(Math.min(s, d1)); const q = P(x, 0, z); if(!q){ first = true; continue; } first ? c.moveTo(q[0], q[1]) : c.lineTo(q[0], q[1]); first = false; } c.stroke(); c.setLineDash([]); };
seg(0, this.L, `rgba(${INK},.32)`, 1, [4, 6]);
if(d > 1){ seg(0, d, ACC, 2.6); seg(Math.max(0, d - 70), d, '#ffffff', 3.2); }
for(let k = Math.max(0, Math.floor((d - 320) / 13)); k * 13 <= d; k++){
const [x, z, a] = this.pos(k * 13), side = k % 2 ? 1 : -1, ox = Math.cos(a + 1.5708) * 7 * side, oz = Math.sin(a + 1.5708) * 7 * side;
const q1 = P(x + ox - Math.cos(a) * 3, 0, z + oz - Math.sin(a) * 3), q2 = P(x + ox + Math.cos(a) * 3, 0, z + oz + Math.sin(a) * 3); if(!q1 || !q2) continue;
c.strokeStyle = `rgba(${INK},${(nlClamp(1 - (d - k * 13) / 320) * .8).toFixed(3)})`; c.lineWidth = 2; c.beginPath(); c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); c.stroke();
}
const cullR = (dist + 500) ** 2; const boxes = this.box.filter(b => (b[0] + b[2] / 2 - tx) ** 2 + (b[1] + b[3] / 2 - tz) ** 2 < cullR).map(b => { const cx = b[0] + b[2] / 2, cz = b[1] + b[3] / 2; return [b, (cx - C[0]) ** 2 + (cz - C[2]) ** 2]; }).sort((a, b) => b[1] - a[1]);
c.lineJoin = 'round';
for(const [b] of boxes){
const [x0, z0, w, dd, h] = b, x1 = x0 + w, z1 = z0 + dd;
const v = [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], [x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]].map(q => P(...q));
if(v.some(q => !q)) continue;
const al = fog(v[6][2]); if(al < .03) continue;
if(v.every(q => q[0] < -60 || q[0] > W + 60) ) continue;
const faces = [[0, 1, 5, 4, [x0 + w / 2, z0 - 1]], [1, 2, 6, 5, [x1 + 1, z0 + dd / 2]], [2, 3, 7, 6, [x0 + w / 2, z1 + 1]], [3, 0, 4, 7, [x0 - 1, z0 + dd / 2]]];
c.strokeStyle = `rgba(${INK},${(al * .5).toFixed(3)})`; c.lineWidth = 1;
for(const fc of faces){ const [cxn, czn] = fc[4], ctr = [(x0 + x1) / 2, (z0 + z1) / 2], nx = cxn - ctr[0], nz = czn - ctr[1]; if(nx * (C[0] - cxn) + nz * (C[2] - czn) <= 0) continue;
c.fillStyle = nx !== 0 ? '#0e0e0d' : '#121211'; c.beginPath(); [0, 1, 2, 3].forEach((k, i) => { const q = v[fc[k]]; i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); c.fill(); c.stroke(); }
c.fillStyle = '#151514'; c.beginPath(); [4, 5, 6, 7].forEach((k, i) => { const q = v[k]; i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); c.fill();
c.strokeStyle = `rgba(${INK},${(al * .75).toFixed(3)})`; c.stroke();
}
c.textBaseline = 'middle';
this.wp.forEach(([pi, tm, name], i) => {
const [x, z] = this.pts[pi], reached = d >= this.cum[pi] - 1, q = P(x, 0, z); if(!q) return; const al = fog(q[2]); if(al < .05) return;
const stem = 54, top = q[1] - stem, fin = i === this.wp.length - 1;
c.strokeStyle = reached ? ACC : `rgba(${INK},${.55 * al})`; c.lineWidth = 1; c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(q[0], top); c.stroke();
c.fillStyle = reached ? ACC : '#0b0b0a'; c.beginPath(); c.arc(q[0], q[1], 3.5, 0, 7); c.fill(); c.stroke();
c.font = '600 10px "LX Text",Inter,sans-serif'; const lbl = tm + '  ' + name, tw = c.measureText(lbl).width + 16;
const lx = q[0] + tw > W - 14 ? q[0] - tw : q[0];
c.globalAlpha = al; c.fillStyle = reached ? (fin ? ACC : '#efeae0') : 'rgba(11,11,10,.85)'; c.fillRect(lx, top - 22, tw, 22);
c.strokeStyle = reached ? 'transparent' : `rgba(${INK},.5)`; c.strokeRect(lx + .5, top - 21.5, tw - 1, 21);
c.fillStyle = reached ? '#0b0b0a' : `rgb(${INK})`; c.fillText(lbl, lx + 8, top - 11); c.globalAlpha = 1;
});
const q = P(wx, 0, wz);
if(q && g > 0 && g < 1){
const ph = (t / 1000) % 1.4 / 1.4; c.strokeStyle = `rgba(212,245,60,${(1 - ph) * .9})`; c.lineWidth = 1.2; c.beginPath(); c.ellipse(q[0], q[1], 6 + ph * 26, (6 + ph * 26) * .45, 0, 0, 7); c.stroke();
c.fillStyle = '#fff'; c.beginPath(); c.arc(q[0], q[1], 4.5, 0, 7); c.fill(); c.strokeStyle = ACC; c.lineWidth = 2; c.stroke();
}
const mins = 41 + Math.floor(48 * g), hh = mins >= 60 ? 8 : 7, mm = mins % 60;
const ck = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); if(this.last.ck !== ck){ this.last.ck = ck; this.clk.textContent = ck; }
this.odo.textContent = String(Math.round(6840 * g)).replace(/\B(?=(\d{3})+$)/g, '\u2009');
const lsec = Math.max(0, Math.round((1 - g) * 49 * 60 + 60)); this.left.textContent = String(Math.floor(lsec / 60)).padStart(2, '0') + ':' + String(lsec % 60).padStart(2, '0');
this.km.textContent = (g * 5.2).toFixed(2).replace('.', ',');
this.stopsEl.forEach((li, i) => li.classList.toggle('on', d >= this.cum[this.wp[i][0]] - 1));
}
},
{
paper: 1, a: '#c8382d', b: '#1f4fa8', kick: 'Главный прогульщик', tag: 'Отсутствует по неуважительной причине.', st: ['Открываем журнал…', 'Проставляем отметки…', 'Подшиваем объяснительные…'],
bg: () => `<i class="s1-paper"></i><i class="s1-margin"></i>`,
mid: () => `<canvas class="s1-cv" width="720" height="820"></canvas>`,
init(el){
const dpr = Math.min(2, window.devicePixelRatio || 1); this.cv = $('.s1-cv', el); this.cv.width = 360 * dpr; this.cv.height = 410 * dpr; this.dpr = dpr; this.c = this.cv.getContext('2d');
const r = nlRnd(41); this.cells = []; for(let w = 0; w < 6; w++) for(let d = 0; d < 6; d++) this.cells.push([w, d, r()]); this.cells.sort((a, b) => a[2] - b[2]);
this.fields = [['ФИО', 'Главный прогульщик'], ['Группа', 'ИС-41'], ['Период', 'сентябрь — июнь']];
this.stamps = [
{ at: .42, x: 264, y: 136, r: -.08, w: 128, h: 26, t: 'ПРОПУСК ЗАФИКСИРОВАН' },
{ at: .66, x: 118, y: 340, r: .06, w: 168, h: 28, t: 'ПРИЧИНА НЕУВАЖИТЕЛЬНАЯ' },
{ at: .88, x: 180, y: 232, r: -.17, w: 276, h: 84, t: 'ГЛАВНЫЙ ПРОГУЛЬЩИК', big: 1 }
];
},
tick(p, t){
const c = this.c, dp = this.dpr, W = 360, H = 410, INK = '#1c1914', RED = '#b3261e', MONO = '"Courier New",monospace';
c.setTransform(dp, 0, 0, dp, 0, 0); c.clearRect(0, 0, W, H);
let sh = 0; this.stamps.forEach(s => { const u = p - s.at; if(s.big && u > 0 && u < .03) sh = (1 - u / .03) * 6; });
c.translate(sh ? (Math.random() - .5) * sh : 0, sh ? (Math.random() - .5) * sh : 0);
c.fillStyle = 'rgba(28,25,20,.22)'; c.fillRect(30, 20, 306, 380); c.fillStyle = '#f7f4ea'; c.fillRect(24, 14, 306, 380); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(24.5, 14.5, 305, 379);
c.fillStyle = INK; c.fillRect(24, 14, 306, 20); c.fillStyle = '#f7f4ea'; c.font = '700 8.5px ' + MONO; c.textAlign = 'left'; c.fillText('ФОРМА № 27 · УЧЕБНАЯ ЧАСТЬ', 32, 27); c.textAlign = 'right'; c.fillText('№ 0027', 322, 27);
c.textAlign = 'left'; c.fillStyle = INK; c.font = '700 17px "Courier New",monospace'; c.fillText('АКТ О ПОСЕЩАЕМОСТИ', 36, 58);
c.fillRect(36, 64, 282, 1.5);
const tot = this.fields.reduce((a, f) => a + f[1].length, 0), shown = Math.floor(tot * nlSeg(p, .05, .3)); let left = shown;
this.fields.forEach(([k, v], i) => { const y = 86 + i * 20; c.font = '700 8.5px ' + MONO; c.fillStyle = 'rgba(28,25,20,.55)'; c.fillText(k.toUpperCase(), 36, y); c.fillRect(96, y + 3, 222, .8); const sub = v.slice(0, Math.max(0, left)); left -= v.length; c.font = '700 11.5px ' + MONO; c.fillStyle = INK; c.fillText(sub, 100, y); });
const x0 = 56, y0 = 168, cw = 43, rh = 25, days = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
c.strokeStyle = 'rgba(28,25,20,.75)'; c.lineWidth = 1; c.strokeRect(x0 - 20.5, y0 - 18.5, 20 + cw * 6 + 1, 18 + rh * 6 + 1);
c.font = '700 8px ' + MONO; c.textAlign = 'center'; c.fillStyle = INK; days.forEach((dn, i) => c.fillText(dn, x0 + i * cw + cw / 2, y0 - 6));
for(let r = 0; r <= 6; r++){ c.beginPath(); c.moveTo(x0 - 20, y0 + r * rh + .5); c.lineTo(x0 + cw * 6, y0 + r * rh + .5); c.stroke(); } for(let k = 0; k <= 6; k++){ c.beginPath(); c.moveTo(x0 + k * cw + .5, y0 - 18); c.lineTo(x0 + k * cw + .5, y0 + rh * 6); c.stroke(); }
c.beginPath(); c.moveTo(x0 - 19.5, y0 - 18); c.lineTo(x0 - 19.5, y0 + rh * 6); c.stroke();
c.fillStyle = 'rgba(28,25,20,.55)'; for(let r = 0; r < 6; r++) c.fillText(String(r + 1), x0 - 10, y0 + r * rh + 16);
const k = Math.floor(nlSeg(p, .1, .84) * this.cells.length); c.fillStyle = RED; c.font = '700 15px ' + MONO;
this.cells.forEach(([w, d], i) => { if(i < k){ const age = k - i; c.globalAlpha = age < 2 ? .6 : 1; c.fillText('Н', x0 + d * cw + cw / 2, y0 + w * rh + 18); } }); c.globalAlpha = 1;
const hrs = Math.round(312 * nlSeg(p, .1, .84)); c.textAlign = 'left'; c.fillStyle = 'rgba(28,25,20,.55)'; c.font = '700 8.5px ' + MONO; c.fillText('ИТОГО ПРОПУЩЕНО, Ч', 36, 352); c.fillStyle = INK; c.font = '700 20px ' + MONO; c.fillText(String(hrs).padStart(3, '0'), 36, 376);
c.fillStyle = 'rgba(28,25,20,.55)'; c.font = '700 8.5px ' + MONO; c.textAlign = 'right'; c.fillText('ПОДПИСЬ ДЕКАНА', 318, 352); c.fillRect(214, 372, 104, .8);
this.stamps.forEach(s => {
const u = (p - s.at) / .05; if(u < -1) return; const drop = u < 0 ? -u : 0, ink = u >= 0;
c.save(); c.translate(s.x, s.y); c.rotate(s.r);
if(ink){ const k2 = Math.min(1, u * 8); c.scale(1 + (1 - k2) * .12, 1 + (1 - k2) * .12); c.globalCompositeOperation = 'multiply'; c.globalAlpha = s.big ? .92 : .82; c.strokeStyle = RED; c.fillStyle = RED; c.lineWidth = s.big ? 4 : 2.2; c.strokeRect(-s.w / 2, -s.h / 2, s.w, s.h);
c.textAlign = 'center'; if(s.big){ c.lineWidth = 1.4; c.strokeRect(-s.w / 2 + 6, -s.h / 2 + 6, s.w - 12, s.h - 12); c.font = '700 25px ' + MONO; c.fillText('ГЛАВНЫЙ', 0, -4); c.fillText('ПРОГУЛЬЩИК', 0, 25); } else { c.font = '700 9.5px ' + MONO; c.fillText(s.t, 0, 4); } }
const lift = ink ? nlSeg(u, .05, .45) : 0, show = drop > 0 ? 1 : 1 - lift;
if(show > 0 && (drop > 0 || u < .45)){ c.globalCompositeOperation = 'source-over'; c.globalAlpha = show; const h = (drop > 0 ? drop : lift) * 70; c.translate(0, -h); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-14, 12, 40, 6); c.fillStyle = '#6b4a24'; c.fillRect(-12, -46, 24, 38); c.fillStyle = '#2a2a2a'; c.fillRect(-Math.min(s.w / 2, 30), -8, Math.min(s.w, 60), 11); c.fillStyle = RED; c.fillRect(-Math.min(s.w / 2, 30) + 2, 3, Math.min(s.w, 60) - 4, 3); }
c.restore();
});
}
},
{
a: '#ff3a9a', b: '#3ab6ff', kick: 'Флешбэк года', tag: 'Лучшие кадры за четыре года.', st: ['Вставляем кассету…', 'Настраиваем трекинг…', 'Перематываем на начало…'],
bg: () => `<div class="s2-bars"></div><canvas class="s2-noise"></canvas><i class="s2-track"></i><i class="s2-scan"></i><i class="s2-edge"></i>
<div class="s2-osd vo1"><b id="s2Mode">◀◀ REW</b><span>SP</span></div><div class="s2-osd vo2"><span>AV 1</span></div>
<div class="s2-osd vo3"><span id="s2Tc">00:00:00:00</span></div><div class="s2-osd vo4"><span>OCT. 26 2026</span></div>`,
mid: () => ``,
init(el){
this.cv = $('.s2-noise', el); this.cx = this.cv.getContext('2d'); this.cv.width = 90; this.cv.height = 160; this.bars = $('.s2-bars', el); this.trk = $('.s2-track', el); this.mode = $('#s2Mode', el); this.tc = $('#s2Tc', el); this.last = 0;
this.img = this.cx.createImageData(90, 160);
},
tick(p, t){
const bars = 1 - nlSeg(p, .28, .62); this.bars.style.opacity = bars.toFixed(2);
const d = this.img.data, amp = (.25 + .75 * (1 - nlSeg(p, .55, .95))) * 255;
for(let i = 0; i < d.length; i += 4){ const v = Math.random() * amp; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
this.cx.putImageData(this.img, 0, 0); this.cv.style.opacity = (.1 + .35 * (1 - bars) * (1 - nlSeg(p, .6, .95)) + .12 * Math.random()).toFixed(2);
this.trk.style.transform = `translateY(${((t / 7) % 140) - 20}vh)`; this.trk.style.opacity = (.8 * (1 - nlSeg(p, .6, .9))).toFixed(2);
const tc = Math.floor(p * 86400 * 0.4); const f = n => String(n).padStart(2, '0'); this.tc.textContent = `${f(Math.floor(tc / 3600) % 100)}:${f(Math.floor(tc / 60) % 60)}:${f(tc % 60)}:${f(Math.floor(t / 40) % 25)}`;
const m = p < .62 ? '◀◀ REW' : '▶ PLAY'; if(this.mode.textContent !== m) this.mode.textContent = m;
}
},
{
a: '#ffb02e', b: '#ffe14a', kick: 'Заводчанин года', tag: 'Смена началась. Пропуска предъявить.', st: ['Запускаем конвейер…', 'Проверяем пропуска…', 'Принимаем завоз…'],
bg: () => `<i class="s3-plate"></i><i class="s3-haz t"></i><i class="s3-haz b"></i>
<svg class="s3-gear" viewBox="-130 -130 260 260" aria-hidden="true"><path d="${nlGear(0, 0, 100, 18, 14)}" class="gr"/><circle r="64" class="gr2"/><circle r="22" class="gr2"/></svg>
<svg class="s3-gear sm" viewBox="-130 -130 260 260" aria-hidden="true"><path d="${nlGear(0, 0, 100, 12, 14)}" class="gr"/><circle r="40" class="gr2"/></svg>`,
mid: () => `<svg class="s3-conv" viewBox="0 0 300 120" aria-hidden="true">
<rect x="0" y="82" width="300" height="14" rx="7" class="bt"/>
<g class="s3-rl">${Array.from({ length: 11 }, (_, i) => `<circle cx="${10 + i * 28}" cy="89" r="4.5"/>`).join('')}</g>
<rect x="0" y="98" width="300" height="6" class="lg"/><path d="M20 104v14M120 104v14M220 104v14M280 104v14" class="lg2"/>
<g class="s3-bx">${Array.from({ length: 6 }, (_, i) => `<g class="bxx" data-i="${i}"><rect x="-17" y="-26" width="34" height="26" rx="2"/><path d="M-17 -16H17M0 -26V0" class="tp"/><text x="0" y="-5" class="lb">${i + 1}</text></g>`).join('')}</g>
</svg>
<div class="s3-gs">${[['ТЕМП', 'g1'], ['ДАВЛ', 'g2'], ['ПЛАН', 'g3']].map(([n, c]) => `<svg viewBox="0 0 100 100" class="${c}" aria-hidden="true">${nlGauge(50, 54, 38, -120, 120, 4, 3, null, .78, {})}<text x="50" y="92" class="g-u">${n}</text></svg>`).join('')}</div>
<div class="s3-led" aria-hidden="true">${['ПИТАНИЕ', 'ЛИНИЯ', 'ПРОПУСК', 'ПЛАН'].map(n => `<span><i></i>${n}</span>`).join('')}</div>`,
init(el){ this.g1 = $('.s3-gear:not(.sm) .gr', el); this.bx = $$('.s3-bx .bxx', el); this.nd = $$('.s3-gs .g-nd', el); this.led = $$('.s3-led span', el); this.gears = $$('.s3-gear', el); },
tick(p, t){
this.gears[0].style.transform = `rotate(${(t / 60 * (.4 + p)).toFixed(1)}deg)`; this.gears[1].style.transform = `rotate(${(-t / 40 * (.4 + p)).toFixed(1)}deg)`;
this.bx.forEach((b, i) => { const u = ((t / 2600 * (.5 + p * .8) + i / 6) % 1); b.setAttribute('transform', `translate(${(-20 + u * 340).toFixed(1)} 82)`); });
[p * .9 + Math.sin(t / 300) * .02, nlSeg(p, .1, 1) * .8 + Math.sin(t / 420) * .03, p].forEach((v, i) => { const n = this.nd[i]; const a0 = +n.dataset.a0, a1 = +n.dataset.a1; n.setAttribute('transform', `rotate(${(a0 + (a1 - a0) * nlClamp(v)).toFixed(1)} 50 54)`); });
this.led.forEach((l, i) => l.classList.toggle('on', p > .12 + i * .24));
}
},
{
a: '#e8c26a', b: '#7fdca4', kick: 'Прилежный студент', tag: 'Тишина. Читальный зал.', st: ['Расставляем книги…', 'Включаем лампу…', 'Заполняем формуляры…'],
bg: () => `<i class="s4-wood"></i><i class="s4-lamp"></i><i class="s4-frame"></i>`,
mid: () => {
const rnd = nlRnd(7), cols = ['#7a1f26', '#1f4d6b', '#2f5d3a', '#6a4a1f', '#4a2a5a', '#8a6a1c', '#2b3a55', '#5a2e1c']; let s = '';
for(let sh = 0; sh < 3; sh++){ const y = 40 + sh * 62; let x = 6, i = 0;
while(x < 292){ const w = 9 + rnd() * 9, h = 34 + rnd() * 20, c = cols[(rnd() * cols.length) | 0];
s += `<g class="sp" data-x="${x.toFixed(1)}" data-y="${y}" transform="translate(${x.toFixed(1)} ${y})"><rect x="0" y="${(-h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${c}"/><rect x="0" y="${(-h).toFixed(1)}" width="1.4" height="${h.toFixed(1)}" class="hi"/><rect x="${(w * .12).toFixed(1)}" y="${(-h * .8).toFixed(1)}" width="${(w * .76).toFixed(1)}" height="2" class="gdl"/><rect x="${(w * .12).toFixed(1)}" y="${(-h * .2).toFixed(1)}" width="${(w * .76).toFixed(1)}" height="2" class="gdl"/></g>`; x += w + 1.2; i++; }
s += `<rect x="0" y="${y}" width="300" height="5" class="pl"/>`; }
return `<svg class="s4-shelf" viewBox="0 0 300 232" aria-hidden="true">${s}</svg>
<div class="s4-card" aria-hidden="true"><div class="hd"><b>ЧИТАТЕЛЬСКИЙ ФОРМУЛЯР</b><span>№ 0027</span></div><div class="ln"><i></i></div><div class="ln"><i></i></div><div class="ln"><i></i></div></div>`;
},
init(el){ this.sp = $$('.sp', el); this.ln = $$('.s4-card .ln i', el); this.n = this.sp.length; },
tick(p){
this.sp.forEach((g, i) => { const k = nlEase(nlSeg(p, .05 + (i / this.n) * .72, .17 + (i / this.n) * .72)); g.style.opacity = k.toFixed(2); g.setAttribute('transform', `translate(${g.dataset.x} ${(+g.dataset.y + (1 - k) * -26).toFixed(1)})`); });
this.ln.forEach((l, i) => { l.style.transform = `scaleX(${nlSeg(p, .15 + i * .22, .4 + i * .22).toFixed(2)})`; });
}
},
{
a: '#ff4d3a', b: '#ffc24a', kick: 'Машина года', tag: 'Зажигание. Контакт. Поехали.', st: ['Включаем зажигание…', 'Прогреваем двигатель…', 'Выезжаем из бокса…'],
bg: () => `<i class="s5-sky"></i><div class="s5-road"><i class="rl"></i><i class="rc"></i><i class="rr"></i><div class="ds">${Array.from({ length: 9 }, (_, i) => `<b style="--i:${i}"></b>`).join('')}</div></div><i class="s5-beam l"></i><i class="s5-beam r"></i>`,
mid: () => `<svg class="s5-cl" viewBox="0 0 330 150" aria-hidden="true">
${nlGauge(82, 78, 62, -130, 130, 8, 2, i => i, .78, { unit: 'x1000 об/мин' }).replace('class="g-nd"', 'class="g-nd tach"')}
<g transform="translate(166 0)">${nlGauge(82, 78, 62, -130, 130, 6, 4, i => i * 40, 1, { unit: 'км/ч' }).replace('class="g-nd"', 'class="g-nd spd"')}</g>
<g class="s5-lamps">${['ENG', 'OIL', 'BAT', 'ABS'].map((n, i) => `<g transform="translate(${126 + i * 22} 134)" class="lp" data-i="${i}"><rect x="-9" y="-7" width="18" height="12" rx="2"/><text y="3">${n}</text></g>`).join('')}</g>
</svg>
<div class="s5-odo" aria-hidden="true"><small>ПРОБЕГ · КМ</small><b id="s5Odo">187412</b></div>`,
init(el){ this.tach = $('.g-nd.tach', el); this.spd = $('.g-nd.spd', el); this.lp = $$('.s5-lamps .lp', el); this.odo = $('#s5Odo', el); this.road = $('.s5-road', el); },
tick(p, t){
const rev = nlClamp(.12 + nlSeg(p, .1, .28) * .75 - nlSeg(p, .28, .34) * .35 + nlSeg(p, .34, .85) * .38 + Math.sin(t / 90) * .008);
const sp = nlClamp(nlSeg(p, .3, 1) * .78);
this.tach.setAttribute('transform', `rotate(${(-130 + 260 * rev).toFixed(1)} 82 78)`); this.spd.setAttribute('transform', `rotate(${(-130 + 260 * sp).toFixed(1)} 82 78)`);
this.lp.forEach((l, i) => l.classList.toggle('off', p > .2 + i * .18));
this.odo.textContent = String(187412 + Math.floor(sp * 14)).padStart(6, '0');
this.road.style.setProperty('--sp', (.4 + sp * 1.8).toFixed(2));
}
},
{
a: '#e8c15a', b: '#b86bff', kick: 'Король Группы', tag: 'Один король. Одна корона.', st: ['Раскрываем занавес…', 'Зажигаем софиты…', 'Выносим корону…'],
bg: () => `<i class="s6-cur l"></i><i class="s6-cur r"></i><i class="s6-cone"></i><i class="s6-cone b"></i><i class="s6-floor"></i><i class="s6-frame"></i>`,
mid: () => {
const leaf = (cx, cy, r, a0, a1, n, flip) => Array.from({ length: n }, (_, i) => { const k = i / (n - 1), a = a0 + (a1 - a0) * k, [x, y] = nlPt(cx, cy, r, a); return `<path class="lf" data-k="${(i / n).toFixed(3)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(a + (flip ? -35 : 35)).toFixed(0)})" d="M0 0C5 -4 11 -4 16 0C11 4 5 4 0 0Z"/>`; }).join('');
return `<svg class="s6-crown" viewBox="0 0 260 200" aria-hidden="true">
<g class="lau">${leaf(130, 108, 84, -118, -28, 12, 0)}${leaf(130, 108, 84, 118, 28, 12, 1).replace(/rotate\(([-\d]+)\)/g, (m, a) => `rotate(${+a + 180})`)}</g>
<g transform="translate(30 42)" class="cr">
<path pathLength="1" class="cl" d="M20 110L10 40L55 75L100 20L145 75L190 40L180 110Z"/>
<path pathLength="1" class="cl" d="M20 110H180V128H20Z"/>
<path pathLength="1" class="cl2" d="M55 75L68 110M100 20L100 110M145 75L132 110M10 40L28 110M190 40L172 110"/>
${[[10, 40], [100, 20], [190, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" class="jw"/>`).join('')}
${[40, 70, 100, 130, 160].map(x => `<circle cx="${x}" cy="119" r="3.2" class="jw2"/>`).join('')}
</g></svg>`;
},
init(el){ this.cl = $$('.s6-crown .cl, .s6-crown .cl2', el); this.jw = $$('.s6-crown .jw, .s6-crown .jw2', el); this.lf = $$('.s6-crown .lf', el); this.cr = $('.s6-crown .cr', el); },
tick(p){
this.cl.forEach((c, i) => { c.style.strokeDashoffset = (1 - nlSeg(p, .06 + i * .05, .5 + i * .04)).toFixed(3); c.style.strokeDasharray = 1; });
this.jw.forEach((j, i) => { j.style.opacity = nlSeg(p, .5 + i * .02, .62 + i * .02).toFixed(2); });
this.lf.forEach(l => { l.style.opacity = nlSeg(p, .12 + +l.dataset.k * .55, .24 + +l.dataset.k * .55).toFixed(2); });
this.cr.style.setProperty('--fill', nlSeg(p, .7, .95).toFixed(2));
}
}
];
let _nlBusy = false, _nlAudio = null;
function nlSynth(dur){
try{
const ac = tink.ac || (tink.ac = new (window.AudioContext || window.webkitAudioContext)()); if(ac.state === 'suspended') ac.resume();
const t = ac.currentTime, g = ac.createGain(), f = ac.createBiquadFilter(), o = ac.createOscillator(), o2 = ac.createOscillator();
o.type = 'sawtooth'; o2.type = 'triangle'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(520, t + dur * .92); o2.frequency.setValueAtTime(140, t); o2.frequency.exponentialRampToValueAtTime(1040, t + dur * .92);
f.type = 'lowpass'; f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(5200, t + dur * .92);
g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + dur * .6); g.gain.linearRampToValueAtTime(.0001, t + dur * .98);
o.connect(f); o2.connect(f); f.connect(g); g.connect(ac.destination); o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
const h = ac.createOscillator(), hg = ac.createGain(); h.type = 'sine'; h.frequency.setValueAtTime(120, t + dur * .93); h.frequency.exponentialRampToValueAtTime(38, t + dur * .93 + .5);
hg.gain.setValueAtTime(0, t + dur * .93); hg.gain.linearRampToValueAtTime(.3, t + dur * .93 + .02); hg.gain.exponentialRampToValueAtTime(.001, t + dur * .93 + .6); h.connect(hg); hg.connect(ac.destination); h.start(t + dur * .93); h.stop(t + dur * .93 + .7);
}catch(_){}
}
function nlMusicStart(index, dur){
const cfg = (typeof VIDEO_SETTINGS !== 'undefined' && VIDEO_SETTINGS.loaderMusic) || {};
const src = (cfg.byIndex && cfg.byIndex[index]) || cfg.default || '';
const bg = (typeof backgroundMusic !== 'undefined' && backgroundMusic && !backgroundMusic.paused) ? backgroundMusic : null; if(bg) try{ bg.pause(); }catch(_){}
let synthDone = false, a = null, fade = 0, stopped = false, vol = cfg.volume == null ? .9 : cfg.volume;
const synth = () => { if(!synthDone && !stopped){ synthDone = true; nlSynth(dur / 1000); } };
if(src){
try{
a = new Audio(); a.preload = 'auto'; a.loop = true; a.volume = 0; a.src = src;
if(cfg.startAt) a.addEventListener('loadedmetadata', () => { try{ a.currentTime = cfg.startAt; }catch(_){} }, { once: true });
a.addEventListener('error', synth, { once: true });
const pr = a.play(); if(pr && pr.then) pr.then(() => { let v = 0; fade = setInterval(() => { v = Math.min(vol, v + vol / 12); a.volume = v; if(v >= vol) clearInterval(fade); }, 55); }).catch(synth);
_nlAudio = a;
}catch(_){ synth(); }
} else synth();
return {
stop(){
stopped = true; clearInterval(fade);
if(a){ const x = a; let v = x.volume; const o = setInterval(() => { v = Math.max(0, v - .09); try{ x.volume = v; }catch(_){} if(v <= 0){ clearInterval(o); try{ x.pause(); x.removeAttribute('src'); x.load(); }catch(_){} } }, 55); }
if(bg) setTimeout(() => { try{ if(!document.getElementById('nomLoader')) bg.play().catch(() => {}); }catch(_){} }, 900);
}
};
}
const NL_LOG = [
[['Маршруты до ЛТПИТУ', '{n} кандидатов'], ['Хронометраж прихода', '07:50'], ['Рейтинг ранних пташек', 'сверка'], ['Журнал вахты', 'готов']],
[['Журнал посещаемости', '{n} кандидатов'], ['Пропуски по неделям', '4 года'], ['Справки и «справки»', 'проверка'], ['Протокол старосты', 'подписан']],
[['Оцифровка архива', '{f}'], ['Кадры 2023–2027', 'отбор'], ['Подписи к кадрам', '{n} героев'], ['Склейка ленты', 'готова']],
[['Табель смены', '{n} кандидатов'], ['Заводские истории', '{f}'], ['Пропуска и допуски', 'проверка'], ['План выполнения', '100%']],
[['Зачётки и оценки', '{n} кандидатов'], ['Читальный зал', 'открыт'], ['Конспекты', '{f}'], ['Ведомость', 'закрыта']],
[['Фото машин', '{f}'], ['Маски кузова и стёкол', 'разметка'], ['Звуки двигателей', 'прогрев'], ['Тюнинг-ателье', '{n} машин']],
[['Список рыцарей', '{n} рыцарей'], ['Круглый стол', 'расставлен'], ['Щиты и гербы', 'сборка'], ['Тронный зал', 'трон пуст']]
];
function nlCollect(index){
const fr = (typeof frames !== 'undefined' && frames[index]) || null, urls = new Set();
try{ if(fr) fr.querySelectorAll('img[src]').forEach(i => { const u = i.getAttribute('src'); if(u && !/^data:/.test(u)) urls.add(u); });
if(fr) fr.querySelectorAll('source[srcset]').forEach(i => { const u = (i.getAttribute('srcset') || '').split(' ')[0]; if(u && !/^data:/.test(u)) urls.add(u); }); }catch(_){}
if(index === 5 && typeof CAR_IMG !== 'undefined') Object.values(CAR_IMG).forEach(u => { if(!/^data:/.test(u)) urls.add(u); });
const n = fr ? fr.querySelectorAll('.nominee:not([hidden])').length : 0;
return { urls: [...urls], n };
}
function nlPreload(urls){
const r = { total: urls.length, done: 0, settled: !urls.length };
urls.forEach(u => { const im = new Image(); const fin = () => { r.done++; if(r.done >= r.total) r.settled = true; }; im.onload = im.onerror = fin; im.src = u; });
setTimeout(() => { r.settled = true; }, 6000);
return r;
}
function playNominationLoader(index, done, kicker){
if(_nlBusy){ done(); return; }
_nlBusy = true;
const sc = NL_SCENES[index] || NL_SCENES[0], title = nominationOrder[index] || '', total = (typeof TOTAL_NOMS === 'number' ? TOTAL_NOMS : 7);
const DUR = sc.dur || (typeof VIDEO_SETTINGS !== 'undefined' && VIDEO_SETTINGS.loaderMs) || 4800; let finished = false, t0 = performance.now(), raf = 0, skipFrom = 0, skipAt = 0;
const el = document.createElement('div'); el.id = 'nomLoader'; el.className = 'nl nl-s' + index + (sc.paper ? ' paper' : '') + (sc.fx ? ' nlx' : '');
el.style.setProperty('--a', sc.a); el.style.setProperty('--b', sc.b); if(sc.bgc) el.style.setProperty('--bgc', sc.bgc); if(sc.glow) el.style.setProperty('--glow', sc.glow);
let li = 0;
const letters = title.split(' ').map(w => `<span class="nl-w">${[...w].map(c => `<span class="nl-l" style="--i:${li++}"><i>${esc(c)}</i></span>`).join('')}</span>`).join('');
el.innerHTML = `
<div class="nl-bg">${sc.bg()}</div><i class="nl-grain"></i><i class="nl-vig"></i>
<i class="nl-cm c1"></i><i class="nl-cm c2"></i><i class="nl-cm c3"></i><i class="nl-cm c4"></i>
<header class="nl-top"><span>БЮЛЛЕТЕНЬ № 0027</span><span class="nl-id">НОМИНАЦИЯ ${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span></header>
<main class="nl-main">
<div class="nl-kick"><i></i><span>${esc(kicker || 'Следующая номинация')}</span><i></i></div>
<div class="nl-mid">${sc.mid()}</div>
<h2 class="nl-title" aria-label="${esc(title)}">${letters}</h2>
<p class="nl-tag">${esc(sc.tag)}</p>
<div class="nl-meter"><span id="nlSt">${esc(sc.st[0])}</span><b id="nlPct">0%</b></div>
<div class="nl-line"><i id="nlFill"></i></div>
<ol class="nl-log">${(NL_LOG[index] || NL_LOG[0]).map(r => `<li><i></i><span>${esc(r[0])}</span><em data-t="${esc(r[1])}"></em></li>`).join('')}</ol>
<div class="nl-pips">${Array.from({ length: total }, (_, i) => `<i class="${i < index ? 'd' : i === index ? 'c' : ''}"></i>`).join('')}</div>
</main>
<footer class="nl-bot"><span>Нажми, чтобы пропустить</span><span>${(VIDEO_SETTINGS.loaderMusic && (VIDEO_SETTINGS.loaderMusic.default || VIDEO_SETTINGS.loaderMusic.byIndex?.[index])) ? '♪ музыка загрузки' : '♪ звук'}</span></footer>`;
document.body.appendChild(el);
const info = nlCollect(index), pre = nlPreload(info.urls), logLi = [...el.querySelectorAll('.nl-log li')];
const fillTxt = t => t.replace('{n}', info.n || '—').replace('{f}', pre.total ? `${Math.min(pre.done, pre.total)}/${pre.total} файлов` : 'в памяти');
logLi.forEach(li => { const e = li.querySelector('em'); e.textContent = ''; });
const fill = $('#nlFill', el), pct = $('#nlPct', el), st = $('#nlSt', el); let lastSt = 0;
const scene = Object.create(sc); try{ scene.init && scene.init(el); }catch(err){ console.error('loader init', err); }
const prog = x => { const k = [0, .08, .31, .36, .64, .7, .92, 1], v = [0, .1, .3, .38, .66, .72, .94, 1]; for(let i = 1; i < k.length; i++) if(x <= k[i]) return v[i - 1] + (v[i] - v[i - 1]) * nlEase((x - k[i - 1]) / (k[i] - k[i - 1])); return 1; };
setTimeout(() => el.classList.add('on'), 30); setTimeout(() => el.classList.add('t1'), 520); setTimeout(() => el.classList.add('t2'), 1250);
const music = nlMusicStart(index, DUR);
const close = () => {
if(finished) return; finished = true; cancelAnimationFrame(raf); music.stop();
el.classList.add('open'); try{ navigator.vibrate?.([18, 30, 40]); }catch(_){}
setTimeout(() => { done(); }, 280);
setTimeout(() => { el.remove(); _nlBusy = false; }, 1300);
};
const frame = now => {
if(finished) return;
let x = Math.min(1, (now - t0) / DUR); if(skipFrom) x = Math.max(x, skipFrom + (now - skipAt) / 520); x = Math.min(1, x);
const p = prog(x), n = Math.round(p * 100);
const hold = x >= 1 && !pre.settled && now - t0 < DUR + 3500;
fill.style.transform = `scaleX(${hold ? .99 : p})`; pct.textContent = (hold ? 99 : n) + '%';
logLi.forEach((li, k) => { const a = k / logLi.length, b = (k + 1) / logLi.length, on = p >= a, dn = p >= b && !(hold && k === logLi.length - 1);
li.classList.toggle('on', on && !dn); li.classList.toggle('dn', dn);
const em = li.querySelector('em'); if(on){ const t = fillTxt(em.dataset.t); if(em.textContent !== t) em.textContent = t; } });
const si = p < .34 ? 0 : p < .7 ? 1 : 2; if(si !== lastSt){ lastSt = si; st.textContent = sc.st[si]; }
try{ scene.tick && scene.tick(p, now - t0, x); }catch(err){ console.error('loader tick', err); scene.tick = null; }
if(x >= 1 && !hold) close(); else raf = requestAnimationFrame(frame);
};
el.addEventListener('click', () => { if(finished || performance.now() - t0 < 900 || skipFrom) return; skipFrom = Math.min(.96, (performance.now() - t0) / DUR); skipAt = performance.now(); });
raf = requestAnimationFrame(frame);
setTimeout(close, DUR + 4200);
}
const FX = {
sm(a, b, x){ const u = nlClamp((x - a) / (b - a)); return u * u * (3 - 2 * u); },
fit(sc){
const el = sc.el, W = el.clientWidth || innerWidth, H = el.clientHeight || innerHeight, cv = sc.cv;
const dpr = Math.min(2, window.devicePixelRatio || 1, Math.sqrt((W > 900 ? 1.5e6 : 2.3e6) / Math.max(1, W * H)));
if(cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)){ cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
const c = sc.c; c.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, W, H, dpr];
},
cam(C, T, W, H, fm = 1.15, cyf = .45){
let f = [T[0] - C[0], T[1] - C[1], T[2] - C[2]]; const fl = Math.hypot(f[0], f[1], f[2]) || 1; f = f.map(v => v / fl);
let r = [-f[2], 0, f[0]]; const rl = Math.hypot(r[0], r[2]) || 1; r = [r[0] / rl, 0, r[2] / rl];
const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
const F = Math.min(W, H) * fm, CX = W / 2, CY = H * cyf;
const P = (x, y, z) => { const vx = x - C[0], vy = y - C[1], vz = z - C[2], zc = vx * f[0] + vy * f[1] + vz * f[2]; if(zc < 12) return null; return [CX + (vx * r[0] + vy * r[1] + vz * r[2]) * F / zc, CY - (vx * u[0] + vy * u[1] + vz * u[2]) * F / zc, zc]; };
P.C = C; P.F = F; return P;
},
box(c, P, x0, y0, z0, w, h, d, side, top, edge, lw = 1){
const x1 = x0 + w, y1 = y0 + h, z1 = z0 + d, C = P.C;
const V = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], v = V.map(q => P(q[0], q[1], q[2]));
if(v.some(q => !q)) return null;
const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2, zm = (z0 + z1) / 2;
const faces = [[[0, 1, 5, 4], [0, 0, -1], [xm, ym, z0]], [[1, 2, 6, 5], [1, 0, 0], [x1, ym, zm]], [[2, 3, 7, 6], [0, 0, 1], [xm, ym, z1]], [[3, 0, 4, 7], [-1, 0, 0], [x0, ym, zm]], [[4, 5, 6, 7], [0, 1, 0], [xm, y1, zm]], [[0, 3, 2, 1], [0, -1, 0], [xm, y0, zm]]];
c.lineWidth = lw; c.strokeStyle = edge; c.lineJoin = 'round';
for(const [ix, n, ctr] of faces){
if(n[0] * (C[0] - ctr[0]) + n[1] * (C[1] - ctr[1]) + n[2] * (C[2] - ctr[2]) <= 0) continue;
c.fillStyle = n[1] === 1 ? top : side; c.beginPath(); ix.forEach((k, i) => i ? c.lineTo(v[k][0], v[k][1]) : c.moveTo(v[k][0], v[k][1])); c.closePath(); c.fill(); if(edge) c.stroke();
}
return v;
},
line(c, P, a, b, style, w = 1){ const p = P(a[0], a[1], a[2]), q = P(b[0], b[1], b[2]); if(!p || !q) return; c.strokeStyle = style; c.lineWidth = w; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); },
flag(c, P, W, x, y, z, text, on, acc, stem = 48, alpha = 1){
const q = P(x, y, z); if(!q) return; c.globalAlpha = alpha;
c.strokeStyle = on ? acc : 'rgba(239,234,224,.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(q[0], q[1] - stem); c.stroke();
c.fillStyle = on ? acc : '#0b0b0a'; c.beginPath(); c.arc(q[0], q[1], 3.2, 0, 7); c.fill(); c.stroke();
c.font = '600 10px "LX Text",Inter,sans-serif'; c.textBaseline = 'middle'; const tw = c.measureText(text).width + 16, lx = q[0] + tw > W - 14 ? q[0] - tw : q[0], top = q[1] - stem;
c.fillStyle = on ? acc : 'rgba(11,11,10,.86)'; c.fillRect(lx, top - 22, tw, 22); if(!on){ c.strokeStyle = 'rgba(239,234,224,.45)'; c.strokeRect(lx + .5, top - 21.5, tw - 1, 21); }
c.fillStyle = on ? '#0b0b0a' : '#efeae0'; c.fillText(text, lx + 8, top - 11); c.globalAlpha = 1;
},
hud(l, r, list){
return `<canvas class="fx-cv"></canvas><i class="fx-shade"></i>
<div class="fx-hud">
<div class="fx-h l"><small>${l[0]}</small><b class="fx-num" data-k="l">${l[1]}</b><span class="fx-sub" data-k="ls">${l[2]}</span></div>
<div class="fx-h r"><small>${r[0]}</small><b class="fx-num" data-k="r">${r[1]}</b><span class="fx-sub" data-k="rs">${r[2]}</span></div>
${list ? `<ol class="fx-list">${list.map(([t, n]) => `<li><i></i><b>${t}</b><span>${n}</span></li>`).join('')}</ol>` : ''}
</div>`;
},
init(sc, el){
sc.el = el; sc.cv = $('.fx-cv', el); sc.c = sc.cv.getContext('2d'); sc.hk = {}; sc.hv = {};
$$('[data-k]', el).forEach(n => sc.hk[n.dataset.k] = n); sc.li = $$('.fx-list li', el);
},
set(sc, k, v){ if(sc.hv[k] === v) return; sc.hv[k] = v; const n = sc.hk[k]; if(n) n.innerHTML = v; },
num(n){ return String(Math.round(n)).replace(/\B(?=(\d{3})+$)/g, ' '); },
pad(n){ return String(n).padStart(2, '0'); }
};
const FX0 = {
fx: 1, dur: 7600, bgc: '#06120d', glow: 'rgba(71,240,160,.10)', a: '#47f0a0', b: '#efeae0',
tag: 'Каждый день. Ровно к 07:50.', st: ['Строим маршрут…', 'Считаем шаги…', 'Пришёл в ЛТПИТУ'],
bg: () => FX.hud(['Время', '07:41', 'В пути <i>00:00</i>'], ['Шагов', '0', '<i>0,00</i> км'],
[['07:41', 'Общежитие'], ['07:44', 'Остановка'], ['07:47', 'Переход'], ['07:50', 'Техникум ЛТПИТУ']]),
mid: () => '',
init(el){
FX.init(this, el);
this.pts = [[100, 1000], [100, 800], [300, 800], [300, 700], [600, 700], [600, 400], [700, 400], [700, 260], [500, 260]];
this.wp = [[0, '07:41', 'ОБЩЕЖИТИЕ'], [2, '07:44', 'ОСТАНОВКА'], [5, '07:47', 'ПЕРЕХОД'], [8, '07:50', 'ЛТПИТУ']];
this.cum = [0]; for(let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.pts[i][0] - this.pts[i - 1][0], this.pts[i][1] - this.pts[i - 1][1])); this.L = this.cum[this.cum.length - 1];
this.lm = { x: 400, z: 108, w: 200, d: 132, h: 74 };
const r = nlRnd(91); this.box = [];
const nearRoute = (x, z) => { for(let i = 1; i < this.pts.length; i++){ const [ax, az] = this.pts[i - 1], [bx, bz] = this.pts[i]; if(x > Math.min(ax, bx) - 60 && x < Math.max(ax, bx) + 60 && z > Math.min(az, bz) - 60 && z < Math.max(az, bz) + 60) return true; } return false; };
for(let cx = -3; cx < 12; cx++) for(let cz = -2; cz < 14; cz++){
const x0 = cx * 100 + 16, z0 = cz * 100 + 16; if(x0 + 68 > this.lm.x - 10 && x0 < this.lm.x + this.lm.w + 10 && z0 + 68 > this.lm.z - 10 && z0 < this.lm.z + this.lm.d + 10) continue;
if(r() < .14) continue; const near = nearRoute(x0 + 34, z0 + 34), h = () => (near ? 7 + r() * 14 : 12 + r() * 40) * (r() < .07 ? 1.9 : 1);
if(r() < .45){ this.box.push([x0, z0, 32, 68, h()], [x0 + 36, z0, 32, 68, h()]); } else this.box.push([x0, z0, 68, 68, h()]);
}
},
pos(d){ d = nlClamp(d, 0, this.L); let i = 1; while(i < this.cum.length - 1 && this.cum[i] < d) i++; const u = (d - this.cum[i - 1]) / (this.cum[i] - this.cum[i - 1] || 1), A = this.pts[i - 1], B = this.pts[i]; return [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, Math.atan2(B[1] - A[1], B[0] - A[0])]; },
tick(p, t, x){
const [c, W, H] = FX.fit(this), ACC = '#47f0a0', INK = '239,234,224', sm = FX.sm;
const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#071a12'); bg.addColorStop(1, '#030806'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
const g = nlClamp((x - .08) / .54), d = this.L * (g < .5 ? 2 * g * g : 1 - Math.pow(-2 * g + 2, 2) / 2), [wx, wz, wa] = this.pos(d), arrived = x >= .62;
const lm = this.lm, front = [lm.x + lm.w / 2, lm.z + lm.d];
const inA = sm(.01, .16, x), hold = sm(.6, .7, x), outA = sm(.9, 1, x), wide = W / H > 1 ? 1.5 : 1, mid = [420, 600];
const fx = wx + Math.cos(wa) * 40, fz = wz + Math.sin(wa) * 40;
let tx = mid[0] + (fx - mid[0]) * inA, tz = mid[1] + (fz - mid[1]) * inA, ty = 0;
tx += (front[0] - tx) * hold; tz += (front[1] - 30 - tz) * hold; ty += 30 * hold;
tx += (mid[0] - tx) * outA; tz += (mid[1] - tz) * outA; ty -= ty * outA;
let dist = (1250 + (330 - 1250) * inA) * wide, hgt = (1050 + (260 - 1050) * inA) * wide, yaw = -1.1 + (-.55 + g * 1.1 + 1.1) * inA;
const hy = -.32 + (x - .62) * 1.9; dist += (430 * wide - dist) * hold; hgt += (150 * wide - hgt) * hold; yaw += (hy - yaw) * hold;
dist += (1150 * wide - dist) * outA; hgt += (1350 * wide - hgt) * outA; yaw += (.35 - yaw) * outA;
const C = [tx + Math.sin(yaw) * dist, hgt, tz + Math.cos(yaw) * dist], P = FX.cam(C, [tx, ty, tz], W, H, 1.15, W < 700 ? .44 : .47);
const fog = z => nlClamp(1.35 - z / 1900);
c.lineWidth = 1;
for(let i = -3; i <= 12; i++) for(let j = -2; j <= 13; j++){
const a1 = P(i * 100, 0, j * 100), a2 = P(i * 100, 0, j * 100 + 100), b2 = P(i * 100 + 100, 0, j * 100);
if(a1 && a2){ c.strokeStyle = `rgba(${INK},${fog((a1[2] + a2[2]) / 2) * .12})`; c.beginPath(); c.moveTo(a1[0], a1[1]); c.lineTo(a2[0], a2[1]); c.stroke(); }
if(a1 && b2){ c.strokeStyle = `rgba(${INK},${fog((a1[2] + b2[2]) / 2) * .12})`; c.beginPath(); c.moveTo(a1[0], a1[1]); c.lineTo(b2[0], b2[1]); c.stroke(); }
}
const seg = (d0, d1, style, w, dash) => { c.strokeStyle = style; c.lineWidth = w; c.setLineDash(dash || []); c.beginPath(); let first = true; for(let s = d0; s <= d1 + .01; s += 8){ const [px, pz] = this.pos(Math.min(s, d1)); const q = P(px, 0, pz); if(!q){ first = true; continue; } first ? c.moveTo(q[0], q[1]) : c.lineTo(q[0], q[1]); first = false; } c.stroke(); c.setLineDash([]); };
seg(0, this.L, `rgba(${INK},.3)`, 1, [4, 6]);
if(d > 1){ seg(0, d, ACC, 2.6); seg(Math.max(0, d - 70), d, '#ffffff', 3.2); }
for(let k = Math.max(0, Math.floor((d - 320) / 13)); k * 13 <= d; k++){
const [px, pz, a] = this.pos(k * 13), side = k % 2 ? 1 : -1, ox = Math.cos(a + 1.5708) * 7 * side, oz = Math.sin(a + 1.5708) * 7 * side;
const q1 = P(px + ox - Math.cos(a) * 3, 0, pz + oz - Math.sin(a) * 3), q2 = P(px + ox + Math.cos(a) * 3, 0, pz + oz + Math.sin(a) * 3); if(!q1 || !q2) continue;
c.strokeStyle = `rgba(${INK},${(nlClamp(1 - (d - k * 13) / 320) * .8).toFixed(3)})`; c.lineWidth = 2; c.beginPath(); c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); c.stroke();
}
const cullR = (dist + 520) ** 2, list = this.box.filter(b => (b[0] + 34 - tx) ** 2 + (b[1] + 34 - tz) ** 2 < cullR).map(b => [b, (b[0] + b[2] / 2 - C[0]) ** 2 + (b[1] + b[3] / 2 - C[2]) ** 2]);
list.push([null, (lm.x + lm.w / 2 - C[0]) ** 2 + (lm.z + lm.d / 2 - C[2]) ** 2]); list.sort((a, b) => b[1] - a[1]);
for(const [b] of list){
if(b){ const q0 = P(b[0] + 34, b[4], b[1] + 34); if(!q0) continue; const al = fog(q0[2]); if(al < .03) continue; FX.box(c, P, b[0], 0, b[1], b[2], b[4], b[3], '#08150f', '#0c1c14', `rgba(${INK},${(al * .6).toFixed(3)})`); continue; }
const glowOn = sm(.6, .66, x), v = FX.box(c, P, lm.x, 0, lm.z, lm.w, lm.h, lm.d, '#0a1c14', '#0f2419', arrived ? 'rgba(71,240,160,.95)' : `rgba(${INK},.8)`, 1.4);
if(!v) continue;
if(C[2] > lm.z + lm.d){
const TL = v[7], TR = v[6], BL = v[3]; c.save(); c.transform((TR[0] - TL[0]) / lm.w, (TR[1] - TL[1]) / lm.w, (BL[0] - TL[0]) / lm.h, (BL[1] - TL[1]) / lm.h, TL[0], TL[1]);
c.fillStyle = `rgba(239,234,224,${.12 + glowOn * .25})`; for(let wy = 30; wy < 62; wy += 14) for(let wx2 = 10; wx2 < lm.w - 10; wx2 += 16){ if(wx2 > 84 && wx2 < 116) continue; c.fillRect(wx2, wy, 9, 8); }
c.fillStyle = arrived ? ACC : 'rgba(239,234,224,.35)'; c.fillRect(88, 46, 24, 28);
c.fillStyle = `rgba(6,18,13,.95)`; c.fillRect(30, 6, lm.w - 60, 20);
c.strokeStyle = arrived ? ACC : 'rgba(239,234,224,.7)'; c.lineWidth = .8; c.strokeRect(30, 6, lm.w - 60, 20);
c.fillStyle = arrived ? ACC : '#efeae0'; c.font = '800 15px "LX Display",Inter,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ЛТПИТУ', lm.w / 2, 16.5); c.textAlign = 'left';
c.restore();
}
}
this.wp.forEach(([pi, tm, name], i) => { const [px, pz] = this.pts[pi], q = P(px, 0, pz); if(!q) return; const on = d >= this.cum[pi] - 1, last = i === this.wp.length - 1; if(last && arrived) return; FX.flag(c, P, W, px, 0, pz, tm + '  ' + name, on, ACC, 54, fog(q[2])); });
if(arrived){ const a = sm(.62, .68, x); FX.flag(c, P, W, front[0], lm.h + 6, lm.z + lm.d / 2, '07:50 · ПРИШЁЛ · ТЕХНИКУМ ЛТПИТУ', true, ACC, 40 + a * 30, a); }
const q = P(wx, 0, wz);
if(q && g > 0){ const ph = (t / 1000) % 1.4 / 1.4; c.strokeStyle = `rgba(71,240,160,${(1 - ph) * .9})`; c.lineWidth = 1.2; c.beginPath(); c.ellipse(q[0], q[1], 6 + ph * 26, (6 + ph * 26) * .45, 0, 0, 7); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(q[0], q[1], 4.5, 0, 7); c.fill(); c.strokeStyle = ACC; c.lineWidth = 2; c.stroke(); }
const sec = Math.round(g * 540), mm = 41 + Math.floor(sec / 60);
FX.set(this, 'l', '07:' + FX.pad(mm)); FX.set(this, 'ls', (arrived ? 'Пришёл · ' : 'В пути ') + '<i>' + FX.pad(Math.floor(sec / 60)) + ':' + FX.pad(sec % 60) + '</i>');
FX.set(this, 'r', FX.num(1080 * g)); FX.set(this, 'rs', '<i>' + (g * .74).toFixed(2).replace('.', ',') + '</i> км');
this.li.forEach((li, i) => li.classList.toggle('on', d >= this.cum[this.wp[i][0]] - 1));
}
};
const FX1 = {
fx: 1, dur: 5600, bgc: '#140e0c', a: '#e5483a', b: '#efeae0',
tag: 'Отсутствует по неуважительной причине.', st: ['Отмечаем присутствующих…', 'Ищем свободное место…', 'Место пустует'],
bg: () => FX.hud(['Отмечено', '0', 'из <i>28</i> по списку'], ['Пропущено, ч', '0', 'за <i>4</i> года']),
mid: () => '',
init(el){ FX.init(this, el); this.rows = 7; this.cols = 8; this.empty = [4, 5]; const r = nlRnd(7); this.jit = Array.from({ length: 64 }, () => r()); },
seat(rw, cl){ return [(cl - (this.cols - 1) / 2) * 66, rw * 22 + 34, 120 + rw * 74]; },
tick(p, t, x){
const [c, W, H] = FX.fit(this), RED = '#e5483a', INK = '239,234,224', sm = FX.sm;
const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1e1411'); bg.addColorStop(1, '#0a0706'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
const wide = W / H > 1 ? .95 : 1, lock = sm(.62, .8, x), [ex, ey, ez] = this.seat(...this.empty);
const yaw = -.28 + x * .4, dist = (760 - lock * 260) * wide, hgt = (430 - lock * 90) * wide;
const T = [ex * lock, 70 + lock * 40, 300 + (ez - 300) * lock], C = [T[0] + Math.sin(yaw) * dist, hgt, T[2] - Math.cos(yaw) * dist], P = FX.cam(C, T, W, H, 1.1, W < 700 ? .45 : .47);
const sx = Math.sin(t / 520) * 230 * (1 - lock) + ex * lock, sz = 120 + ((Math.sin(t / 830) + 1) / 2) * 440 * (1 - lock) + ez * lock;
const spot = P(sx, 0, sz);
if(spot){ const rr = 150 * P.F / spot[2]; const gr = c.createRadialGradient(spot[0], spot[1], 0, spot[0], spot[1], rr); gr.addColorStop(0, `rgba(255,236,214,${.16 + lock * .1})`); gr.addColorStop(1, 'rgba(255,236,214,0)'); c.fillStyle = gr; c.beginPath(); c.ellipse(spot[0], spot[1], rr, rr * .55, 0, 0, 7); c.fill(); }
let marked = 0;
for(let rw = this.rows - 1; rw >= 0; rw--){
const z = 120 + rw * 74, y = rw * 22;
FX.box(c, P, -300, 0, z - 34, 600, y, 74, '#140d0b', '#1a110e', `rgba(${INK},.16)`);
for(let cl = 0; cl < this.cols; cl++){
const [hx, hy, hz] = this.seat(rw, cl), q = P(hx, hy, hz - 6); if(!q) continue; const rr = 13 * P.F / q[2];
const isE = rw === this.empty[0] && cl === this.empty[1], d2 = Math.hypot(hx - sx, hz - sz), lit = nlClamp(1 - d2 / 160);
const order = rw * this.cols + cl, seen = x > .06 + order / 56 * .62;
if(isE){
c.setLineDash([3, 3]); c.strokeStyle = `rgba(229,72,58,${.5 + lock * .5})`; c.lineWidth = 1.4; c.beginPath(); c.arc(q[0], q[1], rr, 0, 7); c.stroke(); c.setLineDash([]);
if(lock > .5){ const pr = (t / 900) % 1; c.strokeStyle = `rgba(229,72,58,${(1 - pr) * .8})`; c.beginPath(); c.arc(q[0], q[1], rr * (1.2 + pr * 1.8), 0, 7); c.stroke(); }
continue;
}
if(seen) marked++;
c.fillStyle = `rgba(${INK},${.18 + lit * .7 + (seen ? .12 : 0)})`; c.beginPath(); c.arc(q[0], q[1], rr, 0, 7); c.fill();
if(seen){ c.strokeStyle = 'rgba(20,14,12,.85)'; c.lineWidth = Math.max(1, rr * .16); c.beginPath(); c.moveTo(q[0] - rr * .4, q[1]); c.lineTo(q[0] - rr * .08, q[1] + rr * .32); c.lineTo(q[0] + rr * .45, q[1] - rr * .32); c.stroke(); }
}
FX.box(c, P, -280, y, z - 46, 560, 26, 16, '#1c1310', '#271a15', `rgba(${INK},.5)`);
}
if(spot){ const top = P(sx * .3, 520, -200); if(top){ const gr = c.createLinearGradient(top[0], top[1], spot[0], spot[1]); gr.addColorStop(0, 'rgba(255,236,214,0)'); gr.addColorStop(1, `rgba(255,236,214,${.06 + lock * .06})`); c.fillStyle = gr; const rr = 150 * P.F / spot[2]; c.beginPath(); c.moveTo(top[0] - 4, top[1]); c.lineTo(top[0] + 4, top[1]); c.lineTo(spot[0] + rr, spot[1]); c.lineTo(spot[0] - rr, spot[1]); c.closePath(); c.fill(); } }
if(lock > .2) FX.flag(c, P, W, ex, ey + 12, ez - 6, 'РЯД 5 · МЕСТО 6 — ПУСТО', true, RED, 46 + lock * 20, sm(.2, .6, lock));
if(x > .82){ const a = sm(.82, .86, x), s = 1 + (1 - a) * .6; c.save(); c.translate(W / 2, H * (W < 700 ? .3 : .32)); c.rotate(-.12); c.scale(s, s); c.globalAlpha = a; c.strokeStyle = RED; c.lineWidth = 3; const bw = Math.min(W * .78, 420); c.strokeRect(-bw / 2, -34, bw, 68); c.lineWidth = 1; c.strokeRect(-bw / 2 + 6, -28, bw - 12, 56); c.fillStyle = RED; c.font = `800 ${Math.min(36, bw / 9)}px "LX Display",Inter,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('НЕ ЯВИЛСЯ', 0, 2); c.restore(); }
FX.set(this, 'l', String(Math.min(27, marked))); FX.set(this, 'r', FX.num(312 * sm(.05, .9, x)));
}
};
const FX2 = {
fx: 1, dur: 6200, bgc: '#0c0617', a: '#ff3a9a', b: '#3ab6ff',
tag: 'Лучшие кадры за четыре года.', st: ['Перематываем плёнку…', 'Ищем лучший кадр…', 'Стоп-кадр'],
bg: () => FX.hud(['Год', '2023', 'Кадр <i>01</i> · плёнка ИС-41'], ['Таймкод', '00:00:00', 'Перемотка']),
mid: () => '',
init(el){
FX.init(this, el);
const noms = $$('.nominee[data-row="Флешбэк"]');
this.ph = noms.map(n => { const src = $('.nominee-front img', n)?.getAttribute('src'), name = ($('.nominee-front h3', n)?.textContent || n.dataset.nominee || '').trim(), im = new Image(); if(src){ im.decoding = 'async'; im.src = src; } return { im, ini: name.split(/\s+/).map(s => s[0] || '').join('').slice(0, 2), name }; });
if(!this.ph.length) this.ph = [{ im: new Image(), ini: 'ИС', name: '' }];
this.K = 18; /* кадр, на котором встанет плёнка */
},
frame(c, A, B, Cc, i, alpha, hot){
const W0 = 220, H0 = 180; c.save(); c.globalAlpha = alpha;
c.transform((B[0] - A[0]) / W0, (B[1] - A[1]) / W0, (Cc[0] - A[0]) / H0, (Cc[1] - A[1]) / H0, A[0], A[1]);
c.fillStyle = '#100820'; c.fillRect(0, 0, W0, H0 + 1);
c.fillStyle = '#04020a'; for(let y = 8; y < H0; y += 30){ c.fillRect(6, y, 11, 15); c.fillRect(W0 - 17, y, 11, 15); }
const p = this.ph[i % this.ph.length], x0 = 28, y0 = 14, w = W0 - 56, h = 132;
if(p.im.complete && p.im.naturalWidth){ const r = Math.max(w / p.im.naturalWidth, h / p.im.naturalHeight), iw = p.im.naturalWidth * r, ih = p.im.naturalHeight * r; c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip(); c.drawImage(p.im, x0 + (w - iw) / 2, y0 + (h - ih) * .3, iw, ih); c.fillStyle = 'rgba(255,58,154,.14)'; c.fillRect(x0, y0, w, h); c.restore(); }
else { const g = c.createLinearGradient(x0, y0, x0 + w, y0 + h); g.addColorStop(0, '#3a1250'); g.addColorStop(1, '#122a4a'); c.fillStyle = g; c.fillRect(x0, y0, w, h); c.fillStyle = 'rgba(239,234,224,.75)'; c.font = '800 54px "LX Display",Inter,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.ini, x0 + w / 2, y0 + h / 2 + 2); c.textAlign = 'left'; }
c.strokeStyle = hot ? '#ff3a9a' : 'rgba(239,234,224,.35)'; c.lineWidth = hot ? 2 : 1; c.strokeRect(x0, y0, w, h);
c.fillStyle = 'rgba(255,58,154,.85)'; c.font = '600 9px "LX Text",Inter,sans-serif'; c.textBaseline = 'alphabetic';
c.fillText(`ИС-41 400  ▸ ${String(i).padStart(2, '0')}A`, x0, y0 + h + 14); c.textAlign = 'right'; c.fillText(String(2023 + Math.floor(i / 6.2)), x0 + w, y0 + h + 14); c.textAlign = 'left';
c.restore();
},
strip(c, pr, cx, cz, tilt, yaw, s, dir, alpha, hotK){
const ct = Math.cos(tilt), st2 = Math.sin(tilt), cy = Math.cos(yaw), sy = Math.sin(yaw);
const P3 = (u, v) => { /* u — поперёк, v — вдоль плёнки */ let X = u, Y = v * ct, Z = v * st2; const X2 = X * cy + Z * sy, Z2 = -X * sy + Z * cy; return pr(cx + X2, Y, cz + Z2); };
const i0 = Math.floor((s - 1100) / 180), i1 = Math.ceil((s + 1100) / 180), list = [];
for(let i = i1; i >= i0; i--){ const v = (i * 180 - s) * dir; const A = P3(-110, v + 90), B = P3(110, v + 90), C2 = P3(-110, v - 90); if(!A || !B || !C2) continue; list.push([A, B, C2, ((i % 1000) + 1000) % 1000, Math.abs(v)]); }
list.sort((m, n) => n[4] - m[4]);
for(const [A, B, C2, i, dv] of list){ const fade = alpha * nlClamp(1.25 - dv / 1000); if(fade > .02) this.frame(c, A, B, C2, i, fade, hotK !== null && i === hotK && dv < 30); }
},
tick(p, t, x){
const [c, W, H] = FX.fit(this), PINK = '#ff3a9a', sm = FX.sm;
const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#170a2c'); bg.addColorStop(1, '#05020b'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
const F = Math.min(W, H) * 1.2, CX = W / 2, CY = H * (W < 700 ? .43 : .46), pr = (X, Y, Z) => Z < 30 ? null : [CX + X * F / Z, CY - Y * F / Z, Z];
const glow = c.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W, H) * .6); glow.addColorStop(0, 'rgba(255,58,154,.16)'); glow.addColorStop(.5, 'rgba(58,182,255,.05)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = glow; c.fillRect(0, 0, W, H);
const u = nlClamp(x / .8), ease = 1 - Math.pow(1 - u, 3), sEnd = this.K * 180, s = sEnd * ease, speed = 3 * Math.pow(1 - u, 2);
const wide = W > H, side = wide ? 520 : 300;
this.strip(c, pr, -side, 1500, -.5, .35, -s * .7 + 400, 1, .45, null);
this.strip(c, pr, side, 1700, -.5, -.35, -s * .55 + 900, 1, .4, null);
const zMain = wide ? 640 : 640; this.strip(c, pr, 0, zMain, -.28 + speed * .04, Math.sin(t / 2400) * .05, s, 1, 1, x > .8 ? this.K : null);
if(speed > .15){ c.strokeStyle = `rgba(239,234,224,${Math.min(.35, speed * .12)})`; c.lineWidth = 1; for(let k = 0; k < 14; k++){ const xx = (k * 97 + t * .3) % W, len = 40 + speed * 60; c.beginPath(); c.moveTo(xx, (k * 131 + t * speed * .9) % H); c.lineTo(xx, (k * 131 + t * speed * .9) % H + len); c.stroke(); } }
if(x > .82){ const a = sm(.82, .95, x), rx = 110 * F / zMain * 1.12, ry = 90 * F / zMain * 1.18; c.strokeStyle = PINK; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); const n = 64; for(let k = 0; k <= n * a; k++){ const an = -1.9 + k / n * Math.PI * 2.15, wob = 1 + Math.sin(k * .7) * .015; const px = CX + Math.cos(an) * rx * wob, py = CY + Math.sin(an) * ry * wob - 6; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke();
if(a > .6){ c.globalAlpha = sm(.6, 1, a); c.fillStyle = PINK; c.font = '600 11px "LX Text",Inter,sans-serif'; c.textAlign = 'center'; c.fillText('СТОП-КАДР · ЛУЧШИЙ МОМЕНТ', CX, CY + ry + 26); c.textAlign = 'left'; c.globalAlpha = 1; } }
const cur = Math.round(s / 180); FX.set(this, 'l', String(2023 + Math.min(4, Math.floor(cur / 4.5)))); FX.set(this, 'ls', 'Кадр <i>' + String(cur + 1).padStart(2, '0') + '</i> · плёнка ИС-41');
const ms = s * 40; FX.set(this, 'r', FX.pad(Math.floor(ms / 60000) % 60) + ':' + FX.pad(Math.floor(ms / 1000) % 60) + ':' + FX.pad(Math.floor(ms / 40) % 25)); FX.set(this, 'rs', x > .8 ? '<i>Стоп-кадр</i>' : speed > .5 ? 'Перемотка <i>×' + Math.ceil(speed * 4) + '</i>' : 'Воспроизведение');
}
};
const FX3 = {
fx: 1, dur: 5600, bgc: '#120d06', a: '#ffb02e', b: '#ffe14a',
tag: 'Смена началась. Пропуска предъявить.', st: ['Запускаем линии…', 'Идёт смена…', 'План выполнен'],
bg: () => FX.hud(['Смена № 3', '07:00', 'Цех <i>№ 4</i>'], ['Единиц', '0', 'план <i>1 200</i>']),
mid: () => '',
init(el){ FX.init(this, el); },
tick(p, t, x){
const [c, W, H] = FX.fit(this), AMB = '#ffb02e', INK = '239,234,224', sm = FX.sm;
const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1c1408'); bg.addColorStop(1, '#080603'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
const wide = W / H > 1 ? 1.15 : 1, yaw = -.75 + x * .5, dist = (900 - x * 180) * wide, hgt = (620 - x * 120) * wide, T = [0, 0, 170];
const C = [Math.sin(yaw) * dist, hgt, T[2] - Math.cos(yaw) * dist], P = FX.cam(C, T, W, H, 1.1, W < 700 ? .46 : .47);
c.lineWidth = 1; for(let i = -8; i <= 8; i++){ FX.line(c, P, [i * 100, 0, -200], [i * 100, 0, 560], `rgba(${INK},.07)`); } for(let j = -2; j <= 5; j++) FX.line(c, P, [-800, 0, j * 100 + 60], [800, 0, j * 100 + 60], `rgba(${INK},.07)`);
for(const zz of [-120, 470]) for(let k = -16; k < 16; k++){ const a = P(k * 50, 0, zz), b = P(k * 50 + 25, 0, zz), cc = P(k * 50 + 45, 0, zz + 20), d2 = P(k * 50 + 20, 0, zz + 20); if(!a || !b || !cc || !d2) continue; c.fillStyle = 'rgba(255,176,46,.22)'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(cc[0], cc[1]); c.lineTo(d2[0], d2[1]); c.closePath(); c.fill(); }
const speed = 120, items = [];
const lines = [0, 170, 340];
const objs = [];
lines.forEach((lz, li) => {
objs.push(['belt', lz]);
for(let k = -6; k < 7; k++){ const xx = ((k * 140 + t / 1000 * speed * (li % 2 ? -1 : 1) + li * 47) % 1820 + 1820) % 1820 - 910; if(Math.abs(xx) > 560) continue; objs.push(['crate', xx, lz, (k + 7 + li * 3) % 9 === 0]); }
});
const gx = Math.sin(t / 1600) * 300; objs.push(['crane', gx]);
const depth = o => { const xx = o[0] === 'crate' ? o[1] : o[0] === 'crane' ? o[1] : 0, zz = o[0] === 'crate' ? o[2] : o[0] === 'crane' ? 170 : o[1]; return (xx - C[0]) ** 2 + (zz - C[2]) ** 2; };
objs.sort((a, b) => depth(b) - depth(a));
let done = 0;
for(const o of objs){
if(o[0] === 'belt'){ const lz = o[1]; FX.box(c, P, -600, 0, lz - 35, 1200, 18, 70, '#17110a', '#1d150b', `rgba(${INK},.5)`); const off = (t / 1000 * speed) % 40; for(let k = -15; k < 15; k++){ FX.line(c, P, [k * 40 + off, 18.5, lz - 35], [k * 40 + off, 18.5, lz + 35], `rgba(${INK},.14)`); } for(const lx of [-560, 560]) FX.box(c, P, lx - 12, 0, lz - 40, 24, 30, 80, '#1d150b', '#2a1f10', `rgba(${INK},.6)`); }
else if(o[0] === 'crate'){ const [, xx, lz, hot] = o; FX.box(c, P, xx - 24, 18, lz - 24, 48, 40, 48, hot ? '#3a280c' : '#1a1309', hot ? AMB : '#231a0c', hot ? AMB : `rgba(${INK},.62)`); }
else { const gx2 = o[1]; FX.box(c, P, gx2 - 10, 0, -150, 20, 300, 20, '#1d150b', '#2a1f10', `rgba(255,176,46,.7)`); FX.box(c, P, gx2 - 10, 0, 500, 20, 300, 20, '#1d150b', '#2a1f10', `rgba(255,176,46,.7)`); FX.box(c, P, gx2 - 14, 300, -150, 28, 22, 670, '#2a1f10', AMB, `rgba(255,176,46,.9)`);
const hz = 170 + Math.sin(t / 900) * 150; FX.line(c, P, [gx2, 300, hz], [gx2, 120, hz], 'rgba(239,234,224,.6)'); FX.box(c, P, gx2 - 14, 104, hz - 14, 28, 16, 28, '#2a1f10', '#3a2a12', AMB); }
}
const units = 1248 * sm(.04, .92, x), hrs = 7 + Math.floor(sm(0, .92, x) * 8);
FX.set(this, 'l', FX.pad(hrs) + ':00'); FX.set(this, 'r', FX.num(units)); FX.set(this, 'rs', units >= 1200 ? 'план <i>выполнен · 104%</i>' : 'план <i>1 200</i>');
}
};
const FX4 = {
fx: 1, dur: 5600, bgc: '#06120b', a: '#e8c26a', b: '#7fdca4',
tag: 'Тишина. Читальный зал.', st: ['Открываем зал…', 'Ищем нужную полку…', 'Зачёт'],
bg: () => FX.hud(['Страниц', '0', 'конспекты · <i>8</i> семестров'], ['Средний балл', '3,0', 'зачётка']),
mid: () => '',
init(el){ FX.init(this, el); const r = nlRnd(4); const pal = ['#2c4a37', '#3b5c45', '#5a4a2a', '#7a6334', '#1f3a2b', '#4b3a24', '#6b6b55', '#2a3f4a']; this.bk = [];
for(const side of [-1, 1]) for(let row = 0; row < 5; row++){ let z = 0; while(z < 2200){ const w = 6 + r() * 10, h = 30 + r() * 14; this.bk.push([side, row, z, w, h, pal[(r() * pal.length) | 0], r() < .04]); z += w + (r() < .06 ? 14 : 1); } } },
tick(p, t, x){
const [c, W, H] = FX.fit(this), GOLD = '#e8c26a', sm = FX.sm;
const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0a1a10'); bg.addColorStop(1, '#030805'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
const cz = -260 + sm(0, .95, x) * 1400, sway = Math.sin(t / 1800) * 10, C = [sway, 110, cz], T = [sway * .3, 100, cz + 400], P = FX.cam(C, T, W, H, .95, W < 700 ? .45 : .46);
const lamp = P(0, 70, 2280); if(lamp){ const rr = 900 * P.F / lamp[2]; const gr = c.createRadialGradient(lamp[0], lamp[1], 0, lamp[0], lamp[1], rr); gr.addColorStop(0, 'rgba(232,194,106,.45)'); gr.addColorStop(1, 'rgba(232,194,106,0)'); c.fillStyle = gr; c.fillRect(lamp[0] - rr, lamp[1] - rr, rr * 2, rr * 2); }
for(const xx of [-60, 0, 60]) FX.line(c, P, [xx, 0, cz + 20], [xx, 0, 2400], 'rgba(239,234,224,.08)');
for(let z = Math.ceil(cz / 160) * 160; z < 2400; z += 160) FX.line(c, P, [-130, 0, z], [130, 0, z], 'rgba(239,234,224,.06)');
FX.box(c, P, -70, 0, 2240, 140, 46, 70, '#13221a', '#1c2e22', 'rgba(232,194,106,.8)');
FX.box(c, P, -30, 46, 2262, 60, 4, 34, '#efeae0', '#efeae0', 'rgba(239,234,224,.9)');
const vis = this.bk.filter(b => b[2] > cz + 30 && b[2] < cz + 1700).sort((a, b) => b[2] - a[2]);
for(const [side, row, z, w, h, col, hot] of vis){
const xf = side * 96, y0 = row * 48 + 4, a = P(xf, y0, z), b = P(xf, y0, z + w), cc = P(xf, y0 + h, z + w), d2 = P(xf, y0 + h, z); if(!a || !b || !cc || !d2) continue;
const fog = nlClamp(1.25 - a[2] / 1600); c.globalAlpha = fog; c.fillStyle = hot ? GOLD : col; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(cc[0], cc[1]); c.lineTo(d2[0], d2[1]); c.closePath(); c.fill();
if(Math.abs(b[0] - a[0]) > 3){ c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.stroke(); const m1 = P(xf, y0 + h * .78, z), m2 = P(xf, y0 + h * .78, z + w); if(m1 && m2){ c.strokeStyle = 'rgba(232,194,106,.5)'; c.beginPath(); c.moveTo(m1[0], m1[1]); c.lineTo(m2[0], m2[1]); c.stroke(); } }
c.globalAlpha = 1;
}
for(const side of [-1, 1]) for(let row = 0; row <= 5; row++) FX.line(c, P, [side * 100, row * 48 + 2, cz + 30], [side * 100, row * 48 + 2, cz + 1700], 'rgba(232,194,106,.28)');
if(x > .8){ const a = sm(.8, .88, x); FX.flag(c, P, W, 0, 50, 2280, 'ЗАЧЁТ · 8 / 8 СЕМЕСТРОВ', true, GOLD, 40, a); }
FX.set(this, 'l', FX.num(4096 * sm(.03, .9, x))); FX.set(this, 'r', (3 + 2 * sm(.05, .9, x)).toFixed(1).replace('.', ','));
}
};
const FX5 = {
fx: 1, dur: 5600, bgc: '#0c0a0d', a: '#ff4d3a', b: '#ffc24a',
tag: 'Зажигание. Контакт. Поехали.', st: ['Зажигание…', 'Набираем скорость…', 'Финиш'],
bg: () => FX.hud(['Скорость', '0', 'км/ч · передача <i>1</i>'], ['Обороты', '0', 'об/мин']),
mid: () => '',
init(el){ FX.init(this, el); const r = nlRnd(55); this.sky = Array.from({ length: 48 }, (_, i) => [i / 48, .2 + r() * .8, r()]); this.z = 0; this.lt = 0; },
tick(p, t, x){
const [c, W, H] = FX.fit(this), RED = '#ff4d3a', AMB = '#ffc24a', sm = FX.sm;
const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#120c0e'); bg.addColorStop(.5, '#1a0d0b'); bg.addColorStop(1, '#050405'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
const kmh = 186 * sm(.04, .85, x) - 30 * sm(.9, 1, x), dt = Math.min(.05, (t - this.lt) / 1000); this.lt = t; this.z += kmh / 3.6 * 12 * dt;
const CY = H * (W < 700 ? .44 : .46), F = Math.min(W, H) * 1.0, camY = 80, CX = W / 2;
const curve = z => Math.sin((z + this.z) / 1400) * 260 - Math.sin(this.z / 1400) * 260;
const pr = (X, Y, z) => { if(z < 10) return null; return [CX + (X + curve(z) - 0) * F / z, CY - (Y - camY) * F / z, z]; };
const hz = CY - (0 - camY) * F / 6000; c.fillStyle = '#0a0709';
this.sky.forEach(([u, h, s]) => { const bw = W / 48 + 1; c.fillRect(u * W, hz - h * 46, bw, h * 46); if(s > .6){ c.fillStyle = 'rgba(255,194,74,.5)'; c.fillRect(u * W + bw * .3, hz - h * 40, 2, 2); c.fillStyle = '#0a0709'; } });
const glow = c.createLinearGradient(0, hz - 80, 0, hz + 10); glow.addColorStop(0, 'rgba(255,77,58,0)'); glow.addColorStop(1, 'rgba(255,77,58,.18)'); c.fillStyle = glow; c.fillRect(0, hz - 80, W, 90);
const road = (X, style, w, dash) => { c.strokeStyle = style; c.lineWidth = w; c.setLineDash(dash || []); c.beginPath(); let f = true; for(let z = 20; z < 6000; z *= 1.08){ const q = pr(X, 0, z); if(!q) continue; f ? c.moveTo(q[0], q[1]) : c.lineTo(q[0], q[1]); f = false; } c.stroke(); c.setLineDash([]); };
road(-240, 'rgba(239,234,224,.7)', 1.4); road(240, 'rgba(239,234,224,.7)', 1.4);
const ph = this.z % 240;
for(let k = 0; k < 40; k++){ const z0 = k * 240 - ph + 20; if(z0 < 160) continue; const a = pr(0, 0, z0), b = pr(0, 0, z0 + 110); if(!a || !b) continue; c.strokeStyle = `rgba(239,234,224,${nlClamp(1.1 - z0 / 6000)})`; c.lineWidth = Math.max(1, 6 * F / z0 * .5); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
const pp = this.z % 300;
for(let k = 0; k < 24; k++){ const z0 = k * 300 - pp + 30; for(const sx of [-330, 330]){ const a = pr(sx, 0, z0), b = pr(sx, 34, z0); if(!a || !b) continue; const al = nlClamp(1.1 - z0 / 6000); c.strokeStyle = `rgba(239,234,224,${al * .6})`; c.lineWidth = Math.max(1, 3 * F / z0); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.fillStyle = sx < 0 ? `rgba(255,77,58,${al})` : `rgba(255,194,74,${al})`; c.fillRect(b[0] - 2, b[1] - 2, 4, 4); } }
const R = Math.min(W, H) * (W < 700 ? .36 : .3), gx = W / 2, gy = CY + R * .15, a0 = Math.PI * .8, a1 = Math.PI * 2.2;
c.lineWidth = 1; for(let v = 0; v <= 240; v += 10){ const a = a0 + (a1 - a0) * v / 240, l = v % 40 === 0 ? 14 : 6; c.strokeStyle = v <= kmh ? (v > 180 ? RED : 'rgba(239,234,224,.9)') : 'rgba(239,234,224,.22)'; c.beginPath(); c.moveTo(gx + Math.cos(a) * R, gy + Math.sin(a) * R); c.lineTo(gx + Math.cos(a) * (R - l), gy + Math.sin(a) * (R - l)); c.stroke(); if(v % 40 === 0){ c.fillStyle = 'rgba(239,234,224,.5)'; c.font = '500 10px "LX Text",Inter,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(v), gx + Math.cos(a) * (R - 28), gy + Math.sin(a) * (R - 28)); } }
c.strokeStyle = RED; c.lineWidth = 2.5; c.beginPath(); c.arc(gx, gy, R + 6, a0, a0 + (a1 - a0) * nlClamp(kmh / 240)); c.stroke(); c.textAlign = 'left';
const gear = Math.min(6, 1 + Math.floor(kmh / 34)), rpm = 1000 + ((kmh % 34) / 34) * 5800 + (gear === 6 ? kmh * 6 : 0);
FX.set(this, 'l', String(Math.round(Math.max(0, kmh)))); FX.set(this, 'ls', 'км/ч · передача <i>' + gear + '</i>'); FX.set(this, 'r', FX.num(kmh < 1 ? 900 : rpm));
}
};
const FX6 = {
fx: 1, dur: 7400, bgc: '#0e0918', a: '#e8c15a', b: '#b86bff',
tag: 'Один король. Одна корона.', st: ['Зал собирается…', 'Претенденты уходят…', 'Корона нашла хозяина'],
bg: () => FX.hud(['Претендентов', '10', 'остаётся <i>один</i>'], ['Номинация', '07 / 07', 'финал']),
mid: () => '',
init(el){
FX.init(this, el); const r = nlRnd(66);
this.rivals = Array.from({ length: 9 }, (_, i) => ({ x: (i - 4) * 105 + (r() - .5) * 30, z: 1150 + r() * 380 })).sort((a, b) => b.z - a.z);
this.order = [3, 6, 1, 8, 0, 5, 2, 7, 4];
this.motes = Array.from({ length: 70 }, () => [r(), r(), r(), r()]);
this.dust = Array.from({ length: 90 }, () => [r() * 2 - 1, r(), r(), r()]);
},
body(c){
c.beginPath(); c.moveTo(-.036, .122); c.lineTo(-.042, .166);
c.bezierCurveTo(-.10, .175, -.188, .178, -.214, .214); c.bezierCurveTo(-.236, .24, -.236, .30, -.232, .36); c.lineTo(-.224, .556);
c.bezierCurveTo(-.222, .586, -.19, .59, -.19, .566); c.lineTo(-.166, .566); c.lineTo(-.162, .602); c.lineTo(-.078, .602);
c.lineTo(-.086, .998); c.lineTo(-.012, .998); c.lineTo(-.008, .642); c.lineTo(.008, .642); c.lineTo(.012, .998); c.lineTo(.086, .998); c.lineTo(.078, .602);
c.lineTo(.162, .602); c.lineTo(.166, .566); c.lineTo(.19, .566); c.bezierCurveTo(.19, .59, .222, .586, .224, .556); c.lineTo(.232, .36);
c.bezierCurveTo(.236, .30, .236, .24, .214, .214); c.bezierCurveTo(.188, .178, .10, .175, .042, .166); c.lineTo(.036, .122); c.closePath();
c.moveTo(.056, .072); c.ellipse(0, .072, .056, .068, 0, 0, Math.PI * 2);
},
person(c, cx, top, h, alpha, hero, cape){
c.save(); c.translate(cx, top); c.scale(h, h); c.globalAlpha = alpha;
const g = c.createLinearGradient(0, 0, 0, 1); g.addColorStop(0, hero ? '#1c1430' : '#140e22'); g.addColorStop(1, '#06040b'); c.fillStyle = g; this.body(c); c.fill();
if(hero){
c.fillStyle = 'rgba(232,193,90,.05)'; c.beginPath(); c.ellipse(0, .06, .05, .05, 0, Math.PI, 0); c.fill();
if(cape > 0){
c.save(); c.beginPath(); c.rect(-1, .16, 2, .84 * cape); c.clip();
const mg = c.createLinearGradient(-.3, 0, .3, 0); mg.addColorStop(0, '#2a0d40'); mg.addColorStop(.35, '#5a1f86'); mg.addColorStop(.55, '#6b2a9c'); mg.addColorStop(.8, '#3a1258'); mg.addColorStop(1, '#1d0730');
c.fillStyle = mg; c.beginPath(); c.moveTo(-.2, .19); c.bezierCurveTo(-.27, .4, -.3, .7, -.34, .99); c.lineTo(.34, .99); c.bezierCurveTo(.3, .7, .27, .4, .2, .19); c.closePath(); c.fill();
c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = .006; for(const fx of [-.16, -.07, .04, .13, .22]){ c.beginPath(); c.moveTo(fx * .6, .24); c.quadraticCurveTo(fx * 1.1, .6, fx * 1.4, .99); c.stroke(); }
c.strokeStyle = 'rgba(232,193,90,.85)'; c.lineWidth = .007; c.beginPath(); c.moveTo(-.2, .19); c.bezierCurveTo(-.27, .4, -.3, .7, -.34, .99); c.moveTo(.2, .19); c.bezierCurveTo(.27, .4, .3, .7, .34, .99); c.stroke();
c.restore();
if(cape > .05){ const ea = Math.min(1, cape * 3); c.globalAlpha = alpha * ea;
c.fillStyle = '#f3efe6'; c.beginPath(); c.moveTo(-.25, .23); c.bezierCurveTo(-.2, .15, -.06, .16, 0, .165); c.bezierCurveTo(.06, .16, .2, .15, .25, .23); c.bezierCurveTo(.2, .27, .06, .25, 0, .26); c.bezierCurveTo(-.06, .25, -.2, .27, -.25, .23); c.fill();
c.fillStyle = '#111'; for(let k = -4; k <= 4; k++){ const x = k * .05, y = .2 + Math.abs(k) * .006; c.beginPath(); c.moveTo(x, y); c.lineTo(x - .006, y + .02); c.lineTo(x + .006, y + .02); c.fill(); }
c.globalAlpha = alpha; }
}
const rg = c.createLinearGradient(-.25, 0, .25, 0); rg.addColorStop(0, 'rgba(232,193,90,.95)'); rg.addColorStop(.3, 'rgba(232,193,90,0)'); rg.addColorStop(.7, 'rgba(184,107,255,0)'); rg.addColorStop(1, 'rgba(184,107,255,.9)');
c.strokeStyle = rg; c.lineWidth = 1.6 / h; this.body(c); c.stroke();
const tg = c.createLinearGradient(0, 0, 0, .2); tg.addColorStop(0, 'rgba(255,240,200,.85)'); tg.addColorStop(1, 'rgba(255,240,200,0)'); c.strokeStyle = tg; c.lineWidth = 2 / h; c.beginPath(); c.ellipse(0, .072, .056, .068, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
}
c.restore();
},
crown(c, cx, by, w, t, sheen){
const h = w * .22, gold = (y0, y1) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#fff3c0'); g.addColorStop(.35, '#efc659'); g.addColorStop(.7, '#c18f2a'); g.addColorStop(1, '#7a5512'); return g; };
const x0 = cx - w / 2, top = by - h;
c.save();
c.fillStyle = '#4a1670'; c.beginPath(); c.moveTo(x0 + w * .08, top); c.bezierCurveTo(x0 + w * .1, top - w * .62, x0 + w * .9, top - w * .62, x0 + w * .92, top); c.closePath(); c.fill();
c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.ellipse(cx - w * .12, top - w * .3, w * .12, w * .16, -.3, 0, 7); c.fill();
c.strokeStyle = gold(top - w * .6, top); c.lineWidth = w * .045; c.lineCap = 'round';
c.beginPath(); c.moveTo(x0 + w * .1, top); c.bezierCurveTo(x0 + w * .12, top - w * .58, cx - w * .08, top - w * .62, cx, top - w * .55); c.stroke();
c.beginPath(); c.moveTo(x0 + w * .9, top); c.bezierCurveTo(x0 + w * .88, top - w * .58, cx + w * .08, top - w * .62, cx, top - w * .55); c.stroke();
c.beginPath(); c.moveTo(cx, top); c.lineTo(cx, top - w * .56); c.stroke();
c.fillStyle = gold(top - w * .76, top - w * .54); c.beginPath(); c.arc(cx, top - w * .62, w * .07, 0, 7); c.fill();
c.fillRect(cx - w * .012, top - w * .82, w * .024, w * .14); c.fillRect(cx - w * .05, top - w * .77, w * .1, w * .022);
const pts = [[.0, .3], [.17, .42], [.33, .32], [.5, .5], [.67, .32], [.83, .42], [1, .3]];
c.fillStyle = gold(top - w * .5, top); c.beginPath(); c.moveTo(x0, top);
pts.forEach(([u, hh], i) => { const px = x0 + w * u, py = top - w * hh; if(i){ const pu = pts[i - 1][0], mx = x0 + w * (pu + u) / 2; c.quadraticCurveTo(mx, top - w * .04, px, py); } else c.lineTo(px, py); });
c.lineTo(x0 + w, top); c.closePath(); c.fill(); c.strokeStyle = 'rgba(90,60,10,.6)'; c.lineWidth = 1; c.stroke();
pts.forEach(([u, hh]) => { const px = x0 + w * u, py = top - w * hh; const pg = c.createRadialGradient(px - w * .01, py - w * .012, 0, px, py, w * .035); pg.addColorStop(0, '#fff'); pg.addColorStop(1, '#d9d2c4'); c.fillStyle = pg; c.beginPath(); c.arc(px, py, w * .032, 0, 7); c.fill(); });
c.fillStyle = gold(top, by); zgRR(c, x0, top, w, h, w * .03); c.fill(); c.strokeStyle = 'rgba(90,60,10,.7)'; c.stroke();
c.strokeStyle = 'rgba(255,243,192,.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0 + 3, top + h * .22); c.lineTo(x0 + w - 3, top + h * .22); c.moveTo(x0 + 3, by - h * .22); c.lineTo(x0 + w - 3, by - h * .22); c.stroke();
const gem = (gx, r, col) => { const gg = c.createRadialGradient(gx - r * .35, top + h / 2 - r * .35, 0, gx, top + h / 2, r); gg.addColorStop(0, '#ffffff'); gg.addColorStop(.25, col); gg.addColorStop(1, '#000'); c.fillStyle = gg; c.beginPath(); c.ellipse(gx, top + h / 2, r * 1.15, r, 0, 0, 7); c.fill(); c.strokeStyle = '#7a5512'; c.lineWidth = 1; c.stroke(); };
gem(cx, h * .34, '#e0314b'); gem(cx - w * .26, h * .26, '#3b7bff'); gem(cx + w * .26, h * .26, '#2fd39a'); gem(cx - w * .43, h * .18, '#b86bff'); gem(cx + w * .43, h * .18, '#b86bff');
c.save(); zgRR(c, x0, top, w, h, w * .03); c.clip(); const sx = x0 - w * .3 + ((t / 1600) % 1.6) * w * 1.6; const sg = c.createLinearGradient(sx, 0, sx + w * .25, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, `rgba(255,255,255,${.55 * sheen})`); sg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sg; c.fillRect(x0, top, w, h); c.restore();
c.restore();
},
tick(p, t, x){
const [c, W, H] = FX.fit(this), GOLD = '#e8c15a', sm = FX.sm, INK = '239,234,224';
const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#160d29'); bg.addColorStop(1, '#05030a'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
const land = .66, landed = x >= land, after = landed ? nlClamp((x - land) / .3) : 0, mob = W < 700;
const cz = -300 + sm(0, 1, x) * 240, C = [Math.sin(t / 3200) * 18, 175, cz], P = FX.cam(C, [0, 160, 1700], W, H, 1.05, mob ? .36 : .4);
const WZ = 1950, wall = [P(-640, 0, WZ), P(640, 0, WZ), P(640, 820, WZ), P(-640, 820, WZ)];
if(wall.every(Boolean)){ c.fillStyle = '#120b20'; c.beginPath(); wall.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); c.fill(); }
for(const wx of [-380, 0, 380]){
const bl = P(wx - 70, 140, WZ), br = P(wx + 70, 140, WZ), tl = P(wx - 70, 520, WZ), tr = P(wx + 70, 520, WZ), ap = P(wx, 600, WZ); if(!bl || !br || !tl || !tr || !ap) continue;
const lit = .35 + after * .5, wg = c.createLinearGradient(0, ap[1], 0, bl[1]); wg.addColorStop(0, `rgba(255,236,190,${lit})`); wg.addColorStop(1, `rgba(184,107,255,${lit * .35})`);
c.fillStyle = wg; c.beginPath(); c.moveTo(bl[0], bl[1]); c.lineTo(tl[0], tl[1]); c.quadraticCurveTo(tl[0], ap[1], ap[0], ap[1]); c.quadraticCurveTo(tr[0], ap[1], tr[0], tr[1]); c.lineTo(br[0], br[1]); c.closePath(); c.fill();
c.strokeStyle = 'rgba(232,193,90,.55)'; c.lineWidth = 1; c.stroke(); c.beginPath(); c.moveTo((bl[0] + br[0]) / 2, bl[1]); c.lineTo(ap[0], ap[1]); c.moveTo(bl[0], (bl[1] + tl[1]) / 2); c.lineTo(br[0], (br[1] + tr[1]) / 2); c.stroke();
const f1 = P(wx - 150, 0, 900), f2 = P(wx + 150, 0, 900); if(f1 && f2){ const sg = c.createLinearGradient(0, tl[1], 0, f1[1]); sg.addColorStop(0, `rgba(255,236,190,${.1 + after * .06})`); sg.addColorStop(1, 'rgba(255,236,190,0)'); c.fillStyle = sg; c.beginPath(); c.moveTo(tl[0], tl[1]); c.lineTo(tr[0], tr[1]); c.lineTo(f2[0], f2[1]); c.lineTo(f1[0], f1[1]); c.closePath(); c.fill(); }
}
for(let iz = 0; iz < 18; iz++) for(let ix = -6; ix < 6; ix++){
const z0 = iz * 110, x0 = ix * 110; if(z0 + 110 < cz + 40) continue;
const a = P(x0, 0, Math.max(z0, cz + 40)), b = P(x0 + 110, 0, Math.max(z0, cz + 40)), cc = P(x0 + 110, 0, z0 + 110), d = P(x0, 0, z0 + 110); if(!a || !b || !cc || !d) continue;
const dark = (ix + iz) % 2 === 0, fog = nlClamp(1.2 - a[2] / 2400);
c.fillStyle = dark ? `rgba(20,13,34,${.95})` : `rgba(58,44,82,${.55 * fog + .2})`; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(cc[0], cc[1]); c.lineTo(d[0], d[1]); c.closePath(); c.fill();
}
const k1 = P(-80, 1, cz + 60), k2 = P(80, 1, cz + 60), k3 = P(80, 1, 1660), k4 = P(-80, 1, 1660);
if(k1 && k2 && k3 && k4){ const kg = c.createLinearGradient(0, k4[1], 0, k1[1]); kg.addColorStop(0, '#4a1222'); kg.addColorStop(1, '#7a1a33'); c.fillStyle = kg; c.beginPath(); c.moveTo(k1[0], k1[1]); c.lineTo(k2[0], k2[1]); c.lineTo(k3[0], k3[1]); c.lineTo(k4[0], k4[1]); c.closePath(); c.fill(); c.strokeStyle = GOLD; c.lineWidth = 1.2; c.beginPath(); c.moveTo(k1[0], k1[1]); c.lineTo(k4[0], k4[1]); c.moveTo(k2[0], k2[1]); c.lineTo(k3[0], k3[1]); c.stroke(); }
for(let s = 0; s < 3; s++) FX.box(c, P, -220 + s * 30, s * 18, 1660 + s * 34, 440 - s * 60, 18, 300, '#1d1430', '#2a1d45', 'rgba(232,193,90,.6)');
const ty = 54; FX.box(c, P, -60, ty, 1780, 120, 56, 70, '#3a1258', '#4a1670', GOLD); FX.box(c, P, -70, ty, 1840, 140, 230, 18, '#2a0d40', '#3a1258', GOLD); FX.box(c, P, -86, ty, 1770, 16, 90, 90, '#2a0d40', '#3a1258', GOLD); FX.box(c, P, 70, ty, 1770, 16, 90, 90, '#2a0d40', '#3a1258', GOLD);
const tc = P(0, ty + 250, 1849); if(tc){ const s = 46 * P.F / tc[2]; this.crown(c, tc[0], tc[1], s, t, .4); }
const cols = []; for(let z = 150; z <= 1650; z += 250) for(const sx of [-360, 360]) cols.push([sx, z]); cols.sort((m, n) => n[1] - m[1]);
for(const [sx, z] of cols){
if(z < cz + 40) continue;
FX.box(c, P, sx - 24, 0, z - 24, 48, 14, 48, '#1d1430', '#2a1d45', 'rgba(232,193,90,.7)');
FX.box(c, P, sx - 18, 14, z - 18, 36, 470, 36, '#160f26', '#1d1430', 'rgba(232,193,90,.45)');
FX.box(c, P, sx - 28, 484, z - 28, 56, 18, 56, '#1d1430', '#2a1d45', 'rgba(232,193,90,.8)');
const ix = sx < 0 ? sx + 20 : sx - 20, a = P(ix, 440, z - 30), b = P(ix, 440, z + 30), cc = P(ix, 200, z + 30), d = P(ix, 200, z - 30), tip = P(ix, 160, z);
if(a && b && cc && d && tip){ const bgr = c.createLinearGradient(0, a[1], 0, tip[1]); bgr.addColorStop(0, '#5a1f86'); bgr.addColorStop(1, '#2a0d40'); c.fillStyle = bgr; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(cc[0], cc[1]); c.lineTo(tip[0], tip[1]); c.lineTo(d[0], d[1]); c.closePath(); c.fill(); c.strokeStyle = 'rgba(232,193,90,.8)'; c.lineWidth = 1; c.stroke();
const m = P(ix, 330, z); if(m){ const rr = 16 * P.F / m[2]; c.strokeStyle = 'rgba(232,193,90,.9)'; c.beginPath(); c.moveTo(m[0] - rr * .6, m[1] + rr * .4); c.lineTo(m[0] - rr * .7, m[1] - rr * .4); c.lineTo(m[0] - rr * .2, m[1]); c.lineTo(m[0], m[1] - rr * .6); c.lineTo(m[0] + rr * .2, m[1]); c.lineTo(m[0] + rr * .7, m[1] - rr * .4); c.lineTo(m[0] + rr * .6, m[1] + rr * .4); c.closePath(); c.stroke(); } }
}
for(const lz of [700, 1300]){ const hk = P(0, 820, lz), ce = P(0, 560, lz); if(!hk || !ce) continue; c.strokeStyle = 'rgba(232,193,90,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(hk[0], hk[1]); c.lineTo(ce[0], ce[1]); c.stroke();
for(let k = 0; k < 10; k++){ const an = k / 10 * 6.283 + t / 4000, q = P(Math.cos(an) * 90, 560, lz + Math.sin(an) * 90); if(!q) continue; const rr = Math.max(1.2, 9 * P.F / q[2]); const fg = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], rr * 3); fg.addColorStop(0, 'rgba(255,230,170,.9)'); fg.addColorStop(1, 'rgba(255,230,170,0)'); c.fillStyle = fg; c.beginPath(); c.arc(q[0], q[1], rr * 3, 0, 7); c.fill(); }
const r0 = P(90, 560, lz), r1 = P(-90, 560, lz); if(r0 && r1){ c.strokeStyle = 'rgba(232,193,90,.55)'; c.beginPath(); c.ellipse(ce[0], ce[1], Math.abs(r0[0] - r1[0]) / 2, Math.abs(r0[0] - r1[0]) / 9, 0, 0, 7); c.stroke(); } }
const prog = sm(.06, .6, x) * 9.999, gone = Math.floor(prog);
for(let i = 0; i < 9; i++){ const rv = this.rivals[i], idx = this.order.indexOf(i), alive = idx >= gone; const q = P(rv.x, 0, rv.z), qh = P(rv.x, 175, rv.z); if(!q || !qh) continue; const hh = q[1] - qh[1];
const al = alive ? .85 : idx === gone - 1 ? (1 - (prog % 1)) * .85 : 0; if(al < .02) continue;
const sp = c.createLinearGradient(0, qh[1] - hh * 1.6, 0, q[1]); sp.addColorStop(0, 'rgba(184,107,255,0)'); sp.addColorStop(1, `rgba(184,107,255,${al * .18})`); c.fillStyle = sp; c.beginPath(); c.moveTo(q[0] - hh * .05, qh[1] - hh * 1.6); c.lineTo(q[0] + hh * .05, qh[1] - hh * 1.6); c.lineTo(q[0] + hh * .3, q[1]); c.lineTo(q[0] - hh * .3, q[1]); c.closePath(); c.fill();
this.person(c, q[0], qh[1], hh, al, false, 0); }
const hf = Math.min(H * (mob ? .8 : .88), W * (mob ? 1.45 : .9)), hx = mob ? W / 2 : W * .6, htop = H * (mob ? .4 : .36);
const dropT = nlClamp((x - .18) / (land - .18)), eased = 1 - Math.pow(1 - dropT, 3), cw = hf * .135, headTop = htop + hf * .006;
const restY = headTop + hf * .068, crownY = -cw + (restY + cw) * eased + (landed ? 0 : Math.sin(t / 380) * hf * .006 * (1 - eased));
const bl = .1 + sm(.3, land, x) * .22 + after * .1; const gb = c.createLinearGradient(0, 0, 0, headTop + hf * .3); gb.addColorStop(0, 'rgba(255,236,190,0)'); gb.addColorStop(1, `rgba(255,236,190,${bl})`); c.fillStyle = gb; c.beginPath(); c.moveTo(hx - hf * .06, 0); c.lineTo(hx + hf * .06, 0); c.lineTo(hx + hf * .3, headTop + hf * .3); c.lineTo(hx - hf * .3, headTop + hf * .3); c.closePath(); c.fill();
this.motes.forEach(([a, b2, s, ph]) => { const mx = hx + (a - .5) * hf * .5 * (b2 + .2), my = ((b2 + t / 9000 * (1 + s)) % 1) * (headTop + hf * .3); const al2 = .25 + .5 * Math.abs(Math.sin(t / 800 + ph * 6)); c.fillStyle = `rgba(255,236,190,${al2 * (.4 + bl)})`; c.fillRect(mx, my, 1.4, 1.4); });
if(landed){ const ra = Math.max(0, 1 - after * 1.4); if(ra > 0){ c.save(); c.translate(hx, restY - cw * .3); for(let k = 0; k < 28; k++){ const an = k / 28 * Math.PI * 2 + t / 3000, len = hf * (.35 + (k % 3) * .15) * (.4 + after); c.strokeStyle = `rgba(255,226,150,${ra * .45})`; c.lineWidth = k % 2 ? 1 : 2.4; c.beginPath(); c.moveTo(Math.cos(an) * cw * .6, Math.sin(an) * cw * .6); c.lineTo(Math.cos(an) * len, Math.sin(an) * len); c.stroke(); } c.restore();
const fl = c.createRadialGradient(hx, restY, 0, hx, restY, hf * .8); fl.addColorStop(0, `rgba(255,226,150,${ra * .45})`); fl.addColorStop(1, 'rgba(255,226,150,0)'); c.fillStyle = fl; c.fillRect(0, 0, W, H); } }
const cape = sm(land + .02, land + .2, x);
this.person(c, hx, htop, hf, 1, true, cape);
this.crown(c, hx, crownY, cw, t, .5 + after * .5);
if(landed){ this.dust.forEach(([dx, dy, s, ph]) => { const tt = (x - land) * 7.4 + ph * .5; if(tt < 0) return; const px = hx + dx * hf * .5 + Math.sin(tt * 3 + ph * 9) * 8, py = restY - hf * .25 + tt * hf * (.15 + s * .25), al3 = Math.max(0, 1 - tt * .7); if(al3 <= 0 || py > H) return; c.fillStyle = `rgba(255,${210 + (s * 40 | 0)},${120 + (s * 80 | 0)},${al3})`; c.save(); c.translate(px, py); c.rotate(tt * 4 + ph * 6); c.fillRect(-1.6 - s * 1.5, -.8, 3.2 + s * 3, 1.6); c.restore(); }); }
if(landed){ const a = sm(land + .06, land + .16, x); c.globalAlpha = a; c.strokeStyle = GOLD; c.lineWidth = 1; const lx = hx + cw * .9, ly = restY - cw * 1.25; c.beginPath(); c.moveTo(hx + cw * .55, restY - cw * .55); c.lineTo(lx, ly); c.lineTo(lx + 22, ly); c.stroke(); c.font = '600 11px "LX Text",Inter,sans-serif'; c.textBaseline = 'middle'; const label = 'КОРОЛЬ ГРУППЫ · 2027', tw = c.measureText(label).width + 16, bx = Math.min(lx + 22, W - tw - 12); c.fillStyle = GOLD; c.fillRect(bx, ly - 11, tw, 22); c.fillStyle = '#0f0a19'; c.fillText(label, bx + 8, ly + 1); c.globalAlpha = 1; }
const vg = c.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .35, W / 2, H * .45, Math.max(W, H) * .8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
FX.set(this, 'l', String(Math.max(1, 10 - gone)).padStart(2, '0')); FX.set(this, 'ls', landed ? 'корона <i>нашла хозяина</i>' : 'остаётся <i>один</i>');
}
};
[FX0, FX1, FX2, FX3, FX4, FX5, FX6].forEach((s, i) => { NL_SCENES[i] = s; });
let _sfBusy = false;
const sfName = () => window._sfName || '';
function sendThenPlay(src, caption, done, meta){
const kind = meta && meta.kind;
const go = kind === 'next' ? done : () => playInterstitial(src, caption, done, meta);
try{ playSendFx(currentNominationIndex, sfName(), go); }catch(err){ console.error('sendfx', err); _sfBusy = false; go(); }
}
const sfSnd = {
tick(){ hmTone(1600, .05, .04, 'square'); },
rustle(){ try{ fxNoise(.22, 3500, .035, 'bandpass'); }catch(_){} },
thud(){ hmTone(78, .32, .12, 'sine'); hmTone(140, .12, .05, 'triangle'); try{ fxNoise(.14, 420, .07, 'lowpass'); }catch(_){} },
chime(){ hmTone(880, .5, .035); setTimeout(() => hmTone(1318, .7, .03), 90); setTimeout(() => hmTone(1760, .9, .02), 180); }
};
const sfDisplayName = name => {
const n = $$('.nominee').find(x => x.dataset.nominee === name), h = n && $('.nominee-front h3', n);
return (h ? h.textContent : name || '').trim();
};
function playSendFx(index, name, done){
if(_sfBusy){ done(); return; }
_sfBusy = true;
const sc = (typeof NL_SCENES !== 'undefined' && NL_SCENES[index]) || {}, acc = sc.a || '#efeae0', bgc = sc.bgc || '#0b0b0a';
const total = typeof TOTAL_NOMS === 'number' ? TOTAL_NOMS : 7, no = String(index + 1).padStart(2, '0'), title = nominationOrder[index] || 'Номинация', who = sfDisplayName(name);
const now = new Date(), stamp = [now.getHours(), now.getMinutes(), now.getSeconds()].map(v => String(v).padStart(2, '0')).join(':');
const el = document.createElement('div'); el.className = 'sv'; el.style.setProperty('--a', acc); el.style.setProperty('--bgc', bgc);
el.innerHTML = `
<i class="sv-bg"></i><i class="sv-rays"></i><i class="sv-glow"></i>
<div class="sv-word" aria-hidden="true"><span>Принято</span></div>
<header class="sv-top"><span>Бюллетень № 0027</span><span>Номинация ${no} / ${String(total).padStart(2, '0')}</span></header>
<div class="sv-stage">
<div class="sv-urn"><i class="sv-lid"></i><i class="sv-slit"></i>
<div class="sv-face"><small>Урна · ИС-41</small><b class="sv-cnt"><span>${no}</span></b><em>голос в номинации</em><i class="sv-led"></i></div></div>
<div class="sv-clip"><div class="sv-ballot">
<div class="sv-half sv-tophalf">
<div class="sv-row"><span>Бюллетень № 0027</span><span>${no} / ${String(total).padStart(2, '0')}</span></div>
<h3>${esc(title)}</h3>
<i class="sv-crease"></i>
</div>
<div class="sv-half sv-bot"><div class="sv-f">
<small>Твой выбор</small>
<div class="sv-pick"><span class="sv-box"><svg viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M4 13l5 5L20 6"/></svg></span><b>${esc(who)}</b></div>
<div class="sv-sign"><span>подпись</span><em>ИС-41</em></div>
</div><div class="sv-k"></div></div>
</div></div>
</div>
<footer class="sv-cap"><span class="sv-st"><i></i><em>Запечатываем бюллетень…</em></span><span class="sv-time">${stamp}</span></footer>`;
document.body.appendChild(el);
const st = $('.sv-st em', el), timers = []; const at = (ms, fn) => timers.push(setTimeout(fn, ms));
let ended = false;
const end = () => { if(ended) return; ended = true; timers.forEach(clearTimeout); done(); setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); _sfBusy = false; }, 500); }, 380); };
el.addEventListener('click', () => { if(el.classList.contains('drop')) end(); });
requestAnimationFrame(() => el.classList.add('on'));
at(140, () => el.classList.add('s1'));
at(760, () => { el.classList.add('check'); sfSnd.tick(); });
at(1150, () => { el.classList.add('fold'); sfSnd.rustle(); st.textContent = 'Складываем…'; });
at(1650, () => { el.classList.add('drop'); st.textContent = 'Опускаем в урну…'; });
at(2050, () => { el.classList.add('in'); sfSnd.thud(); try{ navigator.vibrate?.([24, 40, 18]); }catch(_){} });
at(2250, () => { el.classList.add('ok'); sfSnd.chime(); st.textContent = 'Голос принят'; });
at(3250, end);
setTimeout(() => { if(!ended) end(); }, 6000);
}
const NOM_BASE = {
'Ходящий':   { cls:'th-hody', badge:'ПРИСУТСТВИЕ', kicker:'ХРОНИКА ПОСЕЩАЕМОСТИ', tab1:'Досье', tab2:'Запись', cat:'Самый Ходящий' },
'Прогульщик':{ cls:'th-progul', badge:'ДЕЛО №', kicker:'ГЛАВНЫЙ ПРОГУЛЬЩИК', tab1:'Версия', tab2:'Алиби', cat:'Главный прогульщик' },
'Победитель':{ cls:'th-win', badge:'ТИТУЛ', kicker:'КОРОЛЬ ГРУППЫ', tab1:'Триумф', tab2:'Архив', cat:'Победитель' },
'Завод':     { cls:'th-zavod', badge:'СМЕНА', kicker:'ЗАВОДЧАНИН ГОДА', tab1:'Бригада', tab2:'Смена', cat:'Заводчанин года' },
'Прилежный': { cls:'th-prilez', badge:'ХАРАКТЕР', kicker:'ПРИЛЕЖНЫЙ СТУДЕНТ', tab1:'Портрет', tab2:'Фокус', cat:'Прилежный студент' },
'Машина':    { cls:'th-mash', badge:'ГАРАЖ', kicker:'МАШИНА ГОДА', tab1:'Водитель', tab2:'Гараж', cat:'Машина года' },
'Флешбэк':   { cls:'th-flash', badge:'ЭПИЗОД', kicker:'ФЛЕШБЭК ГОДА', tab1:'Кадр', tab2:'Реакция', cat:'Флешбэк года' },
'Канал':     { cls:'th-kanal', badge:'ЭФИР', kicker:'КАНАЛ ГОДА', tab1:'Канал', tab2:'Студия', cat:'Канал года' }
};
const PERSON_UX = {
'Кирилл|Ходящий': {
personCls: 'p-kirill-h',
history: () => `
<div class="ux-card ux-stamp">
<div class="ux-stamp-mark">ЯВКА</div>
<div class="ux-stamp-grid">
<span class="on">1</span><span class="on">2</span><span class="on">3</span><span class="on">4</span>
<span class="on">5</span><span class="on">6</span><span class="on">7</span><span class="on">8</span>
</div>
<p class="ux-caption">Четыре года. Почти без пропусков. Совесть группы.</p>
</div>`,
video: () => `<div class="ux-quote">«Кирилл уже в аудитории» — и лень сдаётся.</div>`
},
'Галкин|Ходящий': {
personCls: 'p-galkin-h',
history: () => `
<div class="ux-card ux-contract">
<div class="ux-contract-head">КРОВНЫЙ ДОГОВОР С РАСПИСАНИЕМ</div>
<ul class="ux-list">
<li>Место у окна</li>
<li>Глаза открыты даже на монотонных лекциях</li>
<li>Пропуск = событие</li>
</ul>
</div>`,
video: () => `<div class="ux-note-strict">Мебель, без которой аудитория пустая.</div>`
},
'Полякова|Прогульщик': {
personCls: 'p-polyakova',
history: () => `
<div class="ux-card ux-opt">
<div class="ux-opt-title">ОПТИМИЗАЦИЯ</div>
<p>Доведённый до автоматизма навык отсутствовать. Рекорд: «Я не приду, но вы держитесь».</p>
<div class="ux-bar"><i style="width:92%"></i></div>
</div>`,
video: () => `<div class="ux-case">Дело №01 · Полякова</div>`
},
'Иванова|Прогульщик': {
personCls: 'p-ivanova',
history: () => `
<div class="ux-card ux-busy">
<div class="ux-busy-tag">ЗАНЯТА</div>
<p>«Если меня нет на паре — значит, я занята чем-то важным. Или просто сплю».</p>
<div class="ux-chips"><span>харизма</span><span>появление вовремя</span></div>
</div>`,
video: () => `<div class="ux-quote">Главное — уверенность, что всё успеешь.</div>`
},
'Ролдугин|Победитель': {
personCls: 'p-roldugin-w',
history: () => `
<div class="ux-win-podium">
<div class="ux-win-years">
<span>2024</span><span>2025</span>
</div>
<div class="ux-win-title">Самый спокойный</div>
<p class="ux-win-sub">Дважды. Без шума. Как скала.</p>
</div>
<div class="ux-win-claim">Настоящий победитель не повышает голос.</div>`,
video: () => `<div class="ux-win-seal">СПОКОЙСТВИЕ · СУПЕРСИЛА</div>`
},
'Литнарович|Победитель': {
personCls: 'p-litnarovich-w',
history: () => `
<div class="ux-win-multi">
<div class="ux-win-row"><b>Тоскик года</b><span>2024 · 2025</span></div>
<div class="ux-win-row"><b>Воздухан года</b><span>2025</span></div>
<div class="ux-win-row"><b>Канал года</b><span>2025</span></div>
</div>
<p class="ux-win-sub">Король, который превратил тоску в стиль.</p>`,
video: () => `<div class="ux-win-seal">МУЛЬТИТИТУЛ</div>`
},
'Лукин|Победитель': {
personCls: 'p-lukin-w',
history: () => `
<div class="ux-win-lens">
<div class="ux-lens-ring"></div>
<div class="ux-lens-copy">
<strong>Оператор года · Канал года</strong>
<p>2025. Молча сделал то, что другие только обещают.</p>
</div>
</div>`,
video: () => `<div class="ux-win-seal">КАДР · ПРОСТРАНСТВО</div>`
},
'Сериков|Победитель': {
personCls: 'p-serikov-w',
history: () => `
<div class="ux-win-meme">
<div class="ux-win-years"><span>2024</span><span>2025</span></div>
<div class="ux-win-title">Мем года</div>
<p class="ux-win-sub">Два года подряд диктовал язык чата.</p>
</div>`,
video: () => `<div class="ux-win-seal">ЮМОР · ОРУЖИЕ</div>`
},
'Берсенев Илья и Сенченко Дмитрий|Завод': {
personCls: 'p-zavod-1',
history: () => `
<div class="ux-duo">
<div class="ux-duo-a">Берсенев</div>
<div class="ux-duo-x">×</div>
<div class="ux-duo-b">Сенченко</div>
</div>
<p class="ux-caption">Смена, которая не спрашивает «зачем».</p>`,
video: () => `<div class="ux-shift">СМЕНА А · в цеху</div>`
},
'Голиков Матвей и Сериков Александр|Завод': {
personCls: 'p-zavod-2',
history: () => `
<div class="ux-duo alt">
<div class="ux-duo-a">Голиков</div>
<div class="ux-duo-x">×</div>
<div class="ux-duo-b">Сериков</div>
</div>
<p class="ux-caption">Два станка — один ритм.</p>`,
video: () => `<div class="ux-shift">СМЕНА Б · без выходных</div>`
},
'Лукин Александр и Чертовских Андрей|Завод': {
personCls: 'p-zavod-3',
history: () => `
<div class="ux-duo">
<div class="ux-duo-a">Лукин</div>
<div class="ux-duo-x">×</div>
<div class="ux-duo-b">Чертовских</div>
</div>
<p class="ux-caption">Точность и характер в одной бригаде.</p>`,
video: () => `<div class="ux-shift">СМЕНА В · до сигнала</div>`
},
'Куликов Виталий и Сидоров Никита|Завод': {
personCls: 'p-zavod-4',
history: () => `
<div class="ux-duo alt">
<div class="ux-duo-a">Куликов</div>
<div class="ux-duo-x">×</div>
<div class="ux-duo-b">Сидоров</div>
</div>
<p class="ux-caption">Тихие, но незаменимые.</p>`,
video: () => `<div class="ux-shift">СМЕНА Г · последняя</div>`
},
'Галкин Виталий|Прилежный': {
personCls: 'p-galkin-pr',
history: () => `
<div class="ux-focus-card">
<div class="ux-focus-label">СИЛА</div>
<h4>Спокойствие</h4>
<p>Не демонстрация. Состояние по умолчанию.</p>
</div>`,
video: () => `<div class="ux-focus-meter"><i style="width:94%"></i><span>устойчивость</span></div>`
},
'Алиев Александр|Прилежный': {
personCls: 'p-aliev-pr',
history: () => `
<div class="ux-focus-card dark">
<div class="ux-focus-label">ЩИТ</div>
<h4>Ничто не выведет</h4>
<p>Равновесие, которое не продаётся.</p>
</div>`,
video: () => `<div class="ux-focus-meter dark"><i style="width:97%"></i><span>непробиваемость</span></div>`
},
'Караев Эльчин|Прилежный': {
personCls: 'p-karaev-pr',
history: () => `
<div class="ux-focus-card zen">
<div class="ux-focus-label">ДЗЕН</div>
<h4>В человеческом облике</h4>
<p>Тишина, в которой всё на своих местах.</p>
</div>`,
video: () => `<div class="ux-focus-meter zen"><i style="width:90%"></i><span>присутствие</span></div>`
},
'Фролов Андрей|Прилежный': {
personCls: 'p-frolov-pr',
history: () => `
<div class="ux-focus-card soft">
<div class="ux-focus-label">ПОКОЙ</div>
<h4>Мир и покой</h4>
<p>Без лишних слов. С результатом.</p>
</div>`,
video: () => `<div class="ux-focus-meter soft"><i style="width:88%"></i><span>ясность</span></div>`
},
'Сериков Александр|Машина': {
personCls: 'p-serikov-m',
history: (name) => `
<div class="garage-driver">
<div class="garage-label">ТЕХПАСПОРТ · СЕРИКОВ</div>
<div class="garage-specs">
<div><span>Характер</span><b>лёгкий</b></div>
<div><span>Стиль</span><b>воздух</b></div>
<div><span>Статус</span><b>в строю</b></div>
</div>
</div>`,
video: (name) => `
<div class="garage-stage car-a">
<div class="garage-car" aria-hidden="true"><div class="car-body"></div><div class="car-cabin"></div><div class="car-wheel w1"></div><div class="car-wheel w2"></div><div class="car-light"></div></div>
<div class="garage-plate">СЕРИКОВ</div>
<p class="garage-caption">Лёгкий как воздух. Держит дорогу без лишнего шума.</p>
</div>`
},
'Сенченко Дмитрий|Машина': {
personCls: 'p-senchenko-m',
history: () => `
<div class="garage-driver">
<div class="garage-label">ТЕХПАСПОРТ · СЕНЧЕНКО</div>
<div class="garage-specs">
<div><span>Характер</span><b>парящий</b></div>
<div><span>Стиль</span><b>над суетой</b></div>
<div><span>Статус</span><b>в строю</b></div>
</div>
</div>`,
video: () => `
<div class="garage-stage car-b">
<div class="garage-car" aria-hidden="true"><div class="car-body"></div><div class="car-cabin"></div><div class="car-wheel w1"></div><div class="car-wheel w2"></div><div class="car-light"></div></div>
<div class="garage-plate">СЕНЧЕНКО</div>
<p class="garage-caption">Парит над суетой. Холодный металл, тёплый характер.</p>
</div>`
},
'Фролов Андрей|Машина': {
personCls: 'p-frolov-m',
history: () => `
<div class="garage-driver">
<div class="garage-label">ТЕХПАСПОРТ · ФРОЛОВ</div>
<div class="garage-specs">
<div><span>Характер</span><b>эфирный</b></div>
<div><span>Стиль</span><b>мечтатель</b></div>
<div><span>Статус</span><b>в строю</b></div>
</div>
</div>`,
video: () => `
<div class="garage-stage car-c">
<div class="garage-car" aria-hidden="true"><div class="car-body"></div><div class="car-cabin"></div><div class="car-wheel w1"></div><div class="car-wheel w2"></div><div class="car-light"></div></div>
<div class="garage-plate">ФРОЛОВ</div>
<p class="garage-caption">Эфирный мечтатель. Линии чистые, ход ровный.</p>
</div>`
},
'Самсонов Константин|Машина': {
personCls: 'p-samsonov-m',
history: () => `
<div class="garage-driver">
<div class="garage-label">ТЕХПАСПОРТ · САМСОНОВ</div>
<div class="garage-specs">
<div><span>Характер</span><b>философ</b></div>
<div><span>Стиль</span><b>воздушный</b></div>
<div><span>Статус</span><b>в строю</b></div>
</div>
</div>`,
video: () => `
<div class="garage-stage car-d">
<div class="garage-car" aria-hidden="true"><div class="car-body"></div><div class="car-cabin"></div><div class="car-wheel w1"></div><div class="car-wheel w2"></div><div class="car-light"></div></div>
<div class="garage-plate">САМСОНОВ</div>
<p class="garage-caption">Воздушный философ. Надёжность без пафоса.</p>
</div>`
},
'Караев Эльчин|Флешбэк': {
personCls: 'p-karaev-f',
history: () => `
<div class="ux-flash-panel a">
<div class="ux-flash-tag">ХОДЯЧИЙ МЕМ</div>
<p>Не рассказывает истории — сам становится ими.</p>
</div>`,
video: () => `<div class="ux-flash-react">реакция чата: 🔥🔥🔥</div>`
},
'Лукин Александр|Флешбэк': {
personCls: 'p-lukin-f',
history: () => `
<div class="ux-flash-panel b">
<div class="ux-flash-tag">ГЕНЕРАТОР</div>
<p>Смешное появляется там, где его не ждали.</p>
</div>`,
video: () => `<div class="ux-flash-react">реакция чата: 😂 × ∞</div>`
},
'Сериков Александр|Флешбэк': {
personCls: 'p-serikov-f',
history: () => `
<div class="ux-flash-panel c">
<div class="ux-flash-tag">МЕМНЫЙ КОРОЛЬ</div>
<p>Правила игры писал он. Остальные цитировали.</p>
</div>`,
video: () => `<div class="ux-flash-react">реакция чата: классика</div>`
},
'Литнарович Кирилл|Флешбэк': {
personCls: 'p-litnarovich-f',
history: () => `
<div class="ux-flash-panel d">
<div class="ux-flash-tag">ВОПЛОЩЕНИЕ</div>
<p>Юмор как дыхание. Без усилий — и в точку.</p>
</div>`,
video: () => `<div class="ux-flash-react">реакция чата: сохранено</div>`
},
'Айфон братки|Канал': {
personCls: 'p-aifon',
history: () => `
<div class="ux-broadcast">
<div class="ux-live-bar"><span class="live-dot"></span> LIVE</div>
<h4>Айфон Братки</h4>
<p>Светит ярче всех. Канал, в который возвращаются.</p>
</div>`,
video: () => `<div class="ux-studio">СТУДИЯ · сигнал чистый</div>`
}
};
function resolvePersonKey(nomineeEl){
const name = (nomineeEl.dataset.nominee || '').trim();
const row  = (nomineeEl.dataset.row || '').trim();
if(name && row && PERSON_UX[name + '|' + row]) return name + '|' + row;
// fallback: try short name matches for Ходящий etc.
const short = name.split(/\s+/)[0];
if(short && row && PERSON_UX[short + '|' + row]) return short + '|' + row;
// try full name only if unique enough
for(const k of Object.keys(PERSON_UX)){
if(k.startsWith(name + '|') && name) return k;
}
return null;
}
function getModalTheme(nomineeEl){
const row = (nomineeEl.dataset.row || '').trim();
const base = NOM_BASE[row] || { cls:'th-default', badge:'НОМИНАЦИЯ', kicker:'ДОСЬЕ', tab1:'История', tab2:'Видео', cat: row || 'Номинация' };
const pKey = resolvePersonKey(nomineeEl);
const person = pKey ? PERSON_UX[pKey] : null;
return {
className: [base.cls, person?.personCls || ''].filter(Boolean).join(' '),
badge: base.badge,
kicker: base.kicker,
tab1: base.tab1,
tab2: base.tab2,
category: base.cat,
extraHistory: person?.history || (() => ''),
extraVideo: person?.video || (() => '')
};
}
function openCandidate(nominee, pane){
if(!candidateModal||nominee.classList.contains('selected'))return;
{ const fr = nominee.closest('.nomination-frame'); if(fr?.dataset.fifa || fr?.dataset.wanted || fr?.dataset.trophy || fr?.dataset.zavod || fr?.dataset.garage || fr?.dataset.student || fr?.dataset.flash) return openHod(nominee, pane); }
activeCandidate=nominee;
const photo=$('.nominee-front img',nominee);
const title=$('.nominee-front h3',nominee)?.textContent?.trim()||nominee.dataset.nominee||'';
const row = (nominee.dataset.row || '').trim();
const theme = getModalTheme(nominee);
const historyText = $('.nominee-description',nominee)?.textContent?.trim()||'История этого кандидата скоро появится.';
const single = pane === 'history' || pane === 'video';
candidateModal.className = 'candidate-modal visible ' + theme.className + (single ? ' single single-' + pane : '');
candidateModal.setAttribute('aria-hidden','false');
document.body.classList.add('modal-open');
$('#candidateThemeBadge').textContent = theme.badge;
$('#candidateModalKicker').textContent = single ? theme.kicker + ' · ' + (pane === 'video' ? theme.tab2 : theme.tab1) : theme.kicker;
$('#candidateModalName').textContent = title;
$('#candidateModalPhoto').src = photo?.getAttribute('src') || '';
$('#candidateModalPhoto').alt = photo?.alt || title;
$('#candidateCategory').textContent = theme.category;
setupHero(nominee, row);
$('#candidateModalPhoto').style.display = photo?.getAttribute('src') ? '' : 'none';
if(typeof onCandidateOpened==='function') onCandidateOpened();
$('#candidateHistoryText').textContent = historyText;
const extraH = $('#candidateExtraHistory');
const extraV = $('#candidateExtraVideo');
if(extraH) extraH.innerHTML = typeof theme.extraHistory === 'function' ? theme.extraHistory(title) : '';
if(extraV) extraV.innerHTML = typeof theme.extraVideo === 'function' ? theme.extraVideo(title) : '';
const tab1 = $('#tabHistoryBtn'), tab2 = $('#tabVideoBtn');
if(tab1) tab1.textContent = theme.tab1;
if(tab2) tab2.textContent = theme.tab2;
const preferVideo = single ? pane === 'video' : (row === 'Машина' || !!resolveCandidateVideo(nominee));
$$('.candidate-tab').forEach(b => b.classList.toggle('active', b.dataset.pane === (preferVideo ? 'videoPane' : 'historyPane')));
$$('.candidate-pane').forEach(p => p.classList.toggle('active', p.id === (preferVideo ? 'videoPane' : 'historyPane')));
const videoSrc = resolveCandidateVideo(nominee);
candidateVideo.pause();
candidateVideo.removeAttribute('src');
candidateVideo.load();
candidateVideo.muted = false;
candidateVideo.volume = 1;
candidateVideo.playsInline = true;
candidateVideo.setAttribute('playsinline','');
candidateVideo.setAttribute('webkit-playsinline','');
// Генерируем прикольный placeholder если нет видео
const videoPlaceholder = $('#videoPlaceholder') || (() => {
const div = document.createElement('div');
div.id = 'videoPlaceholder';
div.className = 'video-placeholder';
candidateVideo.parentNode.insertBefore(div, candidateVideo.nextSibling);
return div;
})();
if(row === 'Машина'){
candidateVideo.style.display = videoSrc ? 'block' : 'none';
videoPlaceholder.style.display = 'none';
$('#candidateVideoNote').textContent = videoSrc
? 'Ролик из гаража. Нажми ▶, если не стартовал.'
: 'Портрет машины года.';
} else {
if(videoSrc){
candidateVideo.style.display = 'block';
videoPlaceholder.style.display = 'none';
candidateVideo.src = videoSrc;
candidateVideo.load();
$('#candidateVideoNote').textContent = 'Видео запускается автоматически. Если браузер запретит — нажми ▶.';
} else {
// Показываем прикольный placeholder вместо видео
candidateVideo.style.display = 'none';
videoPlaceholder.style.display = 'flex';
const placeholders = [
{ emoji: '🎬', text: 'Видео в монтаже', subtext: 'Режиссёр ещё не закончил работу' },
{ emoji: '📹', text: 'Камера сломалась', subtext: 'Оператор обещал починить к премии' },
{ emoji: '🎥', text: 'Кассета потерялась', subtext: 'Ищем в архиве с 2024 года' },
{ emoji: '🎞️', text: 'Плёнка засветилась', subtext: 'Придётся снимать заново' },
{ emoji: '📼', text: 'VHS не читается', subtext: 'Видеомагнитофон из 90-х подвёл' },
{ emoji: '🔒', text: 'Видео засекречено', subtext: 'Доступ только у жюри' },
{ emoji: '⏸️', text: 'Пауза на монтаже', subtext: 'Добавляем спецэффекты' },
{ emoji: '🎭', text: 'Кадры за кадром', subtext: 'Снимается прямо сейчас' }
];
const chosen = placeholders[Math.floor(Math.random() * placeholders.length)];
videoPlaceholder.innerHTML = `
<div class="placeholder-content">
<div class="placeholder-emoji">${chosen.emoji}</div>
<div class="placeholder-title">${chosen.text}</div>
<div class="placeholder-subtitle">${chosen.subtext}</div>
</div>
`;
$('#candidateVideoNote').textContent = 'Видео для этого кандидата скоро появится.';
}
}
if(videoSrc && row !== 'Машина' && preferVideo){
const playAttempt = candidateVideo.play();
if(playAttempt && playAttempt.catch) playAttempt.catch(() => {
$('#candidateVideoNote').textContent = 'Браузер заблокировал автозапуск. Нажми ▶ на видео.';
});
}
}
function closeCandidate(){
if(!candidateModal) return;
candidateVideo?.pause();
candidateModal.classList.remove('visible');
candidateModal.className = 'candidate-modal';
candidateModal.setAttribute('aria-hidden','true');
document.body.classList.remove('modal-open');
if(typeof onCandidateClosed==='function') onCandidateClosed();
activeCandidate = null;
const extraH = $('#candidateExtraHistory');
const extraV = $('#candidateExtraVideo');
if(extraH) extraH.innerHTML = '';
if(extraV) extraV.innerHTML = '';
}
$('#tab3')?.addEventListener('click',e=>{const n=e.target.closest('.nominee');if(!n||n.hidden||e.target.closest('button'))return;openCandidate(n);});
$('#tab3')?.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const n=e.target.closest?.('.nominee');if(!n||n.hidden)return;e.preventDefault();openCandidate(n);});
$$('.candidate-tab').forEach(button=>button.addEventListener('click',()=>{
$$('.candidate-tab').forEach(b=>b.classList.toggle('active',b===button));
$$('.candidate-pane').forEach(p=>p.classList.toggle('active',p.id===button.dataset.pane));
if(button.dataset.pane==='videoPane'&&candidateVideo?.src){candidateVideo.muted=false;candidateVideo.volume=1;candidateVideo.play().catch(()=>{$('#candidateVideoNote').textContent='Нажми ▶ на видео, чтобы запустить его со звуком.';});}else if(button.dataset.pane!=='videoPane'&&candidateVideo){candidateVideo.pause();}
}));
$('#candidateClose')?.addEventListener('click',closeCandidate);$('#candidateBack')?.addEventListener('click',closeCandidate);
candidateModal?.addEventListener('click',event=>{if(event.target===candidateModal)closeCandidate();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeCandidate();});
let votePending=false;
function burstAt(el){
const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,acc=getComputedStyle(candidateModal).getPropertyValue('--acc')||'#c7a56a';
const glyph=NOM_BASE[(activeCandidate?.dataset.row||'').trim()]?.glyph||'★';
const frag=document.createDocumentFragment();
for(let i=0;i<16;i++){
const s=document.createElement('i');s.className='burst';s.textContent=i%3?'':glyph;
const a=Math.PI*2*i/16+Math.random()*.4,d=60+Math.random()*80;
s.style.cssText=`left:${cx}px;top:${cy}px;--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d-20}px;--c:${acc};--r:${(Math.random()*360)|0}deg`;
frag.appendChild(s);setTimeout(()=>s.remove(),800);
}
document.body.appendChild(frag);
}
$('#candidateVote')?.addEventListener('click',e=>{
if(!activeCandidate||votePending)return;
votePending=true;const chosen=activeCandidate;
burstAt(e.currentTarget);
try{navigator.vibrate?.(18);tg.HapticFeedback?.notificationOccurred?.('success');}catch(_){}
candidateModal.classList.add('voted');
setTimeout(()=>{votePending=false;candidateModal.classList.remove('voted');closeCandidate();voteFor(chosen);},520);
});
function showCompletion(){frames.forEach(f=>f.classList.remove('current'));const hint=$('#votingHint');if(hint)hint.textContent=`Все ${TOTAL_NOMS} номинаций выбраны. Отправь свой голос.`;const counter=$('#currentStep'),fill=$('#progressFill');if(counter)counter.textContent=String(TOTAL_NOMS).padStart(2,'0');if(fill)fill.style.width='100%';if($('#voteReminder'))$('#voteReminder').style.display='none';if(submitVotes){submitVotes.style.display='flex';submitVotes.scrollIntoView({behavior:'smooth',block:'center'});}if(typeof onVotingComplete==='function')onVotingComplete();}
tg.MainButton?.setText?.('Закрыть');tg.MainButton?.show?.();tg.MainButton?.onClick?.(()=>tg.close());
const THEME_EXTRA = {
'Ходящий':   { glyph:'↦', acc:['#3d5a36','#5b7a4a','#7a8f3a','#2f6b55'] },
'Прогульщик':{ glyph:'✕', acc:['#8a6a9a','#b06a8a','#9a9a5a','#5a8aa0'] },
'Победитель':{ glyph:'★', acc:['#c7a56a','#e0c78a','#8ab4ff','#d08ab0'] },
'Завод':     { glyph:'⚙', acc:['#c78a4a','#6a8aa8','#8a6aa8','#6aa88a'] },
'Прилежный': { glyph:'✎', acc:['#3a5568','#5a8ab0','#3a6a52','#6a5a48'] },
'Машина':    { glyph:'◈', acc:['#5a7aaa','#4a8a6a','#8a6aba','#8a8a8a'] },
'Флешбэк':   { glyph:'❝', acc:['#d06aa8','#6a8ad0','#c7a56a','#b09a50'] },
'Канал':     { glyph:'◉', acc:['#c43c3c','#d0703c','#c4a03c','#8a3cc4'] }
};
Object.keys(THEME_EXTRA).forEach(k => Object.assign(NOM_BASE[k], THEME_EXTRA[k]));
const FRAME_THEME = { 'Ходящий':'Ходящий','Прогульщик':'Прогульщик','Пара':'Победитель','Прорыв':'Завод','Прилежный':'Прилежный','Машина':'Машина','Флешбэк':'Флешбэк','Канал':'Канал' };
const ROM=['I','II','III','IV'], SHIFT=['А','Б','В','Г'];
const CARD_TAG = {
'Ходящий':(i,x)=>'БИЛЕТ №'+x, 'Прогульщик':(i,x)=>'ДЕЛО №'+x, 'Победитель':i=>'ТИТУЛ '+ROM[i],
'Завод':i=>'СМЕНА '+SHIFT[i], 'Прилежный':(i,x)=>'ТЕТРАДЬ '+(i+1), 'Машина':(i,x)=>'А '+x+' ВК',
'Флешбэк':(i,x)=>'КАДР '+x, 'Канал':(i,x)=>'КАНАЛ '+x
};
function initialsOf(text){
const w = String(text||'').trim().split(/\s+/).filter(Boolean);
const i = w.indexOf('и');
if(i > 0 && w[i+1]) return (w[0][0] + w[i+1][0]).toUpperCase();
return ((w[0]||'?')[0] + (w[1]?.[0] || '')).toUpperCase();
}
function ensurePhoto(nominee){
const img = $('.nominee-front img', nominee);
if(!img) return;
const name = $('.nominee-front h3', nominee)?.textContent || nominee.dataset.nominee;
const toMonogram = () => {
const d = document.createElement('div');
d.className = 'monogram'; d.setAttribute('aria-hidden','true');
d.textContent = initialsOf(name);
img.replaceWith(d);
};
img.loading = 'lazy'; img.decoding = 'async';
if(!img.getAttribute('src')) toMonogram();
else img.addEventListener('error', toMonogram, {once:true});
}
(function initFrames(){
frames.forEach(frame => {
const key = FRAME_THEME[frame.dataset.nomination] || '';
frame.dataset.theme = key;
// пустые заготовки не показываем и не даём за них голосовать
$$('.nominee', frame).forEach(n => {
if(!(n.dataset.nominee||'').trim() || !(n.dataset.row||'').trim()) n.hidden = true;
});
$$('.nominee:not([hidden])', frame).forEach((n, i) => {
n.style.setProperty('--acc', NOM_BASE[key]?.acc[i] || '#c7a56a');
n.dataset.idx = String(i + 1).padStart(2, '0');
const front = $('.nominee-front', n);
if(front && !$('.ctag', front)){
const t = document.createElement('span'); t.className = 'ctag'; t.setAttribute('aria-hidden','true');
t.textContent = (CARD_TAG[key] || (x => '№' + x))(i, n.dataset.idx);
front.appendChild(t);
}
n.tabIndex = 0; n.setAttribute('role', 'button');
ensurePhoto(n);
});
});
})();
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hoverCapable = () => window.matchMedia('(hover:hover) and (pointer:fine)').matches;
const fifaList = [];
const FIFA_SCOUT = {
'Кирилл':   { pos:'ХОД', interest:'ВЫСОКИЙ',    fields:[['Стаж','4 года'],['Пропуски','~0'],['Контракт','до диплома']],   attrs:[99,96,97,98,99,95] },
'Галкин':   { pos:'ХОД', interest:'РАСТЁТ',     fields:[['Место','у окна'],['Пропуски','события'],['Контракт','кровный']], attrs:[95,90,93,96,98,94] },
'Алиев':    { pos:'ВХД', interest:'ВЫСОКИЙ',    fields:[['Пропуск','с 1 курса'],['Опоздания','0'],['Доступ','навсегда']], attrs:[97,95,90,96,92,97] },
'Голиков':  { pos:'МАР', interest:'ПО ГРАФИКУ', fields:[['Маршрут','8 станций'],['Задержки','редко'],['Конечная','диплом']], attrs:[96,92,89,94,97,93] },
'Куликов':  { pos:'БУД', interest:'ТОЧНЫЙ',     fields:[['Приход','08:29'],['Будильник','заранее'],['Контракт','до звонка']], attrs:[94,99,86,93,91,95] },
'Берсенев': { pos:'ПЕЧ', interest:'ПОДТВЕРЖДЁН', fields:[['Печатей','8 из 8'],['Зачётка','цела'],['Допуск','есть']], attrs:[95,88,94,97,93,96] }
};
const FIFA_ATTR_LABELS = ['ЯВК','РАН','КОН','УСТ','ТЕР','ДИС'];
const attrTone = v => v >= 90 ? 'hi' : v >= 80 ? 'good' : v >= 70 ? 'mid' : 'low';
function teaserOf(text, max = 150){
const t = String(text || '').replace(/\s+/g, ' ').trim();
if(t.length <= max) return t;
const cut = t.slice(0, max);
const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
return end > 60 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…';
}
function buildFifa(frame){
const noms = $$('.nominee:not([hidden])', frame);
if(!noms.length) return;
const n = noms.length;
const pad = v => String(v).padStart(2, '0');
const catName = NOM_BASE[FRAME_THEME[frame.dataset.nomination]]?.cat || 'Номинация';
const slides = noms.map((nom, i) => {
const full = $('.nominee-front h3', nom)?.textContent.trim() || nom.dataset.nominee || '';
const parts = full.split(/\s+/);
const surname = parts[0] || full, firstName = parts.slice(1).join(' ');
const src = $('.nominee-front img', nom)?.getAttribute('src') || '';
const desc = $('.nominee-description', nom)?.textContent || '';
const acc = nom.style.getPropertyValue('--acc') || '#3d5a36';
const sc = FIFA_SCOUT[nom.dataset.nominee] || FIFA_SCOUT[surname] || { pos:'ХОД', interest:'—', fields:[['Стаж','—'],['Пропуски','—'],['Контракт','—']], attrs:[80,80,80,80,80,80] };
const rating = sc.attrs ? Math.round(sc.attrs.reduce((a, b) => a + b, 0) / sc.attrs.length) : '??';
const photo = src
? `<div class="fp-fig"><img src="${esc(src)}" alt="${esc(full)}" decoding="async" draggable="false"></div>`
: `<div class="fifa-mono" aria-hidden="true">${esc(initialsOf(full))}</div>`;
const cut = /\.png(\?|$)/i.test(src);
return `<article class="fifa-slide" data-i="${i}" style="--acc:${esc(acc)}">
<div class="fifa-card" tabindex="0" role="button" aria-label="${esc(full)}">
<div class="fifa-photo${cut ? ' cut' : ''}">${photo}<i class="fp-streaks" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></i><i class="fp-dust" aria-hidden="true"><b></b><b></b><b></b><b></b></i><i class="fp-ring" aria-hidden="true"></i></div>
<div class="fifa-scout">
<div class="fs-interest"><small>Интерес группы</small><b>${esc(sc.interest)}</b></div>
<div class="fs-pos">${esc(sc.pos)}</div>
<div class="fs-name"><i class="fs-emblem" aria-hidden="true"></i><h3>${esc((firstName[0] || '') ? firstName[0] + '. ' : '')}${esc(surname)}</h3></div>
<div class="fs-rate"><span>◎ ${rating}</span><span>↗</span><span class="fs-no">№ ${pad(i + 1)}</span></div>
<div class="fs-fields">${sc.fields.map(([l, v]) => `<div><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join('')}</div>
<div class="fs-attrs">${(sc.attrs || [null,null,null,null,null,null]).map((v, k) => `<div class="${v == null ? 'mid unk' : attrTone(v)}"><small>${FIFA_ATTR_LABELS[k]}</small><b>${v == null ? '??' : v}</b><i></i></div>`).join('')}</div>
</div>
<div class="fifa-info">
<small>${esc(firstName)}</small>
<h4>${esc(surname)}</h4>
<p class="fifa-teaser">${esc(teaserOf(desc))}</p>
<div class="fifa-actions">
<button type="button" class="fifa-btn" data-act="history">История</button>
<button type="button" class="fifa-btn" data-act="video">Видео</button>
<button type="button" class="fifa-btn fifa-btn-vote" data-act="vote">Голосовать</button>
</div>
</div>
</div>
</article>`;
}).join('');
const wrap = document.createElement('div');
wrap.className = 'fifa';
wrap.innerHTML = `
<div class="fifa-stage" aria-roledescription="carousel" aria-label="${esc(catName)}">
<div class="fifa-bg" aria-hidden="true"><span>${esc(catName)}</span></div>
<div class="fifa-count"><b data-role="cur">01</b><i>/</i>${pad(n)}</div>
<div class="fifa-track">${slides}</div>
<button type="button" class="fifa-arrow prev" aria-label="Предыдущий кандидат">‹</button>
<button type="button" class="fifa-arrow next" aria-label="Следующий кандидат">›</button>
</div>
<div class="fifa-dots" role="tablist">${noms.map((_, i) => `<button type="button" class="fifa-dot" data-go="${i}" aria-label="Кандидат ${i + 1}"></button>`).join('')}</div>
<p class="fifa-hint"><span class="h-hover">Наведи на кандидата — выедет описание</span><span class="h-touch">Нажми на кандидата · листай свайпом</span></p>`;
$('.nominee-subblock', frame).before(wrap);
const st = { frame, noms, n, i: 0, wrap,
slides: $$('.fifa-slide', wrap), dots: $$('.fifa-dot', wrap), cur: $('[data-role="cur"]', wrap) };
fifaList.push(st);
// фото не загрузилось -> монограмма
$$('.fifa-photo img', wrap).forEach(img => img.addEventListener('error', () => {
const d = document.createElement('div'); d.className = 'fifa-mono'; d.setAttribute('aria-hidden', 'true');
d.textContent = initialsOf(img.alt); img.replaceWith(d);
}, {once: true}));
fifaGo(st, 0);
wrap.addEventListener('click', e => {
const arrow = e.target.closest('.fifa-arrow');
if(arrow){ fifaGo(st, st.i + (arrow.classList.contains('next') ? 1 : -1)); return; }
const dot = e.target.closest('.fifa-dot');
if(dot){ fifaGo(st, +dot.dataset.go); return; }
const slide = e.target.closest('.fifa-slide');
if(!slide) return;
const idx = +slide.dataset.i;
if(idx !== st.i){ fifaGo(st, idx); return; }              // тап по соседу — выбрать его
const btn = e.target.closest('[data-act]');
if(btn){
e.stopPropagation();
const nom = st.noms[idx], act = btn.dataset.act;
if(act === 'history' || act === 'video') openCandidate(nom, act);
else if(act === 'vote') voteFor(nom);
return;
}
if(!hoverCapable()) slide.classList.toggle('open');      // телефон: тап показывает/прячет описание
});
wrap.addEventListener('keydown', e => {
if(e.key !== 'Enter' && e.key !== ' ') return;
const card = e.target.closest?.('.fifa-card');
if(!card || e.target !== card) return;
e.preventDefault(); card.closest('.fifa-slide').classList.toggle('open');
});
// свайп
let sx = 0, sy = 0, tracking = false;
const stage = $('.fifa-stage', wrap);
stage.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; tracking = true; }, {passive: true});
stage.addEventListener('touchend', e => {
if(!tracking) return; tracking = false;
const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
if(Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) fifaGo(st, st.i + (dx < 0 ? 1 : -1));
}, {passive: true});
}
function fifaGo(st, idx){
const prev = st.i;
st.i = (idx % st.n + st.n) % st.n;
st.slides.forEach((s, k) => {
const d = (k - st.i + st.n) % st.n;
s.classList.remove('is-active', 'is-prev', 'is-next', 'is-far', 'open');
s.classList.add(d === 0 ? 'is-active' : d === 1 ? 'is-next' : d === st.n - 1 ? 'is-prev' : 'is-far');
$('.fifa-card', s).tabIndex = d === 0 ? 0 : -1;
s.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
});
st.dots.forEach((d, k) => d.classList.toggle('on', k === st.i));
if(st.cur) st.cur.textContent = String(st.i + 1).padStart(2, '0');
if(prev !== st.i && typeof fifaMotion === 'function') fifaMotion(st);
}
document.addEventListener('keydown', e => {
if(e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
if(candidateModal?.classList.contains('visible') || $('#hodModal.visible') || $('#videoInterstitial.visible')) return;
const st = fifaList.find(s => s.frame.classList.contains('current'));
if(st) fifaGo(st, st.i + (e.key === 'ArrowRight' ? 1 : -1));
});
frames.filter(f => f.dataset.fifa).forEach(f => { try{ buildFifa(f); }catch(err){ console.error('buildFifa', err); f.dataset.fb = '1'; } });
const fifaCurrentNominee = () => { const st = fifaList.find(s => s.frame.classList.contains('current')); return st ? st.noms[st.i] : null; };
function setupHero(nominee, row){
const hero = $('#candidateHero');
if(!hero) return;
const frame = nominee.closest('.nomination-frame');
const fi = frames.indexOf(frame);
const sibs = $$('.nominee:not([hidden])', frame);
const vi = Math.max(0, sibs.indexOf(nominee));
const base = NOM_BASE[row];
candidateModal.dataset.v = String(vi);
candidateModal.style.setProperty('--acc', base?.acc?.[vi] || '#c7a56a');
$('.hero-glyph', hero).textContent = base?.glyph || '★';
$('.hero-num', hero).textContent = `${String(fi + 1).padStart(2,'0')} / ${String(TOTAL_NOMS).padStart(2,'0')}`;
$('.hero-idx', hero).textContent = `КАНДИДАТ ${vi + 1} ИЗ ${sibs.length}`;
}
$('#candidateModalPhoto')?.addEventListener('error', e => { e.target.style.display = 'none'; });
const FIFA_MOVE = {
'Кирилл':   { type: 'run',   face: 1 },
'Галкин':   { type: 'knees', face: 1 },
'Алиев':    { type: 'dash',  face: 1 },
'Голиков':  { type: 'drop',  face: 1 },
'Куликов':  { type: 'march', face: 1 },
'Берсенев': { type: 'warp',  face: 1 }
};
let fifaStepT = [];
function fifaSteps(type){
fifaStepT.forEach(clearTimeout); fifaStepT = [];
if(typeof fxNoise !== 'function') return;
const hits = type === 'run' ? [60, 230, 400, 570, 740] : type === 'knees' ? [80, 200, 360, 560] : type === 'march' ? [120, 340, 560, 780] : type === 'drop' ? [330, 400] : type === 'dash' ? [40, 120, 480] : type === 'warp' ? [300, 360] : [420, 520];
hits.forEach((t, k) => fifaStepT.push(setTimeout(() => { try{ type === 'knees' ? fxNoise(.14 - k * .02, 700, .07, 'lowpass') : (type === 'drop' || type === 'march') ? fxNoise(.09, 150, .16, 'lowpass') : type === 'warp' ? fxNoise(.05, 5200, .07, 'highpass') : fxNoise(.045, 240, .09 - k * .008, 'lowpass'); }catch(_){} }, t)));
}
function fifaMotion(st){
const s = st.slides[st.i], nom = st.noms[st.i]; if(!s || !nom) return;
const mv = FIFA_MOVE[nom.dataset.nominee] || FIFA_MOVE[(nom.dataset.nominee || '').split(' ')[0]]; if(!mv) return;
s.classList.remove('mv-run', 'mv-knees', 'mv-cheer', 'mv-dash', 'mv-drop', 'mv-march', 'mv-warp'); void s.offsetWidth;
s.style.setProperty('--f', mv.face || 1); s.classList.add('mv-' + mv.type);
fifaSteps(mv.type);
}
{ const prev = onNominationShown;
onNominationShown = idx => { prev(idx); if(frames[idx]?.dataset.fifa){ const st = fifaList.find(x => x.frame === frames[idx]); if(st) setTimeout(() => fifaMotion(st), 380); } }; }
const COACH_KEY = 'premia2027_coach_v2';
const lsGet = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
const lsSet = (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} };
const coach = { on:false, step:0, timer:0 };
const COACH_STEPS = [
{ kicker:'Шаг 1 из 3', title:'Открой кандидата',
text:'Наведи курсор на кандидата (на телефоне — нажми): выедет описание с кнопками «История», «Видео» и «Голосовать». Листай стрелками или свайпом.',
target:() => $('#tab3 .nomination-frame.current .fifa-slide.is-active .fifa-card') || $('#tab3 .nomination-frame.current .nominee:not([hidden])'), place:'auto',
next:'Открыть' },
{ kicker:'Шаг 2 из 3', title:'Сделай выбор',
text:'Изучи досье и нажми «Голосовать за кандидата». Выбор фиксируется сразу, откроется следующая номинация.',
target:() => $('#hodModal.visible .hm-vote') || $('#candidateVote'), place:'top', next:'Понятно' },
{ kicker:'Шаг 3 из 3', title:'И так — в каждой номинации',
text:`Впереди ещё ${TOTAL_NOMS - 1}. Прогресс виден сверху. После последней появится кнопка «Отправить голос».`,
target:() => $('.progress-track'), place:'bottom', next:'Готово' }
];
function coachClear(){
clearTimeout(coach.timer);
$('#coachCard')?.remove(); $('#coachSpot')?.remove(); $('#coachDim')?.remove();
submitVotes?.classList.remove('coach-pulse');
}
function coachFinish(){ coach.on = false; coachClear(); lsSet(COACH_KEY, '1'); }
function coachPlace(card, target, place){
const r = target.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
const cw = card.offsetWidth, ch = card.offsetHeight, gap = 16;
const below = vh - r.bottom, above = r.top;
const side = place === 'auto' ? (below >= ch + gap || below >= above ? 'bottom' : 'top') : place;
let top = side === 'bottom' ? r.bottom + gap : r.top - ch - gap;
top = Math.max(12, Math.min(top, vh - ch - 12));
let left = r.left + r.width / 2 - cw / 2;
left = Math.max(12, Math.min(left, vw - cw - 12));
card.style.top = top + 'px'; card.style.left = left + 'px';
const arrow = card.querySelector('.coach-arrow');
if(arrow){
arrow.className = 'coach-arrow ' + (top > r.top ? 'top' : 'bottom');
arrow.style.left = Math.max(18, Math.min(cw - 30, r.left + r.width / 2 - left - 6)) + 'px';
}
}
function coachShow(i){
coachClear();
if(!coach.on) return;
const s = COACH_STEPS[i];
if(!s) return coachFinish();
coach.step = i;
const target = s.target();
if(target && i !== 1) target.scrollIntoView({block:'center', behavior:'instant'});
if(target){
const r = target.getBoundingClientRect(), pad = 6;
const spot = document.createElement('div');
spot.id = 'coachSpot'; spot.className = 'coach-spotlight';
spot.style.cssText = `top:${r.top-pad}px;left:${r.left-pad}px;width:${r.width+pad*2}px;height:${r.height+pad*2}px;border-radius:${getComputedStyle(target).borderRadius || '12px'}`;
document.body.appendChild(spot);
} else {
const dim = document.createElement('div'); dim.id = 'coachDim'; dim.className = 'coach-dim';
document.body.appendChild(dim);
}
const card = document.createElement('div');
card.id = 'coachCard'; card.className = 'coach-card';
card.setAttribute('role', 'dialog');
card.innerHTML =
`<div class="coach-steps">${COACH_STEPS.map((_, k) => `<span class="${k <= i ? 'on' : ''}"></span>`).join('')}</div>` +
`<div class="coach-kicker">${s.kicker}</div><h4 class="coach-title">${s.title}</h4><p>${s.text}</p>` +
`<div class="coach-actions"><button type="button" class="coach-skip">Пропустить</button>` +
`<button type="button" class="coach-next">${s.next}</button></div><i class="coach-arrow"></i>`;
document.body.appendChild(card);
if(target) coachPlace(card, target, s.place);
else { card.style.left = '50%'; card.style.top = '50%'; card.style.transform = 'translate(-50%,-50%)'; }
$('.coach-skip', card).addEventListener('click', coachFinish);
$('.coach-next', card).addEventListener('click', () => {
if(i === 0 && target) { coachClear(); openCandidate(target.classList.contains('nominee') ? target : (fifaCurrentNominee() || target), target.classList.contains('nominee') ? undefined : 'history'); }
else if(i === 1) coachClear();
else coachFinish();
});
}
function onNominationShown(index){
if(index === 0 && lsGet(COACH_KEY) !== '1'){
coach.on = true; coach.timer = setTimeout(() => coachShow(0), 450);
} else if(coach.on && index === 1){
coach.step = 2; coachClear();
coach.timer = setTimeout(() => { if(coach.on && coach.step === 2 && !candidateModal.classList.contains('visible') && !$('#hodModal.visible')) coachShow(2); }, 500);
} else if(coach.on && index >= 2){
coachFinish();
}
}
function onCandidateOpened(){
if(!coach.on) return;
if(coach.step > 1){ coachFinish(); return; } // пользователь уже освоился — подсказки не мешают
coachClear();
coach.timer = setTimeout(() => { if(candidateModal.classList.contains('visible') || $('#hodModal.visible')) coachShow(1); }, 420);
}
function onCandidateClosed(){
if(!coach.on || coach.step > 1) return;
coachClear();
// если закрыли без выбора — вернуть первую подсказку
coach.timer = setTimeout(() => { if(!transitionBusy && !$('#videoInterstitial.visible')) coachShow(0); }, 350);
}
function onVotingComplete(){
if(lsGet(COACH_KEY + '_submit') === '1' || !submitVotes) return;
coachClear();
submitVotes.classList.add('coach-pulse');
const card = document.createElement('div');
card.id = 'coachCard'; card.className = 'coach-card';
card.innerHTML = `<div class="coach-kicker">Почти готово</div><h4 class="coach-title">Все номинации выбраны</h4>` +
`<p>Нажми «Отправить голос» — выбор уйдёт в зачёт.</p>` +
`<div class="coach-actions"><span></span><button type="button" class="coach-next">Понятно</button></div><i class="coach-arrow"></i>`;
document.body.appendChild(card);
setTimeout(() => coachPlace(card, submitVotes, 'top'), 380); // после smooth-scroll
card.style.visibility = 'hidden'; setTimeout(() => { card.style.visibility = ''; }, 390);
$('.coach-next', card).addEventListener('click', () => { lsSet(COACH_KEY + '_submit', '1'); coachClear(); });
}
let coachResizeT = 0;
window.addEventListener('resize', () => {
if(!coach.on || !$('#coachCard')) return;
clearTimeout(coachResizeT); coachResizeT = setTimeout(() => coachShow(coach.step), 150);
}, {passive:true});
const HOD = {
'Кирилл': {
key: 'kirill', kicker: 'Ведомость посещаемости', tag: 'Совесть группы',
stats: [[4, 'года на парах'], [8, 'семестров подряд'], ['~0', 'прогулов']],
infoTitle: 'Журнал явки',
quote: ['«Кирилл, ты можешь не приходить на вручение. Ты и так тут четыре года без выходных».', 'Из жизни группы'],
videoTitle: 'Запись №01', videoNote: 'Хроника одного вечного студента.',
facts: ['Утро как ритуал: кофе, дорога, лекция', 'Конспекты «как у стенографиста» — всё и по делу', 'Даже на больничном спрашивал: «Что задали?»'],
ph: ['🗂️', 'Плёнка в архиве', 'Ищем запись с самой первой пары'],
art: () => `<div class="hm-stamp"><span>Присутствовал</span><small>4 года · без выходных</small></div>`,
info: () => `
<div class="k-ledger">
<div class="k-row k-head"><i></i><b>1 сем.</b><b>2 сем.</b></div>
${[1,2,3,4].map(c => `<div class="k-row"><b>${c} курс</b>${[0,1].map(s => `<span class="k-cell" style="--i:${(c-1)*2+s}"><em>✓</em></span>`).join('')}</div>`).join('')}
<p class="k-legend">✓ — присутствовал. Пропуски — только по уважительной причине: болезнь, форс-мажор, всемирный потоп.</p>
</div>
<div class="k-ritual"><span>☕<small>Кофе</small></span><i>→</i><span>🚶<small>Дорога</small></span><i>→</i><span>📓<small>Лекция</small></span></div>`
},
'Галкин': {
key: 'galkin', kicker: 'Место у окна', tag: 'Договор с расписанием, подписанный кровью',
stats: [[4, 'года за партой'], [0, 'снов на лекциях'], [1, 'любимое место']],
infoTitle: 'Карта аудитории',
quote: ['«Галкина нет? Он заболел? Что-то серьёзное?»', 'Вся группа, в тот редкий день'],
videoTitle: 'Вид из окна', videoNote: 'Дождь, зима и ни одного прогула.',
facts: ['Сидит сбоку, поближе к окну — чтобы никто не трогал', 'Глаза открыты даже на самых монотонных лекциях', 'Диплом защитил без пафоса: пришёл, ответил, сел'],
ph: ['🪟', 'Видео у окна', 'Ждём, когда закончится дождь'],
art: () => `<div class="g-window"><i></i><i></i><i></i><i></i><div class="g-rain"></div><div class="g-moon"></div></div>`,
info: () => {
const rows = 5, cols = 7, mine = [2, 0];
let seats = '';
for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++){
const isMine = r === mine[0] && c === mine[1];
seats += `<span class="g-seat${isMine ? ' mine' : ''}" style="--i:${r*cols+c}">${isMine ? '<em>ты здесь</em>' : ''}</span>`;
}
return `
<div class="g-room"><div class="g-wall">окно</div><div class="g-seats">${seats}</div><div class="g-board">доска</div></div>
<ul class="g-contract">
<li><b>Место</b> — сбоку, у окна, ряд 3</li>
<li><b>Глаза</b> — открыты, даже когда все витают в облаках</li>
<li><b>Пропуск</b> — считается событием</li>
<li><b>Статус</b> — надёжная мебель аудитории</li>
</ul>`;
}
},
};
const EXCUSES = [
'Я не прогуливала — я проводила аудит собственной посещаемости.',
'Пара была важная, но сегодня у меня дело ещё важнее.',
'Проснулась ровно в тот момент, когда пара закончилась. Совпадение.',
'Я была. Духовно. Просто в другом месте.',
'Нет, в чате я не отвечала: берегла силы для сессии.',
'Лучше прийти на следующую и всё понять, чем прийти на эту и ничего не понять.',
'Вы не поверите, но у меня был дедлайн по жизни.',
'Я так тихо сидела, что вы меня не заметили. Как раз сегодня.',
'Транспорт, погода и общее мироздание были против.',
'Меня задержали важные люди. Одеяло и подушка.'
];
Object.assign(HOD, {
'Полякова': {
key: 'polyakova', kicker: 'Объяснительная записка', tag: 'Оптимизировала учебный процесс',
stats: [[4, 'года практики'], ['∞', 'уважительных причин'], [92, '% оптимизации', '%']],
infoTitle: 'Объяснительная',
quote: ['«Я не приду, но вы держитесь».', 'Екатерина Полякова, личный рекорд'],
videoTitle: 'Видео-объяснительная', videoNote: 'Читает вслух. С выражением.',
facts: ['Навык отсутствовать доведён до автоматизма', 'Каждая «уважительная» причина — с подписью и датой', 'Оптимизация учебного процесса подтверждена печатью'],
ph: ['📝', 'Объяснительная читается', 'Секретарь деканата ищет очки'],
art: () => `<div class="pl-scrawl">я не приду,<br>но вы держитесь</div><i class="pl-clip"></i>`,
info: () => `
<div class="pl-note">
<p class="pl-to">Декану факультета<br>от студентки <b>Поляковой Е.</b></p>
<h4>Объяснительная</h4>
<p class="pl-lead">Не присутствовала на занятиях по причине <small>(нужное отметить):</small></p>
<ul class="pl-reasons">
<li data-r><i></i>болела</li>
<li data-r><i></i>проспала</li>
<li data-r><i></i>всемирный потоп</li>
<li data-r class="on"><i></i>оптимизировала учебный процесс</li>
</ul>
<p class="pl-hand">Прошу считать это личным рекордом.</p>
<div class="pl-sign"><svg viewBox="0 0 160 46" aria-hidden="true"><path pathLength="1" d="M6 34 C 20 6, 30 6, 28 26 C 26 40, 44 8, 52 24 C 58 36, 70 12, 80 22 C 92 34, 104 14, 118 24 S 146 30, 154 14"/></svg><span>Е. Полякова</span></div>
<div class="pl-stamp"><b>Принято</b><small>без вопросов</small></div>
</div>
<p class="pl-tip">Нажимай на причины — вычёркивай и возвращай.</p>`,
after: root => $$('[data-r]', root).forEach(li => li.addEventListener('click', () => li.classList.toggle('on')))
},
'Иванова': {
key: 'ivanova', kicker: 'Ежедневник занятой', tag: 'Если меня нет — значит, я занята чем-то важным. Или сплю',
stats: [[100, '% уверенность', '%'], [2, 'важных дела в день'], ['?', 'где была']],
infoTitle: 'План на день',
quote: ['«Если меня нет на паре — значит, я занята чем-то важным. Или просто сплю».', 'Маргарита Иванова, философия'],
videoTitle: 'Сторис', videoNote: 'Занята. Перезвонит.',
facts: ['Приходит именно тогда, когда это действительно нужно', 'Главное — не количество пар, а уверенность, что всё успеешь', 'Стабильность, харизма и один тактичный сон'],
ph: ['😴', 'Сторис на паузе', 'Автор занят чем-то важным'],
art: () => `<i class="iv-mark a"></i><i class="iv-mark b"></i><div class="iv-sticky">ЗАНЯТА<small>не беспокоить</small></div>`,
info: () => `
<div class="iv-plan">
<div class="iv-head"><b>Пятница</b><span>План на день</span></div>
<div class="iv-row"><time>08:30</time><span>Пара <s>(сегодня без меня)</s></span></div>
<div class="iv-row"><time>10:00</time><span><mark class="y">Важное дело № 1</mark></span></div>
<div class="iv-row"><time>12:30</time><span><mark class="p">Важное дело № 2</mark></span></div>
<div class="iv-row"><time>14:00</time><span>Сон. <em>Возможно.</em></span></div>
<div class="iv-row circled"><time>17:00</time><span>Появиться там, где нужно</span></div>
</div>
<button type="button" class="iv-gen">Придумать причину</button>
<p class="iv-bubble" id="ivBubble" aria-live="polite">Нажми — получишь отмазку Маргариты.</p>`,
after: root => {
const b = $('.iv-gen', root), out = $('#ivBubble', root); let last = -1;
b?.addEventListener('click', () => {
let k; do { k = Math.floor(Math.random() * EXCUSES.length); } while(k === last); last = k;
out.classList.remove('pop'); void out.offsetWidth; out.textContent = '«' + EXCUSES[k] + '»'; out.classList.add('pop');
});
}
}
});
const WANTED = {
'Полякова': { verb: 'ПРОПАЛА', marks: 'Навык отсутствовать — на уровне автомата. Откликается на «Я не приду, но вы держитесь».', seen: 'На линейке 1 сентября. Дальше — тишина.', reward: 'Конспекты за сентябрь', fix: 'tape', stain: 1, note: 'кофе?' },
'Иванова':  { verb: 'ПРОПАЛА', marks: 'Харизма. Всегда занята чем-то важным. Или [[спит]].', seen: 'Именно тогда, когда это было нужно.', reward: 'Не будить до обеда', fix: 'pin', note: 'не будить!' },
'Фролов':   { verb: 'ПРОПАЛ',  marks: 'Расписание знает наизусть. Именно поэтому [[обходит]] его стороной.', seen: 'Последний раз — у расписания. Читал, кивал, ушёл.', reward: 'Отметка в журнале', fix: 'staple' },
'Самсонов': { verb: 'ПРОПАЛ',  marks: 'Стабильность — его конёк. Но не на этой неделе. И не на прошлой.', seen: 'В гараже. Возможно, в чужом. [[Точно не на паре]].', reward: 'Ключи от ВАЗ-2112', fix: 'tape' },
'Караев':   { verb: 'ПРОПАЛ',  marks: 'Однажды уже исчезал на целый курс. Вернулся — и снова [[растворился]].', seen: 'Третий курс. Тишина. Четвёртый — по настроению.', reward: 'Вернуть своё место', fix: 'pin', note: 'вернись!' },
'Сенченко': { verb: 'ПРОПАЛ',  marks: 'Торопится куда угодно, кроме [[аудитории]]. Скорость — запредельная.', seen: 'На парковке. Рядом с Lada. Дальше — следы шин.', reward: 'Полный бак и справка', fix: 'tape2' }
};
const WP_TABS = [['ВИДЕЛ(А)? ЗВОНИ!', '☎ 8-800-ПРОГУЛ'], ['ПРОПАЛ(А) С 1.09', 'найдёшь — скажи'], ['ТЕЛ. СТАРОСТЫ', '2-13-37'], ['НАГРАДА: КОНСПЕКТ', 'выдаём на месте'], ['НЕ ЗВОНИТЬ ПОСЛЕ 9', 'староста спит'], ['ДЕКАНАТ В КУРСЕ', 'каб. 2-13 · не ходи']];
const WP_TONE = ['#fbf8ef', '#f3eedd', '#fdfaf2', '#f6f1e2'];
const wpRnd = (k, m) => { const x = Math.sin(k * 12.9898 + m * 78.233) * 43758.5453; return x - Math.floor(x); };
function wpTab(k, t){
const [a, b] = WP_TABS[t];
return `<button type="button" class="wp-tab" tabindex="-1" aria-label="Оторвать листок" data-k="${k}" style="--tr:${((wpRnd(k, 1) - .5) * 2.2).toFixed(2)}deg;--mt:${(wpRnd(k, 2) * 3).toFixed(1)}px;--tone:${WP_TONE[k % 4]};--ink:${wpRnd(k, 3) > .5 ? '#141414' : '#262626'}"><i class="wp-hole"></i><span class="wp-tx"><b>${esc(a)}</b><em>${esc(b)}</em></span></button>`;
}
function wpStub(k){
const h = 8 + wpRnd(k, 5) * 12, pts = [[0, 0], [100, 0]]; for(let n = 0; n <= 11; n++) pts.push([100 - n * 100 / 11 + (wpRnd(k, 10 + n) - .5) * 4, 38 + wpRnd(k, 20 + n) * 62 * (n % 2 ? 1 : .8)]);
const poly = pts.map(([x, y]) => Math.max(0, Math.min(100, x)).toFixed(0) + '% ' + y.toFixed(0) + '%').join(',');
const pts2 = pts.map(([x, y], i) => i < 2 ? [x, y] : [x, Math.max(10, y - 14 - wpRnd(k, 40 + i) * 8)]), poly2 = pts2.map(([x, y]) => Math.max(0, Math.min(100, x)).toFixed(0) + '% ' + y.toFixed(0) + '%').join(',');
return `<span class="wp-gap"><i class="wp-stub" style="--h:${h.toFixed(0)}px"><b style="clip-path:polygon(${poly})"></b><u style="clip-path:polygon(${poly2})"></u></i></span>`;
}
function wpTear(tab){
const r = tab.getBoundingClientRect(), k = +tab.dataset.k || 0, fly = document.createElement('div');
fly.className = 'wp-fly'; fly.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;--tone:${tab.style.getPropertyValue('--tone')};--ink:${tab.style.getPropertyValue('--ink')}`;
fly.innerHTML = tab.innerHTML; document.body.appendChild(fly);
const dir = wpRnd(k, 7) > .5 ? 1 : -1, dx = dir * (30 + wpRnd(k, 8) * 60), rot = dir * (60 + wpRnd(k, 9) * 140), fall = Math.min(window.innerHeight - r.top + 80, 520);
fly.animate([
{ transform: 'translate(0,0) rotate(0) rotateX(0)', opacity: 1, offset: 0 },
{ transform: `translate(${dx * .15}px,-10px) rotate(${rot * .12}deg) rotateX(-40deg)`, opacity: 1, offset: .12 },
{ transform: `translate(${dx * .6}px,${fall * .45}px) rotate(${rot * .55}deg) rotateX(120deg)`, opacity: 1, offset: .5 },
{ transform: `translate(${dx}px,${fall}px) rotate(${rot}deg) rotateX(300deg)`, opacity: 0, offset: 1 }
], { duration: 1500, easing: 'cubic-bezier(.45,.05,.7,.6)', fill: 'forwards' }).onfinish = () => fly.remove();
for(let n = 0; n < 5; n++){
const bit = document.createElement('i'); bit.className = 'wp-bit'; bit.style.cssText = `left:${r.left + r.width * (.2 + .6 * wpRnd(k, 30 + n))}px;top:${r.top + 4}px`; document.body.appendChild(bit);
bit.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${(wpRnd(k, 40 + n) - .5) * 70}px,${60 + wpRnd(k, 50 + n) * 90}px) rotate(${(wpRnd(k, 60 + n) - .5) * 400}deg)`, opacity: 0 }], { duration: 800 + wpRnd(k, 70 + n) * 500, easing: 'ease-in' }).onfinish = () => bit.remove();
}
try{ fxNoise(.14, 2200, .38, 'highpass'); setTimeout(() => fxNoise(.08, 3400, .28, 'highpass'), 70); setTimeout(() => fxNoise(.05, 1500, .15), 160); }catch(_){}
const stub = document.createElement('div'); stub.innerHTML = wpStub(k + 100); tab.replaceWith(stub.firstElementChild);
}
const rdx = t => esc(t).replace(/\[\[(.+?)\]\]/g, '<span class="rd">$1</span>');
function buildWanted(frame){
const noms = $$('.nominee:not([hidden])', frame);
if(!noms.length) return;
const pad = v => String(v).padStart(2, '0'), rot = [-1.8, 1.4, 1.1, -1.5];
const html = noms.map((nom, i) => {
const full = $('.nominee-front h3', nom)?.textContent.trim() || nom.dataset.nominee;
const parts = full.split(/\s+/), surname = parts[0], first = parts.slice(1).join(' ');
const w = WANTED[nom.dataset.nominee] || WANTED[surname] || { verb: 'ПРОПАЛ', marks: '', seen: '', reward: '', fix: 'tape' };
const src = $('.nominee-front img', nom)?.getAttribute('src') || '';
const photo = src ? `<img src="${esc(src)}" alt="${esc(full)}" draggable="false" decoding="async">` : `<div class="wp-mono">${esc(initialsOf(full))}</div>`;
const gaps = [[1, 4], [3], [0, 5], [2]][i % 4];
const tabs = Array.from({length: 6}, (_, k) => gaps.includes(k) ? wpStub(i * 6 + k) : wpTab(i * 6 + k, (k + i * 2) % WP_TABS.length)).join('');
const fix = w.fix === 'pin' ? '<i class="wp-pin"></i>' : w.fix === 'staple' ? '<i class="wp-staple"></i>' : w.fix === 'tape2' ? '<i class="wp-tape c1"></i><i class="wp-tape c2"></i>' : '<i class="wp-tape"></i>';
return `<article class="wp${w.stain ? ' has-stain' : ''}" data-i="${i}" data-fix="${w.fix}" style="--r:${rot[i % 4]}deg">
${fix}
<div class="wp-paper" tabindex="0" role="button" aria-label="Открыть дело: ${esc(full)}">
<div class="wp-head"><b>${w.verb}</b><small>студент · 4 курса</small></div>
<div class="wp-photo">${photo}<span class="wp-no">№ ${pad(i + 1)}</span>${w.signal ? '<span class="wp-sig"><i></i><i></i><i></i><i></i><em>нет сети</em></span>' : ''}${w.note ? `<span class="wp-hand">${esc(w.note)}</span>` : ''}</div>
<h3 class="wp-name"><small>${esc(first)}</small>${esc(surname)}</h3>
<p class="wp-info"><b>Приметы:</b> ${rdx(w.marks)}</p>
<p class="wp-info seen"><b>Видели:</b> <u>${rdx(w.seen)}</u></p>
<div class="wp-reward"><small>Вознаграждение</small><b>${esc(w.reward || '—')}</b></div>
<div class="wp-open">Открыть дело ↗</div>
<i class="wp-seenstamp">Староста<br>в курсе</i>
</div>
<div class="wp-tabs">${tabs}</div></article>`;
}).join('');
const board = document.createElement('div');
board.className = 'wanted';
board.innerHTML = `<div class="wall-top"><span class="wall-no">Доска объявлений · корпус 2 · этаж 1</span><h4>Просьба сообщить любую информацию</h4>
<div class="wall-stats"><span><b>${noms.length}</b>в розыске</span><span><b id="wallTorn">0</b>листочков оторвано</span><span><b>0</b>найдено</span></div></div>
<div class="wanted-grid">${html}</div><p class="wanted-hint">Нажми на объявление — откроется дело. Листочки внизу можно отрывать.</p>`;
$('.nominee-subblock', frame).before(board);
let torn = 0; const tornEl = $('#wallTorn', board);
board.addEventListener('click', e => {
const tab = e.target.closest('.wp-tab');
if(tab){
e.stopPropagation(); const wp = tab.closest('.wp');
wpTear(tab); torn++; if(tornEl) tornEl.textContent = torn;
if(wp && $$('.wp-tab', wp).length === 0) wp.classList.add('wp-done');
try{ navigator.vibrate?.(8); }catch(_){} return;
}
const wp = e.target.closest('.wp'); if(!wp) return;
openCandidate(noms[+wp.dataset.i], 'history');
});
board.addEventListener('keydown', e => {
if(e.key !== 'Enter' && e.key !== ' ') return;
const wp = e.target.closest?.('.wp'); if(!wp || !e.target.classList.contains('wp-paper')) return;
e.preventDefault(); openCandidate(noms[+wp.dataset.i], 'history');
});
}
frames.filter(f => f.dataset.wanted).forEach(f => { try{ buildWanted(f); }catch(err){ console.error('buildWanted', err); f.dataset.fb = '1'; } });
const TROPHY = {
'Ролдугин':   { no: '01', cups: [['Самый спокойный', 2024], ['Самый спокойный', 2025]] },
'Литнарович': { no: '02', cups: [['Тоскик года', 2024], ['Тоскик года', 2025], ['Воздухан года', 2025], ['Канал года', 2025]] },
'Лукин':      { no: '03', cups: [['Оператор года', 2025], ['Канал года', 2025]] },
'Сериков':    { no: '04', cups: [['Мем года', 2024], ['Мем года', 2025]] },
// претенденты без титулов — начинают с оруженосцев
'Алиев': { no: '05', cups: [] }, 'Берсенев': { no: '06', cups: [] }, 'Галкин': { no: '07', cups: [] }, 'Голиков': { no: '08', cups: [] },
'Иванова': { no: '09', cups: [] }, 'Куликов': { no: '10', cups: [] }, 'Полякова': { no: '11', cups: [] }, 'Самсонов': { no: '12', cups: [] },
'Сенченко': { no: '13', cups: [] }, 'Сидоров': { no: '14', cups: [] }, 'Фролов': { no: '16', cups: [] }, 'Чертовских': { no: '17', cups: [] }
};
function tink(f = [1318, 1976, 2637]){
try{
const ac = tink.ac || (tink.ac = new (window.AudioContext || window.webkitAudioContext)());
if(ac.state === 'suspended') ac.resume();
f.forEach((fr, i) => {
const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
o.type = 'sine'; o.frequency.value = fr;
g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.1 / (i + 1), t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + 1.1);
o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 1.2);
});
}catch(_){}
}
const roman = n => { const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let r = ''; for(const [v, s] of m){ while(n >= v){ r += s; n -= v; } } return r; };
const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return (m > 10 && m < 20) ? c : k === 1 ? a : (k > 1 && k < 5) ? b : c; };
const LAUREL = (() => {
let l = '';
for(let i = 0; i < 9; i++){
const r = 41, a = 112 + i * 16, x = 50 + r * Math.cos(a * Math.PI / 180), y = 50 + r * Math.sin(a * Math.PI / 180);
l += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3.4" ry="7.5" transform="rotate(${a - 28} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
const a2 = 68 - i * 16, x2 = 50 + r * Math.cos(a2 * Math.PI / 180), y2 = 50 + r * Math.sin(a2 * Math.PI / 180);
l += `<ellipse cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" rx="3.4" ry="7.5" transform="rotate(${a2 + 28} ${x2.toFixed(1)} ${y2.toFixed(1)})"/>`;
}
return `<svg class="cn-laurel" viewBox="0 0 100 100" aria-hidden="true">${l}</svg>`;
})();
const GALA_GOLD = id => `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c0"/><stop offset=".22" stop-color="#f0c44e"/><stop offset=".5" stop-color="#b07a1c"/><stop offset=".72" stop-color="#f6d878"/><stop offset="1" stop-color="#7d520d"/></linearGradient>
<radialGradient id="${id}r" cx=".34" cy=".28" r=".85"><stop offset="0" stop-color="#fff6c0"/><stop offset=".3" stop-color="#f0c44e"/><stop offset=".65" stop-color="#b07a1c"/><stop offset="1" stop-color="#6d4608"/></radialGradient>
<linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8a43a"/><stop offset="1" stop-color="#6d4608"/></linearGradient></defs>`;
const GALA_FIG = {
stones: id => `<svg viewBox="0 0 100 130" aria-hidden="true">${GALA_GOLD(id)}
<ellipse cx="50" cy="121" rx="38" ry="6" fill="none" stroke="#f0c44e" stroke-opacity=".5"/><ellipse cx="50" cy="121" rx="27" ry="4" fill="none" stroke="#f0c44e" stroke-opacity=".7"/>
<g stroke="#5c3b06" stroke-width="1"><ellipse cx="50" cy="108" rx="31" ry="11" fill="url(#${id}r)"/><ellipse cx="53" cy="85" rx="23" ry="9" transform="rotate(-6 53 85)" fill="url(#${id}r)"/><ellipse cx="48" cy="66" rx="16" ry="7.5" transform="rotate(6 48 66)" fill="url(#${id}r)"/><ellipse cx="51" cy="51" rx="11" ry="6" transform="rotate(-5 51 51)" fill="url(#${id}r)"/><ellipse cx="50" cy="39" rx="7" ry="4.4" transform="rotate(4 50 39)" fill="url(#${id}r)"/></g>
<g fill="#fff" opacity=".72"><ellipse cx="37" cy="103" rx="10" ry="2.6" transform="rotate(-6 37 103)"/><ellipse cx="42" cy="81" rx="8" ry="2.3" transform="rotate(-10 42 81)"/><ellipse cx="42" cy="63" rx="6" ry="2" transform="rotate(4 42 63)"/><ellipse cx="46" cy="48.5" rx="4" ry="1.6"/><ellipse cx="48" cy="37.5" rx="2.4" ry="1.1"/></g>
<path d="M50 34C49 27 54 21 61 19C60 26 56 31 50 34Z" fill="url(#${id}g)" stroke="#5c3b06" stroke-width=".8"/></svg>`,
crown: id => `<svg viewBox="0 0 100 130" aria-hidden="true">${GALA_GOLD(id)}
<ellipse cx="50" cy="119" rx="36" ry="5" fill="#000" opacity=".25"/>
<path d="M22 90L18 52L30 66L40 44L50 64L60 44L70 66L82 52L78 90Z" fill="#7a0c1c"/>
<path d="M18 92L12 40L25 62L32 34L41 62L50 24L59 62L68 34L75 62L88 40L82 92Z" fill="url(#${id}g)" stroke="#5c3b06" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M16 92H84L82 108C70 111 30 111 18 108Z" fill="url(#${id}d)" stroke="#5c3b06" stroke-width="1.2"/>
<path d="M18 98H82" stroke="#fff6c0" stroke-opacity=".6"/>
<g stroke="#5c3b06" stroke-width=".8"><circle cx="12" cy="38" r="3.8" fill="#fff"/><circle cx="32" cy="32" r="3.8" fill="#fff"/><circle cx="50" cy="22" r="4.4" fill="#fff"/><circle cx="68" cy="32" r="3.8" fill="#fff"/><circle cx="88" cy="38" r="3.8" fill="#fff"/></g>
<circle cx="50" cy="100" r="5.4" fill="#d1122c" stroke="#4a0610"/><circle cx="34" cy="100" r="4.2" fill="#2457d6" stroke="#0a1c58"/><circle cx="66" cy="100" r="4.2" fill="#1fb06c" stroke="#075a30"/><circle cx="24" cy="100" r="2.4" fill="#fff"/><circle cx="76" cy="100" r="2.4" fill="#fff"/>
<g fill="#fff" opacity=".8"><circle cx="48.4" cy="98.4" r="1.4"/><circle cx="32.8" cy="98.8" r="1.1"/><circle cx="64.8" cy="98.8" r="1.1"/><path d="M26 86L34 50" stroke="#fff" stroke-opacity=".5" stroke-width="1.6"/></g></svg>`,
camera: id => `<svg viewBox="0 0 100 130" aria-hidden="true">${GALA_GOLD(id)}
<path d="M50 88L28 122M50 88L72 122M50 88V122" stroke="url(#${id}d)" stroke-width="3.4" stroke-linecap="round"/>
<rect x="12" y="62" width="12" height="16" rx="2" fill="url(#${id}d)" stroke="#5c3b06"/>
<rect x="20" y="52" width="54" height="36" rx="4" fill="url(#${id}g)" stroke="#5c3b06" stroke-width="1.2"/>
<path d="M74 60L94 54V84L74 80Z" fill="url(#${id}d)" stroke="#5c3b06" stroke-width="1.2"/><ellipse cx="94" cy="69" rx="3.4" ry="15" fill="#06101c" stroke="#5c3b06"/><ellipse cx="93" cy="63" rx="1.2" ry="5" fill="#7fb8ff" opacity=".7"/>
<g stroke="#5c3b06" stroke-width="1.2"><circle cx="34" cy="38" r="15" fill="url(#${id}g)"/><circle cx="60" cy="34" r="15" fill="url(#${id}g)"/></g>
<g fill="#2a1804"><circle cx="34" cy="38" r="3"/><circle cx="60" cy="34" r="3"/>${[0, 72, 144, 216, 288].map(a => `<circle cx="${(34 + 8.6 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(38 + 8.6 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="2.6"/><circle cx="${(60 + 8.6 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(34 + 8.6 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="2.6"/>`).join('')}</g>
<path d="M26 58H70" stroke="#fff6c0" stroke-opacity=".7" stroke-width="1.4"/><circle cx="64" cy="76" r="3" fill="#d1122c" stroke="#4a0610"/><path d="M26 82H52" stroke="#5c3b06" stroke-opacity=".5"/></svg>`,
face: id => `<svg viewBox="0 0 100 130" aria-hidden="true">${GALA_GOLD(id)}
<ellipse cx="50" cy="121" rx="30" ry="5" fill="#000" opacity=".25"/>
<path d="M40 120L44 92H56L60 120Z" fill="url(#${id}d)" stroke="#5c3b06" stroke-width="1"/><rect x="32" y="116" width="36" height="6" rx="2" fill="url(#${id}g)" stroke="#5c3b06"/>
<circle cx="50" cy="56" r="38" fill="url(#${id}r)" stroke="#5c3b06" stroke-width="1.4"/>
<path d="M26 46Q33 36 42 46" fill="none" stroke="#2a1804" stroke-width="4" stroke-linecap="round"/><path d="M58 46Q67 36 74 46" fill="none" stroke="#2a1804" stroke-width="4" stroke-linecap="round"/>
<path d="M24 60Q50 100 76 60Z" fill="#3a2006" stroke="#2a1804" stroke-width="1.6" stroke-linejoin="round"/><path d="M36 82Q50 70 64 82Q50 94 36 82Z" fill="#e9a04a"/><path d="M30 63H70" stroke="#fff6c0" stroke-width="3"/>
<path d="M20 58C16 64 16 70 21 70C26 70 25 63 20 58Z" fill="url(#${id}g)" stroke="#5c3b06" stroke-width=".8"/><path d="M80 58C84 64 84 70 79 70C74 70 75 63 80 58Z" fill="url(#${id}g)" stroke="#5c3b06" stroke-width=".8"/>
<path d="M24 34Q36 14 56 18" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/></svg>`
};
const GALA_KIND = { 'Ролдугин': 'stones', 'Литнарович': 'crown', 'Лукин': 'camera', 'Сериков': 'face' };
function galaBurst(host, x, y){
const cols = ['#ffd75a', '#fff3b0', '#e0463a', '#46d39a', '#6ab8ff', '#ff8ad0'], f = document.createDocumentFragment();
for(let i = 0; i < 42; i++){
const p = document.createElement('i'); p.className = 'ga-bit';
const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 130;
p.style.cssText = `left:${x}px;top:${y}px;background:${cols[i % cols.length]};--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d - 60).toFixed(0)}px;--r:${(Math.random() * 720 - 360) | 0}deg;--w:${4 + Math.random() * 5 | 0}px;animation-delay:${(Math.random() * .12).toFixed(2)}s`;
f.appendChild(p); setTimeout(() => p.remove(), 1600);
}
host.appendChild(f);
}
const THR_RANKS = [
{ min: 4, no: 'IV', name: 'Король', sub: 'носит корону', cls: 'k' },
{ min: 3, no: 'III', name: 'Лорд', sub: 'три титула', cls: 'l' },
{ min: 2, no: 'II', name: 'Рыцарь', sub: 'два титула', cls: 'n' },
{ min: 0, no: 'I', name: 'Оруженосец', sub: 'начало пути', cls: 's' }
];
const THR_HER = {
'Ролдугин':   { a: '#3a72cf', b: '#16315f', pat: 'fess', ink: '#cfe0ff' },
'Лукин':      { a: '#2e9a63', b: '#0e4a2d', pat: 'pale', ink: '#c9f1d9' },
'Сериков':    { a: '#c23447', b: '#5a0e1b', pat: 'bend', ink: '#ffd2d8' },
'Литнарович': { a: '#7a3aae', b: '#26093f', pat: 'ermine', ink: '#ecd6ff' },
'Алиев':      { a: '#1f9ec2', b: '#093b4d', pat: 'pale',   ink: '#c7f1ff' },
'Берсенев':   { a: '#5a46c9', b: '#1a1352', pat: 'fess',   ink: '#dcd6ff' },
'Галкин':     { a: '#d98a2b', b: '#4f2c06', pat: 'bend',   ink: '#ffe6bd' },
'Голиков':    { a: '#c8372d', b: '#531009', pat: 'pale',   ink: '#ffd9d4' },
'Иванова':    { a: '#d8508f', b: '#561033', pat: 'ermine', ink: '#ffd5e8' },
'Куликов':    { a: '#e0a81e', b: '#4d3600', pat: 'fess',   ink: '#fff1bd' },
'Полякова':   { a: '#7f6fd8', b: '#2a2160', pat: 'bend',   ink: '#e6e1ff' },
'Самсонов':   { a: '#e0602b', b: '#521c06', pat: 'fess',   ink: '#ffddca' },
'Сенченко':   { a: '#2c3d52', b: '#0a1018', pat: 'pale',   ink: '#cbd9ea' },
'Сидоров':    { a: '#3aa66b', b: '#0c3d22', pat: 'bend',   ink: '#d0f5df' },
'Фролов':     { a: '#43a0d6', b: '#0e3856', pat: 'fess',   ink: '#d4efff' },
'Чертовских': { a: '#a23ab0', b: '#390c42', pat: 'pale',   ink: '#f3d3f8' }
};
const THR_SPARE = [{ a: '#c98a2a', b: '#5a3a0a', pat: 'fess', ink: '#ffe9c2' }, { a: '#2a9aa8', b: '#0b3d45', pat: 'bend', ink: '#c9f3f7' }, { a: '#8a8f9c', b: '#2b2f3a', pat: 'pale', ink: '#e6e9f0' }];
function thrRank(n){ return THR_RANKS.find(r => n >= r.min) || THR_RANKS[THR_RANKS.length - 1]; }
function thrCrownSvg(id){
return `<svg class="thr-cr" viewBox="0 0 120 84" aria-hidden="true"><defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b8"/><stop offset=".45" stop-color="#e4b647"/><stop offset="1" stop-color="#8f6416"/></linearGradient></defs>
<path d="M10 70 4 22l26 20L60 6l30 36 26-20-6 48z" fill="url(#${id}g)" stroke="#5b3f0d" stroke-width="2" stroke-linejoin="round"/>
<rect x="10" y="68" width="100" height="12" rx="3" fill="url(#${id}g)" stroke="#5b3f0d" stroke-width="2"/>
<circle cx="4" cy="22" r="5" fill="#fff3b8" stroke="#5b3f0d"/><circle cx="60" cy="6" r="6" fill="#fff3b8" stroke="#5b3f0d"/><circle cx="116" cy="22" r="5" fill="#fff3b8" stroke="#5b3f0d"/>
<circle cx="60" cy="52" r="6.5" fill="#e0314b" stroke="#5b3f0d"/><circle cx="34" cy="60" r="4" fill="#3b7bff" stroke="#5b3f0d"/><circle cx="86" cy="60" r="4" fill="#2fd39a" stroke="#5b3f0d"/>
<path d="M18 74h84" stroke="#fff3b8" stroke-width="1.4" stroke-dasharray="2 5" stroke-linecap="round"/></svg>`;
}
function thrCrestSvg(){
return `<svg class="thr-crest" viewBox="0 0 160 150" aria-hidden="true"><defs>
<linearGradient id="tcG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b8"/><stop offset=".5" stop-color="#e4b647"/><stop offset="1" stop-color="#8f6416"/></linearGradient>
<linearGradient id="tcS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa6b6"/><stop offset=".5" stop-color="#f4f8fc"/><stop offset="1" stop-color="#8794a6"/></linearGradient>
<linearGradient id="tcF" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a3aae"/><stop offset="1" stop-color="#26093f"/></linearGradient></defs>
<g transform="rotate(38 80 84)"><rect x="74" y="18" width="12" height="110" rx="3" fill="url(#tcS)" stroke="#47536a" stroke-width="1.4"/><rect x="58" y="116" width="44" height="9" rx="3" fill="url(#tcG)" stroke="#5b3f0d" stroke-width="1.4"/><rect x="76" y="125" width="8" height="20" rx="2" fill="#4a3320"/><circle cx="80" cy="148" r="5" fill="url(#tcG)" stroke="#5b3f0d"/></g>
<g transform="rotate(-38 80 84)"><rect x="74" y="18" width="12" height="110" rx="3" fill="url(#tcS)" stroke="#47536a" stroke-width="1.4"/><rect x="58" y="116" width="44" height="9" rx="3" fill="url(#tcG)" stroke="#5b3f0d" stroke-width="1.4"/><rect x="76" y="125" width="8" height="20" rx="2" fill="#4a3320"/><circle cx="80" cy="148" r="5" fill="url(#tcG)" stroke="#5b3f0d"/></g>
<path d="M42 42h76v38c0 24-16 38-38 48-22-10-38-24-38-48z" fill="url(#tcF)" stroke="url(#tcG)" stroke-width="5" stroke-linejoin="round"/>
<path d="M80 48v76M46 76h68" stroke="url(#tcG)" stroke-width="5" opacity=".9"/>
<g transform="translate(52 6) scale(.46)">${thrCrownSvg('tcc').replace(/<svg[^>]*>|<\/svg>/g, '')}</g></svg>`;
}
function buildShowcase(frame){
const noms = $$('.nominee:not([hidden])', frame);
if(!noms.length) return;
let spare = 0;
const people = noms.map((nom, i) => {
const full = $('.nominee-front h3', nom)?.textContent.trim() || nom.dataset.nominee, parts = full.split(/\s+/), key = nom.dataset.nominee;
const t = TROPHY[key] || { no: String(i + 1).padStart(2, '0'), cups: [] };
return { i, full, surname: parts[0], first: parts.slice(1).join(' '), key, t, n: t.cups.length, rank: THR_RANKS[2], her: THR_HER[key] || THR_SPARE[spare++ % THR_SPARE.length], src: $('.nominee-front img', nom)?.getAttribute('src') || '' };
});
const total = people.reduce((a, p) => a + p.n, 0), years = [...new Set(people.flatMap(p => p.t.cups.map(c => c[1])))].sort();
const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
const order = [...people].sort((a, b) => a.surname.localeCompare(b.surname, 'ru')); /* круглый стол: по алфавиту, без старшинства */
const crownSvg = `<svg class="kz-crownsvg" viewBox="0 0 160 110" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round">
<path d="M22 88 12 30l34 28L80 14l34 44 34-28-10 58z"/><path d="M22 88h116v12H22z"/><path d="M28 94h104" stroke-dasharray="1 5"/>
<path d="M46 58 80 26l34 32" opacity=".45"/><circle cx="12" cy="30" r="4"/><circle cx="80" cy="14" r="5"/><circle cx="148" cy="30" r="4"/>
<path d="M80 62l7 8-7 8-7-8z"/><circle cx="52" cy="76" r="3"/><circle cx="108" cy="76" r="3"/></g></svg>`;
const throneSvg = `<svg class="kz-throne" viewBox="0 0 200 170" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round">
<path d="M60 160V70c0-26 18-46 40-56 22 10 40 30 40 56v90"/><path d="M72 120V76c0-18 12-32 28-40 16 8 28 22 28 40v44"/><path d="M44 120h112v14H44z"/><path d="M50 134v26M150 134v26M44 160h112"/>
<path d="M36 104h24v16H36zM140 104h24v16h-24z"/><path d="M100 22v-10M94 16h12"/><circle cx="100" cy="70" r="7"/><path d="M8 168h184" stroke-dasharray="2 6"/></g></svg>`;
const card = p => {
const king = false, k = order.indexOf(p), rom = ROM[k] || '';
return `<button type="button" class="kz-card${king ? ' king' : ''}" data-i="${p.i}" style="--k:${k}" aria-label="Рыцарь: ${esc(p.full)}. Открыть досье">
<span class="kz-ph">${p.src ? `<img src="${esc(p.src)}" alt="" draggable="false" loading="lazy" decoding="async" onerror="this.remove()">` : ''}<b class="kz-ini">${esc(initialsOf(p.full))}</b>
<i class="kz-no">${rom}</i>${king ? `<i class="kz-cr">${crownSvg}</i>` : ''}<i class="kz-fr"></i></span>
<span class="kz-meta"><small>Рыцарь · ${rom}</small><b>${esc(p.surname)}</b><em>${esc(p.first)}</em></span>
</button>`;
};
const chron = years.map(y => people.flatMap(p => p.t.cups.filter(c => c[1] === y).map(c => `<li><b>${y}</b><span>${esc(c[0])}</span><em>${esc(p.surname)}</em></li>`)).join('')).join('');
const idx = frames.indexOf(frame), TOT = typeof TOTAL_NOMS === 'number' ? TOTAL_NOMS : 7;
const board = document.createElement('div');
board.className = 'kz';
board.innerHTML = `
<header class="lxn-head kz-head">
<div class="lxn-kick"><span>Номинация ${String(idx + 1).padStart(2, '0')} / ${String(TOT).padStart(2, '0')}</span><span>Финал · тронный зал</span></div>
<div class="kz-emb">${crownSvg}</div>
<h2 class="lxn-title">Король <em>группы</em></h2>
<p class="lxn-lede">${people.length} ${plural(people.length, 'рыцарь', 'рыцаря', 'рыцарей')} за одним столом. Старшинства нет, трон пуст — корону отдаст только голосование группы.</p>
<dl class="zl-facts kz-facts"><div><dt>${plural(people.length, 'Рыцарь', 'Рыцаря', 'Рыцарей')}</dt><dd>${String(people.length).padStart(2, '0')}</dd></div><div><dt>Король</dt><dd>—</dd></div><div><dt>Трон</dt><dd>пуст</dd></div></dl>
</header>
<section class="kz-trial" aria-label="Испытание претендентов">
<div class="kz-trial-t"><small>Испытание короля</small><b>Общая игра претендентов</b><p>Перед финалом здесь откроется одно испытание для всех кандидатов. Кто пройдёт его лучше — войдёт в историю зала.</p><span class="kz-soon"><i></i>Скоро</span></div>
${throneSvg}
</section>
<div class="kz-sec"><span>Рыцари круглого стола</span><span>${String(people.length).padStart(2, '0')}</span></div>
<div class="kz-grid">${order.map(card).join('')}</div>
${chron ? `<section class="kz-chron"><div class="kz-sec"><span>Хроника титулов</span><span>${String(total).padStart(2, '0')}</span></div><ol>${chron}</ol></section>` : ''}
<p class="lxn-hint">Нажми на портрет — откроется досье претендента.</p>`;
$('.nominee-subblock', frame).before(board);
frame.classList.add('lxn');
const cards = $$('.kz-card', board); let busy = false;
const show = () => board.classList.add('live');
if('IntersectionObserver' in window){ const io = new IntersectionObserver(es => { if(es.some(e => e.isIntersecting)){ show(); io.disconnect(); } }, { threshold: .05 }); io.observe(board); } else show();
setTimeout(show, 2500);
board.addEventListener('click', e => {
const s = e.target.closest('.kz-card'); if(!s || busy) return; busy = true; const p = people[+s.dataset.i];
s.classList.add('pick'); cards.forEach(x => x !== s && x.classList.add('dim')); try{ tink([392, 587, 784]); navigator.vibrate?.([10, 24, 12]); }catch(_){}
setTimeout(() => openCandidate(noms[p.i], 'history'), 480);
setTimeout(() => { s.classList.remove('pick'); cards.forEach(x => x.classList.remove('dim')); busy = false; }, 1400);
});
}
const HOD_WIN = {
'Ролдугин|Победитель': {
key: 'rolz', kicker: 'Сад камней', tag: 'Дважды самый спокойный. Не повышал голос ни разу',
stats: [[2, 'года подряд'], [0, 'повышенных тонов'], [100, '% дзена', '%']],
infoTitle: 'Разровняй песок',
quote: ['«Настоящий победитель не повышает голос. Он просто остаётся собой».', 'Никита Ролдугин, по версии жюри'],
videoTitle: 'Тишина', videoNote: 'Ролик снимается без спешки.',
facts: ['2024 — «Самый спокойный». Объявили шёпотом', '2025 — снова он. Зал аплодировал беззвучно', 'Главное правило: чем громче вокруг, тем ровнее линия'],
ph: ['🪨', 'Тишина', 'Видео будет, когда песок осядет'],
art: () => `<svg class="rz-enso" viewBox="0 0 120 120" aria-hidden="true"><path pathLength="1" d="M60 14C34 14 14 34 14 60s20 46 46 46 46-20 46-46c0-14-6-26-15-34"/></svg><div class="rz-seal">покой</div>`,
info: () => `
<div class="rz-garden">
<canvas class="rz-cv" aria-label="Песок. Проведи пальцем, чтобы нарисовать линии"></canvas>
<p class="rz-say" id="rzSay" aria-live="polite">Проведи пальцем по песку. Медленно.</p>
</div>
<button type="button" class="rz-reset">Разровнять песок</button>`,
after: root => {
const cv = $('.rz-cv', root); if(!cv) return;
const ctx = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
const W = cv.clientWidth || 320, H = cv.clientHeight || 210;
cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
const say = $('#rzSay', root);
const stones = [[W * .26, H * .42, 24], [W * .7, H * .62, 32], [W * .56, H * .22, 15]];
const sand = () => {
ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#e7dcc3'; ctx.fillRect(0, 0, W, H);
ctx.strokeStyle = 'rgba(120,98,60,.34)'; ctx.lineWidth = 1.1;
stones.forEach(([x, y, r]) => { for(let k = 1; k <= 4; k++){ ctx.beginPath(); ctx.arc(x, y, r + k * 9, 0, Math.PI * 2); ctx.stroke(); } });
for(let yy = 10; yy < H; yy += 9){ ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.strokeStyle = 'rgba(120,98,60,.08)'; ctx.stroke(); }
stones.forEach(([x, y, r]) => {
const g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
g.addColorStop(0, '#9a9a96'); g.addColorStop(.6, '#5c5c5a'); g.addColorStop(1, '#2a2a29');
ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x + r * .2, y + r * .85, r * 1.05, r * .3, 0, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * .86, 0, 0, Math.PI * 2); ctx.fill();
});
};
sand();
let last = null, drawing = false;
const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]; };
const rake = (a, b) => {
for(let k = -1; k <= 1; k++){
ctx.strokeStyle = k === 0 ? 'rgba(90,70,40,.5)' : 'rgba(255,250,235,.55)'; ctx.lineWidth = 1.6;
const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * k * 4, ny = dx / l * k * 4;
ctx.beginPath(); ctx.moveTo(a[0] + nx, a[1] + ny); ctx.lineTo(b[0] + nx, b[1] + ny); ctx.stroke();
}
};
cv.addEventListener('pointerdown', e => { drawing = true; last = { p: pos(e), t: performance.now() }; cv.setPointerCapture?.(e.pointerId); });
cv.addEventListener('pointermove', e => {
if(!drawing) return; const p = pos(e), t = performance.now(), sp = Math.hypot(p[0] - last.p[0], p[1] - last.p[1]) / Math.max(1, t - last.t);
rake(last.p, p); last = { p, t };
const fast = sp > 1.4; say.textContent = fast ? 'Слишком резко. Победители не торопятся.' : 'Хорошая линия.'; say.classList.toggle('warn', fast);
});
const end = () => { drawing = false; };
cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
$('.rz-reset', root).addEventListener('click', () => { sand(); say.textContent = 'Песок снова ровный. Как и он.'; say.classList.remove('warn'); });
}
},
'Литнарович|Победитель': {
key: 'litg', kicker: 'Примерка короны', tag: 'Четыре титула — ещё не трон',
stats: [[4, 'титула'], [2, 'года «Тоскик»'], [3, 'номинации за 2025']],
infoTitle: 'Примерка короны',
quote: ['«Титулы — это звенья. Корону из них соберёт только группа».', 'Из устава тронного зала'],
videoTitle: 'Коронация', videoNote: 'Корону ещё доделывают.',
facts: ['Тоскик года — 2024, и снова 2025', 'Воздухан года — 2025, потому что воздух тоже надо уметь', 'Канал года — 2025. Последний камень встал на место'],
ph: ['👑', 'Мастера работают', 'Видео сдадут к финальной церемонии'],
art: () => `<svg class="lg-crown" viewBox="0 0 80 56" aria-hidden="true"><path d="M6 46 0 12l22 18L40 2l18 28 22-18-6 34z"/><rect x="6" y="48" width="68" height="6" rx="2"/></svg><i class="lg-ray a"></i><i class="lg-ray b"></i>`,
info: () => KG_HTML(),
after: root => kgAfter(root)
},
'Лукин|Победитель': {
key: 'lukt', kicker: 'Монтажный стол', tag: 'Молча делал то, что другие только обещают',
stats: [[2, 'титула за 2025'], [24, 'кадра в секунду'], [1, 'канал — целый мир']],
infoTitle: 'Таймлайн 2025',
quote: ['«Оператор может быть художником, а канал — целым миром».', 'Из описания работы'],
videoTitle: 'Рабочий монтаж', videoNote: 'Материал на цветокоррекции.',
facts: ['Оператор года 2025 — кадры, которые остаются в памяти', 'Канал года 2025 — место, куда хочется возвращаться', 'Главное правило: резкость стоит на том, что важно'],
ph: ['🎞️', 'Идёт рендер', 'Финальный монтаж скоро'],
art: () => `<div class="lt-tc">01:00:24:12</div><div class="lt-ruler"></div><i class="lt-ph"></i>`,
info: () => `
<div class="lt-ed" id="ltEd">
<div class="lt-mon"><div class="lt-card"><small id="ltSm">Номинация</small><b id="ltTitle">Оператор года</b><em id="ltYear">2025</em></div><span class="lt-tcm" id="ltTc">00:00:00:00</span></div>
<div class="lt-tl">
<div class="lt-rl"><div>${Array.from({length: 11}, (_, i) => `<i style="left:${i * 10}%"><span>${i}</span></i>`).join('')}</div></div>
<div class="lt-tr"><label>V2</label><div><span class="clip c3" style="left:6%;width:30%">LUKIN</span><span class="clip c3" style="left:56%;width:34%">CHANNEL</span></div></div>
<div class="lt-tr"><label>V1</label><div><span class="clip c1" style="left:0;width:49%">Оператор года</span><span class="clip c2" style="left:51%;width:49%">Канал года</span></div></div>
<div class="lt-tr a"><label>A1</label><div class="lt-wave">${Array.from({length: 48}, (_, i) => `<i style="height:${20 + Math.abs(Math.sin(i * 1.7) * 60 + Math.cos(i * .6) * 20)}%"></i>`).join('')}</div></div>
<div class="lt-over"><i class="lt-head" id="ltHead"></i><input class="lt-scrub" type="range" min="0" max="1000" value="0" aria-label="Положение курсора на таймлайне"></div>
</div>
<div class="lt-ctl"><button type="button" class="lt-play" id="ltPlay" aria-label="Воспроизвести">▶</button><span>Двигай курсор или нажми ▶</span></div>
</div>`,
after: root => {
const inp = $('.lt-scrub', root), head = $('#ltHead', root), ed = $('#ltEd', root), play = $('#ltPlay', root);
const T = $('#ltTitle', root), Y = $('#ltYear', root), S = $('#ltSm', root), TC = $('#ltTc', root);
let playing = false, raf = 0, last = 0;
const upd = () => {
const v = +inp.value / 10; head.style.left = v + '%';
const first = v < 50; T.textContent = first ? 'Оператор года' : 'Канал года'; Y.textContent = '2025'; S.textContent = first ? 'Кадр' : 'Пространство';
ed.classList.toggle('b', !first);
const f = Math.round(v / 100 * 24 * 40), s = Math.floor(f / 24);
TC.textContent = '00:00:' + String(s).padStart(2, '0') + ':' + String(f % 24).padStart(2, '0');
};
inp.addEventListener('input', () => { if(playing) stop(); upd(); });
const stop = () => { playing = false; cancelAnimationFrame(raf); play.textContent = '▶'; };
const tick = now => { if(!inp.isConnected || !hodEl.classList.contains('visible')){ stop(); return; } const dt = now - last; last = now; let v = +inp.value + dt * .09; if(v >= 1000) v = 0; inp.value = v; upd(); if(playing) raf = requestAnimationFrame(tick); };
play.addEventListener('click', () => { if(playing){ stop(); return; } playing = true; play.textContent = '❚❚'; last = performance.now(); raf = requestAnimationFrame(tick); });
upd();
}
},
'Сериков|Победитель': {
key: 'sert', kicker: 'Тир-лист', tag: 'Два года подряд диктовал язык чата',
stats: [[2, 'года «Мем года»'], [999, 'цитат в чате', '+'], ['S', 'тир по умолчанию']],
infoTitle: 'Тир-лист Серикова',
quote: ['«Мем может быть сильнее любого заявления, а юмор — настоящим оружием».', 'Чат группы, дословно'],
videoTitle: 'Подборка', videoNote: 'Смеяться уже можно, смотреть — скоро.',
facts: ['2024 — «Мем года». Смеялись все, цитировали ещё дольше', '2025 — снова «Мем года». Правила игры диктует он', 'Мем живёт дольше любого хайпа — проверено чатом'],
ph: ['😂', 'Подборка грузится', 'Скоро. Чат уже ржёт заранее'],
art: () => `<div class="st-S">S</div><div class="st-tag">ТИР<br>СЕРИКОВА</div>`,
info: () => `
<div class="st-list" id="stList">
${['S', 'A', 'B', 'C', 'D'].map(t => `<div class="st-row t${t}" data-t="${t}"><b>${t}</b><div class="st-zone"></div></div>`).join('')}
</div>
<div class="st-pool" id="stPool">
${['Мем года 2024', 'Мем года 2025', 'Язык чата', 'Юмор как оружие', 'Скромность'].map((n, i) => `<button type="button" class="st-chip" data-i="${i}">${n}</button>`).join('')}
</div>
<p class="st-say" id="stSay" aria-live="polite">Нажми на карточку — она спустится на тир ниже. Жюри посмотрит.</p>`,
after: root => {
const rows = $$('.st-row', root), order = ['S', 'A', 'B', 'C', 'D'], say = $('#stSay', root), pool = $('#stPool', root);
const put = (chip, t) => { chip.dataset.t = t; $('.st-zone', rows[order.indexOf(t)]).appendChild(chip); };
const chips = $$('.st-chip', root);
chips.forEach((c, i) => setTimeout(() => put(c, i === 4 ? 'D' : 'S'), 250 + i * 160));
chips.forEach(c => c.addEventListener('click', () => {
const t = c.dataset.t || 'S', i = order.indexOf(t), name = c.textContent;
if(name === 'Скромность'){ say.textContent = 'Скромность: D. Но это тоже мем.'; c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); return; }
if(i < 4) put(c, order[i + 1]);
say.textContent = 'Жюри не согласно…'; clearTimeout(c._t);
c._t = setTimeout(() => { put(c, 'S'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); say.textContent = '«' + name + '» возвращён в S по решению жюри.'; tink([1568, 2093]); }, 1100);
}));
}
}
};
Object.assign(HOD, HOD_WIN);
const SX_PEOPLE = [
{ x: 36, skin: '#f1c8a0', hair: 'short', hc: '#1c1a22', shirt: '#e9b830' },
{ x: 96, skin: '#8a5a3a', hair: 'curly', hc: '#15131a', shirt: '#2ea67a', gl: 'sq' },
{ x: 156, skin: '#f7dcc0', hair: 'long', hc: '#e9c66e', shirt: '#9b55d6' },
{ x: 216, skin: '#d9a074', hair: 'cap', hc: '#2a1a12', shirt: '#e5604f', beard: 1 },
{ x: 276, skin: '#f2cfab', hair: 'bun', hc: '#5a3620', shirt: '#3b82d6', gl: 'rd' },
{ x: 336, skin: '#c98a5c', hair: 'bald', hc: '#2a1a12', shirt: '#f08fb0', gl: 'sq', stub: 1 }
];
const SX_JOKES = [
['ШУТКА', 'Я не опаздываю. Я даю группе время по мне соскучиться.', 1],
['ШУТКА', 'Говорят, рыжие приносят удачу. Поэтому на зачёты меня берут как талисман.', 1.15],
['ШУТКА', 'Мем года — это когда преподаватель цитирует тебя на экзамене. Дважды.', 1.2],
['ШУТКА', 'Сессия — как чат группы: все молчат, а потом триста сообщений за ночь.', 1],
['ШУТКА', 'Я никогда не сплю на парах. Я просто закрываю глаза, чтобы лучше слышать.', 1.25],
['ШУТКА', 'Дедлайн — это когда за ночь успеваешь всё, кроме сна.', .95]
];
const SX_QUOTES = [
['ЦИТАТА', '«Мем может быть сильнее любого заявления, а юмор — настоящим оружием».', 1.1],
['ЦИТАТА', '«Хороший мем живёт дольше любого хайпа».', .9],
['ЦИТАТА', '«Серьёзный человек без чувства юмора — это просто человек, у которого плохой день».', 1.2],
['ЦИТАТА', '«Если смешно всем, значит, это уже не шутка, а традиция группы».', 1]
];
function sxHair(p){
const c = p.hc;
if(p.hair === 'short') return `<path d="M-25 -1C-28 -24 -12 -32 0 -32C14 -32 28 -24 25 -1C21 -13 12 -18 0 -18C-12 -18 -20 -12 -25 -1Z" fill="${c}"/><path d="M-6 -30q10 -4 20 3" stroke="#4a4856" stroke-width="1.2" fill="none" opacity=".6"/>`;
if(p.hair === 'curly') return [[-19, -12], [-10, -22], [0, -26], [10, -22], [19, -12], [-24, 0], [24, 0], [-5, -17], [6, -17]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7.4" fill="${c}"/>`).join('') + `<circle cx="-4" cy="-24" r="2.2" fill="#fff" opacity=".12"/>`;
if(p.hair === 'long') return `<path d="M-27 -4C-31 -36 31 -36 27 -4L31 46H-31Z" fill="#cfa84e" transform="translate(0 0)"/><path d="M-25 -2C-24 -28 22 -30 25 -2C16 -14 -10 -14 -25 -2Z" fill="${c}"/><path d="M-14 -22q8 -6 18 -2M-4 -26q10 0 16 6" stroke="#fff2b8" stroke-width="1.2" fill="none" opacity=".7"/>`;
if(p.hair === 'cap') return `<path d="M-26 -2C-26 -30 26 -30 26 -2Z" fill="#2c5fb8"/><path d="M-26 -2H34q3 5 -1 6H-26Z" fill="#1d438a"/><circle cx="0" cy="-28" r="2.2" fill="#e9b830"/><path d="M-4 -16h8" stroke="#fff" stroke-width="1.2" opacity=".5"/>`;
if(p.hair === 'bun') return `<circle cx="0" cy="-31" r="9.5" fill="${c}"/><circle cx="-3" cy="-33" r="3" fill="#8a5a3a" opacity=".5"/><path d="M-25 -1C-27 -24 25 -24 25 -1C16 -14 -16 -14 -25 -1Z" fill="${c}"/>`;
return `<ellipse cx="-6" cy="-18" rx="8" ry="3.4" fill="#fff" opacity=".22" transform="rotate(-16 -6 -18)"/>`;
}
function sxAud(p, i){
const gl = p.gl === 'rd' ? `<g fill="rgba(255,255,255,.12)" stroke="#1c1c22" stroke-width="1.6"><circle cx="-9" cy="-1" r="7.2"/><circle cx="9" cy="-1" r="7.2"/></g><path d="M-1.8 -1h3.6" stroke="#1c1c22" stroke-width="1.5"/>`
: p.gl === 'sq' ? `<g fill="rgba(255,255,255,.12)" stroke="#1c1c22" stroke-width="1.7"><rect x="-17" y="-7" width="15" height="11" rx="2.5"/><rect x="2" y="-7" width="15" height="11" rx="2.5"/></g><path d="M-2 -3h4" stroke="#1c1c22" stroke-width="1.5"/>` : '';
const beard = p.beard ? `<path d="M-21 4C-20 28 20 28 21 4C15 14 -15 14 -21 4Z" fill="#2a1a12"/>` : '';
const stub = p.stub ? `<path d="M-19 8C-16 24 16 24 19 8C12 16 -12 16 -19 8Z" fill="#2a1a12" opacity=".35"/>` : '';
return `<g transform="translate(${p.x} 320)"><g class="aud" data-i="${i}" style="--d:${(i * .37).toFixed(2)}s"><g class="ap">
${p.hair === 'long' ? sxHair({ ...p, hair: 'long' }).split('<path d="M-25')[0] : ''}
<g class="ab"><path d="M-44 62C-44 30 -26 24 0 24C26 24 44 30 44 62V80H-44Z" fill="${p.shirt}"/><path d="M-44 62C-44 30 -26 24 0 24C-6 40 -10 60 -10 80H-44Z" fill="#000" opacity=".12"/><path d="M-9 24L0 37L9 24" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/></g>
<rect x="-7" y="13" width="14" height="16" fill="${p.skin}"/><rect x="-7" y="13" width="14" height="16" fill="#000" opacity=".12"/>
<g class="ah"><ellipse cx="-24" cy="2" rx="3.8" ry="5.2" fill="${p.skin}"/><ellipse cx="24" cy="2" rx="3.8" ry="5.2" fill="${p.skin}"/>
<circle r="24" fill="${p.skin}"/><ellipse cx="-8" cy="-10" rx="10" ry="6" fill="#fff" opacity=".13"/><path d="M-20 12C-12 26 12 26 20 12C14 22 -14 22 -20 12Z" fill="#000" opacity=".06"/>
${p.hair === 'long' ? '<path d="M-25 -2C-24 -28 22 -30 25 -2C16 -14 -10 -14 -25 -2Z" fill="' + p.hc + '"/><path d="M-14 -22q8 -6 18 -2M-4 -26q10 0 16 6" stroke="#fff2b8" stroke-width="1.2" fill="none" opacity=".7"/>' : sxHair(p)}
${beard}${stub}
<g class="blush" fill="#ff8a8a"><circle cx="-14" cy="9" r="5" opacity=".4"/><circle cx="14" cy="9" r="5" opacity=".4"/></g>
<g class="e-open"><ellipse cx="-9" cy="-2" rx="4.8" ry="5.2" fill="#fff"/><ellipse cx="9" cy="-2" rx="4.8" ry="5.2" fill="#fff"/><circle cx="-8.5" cy="-1.6" r="2.6" fill="#3a2a20"/><circle cx="9.5" cy="-1.6" r="2.6" fill="#3a2a20"/><circle cx="-7.6" cy="-2.6" r=".9" fill="#fff"/><circle cx="10.4" cy="-2.6" r=".9" fill="#fff"/></g>
<g class="e-laugh" fill="none" stroke="#2a1a14" stroke-width="2.2" stroke-linecap="round"><path d="M-14 0Q-9 -8 -4 0"/><path d="M4 0Q9 -8 14 0"/></g>
<path d="M-14 -9q5 -3 9 -1M5 -10q5 -2 9 1" stroke="${p.hair === 'bald' || p.hair === 'cap' ? '#2a1a12' : p.hc}" stroke-width="2" stroke-linecap="round" fill="none" opacity=".85"/>
${gl}
<path d="M0 2q-3 6 1 7" stroke="rgba(0,0,0,.25)" stroke-width="1.4" fill="none" stroke-linecap="round"/>
<path class="m-closed" d="M-8 11Q0 18 8 11" fill="none" stroke="#7a3a2a" stroke-width="2" stroke-linecap="round"/>
<g class="m-laugh"><path d="M-11 7Q0 4 11 7Q9 25 0 25Q-9 25 -11 7Z" fill="#6e1d28"/><path d="M-9.4 7.6Q0 5 9.4 7.6L9 11Q0 9 -9 11Z" fill="#fff"/><ellipse cx="0" cy="20" rx="5.6" ry="3.4" fill="#e0646b"/></g>
<g class="tears"><path class="t1" d="M-15 4q-3.4 6 0 9q3.4 -3 0 -9z" fill="#7ec8ff"/><path class="t2" d="M15 4q-3.4 6 0 9q3.4 -3 0 -9z" fill="#7ec8ff"/></g>
</g>
<g class="hands"><g class="hl"><circle cx="-7" cy="52" r="7" fill="${p.skin}" stroke="rgba(0,0,0,.2)"/></g><g class="hr"><circle cx="7" cy="52" r="7" fill="${p.skin}" stroke="rgba(0,0,0,.2)"/></g></g>
</g></g></g>`;
}
function sxSpeaker(){
const fr = [[-12, 6], [-7, 9], [-2, 11], [3, 9], [8, 11], [12, 6], [-9, 2], [9, 3], [0, 6], [-4, 5], [5, 5], [-14, 10], [14, 10], [1, 14]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? .8 : 1.1}" fill="#c4713f" opacity=".75"/>`).join('');
return `<g transform="translate(262 62)"><g class="sx-sp" id="sxSp">
<ellipse cx="0" cy="182" rx="52" ry="6" fill="#000" opacity=".4"/>
<path d="M-31 98H31L36 170H13L0 118L-13 170H-36Z" fill="url(#sxJ)" stroke="#1d3b6a" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M0 100V118M-30 104L-35 168M30 104L35 168" stroke="#a9c9f2" stroke-width="1" stroke-dasharray="2.4 2" fill="none" opacity=".55"/>
<path d="M-26 106q5 13 15 10M26 106q-5 13 -15 10" stroke="#a9c9f2" stroke-width="1" stroke-dasharray="2.4 2" fill="none" opacity=".6"/>
<ellipse cx="-24" cy="138" rx="7" ry="10" fill="#7fa8e6" opacity=".25"/><ellipse cx="24" cy="138" rx="7" ry="10" fill="#7fa8e6" opacity=".25"/>
<path d="M-30 108q4 22 -2 40M30 108q-4 22 2 40" stroke="#1d3b6a" stroke-width="1" opacity=".3" fill="none"/>
<rect x="-37" y="161" width="24" height="8" rx="1.5" fill="#5d8fd6" stroke="#1d3b6a" stroke-width="1"/><rect x="13" y="161" width="24" height="8" rx="1.5" fill="#5d8fd6" stroke="#1d3b6a" stroke-width="1"/>
<path d="M-38 169H-12V176Q-12 183 -20 183H-42Q-46 183 -45 177Z" fill="#f6f6f6" stroke="#b5b5b5" stroke-width="1.2"/><path d="M-45 180H-12" stroke="#cfcfcf" stroke-width="3"/><path d="M-36 172l14 0" stroke="#d93a3a" stroke-width="2.4" stroke-linecap="round"/>
<path d="M38 169H12V176Q12 183 20 183H42Q46 183 45 177Z" fill="#f6f6f6" stroke="#b5b5b5" stroke-width="1.2"/><path d="M45 180H12" stroke="#cfcfcf" stroke-width="3"/><path d="M36 172l-14 0" stroke="#d93a3a" stroke-width="2.4" stroke-linecap="round"/>
<path d="M-34 38C-22 28 22 28 34 38L40 106Q0 113 -40 106Z" fill="url(#sxR)" stroke="#7e121b" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M-30 44V102M-22 40V104M-14 38V106M-6 37V107M2 37V107M10 38V106M18 40V104M26 42V102" stroke="#fff" stroke-width="1" opacity=".07"/>
<path d="M-12 58q7 14 2 32M16 64q-5 12 -1 26" stroke="#000" stroke-width="1.6" opacity=".14" fill="none" stroke-linecap="round"/>
<rect x="-40" y="100" width="80" height="9" rx="3" fill="#8f1620"/><path d="M-37 101V108M-31 101V108M-25 101V108M-19 101V108M-13 101V108M-7 101V108M-1 101V108M5 101V108M11 101V108M17 101V108M23 101V108M29 101V108M35 101V108" stroke="#5e0c14" stroke-width="1" opacity=".7"/>
<rect x="-6" y="16" width="12" height="18" fill="#e2aa7f"/><path d="M-6 28Q0 34 6 28V34H-6Z" fill="#000" opacity=".12"/>
<ellipse cx="0" cy="31" rx="14" ry="7" fill="#8f1620"/><ellipse cx="0" cy="29.5" rx="9.5" ry="5" fill="#e2aa7f"/><path d="M-14 31q14 8 28 0" stroke="#5e0c14" stroke-width="1" fill="none" opacity=".6"/>
<path d="M-30 44L-54 82L-22 28" fill="none" stroke="#7e121b" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/><path d="M-30 44L-54 82L-22 28" fill="none" stroke="url(#sxR)" stroke-width="16.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M-27 34L-22 27" stroke="#8f1620" stroke-width="18" stroke-linecap="butt"/><path d="M-30 31l8 -3M-28 36l8 -3" stroke="#5e0c14" stroke-width="1" opacity=".7"/>
<path d="M-18 28C-34 56 -10 74 -40 108C-52 124 -58 140 -66 176" fill="none" stroke="#17171b" stroke-width="1.4"/>
<g id="sxGarm" class="sx-garm"><path d="M30 44L58 76L76 44" fill="none" stroke="#7e121b" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 44L58 76L76 44" fill="none" stroke="url(#sxR)" stroke-width="16.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M73 49L76 44" stroke="#8f1620" stroke-width="18" stroke-linecap="butt"/>
<g stroke="#e2aa7f" stroke-width="3.6" stroke-linecap="round" fill="none"><path d="M72 33L71 25M76 31L76 22M80 32L82 24M83 36L87 30"/><path d="M71 41L64 38"/></g><circle cx="77" cy="38" r="7.6" fill="#f2c39b" stroke="#c98a5e" stroke-width=".8"/></g>
<path d="M-18 24L-8 12" stroke="#1d1d22" stroke-width="6.4" stroke-linecap="round"/><circle cx="-18.4" cy="24.4" r="7" fill="#f2c39b" stroke="#c98a5e" stroke-width=".8"/><path d="M-17 23L-8 12" stroke="#1d1d22" stroke-width="6.4" stroke-linecap="round"/><circle cx="-5.6" cy="9.4" r="5.8" fill="#9aa3ac" stroke="#3a3f45" stroke-width="1.2"/><path d="M-9 7.6H-2.4M-9.4 10H-2M-8.6 12.2H-3" stroke="#555d66" stroke-width=".8"/>
<ellipse cx="-21.6" cy="2.4" rx="3.8" ry="5.2" fill="#e8b58b"/><ellipse cx="21.6" cy="2.4" rx="3.8" ry="5.2" fill="#e8b58b"/>
<ellipse cx="0" cy="0" rx="21" ry="23" fill="url(#sxS)"/>${fr}
<circle cx="-13" cy="9" r="4.4" fill="#ff8a7a" opacity=".3"/><circle cx="13" cy="9" r="4.4" fill="#ff8a7a" opacity=".3"/>
<g class="sx-eyes"><ellipse cx="-8" cy="-1" rx="5.2" ry="4.7" fill="#fff"/><ellipse cx="8" cy="-1" rx="5.2" ry="4.7" fill="#fff"/><circle cx="-7.4" cy="-.6" r="2.7" fill="#4f7a3a"/><circle cx="8.6" cy="-.6" r="2.7" fill="#4f7a3a"/><circle cx="-7.4" cy="-.6" r="1.2" fill="#111"/><circle cx="8.6" cy="-.6" r="1.2" fill="#111"/><circle cx="-6.4" cy="-1.8" r=".9" fill="#fff"/><circle cx="9.6" cy="-1.8" r=".9" fill="#fff"/><path d="M-13.4 -2.4Q-8 -6.6 -2.6 -2.4M2.6 -2.4Q8 -6.6 13.4 -2.4" stroke="#7a3a1a" stroke-width=".9" fill="none"/></g>
<g class="sx-brow"><path d="M-14 -8q6 -5 12 -1M2 -9q6 -4 12 1" stroke="#b8461a" stroke-width="2.7" stroke-linecap="round" fill="none"/></g>
<path d="M0 2q-3.4 7 1.2 8" stroke="#c98760" stroke-width="1.4" fill="none" stroke-linecap="round"/>
<g transform="translate(0 15)"><path class="sx-mc" d="M-6.4 0Q0 5.2 6.4 0" fill="none" stroke="#8a3a22" stroke-width="1.8" stroke-linecap="round"/><g class="sx-mo"><path d="M-6.8 -1Q0 -3.4 6.8 -1Q5.2 9.4 0 9.4Q-5.2 9.4 -6.8 -1Z" fill="#7a1f2b"/><path d="M-5.4 -1.5Q0 -3.2 5.4 -1.5V1.2H-5.4Z" fill="#fff"/><ellipse cx="0" cy="6.4" rx="3.2" ry="2" fill="#e0646b"/></g></g>
<path d="M-22 -1C-24 -26 -8 -38 6 -36C22 -34 28 -16 22 -1C20 -10 14 -18 4 -17C-4 -16.4 -12 -13 -17 -6C-19 -3 -21 -2 -22 -1Z" fill="url(#sxH)"/>
<path d="M-13 -28C-11 -48 12 -50 22 -37C14 -40 6 -38 -2 -34Z" fill="#ef7c2e"/><path d="M5 -42C9 -53 22 -51 24 -44C18 -46 12 -44 5 -42Z" fill="#f59343"/><path d="M-20 -14C-26 -22 -22 -34 -12 -36C-16 -30 -17 -22 -20 -14Z" fill="#c4470f"/>
<path d="M-14 -26q8 -10 18 -9M0 -30q10 -4 18 4M-6 -22q7 -5 14 -3" stroke="#ffb870" stroke-width="1.2" fill="none" opacity=".85" stroke-linecap="round"/><path d="M-18 -12q4 -10 14 -14" stroke="#8f3009" stroke-width="1.3" fill="none" opacity=".6"/>
<path d="M-22 -3C-23 3 -22 8 -21 10L-19 4Z" fill="#c4470f"/><path d="M22 -3C23 3 22 8 21 10L19 4Z" fill="#c4470f"/>
</g></g>`;
}
function sxScene(){
const bricks = '<pattern id="sxB" width="44" height="22" patternUnits="userSpaceOnUse"><rect width="44" height="22" fill="#2a2038"/><path d="M0 .5H44M0 11.5H44M22 .5V11M0 11.5V22M44 11.5V22" stroke="#140f1d" stroke-width="1.5"/><rect x="2" y="2" width="18" height="8" fill="#31264a" opacity=".5"/><rect x="24" y="13" width="18" height="8" fill="#31264a" opacity=".5"/></pattern>';
const bulbs = Array.from({ length: 9 }, (_, i) => `<circle cx="${22 + i * 39}" cy="259" r="3.2" fill="#ffe08a" class="sx-bulb" style="--k:${i}"/>`).join('');
const crowd = Array.from({ length: 10 }, (_, i) => `<circle class="sx-bk" style="--k:${i}" cx="${14 + i * 36}" cy="${284 + (i % 2) * 5}" r="${12 + (i % 3)}" fill="#161022" stroke="rgba(255,255,255,.07)"/>`).join('');
return `<svg class="sx-svg" viewBox="0 0 360 360" role="img" aria-label="Сериков рассказывает шутки, зал смеётся">
<defs>${bricks}
<linearGradient id="sxR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e03a42"/><stop offset="1" stop-color="#a51b25"/></linearGradient>
<linearGradient id="sxJ" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a7ec9"/><stop offset="1" stop-color="#27508f"/></linearGradient>
<radialGradient id="sxS" cx=".4" cy=".35"><stop offset="0" stop-color="#fbdcb9"/><stop offset="1" stop-color="#e3ad84"/></radialGradient>
<linearGradient id="sxH" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f08a34"/><stop offset="1" stop-color="#cf4d12"/></linearGradient>
<linearGradient id="sxSp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d8" stop-opacity=".55"/><stop offset="1" stop-color="#fff6d8" stop-opacity=".02"/></linearGradient>
<linearGradient id="sxW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5f34"/><stop offset="1" stop-color="#4e331b"/></linearGradient>
<linearGradient id="sxC" x1="0" x2="1"><stop offset="0" stop-color="#4a0f2a"/><stop offset=".5" stop-color="#8a1d49"/><stop offset="1" stop-color="#3a0b22"/></linearGradient>
</defs>
<rect width="360" height="360" fill="#0a0812"/>
<rect width="360" height="198" fill="url(#sxB)"/><rect width="360" height="198" fill="url(#sxSp)" opacity=".0"/>
<g fill="#ffe9a8" opacity=".9"><rect x="30" y="0" width="22" height="7" rx="2"/><rect x="150" y="0" width="22" height="7" rx="2"/><rect x="251" y="0" width="22" height="7" rx="2"/></g>
<g class="sx-neon-s"><rect x="288" y="14" width="42" height="21" rx="4" fill="none" stroke="#ff3a6e" stroke-width="2"/><text x="309" y="29.5" text-anchor="middle" font-family="Impact,sans-serif" font-size="14" fill="#ff3a6e" letter-spacing="1.2">LIVE</text></g>
<polygon class="sx-spot" points="250,6 276,6 352,254 176,254" fill="url(#sxSp)"/>
<rect y="196" width="360" height="56" fill="url(#sxW)"/><g stroke="rgba(0,0,0,.28)" stroke-width="1"><path d="M0 210H360M0 224H360M0 238H360"/><path d="M60 196V210M180 196V210M300 196V210M20 210V224M140 210V224M260 210V224M100 224V238M220 224V238M340 224V238"/></g>
<ellipse cx="262" cy="244" rx="64" ry="9" fill="#ffe9a8" opacity=".18"/>
<rect y="250" width="360" height="16" fill="#2b1b0e"/><rect y="250" width="360" height="3" fill="#a87a45"/>${bulbs}
<g><ellipse cx="116" cy="198" rx="16" ry="5" fill="#7a5530"/><path d="M104 200L100 246M128 200L132 246M116 202V248" stroke="#4e331b" stroke-width="3"/><rect x="110" y="184" width="10" height="14" rx="2" fill="#d6ecff" opacity=".8"/><rect x="110" y="192" width="10" height="6" fill="#8fc8ff" opacity=".7"/></g>
<path d="M0 0H26C20 70 30 130 22 252H0Z" fill="url(#sxC)"/><path d="M360 0H334C340 70 330 130 338 252H360Z" fill="url(#sxC)"/>
<path d="M9 0C7 80 12 160 8 252M17 0C15 70 20 150 15 252" stroke="rgba(0,0,0,.35)" fill="none"/><path d="M351 0C353 80 348 160 352 252M343 0C345 70 340 150 345 252" stroke="rgba(0,0,0,.35)" fill="none"/>
${sxSpeaker()}
<rect y="266" width="360" height="94" fill="#0a0812"/>${crowd}
${SX_PEOPLE.map(sxAud).join('')}
</svg>`;
}
const SX_HTML = () => `
<div class="sx" id="sx">
<div class="sx-neon"><small>вечер юмора · вход свободный</small><b>СЕРИКОВ <em>LIVE</em></b></div>
<div class="sx-scene" id="sxScene">${sxScene()}
<div class="sx-bub" id="sxBub"><span class="sx-tag" id="sxTag">РАЗОГРЕВ</span><p id="sxTx">Нажми «Шутка» — Сериков уже у микрофона.</p></div>
<div class="sx-fl" id="sxFl"></div><div class="sx-ovb" id="sxOv"><b>СТОЯЧАЯ ОВАЦИЯ</b><small>зал не может остановиться</small></div>
</div>
<div class="sx-meter"><div class="sx-mh"><small>хохот-метр</small><b id="sxLv">зал присматривается</b></div><div class="sx-bar"><i id="sxBar"></i><span></span><span></span><span></span><span></span></div></div>
<div class="sx-ctl"><button type="button" class="sx-btn" id="sxJoke">🎤 Шутка</button><button type="button" class="sx-btn alt" id="sxQuote">❝ Цитата</button></div>
<div class="sx-sc"><span>рассказано<b id="sxN">0</b></span><span>оваций<b id="sxO">0</b></span></div>
</div>
<h4 class="sx-h">Тир-лист Серикова</h4>`;
function sxAfter(root){
const live = () => root.isConnected, auds = $$('.aud', root), back = $$('.sx-bk', root), sp = $('#sxSp', root), tx = $('#sxTx', root), tag = $('#sxTag', root), bub = $('#sxBub', root), fl = $('#sxFl', root), bar = $('#sxBar', root), lv = $('#sxLv', root), ov = $('#sxOv', root), sc = $('#sxScene', root);
let ji = -1, qi = -1, level = 0, busy = false, told = 0, ovs = 0, typer = 0;
const R = (a, b) => a + Math.random() * (b - a);
const WORDS = ['ХА-ХА!', 'АХАХА', 'ХИ-ХИ', 'ПФФ', 'ГЫГЫ', '🤣', '😂', 'ХА!', 'УХАХА'];
const state = l => l >= 100 ? 'СТОЯЧАЯ ОВАЦИЯ' : l >= 80 ? 'вытирают слёзы' : l >= 60 ? 'ржут в голос' : l >= 40 ? 'смеются' : l >= 20 ? 'улыбаются' : 'зал присматривается';
const floaters = n => { for(let k = 0; k < n; k++){ const f = document.createElement('i'); f.textContent = WORDS[(Math.random() * WORDS.length) | 0]; f.style.cssText = `left:${R(4, 92)}%;bottom:${R(8, 22)}%;font-size:${R(12, 22)}px;--r:${R(-24, 24)}deg;animation-delay:${R(0, .5)}s`; fl.appendChild(f); setTimeout(() => f.remove(), 1900); } };
const hah = n => { for(let k = 0; k < n; k++) setTimeout(() => fxNoise(.07, 700 + Math.random() * 320, .3), k * 118); };
const laugh = p => {
const chance = Math.min(1, .55 + level / 160 + (p - 1) * .5);
auds.forEach((a, i) => { if(Math.random() > chance && i % 3) return; setTimeout(() => { if(!live()) return; a.classList.add('lf'); if(p > 1.05 || level > 55) a.classList.add('roar'); setTimeout(() => a.classList.remove('lf', 'roar'), 1700 + R(0, 1300)); }, R(0, 520)); });
back.forEach(b => { b.classList.add('bob'); setTimeout(() => b.classList.remove('bob'), 2200); });
floaters(5 + ((p * 4) | 0)); hah(5 + (level > 50 ? 3 : 0)); try{ navigator.vibrate?.([10, 40, 10, 40, 10]); }catch(_){}
};
const ovation = () => {
ovs++; $('#sxO', root).textContent = ovs; sc.classList.add('ovation'); auds.forEach(a => { a.classList.add('ov', 'lf', 'roar'); }); ov.classList.add('on'); hah(10);
for(let k = 0; k < 40; k++){ const c = document.createElement('i'); c.className = 'sx-cf'; c.style.cssText = `left:${R(2, 98)}%;background:${['#ffd23f', '#ff5d5d', '#4aa8ff', '#7dff9e', '#ff2e93', '#fff'][k % 6]};--dx:${R(-40, 40)}px;--r:${R(200, 900)}deg;animation-delay:${R(0, .7)}s;animation-duration:${R(1.6, 2.8)}s`; fl.appendChild(c); setTimeout(() => c.remove(), 3600); }
tink([523, 659, 784, 1047, 1319]);
setTimeout(() => { if(!live()) return; sc.classList.remove('ovation'); auds.forEach(a => a.classList.remove('ov', 'lf', 'roar')); ov.classList.remove('on'); level = 0; setBar(); }, 4600);
};
const setBar = () => { bar.style.width = Math.min(100, level) + '%'; lv.textContent = state(level); lv.classList.toggle('hot', level >= 60); };
const tell = pool => {
if(busy) return; busy = true; const idx = pool === SX_JOKES ? (ji = (ji + 1) % pool.length) : (qi = (qi + 1) % pool.length), [kind, text, p] = pool[idx];
tag.textContent = kind; tag.dataset.k = kind; bub.classList.remove('pop'); void bub.offsetWidth; bub.classList.add('pop'); tx.textContent = ''; sp.classList.add('talk'); clearInterval(typer); let c = 0; tink([392, 440]);
typer = setInterval(() => { if(!live()){ clearInterval(typer); return; } c += 1; tx.textContent = text.slice(0, c); if(c % 3 === 0) fxNoise(.02, 1200 + Math.random() * 500, .08); if(c >= text.length){ clearInterval(typer); sp.classList.remove('talk'); told++; $('#sxN', root).textContent = told;
setTimeout(() => { if(!live()) return; level = Math.min(100, level + 9 + p * 8 + R(0, 4)); setBar(); laugh(p); if(level >= 100) setTimeout(ovation, 900); setTimeout(() => { busy = false; }, level >= 100 ? 1200 : 900); }, 320); } }, 34);
};
$('#sxJoke', root).addEventListener('click', () => tell(SX_JOKES)); $('#sxQuote', root).addEventListener('click', () => tell(SX_QUOTES));
setBar();
}
{ const w = HOD['Сериков|Победитель'], oi = w.info, oa = w.after;
w.infoTitle = 'Вечер юмора Серикова';
w.info = () => SX_HTML() + oi();
w.after = root => { oa(root); sxAfter(root); }; }
frames.filter(f => f.dataset.trophy).forEach(f => { try{ buildShowcase(f); }catch(err){ console.error('buildShowcase', err); f.dataset.fb = '1'; } });
const ZAVOD = {
'Берсенев Илья и Сенченко Дмитрий': {
key: 'zbp', no: '01', title: 'Муфта', kicker: 'Чертёж № 01', tag: 'Два вала — одна ось', voteName: 'Берсенев и Сенченко',
stats: [[2, 'вала, одна ось'], [0, 'мкм люфта'], [100, '% совместимость', '%']],
infoTitle: 'Сборочный чертёж',
story: ['Есть пары, которые просто стоят рядом. А есть те, кто стыкуется с точностью до микрона. Берсенев и Сенченко — та самая муфта: один вращает, второй передаёт момент, и вместе они не пробуксовывают ни на смене, ни на сессии.', 'Допуски выдержаны. Люфт — ноль. Конструкторское бюро одобрило, технолог молча кивнул, а ОТК не нашёл, к чему придраться.'],
quote: ['«Где один вал — там нагрузка. Где два вала в одной оси — там производство».', 'Из заводской многотиражки'],
videoTitle: 'Сборка № 01', videoNote: 'Ролик проходит технический контроль.',
facts: ['Стыкуются с точностью до микрона', 'На сессии не пробуксовывают — проверено', 'Каждую смену — как по чертежу'],
ph: ['⚙️', 'Деталь на токарном станке', 'Ролик будет готов после обточки'],
art: () => `<i class="bp-x a"></i><i class="bp-x b"></i><div class="bp-st">М 1:1<small>ЛИСТ 1</small></div><svg class="bp-dim" viewBox="0 0 120 20"><path d="M2 10h116M2 4v12M118 4v12M2 10l6-3M2 10l6 3M118 10l-6-3M118 10l-6 3"/></svg>`,
info: () => `
<div class="bp-sheet" id="bpSheet" style="--t:0">
<svg class="bp-svg" viewBox="0 0 300 170" aria-label="Чертёж муфты: два вала и соединительная втулка">
<g class="bp-axis"><path d="M4 85H296"/></g>
<g class="bp-part" id="bpL"><rect x="10" y="62" width="110" height="46"/><path d="M30 62v46M36 62v46"/><rect class="key" x="60" y="62" width="24" height="7"/><path class="bp-sp" d="M44 66v38M92 66v38M100 66v38"/></g>
<g class="bp-part" id="bpR"><rect x="180" y="62" width="110" height="46"/><path d="M264 62v46M270 62v46"/><rect class="key" x="216" y="101" width="24" height="7"/><path class="bp-sp" d="M200 66v38M208 66v38M248 66v38"/></g>
<g class="bp-coup"><rect x="112" y="50" width="76" height="70" rx="3"/><path d="M112 66h76M112 104h76"/><circle cx="124" cy="58" r="2.4"/><circle cx="176" cy="58" r="2.4"/><circle cx="124" cy="112" r="2.4"/><circle cx="176" cy="112" r="2.4"/></g>
<g class="bp-dm"><path d="M10 138h110M10 133v10M120 133v10"/><text x="65" y="133">Ø42 H7</text><path d="M180 138h110M180 133v10M290 133v10"/><text x="235" y="133">Ø42 h6</text><path d="M112 26h76M112 21v10M188 21v10"/><text x="150" y="19">L 76</text></g>
<g class="bp-lb"><text x="65" y="156">А · БЕРСЕНЕВ</text><text x="235" y="156">Б · СЕНЧЕНКО</text></g>
</svg>
<div class="bp-read"><span>ЛЮФТ</span><b id="bpGap">4.20</b><span>мм</span><em id="bpOk">РАЗОБРАНО</em></div>
</div>
<label class="bp-rng"><span>Сборка</span><input type="range" min="0" max="100" value="0" aria-label="Сборка узла"><b id="bpV">0%</b></label>
<table class="bp-tbl"><tr><td>Разраб.</td><td>Берсенев И.</td><td rowspan="2">Лист<br>1</td></tr><tr><td>Пров.</td><td>Сенченко Д.</td></tr></table>`,
after: root => {
const sh = $('#bpSheet', root), r = $('input', root), g = $('#bpGap', root), ok = $('#bpOk', root), v = $('#bpV', root);
const upd = () => { const t = +r.value / 100; sh.style.setProperty('--t', t); g.textContent = ((1 - t) * 4.2).toFixed(2); v.textContent = r.value + '%'; const d = t >= .99; sh.classList.toggle('done', d); ok.textContent = d ? 'СОБРАНО · ДОПУСК ВЫДЕРЖАН' : t > .5 ? 'СБЛИЖЕНИЕ' : 'РАЗОБРАНО'; if(d && !upd.d){ upd.d = 1; tink([660, 990]); try{ navigator.vibrate?.(20); }catch(_){} } if(!d) upd.d = 0; };
r.addEventListener('input', upd); upd();
}
},
'Голиков Матвей и Лукин Александр': {
key: 'zcv', no: '02', title: 'Конвейер', kicker: 'Линия № 02', tag: 'Один грузит — другой уже отгружает', voteName: 'Голиков и Лукин',
stats: [[24, 'часа на ходу'], [0, 'остановок линии'], [1000, 'деталей за смену', '+']],
infoTitle: 'Лента в работе',
story: ['Пока один грузит, второй уже отгружает. Лента не останавливается, очередь не копится, а то, что сходит с их линии, сразу годное.', 'Голиков встречает деталь на входе, Лукин провожает на выходе — и между ними нет ни простоя, ни перекура, ни лишних слов. Мастер смены говорит, что такой слаженности он не видел с момента запуска цеха.'],
quote: ['«Если лента идёт — значит, эти двое на месте».', 'Мастер смены'],
videoTitle: 'Смена без простоев', videoNote: 'Ролик ещё едет по ленте.',
facts: ['Загрузка и отгрузка синхронны до секунды', 'За смену — тысячи деталей и ни одного брака', 'Лента останавливается только на обед. Иногда'],
ph: ['📦', 'Коробка в пути', 'Видео доедет по ленте'],
art: () => `<i class="cv-hz"></i><div class="cv-mini"><i></i><i></i><i></i></div><div class="cv-sign">ЛИНИЯ № 2</div>`,
info: () => `
<div class="cv-line" id="cvLine" style="--spd:3.2s">
<div class="cv-top"><span>▲ Загрузка · <b>Голиков</b></span><span>Отгрузка · <b>Лукин</b> ▼</span></div>
<div class="cv-belt"><div class="cv-run"><i class="cv-box" style="--k:0"></i><i class="cv-box" style="--k:1"></i><i class="cv-box" style="--k:2"></i><i class="cv-box" style="--k:3"></i><i class="cv-box" style="--k:4"></i></div><div class="cv-scan"><i></i><em>ОТК</em></div></div>
<div class="cv-rl">${'<i></i>'.repeat(16)}</div>
<div class="cv-ctl"><label><span>Скорость ленты</span><input type="range" min="1" max="10" value="5" aria-label="Скорость ленты"></label><div class="cv-count"><small>Деталей</small><b id="cvN">0</b></div></div>
<p class="cv-ok"><i></i><span id="cvS">ОТК: годно, брака нет</span></p>
</div>`,
after: root => {
const line = $('#cvLine', root), r = $('input', root), n = $('#cvN', root), s = $('#cvS', root); let c = 0;
const spd = () => (6.2 - +r.value * .5).toFixed(2); // 1→5.7с … 10→1.2с
const upd = () => { line.style.setProperty('--spd', spd() + 's'); s.textContent = +r.value > 8 ? 'ОТК: темп высокий, брака нет' : 'ОТК: годно, брака нет'; };
r.addEventListener('input', upd); upd();
const iv = setInterval(() => { if(!n.isConnected || !hodEl.classList.contains('visible')){ clearInterval(iv); return; } c += 5 / parseFloat(spd()) * .4; n.textContent = Math.floor(c); }, 400);
}
},
'Сериков Александр и Чертовских Андрей': {
key: 'zhb', no: '03', title: 'Доска почёта', kicker: 'Доска почёта', tag: 'Пятилетку — за три года', voteName: 'Сериков и Чертовских',
stats: [[3, 'года вместо пяти'], [120, '% плана', '%'], ['★', 'ударный труд']],
infoTitle: 'Выполнение плана',
story: ['Пятилетний план они закрыли за три года — и ещё остались силы на субботник. Цеховая стенгазета называет их «эталоном трудового ритма», а профком давно потерял счёт благодарностям.', 'Сериков задаёт темп, Чертовских держит качество. Вместе — стабильные сто двадцать процентов и вымпел цеха, который висит у них на стене уже третий месяц.'],
quote: ['«План — не потолок, а стартовая линия».', 'Из передовицы цеховой стенгазеты'],
videoTitle: 'Кинохроника цеха', videoNote: 'Хроника на монтаже.',
facts: ['План пятилетки закрыт за три года', 'Вымпел цеха третий месяц висит на их стене', 'Профком давно сбился со счёта благодарностей'],
ph: ['🏭', 'Хроника цеха', 'Киножурнал выйдет в ближайшую смену'],
art: () => `<i class="hb-wedge"></i><svg class="hb-star" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 4l13 31 33 3-25 22 8 33-29-18-29 18 8-33L4 38l33-3z"/></svg><div class="hb-sign">ДОСКА<br>ПОЧЁТА</div>`,
info: () => `
<div class="hb-plan">
<div class="hb-hd"><b>План пятилетки</b><span>цех № 3</span></div>
<div class="hb-th"><div class="hb-tube"><i id="hbFill"></i></div><div class="hb-sc">${[0, 20, 40, 60, 80, 100, 120].map(n => `<span style="left:${n / 120 * 100}%">${n}</span>`).join('')}<em style="left:${100 / 120 * 100}%">ПЛАН</em></div></div>
<div class="hb-pct"><b id="hbPct">0</b><span>%</span></div>
<button type="button" class="hb-hit" id="hbHit">Ударить по плану ⚒</button>
<div class="hb-medal" id="hbMedal"><svg viewBox="0 0 100 130" aria-hidden="true"><path d="M30 0h40l-6 44H36z" fill="#b3261e"/><path d="M42 0h16l-3 44H45z" fill="#efe3c7" opacity=".8"/><circle cx="50" cy="84" r="38" fill="#d4a84b" stroke="#7a5620" stroke-width="3"/><circle cx="50" cy="84" r="30" fill="none" stroke="#7a5620" stroke-width="1.5"/><path d="M50 58l7 17 18 1-14 12 5 18-16-10-16 10 5-18-14-12 18-1z" fill="#b3261e"/></svg><div><b>Ударники труда</b><span>Сериков · Чертовских</span></div></div>
</div>`,
after: root => {
const fill = $('#hbFill', root), pct = $('#hbPct', root), btn = $('#hbHit', root), med = $('#hbMedal', root); let v = 0;
const upd = () => { fill.style.width = (v / 120 * 100) + '%'; pct.textContent = v; med.classList.toggle('on', v >= 100); btn.textContent = v >= 120 ? 'Перевыполнено! Ещё раз' : 'Ударить по плану ⚒'; pct.parentNode.classList.toggle('over', v > 100); };
btn.addEventListener('click', () => { v = v >= 120 ? 0 : Math.min(120, v + 10); btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit'); upd(); tink([220, 330]); try{ navigator.vibrate?.(14); }catch(_){} if(v === 100) tink([1047, 1568, 2093]); });
upd();
}
},
'Куликов Виталий и Сидоров Никита': {
key: 'zpn', no: '04', title: 'Пульт', kicker: 'Пульт № 04', tag: 'Один рычаг ничего не запускает', voteName: 'Куликов и Сидоров',
stats: [[2, 'рычага, один пуск'], [100, '% синхронность', '%'], [0, 'аварийных остановок']],
infoTitle: 'Запуск линии',
story: ['Линия запускается только двумя руками: один тянет рычаг А, второй — рычаг Б, и только вместе. Один без другого — аварийная блокировка, и пульт тут же скажет, кто опоздал.', 'Куликов и Сидоров научились делать это одним движением. Поэтому на заводе их всегда видят вместе — и поэтому линия у них никогда не стоит.'],
quote: ['«Рычаг один — а пуск общий».', 'Инструкция по запуску линии № 4'],
videoTitle: 'Запись с пульта', videoNote: 'Запись снимается с диспетчерской.',
facts: ['Пуск линии возможен только в четыре руки', 'Рассинхрон пульт замечает за долю секунды', 'У этих двоих аварийных остановок — ноль'],
ph: ['🎛️', 'Диспетчерская', 'Запись выйдет после запуска линии'],
art: () => `<div class="pn-lamps"><i></i><i></i><i></i><i></i></div><i class="pn-scr a"></i><i class="pn-scr b"></i><div class="pn-sign">ПУЛЬТ № 04</div>`,
info: () => `
<div class="pn" id="pn">
<div class="pn-main">
<button type="button" class="pn-lever" data-k="0" aria-label="Рычаг А — Куликов"><span class="pn-track"><i class="pn-knob"></i></span><b>А</b><small>Куликов</small></button>
<svg class="pn-gauge" viewBox="0 0 120 84" aria-hidden="true"><path class="pn-arc" d="M12 72A48 48 0 0 1 108 72"/><path class="pn-arc g" d="M84 30A48 48 0 0 1 108 72"/>${Array.from({length: 11}, (_, i) => { const a = (-90 + i * 18) * Math.PI / 180, r1 = 44, r2 = i % 5 ? 49 : 53; return `<path class="pn-tk" d="M${(60 + r1 * Math.cos(a)).toFixed(1)} ${(72 + r1 * Math.sin(a)).toFixed(1)}L${(60 + r2 * Math.cos(a)).toFixed(1)} ${(72 + r2 * Math.sin(a)).toFixed(1)}"/>`; }).join('')}<g class="pn-nd"><path d="M60 72V30"/></g><circle cx="60" cy="72" r="5"/></svg>
<button type="button" class="pn-lever" data-k="1" aria-label="Рычаг Б — Сидоров"><span class="pn-track"><i class="pn-knob"></i></span><b>Б</b><small>Сидоров</small></button>
</div>
<div class="pn-status" id="pnSt" aria-live="polite">ЛИНИЯ ОСТАНОВЛЕНА</div>
<div class="pn-leds"><i></i><i></i><i></i><i></i><i></i></div>
<p class="pn-tip">Потяни оба рычага вместе. Один — не запустит.</p>
</div>`,
after: root => {
const pn = $('#pn', root), lv = $$('.pn-lever', root), st = $('#pnSt', root), down = [false, false]; let timer = 0, onFlag = false;
const render = () => {
const n = down.filter(Boolean).length;
pn.dataset.s = n === 2 ? 'run' : n === 1 ? 'warn' : 'stop';
pn.style.setProperty('--n', n === 2 ? 100 : n === 1 ? 38 : 0);
st.textContent = n === 2 ? 'ЛИНИЯ ЗАПУЩЕНА · СИНХРОННО' : n === 1 ? 'РАССИНХРОН · ЖДЁМ ВТОРОЙ РЫЧАГ' : 'ЛИНИЯ ОСТАНОВЛЕНА';
lv.forEach((l, i) => l.classList.toggle('down', down[i]));
if(n === 2 && !onFlag){ onFlag = true; tink([523, 784, 1047]); try{ navigator.vibrate?.([20, 40, 20]); }catch(_){} } if(n < 2) onFlag = false;
clearTimeout(timer);
if(n === 1) timer = setTimeout(() => { if(!pn.isConnected) return; down[0] = down[1] = false; render(); st.textContent = 'АВАРИЙНЫЙ СБРОС · РЫЧАГИ ТЯНУТ ВДВОЁМ'; pn.dataset.s = 'alarm'; tink([196]); }, 2400);
};
lv.forEach(l => l.addEventListener('click', () => { const k = +l.dataset.k; down[k] = !down[k]; render(); }));
render();
}
}
};
Object.assign(HOD, Object.fromEntries(Object.entries(ZAVOD).map(([k, v]) => [k + '|Завод', v])));
const HAT_COL = ['#ffcc00', '#ff7a1a', '#f4f4f4', '#3aa0ff', '#7ad06b', '#ff5d5d', '#d8d8d8', '#ffb62e'];
const hardHat = c => `<svg class="zb-hat" viewBox="0 0 44 26" aria-hidden="true"><path d="M5 21c0-10 7-17 17-17s17 7 17 17z" fill="${c}"/><path d="M18 4h8v12h-8z" fill="rgba(255,255,255,.4)"/><rect x="2" y="20" width="40" height="4.5" rx="2.2" fill="${c}"/><path d="M5 21c0-10 7-17 17-17s17 7 17 17" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/></svg>`;
const gearPath = (n, r1, r2) => { let d = ''; const w = 2 * Math.PI / n, P = (r, a) => (50 + r * Math.cos(a)).toFixed(1) + ' ' + (50 + r * Math.sin(a)).toFixed(1); for(let i = 0; i < n; i++){ const a = i * w; d += (i ? 'L' : 'M') + P(r1, a) + 'L' + P(r2, a + w * .16) + 'L' + P(r2, a + w * .5) + 'L' + P(r1, a + w * .66); } return d + 'Z'; };
const gearSvg = (n, cls) => `<svg class="zh-gear ${cls}" viewBox="0 0 100 100" aria-hidden="true"><path fill-rule="evenodd" d="${gearPath(n, 38, 47)}M50 36a14 14 0 1 0 .1 0z"/></svg>`;
const gaugeSvg = (label, val) => `<div class="zh-g" style="--v:${val}"><svg viewBox="0 0 100 70" aria-hidden="true"><path class="arc" d="M8 60A42 42 0 0 1 92 60"/>${Array.from({length: 9}, (_, i) => { const a = (-180 + i * 22.5) * Math.PI / 180; return `<path class="tk" d="M${(50 + 36 * Math.cos(a)).toFixed(1)} ${(60 + 36 * Math.sin(a)).toFixed(1)}L${(50 + 42 * Math.cos(a)).toFixed(1)} ${(60 + 42 * Math.sin(a)).toFixed(1)}"/>`; }).join('')}<g class="nd"><path d="M50 60L50 26"/></g><circle cx="50" cy="60" r="4"/></svg><span>${label}</span></div>`;
function zBeep(ok = true){ try{ const ac = tink.ac || (tink.ac = new (window.AudioContext || window.webkitAudioContext)()); if(ac.state === 'suspended') ac.resume(); [[ok ? 1100 : 300, 0, .09], [ok ? 1650 : 300, .1, .14]].forEach(([f, d, l]) => { const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + d; o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + l); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + l + .02); }); }catch(_){} }
function buildZavod(frame){
const noms = $$('.nominee:not([hidden])', frame);
if(!noms.length) return;
const barcode = seed => { let x = '', p = 2, s = seed * 9301 + 49297; while(p < 96){ s = (s * 9301 + 49297) % 233280; const w = 1 + (s % 3); x += `<rect x="${p}" y="0" width="${w}" height="22"/>`; p += w + 1 + (s % 2); } return `<svg viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true">${x}</svg>`; };
const badges = noms.map((nom, i) => {
const full = $('.nominee-front h3', nom)?.textContent.trim() || nom.dataset.nominee;
const z = ZAVOD[nom.dataset.nominee] || { no: String(i + 1).padStart(2, '0') };
const ppl = full.split(/\s+и\s+/).map(s => { const p = s.trim().split(/\s+/); return { s: p[0], f: p.slice(1).join(' ') }; });
const src = $('.nominee-front img', nom)?.getAttribute('src') || '';
const people = src
? `<span class="zb-duo"><img src="${esc(src)}" alt="${esc(full)}" draggable="false" loading="lazy" decoding="async"></span>`
: ppl.map((p, k) => `<span class="zb-p"><span class="zb-av">${hardHat(HAT_COL[(i * 2 + k) % 8])}<i>${esc((p.s[0] || '') + (p.f[0] || ''))}</i></span><b>${esc(p.s)}</b><small>${esc(p.f)}</small></span>${k === 0 ? '<span class="zb-amp">&amp;</span>' : ''}`).join('');
const names = ppl.map(p => p.s).join(' и ');
return `<article class="zb" data-i="${i}" style="--i:${i}">
<i class="zb-hook"></i><i class="zb-strap"></i><i class="zb-clip"></i>
<button type="button" class="zb-card" aria-label="Пропуск: ${esc(names)}">
<i class="zb-slot"></i><i class="zb-led"></i>
<span class="zb-band"><em>ЗАВОД</em><i>СМЕНА ${'АБВГ'[i % 4]}</i></span>
<span class="zb-no"><small>бригада</small><b>${z.no}</b></span>
<span class="zb-people">${people}</span>
<span class="zb-foot">${barcode(i + 3)}<small>таб. № ${String(4170 + i * 2)}–${String(4171 + i * 2)}</small></span>
<i class="zb-holo"></i>
</button>
<p class="zb-t">${esc(z.title || '')}</p>
</article>`;
}).join('');
const board = document.createElement('div');
board.className = 'zavod';
const total = typeof TOTAL_NOMS === 'number' ? TOTAL_NOMS : 7, idx = frames.indexOf(frame);
board.innerHTML = `
<header class="lxn-head zh">
<div class="lxn-kick"><span>Номинация ${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span><span>Проходная · смена 1</span></div>
<h2 class="lxn-title">Заводчанин <em>года</em></h2>
<p class="lxn-lede">Четыре бригады, три завода: молоко, картон, автомобили. Приложи пропуск — откроется дело бригады.</p>
<div class="zh-reader"><i class="zh-l"></i><b id="zhMsg">Приложите пропуск</b><span class="zl-time">07:00</span></div>
<dl class="zl-facts"><div><dt>Бригад</dt><dd>${String(noms.length).padStart(2, '0')}</dd></div><div><dt>Заводов</dt><dd>03</dd></div><div><dt>Смена</dt><dd>I</dd></div></dl>
</header>
<div class="zb-board">${badges}</div>
<p class="lxn-hint zavod-hint">Нажми на пропуск — он пройдёт через считыватель.</p>`;
$('.nominee-subblock', frame).before(board); frame.classList.add('lxn');
const zh = $('.zh', board), msg = $('#zhMsg', board), reader = $('.zh-reader', board), cards = $$('.zb', board);
const show = () => zh.classList.add('lit');
if('IntersectionObserver' in window){ const io = new IntersectionObserver(es => { if(es.some(e => e.isIntersecting)){ show(); cards.forEach(c => c.classList.add('in')); io.disconnect(); } }, { threshold: .15 }); io.observe(board); } else { show(); cards.forEach(c => c.classList.add('in')); }
setTimeout(() => { show(); cards.forEach(c => c.classList.add('in')); }, 4000);
let busy = false;
board.addEventListener('click', e => {
const b = e.target.closest('.zb'); if(!b || busy) return; busy = true;
const i = +b.dataset.i;
b.classList.add('swipe'); reader.classList.add('ok'); msg.textContent = 'Доступ разрешён · бригада ' + (ZAVOD[noms[i].dataset.nominee]?.no || '');
zBeep(true); try{ navigator.vibrate?.(16); }catch(_){}
setTimeout(() => { openCandidate(noms[i], 'history'); }, 520);
setTimeout(() => { b.classList.remove('swipe'); reader.classList.remove('ok'); msg.textContent = 'Приложите пропуск'; busy = false; }, 1600);
});
}
frames.filter(f => f.dataset.zavod).forEach(f => { try{ buildZavod(f); }catch(err){ console.error('buildZavod', err); f.dataset.fb = '1'; } });
const CAR_GY = 215; // линия земли
const _h2r = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
const _r2h = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const carMix = (a, b, t) => { const x = _h2r(a), y = _h2r(b); return _r2h(x.map((v, i) => v + (y[i] - v) * t)); };
const carLight = (c, t) => carMix(c, '#ffffff', t), carDark = (c, t) => carMix(c, '#000000', t);
function carWheel(cx, cy, r, st, id){
const rim = r * st.rim;                       // радиус обода
let spokes = '';
const n = st.spokes || 5;
if(st.kind === 'steel'){
// штамповка + пластиковый колпак
let holes = '';
for(let k = 0; k < 8; k++){ const a = k * Math.PI / 4 + .2; holes += `<ellipse cx="${(Math.cos(a) * rim * .7).toFixed(1)}" cy="${(Math.sin(a) * rim * .7).toFixed(1)}" rx="${(rim * .13).toFixed(1)}" ry="${(rim * .06).toFixed(1)}" transform="rotate(${(a * 180 / Math.PI).toFixed(0)} ${(Math.cos(a) * rim * .7).toFixed(1)} ${(Math.sin(a) * rim * .7).toFixed(1)})" fill="#0c0d0e"/>`; }
spokes = `<circle r="${rim}" fill="url(#${id}-steel)"/><circle r="${(rim * .93).toFixed(1)}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1"/>${holes}
<circle r="${(rim * .52).toFixed(1)}" fill="#1b1c1e"/><circle r="${(rim * .47).toFixed(1)}" fill="url(#${id}-cap)"/>
${Array.from({ length: 10 }, (_, k) => { const a = k * Math.PI / 5; return `<path d="M${(Math.cos(a) * rim * .15).toFixed(1)} ${(Math.sin(a) * rim * .15).toFixed(1)}L${(Math.cos(a) * rim * .46).toFixed(1)} ${(Math.sin(a) * rim * .46).toFixed(1)}" stroke="#000" stroke-opacity=".3" stroke-width="1"/>`; }).join('')}
<circle r="${(rim * .13).toFixed(1)}" fill="#2a2c2f"/>`;
} else {
const hub = rim * .2;
for(let k = 0; k < n; k++){
const a = k * 2 * Math.PI / n, P = (rr, aa) => `${(Math.cos(aa) * rr).toFixed(1)} ${(Math.sin(aa) * rr).toFixed(1)}`;
if(st.kind === 'split'){ // двойные спицы
const w = .2, w2 = .07;
spokes += `<path d="M${P(hub, a - w)}L${P(rim * .96, a - w * .62)}L${P(rim * .96, a - w2)}L${P(hub * 1.2, a - .05)}Z" fill="url(#${id}-spoke)"/><path d="M${P(hub, a + w)}L${P(rim * .96, a + w * .62)}L${P(rim * .96, a + w2)}L${P(hub * 1.2, a + .05)}Z" fill="url(#${id}-spoke)"/>`;
} else if(st.kind === 'turbine'){
spokes += `<path d="M${P(hub, a)}Q${P(rim * .55, a + .55)} ${P(rim * .96, a + .22)}L${P(rim * .96, a + .02)}Q${P(rim * .5, a + .26)} ${P(hub, a + .5)}Z" fill="url(#${id}-spoke)"/>`;
} else { // 5 спиц «лопата»
const w = Math.PI / n * .55;
spokes += `<path d="M${P(hub, a - .3)}L${P(rim * .96, a - w)}L${P(rim * .96, a + w)}L${P(hub, a + .3)}Z" fill="url(#${id}-spoke)"/><path d="M${P(rim * .25, a)}L${P(rim * .9, a)}" stroke="#000" stroke-opacity=".28" stroke-width="1.2"/>`;
}
}
spokes = `<circle r="${rim}" fill="#14161a"/>
<circle r="${(rim * .88).toFixed(1)}" fill="url(#${id}-disc)"/><circle r="${(rim * .88).toFixed(1)}" fill="none" stroke="#000" stroke-opacity=".5"/>
<circle r="${(rim * .66).toFixed(1)}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/>
${spokes}
<circle r="${(rim * .22).toFixed(1)}" fill="${st.cap || '#2a2c2f'}" stroke="#000" stroke-opacity=".4"/><circle r="${(rim * .11).toFixed(1)}" fill="#e8ebee" fill-opacity=".8"/>
${[0, 1, 2, 3].map(k => { const a = k * Math.PI / 2 + .78; return `<circle cx="${(Math.cos(a) * rim * .32).toFixed(1)}" cy="${(Math.sin(a) * rim * .32).toFixed(1)}" r="${(rim * .035).toFixed(1)}" fill="#111"/>`; }).join('')}
<circle r="${rim}" fill="none" stroke="${st.lip || '#e2e6ea'}" stroke-width="${(r * .05).toFixed(1)}" stroke-opacity=".85"/>`;
}
const cal = st.kind === 'steel' ? '' : `<path d="M${(rim * .15).toFixed(1)} ${(-rim * .62).toFixed(1)}A${(rim * .64).toFixed(1)} ${(rim * .64).toFixed(1)} 0 0 1 ${(rim * .62).toFixed(1)} ${(-rim * .15).toFixed(1)}L${(rim * .74).toFixed(1)} ${(-rim * .12).toFixed(1)}A${(rim * .76).toFixed(1)} ${(rim * .76).toFixed(1)} 0 0 0 ${(rim * .16).toFixed(1)} ${(-rim * .74).toFixed(1)}Z" fill="${st.caliper || '#c0201b'}" stroke="#000" stroke-opacity=".4" stroke-width=".8"/>`;
return `<g transform="translate(${cx} ${cy})">
<circle r="${r}" fill="url(#${id}-tire)"/>
<circle r="${(r * .97).toFixed(1)}" fill="none" stroke="#2c2f33" stroke-width="1.4"/>
<circle r="${(r * .9).toFixed(1)}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="2.4"/>
<path d="M${(-r * .8).toFixed(1)} ${(-r * .3).toFixed(1)}A${(r * .85).toFixed(1)} ${(r * .85).toFixed(1)} 0 0 1 ${(r * .3).toFixed(1)} ${(-r * .8).toFixed(1)}" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2.4" stroke-linecap="round"/>
<circle r="${(rim * 1.05).toFixed(1)}" fill="#0a0b0c"/>
<g class="whl">${spokes}</g>${cal}
<circle r="${(rim * 1.02).toFixed(1)}" fill="none" stroke="#fff" stroke-opacity=".08"/>
</g>`;
}
const CAR_MODELS = {
polo: {
w: [146, 477, 40], base: '#aeb5bd', wheel: { kind: 'split', spokes: 5, rim: .76, caliper: '#8a8f95', lip: '#cfd5da' },
outline: 'M40 189L38 176C35 166 34 150 35 134C35 124 36 116 40 108C70 99 120 95 170 93C188 84 232 50 256 30C264 25 280 24 300 24L350 24C386 24 408 38 436 86C468 93 522 99 560 108C588 114 604 124 606 142L606 168C606 180 604 186 598 189L523 189A46 46 0 0 0 431 189L192 189A46 46 0 0 0 100 189Z',
arches: [[146, 477, 46]], sill: [192, 431],
glass: ['M356 88L356 33C384 33 402 44 424 86Z', 'M343 88L343 33L262 33C238 52 214 74 196 88Z'],
frames: 'M356 34L356 88M343 34L343 88',
cut: ['M431 90C429 122 430 160 433 183', 'M349 90C347 128 348 160 350 183', 'M197 92C194 128 195 160 196 183', 'M60 103C58 122 57 150 58 176'],
belt: 'M66 120C200 111 360 110 592 124', belt2: 'M66 150C200 146 380 146 598 152',
handles: ['M395 103h22', 'M306 104h22'], mirror: 'M426 90L444 92L447 101L428 102Z', mirrorX: 436,
head: 'M556 108C576 113 597 119 605 132L604 141C586 137 566 128 552 118Z', headIn: [583, 126], headBeam: [600, 128],
tail: 'M37 112C46 107 58 105 70 106L66 134C54 134 43 134 36 134Z', tailBeam: [37, 122],
extras: `<path d="M575 150C590 150 600 152 606 156L606 168L578 168Z" fill="#101113" opacity=".9"/><path d="M582 154h20" stroke="#4a4e54" stroke-width="1"/><circle cx="592" cy="160" r="4.5" fill="#d9dde0" stroke="#000" stroke-opacity=".5"/><path d="M40 168L40 186L120 186" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="1"/>
<path d="M338 114h8" stroke="#000" stroke-opacity=".5" stroke-width="2"/><rect x="160" y="108" width="14" height="9" rx="2" fill="none" stroke="#000" stroke-opacity=".35"/>`,
headrests: [[366, 50], [300, 52], [262, 56]], spoiler: '',
trim: 'M192 183L431 183L431 189L192 189Z', chrome: 'M345 90L436 90', roofRail: ''
},
granta: {
w: [158, 480, 38], base: '#101114', wheel: { kind: 'steel', rim: .78 },
outline: 'M44 190L42 178C40 166 40 148 41 132C41 120 43 110 47 104C72 98 112 95 148 93C176 88 218 52 246 28C256 22 274 20 298 20L346 20C376 20 398 32 430 84C460 91 518 97 556 104C578 108 592 116 596 132L596 166C596 180 594 188 588 190L524 190A46 46 0 0 0 436 190L202 190A46 46 0 0 0 114 190Z',
arches: [[158, 480, 46]], sill: [202, 436],
glass: ['M362 86L362 28C386 28 402 38 422 82Z', 'M348 86L348 28L268 28C246 46 222 68 204 86Z'],
frames: 'M362 29L362 86M348 29L348 86',
cut: ['M436 88C434 124 435 160 438 184', 'M355 88C353 126 354 160 356 184', 'M205 90C201 126 202 160 204 184', 'M60 98C58 118 57 150 58 176'],
belt: 'M70 116C210 108 380 108 580 120', belt2: 'M70 148C210 144 390 144 590 150',
handles: ['M398 102h20', 'M312 103h20'], mirror: 'M430 88L448 90L451 99L432 100Z', mirrorX: 440,
head: 'M558 104C574 108 592 114 596 128L595 138C580 135 564 128 552 118Z', headIn: [580, 122], headBeam: [594, 126],
tail: 'M42 108C50 104 62 102 74 102L70 130C56 130 46 130 41 130Z', tailBeam: [42, 118],
extras: `<path d="M560 152C578 152 592 154 596 158L596 168L564 168Z" fill="#0d0e10"/><path d="M566 156h26" stroke="#3a3d42" stroke-width="1"/><circle cx="582" cy="162" r="4" fill="#c9ced2" stroke="#000" stroke-opacity=".5"/>
<rect x="168" y="106" width="14" height="9" rx="2" fill="none" stroke="#000" stroke-opacity=".35"/>`,
headrests: [[372, 46], [306, 48], [268, 52]], spoiler: '', trim: 'M202 184L436 184L436 190L202 190Z', chrome: '', roofRail: ''
},
vaz2112: {
w: [160, 484, 38], base: '#6d7b6a', wheel: { kind: 'turbine', spokes: 6, rim: .78, lip: '#c9ced2', caliper: '#555a60' },
outline: 'M50 190L48 178C46 168 46 150 47 136C48 124 52 112 58 104C80 86 130 56 192 36C210 30 226 30 250 30L338 30C368 30 392 42 420 84C450 92 520 100 556 106C574 110 586 118 588 132L588 166C588 180 586 188 580 190L528 190A46 46 0 0 0 440 190L206 190A46 46 0 0 0 114 190Z',
arches: [[160, 484, 46]], sill: [206, 440],
glass: ['M352 90L352 36C374 36 392 46 414 86Z', 'M338 90L338 36L248 36L224 90Z', 'M216 90L238 42C198 54 152 72 108 92Z'],
frames: 'M352 36L352 90M338 36L338 90M231 36L220 90',
cut: ['M432 92C430 124 431 160 434 184', 'M345 92C343 128 344 160 346 184', 'M203 94C199 128 200 160 202 184', 'M96 100L96 150'],
belt: 'M66 122C210 112 370 110 580 122', belt2: 'M66 152C210 148 390 148 586 154',
handles: ['M394 105h20', 'M306 106h20'], mirror: 'M424 90L442 92L445 101L426 102Z', mirrorX: 434,
head: 'M552 106C568 109 584 116 588 128L587 137C572 134 558 127 546 118Z', headIn: [574, 122], headBeam: [586, 124],
tail: 'M47 120C50 112 56 106 62 102L84 100L82 128C68 130 56 130 47 130Z', tailBeam: [48, 118],
extras: `<path d="M556 152C572 152 584 154 588 158L588 168L560 168Z" fill="#0d0e10"/><path d="M562 156h22" stroke="#3a3d42" stroke-width="1"/><circle cx="578" cy="162" r="4" fill="#c9ced2" stroke="#000" stroke-opacity=".5"/>
<rect x="118" y="112" width="14" height="9" rx="2" fill="none" stroke="#000" stroke-opacity=".35"/>`,
headrests: [[368, 52], [300, 54], [262, 58]],
spoiler: '<path d="M56 100C70 92 90 84 108 78L112 82C94 90 76 98 62 106Z" fill="#101113" stroke="#000" stroke-opacity=".4"/>',
wing: '<path d="M72 92L74 70M100 80L102 62" stroke="#0b0c0d" stroke-width="4"/><path d="M52 66C70 62 98 56 122 50L124 58C100 64 74 70 56 74Z" fill="#0e0f11" stroke="#000" stroke-opacity=".5"/><path d="M54 67C72 63 98 57 121 51" stroke="#fff" stroke-opacity=".25" fill="none"/>',
trim: 'M206 184L440 184L440 190L206 190Z', chrome: '', roofRail: ''
},
vaz2109: {
w: [160, 484, 38], base: '#a9382f', wheel: { kind: 'turbine', spokes: 6, rim: .78, lip: '#c9ced2', caliper: '#555a60' },
outline: 'M50 190L48 178C46 168 46 150 47 136C48 124 52 112 58 104C72 92 108 70 150 46C166 36 186 32 214 32L330 32C362 32 390 44 418 84C450 92 520 100 556 106C574 110 586 118 588 132L588 166C588 180 586 188 580 190L528 190A46 46 0 0 0 440 190L206 190A46 46 0 0 0 114 190Z',
arches: [[160, 484, 46]], sill: [206, 440],
glass: ['M352 90L352 36C374 36 392 46 414 86Z', 'M338 90L336 38L236 38L212 90Z', 'M204 90L226 44C190 50 160 62 118 92Z'],
frames: 'M352 36L352 90M338 36L338 90M224 38L212 90',
cut: ['M432 92C430 124 431 160 434 184', 'M345 92C343 128 344 160 346 184', 'M203 94C199 128 200 160 202 184', 'M96 100L96 150'],
belt: 'M66 122C210 112 370 110 580 122', belt2: 'M66 152C210 148 390 148 586 154',
handles: ['M394 105h20', 'M306 106h20'], mirror: 'M424 90L442 92L445 101L426 102Z', mirrorX: 434,
head: 'M552 106C568 109 584 116 588 128L587 137C572 134 558 127 546 118Z', headIn: [574, 122], headBeam: [586, 124],
tail: 'M47 120C50 112 56 106 62 102L84 100L82 128C68 130 56 130 47 130Z', tailBeam: [48, 118],
extras: `<path d="M556 152C572 152 584 154 588 158L588 168L560 168Z" fill="#0d0e10"/><path d="M562 156h22" stroke="#3a3d42" stroke-width="1"/><circle cx="578" cy="162" r="4" fill="#c9ced2" stroke="#000" stroke-opacity=".5"/>
<rect x="118" y="112" width="14" height="9" rx="2" fill="none" stroke="#000" stroke-opacity=".35"/>`,
headrests: [[368, 52], [300, 54], [262, 58]],
spoiler: '<path d="M56 100C70 92 90 84 108 78L112 82C94 90 76 98 62 106Z" fill="#101113" stroke="#000" stroke-opacity=".4"/>',
wing: '<path d="M72 92L74 70M100 80L102 62" stroke="#0b0c0d" stroke-width="4"/><path d="M52 66C70 62 98 56 122 50L124 58C100 64 74 70 56 74Z" fill="#0e0f11" stroke="#000" stroke-opacity=".5"/><path d="M54 67C72 63 98 57 121 51" stroke="#fff" stroke-opacity=".25" fill="none"/>',
trim: 'M206 184L440 184L440 190L206 190Z', chrome: '', roofRail: ''
}
};
function carSvg(key, o = {}){
const m = CAR_MODELS[key]; if(!m) return '';
const id = o.id || ('c' + key + Math.random().toString(36).slice(2, 6));
const base = o.color || m.base, wh = o.wheel || m.wheel;
const _dk = _h2r(base).reduce((a, b) => a + b, 0) < 160, c1 = carLight(base, _dk ? .2 : .38), c2 = carLight(base, _dk ? .04 : .08), c3 = carDark(base, .22), c4 = carDark(base, .5);
const isDark = _h2r(base).reduce((a, b) => a + b, 0) < 160;
const [rx, fx, wr] = m.w, wy = CAR_GY - wr;
const clip = `<clipPath id="${id}-cl"><path d="${m.outline}"/></clipPath>`;
const defs = `<defs>${clip}
<linearGradient id="${id}-body" gradientUnits="userSpaceOnUse" x1="0" y1="22" x2="0" y2="190"><stop offset="0" stop-color="${c1}"/><stop offset=".3" stop-color="${c2}"/><stop offset=".4" stop-color="${carDark(base, .12)}"/><stop offset=".58" stop-color="${base}"/><stop offset=".8" stop-color="${c3}"/><stop offset="1" stop-color="${c4}"/></linearGradient>
<linearGradient id="${id}-sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".18" stop-color="#fff" stop-opacity="${isDark ? .22 : .4}"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="${isDark ? .18 : .32}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="${id}-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${isDark ? .5 : .7}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="${id}-low" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
<linearGradient id="${id}-gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2d4254"/><stop offset=".5" stop-color="#111a22"/><stop offset="1" stop-color="#05080b"/></linearGradient>
<linearGradient id="${id}-glr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset=".38" stop-color="#fff" stop-opacity=".06"/><stop offset=".42" stop-color="#fff" stop-opacity=".16"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".1"/></linearGradient>
<radialGradient id="${id}-tire" cx=".5" cy=".5" r=".5"><stop offset=".6" stop-color="#1a1b1d"/><stop offset=".9" stop-color="#0c0d0e"/><stop offset="1" stop-color="#2a2c2f"/></radialGradient>
<radialGradient id="${id}-disc" cx=".5" cy=".5" r=".5"><stop offset=".3" stop-color="#8c9298"/><stop offset=".6" stop-color="#555a60"/><stop offset="1" stop-color="#2f3236"/></radialGradient>
<linearGradient id="${id}-spoke" x1="0" y1="0" x2="1" y2="1">${wh.dark ? '<stop offset="0" stop-color="#4a4e54"/><stop offset=".5" stop-color="#1c1e21"/><stop offset="1" stop-color="#0a0b0c"/>' : '<stop offset="0" stop-color="#f1f4f6"/><stop offset=".5" stop-color="#aeb4ba"/><stop offset="1" stop-color="#6e747a"/>'}</linearGradient>
<radialGradient id="${id}-steel" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#d4d8dc"/><stop offset=".6" stop-color="#8c9298"/><stop offset="1" stop-color="#4a4e54"/></radialGradient>
<radialGradient id="${id}-cap" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#4a4d52"/><stop offset="1" stop-color="#17181a"/></radialGradient>
<linearGradient id="${id}-hl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f9ff"/><stop offset=".5" stop-color="#b9c6d3"/><stop offset="1" stop-color="#5b6672"/></linearGradient>
<linearGradient id="${id}-tl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5a4d"/><stop offset=".6" stop-color="#b0120e"/><stop offset="1" stop-color="#5c0705"/></linearGradient>
<radialGradient id="${id}-beam" cx="0" cy=".5" r="1"><stop offset="0" stop-color="#fffbe6" stop-opacity="1"/><stop offset=".4" stop-color="#fff2b8" stop-opacity=".5"/><stop offset="1" stop-color="#fff2b8" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}-tbeam" cx="1" cy=".5" r="1"><stop offset="0" stop-color="#ff4a3c" stop-opacity=".8"/><stop offset="1" stop-color="#ff4a3c" stop-opacity="0"/></radialGradient>
<filter id="${id}-bl" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="5"/></filter>
<mask id="${id}-rm"><rect x="0" y="${CAR_GY}" width="640" height="60" fill="url(#${id}-rf)"/></mask>
<linearGradient id="${id}-rf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>`;
const arches = m.arches[0], archFill = [rx, fx].map(x => `<circle cx="${x}" cy="${wy}" r="${arches[2]}" fill="#07080a" clip-path="url(#${id}-ac)"/>`).join('');
const archClip = `<clipPath id="${id}-ac"><rect x="0" y="0" width="640" height="${CAR_GY - wr + 14}"/></clipPath>`;
const lipArch = [rx, fx].map(x => { const dy = 189 - wy + (CAR_GY === 215 ? 0 : 0); const r = arches[2], dx = Math.sqrt(Math.max(0, r * r - (m.outline.includes('L206 190') || m.outline.includes('L202 190') || m.outline.includes('L524 190') || m.outline.includes('L528 190') ? (190 - wy) * (190 - wy) : (189 - wy) * (189 - wy)))); const yb = (m.outline.includes('190A') || /L2\d\d 190/.test(m.outline) || /L5\d\d 190/.test(m.outline)) ? 190 : 189; return `<path d="M${(x + dx).toFixed(1)} ${yb}A${r} ${r} 0 0 0 ${(x - dx).toFixed(1)} ${yb}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="2.2"/><path d="M${(x + dx + 1).toFixed(1)} ${yb - 1}A${r + 2} ${r + 2} 0 0 0 ${(x - dx - 1).toFixed(1)} ${yb - 1}" fill="none" stroke="#fff" stroke-opacity="${isDark ? .12 : .35}" stroke-width="1.2"/>`; }).join('');
const glass = m.glass.map(d => `<path d="${d}" fill="url(#${id}-gl)"/>`).join('');
const glare = m.glass.map(d => `<path d="${d}" fill="url(#${id}-glr)" opacity=".8"/>`).join('');
const inside = `<g opacity=".85">${m.headrests.map(([x, y]) => `<rect x="${x - 8}" y="${y}" width="16" height="13" rx="6" fill="#0a0c0e"/><path d="M${x} ${y + 13}L${x - 3} ${y + 34}L${x + 12} ${y + 34}Z" fill="#0a0c0e"/>`).join('')}<ellipse cx="${m.headrests[0][0] + 34}" cy="${m.headrests[0][1] + 22}" rx="5" ry="12" transform="rotate(22 ${m.headrests[0][0] + 34} ${m.headrests[0][1] + 22})" fill="none" stroke="#0a0c0e" stroke-width="3"/></g>`;
const [hx, hy] = m.headIn;
const body = `<g id="${id}-car" class="car-body">
${m.spoiler}
<path d="${m.outline}" fill="url(#${id}-body)"/>
<g clip-path="url(#${id}-cl)">
<path d="M30 20H620V${CAR_GY}H30Z" fill="url(#${id}-sheen)"/>
<path d="${m.belt}" fill="none" stroke="#fff" stroke-opacity="${isDark ? .5 : .75}" stroke-width="1.6"/>
<path d="${m.belt}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="2.4" transform="translate(0 2.4)"/>
<path d="${m.belt2}" fill="none" stroke="#fff" stroke-opacity="${isDark ? .25 : .4}" stroke-width="1.2"/>
<path d="${m.belt2}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="2" transform="translate(0 2)"/>
<path d="M30 20H620V90H30Z" fill="url(#${id}-top)" opacity=".5"/>
<path d="M30 150H620V${CAR_GY}H30Z" fill="url(#${id}-low)"/>
<path d="${m.trim}" fill="#0b0c0d"/><path d="${m.trim}" fill="none" stroke="#fff" stroke-opacity=".12"/>
${m.cut.map(d => `<path d="${d}" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="1.3"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity="${isDark ? .18 : .45}" stroke-width="1" transform="translate(1.4 0)"/>`).join('')}
${m.handles.map(d => `<path d="${d}" stroke="#000" stroke-opacity=".6" stroke-width="5" stroke-linecap="round"/><path d="${d}" stroke="${isDark ? '#3a3d42' : carDark(base, .12)}" stroke-width="3.2" stroke-linecap="round"/><path d="${d}" stroke="#fff" stroke-opacity=".55" stroke-width=".9" transform="translate(0 -1)" stroke-linecap="round"/>`).join('')}
${m.extras}
</g>
${glass}${inside}${glare}
<path d="${m.glass.join(' ')}" fill="none" stroke="#050607" stroke-width="2.2" stroke-linejoin="round"/>
${m.chrome ? `<path d="${m.chrome}" stroke="#d6dade" stroke-width="1.4" opacity=".85"/>` : ''}
<path d="${m.frames}" stroke="#050607" stroke-width="5"/>
<path d="${m.outline}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="1.4"/>
<path d="${m.mirror}" fill="${isDark ? carLight(base, .08) : base}" stroke="#000" stroke-opacity=".6"/><path d="${m.mirror}" fill="url(#${id}-top)" opacity=".5"/>
<path d="${m.head}" fill="url(#${id}-hl)" stroke="#2a2f35" stroke-width="1"/>
<circle cx="${hx}" cy="${hy}" r="6" fill="#e9f2fb" stroke="#4a5560"/><circle cx="${hx}" cy="${hy}" r="3" fill="#8fb3d6"/><circle cx="${hx - 1.5}" cy="${hy - 1.5}" r="1.2" fill="#fff"/>
<path d="${m.head}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".8" transform="translate(-1 -1)"/>
<path d="${m.tail}" fill="url(#${id}-tl)" stroke="#2a0a09" stroke-width="1"/><path d="${m.tail}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".7" transform="translate(1 1)"/>
<rect x="${m.tailBeam[0] + 4}" y="${m.tailBeam[1] + 12}" width="9" height="4" rx="1" fill="#f6f6f6" opacity=".92"/>
</g>`;
const beam = `<g class="car-beam"><path d="M${m.headBeam[0]} ${m.headBeam[1]}L980 ${m.headBeam[1] - 70}L980 ${m.headBeam[1] + 70}Z" fill="url(#${id}-beam)"/></g><g class="car-tbeam"><path d="M${m.tailBeam[0]} ${m.tailBeam[1]}L0 ${m.tailBeam[1] - 12}L0 ${m.tailBeam[1] + 22}Z" fill="url(#${id}-tbeam)"/></g>`;
const wheels = `<g class="car-wheels">${carWheel(rx, wy, wr, wh, id)}${carWheel(fx, wy, wr, wh, id)}</g>`;
const shadow = `<ellipse cx="${rx}" cy="${CAR_GY}" rx="${wr + 6}" ry="4" fill="#000" opacity=".7"/><ellipse cx="${fx}" cy="${CAR_GY}" rx="${wr + 6}" ry="4" fill="#000" opacity=".7"/>`+`<ellipse cx="${(rx + fx) / 2 + 10}" cy="${CAR_GY + 1}" rx="${(fx - rx) / 2 + 100}" ry="9" fill="#000" opacity=".6" filter="url(#${id}-bl)"/>`;
const refl = o.reflect ? `<g mask="url(#${id}-rm)"><use href="#${id}-wr" transform="translate(0 ${CAR_GY * 2}) scale(1 -1)"/></g>` : '';
const tint = o.tint ? m.glass.map(d => `<path d="${d}" fill="#000" opacity=".55"/>`).join('') : '';
const wing = o.spoiler && m.wing ? m.wing : '';
const grp = `<g id="${id}-wr">${archFill}<g transform="translate(0 ${o.lower || 0})">${body}${tint}${wing}</g>${lipArch}${wheels}</g>`;
return `<svg class="car-svg car-${key}${o.lights ? ' on' : ''}" viewBox="24 14 592 216" role="img" aria-label="${esc(o.label || key)}" xmlns="http://www.w3.org/2000/svg">${defs}${archClip}${shadow}${refl}${beam}${grp}</svg>`;
}
const CAR_PAINT = [['#aeb5bd', 'Серебристый металлик'], ['#14161a', 'Глубокий чёрный'], ['#eceff1', 'Белый ледниковый'], ['#2b4a7a', 'Синий мистраль'], ['#9b1b1b', 'Красный рубин'], ['#4a5057', 'Графит металлик']];
const CAR_WHEELS = {
alu: { kind: 'split', spokes: 5, rim: .76, caliper: '#8a8f95', lip: '#cfd5da' },
turb: { kind: 'turbine', spokes: 6, rim: .78, lip: '#c9ced2', caliper: '#555a60' },
dark: { kind: 'split', spokes: 5, rim: .78, dark: 1, lip: '#222', cap: '#111', caliper: '#d0b020' },
steel: { kind: 'steel', rim: .78 },
star: { kind: 'blade', spokes: 5, rim: .78, lip: '#d8dde2', caliper: '#c0201b' }
};
const GARAGE = {
'Галкин Виталий': {
key: 'gpo', no: '01', car: 'polo', plate: ['В', '207', 'ЕН', '116'], model: 'Volkswagen Polo', body: 'седан', title: 'Polo', kicker: 'Витрина № 01', tag: 'Единственный немец на стоянке', voteName: 'Галкин Виталий',
chips: ['1.6 · 110 л.с.', 'АКПП', 'белый'], paint: '#eef0f2',
stats: [[110, 'л.с. под капотом'], [0, 'опозданий на пары'], [100, '% аккуратной парковки', '%']],
infoTitle: 'Конфигуратор',
story: ['Среди «Лад» и «двенадцатых» он приезжает на единственном иностранном автомобиле — и ни разу этим не хвастался. Polo у Виталия ровная, чистая и заводится с первого раза. Как и он сам: спокойно, без рывков и без лишних оборотов.',
'Парковка — отдельный жанр. Он ставит машину так, что между линиями остаётся ровно по ладони с каждой стороны. Соседи по двору разметку по ней подгоняют.',
'На замену масла приезжает заранее, по записи и с квитанцией. У машины сервисная книжка, у Виталия — зачётная, и обе без единого пропуска.'],
quote: ['«Едет ровно — значит, всё в порядке».', 'Из бортового журнала'],
videoTitle: 'Тест-драйв', videoNote: 'Ролик ещё на круге.',
facts: ['Заводится с первого раза даже в мороз', 'Парковка с идеальными зазорами', 'Сервисная книжка без единого пропуска'],
ph: ['🚘', 'Тест-драйв Polo', 'Ролик выедет из гаража чуть позже'],
art: () => carSvg('polo', { label: 'Volkswagen Polo' }),
info: () => `
<div class="gc" id="gc">
<div class="gc-stage"><div class="gc-car" id="gcCar"></div><span class="gc-tag">Volkswagen Polo · седан</span></div>
<div class="gc-row"><span>Цвет кузова</span><div class="gc-sw" id="gcSw">${CAR_PAINT.map(([c, n], i) => `<button type="button" data-c="${c}" data-n="${n}" class="${i ? '' : 'on'}" style="--c:${c}" aria-label="${n}"></button>`).join('')}</div><b id="gcName">${CAR_PAINT[0][1]}</b></div>
<div class="gc-row"><span>Диски</span><div class="gc-wh" id="gcWh">${[['alu', 'Литые 5×'], ['turb', 'Турбина'], ['dark', 'Чёрные'], ['star', 'Лопасть']].map(([k, n], i) => `<button type="button" data-w="${k}" class="${i ? '' : 'on'}">${n}</button>`).join('')}</div></div>
<div class="gc-row"><span>Свет</span><button type="button" class="gc-lt" id="gcLt" aria-pressed="false">Включить фары</button></div>
<table class="gc-spec"><tr><th>Двигатель</th><td>1.6 MPI · 105 л.с.</td></tr><tr><th>Коробка</th><td>автомат, 6 ступеней</td></tr><tr><th>До сотни</th><td>10,6 с — без суеты</td></tr><tr><th>Клиренс</th><td>163 мм — для лужи у входа</td></tr><tr><th>Цена</th><td><b>бесценно</b></td></tr></table>
</div>`,
after: root => {
const car = $('#gcCar', root); let color = CAR_PAINT[0][0], wh = 'alu', lt = false;
const draw = () => { car.innerHTML = carSvg('polo', { color, wheel: CAR_WHEELS[wh], lights: lt, label: 'Volkswagen Polo' }); };
draw();
$('#gcSw', root).addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; $$('#gcSw button', root).forEach(x => x.classList.toggle('on', x === b)); color = b.dataset.c; $('#gcName', root).textContent = b.dataset.n; car.classList.remove('flash'); void car.offsetWidth; car.classList.add('flash'); draw(); tink([784]); });
$('#gcWh', root).addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; $$('#gcWh button', root).forEach(x => x.classList.toggle('on', x === b)); wh = b.dataset.w; draw(); tink([660]); });
const lb = $('#gcLt', root); lb.addEventListener('click', () => { lt = !lt; lb.setAttribute('aria-pressed', lt); lb.textContent = lt ? 'Выключить фары' : 'Включить фары'; lb.classList.toggle('on', lt); draw(); tink([lt ? 988 : 440]); });
}
},
'Сенченко Дмитрий': {
key: 'gbl', no: '02', car: 'granta', plate: ['М', '777', 'ММ', '116'], model: 'Lada Granta', body: 'седан', title: 'Granta Black', kicker: 'Витрина № 02', tag: 'Чёрная, как непрочитанное сообщение', voteName: 'Сенченко Дмитрий',
chips: ['1.6 · 98 л.с.', 'МКПП', 'чёрный'], paint: '#101114', wheel: 'dark',
stats: [[98, 'л.с. и все при деле'], [24, 'часа держится блеск'], [100, '% чёрного', '%']],
infoTitle: 'Ночная трасса',
story: ['Чёрная Гранта Дмитрия блестит так, что в капоте можно поправлять причёску. Снаружи — строгий лак и чёрные диски, внутри — идеальный порядок и подборка, от которой у зеркал дрожит стекло.',
'Ночью она преображается: фары вырезают из темноты ровно столько дороги, сколько нужно, а красные огни тянутся за ней длинным следом. Говорят, лампочки включаются на секунду раньше, чем он поворачивает ключ.',
'Мойка для неё — не повинность, а ритуал. Если на чёрном лаке появляется пылинка, Дмитрий узнаёт об этом раньше самой пылинки.'],
quote: ['«Тёмная, но с ближним светом — красота».', 'Подпись под фотографией в соцсети'],
videoTitle: 'Ночной проезд', videoNote: 'Ролик ещё едет по ночной трассе.',
facts: ['Блеск лака держится сутки', 'Фары включаются заранее', 'Чёрные диски и жёлтые суппорты'],
ph: ['🌃', 'Ночная трасса', 'Ролик подъедет после заката'],
art: () => carSvg('granta', { color: '#101114', wheel: CAR_WHEELS.dark, lights: true, label: 'Lada Granta чёрная' }),
info: () => `
<div class="gn" id="gn" style="--sp:0">
<div class="gn-scene">
<div class="gn-sky"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
<div class="gn-far"></div><div class="gn-near"></div>
<div class="gn-lamps"></div>
<div class="gn-road"><div class="gn-dash"></div></div>
<div class="gn-car" id="gnCar"></div>
<div class="gn-hud"><div><small>км/ч</small><b id="gnKmh">0</b></div><div class="gn-rpm"><small>об/мин</small><i id="gnRpm"></i></div><div><small>передача</small><b id="gnG">N</b></div></div>
</div>
<label class="gn-sl"><span>Скорость</span><input type="range" min="0" max="140" value="0" aria-label="Скорость"></label>
<div class="gn-btns"><button type="button" id="gnFar" aria-pressed="false">Дальний свет</button><button type="button" id="gnBass" aria-pressed="false">Басы</button></div>
</div>`,
after: root => {
const g = $('#gn', root), car = $('#gnCar', root), r = $('input', root), kmh = $('#gnKmh', root), rpm = $('#gnRpm', root), gear = $('#gnG', root);
car.innerHTML = carSvg('granta', { color: '#101114', wheel: CAR_WHEELS.dark, lights: true, label: 'Lada Granta чёрная' });
$('.gn-far', root).innerHTML = gSky(7, 80, '#1b1535', 0) + gSky(7, 80, '#1b1535', 0); $('.gn-near', root).innerHTML = gSky(21, 120, '#0b0a18', .32) + gSky(21, 120, '#0b0a18', .32);
const upd = () => {
const v = +r.value, k = v / 140;
g.style.setProperty('--sp', k.toFixed(3));
g.style.setProperty('--t1', v ? (26 / Math.max(.15, k)).toFixed(1) + 's' : '0s');
g.style.setProperty('--t2', v ? (9 / Math.max(.15, k)).toFixed(1) + 's' : '0s');
g.style.setProperty('--t3', v ? (2.4 / Math.max(.15, k)).toFixed(2) + 's' : '0s');
g.style.setProperty('--tw', v ? (1.5 / Math.max(.15, k)).toFixed(2) + 's' : '0s');
g.classList.toggle('run', v > 0);
kmh.textContent = v;
const gr = v === 0 ? 'N' : v < 20 ? '1' : v < 45 ? '2' : v < 75 ? '3' : v < 105 ? '4' : '5';
gear.textContent = gr;
const lo = [0, 0, 20, 45, 75, 105][gr === 'N' ? 0 : +gr], hi = [1, 20, 45, 75, 105, 140][gr === 'N' ? 0 : +gr];
const t = gr === 'N' ? .12 : .25 + .6 * (v - lo) / Math.max(1, hi - lo);
rpm.style.width = (t * 100) + '%'; rpm.classList.toggle('red', t > .84);
};
r.addEventListener('input', upd); upd();
const far = $('#gnFar', root), bass = $('#gnBass', root);
far.addEventListener('click', () => { const on = !g.classList.contains('far'); g.classList.toggle('far', on); far.setAttribute('aria-pressed', on); far.classList.toggle('on', on); tink([on ? 880 : 440]); });
bass.addEventListener('click', () => { const on = !g.classList.contains('bass'); g.classList.toggle('bass', on); bass.setAttribute('aria-pressed', on); bass.classList.toggle('on', on); tink([on ? 110 : 220]); });
}
},
'Фролов Андрей': {
key: 'ggr', no: '03', car: 'granta', plate: ['О', '123', 'ОО', '116'], model: 'Lada Granta', body: 'седан', title: 'Granta White', kicker: 'Витрина № 03', tag: 'Цвета «мокрого асфальта, но светлее»', voteName: 'Фролов Андрей',
chips: ['1.6 · 90 л.с.', 'МКПП', 'серый'], paint: '#6b6e78', wheel: 'steel',
stats: [[98, 'л.с. честных'], [7, 'л на сотню — по паспорту'], [0, 'царапин, если верить владельцу']],
infoTitle: 'Техосмотр',
story: ['Бело-серая Гранта не любит пыль и мойку одновременно: после дождя она выглядит так, будто её давно не мыли, а после мойки — будто её только что сфотографировали для каталога. Цвет с характером: не белый, не серый, а «как утро после снегопада».',
'Машина неприхотливая и честная: расход как заявлено, шум как заявлено, гордость владельца — сверх заявленного. Штампованные диски с колпаками — классика, к которой не придраться ни одному инспектору.',
'Фролов проходит техосмотр с первого раза, без очереди и без нервов: узлы на месте, фары светят, а лишнего в машине нет. Кроме термоса.'],
quote: ['«Белая, серая, зато — моя».', 'Надпись на пыльном заднем стекле'],
videoTitle: 'Утренний выезд', videoNote: 'Ролик ещё прогревается.',
facts: ['Техосмотр — с первого раза', 'Штампованные диски, классика', 'В салоне только термос'],
ph: ['❄️', 'Утро после снегопада', 'Ролик отъедет, как только прогреется'],
art: () => carSvg('granta', { color: '#6b6e78', wheel: CAR_WHEELS.steel, label: 'Lada Granta серая' }),
info: () => `
<div class="gi" id="gi">
<div class="gi-scene">
<div class="gi-snow">${Array.from({ length: 26 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${5 + (i * 13) % 7}s;--s:${(1.5 + (i * 7) % 3).toFixed(1)}px;--w:${-(i * 1.3).toFixed(1)}s;--dx:${(i % 2 ? 1 : -1) * (6 + i % 5 * 3)}px"></i>`).join('')}</div>
<div class="gi-car" id="giCar"></div>
<div class="gi-hot" id="giHot"></div>
</div>
<div class="gi-card" id="giCard"><small>Техосмотр</small><b>Нажми на точку</b><p>Осмотри все шесть узлов — и машину допустят к движению.</p></div>
<div class="gi-prog"><i id="giBar"></i><span id="giN">0 / 6</span></div>
<div class="gi-stamp" id="giStamp" aria-live="polite">ДОПУЩЕНА К ДВИЖЕНИЮ</div>
</div>`,
after: root => {
const car = $('#giCar', root), hot = $('#giHot', root), card = $('#giCard', root), bar = $('#giBar', root), n = $('#giN', root), st = $('#giStamp', root);
car.innerHTML = carSvg('granta', { color: '#6b6e78', wheel: CAR_WHEELS.steel, label: 'Lada Granta серая' });
// координаты точек — в долях ширины/высоты картинки (viewBox 592×216, начало 24,14)
const P = (x, y) => [((x - 24) / 592 * 100).toFixed(1), ((y - 14) / 216 * 100).toFixed(1)];
const pts = [
['Фары', P(576, 122), 'Светят ровно и далеко', 'Ближний, дальний и габариты — в норме. Лампочка в запасе лежит в бардачке, как и положено.'],
['Колёса', P(480, 177), 'Штамповка с колпаками', 'Давление в порядке, протектор живой. Колпаки на месте — все четыре. Редкий случай.'],
['Капот', P(500, 96), 'Под капотом — порядок', 'Масло чистое, уровень в метках, ни одной лужи под машиной. Предмет зависти бригады.'],
['Кузов', P(390, 140), 'Без единой царапины', 'По версии владельца. По версии техосмотра — тоже: придраться не к чему.'],
['Салон', P(300, 64), 'Только термос', 'Лишнего ничего. Термос закреплён ремнём, как положено перевозчику горячего чая.'],
['Багажник', P(98, 104), 'Заводская чистота', 'Запаска, домкрат, знак аварийной остановки. Всё есть, всё лежит там, где должно.']
];
hot.innerHTML = pts.map(([t, [x, y]], i) => `<button type="button" class="gi-dot" data-i="${i}" style="left:${x}%;top:${y}%" aria-label="${t}"><i></i></button>`).join('');
const seen = new Set();
hot.addEventListener('click', e => {
const b = e.target.closest('.gi-dot'); if(!b) return; const i = +b.dataset.i, [t, , h, p] = pts[i];
$$('.gi-dot', hot).forEach(x => x.classList.toggle('on', x === b)); b.classList.add('seen'); seen.add(i);
card.innerHTML = `<small>${t} · осмотрено</small><b>${h}</b><p>${p}</p>`; card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
bar.style.width = (seen.size / 6 * 100) + '%'; n.textContent = seen.size + ' / 6';
tink([seen.size === 6 ? 1047 : 740]);
if(seen.size === 6){ st.classList.add('on'); try{ navigator.vibrate?.([20, 40, 20]); }catch(_){} }
});
}
},
'Самсонов Константин': {
key: 'g12', no: '04', car: 'vaz2112', plate: ['Х', '112', 'ХХ', '116'], model: 'ВАЗ-2112', body: 'хэтчбек', title: 'Двенашка', kicker: 'Витрина № 04', tag: 'Легенда двора', voteName: 'Самсонов Константин',
chips: ['1.5 · 79 л.с.', 'МКПП', 'тёмно-зелёный'], paint: '#0f4f45', wheel: 'turb',
stats: [[94, 'л.с. + 3 на тюнинг'], [16, 'дюймов литья'], [200, '% уважения во дворе', '%']],
infoTitle: 'Тюнинг-стенд',
story: ['ВАЗ-2112 цвета «болотный металлик» — зелёная с серым отливом, как июльский пруд на закате. Машина-легенда: на ней слушали музыку, возили друзей, чинили её во дворе в любую погоду. Это не просто автомобиль — это место, куда стремятся записаться пассажиры.',
'Колёса — литьё, звук — прямоток, спойлер — «как у соседа, но выше». Константин знает про свою двенашку всё: где стучит, где поёт и в какой момент надо сказать ей пару ласковых.',
'Она давно стала частью двора: если во дворе нет зелёной двенашки, значит, что-то не так — скорее всего, Константин уехал.'],
quote: ['«Двенашка — это не машина, это диагноз с кузовом».', 'Гаражное общество'],
videoTitle: 'Двор в 22:00', videoNote: 'Ролик ещё стоит с открытым капотом.',
facts: ['Прямоток слышно за два квартала', 'Музыка играет раньше, чем заведён двигатель', 'Без неё во дворе тихо — а это тревожно'],
ph: ['🔧', 'Двор, вечер', 'Ролик в гараже, зашли на минуту'],
art: () => carSvg('vaz2112', { color: '#0f4f45', wheel: CAR_WHEELS.turb, label: 'ВАЗ-2112 тёмно-зелёная' }),
info: () => `
<div class="gt" id="gt">
<div class="gt-stage"><div class="gt-car" id="gtCar"></div><div class="gt-glow" id="gtGlow"></div></div>
<div class="gt-mods" id="gtMods">${[
['low', 'Занижение −30 мм', 0, 4500], ['rim', 'Литьё R16', 0, 12800], ['tint', 'Тонировка 5%', 0, 1800], ['spl', 'Спойлер «выше соседского»', 2, 3200], ['glow', 'Подсветка днища', 0, 2400], ['exh', 'Прямоток', 3, 6500]
].map(([k, n, hp, price]) => `<button type="button" class="gt-mod" data-k="${k}" data-hp="${hp}" data-p="${price}" aria-pressed="false"><i></i><span>${n}</span><small>${price.toLocaleString('ru-RU')} ₽</small></button>`).join('')}</div>
<div class="gt-read"><div><small>мощность</small><b id="gtHp">94</b><em>л.с.</em></div><div><small>вложено</small><b id="gtRub">0</b><em>₽</em></div><div class="gt-rep"><small>уважение во дворе</small><span><i id="gtRep"></i></span></div></div>
</div>`,
after: root => {
const car = $('#gtCar', root), glow = $('#gtGlow', root), hpE = $('#gtHp', root), rub = $('#gtRub', root), rep = $('#gtRep', root), st = new Set();
const draw = () => { car.innerHTML = carSvg('vaz2112', { color: '#0f4f45', wheel: st.has('rim') ? CAR_WHEELS.dark : CAR_WHEELS.turb, lower: st.has('low') ? 7 : 0, tint: st.has('tint'), spoiler: st.has('spl'), label: 'ВАЗ-2112 тёмно-зелёная' }); car.classList.toggle('exh', st.has('exh')); glow.classList.toggle('on', st.has('glow')); };
const calc = () => { let hp = 94, p = 0; $$('.gt-mod', root).forEach(b => { if(st.has(b.dataset.k)){ hp += +b.dataset.hp; p += +b.dataset.p; } }); hpE.textContent = hp; rub.textContent = p.toLocaleString('ru-RU'); rep.style.width = Math.min(100, 20 + st.size * 16) + '%'; };
$('#gtMods', root).addEventListener('click', e => {
const b = e.target.closest('.gt-mod'); if(!b) return; const k = b.dataset.k, on = !st.has(k); on ? st.add(k) : st.delete(k);
b.setAttribute('aria-pressed', on); b.classList.toggle('on', on); draw(); calc(); if(k === 'exh' && on) gEngine('v'); else tink([on ? 784 : 392]);
});
draw(); calc();
}
},
'Куликов Виталий': {
key: 'g09', no: '05', car: 'vaz2109', plate: ['К', '109', 'ВК', '116'], model: 'ВАЗ-2109', body: 'хэтчбек', title: 'Девятка', kicker: 'Витрина № 05', tag: 'Заводится с пол-оборота (иногда)', voteName: 'Куликов Виталий',
chips: ['1.5 · 70 л.с.', 'МКПП', 'малиновая'], paint: '#8e1430', wheel: 'steel',
stats: [[70, 'л.с. и все — рабочие'], [5, 'передач — одна лишняя'], [100, '% лёгкости ремонта', '%']],
infoTitle: 'Подсос и стартёр',
story: ['«Девятка», вишнёвая, с характером. Кузов-«зубило» узнают за квартал, мотор — за два. Виталий не покупал машину, а принимал в семью: с ней можно разговаривать, и иногда она отвечает.',
'Утренний запуск — ритуал: подсос на себя, три секунды тишины, стартёр — и всё как в хорошем кино. Если не завелась — значит, ждёт, чтобы её попросили вежливо.',
'Девятка у Виталия на ходу круглый год. Секрет простой: всё, что может отвалиться, давно проверено и закреплено проволокой.'],
quote: ['«Девятка не ломается. Она просит внимания».', 'Из гаражного фольклора'],
videoTitle: 'Запуск в мороз', videoNote: 'Ролик ещё прогревается на подсосе.',
facts: ['Заводится на подсосе — по правилам', 'Кузов-«зубило» с 1990-х как новый', 'Проволока вместо половины запчастей'],
ph: ['🔑', 'Утро, мороз −20', 'Ролик заведётся с третьей попытки'],
art: () => carSvg('vaz2109', { color: '#8e1430', wheel: CAR_WHEELS.steel, label: 'ВАЗ-2109 малиновая' }),
info: () => `
<div class="gk" id="gk">
<div class="gk-stage"><div class="gk-car" id="gkCar"></div><i class="gk-puff"></i></div>
<div class="gk-panel">
<div class="gk-row"><span>Подсос</span><button type="button" class="gk-choke" id="gkChoke" aria-pressed="false"><i></i>на себя</button></div>
<div class="gk-tach"><div class="gk-zone" id="gkZone"></div><i class="gk-nd" id="gkNd"></i></div>
<p class="gk-msg" id="gkMsg">Потяни подсос и жми «Стартёр», когда стрелка в зелёной зоне. Три попытки.</p>
<div class="gk-foot"><button type="button" class="gk-go" id="gkGo">Стартёр</button><span id="gkTry">попытка 0 / 3</span></div>
</div>
</div>`,
after: root => {
const car = $('#gkCar', root), nd = $('#gkNd', root), zone = $('#gkZone', root), msg = $('#gkMsg', root), tr = $('#gkTry', root), ch = $('#gkChoke', root), go = $('#gkGo', root), stage = $('.gk-stage', root);
car.innerHTML = carSvg('vaz2109', { color: '#8e1430', wheel: CAR_WHEELS.steel, label: 'ВАЗ-2109 малиновая' });
let choke = false, tries = 0, done = false, t0 = performance.now(), raf = 0, pos = 0;
const zw = () => choke ? 26 : 12; const z0 = 56;
const place = () => { zone.style.left = z0 + '%'; zone.style.width = zw() + '%'; };
place();
const loop = now => { if(!root.isConnected){ cancelAnimationFrame(raf); return; } const t = (now - t0) / 1000; pos = 50 + 50 * Math.sin(t * (choke ? 2.1 : 2.9)); nd.style.left = pos + '%'; raf = requestAnimationFrame(loop); };
raf = requestAnimationFrame(loop);
ch.addEventListener('click', () => { if(done) return; choke = !choke; ch.classList.toggle('on', choke); ch.setAttribute('aria-pressed', choke); place(); tink([choke ? 520 : 400]); msg.textContent = choke ? 'Подсос вытянут — зона шире, стрелка медленнее.' : 'Подсос убран — зона узкая, стрелка быстрая.'; });
go.addEventListener('click', () => {
if(done) return; tries++; tr.textContent = 'попытка ' + tries + ' / 3';
const hit = pos >= z0 && pos <= z0 + zw();
if(hit){ done = true; msg.textContent = 'Заведена! ' + (tries === 1 ? 'С пол-оборота — как и обещано.' : 'Не с первого, но девятка не обижается.'); stage.classList.add('run'); gEngine('v'); try{ navigator.vibrate?.([30, 40, 50]); }catch(_){} go.disabled = true; go.textContent = 'Едем'; }
else { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); fxNoise(.25, 160, .12, 'lowpass'); msg.textContent = tries >= 3 ? 'Три раза мимо. Девятка просит: «Дай остыть и приходи позже».' : ['Чихнула и заглохла.', 'Стартёр крутит, зажигания нет.'][tries - 1]; if(tries >= 3){ done = true; go.disabled = true; go.textContent = 'Остыть'; } }
});
}
},
'Сериков Александр': {
key: 'gsr', no: '06', car: 'granta', plate: ['С', '777', 'АС', '116'], model: 'Lada Granta', body: 'седан', title: 'Granta Standup', kicker: 'Витрина № 06', tag: 'Машина с чувством юмора', voteName: 'Сериков Александр',
chips: ['1.6 · 90 л.с.', 'МКПП', 'белый'], paint: '#eceff1', wheel: 'steel',
stats: [[87, 'л.с. и ни одной шутки про них'], [12, 'наклеек на кузове'], [100, '% смеха из салона', '%']],
infoTitle: 'Наклейки',
story: ['Синяя Гранта Серикова — главная сцена, пока нет сцены. Салон — зал на четыре места, дорога — программа выступления, а светофор — паузы, которые надо уметь держать.',
'На заднем стекле и бампере живут наклейки, каждая — отдельная шутка. Одну из них вообще никто не понял, но она висит уже третий год, и спокойно.',
'Если за вами едет синяя Гранта с мигающим аварийным светом, это не ДТП. Это Александр отрабатывает аплодисменты.'],
quote: ['«Если бы тормоза работали как мои шутки — все бы давно стояли».', 'Репетиция в салоне'],
videoTitle: 'Выступление на светофоре', videoNote: 'Ролик ждёт зелёного.',
facts: ['Салон — зал на четыре места', 'Наклейки меняются раз в сезон', 'Аварийка = аплодисменты'],
ph: ['🎤', 'Красный свет', 'Ролик начнётся на зелёный'],
art: () => carSvg('granta', { color: '#eceff1', wheel: CAR_WHEELS.steel, label: 'Lada Granta белая' }),
info: () => `
<div class="gx" id="gx">
<div class="gx-stage"><div class="gx-car" id="gxCar"></div><div class="gx-stk" id="gxStk"></div></div>
<div class="gx-set" id="gxSet">${[['😂', 'Не грузите — я за рулём'], ['🎤', 'Здесь был стендап'], ['🚦', 'Зелёный — это тоже шутка'], ['🐢', 'Спешить некуда, анекдот длинный'], ['⭐', 'Оценка 5/5 от мамы'], ['🔥', 'Не лайкай, догоняй']].map(([e, t], i) => `<button type="button" class="gx-b" data-i="${i}"><span>${e}</span><small>${t}</small></button>`).join('')}</div>
<p class="gx-msg" id="gxMsg">Нажимай на наклейки — они прилетят на заднее стекло. Собери все шесть.</p>
<div class="gx-prog"><i id="gxBar"></i><span id="gxN">0 / 6</span></div>
</div>`,
after: root => {
const car = $('#gxCar', root), stk = $('#gxStk', root), msg = $('#gxMsg', root), bar = $('#gxBar', root), n = $('#gxN', root);
car.innerHTML = carSvg('granta', { color: '#eceff1', wheel: CAR_WHEELS.steel, label: 'Lada Granta белая' });
const spots = [[14, 30], [26, 58], [8, 66], [34, 26], [20, 44], [30, 70]], on = new Set();
$('#gxSet', root).addEventListener('click', e => {
const b = e.target.closest('.gx-b'); if(!b) return; const i = +b.dataset.i; if(on.has(i)) return; on.add(i); b.classList.add('on');
const [x, y] = spots[i], s = document.createElement('i'); s.style.cssText = `left:${x}%;top:${y}%;--r:${(i % 2 ? 1 : -1) * (4 + i * 2)}deg`; s.textContent = $('span', b).textContent; stk.appendChild(s);
msg.textContent = '«' + $('small', b).textContent + '» — приклеено.'; bar.style.backgroundSize = (on.size / 6 * 100) + '% 100%'; n.textContent = on.size + ' / 6'; tink([on.size === 6 ? 1047 : 600 + i * 40]);
if(on.size === 6){ msg.textContent = 'Полная коллекция! Зал аплодирует, аварийка мигает.'; car.classList.add('hz'); try{ navigator.vibrate?.([20, 40, 20]); }catch(_){} }
});
}
}
};
Object.assign(HOD, Object.fromEntries(Object.entries(GARAGE).map(([k, v]) => [k + '|Машина', v])));
function gSky(seed, hMax, col, win){
let x = 0, s = seed, svg = '', w = 600; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
while(x < w){ const bw = 26 + rnd() * 40, bh = 30 + rnd() * (hMax - 30), top = 140 - bh;
svg += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${col}"/>`;
if(win){ for(let wy = top + 8; wy < 134; wy += 9) for(let wx = x + 5; wx < x + bw - 5; wx += 8) if(rnd() < win) svg += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="3" height="4" fill="${rnd() < .5 ? '#ffd47a' : '#7fe7ff'}" opacity=".85"/>`; }
x += bw + 1 + rnd() * 5; }
return `<svg viewBox="0 0 ${w} 140" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>`;
}
function gEngine(kind){
try{
const ac = tink.ac || (tink.ac = new (window.AudioContext || window.webkitAudioContext)()); if(ac.state === 'suspended') ac.resume();
const t = ac.currentTime, o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
const p = { polo: [48, 96, .12], granta: [42, 92, .15], v: [38, 130, .2] }[kind] || [42, 90, .14];
o.type = 'sawtooth'; o2.type = 'square'; o.frequency.setValueAtTime(p[0], t); o.frequency.exponentialRampToValueAtTime(p[1], t + .55); o.frequency.exponentialRampToValueAtTime(p[0] * 1.3, t + 1.1);
o2.frequency.setValueAtTime(p[0] * .5, t); o2.frequency.exponentialRampToValueAtTime(p[1] * .5, t + .55); o2.frequency.exponentialRampToValueAtTime(p[0] * .65, t + 1.1);
f.type = 'lowpass'; f.frequency.value = 340; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(p[2], t + .06); g.gain.exponentialRampToValueAtTime(.001, t + 1.15);
o.connect(f); o2.connect(f); f.connect(g); g.connect(ac.destination); o.start(t); o2.start(t); o.stop(t + 1.2); o2.stop(t + 1.2);
}catch(_){}
}
const gDial = (max, step, label, unit, val, red) => {
const cx = 60, cy = 60, R = 50, ang = v => (225 - 270 * v / max) * Math.PI / 180, P = (r, v) => `${(cx + r * Math.cos(ang(v))).toFixed(1)} ${(cy - r * Math.sin(ang(v))).toFixed(1)}`;
let t = '';
for(let v = 0; v <= max + .01; v += step / 5){
const big = Math.abs(v / step - Math.round(v / step)) < .01;
t += `<path d="M${P(big ? 38 : 43, v)}L${P(48, v)}" class="${big ? 'gd-big' : 'gd-sm'}${red && v >= red ? ' gd-red' : ''}"/>`;
if(big) t += `<text x="${P(30, v).split(' ')[0]}" y="${(+P(30, v).split(' ')[1] + 2.6).toFixed(1)}" class="gd-n">${Math.round(v / (max > 20 ? 1 : 1))}</text>`;
}
return `<div class="gd" style="--v:${val}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="58" class="gd-bz"/><circle cx="60" cy="60" r="53" class="gd-face"/>${red ? `<path d="M${P(52, red)}A52 52 0 0 1 ${P(52, max)}" class="gd-arc"/>` : ''}${t}
<text x="60" y="84" class="gd-u">${unit}</text><text x="60" y="94" class="gd-l">${label}</text>
<g class="gd-nd"><g transform="translate(60 60)"><path d="M-8 0L46 0"/><circle r="5"/></g></g></svg></div>`;
};
function buildGarage(frame){
const noms = $$('.nominee:not([hidden])', frame);
if(!noms.length) return;
const stalls = noms.map((nom, i) => {
const full = $('.nominee-front h3', nom)?.textContent.trim() || nom.dataset.nominee;
const z = GARAGE[nom.dataset.nominee] || { no: String(i + 1).padStart(2, '0'), car: 'granta', plate: ['А', '000', 'АА', '116'], model: '', chips: [] };
const src = $('.nominee-front img', nom)?.getAttribute('src') || '';
const ini = full.split(/\s+/).map(s => s[0] || '').join('');
const [a, n, b, r] = z.plate;
return `<article class="gs" data-i="${i}" style="--i:${i}">
<button type="button" class="gs-card" aria-label="${esc(z.model)} — ${esc(full)}">
<span class="gs-top"><span class="gs-no"><small>бокс</small><b>${z.no}</b></span>
<span class="gs-plate"><b class="pl-a">${a}</b><b class="pl-n">${n}</b><b class="pl-b">${b}</b><span class="pl-reg"><em>${r}</em><small><i></i>RUS</small></span></span></span>
<span class="gs-stage">
<i class="gs-cone"></i><i class="gs-light"></i>
<span class="gs-car">${carSvg(z.car, { color: z.paint, wheel: z.wheel ? CAR_WHEELS[z.wheel] : undefined, label: z.model })}</span>
<span class="gs-smoke"><i></i><i></i><i></i><i></i></span>
<i class="gs-floor"></i><i class="gs-mark"></i>
</span>
<span class="gs-info">
<span class="gs-ava">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.remove()">` : ''}<em>${esc(ini)}</em></span>
<span class="gs-who"><b>${esc(full)}</b><small>${esc(z.model)}${z.body ? ' · ' + esc(z.body) : ''}</small></span>
<span class="gs-go"><i></i>Завести</span>
</span>
<span class="gs-chips">${(z.chips || []).map(c => `<em>${esc(c)}</em>`).join('')}</span>
</button>
</article>`;
}).join('');
const board = document.createElement('div');
board.className = 'garage';
board.innerHTML = `
<header class="gh">
<div class="gh-top"><span class="gh-plate">ГАРАЖНЫЙ КООПЕРАТИВ «РЖАВЧИНА»</span><span class="gh-st"><i></i>ОБД: ОШИБОК НЕТ</span></div>
<div class="gh-cluster">
${gDial(8, 1, 'об/мин ×1000', 'RPM', .12, 6.5)}
<div class="gh-mid"><div class="gh-lamps"><i class="l-eng" title="Check engine"></i><i class="l-oil"></i><i class="l-bat"></i><i class="l-brk"></i></div><div class="gh-odo"><small>пробег · км</small><b id="ghOdo">000000</b></div><div class="gh-gear">P</div></div>
${gDial(240, 40, 'км/ч', 'KMH', 0, 0)}
</div>
<div class="gh-tick"><span>БОКС 1 — ${noms.length} ✦ ТЕХОСМОТР ПРОЙДЕН ✦ БЕНЗИН ✦ ОСАГО ✦ ШИНЫ ✦ ЗИМНЯЯ РЕЗИНА ✦ БОКС 1 — ${noms.length} ✦ ТЕХОСМОТР ПРОЙДЕН ✦ БЕНЗИН ✦ ОСАГО ✦ ШИНЫ ✦ ЗИМНЯЯ РЕЗИНА ✦</span></div>
</header>
<div class="gs-list">${stalls}</div>
<p class="garage-hint">Нажми «Завести» — машина оживёт, откроется её паспорт.</p>`;
$('.nominee-subblock', frame).before(board);
const gh = $('.gh', board), odo = $('#ghOdo', board), stalls$ = $$('.gs', board);
const lit = () => {
gh.classList.add('lit'); stalls$.forEach(c => c.classList.add('in'));
const t0 = performance.now(), to = 187412; const tick = now => { const p = Math.min(1, (now - t0) / 1600), e = 1 - Math.pow(1 - p, 3); odo.textContent = String(Math.round(to * e)).padStart(6, '0'); if(p < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
};
if('IntersectionObserver' in window){ const io = new IntersectionObserver(es => { if(es.some(e => e.isIntersecting)){ lit(); io.disconnect(); } }, { threshold: .08 }); io.observe(gh); }
setTimeout(lit, 4000);
let busy = false;
board.addEventListener('click', e => {
const s = e.target.closest('.gs'); if(!s || busy) return; busy = true;
const i = +s.dataset.i, z = GARAGE[noms[i].dataset.nominee] || {};
s.classList.add('start'); gEngine(z.car === 'polo' ? 'polo' : (z.car === 'vaz2112' || z.car === 'vaz2109') ? 'v' : 'granta'); try{ navigator.vibrate?.([30, 40, 50]); }catch(_){}
$('.car-svg', s)?.classList.add('on');
setTimeout(() => { openCandidate(noms[i], 'history'); }, 900);
setTimeout(() => { s.classList.remove('start'); $('.car-svg', s)?.classList.remove('on'); busy = false; }, 2200);
});
}
const STUDENT_NEW = {
'Голиков Матвей': {
key: 'slb', no: '02', book: 'lb', cover: 'ЛАБОРАТОРНЫЙ ЖУРНАЛ', sub: 'опыты · практикум', title: 'Лаборатория', kicker: 'Лабораторный журнал', tag: 'Всё получается с первого раза', voteName: 'Голиков Матвей',
stats: [[6, 'лабораторных — все сданы'], [0, 'разбитых колб'], [100, '% точность', '%']],
infoTitle: 'Журнал опытов',
story: ['Голиков Матвей — человек, у которого лабораторный журнал выглядит как учебник. Каждая запись датирована, каждая цифра на своём месте, каждая колба вымыта раньше, чем её успели попросить.',
'Преподаватель практикума однажды сказал: «Если все опыты проводить как Голиков, химия стала бы самым скучным предметом — всё получается с первого раза». Матвей принял это как комплимент.',
'Он приходит заранее, раскладывает реактивы и надевает халат с видом хирурга перед сложной операцией. Пока остальные ищут вытяжку, у него уже кипит, остывает и записано в протокол.',
'Диплом, говорят, он тоже проводил как опыт: гипотеза, ход работы, вывод — «получилось».'],
quote: ['«Если хорошо подготовиться, опыт сам себя проведёт».', 'Запись в лабораторном журнале'],
videoTitle: 'День в лаборатории', videoNote: 'Ролик ещё центрифугируется.',
facts: ['Все шесть лабораторных сданы с первого захода', 'Колбы моет раньше, чем у него их просят', 'Диплом провёл как ещё один опыт: гипотеза, ход, вывод'],
ph: ['🧪', 'День в лаборатории', 'Ролик выпадает в осадок'],
art: () => `<div class="lb-grid"></div><i class="lb-bub a"></i><i class="lb-bub b"></i><i class="lb-bub c"></i><div class="lb-flask"><i></i></div>`,
info: () => `
<div class="lb" id="lb">
<div class="lb-head"><b>Лабораторный журнал</b><span>Голиков М. · практикум</span></div>
<div class="lb-shelf">${[['титрование', '#38d3a6'], ['осаждение', '#ffd45a'], ['перегонка', '#5ec2ff'], ['нейтрализация', '#c58cff'], ['хроматография', '#ff8a5e'], ['синтез', '#ff6f9d']].map(([n, c], i) => `<button type="button" class="lb-fl" data-i="${i}" style="--c:${c}" aria-label="Опыт ${i + 1}: ${n}"><span class="lb-glass"><i class="lb-liq"></i><u></u><u></u><u></u></span><em>№${i + 1}</em><small>${n}</small></button>`).join('')}</div>
<p class="lb-msg" id="lbMsg">Нажимай на колбы — проводи опыты по очереди. Все шесть — и журнал закрыт.</p>
<div class="lb-foot"><span id="lbCnt">Опытов: 0 / 6</span><b class="lb-ok" id="lbOk">Допущен к экзамену</b></div>
</div>`,
after: root => {
const fl = $$('.lb-fl', root), msg = $('#lbMsg', root), cnt = $('#lbCnt', root), ok = $('#lbOk', root);
const notes = ['Раствор побелел ровно в момент титра. Запись: «Идеально».', 'Осадок выпал строго по плану. Фильтр не понадобился.', 'Дистиллят чистый, как совесть отличника.', 'pH = 7,0. Преподаватель попросил повторить — для себя.', 'Пятна разошлись по линейке. Хроматограмма — в рамку.', 'Синтез завершён. Выход — сто процентов (по версии Матвея).'];
fl.forEach(b => b.addEventListener('click', () => {
if(b.classList.contains('done')) return; b.classList.add('done'); fxNoise(.18, 1800, .06, 'bandpass'); hmTone(660 + $$('.lb-fl.done', root).length * 70, .22, .05);
const n = $$('.lb-fl.done', root).length; cnt.textContent = `Опытов: ${n} / 6`; msg.textContent = notes[+b.dataset.i];
if(n === 6){ ok.classList.add('on'); setTimeout(() => { hmTone(784, .4, .05); hmTone(1175, .5, .04); }, 200); msg.textContent = 'Все лабораторные сданы. Журнал закрыт: допуск к экзамену получен.'; }
}));
}
},
'Сидоров Никита': {
key: 'spk', no: '04', book: 'pk', cover: 'КУРСОВАЯ РАБОТА', sub: 'скоросшиватель', title: 'Курсовая', kicker: 'Папка с курсовой', tag: 'Сдано за неделю до срока', voteName: 'Сидоров Никита',
stats: [[40, 'страниц, все нумерованы'], [7, 'дней запаса до срока'], [0, 'ночей «в последний момент»']],
infoTitle: 'Курсовая работа',
story: ['Сидоров Никита сдаёт курсовые так, будто дедлайн — это рекомендация. За неделю до срока папка уже лежит на столе: сшита, подписана, с оглавлением и списком литературы, который он действительно прочитал.',
'Одногруппники смотрят на него как на человека из параллельной вселенной, где фраза «сделаю в ночь перед сдачей» неизвестна. Там страницы нумеруют заранее, а сноски не ставят в последний момент наугад.',
'Научрук признавался: единственный, кто присылает работу с вопросом «а что ещё можно улучшить?». Это пугает и вдохновляет в равных долях.',
'Папка Никиты — тихий упрёк всем, кто пишет введение в три часа ночи.'],
quote: ['«Дедлайн — это не день сдачи, а день, когда уже поздно что-то менять».', 'Из введения к курсовой'],
videoTitle: 'Защита курсовой', videoNote: 'Ролик подшивают в папку.',
facts: ['Оглавление и список литературы готовы раньше текста', 'Страницы нумеруются заранее, а не в последний момент', 'Спрашивает у научрука: «А что ещё улучшить?»'],
ph: ['📁', 'Защита курсовой', 'Ролик ещё в скоросшивателе'],
art: () => `<div class="pk2-tab">КУРСОВАЯ</div><div class="pk2-stack"><i></i><i></i><i></i></div><div class="pk2-clip"></div>`,
info: () => `
<div class="pk2" id="pk2">
<div class="pk2-sheet"><div class="pk2-top"><b>Курсовая работа</b><span id="pk2Pg">стр. 0 / 40</span></div>
<div class="pk2-text" id="pk2Tx"><p class="ph">Нажми «Написать раздел», и страницы начнут заполняться.</p></div>
<div class="pk2-stamp" id="pk2St"><b>СДАНО</b><small>за 7 дней до срока</small></div></div>
<div class="pk2-prog"><i id="pk2P"></i></div>
<button type="button" class="pk2-btn" id="pk2B">Написать раздел</button>
</div>`,
after: root => {
const tx = $('#pk2Tx', root), pg = $('#pk2Pg', root), p = $('#pk2P', root), b = $('#pk2B', root), st = $('#pk2St', root);
const parts = [['Введение', 'Актуальность темы обусловлена тем, что к дедлайну следует готовиться заранее.'], ['Глава 1', 'Теоретические основы: обзор литературы, которая действительно была прочитана.'], ['Глава 2', 'Практическая часть. Все расчёты сходятся — проверено дважды, один раз для спокойствия.'], ['Глава 3', 'Анализ результатов. Выводы подтверждаются, а не придумываются в три часа ночи.'], ['Заключение', 'Цель достигнута, задачи решены, до срока осталась неделя.'], ['Список литературы', '28 источников. Оформлены по ГОСТу, ссылки в тексте стоят на месте.']];
let i = 0, pages = 0;
b.addEventListener('click', () => {
if(i >= parts.length){ i = 0; pages = 0; tx.innerHTML = '<p class="ph">Начинаем заново. Нажми «Написать раздел».</p>'; pg.textContent = 'стр. 0 / 40'; p.style.width = '0'; st.classList.remove('on'); b.textContent = 'Написать раздел'; return; }
if(i === 0) tx.innerHTML = '';
const [h, t] = parts[i], el = document.createElement('div'); el.className = 'pk2-sec'; el.innerHTML = `<h4>${h}</h4><p></p>`; tx.appendChild(el); const pe = $('p', el);
let k = 0; const iv = setInterval(() => { if(!hmAlive(root)){ clearInterval(iv); return; } pe.textContent = t.slice(0, ++k); if(k % 3 === 0) fxNoise(.012, 3200, .03, 'highpass'); if(k >= t.length) clearInterval(iv); }, 22);
i++; pages = Math.round(i / parts.length * 40); pg.textContent = `стр. ${pages} / 40`; p.style.width = (i / parts.length * 100) + '%'; hmTone(520 + i * 40, .08, .04, 'triangle');
if(i === parts.length){ b.textContent = '↺ Заново'; setTimeout(() => { st.classList.add('on'); fxNoise(.1, 160, .22, 'lowpass'); hmTone(784, .5, .05); }, 1500); } else b.textContent = 'Следующий раздел';
});
}
},
'Иванова Маргарита': {
key: 'spl', no: '05', book: 'pl', cover: 'КОНСПЕКТ', sub: 'цветные маркеры', title: 'Конспект', kicker: 'Конспект в четыре цвета', tag: 'Каждая лекция — произведение искусства', voteName: 'Иванова Маргарита',
stats: [[4, 'цвета маркеров'], [100, '% страниц с пометками', '%'], [0, 'потерянных листов']],
infoTitle: 'Подчеркни главное',
story: ['Иванова Маргарита ведёт конспекты так, что их хочется выставлять. Четыре цвета маркеров, система обозначений, поля с пометками «важно!», «будет на экзамене» и «спросить у препода» — и всё строго по легенде.',
'Перед сессией её тетрадь расходится по группе быстрее расписания: копируют, фотографируют, ксерят. А Рита спокойно отвечает «берите, только вернуть» — и ни одной страницы не потеряно.',
'Говорят, по её конспектам можно восстановить любую лекцию с точностью до шутки преподавателя. Сама Маргарита скромно уверяет, что просто слушала.',
'Награда за чёткость, цвет и умение превратить лекцию в произведение искусства.'],
quote: ['«Главное — подчеркнуть главное. И не подчеркнуть всё подряд».', 'Правило первое из легенды конспекта'],
videoTitle: 'Страницы конспекта', videoNote: 'Ролик подчёркивается жёлтым.',
facts: ['Четыре цвета маркеров — у каждого своё значение', 'Тетрадь разошлась по группе быстрее расписания', 'По конспекту можно восстановить лекцию вместе с шуткой преподавателя'],
ph: ['🖍️', 'Страницы конспекта', 'Ролик ещё закрашивается'],
art: () => `<div class="pl-lines"></div><i class="pl-mk a"></i><i class="pl-mk b"></i><i class="pl-mk c"></i><i class="pl-st">★</i><i class="pl-st s2">♥</i>`,
info: () => `
<div class="pl" id="pl">
<div class="pl-tools" id="plT">${[['y', 'Определение'], ['p', 'Важно'], ['g', 'Пример'], ['b', 'Экзамен']].map(([c, n], i) => `<button type="button" class="pl-mkb ${c}${i ? '' : ' on'}" data-c="${c}"><i></i>${n}</button>`).join('')}</div>
<div class="pl-page" id="plP"><h4>Лекция 4 · Теория вероятностей</h4>
<p>Вероятностью события называют <w>отношение числа благоприятных исходов</w> к общему числу исходов. Например, <w>вероятность выпадения шестёрки</w> на кубике равна одной шестой.</p>
<p>Если события независимы, то <w>вероятность их совместного наступления</w> равна произведению вероятностей. <w>Будет на экзамене</w>: формула полной вероятности.</p>
<p>Главное — <w>внимательно читать условие</w>, а не угадывать ответ.</p></div>
<div class="pl-foot"><span id="plC">Выделено: 0 / 6</span><b id="plD">Конспект готов</b></div>
</div>`,
after: root => {
const words = $$('#plP w', root), tools = $$('.pl-mkb', root), cnt = $('#plC', root), done = $('#plD', root); let col = 'y';
tools.forEach(t => t.addEventListener('click', () => { col = t.dataset.c; tools.forEach(x => x.classList.toggle('on', x === t)); hmTone(500, .05, .03, 'triangle'); }));
words.forEach(w => w.addEventListener('click', () => {
['y', 'p', 'g', 'b'].forEach(c => w.classList.remove('c-' + c)); w.classList.add('c-' + col, 'hl'); fxNoise(.1, 1400, .04, 'bandpass');
const n = words.filter(x => x.classList.contains('hl')).length; cnt.textContent = `Выделено: ${n} / ${words.length}`;
if(n === words.length){ done.classList.add('on'); hmTone(880, .3, .05); setTimeout(() => hmTone(1318, .4, .04), 130); }
}));
}
},
'Чертовских Андрей': {
key: 'stb', no: '06', book: 'tb', cover: 'ЧЕРТЁЖНАЯ ПАПКА', sub: 'допуски и посадки', title: 'Чертёж', kicker: 'Инженерная графика', tag: 'Держит размер, когда остальные его теряют', voteName: 'Чертовских Андрей',
stats: [[5, 'сотых мм допуск'], [100, '% деталей в допуске', '%'], [1, 'тубус на все случаи']],
infoTitle: 'Подгони размер',
story: ['Чертовских Андрей — человек, для которого допуск ±0,05 мм не цифра, а образ жизни. Если деталь не влезла в допуск, он не ругается и не оправдывается: молча берёт напильник и приводит её в чувство.',
'Его чертежи на ватмане выглядят так, будто их распечатал плоттер: линии ровные, штриховка одной густоты, штамп заполнен без помарок. Преподаватель по инженерной графике однажды спросил: «Андрей, вы случайно не принтер?»',
'К сессии он приходит с тубусом, готовальней и ощущением, что всё размерено заранее — от экзамена до обеденного перерыва.',
'Награда за точность, выдержку и умение держать размер, когда остальные его теряют.'],
quote: ['«Размер — это не цифра на чертеже. Это обещание».', 'Андрей, штампуя лист'],
videoTitle: 'Чертёж на ватмане', videoNote: 'Ролик проходит нормоконтроль.',
facts: ['Допуск ±0,05 — образ жизни', 'Чертежи неотличимы от распечатанных на плоттере', 'К сессии приходит с тубусом и готовальней'],
ph: ['📐', 'Чертёж на ватмане', 'Ролик на нормоконтроле'],
art: () => `<div class="tb-grid"></div><svg class="tb-draw" viewBox="0 0 160 100"><circle cx="60" cy="50" r="30"/><circle cx="60" cy="50" r="18"/><path d="M20 50h80M60 10v80M104 20h40M104 80h40M124 20v60"/></svg><div class="tb-stamp">Лист 1 · М 1:1</div>`,
info: () => `
<div class="tb" id="tb">
<div class="tb-part"><svg viewBox="0 0 300 120"><rect x="20" y="30" width="260" height="60" rx="3" class="body"/><circle id="tbHole" cx="150" cy="60" r="20" class="hole"/><path d="M20 106h260" class="dm"/><text x="150" y="116" text-anchor="middle" id="tbTxt">Ø 40.00</text></svg></div>
<div class="tb-read"><div><small>Нужно</small><b id="tbT">Ø 37.40</b></div><div><small>Сейчас</small><b id="tbN">Ø 40.00</b></div><div><small>Допуск</small><b>±0.05</b></div></div>
<input type="range" class="tb-rng" id="tbR" min="3000" max="4800" step="1" value="4000" aria-label="Диаметр отверстия">
<p class="tb-msg" id="tbM">Крути ползунок, пока отверстие не станет нужного диаметра.</p>
<div class="tb-foot"><span id="tbC">Принято деталей: 0</span><button type="button" class="tb-btn" id="tbB">Проверить деталь</button></div>
</div>`,
after: root => {
const r = $('#tbR', root), hole = $('#tbHole', root), tx = $('#tbTxt', root), tn = $('#tbN', root), tt = $('#tbT', root), msg = $('#tbM', root), cnt = $('#tbC', root), btn = $('#tbB', root); let target, ok = 0;
const newT = () => { target = 3200 + Math.round(Math.random() * 1400); tt.textContent = 'Ø ' + (target / 100).toFixed(2); };
const upd = () => { const v = +r.value / 100; hole.setAttribute('r', (v / 2).toFixed(1)); tx.textContent = 'Ø ' + v.toFixed(2); tn.textContent = 'Ø ' + v.toFixed(2); const d = Math.abs(+r.value - target); tn.className = d <= 5 ? 'ok' : d <= 40 ? 'near' : ''; };
r.addEventListener('input', () => { upd(); if(Math.random() < .3) fxNoise(.02, 3800, .02, 'highpass'); });
btn.addEventListener('click', () => {
const d = Math.abs(+r.value - target);
if(d <= 5){ ok++; cnt.textContent = 'Принято деталей: ' + ok; msg.textContent = 'В допуске! Нормоконтроль подписал лист без замечаний.'; hmTone(1175, .3, .05); setTimeout(() => hmTone(1568, .4, .04), 100); newT(); upd(); }
else { msg.textContent = d <= 40 ? `Почти: отклонение ${(d / 100).toFixed(2)} мм. Андрей бы доточил.` : `Брак: отклонение ${(d / 100).toFixed(2)} мм. Это уже не деталь, а сувенир.`; hmTone(180, .3, .06, 'sawtooth'); }
});
newT(); upd();
}
}
};
const STUDENT = {
'Галкин Виталий': {
key: 'sgz', no: '01', book: 'zk', cover: 'ЗАЧЁТНАЯ КНИЖКА', sub: 'студенческая · именная', title: 'Зачётка', kicker: 'Зачётная книжка', tag: 'Спокойствие — его сила', voteName: 'Галкин Виталий',
stats: [[6, 'предметов — все на «отлично»'], [0, 'пересдач за всё время'], [100, '% посещаемости', '%']],
infoTitle: 'Зачётная книжка',
story: ['Прилежный — не значит «зубрила». Это человек, у которого конспект ведётся сам собой, а к зачёту он приходит так спокойно, будто уже его сдал. Спокойствие Виталия — отдельный предмет, и по нему в зачётке тоже «отлично».',
'Преподаватели узнают его по походке: ровно, без суеты, с папкой под мышкой и ощущением, что всё уже сделано. Расписание он помнит наизусть, а дедлайны сдаёт за неделю — чтобы потом было время ни о чём не волноваться.',
'В зачётке у него нет ни одного пустого окошка и ни одного исправления. Печати стоят ровно, как солдаты на параде. Деканат шутит, что зачётку Галкина можно сдавать в музей — но она ещё нужна.'],
quote: ['«Если хорошо подготовиться, то на зачёте остаётся только улыбаться».', 'Виталий Галкин, перед очередным «отлично»'],
videoTitle: 'Один день из жизни отличника', videoNote: 'Ролик ещё сдаёт зачёт.',
facts: ['Все шесть предметов закрыты «отлично»', 'Ни одной пересдачи и ни одного исправления', 'Появляется на парах за десять минут до звонка'],
ph: ['📘', 'День отличника', 'Видео скоро — пока ставим печати'],
art: () => `<i class="sg-gild a"></i><i class="sg-gild b"></i><div class="sg-seal">ЗАЧЁТНАЯ<br>КНИЖКА</div>`,
info: () => `
<div class="zk" id="zk">
<div class="zk-sheet">
<div class="zk-head"><b>Зачётная книжка</b><span>№ 2027-01 · Галкин В.</span></div>
<ul class="zk-rows">${[['Основы спокойствия', 'доц. Тишина А. Н.'], ['Высшая терпимость', 'проф. Штилев Б. В.'], ['Теория ожидания (очередей)', 'доц. Очередин К. К.'], ['Практикум «Не вздохнуть»', 'ст. преп. Выдохов С. Т.'], ['История прохождения дверей', 'доц. Скрипцов Д. Д.'], ['Физкультура (ходьба)', 'тренер Шагов И. И.']].map(([n, t], i) => `<li data-i="${i}"><span class="zk-n">${n}<small>${t}</small></span><span class="zk-g"><em>отлично</em></span><span class="zk-st"><svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="27" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="30" cy="30" r="21" fill="none" stroke="currentColor" stroke-width="1"/><path id="zkc${i}" d="M30 30m-17 0a17 17 0 1 1 34 0a17 17 0 1 1-34 0" fill="none"/><text font-size="6.4" font-weight="700" letter-spacing="1.4" fill="currentColor"><textPath href="#zkc${i}" startOffset="2">ДЕКАНАТ · ЗАЧТЕНО · </textPath></text><path d="M23 31l5 5 10-11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></span></li>`).join('')}</ul>
<div class="zk-foot"><button type="button" class="zk-btn" id="zkBtn">Поставить печать ▸</button><span class="zk-cnt" id="zkCnt">0 / 6</span></div>
<div class="zk-admit" id="zkAd" aria-live="polite"><i></i><b>ДОПУЩЕН К СЕССИИ</b><span>Декан: «Без замечаний»</span></div>
</div>
</div>`,
after: root => {
const rows = $$('.zk-rows li', root), btn = $('#zkBtn', root), cnt = $('#zkCnt', root), ad = $('#zkAd', root); let n = 0;
const press = () => {
if(n >= rows.length){ n = 0; rows.forEach(r => r.classList.remove('done')); ad.classList.remove('on'); btn.textContent = 'Поставить печать ▸'; cnt.textContent = '0 / 6'; return; }
const r = rows[n++]; r.classList.add('done'); r.style.setProperty('--rot', (Math.random() * 16 - 8).toFixed(1) + 'deg'); cnt.textContent = n + ' / 6';
try{ tink([196, 110]); navigator.vibrate?.(14); }catch(_){}
if(n === rows.length){ setTimeout(() => { ad.classList.add('on'); tink([523, 659, 784, 1047]); }, 380); btn.textContent = 'Сбросить ↺'; }
};
btn.addEventListener('click', press);
}
},
'Алиев Александр': {
key: 'sak', no: '03', book: 'kn', cover: 'КОНСПЕКТ', sub: 'общая тетрадь · 96 листов', title: 'Конспект', kicker: 'Лекция № 14', tag: 'Ничто не выведет из равновесия', voteName: 'Алиев Александр',
stats: [[96, 'листов — все исписаны'], [4, 'цвета маркеров'], [0, 'пропущенных лекций']],
infoTitle: 'Страница конспекта',
story: ['Конспекты Александра ходят по потоку как реликвии. Ровный почерк, поля на месте, главное выделено, второстепенное подчёркнуто — а на последней странице обязательно нарисована маленькая звёздочка, «чтобы знали, кто писал».',
'Он не торопится на лекциях и никогда не пишет под диктовку: слушает, думает, формулирует — и уже потом записывает так, что с первого раза понятно даже тем, кто спал. Равновесие у него не только в голове, но и в тетради: каждый абзац сбалансирован.',
'Говорят, у него есть три цвета маркера на каждую тему и четвёртый — «на случай, если преподаватель скажет что-то важное внезапно». Ни разу не пригодился: Александр успевал раньше.'],
quote: ['«Хороший конспект — это когда на экзамене не нужен ни один вопрос».', 'Из заметок на полях'],
videoTitle: 'Лекция глазами конспекта', videoNote: 'Ролик ещё конспектируется.',
facts: ['Четыре цвета маркеров на каждую тему', 'Поля, абзацы и звёздочка в конце — всегда', 'Тетради пользуются спросом у всего потока'],
ph: ['✏️', 'Конспект ведётся', 'Ролик дописывает последний абзац'],
art: () => `<i class="sk-hole a"></i><i class="sk-hole b"></i><i class="sk-hole c"></i><i class="sk-hole d"></i><i class="sk-hole e"></i><div class="sk-clip"></div>`,
info: () => `
<div class="kn" id="kn">
<div class="kn-tools"><span>Маркер</span>${[['y', '#ffe14d'], ['p', '#ff9fc4'], ['g', '#8de08a'], ['b', '#8cc8ff']].map(([k, c], i) => `<button type="button" class="kn-mk${i ? '' : ' on'}" data-c="${c}" aria-label="Маркер ${k}" style="--c:${c}"></button>`).join('')}<button type="button" class="kn-er" aria-label="Ластик">⌫</button></div>
<div class="kn-page">
<i class="kn-clip"></i><i class="kn-ring"></i>
<h4>Лекция № 14. Как не выйти из себя</h4>
<ol class="kn-lines">${['Вдох. Выдох. Повторить.', 'Если нервничает сосед — это его опыт.', 'Дедлайн ≠ повод для паники (см. 2).', 'Три раза проверь, что всё сдано.', 'Конспект сегодня — спокойствие завтра.', 'Не торопиться: время и так идёт.', 'Чай полезнее, чем «ну всё».', 'Формула: план + сон = зачёт.', 'Главное: улыбнуться и сдать.'].map((t, i) => `<li data-i="${i}"><span>${t}</span></li>`).join('')}</ol>
<span class="kn-star">★</span><i class="kn-ring2"></i>
</div>
<div class="kn-foot"><span id="knN">выделено: 0 из 9</span><div class="kn-stamp" id="knSt">КОНСПЕКТ ОБРАЗЦОВЫЙ</div></div>
</div>`,
after: root => {
const lines = $$('.kn-lines li', root), cnt = $('#knN', root), st = $('#knSt', root); let col = '#ffe14d', eraser = false;
$$('.kn-mk', root).forEach(b => b.addEventListener('click', () => { col = b.dataset.c; eraser = false; $$('.kn-mk,.kn-er', root).forEach(x => x.classList.toggle('on', x === b)); }));
$('.kn-er', root).addEventListener('click', e => { eraser = true; $$('.kn-mk,.kn-er', root).forEach(x => x.classList.toggle('on', x === e.currentTarget)); });
const upd = () => { const n = lines.filter(l => l.classList.contains('hl')).length; cnt.textContent = 'выделено: ' + n + ' из 9'; st.classList.toggle('on', n === lines.length); };
lines.forEach(l => l.addEventListener('click', () => { if(eraser){ l.classList.remove('hl'); } else { l.style.setProperty('--hc', col); l.classList.remove('hl'); void l.offsetWidth; l.classList.add('hl'); try{ tink([880]); }catch(_){} } upd(); }));
}
},
};
Object.assign(STUDENT, typeof STUDENT_NEW !== 'undefined' ? STUDENT_NEW : {});
Object.assign(HOD, Object.fromEntries(Object.entries(STUDENT).map(([k, v]) => [k + '|Прилежный', v])));
const SBOOK_COL = { zk: ['#7a1523', '#4a0a14'], kn: ['#25409a', '#142560'], fm: ['#1f5a40', '#0e3324'], ss: ['#1b1d24', '#0a0b0f'], lb: ['#1d6b66', '#0c3a37'], pk: ['#8a6a38', '#4a3516'], pl: ['#c0518f', '#6b1f50'], tb: ['#55633a', '#262e17'] };
function buildStudent(frame){
const noms = $$('.nominee:not([hidden])', frame);
if(!noms.length) return;
const now = new Date(), hDeg = (now.getHours() % 12 + now.getMinutes() / 60) * 30, mDeg = now.getMinutes() * 6 + now.getSeconds() * .1, sOff = -now.getSeconds();
const tickMarks = Array.from({ length: 12 }, (_, i) => `<path d="M50 ${i % 3 ? 8 : 6}V${i % 3 ? 13 : 16}" transform="rotate(${i * 30} 50 50)"/>`).join('');
const books = noms.map((nom, i) => {
const full = $('.nominee-front h3', nom)?.textContent.trim() || nom.dataset.nominee;
const z = STUDENT[nom.dataset.nominee] || { no: String(i + 1).padStart(2, '0'), book: 'zk', cover: 'КНИГА', sub: '', title: '', tag: '' };
const src = $('.nominee-front img', nom)?.getAttribute('src') || '';
const parts = full.split(/\s+/), ini = parts.map(s => s[0] || '').join('');
const [c1, c2] = SBOOK_COL[z.book] || SBOOK_COL.zk;
return `<article class="sb sb-${z.book}" data-i="${i}" style="--i:${i};--c1:${c1};--c2:${c2};--r:${[-1.6, 1.2, 1.1, -1.4][i % 4]}deg">
<button type="button" class="sb-btn" aria-label="${esc(z.cover)}: ${esc(full)}">
<span class="sb-block"><i></i><i></i><i></i></span>
<span class="sb-page"><em>${esc(parts[0])}</em><small>${esc(parts.slice(1).join(' '))}</small><b>открыть</b></span>
<span class="sb-cover">
<i class="sb-grain"></i><i class="sb-hinge"></i><i class="sb-frame"></i>
<span class="sb-top"><small>№ ${z.no}</small><b>${esc(z.cover)}</b><em>${esc(z.sub)}</em></span>
<span class="sb-med"><span class="sb-ring">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.remove()">` : ''}<i>${esc(ini)}</i></span></span>
<span class="sb-name">${esc(parts[0])}<small>${esc(parts.slice(1).join(' '))}</small></span>
<i class="sb-orn a"></i><i class="sb-orn b"></i>
</span>
<i class="sb-ribbon"></i><i class="sb-band"></i>
</button>
<p class="sb-tag"><b>${esc(z.title)}</b>${esc(z.tag)}</p>
</article>`;
}).join('');
const board = document.createElement('div');
board.className = 'student';
board.innerHTML = `
<header class="sh">
<div class="sh-clock"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" class="rim"/><circle cx="50" cy="50" r="42" class="face"/><g class="tk">${tickMarks}</g><g class="hh" style="transform:rotate(${hDeg}deg)"><path d="M50 52V28"/></g><g class="mh" style="transform:rotate(${mDeg}deg)"><path d="M50 54V16"/></g><g class="sh2" style="animation-delay:${sOff}s"><path d="M50 58V12"/></g><circle cx="50" cy="50" r="3.2" class="hub"/></svg></div>
<div class="sh-mid"><span class="sh-pl">ЧИТАЛЬНЫЙ ЗАЛ № 1</span><b>Открыт до последнего зачёта</b><small>выдача книг · тишина обязательна</small></div>
<div class="sh-lamp"><svg viewBox="0 0 80 100" aria-hidden="true"><path class="sh-cord" d="M40 94V70"/><ellipse cx="40" cy="95" rx="22" ry="5" class="base"/><path d="M38 94V56L50 34" class="neck"/><path d="M26 30C26 20 50 14 62 22L66 40C56 42 38 40 30 38Z" class="shade"/><path d="M32 26C40 22 54 22 60 26" class="shine"/></svg><i></i></div>
</header>
<div class="st-desk">
<i class="st-lamplight"></i>
<div class="st-books">${books}</div>
<div class="st-props" aria-hidden="true"><span class="pc"><i></i><i></i></span><span class="cup"><i class="st1"></i><i class="st2"></i><i class="st3"></i></span></div>
</div>
<p class="student-hint">Выбери книгу — она откроется, а вместе с ней и дело студента.</p>`;
$('.nominee-subblock', frame).before(board);
const els = $$('.sb', board); let busy = false;
const show = () => els.forEach(b => b.classList.add('in'));
if('IntersectionObserver' in window){ const io = new IntersectionObserver(es => { if(es.some(e => e.isIntersecting)){ show(); io.disconnect(); } }, { threshold: .08 }); io.observe(board); }
setTimeout(show, 4000);
board.addEventListener('click', e => {
const b = e.target.closest('.sb'); if(!b || busy) return; busy = true;
b.classList.add('open'); try{ tink([330, 247]); navigator.vibrate?.(12); }catch(_){}
setTimeout(() => { openCandidate(noms[+b.dataset.i], 'history'); }, 560);
setTimeout(() => { b.classList.remove('open'); busy = false; }, 1500);
});
}
frames.filter(f => f.dataset.student).forEach(f => { try{ buildStudent(f); }catch(err){ console.error('buildStudent', err); f.dataset.fb = '1'; } });
function fxNoise(dur = .08, freq = 3000, vol = .2, type = 'bandpass'){
try{
const ac = tink.ac || (tink.ac = new (window.AudioContext || window.webkitAudioContext)()); if(ac.state === 'suspended') ac.resume();
const n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
for(let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
s.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = 1.1; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(ac.destination); s.start();
}catch(_){}
}
const FLASH = {
'Караев Эльчин': {
key: 'fkb', no: '01', title: 'Жалюзи', moment: 'Сломанные жалюзи', label: 'ЖАЛЮЗИ', season: 'Год 1', kicker: 'Кассета № 01', tag: 'Они держались до последнего', voteName: 'Караев Эльчин', col: '#ffd24a',
stats: [[14, 'планок — ни одной целой'], [3, 'попытки поднять'], [1, 'шнур остался в руке']],
infoTitle: 'Окно аудитории',
story: ['Это случилось в обычный день на обычной паре. Караев потянул за шнур, чтобы чуть приоткрыть жалюзи, — и в следующую секунду аудитория стала свидетелем события, которое потом пересказывали три семестра. Жалюзи поднялись криво, потом встали, потом задумались, потом рухнули, выпустив облако пыли и один-единственный вздох.',
'С тех пор сломанные жалюзи стали частью истории потока: на них показывают новичкам, как «не надо», и вспоминают, когда кто-то говорит «да тут проще простого». Эльчин принял всё достойно: поднял планки, сложил аккуратной стопкой и сказал «ну, зато свет теперь будет всем». С этой фразы и начался флешбэк.',
'Говорят, потом жалюзи починили, и они простояли ещё десять лет. Но никто уже не помнил, что именно в них было сломано. Зато все помнили, кто это сделал: с улыбкой, с достоинством и с заботой о естественном освещении.'],
quote: ['«Ну что, теперь свет будет всем».', 'Эльчин Караев, держа шнур'],
videoTitle: 'Падение жалюзи (замедленно)', videoNote: 'Плёнку с дублем ещё ищут.',
facts: ['Поднимал жалюзи — поднял всю аудиторию', 'Шнур остался в руке как вещественное доказательство', 'Света после этого стало больше у всех, включая преподавателя'],
ph: ['🪟', 'Кадр с жалюзи', 'Плёнку ещё перематывают'],
art: () => `<i class="fk-sun"></i><i class="fk-slats"></i><div class="fk-tag">КАДР 01</div>`,
info: () => `
<div class="bl" id="bl">
<div class="bl-win">
<div class="bl-sky"><i class="bl-sun"></i><i class="bl-cl a"></i><i class="bl-cl b"></i><div class="bl-city"></div></div>
<div class="bl-dust" id="blDust"></div>
<div class="bl-slats" id="blS">${Array.from({ length: 14 }, (_, i) => `<i class="bl-s${i === 13 ? ' rail' : ''}" style="--i:${i}"></i>`).join('')}</div>
<i class="bl-cord" id="blCord"></i><i class="bl-pull" id="blPull"></i>
<i class="bl-frame"></i>
</div>
<div class="bl-ctl"><button type="button" class="bl-btn" id="blBtn">Дёрнуть шнур</button><button type="button" class="bl-tape" id="blFix" hidden>Починить скотчем</button></div>
<div class="bl-st"><small>состояние</small><b id="blState">Исправны</b></div>
<ul class="bl-log" id="blLog"><li>Журнал поломок пуст.</li></ul>
</div>`,
after: root => {
const slats = $$('.bl-s', root), st = $('#blState', root), log = $('#blLog', root), btn = $('#blBtn', root), fix = $('#blFix', root), pull = $('#blPull', root), cord = $('#blCord', root), dust = $('#blDust', root); let s = 0;
const R = (a, b) => a + Math.random() * (b - a);
const names = ['Исправны', 'Поднялись с запинкой', 'Перекосило', 'Планки сыплются', 'Рухнули'];
const notes = ['Шнур потянут. Жалюзи поднялись.', 'Правая сторона отстала от левой.', 'Две планки вылетели из пазов. Свет попадает куда попало.', 'Шнур остался в руке. Остальное — на полу.'];
const apply = () => {
slats.forEach((el, i) => {
let y = 0, r = 0, x = 0, op = 1, dl = 0;
if(s === 1){ y = -i * 13 * .3; r = R(-2, 2); }
if(s === 2){ y = -i * 13 * .55; r = R(-9, 9); x = i % 3 === 0 ? R(-6, 6) : 0; }
if(s === 3){ y = -i * 13 * .38; r = R(-15, 15); x = R(-8, 8); if(i === 4 || i === 9){ r = i === 4 ? 38 : -34; y += 4; } }
if(s === 4){ y = (178 - (13 - i) * 2.2) - i * 13; r = R(-24, 24); x = R(-20, 20); dl = (13 - i) * .03; }
el.style.transitionDelay = dl + 's';
el.style.setProperty('--y', y.toFixed(1) + 'px'); el.style.setProperty('--r', r.toFixed(1) + 'deg'); el.style.setProperty('--x', x.toFixed(1) + 'px'); el.style.opacity = op;
});
st.textContent = names[s]; st.dataset.s = s;
fix.hidden = s < 3; btn.hidden = s === 4;
};
const puff = () => { dust.innerHTML = Array.from({ length: 9 }, (_, i) => `<i style="left:${10 + i * 10}%;--d:${(i % 3) * .1}s"></i>`).join(''); dust.classList.remove('go'); void dust.offsetWidth; dust.classList.add('go'); };
btn.addEventListener('click', () => {
if(s >= 4) return; s++;
pull.classList.remove('tug'); cord.classList.remove('tug'); void pull.offsetWidth; pull.classList.add('tug'); cord.classList.add('tug');
apply(); const li = document.createElement('li'); li.textContent = notes[s - 1]; if(log.firstChild?.textContent.startsWith('Журнал')) log.innerHTML = ''; log.prepend(li);
if(s < 4){ fxNoise(.1, 2600 + s * 500, .3); setTimeout(() => fxNoise(.07, 3800, .25), 120); }
else { puff(); for(let k = 0; k < 14; k++) setTimeout(() => fxNoise(.06, 1800 + Math.random() * 3200, .35), k * 55); try{ navigator.vibrate?.([40, 30, 60, 30, 90]); }catch(_){} }
});
fix.addEventListener('click', () => { s = 0; apply(); log.prepend(Object.assign(document.createElement('li'), { textContent: 'Починено скотчем. Держится на честном слове.' })); tink([523, 784]); });
apply();
}
},
'Лукин Александр': {
key: 'fld', no: '02', title: 'Парта', moment: 'Сломанная парта', label: 'ПАРТА', season: 'Год 2', kicker: 'Кассета № 02', tag: 'Выдержала всё, кроме такого конспекта', voteName: 'Лукин Александр', col: '#8de08a',
stats: [[12, 'кг — предел парты'], [13, 'кг — было на ней'], [1, 'парта — теперь на скотче']],
infoTitle: 'Испытание нагрузкой',
story: ['На паре по высшей математике Лукин положил на парту рюкзак, ноутбук, три толстых учебника и пакет с обедом — и парта сказала «хватит». Раздался хруст, который запомнил весь корпус. Парта прогнулась посередине, как гамак, и вежливо раскололась пополам.',
'Лукин не растерялся: подпёр половинки портфелем, обмотал разлом скотчем из пенала и дописал конспект, пока преподаватель смотрел в окно. На следующий день в аудитории появилась табличка «Парта Лукина. Не нагружать». Парта на скотче простояла ещё год и помнила всё.',
'С тех пор о Лукине говорят: «человек, который сломал парту подготовкой к экзаменам». Учебная нагрузка оказалась выше грузоподъёмности мебели — а это уже достижение.'],
quote: ['«Парта сломалась не от тяжести. От глубины конспекта».', 'Надпись маркером на разломе'],
videoTitle: 'Хруст на последней парте', videoNote: 'Запись трещит, как та парта.',
facts: ['Предел парты — 12 кг, на ней было 13', 'Разлом обмотали скотчем из пенала', 'Табличка «Не нагружать» висела до выпуска'],
ph: ['🪑', 'Парта до и после', 'Ролик склеивают скотчем'],
art: () => `<i class="fl-board"></i><i class="fl-chalk a"></i><i class="fl-chalk b"></i><div class="fl-ledge"></div><div class="fl-tag">КАДР 02</div>`,
info: () => `
<div class="fd" id="fd">
<div class="fd-room">
<svg viewBox="0 0 320 230" aria-label="Школьная парта под нагрузкой">
<defs><linearGradient id="fdW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2b374"/><stop offset=".5" stop-color="#c58f4f"/><stop offset="1" stop-color="#8f6030"/></linearGradient><linearGradient id="fdM" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6e7780"/><stop offset=".4" stop-color="#d4dae0"/><stop offset="1" stop-color="#5b636b"/></linearGradient></defs>
<rect x="0" y="206" width="320" height="24" fill="#3b2a18"/><path d="M0 206H320" stroke="#6b4a2a" stroke-width="2"/>
<ellipse cx="160" cy="209" rx="120" ry="5" fill="#000" opacity=".4"/>
<g class="fd-legs"><path d="M72 124V206M70 206h12" stroke="url(#fdM)" stroke-width="7" stroke-linecap="round"/><path d="M248 124V206M246 206h12" stroke="url(#fdM)" stroke-width="7" stroke-linecap="round"/><path d="M72 170H248" stroke="url(#fdM)" stroke-width="5"/>
<path d="M96 128h128v34H96z" fill="#9a6b38" stroke="#5a3a18" stroke-width="2"/><path d="M104 136h112M104 146h112" stroke="#5a3a18" stroke-opacity=".5"/></g>
<g class="fd-half l" id="fdL"><rect x="36" y="104" width="124" height="20" rx="2" fill="url(#fdW)" stroke="#5a3a18" stroke-width="1.5"/><path d="M42 111h108M48 117h96" stroke="#7a4f22" stroke-opacity=".45"/><path d="M36 124h124v4H36z" fill="#6b4520"/><text x="48" y="119" class="fd-gr">ЛУКИН</text></g>
<g class="fd-half r" id="fdR"><rect x="160" y="104" width="124" height="20" rx="2" fill="url(#fdW)" stroke="#5a3a18" stroke-width="1.5"/><path d="M168 111h108M174 117h96" stroke="#7a4f22" stroke-opacity=".45"/><path d="M160 124h124v4H160z" fill="#6b4520"/><text x="226" y="119" class="fd-gr b">2+2=5</text></g>
<path class="fd-crack" id="fdCr" d="M160 104L156 110L163 114L157 120L162 124" fill="none" stroke="#2a1608" stroke-width="2" stroke-linejoin="round"/>
<g class="fd-items" id="fdIt"></g>
<g class="fd-tape" id="fdTp"><rect x="130" y="100" width="62" height="12" rx="1" transform="rotate(-14 160 106)" fill="#b8bcc2" opacity=".92"/><rect x="128" y="104" width="64" height="12" rx="1" transform="rotate(12 160 110)" fill="#aab0b6" opacity=".92"/></g>
</svg>
<div class="fd-dust" id="fdDust"></div>
</div>
<div class="fd-meter"><div class="fd-bar"><i id="fdBar"></i><em id="fdLim"></em></div><div class="fd-read"><b id="fdKg">0.0</b><span>кг</span><small id="fdSt">Парта в порядке</small></div></div>
<div class="fd-ctl"><button type="button" class="fd-btn" id="fdAdd">Положить: <b id="fdNext">рюкзак</b></button><button type="button" class="fd-fix" id="fdFix" hidden>Склеить скотчем</button></div>
</div>`,
after: root => {
const items = [['рюкзак', 3.5], ['ноутбук', 2], ['учебник', 2.5], ['ещё учебник', 2.5], ['конспекты', 1.5], ['обед в пакете', 1], ['последний учебник', 2.5]];
const g = $('#fdIt', root), L = $('#fdL', root), Rr = $('#fdR', root), cr = $('#fdCr', root), tp = $('#fdTp', root), kg = $('#fdKg', root), bar = $('#fdBar', root), st = $('#fdSt', root), next = $('#fdNext', root), add = $('#fdAdd', root), fix = $('#fdFix', root), dust = $('#fdDust', root), lim = $('#fdLim', root), box = $('#fd', root);
let n = 0, w = 0, broke = false, limit = 12, y = 104;
const draw = (k, yy) => {
const j = ((k * 37) % 9) - 4; const c = ['#b3261e', '#2457d6', '#1f8a52', '#d58a1a', '#6a3ea8'][k % 5];
if(k === 0) return `<g transform="translate(${130 + j} ${yy - 30})"><rect width="58" height="30" rx="9" fill="#2f6bd8" stroke="#143a80" stroke-width="1.5"/><rect x="10" y="14" width="38" height="12" rx="3" fill="#2457b0"/><path d="M14 6C14 -2 44 -2 44 6" fill="none" stroke="#143a80" stroke-width="3"/></g>`;
if(k === 1) return `<g transform="translate(${126 + j} ${yy - 7})"><rect width="64" height="7" rx="2" fill="#a9b0b8" stroke="#555d66"/><rect x="2" y="-30" width="60" height="30" rx="2" fill="#20242b" stroke="#555d66"/><rect x="5" y="-27" width="54" height="24" fill="#3b82d6" opacity=".7"/></g>`;
if(k === 4) return `<g transform="translate(${130 + j} ${yy - 8})"><rect width="60" height="8" fill="#fbf8ee" stroke="#9a9484"/><path d="M6 3h48" stroke="#2457d6" stroke-opacity=".6"/></g>`;
if(k === 5) return `<g transform="translate(${142 + j} ${yy - 22})"><path d="M0 22V4L4 0H30L34 4V22Z" fill="#c9a06a" stroke="#6b4a22" stroke-width="1.4"/><path d="M0 4H34" stroke="#6b4a22"/></g>`;
return `<g transform="translate(${128 + j} ${yy - 12})"><rect width="62" height="12" rx="1.5" fill="${c}" stroke="rgba(0,0,0,.5)"/><rect x="0" y="3" width="62" height="2" fill="rgba(255,255,255,.45)"/><rect x="0" y="8" width="62" height="1.4" fill="rgba(255,255,255,.3)"/></g>`;
};
const hts = [30, 37, 12, 12, 8, 22, 12];
const upd = () => {
kg.textContent = w.toFixed(1); bar.style.width = Math.min(100, w / 15 * 100) + '%'; lim.style.left = (limit / 15 * 100) + '%';
box.dataset.s = broke ? 'broke' : w >= limit - 2 ? 'crack' : w >= limit - 5 ? 'creak' : 'ok';
st.textContent = broke ? 'ПАРТА СЛОМАНА' : tp.classList.contains('on') && w === 0 ? 'Починена скотчем: держится' : w >= limit - 2 ? 'Парта трещит…' : w >= limit - 5 ? 'Парта скрипит' : 'Парта в порядке';
next.textContent = n < items.length ? items[n][0] : 'ничего не осталось';
const sag = broke ? 19 : Math.min(3.5, w / limit * 3.5);
L.style.transform = `rotate(${sag}deg)`; Rr.style.transform = `rotate(${-sag}deg)`;
cr.style.opacity = !broke && w >= limit - 2 ? 1 : broke ? 1 : 0;
add.disabled = broke || n >= items.length;
};
const crash = () => {
broke = true; L.style.transform = 'rotate(19deg)'; Rr.style.transform = 'rotate(-19deg)'; g.style.transform = 'translateY(26px) rotate(4deg)'; g.style.opacity = '.0'; setTimeout(() => { g.style.opacity = '.0'; }, 400);
dust.classList.remove('go'); void dust.offsetWidth; dust.classList.add('go'); fxNoise(.3, 700, .6); setTimeout(() => fxNoise(.14, 260, .6), 90); setTimeout(() => fxNoise(.2, 1200, .3), 220); try{ navigator.vibrate?.([60, 30, 120]); }catch(_){}
fix.hidden = false; box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
};
add.addEventListener('click', () => {
if(broke || n >= items.length) return; const [, kgw] = items[n]; y = 104 - (g.dataset.h ? +g.dataset.h : 0);
g.insertAdjacentHTML('beforeend', draw(n, y)); g.dataset.h = (+(g.dataset.h || 0)) + hts[n]; n++; w += kgw;
const last = g.lastElementChild; last.classList.add('drop');
tink([220 + n * 40]); fxNoise(.05, 600, .25);
if(w > limit) crash(); upd();
});
fix.addEventListener('click', () => { broke = false; n = 0; w = 0; limit = 6; g.innerHTML = ''; g.dataset.h = 0; g.style.transform = ''; g.style.opacity = 1; tp.classList.add('on'); fix.hidden = true; tink([523, 659]); upd(); });
g.dataset.h = 0; upd();
}
},
'Сериков Александр': {
key: 'fsr', no: '03', title: 'Выход', moment: 'Яркое появление на премиях', label: 'ВЫХОД', season: 'Год 3', kicker: 'Кассета № 03', tag: 'Ослепил всех с первой вспышки', voteName: 'Сериков Александр', col: '#ff2e93',
stats: [[100, 'вспышек за минуту'], [1, 'выход — на все времена'], [0, 'человек, не обернувшийся']],
infoTitle: 'Красная дорожка',
story: ['Когда на красную дорожку вышел Сериков, фотографы забыли, зачем пришли. Вспышки пошли очередями, как салют, и в какой-то момент казалось, что светит сам Сериков. Образ был выверен до миллиметра: пиджак с блёстками, очки по размеру момента и походка человека, которому не нужен дублёр.',
'Мемы про это появились ещё до конца церемонии. Кадр, где он поправляет воротник на фоне двух десятков вспышек, потом висел на стенах у половины потока. Режиссёр церемонии признавался: «Мы подготовили свет. А он принёс свой».',
'С тех пор слово «выход» в потоке означает не «выйти», а «выйти так, чтобы запомнили». Сериков делает это каждый раз — и каждый раз кажется, что в первый.'],
quote: ['«Мы подготовили свет. А он принёс свой».', 'Режиссёр церемонии'],
videoTitle: 'Выход под вспышки', videoNote: 'Съёмка идёт в замедлении.',
facts: ['Фотографы забыли, зачем пришли', 'Пиджак блестел сильнее прожекторов', 'Кадр с воротником висел на стенах потока'],
ph: ['📸', 'Красная дорожка', 'Ролик ждёт своей вспышки'],
art: () => `<i class="fs-beam a"></i><i class="fs-beam b"></i><i class="fs-beam c"></i><i class="fs-fl a"></i><i class="fs-fl b"></i><div class="fs-tag">КАДР 03</div>`,
info: () => `
<div class="fs" id="fs">
<div class="fs-stage" id="fsSt">
<div class="fs-wall"></div><div class="fs-lights"><i></i><i></i><i></i></div>
<div class="fs-carpet"></div>
<div class="fs-man" id="fsMan"><svg viewBox="0 0 120 230" aria-hidden="true"><defs><pattern id="fsSeq" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#2a1c04"/><circle cx="3" cy="3" r="1.7" fill="#ffd75a"/><circle cx="0" cy="0" r="1" fill="#fff6c0"/></pattern><linearGradient id="fsSk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0c9a0"/><stop offset="1" stop-color="#c58e5e"/></linearGradient></defs>
<ellipse cx="60" cy="224" rx="34" ry="5" fill="#000" opacity=".5"/><path d="M42 140L38 218H54L60 160L66 218H82L78 140Z" fill="#14131a"/><path d="M36 218h20v6H34zM64 218h22l2 6H64z" fill="#0a0a0c"/>
<path d="M36 68C36 60 44 56 60 56C76 56 84 60 84 68L90 146L74 150L72 92L60 110L48 92L46 150L30 146Z" fill="url(#fsSeq)" stroke="#6b4a08" stroke-width="1.4"/><path d="M60 110L48 92L52 70H68L72 92Z" fill="#f4f4f6"/><path d="M60 72L56 80L60 86L64 80Z" fill="#b3122a"/>
<circle cx="60" cy="40" r="19" fill="url(#fsSk)"/><path d="M41 36C40 20 52 14 62 15C74 16 80 26 79 38C76 30 68 26 58 28C50 29 44 31 41 36Z" fill="#1a1208"/><rect x="45" y="36" width="30" height="9" rx="4" fill="#0a0c10"/><path d="M48 38L56 38" stroke="#fff" stroke-opacity=".7" stroke-width="1.4"/><path d="M52 52Q60 57 68 52" fill="none" stroke="#7a3a1a" stroke-width="1.6" stroke-linecap="round"/>
<path d="M30 146L24 160" stroke="url(#fsSk)" stroke-width="8" stroke-linecap="round"/><path d="M90 146L98 128" stroke="url(#fsSk)" stroke-width="8" stroke-linecap="round"/></svg><i class="fs-gl a">✦</i><i class="fs-gl b">✦</i><i class="fs-gl c">✦</i></div>
<div class="fs-pap" id="fsPap">${[8, 24, 42, 60, 78, 92].map((x, i) => `<span style="left:${x}%;--k:${i}"><svg viewBox="0 0 50 60" aria-hidden="true"><circle cx="25" cy="14" r="9" fill="#0a0a0e"/><path d="M6 60C6 34 14 26 25 26C36 26 44 34 44 60Z" fill="#0a0a0e"/><rect x="16" y="22" width="22" height="14" rx="3" fill="#1a1a22" stroke="#444"/><circle cx="27" cy="29" r="4.4" fill="#5a6070"/></svg><i class="fs-lamp"></i></span>`).join('')}</div>
<i class="fs-white" id="fsWhite"></i><div class="fs-bursts" id="fsBur"></div>
</div>
<div class="fs-read"><div><small>вспышек</small><b id="fsN">0</b></div><div class="fs-meter"><small>яркость выхода</small><span><i id="fsM"></i></span></div></div>
<div class="fs-ctl"><button type="button" class="fs-go" id="fsGo">Выйти на дорожку</button><button type="button" class="fs-snap" id="fsSnap">Вспышка!</button></div>
<div class="fs-mag" id="fsMag"><small>свежий номер</small><b>СЕРИКОВ ОСЛЕПИЛ ВСЕХ</b><span>Фотографы просят выходить помедленнее.</span></div>
</div>`,
after: root => {
const man = $('#fsMan', root), n = $('#fsN', root), m = $('#fsM', root), wh = $('#fsWhite', root), bur = $('#fsBur', root), pap = $$('#fsPap > span', root), mag = $('#fsMag', root), go = $('#fsGo', root), st = $('#fsSt', root); let c = 0, walking = false, iv = 0;
const flash = () => {
c++; n.textContent = c; m.style.width = Math.min(100, c * 3.3) + '%';
const p = pap[(Math.random() * pap.length) | 0]; p.classList.remove('f'); void p.offsetWidth; p.classList.add('f');
const b = document.createElement('i'); const r = p.getBoundingClientRect(), s = st.getBoundingClientRect(); b.style.left = (r.left - s.left + r.width / 2) + 'px'; b.style.top = (r.top - s.top + 6) + 'px'; bur.appendChild(b); setTimeout(() => b.remove(), 520);
wh.classList.remove('on'); void wh.offsetWidth; wh.classList.add('on'); fxNoise(.03, 5200, .18, 'highpass');
if(c >= 30) mag.classList.add('on');
};
$('#fsSnap', root).addEventListener('click', () => { flash(); if(Math.random() < .6) setTimeout(flash, 90); try{ navigator.vibrate?.(8); }catch(_){} });
go.addEventListener('click', () => {
if(walking) return; walking = true; man.classList.remove('walk'); void man.offsetWidth; man.classList.add('walk'); go.disabled = true; let t = 0;
iv = setInterval(() => { if(!man.isConnected){ clearInterval(iv); return; } t++; const k = 1 + (t > 6 ? 1 : 0) + (Math.random() < .5 ? 1 : 0); for(let i = 0; i < k; i++) setTimeout(flash, i * 70); if(t > 16){ clearInterval(iv); walking = false; go.disabled = false; go.textContent = 'Ещё раз выйти'; } }, 230);
});
}
},
'Литнарович Кирилл': {
key: 'flt', no: '04', title: 'Завоз', moment: 'Завозы на канале «Айфон братки»', label: 'ЗАВОЗ', season: 'Год 4', kicker: 'Кассета № 04', tag: 'Когда канал просыпается', voteName: 'Литнарович Кирилл', col: '#2aabee',
stats: [[12480, 'подписчиков ждут завоза'], [24, 'часа в сутки — на связи'], [0, 'завозов без ажиотажа']],
infoTitle: 'Канал «Айфон Братки»',
story: ['«Айфон Братки» — канал, который просыпается от слова «завоз». Литнарович публикует пост, и через минуту комментарии превращаются в очередь: все спрашивают цену, наличие и «а в чёрном есть?». Он отвечает с достоинством человека, у которого всё уже разложено по коробкам.',
'Завозы на канале — отдельное явление: ровные ряды на фото, подписи без лишних слов, реакции — огонь и «беру». Подписчики ждут их, как новый сезон сериала. И каждый раз канал выдерживает ажиотаж, пусть и ценой уведомлений.',
'Поэтому момент и попал во флешбэк: канал жил, звенел и менял настроение потока. Кирилл не просто завозил — он создавал ожидание. А ожидание, как известно, лучшая реклама.'],
quote: ['«Завоз — это не событие. Это праздник с накладной».', 'Из комментариев под постом'],
videoTitle: 'Завоз: день ожидания', videoNote: 'Ролик ещё в пути.',
facts: ['Пост вышел — через минуту очередь', 'Фото ровными рядами, подписи без лишних слов', 'Подписчики ждут завоз как новый сезон'],
ph: ['📦', 'Завоз в пути', 'Ролик доедет следующим рейсом'],
art: () => `<i class="ft-plane"></i><i class="ft-dot a"></i><i class="ft-dot b"></i><i class="ft-dot c"></i><div class="ft-tag">КАДР 04</div>`,
info: () => `
<div class="tg" id="tg">
<div class="tg-head"><span class="tg-ava">АБ</span><div><b>Айфон Братки</b><small id="tgSub">12 480 подписчиков</small></div><i class="tg-bell"></i></div>
<div class="tg-road"><i class="tg-truck" id="tgTruck"><svg viewBox="0 0 90 46" aria-hidden="true"><rect x="2" y="6" width="50" height="28" rx="3" fill="#e9eef3" stroke="#8aa0b4"/><path d="M52 14H74L84 24V34H52Z" fill="#2aabee" stroke="#176e9c"/><path d="M58 18H72L78 24H58Z" fill="#cfeaff"/><circle cx="20" cy="36" r="7" fill="#1b2430"/><circle cx="20" cy="36" r="3" fill="#8a96a4"/><circle cx="68" cy="36" r="7" fill="#1b2430"/><circle cx="68" cy="36" r="3" fill="#8a96a4"/><path d="M10 14h34M10 22h34" stroke="#b9c6d3"/></svg></i></div>
<div class="tg-feed" id="tgFeed"></div>
<button type="button" class="tg-drop" id="tgDrop">📦 Сделать завоз</button>
</div>`,
after: root => {
const feed = $('#tgFeed', root), sub = $('#tgSub', root), truck = $('#tgTruck', root), btn = $('#tgDrop', root); let subs = 12480, k = 0;
const pool = [['iPhone 15 Pro', '256 ГБ · натуральный титан', '#8f8a82'], ['iPhone 14', '128 ГБ · синий', '#4a78c2'], ['iPhone 13', '128 ГБ · чёрный', '#23252b'], ['iPhone 15', '128 ГБ · розовый', '#e7a6b8'], ['iPhone 12', '64 ГБ · белый', '#e9e9ec'], ['iPhone 15 Pro Max', '512 ГБ · чёрный титан', '#2f3036']];
const fmt = v => v.toLocaleString('ru-RU');
const mk = (p, id, fresh) => { const left = 3 + ((id * 5) % 9), t = new Date(Date.now() - (fresh ? 0 : id * 3600e3)); return `<article class="tg-post${fresh ? ' new' : ''}"><div class="tg-img" style="--c:${p[2]}"><svg viewBox="0 0 60 100" aria-hidden="true"><rect x="8" y="4" width="44" height="92" rx="9" fill="${p[2]}" stroke="rgba(0,0,0,.4)" stroke-width="1.4"/><rect x="12" y="10" width="36" height="80" rx="5" fill="rgba(0,0,0,.35)"/><circle cx="22" cy="22" r="6" fill="rgba(0,0,0,.55)"/><circle cx="36" cy="22" r="6" fill="rgba(0,0,0,.55)"/><circle cx="29" cy="34" r="6" fill="rgba(0,0,0,.55)"/></svg><b>ЗАВОЗ</b></div><div class="tg-tx"><h5>📦 ЗАВОЗ № ${id}</h5><p><b>${p[0]}</b><br>${p[1]}<br>В наличии: <em>${left} шт.</em></p><div class="tg-re"><span>🔥 ${20 + (id * 7) % 40}</span><span>❤️ ${8 + (id * 3) % 20}</span><span>👀 ${2 + id % 6}</span></div><small>${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')} · <i>👁</i> ${fmt(1200 + id * 311)}</small></div></article>`; };
feed.innerHTML = [2, 1].map(i => mk(pool[(i + 3) % pool.length], i, false)).join(''); k = 2;
btn.addEventListener('click', () => {
k++; const p = pool[(k + 1) % pool.length];
truck.classList.remove('go'); void truck.offsetWidth; truck.classList.add('go'); fxNoise(.3, 180, .3, 'lowpass');
setTimeout(() => { feed.insertAdjacentHTML('afterbegin', mk(p, k, true)); if(feed.children.length > 4) feed.lastElementChild.remove(); subs += 37 + ((Math.random() * 60) | 0); sub.textContent = fmt(subs) + ' подписчиков'; tink([988, 1319]); try{ navigator.vibrate?.(12); }catch(_){} }, 900);
});
}
},
'Куликов Виталий': {
key: 'fku', no: '05', title: 'Забег', moment: 'Забег до звонка', label: 'ЗАБЕГ', season: 'Год 2', kicker: 'Кассета № 05', tag: 'Дверь закрылась на его глазах', voteName: 'Куликов Виталий', col: '#ff8a3d',
stats: [[38, 'секунд до звонка'], [3, 'этажа бегом'], [1, 'дверь — закрыта на кончике носа']],
infoTitle: 'Коридор, 8:29',
story: ['Обычное утро, 8:29. До звонка тридцать восемь секунд, до аудитории — три этажа и один бесконечный коридор. Виталий выбегает из-за угла с рюкзаком наперевес, и вся поточная лестница замирает: все знают, чем это закончится.',
'Он успевает почти всё: ступени, поворот, дежурный по этажу и даже шнурок, который решил развязаться ровно на середине. Дверь закрывается медленно, как в кино, — и в щель остаётся виден кончик носа.',
'Ему открыли. Преподаватель посмотрел на часы и сказал: «Ровно ноль-ноль. Как вы это делаете?». С тех пор в потоке говорят: «Бежит, как Куликов» — и имеют в виду не скорость, а оптимизм.'],
quote: ['«Если бежать достаточно уверенно, время само подождёт».', 'Виталий Куликов, на площадке между этажами'],
videoTitle: 'Забег в замедленной съёмке', videoNote: 'Плёнку с хронометражем ещё ищут.',
facts: ['Три этажа за 38 секунд', 'Шнурок развязался ровно на середине', 'Дверь открыли — из уважения к оптимизму'],
ph: ['🏃', 'Коридор, 8:29', 'Плёнка ещё догоняет звонок'],
art: () => `<i class="fku-door"></i><i class="fku-run"></i><div class="fk-tag">КАДР 05</div>`,
info: () => `
<div class="fk5" id="fk5">
<div class="fk5-hall"><i class="fk5-door" id="fk5Door"></i><i class="fk5-man" id="fk5Man">🏃</i><i class="fk5-line"></i></div>
<div class="fk5-clock"><small>до звонка</small><b id="fk5T">10.0</b><span>с</span></div>
<p class="fk5-msg" id="fk5Msg">Жми «Бежать» как можно чаще — успей до двери, пока она не закрылась.</p>
<div class="fk5-foot"><button type="button" class="fk5-go" id="fk5Go">Бежать!</button><span id="fk5R">рекорд: —</span></div>
</div>`,
after: root => {
const man = $('#fk5Man', root), door = $('#fk5Door', root), t = $('#fk5T', root), msg = $('#fk5Msg', root), go = $('#fk5Go', root), rec = $('#fk5R', root);
let d = 0, left = 10, run = false, tm = 0, best = null;
const draw = () => { man.style.left = Math.min(d, 100) + '%'; door.style.setProperty('--o', Math.max(0, left / 10)); t.textContent = Math.max(0, left).toFixed(1); };
const end = win => {
run = false; clearInterval(tm); go.textContent = 'Ещё раз';
if(win){ const sc = (left).toFixed(1); best = best === null ? +sc : Math.max(best, +sc); rec.textContent = 'рекорд: ' + best.toFixed(1) + ' с запаса'; msg.textContent = left < 1.2 ? 'Влетел в щель! Преподаватель смотрит на часы: «Ровно ноль-ноль».' : 'Успел с запасом — подозрительно для Куликова.'; tink([784, 1047]); try{ navigator.vibrate?.([20, 40, 20]); }catch(_){} }
else { msg.textContent = 'Дверь закрылась. В щель остался кончик носа.'; fxNoise(.2, 220, .3, 'lowpass'); }
};
go.addEventListener('click', () => {
if(!run){ d = 0; left = 10; run = true; go.textContent = 'Бежать!'; msg.textContent = 'Пошёл! Жми быстрее!'; draw(); tm = setInterval(() => { if(!root.isConnected){ clearInterval(tm); return; } left -= .1; if(left <= 0){ left = 0; draw(); end(false); } else draw(); }, 100); return; }
d += 2.6; tink([300 + d * 4]); draw(); man.classList.remove('step'); void man.offsetWidth; man.classList.add('step');
if(d >= 100) end(true);
});
draw();
}
},
};
Object.assign(HOD, Object.fromEntries(Object.entries(FLASH).map(([k, v]) => [k + '|Флешбэк', v])));
function buildFlash(frame){
const noms = $$('.nominee:not([hidden])', frame);
if(!noms.length) return;
const total = typeof TOTAL_NOMS === 'number' ? TOTAL_NOMS : 7, idx = frames.indexOf(frame);
const cells = noms.map((nom, i) => {
const full = $('.nominee-front h3', nom)?.textContent.trim() || nom.dataset.nominee;
const z = FLASH[nom.dataset.nominee] || { no: String(i + 1).padStart(2, '0'), moment: '', season: '' };
const src = $('.nominee-front img', nom)?.getAttribute('src') || '', ini = full.split(/\s+/).map(s => s[0] || '').join('').slice(0, 2);
return `<article class="cs-fr" data-i="${i}" style="--i:${i}">
<button type="button" class="cs-btn" aria-label="${esc(z.moment)}: ${esc(full)}">
<span class="cs-film"><span class="cs-edge t">ИС-41 400 &nbsp;▸ ${String(i * 6 + 4).padStart(2, '0')}A</span>
<span class="cs-img">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.remove()">` : ''}<b>${esc(ini)}</b></span>
<span class="cs-edge b">${esc(z.season || '')} &nbsp;·&nbsp; кадр ${esc(z.no || '')}</span></span>
<svg class="cs-mark" viewBox="0 0 200 140" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M30 18C80 2 168 4 188 40C204 80 170 128 100 132C34 136 4 104 8 66C11 36 40 16 92 12"/></svg>
</button>
<p class="cs-cap"><small>Кадр ${esc(z.no || '')}</small><b>${esc(z.moment || '')}</b><em>${esc(full)}</em></p>
</article>`;
}).join('');
const board = document.createElement('div');
board.className = 'cs';
board.innerHTML = `
<header class="lxn-head">
<div class="lxn-kick"><span>Номинация ${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span><span>Плёнка ИС-41 · 400</span></div>
<h2 class="lxn-title">Флешбэк <em>года</em></h2>
<p class="lxn-lede">${noms.length} моментов за четыре года. Выбери кадр, который остался в памяти.</p>
<div class="cs-years">${[2023, 2024, 2025, 2026, 2027].map(y => `<span>${y}</span>`).join('')}</div>
</header>
<div class="cs-sheet">${cells}</div>
<p class="lxn-hint">Нажми на кадр — откроется история момента.</p>`;
$('.nominee-subblock', frame).before(board);
frame.classList.add('lxn');
const els = $$('.cs-fr', board); let busy = false;
const show = () => els.forEach(b => b.classList.add('in'));
if('IntersectionObserver' in window){ const io = new IntersectionObserver(es => { if(es.some(e => e.isIntersecting)){ show(); io.disconnect(); } }, { threshold: .05 }); io.observe(board); }
setTimeout(show, 2500);
board.addEventListener('click', e => {
const b = e.target.closest('.cs-fr'); if(!b || busy) return; busy = true;
els.forEach(x => x.classList.toggle('pick', x === b)); try{ fxNoise(.12, 2400, .08, 'highpass'); navigator.vibrate?.(12); }catch(_){}
setTimeout(() => { openCandidate(noms[+b.dataset.i], 'history'); }, 520);
setTimeout(() => { busy = false; }, 1200);
});
}
frames.filter(f => f.dataset.flash).forEach(f => { try{ buildFlash(f); }catch(err){ console.error('buildFlash', err); f.dataset.fb = '1'; } });
Object.assign(HOD['Кирилл'], {
stats: [[1342, 'пар посещено'], [4, 'года без выходных'], ['~0', 'прогулов']],
infoTitle: 'Личное дело посещаемости',
info: () => {
const src = (typeof hodActive !== 'undefined' && hodActive && $('.nominee-front img', hodActive)?.getAttribute('src')) || '';
const bars = Array.from({ length: 34 }, (_, i) => { const w = [1, 2, 1, 3, 1, 1, 2][i % 7]; return `<i style="width:${w}px"></i>`; }).join('');
const weeks = y => Array.from({ length: 36 }, (_, w) => `<i class="kx-c" data-y="${y}" data-w="${w}" style="--i:${y * 36 + w}"></i>`).join('');
return `
<div class="kx">
<section class="kx-sec">
<div class="kx-lbl"><b>01</b>Пропуск и турникет</div>
<div class="kx-gate" id="kxGate">
<div class="kx-card" id="kxCard"><i class="kx-lan"></i><i class="kx-holo"></i><i class="kx-chip"></i>
<div class="kx-ch"><b>УНИВЕРСИТЕТ</b><small>студенческий билет</small></div>
<div class="kx-cb"><span class="kx-ph">${src ? `<img src="${esc(src)}" alt="" draggable="false" onerror="this.remove()">` : ''}<em>ЛК</em></span>
<div class="kx-id"><b>ЛИТНАРОВИЧ</b><span>Кирилл</span>
<dl><dt>Группа</dt><dd>бессменная</dd><dt>Курс</dt><dd>4 из 4</dd><dt>Прогулов</dt><dd class="z">0</dd></dl></div></div>
<div class="kx-bc">${bars}</div>
</div>
<div class="kx-yard" aria-hidden="true">
<svg viewBox="0 0 300 190">
<defs><pattern id="kxT" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#2b3a33"/><path d="M0 0H30V30" fill="none" stroke="#1f2b26" stroke-width="1.5"/></pattern><linearGradient id="kxSt" x1="0" x2="1"><stop offset="0" stop-color="#8d99a3"/><stop offset=".5" stop-color="#e5ebef"/><stop offset="1" stop-color="#7e8a94"/></linearGradient></defs>
<rect width="300" height="190" fill="url(#kxT)"/>
<rect x="0" y="0" width="300" height="22" fill="#14201a"/><rect x="120" y="0" width="60" height="22" fill="#0b1410"/><text x="150" y="15" text-anchor="middle" class="kx-t1">АУДИТОРИЯ</text>
<rect x="0" y="176" width="300" height="14" fill="#3a4a3f"/><text x="150" y="187" text-anchor="middle" class="kx-t2">УЛИЦА</text>
<rect x="104" y="40" width="9" height="108" rx="3" fill="url(#kxSt)"/><rect x="187" y="40" width="9" height="108" rx="3" fill="url(#kxSt)"/>
<rect x="86" y="58" width="24" height="46" rx="4" fill="#10161c" stroke="#52606b"/><rect x="90" y="63" width="16" height="10" rx="1.5" fill="#0a2a1a" id="kxScr"/><circle cx="98" cy="86" r="3.6" fill="#c0392b" id="kxLed"/><rect x="92" y="94" width="12" height="5" rx="1" fill="#2a3640"/>
<path d="M196 104h14v6h-14z" fill="#52606b"/>
<g id="kxArm" style="transform-origin:150px 94px"><circle cx="150" cy="94" r="8" fill="url(#kxSt)" stroke="#55626d"/>
<rect x="147" y="58" width="6" height="36" rx="3" fill="url(#kxSt)" stroke="#55626d" stroke-width=".8"/>
<rect x="147" y="94" width="6" height="36" rx="3" fill="url(#kxSt)" stroke="#55626d" stroke-width=".8" style="transform-origin:150px 94px;transform:rotate(120deg)"/>
<rect x="147" y="94" width="6" height="36" rx="3" fill="url(#kxSt)" stroke="#55626d" stroke-width=".8" style="transform-origin:150px 94px;transform:rotate(240deg)"/>
<circle cx="150" cy="94" r="3" fill="#2a3640"/></g>
<g id="kxWalk" style="opacity:0"><ellipse cx="150" cy="190" rx="17" ry="8.5" fill="#000" opacity=".3"/>
<rect x="141" y="182" width="18" height="11" rx="3.5" fill="#6b4a2a"/><ellipse cx="150" cy="188" rx="15" ry="7.5" fill="#2f6b3c"/><ellipse cx="150" cy="188" rx="15" ry="7.5" fill="none" stroke="#1c4426" stroke-width="1.2"/>
<circle cx="150" cy="183" r="8" fill="#e9bf97"/><path d="M142 183c0-8 5-10 8-10s9 2 8 10c-3-4-6-5-8-5s-6 1-8 5z" fill="#3a2614"/></g>
<path d="M150 168v-20" stroke="#7dffa0" stroke-width="2" stroke-dasharray="3 5" opacity=".35"/>
</svg>
</div>
</div>
<div class="kx-gctl"><button type="button" class="kx-btn" id="kxScan">Приложить пропуск</button><div class="kx-cnt"><small>пар посещено</small><b id="kxCnt">1 342</b></div></div>
<ul class="kx-log" id="kxLog"><li><time>08:11</time>Проход разрешён · пара №1342</li></ul>
</section>
<section class="kx-sec">
<div class="kx-lbl"><b>02</b>Четыре года в клетках</div>
<div class="kx-hm" id="kxHm">
${[0, 1, 2, 3].map(y => `<div class="kx-hy"><span>${y + 1} курс</span><div class="kx-wk">${weeks(y)}</div></div>`).join('')}
<div class="kx-mo"><span>сен</span><span>окт</span><span>ноя</span><span>дек</span><span>янв</span><span>фев</span><span>мар</span><span>апр</span><span>май</span></div>
</div>
<div class="kx-leg"><span><i class="l4"></i>на всех парах</span><span><i class="l0"></i>каникулы</span><span><i class="ill"></i>болел</span><span><i class="fl"></i>форс-мажор</span></div>
<p class="kx-tip" id="kxTip"><b>144 недели.</b> Нажми на клетку — узнаешь, что было на этой неделе.</p>
</section>
<section class="kx-sec">
<div class="kx-lbl"><b>03</b>Утро по минутам</div>
<div class="kx-morn" id="kxMorn">
<svg viewBox="0 0 340 160" class="kx-sky" aria-hidden="true">
<defs><linearGradient id="kxN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1233"/><stop offset="1" stop-color="#3a3a6e"/></linearGradient><linearGradient id="kxD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fb6f2"/><stop offset="1" stop-color="#ffe6b0"/></linearGradient><radialGradient id="kxSun"><stop offset="0" stop-color="#fff7c4"/><stop offset="1" stop-color="#ffd24a"/></radialGradient></defs>
<rect width="340" height="160" fill="url(#kxD)"/><rect width="340" height="160" fill="url(#kxN)" id="kxNight"/>
<g id="kxStars" fill="#fff">${[[20, 18], [60, 40], [100, 14], [140, 30], [190, 12], [240, 34], [290, 16], [320, 42], [40, 60], [270, 58]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1 : 1.5}"/>`).join('')}</g>
<circle id="kxSunE" r="13" fill="url(#kxSun)"/>
<path d="M0 126c40-14 70-8 110-14s90-6 130-12 70-2 100-8V160H0z" fill="#2f4a3a"/><path d="M0 140c60-10 120-4 180-8s110-2 160-6v34H0z" fill="#243b2e"/>
<g fill="#1b2a22"><rect x="14" y="94" width="32" height="30"/><path d="M10 94l20-16 20 16z" fill="#7a2f26"/><rect x="62" y="104" width="14" height="22"/><rect x="288" y="62" width="40" height="62"/><path d="M284 62l24-12 24 12z" fill="#394a63"/></g>
<g fill="#ffe08a" opacity=".85"><rect x="22" y="102" width="6" height="7"/><rect x="34" y="102" width="6" height="7"/><rect x="294" y="72" width="6" height="7"/><rect x="306" y="72" width="6" height="7"/><rect x="318" y="72" width="6" height="7"/><rect x="294" y="88" width="6" height="7"/><rect x="306" y="88" width="6" height="7"/></g>
<path id="kxPath" d="M30 126C60 126 70 104 110 102S170 118 210 114S280 100 304 112" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2.4" stroke-dasharray="2 6" stroke-linecap="round"/>
<g id="kxPts">${[['🏠', 30, 126], ['🚌', 110, 102], ['☕', 210, 114], ['🎓', 304, 112]].map(([e, x, y]) => `<g transform="translate(${x} ${y})"><circle r="9" fill="#fff" stroke="#2f6b3c" stroke-width="1.6"/><text y="4" text-anchor="middle" font-size="10">${e}</text></g>`).join('')}</g>
<g id="kxPin"><ellipse cy="12" rx="8" ry="3" fill="#000" opacity=".3"/><circle r="9.5" fill="#e9bf97" stroke="#2f6b3c" stroke-width="2"/><path d="M-9 -2c0-8 5-10 9-10s9 2 9 10c-3-4-6-5-9-5s-6 1-9 5z" fill="#3a2614"/><circle cx="-3.3" cy="1" r="1.2" fill="#222"/><circle cx="3.3" cy="1" r="1.2" fill="#222"/><path d="M-3 5q3 2.4 6 0" fill="none" stroke="#7a3a1a" stroke-width="1.2" stroke-linecap="round"/></g>
</svg>
<div class="kx-clk"><b id="kxTm">06:30</b><span id="kxEv">Будильник. Первый и последний.</span></div>
<input type="range" min="0" max="1000" value="0" class="kx-rng" id="kxRng" aria-label="Время утра">
<div class="kx-ms" id="kxMs">${['06:30', '06:48', '07:05', '07:30', '07:52', '08:15'].map(t => `<i data-t="${t}"><b></b><small>${t}</small></i>`).join('')}</div>
<button type="button" class="kx-btn kx-play" id="kxPlay">▶ Пройти утро</button>
</div>
</section>
<section class="kx-sec">
<div class="kx-cert" id="kxCert">
<div class="kx-cin"><small>ГРАМОТА · ЗА ВЕРНОСТЬ ПАРАМ</small><b>Литнарович Кирилл</b><p>награждается за 1 342 посещённые пары, 4 года на передней линии образования и ни одного «меня сегодня не будет».</p>
<div class="kx-sign"><span>Деканат</span><em>подпись</em></div></div>
<svg class="kx-seal" viewBox="0 0 120 120" aria-hidden="true"><defs><path id="kxCirc" d="M60 60m-40 0a40 40 0 1 1 80 0a40 40 0 1 1-80 0"/></defs>
<circle cx="60" cy="60" r="56" fill="#b3382c"/><circle cx="60" cy="60" r="50" fill="none" stroke="#f5d9c9" stroke-width="1.5" stroke-dasharray="2 3"/><circle cx="60" cy="60" r="30" fill="none" stroke="#f5d9c9" stroke-width="1.5"/>
<text font-size="11" font-weight="800" fill="#f5d9c9" letter-spacing="2.4"><textPath href="#kxCirc" startOffset="0">ПРИСУТСТВОВАЛ · ПРИСУТСТВОВАЛ · </textPath></text><text x="60" y="68" text-anchor="middle" font-size="26" fill="#f5d9c9">✓</text></svg>
</div>
</section>
</div>`;
},
after: root => {
const live = () => root.isConnected;
const walk = $('#kxWalk', root), arm = $('#kxArm', root), led = $('#kxLed', root), scr = $('#kxScr', root), card = $('#kxCard', root), btn = $('#kxScan', root), cnt = $('#kxCnt', root), log = $('#kxLog', root);
let n = 1342, busy = false; const pad = v => String(v).padStart(2, '0');
btn.addEventListener('click', () => {
if(busy) return; busy = true; btn.disabled = true;
card.classList.remove('tap'); void card.offsetWidth; card.classList.add('tap'); tink([880]); fxNoise(.05, 3000, .2);
setTimeout(() => { led.setAttribute('fill', '#2ecc71'); scr.setAttribute('fill', '#17c964'); tink([1175, 1568]); }, 380);
walk.style.opacity = 1; walk.getAnimations?.().forEach(a => a.cancel());
walk.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-165px)' }], { duration: 2400, delay: 450, easing: 'ease-in-out', fill: 'forwards' });
arm.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(120deg)' }], { duration: 700, delay: 1050, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
setTimeout(() => fxNoise(.2, 500, .25, 'lowpass'), 1100);
setTimeout(() => {
n++; cnt.textContent = n.toLocaleString('ru-RU'); const d = new Date(); const li = document.createElement('li'); li.innerHTML = `<time>${pad(d.getHours())}:${pad(d.getMinutes())}</time>Проход разрешён · пара №${n}`; log.prepend(li); if(log.children.length > 4) log.lastElementChild.remove();
}, 1500);
setTimeout(() => {
walk.style.opacity = 0; walk.getAnimations?.().forEach(a => a.cancel()); arm.getAnimations?.().forEach(a => a.cancel());
led.setAttribute('fill', '#c0392b'); scr.setAttribute('fill', '#0a2a1a'); busy = false; btn.disabled = false;
}, 3100);
});
const tips = ['Пришёл за 15 минут до звонка и занял первую парту.', 'Записал даже то, что преподаватель не диктовал.', 'Задал вопрос по теме. Лекция удлинилась на 10 минут.', 'Сидел ровно. Телефон был в рюкзаке.', 'Принёс конспект для тех, кто «случайно пропустил».', 'Единственный, кто слышал, о чём шла речь.', 'Вахтёр уже не спрашивал пропуск.', 'Выучил расписание наизусть, включая замены.'];
const mon = ['сентябре', 'октябре', 'ноябре', 'декабре', 'январе', 'феврале', 'марте', 'апреле', 'мае'];
const hm = $('#kxHm', root), tip = $('#kxTip', root);
$$('.kx-c', hm).forEach(c => {
const y = +c.dataset.y, w = +c.dataset.w, k = y * 36 + w; let cls = 'l' + (3 + ((k * 7 + y) % 3 ? 1 : 0)), msg = tips[(k * 5 + y) % tips.length];
if(w === 17 || w === 18){ cls = 'l0'; msg = 'Зимние каникулы. Но перед сном всё равно проверил расписание.'; }
if(w >= 33){ cls = 'l5'; msg = 'Экзамены. Пришёл за час. Вышел последним — с пятёркой.'; }
if(w >= 16 && w <= 16){ cls = 'l5'; msg = 'Зимняя сессия. Билет вытянул спокойно.'; }
if(y === 1 && w === 22){ cls = 'ill'; msg = 'Болел. Но написал в чат: «Что задали?»'; }
if(y === 2 && w === 8){ cls = 'fl'; msg = 'Форс-мажор: всемирный потоп (лужа у входа). Опоздал на 4 минуты, но пришёл.'; }
c.classList.add(cls); c.dataset.msg = `<b>${y + 1} курс · ${w % 4 + 1}-я неделя в ${mon[Math.min(8, (w / 4) | 0)]}.</b> ${msg}`;
});
hm.addEventListener('click', e => { const c = e.target.closest('.kx-c'); if(!c) return; $$('.kx-c.sel', hm).forEach(x => x.classList.remove('sel')); c.classList.add('sel'); tip.innerHTML = c.dataset.msg; tink([660 + (+c.dataset.w % 6) * 60]); });
const path = $('#kxPath', root), pin = $('#kxPin', root), rng = $('#kxRng', root), tm = $('#kxTm', root), ev = $('#kxEv', root), night = $('#kxNight', root), stars = $('#kxStars', root), sun = $('#kxSunE', root), dots = $$('#kxMs i', root), L = path.getTotalLength();
const evs = [[0, 'Будильник. Первый и последний.'], [18, 'Вышел из дома. Рюкзак собран с вечера.'], [35, 'Остановка. Автобус подошёл ровно вовремя.'], [60, 'Кофейня: «как обычно» — и бариста уже кивает.'], [82, 'У входа. Вахтёр здоровается по имени.'], [105, 'В аудитории. Первая парта, тетрадь открыта.']];
const setT = v => {
const t = v / 1000, mins = Math.round(t * 105), hh = 6 + ((30 + mins) / 60 | 0), mm = (30 + mins) % 60; tm.textContent = pad(hh) + ':' + pad(mm);
const p = path.getPointAtLength(L * t); pin.setAttribute('transform', `translate(${p.x} ${p.y - 10})`);
let cur = 0; evs.forEach(([m], i) => { if(mins >= m) cur = i; }); ev.textContent = evs[cur][1]; dots.forEach((d, i) => d.classList.toggle('on', i <= cur));
night.setAttribute('opacity', Math.max(0, 1 - t * 1.7).toFixed(2)); stars.setAttribute('opacity', Math.max(0, 1 - t * 2.4).toFixed(2));
sun.setAttribute('cx', 30 + t * 280); sun.setAttribute('cy', 120 - Math.sin(Math.min(1, t * 1.15) * Math.PI / 1.7) * 92);
};
rng.addEventListener('input', () => setT(+rng.value)); setT(0);
let raf = 0; $('#kxPlay', root).addEventListener('click', () => {
cancelAnimationFrame(raf); const t0 = performance.now(), from = +rng.value >= 990 ? 0 : +rng.value, dur = 6500 * (1 - from / 1000) + 400; tink([523, 659]);
const step = now => { if(!live()) return; const k = Math.min(1, (now - t0) / dur); rng.value = from + (1000 - from) * k; setT(+rng.value); if(k < 1) raf = requestAnimationFrame(step); else tink([784, 1047]); };
raf = requestAnimationFrame(step);
});
}
});
const K3_COL = { wood: '#b07a3f', deskTop: '#d9b27a', deskSide: '#8f6a3c', metal: '#7d8794', chair: '#3d6fb5' };
function k3bx(x, y, z, w, h, d, c, o = {}){
const f = o.f || ((w <= 2 && d <= 2) ? ['fr', 'bk', 'lf', 'rt'] : ['fr', 'bk', 'lf', 'rt', 'tp']);
return `<div class="bx ${o.cls || ''}" ${o.id ? `id="${o.id}"` : ''} ${o.at || ''} style="--x:${x}px;--y:${y}px;--z:${z}px;--w:${w}px;--h:${h}px;--d:${d}px;--c:${c};${o.st || ''}">${f.map(k => `<i class="p ${k}"${o.fc && o.fc[k] ? ` style="background:${o.fc[k]}"` : ''}>${(o.in && o.in[k]) || ''}</i>`).join('')}</div>`;
}
const k3grp = (x, y, z, ry, inner, o = {}) => `<div class="bx grp ${o.cls || ''}" ${o.id ? `id="${o.id}"` : ''} ${o.at || ''} style="--x:${x}px;--y:${y}px;--z:${z}px;--ry:${ry}deg;${o.st || ''}">${o.wrap ? `<div class="rot hopr">${inner}</div>` : inner}</div>`;
const k3rot = (x, y, z, inner, o = {}) => `<div class="bx pv ${o.cls || ''}" ${o.id ? `id="${o.id}"` : ''} style="--x:${x}px;--y:${y}px;--z:${z}px"><div class="rot" style="${o.st || ''}">${inner}</div></div>`;
const k3face = o => `<em class="ey l" style="--e:${o.eye || '#1d1a1a'}"></em><em class="ey r" style="--e:${o.eye || '#1d1a1a'}"></em><em class="br l" style="--b:${o.brow || o.hair}"></em><em class="br r" style="--b:${o.brow || o.hair}"></em><em class="mo ${o.mouth || ''}"></em><em class="ck l"></em><em class="ck r"></em>${o.glasses ? '<em class="gl"></em>' : ''}${o.fr ? '<em class="fk"></em>' : ''}${o.stub ? '<em class="stb"></em>' : ''}`;
function k3head(o, ry = 0, id = ''){
const s = o.skin, h = o.hair;
return k3rot(0, -30, 0, `<div class="bx pv" style="--x:0px;--y:0px;--z:0px"><div class="rot ${id ? 'look' : ''}" ${id ? `id="${id}"` : ''} style="transform:rotateY(${ry}deg)">
${k3bx(0, -6, 0, 11, 11, 11, s, { fc: { tp: h }, in: { fr: k3face(o), rt: '<em class="ear"></em>', lf: '<em class="ear"></em>' } })}
${k3bx(0, -12.5, 0, 11.8, 2.6, 11.8, h)}${k3bx(0, -7.2, -4.7, 11.8, 9.2, 2.4, h)}
${k3bx(5.8, -9.4, .4, 1.4, 6, 8.6, h)}${k3bx(-5.8, -9.4, .4, 1.4, 6, 8.6, h)}${k3bx(0, -11.2, 5.1, 11.8, 2.2, 1.8, h)}
${o.cap ? k3bx(0, -13.7, 0, 12.4, 2, 12.4, o.cap) + k3bx(0, -12.6, 7.6, 12.4, .8, 4.6, o.cap) : ''}
${o.hood ? k3bx(0, -1, -5, 12, 3, 4, o.hood) : ''}
</div></div>`);
}
function makeCam3D(view, world, P, o = {}){
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cam = { ...P[o.start || 'over'] }, tgt = { ...cam };
let drag = null, moved = 0, vis = true, dirty = true, lt = 0, slow = 0, idle = 0;
const api = { cam, tgt, get moved(){ return moved; }, dirty(){ dirty = true; }, lite: false };
const apply = () => {
world.style.transform = `translate3d(0,${cam.sc > 2 ? 0 : (o.dy ?? 34)}px,0) scale(${cam.sc.toFixed(3)}) rotateX(${cam.pit.toFixed(2)}deg) rotateY(${cam.yaw.toFixed(2)}deg) translate3d(${(-cam.fx).toFixed(1)}px,${(-cam.fy).toFixed(1)}px,${(-cam.fz).toFixed(1)}px)`;
world.style.setProperty('--bY', (-cam.yaw).toFixed(2) + 'deg'); world.style.setProperty('--bX', (-cam.pit).toFixed(2) + 'deg');
if(o.onApply) o.onApply(cam);
};
const loop = now => {
if(!view.isConnected) return; requestAnimationFrame(loop);
if(!vis || document.hidden){ lt = now; return; }
const dt = Math.min(100, now - (lt || now)); lt = now; const ez = 1 - Math.exp(-dt / 170);
if(dt > 42){ if(++slow > 12 && !api.lite){ api.lite = true; if(o.onLite) o.onLite(); } } else if(slow > 0) slow -= .25;
let moving = false;
for(const k of ['yaw', 'pit', 'sc', 'fx', 'fy', 'fz']){ const d = tgt[k] - cam[k]; if(Math.abs(d) > (k === 'sc' ? .0015 : .02)){ cam[k] += d * ez; moving = true; } else if(d){ cam[k] = tgt[k]; moving = true; } }
if(o.auto && !drag && now - idle > 3000 && !tgt.lock){ tgt.yaw += dt * .006; moving = true; cam.yaw = tgt.yaw; }
if(moving || dirty){ apply(); dirty = false; }
};
if('IntersectionObserver' in window) new IntersectionObserver(es => { vis = es.some(e => e.isIntersecting); if(o.onVis) o.onVis(vis); }, { threshold: .02 }).observe(view);
document.addEventListener('visibilitychange', () => { if(o.onVis) o.onVis(vis && !document.hidden); });
requestAnimationFrame(loop);
view.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = 0; idle = performance.now(); try{ view.setPointerCapture(e.pointerId); }catch(_){} if(o.onDrag) o.onDrag(); });
view.addEventListener('pointermove', e => { if(!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; moved += Math.abs(dx) + Math.abs(dy); tgt.yaw += dx * .45; tgt.pit = clamp(tgt.pit + dy * .3, o.pitMin ?? -84, o.pitMax ?? -6); idle = performance.now(); });
const up = () => { drag = null; idle = performance.now(); }; view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
view.style.touchAction = 'none';
api.go = k => { Object.assign(tgt, P[k]); tgt.yaw = P[k].yaw + Math.round((cam.yaw - P[k].yaw) / 360) * 360; idle = performance.now(); };
return api;
}
const EASE = { out: t => 1 - Math.pow(1 - t, 3), inout: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, back: t => { const c = 1.70158, d = c + 1; return 1 + d * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }, in: t => t * t };
function tween3D(el, to, ms, ease = 'out', done){
const from = {}; Object.keys(to).forEach(k => { const v = parseFloat(el.style.getPropertyValue(k)); from[k] = isNaN(v) ? 0 : v; });
const units = { '--ry': 'deg', '--rx': 'deg', '--rz': 'deg' }, t0 = performance.now(), f = EASE[ease] || EASE.out;
const step = now => { if(!el.isConnected) return; const k = Math.min(1, (now - t0) / ms), e = f(k);
Object.keys(to).forEach(p => el.style.setProperty(p, (from[p] + (to[p] - from[p]) * e).toFixed(2) + (units[p] || 'px')));
if(k < 1) requestAnimationFrame(step); else if(done) done(); };
requestAnimationFrame(step);
}
function makeCull3D(world){
const items = [];
world.querySelectorAll('.bx > .p').forEach(p => {
const k = ['fr', 'bk', 'lf', 'rt'].find(c => p.classList.contains(c)); if(!k) return;
const box = p.parentElement; if(box.closest('.rot')) return;
let g = 0; for(let e = box; e && e !== world; e = e.parentElement){ if(e.classList && e.classList.contains('grp')){ const v = parseFloat(e.style.getPropertyValue('--ry')); if(!isNaN(v)) g += v; } }
const r = g * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), l = { fr: [0, 1], bk: [0, -1], lf: [-1, 0], rt: [1, 0] }[k];
items.push({ p, nx: l[0] * c + l[1] * s, nz: -l[0] * s + l[1] * c, v: true });
});
let last = 1e9;
return { n: items.length, update(yaw, force){
if(!force && Math.abs(yaw - last) < 2) return; last = yaw;
const a = yaw * Math.PI / 180, dx = -Math.sin(a), dz = Math.cos(a);
for(const it of items){ const v = it.nx * dx + it.nz * dz > -.22; if(v !== it.v){ it.v = v; it.p.style.display = v ? '' : 'none'; } }
} };
}
function k3seated(o, id = '', headId = ''){
const sh = o.shirt, pa = o.pants || '#334a7a';
const leg = sx => k3bx(sx * 3.6, -17, 6, 4.4, 4.4, 12, pa) + k3bx(sx * 3.6, -6.5, 12, 4, 13, 4, pa) + k3bx(sx * 3.6, -1.3, 13.5, 4.4, 2.6, 7, o.shoe || '#f1f1f1', { fc: { tp: '#ddd' } });
const arm = sx => k3bx(sx * 8.6, -27.2, 0, 4.4, 8.6, 4.4, sh) + k3bx(sx * 8.6, -26, 7, 4.2, 4.2, 11, sh) + k3bx(sx * 8.6, -26, 13.2, 3.4, 3.4, 2.6, o.skin);
return k3grp(0, 0, 0, 0, `
${leg(1)}${leg(-1)}
${k3bx(0, -22.5, 0, 13, 15, 7, sh, { in: o.logo ? { fr: o.logo } : {} })}
${o.pack ? k3bx(0, -24, -6, 11, 13, 5, o.pack) + k3bx(4.6, -20, -3.2, 1.6, 12, 1, '#222') + k3bx(-4.6, -20, -3.2, 1.6, 12, 1, '#222') : ''}
${o.hood ? k3bx(0, -30.4, -3.2, 12, 4, 4, sh) : ''}
${arm(1)}${arm(-1)}
${k3head(o, o.look || 0, headId)}`, { id, st: '' });
}
function k3desk(){
return `${k3bx(0, -25, 21, 34, 2, 20, K3_COL.deskTop, { fc: { tp: 'linear-gradient(135deg,#e2bd88,#c99a5d)' } })}
${k3bx(15.5, -12, 21, 2, 24, 18, K3_COL.deskSide)}${k3bx(-15.5, -12, 21, 2, 24, 18, K3_COL.deskSide)}
${k3bx(0, -8, 22, 29, 1.6, 15, '#a97d45')}
${k3bx(0, -17.5, 14.5, 2, 2, 2, K3_COL.metal)}`;
}
function k3chair(){
return `${k3bx(0, -15.5, -.5, 15, 2, 14, K3_COL.chair)}${k3bx(0, -24, -8, 15, 12, 2, K3_COL.chair)}
${k3bx(-6.2, -7.5, -5, 1.4, 15, 1.4, K3_COL.metal)}${k3bx(6.2, -7.5, -5, 1.4, 15, 1.4, K3_COL.metal)}${k3bx(-6.2, -7.5, 4, 1.4, 15, 1.4, K3_COL.metal)}${k3bx(6.2, -7.5, 4, 1.4, 15, 1.4, K3_COL.metal)}`;
}
function k3set(sx, sz, inner = '', o = {}){ return k3grp(sx, 0, sz, -90, `${k3chair()}${k3desk()}${inner}`, o); }
function k3teacher(){
const o = { skin: '#efc6a0', hair: '#bfc2c8', glasses: 1, brow: '#8c8f96', mouth: 'o' };
const arm = (sx, up) => up ? k3rot(sx * 9.4, -44, 0, `<div class="rot tw" style="transform:rotateX(78deg)">${k3bx(0, 8.8, 0, 4.4, 17.6, 4.4, '#565d70')}${k3bx(0, 18.6, 0, 3.4, 3, 3.4, o.skin)}${k3bx(0, 21, .6, 1.4, 3.4, 1.4, '#fff')}</div>`) : k3bx(sx * 9.4, -35.5, 0, 4.4, 18, 4.4, '#565d70') + k3bx(sx * 9.4, -25.4, 0, 3.4, 3, 3.4, o.skin);
return k3grp(-109, 0, -38, -90, `
${k3bx(3.2, -13, 0, 5, 26, 5, '#3c4050')}${k3bx(-3.2, -13, 0, 5, 26, 5, '#3c4050')}${k3bx(3.2, -1.4, 1.8, 5, 2.8, 8.6, '#1d1d22')}${k3bx(-3.2, -1.4, 1.8, 5, 2.8, 8.6, '#1d1d22')}
${k3bx(0, -36.5, 0, 14, 21, 8, '#565d70', { in: { fr: '<em class="tie"></em>' } })}
${arm(1, true)}${arm(-1, false)}
${k3head(o, 0).replace('--y:-30px', '--y:-47px')}`, { id: 'k3Teach', at: 'data-hit="teacher"', wrap: 1 });
}
function k3bin2(){
const c = '#5f6f7d';
return `<div class="bx grp" id="k3Bin" style="--x:-112px;--y:0px;--z:-84px;--ry:0deg">
${k3bx(0, -.6, 0, 14, 1.2, 14, '#3c4955')}
${k3bx(0, -6.6, 7, 14, 12, 1, c, { fc: { fr: 'repeating-linear-gradient(90deg,#69798a 0 2px,#566574 2px 3px)' } })}${k3bx(0, -6.6, -7, 14, 12, 1, c, { fc: { fr: 'repeating-linear-gradient(90deg,#69798a 0 2px,#566574 2px 3px)' } })}
${k3bx(7, -6.6, 0, 1, 12, 14, c)}${k3bx(-7, -6.6, 0, 1, 12, 14, c)}
${k3bx(0, -12.4, 7, 15, 1.2, 1.4, '#9aa8b5')}${k3bx(0, -12.4, -7, 15, 1.2, 1.4, '#9aa8b5')}${k3bx(7, -12.4, 0, 1.4, 1.2, 14.6, '#9aa8b5')}${k3bx(-7, -12.4, 0, 1.4, 1.2, 14.6, '#9aa8b5')}
${k3bx(-2, -2.4, 1, 4, 2.6, 3, '#fffdf2')}${k3bx(2.4, -2, -2, 3, 2, 3, '#fffdf2')}
</div>`;
}
function k3scene(){
const floor = `<div class="k3-pl k3-floor" style="width:260px;height:200px;left:-130px;top:-100px;transform:rotateX(90deg)">
<i class="rug"></i>
${[[-62, 0], [-8, 0], [46, 0], [-62, -56], [-62, 56], [-8, -56], [-8, 56], [46, -56], [46, 56]].map(([x, z]) => `<i class="shd" style="left:${x - 32 + 130}px;top:${z - 18 + 100}px"></i>`).join('')}
<i class="beam a"></i><i class="beam b"></i><i class="beam c"></i><i class="beam d"></i></div>`;
const win = (u, i) => `<div class="k3-win" data-s="a" style="left:${u}px;top:12px"><i class="sky"></i><i class="sn"></i><i class="hill"></i><i class="bar v"></i><i class="bar h"></i><i class="shine"></i></div>`;
const back = `<div class="k3-pl k3-wall" style="width:260px;height:90px;left:-130px;top:-90px;transform:translateZ(-100px)">
${win(26)}${win(158)}
<div class="k3-clock" data-hit="clock"><i class="rim"></i><i class="fc"></i><b class="h" id="k3H"></b><b class="m" id="k3M"></b><b class="s" id="k3S"></b><u></u></div>
<div class="k3-sched"><b>РАСПИСАНИЕ</b><span>Пн–Сб · 1-я пара</span><span>Литнарович К. ✓ ✓ ✓</span></div>
</div>`;
const left = `<div class="k3-pl k3-wall l" style="width:200px;height:90px;left:-100px;top:-90px;transform:translateX(-130px) rotateY(90deg)">
<div class="k3-board" data-hit="board"><i class="fr"></i><div class="ch"><b>ПАРА № <u id="k3No">1</u></b><span>Присутствует: Литнарович ✓</span><span class="ab" id="k3Ab">Остальные — уточняются</span><div class="tl" id="k3Tl"></div></div></div>
<div class="k3-poster"><i></i><b>ТИШИНА</b><span>идёт лекция</span></div>
</div>`;
const right = `<div class="k3-pl k3-wall r" style="width:200px;height:90px;left:-100px;top:-90px;transform:translateX(130px) rotateY(-90deg)">
<div class="k3-door"><i class="gl"></i><i class="hd"></i></div>
<div class="k3-cork"><span style="--r:-4deg;left:6px;top:7px;background:#ffe27a">лекции</span><span style="--r:3deg;left:30px;top:5px;background:#9fe0ff">зачёт</span><span style="--r:-2deg;left:8px;top:25px;background:#ffb3c7">пары!</span><span style="--r:5deg;left:34px;top:24px;background:#c8f2a2">явка 100%</span></div>
</div>`;
const trims = k3bx(0, -91.5, -100, 262, 3, 5, '#e9dfc7') + k3bx(-130, -91.5, 0, 5, 3, 202, '#e9dfc7') + k3bx(130, -91.5, 0, 5, 3, 202, '#e9dfc7');
const winProps = [-39, 39].map(x => k3bx(x, -37.5, -94.5, 52, 2.4, 10, '#f4efe2') + k3bx(x, -13, -97, 40, 24, 4, '#e6e3da', { fc: { fr: 'repeating-linear-gradient(90deg,#f3f1ea 0 3px,#a9a69b 3px 4px)' } })
+ k3bx(x - 12, -43.4, -93, 7, 5.6, 7, '#b0552e') + `<div class="bx plant" style="--x:${x - 12}px;--y:-43.4px;--z:-93px"><i class="lf a"></i><i class="lf b"></i><i class="lf c"></i></div>`).join('');
const tray = k3bx(-127, -26.5, 0, 6, 2.4, 160, '#8a5a2d') + k3bx(-126, -28.5, 40, 3, 1.4, 6, '#fff') + k3bx(-126, -28.5, 10, 3, 2, 8, '#2a2a2a');
const note = (x = 0, ry = 0) => k3bx(x, -26.3, 21.5, 11, .5, 14, '#fffdf2', { fc: { tp: 'repeating-linear-gradient(180deg,#fffdf2 0 1.6px,#bcd5ee 1.6px 2.2px)' }, st: `transform:translate3d(var(--x),var(--y),var(--z)) rotateY(${ry}deg)` }) + k3bx(x + 5.4, -26.7, 22, .4, .4, 5, '#2457d6');
const kir = k3grp(-62, 0, 0, -90, `${k3chair()}${k3desk()}${note()}
${k3bx(10, -26.6, 17, 3.4, 3.8, 3.4, '#f4efe2', { cls: 'cup', at: 'data-hit="cup"' })}
<div class="bx bbk steam" style="--x:10px;--y:-33px;--z:17px"><i></i><i></i><i></i></div>
${k3seated({ skin: '#efc19b', hair: '#4a2e1a', shirt: '#3f7d4a', pants: '#2b3d6b', hood: '#3f7d4a', pack: '#243a63', mouth: 'smile', eye: '#1b1b1b', logo: '<em class="logo"></em>' }, '', 'k3Look')}`, { at: 'data-hit="kirill"', id: 'k3Kir', wrap: 1 });
const slp = k3grp(-8, 0, 56, -90, `${k3chair()}${k3desk()}
${k3bx(0, -18, 0, 13, 15, 7, '#d9792b')}${k3bx(0, -21.5, 17, 13, 3.8, 11, '#d9792b')}${k3bx(0, -27, 19, 12, 5.6, 10, '#efc19b', { fc: { tp: '#3a2a22' } })}
${k3bx(3.6, -17, 6, 4.4, 4.4, 12, '#444')}${k3bx(-3.6, -17, 6, 4.4, 4.4, 12, '#444')}${k3bx(3.6, -6.5, 12, 4, 13, 4, '#444')}${k3bx(-3.6, -6.5, 12, 4, 13, 4, '#444')}
<div class="bx bbk zzz" style="--x:0px;--y:-38px;--z:20px"><b>Z</b><b>z</b><b>z</b></div>`, {});
const phn = k3grp(-8, 0, -56, -90, `${k3chair()}${k3desk()}${k3seated({ skin: '#d4a07a', hair: '#1c1a1f', shirt: '#b13a52', pants: '#3b3b44', mouth: 'o', cap: '#222' })}
${k3bx(0, -26.6, 20, 5, .8, 9, '#111', { fc: { tp: 'linear-gradient(135deg,#5ab0ff,#6b3cff)' } })}`, {});
const vis = [[46, 0, '#e6b84a', '#6b4a2a', '#8c5a3a'], [46, -56, '#6fb0a0', '#2f2f3a', '#d8b08a'], [-62, 56, '#9b6ad6', '#383848', '#2a1a12']].map(([x, z, sh, hr, sk], i) => k3grp(x, 0, z, -90, `${k3chair()}${k3desk()}<div class="vis" data-v="${i}">${k3seated({ skin: sk, hair: hr, shirt: sh, mouth: 'smile', pack: '#555' })}${k3bx(0, -26.3, 21.5, 11, .5, 14, '#fffdf2')}</div>`, { cls: 'visw' })).join('');
const bags = [[-62, -56, '#cc4b37'], [-8, 0, '#2d8a68'], [46, 56, '#6b4aa8']].map(([x, z, c]) => k3grp(x, 0, z, -90, `${k3chair()}${k3desk()}${k3bx(0, -29, 21, 12, 8, 6, c)}${k3bx(0, -33.4, 21, 8, 1, 3, '#222')}`, {})).join('');
const tdesk = k3grp(-108, 0, 66, -90, `${k3bx(0, -25, 0, 30, 2, 18, '#7a5430')}${k3bx(13, -12, 0, 2, 24, 16, '#5a3c1e')}${k3bx(-13, -12, 0, 2, 24, 16, '#5a3c1e')}
${k3bx(0, -29.4, 1, 13, .8, 9, '#c9d0d8')}${k3bx(0, -33.4, -3.4, 13, 8, .8, '#222', { fc: { fr: 'linear-gradient(135deg,#3a7bd5,#3fd1b0)' } })}${k3bx(9, -27.8, 4, 3, 3, 3, '#ffd24a')}${k3bx(-9, -26.6, -2, 8, .8, 11, '#fff')}`, {});
const bin = k3bx(114, -6, 80, 9, 12, 9, '#4a5a66') + k3bx(114, -12.4, 80, 8, 1, 8, '#222');
return `<div class="k3-world" id="k3World">${floor}${back}${left}${right}${trims}${winProps}${tray}${tdesk}${bin}${bags}${vis}${slp}${phn}${kir}${k3teacher()}
<div class="bx bb k3-tag" style="--x:-62px;--y:-58px;--z:0px"><div class="tin"><b>ЛИТНАРОВИЧ</b><small>1342 пары · 0 прогулов</small></div></div>
<div class="bx bb k3-say" id="k3Say" style="--x:-62px;--y:-66px;--z:0px"><div class="tin"><span id="k3SayT"></span></div></div>
<div class="bx bb k3-say t2" id="k3Say2" style="--x:-109px;--y:-70px;--z:-38px"><div class="tin"><span id="k3SayT2"></span></div></div>
${k3bin2()}
<div class="bx bb k3-tag k3-goal" style="--x:-112px;--y:-17px;--z:-84px"><div class="tin"><b>ЦЕЛЬ</b></div></div>
<div class="bx k3-ball" id="k3Ball" style="--x:-66px;--y:-30px;--z:-4px;--w:3.4px;--h:3.4px;--d:3.4px;--c:#fffdf2">${['fr', 'bk', 'lf', 'rt', 'tp'].map(k => `<i class="p ${k}"></i>`).join('')}</div></div>`;
}
const K3_HTML = () => `
<div class="k3" id="k3">
<div class="k3-hud"><span id="k3Yr">1 курс · осень</span><b id="k3Pn">пара №1342</b></div>
<div class="k3-view" id="k3View"><div class="k3-cam">${k3scene()}</div><div class="k3-tint" id="k3Tint"></div></div>
<div class="k3-ctl">
<button type="button" class="k3-b on" data-v="over">Обзор</button><button type="button" class="k3-b" data-v="top">Сверху</button><button type="button" class="k3-b" data-v="kir">Кирилл</button><button type="button" class="k3-b hot" id="k3Run">⏩ 4 года</button><button type="button" class="k3-b game" id="k3Play">🎯 Игра</button>
</div>
<div class="k3-game" id="k3Game" hidden>
<div class="g-top"><span class="g-t" id="gTeach">Преподаватель пишет на доске</span><span class="g-s">Счёт <b id="gScore">0</b></span><span class="g-s">Время <b id="gTime">45</b></span><span class="g-s">Замечания <b id="gStr">○○○</b></span></div>
<div class="g-meter" id="gMeter"><i class="zone" id="gZone"></i><i class="mk" id="gMk"></i></div>
<div class="g-row"><button type="button" class="g-go" id="gGo">Старт</button><span class="g-best">Рекорд: <b id="gBest">0</b></span></div>
<p class="g-help">Брось бумажку в урну у доски. Жми «Бросок», когда ползунок в зелёной зоне. Пока преподаватель смотрит на класс — не бросай!</p>
</div>
<p class="k3-hint">Тяни пальцем — комната вращается. Нажми на Кирилла, часы, доску, кружку.</p>
</div>`;
function k3after(root){
const view = $('#k3View', root), world = $('#k3World', root), look = $('#k3Look', root), say = $('#k3Say', root), sayT = $('#k3SayT', root), tint = $('#k3Tint', root), yr = $('#k3Yr', root), pn = $('#k3Pn', root), no = $('#k3No', root), tl = $('#k3Tl', root), ab = $('#k3Ab', root);
const live = () => root.isConnected;
const P = { over: { yaw: -24, pit: -31, sc: 1.1, fx: -6, fy: -24, fz: 0 }, top: { yaw: -8, pit: -82, sc: 1.12, fx: -4, fy: 0, fz: 0 }, kir: { yaw: -16, pit: -14, sc: 3.4, fx: -62, fy: -30, fz: 0 }, game: { yaw: -86, pit: -36, sc: 1.5, fx: -78, fy: -16, fz: -42 } };
let cam = { ...P.over }, tgt = { ...P.over }, drag = null, idle = 0, last = 0, vis = true, running = false, moved = 0, t0 = performance.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cull = makeCull3D(world);
const apply = () => {
cull.update(cam.yaw);
world.style.transform = `translate3d(0,${(cam.sc > 2 ? 0 : 34)}px,0) scale(${cam.sc.toFixed(3)}) rotateX(${cam.pit.toFixed(2)}deg) rotateY(${cam.yaw.toFixed(2)}deg) translate3d(${(-cam.fx).toFixed(1)}px,${(-cam.fy).toFixed(1)}px,${(-cam.fz).toFixed(1)}px)`;
world.style.setProperty('--bY', (-cam.yaw).toFixed(2) + 'deg'); world.style.setProperty('--bX', (-cam.pit).toFixed(2) + 'deg');
let phi = ((-cam.yaw + 90) % 360 + 540) % 360 - 180; phi = clamp(phi, -78, 78); if(look) look.style.transform = `rotateY(${phi.toFixed(1)}deg)`;
};
let lt = 0, dirty = true, slow = 0, fcount = 0;
const kroot = $('#k3', root);
const loop = now => {
if(!live()) return; requestAnimationFrame(loop);
if(!vis || document.hidden){ lt = now; return; }
const dt = Math.min(100, now - (lt || now)); lt = now;
if(dt > 42){ if(++slow > 12 && !kroot.classList.contains('lite')){ kroot.classList.add('lite'); } } else if(slow > 0) slow -= .25;
let moving = false; const ez = 1 - Math.exp(-dt / 170);
['yaw', 'pit', 'sc', 'fx', 'fy', 'fz'].forEach(k => { const d = tgt[k] - cam[k]; if(Math.abs(d) > (k === 'sc' ? .0015 : .02)){ cam[k] += d * ez; moving = true; } else if(d){ cam[k] = tgt[k]; moving = true; } });
if(moving || dirty){ apply(); dirty = false; }
};
if('IntersectionObserver' in window){ new IntersectionObserver(es => { vis = es.some(e => e.isIntersecting); kroot.classList.toggle('off', !vis); }, { threshold: .02 }).observe(view); }
document.addEventListener('visibilitychange', () => kroot.classList.toggle('off', document.hidden || !vis));
requestAnimationFrame(loop);
view.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = 0; idle = performance.now(); try{ view.setPointerCapture(e.pointerId); }catch(_){} });
view.addEventListener('pointermove', e => { if(!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; moved += Math.abs(dx) + Math.abs(dy); tgt.yaw += dx * .45; tgt.pit = clamp(tgt.pit + dy * .3, -84, -6); idle = performance.now(); $$('.k3-b', root).forEach(b => b.classList.remove('on')); });
const up = () => { drag = null; idle = performance.now(); }; view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
view.style.touchAction = 'none';
const go = k => { Object.assign(tgt, P[k]); tgt.yaw = P[k].yaw + Math.round((cam.yaw - P[k].yaw) / 360) * 360; $$('.k3-b[data-v]', root).forEach(b => b.classList.toggle('on', b.dataset.v === k)); idle = performance.now(); tink([523]); };
$$('.k3-b[data-v]', root).forEach(b => b.addEventListener('click', () => go(b.dataset.v)));
const H = $('#k3H', root), M = $('#k3M', root), S = $('#k3S', root); let sp = 0, simMin = null;
const clk = () => { const d = new Date(), s = d.getSeconds(), m = simMin != null ? simMin : d.getMinutes() + s / 60, h = simMin != null ? simMin / 12 : (d.getHours() % 12) * 60 / 12 + d.getMinutes() / 12; H.style.transform = `rotate(${(simMin != null ? simMin / 12 : (d.getHours() % 12 + d.getMinutes() / 60) * 30)}deg)`; M.style.transform = `rotate(${(simMin != null ? simMin * 6 : m * 6)}deg)`; S.style.transform = `rotate(${(simMin != null ? simMin * 36 : s * 6)}deg)`; };
clk(); const ci = setInterval(() => { if(!live()){ clearInterval(ci); return; } if(simMin == null) clk(); }, 1000);
const lines = ['Я здесь!', 'Пара №1342. Уже записываю.', 'Что задали? Да, я знаю, сам проверял.', 'Пропуск? Нет, не слышал о таком.', 'Тетрадь открыта. Всегда.', 'Преподаватель ещё не пришёл, а я уже тут.'];
let li = -1, st = 0;
const speak = (t, ms = 2600) => { sayT.textContent = t; say.classList.add('on'); clearTimeout(st); st = setTimeout(() => say.classList.remove('on'), ms); };
const hop = () => { const k = $('#k3Kir', root); k.classList.remove('hop'); void k.offsetWidth; k.classList.add('hop'); };
const tlMake = n => { const g = Math.floor(n / 5); tl.innerHTML = Array.from({ length: Math.min(g, 18) }, () => '<i class="g"></i>').join('') + (n % 5 ? `<i class="p p${n % 5}"></i>` : ''); };
tlMake(1337);
const abs = ['Остальные — уточняются', 'Отсутствуют: почти все', 'Отсутствуют: не найдены', 'Остальные — на связи (чат)', 'Остальные — в пути (с 2023)'];
view.addEventListener('click', e => {
if(moved > 8) return; const h = e.target.closest('[data-hit]'); if(!h) return; const k = h.dataset.hit;
if(k === 'kirill'){ li = (li + 1) % lines.length; speak(lines[li]); hop(); tink([660, 880]); try{ navigator.vibrate?.(10); }catch(_){} }
else if(k === 'teacher'){ speak('Литнарович, вы опять первый?', 2400); tink([330]); const t = $('#k3Teach', root); t.classList.remove('hop'); void t.offsetWidth; t.classList.add('hop'); setTimeout(() => speak('Так точно.', 1800), 1700); }
else if(k === 'board'){ ab.textContent = abs[(abs.indexOf(ab.textContent) + 1) % abs.length]; tink([440, 554]); fxNoise(.12, 2400, .2, 'highpass'); }
else if(k === 'cup'){ speak('Кофе без сахара. Как обычно.', 2200); tink([784]); const s = $('.steam', root); s.classList.add('big'); setTimeout(() => s.classList.remove('big'), 2000); }
else if(k === 'clock'){ run(); }
});
const seasons = [['a', '1 курс · осень', '#ffb36a'], ['w', '1 курс · зима', '#bcd4ff'], ['s', '2 курс · весна', '#bde8a8'], ['a', '2 курс · осень', '#ffb36a'], ['w', '3 курс · зима', '#bcd4ff'], ['s', '3 курс · весна', '#bde8a8'], ['a', '4 курс · осень', '#ffb36a'], ['y', '4 курс · лето', '#ffe27a']];
const wins = $$('.k3-win', root), vs = $$('.visw .vis', root), runBtn = $('#k3Run', root);
function run(){
if(running) return; running = true; runBtn.disabled = true; tint.classList.add('on'); speak('Четыре года за 14 секунд…', 2200); tink([392, 523, 659]); let i = 0; const start = performance.now(), total = 14000, N0 = 1, N1 = 1342;
let lastN = -1, lastT = 0; const tick = () => { if(!live()) return; const nowT = performance.now(); const k = Math.min(1, (nowT - start) / total); if(k < 1 && nowT - lastT < 66){ requestAnimationFrame(tick); return; } lastT = nowT; const n = Math.round(N0 + (N1 - N0) * k); if(n !== lastN){ lastN = n; pn.textContent = 'пара №' + n; no.textContent = n; if(Math.floor(n / 5) !== Math.floor((n - 1) / 5) || k >= 1) tlMake(n); } simMin = k * 720 * 6; clk();
const si = Math.min(7, Math.floor(k * 8)); if(si !== i || k === 0){ i = si; const [s, t, c] = seasons[si]; yr.textContent = t; wins.forEach(w => w.dataset.s = s); tint.style.background = c; vs.forEach((v, j) => v.classList.toggle('here', (si + j) % 3 !== 0)); if(si < 8) { fxNoise(.06, 1800, .12); } }
if(k < 1) requestAnimationFrame(tick); else { simMin = null; clk(); running = false; runBtn.disabled = false; tint.classList.remove('on'); vs.forEach(v => v.classList.remove('here')); wins.forEach(w => w.dataset.s = 'a'); yr.textContent = '4 курс · выпуск'; speak('1342 пары. Ни одной пропущенной.', 3200); tink([784, 1047, 1319]); hop(); }
};
requestAnimationFrame(tick);
}
runBtn.addEventListener('click', run);
{ const gp = $('#k3Play', root), gbox = $('#k3Game', root), gGo = $('#gGo', root), gT = $('#gTeach', root), gSc = $('#gScore', root), gTi = $('#gTime', root), gSt = $('#gStr', root), gMeter = $('#gMeter', root), gZone = $('#gZone', root), gMk = $('#gMk', root), gBest = $('#gBest', root), ball = $('#k3Ball', root), say2 = $('#k3Say2', root), sayT2 = $('#k3SayT2', root), teach = $('#k3Teach', root), bin = $('#k3Bin', root);
let on = false, score = 0, strikes = 0, left = 45, ph = 0, zone = .55, zw = .2, watch = false, warn = false, nextTurn = 0, turnEnd = 0, flying = false, raf = 0, tStart = 0, best = 0, st2 = 0;
try{ best = +localStorage.getItem('k3_best') || 0; }catch(_){} gBest.textContent = best;
const say2f = (t, ms = 1600) => { sayT2.textContent = t; say2.classList.add('on'); clearTimeout(st2); st2 = setTimeout(() => say2.classList.remove('on'), ms); };
const setWatch = v => { watch = v; teach.classList.toggle('look', v); gT.textContent = v ? 'СМОТРИТ НА КЛАСС! Не бросай' : 'Преподаватель пишет на доске'; gT.classList.toggle('bad', v); gT.classList.remove('warn'); };
const newZone = () => { zone = .32 + Math.random() * .48; zw = Math.max(.1, .22 - score * .006); gZone.style.left = ((zone - zw / 2) * 100).toFixed(1) + '%'; gZone.style.width = (zw * 100).toFixed(1) + '%'; };
const hud = () => { gSc.textContent = score; gTi.textContent = Math.max(0, Math.ceil(left)); gSt.textContent = '●'.repeat(strikes) + '○'.repeat(3 - strikes); };
const S0 = [-68, -31, -4], T0 = [-112, -13, -84];
function throwBall(p){
flying = true; const err = p - zone; const a = Math.abs(err); const caught = watch || warn && performance.now() > turnEnd - 400;
let L = [...T0], res = 'swish';
if(a < zw * .5) res = 'swish'; else if(a < zw * .9) res = 'rim'; else res = 'miss';
const dx = T0[0] - S0[0], dz = T0[2] - S0[2], dl = Math.hypot(dx, dz), ux = dx / dl, uz = dz / dl;
if(res === 'rim'){ L = [T0[0] + (Math.random() - .5) * 8, -13, T0[2] + (Math.random() - .5) * 8]; }
if(res === 'miss'){ const o = err * 150; L = [Math.max(-124, Math.min(120, T0[0] + ux * o + -uz * (Math.random() - .5) * 18)), -1.5, Math.max(-96, Math.min(96, T0[2] + uz * o + ux * (Math.random() - .5) * 18))]; }
ball.style.display = 'block'; const dur = 760, t0 = performance.now(), arc = 34 + dl * .12; tink([880]); fxNoise(.08, 1500, .12, 'highpass');
const step = now => { if(!live()) return; const k = Math.min(1, (now - t0) / dur); const x = S0[0] + (L[0] - S0[0]) * k, z = S0[2] + (L[2] - S0[2]) * k, y = S0[1] + (L[1] - S0[1]) * k - Math.sin(Math.PI * k) * arc;
ball.style.setProperty('--x', x.toFixed(1) + 'px'); ball.style.setProperty('--y', y.toFixed(1) + 'px'); ball.style.setProperty('--z', z.toFixed(1) + 'px'); ball.style.transform = `translate3d(${x}px,${y}px,${z}px) rotateX(${k * 720}deg) rotateY(${k * 540}deg)`;
if(k < 1){ requestAnimationFrame(step); return; }
flying = false;
if(caught){ strikes++; say2f('Литнарович! Это что такое?', 1900); tink([196, 147]); try{ navigator.vibrate?.([30, 40, 30]); }catch(_){} speak('Я просто… пишу конспект.', 1800); }
else if(res === 'swish'){ score += 3; tink([784, 1047, 1319]); speak('ТРИ ОЧКА!', 1100); bin.classList.remove('hit'); void bin.offsetWidth; bin.classList.add('hit'); hop(); }
else if(res === 'rim'){ score += 1; tink([659, 784]); speak('Чудом, но попал', 1100); bin.classList.remove('hit'); void bin.offsetWidth; bin.classList.add('hit'); }
else { tink([196]); speak(err > 0 ? 'Перелёт…' : 'Недолёт…', 900); setTimeout(() => { if(!flying) ball.style.display = 'none'; }, 700); }
if(res !== 'miss' || caught) setTimeout(() => { if(!flying) ball.style.display = 'none'; }, 260);
hud(); newZone(); if(strikes >= 3) end('Замечания закончились');
};
requestAnimationFrame(step);
}
function loopG(now){
if(!on || !live()) return; raf = requestAnimationFrame(loopG);
left = 45 - (now - tStart) / 1000; ph = .5 + .5 * Math.sin((now - tStart) / (520 - Math.min(220, score * 14))); gMk.style.left = (ph * 100).toFixed(1) + '%';
if(now > nextTurn && !watch && !warn){ warn = true; turnEnd = now + 700; gT.textContent = 'Преподаватель оборачивается…'; gT.classList.add('warn'); say2f('Так…', 700); }
if(warn && now > turnEnd){ warn = false; setWatch(true); const d = 1300 + Math.random() * 1200; turnEnd = now + d; }
if(watch && now > turnEnd){ setWatch(false); nextTurn = now + 2200 + Math.random() * 3200; }
if((Math.floor(now / 250) & 1) === 0) hud();
if(left <= 0) end('Время вышло');
}
function end(why){
on = false; cancelAnimationFrame(raf); setWatch(false); say2.classList.remove('on'); gGo.textContent = 'Ещё раз'; gGo.dataset.m = 'start'; gT.textContent = why + ' · ' + score + ' очк.'; gT.classList.remove('bad', 'warn');
if(score > best){ best = score; try{ localStorage.setItem('k3_best', String(best)); }catch(_){} gBest.textContent = best; speak('Новый рекорд: ' + best + '!', 2600); tink([523, 659, 784, 1047]); } else speak('Итого: ' + score, 2000);
}
function start(){ score = 0; strikes = 0; left = 45; on = true; flying = false; ball.style.display = 'none'; newZone(); hud(); tStart = performance.now(); nextTurn = tStart + 2600; warn = false; setWatch(false); gGo.textContent = 'БРОСОК'; gGo.dataset.m = 'throw'; tink([392, 523]); cancelAnimationFrame(raf); raf = requestAnimationFrame(loopG); }
gGo.addEventListener('pointerdown', e => { e.preventDefault(); if(gGo.dataset.m === 'throw'){ if(on && !flying) throwBall(ph); } else start(); });
gGo.dataset.m = 'start';
gp.addEventListener('click', () => { const open = gbox.hidden; gbox.hidden = !open; gp.classList.toggle('on', open); $('#k3', root).classList.toggle('gaming', open); if(open){ go('game'); $$('.k3-b[data-v]', root).forEach(b => b.classList.remove('on')); speak('Попробую-ка…', 1400); } else { if(on) end('Игра остановлена'); go('over'); } });
zone = .55; newZone();
}
go('over');
setTimeout(() => speak('Привет! Я Кирилл.', 2400), 800);
}
{ const kk = HOD['Кирилл'], oi = kk.info, oa = kk.after;
kk.info = () => `<div class="kx"><section class="kx-sec"><div class="kx-lbl"><b>3D</b>Аудитория за четыре года</div>${K3_HTML()}</section></div>` + oi();
kk.after = root => { k3after(root); oa(root); }; }
function ohGear(cx, cy, r, n, tw = .22, hole = .34){
let d = ''; const R2 = r, R1 = r * (1 - tw * .55);
for(let i = 0; i < n; i++){
const a = i / n * Math.PI * 2, b = (i + .5) / n * Math.PI * 2, step = Math.PI * 2 / n;
[[a, R1], [a + step * .12, R2], [a + step * .38, R2], [a + step * .5, R1]].forEach(([t, rr], k) => { d += (i + k ? 'L' : 'M') + (cx + Math.cos(t) * rr).toFixed(1) + ' ' + (cy + Math.sin(t) * rr).toFixed(1); });
}
d += 'Z';
const spokes = [0, 1, 2, 3, 4].map(k => { const t = k / 5 * Math.PI * 2; return `<path d="M${(cx + Math.cos(t) * r * hole).toFixed(1)} ${(cy + Math.sin(t) * r * hole).toFixed(1)}L${(cx + Math.cos(t) * r * .78).toFixed(1)} ${(cy + Math.sin(t) * r * .78).toFixed(1)}" stroke="#9a7a2a" stroke-width="${(r * .09).toFixed(1)}" stroke-linecap="round"/>`; }).join('');
return `<path d="${d}" fill="url(#ohG)" stroke="#6a4f12" stroke-width=".8"/><circle cx="${cx}" cy="${cy}" r="${(r * .78).toFixed(1)}" fill="none" stroke="#6a4f12" stroke-width=".6" opacity=".7"/>${spokes}<circle cx="${cx}" cy="${cy}" r="${(r * .2).toFixed(1)}" fill="#c9a24a" stroke="#6a4f12" stroke-width=".8"/><circle cx="${cx}" cy="${cy}" r="${(r * .09).toFixed(1)}" fill="#c0262e"/>`;
}
const OH = {
'Галкин': {
html: () => `
<div class="oh-sec"><div class="oh-lbl">Окно у третьего ряда · протри стекло</div>
<div class="oh-win" id="ohWin"><div class="oh-night"><i class="m"></i>${Array.from({ length: 16 }, (_, i) => `<b style="left:${(i * 37) % 96}%;top:${50 + (i * 23) % 40}%;--c:${['#ffd27a', '#ffb347', '#9fd8ff', '#fff3b0'][i % 4]};--d:${(i % 5) * .5}s"></b>`).join('')}<span class="bld"></span><em>Галкин был здесь</em></div>
<canvas id="ohFog"></canvas><div class="oh-drops">${Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 29 + 7) % 96}%;--d:${(i % 7) * .6}s;--t:${3 + (i % 4)}s"></i>`).join('')}</div><div class="oh-frame"></div></div>
<p class="oh-hint" id="ohHint">Проведи пальцем по стеклу — оно запотело.</p></div>`,
after: root => {
const cv = $('#ohFog', root), box = $('#ohWin', root), hint = $('#ohHint', root); const W = box.clientWidth || 340, H = box.clientHeight || 190, dpr = Math.min(2, window.devicePixelRatio || 1);
cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
const fog = a => { g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgba(205,220,235,${a})`; g.fillRect(0, 0, W, H); };
fog(.92); for(let i = 0; i < 60; i++){ g.fillStyle = 'rgba(255,255,255,.04)'; g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 8 + Math.random() * 18, 0, 7); g.fill(); }
let down = false, wiped = 0, lx = 0, ly = 0;
const wipe = (x, y) => { g.globalCompositeOperation = 'destination-out'; g.lineCap = 'round'; g.lineWidth = 26; g.beginPath(); g.moveTo(lx, ly); g.lineTo(x, y); g.stroke(); g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill(); lx = x; ly = y; wiped++; if(wiped === 14) hint.textContent = 'Видно! Он сидит у окна уже четвёртый год.'; if(wiped % 5 === 0) fxNoise(.03, 5000, .06, 'highpass'); };
const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
cv.style.touchAction = 'none';
cv.addEventListener('pointerdown', e => { down = true; [lx, ly] = pt(e); wipe(lx, ly); try{ cv.setPointerCapture(e.pointerId); }catch(_){} });
cv.addEventListener('pointermove', e => { if(!down) return; const [x, y] = pt(e); wipe(x, y); });
cv.addEventListener('pointerup', () => { down = false; }); cv.addEventListener('pointercancel', () => { down = false; });
const iv = setInterval(() => { if(!root.isConnected){ clearInterval(iv); return; } fog(.035); }, 420);
}
},
};
Object.entries(OH).forEach(([k, v]) => { const d = HOD[k]; if(!d) return; const oi = d.info, oa = d.after; d.info = () => oi() + v.html(); d.after = root => { oa?.(root); v.after(root); }; });
let hodActive = null, hodPane = 'history', hodVoting = false;
const hodEl = (() => {
const el = document.createElement('section');
el.className = 'hm'; el.id = 'hodModal'; el.setAttribute('aria-hidden', 'true');
el.innerHTML = '<div class="hm-dialog" role="dialog" aria-modal="true"><button type="button" class="hm-close" aria-label="Закрыть">×</button><div class="hm-scroll"></div><div class="hm-actions"></div></div>';
document.body.appendChild(el);
return el;
})();
const hodDialog = $('.hm-dialog', hodEl), hodScroll = $('.hm-scroll', hodEl), hodActions = $('.hm-actions', hodEl);
const HOD_SOON = {
key: 'soon', soon: true, kicker: 'Досье', tag: 'Досье готовится к печати', stats: [], infoTitle: '',
quote: ['', ''], videoTitle: 'Видео', videoNote: '', facts: [], ph: ['', '', ''], art: () => '<i class="hm-soon-seal"></i>', info: () => ''
};
function hodSoon(d, video){
return `<div class="hm-body"><div class="hm-soon">
<span class="hm-soon-ring"><i></i><i></i><i></i></span>
<b>СКОРО</b>
<p>${video ? 'Видеоролик об этом кандидате ещё монтируется.' : 'История этого кандидата ещё пишется.'}</p>
<small>Загляни чуть позже — здесь появится досье</small>
</div></div>`;
}
function hodData(nominee){
const name = (nominee.dataset.nominee || '').trim();
const full = $('.nominee-front h3', nominee)?.textContent.trim() || name;
const parts = full.split(/\s+/);
const row = (nominee.dataset.row || '').trim();
const soonText = ($('.nominee-description', nominee)?.textContent || '').trim();
const isSoon = (!soonText || /^скоро\.?$/i.test(soonText)) && !HOD[name + '|' + row];
const base = isSoon ? HOD_SOON : HOD[name + '|' + row] || HOD[name] || HOD[parts[0]] || {
key: 'kirill', kicker: 'Досье', tag: '', stats: [], infoTitle: '', quote: ['', ''], videoTitle: 'Видео', videoNote: '', facts: [], ph: ['🎬', 'Видео скоро', ''], art: () => '', info: () => ''
};
const src = $('.nominee-front img', nominee)?.getAttribute('src') || '';
const story = ($('.nominee-description', nominee)?.textContent || '').split(/\n+/).map(s => s.replace(/\*/g, '').trim()).filter(Boolean);
const ppl = / и /.test(full) ? full.split(/\s+и\s+/).map(x => { const p = x.trim().split(/\s+/); return { surname: p[0], first: p.slice(1).join(' ') }; }) : null;
return { ...base, full, surname: ppl ? ppl.map(p => p.surname).join(' и ') : (parts[0] || full), first: ppl ? ppl.map(p => p.first).join(' · ') : parts.slice(1).join(' '), people: ppl, src, story: story.length ? story : (base.story || []) };
}
function hodHero(d, compact){
const photo = d.src ? `<img class="hm-photo${d.people ? ' hm-duo-ph' : ''}" src="${esc(d.src)}" alt="${esc(d.full)}" draggable="false">`
: d.people ? `<div class="hm-duo">${d.people.map((p, k) => `<span class="hm-av a${k}">${hardHat(HAT_COL[(((+d.no || 1) - 1) * 2 + k) % 8])}<i>${esc((p.surname[0] || '') + (p.first[0] || ''))}</i></span>`).join('')}</div>`
: `<div class="hm-photo hm-mono">${esc(initialsOf(d.full))}</div>`;
const nameHtml = d.people ? `<small class="hm-first">${esc(d.first)}</small><h2 class="hm-name hm-name-duo">${d.people.map(p => `<span>${esc(p.surname)}</span>`).join('<em>&amp;</em>')}</h2>` : `<small class="hm-first">${esc(d.first)}</small><h2 class="hm-name">${esc(d.surname)}</h2>`;
return `<header class="hm-hero${compact ? ' compact' : ''}"><div class="hm-art">${d.art()}</div>
${photo}<div class="hm-hero-text"><span class="hm-kicker">${esc(d.kicker)} · ${compact ? 'видео' : 'история'}</span>
${nameHtml}${compact ? '' : `<p class="hm-tag">${esc(d.tag)}</p>`}</div></header>`;
}
function hodHistory(d){
if(d.soon) return hodHero(d) + hodSoon(d, false);
return `${hodHero(d)}<div class="hm-body">
<div class="hm-stats">${d.stats.map(([v, l, suf], i) => `<div class="hm-stat" style="--d:${i}">${typeof v === 'number' ? `<b data-to="${v}" data-suf="${esc(suf || '')}">0${esc(suf || '')}</b>` : `<b>${esc(v)}</b>`}<span>${esc(l)}</span></div>`).join('')}</div>
<section class="hm-block"><h3>${esc(d.infoTitle)}</h3>${d.info()}</section>
<section class="hm-block hm-story"><h3>Полная история</h3>${d.story.map(p => `<p>${esc(p)}</p>`).join('')}</section>
<blockquote class="hm-quote"><p>${esc(d.quote[0])}</p><cite>${esc(d.quote[1])}</cite></blockquote></div>`;
}
function hodVideo(d, src){
if(d.soon) return hodHero(d, true) + hodSoon(d, true);
const [emo, t, s] = d.ph;
return `${hodHero(d, true)}<div class="hm-body">
<div class="hm-screen"><div class="hm-screen-in">
${src ? `<video id="hodVideo" controls playsinline preload="metadata"></video>` : ''}
<div class="hm-ph" ${src ? 'hidden' : ''}><span>${emo}</span><b>${esc(t)}</b><small>${esc(s)}</small></div>
</div><div class="hm-screen-tag">${esc(d.videoTitle)}</div></div>
<p class="hm-note" id="hodNote">${src ? 'Видео запустится само. Если браузер запретит — нажми ▶.' : 'Видео для этого кандидата скоро появится. ' + esc(d.videoNote)}</p>
<section class="hm-block"><h3>Что в ролике</h3><ul class="hm-facts">${d.facts.map((f, i) => `<li style="--d:${i}">${esc(f)}</li>`).join('')}</ul></section>
<blockquote class="hm-quote"><p>${esc(d.quote[0])}</p><cite>${esc(d.quote[1])}</cite></blockquote></div>`;
}
function hodCountUp(){
$$('.hm-stat b[data-to]', hodEl).forEach((b, i) => {
const to = +b.dataset.to, suf = b.dataset.suf || '', t0 = performance.now() + 250 + i * 120, dur = 900;
const tick = now => {
const p = Math.max(0, Math.min(1, (now - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
b.textContent = Math.round(to * e) + suf;
if(p < 1 && hodEl.classList.contains('visible')) requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
});
}
function openHod(nominee, pane){
if(!nominee || nominee.classList.contains('selected')) return;
hodActive = nominee; hodPane = pane === 'video' ? 'video' : 'history';
const d = hodData(nominee), src = resolveCandidateVideo(nominee);
const acc = nominee.style.getPropertyValue('--acc');
hodDialog.className = 'hm-dialog hm-t-' + d.key + ' hm-pane-' + hodPane;
hodDialog.style.removeProperty('--acc');
hodEl.classList.add('visible'); hodEl.setAttribute('aria-hidden', 'false');
document.body.classList.add('modal-open');
hodScroll.innerHTML = hodPane === 'video' ? hodVideo(d, src) : hodHistory(d);
hodScroll.scrollTop = 0;
hodActions.innerHTML = `
<button type="button" class="hm-btn hm-vote">Голосовать за ${esc(d.voteName || d.surname)}</button>
<button type="button" class="hm-btn hm-back" data-hm="back">← Назад</button>
<button type="button" class="hm-btn hm-switch" data-hm="${hodPane === 'video' ? 'history' : 'video'}">${hodPane === 'video' ? 'История' : '▶ Видео'}</button>`;
$$('.hm-photo', hodEl).forEach(img => img.addEventListener?.('error', () => { img.style.display = 'none'; }, {once: true}));
if(hodPane === 'history'){ hodCountUp(); d.after?.(hodScroll); }
if(hodPane === 'video' && src){
const v = $('#hodVideo'), ph = $('.hm-ph', hodEl), note = $('#hodNote');
v.addEventListener('error', () => { v.style.display = 'none'; ph.hidden = false; note.textContent = 'Не удалось загрузить видео. ' + d.videoNote; }, {once: true});
v.src = src; v.playsInline = true; v.volume = 1;
const p = v.play(); if(p?.catch) p.catch(() => { note.textContent = 'Браузер заблокировал автозапуск — нажми ▶ на видео.'; });
}
if(typeof onCandidateOpened === 'function') onCandidateOpened();
}
function closeHod(){
if(!hodEl.classList.contains('visible')) return;
const v = $('#hodVideo'); if(v){ v.pause(); v.removeAttribute('src'); v.load(); }
hodEl.classList.remove('visible'); hodEl.setAttribute('aria-hidden', 'true');
hodScroll.innerHTML = ''; hodActive = null;
if(!candidateModal.classList.contains('visible')) document.body.classList.remove('modal-open');
if(typeof onCandidateClosed === 'function') onCandidateClosed();
}
function hodBurst(btn){
const r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, frag = document.createDocumentFragment();
for(let i = 0; i < 22; i++){
const s = document.createElement('i'); s.className = 'hm-burst';
const a = Math.PI * 2 * i / 22 + Math.random() * .4, dist = 70 + Math.random() * 90;
s.style.cssText = `left:${cx}px;top:${cy}px;--dx:${Math.cos(a) * dist}px;--dy:${Math.sin(a) * dist - 24}px;--r:${(Math.random() * 360) | 0}deg`;
frag.appendChild(s); setTimeout(() => s.remove(), 900);
}
document.body.appendChild(frag);
}
hodEl.addEventListener('click', e => {
if(e.target === hodEl || e.target.closest('.hm-close')){ closeHod(); return; }
const sw = e.target.closest('[data-hm]');
if(sw){ const act = sw.dataset.hm; if(act === 'back') closeHod(); else if(hodActive) openHod(hodActive, act); return; }
const vote = e.target.closest('.hm-vote');
if(vote && hodActive && !hodVoting){
hodVoting = true; const chosen = hodActive;
hodBurst(vote); vote.textContent = '✓ Выбор принят'; hodDialog.classList.add('voted');
try{ navigator.vibrate?.(18); tg.HapticFeedback?.notificationOccurred?.('success'); }catch(_){}
setTimeout(() => { hodVoting = false; hodDialog.classList.remove('voted'); closeHod(); voteFor(chosen); }, 700);
}
});
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeHod(); });
const KG = { steel: '#b9c4d2', dark: '#7b8798', gold: '#d6ab45', goldD: '#9a7424', green: '#2f7d4a', cape: '#8c1d2e', leather: '#4a3320', stone: ['#5f6470', '#737987', '#878e9c'] };
const KG_PIECES = [
{ n: 'Тоскик года', y: 2024, c: '#e0314b', from: [-38, -70, 20, 40] },
{ n: 'Тоскик года', y: 2025, c: '#3b7bff', from: [38, -86, 12, 140] },
{ n: 'Воздухан года', y: 2025, c: '#2fd39a', from: [-30, -104, -14, 220] },
{ n: 'Канал года', y: 2025, c: '#ffb62e', from: [34, -64, -18, 310] }
];
function kgCrownPiece(i){
const g = KG.gold, d = KG.goldD, gem = KG_PIECES[i].c;
const hl = { fc: { fr: 'linear-gradient(180deg,#f7dc8a,#d6ab45 60%,#a67c28)' } };
return `${k3bx(0, 0, 6.2, 13.8, 3.2, 1.3, g, hl)}${k3bx(0, 1.4, 6.2, 14.2, .7, 1.5, d)}
${[-5.2, 0, 5.2].map((x, k) => k3bx(x, -3.6 - (k === 1 ? 1.2 : 0), 6.2, 2, 4 + (k === 1 ? 2.4 : 0), 1.3, g, hl) + k3bx(x, -6 - (k === 1 ? 2.4 : 0), 6.2, 1.2, 1.2, 1.4, '#fff3b0')).join('')}
${k3bx(0, -.2, 7, 2.2, 2.2, .8, gem, { fc: { fr: `radial-gradient(circle at 35% 30%,#fff,${gem} 45%,#000 170%)` } })}`;
}
function kgKnight(){
const S = KG.steel, D = KG.dark, G = KG.gold, GD = KG.goldD, R = KG.green;
const hl = { fc: { fr: 'linear-gradient(180deg,#f7dc8a,#d6ab45 60%,#a67c28)' } };
const leg = s => k3bx(s * 3.5, -1.8, 1.4, 5, 3.6, 9, '#454c58') + k3bx(s * 3.5, -8.8, 0, 4.8, 10.4, 5, S) + k3bx(s * 3.5, -14.8, .7, 5.4, 3.2, 5.8, G, hl) + k3bx(s * 3.5, -20.4, 0, 5, 8, 5.4, D);
const arm = s => k3rot(s * 9.2, -42, 0, `<div class="rot" style="transform:rotateX(46.5deg) rotateZ(${s * 28.8}deg)">${k3bx(0, 3.6, 0, 4.2, 7.2, 4.4, S)}${k3bx(0, 7.3, .2, 4.8, 2.2, 5, G, hl)}${k3bx(0, 11, 0, 3.8, 6.6, 4, D)}${k3bx(0, 14.4, 0, 3.4, 3.2, 3.6, '#c3ccd8')}</div>`);
const spikes = s => k3bx(s * 9.6, -47.2, 0, 1.4, 2.8, 1.4, G, hl);
const sword = `${k3bx(0, -39, 9.4, 2.8, 2.8, 2.8, G, hl)}${k3bx(0, -35, 9.4, 1.5, 6.4, 1.5, KG.leather)}${k3bx(0, -30.5, 9.4, 11, 1.7, 2.2, G, hl)}${k3bx(0, -16, 9.4, 2.8, 28, .9, '#e8eef6', { fc: { fr: 'linear-gradient(90deg,#fff,#c9d3df 50%,#8794a6)' } })}${k3bx(0, -1.4, 9.4, 1.6, 2.8, .7, '#dfe6ee')}`;
const head = k3head({ skin: '#efc19b', hair: '#4a2e1a', mouth: 'smile', eye: '#1b1b1b', brow: '#2c1a0e' }, 0, 'kgHead').replace('--y:-30px', '--y:-47px');
const cape = k3rot(0, -45, -4.6, `<div class="rot kg-cape">${k3bx(0, 14.5, 0, 14, 29, .9, KG.cape, { fc: { bk: 'linear-gradient(180deg,#a82a3d,#6e1522)', fr: 'linear-gradient(180deg,#7a1727,#4c0d18)' } })}${k3bx(-6.9, 14.5, .2, .8, 29, 1.2, G)}${k3bx(6.9, 14.5, .2, .8, 29, 1.2, G)}${k3bx(0, 29.2, .2, 14.8, .8, 1.2, G)}</div>`);
return `<div class="bx grp" id="kgBody" style="--x:0px;--y:0px;--z:0px;--ry:0deg">
${leg(1)}${leg(-1)}
${k3bx(0, -25.2, 0, 14, 3.8, 8.6, R)}${k3bx(-5.2, -24.4, .6, 3.6, 6.6, 9, S)}${k3bx(5.2, -24.4, .6, 3.6, 6.6, 9, S)}
${k3bx(0, -28.2, 0, 14.6, 2, 9, KG.leather)}${k3bx(0, -28.2, 4.7, 3.4, 2.2, .7, G, hl)}
${k3bx(0, -36.4, 0, 14.2, 15, 8.2, S, { fc: { fr: 'linear-gradient(180deg,#d4dde8,#a8b4c4)' } })}
${k3bx(0, -35.2, 4.2, 8.6, 14, .6, R, { in: { fr: '<em class="kg-em"></em>' } })}${k3bx(0, -41.6, 4.4, 11, 1.2, .8, G, hl)}
${k3bx(0, -45, 0, 8.6, 3, 7.8, D)}${k3bx(0, -46.4, 0, 11, 2.2, 9.4, '#f2efe8')}
${k3bx(s9(1), -43.2, 0, 6.6, 3.6, 7.2, S)}${k3bx(s9(-1), -43.2, 0, 6.6, 3.6, 7.2, S)}${k3bx(s9(1), -45.2, 0, 7, 1.4, 7.6, G, hl)}${k3bx(s9(-1), -45.2, 0, 7, 1.4, 7.6, G, hl)}${spikes(1)}${spikes(-1)}
${arm(1)}${arm(-1)}${sword}${cape}${head}
</div>`;
function s9(s){ return s * 9.6; }
}
function kgScene(){
const st = KG.stone;
const dais = k3bx(0, -1.5, 0, 92, 3, 92, st[0], { fc: { tp: 'repeating-linear-gradient(90deg,rgba(0,0,0,.2) 0 1px,transparent 1px 15px),repeating-linear-gradient(0deg,rgba(0,0,0,.2) 0 1px,transparent 1px 15px),#5f6470' } })
+ k3bx(0, -4.5, 0, 66, 3, 66, st[1], { fc: { tp: 'repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 1px,transparent 1px 11px),repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 1px,transparent 1px 11px),#737987' } })
+ k3bx(0, -7.5, 0, 42, 3, 42, st[2], { fc: { tp: 'repeating-linear-gradient(90deg,rgba(0,0,0,.16) 0 1px,transparent 1px 10px),repeating-linear-gradient(0deg,rgba(0,0,0,.16) 0 1px,transparent 1px 10px),#878e9c' } })
+ k3bx(0, -2.9, 30, 14, .5, 36, '#8c1d2e') + k3bx(0, -5.9, 18, 14, .5, 14, '#8c1d2e') + k3bx(0, -8.9, 4, 14, .5, 22, '#8c1d2e')
+ k3bx(-7.1, -2.9, 30, .6, .5, 36, KG.gold) + k3bx(7.1, -2.9, 30, .6, .5, 36, KG.gold);
const floor = `<div class="k3-pl kg-floor" style="width:420px;height:420px;left:-210px;top:-210px;transform:rotateX(90deg)"><i class="kg-rune"></i><i class="kg-rune r2"></i></div>`;
const wall = `<div class="k3-pl kg-wall" style="width:420px;height:220px;left:-210px;top:-220px;transform:translateZ(-110px)"><i class="kg-arch"></i><i class="kg-win"></i></div>`;
const pillar = x => k3bx(x, -37, -92, 12, 74, 12, '#6a707e', { fc: { fr: 'repeating-linear-gradient(90deg,#757b89 0 3px,#5a606d 3px 4px)' } }) + k3bx(x, -76, -92, 16, 5, 16, '#8a909d') + k3bx(x, -2, -92, 16, 4, 16, '#8a909d');
const torch = (x, z) => k3bx(x, -13, z, 2, 26, 2, '#4a3320') + k3bx(x, -27, z, 6.4, 3, 6.4, '#2d2a30') + k3bx(x, -29.5, z, 5, 2, 5, '#a0561f') + `<div class="bx bb kg-fire" style="--x:${x}px;--y:-34px;--z:${z}px"><i></i><i></i><i></i></div>`;
const banner = x => k3bx(x, -66, -78, 20, 3, 3, KG.gold) + k3bx(x, -44, -78, 17, 40, 1.2, KG.cape, { fc: { fr: 'linear-gradient(180deg,#9a2438,#6e1522)' }, in: { fr: '<em class="kg-bn"></em>' } }) + k3bx(x, -23.4, -78, 17, 1.2, 1.4, KG.gold);
const shield = `<div class="bx grp" style="--x:-24px;--y:-9px;--z:10px;--ry:24deg">${k3bx(0, -8, 0, 12, 10, 1.6, '#2a4a8a', { fc: { fr: 'linear-gradient(135deg,#3a62b8,#1c3567)' } })}${k3bx(0, -3, 0, 8, 6, 1.6, '#2a4a8a', { fc: { fr: 'linear-gradient(135deg,#3a62b8,#1c3567)' } })}${k3bx(0, 0, 0, 3.6, 4, 1.6, '#2a4a8a')}${k3bx(0, -5, .9, 1.8, 14, .5, KG.gold)}${k3bx(0, -8, .9, 8, 1.8, .5, KG.gold)}</div>`;
const pieces = KG_PIECES.map((p, i) => `<div class="bx grp kgp" id="kgP${i}" data-i="${i}" style="--x:${p.from[0]}px;--y:${p.from[1]}px;--z:${p.from[2]}px;--ry:${p.from[3]}deg"><div class="rot kg-fl" style="animation-delay:${-i * .7}s">${kgCrownPiece(i)}</div></div>`).join('');
const extra = k3rot(0, -2.6, 0, `${k3bx(0, 3.2, 0, 11.8, .8, 11.8, '#5b1b6b', { fc: { tp: 'radial-gradient(circle,#8a3aa0,#4a1558)' } })}${[[-6.2, -6.2], [6.2, -6.2], [-6.2, 6.2], [6.2, 6.2]].map(([x, z]) => k3bx(x, -2, z, 1.8, 3, 1.8, KG.gold) + k3bx(x, -4.2, z, 1.2, 1.2, 1.2, '#fff3b0')).join('')}${k3bx(0, -6.4, -2, 1.5, 8, 1.5, KG.gold)}${k3bx(0, -8.2, -2, 5, 1.5, 1.5, KG.gold)}${k3bx(0, -10.4, -2, 2, 2, 2, '#e0314b')}`, { cls: 'kg-ex' });
const crown = `<div class="bx grp" id="kgCrown" style="--x:0px;--y:-84px;--z:0px;--ry:0deg">${pieces}${extra}</div>`;
return `<div class="k3-world kg-world" id="kgWorld">${floor}${wall}${dais}${pillar(-70)}${pillar(70)}${banner(-36)}${banner(36)}${torch(-34, 26)}${torch(34, 26)}${shield}
<div class="bx grp" id="kgKnight" style="--x:0px;--y:-9px;--z:0px;--ry:0deg">${kgKnight()}</div>${crown}
<div class="bx bb k3-say kg-sayw" id="kgSay" style="--x:30px;--y:-88px;--z:0px"><div class="tin"><span id="kgSayT"></span></div></div>
<div class="bx bb k3-tag kg-title" id="kgTitle" style="--x:0px;--y:-112px;--z:0px"><div class="tin"><b>РЫЦАРЬ · ПРЕТЕНДЕНТ</b><small>Литнарович Кирилл · MMXXVII</small></div></div></div>`;
}
const KG_HTML = () => `
<div class="kg" id="kg">
<div class="k3-hud"><span id="kgSt">Корона разобрана</span><b id="kgCnt">0 / 4</b></div>
<div class="k3-view kg-view" id="kgView"><div class="k3-cam">${kgScene()}</div><i class="kg-glow"></i><i class="kg-flash" id="kgFlash"></i><div class="kg-fx" id="kgFx"></div></div>
<div class="k3-ctl"><button type="button" class="k3-b on" data-v="over">Обзор</button><button type="button" class="k3-b" data-v="face">Лицо</button><button type="button" class="k3-b" data-v="crown">Корона</button><button type="button" class="k3-b" data-v="back">Сзади</button></div>
<div class="lg-gems">
${KG_PIECES.map((p, i) => `<button type="button" class="lg-gem ${['rub', 'sap', 'eme', 'top'][i]}" data-i="${i}" aria-label="Звено короны: ${p.n} ${p.y}"><i></i><b>${p.n}</b><small>${roman(p.y)}</small></button>`).join('')}
</div>
<div class="lg-royal" aria-live="polite"><b>Только примерка</b><span>Четыре титула — ещё не трон. Настоящую корону отдаст голосование.</span></div>
<button type="button" class="lg-auto">Собрать и примерить</button>
<p class="k3-hint">Нажимай на титулы — звенья короны слетятся. Тяни пальцем — рыцарь поворачивается.</p>
</div>`;
function kgAfter(root){
const view = $('#kgView', root), world = $('#kgWorld', root), flash = $('#kgFlash', root), fx = $('#kgFx', root), crown = $('#kgCrown', root), head = $('#kgHead', root), knight = $('#kgKnight', root), body = $('#kgBody', root);
const say = $('#kgSay', root), sayT = $('#kgSayT', root), st = $('#kgSt', root), cnt = $('#kgCnt', root), royal = $('.lg-royal', root), kg = $('#kg', root);
const gems = $$('.lg-gem', root), piece = i => $('#kgP' + i, root), live = () => root.isConnected;
const P = { over: { yaw: -22, pit: -19, sc: 2.55, fx: 0, fy: -58, fz: 0 }, face: { yaw: -8, pit: -6, sc: 6.2, fx: 0, fy: -62, fz: 0 }, crown: { yaw: -30, pit: -28, sc: 4.2, fx: 0, fy: -78, fz: 0 }, back: { yaw: 168, pit: -14, sc: 2.7, fx: 0, fy: -48, fz: 0 } };
const cull = makeCull3D(world);
const C = makeCam3D(view, world, P, { dy: 12, onApply: c => { cull.update(c.yaw); if(head && !done) { let phi = ((-c.yaw) % 360 + 540) % 360 - 180; phi = Math.max(-60, Math.min(60, phi * .6)); head.style.transform = `rotateY(${phi.toFixed(1)}deg)`; } }, onVis: v => kg.classList.toggle('off', !v), onLite: () => kg.classList.add('lite'), pitMin: -70, pitMax: -2 });
$$('.k3-b[data-v]', root).forEach(b => b.addEventListener('click', () => { C.go(b.dataset.v); $$('.k3-b[data-v]', root).forEach(x => x.classList.toggle('on', x === b)); tink([523]); }));
let set = [false, false, false, false], done = false, busy = false, st1 = 0;
const speak = (t, ms = 2400) => { sayT.textContent = t; say.classList.add('on'); clearTimeout(st1); st1 = setTimeout(() => say.classList.remove('on'), ms); };
const upd = () => { const n = set.filter(Boolean).length; cnt.textContent = n + ' / 4'; st.textContent = n === 4 ? (done ? 'Примерил' : 'Корона собрана') : n ? 'Звенья на месте: ' + n : 'Корона разобрана'; };
const attach = i => {
if(set[i] || busy) return; set[i] = true; gems[i].classList.add('set'); const el = piece(i), fl = $('.kg-fl', el); fl.style.animation = 'none';
const fin = i * 90; tween3D(el, { '--x': 0, '--y': 0, '--z': 0, '--ry': fin + (360 * 0) }, 900, 'inout', () => { tink([1760 + i * 220]); el.classList.add('seat'); upd(); if(set.every(Boolean)) setTimeout(crownIt, 500); });
tink([660 + i * 110]); try{ navigator.vibrate?.(8); }catch(_){}
speak(['Первое звено!', 'Второе звено!', 'Третье звено!', 'Последнее звено!'][set.filter(Boolean).length - 1], 1300);
};
const burst = (n = 34) => { const r = view.getBoundingClientRect(); for(let k = 0; k < n; k++){ const s = document.createElement('i'); s.className = 'kg-sp'; const a = Math.random() * 6.28, d = 40 + Math.random() * 120; s.style.cssText = `left:${r.width * .5}px;top:${r.height * .38}px;--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d - 30).toFixed(0)}px;background:${['#ffe27a', '#fff', '#ffb62e', '#e0314b', '#7ad0ff'][k % 5]}`; fx.appendChild(s); setTimeout(() => s.remove(), 1300); } };
function crownIt(){
if(done || busy) return; busy = true; $('.kg-ex', crown).classList.add('on'); st.textContent = 'Корона собрана'; speak('Корона готова!', 1500); tink([784, 1047, 1319]); C.go('crown'); $$('.k3-b[data-v]', root).forEach(x => x.classList.toggle('on', x.dataset.v === 'crown'));
flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
tween3D(crown, { '--y': -100, '--ry': 720 }, 1500, 'inout', () => {
head.style.transition = 'transform .6s'; head.style.transform = 'rotateX(12deg)';
tween3D(crown, { '--y': -67 }, 900, 'in', () => {
tink([523, 659, 784, 1047, 1568]); try{ navigator.vibrate?.([20, 40, 20, 40, 30]); }catch(_){}
burst(46); flash.classList.remove('go2'); void flash.offsetWidth; flash.classList.add('go2');
knight.classList.add('crowned'); kg.classList.add('crowned'); head.style.transform = 'rotateX(0deg)'; done = true; busy = false; upd(); royal.classList.add('on');
tween3D(crown, { '--y': -66 }, 300, 'back'); C.go('over'); $$('.k3-b[data-v]', root).forEach(x => x.classList.toggle('on', x.dataset.v === 'over'));
setTimeout(() => speak('Сидит неплохо. Но решит группа.', 3200), 400);
});
});
}
gems.forEach((g, i) => g.addEventListener('click', () => attach(i)));
$('.lg-auto', root).addEventListener('click', () => {
if(busy) return;
if(done){ /* сброс: корона снова разлетается */
done = false; set = [false, false, false, false]; gems.forEach(g => g.classList.remove('set')); royal.classList.remove('on'); knight.classList.remove('crowned'); kg.classList.remove('crowned'); $('.kg-ex', crown).classList.remove('on'); upd();
tween3D(crown, { '--y': -84, '--ry': 0 }, 400, 'out'); KG_PIECES.forEach((p, i) => { const el = piece(i); el.classList.remove('seat'); tween3D(el, { '--x': p.from[0], '--y': p.from[1], '--z': p.from[2], '--ry': p.from[3] }, 700, 'out', () => { $('.kg-fl', el).style.animation = ''; }); });
setTimeout(() => $('.lg-auto', root).click(), 900); return;
}
gems.forEach((g, i) => setTimeout(() => { if(live()) attach(i); }, 200 + i * 1000));
});
C.go('over'); upd(); setTimeout(() => speak('Я просто примерю.', 2400), 700);
}
const hmAlive = root => root && root.isConnected;
const hmTone = (f, d = .12, v = .06, type = 'sine') => {
try{
const ac = tink.ac || (tink.ac = new (window.AudioContext || window.webkitAudioContext)()); if(ac.state === 'suspended') ac.resume();
const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type; o.frequency.value = f;
g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + .05);
}catch(_){}
};
const hmPad = (n, k = 2) => String(n).padStart(k, '0');
Object.assign(HOD, {
'Алиев|Ходящий': {
key: 'aliev', kicker: 'Электронная проходная', tag: 'Пропуск приложил — день начался',
stats: [[4, 'года доступа'], [8, 'семестров'], [0, 'опозданий']],
infoTitle: 'Турникет № 1',
quote: ['«Если пара идёт — Алиев уже в третьем ряду».', 'Преподаватели, не отмечая в журнале'],
videoTitle: 'Камера на входе', videoNote: 'Запись с проходной: 08:29, как всегда.',
facts: ['Проходил в университет в одно и то же время — вахтёры сверяли часы', 'Пропуск приложил — день начался, никаких «забери за меня»', 'Восемь семестров без единой записи в журнале опозданий'],
ph: ['🛂', 'Запись с проходной', 'Камера ищет момент входа'],
art: () => `<div class="al-grid"></div><i class="al-scan"></i><div class="al-hud"><span>ДОСТУП</span><small>РАЗРЕШЁН · 4 ГОДА</small></div><i class="al-br tl"></i><i class="al-br tr"></i><i class="al-br bl"></i><i class="al-br br"></i>`,
info: () => `
<div class="al-gate">
<div class="al-pass"><i class="al-chip"></i><div class="al-ph">АА</div>
<div class="al-pi"><small>Студент · очная форма</small><b>Алиев А.</b><span>ID 20-27-0831</span></div><i class="al-bar"></i></div>
<div class="al-turn">
<svg viewBox="-60 -60 120 120" aria-hidden="true"><circle r="54" class="r1"/><circle r="46" class="r2"/>
<g class="al-arms" id="alArms">${[0, 120, 240].map(a => `<g transform="rotate(${a})"><rect x="-3" y="-44" width="6" height="40" rx="3"/><circle cy="-46" r="4"/></g>`).join('')}</g>
<circle r="9" class="hub"/></svg>
<div class="al-side"><div class="al-led" id="alLed"></div>
<div class="al-disp"><small>Входов</small><b id="alN">000</b></div></div>
</div>
<button type="button" class="al-btn" id="alBtn">Приложить пропуск</button>
<p class="al-msg" id="alMsg">Приложи пропуск к считывателю — турникет откроется.</p>
<ul class="al-log" id="alLog"></ul>
</div>`,
after: root => {
const btn = $('#alBtn', root), arms = $('#alArms', root), led = $('#alLed', root), n = $('#alN', root), msg = $('#alMsg', root), log = $('#alLog', root);
let cnt = 0, rot = 0, busy = false;
const tm = i => `08:${hmPad(12 + (i * 2) % 17)}:${hmPad((i * 17) % 60)}`;
btn.addEventListener('click', () => {
if(busy) return; busy = true; cnt++;
hmTone(1760, .09, .07); setTimeout(() => hmTone(2349, .12, .06), 90);
led.className = 'al-led ok'; msg.textContent = cnt >= 8 ? 'Все 8 семестров пройдены. Доступ — навсегда.' : 'Пропуск принят. Проходи.';
setTimeout(() => { fxNoise(.07, 220, .13, 'lowpass'); rot += 120; arms.style.transform = `rotate(${rot}deg)`; }, 160);
setTimeout(() => fxNoise(.05, 480, .1, 'lowpass'), 640);
n.textContent = hmPad(cnt, 3);
const li = document.createElement('li'); li.innerHTML = `<time>${tm(cnt)}</time><span>вход № ${cnt}</span><b>доступ разрешён</b>`; log.prepend(li); while(log.children.length > 4) log.lastChild.remove();
setTimeout(() => { led.className = 'al-led'; busy = false; }, 900);
});
}
},
'Голиков|Ходящий': {
key: 'golikov', kicker: 'Линия «Пары»', tag: 'Двери закрываются. Следующая — выпуск',
stats: [[8, 'станций по маршруту'], [0, 'проехал мимо'], [1, 'конечная']],
infoTitle: 'Схема маршрута',
quote: ['«Опаздывают у нас все. У Матвея бывают задержки на линии».', 'Диспетчер группы'],
videoTitle: 'Вид из кабины', videoNote: 'Тоннель, огни и ни одной пропущенной станции.',
facts: ['Едет по маршруту: без суеты, с точностью до минуты', 'Знает, где лучшая розетка и когда в буфете пирожки', 'Конечная станция — диплом, лицо то же, что на первой паре'],
ph: ['🚇', 'Вид из кабины', 'Поезд въезжает на станцию'],
art: () => `<div class="gl-hero"><i class="gl-mline"></i><i class="gl-tun"></i><b class="gl-m">M</b><div class="gl-lamps">${Array.from({ length: 7 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div></div>`,
info: () => {
const names = ['Первое сентября', '1 семестр', '2 семестр', '3 семестр', '4 семестр', '5 семестр', '6 семестр', '7 семестр', 'Диплом'];
return `
<div class="gl-map" id="glMap">
<div class="gl-rail"><i id="glFill"></i></div>
${names.map((nm, i) => `<span class="gl-s${i === 0 ? ' on' : ''}" data-i="${i}" style="left:calc(14px + (100% - 28px) * ${i / 8})"><i></i><em>${i === 0 ? 'СТ' : i === 8 ? 'ДП' : i}</em></span>`).join('')}
<div class="gl-train" id="glTrain"><span></span><span></span><i></i></div>
</div>
<div class="gl-board"><small id="glLine">Линия 4 «Пары» · пропущено станций: 0</small><b id="glName">${names[0]}</b><p id="glAnn">Поезд на первой станции. Осторожно, двери закрываются.</p></div>
<button type="button" class="gl-btn" id="glBtn" data-names='${names.join('|')}'>Следующая станция →</button>`;
},
after: root => {
const btn = $('#glBtn', root), names = btn.dataset.names.split('|'), train = $('#glTrain', root), fill = $('#glFill', root), nm = $('#glName', root), ann = $('#glAnn', root), sts = $$('.gl-s', root);
let i = 0, busy = false;
const place = k => { const p = k / 8; train.style.left = `calc(14px + (100% - 28px) * ${p})`; fill.style.width = (p * 100) + '%'; };
place(0);
btn.addEventListener('click', () => {
if(busy) return;
if(i === 8){ i = 0; place(0); sts.forEach((s, k) => s.classList.toggle('on', k === 0)); nm.textContent = names[0]; ann.textContent = 'Поезд возвращается на первую станцию.'; btn.textContent = 'Следующая станция →'; return; }
busy = true; i++; hmTone(659, .22, .05); setTimeout(() => hmTone(523, .3, .05), 140);
train.classList.add('go'); place(i); fxNoise(.6, 180, .05, 'lowpass');
setTimeout(() => {
train.classList.remove('go'); sts.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('done', k < i); });
nm.textContent = names[i]; hmTone(880, .18, .06); setTimeout(() => hmTone(1175, .25, .05), 120);
ann.textContent = i === 8 ? 'Конечная. Просьба забрать диплом и не забывать вещи в вагоне.' : `Станция «${names[i]}». Ни одной пары не проехали мимо.`;
btn.textContent = i === 8 ? '↺ Сначала' : 'Следующая станция →'; busy = false;
}, 1050);
});
}
},
'Куликов|Ходящий': {
key: 'kulikov', kicker: 'Будильник заранее', tag: 'Ровно за минуту до звонка',
stats: [['08:29', 'он у двери аудитории'], [0, 'раз «ещё пять минут»'], [4, 'года одного утра']],
infoTitle: 'Успей на первую пару',
quote: ['«Стоит Куликову появиться в дверях — на часах 8:29».', 'Группа, сверяя часы'],
videoTitle: 'Утро Виталия', videoNote: 'Будильник, дорога, 08:29.',
facts: ['Просыпается раньше будильника — потому что знает про пару', 'Если сказал «буду к началу» — будет за минуту до', 'Часы в аудитории подозрительно сходились по нему'],
ph: ['⏰', 'Утро Виталия', 'Будильник ещё не успел зазвенеть'],
art: () => `<div class="ku-ghost">08:30</div><div class="ku-bells"><i></i><i></i></div><div class="ku-rays"></div>`,
info: () => `
<div class="ku-clock">
<small>Первая пара · звонок в 08:30:00</small>
<div class="ku-digits" id="kuD">08:20:00</div>
<div class="ku-bar"><i id="kuP"></i><span></span></div>
<p class="ku-res" id="kuRes">Время идёт быстрее обычного. Нажми «В аудиторию!» как можно ближе к звонку — но не позже.</p>
<button type="button" class="ku-btn" id="kuGo">▶ Выйти из дома</button>
<div class="ku-best" id="kuBest">Рекорд: —</div>
</div>`,
after: root => {
const d = $('#kuD', root), p = $('#kuP', root), res = $('#kuRes', root), go = $('#kuGo', root), best = $('#kuBest', root);
const START = 8 * 3600 + 20 * 60, BELL = 8 * 3600 + 30 * 60, RATE = 55;
let t0 = 0, run = false, raf = 0, rec = null;
const fmt = s => `${hmPad(Math.floor(s / 3600))}:${hmPad(Math.floor(s / 60) % 60)}:${hmPad(Math.floor(s) % 60)}`;
const stop = () => { run = false; cancelAnimationFrame(raf); go.textContent = '↺ Ещё раз'; go.classList.remove('hot'); };
const tick = () => {
if(!hmAlive(root)) return;
const now = START + (performance.now() - t0) / 1000 * RATE;
d.textContent = fmt(Math.min(now, BELL + 60)); p.style.width = Math.min(100, (now - START) / (BELL - START) * 100) + '%';
if(now >= BELL){ d.classList.add('late'); hmTone(1568, .5, .08, 'square'); stop(); res.textContent = 'Звонок прозвенел, а ты ещё в коридоре. Преподаватель уже закрывает дверь. Виталий так не делает.'; return; }
raf = requestAnimationFrame(tick);
};
go.addEventListener('click', () => {
if(!run){ d.classList.remove('late'); d.textContent = fmt(START); p.style.width = '0'; res.textContent = 'Идёшь по коридору… Жми, когда будешь у двери!'; go.textContent = 'В аудиторию!'; go.classList.add('hot'); t0 = performance.now(); run = true; hmTone(880, .08, .05); raf = requestAnimationFrame(tick); return; }
const now = START + (performance.now() - t0) / 1000 * RATE, dt = BELL - now; stop(); d.textContent = fmt(now); fxNoise(.07, 300, .12, 'lowpass');
if(dt <= 20){ hmTone(1318, .3, .07); setTimeout(() => hmTone(1976, .4, .06), 120); res.textContent = `Идеально: за ${Math.max(1, Math.round(dt))} с до звонка. Это уровень Куликова — 08:29.`; }
else if(dt <= 75){ hmTone(988, .25, .06); res.textContent = `Хорошо: за ${Math.round(dt)} с до звонка. Куликов бы прошёл ещё на секунд сорок точнее.`; }
else { res.textContent = `Слишком рано: за ${Math.round(dt / 60 * 10) / 10} мин до звонка. Придётся стоять у двери и делать вид, что так задумано.`; }
if(dt >= 0 && (rec === null || dt < rec)){ rec = dt; best.textContent = `Рекорд: за ${Math.max(1, Math.round(rec))} с до звонка`; }
});
}
},
'Берсенев|Ходящий': {
key: 'bershod', kicker: 'Зачётная книжка', tag: 'Восемь подписей и ни одной потерянной зачётки',
stats: [[8, 'печатей деканата'], [0, 'потерянных зачёток'], [4, 'года в порядке']],
infoTitle: 'Печати за семестры',
quote: ['«Вон тот, у которого всё в порядке».', 'Деканат, не называя фамилии'],
videoTitle: 'Приём в деканате', videoNote: 'Штамп, подпись, следующий.',
facts: ['Приходит регулярно и без объявлений — как налоги и дедлайны', 'Штамп стал частью его личного стиля', 'В деканате знают в лицо — и это высшее доверие'],
ph: ['🗂️', 'Приём в деканате', 'Секретарь ищет нужный штамп'],
art: () => `<div class="bh-hero"><span class="bh-seal"></span><span class="bh-seal b"></span><div class="bh-lines"></div></div>`,
info: () => {
const rm = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
return `
<div class="bh-book">
<div class="bh-cov"><b>Зачётная книжка</b><small>№ 27-0417 · очная форма</small></div>
<div class="bh-rows">${rm.map((r, i) => `<button type="button" class="bh-row" data-i="${i}"><span class="bh-n">${r}</span><span class="bh-t">${(i >> 1) + 1} курс · ${i % 2 ? 'весна' : 'осень'}</span><span class="bh-slot"><u>место для печати</u></span></button>`).join('')}</div>
<div class="bh-foot"><span id="bhCnt">Печатей: 0 из 8</span><button type="button" class="bh-all" id="bhAll">Проставить все</button></div>
<div class="bh-fin" id="bhFin" hidden><b>Допущен к диплому</b><small>Деканат · подпись · печать</small></div>
</div>`;
},
after: root => {
const rows = $$('.bh-row', root), cnt = $('#bhCnt', root), fin = $('#bhFin', root), all = $('#bhAll', root);
const stamp = (row, quiet) => {
if(row.classList.contains('done')) return false;
const slot = $('.bh-slot', row), r = (Math.random() - .5) * 26;
slot.innerHTML = `<span class="bh-st" style="--r:${r.toFixed(1)}deg;--dx:${((Math.random() - .5) * 8).toFixed(0)}px"><b>ДЕКАНАТ</b><i>ДОПУЩЕН</i><small>${hmPad(1 + (Math.random() * 27 | 0))}.${hmPad(1 + (Math.random() * 12 | 0))}</small></span>`;
row.classList.add('done'); if(!quiet){ fxNoise(.08, 150, .26, 'lowpass'); setTimeout(() => fxNoise(.04, 2400, .05, 'highpass'), 40); }
return true;
};
const upd = () => { const k = rows.filter(r => r.classList.contains('done')).length; cnt.textContent = `Печатей: ${k} из 8`; if(k === 8){ fin.hidden = false; all.disabled = true; hmTone(784, .5, .05); setTimeout(() => hmTone(1175, .6, .05), 160); } };
rows.forEach(r => r.addEventListener('click', () => { if(stamp(r)) upd(); }));
all.addEventListener('click', () => { rows.forEach((r, i) => setTimeout(() => { if(hmAlive(root)){ stamp(r); upd(); } }, i * 170)); });
}
}
});
Object.assign(HOD, {
'Фролов|Прогульщик': {
key: 'pfrolov', kicker: 'Операция «Выход»', tag: 'Тихо встал. Тихо вышел. Тихо исчез',
stats: [[100, 'стелс', '%'], [12, 'сек. до оборота'], [1, 'куртка на стуле']],
infoTitle: 'Тихо к выходу',
quote: ['«Он был на паре. Просто куртка висела так убедительно».', 'Одногруппники, голосуя за версию с курткой'],
videoTitle: 'Съёмка скрытой камерой', videoNote: 'Дверь скрипнула — но никто не заметил.',
facts: ['Знает, в какой аудитории скрипит дверь и на каком этаже дежурит вахтёр', 'Считает секунды, пока преподаватель смотрит на доску', 'Куртка на стуле — классика маскировки'],
ph: ['🥷', 'Скрытая камера', 'Объект движется к выходу'],
art: () => `<div class="pf-chalk"><b>Расписание</b><span>Пн · 9:00 · лекция</span><span>Вт · 10:40 · семинар</span><span>Ср · 9:00 · лекция</span><i></i></div><div class="pf-dust2"><i></i><i></i><i></i><i></i><i></i></div><div class="pf-doorglow"></div>`,
info: () => `
<div class="pf-room" id="pfRoom" data-s="back">
<div class="pf-board"><div class="pf-formula">∫ ψ dx = ? &nbsp; Теорема 7.3</div>
<div class="pf-teach"><span class="pf-head"><i class="hr"></i><i class="fc"><u></u><u></u></i></span><span class="pf-body"></span><span class="pf-warn">!</span></div></div>
<div class="pf-floor"><div class="pf-cone"></div>
<div class="pf-desks">${Array.from({ length: 5 }, () => '<i></i>').join('')}</div>
<div class="pf-track"><div class="pf-me" id="pfMe"><i></i><b>Ф</b></div><div class="pf-door">ВЫХОД</div></div>
</div>
<div class="pf-prog"><i id="pfP"></i></div>
<p class="pf-msg" id="pfMsg">Держи кнопку и ползи к двери, пока препод пишет на доске. Оборачивается — отпусти!</p>
<button type="button" class="pf-hold" id="pfHold">Ползти к двери (удерживай)</button>
<div class="pf-score" id="pfSc">Попыток: 0 · замечен: 0</div>
</div>`,
after: root => {
const room = $('#pfRoom', root), me = $('#pfMe', root), prog = $('#pfP', root), msg = $('#pfMsg', root), hold = $('#pfHold', root), sc = $('#pfSc', root);
let pos = 0, holding = false, st = 'back', won = false, caught = 0, tries = 1, to = 0;
const set = s => { st = s; room.dataset.s = s; };
const sched = () => {
if(!hmAlive(root)) return; set('back');
to = setTimeout(() => { if(!hmAlive(root)) return; set('warn'); hmTone(520, .08, .03); to = setTimeout(() => { if(!hmAlive(root)) return; set('look'); if(holding && !won) busted(); to = setTimeout(sched, 800 + Math.random() * 900); }, 520); }, 1100 + Math.random() * 1600);
};
const busted = () => {
caught++; pos = Math.max(0, pos - 45); holding = false; room.classList.add('shake'); setTimeout(() => room.classList.remove('shake'), 400);
hmTone(160, .35, .09, 'sawtooth'); msg.textContent = 'Заметили! «Фролов, вы куда?» — пришлось вернуться на место.'; tries++; sc.textContent = `Попыток: ${tries} · замечен: ${caught}`;
};
const draw = () => { me.style.left = `calc(${pos}% * .9)`; prog.style.width = pos + '%'; room.classList.toggle('crawl', holding && !won); };
const iv = setInterval(() => {
if(!hmAlive(root)){ clearInterval(iv); clearTimeout(to); return; }
if(holding && !won){
if(st === 'look'){ busted(); } else { pos = Math.min(100, pos + .7); if(Math.random() < .08) fxNoise(.03, 900, .025, 'lowpass'); }
if(pos >= 100){ won = true; holding = false; msg.textContent = `Побег удался! Куртка осталась на стуле. Попыток: ${tries}.`; hold.textContent = '↺ Ещё раз'; hmTone(784, .3, .06); setTimeout(() => hmTone(1175, .5, .05), 150); fxNoise(.2, 600, .1, 'lowpass'); room.classList.add('free'); }
}
draw();
}, 40);
const on = e => { e.preventDefault(); if(won){ won = false; pos = 0; tries = 1; caught = 0; room.classList.remove('free'); hold.textContent = 'Ползти к двери (удерживай)'; msg.textContent = 'Снова в строю. Ползи, пока он смотрит на доску.'; sc.textContent = 'Попыток: 1 · замечен: 0'; return; } holding = true; hold.classList.add('on'); if(st === 'look') busted(); };
const off = () => { holding = false; hold.classList.remove('on'); };
hold.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => hold.addEventListener(ev, off));
hold.addEventListener('contextmenu', e => e.preventDefault()); hold.style.touchAction = 'none';
sched();
}
},
'Самсонов|Прогульщик': {
key: 'psamsonov', kicker: 'Гараж № 12', tag: 'Опоздал на пару? Нет. Стартовал',
stats: [[50, 'шанс завестись', '%'], [20, 'минут «я скоро»'], [2112, 'любимая модель']],
infoTitle: 'Дрэг-старт у гаража',
quote: ['«Я уже еду», — написал Костя, в этот момент выкручивая гайку.', 'Чат группы, 09:12'],
videoTitle: 'Заезд у гаража', videoNote: 'Звук мотора, запах бензина и ни слова про пару.',
facts: ['ВАЗ-2112 важнее теории вероятностей — пара будет и завтра', 'Шанс завестись с первого раза — ровно пятьдесят на пятьдесят', 'На пару не пришёл, зато пришёл с бензином и счастьем'],
ph: ['🏁', 'Заезд у гаража', 'Мотор прогревается'],
art: () => `<div class="pm-skid"><i></i><i></i></div><div class="pm-tach"><svg viewBox="0 0 120 70"><path class="a" d="M10 62A50 50 0 0 1 110 62"/><path class="r" d="M92 22A50 50 0 0 1 110 62"/>${Array.from({ length: 9 }, (_, k) => { const a = Math.PI + k / 8 * Math.PI, x1 = 60 + Math.cos(a) * 44, y1 = 62 + Math.sin(a) * 44, x2 = 60 + Math.cos(a) * 50, y2 = 62 + Math.sin(a) * 50; return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`; }).join('')}<path class="n" d="M60 62L28 40"/></svg></div>`,
info: () => `
<div class="pm-drag" id="pmDrag">
<div class="pm-tree"><i class="l"></i><i class="l"></i><i class="l"></i><i class="g"></i></div>
<div class="pm-road"><div class="pm-line"></div><div class="pm-car" id="pmCar">${typeof carSvg === 'function' ? carSvg('vaz2112', { color: '#c9442a' }) : '🚗'}</div><div class="pm-fin">ПАРА</div></div>
<div class="pm-read"><div><small>Реакция</small><b id="pmMs">— мс</b></div><div><small>Рекорд</small><b id="pmBest">— мс</b></div></div>
<p class="pm-msg" id="pmMsg">Жди зелёный. Нажмёшь раньше — фальстарт, позже — пара уже началась.</p>
<button type="button" class="pm-btn" id="pmBtn">К старту</button>
</div>`,
after: root => {
const box = $('#pmDrag', root), ls = $$('.pm-tree i', box), car = $('#pmCar', box), ms = $('#pmMs', box), bestEl = $('#pmBest', box), msg = $('#pmMsg', box), btn = $('#pmBtn', box);
let state = 'idle', t0 = 0, timers = [], best = null;
const clear = () => { timers.forEach(clearTimeout); timers = []; };
const reset = () => { ls.forEach(l => l.classList.remove('on')); car.style.transition = 'none'; car.style.transform = 'none'; void car.offsetWidth; car.style.transition = ''; box.classList.remove('bad', 'go'); };
const engine = (len) => { try{ const ac = tink.ac || (tink.ac = new (window.AudioContext || window.webkitAudioContext)()); if(ac.state === 'suspended') ac.resume(); const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(380, t + len); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + .08); g.gain.exponentialRampToValueAtTime(.0001, t + len + .15); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + len + .2); }catch(_){} };
btn.addEventListener('click', () => {
if(state === 'idle'){
clear(); reset(); state = 'stage'; btn.textContent = 'Жди зелёный…'; btn.classList.add('wait'); ms.textContent = '— мс'; msg.textContent = 'Тише… Мотор рычит, огни загораются.';
[0, 1, 2].forEach(k => timers.push(setTimeout(() => { ls[k].classList.add('on'); hmTone(440 + k * 40, .12, .05, 'square'); }, 500 + k * 520)));
timers.push(setTimeout(() => { ls[3].classList.add('on'); state = 'green'; t0 = performance.now(); btn.textContent = 'ГАЗ!'; btn.classList.remove('wait'); btn.classList.add('hot'); hmTone(1046, .22, .06, 'square'); }, 500 + 2 * 520 + 500 + Math.random() * 1100));
return;
}
if(state === 'stage'){
clear(); state = 'idle'; box.classList.add('bad'); btn.classList.remove('wait'); btn.textContent = 'К старту'; msg.textContent = 'Фальстарт! Слишком рано — пара ещё не началась, гайка ещё не выкручена.'; hmTone(150, .4, .08, 'sawtooth'); return;
}
if(state === 'green'){
const r = Math.round(performance.now() - t0); state = 'done'; btn.classList.remove('hot'); ms.textContent = r + ' мс'; engine(1.4);
const run = Math.max(.9, Math.min(2.4, .8 + r / 350)); car.style.transition = `transform ${run}s cubic-bezier(.5,0,.9,.4)`; car.style.transform = 'translateX(calc(100cqw - 100%))'; box.classList.add('go');
if(best === null || r < best){ best = r; bestEl.textContent = r + ' мс'; }
msg.textContent = r < 250 ? 'Реакция уровня Формулы-1. Пара не успеет даже начаться.' : r < 400 ? 'Достойно. До пары доедет, но заедет по пути в гараж.' : 'Гайка важнее. Пара подождёт — она всегда ждёт.';
timers.push(setTimeout(() => { state = 'idle'; btn.textContent = '↺ Ещё заезд'; }, run * 1000 + 200)); btn.textContent = 'Едет…';
}
});
}
},
'Караев|Прогульщик': {
key: 'pkaraev', kicker: 'Два сезона', tag: 'Присутствие. Отсутствие. Возвращение',
stats: [[2, 'курса на месте'], [1, 'курс «растворился»'], [4, 'курс — вернулся']],
infoTitle: 'Найди Эльчина',
quote: ['«Сел на то же место и сделал вид, что никуда не уходил».', 'Группа, четвёртый курс'],
videoTitle: 'Хроника исчезновения', videoNote: 'Пустое место у стены. Год.',
facts: ['Первые два курса можно было сверять календарь по нему', 'Третий курс: место пустое, а в списках — исправно', 'Четвёртый: вернулся как сериал, который давно считали закрытым'],
ph: ['👻', 'Хроника исчезновения', 'Плёнка засвечена. Место пустое'],
art: () => `<div class="pk-moon"></div><div class="pk-fog a"></div><div class="pk-fog b"></div><div class="pk-ghost"></div><div class="pk-stars">${Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 37) % 96}%;top:${(i * 23) % 60}%;--d:${(i % 5) * .6}s"></i>`).join('')}</div>`,
info: () => `
<div class="pk-tl">
<div class="pk-y ok"><b>1</b><span>курс</span><em>на месте</em></div>
<div class="pk-y ok"><b>2</b><span>курс</span><em>на месте</em></div>
<div class="pk-y gone"><b>3</b><span>курс</span><em>исчез</em></div>
<div class="pk-y back"><b>4</b><span>курс</span><em>вернулся</em></div>
</div>
<div class="pk-hall" id="pkHall"><div class="pk-wall">доска</div><div class="pk-seats">${Array.from({ length: 20 }, (_, i) => `<button type="button" class="pk-s" data-i="${i}" aria-label="место ${i + 1}"><u></u></button>`).join('')}</div></div>
<p class="pk-msg" id="pkMsg">Эльчин снова исчез. Он сидит на одном из мест — проверяй. Подсказки: холодно / тепло / горячо.</p>
<div class="pk-foot"><span id="pkTry">Попыток: 0</span><button type="button" class="pk-btn" id="pkAgain">Спрятать снова</button></div>`,
after: root => {
const seats = $$('.pk-s', root), msg = $('#pkMsg', root), tries = $('#pkTry', root), again = $('#pkAgain', root);
const W = 4; let hid = 0, n = 0, found = false;
const hide = () => { hid = (Math.random() * seats.length) | 0; n = 0; found = false; tries.textContent = 'Попыток: 0'; seats.forEach(s => { s.className = 'pk-s'; }); msg.textContent = 'Он спрятался заново. Ищи — нажимай на места.'; };
const dist = i => Math.abs((i % W) - (hid % W)) + Math.abs(((i / W) | 0) - ((hid / W) | 0));
seats.forEach((s, i) => s.addEventListener('click', () => {
if(found || s.classList.contains('tried')) return;
n++; tries.textContent = 'Попыток: ' + n; const d = dist(i);
if(d === 0){ found = true; s.classList.add('found'); hmTone(784, .4, .06); setTimeout(() => hmTone(1175, .6, .05), 140); msg.textContent = `Нашёл! С ${n}-й попытки. Он «вернулся» и сделал вид, что никуда не уходил.`; return; }
const lvl = d === 1 ? 'hot' : d === 2 ? 'warm' : d <= 4 ? 'cool' : 'cold';
s.classList.add('tried', lvl); hmTone(220 + (6 - Math.min(5, d)) * 90, .16, .05);
msg.textContent = { hot: 'Горячо! Он где-то совсем рядом.', warm: 'Тепло. Уже недалеко.', cool: 'Прохладно… здесь только пыль и конспекты.', cold: 'Холодно. Это вообще другой конец аудитории.' }[lvl];
}));
again.addEventListener('click', hide); hide();
}
},
'Сенченко|Прогульщик': {
key: 'psenchenko', kicker: 'Дорожная обстановка', tag: 'Едет куда угодно — лишь бы не в аудиторию',
stats: [[4, 'места, куда едет Granta'], [1, 'аудитория, куда нет'], [100, 'манёвренность', '%']],
infoTitle: 'Объезд пар',
quote: ['«Если не едет — значит, паркуется. Если не паркуется — ищет, где».', 'Группа о Диме'],
videoTitle: 'Регистратор', videoNote: 'Дорога, заправка, мойка — и мимо аудитории.',
facts: ['Знает дорогу к мойке, заправке, шиномонтажу и ещё одному месту', 'Манёвренность на уровне: объедет любую аудиторию по кругу', 'Ждать его можно как автобус в дождь'],
ph: ['🚗', 'Видеорегистратор', 'Запись дороги. Аудитории не видно'],
art: () => `<div class="ps-road"><i></i><i></i><i></i></div><div class="ps-beam l"></div><div class="ps-beam r"></div><div class="ps-sign">ПАРА →<small>нет, прямо</small></div>`,
info: () => `
<div class="ps-game" id="psGame">
<canvas id="psCv" width="300" height="330"></canvas>
<div class="ps-over on" id="psOver"><b>Объезд пар</b><span>Тапай слева/справа или жми стрелки — не въезжай в знаки «ПАРА».</span><button type="button" id="psGo">Поехали</button></div>
<div class="ps-hud"><span id="psT">0.0 c</span><span id="psB">рекорд 0.0 c</span></div>
</div>
<div class="ps-ctl"><button type="button" id="psL" aria-label="влево">◀</button><button type="button" id="psR" aria-label="вправо">▶</button></div>`,
after: root => {
const cv = $('#psCv', root), over = $('#psOver', root), go = $('#psGo', root), tEl = $('#psT', root), bEl = $('#psB', root);
const W = 300, H = 330, dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = '100%'; cv.style.aspectRatio = W + '/' + H;
const g = cv.getContext('2d'); g.scale(dpr, dpr);
const RX = 40, RW = 220, LW = RW / 3, cx = i => RX + LW * i + LW / 2;
let lane = 1, x = cx(1), run = false, obs = [], t = 0, last = 0, spawn = 0, best = 0, off = 0, raf = 0, shake = 0;
const move = d => { if(!run) return; lane = Math.max(0, Math.min(2, lane + d)); hmTone(300 + lane * 60, .05, .025, 'triangle'); };
const car = (px, py, w, h) => {
g.save(); g.translate(px, py);
g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(2, h / 2 + 2, w * .6, 7, 0, 0, 7); g.fill();
const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, '#d9dde0'); gr.addColorStop(.5, '#fff'); gr.addColorStop(1, '#b9bfc4');
g.fillStyle = gr; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 8); g.fill();
g.fillStyle = '#15202a'; g.beginPath(); g.roundRect(-w / 2 + 4, -h / 2 + 12, w - 8, 14, 3); g.fill(); g.beginPath(); g.roundRect(-w / 2 + 4, h / 2 - 22, w - 8, 12, 3); g.fill();
g.fillStyle = '#f3f6f8'; g.fillRect(-w / 2 + 6, -h / 2 + 27, w - 12, h - 52);
g.fillStyle = '#ffe9a6'; g.fillRect(-w / 2 + 3, -h / 2 + 2, 6, 4); g.fillRect(w / 2 - 9, -h / 2 + 2, 6, 4);
g.fillStyle = '#d33'; g.fillRect(-w / 2 + 3, h / 2 - 5, 6, 3); g.fillRect(w / 2 - 9, h / 2 - 5, 6, 3);
g.restore();
};
const sign = (o) => {
g.save(); g.translate(o.x, o.y);
g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-27, 14, 56, 8);
g.fillStyle = '#1257c4'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.roundRect(-28, -18, 56, 38, 6); g.fill(); g.stroke();
g.fillStyle = '#fff'; g.font = '700 12px Manrope, Arial, sans-serif'; g.textAlign = 'center'; g.fillText('ПАРА', 0, -2); g.font = '800 11px Manrope, Arial, sans-serif'; g.fillStyle = '#ffd21f'; g.fillText('№ ' + o.n, 0, 13);
g.restore();
};
const draw = () => {
g.fillStyle = '#12301f'; g.fillRect(0, 0, W, H); g.fillStyle = '#242a2f'; g.fillRect(RX, 0, RW, H);
g.fillStyle = '#fff'; g.fillRect(RX - 3, 0, 3, H); g.fillRect(RX + RW, 0, 3, H);
g.fillStyle = 'rgba(255,255,255,.7)'; for(let k = 1; k < 3; k++) for(let y = -40 + off % 40; y < H; y += 40) g.fillRect(RX + LW * k - 1, y, 2, 20);
obs.forEach(sign); car(x, H - 62, 34, 60);
if(shake > 0){ g.fillStyle = `rgba(255,80,60,${shake / 14})`; g.fillRect(0, 0, W, H); }
};
const end = () => {
run = false; cancelAnimationFrame(raf); shake = 12; fxNoise(.3, 200, .2, 'lowpass'); hmTone(130, .45, .08, 'sawtooth'); draw();
if(t > best){ best = t; bEl.textContent = `рекорд ${best.toFixed(1)} c`; }
$('b', over).textContent = 'Врезался в пару'; $('span', over).textContent = `Проехал ${t.toFixed(1)} с, а потом всё-таки пара. Бывает с каждым.`; go.textContent = '↺ Ещё заезд'; over.classList.add('on');
};
const loop = ts => {
if(!run || !hmAlive(root)) return;
const dt = Math.min(.05, (ts - last) / 1000 || .016); last = ts; t += dt; const sp = 130 + t * 9;
x += (cx(lane) - x) * Math.min(1, dt * 14); off += sp * dt; spawn -= dt;
if(spawn <= 0){ const ln = (Math.random() * 3) | 0; obs.push({ x: cx(ln), y: -30, n: 1 + ((t / 3) | 0) % 9, ln }); if(t > 8 && Math.random() < .4){ const l2 = (ln + 1 + ((Math.random() * 2) | 0)) % 3; obs.push({ x: cx(l2), y: -30 - 20, n: 2, ln: l2 }); } spawn = Math.max(.42, 1 - t * .02); }
obs.forEach(o => { o.y += sp * dt; }); obs = obs.filter(o => o.y < H + 40);
for(const o of obs){ if(Math.abs(o.x - x) < 28 && Math.abs(o.y - (H - 62)) < 36){ draw(); return end(); } }
tEl.textContent = t.toFixed(1) + ' c'; draw(); raf = requestAnimationFrame(loop);
};
const start = () => { lane = 1; x = cx(1); obs = []; t = 0; spawn = .6; shake = 0; run = true; over.classList.remove('on'); last = performance.now(); raf = requestAnimationFrame(loop); hmTone(523, .1, .05, 'triangle'); };
go.addEventListener('click', start);
$('#psL', root).addEventListener('click', () => move(-1)); $('#psR', root).addEventListener('click', () => move(1));
cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); move(e.clientX < r.left + r.width / 2 ? -1 : 1); });
const key = e => { if(!hmAlive(root)){ document.removeEventListener('keydown', key); return; } if(e.key === 'ArrowLeft') move(-1); if(e.key === 'ArrowRight') move(1); };
document.addEventListener('keydown', key);
draw();
}
}
});
(function(){
const tab = document.getElementById('tab3'); if(!tab) return;
const NAMES = ['ХОДЯЩИЙ', 'ПРОГУЛЬЩИК', 'ФЛЕШБЭК', 'ЗАВОД', 'СТУДЕНТ', 'МАШИНА', 'КОРОЛЬ'];
const ACC = ['#47f0a0', '#e0554a', '#ff3a9a', '#ffb02e', '#e8c26a', '#ff4d3a', '#e8c15a'];
const FULL = ['Самый Ходящий', 'Главный прогульщик', 'Флешбэк года', 'Заводчанин года', 'Прилежный студент', 'Машина года', 'Король Группы'];
const rail = document.createElement('div'); rail.className = 'pm-rail';
rail.innerHTML = `<div class="pm-seg">${NAMES.map((n, i) => `<span data-i="${i}"><b>${String(i + 1).padStart(2, '0')}</b><i></i><em>${n}</em></span>`).join('')}</div>
<div class="pm-meta"><span id="pmNo">НОМИНАЦИЯ 01 / 07</span><span id="pmNm">${FULL[0]}</span><span id="pmCnt">— кандидатов</span></div>`;
const track = $('.progress-track', tab); (track || $('.voting-heading', tab)).after(rail);
const segs = $$('.pm-seg span', rail), no = $('#pmNo', rail), nm = $('#pmNm', rail), cnt = $('#pmCnt', rail);
const sync = m => {
segs.forEach((s, i) => { s.classList.toggle('d', i < m); s.classList.toggle('c', i === m); s.style.setProperty('--c', ACC[i]); });
no.textContent = 'НОМИНАЦИЯ ' + String(m + 1).padStart(2, '0') + ' / ' + String(NAMES.length).padStart(2, '0'); nm.textContent = FULL[m] || '';
const f = $$('.nomination-frame')[m]; const k = f ? $$('.nominee:not([hidden])', f).length : 0; cnt.textContent = k + ' ' + plural(k, 'кандидат', 'кандидата', 'кандидатов');
document.body.style.setProperty('--pmA', ACC[m] || '#fff');
};
let cur = -1;
const poll = () => {
const shown = getComputedStyle(tab).display !== 'none';
const m = Math.max(0, Math.min(NAMES.length - 1, typeof currentNominationIndex === 'number' ? currentNominationIndex : 0));
if(shown){ if(document.body.dataset.pm !== String(m)) document.body.dataset.pm = m; if(m !== cur){ cur = m; sync(m); } }
else if(document.body.dataset.pm !== undefined){ delete document.body.dataset.pm; cur = -1; }
requestAnimationFrame(poll);
};
requestAnimationFrame(poll);
$$('.nomination-frame').forEach(f => { ['c1', 'c2', 'c3', 'c4'].forEach(c => { const i = document.createElement('i'); i.className = 'pm-cm ' + c; i.setAttribute('aria-hidden', 'true'); f.appendChild(i); }); });
let tick = false;
tab.addEventListener('scroll', () => { if(tick) return; tick = true; requestAnimationFrame(() => { tick = false; tab.style.setProperty('--sy', Math.min(600, tab.scrollTop) + ''); }); }, { passive: true });
const mo = new MutationObserver(ms => ms.forEach(m => { const f = m.target; if(f.classList?.contains('nomination-frame') && f.classList.contains('current') && !(m.oldValue || '').includes('current')){ f.classList.remove('pm-in'); void f.offsetWidth; f.classList.add('pm-in'); tab.scrollTo?.({ top: 0 }); } }));
$$('.nomination-frame').forEach(f => mo.observe(f, { attributes: true, attributeFilter: ['class'], attributeOldValue: true }));
})();
const hgBest = (k, v) => { try{ if(v === undefined) return +localStorage.getItem('hg_' + k) || 0; const o = +localStorage.getItem('hg_' + k) || 0; if(v > o) localStorage.setItem('hg_' + k, v); return Math.max(o, v); }catch(_){ return v || 0; } };
const hgRnd = (a, b) => a + Math.random() * (b - a);
const hgClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hgShell = (id, title, s1, s2, hint, canvas = true) => `
<div class="hg" id="hg-${id}" data-g="${id}">
<div class="hg-top"><b>${title}</b><span class="hg-s" data-s="1">${s1}</span><span class="hg-s" data-s="2">${s2}</span></div>
<div class="hg-stage">${canvas ? '<canvas class="hg-cv" width="320" height="440"></canvas>' : '<div class="hg-dom"></div>'}
<div class="hg-ov"><i class="hg-ico"></i><h4></h4><p></p><button type="button" class="hg-go">Играть</button></div></div>
<div class="hg-hint">${hint}</div><div class="hg-rec"></div></div>`;
const hgMount = (root, id) => {
const box = root.querySelector('#hg-' + id); if(!box || box._on) return null; box._on = 1;
const cv = box.querySelector('canvas'), ov = box.querySelector('.hg-ov');
if(cv){ const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1)); cv.width = 320 * dpr; cv.height = 440 * dpr; cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); }
const g = { box, cv, ov, ctx: cv?.getContext('2d'), W: 320, H: 440, run: false, raf: 0 };
g.hud = (a, b) => { if(a != null) box.querySelector('[data-s="1"]').innerHTML = a; if(b != null) box.querySelector('[data-s="2"]').innerHTML = b; };
g.rec = (t) => { box.querySelector('.hg-rec').textContent = t; };
g.show = (ico, h, p, btn) => { ov.querySelector('.hg-ico').textContent = ico; ov.querySelector('h4').textContent = h; ov.querySelector('p').innerHTML = p; ov.querySelector('.hg-go').textContent = btn; ov.classList.add('on'); box.classList.remove('live'); };
g.hide = () => { ov.classList.remove('on'); box.classList.add('live'); };
g.loop = (step) => {
let last = performance.now(); g.run = true;
const f = now => {
if(!g.run || !hmAlive(box)) { g.run = false; return; }
const dt = Math.min(.05, (now - last) / 1000); last = now; step(dt, now / 1000);
if(g.run) g.raf = requestAnimationFrame(f);
};
g.raf = requestAnimationFrame(f);
};
g.stop = () => { g.run = false; cancelAnimationFrame(g.raf); };
return g;
};
const hgAliev = root => {
const g = hgMount(root, 'aliev'); if(!g) return;
const { ctx: c, W, H } = g, LANES = [92, 160, 228], GOAL = 420, BASE = 45;
let S;
const reset = () => ({ lane: 1, x: LANES[1], dist: 0, time: BASE, v: 200, obs: [], spawn: 0, shake: 0, flash: 0, tilt: 0, hit: 0, got: 0, lines: 0, txt: [] });
const hud = () => g.hud('⏱ ' + hmPad(Math.max(0, Math.ceil(S.time) / 60 | 0)) + ':' + hmPad(Math.max(0, Math.ceil(S.time)) % 60), Math.floor(S.dist) + ' / ' + GOAL + ' м');
const move = d => { if(!g.run) return; const n = hgClamp(S.lane + d, 0, 2); if(n !== S.lane){ S.lane = n; hmTone(520 + n * 90, .06, .035, 'triangle'); } };
g.box.addEventListener('pointerdown', e => { if(e.target.closest('.hg-ov')) return; const r = g.cv.getBoundingClientRect(); move((e.clientX - r.left) / r.width < .5 ? -1 : 1); });
let sx = null; g.cv.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
g.cv.addEventListener('touchmove', e => { if(sx == null) return; const dx = e.touches[0].clientX - sx; if(Math.abs(dx) > 28){ move(dx > 0 ? 1 : -1); sx = e.touches[0].clientX; } }, { passive: true });
const key = e => { if(!hmAlive(g.box)) return document.removeEventListener('keydown', key); if(!g.run) return; if(['ArrowLeft', 'a', 'A', 'ф'].includes(e.key)){ move(-1); e.preventDefault(); } if(['ArrowRight', 'd', 'D', 'в'].includes(e.key)){ move(1); e.preventDefault(); } };
document.addEventListener('keydown', key);
const spawnRow = () => {
const free = Math.floor(Math.random() * 3), r = Math.random();
for(let l = 0; l < 3; l++){
if(l === free) { if(r < .28) S.obs.push({ l, y: -30, t: 'clock' }); continue; }
if(Math.random() < .85) S.obs.push({ l, y: -30, t: Math.random() < .4 ? 'wet' : 'crowd', k: Math.random() * 3 | 0 });
}
};
const draw = t => {
c.save(); if(S.shake > 0) c.translate(hgRnd(-S.shake, S.shake), hgRnd(-S.shake, S.shake));
c.fillStyle = '#06121a'; c.fillRect(-10, -10, W + 20, H + 20);
const off = S.lines % 60;
for(let y = -60 + off; y < H; y += 60){
[[0, 1], [W - 46, -1]].forEach(([x0]) => {
c.fillStyle = '#0e2a3a'; c.fillRect(x0, y, 46, 54); c.fillStyle = '#143a50'; c.fillRect(x0 + 3, y + 3, 40, 48);
c.fillStyle = 'rgba(53,208,255,.22)'; c.fillRect(x0 + 8, y + 10, 30, 2); c.fillRect(x0 + 8, y + 40, 30, 2); c.fillStyle = '#35d0ff'; c.fillRect(x0 + (x0 ? 10 : 34), y + 24, 3, 8);
});
}
const g1 = c.createLinearGradient(0, 0, 0, H); g1.addColorStop(0, '#0a2230'); g1.addColorStop(1, '#10394d'); c.fillStyle = g1; c.fillRect(46, 0, W - 92, H);
c.strokeStyle = 'rgba(125,255,176,.25)'; c.lineWidth = 2; c.setLineDash([16, 18]); c.lineDashOffset = -S.lines;
[126, 194].forEach(x => { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }); c.setLineDash([]);
S.obs.forEach(o => {
const x = LANES[o.l], y = o.y;
if(o.t === 'crowd'){
for(let i = 0; i < 3; i++){ const dx = (i - 1) * 17, dy = (i === 1 ? -4 : 3); c.fillStyle = ['#5a6c80', '#7a5a6c', '#506a5a'][(o.k + i) % 3]; c.beginPath(); c.arc(x + dx, y + dy, 11, 0, 7); c.fill(); c.fillStyle = '#e8d2b8'; c.beginPath(); c.arc(x + dx, y + dy - 12, 6, 0, 7); c.fill(); }
} else if(o.t === 'wet'){
c.fillStyle = 'rgba(90,190,255,.35)'; c.beginPath(); c.ellipse(x, y, 30, 15, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(190,235,255,.7)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y, 20, 9, 0, 0, 7); c.stroke();
c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(x, y - 20); c.lineTo(x + 11, y + 2); c.lineTo(x - 11, y + 2); c.closePath(); c.fill(); c.fillStyle = '#222'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('!', x, y);
} else {
const p = 1 + Math.sin(t * 8) * .08; c.save(); c.translate(x, y); c.scale(p, p); c.fillStyle = 'rgba(125,255,176,.18)'; c.beginPath(); c.arc(0, 0, 20, 0, 7); c.fill(); c.strokeStyle = '#7dffb0'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 13, 0, 7); c.stroke(); c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 0); c.lineTo(6, 4); c.stroke(); c.restore();
}
});
const px = S.x, py = 360; c.save(); c.translate(px, py); c.rotate(S.tilt);
c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, 16, 15, 6, 0, 0, 7); c.fill();
for(let i = 1; i < 5; i++){ c.fillStyle = `rgba(53,208,255,${.22 - i * .04})`; c.beginPath(); c.arc(0, i * 12, 14 - i * 2, 0, 7); c.fill(); }
c.fillStyle = S.hit > 0 && ((t * 20) | 0) % 2 ? '#ff6b6b' : '#35d0ff'; c.beginPath(); c.arc(0, 0, 15, 0, 7); c.fill();
c.fillStyle = '#06202c'; c.font = '900 15px Oswald,Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('А', 0, 1);
const sw = Math.sin(t * 22) * 5; c.fillStyle = '#7dffb0'; c.fillRect(-12 + sw, 12, 7, 5); c.fillRect(5 - sw, 12, 7, 5);
c.restore();
S.txt.forEach(q => { c.globalAlpha = hgClamp(q.a, 0, 1); c.fillStyle = q.col; c.font = '800 13px Oswald,Arial'; c.textAlign = 'center'; c.fillText(q.s, q.x, q.y); }); c.globalAlpha = 1;
const vg = c.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 280); vg.addColorStop(0, 'transparent'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
if(S.flash > 0){ c.fillStyle = `rgba(255,70,70,${S.flash * .35})`; c.fillRect(0, 0, W, H); }
c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(W - 8, 20, 4, H - 40); c.fillStyle = '#7dffb0'; const pr = hgClamp(S.dist / GOAL, 0, 1); c.fillRect(W - 8, H - 20 - (H - 40) * pr, 4, (H - 40) * pr);
c.restore();
};
const finish = ok => {
g.stop(); const m = Math.floor(S.dist), sc = ok ? 1000 + Math.round(S.time * 20) : m, b = hgBest('aliev', sc);
if(ok){ hmTone(660, .12, .06); setTimeout(() => hmTone(880, .2, .06), 120); }
g.show(ok ? '🛂' : '🔔', ok ? 'Успел. Как всегда' : 'Звонок. Ты опоздал', ok ? `Запас до звонка: <b>${S.time.toFixed(1)} с</b>. Алиев такое делает каждый день.` : `Пробежал <b>${m} м</b> из ${GOAL}. Алиеву столько не надо — у него «опозданий: 0».`, 'Ещё раз');
g.rec('Рекорд: ' + (b >= 1000 ? 'успел с запасом ' + ((b - 1000) / 20).toFixed(1) + ' с' : b + ' м'));
};
const start = () => {
S = reset(); g.hide(); hud();
g.loop((dt, t) => {
S.time -= dt; const target = hgClamp(200 + S.dist * .33, 200, 330) * (S.hit > 0 ? .55 : 1); S.v += (target - S.v) * Math.min(1, dt * 3);
S.dist += S.v * dt / 22; S.lines += S.v * dt; S.x += (LANES[S.lane] - S.x) * Math.min(1, dt * 16); S.tilt = (LANES[S.lane] - S.x) * .012;
S.spawn -= S.v * dt; if(S.spawn <= 0){ spawnRow(); S.spawn = hgRnd(150, 215) - Math.min(50, S.dist * .08); }
S.hit = Math.max(0, S.hit - dt); S.shake = Math.max(0, S.shake - dt * 30); S.flash = Math.max(0, S.flash - dt * 3);
S.obs.forEach(o => { o.y += S.v * dt; if(!o.done && Math.abs(o.y - 360) < 24 && Math.abs(LANES[o.l] - S.x) < 26){
o.done = 1;
if(o.t === 'clock'){ S.time += 3; S.txt.push({ x: S.x, y: 320, a: 1.4, col: '#7dffb0', s: '+3 с' }); hmTone(900, .1, .05); }
else { S.time -= o.t === 'crowd' ? 2 : 1; S.hit = .9; S.shake = 7; S.flash = 1; S.v *= .4; S.txt.push({ x: S.x, y: 320, a: 1.4, col: '#ff7a7a', s: o.t === 'crowd' ? 'толпа −2 с' : 'мокро −1 с' }); fxNoise(.15, 500, .05, 'lowpass'); }
}});
S.obs = S.obs.filter(o => o.y < H + 40); S.txt.forEach(q => { q.y -= 30 * dt; q.a -= dt; }); S.txt = S.txt.filter(q => q.a > 0);
draw(t); hud();
if(S.dist >= GOAL) finish(true); else if(S.time <= 0){ S.time = 0; finish(false); }
});
};
g.ov.querySelector('.hg-go').addEventListener('click', start);
S = reset(); draw(0); hud(); g.rec(hgBest('aliev') ? 'Рекорд: ' + (hgBest('aliev') >= 1000 ? 'успел' : hgBest('aliev') + ' м') : 'Рекорда пока нет');
g.show('🛂', 'Успеть до звонка', 'Коридор 420 метров, 45 секунд до звонка. Обходи толпу и лужи, лови часы <b>+3 с</b>.', 'Бежать');
};
const hgGalkin = root => {
const g = hgMount(root, 'galkin'); if(!g) return;
const { ctx: c, W, H } = g, LX = [50, 125, 200, 275], HY = 370, FALL = 1.55, N = 44, BEAT = .5;
const NOTE = [330, 392, 440, 523], NAMES = ['Матан', 'Физика', 'Прога', 'Физра'], COL = ['#f6b26b', '#6fa3d8', '#ffd27a', '#9fd8ff'];
let S;
const chart = () => { const a = []; let lane = 1; for(let i = 0; i < N; i++){ const r = Math.random(); lane = r < .45 ? (lane + (Math.random() < .5 ? 1 : -1) + 4) % 4 : (Math.random() * 4 | 0); a.push({ t: 2.2 + i * BEAT * (i > 20 && Math.random() < .35 ? .75 : 1) + (i > 20 ? 0 : 0), l: lane, s: 0 }); }
for(let i = 1; i < a.length; i++) if(a[i].t < a[i - 1].t + .26) a[i].t = a[i - 1].t + .38; return a; };
const reset = () => ({ n: chart(), t0: 0, now: 0, perf: 0, good: 0, miss: 0, combo: 0, best: 0, fx: [], press: [0, 0, 0, 0], done: 0 });
const hud = () => g.hud('Пропущено: <b>' + S.miss + '</b>', 'Серия ×' + S.combo);
const judge = l => {
if(!g.run) return; S.press[l] = 1; hmTone(NOTE[l], .1, .04, 'triangle');
let best = null, bd = 9; S.n.forEach(n => { if(!n.s && n.l === l){ const d = Math.abs(n.t - S.now); if(d < bd){ bd = d; best = n; } } });
if(best && bd < .17){ best.s = bd < .075 ? 2 : 1; if(best.s === 2) S.perf++; else S.good++; S.combo++; S.best = Math.max(S.best, S.combo); S.fx.push({ x: LX[l], y: HY, a: 1, t: best.s === 2 ? 'ИДЕАЛЬНО' : 'ХОРОШО', col: best.s === 2 ? '#ffe08a' : '#9fd8ff' }); hmTone(NOTE[l] * 2, .16, .05, 'sine'); }
else { S.fx.push({ x: LX[l], y: HY - 10, a: .6, t: '·', col: '#556' }); }
hud();
};
const KEYS = { d: 0, в: 0, f: 1, а: 1, j: 2, о: 2, k: 3, л: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
const key = e => { if(!hmAlive(g.box)) return document.removeEventListener('keydown', key); if(!g.run || e.repeat) return; const l = KEYS[e.key]; if(l != null){ judge(l); e.preventDefault(); } };
document.addEventListener('keydown', key);
g.cv.addEventListener('pointerdown', e => { const r = g.cv.getBoundingClientRect(); judge(hgClamp(Math.floor((e.clientX - r.left) / r.width * 4), 0, 3)); });
const draw = () => {
const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0e1827'); bg.addColorStop(1, '#26405f'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
for(let i = 0; i < 30; i++){ const x = (i * 97) % W, y = (i * 53) % 250; c.fillStyle = `rgba(255,240,200,${.25 + (Math.sin(S.perf * .0 + i + S.now * 2) + 1) * .2})`; c.fillRect(x, y, 2, 2); }
c.fillStyle = 'rgba(246,178,107,.1)'; for(let i = 0; i < 4; i++) c.fillRect(LX[i] - 31, 0, 62, H);
c.fillStyle = 'rgba(0,0,0,.25)'; for(let i = 0; i < 4; i++){ c.fillRect(LX[i] - 31, 0, 1, H); c.fillRect(LX[i] + 30, 0, 1, H); }
c.fillStyle = '#f6b26b'; c.fillRect(8, HY - 1, W - 16, 3); c.shadowColor = '#f6b26b'; c.shadowBlur = 14; c.fillRect(8, HY - 1, W - 16, 2); c.shadowBlur = 0;
for(let i = 0; i < 4; i++){ c.strokeStyle = COL[i]; c.lineWidth = 3; c.fillStyle = S.press[i] > 0 ? COL[i] : 'rgba(255,255,255,.04)'; c.beginPath(); c.arc(LX[i], HY, 24, 0, 7); c.fill(); c.stroke(); c.fillStyle = S.press[i] > 0 ? '#14202f' : COL[i]; c.font = '700 10px Oswald,Arial'; c.textAlign = 'center'; c.fillText('DFJK'[i], LX[i], HY + 4); S.press[i] = Math.max(0, S.press[i] - .12); }
S.n.forEach(n => { if(n.s) return; const y = HY - (n.t - S.now) / FALL * (HY + 20); if(y < -30 || y > H + 20) return;
c.fillStyle = COL[n.l]; c.beginPath(); c.roundRect(LX[n.l] - 25, y - 14, 50, 28, 8); c.fill(); c.fillStyle = '#14202f'; c.font = '800 11px Oswald,Arial'; c.textAlign = 'center'; c.fillText(NAMES[n.l].toUpperCase(), LX[n.l], y + 4); });
S.fx.forEach(q => { c.globalAlpha = hgClamp(q.a, 0, 1); c.fillStyle = q.col; c.font = '900 13px Oswald,Arial'; c.textAlign = 'center'; c.fillText(q.t, q.x, q.y - 34 + (1 - q.a) * -24); }); c.globalAlpha = 1;
if(S.combo > 4){ c.fillStyle = 'rgba(246,178,107,.9)'; c.font = '900 28px Oswald,Arial'; c.textAlign = 'center'; c.fillText(S.combo, W / 2, 70); c.font = '700 10px Oswald,Arial'; c.fillText('ПАР ПОДРЯД', W / 2, 86); }
c.fillStyle = 'rgba(255,255,255,.05)'; c.font = 'italic 11px Georgia'; c.textAlign = 'center'; c.fillText('Галкин был здесь', W / 2, 24);
};
const finish = () => {
g.stop(); const total = S.n.length, sc = Math.max(0, S.perf * 100 + S.good * 60 - S.miss * 80 + S.best * 5), b = hgBest('galkin', sc);
const ok = S.miss === 0; if(ok){ hmTone(523, .14, .06); setTimeout(() => hmTone(784, .26, .06), 140); }
g.show(ok ? '🌙' : '📓', ok ? 'Ни одной пропущенной' : 'Есть пропуски: ' + S.miss, `Идеально: <b>${S.perf}</b> · хорошо: <b>${S.good}</b> · пропущено: <b>${S.miss}</b> из ${total}.<br>${ok ? 'Галкин пришёл на все пары. Все до одной.' : 'Галкин бы расстроился. Но он бы пришёл.'}`, 'Ещё раз');
g.rec('Лучший счёт: ' + b);
};
const start = () => {
S = reset(); g.hide(); S.t0 = performance.now(); hud();
g.loop(dt => {
S.now = (performance.now() - S.t0) / 1000; S.perf = S.perf;
S.n.forEach(n => { if(!n.s && S.now - n.t > .17){ n.s = -1; S.miss++; S.combo = 0; S.fx.push({ x: LX[n.l], y: HY, a: 1, t: 'ПРОПУСК', col: '#ff7a7a' }); hud(); } });
S.fx.forEach(q => q.a -= dt * 1.6); S.fx = S.fx.filter(q => q.a > 0); draw();
if(S.now > S.n[S.n.length - 1].t + .6) finish();
});
};
g.ov.querySelector('.hg-go').addEventListener('click', start);
S = reset(); draw(); hud(); g.rec(hgBest('galkin') ? 'Лучший счёт: ' + hgBest('galkin') : 'Рекорда пока нет');
g.show('🌙', 'Ни одной пропущенной', 'Пары падают на линию. Жми в такт: <b>D F J K</b> или тапай по дорожкам. Пропустишь пару — Галкин расстроится.', 'Начать');
};
const hgGolikov = root => {
const g = hgMount(root, 'golikov'); if(!g) return;
const { ctx: c, W, H } = g, STN = [{ n: 'Семестр 2', d: 230 }, { n: 'Семестр 5', d: 300 }, { n: 'Диплом', d: 370 }], ZONE = 7;
let S, hold = false;
const reset = () => ({ i: 0, x: 0, v: 21, res: [], phase: 'run', wait: 0, sound: 0, tx: 0 });
const hud = () => g.hud('Станция: <b>' + (S.i + 1) + '/3</b>', 'Скорость ' + Math.round(S.v * 3.6) + ' км/ч');
const press = on => { hold = on; g.box.classList.toggle('brk', on); };
g.cv.addEventListener('pointerdown', e => { e.preventDefault(); press(true); });
window.addEventListener('pointerup', () => press(false)); g.cv.addEventListener('pointerleave', () => press(false));
const key = e => { if(!hmAlive(g.box)) return document.removeEventListener('keydown', key); if(e.code === 'Space' && g.run){ e.preventDefault(); press(e.type === 'keydown'); } };
document.addEventListener('keydown', key); document.addEventListener('keyup', key);
const grade = err => err < .7 ? ['ИДЕАЛЬНО', 100] : err < 1.8 ? ['ОТЛИЧНО', 80] : err < 3.5 ? ['В ДВЕРИ', 55] : ['ДАЛЕКО', 25];
const draw = t => {
const st = STN[S.i], plat = st.d, cam = S.x - 90;
c.fillStyle = '#e7ebee'; c.fillRect(0, 0, W, H);
c.fillStyle = '#d7dde2'; c.fillRect(0, 0, W, 250); c.strokeStyle = 'rgba(0,0,0,.06)'; c.lineWidth = 1;
for(let x = -(cam * .6 % 40); x < W; x += 40){ c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 250); c.stroke(); } for(let y = 30; y < 250; y += 40){ c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
for(let i = -2; i < 12; i++){ const x = i * 90 - (cam * .6 % 90) - 90 + 90; c.fillStyle = '#c0c8cf'; c.fillRect(x, 0, 16, 250); c.fillStyle = '#d3202b'; c.fillRect(x, 120, 16, 6); }
const px = (plat - cam) * 6; c.fillStyle = '#9ba4ac'; c.fillRect(0, 250, W, 40);
c.fillStyle = '#12803c'; c.fillRect(0, 288, W, 3);
c.fillStyle = '#f5c518'; c.fillRect(0, 250, W, 4);
const zx = (plat - ZONE / 2 - cam) * 6 + 90 - 90 * 0, zw = ZONE * 6; const zl = 210 + (plat - S.x) * 6 - zw / 2;
c.fillStyle = 'rgba(18,128,60,.22)'; c.fillRect(zl, 254, zw, 34); c.strokeStyle = '#12803c'; c.lineWidth = 2; c.setLineDash([5, 4]); c.strokeRect(zl, 254, zw, 34); c.setLineDash([]);
c.fillStyle = '#12803c'; c.font = '800 10px Oswald,Arial'; c.textAlign = 'center'; c.fillText('СТОП-МЕТКА', zl + zw / 2, 276);
const sx = zl + zw / 2; c.fillStyle = '#13202b'; c.fillRect(sx - 56, 40, 112, 36); c.fillStyle = '#d3202b'; c.fillRect(sx - 56, 40, 112, 5); c.fillStyle = '#fff'; c.font = '800 15px Oswald,Arial'; c.fillText(st.n.toUpperCase(), sx, 66);
c.fillStyle = '#4a525a'; c.fillRect(0, 330, W, 6); c.fillStyle = '#2d3238'; c.fillRect(0, 336, W, 3); for(let x = -((S.x * 6) % 24); x < W; x += 24) c.fillRect(x, 340, 10, 5);
const tx = 90 - 70; c.save(); c.translate(tx, 0);
c.fillStyle = '#1d4e89'; c.beginPath(); c.roundRect(0, 270, 190, 58, [10, 24, 6, 6]); c.fill(); c.fillStyle = '#e9edf0'; c.fillRect(0, 296, 190, 8);
for(let i = 0; i < 4; i++){ c.fillStyle = '#bfe3f7'; c.fillRect(14 + i * 38, 280, 28, 18); }
c.fillStyle = '#ffe9a8'; c.fillRect(176, 306, 10, 8); c.fillStyle = '#d3202b'; c.fillRect(0, 322, 190, 4);
c.fillStyle = '#222'; [28, 60, 130, 162].forEach(x => { c.beginPath(); c.arc(x, 330, 7, 0, 7); c.fill(); });
c.restore();
c.strokeStyle = '#d3202b'; c.lineWidth = 2; c.beginPath(); c.moveTo(tx + 190, 262); c.lineTo(tx + 190, 336); c.stroke();
c.fillStyle = '#13202b'; c.fillRect(0, 360, W, 80);
const sp = hgClamp(S.v / 24, 0, 1); c.strokeStyle = '#2d3a46'; c.lineWidth = 10; c.beginPath(); c.arc(70, 428, 52, Math.PI, 0); c.stroke();
c.strokeStyle = sp > .8 ? '#d3202b' : '#12803c'; c.beginPath(); c.arc(70, 428, 52, Math.PI, Math.PI + Math.PI * sp); c.stroke();
c.fillStyle = '#fff'; c.font = '900 20px Oswald,Arial'; c.fillText(Math.round(S.v * 3.6), 70, 420); c.font = '700 9px Oswald,Arial'; c.fillStyle = '#9fb0bf'; c.fillText('КМ/Ч', 70, 432);
const dist = Math.max(0, plat - S.x); c.fillStyle = '#fff'; c.font = '900 24px Oswald,Arial'; c.textAlign = 'left'; c.fillText(dist.toFixed(0) + ' м', 150, 410); c.font = '700 10px Oswald,Arial'; c.fillStyle = '#9fb0bf'; c.fillText('ДО СТОП-МЕТКИ', 150, 426);
c.textAlign = 'center'; c.fillStyle = hold ? '#d3202b' : '#2d3a46'; c.beginPath(); c.roundRect(244, 376, 66, 50, 10); c.fill(); c.fillStyle = '#fff'; c.font = '800 11px Oswald,Arial'; c.fillText('ТОРМОЗ', 277, 405);
if(S.phase === 'stop'){ const gr = S.last; c.fillStyle = 'rgba(19,32,43,.88)'; c.fillRect(30, 130, 260, 70); c.fillStyle = gr[1] > 70 ? '#4ade80' : '#ffcf5a'; c.font = '900 26px Oswald,Arial'; c.fillText(gr[0], W / 2, 168); c.fillStyle = '#fff'; c.font = '600 11px Oswald,Arial'; c.fillText('отклонение ' + S.err.toFixed(1) + ' м', W / 2, 188); }
if(S.phase === 'over'){ c.fillStyle = 'rgba(211,32,43,.88)'; c.fillRect(30, 130, 260, 70); c.fillStyle = '#fff'; c.font = '900 24px Oswald,Arial'; c.fillText('ПРОЕХАЛ СТАНЦИЮ', W / 2, 172); }
};
const finish = () => {
g.stop(); const sc = S.res.reduce((a, b) => a + b, 0), b = hgBest('golikov', sc), ok = sc >= 240;
g.show('🚇', ok ? 'Диплом получен' : 'Конечная', `Баллы: <b>${S.res.join(' + ')} = ${sc}</b> из 300.<br>${ok ? 'Голиков довёз всех до диплома без единой аварийной остановки.' : 'Поезд дошёл. Но Голиков остановил бы точнее.'}`, 'Ещё раз'); g.rec('Лучший счёт: ' + b);
};
const start = () => {
S = reset(); g.hide(); hud();
g.loop((dt, t) => {
const st = STN[S.i];
if(S.phase === 'run'){
if(hold){ S.v = Math.max(0, S.v - (S.v > 8 ? 9 : 5) * dt); S.sound -= dt; if(S.sound <= 0 && S.v > .5){ fxNoise(.08, 2500, .01 * (S.v / 10 + .3), 'bandpass'); S.sound = .08; } }
else S.v = Math.min(22, S.v + (S.v < 6 ? 2.2 : 5) * dt);
S.x += S.v * dt;
const err = Math.abs(S.x - st.d);
if(S.v < .25 && hold && err <= ZONE * 1.4 && S.x > st.d - ZONE * 1.5){ S.v = 0; S.err = err; S.last = grade(err); S.res.push(S.last[1]); S.phase = 'stop'; S.wait = 1.5; hmTone(S.last[1] > 70 ? 880 : 520, .25, .06); }
else if(S.x > st.d + ZONE * 1.2 + 8){ S.res.push(0); S.phase = 'over'; S.wait = 1.4; hmTone(180, .35, .07, 'sawtooth'); }
} else { S.wait -= dt; if(S.wait <= 0){ if(S.i >= 2){ draw(t); return finish(); } S.i++; S.x = 0; S.v = 21; S.phase = 'run'; hold = false; } }
draw(t); hud();
});
};
g.ov.querySelector('.hg-go').addEventListener('click', start);
S = reset(); draw(0); hud(); g.rec(hgBest('golikov') ? 'Лучший счёт: ' + hgBest('golikov') : 'Рекорда пока нет');
g.show('🚇', 'Остановись у платформы', 'Три станции. <b>Зажми «Тормоз»</b> (или пробел) — отпусти, чтобы разогнаться. Встань точно в зелёную метку.', 'Поехали');
};
const hgKulikov = root => {
const g = hgMount(root, 'kulikov'); if(!g) return;
const { ctx: c, W, H } = g, ROUNDS = 5, BELL = 30 * 1; /* звонок = 08:30:00 → отсчёт внутри минуты 29 → t от 0 до 60 */
let S;
const reset = () => ({ r: 0, pts: [], errs: [], t: 0, base: 0, hidden: false, state: 'idle', wait: 0, msg: '', lastErr: 0, shown: 0 });
const fmt = ms => { const s = ms / 1000; return '08:' + hmPad(29 + (s >= 60 ? 1 : 0)) + ':' + hmPad(Math.floor(s) % 60) + '.' + hmPad(Math.floor((s % 1) * 100)); };
const hud = () => g.hud('Попытка <b>' + Math.min(S.r + 1, ROUNDS) + '/' + ROUNDS + '</b>', 'Среднее: <b>' + (S.errs.length ? (S.errs.reduce((a, b) => a + Math.abs(b), 0) / S.errs.length).toFixed(2) + ' с' : '—') + '</b>');
const draw = () => {
c.fillStyle = '#0b0905'; c.fillRect(0, 0, W, H);
const rg = c.createRadialGradient(W / 2, 170, 20, W / 2, 170, 230); rg.addColorStop(0, '#3a2609'); rg.addColorStop(1, '#0b0905'); c.fillStyle = rg; c.fillRect(0, 0, W, H);
const cx = W / 2, cy = 165, R = 110, el = S.t / 1000; /* el: секунды с 08:29:00 */
c.fillStyle = '#17110a'; c.beginPath(); c.arc(cx, cy, R + 12, 0, 7); c.fill(); c.strokeStyle = '#ffb020'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R + 12, 0, 7); c.stroke();
c.fillStyle = '#241a0d'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
for(let i = 0; i < 60; i++){ const a = i / 60 * Math.PI * 2 - Math.PI / 2, l = i % 5 ? 5 : 12; c.strokeStyle = i % 5 ? 'rgba(255,233,184,.35)' : '#ffe9b8'; c.lineWidth = i % 5 ? 1 : 2.5; c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - 3), cy + Math.sin(a) * (R - 3)); c.lineTo(cx + Math.cos(a) * (R - 3 - l), cy + Math.sin(a) * (R - 3 - l)); c.stroke(); }
c.fillStyle = '#ff5a36'; const ba = 0 - Math.PI / 2; c.beginPath(); c.moveTo(cx + Math.cos(ba) * (R + 4), cy + Math.sin(ba) * (R + 4)); c.lineTo(cx + Math.cos(ba) * (R - 16) + Math.cos(ba + 1.57) * 7, cy + Math.sin(ba) * (R - 16) + Math.sin(ba + 1.57) * 7); c.lineTo(cx + Math.cos(ba) * (R - 16) - Math.cos(ba + 1.57) * 7, cy + Math.sin(ba) * (R - 16) - Math.sin(ba + 1.57) * 7); c.fill();
c.font = '800 10px Oswald,Arial'; c.textAlign = 'center'; c.fillStyle = '#ff5a36'; c.fillText('ЗВОНОК', cx, cy - R + 36);
c.fillStyle = '#ffe9b8'; c.font = '800 22px Oswald,Arial'; c.fillText('8:29', cx, cy + 40);
if(!S.hidden || S.state === 'done'){ const a = (el % 60) / 60 * Math.PI * 2 - Math.PI / 2; c.strokeStyle = '#ffb020'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - Math.cos(a) * 18, cy - Math.sin(a) * 18); c.lineTo(cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12)); c.stroke(); }
else { c.fillStyle = 'rgba(255,233,184,.14)'; c.font = '900 40px Oswald,Arial'; c.fillText('?', cx, cy - 16); }
c.fillStyle = '#ffb020'; c.beginPath(); c.arc(cx, cy, 6, 0, 7); c.fill();
c.fillStyle = '#120d06'; c.fillRect(40, 308, 240, 58); c.strokeStyle = 'rgba(255,176,32,.35)'; c.lineWidth = 1; c.strokeRect(40, 308, 240, 58);
c.font = '900 36px "Courier New",monospace'; c.fillStyle = S.hidden && S.state !== 'done' ? 'rgba(255,176,32,.18)' : '#ffb020'; c.fillText(S.hidden && S.state !== 'done' ? '08:••:••.••' : fmt(S.state === 'done' ? S.shown : S.t), cx, 348);
if(S.state === 'run' && S.hidden){ c.fillStyle = '#ff5a36'; c.font = '700 11px Oswald,Arial'; c.fillText('ВРЕМЯ СКРЫТО · ЖДИ ЗВОНКА', cx, 384); }
if(S.state === 'done'){ const late = S.lastErr > 0; c.fillStyle = late ? '#ff7a6a' : '#7dffb0'; c.font = '900 18px Oswald,Arial'; c.fillText(late ? 'ОПОЗДАЛ НА ' + S.lastErr.toFixed(2) + ' с' : 'ЗА ' + Math.abs(S.lastErr).toFixed(2) + ' с ДО ЗВОНКА', cx, 384); }
c.textAlign = 'center'; c.fillStyle = '#ffb020'; c.beginPath(); c.roundRect(60, 398, 200, 34, 10); c.fill(); c.fillStyle = '#1a1005'; c.font = '900 14px Oswald,Arial'; c.fillText(S.state === 'done' ? 'ДАЛЬШЕ' : 'ВОЙТИ В АУДИТОРИЮ', cx, 420);
};
const act = () => {
if(!g.run) return;
if(S.state === 'run'){
S.state = 'done'; S.shown = S.t; const err = (S.t - 60000) / 1000; S.lastErr = err; S.errs.push(err);
S.pts.push(err > 0 ? 0 : Math.max(5, Math.round(100 - Math.abs(err) * 30))); hmTone(err > 0 ? 200 : 700, .2, .06, err > 0 ? 'sawtooth' : 'sine'); hud();
} else if(S.state === 'done'){
S.r++; if(S.r >= ROUNDS) return finish(); S.state = 'run'; S.base = performance.now(); S.t = 60000 - 18000 - hgRnd(0, 3000); S.hidden = false; S.t0 = S.t; hud();
}
};
g.cv.addEventListener('pointerdown', e => { const r = g.cv.getBoundingClientRect(); if((e.clientY - r.top) / r.height > .86) act(); });
const key = e => { if(!hmAlive(g.box)) return document.removeEventListener('keydown', key); if(g.run && (e.code === 'Space' || e.key === 'Enter')){ e.preventDefault(); act(); } };
document.addEventListener('keydown', key);
const finish = () => {
g.stop(); const sc = S.pts.reduce((a, b) => a + b, 0), avg = S.errs.reduce((a, b) => a + Math.abs(b), 0) / S.errs.length, b = hgBest('kulikov', sc);
g.show('⏰', avg < .5 ? 'Ровно в 8:29' : 'Звонок есть звонок', `Баллы: <b>${sc}</b> из 500. Средняя ошибка: <b>${avg.toFixed(2)} с</b>.<br>${avg < .5 ? 'Куликов заходит в аудиторию за секунду до звонка. Всегда.' : 'Куликов бы вошёл точнее. Он носит часы без стрелок.'}`, 'Ещё раз'); g.rec('Лучший счёт: ' + b);
};
const start = () => {
S = reset(); g.hide(); S.state = 'run'; S.t = 60000 - 18000 - hgRnd(0, 3000); S.base = performance.now(); S.t0 = S.t; hud();
g.loop(() => {
if(S.state === 'run'){ S.t = S.t0 + (performance.now() - S.base); S.hidden = S.t > 60000 - 11000; if(S.t > 60000 + 4000){ act(); } }
draw();
});
};
g.ov.querySelector('.hg-go').addEventListener('click', start);
S = reset(); S.t = 42000; draw(); hud(); g.rec(hgBest('kulikov') ? 'Лучший счёт: ' + hgBest('kulikov') : 'Рекорда пока нет');
g.show('⏰', 'Ровно в 8:29', 'За 11 секунд до звонка часы <b>гаснут</b>. Жми «Войти» как можно ближе к звонку — но не позже. 5 попыток.', 'Начать');
};
const hgBersenev = root => {
const g = hgMount(root, 'bershod'); if(!g) return;
const dom = g.box.querySelector('.hg-dom'), SEALS = [['★', 392], ['✦', 440], ['❖', 494], ['✿', 523], ['☗', 587], ['⚜', 659]], SEM = 8;
dom.innerHTML = `<div class="hg-book"><div class="hg-sem"></div><div class="hg-seals">${SEALS.map((s, i) => `<button type="button" class="hg-seal" data-i="${i}" style="--r:${(i % 2 ? 1 : -1) * (2 + i)}deg"><i>${s[0]}</i></button>`).join('')}</div><div class="hg-stamps">${Array.from({ length: SEM }, (_, i) => `<b>${i + 1}</b>`).join('')}</div><div class="hg-msg"></div></div>`;
const btns = [...dom.querySelectorAll('.hg-seal')], sem = dom.querySelector('.hg-sem'), msg = dom.querySelector('.hg-msg'), stamps = [...dom.querySelectorAll('.hg-stamps b')];
let S, lock = true;
const lit = (i, ms = 360) => { btns[i].classList.add('on'); hmTone(SEALS[i][1], ms / 1000, .06, 'triangle'); setTimeout(() => btns[i].classList.remove('on'), ms - 60); };
const hud = () => g.hud('Семестр <b>' + Math.min(S.r + 1, SEM) + '/' + SEM + '</b>', 'Пересдачи: <b>' + S.fail + '/3</b>');
const wait = ms => new Promise(r => setTimeout(r, ms));
const play = async () => {
lock = true; const my = ++S.tok; sem.textContent = 'СЕМЕСТР ' + (S.r + 1) + ' · печатей: ' + S.seq.length; msg.textContent = 'Запоминай…'; await wait(700);
for(const i of S.seq){ if(!hmAlive(g.box) || my !== S.tok) return; lit(i, Math.max(240, 420 - S.r * 20)); await wait(Math.max(300, 520 - S.r * 25)); }
msg.textContent = 'Теперь ты'; S.pos = 0; lock = false;
};
const next = () => { S.seq.push(Math.random() * 6 | 0); hud(); play(); };
const end = ok => {
lock = true; S.tok++; g.run = false; const sc = S.r * 100 + (ok ? (3 - S.fail) * 100 : 0), b = hgBest('bershod', sc);
g.show(ok ? '🎓' : '📕', ok ? 'Допущен к диплому' : 'Отчислен (временно)', ok ? `Все 8 семестров закрыты. Пересдач: <b>${S.fail}</b>. Зачётка выглядит как произведение искусства.` : `Закрыто семестров: <b>${S.r}</b> из ${SEM}. Берсенев ставит печати с первого раза.`, 'Ещё раз'); g.rec('Лучший счёт: ' + b);
};
btns.forEach((b, i) => b.addEventListener('click', () => {
if(lock || !g.run) return; lit(i, 220);
if(i === S.seq[S.pos]){ S.pos++; if(S.pos >= S.seq.length){ lock = true; stamps[S.r].classList.add('done'); msg.textContent = 'Печать поставлена ✓'; hmTone(784, .2, .06); S.r++; if(S.r >= SEM) return setTimeout(() => end(true), 600); setTimeout(next, 900); } }
else { S.fail++; hud(); msg.textContent = 'Не та печать — пересдача'; hmTone(150, .3, .07, 'sawtooth'); dom.classList.add('bad'); setTimeout(() => dom.classList.remove('bad'), 400); if(S.fail >= 3) return setTimeout(() => end(false), 700); lock = true; setTimeout(play, 1000); }
}));
const start = () => { S = { r: 0, fail: 0, seq: [Math.random() * 6 | 0, Math.random() * 6 | 0], pos: 0, tok: 0 }; stamps.forEach(s => s.classList.remove('done')); g.run = true; g.hide(); hud(); play(); };
g.ov.querySelector('.hg-go').addEventListener('click', start);
S = { r: 0, fail: 0 }; hud(); g.rec(hgBest('bershod') ? 'Лучший счёт: ' + hgBest('bershod') : 'Рекорда пока нет');
g.show('📘', 'Порядок печатей', 'Деканат ставит печати в определённом порядке. Запомни и повтори — с каждым семестром длиннее. <b>3 пересдачи</b> — и всё.', 'В деканат');
};
(() => {
const set = (k, id, title, s1, s2, hint, canvas, mount, infoTitle) => {
const d = HOD[k]; if(!d) return;
d.infoTitle = infoTitle; d.info = () => hgShell(id, title, s1, s2, hint, canvas);
d.after = root => { try{ mount(root); }catch(e){ console.warn('hod game', e); } };
};
set('Алиев|Ходящий', 'aliev', 'УСПЕТЬ ДО ЗВОНКА', '⏱ 0:45', '0 / 420 м', '← → · A D · свайп · тап по половине экрана', true, hgAliev, 'Коридор до звонка');
set('Галкин', 'galkin', 'НИ ОДНОЙ ПРОПУЩЕННОЙ', 'Пропущено: <b>0</b>', 'Серия ×0', 'D F J K · или тапай по дорожкам', true, hgGalkin, 'Пары по расписанию');
set('Голиков|Ходящий', 'golikov', 'ОСТАНОВИСЬ У ПЛАТФОРМЫ', 'Станция: <b>1/3</b>', 'Скорость', 'Зажми «Тормоз» / пробел · отпусти — разгон', true, hgGolikov, 'Линия «Пары»');
set('Куликов|Ходящий', 'kulikov', 'РОВНО В 8:29', 'Попытка <b>1/5</b>', 'Среднее: —', 'Пробел · Enter · кнопка внизу', true, hgKulikov, 'Звонок на первую пару');
set('Берсенев|Ходящий', 'bershod', 'ПОРЯДОК ПЕЧАТЕЙ', 'Семестр <b>1/8</b>', 'Пересдачи: <b>0/3</b>', 'Смотри и повторяй — по одной печати', false, hgBersenev, 'Зачётная книжка');
})();
(() => {
const lx = document.querySelector('.lx'); if(!lx) return;
const mast = lx.querySelector('.lx-mast'), fit = lx.querySelector('.lx-fit');
fit.innerHTML = [...fit.textContent].map((ch, k) => `<b style="--k:${k}">${ch}</b>`).join('');
lx.querySelectorAll('.lx-facts div, .lx-intro > *').forEach((e, k) => e.style.setProperty('--k', k % 3));
const doFit = () => {
const cs = getComputedStyle(mast), avail = mast.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
fit.style.fontSize = '100px'; const w = fit.getBoundingClientRect().width || 1;
const size = 100 * avail / w;
let fs = size;
if(window.innerWidth >= 1024){
const ch = Math.max(560, window.innerHeight - 118), cl = 44;
fs = Math.min(size, (ch - cl) * .5 / .8);
lx.style.setProperty('--ch', ch + 'px');
const mh = fs * .8, pt = cl + 10 + mh * .5, ph = ch - pt + 10, pw = Math.min(window.innerWidth - 40, ph * 1513 / 600);
lx.style.setProperty('--pt', pt.toFixed(0) + 'px'); lx.style.setProperty('--pw', pw.toFixed(0) + 'px');
}
fit.style.fontSize = fs.toFixed(2) + 'px';
lx.style.setProperty('--mh', (fs * .8).toFixed(1) + 'px');
};
const start = () => { doFit(); requestAnimationFrame(() => lx.classList.add('is-in')); [250, 800, 1600, 3000].forEach(t => setTimeout(doFit, t)); };
let started = false; const go = () => { if(started) return; started = true; start(); };
const fl = document.fonts && document.fonts.load ? Promise.all(['800 100px "LX Display"', '600 40px "LX Display"', 'italic 400 40px "LX Serif"', '500 12px "LX Text"'].map(f => document.fonts.load(f).catch(() => {}))) : Promise.resolve();
fl.then(go); setTimeout(go, 1200);
if(document.fonts) document.fonts.addEventListener?.('loadingdone', () => doFit());
if(window.ResizeObserver){ let busy = false; new ResizeObserver(() => { if(busy) return; const cs = getComputedStyle(mast), avail = mast.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), w = fit.getBoundingClientRect().width; if(Math.abs(w - avail) > 1.5){ busy = true; doFit(); requestAnimationFrame(() => busy = false); } }).observe(fit); }
let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(doFit, 60); });
const pan = lx.querySelector('.lx-pan'), img = pan && pan.querySelector('img'); if(!img) return;
const narrow = () => window.innerWidth < 700, lim = () => narrow() ? Math.min(0, pan.clientWidth - img.clientWidth) : 0;
let x = null, dir = -1, drag = null, rest = 0, last = performance.now();
const set = v => { x = Math.max(lim(), Math.min(0, v)); img.style.transform = narrow() ? `translate3d(${x.toFixed(1)}px,0,0)` : ''; };
const on = () => { const t = document.getElementById('tab1'); return t && t.classList.contains('active') && !document.hidden; };
const tick = now => {
const dt = Math.min(.05, (now - last) / 1000); last = now;
if(x === null && img.clientWidth) set(lim() * .45);
if(x !== null && !drag && narrow() && on() && now > rest){ const L = lim(); if(L < 0){ let n = x + dir * 9 * dt; if(n <= L){ n = L; dir = 1; } if(n >= 0){ n = 0; dir = -1; } set(n); } }
requestAnimationFrame(tick);
};
pan.addEventListener('pointerdown', e => { if(!narrow()) return; drag = { sx: e.clientX, x0: x || 0 }; });
pan.addEventListener('pointermove', e => { if(!drag) return; const dx = e.clientX - drag.sx; if(Math.abs(dx) > 2) dir = dx > 0 ? 1 : -1; set(drag.x0 + dx); });
const up = () => { if(drag){ drag = null; rest = performance.now() + 3000; } };
pan.addEventListener('pointerup', up); pan.addEventListener('pointercancel', up); pan.addEventListener('pointerleave', up);
pan.style.touchAction = 'pan-y';
window.addEventListener('resize', () => { if(x !== null) set(x); });
requestAnimationFrame(tick);
})();
const nbPh = d => `<div class="nb-ph">${d.src ? `<img src="${esc(d.src)}" alt="" draggable="false">` : ''}<b class="nb-mono">${esc(initialsOf(d.full))}</b></div>`;
const nbStat = ([v, l, suf]) => `<b class="nb-n"${typeof v === 'number' ? ` data-to="${v}" data-suf="${esc(suf || '')}"` : ''}>${typeof v === 'number' ? '0' + esc(suf || '') : esc(v)}</b><span>${esc(l)}</span>`;
const nbStory = d => (d.story && d.story.length ? d.story : [d.tag]).map(p => `<p>${esc(p)}</p>`).join('');
const nbQuote = d => `<p>${esc(d.quote[0])}</p><cite>${esc(d.quote[1])}</cite>`;
const nbTabs = (on, labels = ['Досье', 'Игра', 'Видео']) => labels.map(t => {
const act = t === 'Видео' ? (on === 'video' ? '' : ' data-hm="video"') : t === 'Игра' ? ' data-go="#nbGame"' : t === 'Тюнинг' ? ' data-go="#crTune"' : on === 'video' ? ' data-hm="history"' : '';
return `<button type="button" class="nb-tab${(t === 'Видео' && on === 'video') || (t === 'Досье' && on !== 'video') ? ' on' : ''}"${act}>${t}</button>`;
}).join('');
const nbPlay = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const nbArrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const nbSpark = (seed, w = 90, h = 26) => { const r = nlRnd(seed); let p = ''; for(let i = 0; i <= 8; i++) p += (i ? 'L' : 'M') + (i * w / 8).toFixed(1) + ' ' + (4 + r() * (h - 8)).toFixed(1); return `<svg class="nb-spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${p}"/></svg>`; };
const nbLine = (seed, cls) => { const r = nlRnd(seed); let pts = []; for(let i = 0; i <= 6; i++) pts.push([i * 50 + 10, 90 - (25 + r() * 55)]); let p = `M${pts[0][0]} ${pts[0][1]}`; for(let i = 1; i < pts.length; i++){ const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2; p += `C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`; } return `<path class="${cls}" pathLength="1" d="${p}"/>`; };
const NB = {
f1: d => `<div class="nb nb-f1">
<nav class="nb-pill"><i class="nb-logo">${esc((d.surname || '?')[0])}</i>${nbTabs('history')}</nav>
<section class="nb-panel">
<div class="nb-hero">
<span class="nb-bignum" aria-hidden="true">${esc(typeof d.stats[0]?.[0] === 'number' ? d.stats[0][0] : '№')}</span>
${nbPh(d)}
<div class="nb-hero-t"><small>${esc(d.kicker)}</small><h2>${esc(d.surname)}</h2><b>${esc(d.first)}</b>
<p class="nb-sub">${esc(d.tag)}</p><button type="button" class="nb-cta" data-hm="video">${nbPlay}<span>Смотреть видео</span></button></div>
</div>
<div class="nb-trio">
<article class="nb-card"><h4>Таблица</h4><ol class="nb-table">${d.stats.map((s, i) => `<li class="${i === 0 ? 'lead' : ''}"><em>${i + 1}</em><span>${esc(s[1])}</span><b class="nb-n"${typeof s[0] === 'number' ? ` data-to="${s[0]}" data-suf="${esc(s[2] || '')}"` : ''}>${typeof s[0] === 'number' ? '0' + esc(s[2] || '') : esc(s[0])}</b></li>`).join('')}</ol></article>
<article class="nb-card"><h4>Хайлайты</h4><ul class="nb-hl">${d.facts.map(f => `<li data-hm="video"><i>${nbPlay}</i><span>${esc(f)}</span></li>`).join('')}</ul></article>
<article class="nb-card nb-story"><h4>Полная история</h4>${nbStory(d)}</article>
</div>
<section class="nb-card nb-game" id="nbGame"><h4>${esc(d.infoTitle)}</h4>${d.info()}</section>
<div class="nb-player"><i class="nb-disc">${esc((d.surname || '?')[0])}</i><div><b>${esc(d.quote[1])}</b><p>${esc(d.quote[0])}</p></div><span class="nb-bar"><i></i></span></div>
</section></div>`,
rain: d => `<div class="nb nb-rain">
<div class="nb-rain-top"><span class="nb-brand"><i></i>ХОДЯЩИЙ</span><span class="nb-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>${esc(d.kicker)}</span></div>
<div class="nb-chips">${nbTabs('history', ['Досье', 'Игра', 'Видео'])}<span class="nb-tab">${esc(d.stats[1]?.[1] || '')}</span></div>
<div class="nb-grid">
<article class="nb-tile nb-big"><div class="nb-bgph">${nbPh(d)}</div>
<div class="nb-float"><div><h3>${esc(d.surname)}</h3><small>${esc(d.first)} · ${esc(d.tag)}</small><p class="nb-price">${typeof d.stats[0]?.[0] === 'number' ? nbStat(d.stats[0]) : ''}</p></div><span class="nb-rate">★ 5.0</span>
<div class="nb-btns"><button type="button" aria-label="Видео" data-hm="video">${nbPlay}</button><button type="button" aria-label="К игре" data-go="#nbGame">${nbArrow}</button></div></div>
<div class="nb-slide"><button type="button" data-go="#nbGame">←</button><span>листай вниз — игра</span><button type="button" data-hm="video">→</button></div></article>
<article class="nb-tile nb-quote"><span class="nb-star">★ 5.0</span><h4>${esc(d.quote[1])}</h4>${nbQuote(d)}</article>
<article class="nb-tile nb-mini"><span class="nb-lab">Цифры</span><i class="nb-arr">${nbArrow}</i><div class="nb-ms">${d.stats.map(s => `<div>${nbStat(s)}</div>`).join('')}</div></article>
<article class="nb-tile nb-mini nb-reg"><span class="nb-lab">Ролик</span><i class="nb-arr" data-hm="video">${nbArrow}</i><ul>${d.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul><button type="button" data-hm="video">Смотреть</button></article>
<article class="nb-tile nb-wide nb-game" id="nbGame"><span class="nb-lab">${esc(d.infoTitle)}</span>${d.info()}</article>
<article class="nb-tile nb-wide nb-story"><span class="nb-lab">Полная история</span>${nbStory(d)}</article>
</div></div>`,
show: d => `<div class="nb nb-show">
<div class="nb-room" aria-hidden="true"></div>
<header class="nb-sh-top"><span class="nb-brand"><i>◆</i><b>ИС-41</b><small>Ходящий</small></span><nav class="nb-seg">${nbTabs('history', ['Досье', 'Игра', 'Видео'])}</nav></header>
<section class="nb-sh-title"><h2>${esc(d.surname)}</h2><small>${esc(d.kicker)}</small><p class="nb-price">${typeof d.stats[0]?.[0] === 'number' ? nbStat(d.stats[0]) : esc(d.tag)}</p></section>
<div class="nb-stage"><div class="nb-ring"></div>${nbPh(d)}<span class="nb-dot a"></span><span class="nb-dot b"></span></div>
<div class="nb-chips2">${d.stats.map((s, i) => `<div class="nb-chip" style="--i:${i}"><i>${['⏱', '🚇', '✓'][i % 3]}</i><span>${nbStat(s)}</span></div>`).join('')}
<div class="nb-chip"><i>❝</i><span><b>${esc(d.quote[1])}</b><span>${esc(d.quote[0])}</span></span></div></div>
<article class="nb-sh-card nb-game" id="nbGame"><h4>${esc(d.infoTitle)}</h4>${d.info()}</article>
<div class="nb-sh-two"><article class="nb-sh-card nb-story"><h4>Полная история</h4>${nbStory(d)}</article>
<article class="nb-sh-card nb-res"><small>Что в ролике</small><ul>${d.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul><button type="button" data-hm="video">${nbPlay}<span>Смотреть видео</span></button></article></div></div>`,
ana: d => `<div class="nb nb-ana">
<header class="nb-an-top"><h2>${esc(d.surname)} · аналитика</h2><nav class="nb-ic">${nbTabs('history', ['Досье', 'Игра', 'Видео'])}</nav></header>
<div class="nb-an-grid">
<article class="nb-an-hero"><div class="nb-hero-t"><small>${esc(d.kicker)}</small><h3>${esc(d.surname)}<br><em>${esc(d.first)}</em></h3><button type="button" class="nb-cta" data-hm="video"><span>Смотреть видео</span></button></div>${nbPh(d)}
<div class="nb-strip">${d.stats.map(s => `<div>${nbStat(s)}<i></i></div>`).join('')}<button type="button" class="nb-next" data-hm="video" aria-label="Видео">→</button></div></article>
<article class="nb-an-card"><h4>Активность сейчас <em>💡</em></h4><svg class="nb-chart" viewBox="0 0 320 110" aria-hidden="true"><g class="grid">${[20, 45, 70, 95].map(y => `<path d="M10 ${y}H316"/>`).join('')}</g>${nbLine(11, 'l1')}${nbLine(29, 'l2')}<circle class="pt" cx="316" cy="40" r="5"/></svg><div class="nb-axis"><span>Пн</span><span>Ср</span><span>Пт</span><span>Вс</span></div></article>
<article class="nb-an-card nb-an-quote"><h4>Из жизни группы</h4><div class="nb-qq"><span class="nb-qn">8:29</span><div>${nbQuote(d)}</div></div></article>
<article class="nb-an-card nb-an-list"><h4>Лучшие моменты</h4>${d.facts.map((f, i) => `<div class="nb-row" data-hm="video"><i class="nb-th">${esc(d.ph?.[0] || '▶')}</i><div><b>${esc(f)}</b><small>${esc(d.videoTitle)}</small></div>${nbSpark(40 + i)}<em>▸</em></div>`).join('')}</article>
<article class="nb-an-card nb-game" id="nbGame"><h4>${esc(d.infoTitle)}</h4>${d.info()}</article>
<article class="nb-an-card nb-story"><h4>Полная история</h4>${nbStory(d)}</article>
</div></div>`,
gold: d => `<div class="nb nb-gold">
<nav class="nb-pill"><i class="nb-logo">⚜</i>${nbTabs('history')}</nav>
<div class="nb-gg">
<article class="nb-gt nb-tall"><span class="nb-oct" aria-hidden="true">${esc(typeof d.stats[1]?.[0] === 'number' ? d.stats[1][0] : '8')}</span>${nbPh(d)}<div class="nb-cap"><small>${esc(d.kicker)}</small><button type="button" data-hm="video" aria-label="Видео">${nbPlay}</button></div></article>
<article class="nb-gt nb-name"><small>${esc(d.first)}</small><h2>${esc(d.surname)}</h2><p>${esc(d.tag)}</p></article>
<article class="nb-gt nb-nums">${d.stats.map(s => `<div>${nbStat(s)}</div>`).join('')}</article>
<article class="nb-gt nb-wide nb-game" id="nbGame"><h4>${esc(d.infoTitle)}</h4>${d.info()}</article>
<article class="nb-gt nb-wide nb-story"><h4>Полная история</h4>${nbStory(d)}</article>
<article class="nb-gt nb-wide nb-quote">${nbQuote(d)}</article>
<article class="nb-gt nb-wide nb-fx"><h4>Что в ролике</h4><ul>${d.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul><button type="button" class="nb-cta" data-hm="video">${nbPlay}<span>Смотреть видео</span></button></article>
</div></div>`
};
const nbVideo = (d, src) => {
const kind = d.bento, nav = kind === 'f1' || kind === 'gold' ? `<nav class="nb-pill"><i class="nb-logo">${kind === 'gold' ? '⚜' : esc((d.surname || '?')[0])}</i>${nbTabs('video')}</nav>` : `<nav class="nb-vtabs">${nbTabs('video')}</nav>`;
const [emo, t, s] = d.ph || ['🎬', '', ''];
return `<div class="nb nb-${kind} nb-v">${nav}<section class="nb-card nb-tile nb-an-card nb-sh-card nb-gt nb-screen"><h4>${esc(d.videoTitle)}</h4>
<div class="nb-vs">${src ? '<video id="hodVideo" controls playsinline preload="metadata"></video>' : ''}<div class="hm-ph" ${src ? 'hidden' : ''}><span>${emo}</span><b>${esc(t)}</b><small>${esc(s)}</small></div></div>
<p class="hm-note" id="hodNote">${src ? 'Видео запустится само. Если браузер запретит — нажми ▶.' : 'Видео скоро появится. ' + esc(d.videoNote)}</p></section>
<section class="nb-card nb-tile nb-an-card nb-sh-card nb-gt"><h4>Что в ролике</h4><ul class="nb-fl">${d.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul></section>
<section class="nb-card nb-tile nb-an-card nb-sh-card nb-gt nb-quote">${nbQuote(d)}</section></div>`;
};
const _nbHistory = hodHistory, _nbVideo = hodVideo;
hodHistory = d => (d.bento && NB[d.bento]) ? NB[d.bento](d) : _nbHistory(d);
hodVideo = (d, src) => (d.bento && NB[d.bento]) ? nbVideo(d, src) : _nbVideo(d, src);
const nbCount = root => $$('.nb-n[data-to]', root).forEach((b, i) => {
const to = +b.dataset.to, suf = b.dataset.suf || '', t0 = performance.now() + 300 + i * 120, dur = 900;
const tick = now => { const p = Math.max(0, Math.min(1, (now - t0) / dur)), e = 1 - Math.pow(1 - p, 3); b.textContent = Math.round(to * e) + suf; if(p < 1 && hodEl.classList.contains('visible')) requestAnimationFrame(tick); };
requestAnimationFrame(tick);
});
hodEl.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if(g){ const t = hodScroll.querySelector(g.dataset.go); if(t) hodScroll.scrollTo({ top: t.offsetTop - 12, behavior: 'smooth' }); } });
[['Алиев|Ходящий', 'f1'], ['Кирилл', 'f1'], ['Галкин', 'rain'], ['Голиков|Ходящий', 'show'], ['Куликов|Ходящий', 'ana'], ['Берсенев|Ходящий', 'gold']].forEach(([k, b]) => {
const d = HOD[k]; if(!d) return; d.bento = b; const oa = d.after;
d.after = root => {
oa?.(root); nbCount(root);
$$('.nb-ph img', root).forEach(i => { const rm = () => i.remove(); i.addEventListener('error', rm, { once: true }); if(i.complete && !i.naturalWidth) rm(); });
};
});
const ZF = { d: '"LX Display",Inter,sans-serif', t: '"LX Text",Inter,sans-serif' };
const zgTxt = (c, s, x, y, font, col, al = 'center', bl = 'middle') => { c.font = font; c.fillStyle = col; c.textAlign = al; c.textBaseline = bl; c.fillText(s, x, y); };
const zgRR = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const zgEase = u => 1 - Math.pow(1 - nlClamp(u), 3);
const zgHold = (g, on, off) => {
g.cv.addEventListener('pointerdown', e => { if(!g.run) return; e.preventDefault(); on(e); });
if(off){ window.addEventListener('pointerup', e => { if(g.run) off(e); }); g.cv.addEventListener('pointercancel', e => off(e)); }
const kd = e => { if(!hmAlive(g.box)) return document.removeEventListener('keydown', kd); if(!g.run || e.repeat) return; if(e.code === 'Space' || e.key === 'Enter'){ e.preventDefault(); on(e); } };
document.addEventListener('keydown', kd);
if(off){ const ku = e => { if(!hmAlive(g.box)) return document.removeEventListener('keyup', ku); if(e.code === 'Space' || e.key === 'Enter') off(e); }; document.addEventListener('keyup', ku); }
};
const zgRec = (g, k, unit) => { const b = hgBest(k); g.rec(b ? 'Рекорд: ' + b + (unit || '') : 'Рекорда пока нет'); };
const zgVerdict = (c, W, v) => {
if(!v || v.a <= 0) return; const a = Math.min(1, v.a * 2), s = 1 + (1 - Math.min(1, (1.3 - v.a) * 6)) * .25;
c.save(); c.globalAlpha = a; c.translate(W / 2, v.y); c.scale(s, s);
c.font = `800 22px ${ZF.d}`; const tw = Math.max(c.measureText(v.t).width, 60) + 34;
c.fillStyle = v.bg; zgRR(c, -tw / 2, -22, tw, 44, 4); c.fill();
zgTxt(c, v.t, 0, -2, `800 22px ${ZF.d}`, v.fg);
if(v.s){ c.font = `600 11px ${ZF.t}`; const sw = c.measureText(v.s).width + 16; c.fillStyle = 'rgba(12,14,18,.82)'; zgRR(c, -sw / 2, 22, sw, 20, 3); c.fill(); zgTxt(c, v.s, 0, 32.5, `600 11px ${ZF.t}`, '#fff'); }
c.restore();
};
const ZOK = { bg: '#1f9d55', fg: '#fff' }, ZMID = { bg: '#f2b632', fg: '#1a1205' }, ZBAD = { bg: '#d6452f', fg: '#fff' };
const zgMilk = root => {
const g = hgMount(root, 'zmilk'); if(!g) return;
const { ctx: c, W, H } = g, N = 8, NX = 128, BASE = 366, K = .16, MAX = 1150;
let S, hold = false;
const lvlY = ml => BASE - 2 - Math.min(ml, MAX) * K;
const reset = () => ({ i: 0, ph: 'in', t: 0, x: -110, ml: 0, drip: 0, poured: false, timer: 0, tmax: 1, res: [], v: null, drops: [], cap: 0, spill: 0, wob: 0 });
const rate = () => 360 + S.i * 42;
const hud = () => { const ok = S.res.filter(r => r >= 80).length; g.hud('Бутылка <b>' + Math.min(N, S.i + 1) + '/' + N + '</b>', 'Годных <b>' + ok + '</b>'); };
zgHold(g, () => { hold = true; }, () => { hold = false; });
const bottle = (x, ml, cap, spill) => {
const top = BASE - 190, neckW = 30, bodyW = 98;
const path = () => { c.beginPath(); c.moveTo(x - neckW / 2, top + 6); c.lineTo(x - neckW / 2, top + 44); c.bezierCurveTo(x - neckW / 2, top + 62, x - bodyW / 2, top + 66, x - bodyW / 2, top + 90); c.lineTo(x - bodyW / 2, BASE - 8); c.quadraticCurveTo(x - bodyW / 2, BASE, x - bodyW / 2 + 8, BASE); c.lineTo(x + bodyW / 2 - 8, BASE); c.quadraticCurveTo(x + bodyW / 2, BASE, x + bodyW / 2, BASE - 8); c.lineTo(x + bodyW / 2, top + 90); c.bezierCurveTo(x + bodyW / 2, top + 66, x + neckW / 2, top + 62, x + neckW / 2, top + 44); c.lineTo(x + neckW / 2, top + 6); c.closePath(); };
c.fillStyle = 'rgba(10,30,60,.18)'; c.beginPath(); c.ellipse(x + 6, BASE + 2, 50, 5, 0, 0, 7); c.fill();
path(); const gl = c.createLinearGradient(x - bodyW / 2, 0, x + bodyW / 2, 0); gl.addColorStop(0, 'rgba(160,200,235,.28)'); gl.addColorStop(.5, 'rgba(200,225,250,.08)'); gl.addColorStop(1, 'rgba(160,200,235,.28)'); c.fillStyle = gl; c.fill();
if(ml > 0){ c.save(); path(); c.clip(); const ly = lvlY(ml) + Math.sin(S.wob) * 1.5 * (hold ? 1 : .3); const mg = c.createLinearGradient(x - bodyW / 2, 0, x + bodyW / 2, 0); mg.addColorStop(0, '#e9eef3'); mg.addColorStop(.35, '#ffffff'); mg.addColorStop(1, '#dde5ee'); c.fillStyle = mg; c.fillRect(x - 60, ly, 120, BASE - ly + 2); c.fillStyle = 'rgba(255,255,255,1)'; c.fillRect(x - 60, ly, 120, 2.5); c.fillStyle = 'rgba(160,190,220,.35)'; c.fillRect(x - 60, ly + 2.5, 120, 1.5); c.restore(); }
c.save(); path(); c.clip(); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x - bodyW / 2 + 9, top + 92, 6, 150); c.fillRect(x - neckW / 2 + 5, top + 10, 3, 34); c.restore();
path(); c.strokeStyle = 'rgba(200,225,250,.9)'; c.lineWidth = 1.6; c.stroke();
c.fillStyle = '#1452a8'; c.fillRect(x - bodyW / 2, BASE - 40, bodyW, 30); c.fillStyle = '#fff'; c.fillRect(x - bodyW / 2, BASE - 40, bodyW, 2);
zgTxt(c, 'ЛЕБЕДЯНЬ', x, BASE - 30, `800 10px ${ZF.d}`, '#fff'); zgTxt(c, 'молоко 2,5% · 1 л', x, BASE - 18, `600 7.5px ${ZF.t}`, 'rgba(255,255,255,.85)');
/* деления на бутылке */ for(let m = 200; m <= 900; m += 100){ const yy = lvlY(m); if(yy > BASE - 42) continue; c.fillStyle = 'rgba(20,82,168,.55)'; c.fillRect(x + bodyW / 2 - 12, yy, m % 500 ? 6 : 10, 1); }
const my = lvlY(1000); c.strokeStyle = '#d6452f'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - neckW / 2 - 7, my); c.lineTo(x + neckW / 2 + 7, my); c.stroke();
c.fillStyle = '#d6452f'; zgRR(c, x - neckW / 2 - 34, my - 8, 24, 16, 2); c.fill(); zgTxt(c, '1 л', x - neckW / 2 - 22, my, `800 9px ${ZF.d}`, '#fff');
if(cap > 0){ const cy = top + 6 - (1 - zgEase(cap)) * 60; c.fillStyle = '#1452a8'; zgRR(c, x - neckW / 2 - 3, cy - 12, neckW + 6, 14, 3); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x - neckW / 2, cy - 10, neckW, 2); }
if(spill > 0){ c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x - neckW / 2, top + 6); c.quadraticCurveTo(x - neckW / 2 - 6, top + 30 + spill * 60, x - neckW / 2 - 2, top + 40 + spill * 120); c.lineTo(x - neckW / 2 + 4, top + 40 + spill * 110); c.quadraticCurveTo(x - neckW / 2 + 2, top + 30, x - neckW / 2 + 4, top + 6); c.fill(); c.beginPath(); c.ellipse(x - 10, BASE + 2, 20 + spill * 40, 4, 0, 0, 7); c.fill(); }
};
const draw = t => {
c.fillStyle = '#eaf1f7'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(80,120,160,.12)'; c.lineWidth = 1; for(let y = 0; y < 300; y += 22){ c.beginPath(); c.moveTo(0, y + .5); c.lineTo(W, y + .5); c.stroke(); } for(let y = 0; y < 300; y += 22) for(let x = (y / 22 % 2) * 22; x < W; x += 44){ c.beginPath(); c.moveTo(x + .5, y); c.lineTo(x + .5, y + 22); c.stroke(); }
c.fillStyle = '#1452a8'; c.fillRect(0, 300, W, 4);
const pg2 = c.createLinearGradient(0, 150, 0, BASE); pg2.addColorStop(0, '#1d3554'); pg2.addColorStop(1, '#0e1f36'); c.fillStyle = pg2; c.fillRect(58, 150, 140, BASE - 150); c.strokeStyle = 'rgba(255,255,255,.25)'; c.strokeRect(58.5, 150.5, 139, BASE - 151);
c.fillStyle = 'rgba(255,255,255,.06)'; for(let y = 160; y < BASE; y += 12) c.fillRect(60, y, 136, 1);
const tg = c.createLinearGradient(20, 0, 236, 0); tg.addColorStop(0, '#b9c6d3'); tg.addColorStop(.45, '#f4f7fa'); tg.addColorStop(1, '#a8b6c4'); c.fillStyle = tg; zgRR(c, 24, 18, 208, 76, 10); c.fill(); c.strokeStyle = '#8193a6'; c.stroke();
zgTxt(c, 'ЛЕБЕДЯНЬ', 128, 46, `800 18px ${ZF.d}`, '#1452a8'); zgTxt(c, 'МОЛОКО 2,5% · +4 °C', 128, 70, `600 9px ${ZF.t}`, '#4b6584');
c.fillStyle = tg; c.fillRect(NX - 7, 94, 14, 40); c.fillStyle = '#7b8da0'; zgRR(c, NX - 15, 132, 30, 14, 3); c.fill(); c.fillStyle = '#55687c'; c.fillRect(NX - 5, 146, 10, 6);
c.fillStyle = hold && S.ph === 'fill' ? '#1f9d55' : '#c4ced8'; c.beginPath(); c.arc(NX + 22, 139, 4, 0, 7); c.fill();
if(S.ph === 'fill' && (hold || S.drip > 0)){ const ly = lvlY(S.ml), w = hold ? 6 : 3; const sg = c.createLinearGradient(NX - w, 0, NX + w, 0); sg.addColorStop(0, '#dbe6f0'); sg.addColorStop(.5, '#ffffff'); sg.addColorStop(1, '#d2dfeb'); c.fillStyle = sg; c.fillRect(NX - w / 2 + Math.sin(t * 30) * .6, 152, w, ly - 152); }
S.drops.forEach(d => { c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.arc(d.x, d.y, d.r, 0, 7); c.fill(); });
c.fillStyle = '#2b3b52'; c.fillRect(0, BASE, W, 14); c.fillStyle = '#3c5272'; const off = S.ph === 'in' || S.ph === 'out' ? (t * 140) % 20 : 0; for(let x = -20 + off; x < W; x += 20){ c.beginPath(); c.arc(x, BASE + 7, 4, 0, 7); c.fill(); }
c.fillStyle = '#1d2a3b'; c.fillRect(0, BASE + 14, W, H - BASE - 14);
bottle(S.x, S.ml, S.cap, S.spill);
const gx = 262, gy0 = 120, gy1 = BASE - 4, gH = gy1 - gy0, gyOf = ml => gy1 - ml / MAX * gH;
c.fillStyle = '#ffffff'; zgRR(c, gx - 6, gy0 - 34, 58, gH + 50, 6); c.fill(); c.strokeStyle = 'rgba(20,82,168,.25)'; c.stroke();
zgTxt(c, 'МЛ', gx + 23, gy0 - 20, `700 9px ${ZF.t}`, '#4b6584');
c.fillStyle = 'rgba(242,182,50,.35)'; c.fillRect(gx, gyOf(1040), 18, gyOf(960) - gyOf(1040)); c.fillStyle = 'rgba(31,157,85,.55)'; c.fillRect(gx, gyOf(1015), 18, gyOf(985) - gyOf(1015));
c.fillStyle = '#e3ebf3'; c.fillRect(gx, gy0, 18, gH); c.fillStyle = 'rgba(242,182,50,.45)'; c.fillRect(gx, gyOf(1040), 18, gyOf(960) - gyOf(1040)); c.fillStyle = '#1f9d55'; c.fillRect(gx, gyOf(1015), 18, gyOf(985) - gyOf(1015));
const fy = gyOf(Math.min(S.ml, MAX)); c.fillStyle = 'rgba(20,82,168,.85)'; c.fillRect(gx + 4, fy, 10, gy1 - fy);
for(let m = 0; m <= 1100; m += 100){ const y = gyOf(m); c.fillStyle = '#4b6584'; c.fillRect(gx + 18, y, m % 500 ? 5 : 9, 1); if(m % 500 === 0 || m === 1000) zgTxt(c, String(m), gx + 30, y, `600 8px ${ZF.t}`, m === 1000 ? '#d6452f' : '#4b6584', 'left'); }
c.fillStyle = '#d6452f'; c.beginPath(); c.moveTo(gx - 1, fy); c.lineTo(gx - 8, fy - 5); c.lineTo(gx - 8, fy + 5); c.fill();
zgTxt(c, String(Math.round(S.ml)).replace(/\B(?=(\d{3})+$)/g, ' '), 290, 114, `300 15px ${ZF.d}`, '#0e2a52', 'right');
if(S.ph === 'fill'){ const u = nlClamp(S.timer / S.tmax); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(20, 396, 220, 4); c.fillStyle = u < .3 ? '#d6452f' : '#7fb2ff'; c.fillRect(20, 396, 220 * u, 4); }
zgTxt(c, hold && S.ph === 'fill' ? 'ЛЬЁТСЯ… ОТПУСТИ НА «1 Л»' : 'ЗАЖМИ И ДЕРЖИ — ЛЬЁТСЯ', 20, 418, `700 10px ${ZF.t}`, hold && S.ph === 'fill' ? '#7fffb0' : '#cfe0f5', 'left');
zgVerdict(c, W, S.v);
};
const judge = (spill) => {
const err = S.ml - 1000, a = Math.abs(err); let pts, v;
if(spill || S.ml > 1060){ pts = 0; v = { t: 'ПЕРЕЛИВ', s: Math.round(S.ml) + ' мл — брак', ...ZBAD }; }
else if(a <= 15){ pts = 100; v = { t: 'ИДЕАЛЬНО', s: Math.round(S.ml) + ' мл', ...ZOK }; }
else if(a <= 40){ pts = 80; v = { t: 'ГОДНО', s: (err > 0 ? '+' : '−') + Math.round(a) + ' мл от литра', ...ZMID }; }
else { pts = S.ml < 1 ? 0 : 30; v = { t: 'НЕДОЛИВ', s: Math.round(S.ml) + ' мл', ...ZBAD }; }
S.res.push(pts); S.v = { ...v, a: 1.3, y: 186 }; S.ph = 'cap'; S.t = 0; hmTone(pts >= 100 ? 990 : pts >= 80 ? 700 : 200, .18, .06, pts >= 80 ? 'sine' : 'sawtooth'); hud();
};
const finish = () => {
g.stop(); const sum = S.res.reduce((a, b) => a + b, 0), sc = Math.round(sum / N), good = S.res.filter(r => r >= 80).length, b = hgBest('zmilk', sc);
g.show('🥛', sc >= 85 ? 'Партия принята' : 'Партия на доработку', `Годных бутылок: <b>${good}</b> из ${N} · идеальных: <b>${S.res.filter(r => r === 100).length}</b>.<br>Оценка смены: <b>${sc}</b> / 100. ${sc >= 85 ? 'Берсенев и Сенченко подписывают накладную.' : 'На «Лебедяни» так не разливают — ещё смену?'}`, 'Ещё смена'); g.rec('Рекорд: ' + b + ' / 100');
};
const start = () => {
S = reset(); hold = false; g.hide(); hud();
g.loop((dt, t) => {
S.t += dt; S.wob += dt * (hold ? 16 : 6);
if(S.v) S.v.a -= dt * .9;
if(S.ph === 'in'){ S.x = -110 + (NX + 110) * zgEase(S.t / .6); if(S.t >= .6){ S.x = NX; S.ph = 'fill'; S.t = 0; S.tmax = S.timer = 1000 / rate() + 2.2; hold = false; } }
else if(S.ph === 'fill'){
S.timer -= dt;
if(hold){ S.ml += rate() * dt; S.poured = true; S.drip = .18; if(Math.random() < .5) S.drops.push({ x: NX + (Math.random() - .5) * 12, y: lvlY(S.ml), vx: (Math.random() - .5) * 60, vy: -40 - Math.random() * 60, r: 1 + Math.random() * 1.6 }); }
else if(S.drip > 0){ S.drip -= dt; S.ml += rate() * .12 * dt / .18; if(S.drip <= 0) judge(false); }
else if(S.poured){ judge(false); }
if(S.ph === 'fill' && S.ml >= MAX){ S.ml = MAX; judge(true); }
if(S.ph === 'fill' && S.timer <= 0){ hold = false; judge(false); }
}
else if(S.ph === 'cap'){ if(S.res[S.res.length - 1] === 0 && S.ml >= 1060) S.spill = Math.min(1, S.spill + dt * 2); S.cap = Math.min(1, S.t / .35); if(S.t > 1.1){ S.ph = 'out'; S.t = 0; } }
else if(S.ph === 'out'){ S.x = NX + (W + 120 - NX) * zgEase(S.t / .55); if(S.t >= .55){ S.i++; if(S.i >= N) return finish(); S.ph = 'in'; S.t = 0; S.ml = 0; S.poured = false; S.drip = 0; S.cap = 0; S.spill = 0; hud(); } }
S.drops.forEach(d => { d.vy += 500 * dt; d.x += d.vx * dt; d.y += d.vy * dt; }); S.drops = S.drops.filter(d => d.y < lvlY(S.ml) + 4 && d.y < BASE);
draw(t);
});
};
g.ov.querySelector('.hg-go').addEventListener('click', start);
S = reset(); S.x = NX; S.ml = 720; draw(0); hud(); zgRec(g, 'zmilk', ' / 100');
g.show('🥛', 'Розлив на «Лебедяни»', 'Бутылка встаёт под кран. <b>Зажми экран</b> — молоко льётся, <b>отпусти</b>, когда уровень дойдёт до красной метки «1 л». Справа — шкала: попади в зелёную зону.', 'Начать смену');
};
const zgCut = root => {
const g = hgMount(root, 'zcut'); if(!g) return;
const { ctx: c, W, H } = g, N = 10, KX = 196, BY = 236, BT = 30, MM = .5;
let S;
const reset = () => ({ off: 0, v: 70, marks: [], made: 0, done: 0, res: [], knife: 0, v2: null, sheets: [], shake: 0 });
const hud = () => g.hud('Рез <b>' + Math.min(N, S.done + 1) + '/' + N + '</b>', 'Точных <b>' + S.res.filter(r => r <= 2).length + '</b>');
const nearest = () => { let b = null; S.marks.forEach(m => { if(!m.cut && !m.miss && (!b || Math.abs(m.x - KX) < Math.abs(b.x - KX))) b = m; }); return b; };
const cutNow = () => {
if(!g.run || S.knife > 0) return; S.knife = .26; S.shake = 4; try{ fxNoise(.09, 2600, .06, 'highpass'); }catch(_){}
const m = nearest(), dx = m ? m.x - KX : 999;
if(m && Math.abs(dx) < 70){ m.cut = true; const mm = Math.abs(dx) * MM; S.res.push(mm); S.done++; S.sheets.push({ x: KX, y: BY, t: 0 });
S.v2 = mm <= 2 ? { t: 'ТОЧНО', s: mm.toFixed(1) + ' мм', ...ZOK, a: 1.2, y: 116 } : mm <= 8 ? { t: (dx > 0 ? 'ПОЗДНО ' : 'РАНО ') + mm.toFixed(0) + ' мм', s: 'в допуске', ...ZMID, a: 1.2, y: 116 } : { t: 'БРАК', s: (dx > 0 ? 'поздно на ' : 'рано на ') + mm.toFixed(0) + ' мм', ...ZBAD, a: 1.2, y: 116 };
hmTone(mm <= 2 ? 990 : mm <= 8 ? 660 : 220, .14, .06); }
else { S.res.push(30); S.done++; S.v2 = { t: 'МИМО', s: 'метки нет под ножом', ...ZBAD, a: 1.2, y: 116 }; hmTone(180, .2, .06, 'sawtooth'); }
hud(); if(S.done >= N) setTimeout(finish, 700);
};
zgHold(g, cutNow);
const board = (x0, x1) => {
c.fillStyle = '#d9b47c'; c.fillRect(x0, BY, x1 - x0, 5); c.fillRect(x0, BY + BT - 5, x1 - x0, 5);
c.fillStyle = '#c99d5f'; c.fillRect(x0, BY + 5, x1 - x0, BT - 10);
c.strokeStyle = '#9c7440'; c.lineWidth = 1.6; c.beginPath(); for(let x = x0; x <= x1; x += 2){ const y = BY + BT / 2 + Math.sin((x - S.off) / 5) * (BT / 2 - 6); x === x0 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke();
c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x0, BY, x1 - x0, 1.5);
};
const draw = t => {
c.save(); if(S.shake > 0) c.translate((Math.random() - .5) * S.shake, (Math.random() - .5) * S.shake);
const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#24272b'); bg.addColorStop(1, '#141618'); c.fillStyle = bg; c.fillRect(-6, -6, W + 12, H + 12);
zgTxt(c, 'ГОТЭК · ГОФРОАГРЕГАТ', 16, 22, `800 12px ${ZF.d}`, '#ffcc00', 'left'); zgTxt(c, 'профиль B · 3 слоя', W - 16, 22, `600 9px ${ZF.t}`, 'rgba(255,255,255,.5)', 'right');
const sx = 30, sw = W - 60, sy = 60, rng = 60, toX = mm => sx + sw / 2 + mm / rng * sw / 2;
c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(sx, sy, sw, 22); c.fillStyle = 'rgba(242,182,50,.35)'; c.fillRect(toX(-8), sy, toX(8) - toX(-8), 22); c.fillStyle = 'rgba(31,157,85,.8)'; c.fillRect(toX(-2), sy, toX(2) - toX(-2), 22);
for(let mm = -60; mm <= 60; mm += 10){ c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(toX(mm), sy + 22, 1, mm % 30 ? 4 : 8); }
zgTxt(c, 'РАНО', sx, sy + 38, `700 8.5px ${ZF.t}`, 'rgba(255,255,255,.45)', 'left'); zgTxt(c, 'ТОЧНО', W / 2, sy + 38, `700 8.5px ${ZF.t}`, '#5fd08f'); zgTxt(c, 'ПОЗДНО', sx + sw, sy + 38, `700 8.5px ${ZF.t}`, 'rgba(255,255,255,.45)', 'right');
const m = nearest(); if(m){ const mm = (m.x - KX) * MM; if(Math.abs(mm) <= rng + 10){ const px = toX(Math.max(-rng, Math.min(rng, mm))); c.fillStyle = '#ff4d3a'; c.fillRect(px - 2, sy - 6, 4, 34); c.beginPath(); c.moveTo(px - 6, sy - 10); c.lineTo(px + 6, sy - 10); c.lineTo(px, sy - 2); c.fill(); } }
for(const [x, r] of [[24, 24], [W - 24, 24]]){ c.fillStyle = '#3a3e44'; c.beginPath(); c.arc(x, BY + BT / 2, r, 0, 7); c.fill(); c.strokeStyle = '#ffcc00'; c.lineWidth = 3; c.beginPath(); const a = S.off / r; c.arc(x, BY + BT / 2, r - 4, a, a + 1.4); c.stroke(); c.fillStyle = '#1b1d20'; c.beginPath(); c.arc(x, BY + BT / 2, 6, 0, 7); c.fill(); }
board(0, W);
S.marks.forEach(mk => { if(mk.x < -6 || mk.x > W + 6) return; if(mk.cut){ c.fillStyle = '#141618'; c.fillRect(mk.x - 1.5, BY - 1, 3, BT + 2); return; } c.fillStyle = mk.miss ? 'rgba(255,77,58,.4)' : '#ff4d3a'; c.fillRect(mk.x - 2, BY - 14, 4, BT + 28); c.beginPath(); c.moveTo(mk.x - 7, BY - 20); c.lineTo(mk.x + 7, BY - 20); c.lineTo(mk.x, BY - 12); c.fill(); });
const drop = S.knife > 0 ? Math.sin((1 - S.knife / .26) * Math.PI) : 0, ky = BY - 70 + drop * 74;
c.fillStyle = '#3a3e44'; c.fillRect(KX - 34, 100, 68, 22); c.fillStyle = '#ffcc00'; for(let k = 0; k < 6; k++){ c.beginPath(); c.moveTo(KX - 34 + k * 12, 100); c.lineTo(KX - 28 + k * 12, 100); c.lineTo(KX - 34 + k * 12 + 12, 122); c.lineTo(KX - 40 + k * 12 + 12, 122); c.fill(); }
c.fillStyle = '#5a6068'; c.fillRect(KX - 4, 122, 8, ky - 122);
const bl = c.createLinearGradient(KX - 16, 0, KX + 16, 0); bl.addColorStop(0, '#9aa4b0'); bl.addColorStop(.5, '#f2f5f8'); bl.addColorStop(1, '#8a94a0'); c.fillStyle = bl; c.beginPath(); c.moveTo(KX - 16, ky); c.lineTo(KX + 16, ky); c.lineTo(KX + 16, ky + 34); c.lineTo(KX, ky + 46); c.lineTo(KX - 16, ky + 34); c.closePath(); c.fill(); c.strokeStyle = '#5a6068'; c.lineWidth = 1; c.stroke();
c.strokeStyle = 'rgba(255,204,0,.6)'; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(KX, BY - 24); c.lineTo(KX, BY + BT + 24); c.stroke(); c.setLineDash([]);
c.fillStyle = '#2d3136'; c.fillRect(150, 404, 150, 8);
for(let i = 0; i < S.res.filter(r => r < 30).length; i++){ c.fillStyle = i % 2 ? '#d9b47c' : '#c99d5f'; c.fillRect(158, 398 - i * 6, 134, 6); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(158, 403 - i * 6, 134, 1); }
S.sheets.forEach(sh => { const u = zgEase(sh.t / .5); c.globalAlpha = 1 - u * .3; c.fillStyle = '#d9b47c'; c.fillRect(sh.x + 6 + u * 40, BY + u * 130, 80 - u * 20, 8); c.globalAlpha = 1; });
zgTxt(c, 'ГОТОВЫЕ ЛИСТЫ', 225, 424, `700 8.5px ${ZF.t}`, 'rgba(255,255,255,.5)');
zgTxt(c, 'ЖМИ, КОГДА', 16, 392, `700 10px ${ZF.t}`, '#ffcc00', 'left'); zgTxt(c, 'МЕТКА ПОД НОЖОМ', 16, 406, `700 10px ${ZF.t}`, '#ffcc00', 'left');
zgVerdict(c, W, S.v2);
c.restore();
};
const finish = () => {
if(!g.run) return; g.stop(); const avg = S.res.reduce((a, b) => a + b, 0) / S.res.length, sc = Math.max(0, Math.round(100 - avg * 4)), b = hgBest('zcut', sc);
g.show('📦', avg <= 4 ? 'Рез по чертежу' : 'Листы в переработку', `Точных резов: <b>${S.res.filter(r => r <= 2).length}</b> из ${N} · среднее отклонение <b>${avg.toFixed(1)} мм</b>.<br>Оценка: <b>${sc}</b> / 100. ${avg <= 4 ? 'Голиков и Лукин режут так же.' : 'На ГОТЭКе допуск — пара миллиметров.'}`, 'Ещё смена'); g.rec('Рекорд: ' + b + ' / 100');
};
const start = () => {
S = reset(); g.hide(); hud(); let gap = 0;
g.loop((dt, t) => {
S.v = 70 + S.done * 11; S.off += S.v * dt; S.knife = Math.max(0, S.knife - dt); S.shake = Math.max(0, S.shake - dt * 30); if(S.v2) S.v2.a -= dt * .8;
S.marks.forEach(mk => mk.x += S.v * dt); gap -= S.v * dt;
if(S.made < N && gap <= 0){ S.marks.push({ x: -10, cut: false }); S.made++; gap = 190 + Math.random() * 90; }
S.marks.forEach(mk => { if(!mk.cut && !mk.miss && mk.x > KX + 70){ mk.miss = true; S.res.push(30); S.done++; S.v2 = { t: 'ПРОПУЩЕНО', s: 'нож не опустился', ...ZBAD, a: 1.2, y: 116 }; hmTone(180, .2, .06, 'sawtooth'); hud(); if(S.done >= N) setTimeout(finish, 700); } });
S.sheets.forEach(sh => sh.t += dt); S.sheets = S.sheets.filter(sh => sh.t < .5);
S.marks = S.marks.filter(mk => mk.x < W + 20);
draw(t);
});
};
g.ov.querySelector('.hg-go').addEventListener('click', start);
S = reset(); S.marks = [{ x: KX - 40, cut: false }]; draw(0); hud(); zgRec(g, 'zcut', ' / 100');
g.show('📦', 'Гофроагрегат ГОТЭК', 'Картон идёт полотном слева направо. <b>Жми</b>, когда красная метка точно под ножом. Сверху шкала: стрелка в <b>зелёной зоне</b> — идеальный рез. 10 листов.', 'Запустить линию');
};
const zgStack = root => {
const g = hgMount(root, 'zstack'); if(!g) return;
const { ctx: c, W, H } = g, GOAL = 12, BH = 24, BASE = 360, PW = 176, PX = (W - PW) / 2;
let S;
const reset = () => ({ stack: [{ x: PX, w: PW }], cur: null, dir: 1, sp: 110, falls: [], cam: 0, perfect: 0, v: null, drop: 0 });
const hud = () => g.hud('Ярус <b>' + (S.stack.length - 1) + '/' + GOAL + '</b>', 'Идеально <b>' + S.perfect + '</b>');
const spawn = () => { const top = S.stack[S.stack.length - 1]; S.cur = { x: S.dir > 0 ? 8 : W - top.w - 8, w: top.w }; S.sp = 110 + S.stack.length * 11; };
const lvlY = i => BASE - i * BH;
const place = () => {
if(!g.run || !S.cur || S.drop > 0) return; S.drop = .16;
setTimeout(() => {
if(!g.run || !S.cur) return; const top = S.stack[S.stack.length - 1], cur = S.cur, l = Math.max(cur.x, top.x), r = Math.min(cur.x + cur.w, top.x + top.w), ov = r - l; S.drop = 0;
if(ov <= 4){ S.falls.push({ x: cur.x, w: cur.w, lvl: S.stack.length, y: 0, vy: 0, rot: 0, vr: (Math.random() - .5) * 4 }); S.cur = null; S.v = { t: 'УПАЛА', s: 'мимо поддона', ...ZBAD, a: 1.3, y: 110 }; hmTone(150, .35, .07, 'sawtooth'); return end(false); }
if(Math.abs(cur.x - top.x) <= 6){ S.stack.push({ x: top.x, w: top.w }); S.perfect++; S.v = { t: 'ИДЕАЛЬНО', s: 'угол в угол', ...ZOK, a: 1.1, y: 110 }; hmTone(990, .12, .05); setTimeout(() => hmTone(1320, .12, .04), 70); }
else { S.stack.push({ x: l, w: ov }); const cutW = cur.w - ov, cutX = cur.x < top.x ? cur.x : r; S.falls.push({ x: cutX, w: cutW, lvl: S.stack.length - 1, y: 0, vy: 0, rot: 0, vr: (cur.x < top.x ? -1 : 1) * 3 }); S.v = { t: '−' + Math.round(cutW / PW * 100) + '%', s: 'край отрезан', ...ZMID, a: 1.1, y: 110 }; hmTone(560, .1, .05); }
S.dir *= -1; hud(); if(S.stack.length - 1 >= GOAL) return end(true); spawn();
}, 160);
};
zgHold(g, place);
const box = (x, y, w, hot) => {
const h = BH - 2; const gr = c.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, hot ? '#e2bd86' : '#d4ab72'); gr.addColorStop(1, hot ? '#c99d5f' : '#bb8f55'); c.fillStyle = gr; c.fillRect(x, y, w, h);
c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x, y, w, 2); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(x, y + h - 2, w, 2);
if(w > 30){ c.fillStyle = 'rgba(150,105,50,.55)'; c.fillRect(x + w / 2 - 7, y, 14, h); }
if(w > 90){ zgTxt(c, 'ГОТЭК', x + 10, y + h / 2 + 1, `800 8.5px ${ZF.d}`, 'rgba(70,40,10,.75)', 'left'); zgTxt(c, '↑↑', x + w - 10, y + h / 2 + 1, `800 9px ${ZF.d}`, 'rgba(70,40,10,.6)', 'right'); }
c.strokeStyle = 'rgba(70,40,10,.45)'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1);
};
const draw = t => {
const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#f3ead6'); bg.addColorStop(1, '#e5d7b8'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
c.fillStyle = 'rgba(27,26,23,.07)'; for(const x of [0, W - 60]){ for(let y = 70; y < 400; y += 54){ c.fillRect(x, y, 60, 4); for(let k = 0; k < 3; k++) c.fillRect(x + 4 + k * 19, y - 26, 16, 26); } c.fillRect(x + 2, 60, 4, 360); c.fillRect(x + 54, 60, 4, 360); }
zgTxt(c, 'СКЛАД ГОТЭК · ПОДДОН № 27', W / 2, 18, `800 11px ${ZF.d}`, '#c9302c');
c.fillStyle = '#2a2622'; c.fillRect(0, 34, W, 6); c.fillStyle = '#ffcc00'; for(let x = 0; x < W; x += 16) c.fillRect(x, 40, 8, 3);
const camY = S.cam;
c.save(); c.translate(0, camY);
const py = BASE + BH - 2; c.fillStyle = '#9a7449'; c.fillRect(PX - 6, py, PW + 12, 7); c.fillStyle = '#7d5c36'; for(const x of [PX - 6, PX + PW / 2 - 9, PX + PW - 12]) c.fillRect(x, py + 7, 18, 11); c.fillStyle = '#9a7449'; c.fillRect(PX - 6, py + 18, PW + 12, 5);
c.fillStyle = 'rgba(0,0,0,.1)'; c.fillRect(PX - 20, py + 23, PW + 40, 3);
if(S.stack.length === 1){ c.strokeStyle = 'rgba(201,48,44,.5)'; c.setLineDash([5, 4]); c.strokeRect(PX + .5, lvlY(0) + .5, PW - 1, BH - 3); c.setLineDash([]); }
S.stack.forEach((b, i) => { if(i) box(b.x, lvlY(i - 1), b.w, false); });
for(let i = 0; i <= GOAL; i++){ const y = lvlY(i - 1) + BH - 1; c.fillStyle = 'rgba(27,26,23,.3)'; c.fillRect(W - 18, y, i % 4 ? 5 : 10, 1); if(i && i % 4 === 0) zgTxt(c, String(i), W - 22, y, `600 8px ${ZF.t}`, 'rgba(27,26,23,.5)', 'right'); }
if(S.cur){ const lv = S.stack.length - 1, ty = lvlY(lv), hang = ty - 70, y = S.drop > 0 ? hang + (ty - hang) * (1 - S.drop / .16) : hang; const cx = S.cur.x + S.cur.w / 2;
c.strokeStyle = 'rgba(201,48,44,.35)'; c.setLineDash([3, 4]); c.strokeRect(S.cur.x + .5, ty + .5, S.cur.w - 1, BH - 3); c.setLineDash([]);
c.restore(); c.strokeStyle = '#2a2622'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx, 43); c.lineTo(cx, y + camY - 8); c.stroke(); c.fillStyle = '#2a2622'; c.fillRect(cx - 14, 36, 28, 10); c.fillStyle = '#ffcc00'; c.fillRect(cx - 8, y + camY - 10, 16, 4);
c.save(); c.translate(0, camY); box(S.cur.x, y, S.cur.w, true); }
S.falls.forEach(f => { c.save(); const y = lvlY(f.lvl - 1) + f.y; c.translate(f.x + f.w / 2, y + BH / 2); c.rotate(f.rot); c.globalAlpha = Math.max(0, 1 - f.y / 320); box(-f.w / 2, -BH / 2, f.w, false); c.restore(); });
c.restore();
zgTxt(c, 'ЖМИ — ОПУСТИТЬ КОРОБКУ', W / 2, H - 14, `700 9.5px ${ZF.t}`, 'rgba(27,26,23,.6)');
zgVerdict(c, W, S.v);
};
const end = ok => {
if(!g.run) return; setTimeout(() => {
g.stop(); const lv = S.stack.length - 1, sc = lv * 8 + S.perfect * 4, b = hgBest('zstack', sc);
g.show('🧱', ok ? 'Поддон собран' : 'Коробка упала', `Ярусов: <b>${lv}</b> из ${GOAL} · идеальных: <b>${S.perfect}</b>.<br>${ok ? 'Сериков и Чертовских — поддон хоть в музей.' : 'На складе ГОТЭКа так не кладут. Пересобрать?'}`, 'Пересобрать'); g.rec('Рекорд: ' + b + ' очков');
}, ok ? 500 : 1100);
};
const start = () => {
S = reset(); g.hide(); spawn(); hud();
g.loop((dt, t) => {
if(S.v) S.v.a -= dt * .9;
if(S.cur && S.drop <= 0){ S.cur.x += S.dir * S.sp * dt; if(S.cur.x + S.cur.w > W - 6){ S.cur.x = W - 6 - S.cur.w; S.dir = -1; } if(S.cur.x < 6){ S.cur.x = 6; S.dir = 1; } }
if(S.drop > 0) S.drop = Math.max(.0001, S.drop - dt);
S.falls.forEach(f => { f.vy += 900 * dt; f.y += f.vy * dt; f.rot += f.vr * dt; }); S.falls = S.falls.filter(f => f.y < 340);
const want = Math.max(0, (S.stack.length - 8) * BH); S.cam += (want - S.cam) * Math.min(1, dt * 4);
draw(t);
});
};
g.ov.querySelector('.hg-go').addEventListener('click', start);
S = reset(); S.stack.push({ x: PX, w: PW }, { x: PX + 10, w: PW - 10 }); S.cur = { x: 40, w: PW - 10 }; draw(0); S = reset(); hud(); zgRec(g, 'zstack', ' очков');
g.show('🧱', 'Поддон ГОТЭК', 'Кран носит коробку влево-вправо. <b>Жми</b>, чтобы опустить её ровно на ярус ниже. Всё, что свисает, отрежется — следующая будет уже. Собери <b>12 ярусов</b>.', 'Собрать поддон');
};
const zgCar = root => {
const g = hgMount(root, 'zcar'); if(!g) return;
const { ctx: c, W, H } = g, N = 10, CX = 160, GY = 262, BY = 354, BW = 74, BH2 = 74;
const PARTS = ['Колёса', 'Двери', 'Фары', 'Капот'], COLS = ['#e9ecef', '#9aa3ad', '#22262c', '#b3261e', '#1d4e89'];
let S;
const reset = () => ({ i: 0, ph: 'in', t: 0, x: -170, car: null, timer: 0, tmax: 1, res: [], v: null, fly: null, hit: -1 });
const hud = () => g.hud('Авто <b>' + Math.min(N, S.i + 1) + '/' + N + '</b>', 'Без брака <b>' + S.res.filter(Boolean).length + '</b>');
const newCar = () => { const need = Math.random() * 4 | 0, has = [true, true, true, true]; has[need] = false; return { need, has, col: COLS[S.i % COLS.length], bad: false }; };
const icon = (k, x, y, s, col) => {
c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.2 / s;
if(k === 0){ c.beginPath(); c.arc(0, 0, 13, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, 5, 0, 7); c.stroke(); for(let a = 0; a < 5; a++){ const an = a / 5 * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(an) * 5, Math.sin(an) * 5); c.lineTo(Math.cos(an) * 11, Math.sin(an) * 11); c.stroke(); } }
else if(k === 1){ c.beginPath(); c.moveTo(-12, 12); c.lineTo(-12, -4); c.lineTo(-4, -12); c.lineTo(12, -12); c.lineTo(12, 12); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(-8, -3); c.lineTo(-2, -8); c.lineTo(8, -8); c.lineTo(8, -3); c.closePath(); c.stroke(); c.fillRect(3, 2, 6, 2.4); }
else if(k === 2){ c.beginPath(); c.arc(-3, 0, 9, -Math.PI / 2, Math.PI / 2); c.closePath(); c.stroke(); for(const dy of [-7, 0, 7]){ c.beginPath(); c.moveTo(9, dy); c.lineTo(15, dy * 1.4); c.stroke(); } }
else { c.beginPath(); c.moveTo(-14, 8); c.lineTo(-8, -8); c.lineTo(14, -8); c.lineTo(14, 8); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(-6, 0); c.lineTo(8, 0); c.stroke(); }
c.restore();
};
const car = (x, cr, pulse) => {
const ox = x, y = GY, col = cr.col, dark = col === '#22262c';
c.save(); c.translate(ox, y);
c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, 20, 120, 7, 0, 0, 7); c.fill();
const body = () => { c.beginPath(); c.moveTo(-118, 6); c.lineTo(-120, -18); c.quadraticCurveTo(-119, -30, -104, -32); c.lineTo(-74, -34); c.lineTo(-48, -60); c.quadraticCurveTo(-40, -66, -26, -66); c.lineTo(28, -66); c.quadraticCurveTo(38, -66, 46, -58); c.lineTo(70, -36); c.lineTo(108, -30); c.quadraticCurveTo(122, -26, 122, -12); c.lineTo(120, 6); c.closePath(); };
body(); const bg = c.createLinearGradient(0, -66, 0, 8); bg.addColorStop(0, dark ? '#4a515c' : '#ffffff'); bg.addColorStop(.25, col); bg.addColorStop(1, dark ? '#0d0f12' : 'rgba(0,0,0,.35)'); c.fillStyle = col; c.fill(); c.fillStyle = bg; c.globalAlpha = .55; c.fill(); c.globalAlpha = 1;
c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.2; c.stroke();
c.fillStyle = '#1a2533'; c.beginPath(); c.moveTo(-66, -36); c.lineTo(-44, -58); c.lineTo(-6, -58); c.lineTo(-6, -36); c.closePath(); c.fill(); c.beginPath(); c.moveTo(0, -58); c.lineTo(26, -58); c.quadraticCurveTo(34, -58, 40, -52); c.lineTo(58, -36); c.lineTo(0, -36); c.closePath(); c.fill();
c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(-58, -38); c.lineTo(-42, -54); c.lineTo(-34, -54); c.lineTo(-50, -38); c.fill();
c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-110, -26, 220, 1.4);
const ghost = k => cr.has[k] ? null : (pulse > .5 ? '#ffb000' : 'rgba(255,176,0,.45)');
if(cr.has[1]){ c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-3, -36); c.lineTo(-3, 2); c.moveTo(-70, -34); c.lineTo(-72, 2); c.moveTo(56, -34); c.lineTo(58, 2); c.stroke(); c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(-26, -26, 10, 2.5); c.fillRect(36, -26, 10, 2.5); }
else { c.fillStyle = '#0d1117'; c.beginPath(); c.moveTo(-70, -36); c.lineTo(58, -36); c.lineTo(58, 2); c.lineTo(-72, 2); c.closePath(); c.fill(); c.fillStyle = '#3a414b'; c.fillRect(-60, -10, 40, 8); c.fillRect(6, -10, 40, 8); c.strokeStyle = ghost(1); c.lineWidth = 2; c.setLineDash([5, 4]); c.stroke(); c.setLineDash([]); }
if(!cr.has[3]){ c.fillStyle = '#0d1117'; c.beginPath(); c.moveTo(70, -36); c.lineTo(108, -30); c.quadraticCurveTo(120, -27, 121, -18); c.lineTo(70, -18); c.closePath(); c.fill(); c.strokeStyle = '#59616c'; c.lineWidth = 1; for(let k = 0; k < 4; k++){ c.beginPath(); c.arc(84 + k * 9, -24, 3, 0, 7); c.stroke(); } c.strokeStyle = ghost(3); c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(70, -36); c.lineTo(108, -30); c.quadraticCurveTo(120, -27, 121, -18); c.stroke(); c.setLineDash([]); }
if(cr.has[2]){ c.fillStyle = '#fff6c8'; zgRR(c, 108, -24, 13, 7, 2); c.fill(); c.fillStyle = '#c83a2d'; c.fillRect(-120, -22, 6, 8); }
else { c.fillStyle = '#0d1117'; zgRR(c, 108, -24, 13, 7, 2); c.fill(); c.strokeStyle = ghost(2); c.lineWidth = 2; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]); }
for(const wx of [-78, 80]){ c.fillStyle = '#0b0d10'; c.beginPath(); c.arc(wx, 4, 25, Math.PI, 0); c.fill();
if(cr.has[0]){ c.fillStyle = '#121418'; c.beginPath(); c.arc(wx, 6, 21, 0, 7); c.fill(); const rg = c.createRadialGradient(wx - 3, 3, 1, wx, 6, 12); rg.addColorStop(0, '#f2f4f6'); rg.addColorStop(1, '#7c858f'); c.fillStyle = rg; c.beginPath(); c.arc(wx, 6, 12, 0, 7); c.fill(); c.strokeStyle = '#3a414b'; c.lineWidth = 1.4; for(let a = 0; a < 5; a++){ const an = a / 5 * 6.283 + S.t * 3 * (S.ph === 'in' || S.ph === 'out' ? 1 : 0); c.beginPath(); c.moveTo(wx, 6); c.lineTo(wx + Math.cos(an) * 11, 6 + Math.sin(an) * 11); c.stroke(); } }
else { c.fillStyle = '#5c646e'; c.fillRect(wx - 3, -2, 6, 10); c.strokeStyle = ghost(0); c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.arc(wx, 6, 21, 0, 7); c.stroke(); c.setLineDash([]); } }
if(cr.bad){ c.strokeStyle = '#d6452f'; c.lineWidth = 4; c.beginPath(); c.moveTo(-40, -50); c.lineTo(40, 0); c.moveTo(40, -50); c.lineTo(-40, 0); c.stroke(); }
c.restore();
};
const press = k => {
if(!g.run || S.ph !== 'post') return; S.hit = k; S.hitT = .25;
const cr = S.car;
if(k === cr.need){ S.ph = 'fit'; S.t = 0; S.fly = { k, x0: 40 + k * 80, y0: BY + 30 }; hmTone(760, .08, .05); }
else { cr.bad = true; S.res.push(false); S.v = { t: 'БРАК', s: 'нужны были: ' + PARTS[cr.need].toLowerCase(), ...ZBAD, a: 1.3, y: 112 }; hmTone(160, .3, .07, 'sawtooth'); S.ph = 'hold'; S.t = 0; hud(); }
};
g.cv.addEventListener('pointerdown', e => { if(!g.run) return; const r = g.cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H; if(y >= BY - 6) press(Math.max(0, Math.min(3, Math.floor((x - 6) / ((W - 12) / 4))))); });
const kd = e => { if(!hmAlive(g.box)) return document.removeEventListener('keydown', kd); const k = '1234'.indexOf(e.key); if(k >= 0 && g.run){ e.preventDefault(); press(k); } };
document.addEventListener('keydown', kd);
const draw = t => {
const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1d2025'); bg.addColorStop(1, '#101215'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
c.fillStyle = 'rgba(255,255,255,.03)'; for(const x of [30, 160, 290]) c.fillRect(x - 10, 0, 20, 280);
for(const x of [70, 250]){ c.fillStyle = '#2b2f36'; c.fillRect(x - 22, 40, 44, 6); const lg = c.createLinearGradient(0, 46, 0, 250); lg.addColorStop(0, 'rgba(255,240,200,.14)'); lg.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = lg; c.beginPath(); c.moveTo(x - 20, 46); c.lineTo(x + 20, 46); c.lineTo(x + 70, 250); c.lineTo(x - 70, 250); c.closePath(); c.fill(); }
zgTxt(c, 'СБОРОЧНЫЙ ЦЕХ · ПОСТ № 2', 16, 20, `800 11px ${ZF.d}`, '#ffb000', 'left'); zgTxt(c, '总装线', W - 16, 20, `600 10px ${ZF.t}`, 'rgba(255,255,255,.4)', 'right');
c.strokeStyle = 'rgba(255,176,0,.5)'; c.setLineDash([6, 5]); c.lineWidth = 1; c.strokeRect(CX - 132.5, 168.5, 265, 120); c.setLineDash([]);
zgTxt(c, 'ПОСТ', CX - 128, 180, `700 8.5px ${ZF.t}`, '#ffb000', 'left');
if(S.car && (S.ph === 'post' || S.ph === 'fit')){ const nd = S.car.need; c.fillStyle = '#ffb000'; zgRR(c, CX - 92, 96, 184, 44, 4); c.fill(); icon(nd, CX - 66, 118, .9, '#1a1205'); zgTxt(c, 'НУЖНЫ: ' + PARTS[nd].toUpperCase(), CX - 44, 118, `800 15px ${ZF.d}`, '#1a1205', 'left');
const u = nlClamp(S.timer / S.tmax); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(CX - 92, 146, 184, 4); c.fillStyle = u < .3 ? '#d6452f' : '#ffb000'; c.fillRect(CX - 92, 146, 184 * u, 4); }
c.fillStyle = '#2a2e34'; c.fillRect(0, GY + 28, W, 14); c.fillStyle = '#3a4048'; const off = S.ph === 'in' || S.ph === 'out' ? (t * 180) % 24 : 0; for(let x = -24 + off; x < W; x += 24) c.fillRect(x, GY + 32, 12, 5);
c.fillStyle = '#16181b'; c.fillRect(0, GY + 42, W, 40);
if(S.car) car(S.x, S.car, (Math.sin(t * 8) + 1) / 2);
if(S.fly){ const u = zgEase(S.t / .38), tx = S.x + [0, -8, 114, 96][S.fly.k], ty = GY + [6, -16, -20, -26][S.fly.k]; icon(S.fly.k, S.fly.x0 + (tx - S.fly.x0) * u, S.fly.y0 + (ty - S.fly.y0) * u - Math.sin(u * Math.PI) * 60, 1.1, '#ffb000'); }
const bw = (W - 12) / 4;
PARTS.forEach((n, k) => { const x = 6 + k * bw, hot = S.hit === k && S.hitT > 0; c.fillStyle = hot ? '#ffb000' : '#23272d'; zgRR(c, x + 3, BY, bw - 6, BH2, 6); c.fill(); c.strokeStyle = hot ? '#ffb000' : 'rgba(255,176,0,.45)'; c.lineWidth = 1; c.stroke();
icon(k, x + bw / 2, BY + 28, 1, hot ? '#1a1205' : '#ffb000'); zgTxt(c, n.toUpperCase(), x + bw / 2, BY + 58, `700 9px ${ZF.t}`, hot ? '#1a1205' : '#e6e8ea'); zgTxt(c, String(k + 1), x + 12, BY + 12, `600 8px ${ZF.t}`, hot ? '#1a1205' : 'rgba(255,255,255,.35)', 'left'); });
zgVerdict(c, W, S.v);
};
const finish = () => {
g.stop(); const ok = S.res.filter(Boolean).length, sc = Math.round(ok / N * 100), b = hgBest('zcar', sc);
g.show('🚗', ok === N ? 'Ноль брака' : 'ОТК вернул машины', `Собрано без брака: <b>${ok}</b> из ${N}.<br>${ok === N ? 'Куликов и Сидоров: каждая деталь на своём месте.' : 'На линии так нельзя — ещё смену?'}`, 'Ещё смена'); g.rec('Рекорд: ' + b + '% без брака');
};
const start = () => {
S = reset(); g.hide(); S.car = newCar(); hud();
g.loop((dt, t) => {
S.t += dt; S.hitT = Math.max(0, (S.hitT || 0) - dt); if(S.v) S.v.a -= dt * .9;
if(S.ph === 'in'){ S.x = -170 + (CX + 170) * zgEase(S.t / .7); if(S.t >= .7){ S.x = CX; S.ph = 'post'; S.t = 0; S.tmax = S.timer = Math.max(1.6, 3.4 - S.i * .18); } }
else if(S.ph === 'post'){ S.timer -= dt; if(S.timer <= 0){ S.car.bad = true; S.res.push(false); S.v = { t: 'НЕ УСПЕЛ', s: 'машина ушла без детали', ...ZBAD, a: 1.3, y: 112 }; hmTone(160, .3, .07, 'sawtooth'); S.ph = 'hold'; S.t = 0; hud(); } }
else if(S.ph === 'fit'){ if(S.t >= .38){ S.car.has[S.fly.k] = true; S.fly = null; S.res.push(true); S.v = { t: 'ГОТОВО', s: PARTS[S.car.need].toLowerCase() + ' на месте', ...ZOK, a: 1.1, y: 112 }; hmTone(990, .1, .05); setTimeout(() => hmTone(1320, .12, .04), 80); S.ph = 'hold'; S.t = 0; hud(); } }
else if(S.ph === 'hold'){ if(S.t >= .55){ S.ph = 'out'; S.t = 0; } }
else if(S.ph === 'out'){ S.x = CX + (W + 180 - CX) * zgEase(S.t / .55); if(S.t >= .55){ S.i++; if(S.i >= N) return finish(); S.car = newCar(); S.ph = 'in'; S.t = 0; S.x = -170; hud(); } }
draw(t);
});
};
g.ov.querySelector('.hg-go').addEventListener('click', start);
S = reset(); S.car = { need: 0, has: [false, true, true, true], col: '#e9ecef', bad: false }; S.x = CX; S.ph = 'post'; S.timer = S.tmax = 1; draw(0); S = reset(); hud(); zgRec(g, 'zcar', '%');
g.show('🚗', 'Сборочная линия', 'Кузов встаёт на пост. Жёлтым мигает <b>то, чего не хватает</b> — сверху написано, что нужно. Нажми нужную деталь внизу (или 1–4), пока не кончилась полоска. 10 машин.', 'Запустить линию');
};
(() => {
const D = {
'Берсенев Илья и Сенченко Дмитрий': { plant: 'ЛЕБЕДЯНЬ', title: 'Розлив', game: ['zmilk', 'РОЗЛИВ · ЛЕБЕДЯНЬ', 'Бутылка <b>1/8</b>', 'Годных <b>0</b>', 'Зажми — льётся · отпусти на метке «1 л»', zgMilk],
kicker: 'Лебедянь · молочный завод', tag: 'Два оператора — одна линия розлива', stats: [[2, 'оператора на линии'], [0, 'пролитых пакетов'], [100, '% по ГОСТу', '%']], infoTitle: 'Линия розлива',
story: ['Берсенев и Сенченко работают на «Лебедяни» — там, где молоко с фермы за несколько часов становится пакетом на полке.', 'Их участок — розлив: пакет должен встать под сопло, налиться ровно до метки и уехать дальше. Чуть больше — перелив, чуть меньше — недолив, и партия уходит в брак.', 'Говорят, по их пакетам можно сверять мерный стакан.'],
quote: ['«Молоко любит точность и холод. Мы — тоже».', 'Начальник смены розлива'], videoTitle: 'Смена на розливе', videoNote: 'Ролик ещё охлаждается до +4 °C.',
facts: ['Пакеты — ровно до метки', 'Перелив на их смене — редкость', 'Работают в паре, как одна линия'], ph: ['🥛', 'Цех розлива', 'Ролик ещё охлаждается'] },
'Голиков Матвей и Лукин Александр': { plant: 'ГОТЭК', title: 'Гофрокартон', game: ['zcut', 'ГОФРОАГРЕГАТ · ГОТЭК', 'Рез <b>1/10</b>', 'Точных <b>0</b>', 'Жми, когда красная метка под ножом', zgCut],
kicker: 'ГОТЭК · производство картона', tag: 'Режут картон ровно по метке', stats: [[3, 'слоя в гофре'], [0, 'мм отклонения'], [1000, 'листов за смену', '+']], infoTitle: 'Гофроагрегат',
story: ['Голиков и Лукин — на ГОТЭКе, где из рулонов бумаги рождается гофрокартон: два плоских слоя и волна между ними.', 'Полотно идёт без остановки, и нож должен резать точно по метке — иначе коробка не сложится. Их листы ложатся в стопку ровно, как по линейке.', 'Пока один следит за полотном, второй уже готовит следующую партию.'],
quote: ['«Картон не прощает лишнего миллиметра».', 'Мастер гофроцеха'], videoTitle: 'Полотно идёт', videoNote: 'Ролик ещё сохнет после склейки.',
facts: ['Рез — точно по метке', 'Тысячи листов за смену', 'Профиль B, три слоя — без брака'], ph: ['📦', 'Гофроагрегат', 'Ролик ещё сохнет'] },
'Сериков Александр и Чертовских Андрей': { plant: 'ГОТЭК', title: 'Поддон', game: ['zstack', 'ПОДДОН · ГОТЭК', 'Ярус <b>0/12</b>', 'Идеально <b>0</b>', 'Жми — опустить коробку', zgStack],
kicker: 'ГОТЭК · склад готовой продукции', tag: 'Поддон собран — как по линейке', stats: [[12, 'ярусов на поддоне'], [0, 'упавших коробок'], [100, '% ровно', '%']], infoTitle: 'Укладка на поддон',
story: ['Сериков и Чертовских тоже на ГОТЭКе — там, куда картон приезжает уже коробками и отправляется к заказчикам.', 'Их работа — собрать поддон так, чтобы он доехал целым: ярус к ярусу, угол к углу, ни одной свисающей коробки.', 'Водители фур говорят, что их поддоны можно перевозить хоть через всю страну.'],
quote: ['«Ровный поддон — это уважение к тому, кто его будет разгружать».', 'Кладовщик смены'], videoTitle: 'Поддон № 27', videoNote: 'Ролик ещё упаковывают в стрейч.',
facts: ['Двенадцать ярусов — и ни одного перекоса', 'Коробки не падают даже на погрузчике', 'Склад работает как часы'], ph: ['🧱', 'Склад ГОТЭК', 'Ролик ещё в плёнке'] },
'Куликов Виталий и Сидоров Никита': { plant: 'АВТОЗАВОД', title: 'Сборка', game: ['zcar', 'СБОРОЧНАЯ ЛИНИЯ', 'Авто <b>1/10</b>', 'Без брака <b>0</b>', 'Нужная деталь — кнопкой внизу или 1–4', zgCar],
kicker: 'Автосборочный завод', tag: 'Каждая деталь — на своё место', stats: [[60, 'секунд на машину'], [0, 'машин с браком'], [4, 'детали на посту']], infoTitle: 'Сборочная линия',
story: ['Куликов и Сидоров — на заводе, где собирают китайские автомобили: кузов приезжает на пост, и за минуту на нём должно появиться то, чего не хватает.', 'Колёса, двери, фары, капот — перепутать нельзя, остановить линию тоже. Ошибка одного поста — машина уходит в ОТК.', 'Их пост знают как место, откуда машины уезжают целыми.'],
quote: ['«Линия не ждёт. Значит, ждать не будем и мы».', 'Мастер сборочного цеха'], videoTitle: 'Пост № 2', videoNote: 'Ролик ещё проходит ОТК.',
facts: ['Минута на машину — и ни одной лишней секунды', 'Ноль брака на посту', 'Колёса, двери, фары — всё на месте'], ph: ['🚗', 'Сборочный цех', 'Ролик ещё на конвейере'] }
};
Object.entries(D).forEach(([name, v]) => {
const d = HOD[name + '|Завод']; if(!d) return;
['kicker', 'tag', 'stats', 'infoTitle', 'story', 'quote', 'videoTitle', 'videoNote', 'facts', 'ph', 'title'].forEach(k => { d[k] = v[k]; });
const [id, ttl, s1, s2, hint, fn] = v.game;
d.art = () => `<div class="zg-art"><b>${v.plant}</b><small>${v.kicker}</small></div>`;
d.info = () => hgShell(id, ttl, s1, s2, hint, true);
d.after = root => { try{ fn(root); }catch(e){ console.warn('zavod game', e); } };
if(typeof ZAVOD !== 'undefined' && ZAVOD[name]){ ZAVOD[name].title = v.title; ZAVOD[name].plant = v.plant; }
});
$$('.nomination-frame[data-zavod] .nominee').forEach((nom, i) => {
const v = D[nom.dataset.nominee], card = $$('.zb')[i]; if(!v || !card) return;
const em = $('.zb-band em', card), t = $('.zb-t', card); if(em) em.textContent = v.plant; if(t) t.textContent = v.title;
});
})();
const CAR_IMG = {
galkin: 'cars/galkin.webp', senchenko: 'cars/senchenko.webp', frolov: 'cars/frolov.webp', samsonov: 'cars/samsonov.webp', kulikov: 'cars/kulikov.webp', serikov: 'cars/serikov.webp',
galkin_m: 'cars/galkin_m.webp', senchenko_m: 'cars/senchenko_m.webp', frolov_m: 'cars/frolov_m.webp', samsonov_m: 'cars/samsonov_m.webp', kulikov_m: 'cars/kulikov_m.webp', serikov_m: 'cars/serikov_m.webp'
};
if(typeof window !== 'undefined' && window.CAR_DATA) for(const k in CAR_IMG) if(window.CAR_DATA[k]) CAR_IMG[k] = window.CAR_DATA[k];
const CAR_RIG = {
'Галкин Виталий': { img: 'galkin', plate: [[3.9, 62.1], [16.8, 63.3], [16.7, 73.1], [3.8, 71.6]], snd: 'modern', paintName: 'Белый «Кэнди»', engine: '1.6 MPI · 110 л.с.', gear: 'АКПП-6', year: '2021',
w: [[51.27,77.63,6.48,7.59,7.8],[92.75,64.82,2.37,5.53,2.6]], tk: 1.42, lip: [[1.5,82.0],[3.0,82.1],[4.5,82.2],[6.0,82.3],[7.5,82.5],[9.0,82.7],[10.5,82.9],[12.0,83.1],[13.5,83.5],[15.0,83.7],[16.5,83.8],[18.0,84.0],[19.5,84.3],[21.0,84.7],[22.5,85.2],[24.0,85.8],[25.5,86.3],[27.0,86.6],[28.5,86.8],[30.0,87.0],[31.5,87.1],[33.0,87.1],[34.5,87.2],[36.0,87.3],[37.5,87.2],[39.0,87.2],[40.5,87.1],[42.0,87.1],[43.5,87.1]],
sill: [[62.0,77.1],[63.5,76.9],[65.0,76.5],[66.5,75.9],[68.0,75.4],[69.5,74.8],[71.0,74.2],[72.5,73.6],[74.0,73.0],[75.5,72.5],[77.0,72.0],[78.5,71.5],[80.0,71.1],[81.5,71.0],[83.0,70.9],[84.5,70.9],[86.0,71.2]], hf: [[5,42.5],[15,44],[25,44.5],[34,43.5],[44.5,43]], hr: [[26.4,26.8],[42,26.3],[58,25.8]],
lights: [[37.5,46.5,1.0],[2.6,52,0.55]], fog: [], rear: { p: [97.5,28.5], k: 'sedan' } },
'Сенченко Дмитрий': { img: 'senchenko', plate: [[6.1, 65.5], [18.8, 68.0], [18.5, 76.0], [5.9, 73.8]], snd: 'sport', paintName: 'Чёрный «Пантера»', engine: '1.6 · 98 л.с.', gear: 'МКПП-5', year: '2016',
w: [[51.21,79.63,6.54,8.06,17.6],[92.09,56.61,2.9,5.73,3.4]], tk: 1.4, lip: [[1.5,78.8],[3.0,79.4],[4.5,80.1],[6.0,80.7],[7.5,81.0],[9.0,81.3],[10.5,81.6],[12.0,81.9],[13.5,82.3],[15.0,82.8],[16.5,83.2],[18.0,83.6],[19.5,83.9],[21.0,84.3],[22.5,85.0],[24.0,85.5],[25.5,85.7],[27.0,85.8],[28.5,85.8],[30.0,85.8],[31.5,85.6],[33.0,85.3],[34.5,85.0],[36.0,84.5],[37.5,84.2],[39.0,84.0],[40.5,84.0],[42.0,84.0]],
sill: [[62.5,75.5],[64.0,75.0],[65.5,74.4],[67.0,73.6],[68.5,72.7],[70.0,71.8],[71.5,70.8],[73.0,70.0],[74.5,69.1],[76.0,68.1],[77.5,67.1],[79.0,66.1],[80.5,65.4],[82.0,65.0],[83.5,64.9],[85.0,64.5],[86.5,64.0]], hf: [[7,44],[16,47.5],[25.5,50.5],[34,51.5],[42,50.5]], hr: [[27.3,28],[43,29.5],[59,31]],
lights: [[34,57,1.0],[5,51,0.6]], fog: [[34.7,77.5,0.5]], rear: { p: [97.3,21.5], k: 'sedan' } },
'Фролов Андрей': { img: 'frolov', plate: [[9.3, 65.0], [31.7, 68.3], [31.0, 78.3], [9.0, 74.8]], snd: 'granta', paintName: 'Серый «Плутон»', engine: '1.6 · 90 л.с.', gear: 'МКПП-5', year: '2023',
w: [[69.86,82.25,5.72,9.23,17.4],[95.7,57.5,1.6,6.45,3.0]], tk: 1.42, lip: [[0.5,77.5],[2.0,78.0],[3.5,78.6],[5.0,79.4],[6.5,80.5],[8.0,81.6],[9.5,82.6],[11.0,83.3],[12.5,83.5],[14.0,83.6],[15.5,83.5],[17.0,83.5],[18.5,83.3],[20.0,83.2],[21.5,83.1],[23.0,83.2],[24.5,83.3],[26.0,83.4],[27.5,83.6],[29.0,83.9],[30.5,84.2],[32.0,84.4],[33.5,84.8],[35.0,85.2],[36.5,85.5],[38.0,85.6],[39.5,85.6],[41.0,85.5],[42.5,85.3],[44.0,85.1],[45.5,84.9],[47.0,84.6],[48.5,84.4],[50.0,84.2],[51.5,84.2],[53.0,84.9],[54.5,86.6],[56.0,87.9],[57.5,88.7]],
sill: [[82.7,68.8],[84.2,68.7],[85.7,68.6],[87.2,68.4],[88.7,68.2]], hf: [[7,47],[15,50],[25,52.5],[39,54.5],[50,51.5],[62.5,47.8]], hr: [[29.2,27.2],[50,29.5],[72.3,32.5]],
lights: [[53,54.5,1.0],[5.3,49,0.6]], fog: [], rear: { p: [96.5,27.5], k: 'sedan' } },
'Самсонов Константин': { img: 'samsonov', plate: [[3.8, 68.8], [12.9, 73.4], [12.3, 81.6], [3.2, 77.0]], snd: 'vaz', paintName: 'Тёмно-зелёный «Изумруд»', engine: '1.5 · 79 л.с.', gear: 'МКПП-5', year: '2004',
w: [[50.31,79.69,4.71,7.18,16.4],[91.65,46.41,1.87,6.07,16.4]], tk: 1.45, lip: [[4.5,72.2],[6.0,73.2],[7.5,74.4],[9.0,76.0],[10.5,77.1],[12.0,77.3],[13.5,77.4],[15.0,77.7],[16.5,78.4],[18.0,79.3],[19.5,80.6],[21.0,82.3],[22.5,84.2],[24.0,86.1],[25.5,87.8],[27.0,88.8],[28.5,89.0],[30.0,89.0],[31.5,89.0],[33.0,89.2],[34.5,89.4],[36.0,89.5],[37.5,89.5],[39.0,89.7],[40.5,90.2],[42.0,90.8]],
sill: [[60.7,73.9],[62.2,73.2],[63.7,72.3],[65.2,71.2],[66.7,69.8],[68.2,68.5],[69.7,67.4],[71.2,66.2],[72.7,65.1],[74.2,63.8],[75.7,62.5],[77.2,61.0],[78.7,59.8],[80.2,58.9],[81.7,58.3],[83.2,57.8],[84.7,57.5]], hf: [[5,53.5],[10,57],[16.5,62],[25,63.3],[33,61.8]], hr: [[32.7,31],[46,34.5],[58.5,38]],
lights: [[24,66.5,1.0],[5,57.5,0.55]], fog: [], rear: { p: [96.5,24], r: [88,9], k: 'hatch' } },
'Куликов Виталий': { img: 'kulikov', plate: [[3.1, 63.2], [13.7, 78.9], [13.7, 82.8], [2.0, 66.6]], snd: 'carb', paintName: 'Малиновый «Виктория»', engine: '1.5 · 70 л.с. · карбюратор', gear: 'МКПП-5', year: '1998',
w: [[56.79,84.32,4.29,7.91,15.0],[93.3,42.83,1.21,3.93,11.7]], tk: 1.6, lip: [[2.5,68.9],[4.0,70.2],[5.5,71.7],[7.0,73.5],[8.5,75.4],[10.0,77.3],[11.5,79.1],[13.0,80.8],[14.5,82.5],[16.0,83.6],[17.5,83.9],[19.0,84.0],[20.5,84.2],[22.0,84.4],[23.5,84.5],[25.0,84.6],[26.5,84.6],[28.0,84.6],[29.5,84.6],[31.0,84.3],[32.5,83.9],[34.0,83.5],[35.5,83.4],[37.0,83.5],[38.5,83.5],[40.0,83.8],[41.5,84.3],[43.0,84.5],[44.5,84.5],[46.0,84.5]],
sill: [[69.2,65.1],[70.7,64.3],[72.2,63.3],[73.7,61.9],[75.2,60.2],[76.7,58.5],[78.2,57.0],[79.7,55.5],[81.2,53.9],[82.7,52.4],[84.2,51.0],[85.7,49.7],[87.2,49.1],[88.7,48.9]], hf: [[3.5,42.5],[8,47],[14,53],[20,58.5],[26,61],[32,63]], hr: [[35.5,21],[50,27],[65.5,33.5]],
lights: [[24,67,1.0],[4.3,50,0.6]], fog: [], rear: { p: [97.5,15.5], r: [91,1.5], k: 'hatch' } },
'Сериков Александр': { img: 'serikov', plate: [[5.6, 64.2], [20.3, 65.1], [20.1, 72.9], [5.6, 71.7]], snd: 'granta', paintName: 'Белый «Ледниковый»', engine: '1.6 · 90 л.с.', gear: 'МКПП-5', year: '2022',
w: [[53.49,79.18,3.85,7.03,5.0],[91.98,64.44,2.44,5.5,1.4]], tk: 1.55, lip: [[2,76.8],[3.5,78.7],[5.0,81.0],[6.5,84.2],[8.0,86.6],[9.5,87.6],[11.0,87.8],[12.5,87.8],[14.0,87.8],[15.5,87.4],[17.0,86.5],[18.5,85.6],[20.0,85.2],[21.5,85.0],[23.0,84.7],[24.5,84.2],[26.0,83.9],[27.5,83.8],[29.0,83.8],[30.5,83.8],[32.0,83.8],[33.5,83.8],[35.0,83.8],[36.5,83.8],[38.0,83.8],[39.5,83.8],[41.0,83.8],[42.5,83.8],[44.0,83.8],[45.5,83.8]],
sill: [[64.3,75.7],[65.8,75.3],[67.3,74.9],[68.8,74.4],[70.3,73.7],[71.8,72.9],[73.3,72.2],[74.8,71.6],[76.3,70.9],[77.8,70.4],[79.3,70.1],[80.8,69.9],[82.3,69.8],[83.8,69.8],[85.3,69.8]], hf: [[4.8,46.7],[15,50.7],[24.8,52],[28,48.5],[36,46.3],[44,45]], hr: [[23,29.5],[38.5,31],[54,33]],
lights: [[36,51,1.0],[2.8,54,0.5]], fog: [], rear: { p: [96.5,24.5], k: 'sedan' } },
};
const TUNE = {
paint: [['stock', 'Заводской', null], ['white', 'Белое облако', '#eceef0'], ['black', 'Чёрная пантера', '#0f1014'], ['silver', 'Платина', '#a9aeb4'], ['graphite', 'Графит', '#3c4047'], ['red', 'Красный «Ралли»', '#c3121c'], ['orange', 'Сердолик', '#e2531a'], ['yellow', 'Жёлтый «Такси»', '#f0b10b'], ['lime', 'Кислотный', '#7ccf1f'], ['green', 'Изумруд', '#0c6a4b'], ['blue', 'Борнео', '#1b4fb2'], ['navy', 'Полночь', '#141f3d'], ['violet', 'Фиолет', '#5b2a90'], ['pink', 'Фламинго', '#e0568d']],
fin: [['gloss', 'Глянец'], ['metal', 'Металлик'], ['pearl', 'Перламутр'], ['matte', 'Мат'], ['flip', 'Хамелеон']],
hood: [['stock', 'Сток'], ['carbon', 'Карбон'], ['black', 'Мат. чёрный']],
liv: [['none', 'Нет'], ['stripes', 'Полосы'], ['side', 'Борт · 41'], ['both', 'Полосы + борт']],
rim: [['stock', 'Заводские'], ['mesh', 'Сетка'], ['y5', 'Y-спица'], ['six', 'Шесть спиц'], ['deep', 'Полка'], ['turbo', 'Турбина'], ['rally', 'Ралли']],
rimc: [['silver', 'Серебро', '#cdd2d7'], ['graphite', 'Графит', '#4a4f57'], ['black', 'Чёрный', '#17181b'], ['bronze', 'Бронза', '#a07c46'], ['gold', 'Золото', '#cfa649'], ['white', 'Белый', '#eef0f2']],
rsz: [['15', 'R15', 1], ['16', 'R16', 1.07], ['17', 'R17', 1.14], ['18', 'R18', 1.21]],
cal: [['stock', 'Сток', null], ['red', 'Красные', '#d42a2a'], ['yellow', 'Жёлтые', '#f2c21b'], ['blue', 'Синие', '#2c6ce0']],
front: [['stock', 'Сток'], ['lip', 'Губа'], ['split', 'Сплиттер'], ['canard', 'Сплиттер + клыки']],
skirt: [['stock', 'Сток'], ['on', 'Пороги']],
arch: [['stock', 'Сток'], ['flare', 'Расширители']],
spoil: [['stock', 'Нет'], ['lip', 'Сабля'], ['duck', 'Утиный хвост'], ['gt', 'GT-крыло'], ['ta', 'Тайм-аттак']],
spoilH: [['stock', 'Нет'], ['roof', 'Козырёк'], ['roof2', 'Большой козырёк'], ['gt', 'GT-крыло'], ['ta', 'Тайм-аттак']],
kmat: [['carbon', 'Карбон'], ['black', 'Чёрный глянец'], ['body', 'В цвет']],
low: [['0', 'Сток', 0], ['30', '−30 мм', 30], ['50', '−50 мм', 50], ['70', 'Стэнс −70', 70]],
tint: [['0', 'Нет'], ['35', '35%'], ['70', '70%'], ['95', 'В ноль']],
light: [['stock', 'Сток'], ['led', 'LED'], ['xenon', 'Ксенон'], ['amber', 'Жёлтые']],
neon: [['off', 'Выкл', null], ['blue', 'Синий', '#2f8cff'], ['red', 'Красный', '#ff2a3d'], ['green', 'Зелёный', '#25e07a'], ['violet', 'Фиолет', '#b14bff']]
};
const TUNE_DEF = { paint: 'stock', fin: 'gloss', hood: 'stock', liv: 'none', rim: 'stock', rimc: 'silver', rsz: '16', cal: 'stock', front: 'stock', skirt: 'stock', arch: 'stock', spoil: 'stock', kmat: 'carbon', low: '0', tint: '0', light: 'stock', neon: 'off' };
const TUNE_COST = {
paint: v => v === 'stock' ? 0 : 65000, fin: (v, t) => t.paint === 'stock' ? 0 : ({ gloss: 0, metal: 18000, pearl: 32000, matte: 38000, flip: 85000 }[v] || 0),
hood: v => ({ carbon: 42000, black: 9000 }[v] || 0), liv: v => ({ stripes: 14000, side: 12000, both: 24000 }[v] || 0),
rim: (v, t) => v === 'stock' ? 0 : Math.round(({ mesh: 64000, y5: 42000, six: 56000, deep: 72000, turbo: 38000, rally: 46000 }[v] || 0) * (1 + (+t.rsz - 15) * .14)),
cal: v => v === 'stock' ? 0 : 7000, front: (v, t) => Math.round(({ lip: 9000, split: 26000, canard: 34000 }[v] || 0) * (t.kmat === 'carbon' ? 1.6 : 1)),
skirt: (v, t) => v === 'on' ? (t.kmat === 'carbon' ? 31000 : 19000) : 0, arch: v => v === 'flare' ? 28000 : 0,
spoil: (v, t) => Math.round(({ lip: 6000, duck: 15000, gt: 42000, ta: 78000, roof: 9000, roof2: 16000 }[v] || 0) * (t.kmat === 'carbon' ? 1.5 : 1)),
kmat: () => 0, low: v => ({ 30: 18000, 50: 48000, 70: 98000 }[v] || 0), tint: v => +v ? 6000 : 0,
light: v => ({ led: 16000, xenon: 9000, amber: 3500 }[v] || 0), neon: v => v === 'off' ? 0 : 9000
};
const TUNE_PRESETS = [
['street', 'Стрит', { paint: 'graphite', fin: 'metal', rim: 'six', rimc: 'black', rsz: '17', cal: 'red', front: 'lip', skirt: 'on', kmat: 'black', low: '30', tint: '35', light: 'led' }],
['ta', 'Тайм-аттак', { paint: 'white', fin: 'gloss', hood: 'carbon', liv: 'both', rim: 'six', rimc: 'bronze', rsz: '17', cal: 'red', front: 'canard', skirt: 'on', arch: 'flare', spoil: 'ta', kmat: 'carbon', low: '50', light: 'led' }],
['dark', 'Пацанская', { paint: 'black', fin: 'gloss', rim: 'deep', rimc: 'black', rsz: '16', low: '50', tint: '95', light: 'xenon', front: 'lip', kmat: 'black' }],
['rally', 'Ралли', { paint: 'blue', fin: 'gloss', liv: 'both', rim: 'rally', rimc: 'white', rsz: '15', front: 'lip', kmat: 'black', light: 'amber', spoil: 'duck' }],
['stance', 'Стэнс', { paint: 'pink', fin: 'pearl', rim: 'mesh', rimc: 'gold', rsz: '18', low: '70', front: 'lip', kmat: 'body', tint: '35', spoil: 'lip' }],
['night', 'Ночной город', { paint: 'violet', fin: 'flip', rim: 'turbo', rimc: 'graphite', rsz: '17', cal: 'blue', neon: 'violet', light: 'led', tint: '70', skirt: 'on', kmat: 'carbon' }]
];
const carImgCache = {};
function carImage(key){
if(carImgCache[key]) return carImgCache[key];
const base = CAR_IMG[key];
const load = n => new Promise(res => {
const im = new Image(); let t = setTimeout(() => { im.onload = im.onerror = null; res(null); }, 14000);
im.decoding = 'async';
im.onload = () => { clearTimeout(t); res(im); }; im.onerror = () => { clearTimeout(t); res(null); };
im.src = n && !/^data:/.test(base) ? base + (base.includes('?') ? '&' : '?') + 'r=' + n + Date.now() : base;
});
const p = (async () => { for(let n = 0; n < 3; n++){ const im = await load(n); if(im) return im; await new Promise(r => setTimeout(r, 600)); } return null; })();
p.then(v => { if(!v && carImgCache[key] === p) delete carImgCache[key]; });
return carImgCache[key] = p;
}
function carWarm(){ Object.keys(CAR_IMG).forEach(k => { try{ carImage(k); }catch(_){} }); }
const tnCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tnHex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const tnRgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const tnMix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const tnPolyAt = (pl, u) => { /* точка на ломаной по доле длины */
let L = 0; const seg = []; for(let i = 1; i < pl.length; i++){ const l = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]); seg.push(l); L += l; }
let d = Math.max(0, Math.min(1, u)) * L; for(let i = 0; i < seg.length; i++){ if(d <= seg[i] || i === seg.length - 1){ const k = seg[i] ? Math.min(1, d / seg[i]) : 0; return [pl[i][0] + (pl[i + 1][0] - pl[i][0]) * k, pl[i][1] + (pl[i + 1][1] - pl[i][1]) * k]; } d -= seg[i]; }
return pl[pl.length - 1];
};
async function tunePrep(st){
const rig = st.rig, [im, mk] = await Promise.all([carImage(rig.img), carImage(rig.img + '_m')]);
if(!im) return false;
const W = im.naturalWidth, H = im.naturalHeight, N = W * H;
const bc = tnCanvas(W, H), bx = bc.getContext('2d', { willReadFrequently: true }); bx.drawImage(im, 0, 0);
st.im = im; st.W = W; st.H = H; st.src = bx.getImageData(0, 0, W, H).data;
const mR = new Uint8Array(N), mG = new Uint8Array(N), mB = new Uint8Array(N);
if(mk){ const mc = tnCanvas(W, H), mx = mc.getContext('2d', { willReadFrequently: true }); mx.imageSmoothingEnabled = true; mx.imageSmoothingQuality = 'high'; mx.drawImage(mk, 0, 0, W, H);
const md = mx.getImageData(0, 0, W, H).data; for(let p = 0, i = 0; p < N; p++, i += 4){ mR[p] = md[i]; mG[p] = md[i + 1]; mB[p] = md[i + 2]; } }
st.mR = mR; st.mG = mG; st.mB = mB;
const src = st.src, hist = new Float64Array(256); let tot = 0, ar = 0, ag = 0, ab = 0, an = 0;
for(let p = 0, i = 0; p < N; p++, i += 4){ if(mR[p] > 170 && src[i + 3] > 200){ const L = (src[i] * 54 + src[i + 1] * 183 + src[i + 2] * 19) >> 8; hist[L]++; tot++; } }
const cdf = new Float64Array(256); let acc = 0; for(let i = 0; i < 256; i++){ acc += hist[i]; cdf[i] = tot ? acc / tot : i / 255; }
const pct = q => { for(let i = 0; i < 256; i++) if(cdf[i] >= q) return i; return 255; };
const p2 = pct(.02), p98 = Math.max(p2 + 8, pct(.985)), q92 = pct(.93);
const lut = new Uint8Array(256); for(let i = 0; i < 256; i++){ const lin = Math.max(0, Math.min(1, (i - p2) / (p98 - p2))); lut[i] = Math.round((cdf[i] * .5 + lin * .5) * 255); }
st.lut = lut; st.q92 = Math.min(250, q92);
for(let p = 0, i = 0; p < N; p += 3, i += 12){ if(mR[p] > 200){ const L = lut[(src[i] * 54 + src[i + 1] * 183 + src[i + 2] * 19) >> 8]; if(L > 110 && L < 170){ ar += src[i]; ag += src[i + 1]; ab += src[i + 2]; an++; } } }
st.avg = an ? [ar / an, ag / an, ab / an] : [128, 128, 128];
const X = x => x * W / 100, Y = y => y * H / 100, g = st.g = {};
g.w = rig.w.map(([cx, cy, a, b, ang]) => {
const r = ang * Math.PI / 180, A = [Math.cos(r) * a * W / 100, Math.sin(r) * a * W / 100], B = [-Math.sin(r) * b * W / 100, Math.cos(r) * b * W / 100];
const la = Math.hypot(...A), lb = Math.hypot(...B), maj = Math.max(la, lb), mn = Math.min(la, lb), mv = la < lb ? A : B;
let dx = mv[0] / Math.hypot(...mv), dy = mv[1] / Math.hypot(...mv); if(dx > 0){ dx = -dx; dy = -dy; }
const sv = Math.sqrt(Math.max(0, 1 - (mn / maj) ** 2));
return { C: [X(cx), Y(cy)], A, B, D: [dx * sv * maj, dy * sv * maj], maj, mn };
});
const mF = g.w[0].maj * 2 * rig.tk / .62, mR2 = g.w[1].maj * 2 * rig.tk / .62; g.mF = mF; g.mR = mR2; g.m = (mF + mR2) / 2;
g.mAt = x => { const t = Math.max(0, Math.min(1, (x - g.w[0].C[0]) / (g.w[1].C[0] - g.w[0].C[0]))); return mF + (mR2 - mF) * t; };
g.lip = rig.lip.map(([x, y]) => [X(x), Y(y)]); g.sill = rig.sill.map(([x, y]) => [X(x), Y(y)]);
g.hf = rig.hf.map(([x, y]) => [X(x), Y(y)]); g.hr = rig.hr.map(([x, y]) => [X(x), Y(y)]);
g.lights = rig.lights.map(([x, y, s]) => [X(x), Y(y), s]); g.fog = (rig.fog || []).map(([x, y, s]) => [X(x), Y(y), s]);
const n = g.lights[0], f = g.lights[1]; let lx = f[0] - n[0], ly = f[1] - n[1]; const ll = Math.hypot(lx, ly); lx /= ll; ly /= ll;
const wc0 = g.w[0].C, wc1 = g.w[1].C; let gx = wc1[0] - wc0[0], gy = wc1[1] - wc0[1]; const gl = Math.hypot(gx, gy); gx /= gl; gy /= gl;
const fg = Math.min(.9, gl / (2.5 * g.m));
g.lat = [lx, ly]; g.lon = [gx, gy]; g.fg = fg;
const fl = Math.max(.35, Math.min(.85, ll / 1.3 / mF)); g.fl = fl;
g.rear = { P: [X(rig.rear.p[0]), Y(rig.rear.p[1])], R: rig.rear.r ? [X(rig.rear.r[0]), Y(rig.rear.r[1])] : null, m: mR2, L: [lx * fl, ly * fl - .04], G: [gx * fg, gy * fg], k: rig.rear.k };
const wc = tnCanvas(W, H), wx = wc.getContext('2d', { willReadFrequently: true }); wx.fillStyle = '#fff';
g.w.forEach(w => { wx.save(); wx.setTransform(w.A[0] * rig.tk * 1.03, w.A[1] * rig.tk * 1.03, w.B[0] * rig.tk * 1.03, w.B[1] * rig.tk * 1.03, w.C[0], w.C[1]); wx.beginPath(); wx.arc(0, 0, 1, 0, 7); wx.restore(); wx.fill(); });
const wd = wx.getImageData(0, 0, W, H), wdd = wd.data, wm = st.wm = new Uint8Array(N);
for(let p = 0, i = 0; p < N; p++, i += 4){ const v = wdd[i + 3] * (255 - mR[p]) / 255 * (src[i + 3] / 255); wm[p] = v; wdd[i] = wdd[i + 1] = wdd[i + 2] = 0; wdd[i + 3] = v; }
wx.putImageData(wd, 0, 0); st.wmCv = wc;
const wl = tnCanvas(W, H), wlx = wl.getContext('2d'); wlx.drawImage(im, 0, 0); wlx.globalCompositeOperation = 'destination-in'; wlx.drawImage(wc, 0, 0); st.wheelCv = wl;
st.bodyCv = tnCanvas(W, H); st.holeCv = tnCanvas(W, H); st.rimCv = tnCanvas(W, H);
st.out = st.bodyCv.getContext('2d').createImageData(W, H);
st.pad = { t: Math.round(H * .14), r: Math.round(W * .05), b: Math.round(H * .05), l: Math.round(W * .025) };
st.liv = {}; st.key = '';
return true;
}
function tuneLivery(st, kind){
if(st.liv[kind]) return st.liv[kind];
const { W, H, g } = st, c = tnCanvas(W, H), x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.strokeStyle = '#fff';
if(kind === 'stripes' || kind === 'both'){
const lipFace = g.lip.slice(0, Math.max(2, Math.round(g.lip.length * .86)));
const at = (u, v) => { const a = tnPolyAt(g.hf, u), b = tnPolyAt(g.hr, u); if(v >= 0) return [a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v]; const l = tnPolyAt(lipFace, u); return [a[0] + (l[0] - a[0]) * -v, a[1] + (l[1] - a[1]) * -v]; };
[[.355, .455], [.545, .645]].forEach(([u0, u1]) => { x.beginPath(); for(let v = -1; v <= 1.06; v += .08) { const p = at(u0, v); v < -.99 ? x.moveTo(...p) : x.lineTo(...p); } for(let v = 1.06; v >= -1; v -= .08) x.lineTo(...at(u1, v)); x.closePath(); x.fill(); });
}
if(kind === 'side' || kind === 'both'){
const s = g.sill, a = s[0], b = s[s.length - 1], dx = (b[0] - a[0]), dy = (b[1] - a[1]);
const P0 = [a[0] - dx * .62, a[1] - dy * .62], P1 = [b[0] + dx * .5, b[1] + dy * .5];
const band = (h0, h1) => { x.beginPath(); for(let k = 0; k <= 20; k++){ const t = k / 20, px = P0[0] + (P1[0] - P0[0]) * t, py = P0[1] + (P1[1] - P0[1]) * t; const m = g.mAt(px); k ? x.lineTo(px, py - h0 * m) : x.moveTo(px, py - h0 * m); }
for(let k = 20; k >= 0; k--){ const t = k / 20, px = P0[0] + (P1[0] - P0[0]) * t, py = P0[1] + (P1[1] - P0[1]) * t; x.lineTo(px, py - h1 * m(px)); } x.closePath(); x.fill(); };
const m = px => g.mAt(px);
band(.30, .37); band(.395, .415);
const t = .3, px = a[0] + dx * t, py = a[1] + dy * t, mm = g.mAt(px), lo = [g.lon[0] * g.fg * mm, g.lon[1] * g.fg * mm];
x.save(); x.setTransform(lo[0] / 100, lo[1] / 100, 0, -mm / 100, px, py - (st.rig.rear.k === 'hatch' ? .5 : .6) * mm); x.beginPath(); x.arc(0, 0, 19, 0, 7); x.fill();
x.globalCompositeOperation = 'destination-out'; x.font = '800 21px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.scale(1, -1); x.fillText('41', 0, 1); x.restore();
}
const d = x.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H); for(let p = 0, i = 3; p < m.length; p++, i += 4) m[p] = d[i];
return (st.liv[kind] = m);
}
const TN_HUE = (() => { const t = new Uint8Array(360 * 3); for(let h = 0; h < 360; h++){ const s = .78, l = .46, c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2; let r = 0, g = 0, b = 0;
if(h < 60){ r = c; g = x; } else if(h < 120){ r = x; g = c; } else if(h < 180){ g = c; b = x; } else if(h < 240){ g = x; b = c; } else if(h < 300){ r = x; b = c; } else { r = c; b = x; }
t[h * 3] = (r + m) * 255; t[h * 3 + 1] = (g + m) * 255; t[h * 3 + 2] = (b + m) * 255; } return t; })();
function tnHue(rgb){ const [r, g, b] = rgb.map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if(!d) return 0; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return ((h * 60) + 360) % 360; }
function tuneCurves(fin, lc = .5){
const lift = .4 * lc * lc, K1 = new Float32Array(256), K2 = new Float32Array(256);
for(let i = 0; i < 256; i++){ const x = Math.min(1, i / 127.5), u = Math.max(0, (i - 127.5) / 127.5);
if(fin === 'matte'){ const f = .2 + lift; K1[i] = f + (1 - f) * Math.pow(x, 1.05); K2[i] = u * .26; }
else if(fin === 'metal'){ const f = .13 + lift; K1[i] = f + (1 - f) * Math.pow(x, 1.2); K2[i] = Math.pow(u, 1.6) * .9; }
else { const f = .12 + lift; K1[i] = f + (1 - f) * Math.pow(x, 1.3); K2[i] = Math.pow(u, 2.1) * .9; } }
return { K1, K2 };
}
function tuneBody(st){
const t = st.t, key = [t.paint, t.fin, t.hood, t.liv, t.tint].join('|');
if(key === st.key) return; st.key = key;
const { W, H, src, mR, mG, mB, lut } = st, N = W * H, out = st.out, d = out.data;
const P = TUNE.paint.find(p => p[0] === t.paint), C = P && P[2] ? tnHex(P[2]) : null, fin = C ? t.fin : 'gloss';
const { K1, K2 } = tuneCurves(fin, C ? (C[0] * .2126 + C[1] * .7152 + C[2] * .0722) / 255 : .5), q92 = st.q92, spK = fin === 'matte' ? 0 : fin === 'metal' ? .7 : .85;
const HL = C && fin === 'pearl' ? tnMix([255, 255, 255], TN_HUE.slice(((tnHue(C) + 40) % 360 | 0) * 3, ((tnHue(C) + 40) % 360 | 0) * 3 + 3), .28) : [255, 255, 255];
const h0 = C ? tnHue(C) : 0, flip = C && fin === 'flip', metal = fin === 'metal', pearl = fin === 'pearl';
const livM = t.liv !== 'none' ? tuneLivery(st, t.liv) : null;
const avgL = (st.avg[0] * 54 + st.avg[1] * 183 + st.avg[2] * 19) >> 8, baseL = C ? (C[0] * 54 + C[1] * 183 + C[2] * 19) >> 8 : avgL;
const SC = baseL > 120 ? [22, 23, 26] : [244, 244, 242];  /* цвет полос — контрастный */
const hood = t.hood !== 'stock' ? t.hood : null, tint = (+t.tint || 0) / 100;
const hv = st.g.lon, ca = Math.cos(Math.atan2(hv[1], hv[0]) + .5), sa = Math.sin(Math.atan2(hv[1], hv[0]) + .5), cell = Math.max(4, W / 200);
for(let p = 0, i = 0; p < N; p++, i += 4){
const a = src[i + 3]; d[i + 3] = a; let r = src[i], gg = src[i + 1], b = src[i + 2];
if(!a){ d[i] = d[i + 1] = d[i + 2] = 0; continue; }
const pm = mR[p];
if(pm > 2 && (C || hood || livM)){
const L = (r * 54 + gg * 183 + b * 19) >> 8; let si = lut[L];
let cr, cg, cb, kk = pm / 255;
if(metal){ const n = ((p * 2654435761) >>> 0) & 1023; si = Math.max(0, Math.min(255, si + ((n >> 5) - 16))); }
const ramp = (R, G, B, hr, hg, hb) => { if(si < 128){ const k = K1[si]; cr = R * k; cg = G * k; cb = B * k; } else { const k = K2[si]; cr = R + (hr - R) * k; cg = G + (hg - G) * k; cb = B + (hb - B) * k; } };
if(C){
if(flip){ const x = p % W, hh = ((h0 + (si - 128) * .62 + (x / W - .5) * 110) % 360 + 360) % 360 | 0, o = hh * 3; ramp(TN_HUE[o], TN_HUE[o + 1], TN_HUE[o + 2], 255, 255, 255); }
else ramp(C[0], C[1], C[2], HL[0], HL[1], HL[2]);
} else { cr = r; cg = gg; cb = b; }
if(livM && livM[p]){ const lk = livM[p] / 255; const r0 = cr, g0 = cg, b0 = cb; ramp(SC[0], SC[1], SC[2], 255, 255, 255); cr = r0 + (cr - r0) * lk; cg = g0 + (cg - g0) * lk; cb = b0 + (cb - b0) * lk; }
if(hood && mB[p]){
const hk = mB[p] / 255, x = p % W, y = (p / W) | 0; let v;
if(hood === 'carbon'){ const u = (x * ca + y * sa) / cell, w = (-x * sa + y * ca) / cell, iu = Math.floor(u), iw = Math.floor(w), fu = u - iu, fw = w - iw;
const tw = ((iu + iw) & 3) < 2; v = tw ? .55 + .45 * Math.sin(Math.PI * fw) : .18 + .32 * Math.sin(Math.PI * fu); v = (14 + 26 * v) * (.55 + si / 255 * .95); if(si > 175) v += (si - 175) * 1.6; }
else { v = (13 + 10 * (si / 255)) * 1.1; }
cr += (v - cr) * hk; cg += (v * 1.03 - cg) * hk; cb += (v * 1.08 - cb) * hk;
}
if(spK && L > q92 && C){ const s = Math.min(1, (L - q92) / (256 - q92)) * spK; cr += (255 - cr) * s; cg += (255 - cg) * s; cb += (255 - cb) * s; }
if(metal && C){ const n = ((p * 2246822519) >>> 0) & 1023; if(n > 1012 && si > 120){ cr = cr + (255 - cr) * .55; cg = cg + (255 - cg) * .55; cb = cb + (255 - cb) * .55; } }
r += (cr - r) * kk; gg += (cg - gg) * kk; b += (cb - b) * kk;
}
if(tint && mG[p] > 2){ const gk = mG[p] / 255 * tint, L = (src[i] * 54 + src[i + 1] * 183 + src[i + 2] * 19) >> 8, refl = Math.max(0, L - 150) * .55 * tint;
r += (r * .1 + refl * .9 - r) * gk; gg += (gg * .1 + refl * .95 - gg) * gk; b += (b * .12 + refl - b) * gk; }
d[i] = r; d[i + 1] = gg; d[i + 2] = b;
}
st.bodyCv.getContext('2d').putImageData(out, 0, 0);
const hx = st.holeCv.getContext('2d'); hx.clearRect(0, 0, W, H); hx.globalCompositeOperation = 'source-over'; hx.drawImage(st.bodyCv, 0, 0); hx.globalCompositeOperation = 'destination-out'; hx.drawImage(st.wmCv, 0, 0); hx.globalCompositeOperation = 'source-over';
st.kitCol = C ? C.map(v => v * .92) : st.avg;
}
let tnCarbonPat = null;
function tnCarbon(c){
if(!tnCarbonPat){ const p = tnCanvas(8, 8), x = p.getContext('2d'); x.fillStyle = '#111215'; x.fillRect(0, 0, 8, 8);
for(let i = 0; i < 4; i++) for(let j = 0; j < 4; j++){ const tw = ((i + j) & 3) < 2; x.fillStyle = tw ? '#2b2e34' : '#1a1c20'; x.fillRect(i * 2, j * 2, 2, 2); x.fillStyle = tw ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.2)'; x.fillRect(i * 2, j * 2, tw ? 2 : 1, tw ? 1 : 2); }
tnCarbonPat = p; }
return c.createPattern(tnCarbonPat, 'repeat');
}
function tnMat(c, st, mat, k = 1){
if(mat === 'carbon') return tnCarbon(c);
if(mat === 'body'){ const col = st.kitCol || st.avg; return tnRgb(col.map(v => v * k)); }
return k > 1 ? '#2a2c31' : '#0e0f12';
}
function tnPath(c, pts){ c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); }
function tnShade(c, pts, a, b, x0, y0, x1, y1){ const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; tnPath(c, pts); c.fill(); }
function tnMetal(c, col, x0, y0, x1, y1, dark){
const g = c.createLinearGradient(x0, y0, x1, y1), hi = tnMix(col, [255, 255, 255], .55), lo = tnMix(col, [0, 0, 0], dark ? .7 : .45);
g.addColorStop(0, tnRgb(hi)); g.addColorStop(.35, tnRgb(col)); g.addColorStop(.62, tnRgb(lo)); g.addColorStop(.8, tnRgb(col)); g.addColorStop(1, tnRgb(tnMix(col, [255, 255, 255], .25))); return g;
}
function tuneRim(c, w, o){
const k = (o.size || 1) * 1.035, A = [w.A[0] * k, w.A[1] * k], B = [w.B[0] * k, w.B[1] * k], D = [w.D[0] * k, w.D[1] * k], C0 = w.C, col = o.col, type = o.type;
const M = (r, a, z = 0) => [C0[0] + r * (Math.cos(a) * A[0] + Math.sin(a) * B[0]) + z * D[0], C0[1] + r * (Math.cos(a) * A[1] + Math.sin(a) * B[1]) + z * D[1]];
const sp = (z, f) => { c.save(); c.transform(A[0], A[1], B[0], B[1], C0[0] + z * D[0], C0[1] + z * D[1]); f(); c.restore(); };
const R = Math.max(Math.hypot(...A), Math.hypot(...B)), lx = C0[0] - R, ly = C0[1] - R, rx = C0[0] + R, ry = C0[1] + R;
const ell = (r, z) => { sp(z, () => { c.beginPath(); c.arc(0, 0, r, 0, 7); }); };
const dk = tnMix(col, [0, 0, 0], .62), lt = tnMix(col, [255, 255, 255], .35);
c.save();
ell(1.04, 0); c.fillStyle = '#0c0c0e'; c.fill();
ell(1.0, 0); c.clip();
c.fillStyle = tnMetal(c, dk, lx, ly, rx, ry, 1); ell(1.0, 0); c.fill();
c.fillStyle = '#060607'; ell(.97, .9); c.fill();
const disc = c.createRadialGradient(...M(0, 0, .58), 0, ...M(0, 0, .58), R * .78); disc.addColorStop(0, '#16171a'); disc.addColorStop(.42, '#2c2e33'); disc.addColorStop(.72, '#4d5157'); disc.addColorStop(.88, '#3b3e43'); disc.addColorStop(1, '#1d1f22');
c.fillStyle = disc; ell(.76, .58); c.fill();
c.strokeStyle = 'rgba(20,20,22,.55)'; c.lineWidth = Math.max(.6, R * .012); for(let j = 0; j < 6; j++){ const a = j * Math.PI / 3 + .3; c.beginPath(); c.moveTo(...M(.42, a, .58)); c.lineTo(...M(.72, a + .35, .58)); c.stroke(); }
c.fillStyle = '#1b1c1f'; ell(.34, .55); c.fill();
let best = 0, bv = -9; for(let a = 0; a < 6.28; a += .1){ const p = M(1, a), v = (p[0] - C0[0]) * .55 - (p[1] - C0[1]) * .85; if(v > bv){ bv = v; best = a; } }
const calCol = o.cal ? tnHex(o.cal) : [92, 96, 102];
const cp = []; for(let a = best - .42; a <= best + .42; a += .07) cp.push(M(.8, a, .42)); for(let a = best + .42; a >= best - .42; a -= .07) cp.push(M(.6, a, .46));
c.fillStyle = tnMetal(c, calCol, lx, ly, rx, ry, 1); tnPath(c, cp); c.fill();
if(o.cal){ c.fillStyle = 'rgba(255,255,255,.35)'; tnPath(c, cp.slice(0, cp.length / 2).concat(cp.slice(0, cp.length / 2).reverse().map(p => [p[0] + (C0[0] - p[0]) * .06, p[1] + (C0[1] - p[1]) * .06]))); c.fill(); }
const rot = o.spin || 0, face = tnMetal(c, col, lx, ly, rx, ry), side = tnRgb(tnMix(col, [0, 0, 0], .55));
const spoke = (pts, z0 = .06, th = .16) => { /* pts: [r, a] — сначала боковая грань (смещённая копия), потом лицевая */
c.fillStyle = side; tnPath(c, pts.map(([r, a]) => M(r, a + rot, z0 + th))); c.fill();
c.fillStyle = 'rgba(0,0,0,.35)'; tnPath(c, pts.map(([r, a]) => M(r, a + rot, z0 + th * .5))); c.fill();
c.fillStyle = face; tnPath(c, pts.map(([r, a]) => M(r, a + rot, z0 * (1 - r) + .01))); c.fill(); c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = Math.max(.5, R * .008); c.stroke(); };
const lipRing = (r0, z = 0, hiK = 1) => { c.fillStyle = tnMetal(c, tnMix(col, [255, 255, 255], .2 * hiK), lx, ly, rx, ry); sp(z, () => { c.beginPath(); c.arc(0, 0, 1, 0, 7); c.arc(0, 0, r0, 0, 7, true); }); c.fill();
c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = Math.max(.7, R * .018); ell(r0, z); c.stroke(); };
if(type === 'mesh'){
for(let j = 0; j < 10; j++){ const a = j * Math.PI / 5; for(const s of [-1, 1]) spoke([[.2, a - .05], [.87, a + s * .36 - .028], [.87, a + s * .36 + .028], [.2, a + .05]], .05, .12); }
lipRing(.86); c.fillStyle = tnRgb(lt); for(let j = 0; j < 24; j++){ const p = M(.92, j * Math.PI / 12 + rot); c.beginPath(); c.arc(p[0], p[1], Math.max(.6, R * .018), 0, 7); c.fill(); }
} else if(type === 'y5'){
for(let j = 0; j < 5; j++){ const a = j * Math.PI * 2 / 5; spoke([[.2, a - .17], [.5, a - .11], [.88, a - .4], [.88, a - .27], [.56, a], [.88, a + .27], [.88, a + .4], [.5, a + .11], [.2, a + .17]], .08, .18); }
lipRing(.87);
} else if(type === 'six'){
for(let j = 0; j < 6; j++){ const a = j * Math.PI / 3; spoke([[.22, a - .27], [.6, a - .2], [.88, a - .23], [.88, a + .23], [.6, a + .2], [.22, a + .27]], .1, .2); c.fillStyle = 'rgba(0,0,0,.28)'; tnPath(c, [M(.3, a + rot, .1), M(.86, a + rot, .02), M(.86, a + .05 + rot, .02), M(.3, a + .04 + rot, .1)]); c.fill(); }
lipRing(.88, 0, .6);
} else if(type === 'deep'){
const lipG = c.createLinearGradient(lx, ly, rx, ry); lipG.addColorStop(0, tnRgb(tnMix(col, [255, 255, 255], .5))); lipG.addColorStop(.3, tnRgb(col)); lipG.addColorStop(.55, tnRgb(tnMix(col, [0, 0, 0], .5))); lipG.addColorStop(.85, tnRgb(tnMix(col, [0, 0, 0], .2))); lipG.addColorStop(1, tnRgb(tnMix(col, [255, 255, 255], .2)));
c.fillStyle = lipG; sp(0, () => { c.beginPath(); c.arc(0, 0, 1, 0, 7); c.arc(0, 0, .8, 0, 7, true); }); c.fill();
c.save(); ell(.8, 0); c.clip();
c.fillStyle = tnRgb(tnMix(col, [0, 0, 0], .55)); ell(.8, 0); c.fill();
c.fillStyle = '#070708'; ell(.76, .34); c.fill(); c.fillStyle = disc; ell(.66, .62); c.fill();
c.fillStyle = tnMetal(c, calCol, lx, ly, rx, ry, 1); tnPath(c, cp.map(p => [p[0] + (C0[0] - p[0]) * .18, p[1] + (C0[1] - p[1]) * .18])); c.fill();
for(let j = 0; j < 8; j++){ const a = j * Math.PI / 4; spoke([[.2, a - .1], [.78, a - .06], [.78, a + .06], [.2, a + .1]], .32, .12); }
c.restore();
c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = Math.max(.7, R * .02); ell(.8, 0); c.stroke();
c.fillStyle = 'rgba(230,232,236,.9)'; for(let j = 0; j < 16; j++){ const p = M(.84, j * Math.PI / 8); c.beginPath(); c.arc(p[0], p[1], Math.max(.6, R * .014), 0, 7); c.fill(); }
} else if(type === 'turbo'){
c.fillStyle = face; ell(.88, .04); c.fill();
for(let j = 0; j < 12; j++){ const a = j * Math.PI / 6 + rot, pts = []; for(let q = 0; q <= 6; q++){ const r = .3 + q * .09; pts.push(M(r, a + q * .07, .06)); } for(let q = 6; q >= 0; q--){ const r = .3 + q * .09; pts.push(M(r, a + q * .07 + .2, .06)); }
c.fillStyle = '#08080a'; tnPath(c, pts); c.fill(); }
lipRing(.88);
} else if(type === 'rally'){
c.fillStyle = face; sp(.05, () => { c.beginPath(); c.arc(0, 0, .9, 0, 7); for(let j = 0; j < 8; j++){ const a = j * Math.PI / 4 + rot; c.moveTo(Math.cos(a) * .62 + .15, Math.sin(a) * .62); c.arc(Math.cos(a) * .62, Math.sin(a) * .62, .15, 0, 7); } }); c.fill('evenodd');
c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = Math.max(.6, R * .014); for(let j = 0; j < 8; j++){ const a = j * Math.PI / 4 + rot; sp(.05, () => { c.beginPath(); c.arc(Math.cos(a) * .62, Math.sin(a) * .62, .15, 0, 7); }); c.stroke(); }
lipRing(.9, 0, .5);
}
c.fillStyle = tnMetal(c, type === 'deep' ? tnMix(col, [0, 0, 0], .2) : col, lx, ly, rx, ry); ell(.2, type === 'deep' ? .3 : .12); c.fill();
c.fillStyle = '#16171a'; ell(.09, type === 'deep' ? .3 : .12); c.fill();
for(let j = 0; j < 5; j++){ const p = M(.155, j * Math.PI * 2 / 5 + rot, type === 'deep' ? .3 : .12); c.fillStyle = '#9aa0a7'; c.beginPath(); c.arc(p[0], p[1], Math.max(.7, R * .028), 0, 7); c.fill(); }
const L = c.createLinearGradient(lx, ly, rx, ry); L.addColorStop(0, 'rgba(255,255,255,.28)'); L.addColorStop(.45, 'rgba(255,255,255,0)'); L.addColorStop(.7, 'rgba(0,0,0,.1)'); L.addColorStop(1, 'rgba(0,0,0,.45)');
c.fillStyle = L; ell(1, 0); c.fill();
c.restore();
c.strokeStyle = 'rgba(0,0,0,.65)'; c.lineWidth = Math.max(.8, R * .03); ell(1.0, 0); c.stroke();
}
function tuneRimThumb(cv, type, col){
const c = cv.getContext('2d'), s = cv.width; c.clearRect(0, 0, s, s);
c.fillStyle = '#0e0e10'; c.beginPath(); c.arc(s / 2, s / 2, s * .48, 0, 7); c.fill();
if(type === 'stock'){ c.strokeStyle = 'rgba(239,234,224,.5)'; c.lineWidth = 1.5; c.beginPath(); c.arc(s / 2, s / 2, s * .3, 0, 7); c.stroke(); c.font = `600 ${s * .16}px sans-serif`; c.fillStyle = 'rgba(239,234,224,.7)'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('OEM', s / 2, s / 2); return; }
tuneRim(c, { C: [s / 2, s / 2], A: [s * .34, 0], B: [0, s * .34], D: [-s * .05, -s * .02], maj: s * .34 }, { type, col: tnHex(col), size: 1, cal: '#d42a2a' });
}
function tuneFront(c, st, type, mat){
const g = st.g, lp = g.lip, m = g.mF, n = lp.length;
const dn = (type === 'lip' ? .02 : .034) * m, th = (type === 'lip' ? .01 : .014) * m;
const top = lp.map(p => [p[0], p[1] - .014 * m]), bot = lp.map((p, i) => [p[0], p[1] + dn * (.35 + .65 * Math.sin(Math.PI * Math.min(1, i / (n - 1) * 1.05)) ** .3)]), bot2 = bot.map(p => [p[0], p[1] + th]);
c.save();
c.fillStyle = tnMat(c, st, mat); tnPath(c, top.concat(bot.slice().reverse())); c.fill();
tnShade(c, top.concat(bot.slice().reverse()), 'rgba(255,255,255,.05)', 'rgba(0,0,0,.35)', lp[0][0], lp[0][1] - dn, lp[0][0], lp[0][1] + dn);
c.fillStyle = '#060607'; tnPath(c, bot.concat(bot2.slice().reverse())); c.fill();
c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = Math.max(1, m * .004); c.beginPath(); bot.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
if(type !== 'lip'){ c.strokeStyle = '#d6262c'; c.lineWidth = Math.max(1.2, m * .006); c.beginPath(); bot2.forEach((p, i) => i ? c.lineTo(p[0], p[1] - th * .35) : c.moveTo(p[0], p[1] - th * .35)); c.stroke(); }
if(type === 'canard'){
const e = lp[n - 1], q = lp[Math.max(0, n - 6)], dx = g.lon[0] * g.fg * m, dy = g.lon[1] * g.fg * m;
[[.2, .5], [.13, .34]].forEach(([h, l], j) => { const bx = e[0] - (e[0] - q[0]) * (.35 + j * .1), by = e[1] - h * m;
const pts = [[bx - .12 * m, by + .01 * m], [bx + dx * .02, by + dy * .02 - .004 * m], [bx + dx * .1, by + dy * .1 - .03 * m], [bx - .05 * m + dx * .06, by + dy * .06 - .02 * m]];
c.fillStyle = tnMat(c, st, mat); tnPath(c, pts); c.fill(); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(...pts[0]); c.lineTo(...pts[3]); c.lineTo(...pts[2]); c.stroke(); });
}
c.restore();
}
function tuneSkirt(c, st, mat){
const g = st.g, s = g.sill, a = s[0], b = s[s.length - 1], ex = (p, q, k) => [p[0] + (p[0] - q[0]) * k, p[1] + (p[1] - q[1]) * k];
const pts = [ex(a, s[3] || b, .35)].concat(s, [ex(b, s[s.length - 4] || a, .25)]);
const top = pts.map(p => [p[0], p[1] - .055 * g.mAt(p[0])]), bot = pts.map(p => [p[0] - .01 * g.mAt(p[0]), p[1] + .03 * g.mAt(p[0])]);
c.save(); c.fillStyle = tnMat(c, st, mat); tnPath(c, top.concat(bot.slice().reverse())); c.fill();
tnShade(c, top.concat(bot.slice().reverse()), 'rgba(255,255,255,.12)', 'rgba(0,0,0,.45)', a[0], a[1] - .05 * g.mF, a[0], a[1] + .03 * g.mF);
c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = Math.max(1, g.mF * .004); c.beginPath(); top.forEach((p, i) => i ? c.lineTo(p[0], p[1] + 1) : c.moveTo(p[0], p[1] + 1)); c.stroke();
c.restore();
}
function tuneFlares(c, st, mat){
const g = st.g, tk = st.rig.tk;
g.w.forEach((w, wi) => {
const P = (s, a) => [w.C[0] + s * tk * (Math.cos(a) * w.A[0] + Math.sin(a) * w.B[0]), w.C[1] + s * tk * (Math.cos(a) * w.A[1] + Math.sin(a) * w.B[1])];
const as = []; for(let a = 0; a < 6.283; a += .05){ const p = P(1, a); if(p[1] < w.C[1] + w.maj * tk * .18) as.push(a); }
if(as.length < 3) return;
let gap = 0; for(let i = 1; i < as.length; i++) if(as[i] - as[i - 1] > .2){ gap = i; break; }
const arc = as.slice(gap).concat(as.slice(0, gap).map(a => a + 6.283));
const o = arc.map(a => P(1.17, a)), inn = arc.map(a => P(1.0, a));
c.save(); c.fillStyle = tnMat(c, st, mat); tnPath(c, o.concat(inn.slice().reverse())); c.fill();
tnShade(c, o.concat(inn.slice().reverse()), 'rgba(255,255,255,.14)', 'rgba(0,0,0,.4)', w.C[0], w.C[1] - w.maj * tk * 1.17, w.C[0], w.C[1]);
c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = Math.max(1, w.maj * .02); c.beginPath(); o.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
c.fillStyle = '#c9ced4'; for(let i = 2; i < arc.length - 1; i += Math.max(2, Math.round(arc.length / 9))){ const p = P(1.09, arc[i]); c.beginPath(); c.arc(p[0], p[1], Math.max(.8, w.maj * (wi ? .018 : .022)), 0, 7); c.fill(); }
c.restore();
});
}
function tuneWing(c, st, type, mat){
const f = st.g.rear, m = f.m, Wd = 1.5, O = (type === 'roof' || type === 'roof2') && f.R ? f.R : f.P;
const pt = (u, v, z) => [O[0] + (u * f.L[0] + v * f.G[0]) * m, O[1] + (u * f.L[1] + v * f.G[1] - z) * m];
const q = (pts, fill) => { c.fillStyle = fill; tnPath(c, pts.map(p => pt(...p))); c.fill(); };
const edge = (a, b, col = 'rgba(255,255,255,.5)', wd = 1) => { c.strokeStyle = col; c.lineWidth = wd; c.beginPath(); c.moveTo(...pt(...a)); c.lineTo(...pt(...b)); c.stroke(); };
const M = tnMat(c, st, mat), Mhi = tnMat(c, st, mat, 1.25), dark = '#08090b';
c.save();
if(type === 'lip'){ q([[0, -.02, 0], [Wd, -.02, 0], [Wd, .03, .04], [0, .03, .04]], M); q([[0, .03, .04], [Wd, .03, .04], [Wd, .03, .025], [0, .03, .025]], dark); edge([0, .03, .04], [Wd, .03, .04]); }
else if(type === 'duck'){ const col = st.kitCol ? tnRgb(st.kitCol) : M; q([[0, -.16, 0], [Wd, -.16, 0], [Wd, .05, .075], [0, .05, .075]], mat === 'carbon' ? M : col); q([[0, .05, .075], [Wd, .05, .075], [Wd, .03, .03], [0, .03, .03]], dark); edge([0, .05, .075], [Wd, .05, .075], 'rgba(255,255,255,.6)', 1.2); }
else if(type === 'roof' || type === 'roof2'){
const L2 = type === 'roof2' ? .34 : .2, up = type === 'roof2' ? .05 : -.02, u0 = .06, u1 = Wd - .06;
q([[u0, -.05, .01], [u1, -.05, .01], [u1, L2, up], [u0, L2, up]], M);
q([[u0, L2, up], [u1, L2, up], [u1, L2, up - .035], [u0, L2, up - .035]], dark);
if(type === 'roof2'){ for(const u of [u1, u0]) q([[u, -.04, .01], [u, L2 + .02, up + .02], [u, L2 + .02, up - .08], [u, .02, -.06]], Mhi); }
edge([u0, L2, up], [u1, L2, up], 'rgba(255,255,255,.55)', 1.2);
} else if(type === 'gt' || type === 'ta'){
const hat = f.k === 'hatch', H = hat ? (type === 'ta' ? .2 : .12) : (type === 'ta' ? .36 : .22), ch = (type === 'ta' ? .34 : .26) * (hat ? .8 : 1), u0 = -.05, u1 = Wd + .05, ep = type === 'ta' ? .2 : .13;
const endp = u => [[u, -ch - .07, H - ep * .8], [u, .1, H - ep * .55], [u, .12, H + ep * .6], [u, -ch + .02, H + ep * .35]];
q(endp(u1), Mhi);
const ped = u => { q([[u, -.07, 0], [u, .03, 0], [u, .02, H], [u, -.1, H]], '#121316'); q([[u + .035, -.07, 0], [u + .035, .03, 0], [u + .035, .02, H], [u + .035, -.1, H]], '#2a2c30'); };
ped(Wd - .14);
q([[u0, -ch, H - .045], [u1, -ch, H - .045], [u1, .04, H + .02], [u0, .04, H + .02]], dark);   /* низ крыла */
q([[u0, -ch, H - .02], [u1, -ch, H - .02], [u1, .04, H + .045], [u0, .04, H + .045]], M);        /* верх */
q([[u0, .04, H + .045], [u1, .04, H + .045], [u1, .045, H + .085], [u0, .045, H + .085]], '#16171a'); /* гарни-флап */
edge([u0, -ch, H - .02], [u1, -ch, H - .02], 'rgba(255,255,255,.55)', 1.3);
ped(.14);
q(endp(u0), Mhi); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1; tnPath(c, endp(u0).map(p => pt(...p))); c.stroke();
if(type === 'ta'){ c.fillStyle = 'rgba(214,38,44,.95)'; tnPath(c, [[u0, -ch - .05, H - ep * .7], [u0, .09, H - ep * .48], [u0, .09, H - ep * .3], [u0, -ch - .05, H - ep * .5]].map(p => pt(...p))); c.fill(); }
}
c.restore();
}
function tuneLights(c, st, kind, run){
const g = st.g, col = { led: [235, 245, 255], xenon: [200, 220, 255], amber: [255, 196, 70], stock: [255, 240, 205] }[kind] || [255, 240, 205];
c.save(); c.globalCompositeOperation = 'lighter';
g.lights.concat(kind === 'amber' ? g.fog : []).forEach(([x, y, s]) => { const r = g.mF * .1 * s * (kind === 'xenon' ? 1.2 : 1), fl = run ? .75 + Math.random() * .25 : 1;
const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, tnRgb(col, .95 * fl)); gr.addColorStop(.18, tnRgb(col, .55 * fl)); gr.addColorStop(1, tnRgb(col, 0));
c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, r * 1.6, r * .9, 0, 0, 7); c.fill();
if(kind === 'led' || kind === 'xenon'){ c.strokeStyle = tnRgb(col, .9 * fl); c.lineWidth = Math.max(1.2, r * .05); c.beginPath(); c.ellipse(x, y + r * .05, r * .4, r * .12, -.12, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); } });
c.restore();
}
function tuneGround(c, st, neon){
const g = st.g, lp = g.lip, sl = g.sill, tk = st.rig.tk;
c.save();
g.w.forEach(w => { const x = w.C[0] - w.D[0] * .25, y = w.C[1] + w.maj * tk * .97, rx = Math.max(w.mn, w.maj * .55) * tk * 1.1, ry = w.maj * tk * .12;
const gr = c.createRadialGradient(x, y, 0, x, y, rx); gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(.6, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); });
const under = [...lp.map(p => [p[0], p[1] - g.mF * .03]), ...sl.map(p => [p[0], p[1] - g.mAt(p[0]) * .02])];
c.filter = 'none'; c.fillStyle = 'rgba(0,0,0,.55)'; c.shadowColor = 'rgba(0,0,0,.9)'; c.shadowBlur = g.mF * .08; c.shadowOffsetY = g.mF * .03;
tnPath(c, under); c.fill();
if(neon){
c.globalCompositeOperation = 'lighter'; c.shadowOffsetY = g.mF * .02;
const strip = [...lp.map(p => [p[0], p[1] - g.mF * .02]), ...sl.map(p => [p[0], p[1] - g.mAt(p[0]) * .015])];
c.shadowColor = neon; c.shadowBlur = g.mF * .3; c.fillStyle = neon; c.globalAlpha = .7; tnPath(c, strip); c.fill();
c.shadowBlur = g.mF * .1; c.globalAlpha = .55; tnPath(c, strip); c.fill();
const x0 = lp[0][0], x1 = sl[sl.length - 1][0], y0 = Math.max(...lp.map(p => p[1]), ...sl.map(p => p[1]));
const gr = c.createRadialGradient((x0 + x1) / 2, y0, 0, (x0 + x1) / 2, y0, (x1 - x0) * .6); gr.addColorStop(0, neon); gr.addColorStop(1, 'rgba(0,0,0,0)');
c.shadowBlur = 0; c.shadowOffsetY = 0; c.globalAlpha = .35; c.fillStyle = gr; c.beginPath(); c.ellipse((x0 + x1) / 2, y0 + g.mF * .03, (x1 - x0) * .6, g.mF * .09, -.04, 0, 7); c.fill();
}
c.restore();
}
function tuneRender(st, opt = {}){
if(!st.ready) return;
const t = opt.stock ? TUNE_DEF : st.t, cv = st.cv, c = cv.getContext('2d'), { W, H, pad, g } = st;
if(opt.stock){ const k = st.t; st.t = TUNE_DEF; tuneBody(st); st.t = k; } else tuneBody(st);
const low = (+t.low || 0) / 1000 * g.m, rimOn = t.rim !== 'stock', neon = (TUNE.neon.find(n => n[0] === t.neon) || [])[2];
const sz = (TUNE.rsz.find(s => s[0] === t.rsz) || [0, 0, 1])[2], rc = (TUNE.rimc.find(s => s[0] === t.rimc) || TUNE.rimc[0])[2], cal = (TUNE.cal.find(s => s[0] === t.cal) || [])[2];
c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.translate(pad.l, pad.t);
tuneGround(c, st, neon);
const rims = () => { if(!rimOn) return; const rx = st.rimCv.getContext('2d'); rx.setTransform(1, 0, 0, 1, 0, 0); rx.globalCompositeOperation = 'source-over'; rx.clearRect(0, 0, W, H);
g.w.forEach((w, i) => tuneRim(rx, w, { type: t.rim, col: tnHex(rc), size: sz, cal, spin: st.spin * (i ? 1 : 1) }));
rx.globalCompositeOperation = 'destination-in'; rx.drawImage(st.wmCv, 0, 0); rx.globalCompositeOperation = 'source-over'; c.drawImage(st.rimCv, 0, 0); };
if(low > .5){ c.drawImage(st.wheelCv, 0, 0); rims(); }
c.save(); c.translate(0, low);
if(t.spoil !== 'stock') tuneWing(c, st, t.spoil, t.kmat);
c.drawImage(low > .5 ? st.holeCv : st.bodyCv, 0, 0);
c.restore();
if(low <= .5) rims();
c.save(); c.translate(0, low);
if(t.arch === 'flare') tuneFlares(c, st, t.kmat);
if(t.skirt === 'on') tuneSkirt(c, st, t.kmat);
if(t.front !== 'stock') tuneFront(c, st, t.front, t.kmat);
if(t.light !== 'stock' || st.run) tuneLights(c, st, t.light, st.run);
c.restore();
}
function tuneStudio(cv, rig){
const st = { cv, rig, t: { ...TUNE_DEF }, spin: 0, run: 0, ready: false, plain: false };
const run = () => {
const main = tunePrep(st).then(ok => { if(!ok) return false; cv.width = st.W + st.pad.l + st.pad.r; cv.height = st.H + st.pad.t + st.pad.b; st.ready = true; tuneRender(st); return true; })
.catch(async err => { console.error('tunePrep', err);
try{ const im = await carImage(rig.img); if(!im) return false; cv.width = im.naturalWidth; cv.height = im.naturalHeight; cv.getContext('2d').drawImage(im, 0, 0); st.plain = true; return true; }catch(_){ return false; } });
const guard = new Promise(res => setTimeout(() => res('late'), 25000));
return Promise.race([main, guard]).then(v => v === 'late' ? main.then(x => x, () => false) : v);
};
st.load = run(); st.retry = () => { st.ready = false; st.load = run(); return st.load; };
return st;
}
const carAudio = {};
function carSound(kind){
try{
const src = CAR_SND[kind] || CAR_SND.granta;
let a = carAudio[kind]; if(!a){ a = carAudio[kind] = new Audio(src); a.preload = 'auto'; }
Object.values(carAudio).forEach(x => { if(x !== a){ try{ x.pause(); x.currentTime = 0; }catch(_){} } });
a.currentTime = 0; a.volume = 1; const p = a.play(); if(p && p.catch) p.catch(() => { try{ gEngine(kind === 'modern' ? 'polo' : kind === 'vaz' || kind === 'carb' ? 'v' : 'granta'); }catch(_){} });
}catch(_){ try{ gEngine('granta'); }catch(__){} }
}
function carPreload(kind){ try{ if(!carAudio[kind]){ const a = carAudio[kind] = new Audio(CAR_SND[kind] || CAR_SND.granta); a.preload = 'auto'; } }catch(_){} }
const CF_TABS = [['body', 'Кузов'], ['rims', 'Диски'], ['kit', 'Обвес'], ['low', 'Посадка'], ['glass', 'Свет']];
const CF_ROWS = { body: ['paint', 'fin', 'hood', 'liv'], rims: ['rim', 'rimc', 'rsz', 'cal'], kit: ['front', 'skirt', 'arch', 'spoil', 'kmat'], low: ['low'], glass: ['tint', 'light', 'neon'] };
const CF_LBL = { paint: 'Цвет', fin: 'Покрытие', hood: 'Капот', liv: 'Ливрея', rim: 'Модель дисков', rimc: 'Цвет дисков', rsz: 'Диаметр', cal: 'Суппорты', front: 'Передний обвес', skirt: 'Пороги', arch: 'Арки', spoil: 'Спойлер', kmat: 'Материал обвеса', low: 'Клиренс', tint: 'Тонировка', light: 'Фары', neon: 'Подсветка днища' };
const CF_DIM = { galkin: [960, 472], senchenko: [960, 514], frolov: [960, 688], samsonov: [960, 590], kulikov: [960, 573], serikov: [960, 543] };
const cfList = (k, rig) => k === 'spoil' && rig.rear && rig.rear.k === 'hatch' ? TUNE.spoilH : TUNE[k];
const cfName = (k, v, rig) => { const o = cfList(k, rig).find(x => String(x[0]) === String(v)); return o ? o[1] : ''; };
const cfRow = (k, rig, z) => {
const list = cfList(k, rig), cur = TUNE_DEF[k];
const btn = ([v, n, col]) => {
const on = String(v) === String(cur) ? ' on' : '';
if(k === 'paint' || k === 'rimc' || k === 'neon'){ const c = v === 'stock' ? (z.paint || '#888') : col; return `<button type="button" class="cf-sw${on}${v === 'stock' || v === 'off' ? ' cf-sw0' : ''}" data-v="${v}" style="--c:${c || 'transparent'}" aria-label="${esc(n)}"><i></i></button>`; }
if(k === 'rim') return `<button type="button" class="cf-rim${on}" data-v="${v}"><canvas width="96" height="96"></canvas><span>${esc(n)}</span></button>`;
return `<button type="button" class="cf-o${on}" data-v="${v}">${esc(n)}</button>`;
};
return `<div class="cf-row" data-k="${k}"><div class="cf-lbl"><span>${CF_LBL[k]}</span><b>${esc(cfName(k, cur, rig))}</b></div><div class="cf-opts">${list.map(btn).join('')}</div></div>`;
};
NB.car = d => {
const rig = CAR_RIG[d.full] || {}, z = (typeof GARAGE !== 'undefined' && GARAGE[d.full]) || {}, dim = CF_DIM[rig.img] || [960, 520];
const cw = Math.round(dim[0] * 1.075), ch = Math.round(dim[1] * 1.19);
const extra = d.carExtra === false ? '' : `<section class="cr-card nb-game" id="nbGame"><div class="cr-h"><span>Испытание</span><b>${esc(d.infoTitle)}</b></div>${d.info()}</section>`;
return `<div class="nb nb-car">
<nav class="nb-pill"><i class="nb-logo">${esc(z.no || '')}</i>${nbTabs('history', ['Досье', 'Тюнинг', 'Видео'])}</nav>
<header class="cr-head"><small>Машина года · лот ${esc(z.no || '')}</small><h2>${esc(z.model || '')}</h2><p><b>${esc(d.surname)}</b> ${esc(d.first)} · ${esc(rig.year || '')}</p></header>
<section class="cf" id="crTune">
<div class="cf-stage cr-studio" data-car="${esc(d.full)}"><i class="cr-spot"></i>
<canvas class="cr-cv" width="${cw}" height="${ch}"></canvas>
<div class="cf-load"><i></i><span>Загружаем фото</span></div>
<div class="cf-hud"><small>Смета</small><b class="cf-total">0 ₽</b><span class="cf-cnt">заводская комплектация</span></div>
<button type="button" class="cr-start" data-start><i></i><span>Завести</span></button>
<button type="button" class="cf-ba" data-ba><span>Удерживай</span><b>До / после</b></button>
</div>
<div class="cf-presets"><span>Готовые сборки</span><div class="cf-chips">${TUNE_PRESETS.map(([k, n]) => `<button type="button" class="cf-pre" data-pre="${k}">${esc(n)}</button>`).join('')}<button type="button" class="cf-pre cf-pre0" data-pre="reset">Заводская</button></div></div>
<nav class="cf-tabs">${CF_TABS.map(([k, n], i) => `<button type="button" class="cf-tab${i ? '' : ' on'}" data-p="${k}"><i>${String(i + 1).padStart(2, '0')}</i>${n}</button>`).join('')}</nav>
<div class="cf-panels">${CF_TABS.map(([k], i) => `<div class="cf-panel${i ? '' : ' on'}" data-p="${k}">${CF_ROWS[k].map(r => cfRow(r, rig, z)).join('')}${k === 'low' ? '<p class="cf-note">Кузов садится на колёса прямо на фото: −30 мм — пружины, −50 мм — койловеры, −70 мм — пневма.</p>' : ''}</div>`).join('')}</div>
<div class="cf-bill"><div class="cf-bill-h"><span>Заказ-наряд</span><b class="cf-total">0 ₽</b></div><ol class="cf-items"><li class="cf-empty">Пока заводская комплектация</li></ol><button type="button" class="cr-reset">Сбросить к заводской</button></div>
</section>
<dl class="cr-spec"><div><dt>Двигатель</dt><dd>${esc(rig.engine || '')}</dd></div><div><dt>Коробка</dt><dd>${esc(rig.gear || '')}</dd></div><div><dt>Цвет</dt><dd>${esc(rig.paintName || '')}</dd></div></dl>
<div class="cr-stats">${d.stats.map(s => `<div>${nbStat(s)}</div>`).join('')}</div>
${extra}
<section class="cr-card nb-story"><div class="cr-h"><span>История</span><b>${esc(z.title || '')}</b></div>${nbStory(d)}</section>
<blockquote class="cr-quote">${nbQuote(d)}</blockquote>
<section class="cr-card"><div class="cr-h"><span>Что в ролике</span><b>${esc(d.videoTitle)}</b></div><ul class="nb-fl">${d.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul><button type="button" class="nb-cta" data-hm="video">${nbPlay}<span>Смотреть видео</span></button></section>
</div>`;
};
function buildShowroom(frame){
try{ carWarm(); }catch(_){}
const noms = $$('.nominee:not([hidden])', frame); if(!noms.length) return;
const list = noms.map((nom, i) => { const name = nom.dataset.nominee, full = $('.nominee-front h3', nom)?.textContent.trim() || name, z = GARAGE[name] || {}, rig = CAR_RIG[name] || {}; return { i, nom, name, full, z, rig, sur: full.split(/\s+/)[0], first: full.split(/\s+/).slice(1).join(' ') }; });
const idx = frames.indexOf(frame), TOT = typeof TOTAL_NOMS === 'number' ? TOTAL_NOMS : 7;
const board = document.createElement('div'); board.className = 'sr';
board.innerHTML = `
<header class="lxn-head">
<div class="lxn-kick"><span>Номинация ${String(idx + 1).padStart(2, '0')} / ${String(TOT).padStart(2, '0')}</span><span>Шоу-рум · ${String(list.length).padStart(2, '0')} машин</span></div>
<h2 class="lxn-title">Машина <em>года</em></h2>
<p class="lxn-lede">Настоящие машины группы. Нажми на машину — она заведётся. Открой досье — и собери тюнинг прямо на фото.</p>
</header>
<div class="sr-stage" tabindex="0" aria-label="Шоу-рум">
<i class="sr-wall"></i><i class="sr-spot"></i><i class="sr-floor"></i>
<div class="sr-track">${list.map(c => `<figure class="sr-car" data-i="${c.i}"><img src="${CAR_IMG[c.rig.img] || ''}" alt="${esc(c.z.model || '')} — ${esc(c.full)}" draggable="false" decoding="async">${(c.rig.lights || []).map(([x, y, k]) => `<i class="sr-glow" style="left:${x - 12 * k}%;top:${y - 14 * k}%;width:${24 * k}%;height:${28 * k}%"></i>`).join('')}</figure>`).join('')}</div>
<span class="sr-num"><b>01</b> / ${String(list.length).padStart(2, '0')}</span>
<button type="button" class="sr-nav prev" aria-label="Предыдущая">←</button><button type="button" class="sr-nav next" aria-label="Следующая">→</button>
</div>
<div class="sr-info">
<div class="sr-name"><small class="sr-model"></small><b class="sr-owner"></b><span class="sr-specs"></span></div>
<div class="sr-btns"><button type="button" class="sr-start"><i></i>Завести</button><button type="button" class="sr-open">Досье и тюнинг →</button></div>
</div>
<ol class="sr-list">${list.map(c => `<li><button type="button" data-i="${c.i}"><span class="n">${String(c.i + 1).padStart(2, '0')}</span><span class="t"><b>${esc(c.sur)}</b><small>${esc(c.z.model || '')}</small></span><i style="--c:${c.z.paint || '#999'}"></i></button></li>`).join('')}</ol>
<p class="lxn-hint">Листай машины свайпом или стрелками.</p>`;
$('.nominee-subblock', frame).before(board); frame.classList.add('lxn');
const stage = $('.sr-stage', board), cars = $$('.sr-car', board), items = $$('.sr-list button', board), num = $('.sr-num b', board);
const mdl = $('.sr-model', board), own = $('.sr-owner', board), spec = $('.sr-specs', board);
let cur = 0, busy = false;
const show = (i, dir = 0) => {
cur = (i + list.length) % list.length; const c = list[cur];
cars.forEach((el, k) => { el.classList.toggle('on', k === cur); el.classList.toggle('prev', k === (cur - 1 + list.length) % list.length); el.classList.toggle('next', k === (cur + 1) % list.length); });
items.forEach((b, k) => b.classList.toggle('on', k === cur));
num.textContent = String(cur + 1).padStart(2, '0'); mdl.textContent = (c.z.model || '') + ' · ' + (c.rig.year || ''); own.innerHTML = `${esc(c.sur)} <em>${esc(c.first)}</em>`; spec.textContent = [c.rig.engine, c.rig.gear, c.rig.paintName].filter(Boolean).join(' · ');
stage.style.setProperty('--paint', c.z.paint || '#888'); carPreload(c.rig.snd);
};
const start = () => { const c = list[cur], el = cars[cur]; carSound(c.rig.snd); el.classList.remove('run'); void el.offsetWidth; el.classList.add('run'); setTimeout(() => el.classList.remove('run'), 3300); try{ navigator.vibrate?.([40, 60, 40, 60, 120]); }catch(_){} };
const open = () => { if(busy) return; busy = true; openCandidate(list[cur].nom, 'history'); setTimeout(() => busy = false, 800); };
$('.prev', stage).addEventListener('click', e => { e.stopPropagation(); show(cur - 1); });
$('.next', stage).addEventListener('click', e => { e.stopPropagation(); show(cur + 1); });
$('.sr-start', board).addEventListener('click', start);
$('.sr-open', board).addEventListener('click', open);
items.forEach(b => b.addEventListener('click', () => { show(+b.dataset.i); stage.scrollIntoView?.({ behavior: 'smooth', block: 'center' }); }));
let sx = null, moved = false;
stage.addEventListener('pointerdown', e => { if(e.target.closest('button')) return; sx = e.clientX; moved = false; });
stage.addEventListener('pointermove', e => { if(sx !== null && Math.abs(e.clientX - sx) > 12) moved = true; });
stage.addEventListener('pointerup', e => { if(sx === null) return; const dx = e.clientX - sx; sx = null; if(e.target.closest('button')) return;
if(moved && Math.abs(dx) > 40){ show(cur + (dx < 0 ? 1 : -1)); return; }
if(!moved && e.target.closest('.sr-car.on')){ start(); setTimeout(open, 1500); } });
stage.addEventListener('keydown', e => { if(e.key === 'ArrowLeft') show(cur - 1); if(e.key === 'ArrowRight') show(cur + 1); if(e.key === 'Enter'){ start(); setTimeout(open, 1500); } });
show(0);
}
frames.filter(f => f.dataset.garage).forEach(f => { try{ buildShowroom(f); }catch(err){ console.error('buildShowroom', err); f.dataset.fb = '1'; } });
const CF_ITEM = { paint: 'Покраска', fin: 'Покрытие', hood: 'Капот', liv: 'Ливрея', rim: 'Диски', cal: 'Суппорты', front: 'Передний обвес', skirt: 'Пороги', arch: 'Расширители арок', spoil: 'Спойлер', low: 'Занижение', tint: 'Тонировка', light: 'Фары', neon: 'Подсветка' };
function cfAttach(root, name){
const rig = CAR_RIG[name], box = root.querySelector('.cf-stage'); if(!rig || !box) return;
const cv = box.querySelector('canvas'), st = tuneStudio(cv, rig), cf = root.querySelector('.cf');
carPreload(rig.snd);
let raf = 0; const draw = () => { if(raf || st.plain) return; raf = requestAnimationFrame(() => { raf = 0; tuneRender(st); }); };
const ld = box.querySelector('.cf-load'), okLoad = ok => { box.classList.remove('fail'); if(ok){ box.classList.add('ready'); return; }
box.classList.add('fail'); ld.innerHTML = '<span>Фото не загрузилось</span><button type="button" class="cf-retry">Повторить</button>'; };
st.load.then(okLoad);
ld.addEventListener('click', e => { if(!e.target.closest('.cf-retry')) return; ld.innerHTML = '<i></i><span>Загружаем фото</span>'; box.classList.remove('fail'); st.retry().then(okLoad); });
const thumbs = () => { const col = (TUNE.rimc.find(x => x[0] === st.t.rimc) || TUNE.rimc[0])[2]; root.querySelectorAll('.cf-rim').forEach(b => tuneRimThumb(b.querySelector('canvas'), b.dataset.v, col)); };
thumbs();
const fmt = n => n.toLocaleString('ru-RU') + ' ₽';
const sync = () => {
root.querySelectorAll('.cf-row').forEach(row => { const k = row.dataset.k, v = String(st.t[k]); row.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v)); row.querySelector('.cf-lbl b').textContent = cfName(k, v, rig); });
let sum = 0; const items = [];
Object.keys(TUNE_DEF).forEach(k => { const c = TUNE_COST[k] ? TUNE_COST[k](st.t[k], st.t) : 0; if(c > 0){ sum += c; let n = cfName(k, st.t[k], rig);
if(k === 'rim') n += ' · ' + cfName('rsz', st.t.rsz, rig) + ' · ' + cfName('rimc', st.t.rimc, rig).toLowerCase();
if(k === 'paint') n = '«' + n + '»';
if(['front', 'skirt', 'spoil', 'arch'].includes(k)) n += ' · ' + cfName('kmat', st.t.kmat, rig).toLowerCase();
items.push([CF_ITEM[k] || k, n, c]); } });
root.querySelectorAll('.cf-total').forEach(e => e.textContent = fmt(sum));
const cnt = items.length; root.querySelector('.cf-cnt').textContent = cnt ? `${cnt} ${cnt % 10 === 1 && cnt % 100 !== 11 ? 'доработка' : cnt % 10 >= 2 && cnt % 10 <= 4 && (cnt % 100 < 10 || cnt % 100 >= 20) ? 'доработки' : 'доработок'}` : 'заводская комплектация';
root.querySelector('.cf-items').innerHTML = items.length ? items.map(([a, b, c]) => `<li><span>${esc(a)}</span><em>${esc(b)}</em><b>${fmt(c)}</b></li>`).join('') : '<li class="cf-empty">Пока заводская комплектация</li>';
box.style.setProperty('--neon', (TUNE.neon.find(x => x[0] === st.t.neon) || [])[2] || 'transparent');
};
const set = (k, v) => { st.t[k] = v; if(k === 'rimc') thumbs(); if(k === 'paint' && v === 'stock') st.t.fin = 'gloss'; sync(); draw(); };
cf.addEventListener('click', e => {
const tab = e.target.closest('.cf-tab'); if(tab){ cf.querySelectorAll('.cf-tab').forEach(x => x.classList.toggle('on', x === tab)); cf.querySelectorAll('.cf-panel').forEach(x => x.classList.toggle('on', x.dataset.p === tab.dataset.p)); try{ tink([740]); }catch(_){} return; }
const pre = e.target.closest('.cf-pre'); if(pre){ const p = TUNE_PRESETS.find(x => x[0] === pre.dataset.pre); Object.assign(st.t, TUNE_DEF, p ? p[2] : {}); if(st.t.spoil !== 'stock' && rig.rear.k === 'hatch' && (st.t.spoil === 'lip' || st.t.spoil === 'duck')) st.t.spoil = 'roof';
cf.querySelectorAll('.cf-pre').forEach(x => x.classList.toggle('on', x === pre && !!p)); thumbs(); sync(); draw(); try{ tink([660, 990]); }catch(_){} if(p && st.ready) st.start(true); return; }
const b = e.target.closest('.cf-row [data-v]'); if(b){ const k = b.closest('.cf-row').dataset.k; cf.querySelectorAll('.cf-pre').forEach(x => x.classList.remove('on')); set(k, b.dataset.v); try{ tink([k === 'light' ? 988 : 660]); }catch(_){} if(k === 'light' && b.dataset.v !== 'stock') st.start(false); return; }
if(e.target.closest('.cr-reset')){ Object.assign(st.t, TUNE_DEF); cf.querySelectorAll('.cf-pre').forEach(x => x.classList.remove('on')); thumbs(); sync(); draw(); return; }
if(e.target.closest('[data-start]') || e.target === cv) st.start(true);
});
const ba = box.querySelector('[data-ba]'); let hold = false;
const on = e => { e.preventDefault(); hold = true; box.classList.add('ba'); tuneRender(st, { stock: true }); }, off = () => { if(!hold) return; hold = false; box.classList.remove('ba'); tuneRender(st); };
ba.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => ba.addEventListener(t, off)); ba.addEventListener('contextmenu', e => e.preventDefault());
st.start = (snd = true) => {
if(snd) carSound(rig.snd); box.classList.remove('run'); void box.offsetWidth; box.classList.add('run'); st.run = 1;
const t0 = performance.now(); const f = now => { const e = now - t0; st.run = e < 3200 ? 1 : 0; if(e < 1400) st.spin += .02 * (1 - e / 1400); tuneRender(st);
if(e < 3300 && hmAlive(box)) requestAnimationFrame(f); else { box.classList.remove('run'); st.run = 0; tuneRender(st); } }; requestAnimationFrame(f);
try{ navigator.vibrate?.([40, 60, 40, 60, 120]); }catch(_){}
};
sync();
}
Object.keys(CAR_RIG).forEach(name => {
const d = HOD[name + '|Машина']; if(!d) return;
d.bento = 'car'; d.key = 'car';
if(name === 'Галкин Виталий' || name === 'Самсонов Константин') d.carExtra = false; /* их старые стенды заменены настоящим тюнингом на фото */
const oa = d.after;
d.after = root => {
if(d.carExtra !== false){ try{ oa?.(root); }catch(e){ console.warn(e); } }
nbCount(root);
try{ cfAttach(root, name); }catch(e){ console.error('tune', e); }
};
});
const BK = {
noise(seed, n = 64){ const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'), d = x.createImageData(n, n); let s = seed; for(let i = 0; i < d.data.length; i += 4){ s = (s * 9301 + 49297) % 233280; const v = s / 233280 * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return c; },
rr(c, x, y, w, h, r){ const [a, b, cc, d] = Array.isArray(r) ? r : [r, r, r, r]; c.beginPath(); c.moveTo(x + a, y); c.lineTo(x + w - b, y); c.quadraticCurveTo(x + w, y, x + w, y + b); c.lineTo(x + w, y + h - cc); c.quadraticCurveTo(x + w, y + h, x + w - cc, y + h); c.lineTo(x + d, y + h); c.quadraticCurveTo(x, y + h, x, y + h - d); c.lineTo(x, y + a); c.quadraticCurveTo(x, y, x + a, y); c.closePath(); },
gold(c, x0, y0, x1, y1){ const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, '#fff1b8'); g.addColorStop(.18, '#e7c45e'); g.addColorStop(.45, '#a8781f'); g.addColorStop(.62, '#f0d47a'); g.addColorStop(.85, '#b98a2a'); g.addColorStop(1, '#f6e2a0'); return g; },
silver(c, x0, y0, x1, y1){ const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, '#f4f6f8'); g.addColorStop(.4, '#9aa2ab'); g.addColorStop(.6, '#e6eaee'); g.addColorStop(1, '#7d858e'); return g; },
foil(c, txt, x, y, font, fill, align = 'center'){ c.font = font; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = 'rgba(0,0,0,.55)'; c.fillText(txt, x, y + 1.2); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillText(txt, x, y - .6); c.fillStyle = fill; c.fillText(txt, x, y); },
ink(c, txt, x, y, size, col = '#1d2f8a', rot = -.03, align = 'center'){ c.save(); c.translate(x, y); c.rotate(rot); c.font = `italic 500 ${size}px Caveat,"LX Serif",Georgia,serif`; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = col; c.globalAlpha = .92; c.fillText(txt, 0, 0); c.restore(); },
type(c, txt, x, y, size, col = '#1b1b1b', align = 'center', w = 700, fam = '"LX Text",Inter,Arial,sans-serif', ls = 0){ c.font = `${w} ${size}px ${fam}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = col; if(ls && c.letterSpacing !== undefined) c.letterSpacing = ls + 'px'; c.fillText(txt, x, y); if(c.letterSpacing !== undefined) c.letterSpacing = '0px'; },
blind(c, x, y, w, h, r = 3){ c.lineWidth = 1.4; c.strokeStyle = 'rgba(0,0,0,.45)'; BK.rr(c, x + .8, y + .8, w, h, r); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.13)'; BK.rr(c, x - .4, y - .4, w, h, r); c.stroke(); },
photo(c, im, x, y, w, h, ini, mono, round){
c.save(); if(round){ c.beginPath(); c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 7); } else c.rect(x, y, w, h); c.clip();
if(im && im.naturalWidth){ const s = Math.max(w / im.naturalWidth, h / im.naturalHeight), iw = im.naturalWidth * s, ih = im.naturalHeight * s; c.filter = mono ? 'grayscale(1) contrast(1.1)' : 'sepia(.18) contrast(1.05)'; c.drawImage(im, x + (w - iw) / 2, y + (h - ih) * .25, iw, ih); c.filter = 'none'; }
else { const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#3a3f45'); g.addColorStop(1, '#16191d'); c.fillStyle = g; c.fillRect(x, y, w, h); c.font = `italic 400 ${Math.round(h * .42)}px "LX Serif",Georgia,serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(239,234,224,.75)'; c.fillText(ini, x + w / 2, y + h / 2 + h * .03); }
c.restore();
},
clip(c, x, y, s = 1){ c.save(); c.translate(x, y); c.scale(s, s); c.lineWidth = 2.4; c.strokeStyle = BK.silver(c, -8, 0, 8, 40); c.beginPath(); c.moveTo(-4, 34); c.lineTo(-4, 4); c.arc(1, 4, 5, Math.PI, 0); c.lineTo(6, 30); c.arc(2, 30, 4, 0, Math.PI); c.lineTo(-2, 10); c.stroke(); c.restore(); },
tape(c, x, y, w, h, rot){ c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = 'rgba(245,238,210,.55)'; c.fillRect(-w / 2, -h / 2, w, h); c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(-w / 2, -h / 2 + 1); c.lineTo(w / 2, -h / 2 + 1); c.stroke(); for(let k = -w / 2; k < w / 2; k += 3){ c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(k, -h / 2 - 1, 1.5, 2); c.fillRect(k + 1, h / 2 - 1, 1.5, 2); } c.restore(); },
draw(cv, spec, im){
const c = cv.getContext('2d'), W = cv.width, H = cv.height, s = W / 300; c.setTransform(s, 0, 0, s, 0, 0); const w = 300, h = 400;
c.clearRect(0, 0, w, h);
const R = [3, 8, 8, 3];
c.save(); BK.rr(c, 0, 0, w, h, R); c.clip();
const base = c.createLinearGradient(0, 0, w, h); base.addColorStop(0, spec.c1); base.addColorStop(1, spec.c2); c.fillStyle = base; c.fillRect(0, 0, w, h);
const nz = BK._nz || (BK._nz = { a: BK.noise(7, 48), b: BK.noise(19, 160), f: BK.noise(31, 256) });
c.imageSmoothingEnabled = true;
if(spec.mat === 'leather'){ c.globalAlpha = .28; c.globalCompositeOperation = 'overlay'; c.drawImage(nz.a, 0, 0, w, h); c.globalAlpha = .22; c.drawImage(nz.b, 0, 0, w, h); c.globalCompositeOperation = 'source-over';
/* «шагрень»: мелкие выпуклости */ c.globalAlpha = .07; for(let k = 0; k < 900; k++){ const x = (k * 73.13) % w, y = (k * 51.77 + (k % 7) * 13) % h; c.fillStyle = k % 2 ? '#fff' : '#000'; c.beginPath(); c.arc(x, y, .8 + (k % 3) * .5, 0, 7); c.fill(); } c.globalAlpha = 1; }
if(spec.mat === 'cloth'){ c.globalAlpha = .12; c.strokeStyle = '#000'; c.lineWidth = .6; for(let x = 0; x < w; x += 2.2){ c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } c.strokeStyle = '#fff'; c.globalAlpha = .06; for(let y = 0; y < h; y += 2.2){ c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.globalAlpha = .2; c.globalCompositeOperation = 'overlay'; c.drawImage(nz.b, 0, 0, w, h); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
if(spec.mat === 'kraft'){ c.globalAlpha = .35; c.globalCompositeOperation = 'multiply'; c.drawImage(nz.f, 0, 0, w, h); c.globalCompositeOperation = 'source-over'; c.globalAlpha = .08; c.strokeStyle = '#3b2610'; for(let k = 0; k < 160; k++){ const x = (k * 37.7) % w, y = (k * 91.3) % h, a = (k % 17) / 17 * 6.28; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); c.stroke(); } c.globalAlpha = 1; }
if(spec.mat === 'gloss'){ c.globalAlpha = .1; c.globalCompositeOperation = 'overlay'; c.drawImage(nz.b, 0, 0, w, h); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
spec.deco(c, w, h, im);
const li = c.createRadialGradient(w * .2, h * .05, 10, w * .3, h * .2, w * 1.1); li.addColorStop(0, 'rgba(255,236,190,.22)'); li.addColorStop(.5, 'rgba(255,236,190,.04)'); li.addColorStop(1, 'rgba(0,0,0,.28)'); c.fillStyle = li; c.fillRect(0, 0, w, h);
if(spec.mat === 'gloss'){ const sh = c.createLinearGradient(0, 0, w, h); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.42, 'rgba(255,255,255,0)'); sh.addColorStop(.5, 'rgba(255,255,255,.16)'); sh.addColorStop(.58, 'rgba(255,255,255,0)'); c.fillStyle = sh; c.fillRect(0, 0, w, h); }
[[w, 0], [w, h], [0, h], [0, 0]].forEach(([x, y], k) => { const g = c.createRadialGradient(x, y, 0, x, y, 22 + (k % 2) * 8); g.addColorStop(0, `rgba(255,240,220,${spec.mat === 'gloss' ? .1 : .22})`); g.addColorStop(1, 'rgba(255,240,220,0)'); c.fillStyle = g; c.fillRect(x - 40, y - 40, 80, 80); });
c.globalAlpha = .07; c.strokeStyle = '#fff'; c.lineWidth = .8; for(let k = 0; k < 14; k++){ const x = (k * 97) % w, y = (k * 151) % h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 8 + (k % 5) * 3, y + (k % 3) - 1); c.stroke(); } c.globalAlpha = 1;
const hx = spec.spiral ? 26 : 17; const hg = c.createLinearGradient(0, 0, hx + 6, 0); hg.addColorStop(0, 'rgba(0,0,0,.45)'); hg.addColorStop(.55, 'rgba(255,255,255,.08)'); hg.addColorStop(.8, 'rgba(0,0,0,.35)'); hg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = hg; c.fillRect(0, 0, hx + 6, h);
c.restore();
c.save(); BK.rr(c, .5, .5, w - 1, h - 1, R); c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1.2; c.stroke(); BK.rr(c, 1.6, 1.6, w - 3.2, h - 3.2, R); c.strokeStyle = 'rgba(255,255,255,.08)'; c.stroke(); c.restore();
if(spec.spiral){ for(let y = 18; y < h - 10; y += 15){ c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.ellipse(15, y + 2, 3.2, 3.2, 0, 0, 7); c.fill(); c.lineWidth = 2.6; c.strokeStyle = BK.silver(c, 0, y - 6, 18, y + 6); c.beginPath(); c.ellipse(8, y, 9, 4.6, -.25, Math.PI * .55, Math.PI * 1.95); c.stroke(); } }
}
};
const BK_SPEC = {
zk: { mat: 'leather', c1: '#7c1624', c2: '#3f0710', deco(c, w, h, im){ const z = this.z;
BK.blind(c, 26, 12, w - 38, h - 24, 4); BK.blind(c, 32, 18, w - 50, h - 36, 3);
c.strokeStyle = BK.gold(c, 0, 0, w, h); c.lineWidth = 1.2; BK.rr(c, 38, 24, w - 62, h - 48, 2); c.stroke();
[[38, 24], [w - 24, 24], [38, h - 24], [w - 24, h - 24]].forEach(([x, y]) => { c.fillStyle = BK.gold(c, x - 6, y - 6, x + 6, y + 6); c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillRect(-4, -4, 8, 8); c.restore(); });
BK.foil(c, 'ЗАЧЁТНАЯ', w / 2 + 7, 66, '700 21px "LX Serif",Georgia,serif', BK.gold(c, 60, 55, 240, 75)); BK.foil(c, 'КНИЖКА', w / 2 + 7, 92, '700 21px "LX Serif",Georgia,serif', BK.gold(c, 60, 80, 240, 100));
BK.foil(c, '— студенческая —', w / 2 + 7, 116, 'italic 400 11px "LX Serif",Georgia,serif', BK.gold(c, 80, 110, 220, 122));
const cx = w / 2 + 7, cy = 212, r = 58; c.lineWidth = 3; c.strokeStyle = BK.gold(c, cx - r, cy - r, cx + r, cy + r); c.beginPath(); c.arc(cx, cy, r + 6, 0, 7); c.stroke(); c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, r + 11, 0, 7); c.stroke();
for(let k = 0; k < 18; k++){ const a = Math.PI * .6 + k / 17 * Math.PI * .8, x = cx + Math.cos(a) * (r + 18), y = cy + Math.sin(a) * (r + 18); c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2 + (k < 9 ? -.5 : .5)); c.fillStyle = BK.gold(c, -3, -6, 3, 6); c.beginPath(); c.ellipse(0, 0, 2.4, 6, 0, 0, 7); c.fill(); c.restore(); }
BK.photo(c, im, cx - r, cy - r, r * 2, r * 2, z.ini, false, true); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke();
BK.foil(c, z.sur.toUpperCase(), cx, 322, '700 22px "LX Serif",Georgia,serif', BK.gold(c, 60, 312, 240, 332)); BK.foil(c, z.first, cx, 346, 'italic 400 14px "LX Serif",Georgia,serif', BK.gold(c, 90, 338, 210, 354));
BK.foil(c, '№ ' + z.no, cx, 372, '600 10px "LX Text",Inter,sans-serif', BK.gold(c, 120, 366, 180, 378)); } },
lb: { mat: 'cloth', c1: '#1d5c58', c2: '#0b302e', deco(c, w, h, im){ const z = this.z;
[[w - 3, 3, -1, 1], [w - 3, h - 3, -1, -1]].forEach(([x, y, sx, sy]) => { c.fillStyle = BK.silver(c, x - 30, y - 30, x, y); c.beginPath(); c.moveTo(x, y); c.lineTo(x + sx * 30, y); c.lineTo(x, y + sy * 30); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.4)'; c.stroke(); });
const lx = 50, ly = 40, lw = w - 82, lh = 120; c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 6; c.shadowOffsetY = 2; c.fillStyle = '#efe7cf'; c.fillRect(lx, ly, lw, lh); c.restore();
c.strokeStyle = 'rgba(30,40,80,.18)'; for(let y = ly + 74; y < ly + lh - 6; y += 13){ c.beginPath(); c.moveTo(lx + 10, y); c.lineTo(lx + lw - 10, y); c.stroke(); }
c.strokeStyle = '#1b1b1b'; c.lineWidth = 1; c.strokeRect(lx + 5, ly + 5, lw - 10, lh - 10);
BK.type(c, 'ЛАБОРАТОРНЫЙ', lx + lw / 2, ly + 26, 15, '#1b1b1b', 'center', 800); BK.type(c, 'ЖУРНАЛ', lx + lw / 2, ly + 46, 15, '#1b1b1b', 'center', 800);
BK.type(c, 'практикум · опыты · № ' + z.no, lx + lw / 2, ly + 64, 9, '#555', 'center', 500);
BK.ink(c, z.sur + ' ' + z.first[0] + '.', lx + lw / 2 + 4, ly + 92, 22); BK.ink(c, 'гр. ИС-41', lx + lw / 2 + 20, ly + 108, 15);
const px = 66, py = 196, pw = 104, ph = 128; c.save(); c.translate(px + pw / 2, py + ph / 2); c.rotate(-.05); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 8; c.shadowOffsetY = 3; c.fillStyle = '#f6f3ec'; c.fillRect(-pw / 2, -ph / 2, pw, ph); c.restore(); c.save(); c.translate(px + pw / 2, py + ph / 2); c.rotate(-.05); BK.photo(c, im, -pw / 2 + 7, -ph / 2 + 7, pw - 14, ph - 30, z.ini, true); c.restore(); BK.clip(c, px + 22, py - 8, 1);
c.save(); c.translate(222, 268); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-10, -34); c.lineTo(-10, -6); c.lineTo(-28, 26); c.quadraticCurveTo(-30, 32, -24, 32); c.lineTo(24, 32); c.quadraticCurveTo(30, 32, 28, 26); c.lineTo(10, -6); c.lineTo(10, -34); c.moveTo(-14, -34); c.lineTo(14, -34); c.moveTo(-20, 14); c.lineTo(20, 14); c.stroke(); c.restore(); } },
kn: { mat: 'gloss', spiral: true, c1: '#2b49b0', c2: '#14256e', deco(c, w, h, im){ const z = this.z;
c.globalAlpha = .12; c.strokeStyle = '#fff'; c.lineWidth = 1; for(let k = -h; k < w + h; k += 16){ c.beginPath(); c.moveTo(30 + k, 0); c.lineTo(30 + k - h * .5, h); c.stroke(); } c.globalAlpha = 1;
c.fillStyle = 'rgba(255,255,255,.95)'; c.fillRect(30, 0, w - 30, 64); BK.type(c, 'КОНСПЕКТ', 48, 30, 26, '#14256e', 'left', 800); BK.type(c, 'ОБЩАЯ ТЕТРАДЬ · 96 ЛИСТОВ · КЛЕТКА', 49, 50, 8.5, '#5a6aa8', 'left', 600);
const lx = 58, ly = 290, lw = w - 96, lh = 78; c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 5; c.shadowOffsetY = 2; c.fillStyle = '#fbfaf3'; BK.rr(c, lx, ly, lw, lh, 6); c.fill(); c.restore(); c.strokeStyle = '#2b49b0'; c.lineWidth = 1.2; BK.rr(c, lx + 4, ly + 4, lw - 8, lh - 8, 4); c.stroke();
BK.type(c, 'ТЕТРАДЬ', lx + 14, ly + 17, 9, '#2b49b0', 'left', 700); c.strokeStyle = 'rgba(43,73,176,.35)'; for(let y = ly + 36; y < ly + lh - 8; y += 16){ c.beginPath(); c.moveTo(lx + 12, y); c.lineTo(lx + lw - 12, y); c.stroke(); }
BK.ink(c, z.sur + ' ' + z.first, lx + lw / 2, ly + 33, 22, '#14256e', -.02); BK.ink(c, 'лекции · 4 курс', lx + lw / 2, ly + 55, 16, '#14256e', -.02);
const px = 104, py = 98, pw = 130, ph = 160; c.save(); c.translate(px + pw / 2, py + ph / 2); c.rotate(.045); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 10; c.shadowOffsetY = 4; c.fillStyle = '#fbfaf5'; c.fillRect(-pw / 2, -ph / 2, pw, ph); c.shadowColor = 'transparent'; BK.photo(c, im, -pw / 2 + 8, -ph / 2 + 8, pw - 16, ph - 40, z.ini); BK.ink(c, 'это я ✓', 0, ph / 2 - 16, 18, '#1d2f8a', -.04); c.restore();
BK.tape(c, px + pw / 2, py + 2, 54, 16, -.12); } },
pk: { mat: 'kraft', c1: '#c49a5c', c2: '#9a7038', deco(c, w, h, im){ const z = this.z;
c.fillStyle = '#1e1810'; BK.type(c, 'ДЕЛО', w / 2 + 6, 46, 30, '#231a0d', 'center', 800, '"LX Display",Inter,sans-serif', 8);
c.fillRect(44, 66, w - 70, 2); c.fillRect(44, 70, w - 70, 1);
BK.type(c, 'КУРСОВАЯ РАБОТА', w / 2 + 6, 90, 13, '#231a0d', 'center', 800); BK.type(c, 'скоросшиватель · А4', w / 2 + 6, 108, 9, '#4a3a20', 'center', 500);
const rows = [['Студент', z.sur + ' ' + z.first[0] + '.'], ['Группа', 'ИС-41'], ['Оценка', 'отл. (5)']]; rows.forEach(([k, v], i) => { const y = 268 + i * 30; BK.type(c, k, 48, y, 10, '#3b2c14', 'left', 600); c.fillStyle = '#3b2c14'; c.fillRect(104, y + 8, w - 134, 1); BK.ink(c, v, 110, y + 1, 21, i === 2 ? '#a3121b' : '#14256e', -.02, 'left'); });
const px = w / 2 - 52, py = 124, pw = 116, ph = 128; c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 6; c.shadowOffsetY = 3; c.fillStyle = '#f7f4ec'; c.fillRect(px, py, pw, ph); c.restore(); BK.photo(c, im, px + 6, py + 6, pw - 12, ph - 12, z.ini, true);
c.fillStyle = BK.silver(c, px + 20, py, px + 40, py + 6); c.fillRect(px + 20, py - 2, 18, 5); c.fillRect(px + pw - 38, py - 2, 18, 5);
c.save(); c.translate(w - 50, 375); c.rotate(-.18); c.strokeStyle = 'rgba(163,18,27,.8)'; c.lineWidth = 2.5; c.strokeRect(-36, -14, 72, 28); BK.type(c, 'СДАНО', 0, 1, 14, 'rgba(163,18,27,.85)', 'center', 800); c.restore();
c.strokeStyle = '#efe7d3'; c.lineWidth = 3; c.beginPath(); c.moveTo(w, 196); c.quadraticCurveTo(w - 24, 206, w - 12, 226); c.stroke(); c.beginPath(); c.moveTo(w, 204); c.quadraticCurveTo(w - 30, 232, w - 38, 258); c.stroke();
c.fillStyle = BK.silver(c, 18, 180, 30, 220); c.fillRect(20, 150, 8, 100); } },
pl: { mat: 'gloss', spiral: true, c1: '#c2528f', c2: '#6c1f50', deco(c, w, h, im){ const z = this.z;
c.fillStyle = 'rgba(255,255,255,.18)'; for(let y = 14; y < h; y += 14) for(let x = 36; x < w; x += 14){ c.beginPath(); c.arc(x, y, .9, 0, 7); c.fill(); }
[['#ffd43b', 70], ['#38d27a', 118], ['#3aa0ff', 166], ['#ff7a3d', 214]].forEach(([col, y]) => { c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 3; c.fillStyle = col; c.globalAlpha = .92; c.fillRect(w - 22, y, 22, 32); c.restore(); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(w - 22, y, 22, 3); });
BK.type(c, 'КОНСПЕКТ', 52, 54, 27, '#fff', 'left', 800); BK.type(c, 'в четыре цвета', 54, 78, 11, 'rgba(255,255,255,.8)', 'left', 500);
c.fillStyle = '#ffd43b'; c.globalAlpha = .55; c.fillRect(50, 44, 92, 14); c.globalAlpha = 1; BK.type(c, 'КОНСПЕКТ', 52, 54, 27, '#fff', 'left', 800);
const px = 66, py = 104, pw = 168, ph = 150; c.save(); c.translate(px + pw / 2, py + ph / 2); c.rotate(-.03); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 10; c.shadowOffsetY = 4; c.fillStyle = '#fff'; c.fillRect(-pw / 2, -ph / 2, pw, ph); c.shadowColor = 'transparent'; BK.photo(c, im, -pw / 2 + 8, -ph / 2 + 8, pw - 16, ph - 16, z.ini); c.restore();
BK.tape(c, px + 10, py + 6, 46, 15, -.6); BK.tape(c, px + pw - 8, py + ph - 6, 46, 15, -.6);
c.save(); c.translate(150, 304); c.rotate(-.04); c.fillStyle = '#fff59d'; c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 6; c.shadowOffsetY = 3; c.fillRect(-96, -30, 192, 70); c.restore(); BK.ink(c, z.sur + ' ' + z.first, 150, 296, 23, '#6c1f50', -.04); BK.ink(c, 'не трогать! ♥', 152, 322, 18, '#c2185b', -.04); } },
tb: { mat: 'cloth', c1: '#566339', c2: '#262e16', deco(c, w, h, im){ const z = this.z;
BK.type(c, 'ПАПКА ДЛЯ ЧЕРЧЕНИЯ', w / 2 + 8, 44, 14, '#e9e2c6', 'center', 800); BK.type(c, 'формат А3 · ГОСТ 2.301', w / 2 + 8, 62, 9, 'rgba(233,226,198,.7)', 'center', 500);
c.strokeStyle = 'rgba(233,226,198,.8)'; c.lineWidth = 1; c.strokeRect(34, 80, w - 52, 196);
c.save(); c.translate(w / 2 + 8, 178); c.strokeStyle = 'rgba(233,226,198,.6)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, -78); c.lineTo(-44, 72); c.moveTo(0, -78); c.lineTo(44, 72); c.stroke(); c.beginPath(); c.arc(0, -78, 6, 0, 7); c.stroke(); c.setLineDash([3, 4]); c.beginPath(); c.arc(0, -78, 130, Math.PI * .38, Math.PI * .62); c.stroke(); c.setLineDash([]); c.restore();
const px = w / 2 - 44, py = 118, pw = 104, ph = 116; c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 6; c.shadowOffsetY = 2; c.fillStyle = '#f2ecd8'; c.fillRect(px, py, pw, ph); c.restore(); BK.photo(c, im, px + 5, py + 5, pw - 10, ph - 10, z.ini, true);
const tx = 34, ty = 290, tw = w - 52, th = 92; c.fillStyle = '#efe7cf'; c.fillRect(tx, ty, tw, th); c.strokeStyle = '#1b1b1b'; c.lineWidth = 1.4; c.strokeRect(tx, ty, tw, th); c.lineWidth = .7;
[[0, 30], [0, 60]].forEach(([, y]) => { c.beginPath(); c.moveTo(tx, ty + y); c.lineTo(tx + tw, ty + y); c.stroke(); }); [70, 170].forEach(x => { c.beginPath(); c.moveTo(tx + x, ty); c.lineTo(tx + x, ty + th); c.stroke(); });
BK.type(c, 'Разраб.', tx + 6, ty + 15, 9, '#1b1b1b', 'left', 600); BK.type(c, 'Пров.', tx + 6, ty + 45, 9, '#1b1b1b', 'left', 600); BK.type(c, 'Лист', tx + 6, ty + 76, 9, '#1b1b1b', 'left', 600);
BK.ink(c, z.sur, tx + 120, ty + 16, 19, '#14256e', -.02); BK.ink(c, 'зачтено', tx + 120, ty + 46, 17, '#a3121b', -.05); BK.type(c, '1 / 1', tx + 120, ty + 76, 10, '#1b1b1b');
BK.type(c, 'ИС-41', tx + tw - 22, ty + 46, 12, '#1b1b1b', 'center', 800);
c.strokeStyle = '#d8cfae'; c.lineWidth = 3.2; c.beginPath(); c.moveTo(w, 150); c.quadraticCurveTo(w - 28, 160, w - 20, 186); c.stroke(); c.beginPath(); c.moveTo(w, 160); c.quadraticCurveTo(w - 36, 196, w - 44, 222); c.stroke(); } }
};
function realBooks(frame){
const board = $('.student', frame); if(!board) return;
const noms = $$('.nominee:not([hidden])', frame);
frame.classList.add('lxn'); board.classList.add('real');
const idx = frames.indexOf(frame), TOT = typeof TOTAL_NOMS === 'number' ? TOTAL_NOMS : 7;
board.insertAdjacentHTML('afterbegin', `<header class="lxn-head"><div class="lxn-kick"><span>Номинация ${String(idx + 1).padStart(2, '0')} / ${String(TOT).padStart(2, '0')}</span><span>Читальный зал № 1</span></div>
<h2 class="lxn-title">Прилежный <em>студент</em></h2><p class="lxn-lede">Шесть книг на столе читального зала. Выбери одну — она откроется, а вместе с ней и дело студента.</p></header>`);
const books = $$('.sb', board);
const paint = () => books.forEach((b, i) => {
const nom = noms[+b.dataset.i], full = $('.nominee-front h3', nom)?.textContent.trim() || nom.dataset.nominee, z = STUDENT[nom.dataset.nominee] || {}, kind = (b.className.match(/sb-(\w\w)\b/) || [])[1] || 'zk';
const spec = Object.create(BK_SPEC[kind] || BK_SPEC.zk); const parts = full.split(/\s+/); spec.z = { sur: parts[0], first: parts.slice(1).join(' ') || ' ', ini: parts.map(s => s[0] || '').join('').slice(0, 2), no: z.no || String(i + 1).padStart(2, '0') };
const cover = $('.sb-cover', b); let cv = $('canvas.bk-cv', cover); if(!cv){ cv = document.createElement('canvas'); cv.className = 'bk-cv'; cover.prepend(cv); }
const dpr = Math.min(2.5, window.devicePixelRatio || 1), cw = Math.max(150, cover.clientWidth || 160); cv.width = Math.round(cw * dpr); cv.height = Math.round(cw * dpr * 4 / 3);
const src = $('.nominee-front img', nom)?.getAttribute('src'); let im = null;
const go = () => { try{ BK.draw(cv, spec, im); }catch(err){ console.warn('book', err); } };
if(src){ im = new Image(); im.onload = go; im.onerror = () => { im = null; go(); }; im.src = src; }
go();
});
paint();
if(document.fonts && document.fonts.ready) document.fonts.ready.then(paint);
let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(paint, 200); });
if('IntersectionObserver' in window){ const io = new IntersectionObserver(es => { if(es.some(e => e.isIntersecting)){ paint(); io.disconnect(); } }); io.observe(board); }
}
frames.filter(f => f.dataset.student).forEach(f => { try{ realBooks(f); }catch(err){ console.error('realBooks', err); } });
function realWanted(frame){
const board = $('.wanted', frame); if(!board) return;
board.classList.add('real'); frame.classList.add('lxn');
const idx = frames.indexOf(frame), TOT = typeof TOTAL_NOMS === 'number' ? TOTAL_NOMS : 7, n = $$('.wp', board).length;
board.insertAdjacentHTML('afterbegin', `<header class="lxn-head"><div class="lxn-kick"><span>Номинация ${String(idx + 1).padStart(2, '0')} / ${String(TOT).padStart(2, '0')}</span><span>У деканата</span></div>
<h2 class="lxn-title">Главный <em>прогульщик</em></h2><p class="lxn-lede">${n} объявлений о пропаже. Нажми на листок — откроется дело. Отрывные листочки внизу можно отрывать.</p></header>`);
const cork = document.createElement('div'); cork.className = 'wr-board';
cork.innerHTML = '<i class="wr-frame"></i><i class="wr-light"></i>';
const top = $('.wall-top', board), grid = $('.wanted-grid', board);
board.insertBefore(cork, top || grid); if(top) cork.appendChild(top); cork.appendChild(grid);
if(top) top.insertAdjacentHTML('afterbegin', '<i class="wr-pin a"></i><i class="wr-pin b"></i>');
cork.insertAdjacentHTML('beforeend', '<i class="wr-note"><b>Потерян пропуск</b><small>звонить Лукину</small></i><i class="wr-pin loose"></i><i class="wr-hole h1"></i><i class="wr-hole h2"></i><i class="wr-hole h3"></i>');
$$('.wp', board).forEach((wp, i) => { const p = $('.wp-paper', wp); if(p) p.insertAdjacentHTML('beforeend', '<i class="wr-crease"></i><i class="wr-curl"></i>'); wp.style.setProperty('--sh', (i % 2 ? 1 : -1)); });
}
frames.filter(f => f.dataset.wanted).forEach(f => { try{ realWanted(f); }catch(err){ console.error('realWanted', err); } });
const VOTE_CONFIG = {
// Если поднимете свой прокси (см. worker/vote-worker.js) — впишите сюда его адрес.
// Тогда голоса пойдут на него, а токен бота можно убрать из клиента.
endpoint: 'https://premia-2027.kirilltop228gamer.workers.dev/vote',
botToken: '',
chatId: '-1002626436094',
oneVotePerUser: true
};
const PROG_KEY = 'premia2027_progress_v1', OUT_KEY = 'premia2027_outbox_v1', DONE_KEY = 'premia2027_done_';
const tgUser = tg.initDataUnsafe?.user || null, userKey = tgUser?.id ? String(tgUser.id) : '';
const jget = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } };
const jset = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const jdel = k => { try{ localStorage.removeItem(k); }catch(e){} };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function saveProgress(){ jset(PROG_KEY, { u: userKey, sel: { ...selectedNominees }, t: Date.now() }); }
function loadProgress(){
const p = jget(PROG_KEY, null);
if(!p || p.u !== userKey || !p.sel || !Object.keys(p.sel).length || Date.now() - p.t > 864e5) return null;
return p;
}
function scToast(text){
let t = $('#scToast'); if(!t){ t = document.createElement('div'); t.id = 'scToast'; t.className = 'sc-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
t.textContent = text; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 3200);
}
function restoreProgress(p){
let first = -1;
frames.forEach((f, i) => {
const noms = $$('.nominee', f), hit = noms.find(n => p.sel[(n.dataset.row || '').trim()] === (n.dataset.nominee || ''));
if(hit){
selectedNominees[(hit.dataset.row || '').trim()] = hit.dataset.nominee || '';
hit.classList.add('selected'); hit.classList.remove('flipped');
noms.forEach(n => { if(n !== hit){ n.style.pointerEvents = 'none'; n.style.opacity = '.38'; } });
} else if(first < 0) first = i;
});
if(first < 0){ showCompletion(); scToast('Все номинации выбраны — осталось отправить голос'); }
else { showNomination(first); scToast('Продолжаем с номинации ' + String(first + 1).padStart(2, '0') + ' из ' + String(TOTAL_NOMS).padStart(2, '0')); }
}
function voteSource(){ return (tg.initData && tgUser?.id) ? 'tg' : 'web'; }
function deviceId(){ try{ let d = localStorage.getItem('premia2027_dev'); if(!d){ d = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); localStorage.setItem('premia2027_dev', d); } return d; }catch(_){ return ''; } }
async function postVote(v){
const ctrl = new AbortController(), to = setTimeout(() => ctrl.abort(), 10000);
try{
if(VOTE_CONFIG.endpoint){
const r = await fetch(VOTE_CONFIG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v), signal: ctrl.signal });
return { ok: r.ok, retryAfter: +r.headers.get('Retry-After') || 0, fatal: r.status >= 400 && r.status < 500 && r.status !== 429 };
}
const text = `@${v.username} проголосовал за (${v.source === 'tg' ? 'Telegram' : 'сайт'}):\n` + Object.entries(v.votes).map(([row, n]) => `${row}: ${n}`).join('\n') + '\n\nhttps://us27utogi.com/';
const r = await fetch(`https://api.telegram.org/bot${VOTE_CONFIG.botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: VOTE_CONFIG.chatId, text }), signal: ctrl.signal });
if(r.ok) return { ok: true };
let ra = 0; try{ ra = (await r.json())?.parameters?.retry_after || 0; }catch(e){}
return { ok: false, retryAfter: ra, fatal: r.status >= 400 && r.status < 500 && r.status !== 429 };
}catch(e){ return { ok: false }; }
finally{ clearTimeout(to); }
}
function voteStatus(kind, extra){
let box = $('#voteStatus'); if(!box){ box = document.createElement('div'); box.id = 'voteStatus'; box.className = 'vs'; box.setAttribute('aria-live', 'polite'); ($('#tab5') || document.body).appendChild(box); }
const M = {
sending: ['Отправляем твой голос…', 'Не закрывай окно — это займёт пару секунд.'],
retry: ['Сервер перегружен — пробуем ещё раз', extra || 'Голос сохранён на устройстве и уйдёт сам.'],
offline: ['Нет связи', 'Голос сохранён на устройстве и отправится, как только сеть появится.'],
ok: ['Голос принят', 'Спасибо! Можно закрывать.'],
fail: ['Не получилось отправить', 'Голос сохранён. Нажми кнопку, чтобы повторить.']
}[kind];
box.className = 'vs vs-' + kind;
box.innerHTML = `<i></i><b>${M[0]}</b><span>${M[1]}</span>` + (kind === 'fail' ? '<button type="button" class="vs-btn">Отправить ещё раз</button>' : '');
$('.vs-btn', box)?.addEventListener('click', () => { voteStatus('sending'); flushOutbox(true); });
}
let flushing = null;
function flushOutbox(visible){
if(flushing) return flushing;
flushing = (async () => {
let allOk = true;
for(const v of jget(OUT_KEY, [])){
let attempt = 0;
for(;;){
if(navigator.onLine === false){ if(visible) voteStatus('offline'); await Promise.race([new Promise(r => addEventListener('online', r, { once: true })), sleep(8000)]); if(navigator.onLine === false && ++attempt > 6){ allOk = false; break; } continue; }
const r = await postVote(v);
if(r.ok){ jset(OUT_KEY, jget(OUT_KEY, []).filter(x => x.id !== v.id)); break; }
if(r.fatal || ++attempt > 12){ allOk = false; break; }
const wait = Math.min(60000, r.retryAfter ? r.retryAfter * 1000 : Math.pow(2, attempt) * 700) + Math.random() * 1500;
if(visible) voteStatus('retry', 'Следующая попытка через ' + Math.ceil(wait / 1000) + ' с. Голос сохранён на устройстве.');
await sleep(wait);
}
if(!allOk) break;
}
return allOk;
})().then(ok => {
flushing = null;
if(ok){ jdel(PROG_KEY); if(userKey) jset(DONE_KEY + userKey, 1); if(visible){ voteStatus('ok'); setTimeout(() => { try{ tg.close(); }catch(_){} }, 2200); } }
else if(visible) voteStatus('fail');
return ok;
});
return flushing;
}
let submitting = false;
if(submitVotes){
const fresh = submitVotes;
fresh.addEventListener('click', () => {
if(submitting) return; submitting = true; fresh.disabled = true; playSound(clickSound);
const v = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), source: voteSource(), deviceId: deviceId(), initData: tg.initData || '', userId: userKey || 'Аноним', username: tgUser?.username || 'Аноним', name: [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' '), votes: { ...selectedNominees }, ts: Date.now() };
const box = jget(OUT_KEY, []); box.push(v); jset(OUT_KEY, box);
switchTab('tab5'); if(thankYou) thankYou.style.display = 'block';
voteStatus('sending'); flushOutbox(true);
});
}
addEventListener('online', () => { if(jget(OUT_KEY, []).length) flushOutbox(!!$('#voteStatus')); });
if(jget(OUT_KEY, []).length) setTimeout(() => flushOutbox(false), 1500 + Math.random() * 3000);
function alreadyVoted(){ return VOTE_CONFIG.oneVotePerUser && userKey && jget(DONE_KEY + userKey, 0) === 1; }