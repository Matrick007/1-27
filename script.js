const tg = window.Telegram?.WebApp || {initDataUnsafe:{},close:()=>{},MainButton:{setText:()=>{},show:()=>{},onClick:()=>{}}};
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const nextButton=$('#nextButton'), submitVotes=$('#submitVotes'), clickSound=$('#clickSound'), transitionSound=$('#transitionSound');
const backgroundMusic=$('#backgroundMusic'), musicModal=$('#musicModal'), musicControl=$('#musicControl');
const musicControlButton=$('#musicControlButton'), musicControlMenu=$('#musicControlMenu'), selectedNominees={};
const nominationOrder=['Самый Ходящий','Главный прогульщик','Номинация победителей','Заводчанин года','Прилежный студент','Машина года','Флешбэк года'];
const TOTAL_NOMS = nominationOrder.length; // 7

/* ============================================================
   ВИДЕО КАНДИДАТОВ — как добавлять
   ------------------------------------------------------------
   1) Лучший способ: прямо на карточке в index.html
      <div class="nominee" data-nominee="Кирилл" data-row="Ходящий"
           data-video="videos/candidates/kirill-hodyashiy.mp4">
      Один и тот же человек в другой номинации — другой data-video:
      <div class="nominee" data-nominee="Кирилл" data-row="Воздухан"
           data-video="videos/candidates/kirill-vozduhan.mp4">

   2) Запасной способ: словарь ниже (candidates).
      Ключ = data-nominee  ИЛИ  "data-nominee|data-row"
      Пример:
        'Кирилл': 'videos/candidates/kirill.mp4',              // общее
        'Кирилл|Ходящий': 'videos/candidates/kirill-h.mp4',    // только в этой номинации
   Приоритет: data-video на карточке > candidates['имя|ряд'] > candidates['имя']
   ============================================================ */
const VIDEO_SETTINGS = {
  intro: 'videos/intro.mp4',
  transitionAfter: {
    'Самый Ходящий': 'videos/2.mp4',
    'Главный прогульщик': 'videos/2.mp4',
    'Номинация победителей': 'videos/2.mp4',
    'Заводчанин года': 'videos/2.mp4',
    'Прилежный студент': 'videos/2.mp4',
    'Машина года': 'videos/2.mp4',
    'Флешбэк года': 'videos/2.mp4'
  },
  outro: 'videos/2.mp4',
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

/** Резолвит путь к видео кандидата с учётом номинации */
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
function changeMusic(src){if(src){backgroundMusic.src=src;backgroundMusic.play().catch(()=>{});}else{backgroundMusic.pause();backgroundMusic.removeAttribute('src');}if(musicModal)musicModal.style.display='none';if(musicControlMenu)musicControlMenu.style.display='none';}
function showNomination(index){currentNominationIndex=index;frames.forEach((f,i)=>{f.classList.toggle('current',i===index);f.classList.toggle('completed',i<index);});const counter=$('#currentStep'),fill=$('#progressFill'),hint=$('#votingHint');if(counter)counter.textContent=String(Math.min(index+1,TOTAL_NOMS)).padStart(2,'0');if(fill)fill.style.width=`${Math.min((index+1)/TOTAL_NOMS*100,100)}%`;if(hint)hint.textContent=`Номинация ${String(index+1).padStart(2,'0')} из ${String(TOTAL_NOMS).padStart(2,'0')} · Открой кандидата, изучи историю и выбери одного.`;const tab=$('#tab3');if(tab)tab.scrollTo({top:0,behavior:'instant'});window.scrollTo({top:0,behavior:'instant'});if(typeof onNominationShown==='function')onNominationShown(index);}
/* ============================================================
   КИНОПОКАЗ — экран ролика между номинациями
   ============================================================ */
let videoDone = null, videoFallbackTimer = null, scLeadTimer = null, scMeta = {};
const scFmt = t => (isFinite(t) && t > 0) ? String((t / 60) | 0).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0') : '00:00';
function ensureVideoOverlay(){
  let overlay = $('#videoInterstitial'); if(overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'videoInterstitial'; overlay.className = 'sc'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
  const ticks = Array.from({length: TOTAL_NOMS}, () => '<i></i>').join('');
  overlay.innerHTML = `
    <div class="sc-beam" aria-hidden="true"></div>
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
function startVoting(){if(typeof alreadyVoted==='function'&&alreadyVoted()){switchTab('tab5');if(thankYou){thankYou.textContent='Ты уже проголосовал. Спасибо!';thankYou.style.display='block';}return;}switchTab('tab3');if(musicControl)musicControl.style.display='block';{const p=typeof loadProgress==='function'?loadProgress():null;if(p){restoreProgress(p);return;}}playInterstitial(VIDEO_SETTINGS.intro,'Добро пожаловать на премию',()=>showNomination(0),{kind:'intro',title:'Добро пожаловать на премию',sub:'Восемь номинаций. Один голос в каждой.'});}
if(menuButton)menuButton.addEventListener('click',()=>{menu.style.display=menu.style.display==='block'?'none':'block';});
$$('.menu-item').forEach(item=>item.addEventListener('click',()=>{infoText.textContent=item.dataset.info==='about'?'Разработчик — Литнарович. Ведущие — Литнарович и Лукин!':'Выбери одного номинанта в каждой категории. После последнего выбора отправь свой голос.';infoPanel.style.display='flex';menu.style.display='none';}));
if(closeInfo)closeInfo.addEventListener('click',()=>infoPanel.style.display='none');
if(nextButton)nextButton.addEventListener('click',()=>{playSound(clickSound);if(musicModal)musicModal.style.display='flex';else startVoting();});
$$('.music-modal .track-option').forEach(option=>option.addEventListener('click',()=>{changeMusic(option.dataset.track);startVoting();}));
if(musicControlButton)musicControlButton.addEventListener('click',()=>{musicControlMenu.style.display=musicControlMenu.style.display==='block'?'none':'block';});
$$('.music-control-menu .track-option').forEach(option=>option.addEventListener('click',()=>changeMusic(option.dataset.track)));
function voteFor(nominee){
  if(transitionBusy || nominee.classList.contains('selected')) return;
  const row = (nominee.dataset.row || '').trim();
  const nomineeName = nominee.dataset.nominee || '';
  selectedNominees[row] = nomineeName;
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
    transitionBusy = false;
    if(nextIndex < frames.length) showNomination(nextIndex);
    else showCompletion();
  };

  // После последней номинации показываем финальный ролик.
  if(nextIndex >= frames.length){
    playInterstitial(VIDEO_SETTINGS.outro, 'Спасибо за участие', continueToNext, {kind:'outro', title:'Спасибо за участие', sub:'Все номинации пройдены. Твой голос засчитан.', choice: nomineeName});
    return;
  }

  const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ');
  const currentTitle = nominationOrder[currentNominationIndex] || row;
  const transitionEntry = Object.entries(VIDEO_SETTINGS.transitionAfter).find(([key]) =>
    normalize(key) === normalize(row) || normalize(key) === normalize(currentTitle)
  );
  // Резервный путь гарантирует показ ролика после каждой промежуточной номинации.
  const transitionSrc = transitionEntry?.[1] || 'videos/2.mp4';
  playInterstitial(transitionSrc, `Следующая номинация · ${nominationOrder[nextIndex] || ''}`, continueToNext, {kind:'next', index:nextIndex, title:nominationOrder[nextIndex] || '', sub:'Следующая номинация', choice: nomineeName});
}

let activeCandidate=null;
const candidateModal=$('#candidateModal'), candidateVideo=$('#candidateVideo');

/* ============================================================
   УНИКАЛЬНЫЕ ДИЗАЙНЫ МОДАЛОК
   База — по номинации (строгий тон).
   Изюминка — по человеку (свой блок, свой акцент).
   ============================================================ */

const NOM_BASE = {
  'Ходящий':   { cls:'th-hody', badge:'ПРИСУТСТВИЕ', kicker:'ХРОНИКА ПОСЕЩАЕМОСТИ', tab1:'Досье', tab2:'Запись', cat:'Самый Ходящий' },
  'Прогульщик':{ cls:'th-progul', badge:'ДЕЛО №', kicker:'ГЛАВНЫЙ ПРОГУЛЬЩИК', tab1:'Версия', tab2:'Алиби', cat:'Главный прогульщик' },
  'Победитель':{ cls:'th-win', badge:'ТИТУЛ', kicker:'НОМИНАЦИЯ ПОБЕДИТЕЛЕЙ', tab1:'Триумф', tab2:'Архив', cat:'Победитель' },
  'Завод':     { cls:'th-zavod', badge:'СМЕНА', kicker:'ЗАВОДЧАНИН ГОДА', tab1:'Бригада', tab2:'Смена', cat:'Заводчанин года' },
  'Прилежный': { cls:'th-prilez', badge:'ХАРАКТЕР', kicker:'ПРИЛЕЖНЫЙ СТУДЕНТ', tab1:'Портрет', tab2:'Фокус', cat:'Прилежный студент' },
  'Машина':    { cls:'th-mash', badge:'ГАРАЖ', kicker:'МАШИНА ГОДА', tab1:'Водитель', tab2:'Гараж', cat:'Машина года' },
  'Флешбэк':   { cls:'th-flash', badge:'ЭПИЗОД', kicker:'ФЛЕШБЭК ГОДА', tab1:'Кадр', tab2:'Реакция', cat:'Флешбэк года' },
  'Канал':     { cls:'th-kanal', badge:'ЭФИР', kicker:'КАНАЛ ГОДА', tab1:'Канал', tab2:'Студия', cat:'Канал года' }
};

/** Уникальные блоки: ключ = data-nominee (или data-nominee|row) */
const PERSON_UX = {
  /* ——— САМЫЙ ХОДЯЩИЙ ——— */
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
  'Самсонов|Ходящий': {
    personCls: 'p-samsonov-h',
    history: () => `
      <div class="ux-card ux-quiet">
        <div class="ux-quiet-line"></div>
        <div class="ux-quiet-body">
          <strong>Фон аудитории</strong>
          <p>Не блистал. Не спорил. Просто был. Как стол преподавателя — незаметен, пока не пропадёт.</p>
        </div>
      </div>`,
    video: () => `<div class="ux-metric"><span>тишина</span><b>как стиль</b></div>`
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
  'Караев|Ходящий': {
    personCls: 'p-karaev-h',
    history: () => `
      <div class="ux-card ux-timeline">
        <div class="ux-tl-item on"><i></i><span>1–2 курс</span><b>всегда</b></div>
        <div class="ux-tl-item gap"><i></i><span>3 курс</span><b>тишина</b></div>
        <div class="ux-tl-item on"><i></i><span>4 курс</span><b>вернулся</b></div>
      </div>
      <p class="ux-caption">Некоторые вещи не нуждаются в объяснении.</p>`,
    video: () => `<div class="ux-quote">Просто снова был здесь.</div>`
  },

  /* ——— ПРОГУЛЬЩИК ——— */
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
  'Берсенев|Прогульщик': {
    personCls: 'p-bersenev-p',
    history: () => `
      <div class="ux-card ux-discovery">
        <div class="ux-year">III КУРС</div>
        <p>Год великих открытий: пары существуют и без него. Преподаватели сомневались в его существовании.</p>
      </div>`,
    video: () => `<div class="ux-note-strict">Меньше пар — больше жизни.</div>`
  },
  'Ролдугин|Прогульщик': {
    personCls: 'p-roldugin-p',
    history: () => `
      <div class="ux-card ux-remote">
        <div class="ux-remote-icon">📡</div>
        <div>
          <strong>Дистанционное присутствие</strong>
          <p>Его нет на паре, но он всегда в курсе. «Я не прогулял — я взял паузу».</p>
        </div>
      </div>`,
    video: () => `<div class="ux-case">Дело №04 · Ролдугин · закрыто спокойствием</div>`
  },

  /* ——— ПОБЕДИТЕЛИ — разрыв ——— */
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

  /* ——— ЗАВОД ——— */
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

  /* ——— ПРИЛЕЖНЫЙ ——— */
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

  /* ——— МАШИНА ——— */
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

  /* ——— ФЛЕШБЭК ——— */
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

  /* ——— КАНАЛ ——— */
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

/* ============================================================
   ТЕМЫ НОМИНАЦИЙ: акценты, глифы, инициализация карточек
   ============================================================ */
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

/* ============================================================
   FIFA-КАРУСЕЛЬ — «Самый Ходящий»
   Кандидат стоит по центру. ПК: наведи — снизу выезжает описание.
   Телефон: тап по кандидату. Свайп / стрелки / точки — листать.
   Кнопки «История» и «Видео» открывают ОТДЕЛЬНЫЕ окна.
   Данные берутся из тех же .nominee в index.html (они скрыты).
   ============================================================ */
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hoverCapable = () => window.matchMedia('(hover:hover) and (pointer:fine)').matches;
const fifaList = [];

/* Скаут-характеристики в духе FIFA: ЯВК явка · РАН ранние приходы · КОН конспекты · УСТ устойчивость · ТЕР терпение · ДИС дисциплина */
const FIFA_SCOUT = {
  'Кирилл':   { pos:'ХОД', interest:'ВЫСОКИЙ',    fields:[['Стаж','4 года'],['Пропуски','~0'],['Контракт','до диплома']],   attrs:[99,96,97,98,99,95] },
  'Самсонов': { pos:'ХОД', interest:'СТАБИЛЬНЫЙ', fields:[['Стаж','4 года'],['Пропуски','почти 0'],['Контракт','по расписанию']], attrs:[97,99,88,96,94,92] },
  'Галкин':   { pos:'ХОД', interest:'РАСТЁТ',     fields:[['Место','у окна'],['Пропуски','события'],['Контракт','кровный']], attrs:[95,90,93,96,98,94] },
  'Караев':   { pos:'ХОД', interest:'НЕИЗВЕСТЕН', fields:[['Стаж','3 года'],['Пропуски','1 курс'],['Контракт','продлён']],  attrs:[78,70,88,62,94,80] }
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
    const rating = Math.round(sc.attrs.reduce((a, b) => a + b, 0) / sc.attrs.length);
    const photo = src
      ? `<img src="${esc(src)}" alt="${esc(full)}" decoding="async" draggable="false">`
      : `<div class="fifa-mono" aria-hidden="true">${esc(initialsOf(full))}</div>`;
    return `<article class="fifa-slide" data-i="${i}" style="--acc:${esc(acc)}">
      <div class="fifa-card" tabindex="0" role="button" aria-label="${esc(full)}">
        <div class="fifa-photo">${photo}</div>
        <div class="fifa-scout">
          <div class="fs-interest"><small>Интерес группы</small><b>${esc(sc.interest)}</b></div>
          <div class="fs-pos">${esc(sc.pos)}</div>
          <div class="fs-name"><i class="fs-emblem" aria-hidden="true"></i><h3>${esc((firstName[0] || '') ? firstName[0] + '. ' : '')}${esc(surname)}</h3></div>
          <div class="fs-rate"><span>◎ ${rating}</span><span>↗</span><span class="fs-no">№ ${pad(i + 1)}</span></div>
          <div class="fs-fields">${sc.fields.map(([l, v]) => `<div><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join('')}</div>
          <div class="fs-attrs">${sc.attrs.map((v, k) => `<div class="${attrTone(v)}"><small>${FIFA_ATTR_LABELS[k]}</small><b>${v}</b><i></i></div>`).join('')}</div>
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
}

/** стрелки клавиатуры листают, пока открыта номинация и нет окна кандидата */
document.addEventListener('keydown', e => {
  if(e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if(candidateModal?.classList.contains('visible') || $('#hodModal.visible') || $('#videoInterstitial.visible')) return;
  const st = fifaList.find(s => s.frame.classList.contains('current'));
  if(st) fifaGo(st, st.i + (e.key === 'ArrowRight' ? 1 : -1));
});

frames.filter(f => f.dataset.fifa).forEach(f => { try{ buildFifa(f); }catch(err){ console.error('buildFifa', err); f.dataset.fb = '1'; } });
const fifaCurrentNominee = () => { const st = fifaList.find(s => s.frame.classList.contains('current')); return st ? st.noms[st.i] : null; };

/* Шапка модалки: свой цвет, узор и глиф на каждого кандидата */
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

/* ============================================================
   ОНБОРДИНГ — строгие подсказки для первого запуска
   ============================================================ */
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

/* ============================================================
   ОКНА КАНДИДАТОВ «САМОГО ХОДЯЩЕГО» — у каждого свой дизайн и наполнение
   openHod(nominee, 'history' | 'video')
   Тексты истории берутся из .nominee-description в index.html,
   всё остальное (цифры, схемы, цитаты) — в объекте HOD ниже.
   ============================================================ */
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
  'Самсонов': {
    key: 'samsonov', kicker: 'Швейцарские часы', tag: 'Человек-невидимка, который всегда на месте',
    stats: [[4, 'года без драм'], [100, '% точность', '%'], [0, 'опозданий']],
    infoTitle: 'Распорядок дня',
    quote: ['«Что задали?» — единственное, о чём он спрашивал, когда всё-таки не приходил.', 'Константин Самсонов'],
    videoTitle: 'Хронометраж', videoNote: 'Ровно столько, сколько нужно.',
    facts: ['Приходит раньше группы — молча и с ровной спиной', 'Тетрадь открыта, ручка наготове', 'Его отсутствие — событие, присутствие — норма'],
    ph: ['⏱️', 'Таймкод 00:00', 'Ролик придёт вовремя. Как и Костя'],
    art: () => `<svg class="s-dial" viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="74" class="s-ring"/><circle cx="80" cy="80" r="66" class="s-ring2"/>
      ${Array.from({length:60}, (_, i) => { const a = i*6*Math.PI/180, big = i%5===0, r1 = big?54:60, r2 = 66; return `<line x1="${80+Math.sin(a)*r1}" y1="${80-Math.cos(a)*r1}" x2="${80+Math.sin(a)*r2}" y2="${80-Math.cos(a)*r2}" class="${big?'s-tk big':'s-tk'}"/>`; }).join('')}
      <line x1="80" y1="80" x2="80" y2="44" class="s-hand h" transform="rotate(255 80 80)"/><line x1="80" y1="80" x2="80" y2="30" class="s-hand m" transform="rotate(180 80 80)"/>
      <g class="s-sec"><line x1="80" y1="92" x2="80" y2="22"/><circle cx="80" cy="80" r="4"/></g></svg>`,
    info: () => `
      <ol class="s-timeline">
        <li><time>08:15</time><div><b>Уже в аудитории</b><span>Садится заранее. Спина ровная.</span></div></li>
        <li><time>08:25</time><div><b>Тетрадь открыта</b><span>Ручка наготове, телефон не нужен.</span></div></li>
        <li><time>08:30</time><div><b>Пара началась</b><span>Не спорит, не блистает, не спит.</span></div></li>
        <li><time>всегда</time><div><b>Просто был</b><span>Как стол преподавателя или доска.</span></div></li>
      </ol>
      <div class="s-meter"><div><span>Стабильность</span><b>100%</b></div><i><u></u></i></div>
      <div class="s-chips"><span>не блистал</span><span>не спорил</span><span>не спал</span><span>был</span></div>`
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
  'Караев': {
    key: 'karaev', kicker: 'Сюжетный поворот', tag: 'Исчез на год. Вернулся как ни в чём не бывало',
    stats: [[2, 'года образцовой явки'], [1, 'год тишины'], [1, 'возвращение']],
    infoTitle: 'Кривая посещаемости',
    quote: ['Некоторые вещи не нуждаются в объяснении. Он просто снова был здесь.', 'Хроника Эльчина'],
    videoTitle: 'Акт III', videoNote: 'Трейлер возвращения.',
    facts: ['Первые два курса — эталон посещаемости', 'Третий курс: пропал с радаров, но числился и сдавал', 'Четвёртый: сел на своё место, будто паузы не было'],
    ph: ['🎬', 'Монтаж Акта III', 'Возвращение уже в производстве'],
    art: () => `<div class="r-film top"></div><div class="r-film bot"></div><div class="r-beam"></div><div class="r-title">Возвращение</div>`,
    info: () => {
      const v = [18, 16, 20, 18, 112, 118, 22, 16], xs = v.map((_, i) => 24 + i * 38);
      const pts = xs.map((x, i) => `${x},${v[i]}`).join(' ');
      const line = xs.map((x, i) => `${i ? 'L' : 'M'}${x},${v[i]}`).join(' ');
      return `
      <svg class="r-chart" viewBox="0 0 310 150" role="img" aria-label="График посещаемости по семестрам">
        <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0b25a" stop-opacity=".45"/><stop offset="1" stop-color="#e0b25a" stop-opacity="0"/></linearGradient></defs>
        <rect x="140" y="6" width="80" height="128" rx="6" class="r-gap"/>
        <path d="${line} L${xs[7]},134 L${xs[0]},134 Z" fill="url(#rg)"/>
        <polyline points="${pts}" class="r-line" pathLength="1"/>
        ${xs.map((x, i) => `<circle cx="${x}" cy="${v[i]}" r="4" class="r-dot${i === 4 || i === 5 ? ' low' : ''}" style="--i:${i}"/>`).join('')}
        <text x="180" y="22" class="r-note" text-anchor="middle">тишина</text>
        ${['1','2','3','4'].map((n, k) => `<text x="${(xs[k*2] + xs[k*2+1]) / 2}" y="148" class="r-ax" text-anchor="middle">${n} курс</text>`).join('')}
      </svg>
      <div class="r-acts">
        <div><em>I</em><b>Образец</b><span>Ходил всегда. Сидел, слушал, записывал.</span></div>
        <div class="dark"><em>II</em><b>Тишина</b><span>Исчез с радаров. Пустое место в аудитории.</span></div>
        <div><em>III</em><b>Возвращение</b><span>Сел на своё место и снова начал ходить.</span></div>
      </div>`;
    }
  }
};

/* ============================================================
   «ГЛАВНЫЙ ПРОГУЛЬЩИК» — стена объявлений «РОЗЫСК» + 4 окна-документа
   ============================================================ */
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
  },
  'Берсенев': {
    key: 'bersenev', kicker: 'Проверка существования', tag: 'Числится в списках. В аудитории — по слухам',
    stats: [[3, 'курс открытий'], [0, 'найдено в аудитории'], [1, 'строка в списке']],
    infoTitle: 'Реестр студентов',
    quote: ['Меньше пар — больше жизни. Он не избегает учёбы, он её оптимизирует.', 'Из показаний очевидцев'],
    videoTitle: 'Камера 04', videoNote: 'Записей с участием объекта не обнаружено.',
    facts: ['Третий курс: оказалось, что пары существуют и без него', 'Преподаватели начали сомневаться в его существовании', 'Одногруппники просто привыкли к загадочному отсутствию'],
    ph: ['📼', 'NO SIGNAL', 'Объект в кадре не обнаружен'],
    art: () => `<pre class="bs-art">&gt; найти "Берсенев"\n  результатов: 0\n  _</pre>`,
    info: () => `
      <div class="bs-term">
        <div class="bs-bar"><i></i><i></i><i></i><span>реестр_студентов</span></div>
        <pre class="bs-out" id="bsOut" aria-live="polite"></pre>
        <button type="button" class="bs-run">Проверить ещё раз</button>
      </div>`,
    after: root => {
      const out = $('#bsOut', root), btn = $('.bs-run', root); let timers = [];
      const lines = [
        ['> найти "Берсенев Илья"', ''],
        ['  списки группы ........... ', 'ok:найден'],
        ['  ведомость ............... ', 'ok:найден (графа «н»)'],
        ['  аудитория 214 ........... ', 'bad:не найден'],
        ['  столовая ................ ', 'bad:не найден'],
        ['  первая пара ............. ', 'bad:не найден'],
        ['  чат группы .............. ', 'warn:1 сообщение за 2 года'],
        ['', ''],
        ['ВЕРДИКТ: числится.', 'verdict'],
        ['Существование не подтверждено.', 'verdict']
      ];
      const run = () => {
        timers.forEach(clearTimeout); timers = []; out.innerHTML = ''; btn.disabled = true;
        lines.forEach(([a, b], i) => timers.push(setTimeout(() => {
          if(!root.isConnected) return;
          const cls = b.includes(':') ? b.split(':')[0] : b, val = b.includes(':') ? b.slice(b.indexOf(':') + 1) : '';
          out.insertAdjacentHTML('beforeend', `<span class="${cls}">${esc(a)}${val ? `<em>${esc(val)}</em>` : ''}</span>\n`);
          if(i === lines.length - 1) btn.disabled = false;
        }, 350 + i * 420)));
      };
      btn?.addEventListener('click', run); run();
    }
  },
  'Ролдугин': {
    key: 'roldugin', kicker: 'Дистанционное присутствие', tag: 'Не прогулял — взял паузу',
    stats: [[100, '% в курсе', '%'], [0, 'визитов в аудиторию'], [1, 'пауза']],
    infoTitle: 'Лекция · онлайн',
    quote: ['«Я не прогулял — я взял паузу».', 'Никита Ролдугин, девиз'],
    videoTitle: 'Эфир', videoNote: 'Камера выключена. Звук — по желанию.',
    facts: ['Знания можно получить и без личного визита', 'Жанр «академического исчезновения» доведён до совершенства', 'Появляется ровно в тот момент, когда это важно'],
    ph: ['📡', 'Соединение установлено', 'Камера выключена. Присутствие — дистанционное'],
    art: () => `<div class="rl-mini"><i></i><i></i><i class="off"></i></div><span class="rl-rec">REC</span>`,
    info: () => `
      <div class="rl-call">
        <div class="rl-top"><span class="rl-live"><i></i>Лекция <time id="rlT">42:17</time></span><span>онлайн</span></div>
        <div class="rl-grid">
          <div class="rl-tile"><b>П</b><span>Преподаватель</span></div>
          <div class="rl-tile"><b>Г</b><span>Группа · 12</span></div>
          <div class="rl-tile off"><b>Н</b><span>Никита · камера выкл.</span><em>🔇</em></div>
          <div class="rl-tile ghost"><b>?</b><span>В курсе событий</span></div>
        </div>
        <div class="rl-bar"><button type="button" class="rl-pause">⏸ Взять паузу</button></div>
        <p class="rl-state" id="rlState">Статус: в курсе событий</p>
      </div>`,
    after: root => {
      const t = $('#rlT', root), st = $('#rlState', root), btn = $('.rl-pause', root); let sec = 42 * 60 + 17, paused = false;
      const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      const id = setInterval(() => { if(!root.isConnected){ clearInterval(id); return; } if(!paused){ sec++; t.textContent = fmt(sec); } }, 1000);
      btn?.addEventListener('click', () => {
        paused = !paused; root.querySelector('.rl-call').classList.toggle('paused', paused);
        btn.textContent = paused ? '▶ Вернуться' : '⏸ Взять паузу';
        st.textContent = paused ? 'Статус: не прогулял — взял паузу' : 'Статус: в курсе событий';
      });
    }
  }
});

/* ---------- стена объявлений ---------- */
const WANTED = {
  'Полякова': { verb: 'ПРОПАЛА', marks: 'Навык отсутствовать — на уровне автомата. Откликается на «Я не приду, но вы держитесь».', seen: 'На линейке 1 сентября. Дальше — тишина.', reward: 'Конспекты за сентябрь', fix: 'tape', stain: 1, note: 'кофе?' },
  'Иванова':  { verb: 'ПРОПАЛА', marks: 'Харизма. Всегда занята чем-то важным. Или [[спит]].', seen: 'Именно тогда, когда это было нужно.', reward: 'Не будить до обеда', fix: 'pin', note: 'не будить!' },
  'Берсенев': { verb: 'ПРОПАЛ',  marks: 'Числится в списках. Преподаватели сомневаются, что [[существует]].', seen: 'Третий курс. [[Мельком]], по слухам.', reward: 'Подтвердить, что существует', fix: 'staple', redact: 1 },
  'Ролдугин': { verb: 'ПРОПАЛ',  marks: 'Всегда в курсе. На связи, но не в аудитории.', seen: 'В чате — всегда. В аудитории — по настроению.', reward: 'Стабильный Wi-Fi', fix: 'tape2', signal: 1 }
};
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
    const gone = (i * 2 + 1) % 6;
    const tabs = Array.from({length: 6}, (_, k) => k === gone ? '<span class="wp-gap"></span>' : '<button type="button" class="wp-tab" tabindex="-1" aria-label="Оторвать листок"><span>Видел(а)? Скажи старосте</span></button>').join('');
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
        <div class="wp-tabs">${tabs}</div>
        <i class="wp-seenstamp">Староста<br>в курсе</i>
      </div></article>`;
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
      e.stopPropagation(); if(tab.classList.contains('torn')) return;
      tab.classList.add('torn'); torn++; if(tornEl) tornEl.textContent = torn;
      const wp = tab.closest('.wp'); if(wp && $$('.wp-tab:not(.torn)', wp).length === 0) wp.classList.add('wp-done');
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

/* ============================================================
   НОМИНАЦИЯ ПОБЕДИТЕЛЕЙ — «Коллекция»: четыре монеты на бархатном планшете
   Окна: дзен-сад · корона из камней · монтажный стол · тир-лист
   ============================================================ */
const TROPHY = {
  'Ролдугин':   { no: '01', cups: [['Самый спокойный', 2024], ['Самый спокойный', 2025]] },
  'Литнарович': { no: '02', cups: [['Тоскик года', 2024], ['Тоскик года', 2025], ['Воздухан года', 2025], ['Канал года', 2025]] },
  'Лукин':      { no: '03', cups: [['Оператор года', 2025], ['Канал года', 2025]] },
  'Сериков':    { no: '04', cups: [['Мем года', 2024], ['Мем года', 2025]] }
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

function buildShowcase(frame){
  const noms = $$('.nominee:not([hidden])', frame);
  if(!noms.length) return;
  const row = noms.map((nom, i) => {
    const full = $('.nominee-front h3', nom)?.textContent.trim() || nom.dataset.nominee;
    const parts = full.split(/\s+/), surname = parts[0], first = parts.slice(1).join(' ');
    const t = TROPHY[nom.dataset.nominee] || { no: String(i + 1).padStart(2, '0'), cups: [] };
    const src = $('.nominee-front img', nom)?.getAttribute('src') || '';
    const n = t.cups.length, titles = [...new Set(t.cups.map(c => c[0]))];
    const fig = (GALA_FIG[GALA_KIND[nom.dataset.nominee]] || GALA_FIG.stones)('gf' + i);
    const medals = t.cups.map(c => `<i title="${esc(c[0])} ${c[1]}">${String(c[1]).slice(2)}</i>`).join('');
    return `<article class="gw" data-i="${i}" style="--i:${i}">
      <button type="button" class="gw-btn" aria-label="Победитель: ${esc(full)}">
        <span class="gw-no">№ ${t.no}</span>
        <i class="gw-spot"></i>
        <span class="gw-fig">${fig}<i class="gw-gl a">✦</i><i class="gw-gl b">✦</i><i class="gw-gl c">✦</i></span>
        <span class="gw-ped">
          <span class="gw-cam">${src ? `<img src="${esc(src)}" alt="" draggable="false" loading="lazy" decoding="async" onerror="this.remove()">` : ''}<em>${esc(initialsOf(full))}</em></span>
          <span class="gw-plq"><b>${esc(surname)}</b><small>${esc(first)}</small></span>
          <span class="gw-med">${medals}</span>
        </span>
        <i class="gw-floor"></i>
      </button>
      <p class="gw-t"><b>${n} ${plural(n, 'титул', 'титула', 'титулов')}</b>${titles.map(esc).join(' · ')}</p>
    </article>`;
  }).join('');
  const bits = Array.from({ length: 20 }, (_, i) => `<i style="left:${(i * 53) % 100}%;--d:${7 + (i * 3) % 6}s;--w:${-(i * .9).toFixed(1)}s;--c:${['#ffd75a', '#fff3b0', '#e0463a', '#f5b6c0', '#9fd8ff'][i % 5]};--dx:${(i % 2 ? 1 : -1) * (12 + i % 4 * 8)}px"></i>`).join('');
  const board = document.createElement('div');
  board.className = 'gala';
  board.innerHTML = `
    <header class="ga-marq"><i class="ga-bulbs t"></i><span class="ga-eye">Церемония вручения</span><b>ПОБЕДИТЕЛИ</b><span class="ga-yrs"><i>★</i>MMXXIV — MMXXV<i>★</i></span><i class="ga-bulbs b"></i></header>
    <div class="ga-stage">
      <i class="ga-valance"></i><i class="ga-curtain l"></i><i class="ga-curtain r"></i>
      <div class="ga-beams" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="ga-rain" aria-hidden="true">${bits}</div>
      <div class="ga-row">${row}</div>
    </div>
    <div class="ga-carpet" aria-hidden="true"><i class="ga-post a"></i><i class="ga-post b"></i><span>красная дорожка</span></div>
    <p class="gala-hint">Нажми на статуэтку — на неё упадёт свет, откроется витрина победителя.</p>`;
  $('.nominee-subblock', frame).before(board);
  const ws = $$('.gw', board), stage = $('.ga-stage', board); let busy = false;
  const show = () => ws.forEach(w => w.classList.add('lit'));
  if('IntersectionObserver' in window){ const io = new IntersectionObserver(es => { if(es.some(e => e.isIntersecting)){ show(); io.disconnect(); } }, { threshold: .15 }); io.observe(stage); }
  setTimeout(show, 4500);
  board.addEventListener('click', e => {
    const w = e.target.closest('.gw'); if(!w || busy) return; busy = true;
    ws.forEach(x => { x.classList.toggle('on', x === w); x.classList.toggle('dim', x !== w); });
    stage.classList.add('spot');
    const r = $('.gw-fig', w).getBoundingClientRect(), s = stage.getBoundingClientRect();
    galaBurst(stage, r.left - s.left + r.width / 2, r.top - s.top + r.height / 2);
    tink([523, 659, 784, 1047]); try{ navigator.vibrate?.([14, 30, 14]); }catch(_){}
    setTimeout(() => { openCandidate(noms[+w.dataset.i], 'history'); }, 850);
    setTimeout(() => { ws.forEach(x => x.classList.remove('on', 'dim')); stage.classList.remove('spot'); busy = false; }, 2200);
  });
}

const HOD_WIN = {
  /* ——— РОЛДУГИН · дзен-сад ——— */
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

  /* ——— ЛИТНАРОВИЧ · корона из четырёх камней ——— */
  'Литнарович|Победитель': {
    key: 'litg', kicker: 'Коронация', tag: 'Четыре титула. Одна корона',
    stats: [[4, 'титула'], [2, 'года «Тоскик»'], [3, 'номинации за 2025']],
    infoTitle: 'Собери корону',
    quote: ['«Только настоящий король превратит тоску в стиль, воздух — в атмосферу, а канал — в легенду».', 'Из протокола жюри'],
    videoTitle: 'Коронация', videoNote: 'Корону ещё доделывают.',
    facts: ['Тоскик года — 2024, и снова 2025', 'Воздухан года — 2025, потому что воздух тоже надо уметь', 'Канал года — 2025. Последний камень встал на место'],
    ph: ['👑', 'Мастера работают', 'Видео сдадут к финальной церемонии'],
    art: () => `<svg class="lg-crown" viewBox="0 0 80 56" aria-hidden="true"><path d="M6 46 0 12l22 18L40 2l18 28 22-18-6 34z"/><rect x="6" y="48" width="68" height="6" rx="2"/></svg><i class="lg-ray a"></i><i class="lg-ray b"></i>`,
    info: () => `
      <div class="lg-stage" id="lgStage">
        <svg class="lg-big" viewBox="0 0 200 130" aria-hidden="true"><defs><linearGradient id="lgG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e3a3"/><stop offset=".5" stop-color="#c79a45"/><stop offset="1" stop-color="#7a5620"/></linearGradient></defs>
          <path d="M14 108 4 34l44 36 52-62 52 62 44-36-10 74z" fill="url(#lgG)" stroke="#5b4118" stroke-width="1.4"/><rect x="14" y="108" width="172" height="14" rx="3" fill="url(#lgG)" stroke="#5b4118" stroke-width="1.4"/>
          <circle cx="4" cy="34" r="6" fill="url(#lgG)"/><circle cx="100" cy="8" r="7" fill="url(#lgG)"/><circle cx="196" cy="34" r="6" fill="url(#lgG)"/></svg>
        <i class="lg-sock s1"></i><i class="lg-sock s2"></i><i class="lg-sock s3"></i><i class="lg-sock s4"></i>
        <div class="lg-glow"></div>
      </div>
      <div class="lg-gems">
        ${[['Тоскик года', 2024, 'rub'], ['Тоскик года', 2025, 'sap'], ['Воздухан года', 2025, 'eme'], ['Канал года', 2025, 'top']].map(([n, y, c], i) => `<button type="button" class="lg-gem ${c}" data-i="${i}" aria-label="Вставить камень: ${n} ${y}"><i></i><b>${n}</b><small>${roman(y)}</small></button>`).join('')}
      </div>
      <div class="lg-royal" aria-live="polite"><b>Корона собрана</b><span>Четыре титула. Один король.</span></div>
      <button type="button" class="lg-auto">Собрать автоматически</button>`,
    after: root => {
      const gems = $$('.lg-gem', root), socks = $$('.lg-sock', root), stage = $('#lgStage', root), royal = $('.lg-royal', root);
      const check = () => { const all = gems.every(g => g.classList.contains('set')); stage.classList.toggle('done', all); royal.classList.toggle('on', all); if(all){ tink([1047, 1568, 2093]); try{ navigator.vibrate?.([16, 50, 16]); }catch(_){} } };
      const toggle = g => { const i = +g.dataset.i; g.classList.toggle('set'); socks[i].classList.toggle('on', g.classList.contains('set')); tink([1760 + i * 220]); check(); };
      gems.forEach(g => g.addEventListener('click', () => toggle(g)));
      $('.lg-auto', root).addEventListener('click', () => {
        gems.forEach((g, i) => { g.classList.remove('set'); socks[i].classList.remove('on'); }); stage.classList.remove('done'); royal.classList.remove('on');
        gems.forEach((g, i) => setTimeout(() => { if(g.isConnected) toggle(g); }, 350 + i * 420));
      });
    }
  },

  /* ——— ЛУКИН · монтажный стол ——— */
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

  /* ——— СЕРИКОВ · тир-лист ——— */
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
frames.filter(f => f.dataset.trophy).forEach(f => { try{ buildShowcase(f); }catch(err){ console.error('buildShowcase', err); f.dataset.fb = '1'; } });


/* ============================================================
   ЗАВОДЧАНИН ГОДА — «Проходная»: пропуска бригад на перфорированном щите
   Окна: чертёж · конвейер · доска почёта · пульт управления
   ============================================================ */
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
  'Голиков Матвей и Сериков Александр': {
    key: 'zcv', no: '02', title: 'Конвейер', kicker: 'Линия № 02', tag: 'Один грузит — другой уже отгружает', voteName: 'Голиков и Сериков',
    stats: [[24, 'часа на ходу'], [0, 'остановок линии'], [1000, 'деталей за смену', '+']],
    infoTitle: 'Лента в работе',
    story: ['Пока один грузит, второй уже отгружает. Лента не останавливается, очередь не копится, а то, что сходит с их линии, сразу годное.', 'Голиков встречает деталь на входе, Сериков провожает на выходе — и между ними нет ни простоя, ни перекура, ни лишних слов. Мастер смены говорит, что такой слаженности он не видел с момента запуска цеха.'],
    quote: ['«Если лента идёт — значит, эти двое на месте».', 'Мастер смены'],
    videoTitle: 'Смена без простоев', videoNote: 'Ролик ещё едет по ленте.',
    facts: ['Загрузка и отгрузка синхронны до секунды', 'За смену — тысячи деталей и ни одного брака', 'Лента останавливается только на обед. Иногда'],
    ph: ['📦', 'Коробка в пути', 'Видео доедет по ленте'],
    art: () => `<i class="cv-hz"></i><div class="cv-mini"><i></i><i></i><i></i></div><div class="cv-sign">ЛИНИЯ № 2</div>`,
    info: () => `
      <div class="cv-line" id="cvLine" style="--spd:3.2s">
        <div class="cv-top"><span>▲ Загрузка · <b>Голиков</b></span><span>Отгрузка · <b>Сериков</b> ▼</span></div>
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
  'Лукин Александр и Чертовских Андрей': {
    key: 'zhb', no: '03', title: 'Доска почёта', kicker: 'Доска почёта', tag: 'Пятилетку — за три года', voteName: 'Лукин и Чертовских',
    stats: [[3, 'года вместо пяти'], [120, '% плана', '%'], ['★', 'ударный труд']],
    infoTitle: 'Выполнение плана',
    story: ['Пятилетний план они закрыли за три года — и ещё остались силы на субботник. Цеховая стенгазета называет их «эталоном трудового ритма», а профком давно потерял счёт благодарностям.', 'Лукин задаёт темп, Чертовских держит качество. Вместе — стабильные сто двадцать процентов и вымпел цеха, который висит у них на стене уже третий месяц.'],
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
        <div class="hb-medal" id="hbMedal"><svg viewBox="0 0 100 130" aria-hidden="true"><path d="M30 0h40l-6 44H36z" fill="#b3261e"/><path d="M42 0h16l-3 44H45z" fill="#efe3c7" opacity=".8"/><circle cx="50" cy="84" r="38" fill="#d4a84b" stroke="#7a5620" stroke-width="3"/><circle cx="50" cy="84" r="30" fill="none" stroke="#7a5620" stroke-width="1.5"/><path d="M50 58l7 17 18 1-14 12 5 18-16-10-16 10 5-18-14-12 18-1z" fill="#b3261e"/></svg><div><b>Ударники труда</b><span>Лукин · Чертовских</span></div></div>
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
  board.innerHTML = `
    <header class="zh"><div class="zh-gears">${gearSvg(14, 'a')}${gearSvg(9, 'b')}${gearSvg(11, 'c')}</div>
      <div class="zh-top"><span class="zh-plate">ГОСТ 27-2027 · ПРОХОДНАЯ</span></div>
      <div class="zh-reader"><i class="zh-l"></i><b id="zhMsg">Приложите пропуск</b></div>
      <div class="zh-gauges">${gaugeSvg('план', 100)}${gaugeSvg('темп', 82)}${gaugeSvg('перекур', 9)}</div>
      <div class="zh-tick"><span>СМЕНА 1 ✦ БРИГАД: ${noms.length} ✦ ПЛАН: 100% ✦ ПРОГУЛОВ: 0 ✦ ЛИНИЯ ЗАПУЩЕНА ✦ СМЕНА 1 ✦ БРИГАД: ${noms.length} ✦ ПЛАН: 100% ✦ ПРОГУЛОВ: 0 ✦ ЛИНИЯ ЗАПУЩЕНА ✦</span></div>
    </header>
    <div class="zb-board">${badges}</div>
    <div class="zv-belt" aria-hidden="true"><i></i><i></i><i></i></div>
    <p class="zavod-hint">Приложи пропуск к считывателю — откроется дело бригады.</p>`;
  $('.nominee-subblock', frame).before(board);
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

/* ============================================================
   МАШИНЫ — детальные SVG-профили (вид сбоку, нос вправо)
   Polo седан · Lada Granta (седан) · ВАЗ-2112 (хэтчбек)
   carSvg(key, {id, reflect, lights})
   ============================================================ */
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

/* ---------- описания моделей ---------- */
const CAR_MODELS = {
  /* ───────────── Volkswagen Polo, седан ───────────── */
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
  /* ───────────── Lada Granta, седан ───────────── */
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
  /* ───────────── ВАЗ-2112, хэтчбек ───────────── */
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

/* ============================================================
   МАШИНА ГОДА — «Гараж»: четыре бокса, приборная панель, реалистичные профили
   Окна: конфигуратор · ночная трасса · техосмотр · тюнинг-стенд
   ============================================================ */
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
    chips: ['1.6 · 105 л.с.', 'АКПП', 'серебристый'], paint: '#aeb5bd',
    stats: [[105, 'л.с. под капотом'], [0, 'опозданий на пары'], [100, '% аккуратной парковки', '%']],
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
    chips: ['1.6 · 87 л.с.', 'МКПП', 'бело-серый'], paint: '#d6d9dc', wheel: 'steel',
    stats: [[98, 'л.с. честных'], [7, 'л на сотню — по паспорту'], [0, 'царапин, если верить владельцу']],
    infoTitle: 'Техосмотр',
    story: ['Бело-серая Гранта не любит пыль и мойку одновременно: после дождя она выглядит так, будто её давно не мыли, а после мойки — будто её только что сфотографировали для каталога. Цвет с характером: не белый, не серый, а «как утро после снегопада».',
      'Машина неприхотливая и честная: расход как заявлено, шум как заявлено, гордость владельца — сверх заявленного. Штампованные диски с колпаками — классика, к которой не придраться ни одному инспектору.',
      'Фролов проходит техосмотр с первого раза, без очереди и без нервов: узлы на месте, фары светят, а лишнего в машине нет. Кроме термоса.'],
    quote: ['«Белая, серая, зато — моя».', 'Надпись на пыльном заднем стекле'],
    videoTitle: 'Утренний выезд', videoNote: 'Ролик ещё прогревается.',
    facts: ['Техосмотр — с первого раза', 'Штампованные диски, классика', 'В салоне только термос'],
    ph: ['❄️', 'Утро после снегопада', 'Ролик отъедет, как только прогреется'],
    art: () => carSvg('granta', { color: '#d6d9dc', wheel: CAR_WHEELS.steel, label: 'Lada Granta бело-серая' }),
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
      car.innerHTML = carSvg('granta', { color: '#d6d9dc', wheel: CAR_WHEELS.steel, label: 'Lada Granta бело-серая' });
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
    chips: ['1.6 · 94 л.с.', 'МКПП', 'зелёно-серый'], paint: '#6d7b6a', wheel: 'turb',
    stats: [[94, 'л.с. + 3 на тюнинг'], [16, 'дюймов литья'], [200, '% уважения во дворе', '%']],
    infoTitle: 'Тюнинг-стенд',
    story: ['ВАЗ-2112 цвета «болотный металлик» — зелёная с серым отливом, как июльский пруд на закате. Машина-легенда: на ней слушали музыку, возили друзей, чинили её во дворе в любую погоду. Это не просто автомобиль — это место, куда стремятся записаться пассажиры.',
      'Колёса — литьё, звук — прямоток, спойлер — «как у соседа, но выше». Константин знает про свою двенашку всё: где стучит, где поёт и в какой момент надо сказать ей пару ласковых.',
      'Она давно стала частью двора: если во дворе нет зелёной двенашки, значит, что-то не так — скорее всего, Константин уехал.'],
    quote: ['«Двенашка — это не машина, это диагноз с кузовом».', 'Гаражное общество'],
    videoTitle: 'Двор в 22:00', videoNote: 'Ролик ещё стоит с открытым капотом.',
    facts: ['Прямоток слышно за два квартала', 'Музыка играет раньше, чем заведён двигатель', 'Без неё во дворе тихо — а это тревожно'],
    ph: ['🔧', 'Двор, вечер', 'Ролик в гараже, зашли на минуту'],
    art: () => carSvg('vaz2112', { color: '#6d7b6a', wheel: CAR_WHEELS.turb, label: 'ВАЗ-2112 зелёно-серая' }),
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
      const draw = () => { car.innerHTML = carSvg('vaz2112', { color: '#6d7b6a', wheel: st.has('rim') ? CAR_WHEELS.dark : CAR_WHEELS.turb, lower: st.has('low') ? 7 : 0, tint: st.has('tint'), spoiler: st.has('spl'), label: 'ВАЗ-2112 зелёно-серая' }); car.classList.toggle('exh', st.has('exh')); glow.classList.toggle('on', st.has('glow')); };
      const calc = () => { let hp = 94, p = 0; $$('.gt-mod', root).forEach(b => { if(st.has(b.dataset.k)){ hp += +b.dataset.hp; p += +b.dataset.p; } }); hpE.textContent = hp; rub.textContent = p.toLocaleString('ru-RU'); rep.style.width = Math.min(100, 20 + st.size * 16) + '%'; };
      $('#gtMods', root).addEventListener('click', e => {
        const b = e.target.closest('.gt-mod'); if(!b) return; const k = b.dataset.k, on = !st.has(k); on ? st.add(k) : st.delete(k);
        b.setAttribute('aria-pressed', on); b.classList.toggle('on', on); draw(); calc(); if(k === 'exh' && on) gEngine('v'); else tink([on ? 784 : 392]);
      });
      draw(); calc();
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
    s.classList.add('start'); gEngine(z.car === 'polo' ? 'polo' : z.car === 'vaz2112' ? 'v' : 'granta'); try{ navigator.vibrate?.([30, 40, 50]); }catch(_){}
    $('.car-svg', s)?.classList.add('on');
    setTimeout(() => { openCandidate(noms[i], 'history'); }, 900);
    setTimeout(() => { s.classList.remove('start'); $('.car-svg', s)?.classList.remove('on'); busy = false; }, 2200);
  });
}
frames.filter(f => f.dataset.garage).forEach(f => { try{ buildGarage(f); }catch(err){ console.error('buildGarage', err); f.dataset.fb = '1'; } });

/* ============================================================
   ПРИЛЕЖНЫЙ СТУДЕНТ — «Читальный зал»: четыре книги на столе под лампой
   Окна: зачётная книжка · конспект · читательский формуляр · сессия
   ============================================================ */
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
    key: 'sak', no: '02', book: 'kn', cover: 'КОНСПЕКТ', sub: 'общая тетрадь · 96 листов', title: 'Конспект', kicker: 'Лекция № 14', tag: 'Ничто не выведет из равновесия', voteName: 'Алиев Александр',
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
  'Караев Эльчин': {
    key: 'skf', no: '03', book: 'fm', cover: 'ЧИТАТЕЛЬСКИЙ ФОРМУЛЯР', sub: 'абонемент · читальный зал', title: 'Формуляр', kicker: 'Абонемент № 3', tag: 'Дзен в человеческом обличии', voteName: 'Караев Эльчин',
    stats: [[312, 'книги прочитано'], [0, 'просроченных возвратов'], [24, 'часа в читалке — рекорд']],
    infoTitle: 'Картотека',
    story: ['В читальном зале есть один человек, при котором библиотекарь перестаёт шептать. Эльчин входит бесшумно, берёт книгу с нужной полки с первого раза и садится у окна — так, будто это место ждало его всё утро.',
      'Он читает не быстро и не медленно, а ровно настолько, чтобы мысль успела дойти до конца. Формуляр у него — как летопись: каждая запись аккуратно датирована, каждая книга возвращена в срок, а иногда — на день раньше, «чтобы не задерживать других».',
      'Бывает, что в зале шумно, но вокруг Караева всегда образуется круг тишины. Читатели соседних столов признаются: рядом с ним даже конспекты пишутся тише. Настоящий дзен — и нет, это не метафора.'],
    quote: ['«Хорошая книга не торопит. И читатель тоже».', 'Запись в книге отзывов читального зала'],
    videoTitle: 'Тишина в читальном зале', videoNote: 'Ролик ещё лежит на выдаче.',
    facts: ['312 книг и ни одной просроченной', 'Возвращает на день раньше — чтобы другим хватило', 'Вокруг него в зале образуется круг тишины'],
    ph: ['📚', 'Читальный зал', 'Видео выдадут на абонементе'],
    art: () => `<div class="sf-lampbeam"></div><i class="sf-brass a"></i><i class="sf-brass b"></i><div class="sf-label">К</div>`,
    info: () => `
      <div class="fm" id="fm">
        <div class="fm-drawer"><span class="fm-lab">К · Караев Э.</span><i class="fm-knob"></i></div>
        <div class="fm-deck" id="fmDeck"></div>
        <div class="fm-nav"><button type="button" id="fmPrev" aria-label="Предыдущая карточка">‹</button><span id="fmNo">1 / 5</span><button type="button" id="fmNext" aria-label="Следующая карточка">›</button></div>
      </div>`,
    after: root => {
      const cards = [
        ['Толстой Л. Н.', '«Война и мир». Том 1–4', '03.09', '04.09', 'прочитано за сутки', 'Оставлена закладка и записка «Отличная книга. Верните тому, кто любит долгие вечера».'],
        ['Булгаков М. А.', '«Мастер и Маргарита»', '11.10', '12.10', 'сдано досрочно', 'Библиотекарь: «Ни одного пятна, ни одной загнутой страницы».'],
        ['Кнут Д.', '«Искусство программирования»', '01.11', '30.11', 'в срок', 'Прочитано целиком, включая упражнения. Читатель вернулся за следующим томом.'],
        ['Чехов А. П.', '«Каштанка». Рассказы', '15.12', '15.12', 'за один присест', 'Возвращено в тот же день. Читатель: «Очень по-человечески».'],
        ['Без автора', 'Учебник, который никто не открывал', '20.01', '21.01', 'прочитан и разобран', 'Выдан как «на всякий случай». Возвращён с пометками на полях и аккуратными закладками.']
      ];
      const deck = $('#fmDeck', root), no = $('#fmNo', root); let i = 0;
      const mk = (c, k) => `<article class="fm-card" data-k="${k}"><div class="fm-top"><span>№ ${String(4120 + k * 7)}</span><span>ЧИТАТЕЛЬ: КАРАЕВ Э.</span></div><dl><dt>Автор</dt><dd>${c[0]}</dd><dt>Название</dt><dd>${c[1]}</dd></dl><div class="fm-dates"><div><small>выдано</small><b>${c[2]}</b></div><div><small>возвращено</small><b>${c[3]}</b></div></div><p class="fm-note">${c[5]}</p><div class="fm-stamp">${c[4]}</div></article>`;
      const render = (dir = 0) => {
        deck.innerHTML = [0, 1, 2].map(o => { const k = (i + 2 - o) % cards.length; return mk(cards[k], k).replace('class="fm-card"', `class="fm-card z${2 - o}"`); }).join('');
        const top = $('.fm-card.z2', deck); if(top && dir){ top.classList.add(dir > 0 ? 'in-r' : 'in-l'); }
        no.textContent = (i + 1) + ' / ' + cards.length;
      };
      const go = d => { i = (i + d + cards.length) % cards.length; render(d); try{ tink([d > 0 ? 440 : 392]); }catch(_){} };
      $('#fmNext', root).addEventListener('click', () => go(1)); $('#fmPrev', root).addEventListener('click', () => go(-1));
      let sx = 0; deck.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true }); deck.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx; if(Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); });
      render();
    }
  },
  'Фролов Андрей': {
    key: 'ssc', no: '04', book: 'ss', cover: 'СЕССИЯ', sub: 'ежедневник · зима 2027', title: 'Сессия', kicker: 'Зимняя сессия', tag: 'Мир и покой', voteName: 'Фролов Андрей',
    stats: [[4, 'экзамена — автоматом'], [7, 'дней до последнего зачёта'], [0, 'ночей без сна']],
    infoTitle: 'Календарь сессии',
    story: ['Когда у остальных начинается сессия, у Андрея начинается «зимний режим»: чай, плед и тихий вечер с конспектами. Он давно понял главный секрет — сессию нужно сдавать до того, как она началась. Поэтому к её открытию у него уже стоит «автомат» по половине предметов.',
      'В расписании у него всё расписано по часам: подготовка, отдых, прогулка. Даже паника у него по расписанию — и в график она не попала, поэтому её нет. Однокурсники пытались повторить его систему, но ломались на пункте «лечь спать в 23:00».',
      'Сдаёт Андрей так, как другие пьют чай: без нервов и с удовольствием. Говорят, преподаватель на последнем экзамене сам встал и пожал ему руку — «за мир и покой во всём потоке».'],
    quote: ['«Спокойная сессия — это когда ты сдал её ещё осенью».', 'Из личного плана на зиму'],
    videoTitle: 'Сессия без паники', videoNote: 'Ролик ещё в режиме «автомат».',
    facts: ['Три экзамена из четырёх закрыты автоматом', 'Паника в расписание не вошла', 'Спать ложится по плану — в 23:00'],
    ph: ['🌙', 'Тихий вечер перед экзаменом', 'Видео выйдет после «автомата»'],
    art: () => `<i class="ss-moon"></i><i class="ss-star a"></i><i class="ss-star b"></i><i class="ss-star c"></i><i class="ss-star d"></i><i class="ss-glow"></i>`,
    info: () => `
      <div class="ss" id="ss">
        <div class="ss-head"><b>Январь 2027</b><span>сессия</span></div>
        <div class="ss-cal" id="ssCal"></div>
        <div class="ss-note" id="ssNote"><small>Выбери день с отметкой</small><b>Нажми на экзамен</b><p>Закрой все четыре — и спокойная сессия считается состоявшейся.</p></div>
        <div class="ss-prog"><svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="25" class="bg"/><circle cx="30" cy="30" r="25" class="fg" id="ssRing" pathLength="100"/></svg><div><b id="ssN">0 / 4</b><small id="ssMsg">сессия идёт</small></div></div>
      </div>`,
    after: root => {
      const exams = { 12: ['Математика', 'Автомат. Преподаватель сам встал и пожал руку.'], 15: ['История', 'Автомат. «Вы и так всё знаете».'], 20: ['Физика', 'Сдано досрочно. Задачи решены ещё в ноябре.'], 26: ['Философия', 'Сдано. В ведомости: «Мир и покой».'] };
      const cal = $('#ssCal', root), note = $('#ssNote', root), ring = $('#ssRing', root), n = $('#ssN', root), msg = $('#ssMsg', root), done = new Set();
      const first = (new Date(2027, 0, 1).getDay() + 6) % 7; // Пн = 0
      let h = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => `<i class="ss-d">${d}</i>`).join('');
      for(let k = 0; k < first; k++) h += '<i></i>';
      for(let d = 1; d <= 31; d++) h += exams[d] ? `<button type="button" class="ss-ex" data-d="${d}"><b>${d}</b><small>${exams[d][0].slice(0, 4)}.</small></button>` : `<span class="ss-day${(first + d - 1) % 7 > 4 ? ' we' : ''}">${d}</span>`;
      cal.innerHTML = h;
      const upd = () => { ring.style.strokeDashoffset = 100 - done.size * 25; n.textContent = done.size + ' / 4'; msg.textContent = done.size === 4 ? 'сессия закрыта · можно спать' : 'сессия идёт'; $('.ss-prog', root).classList.toggle('all', done.size === 4); };
      cal.addEventListener('click', e => {
        const b = e.target.closest('.ss-ex'); if(!b) return; const d = +b.dataset.d; done.add(d); b.classList.add('done');
        note.innerHTML = `<small>${d} января · ${exams[d][0]}</small><b>Автомат ✓</b><p>${exams[d][1]}</p>`; note.classList.remove('pop'); void note.offsetWidth; note.classList.add('pop');
        upd(); try{ tink(done.size === 4 ? [523, 784, 1047] : [740]); navigator.vibrate?.(14); }catch(_){}
      });
      upd();
    }
  }
};
Object.assign(HOD, Object.fromEntries(Object.entries(STUDENT).map(([k, v]) => [k + '|Прилежный', v])));

const SBOOK_COL = { zk: ['#7a1523', '#4a0a14'], kn: ['#25409a', '#142560'], fm: ['#1f5a40', '#0e3324'], ss: ['#1b1d24', '#0a0b0f'] };
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

/* ============================================================
   ФЛЕШБЭК ГОДА — «Видеопрокат»: ЭЛТ-телевизор, видеомагнитофон и четыре VHS-кассеты
   Лучшие моменты за 4 года. Окна: жалюзи · парта · красная дорожка · канал «завозы»
   ============================================================ */
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
  }
};
Object.assign(HOD, Object.fromEntries(Object.entries(FLASH).map(([k, v]) => [k + '|Флешбэк', v])));

function buildFlash(frame){
  const noms = $$('.nominee:not([hidden])', frame);
  if(!noms.length) return;
  const tapes = noms.map((nom, i) => {
    const full = $('.nominee-front h3', nom)?.textContent.trim() || nom.dataset.nominee;
    const z = FLASH[nom.dataset.nominee] || { no: String(i + 1).padStart(2, '0'), label: 'КАДР', title: '', moment: '', season: '', col: '#ffd24a', tag: '' };
    const src = $('.nominee-front img', nom)?.getAttribute('src') || '';
    const parts = full.split(/\s+/), ini = parts.map(s => s[0] || '').join('');
    return `<article class="vt" data-i="${i}" style="--i:${i};--c:${z.col};--r:${[-1.8, 1.4, 1.2, -1.5][i % 4]}deg">
      <button type="button" class="vt-btn" aria-label="${esc(z.moment)}: ${esc(full)}">
        <span class="vt-case">
          <i class="vt-screw a"></i><i class="vt-screw b"></i><i class="vt-screw c"></i><i class="vt-screw d"></i>
          <span class="vt-win"><i class="vt-reel l"></i><i class="vt-reel r"></i><i class="vt-tape"></i></span>
          <span class="vt-lab">
            <span class="vt-stripe"><b>VHS</b><small>${esc(z.season)} · кадр ${z.no}</small></span>
            <span class="vt-ph"><span class="vt-ring">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.remove()">` : ''}<i>${esc(ini)}</i></span></span>
            <span class="vt-ti">${esc(z.label)}</span>
            <span class="vt-nm">${esc(parts[0])}<small>${esc(parts.slice(1).join(' '))}</small></span>
          </span>
          <span class="vt-bar"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
        </span>
      </button>
      <p class="vt-cap"><b>${esc(z.moment)}</b>${esc(z.tag)}</p>
    </article>`;
  }).join('');
  const board = document.createElement('div');
  board.className = 'flash';
  board.innerHTML = `
    <div class="fx-tv" id="fxTv">
      <div class="fx-crt"><div class="fx-scr">
        <i class="fx-snow"></i><i class="fx-roll"></i><i class="fx-scan"></i><i class="fx-vig"></i>
        <div class="fx-osd"><span class="fx-play"><i></i>PLAY</span><span class="fx-ch">AV 1</span></div>
        <div class="fx-title"><small>лучшие моменты</small><b>ФЛЕШБЭК</b><em>за 4 года</em></div>
        <div class="fx-tc"><span id="fxTc">00:00:00</span><span class="fx-sp">SP</span></div>
        <div class="fx-msg" id="fxMsg">ВСТАВЬ КАССЕТУ</div>
      </div></div>
      <div class="fx-ctl"><span class="fx-led"></span><span class="fx-slot" id="fxSlot"><i></i></span><span class="fx-knobs"><i></i><i></i></span></div>
    </div>
    <div class="fx-shelf"><div class="fx-tapes">${tapes}</div><i class="fx-plank"></i></div>
    <p class="flash-hint">Вставь кассету в видеомагнитофон — и перемотай на нужный момент.</p>`;
  $('.nominee-subblock', frame).before(board);
  const els = $$('.vt', board), tc = $('#fxTc', board), msg = $('#fxMsg', board), tv = $('#fxTv', board), slot = $('#fxSlot', board);
  let busy = false, sec = 0;
  const pad = n => String(n).padStart(2, '0');
  setInterval(() => { if(!board.isConnected) return; sec = (sec + 1) % 86400; tc.textContent = `${pad((sec / 3600) | 0)}:${pad(((sec % 3600) / 60) | 0)}:${pad(sec % 60)}`; }, 1000);
  const show = () => els.forEach(b => b.classList.add('in'));
  if('IntersectionObserver' in window){ const io = new IntersectionObserver(es => { if(es.some(e => e.isIntersecting)){ show(); io.disconnect(); } }, { threshold: .08 }); io.observe(board); }
  setTimeout(show, 4000);
  board.addEventListener('click', e => {
    const b = e.target.closest('.vt'); if(!b || busy) return; busy = true;
    const z = FLASH[noms[+b.dataset.i].dataset.nominee] || {};
    b.classList.add('ins'); tv.style.setProperty('--tc', z.col || '#ffd24a'); tv.classList.add('load'); slot.classList.add('in');
    msg.textContent = 'ЗАГРУЗКА…'; try{ tink([196, 165]); fxNoise(.22, 400, .35, 'lowpass'); navigator.vibrate?.(14); }catch(_){}
    setTimeout(() => { msg.textContent = '▶ ' + (z.label || 'КАДР') + ' · ' + (z.season || ''); tv.classList.add('glitch'); fxNoise(.25, 3000, .3); }, 520);
    setTimeout(() => { openCandidate(noms[+b.dataset.i], 'history'); }, 900);
    setTimeout(() => { b.classList.remove('ins'); tv.classList.remove('load', 'glitch'); slot.classList.remove('in'); msg.textContent = 'ВСТАВЬ КАССЕТУ'; busy = false; }, 1700);
  });
}
frames.filter(f => f.dataset.flash).forEach(f => { try{ buildFlash(f); }catch(err){ console.error('buildFlash', err); f.dataset.fb = '1'; } });

let hodActive = null, hodPane = 'history', hodVoting = false;
const hodEl = (() => {
  const el = document.createElement('section');
  el.className = 'hm'; el.id = 'hodModal'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="hm-dialog" role="dialog" aria-modal="true"><button type="button" class="hm-close" aria-label="Закрыть">×</button><div class="hm-scroll"></div><div class="hm-actions"></div></div>';
  document.body.appendChild(el);
  return el;
})();
const hodDialog = $('.hm-dialog', hodEl), hodScroll = $('.hm-scroll', hodEl), hodActions = $('.hm-actions', hodEl);

function hodData(nominee){
  const name = (nominee.dataset.nominee || '').trim();
  const full = $('.nominee-front h3', nominee)?.textContent.trim() || name;
  const parts = full.split(/\s+/);
  const row = (nominee.dataset.row || '').trim();
  const base = HOD[name + '|' + row] || HOD[name] || HOD[parts[0]] || {
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
  return `${hodHero(d)}<div class="hm-body">
    <div class="hm-stats">${d.stats.map(([v, l, suf], i) => `<div class="hm-stat" style="--d:${i}">${typeof v === 'number' ? `<b data-to="${v}" data-suf="${esc(suf || '')}">0${esc(suf || '')}</b>` : `<b>${esc(v)}</b>`}<span>${esc(l)}</span></div>`).join('')}</div>
    <section class="hm-block"><h3>${esc(d.infoTitle)}</h3>${d.info()}</section>
    <section class="hm-block hm-story"><h3>Полная история</h3>${d.story.map(p => `<p>${esc(p)}</p>`).join('')}</section>
    <blockquote class="hm-quote"><p>${esc(d.quote[0])}</p><cite>${esc(d.quote[1])}</cite></blockquote></div>`;
}

function hodVideo(d, src){
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

/* ============================================================
   НАДЁЖНОСТЬ: сохранение прогресса, очередь отправки голоса,
   повторы с паузами, защита от двойного голоса.
   ============================================================ */
const VOTE_CONFIG = {
  // Если поднимете свой прокси (см. worker/vote-worker.js) — впишите сюда его адрес.
  // Тогда голоса пойдут на него, а токен бота можно убрать из клиента.
  endpoint: '',
  botToken: '7896921651:AAHvSknX1BImERrKpfk_gAsG6fissqVcrfc',
  chatId: '-1002626436094',
  oneVotePerUser: true
};
const PROG_KEY = 'premia2027_progress_v1', OUT_KEY = 'premia2027_outbox_v1', DONE_KEY = 'premia2027_done_';
const tgUser = tg.initDataUnsafe?.user || null, userKey = tgUser?.id ? String(tgUser.id) : '';
const jget = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } };
const jset = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const jdel = k => { try{ localStorage.removeItem(k); }catch(e){} };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- прогресс: перезагрузка Telegram не стирает выбор ---------- */
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

/* ---------- отправка ---------- */
async function postVote(v){
  const ctrl = new AbortController(), to = setTimeout(() => ctrl.abort(), 10000);
  try{
    if(VOTE_CONFIG.endpoint){
      const r = await fetch(VOTE_CONFIG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v), signal: ctrl.signal });
      return { ok: r.ok, retryAfter: +r.headers.get('Retry-After') || 0, fatal: r.status >= 400 && r.status < 500 && r.status !== 429 };
    }
    const text = `@${v.username} проголосовал за:\n` + Object.entries(v.votes).map(([row, n]) => `${row}: ${n}`).join('\n');
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
    const v = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), userId: userKey || 'Аноним', username: tgUser?.username || 'Аноним', votes: { ...selectedNominees }, ts: Date.now() };
    const box = jget(OUT_KEY, []); box.push(v); jset(OUT_KEY, box);
    switchTab('tab5'); if(thankYou) thankYou.style.display = 'block';
    voteStatus('sending'); flushOutbox(true);
  });
}
addEventListener('online', () => { if(jget(OUT_KEY, []).length) flushOutbox(!!$('#voteStatus')); });
if(jget(OUT_KEY, []).length) setTimeout(() => flushOutbox(false), 1500 + Math.random() * 3000);

/* ---------- безопасные сборщики: если один упал — показываем исходные карточки ---------- */
function alreadyVoted(){ return VOTE_CONFIG.oneVotePerUser && userKey && jget(DONE_KEY + userKey, 0) === 1; }
