const tg = window.Telegram?.WebApp || {initDataUnsafe:{},close:()=>{},MainButton:{setText:()=>{},show:()=>{},onClick:()=>{}}};
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const nextButton=$('#nextButton'), submitVotes=$('#submitVotes'), clickSound=$('#clickSound'), transitionSound=$('#transitionSound');
const backgroundMusic=$('#backgroundMusic'), musicModal=$('#musicModal'), musicControl=$('#musicControl');
const musicControlButton=$('#musicControlButton'), musicControlMenu=$('#musicControlMenu'), selectedNominees={};
const nominationOrder=['Самый Ходящий','Главный прогульщик','Номинация победителей','Заводчанин года','Прилежный студент','Машина года','Флешбэк года','Канал года'];
const TOTAL_NOMS = nominationOrder.length; // 8


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
    'Флешбэк года': 'videos/2.mp4',
    'Канал года': 'videos/2.mp4'
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
function ensureVideoOverlay(){
 let overlay=$('#videoInterstitial');if(overlay)return overlay;
 overlay=document.createElement('section');overlay.id='videoInterstitial';overlay.className='video-interstitial';
 overlay.innerHTML='<div class="video-stage"><div class="video-topline"><span class="video-brand">ПРЕМИЯ · СПЕЦИАЛЬНЫЙ ПОКАЗ</span><button type="button" id="skipVideo" class="video-skip">Пропустить видео ↗</button></div><h2 class="video-caption" id="videoCaption">Добро пожаловать на премию</h2><div class="video-frame"><video id="interstitialVideo" playsinline webkit-playsinline preload="auto" controls></video><div class="video-loading" id="videoLoading">Подготавливаем показ…</div></div><div class="video-bottomline"><span id="videoStatus">Подготовка видео…</span><button type="button" id="videoSound" class="video-sound">Включить звук</button></div><p class="video-note" id="videoNote">Видео начнётся автоматически. Если звук заблокирован браузером, включи его кнопкой.</p></div>';
 document.body.appendChild(overlay);
 const style=document.createElement('style');style.id='videoInterstitialStyles';style.textContent=`
 #videoInterstitial{position:fixed!important;inset:0!important;z-index:2147483000!important;display:none!important;align-items:center!important;justify-content:center!important;overflow:auto!important;padding:clamp(12px,3vw,36px)!important;background:#101010!important;background-image:none!important;color:#fff!important;box-sizing:border-box!important;font-family:inherit!important;isolation:isolate!important}
 #videoInterstitial::before,#videoInterstitial::after,#videoInterstitial *::before,#videoInterstitial *::after{content:none!important;display:none!important;background:none!important;background-image:none!important;animation:none!important}
 #videoInterstitial,#videoInterstitial *{background-image:none!important;}
 #videoInterstitial .video-stage{background:transparent!important;background-color:transparent!important;background-image:none!important;box-shadow:none!important;border:0!important}
 #videoInterstitial .video-frame{background:#000!important;background-color:#000!important;background-image:none!important}
 /* Mobile browsers may apply inherited striped backgrounds from global selectors. Force a clean overlay. */
 @media(max-width:768px){#videoInterstitial,#videoInterstitial.visible{background:#101010!important;background-color:#101010!important;background-image:none!important}#videoInterstitial .video-stage,#videoInterstitial .video-topline,#videoInterstitial .video-bottomline,#videoInterstitial .video-note,#videoInterstitial .video-caption{background:transparent!important;background-color:transparent!important;background-image:none!important}#videoInterstitial .video-frame{border:1px solid rgba(224,190,103,.55)!important;background:#000!important;background-image:none!important;box-shadow:0 12px 36px #0009!important}}
 #videoInterstitial.visible{display:flex!important}
 #videoInterstitial *{box-sizing:border-box}
 #videoInterstitial .video-stage{width:min(1100px,100%)!important;margin:auto!important;display:flex!important;flex-direction:column!important;gap:clamp(12px,2vh,22px)!important}
 #videoInterstitial .video-topline,#videoInterstitial .video-bottomline{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;flex-wrap:wrap!important}
 #videoInterstitial .video-brand{font-size:clamp(11px,1.5vw,14px)!important;letter-spacing:.2em!important;color:#d8bd79!important;font-weight:700!important}
 #videoInterstitial .video-caption{margin:0!important;color:#fff!important;font-size:clamp(25px,5vw,54px)!important;line-height:1.08!important;font-weight:800!important;text-align:left!important;overflow-wrap:anywhere!important}
 #videoInterstitial .video-frame{position:relative!important;width:100%!important;aspect-ratio:16/9!important;max-height:70vh!important;background:#000!important;border:1px solid rgba(224,190,103,.55)!important;border-radius:clamp(10px,2vw,22px)!important;overflow:hidden!important;box-shadow:0 20px 80px #0009!important}
 #videoInterstitial video{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important;background:#000!important}
 #videoInterstitial .video-loading{position:absolute!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:20px!important;background:#080808!important;color:#e4c879!important;font-size:clamp(15px,2vw,22px)!important;text-align:center!important;pointer-events:none!important}
 #videoInterstitial .video-loading.hidden{display:none!important}
 #videoInterstitial .video-skip,#videoInterstitial .video-sound{appearance:none!important;border:1px solid #c9a957!important;background:#191713!important;color:#fff!important;border-radius:999px!important;padding:12px 18px!important;min-height:44px!important;font:inherit!important;font-size:14px!important;font-weight:700!important;cursor:pointer!important}
 #videoInterstitial .video-skip{background:#d7b45d!important;color:#17130b!important}
 #videoInterstitial #videoStatus{font-size:14px!important;color:#e3d8b8!important}
 #videoInterstitial .video-note{margin:0!important;color:#bcb8ae!important;font-size:13px!important;line-height:1.5!important}
 @media(max-width:600px){#videoInterstitial{padding:16px!important}#videoInterstitial .video-stage{gap:16px!important}#videoInterstitial .video-frame{aspect-ratio:9/14!important;max-height:64vh!important}#videoInterstitial video{object-fit:contain!important}#videoInterstitial .video-caption{font-size:clamp(26px,8vw,40px)!important}#videoInterstitial .video-topline{align-items:flex-start!important}#videoInterstitial .video-skip{padding:10px 12px!important}}
 `;document.head.appendChild(style);
 $('#skipVideo').addEventListener('click',finishVideo);
 $('#videoSound').addEventListener('click',()=>{const video=$('#interstitialVideo');video.muted=false;video.volume=1;video.play().then(()=>{$('#videoSound').textContent='Звук включён';$('#videoNote').textContent='Звук включён.';}).catch(()=>{$('#videoNote').textContent='Нажми значок звука на самом видеоплеере.';});});
 return overlay;
}
let videoDone=null, videoFallbackTimer=null;
function finishVideo(){const overlay=$('#videoInterstitial'),video=$('#interstitialVideo');if(!overlay?.classList.contains('visible'))return;if(videoFallbackTimer){clearTimeout(videoFallbackTimer);videoFallbackTimer=null;}if(video){video.pause();video.onended=null;}overlay.classList.remove('visible');overlay.style.display='none';const done=videoDone;videoDone=null;if(done)done();}
function playInterstitial(src,caption,done){
 const overlay=ensureVideoOverlay(),video=$('#interstitialVideo');videoDone=done;$('#videoCaption').textContent=caption;$('#videoStatus').textContent='Загрузка ролика…';$('#videoNote').textContent='Показ крупным планом. Если звук не включится автоматически, нажми «Включить звук».';$('#videoLoading').classList.remove('hidden');$('#videoSound').textContent='Включить звук';overlay.style.display='flex';overlay.classList.add('visible');
 video.onended=finishVideo;video.onerror=()=>{$('#videoLoading').classList.remove('hidden');$('#videoLoading').textContent='Видео не найдено — продолжаем';$('#videoStatus').textContent='Ролик отсутствует или путь указан неверно';$('#videoNote').textContent='Автоматически открываем следующую номинацию.';if(videoFallbackTimer)clearTimeout(videoFallbackTimer);videoFallbackTimer=setTimeout(()=>{if(overlay.classList.contains('visible'))finishVideo();},350);};
 video.pause();video.removeAttribute('src');video.load();
 if(!src){$('#videoLoading').textContent='Видео пока не добавлено — продолжаем';$('#videoStatus').textContent='Ролик не указан';$('#videoNote').textContent='Номинация откроется автоматически.';videoFallbackTimer=setTimeout(()=>{if(overlay.classList.contains('visible'))finishVideo();},700);return;}
 $('#videoLoading').textContent='Подготавливаем показ…';video.src=src;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.muted=false;video.volume=1;video.load();
 const attempt=video.play();if(attempt&&attempt.then)attempt.then(()=>{$('#videoLoading').classList.add('hidden');$('#videoStatus').textContent='Идёт показ';}).catch(()=>{video.muted=true;video.play().then(()=>{$('#videoLoading').classList.add('hidden');$('#videoStatus').textContent='Идёт показ без звука';$('#videoNote').textContent='Браузер разрешил автозапуск без звука. Нажми «Включить звук», чтобы попробовать включить звук.';}).catch(()=>{$('#videoLoading').textContent='Нажми ▶, чтобы запустить видео';$('#videoStatus').textContent='Ожидает запуска';$('#videoNote').textContent='Автозапуск заблокирован браузером. Нажми ▶ на плеере или «Включить звук».';});});
 video.onplaying=()=>$('#videoLoading').classList.add('hidden');
}
function startVoting(){switchTab('tab3');if(musicControl)musicControl.style.display='block';playInterstitial(VIDEO_SETTINGS.intro,'Добро пожаловать на премию',()=>showNomination(0));}
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
  nominee.classList.add('selected');
  nominee.classList.remove('flipped');
  $$('.nominee').forEach(n => {
    if((n.dataset.row || '').trim() === row && n !== nominee){
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
    playInterstitial(VIDEO_SETTINGS.outro, 'Спасибо за участие', continueToNext);
    return;
  }

  const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ');
  const currentTitle = nominationOrder[currentNominationIndex] || row;
  const transitionEntry = Object.entries(VIDEO_SETTINGS.transitionAfter).find(([key]) =>
    normalize(key) === normalize(row) || normalize(key) === normalize(currentTitle)
  );
  // Резервный путь гарантирует показ ролика после каждой промежуточной номинации.
  const transitionSrc = transitionEntry?.[1] || 'videos/2.mp4';
  playInterstitial(transitionSrc, `Следующая номинация · ${nominationOrder[nextIndex] || ''}`, continueToNext);
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

function openCandidate(nominee){
 if(!candidateModal||nominee.classList.contains('selected'))return;
 activeCandidate=nominee;
 const photo=$('.nominee-front img',nominee);
 const title=$('.nominee-front h3',nominee)?.textContent?.trim()||nominee.dataset.nominee||'';
 const row = (nominee.dataset.row || '').trim();
 const theme = getModalTheme(nominee);
 const historyText = $('.nominee-description',nominee)?.textContent?.trim()||'История этого кандидата скоро появится.';

 candidateModal.className = 'candidate-modal visible ' + theme.className;
 candidateModal.setAttribute('aria-hidden','false');
 document.body.classList.add('modal-open');

 $('#candidateThemeBadge').textContent = theme.badge;
 $('#candidateModalKicker').textContent = theme.kicker;
 $('#candidateModalName').textContent = title;
 $('#candidateModalPhoto').src = photo?.getAttribute('src') || '';
 $('#candidateModalPhoto').alt = photo?.alt || title;
 $('#candidateCategory').textContent = theme.category;
 $('#candidateHistoryText').textContent = historyText;

 const extraH = $('#candidateExtraHistory');
 const extraV = $('#candidateExtraVideo');
 if(extraH) extraH.innerHTML = typeof theme.extraHistory === 'function' ? theme.extraHistory(title) : '';
 if(extraV) extraV.innerHTML = typeof theme.extraVideo === 'function' ? theme.extraVideo(title) : '';

 const tab1 = $('#tabHistoryBtn'), tab2 = $('#tabVideoBtn');
 if(tab1) tab1.textContent = theme.tab1;
 if(tab2) tab2.textContent = theme.tab2;

 const preferVideo = row === 'Машина' || !!resolveCandidateVideo(nominee);
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

 if(row === 'Машина'){
   candidateVideo.style.display = videoSrc ? 'block' : 'none';
   $('#candidateVideoNote').textContent = videoSrc
     ? 'Ролик из гаража. Нажми ▶, если не стартовал.'
     : 'Стилизованный портрет машины. Видео — через data-video.';
 } else {
   candidateVideo.style.display = 'block';
   if(videoSrc){
     candidateVideo.src = videoSrc;
     candidateVideo.load();
     $('#candidateVideoNote').textContent = 'Видео запускается автоматически. Если браузер запретит — нажми ▶.';
   } else {
     $('#candidateVideoNote').textContent = 'Для этого кандидата видео ещё не указано.';
   }
 }

 if(videoSrc && row !== 'Машина'){
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
  activeCandidate = null;
  const extraH = $('#candidateExtraHistory');
  const extraV = $('#candidateExtraVideo');
  if(extraH) extraH.innerHTML = '';
  if(extraV) extraV.innerHTML = '';
}
$$('.nominee').forEach(nominee=>nominee.addEventListener('click',event=>{if(event.target.closest('button'))return;openCandidate(nominee);}));
$$('.candidate-tab').forEach(button=>button.addEventListener('click',()=>{
 $$('.candidate-tab').forEach(b=>b.classList.toggle('active',b===button));
 $$('.candidate-pane').forEach(p=>p.classList.toggle('active',p.id===button.dataset.pane));
 if(button.dataset.pane==='videoPane'&&candidateVideo?.src){candidateVideo.muted=false;candidateVideo.volume=1;candidateVideo.play().catch(()=>{$('#candidateVideoNote').textContent='Нажми ▶ на видео, чтобы запустить его со звуком.';});}else if(button.dataset.pane!=='videoPane'&&candidateVideo){candidateVideo.pause();}
}));
$('#candidateClose')?.addEventListener('click',closeCandidate);$('#candidateBack')?.addEventListener('click',closeCandidate);
 candidateModal?.addEventListener('click',event=>{if(event.target===candidateModal)closeCandidate();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeCandidate();});
$('#candidateVote')?.addEventListener('click',()=>{if(activeCandidate){const chosen=activeCandidate;closeCandidate();voteFor(chosen);}});

function showCompletion(){frames.forEach(f=>f.classList.remove('current'));const hint=$('#votingHint');if(hint)hint.textContent=`Все ${TOTAL_NOMS} номинаций выбраны. Отправь свой голос.`;const counter=$('#currentStep'),fill=$('#progressFill');if(counter)counter.textContent=String(TOTAL_NOMS).padStart(2,'0');if(fill)fill.style.width='100%';if($('#voteReminder'))$('#voteReminder').style.display='none';if(submitVotes){submitVotes.style.display='flex';submitVotes.scrollIntoView({behavior:'smooth',block:'center'});}if(typeof onVotingComplete==='function')onVotingComplete();}
if(submitVotes)submitVotes.addEventListener('click',()=>{playSound(clickSound);const userId=tg.initDataUnsafe.user?.id||'Аноним',username=tg.initDataUnsafe.user?.username||'Аноним';sendVoteToTelegram(userId,username,selectedNominees);switchTab('tab5');if(thankYou)thankYou.style.display='block';setTimeout(()=>tg.close(),3000);});
function sendVoteToTelegram(userId,username,votes){const botToken='7896921651:AAHvSknX1BImERrKpfk_gAsG6fissqVcrfc',chatId='-1002626436094';const message=`@${username} проголосовал за:\n${Object.entries(votes).map(([row,nominee])=>`${row}: ${nominee}`).join('\n')}`;fetch(`https://api.telegram.org/bot${botToken}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text:message})}).then(r=>r.json()).then(data=>console.log('Голос отправлен:',data)).catch(error=>console.error('Ошибка отправки голоса:',error));}
tg.MainButton?.setText?.('Закрыть');tg.MainButton?.show?.();tg.MainButton?.onClick?.(()=>tg.close());


/* ========== Onboarding: подсказки для первого запуска ========== */
const COACH_KEY = 'premia2027_coach_done_v1';
let coachActive = false;
let coachStep = 0;

const COACH_STEPS = [
  {
    id: 'tap-card',
    kicker: 'Шаг 1 из 3',
    text: 'Нажми на любую карточку кандидата — откроется досье: история и видео.',
    target: () => document.querySelector('#tab3 .nomination-frame.current .nominee'),
    place: 'bottom'
  },
  {
    id: 'vote-btn',
    kicker: 'Шаг 2 из 3',
    text: 'Внутри досье нажми «Голосовать за кандидата». После выбора откроется следующая номинация.',
    target: () => null, // показываем после открытия модалки — через openCandidate
    place: 'bottom',
    waitModal: true
  },
  {
    id: 'second-nom',
    kicker: 'Шаг 3 из 3',
    text: 'Отлично! Дальше всё так же: открыл → посмотрел → выбрал. Ещё 6 номинаций — и готово.',
    target: () => document.querySelector('#tab3 .nomination-frame.current .nominee'),
    place: 'bottom'
  }
];

function coachDone(){
  try{ localStorage.setItem(COACH_KEY, '1'); }catch(e){}
  coachActive = false;
  removeCoachUI();
}
function coachShouldRun(){
  try{ return localStorage.getItem(COACH_KEY) !== '1'; }catch(e){ return true; }
}
function removeCoachUI(){
  $('#coachOverlay')?.remove();
  $('#coachCard')?.remove();
  $('#coachSpotlight')?.remove();
  submitVotes?.classList.remove('coach-pulse');
}
function placeNear(el, card, place){
  const r = el.getBoundingClientRect();
  const cw = card.offsetWidth, ch = card.offsetHeight;
  let top, left;
  if(place === 'top'){
    top = r.top - ch - 14;
    left = r.left + r.width/2 - cw/2;
  } else {
    top = r.bottom + 14;
    left = r.left + r.width/2 - cw/2;
  }
  left = Math.max(14, Math.min(left, window.innerWidth - cw - 14));
  top  = Math.max(14, Math.min(top,  window.innerHeight - ch - 14));
  card.style.top = top + 'px';
  card.style.left = left + 'px';
  // стрелка
  let arrow = card.querySelector('.coach-arrow');
  if(!arrow){ arrow = document.createElement('div'); arrow.className = 'coach-arrow'; card.appendChild(arrow); }
  arrow.className = 'coach-arrow ' + (place === 'top' ? 'bottom' : 'top');
  arrow.style.left = Math.max(16, Math.min(cw/2 - 6, r.left + r.width/2 - left - 6)) + 'px';
  arrow.style.right = 'auto';
}
function showCoachStep(stepIndex){
  if(!coachActive) return;
  removeCoachUI();
  const step = COACH_STEPS[stepIndex];
  if(!step){ coachDone(); return; }
  coachStep = stepIndex;

  const target = typeof step.target === 'function' ? step.target() : null;
  if(step.waitModal && !document.querySelector('.candidate-modal.visible')){
    // ждём открытия модалки — подсказка появится из openCandidate
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'coachOverlay';
  overlay.className = 'coach-overlay';
  document.body.appendChild(overlay);

  if(target){
    const spot = document.createElement('div');
    spot.id = 'coachSpotlight';
    spot.className = 'coach-spotlight';
    const r = target.getBoundingClientRect();
    const pad = 6;
    spot.style.top = (r.top - pad) + 'px';
    spot.style.left = (r.left - pad) + 'px';
    spot.style.width = (r.width + pad*2) + 'px';
    spot.style.height = (r.height + pad*2) + 'px';
    document.body.appendChild(spot);
  }

  const card = document.createElement('div');
  card.id = 'coachCard';
  card.className = 'coach-card';
  const dots = COACH_STEPS.map((_,i)=>`<span class="coach-dot${i===stepIndex?' on':''}"></span>`).join('');
  card.innerHTML = `
    <div class="coach-dots">${dots}</div>
    <div class="coach-kicker">${step.kicker}</div>
    <p>${step.text}</p>
    <div class="coach-actions">
      <button type="button" class="coach-skip" id="coachSkip">Пропустить</button>
      <button type="button" class="coach-next" id="coachNext">${stepIndex >= COACH_STEPS.length-1 ? 'Понятно' : 'Дальше'}</button>
    </div>`;
  document.body.appendChild(card);

  if(target) placeNear(target, card, step.place || 'bottom');
  else {
    card.style.left = '50%';
    card.style.top = '50%';
    card.style.transform = 'translate(-50%,-50%)';
  }

  $('#coachSkip')?.addEventListener('click', () => coachDone());
  $('#coachNext')?.addEventListener('click', () => {
    if(stepIndex >= COACH_STEPS.length - 1) coachDone();
    else {
      // если ждём модалку — просто закрываем карточку и ждём действия
      if(COACH_STEPS[stepIndex+1]?.waitModal){
        removeCoachUI();
        coachStep = stepIndex + 1;
      } else {
        showCoachStep(stepIndex + 1);
      }
    }
  });
}

function startCoachIfNeeded(){
  if(!coachShouldRun()) return;
  coachActive = true;
  coachStep = 0;
  // небольшая пауза, чтобы карточки успели отрисоваться
  setTimeout(() => showCoachStep(0), 450);
}

function onNominationShown(index){
  if(!coachActive) return;
  if(index === 0) startCoachIfNeeded();
  else if(index === 1 && coachStep <= 2){
    // после первой голосования — финальная подсказка на второй номинации
    setTimeout(() => showCoachStep(2), 500);
  } else if(index >= 2){
    // дальше подсказки не нужны
    coachDone();
  }
}

function onVotingComplete(){
  // подсказка на кнопку «Отправить»
  if(!coachShouldRun() && localStorage.getItem(COACH_KEY+'_submit')) return;
  // показываем всегда один раз на кнопку отправки, даже если основной coach уже пройден
  try{
    if(localStorage.getItem(COACH_KEY + '_submit') === '1') return;
  }catch(e){}

  removeCoachUI();
  const btn = submitVotes;
  if(!btn) return;
  btn.classList.add('coach-pulse');

  const card = document.createElement('div');
  card.id = 'coachCard';
  card.className = 'coach-card';
  card.innerHTML = `
    <div class="coach-kicker">Почти готово</div>
    <p>Все номинации выбраны. Нажми «Отправить голос» — твой выбор уйдёт в зачёт.</p>
    <div class="coach-actions">
      <button type="button" class="coach-skip" id="coachSkip">Скрыть</button>
      <button type="button" class="coach-next" id="coachNext">Ок</button>
    </div>`;
  document.body.appendChild(card);
  placeNear(btn, card, 'top');
  const finish = () => {
    try{ localStorage.setItem(COACH_KEY + '_submit', '1'); }catch(e){}
    removeCoachUI();
  };
  $('#coachSkip')?.addEventListener('click', finish);
  $('#coachNext')?.addEventListener('click', finish);
}

// Когда открывают кандидата — показываем шаг 2 (голосовать)
const _origOpenCandidate = openCandidate;
openCandidate = function(nominee){
  _origOpenCandidate(nominee);
  if(coachActive && (coachStep === 0 || coachStep === 1)){
    setTimeout(() => {
      // подсветим кнопку голосовать в модалке
      const voteBtn = $('#candidateVote');
      removeCoachUI();
      coachStep = 1;
      if(!voteBtn) return;
      const card = document.createElement('div');
      card.id = 'coachCard';
      card.className = 'coach-card';
      card.innerHTML = `
        <div class="coach-dots"><span class="coach-dot"></span><span class="coach-dot on"></span><span class="coach-dot"></span></div>
        <div class="coach-kicker">Шаг 2 из 3</div>
        <p>Изучи историю или видео, затем нажми «Голосовать за кандидата».</p>
        <div class="coach-actions">
          <button type="button" class="coach-skip" id="coachSkip">Пропустить подсказки</button>
          <button type="button" class="coach-next" id="coachNext">Понятно</button>
        </div>`;
      document.body.appendChild(card);
      placeNear(voteBtn, card, 'top');
      $('#coachSkip')?.addEventListener('click', () => coachDone());
      $('#coachNext')?.addEventListener('click', () => removeCoachUI());
    }, 350);
  }
};

