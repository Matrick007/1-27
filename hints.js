/* Подсказки с персонажами. Каждая показывается один раз (запоминается в localStorage). */
(function(){
'use strict';
var SEEN_KEY='premia2027_hints_v1', LS=window.localStorage;
function lsGet(k){try{return LS.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{LS.setItem(k,v)}catch(e){}}
// старые 3 шага «coach» заменены новой системой
lsSet('premia2027_coach_v2','1');

/* РЕЖИМ РАЗРАБОТКИ: подсказки показываются при каждой загрузке страницы.
   Когда разработка закончится — поставь PERSIST=true, и каждая подсказка будет показываться один раз. */
var PERSIST=false;
var seen={};if(PERSIST){try{seen=JSON.parse(lsGet(SEEN_KEY)||'{}')||{}}catch(e){}}
function mark(id){seen[id]=1;if(PERSIST)lsSet(SEEN_KEY,JSON.stringify(seen))}

var isPC=window.matchMedia&&window.matchMedia('(hover:hover) and (pointer:fine)').matches;
var $=function(s,r){return(r||document).querySelector(s)}, $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};

/* персонажи: по 2 подсказки на каждого, по порядку */
var CH=[
 {n:'Кирилл',img:'photo/Подсказки/k1.webp'},
 {n:'Лукин',img:'photo/Подсказки/l1.webp'},
 {n:'Лукин',img:'photo/Подсказки/l2.webp'},
 {n:'Кирилл',img:'photo/Подсказки/k2.webp'},
 {n:'Тигр',img:'photo/Подсказки/t1.webp',sq:true}
];
CH.forEach(function(c){var i=new Image();i.src=c.img});

function visible(el){if(!el)return false;var r=el.getBoundingClientRect();return r.width>0&&r.height>0}
function curFrame(){return $('#tab3.active .nomination-frame.current')}
function busy(){return !!($('#nomLoader')||$('#videoInterstitial.visible')||$('.js-box'))}
function dossier(){return !!($('#hodModal.visible')||$('#candidateModal.visible'))}
function voted(){return !!$('#tab5.active')}

var H=[]; // порядок = порядок персонажей
function add(o){o.i=H.length;o.ch=CH[Math.min(CH.length-1,Math.floor(o.i*CH.length/10))];H.push(o)}

/* 1. главный экран */
add({id:'hero',
 text:function(){return isPC?'Жми <b>«Начать голосование»</b> — кнопка прямо тут.':'Привет! <b>Листай вниз</b> <span class="hn-arr">↓</span> — там кнопка начала голосования.'},
 ctx:function(){return $('#tab1.active')&&!document.body.classList.contains('modal-open')},
 when:function(){return $('#tab1.active')},
 target:function(){return isPC?($('.lx-cta2')||$('#nextButton')):null},
 done:function(){var b=$('#nextButton');if(!b)return false;var r=b.getBoundingClientRect();return !isPC&&r.top<innerHeight*.8&&r.bottom>0},
 delay:700});
/* 2. листание кандидатов */
var swipeBase=-1;
function activeIdx(){var s=$$('.nomination-frame.current .fifa-slide');for(var i=0;i<s.length;i++)if(s[i].classList.contains('is-active'))return i;return -1}
add({id:'swipe',
 text:function(){return isPC?'Кандидатов можно <b>листать стрелками</b> или мышкой — посмотри остальных.':'Кандидатов можно <b>листать свайпом</b> влево-вправо.'},
 ctx:function(){var f=curFrame();return f&&f.dataset.fifa&&!dossier()},
 when:function(){var f=curFrame();return f&&f.dataset.fifa&&!busy()&&!dossier()&&$('.fifa-slide.is-active',f)},
 onShow:function(){swipeBase=activeIdx()},
 done:function(){return activeIdx()!==swipeBase},
 delay:600});
/* 3. нажать на кандидата */
add({id:'tap',
 text:function(){return isPC?'Наведи на кандидата — выедут кнопки <b>«История»</b>, <b>«Видео»</b> и <b>«Голосовать»</b>.':'<b>Нажми на кандидата</b> — выскочат кнопки «История», «Видео» и «Голосовать».'},
 ctx:function(){var f=curFrame();return f&&f.dataset.fifa&&!dossier()},
 when:function(){var f=curFrame();return seen.swipe&&f&&f.dataset.fifa&&!busy()&&!dossier()},
 target:function(){return $('.nomination-frame.current .fifa-slide.is-active .fifa-card')},
 done:function(){return dossier()},
 delay:500});
/* 4. прокрутить досье */
add({id:'scroll',
 text:function(){return'Листай досье <b>вниз</b> <span class="hn-arr">↓</span> — там будут игры и всякие приколы.'},
 ctx:function(){return dossier()},
 when:function(){return seen.tap&&dossier()},
 done:function(){var s=$('#hodModal.visible .hm-scroll')||$('#candidateModal.visible .candidate-dialog');return s&&s.scrollTop>140},
 delay:900});
/* 5. выйти или проголосовать */
add({id:'exit',
 text:function(){return isPC?'Теперь можно <b>выйти</b> и глянуть следующего кандидата — или <b>проголосовать</b> за этого. Решай сам.':'Дальше решай сам: <b>выйди</b> и глянь следующего кандидата — или <b>проголосуй</b> за этого.'},
 ctx:function(){return dossier()},
 when:function(){return seen.scroll&&dossier()},
 target:function(){return isPC?($('#hodModal.visible .hm-vote')||$('#candidateVote')):null},
 done:function(){return !dossier()},
 delay:600});
/* 6. листовки */
add({id:'wanted',
 text:function(){return'Нижний листочек на объявлении можно <b>сорвать</b>. Попробуй!'},
 ctx:function(){var f=curFrame();return f&&f.dataset.wanted&&!dossier()},
 when:function(){var f=curFrame();return f&&f.dataset.wanted&&!busy()&&!dossier()},
 target:function(){return $('.nomination-frame.current .wp-tab')},
 done:function(){var t=$('#wallTorn');return t&&+t.textContent>0},
 delay:900});
/* 7. досье и тюнинг */
add({id:'garage',
 text:function(){return'Загляни в <b>«Досье и тюнинг»</b> — там можно не только почитать, но и покрутить тачку.'},
 ctx:function(){var f=curFrame();return f&&f.dataset.garage&&!dossier()},
 when:function(){var f=curFrame();return f&&f.dataset.garage&&!busy()&&!dossier()},
 target:function(){return $('.nomination-frame.current .sr-open')},
 done:function(){return dossier()},
 delay:900});
/* 8. покраска */
add({id:'paint',
 text:function(){return'Тут можно <b>затюнинговать</b> машину. Начни с покраски: спустись к панели «Кузов» и <b>выбери цвет</b>.'},
 ctx:function(){return $('#hodModal.visible .cf')},
 when:function(){return $('#hodModal.visible .cf')&&visible($('#hodModal.visible .cf'))},
 target:function(){return $('#hodModal.visible .cf-row[data-k="paint"]')},
 done:function(){return paintDone},
 delay:1200});
/* 9. тюнить все */
add({id:'all',
 text:function(){return'Красота! Так можно <b>затюнинговать все машины</b> — закрой досье и листай авто дальше.'},
 ctx:function(){return $('#hodModal.visible .cf')},
 when:function(){return paintDone&&$('#hodModal.visible .cf')},
 done:function(){return !$('#hodModal.visible .cf')},
 delay:500});
/* 10. турнир */
add({id:'joust',
 text:function(){return'Не знаешь, за кого голосовать? Сыграй в <b>турнир на копьях</b> — выберешь сильнейшего.'},
 ctx:function(){var f=curFrame();return f&&f.dataset.trophy&&!busy()},
 when:function(){var f=curFrame();return f&&f.dataset.trophy&&!busy()&&$('.kq-joust',f)},
 target:function(){return $('.nomination-frame.current .kq-joust b')||$('.nomination-frame.current .kq-joust')},
 done:function(){return !!$('.js-box')},
 delay:1200});

var paintDone=false;
document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('.cf-row[data-k="paint"] [data-v]'))setTimeout(function(){paintDone=true},50)},true);

/* ---------- отрисовка ---------- */
var PTR_SVG='<svg viewBox="0 0 24 24"><path d="M12 21 3 9h6V3h6v6h6z" fill="#e6c98a" stroke="#17130a" stroke-width="1.4" stroke-linejoin="round"/></svg>';
var numEl,root,box,chEl,nameEl,textEl,dots,okBtn,ring,ptr,cur=null,typeT=0,startT=0;
function build(){
 root=document.createElement('div');root.className='hn';root.setAttribute('role','status');root.setAttribute('aria-live','polite');
 root.innerHTML='<div class="hn-box"><div class="hn-ch"><img alt="" draggable="false"></div><div class="hn-meta"><span class="hn-name"></span><i></i><span class="hn-num"></span></div><div class="hn-text"></div><div class="hn-row"><span class="hn-dots"></span><button type="button" class="hn-ok">Понял</button></div></div>';
 document.body.appendChild(root);
 chEl=$('.hn-ch',root);nameEl=$('.hn-name',root);numEl=$('.hn-num',root);textEl=$('.hn-text',root);dots=$('.hn-dots',root);okBtn=$('.hn-ok',root);
 okBtn.addEventListener('click',function(){hide(true)});
 ring=document.createElement('div');ring.className='hn-ring';ring.style.display='none';document.body.appendChild(ring);
 ptr=document.createElement('div');ptr.className='hn-ptr';ptr.innerHTML=PTR_SVG;ptr.style.display='none';document.body.appendChild(ptr);
}
function place(){
 if(!cur||!cur.target){ring&&(ring.style.display='none');ptr&&(ptr.style.display='none');return}
 var t=cur.target();if(!t||!visible(t)){ring.style.display='none';ptr.style.display='none';return}
 var r=t.getBoundingClientRect(),vh=innerHeight,pad=4;
 // окно закрывает цель — переносим его на противоположную сторону экрана (один раз)
 if(!cur.flipTried&&root.classList.contains('on')){
  var br=$('.hn-box',root).getBoundingClientRect();
  if(r.bottom>br.top&&r.top<br.bottom&&r.right>br.left&&r.left<br.right&&r.bottom>0&&r.top<vh){cur.flipTried=1;root.classList.toggle('flip')}
 }
 var out=r.bottom<0||r.top>vh;
 if(out){ring.style.display='none';ptr.style.display='block';ptr.classList.toggle('up',r.top<=vh);ptr.style.left=Math.max(12,Math.min(innerWidth-44,r.left+r.width/2-17))+'px';ptr.style.top=(r.top>vh?vh-150:12)+'px';return}
 ring.style.display='block';
 ring.style.left=(r.left-pad)+'px';ring.style.top=(r.top-pad)+'px';ring.style.width=(r.width+pad*2)+'px';ring.style.height=(r.height+pad*2)+'px';
 if(isPC){ptr.style.display='block';ptr.classList.toggle('up',!(r.top>90));ptr.style.left=(r.left+r.width/2-17)+'px';ptr.style.top=(r.top>90?r.top-46:r.bottom+6)+'px'}else ptr.style.display='none';
}
function show(h){
 if(!root)build();
 cur=h;h.t0=Date.now();h.flipTried=0;root.classList.remove('flip');
 chEl.className='hn-ch'+(h.ch.sq?' sq':'');$('img',chEl).src=h.ch.img;
 nameEl.textContent=h.ch.n;numEl.textContent='Подсказка '+('0'+(h.i+1)).slice(-2)+' / '+H.length;
 dots.innerHTML=H.map(function(x,i){return'<i class="'+(i===h.i?'on':i<h.i?'d':'')+'"></i>'}).join('');
 var full=h.text();textEl.innerHTML='';clearInterval(typeT);
 var tmp=document.createElement('div');tmp.innerHTML=full;
 var total=tmp.textContent.length,printed=0;
 typeT=setInterval(function(){
  printed=Math.min(total,printed+2);
  textEl.innerHTML=truncHtml(full,printed);
  if(printed>=total){clearInterval(typeT);textEl.innerHTML=full}
 },22);
 mark(h.id);
 if(h.onShow)h.onShow();
 setTimeout(function(){revealTarget(h)},350);
 requestAnimationFrame(function(){root.classList.add('on')});
 place();
}
function truncHtml(html,n){
 var out='',cnt=0,i=0,open=[];
 while(i<html.length&&cnt<n){
  if(html[i]==='<'){var j=html.indexOf('>',i);var tag=html.slice(i,j+1);out+=tag;
   var m=/^<(\/?)(\w+)/.exec(tag);if(m){if(m[1])open.pop();else if(!/\/>$/.test(tag))open.push(m[2])}i=j+1}
  else{out+=html[i];cnt++;i++}
 }
 while(open.length)out+='</'+open.pop()+'>';
 return out;
}
function revealTarget(h){
 if(cur!==h||!h.target)return;
 var t=h.target();if(!t||!visible(t))return;
 var r=t.getBoundingClientRect(),bh=$('.hn-box',root).offsetHeight+24,vh=innerHeight;
 var hidden=r.bottom>vh-bh||r.top<0;h.scrollTo=h.scrollTo||(h.id==='joust');
 if(h.id==='hero'&&isPC)return; // на ПК просто показываем стрелкой
 if(hidden||h.scrollTo){
  var y=(vh-bh)/2-r.height/2; // центр свободной области над окном
  var host=t.closest('.hm-scroll')||null;
  if(host){var hr=host.getBoundingClientRect();host.scrollBy({top:r.top-hr.top-Math.max(60,(vh-bh-hr.top)/2-r.height/2),behavior:'smooth'})}
  else t.scrollIntoView({block:'center',behavior:'smooth'});
 }
}
function hide(user){
 if(!cur)return;
 clearInterval(typeT);
 root.classList.remove('on');ring.style.display='none';ptr.style.display='none';cur=null;
}

/* ---------- главный цикл ---------- */
function tick(){
 if(voted()){hide();return}
 if(cur){
  var ok=false;try{ok=cur.ctx()}catch(e){}
  if(!ok){hide();return}
  var d=false;try{d=cur.done()}catch(e){}
  if(d&&Date.now()-cur.t0>900){hide();return}
  place();return;
 }
 if(document.hidden||busy())return;
 for(var i=0;i<H.length;i++){
  var h=H[i];if(seen[h.id])continue;
  var w=false;try{w=h.when()}catch(e){}
  if(w){
   // подсказка должна простоять условие какое-то время, чтобы не мигать на переходах
   if(!h._w)h._w=Date.now();
   if(Date.now()-h._w>=(h.delay||500)){show(h)}
   return;
  }else h._w=0;
 }
}
function init(){setInterval(tick,300);addEventListener('resize',place,{passive:true});addEventListener('scroll',place,{passive:true,capture:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
