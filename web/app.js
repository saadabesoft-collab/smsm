/* ===== سمسم — المحرّك والواجهة ===== */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const AR=n=>Number(n).toLocaleString('ar-EG',{useGrouping:false});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const arD=s=>String(s).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);
const dk=d=>{d=new Date(d);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const fromDk=k=>{const[y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const WD=['الأحد','الاتنين','التلات','الأربع','الخميس','الجمعة','السبت'];
const NATIVE=!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());
const NP=NATIVE?Capacitor.Plugins.Smsm:null, SRP=NATIVE?Capacitor.Plugins.SpeechRecognition:null;
const KEY='smsm_v1';
const DEF={tasks:[],reports:[],lastDay:null,set:{name:'',snooze:[5,10,15,30,60],snDef:10,repeat:3,closeH:0,voice:true,rate:1,wake:false,theme:'auto',confirm:true}};
let S=load();
function load(){try{const o=JSON.parse(localStorage.getItem(KEY));if(o&&o.tasks){o.set={...DEF.set,...o.set};o.reports=o.reports||[];return o}}catch(e){}return JSON.parse(JSON.stringify(DEF))}
let saveT=null;
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}clearTimeout(saveT);saveT=setTimeout(nsched,400)}
const uid=()=>'t'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const hid=s=>{let h=5381;for(const c of s)h=((h<<5)+h+c.charCodeAt(0))|0;return Math.abs(h)%1e9+1};

/* ---------- time words ---------- */
const HW=['اتناشر','واحدة','اتنين','تلاتة','أربعة','خمسة','ستة','سبعة','تمانية','تسعة','عشرة','حداشر','اتناشر'];
function perOf(H){return H<4?'بالليل':H<12?'الصبح':H<15?'الضهر':H<18?'العصر':H<20?'المغرب':'بالليل'}
function sayTime(d){d=new Date(d);let H=d.getHours(),M=d.getMinutes(),h=H%12,extra='';
 if(M===0)extra='';else if(M===15)extra=' وربع';else if(M===30)extra=' ونص';else if(M===20)extra=' وتلت';
 else if(M===45){h=(h+1)%12;extra=' إلا ربع';H=(H+1)%24}else if(M===40){h=(h+1)%12;extra=' إلا تلت';H=(H+1)%24}else extra=' و'+M+' دقيقة';
 return 'الساعة '+HW[h===0?12:h]+extra+' '+perOf(H)}
function showTime(d){d=new Date(d);const H=d.getHours(),h=H%12||12;return AR(h)+':'+arD(pad(d.getMinutes()))}
function ampm(d){const H=new Date(d).getHours();return perOf(H)}
function dayWord(d){const t=dk(new Date()),k=dk(d);if(k===t)return'النهارده';if(k===dk(addDays(new Date(),1)))return'بكرة';if(k===dk(addDays(new Date(),2)))return'بعد بكرة';if(k===dk(addDays(new Date(),-1)))return'امبارح';
 const x=new Date(d),diff=(fromDk(k)-fromDk(t))/864e5;if(diff>0&&diff<7)return'يوم '+WD[x.getDay()];return WD[x.getDay()]+' '+AR(x.getDate())+' '+MONTHS[x.getMonth()]+(x.getFullYear()!==new Date().getFullYear()?' '+AR(x.getFullYear()):'')}
function sayWhen(t){const at=t.at,mins=Math.round((at-Date.now())/6e4);
 if(!t.dayOnly&&mins>0&&mins<60&&dk(at)===dk(new Date()))return 'بعد '+(mins===30?'نص ساعة':mins===15?'ربع ساعة':mins===1?'دقيقة':mins===2?'دقيقتين':mins+(mins<=10?' دقايق':' دقيقة'));
 if(!t.dayOnly&&mins>=60&&mins<180&&mins%30===0&&dk(at)===dk(new Date()))return 'بعد '+({60:'ساعة',90:'ساعة ونص',120:'ساعتين',150:'ساعتين ونص'}[mins]);
 return dayWord(at)+' '+sayTime(at)}
function speakWhen(t){const w=sayWhen(t);return t.rep==='d'?'كل يوم '+sayTime(t.at):t.rep==='w'?'كل '+WD[new Date(t.at).getDay()]+' '+sayTime(t.at):w}
function hijri(d){try{return new Intl.DateTimeFormat('ar-EG-u-ca-islamic-umalqura-nu-arab',{day:'numeric',month:'long',year:'numeric'}).format(d).replace(/[٬,]/g,'').replace(' هـ','')+' هـ'}catch(e){return''}}

/* ---------- speech out ---------- */
/* Egyptian pronunciation hints for the speech engine */
const EG=[[/تم التسجيل/g,'تمام، اتسجِّلِت'],[/هفكرك/g,'هَفَكَّرَك'],[/بفكرك/g,'بَفَكَّرَك'],[/أفكرك/g,'أفَكَّرَك'],[/الصبح/g,'الصُّبح'],[/الضهر/g,'الضُّهر'],[/العصر/g,'العَصْر'],[/بالليل/g,'باللِّيل'],[/المغرب/g,'المَغْرِب'],
 [/ونص/g,'ونُصّ'],[/نص ساعة/g,'نُصّ ساعة'],[/ربع/g,'رُبع'],[/بكرة/g,'بُكْرة'],[/النهارده/g,'النَّهارده'],[/دقايق/g,'دَقايِق'],[/عندك/g,'عَنْدَك'],[/خلصت/g,'خَلَّصْت'],[/خلص /g,'خِلِص '],[/مفهمتش/g,'مَفهِمتِش'],[/إمتى/g,'إمْتَى'],[/حداشر/g,'حِداشَر'],[/اتناشر/g,'اتْناشَر'],[/تلاتة/g,'تَلاتة'],[/تمانية/g,'تَمانية']];
const egSay=t=>EG.reduce((x,[r,v])=>x.replace(r,v),String(t));
let arVoice=null;
function pickVoice(){if(!('speechSynthesis'in window))return;const v=speechSynthesis.getVoices().filter(x=>/^ar/i.test(x.lang));
 arVoice=v.find(x=>x.name===S.set.voiceName)||v.find(x=>/EG/i.test(x.lang)&&/Natural|Online|Salma|Shakir/i.test(x.name))||v.find(x=>/EG/i.test(x.lang))||v.find(x=>/Natural|Online|Google/i.test(x.name))||v[0]||null}
if('speechSynthesis'in window){pickVoice();speechSynthesis.onvoiceschanged=pickVoice}
const azOn=()=>!!(S.set.az&&S.set.az.key&&S.set.az.region);
const azName=t=>'c'+hid((S.set.az.voice||'')+'|'+S.set.rate+'|'+t)+'.mp3';
const azCache=new Map();
async function azBlob(text){const k=azName(text);if(azCache.has(k))return azCache.get(k);const a=S.set.az;const x=text.replace(/&/g,'&amp;').replace(/</g,'&lt;');
 const r=await fetch('https://'+a.region+'.tts.speech.microsoft.com/cognitiveservices/v1',{method:'POST',headers:{'Ocp-Apim-Subscription-Key':a.key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3'},
  body:"<speak version='1.0' xml:lang='ar-EG'><voice name='"+(a.voice||'ar-EG-SalmaNeural')+"'><prosody rate='"+Math.round((S.set.rate-1)*100)+"%'>"+x+"</prosody></voice></speak>"});
 if(!r.ok)throw new Error('az '+r.status);const b=await r.blob();azCache.set(k,b);return b}
async function azFile(text){const a=S.set.az;const r=await NP.cloudTts({text,key:a.key,region:a.region,voice:a.voice||'ar-EG-SalmaNeural',rate:S.set.rate,name:azName(text)});return r.path}
async function speak(text,force){if((!S.set.voice&&!force)||!text)return;text=egSay(text);
 if(azOn()){try{if(NATIVE){const f=await azFile(text);await NP.playFile({path:f});return}const b=await azBlob(text);await new Promise(res=>{const a=new Audio(URL.createObjectURL(b));a.onended=a.onerror=res;a.play().catch(res)});return}catch(e){}}
 if(NATIVE){try{await NP.speak({text,rate:S.set.rate,voice:S.set.voiceName||''})}catch(e){}return}
 if(!('speechSynthesis'in window))return;
 await new Promise(res=>{try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=arVoice?arVoice.lang:'ar-EG';if(arVoice)u.voice=arVoice;u.rate=S.set.rate;u.onend=u.onerror=()=>res();speechSynthesis.speak(u);setTimeout(res,Math.min(15000,1500+text.length*120))}catch(e){res()}})}
/* the sentence said when a reminder rings */
const remLine=t=>(S.set.name?'يا '+S.set.name+'، ':'')+(t.note?'عندك فويس نوت'+(t.text&&t.text!=='فويس نوت'?'، '+t.text:''):'بفكرك: '+t.text);
/* with the Azure voice on, prepare the reminder sentence as a file so the phone can play it while the app is closed */
let clipBusy=false;
async function ensureClips(){if(!NATIVE||!azOn()||clipBusy)return;clipBusy=true;let got=false;
 try{for(const t of S.tasks.filter(t=>!t.done&&!t.closed&&!t.missed&&t.at>Date.now()-36e5&&t.at<Date.now()+7*864e5).slice(0,40)){const line=egSay(remLine(t));if(t.vclip&&t.vclip.line===line)continue;
  try{const path=await azFile(line);t.vclip={line,path};got=true}catch(e){break}}}finally{clipBusy=false}if(got){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}nsched()}}
/* ---------- speech in ---------- */
const WebSR=window.SpeechRecognition||window.webkitSpeechRecognition;
const canListen=()=>NATIVE||!!WebSR;
let listening=false;
function setLive(on,label){listening=on;$('#talk').classList.toggle('live',on);if(label!=null)heard(label)}
function heard(t,cls){$('#heard').innerHTML=t?'<div class="heard'+(cls?' '+cls:'')+'">'+t+'</div>':''}
async function listen(prompt){
 if(!canListen()){toast('المتصفح ده مش بيدعم الكلام — جرّب Chrome أو اكتب تحت');return''}
 stopWake();setLive(true,'<b>سامعك…</b> '+esc(prompt||''));
 try{
  if(NATIVE){const p=await SRP.checkPermissions();if(p.speechRecognition!=='granted'){const r=await SRP.requestPermissions();if(r.speechRecognition!=='granted'){toast('محتاج إذن الميكروفون');return''}}
   const r=await SRP.start({language:'ar-EG',maxResults:3,partialResults:false,popup:false,prompt:prompt||'قول لسمسم'});return(r&&r.matches&&r.matches[0])||''}
  return await new Promise(res=>{const r=new WebSR();r.lang='ar-EG';r.interimResults=true;r.maxAlternatives=1;let fin='';
   r.onresult=e=>{let t='';for(const x of e.results){t+=x[0].transcript;if(x.isFinal)fin=t}heard('<b>سامعك…</b> '+esc(t))};
   r.onerror=()=>{};r.onend=()=>res(fin||'');r.start();setTimeout(()=>{try{r.stop()}catch(e){}},12000)})
 }catch(e){return''}finally{setLive(false);setTimeout(startWake,600)}}

/* "يا سمسم" while the app is open (PC/browser) */
let wakeR=null,wakeOn=false;
function startWake(){if(NATIVE||!WebSR||!S.set.wake||wakeOn||listening||document.hidden)return;
 try{wakeR=new WebSR();wakeR.lang='ar-EG';wakeR.continuous=true;wakeR.interimResults=false;wakeOn=true;
  wakeR.onresult=e=>{const t=e.results[e.results.length-1][0].transcript;if(/سمسم|سم سم|سمسن/.test(t)){stopWake();const rest=t.replace(/.*?(?:يا\s*)?(?:سمسم|سم سم|سمسن)/,'').trim();converse(rest.length>4?t:null,true)}};
  wakeR.onend=()=>{wakeOn=false;if(S.set.wake&&!listening)setTimeout(startWake,500)};wakeR.onerror=()=>{};wakeR.start()}catch(e){wakeOn=false}}
function stopWake(){if(wakeR){wakeOn=false;try{wakeR.onend=null;wakeR.abort()}catch(e){}wakeR=null}}

/* ---------- conversation ---------- */
const LIST_RE=/(ايه|إيه|ايش|اية|إية).*(مهام|ورايا|ورايه|عندي|عندى|مواعيد|المطلوب)|(مهامي|مواعيدي)/;
async function converse(first,woke){
 let text=first;
 if(!text){if(woke)await speak('أيوه، أنا سامعك');text=await listen('مثلاً: فكرني بعد نص ساعة أكلم محمد')}
 if(!text){heard('');return}
 heard('<b>إنت:</b> '+esc(text));
 const nb=smNorm(smBase(text));
 if(LIST_RE.test(nb)&&!/فكرني|ذكرني|نبهني/.test(nb)){const tom=/بكر[اه]|غدا/.test(nb);const d=tom?addDays(new Date(),1):new Date();const l=tasksOn(dk(d)).filter(t=>!t.done);
  const msg=l.length?(tom?'بكرة ':'النهارده ')+'عندك '+l.length+(l.length<11&&l.length>2?' مهام':' مهمة')+': '+l.map(t=>t.text+' '+sayTime(t.at)).join('، '):(tom?'بكرة':'النهارده')+' مفيش حاجة متسجلة';
  heard('<b>سمسم:</b> '+esc(msg));await speak(msg);return}
 let p=smParse(text);
 if(!p.text){await speak('أفكرك بإيه؟');const t2=await listen('أفكرك بإيه؟');if(!t2){heard('');return}const q=smParse(t2);p.text=q.text||t2;if(!p.at&&q.at){p.at=q.at;p.hasTime=q.hasTime;p.dayOnly=q.dayOnly}}
 if(!p.at){await speak('إمتى أفكرك؟');const t3=await listen('إمتى؟ مثلاً: بعد ساعة، بكرة الساعة ٥');const q=t3?smParse(t3):null;if(!q||!q.at){heard('<b>سمسم:</b> ملحقتش أفهم الوقت. قولها تاني أو اكتبها');await speak('معلش مفهمتش الوقت، قولها تاني');return}p.at=q.at;p.dayOnly=q.dayOnly;if(q.rep)p.rep=q.rep}
 const t=addTask({text:p.text,at:p.at,dayOnly:p.dayOnly,rep:p.rep,src:'voice'});
 const msg='تم التسجيل. هفكرك '+speakWhen(t)+'، '+t.text;
 heard('<b>سمسم:</b> '+esc('تمام، اتسجلت. هفكرك '+speakWhen(t)));
 if(S.set.confirm)await speak(msg);}

function addTask(o){const t={id:uid(),text:o.text.trim()||'تذكير',at:o.at,dayOnly:!!o.dayOnly,rep:o.rep||null,note:o.note||null,notePath:o.notePath||null,done:false,snz:0,src:o.src||'text',created:Date.now()};S.tasks.push(t);save();render();return t}

/* ---------- typing ---------- */
$('#sayF').addEventListener('submit',async e=>{e.preventDefault();const v=$('#sayI').value.trim();if(!v)return;const p=smParse(v);
 if(!p.text){toast('اكتب الحاجة اللي عايز تفتكرها');return}
 if(!p.at){p.at=Date.now()+30*6e4;toast('محددتش وقت، هفكرك بعد نص ساعة — تقدر تعدّل')}
 const t=addTask({text:p.text,at:p.at,dayOnly:p.dayOnly,rep:p.rep});$('#sayI').value='';toast('تم التسجيل '+speakWhen(t));if(S.set.confirm)speak('تم التسجيل')});
$('#talk').onclick=()=>{if(listening)return;unlockAudio();converse()};
const EX=['فكرني بعد نص ساعة أكلم محمد','فكرني كمان ساعتين أشتري عيش','فكرني بكرة الساعة ١٠ الصبح بالاجتماع','فكرني كل يوم الساعة ٩ بالليل أخد الدوا','فكرني يوم ١٥ ديسمبر عيد ميلاد مراتي','إيه ورايا النهارده؟'];
$('#ex').innerHTML=EX.map(x=>'<button type="button">'+esc(x)+'</button>').join('');
$('#ex').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(/ورايا/.test(b.textContent)){converse(b.textContent);return}$('#sayI').value=b.textContent;$('#sayI').focus()};

/* ---------- tasks helpers ---------- */
function tasksOn(k){return S.tasks.filter(t=>dk(t.at)===k).sort((a,b)=>a.at-b.at)}
function markDone(t,v=true){t.done=v;t.doneAt=v?Date.now():null;if(v&&t.rep)spawnNext(t);if(NATIVE)NP.dismiss({key:okey(t),id:hid(t.id)}).catch(()=>{});save();render()}
function spawnNext(t){if(t.nextMade)return;t.nextMade=true;const step=t.rep==='w'?7:1;let d=new Date(t.at);do{d=addDays(d,step)}while(d.getTime()<=Date.now());
 S.tasks.push({...t,id:uid(),at:d.getTime(),done:false,doneAt:null,snz:0,closed:false,missed:false,ringAt:null,nextMade:false,created:Date.now()})}
function snooze(t,min){t.at=Date.now()+min*6e4;t.snz=(t.snz||0)+1;t.ringAt=null;t.dayOnly=false;if(NATIVE)NP.dismiss({key:okey(t),id:hid(t.id)}).catch(()=>{});save();render()}
function delTask(t){S.tasks=S.tasks.filter(x=>x!==t);if(t.note)idbDel(t.note);if(NATIVE){NP.dismiss({key:okey(t),id:hid(t.id)}).catch(()=>{});if(t.notePath)NP.deleteAudio({path:t.notePath}).catch(()=>{})}save();render()}
const okey=t=>t.id+':'+t.at;
const findT=id=>S.tasks.find(t=>t.id===id);

/* ---------- home ---------- */
function greet(){const H=new Date().getHours();const g=H<12&&H>=4?'صباح الخير':'مساء الخير';return g+(S.set.name?' يا '+S.set.name:'')}
function tick(){const n=new Date();const H=n.getHours();$('#clk').innerHTML=AR(H%12||12)+':'+arD(pad(n.getMinutes()))+'<small>'+arD(pad(n.getSeconds()))+' '+(H<12?'ص':'م')+'</small>';
 $('#dte').textContent=WD[n.getDay()]+' '+AR(n.getDate())+' '+MONTHS[n.getMonth()]+' '+AR(n.getFullYear());$('#hdt').textContent=hijri(n);$('#greet').textContent=greet();
 dayClose();if(!NATIVE)engine();if(n.getSeconds()===0){render();applyTheme()}}
function taskRow(t){const late=!t.done&&t.at<Date.now();const meta=[];if(t.note)meta.push('🎙 فويس نوت');if(t.rep)meta.push(t.rep==='d'?'🔁 كل يوم':'🔁 كل أسبوع');if(t.snz)meta.push('اتأجل '+AR(t.snz)+' مرة');if(t.moved)meta.push('متنقّلة');
 return '<div class="task'+(t.done?' done':'')+(late?' late':'')+'" data-id="'+t.id+'"><button class="ck" data-a="done" aria-label="تم"></button><div class="tm">'+(t.dayOnly?'طول<small>اليوم</small>':showTime(t.at)+'<small>'+ampm(t.at)+'</small>')+'</div><div class="tx" data-a="edit"><b>'+esc(t.text)+'</b>'+(meta.length?'<small>'+meta.join(' · ')+'</small>':'')+'</div>'+
 (t.note?'<button class="ib" data-a="play" aria-label="شغّل"><svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg></button>':'')+
 (!t.done?'<button class="ib" data-a="snz" aria-label="تأجيل"><svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3L2 6M19 3l3 3"/></svg></button>':'')+'</div>'}
function emptyBox(msg){return '<div class="empty"><svg viewBox="0 0 512 512"><use href="#genie"/></svg><div>'+msg+'</div></div>'}
function render(){
 const tk=dk(new Date()),today=S.tasks.filter(t=>!t.closed&&(dk(t.at)===tk||(t.at<Date.now()&&!t.done&&!t.missed))).sort((a,b)=>a.at-b.at);
 const done=today.filter(t=>t.done).length,p=today.length?Math.round(done/today.length*100):0;
 $('#pr').style.setProperty('--p',p);$('#prT').textContent=AR(p)+'٪';
 $('#prS').textContent=today.length?'خلصت '+AR(done)+' من '+AR(today.length)+(today.length-done?' — فاضل '+AR(today.length-done):' — عاش 👏'):'مفيش مهام لسه';
 $('#today').innerHTML=today.length?today.map(taskRow).join(''):emptyBox('دوس "كلّم سمسم" وقوله يفكرك بإيه');
 const tm=tasksOn(dk(addDays(new Date(),1)));$('#tmN').textContent=tm.length?AR(tm.length)+' مهام':'';
 $('#tomorrow').innerHTML=tm.length?tm.map(taskRow).join(''):'<div class="muted">لسه مفيش حاجة لبكرة</div>';
 if($('#v-cal').classList.contains('on'))renderCal();if($('#v-rep').classList.contains('on'))renderRep()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b)return;const row=b.closest('[data-id]');if(!row)return;const t=findT(row.dataset.id);if(!t)return;const a=b.dataset.a;
 if(a==='done'){markDone(t,!t.done);if(t.done){toast('عاش!');}}
 else if(a==='edit')editSheet(t);else if(a==='play')playNote(t);
 else if(a==='snz'){openSheet('<h2>أأجّل "'+esc(t.text)+'"</h2><p class="muted">لـ إمتى؟</p><div class="snz" id="sz">'+S.set.snooze.map(m=>'<button data-m="'+m+'">'+minLabel(m)+'</button>').join('')+'</div><div class="row" style="margin-top:14px"><button class="btn ghost sp" id="szx">إلغاء</button></div>');
  $('#sz').onclick=e=>{const x=e.target.closest('[data-m]');if(!x)return;snooze(t,+x.dataset.m);closeSheet();toast('هفكرك بعد '+minLabel(+x.dataset.m))};$('#szx').onclick=closeSheet}});
function minLabel(m){return m<60?AR(m)+' دقيقة':m===60?'ساعة':m===90?'ساعة ونص':m===120?'ساعتين':m%60===0?AR(m/60)+' ساعات':AR(m)+' دقيقة'}

/* ---------- sheet / toast ---------- */
function openSheet(h){$('#sheetIn').innerHTML=h;$('#sheet').classList.add('on')}
function closeSheet(){$('#sheet').classList.remove('on');$('#sheetIn').innerHTML='';if(rec)stopRec(true)}
$('#sheet').addEventListener('click',e=>{if(e.target.id==='sheet')closeSheet()});
let toastT;function toast(m){$$('.toast').forEach(x=>x.remove());const d=document.createElement('div');d.className='toast';d.textContent=m;document.body.appendChild(d);clearTimeout(toastT);toastT=setTimeout(()=>d.remove(),3200)}
const toLocalInput=ms=>{const d=new Date(ms);return dk(d)+'T'+pad(d.getHours())+':'+pad(d.getMinutes())};

function editSheet(t){openSheet('<h2>تعديل التذكير</h2><div class="form"><input id="eT" value="'+esc(t.text)+'"><input id="eW" type="datetime-local" value="'+toLocalInput(t.at)+'"><select id="eR"><option value="">مرة واحدة</option><option value="d"'+(t.rep==='d'?' selected':'')+'>كل يوم</option><option value="w"'+(t.rep==='w'?' selected':'')+'>كل أسبوع</option></select>'+(t.note?'<button class="btn teal" id="eP">▶ اسمع الفويس نوت</button>':'')+
 '<div class="row"><button class="btn sp" id="eS">حفظ</button><button class="btn ghost" id="eD" style="color:var(--warn)">حذف</button></div></div>');
 $('#eS').onclick=()=>{const w=new Date($('#eW').value).getTime();if(NATIVE)NP.dismiss({key:okey(t),id:hid(t.id)}).catch(()=>{});t.text=$('#eT').value.trim()||t.text;if(w){t.at=w;t.dayOnly=false;t.ringAt=null;t.done=false;t.closed=false;t.missed=false}t.rep=$('#eR').value||null;save();render();closeSheet();toast('اتحفظ')};
 $('#eD').onclick=()=>{delTask(t);closeSheet();toast('اتحذف')};if($('#eP'))$('#eP').onclick=()=>playNote(t)}

/* ---------- voice notes ---------- */
let db=null;
function idb(){return db?Promise.resolve(db):new Promise((res,rej)=>{const r=indexedDB.open('smsm',1);r.onupgradeneeded=()=>r.result.createObjectStore('notes');r.onsuccess=()=>{db=r.result;res(db)};r.onerror=()=>rej(r.error)})}
async function idbPut(k,v){const d=await idb();return new Promise(r=>{const tx=d.transaction('notes','readwrite');tx.objectStore('notes').put(v,k);tx.oncomplete=()=>r()})}
async function idbGet(k){const d=await idb();return new Promise(r=>{const q=d.transaction('notes').objectStore('notes').get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>r(null)})}
async function idbDel(k){try{const d=await idb();d.transaction('notes','readwrite').objectStore('notes').delete(k)}catch(e){}}
let curAudio=null;
async function playNote(t,el){if(curAudio){try{curAudio.pause()}catch(e){}}
 if(NATIVE&&t.notePath&&(!t.note||t.note==='file')){NP.playFile({path:t.notePath}).catch(()=>toast('الفويس نوت مش موجودة'));return}
 const b=await idbGet(t.note);if(!b){if(NATIVE&&t.notePath){NP.playFile({path:t.notePath}).catch(()=>{});return}toast('الفويس نوت مش موجودة');return}const u=URL.createObjectURL(b);
 if(el){el.innerHTML='<audio controls autoplay src="'+u+'"></audio>';curAudio=el.querySelector('audio');curAudio.play().catch(()=>{})}else{curAudio=new Audio(u);curAudio.play().catch(()=>toast('دوس تاني عشان يشتغل'))}}
let rec=null,recChunks=[],recT=0,recTimer=null,recStream=null,recSR=null,recText='';
$('#noteBtn').onclick=()=>noteFlow();
/* voice note: record + understand the words, so "فكرني أشتري عيش كمان ساعة" sets the time by itself */
async function noteFlow(dayKey){unlockAudio();
 if(NATIVE){let r=null;try{r=await NP.listenNote({language:'ar-EG',prompt:'قول الفويس نوت… مثلاً: فكرني أشتري عيش كمان ساعة'})}catch(e){r=null}
  if(r){if(r.cancel)return;if(!r.text&&!r.path){toast('مسمعتش حاجة، جرّب تاني');return}return noteResult(r.text||'',null,r.path||null,dayKey)}}
 if(!navigator.mediaDevices||!window.MediaRecorder){toast('الجهاز ده مش بيدعم التسجيل');return}
 try{recStream=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){toast('محتاج إذن الميكروفون عشان أسجّل');return}
 stopWake();const mt=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg'].find(m=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(m))||'';
 rec=new MediaRecorder(recStream,mt?{mimeType:mt}:undefined);recChunks=[];recText='';rec.ondataavailable=e=>{if(e.data.size)recChunks.push(e.data)};
 rec.onstop=async()=>{recStream.getTracks().forEach(x=>x.stop());clearInterval(recTimer);const cancel=rec&&rec._cancel;const type=rec.mimeType||'audio/webm';rec=null;
  const txt=await stopRecSR();if(cancel)return;const blob=new Blob(recChunks,{type});noteResult(txt,blob,null,dayKey)};
 rec.start();recT=0;openSheet('<h2>بسجّل… اتكلم براحتك</h2><div class="rec"><i></i><span id="recS">٠:٠٠</span></div><div class="heard" id="recTx" style="min-height:44px;text-align:center">قول مثلاً: فكرني أشتري عيش كمان ساعة</div><p class="muted" style="text-align:center">لو قلت الوقت جوه الكلام هظبطه لوحدي. لما تخلص دوس "خلصت".</p><div class="row"><button class="btn teal sp" id="recStop">خلصت</button><button class="btn ghost" id="recX">إلغاء</button></div>');
 if(WebSR){try{recSR=new WebSR();recSR.lang='ar-EG';recSR.continuous=true;recSR.interimResults=true;let fin='';
  recSR.onresult=e=>{let t='';fin='';for(const x of e.results){if(x.isFinal)fin+=x[0].transcript+' ';else t+=x[0].transcript}recText=(fin+t).trim();const el=$('#recTx');if(el)el.textContent=recText||'…'};
  recSR.onerror=()=>{};recSR._done=new Promise(r=>{recSR.onend=r});recSR.start()}catch(e){recSR=null}}
 recTimer=setInterval(()=>{recT++;const el=$('#recS');if(el)el.textContent=AR(Math.floor(recT/60))+':'+arD(pad(recT%60));if(recT>=180)stopRec()},1000);
 $('#recStop').onclick=()=>stopRec();$('#recX').onclick=()=>{stopRec(true);closeSheet()}}
async function stopRecSR(){if(!recSR)return recText;const r=recSR;recSR=null;try{r.stop()}catch(e){}await Promise.race([r._done,new Promise(x=>setTimeout(x,1500))]);return recText}
function stopRec(cancel){if(!rec)return;rec._cancel=!!cancel;try{rec.stop()}catch(e){}}
function parseFor(text,dayKey){const q=smParse(text,Date.now());if(!q.at)return q;
 if(dayKey&&dayKey!==dk(new Date())&&dk(q.at)!==dayKey){const x=new Date(q.at),y=fromDk(dayKey);y.setHours(q.hasTime?x.getHours():9,q.hasTime?x.getMinutes():0,0,0);q.at=y.getTime();q.dayOnly=!q.hasTime}return q}
async function saveNote(o){let note=null,path=o.path||null;
 if(o.blob){note='n'+uid();await idbPut(note,o.blob);if(NATIVE&&!path){try{const b64=await blobB64(o.blob);const r=await NP.saveAudio({name:note+(o.blob.type.includes('mp4')?'.m4a':o.blob.type.includes('ogg')?'.ogg':'.webm'),data:b64});path=r.path}catch(e){}}}
 else if(path)note='file';
 const t=addTask({text:o.text||'فويس نوت',at:o.at,dayOnly:o.dayOnly,rep:o.rep,note,notePath:path,src:'note'});
 const m='تم التسجيل. هفكرك '+speakWhen(t)+(t.text!=='فويس نوت'?'، '+t.text:'');toast('تمام، هفكرك '+speakWhen(t)+(note?' بالفويس نوت':''));if(S.set.confirm)speak(m);return t}
async function noteResult(text,blob,path,dayKey){closeSheet();
 if(text)heard('<b>سمعتك:</b> '+esc(text));
 const q=text?parseFor(text,dayKey):null;
 if(q&&q.at){await saveNote({text:q.text||'فويس نوت',at:q.at,dayOnly:q.dayOnly,rep:q.rep,blob,path});if(!blob&&!path)toast('اتسجّل كلامك كتذكير');return}
 noteWhen(blob,path,dayKey,q&&q.text?q.text:text)}
function noteWhen(blob,path,dayKey,text){const u=blob?URL.createObjectURL(blob):null;const base=dayKey?fromDk(dayKey):new Date();const isToday=!dayKey||dayKey===dk(new Date());
 const chips=isToday?[[15,'بعد ربع ساعة'],[30,'بعد نص ساعة'],[60,'بعد ساعة'],[120,'بعد ساعتين'],[180,'بعد ٣ ساعات'],['tm9','بكرة ٩ الصبح']]:[['d9','٩ الصبح'],['d13','١ الضهر'],['d17','٥ العصر'],['d21','٩ بالليل']];
 const def=isToday?Date.now()+60*6e4:new Date(base.getFullYear(),base.getMonth(),base.getDate(),9).getTime();
 openSheet('<h2>تمام! أفكرك بيها إمتى؟</h2><p class="muted">مسمعتش وقت في كلامك، اختاره من هنا:</p>'+(u?'<audio controls src="'+u+'"></audio>':path?'<button class="btn ghost" id="nP">▶ اسمع الفويس نوت</button>':'')+'<div class="form"><input id="nT" placeholder="اسم للتذكير (اختياري)" value="'+esc(text||'')+'"><div class="snz" id="nC">'+chips.map(c=>'<button data-c="'+c[0]+'">'+c[1]+'</button>').join('')+'</div><input id="nW" type="datetime-local" value="'+toLocalInput(def)+'">'+(canListen()?'<button class="btn ghost" id="nV">🎤 قول الوقت بصوتك</button>':'')+'<div class="row"><button class="btn teal sp" id="nS">سجّل التذكير</button><button class="btn ghost" id="nX">إلغاء</button></div></div>');
 if($('#nP'))$('#nP').onclick=()=>NP.playFile({path}).catch(()=>{});
 $('#nC').onclick=e=>{const b=e.target.closest('[data-c]');if(!b)return;$$('#nC button').forEach(x=>x.classList.toggle('on',x===b));const c=b.dataset.c;let at;
  if(c==='tm9'){const d=addDays(new Date(),1);d.setHours(9,0,0,0);at=d.getTime()}else if(c[0]==='d'){const d=new Date(base);d.setHours(+c.slice(1),0,0,0);at=d.getTime()}else at=Date.now()+(+c)*6e4;$('#nW').value=toLocalInput(at)};
 if($('#nV'))$('#nV').onclick=async()=>{const t=await listen('إمتى أفكرك؟');const q=t?smParse(t,Date.now()):null;if(q&&q.at){$('#nW').value=toLocalInput(q.at);if(q.text&&!$('#nT').value)$('#nT').value=q.text;toast('تمام: '+dayWord(q.at)+' '+sayTime(q.at))}else toast('مفهمتش الوقت، اختاره من تحت')};
 $('#nX').onclick=closeSheet;
 $('#nS').onclick=async()=>{const at=new Date($('#nW').value).getTime();if(!at){toast('اختار الوقت');return}closeSheet();await saveNote({text:$('#nT').value.trim()||'فويس نوت',at,blob,path})}}
const blobB64=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(String(f.result).split(',')[1]);f.readAsDataURL(b)});

/* ---------- reminder engine (browser / PC) ---------- */
let popT=null;
function engine(){if(popT&&$('#pop').classList.contains('on')){const t=findT(popT);if(!t||t.done){hidePop();return}
  if(Date.now()-(t.ringAt||0)>=S.set.repeat*6e4){t.ringAt=Date.now();save();ring(t)}return}
 const now=Date.now();const due=S.tasks.filter(t=>!t.done&&!t.closed&&!t.missed&&t.at<=now&&t.at>now-12*3600e3&&(!t.ringAt||now-t.ringAt>=S.set.repeat*6e4)).sort((a,b)=>a.at-b.at)[0];
 if(due){due.ringAt=now;save();showPop(due);ring(due)}}
function ring(t){const msg=remLine(t);if(document.hidden&&'Notification'in window&&Notification.permission==='granted'){try{const n=new Notification('سمسم بيفكرك',{body:t.text,icon:'icon-192.png',tag:t.id,requireInteraction:true});n.onclick=()=>{window.focus();n.close()}}catch(e){}}
 if(t.note){speak(msg).then(()=>{const el=$('#popAud');if(el)playNote(t,el)})}else speak(msg)}
function showPop(t){popT=t.id;const late=Math.round((Date.now()-t.at)/6e4);
 $('#pop').innerHTML='<div class="pc"><div class="ph"><svg viewBox="0 0 512 512"><use href="#genie"/></svg><p>سمسم بيفكرك</p></div><div class="pb"><div class="muted">بفكرك بـ</div><h2>'+esc(t.text)+'</h2><div class="tl">'+(t.dayOnly?'النهارده':showTime(t.at)+' '+ampm(t.at))+(late>1?' — من '+AR(late)+' دقيقة':'')+(t.snz?' · اتأجل '+AR(t.snz)+' مرة':'')+'</div><div id="popAud"></div>'+
 '<div class="pact"><button class="btn ok" id="pOk">تم</button><div class="muted">أو أجّل:</div><div class="snz">'+S.set.snooze.map(m=>'<button data-m="'+m+'">'+minLabel(m)+'</button>').join('')+'</div></div></div></div>';
 $('#pop').classList.add('on');if(t.note)playNote(t,$('#popAud'));
 $('#pOk').onclick=()=>{markDone(t);hidePop();speak('عاش يا بطل');};
 $('#pop').querySelector('.snz').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;snooze(t,+b.dataset.m);hidePop();toast('هفكرك تاني بعد '+minLabel(+b.dataset.m))}}
function hidePop(){$('#pop').classList.remove('on');popT=null;if(curAudio)curAudio.pause();if('speechSynthesis'in window)speechSynthesis.cancel()}
let unlocked=false;function unlockAudio(){if(unlocked)return;unlocked=true;try{const a=new Audio();a.muted=true;a.play().catch(()=>{})}catch(e){}if('Notification'in window&&Notification.permission==='default')Notification.requestPermission().catch(()=>{})}

/* ---------- native schedule ---------- */
function nsched(){if(!NATIVE)return;setTimeout(ensureClips,50);const now=Date.now(),items=[];
 S.tasks.filter(t=>!t.done&&!t.closed&&!t.missed&&t.at>now-12*3600e3).sort((a,b)=>a.at-b.at).slice(0,120).forEach(t=>{
  items.push({id:hid(t.id),key:okey(t),task:t.id,time:Math.max(t.at,now+3000),exp:t.at+12*3600e3,title:'سمسم بيفكرك',body:t.text,persistent:true,repeat:S.set.repeat,
   sound:t.notePath?'note':(S.set.voice?'tts':'none'),file:t.notePath||'',speech:egSay(remLine(t)),speechFile:(t.vclip&&t.vclip.line===egSay(remLine(t)))?t.vclip.path:'',voice:S.set.voiceName||'',
   when:t.dayOnly?'النهارده':showTime(t.at)+' '+ampm(t.at),snooze:S.set.snooze,snDef:S.set.snDef,rate:S.set.rate,kind:'task'})});
 // day close
 const b=boundary(addDays(fromDk(logicalDay()),1));const left=S.tasks.filter(t=>!t.done&&!t.closed&&!t.missed&&t.at<b.getTime()).length;
 items.push({id:hid('close'+dk(b)),key:'close:'+dk(b),time:b.getTime()+5000,exp:b.getTime()+6*3600e3,title:'سمسم — تقرير اليوم',body:left?'فاضل '+left+' مهام ما خلصتش. تنقلها لبكرة؟':'خلّصت كل مهام النهارده 👏',persistent:false,repeat:0,sound:S.set.voice?'tts':'none',
  speech:egSay('خلص اليوم'+(S.set.name?' يا '+S.set.name:'')+'. '+(left?'فاضل '+left+' مهام ما خلصتش. افتح سمسم تشوف التقرير وتنقلها لبكرة':'خلصت كل مهام النهارده، عاش')),kind:'close',rate:S.set.rate,voice:S.set.voiceName||''});
 NP.schedule({items}).catch(()=>{})}
async function nativeAcks(){if(!NATIVE)return;try{const r=await NP.getAcks();(r.acks||[]).forEach(applyAck);save();render()}catch(e){}}
function applyAck(a){if(!a||!a.key)return;if(a.key.startsWith('close:')){if(a.act==='open')go('rep');return}const id=a.key.split(':')[0],t=findT(id);if(!t)return;
 if(a.act==='done'&&!t.done){t.done=true;t.doneAt=a.at||Date.now();if(t.rep)spawnNext(t)}
 else if(a.act==='snooze'&&a.key===okey(t)){t.at=(a.at||Date.now())+(a.min||10)*6e4;t.snz=(t.snz||0)+1;t.ringAt=null;t.dayOnly=false}
 else if(a.act==='open')editSheet(t)}

/* ---------- day close & report ---------- */
function logicalDay(){return dk(new Date(Date.now()-S.set.closeH*3600e3))}
function boundary(dayDate){const d=new Date(dayDate);d.setHours(S.set.closeH,0,0,0);return d}
function dayClose(){const L=logicalDay();if(!S.lastDay){S.lastDay=L;save();return}if(S.lastDay>=L)return;
 const b=boundary(fromDk(L)).getTime();const prev=S.lastDay;S.lastDay=L;
 const inDay=S.tasks.filter(t=>!t.closed&&t.at<b);if(!inDay.length){save();return}
 const done=inDay.filter(t=>t.done),left=inDay.filter(t=>!t.done);
 inDay.forEach(t=>{t.closed=true;if(!t.done&&t.rep)spawnNext(t)});
 const rp={day:dk(addDays(fromDk(L),-1)),done:done.map(t=>({text:t.text,at:t.at})),left:left.map(t=>({id:t.id,text:t.text,at:t.at,dayOnly:t.dayOnly})),ask:left.filter(t=>!t.rep).length>0,closedAt:Date.now()};
 addReport(rp);
 const cut=Date.now()-90*864e5;S.tasks=S.tasks.filter(t=>!(t.closed&&t.at<cut));save();render();
 const R=S.reports.find(r=>r.day===rp.day);if(R&&R.ask)setTimeout(()=>showReport(R,true),900)}
function showReport(rp,fresh){const all=rp.done.length+rp.left.length,p=all?Math.round(rp.done.length/all*100):0;const d=fromDk(rp.day);const tgtK=rp.day>=logicalDay()?dk(addDays(fromDk(logicalDay()),1)):logicalDay();const movable=rp.left.filter(x=>{const t=findT(x.id);return t&&!t.done&&!t.rep&&!t.movedTo});
 openSheet('<h2>تقرير '+(rp.day===dk(addDays(new Date(),-1))?'امبارح':WD[d.getDay()]+' '+AR(d.getDate())+' '+MONTHS[d.getMonth()])+'</h2><p class="muted">خلصت '+AR(rp.done.length)+' من '+AR(all)+' ('+AR(p)+'٪)</p><div class="bar"><i style="width:'+p+'%"></i></div>'+
 (rp.done.length?'<h3 style="margin-top:14px;color:var(--ok)">اتعملت</h3>'+rp.done.map(x=>'<div class="muted">• '+esc(x.text)+'</div>').join(''):'')+
 (rp.left.length?'<h3 style="margin-top:12px;color:var(--warn)">✗ ما اتعملتش</h3>'+rp.left.map(x=>'<label class="row muted" style="padding:4px 0"><input type="checkbox" class="mv" value="'+x.id+'"'+(movable.find(m=>m.id===x.id)?' checked':' disabled')+'> '+esc(x.text)+'</label>').join(''):'')+
 (movable.length?'<div class="card" style="background:var(--soft);border:0"><b>هل تريد نقل المهام التي لم يتم إنجازها '+(tgtK===dk(addDays(new Date(),1))?'لبكرة':'للنهارده')+'؟</b><div class="muted">هتتنقل على يوم '+WD[fromDk(tgtK).getDay()]+' '+AR(fromDk(tgtK).getDate())+' '+MONTHS[fromDk(tgtK).getMonth()]+' بنفس مواعيدها</div><div class="row" style="margin-top:10px"><button class="btn sp" id="mvY">أيوه، انقلها</button><button class="btn ghost" id="mvN">لا</button></div></div>':'<div class="row" style="margin-top:14px"><button class="btn sp" id="mvN">تمام</button></div>'));
 if(fresh&&movable.length)speak('خلص اليوم. فاضل '+movable.length+' مهام ما اتعملتش. تحب أنقلها لبكرة؟');
 if($('#mvY'))$('#mvY').onclick=()=>{const ids=$$('.mv:checked').map(x=>x.value);const target=fromDk(tgtK);let n=0;
  ids.forEach(id=>{const t=findT(id);if(!t||t.done||t.rep)return;const o=new Date(t.at),nd=new Date(target);nd.setHours(t.dayOnly?9:o.getHours(),t.dayOnly?0:o.getMinutes(),0,0);
   const c={...t,id:uid(),at:nd.getTime(),closed:false,missed:false,done:false,ringAt:null,snz:0,moved:true,created:Date.now()};S.tasks.push(c);t.movedTo=c.id;n++});
  rp.ask=false;save();render();closeSheet();toast('اتنقلت '+AR(n)+' مهام');speak('تمام، نقلتهم')};
 $('#mvN').onclick=()=>{rp.ask=false;rp.left.forEach(x=>{const t=findT(x.id);if(t&&!t.movedTo)t.missed=true});save();closeSheet()}}

/* ---------- calendar ---------- */
let calY=new Date().getFullYear(),calM=new Date().getMonth(),calSel=dk(new Date()),calYear=false;
const countMap=()=>{const m={};S.tasks.forEach(t=>{const k=dk(t.at);m[k]=(m[k]||0)+1});return m};
function renderCal(){const cm=countMap();$('#calMode').textContent=calYear?'عرض الشهر':'السنة كلها';
 if(calYear){let h='<div class="row" style="margin:14px 0"><button class="btn ghost sm" id="cyP">›</button><h2 class="sp" style="text-align:center">'+AR(calY)+'</h2><button class="btn ghost sm" id="cyN">‹</button></div><div class="yr">';
  for(let m=0;m<12;m++){const f=new Date(calY,m,1),off=(f.getDay()+1)%7,n=new Date(calY,m+1,0).getDate();h+='<button class="mm" data-m="'+m+'"><b>'+MONTHS[m]+'</b><div class="g">'+'<i></i>'.repeat(off);
   for(let d=1;d<=n;d++){const k=calY+'-'+pad(m+1)+'-'+pad(d);h+='<i class="'+(cm[k]?'has ':'')+(k===dk(new Date())?'td':'')+'">'+AR(d)+'</i>'}h+='</div></button>'}
  $('#calBody').innerHTML=h+'</div><div style="height:20px"></div>';$('#cyP').onclick=()=>{calY--;renderCal()};$('#cyN').onclick=()=>{calY++;renderCal()};
  $$('.mm').forEach(b=>b.onclick=()=>{calM=+b.dataset.m;calYear=false;calSel=calY+'-'+pad(calM+1)+'-01';renderCal()});return}
 const f=new Date(calY,calM,1),off=(f.getDay()+1)%7,n=new Date(calY,calM+1,0).getDate();
 let h='<div class="row" style="margin:14px 0 8px"><button class="btn ghost sm" id="cmP">›</button><div class="sp" style="text-align:center"><h2>'+MONTHS[calM]+' '+AR(calY)+'</h2><div class="muted">'+hijri(new Date(calY,calM,15)).replace(/^\S+\s/,'')+'</div></div><button class="btn ghost sm" id="cmN">‹</button></div><div class="cal">'+['سبت','حد','اتنين','تلات','أربع','خميس','جمعة'].map(x=>'<div class="hd">'+x+'</div>').join('')+'<div></div>'.repeat(off);
 for(let d=1;d<=n;d++){const k=calY+'-'+pad(calM+1)+'-'+pad(d);h+='<button data-k="'+k+'" class="'+(k===dk(new Date())?'td ':'')+(k===calSel?'sel':'')+'">'+AR(d)+(cm[k]?'<span class="dot"></span>':'')+'</button>'}
 h+='</div>';const sd=fromDk(calSel),l=tasksOn(calSel);
 h+='<div class="card"><div class="ch"><div><h3>'+WD[sd.getDay()]+' '+AR(sd.getDate())+' '+MONTHS[sd.getMonth()]+' '+AR(sd.getFullYear())+'</h3><div class="muted">'+hijri(sd)+'</div></div><button class="btn sm ghost" id="cToday">النهارده</button></div><div style="margin-top:8px">'+(l.length?l.map(taskRow).join(''):'<div class="muted">مفيش تذكيرات في اليوم ده</div>')+'</div>'+
 '<div class="form"><input id="cT" placeholder="اكتب التذكير… مثلاً: عيد ميلاد مراتي"><div class="row"><input id="cW" type="time" value="09:00" style="flex:1"><select id="cR" style="flex:1"><option value="">مرة واحدة</option><option value="d">كل يوم</option><option value="w">كل أسبوع</option></select></div><div class="row"><button class="btn sp" id="cA">سجّل في اليوم ده</button>'+(canListen()?'<button class="btn ghost" id="cV" aria-label="قول">🎤</button>':'')+'<button class="btn teal" id="cN" aria-label="فويس نوت">🎙</button></div></div></div><div style="height:20px"></div>';
 $('#calBody').innerHTML=h;
 $('#cmP').onclick=()=>{calM--;if(calM<0){calM=11;calY--}renderCal()};$('#cmN').onclick=()=>{calM++;if(calM>11){calM=0;calY++}renderCal()};
 $$('.cal [data-k]').forEach(b=>b.onclick=()=>{calSel=b.dataset.k;renderCal()});
 $('#cToday').onclick=()=>{const n=new Date();calY=n.getFullYear();calM=n.getMonth();calSel=dk(n);renderCal()};
 $('#cA').onclick=()=>{const tx=$('#cT').value.trim();if(!tx){toast('اكتب التذكير الأول');return}const[H,M]=($('#cW').value||'09:00').split(':').map(Number);const d=fromDk(calSel);d.setHours(H,M,0,0);
  const t=addTask({text:tx,at:d.getTime(),rep:$('#cR').value||null,src:'cal'});toast('اتسجّل '+dayWord(t.at)+' '+sayTime(t.at));if(S.set.confirm)speak('تم التسجيل')};
 if($('#cV'))$('#cV').onclick=async()=>{const t=await listen('قول التذكير ووقته');if(!t)return;const d=fromDk(calSel);d.setHours(12);const p=smParse(t,d.getTime()-12*3600e3+1);let at=p.at;
  if(!at||dk(at)!==calSel){const x=new Date(at||d);const y=fromDk(calSel);y.setHours(p.hasTime?x.getHours():9,p.hasTime?x.getMinutes():0,0,0);at=y.getTime()}
  if(!p.text){toast('مفهمتش التذكير، اكتبه');return}const tk=addTask({text:p.text,at,rep:p.rep,src:'voice'});const m='تم التسجيل. هفكرك '+dayWord(tk.at)+' '+sayTime(tk.at);toast(m);if(S.set.confirm)speak(m)};
 $('#cN').onclick=()=>noteFlow(calSel)}
$('#calMode').onclick=()=>{calYear=!calYear;renderCal()};

/* ---------- reports ---------- */
function renderRep(){const L=S.reports;const last7=[];for(let i=7;i>=1;i--){const k=dk(addDays(new Date(),-i));const r=L.find(x=>x.day===k);last7.push({k,r})}
 const tot=L.slice(0,30).reduce((a,r)=>[a[0]+r.done.length,a[1]+r.done.length+r.left.length],[0,0]);
 let h='<div class="card"><h3>آخر ٧ أيام</h3><div style="display:flex;gap:8px;align-items:flex-end;height:130px;margin-top:12px">'+last7.map(({k,r})=>{const a=r?r.done.length+r.left.length:0,p=a?r.done.length/a:0;const d=fromDk(k);
  return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end"><small class="muted">'+(a?AR(Math.round(p*100))+'٪':'')+'</small><div style="width:100%;max-width:34px;height:'+(a?Math.max(8,p*90):4)+'px;border-radius:8px;background:'+(a?'linear-gradient(var(--pri2),var(--pri))':'var(--soft)')+'"></div><small class="muted">'+['حد','اتنين','تلات','أربع','خميس','جمعة','سبت'][d.getDay()]+'</small></div>'}).join('')+'</div>'+
  '<p class="muted" style="margin:10px 0 0">آخر ٣٠ يوم: خلصت '+AR(tot[0])+' من '+AR(tot[1])+' مهمة'+(tot[1]?' ('+AR(Math.round(tot[0]/tot[1]*100))+'٪)':'')+'</p></div>';
 h+='<div class="card"><div class="ch"><h3>النهارده لحد دلوقتي</h3><button class="btn sm ghost" id="rNow">اقفل اليوم دلوقتي</button></div>';
 const tk=dk(new Date()),td=S.tasks.filter(t=>!t.closed&&dk(t.at)<=tk);const dn=td.filter(t=>t.done).length;h+='<p class="muted">خلصت '+AR(dn)+' من '+AR(td.length)+'</p><div class="bar"><i style="width:'+(td.length?dn/td.length*100:0)+'%"></i></div></div>';
 h+='<div class="card"><h3>الأيام اللي فاتت</h3>'+(L.length?L.slice(0,60).map((r,i)=>{const a=r.done.length+r.left.length,p=a?Math.round(r.done.length/a*100):0;const d=fromDk(r.day);
  return '<button class="rep" data-r="'+i+'" style="width:100%;text-align:start"><div class="row"><b class="sp">'+WD[d.getDay()]+' '+AR(d.getDate())+' '+MONTHS[d.getMonth()]+'</b><span class="muted">'+AR(r.done.length)+'/'+AR(a)+'</span>'+(r.ask?'<span style="color:var(--peach)">● نقل؟</span>':'')+'</div><div class="bar" style="margin-top:6px"><i style="width:'+p+'%"></i></div></button>'}).join(''):'<div class="muted">أول تقرير هيظهر بعد ١٢ بالليل</div>')+'</div><div style="height:20px"></div>';
 $('#repBody').innerHTML=h;$$('#repBody [data-r]').forEach(b=>b.onclick=()=>showReport(S.reports[+b.dataset.r]));
 $('#rNow').onclick=()=>{if(confirmBox('اقفل مهام النهارده وطلّع التقرير دلوقتي؟'))forceClose()}}
function confirmBox(m){return window.confirm(m)}
function forceClose(){const L=logicalDay(),b=Date.now()+1;const inDay=S.tasks.filter(t=>!t.closed&&dk(t.at)<=L&&(t.at<b||dk(t.at)===L));if(!inDay.length){toast('مفيش مهام تتقفل');S.lastDay=L;save();return}
 const done=inDay.filter(t=>t.done),left=inDay.filter(t=>!t.done);inDay.forEach(t=>{t.closed=true;if(!t.done&&t.rep)spawnNext(t)});
 let rp={day:L,done:done.map(t=>({text:t.text,at:t.at})),left:left.map(t=>({id:t.id,text:t.text,at:t.at,dayOnly:t.dayOnly})),ask:left.filter(t=>!t.rep).length>0,closedAt:Date.now()};
 S.lastDay=L;rp=addReport(rp);save();render();showReport(rp,true)}
function addReport(rp){const ex=S.reports.find(r=>r.day===rp.day);if(ex){ex.done=ex.done.concat(rp.done);ex.left=ex.left.concat(rp.left);ex.ask=ex.ask||rp.ask;ex.closedAt=rp.closedAt;return ex}S.reports.unshift(rp);S.reports.sort((a,b)=>a.day<b.day?1:-1);S.reports=S.reports.slice(0,400);return rp}

/* ---------- settings ---------- */
const SN_ALL=[5,10,15,20,30,45,60,120,180];
async function renderSet(){const s=S.set;let h='<div class="card"><h3>عنك</h3><div class="set"><label>اسمك<small>سمسم هيناديك بيه</small></label><input type="text" id="sName" value="'+esc(s.name)+'" placeholder="مثلاً: سعادة" style="width:160px"></div></div>'+
 '<div class="card"><h3>التأجيل</h3><div class="set" style="display:block"><label>المدد اللي تظهر في زرار التأجيل</label><div class="snz" id="sSn" style="margin-top:8px">'+SN_ALL.map(m=>'<button class="'+(s.snooze.includes(m)?'on':'')+'" data-m="'+m+'">'+minLabel(m)+'</button>').join('')+'</div></div>'+
 '<div class="set"><label>لو ما ردّيتش، يرن تاني كل<small>لحد ما تدوس تم أو تأجيل</small></label><select id="sRep">'+[1,2,3,5,10,15].map(m=>'<option value="'+m+'"'+(s.repeat===m?' selected':'')+'>'+AR(m)+' دقيقة</option>').join('')+'</select></div>'+
 (NATIVE?'<div class="set"><label>التأجيل من الإشعار نفسه<small>زرار "أجّل" في الإشعار</small></label><select id="sSd">'+s.snooze.map(m=>'<option value="'+m+'"'+(s.snDef===m?' selected':'')+'>'+minLabel(m)+'</option>').join('')+'</select></div>':'')+'</div>'+
 '<div class="card"><h3>قفل اليوم</h3><div class="set"><label>اليوم بيتقفل الساعة<small>وبعدها يطلع التقرير ويسألك تنقل اللي فاضل لبكرة</small></label><select id="sClose">'+[0,1,2,3].map(h=>'<option value="'+h+'"'+(s.closeH===h?' selected':'')+'>'+(h?AR(h)+' بالليل':'١٢ بالليل')+'</option>').join('')+'</select></div></div>'+
 '<div class="card"><h3>الصوت والكلام</h3><div class="set"><label>سمسم يتكلم<small>يقول "بفكرك بـ…" و"تم التسجيل"</small></label><input type="checkbox" class="sw" id="sVoice"'+(s.voice?' checked':'')+'></div>'+
 '<div class="set"><label>يقول "تم التسجيل" بعد كل تذكير</label><input type="checkbox" class="sw" id="sConf"'+(s.confirm?' checked':'')+'></div>'+
 '<div class="set"><label>سرعة الكلام</label><input type="range" id="sRate" min="0.6" max="1.4" step="0.1" value="'+s.rate+'" style="width:150px"></div>'+
 (!NATIVE&&WebSR?'<div class="set"><label>"يا سمسم" وهو مفتوح<small>على الكمبيوتر: قول "يا سمسم" وبعدها الكلام من غير ما تدوس حاجة</small></label><input type="checkbox" class="sw" id="sWake"'+(s.wake?' checked':'')+'></div>':'')+
 '<div class="set"><label>صوت الموبايل<small>جرّب الأصوات العربي واختار أحسنها</small></label><select id="sVc" style="max-width:200px"><option value="">تلقائي</option></select></div>'+'<div class="set"><label>جرّب الصوت</label><button class="btn sm ghost" id="sTry">اسمع</button></div>'+'<div class="set" style="display:block"><label>صوت مصري طبيعي (اختياري)<small>أصوات الموبايل عربي فصحى. لو عايز صوت مصري حقيقي (سلمى أو شاكر من مايكروسوفت) حط مفتاح Azure Speech المجاني هنا. من غيره سمسم هيشتغل عادي بصوت الموبايل.</small></label><div class="form"><input id="azK" placeholder="Azure Speech key" value="'+esc(s.az&&s.az.key||'')+'" dir="ltr"><div class="row"><input id="azR" placeholder="region مثلاً uaenorth" value="'+esc(s.az&&s.az.region||'')+'" dir="ltr" style="flex:1"><select id="azV" style="flex:1"><option value="ar-EG-SalmaNeural">سلمى (ست)</option><option value="ar-EG-ShakirNeural"'+(s.az&&s.az.voice==='ar-EG-ShakirNeural'?' selected':'')+'>شاكر (راجل)</option></select></div><div class="row"><button class="btn sm sp" id="azS">احفظ وجرّب</button>'+(s.az&&s.az.key?'<button class="btn sm ghost" id="azD">إلغاء الصوت المصري</button>':'')+'</div></div></div>'+(NATIVE?'<div class="set"><label>صوت الكلام العربي<small>لو الصوت مش عربي نزّل اللغة العربية من إعدادات تحويل النص لكلام</small></label><button class="btn sm ghost" data-o="tts">افتح</button></div>':'')+'</div>'+
 '<div class="card"><h3>الشكل</h3><div class="set"><label>الوضع<small>تقدر كمان تبدّل من زرار ☀️/🌙 فوق في الرئيسية</small></label><select id="sTheme"><option value="auto">تلقائي (نهاري الصبح وليلي بالليل)</option><option value="light"'+(s.theme==='light'?' selected':'')+'>نهاري ☀️</option><option value="dark"'+(s.theme==='dark'?' selected':'')+'>ليلي 🌙</option></select></div></div>'+
 '<div class="card" id="permCard"></div>'+
 '<div class="card"><h3>تجربة</h3><div class="set"><label>جرّب تذكير بعد ١٠ ثواني<small>عشان تشوف الـ Pop-up والصوت'+(NATIVE?' — اقفل الشاشة واستنى':'')+'</small></label><button class="btn sm" id="sTest">جرّب</button></div></div>'+
 '<div class="card"><h3>نسخة احتياطية</h3><div class="row" style="margin-top:8px"><button class="btn sm ghost" id="sExp">صدّر</button><button class="btn sm ghost" id="sImp">استورد</button><button class="btn sm ghost" id="sClr" style="color:var(--warn)">امسح المهام المنتهية</button></div><textarea id="sBox" placeholder="البيانات هتظهر هنا…" hidden></textarea></div><footer class="brand">سمسم — تطوير <b>BeSoft</b></footer>';
 $('#setBody').innerHTML=h;
 const on=(id,ev,fn)=>{const e=$(id);if(e)e.addEventListener(ev,fn)};
 on('#sName','change',e=>{s.name=e.target.value.trim();save();tick()});
 on('#sSn','click',e=>{const b=e.target.closest('[data-m]');if(!b)return;const m=+b.dataset.m;if(s.snooze.includes(m)){if(s.snooze.length<2)return;s.snooze=s.snooze.filter(x=>x!==m)}else s.snooze=[...s.snooze,m].sort((a,b)=>a-b);if(!s.snooze.includes(s.snDef))s.snDef=s.snooze[0];save();renderSet()});
 on('#sRep','change',e=>{s.repeat=+e.target.value;save()});on('#sSd','change',e=>{s.snDef=+e.target.value;save()});
 on('#sClose','change',e=>{s.closeH=+e.target.value;S.lastDay=logicalDay();save()});
 on('#sVoice','change',e=>{s.voice=e.target.checked;save()});on('#sConf','change',e=>{s.confirm=e.target.checked;save()});on('#sRate','change',e=>{s.rate=+e.target.value;save();speak('أهلاً، أنا سمسم')});
 on('#sWake','change',e=>{s.wake=e.target.checked;save();if(s.wake){unlockAudio();startWake();toast('قول "يا سمسم" في أي وقت والبرنامج مفتوح')}else stopWake()});
 on('#sTry','click',()=>speak('أهلاً'+(s.name?' يا '+s.name:'')+'، أنا سمسم. قولّي فكرني بإيه، وأنا هفكرك في معاده',true));
 on('#sTheme','change',e=>{s.theme=e.target.value;save();applyTheme()});
 fillVoices();
 on('#sVc','change',e=>{s.voiceName=e.target.value;save();pickVoice();speak('أهلاً، أنا سمسم. ده صوتي الجديد',true)});
 on('#azS','click',async()=>{const key=$('#azK').value.trim(),region=$('#azR').value.trim().toLowerCase();if(!key||!region){toast('اكتب المفتاح والـ region');return}
  s.az={key,region,voice:$('#azV').value};save();toast('بجرّب الصوت…');try{if(NATIVE)await NP.playFile({path:await azFile(egSay('أهلاً'+(s.name?' يا '+s.name:'')+'، أنا سمسم، وده صوتي المصري'))});else{const b=await azBlob(egSay('أهلاً، أنا سمسم، وده صوتي المصري'));await new Audio(URL.createObjectURL(b)).play()}toast('اشتغل 👌');S.tasks.forEach(t=>delete t.vclip);save()}catch(e){toast('المفتاح أو الـ region مش مظبوطين، أو مفيش نت');}renderSet()});
 on('#azD','click',()=>{delete s.az;S.tasks.forEach(t=>delete t.vclip);save();renderSet();toast('رجعنا لصوت الموبايل')});
 on('#sTest','click',()=>{unlockAudio();const t=addTask({text:'ده تذكير تجربة من سمسم',at:Date.now()+10000,src:'test'});toast('استنى ١٠ ثواني…')});
 on('#sExp','click',()=>{const b=$('#sBox');b.hidden=false;b.value=JSON.stringify({...S,tasks:S.tasks.map(t=>({...t}))});b.select();try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([b.value],{type:'application/json'}));a.download='smsm-backup-'+dk(new Date())+'.json';a.click()}catch(e){}});
 on('#sImp','click',()=>{const b=$('#sBox');if(b.hidden||!b.value.trim()){b.hidden=false;b.value='';b.placeholder='الصق البيانات هنا ودوس استورد تاني';b.focus();return}try{const o=JSON.parse(b.value);if(!o.tasks)throw 0;S={...JSON.parse(JSON.stringify(DEF)),...o,set:{...DEF.set,...o.set}};save();render();renderSet();toast('اتستوردت')}catch(e){toast('البيانات دي مش سليمة')}});
 on('#sClr','click',()=>{if(!confirmBox('أمسح كل المهام اللي خلصت أو اتقفلت؟ (التقارير هتفضل)'))return;S.tasks.filter(t=>t.done||t.closed).forEach(t=>{if(t.note)idbDel(t.note)});S.tasks=S.tasks.filter(t=>!(t.done||t.closed));save();render();toast('اتمسحت')});
 $$('#setBody [data-o]').forEach(b=>b.onclick=()=>NP.open({what:b.dataset.o}));
 renderPerm()}
async function fillVoices(){const sel=$('#sVc');if(!sel)return;let list=[];
 if(NATIVE){try{const r=await NP.voices();list=(r.voices||[]).filter(v=>v.installed||v.network).map(v=>({id:v.name,label:(/EG/i.test(v.locale)?'🇪🇬 ':'')+v.locale+' — '+v.name.replace(/^ar-[a-z]+-x-/i,'')+(v.network?' (نت)':'')}))}catch(e){}}
 else if('speechSynthesis'in window)list=speechSynthesis.getVoices().filter(v=>/^ar/i.test(v.lang)).map(v=>({id:v.name,label:(/EG/i.test(v.lang)?'🇪🇬 ':'')+v.name}));
 list.sort((a,b)=>(/🇪🇬/.test(b.label)?1:0)-(/🇪🇬/.test(a.label)?1:0));
 sel.innerHTML='<option value="">تلقائي</option>'+list.map(v=>'<option value="'+esc(v.id)+'"'+(S.set.voiceName===v.id?' selected':'')+'>'+esc(v.label)+'</option>').join('');
 if(!list.length)sel.innerHTML='<option value="">مفيش أصوات عربي — نزّلها من إعدادات الموبايل</option>'}
async function renderPerm(){const c=$('#permCard');if(!c)return;
 if(!NATIVE){c.innerHTML='<h3>التنبيهات على الكمبيوتر</h3><p class="muted">سيب سمسم مفتوح في تاب، وهيطلع لك Pop-up بالصوت في معاده. ولو التاب في الخلفية هيبعت إشعار.</p><div class="set"><label>إشعارات المتصفح</label><button class="btn sm ghost" id="pN">'+('Notification'in window?(Notification.permission==='granted'?'مفعّلة':'فعّل'):'غير مدعومة')+'</button></div>';
  const b=$('#pN');if(b)b.onclick=()=>{if('Notification'in window)Notification.requestPermission().then(renderPerm)};return}
 let st={};try{st=await NP.status()}catch(e){}
 const row=(k,lab,sub,what)=>'<div class="set"><label>'+lab+'<small>'+sub+'</small></label>'+(st[k]?'<span style="color:var(--ok);font-weight:600">تمام</span>':'<button class="btn sm peach" data-p="'+what+'">فعّل</button>')+'</div>';
 c.innerHTML='<h3>صلاحيات التذكير</h3><p class="muted">عشان سمسم يفكرك حتى والموبايل مقفول، فعّل دول:</p>'+row('notifications','الإشعارات','لازم','notifications')+row('exact','المنبه في المعاد بالظبط','عشان ميتأخرش','exact')+row('overlay','الظهور فوق التطبيقات','عشان الـ Pop-up يطلع على الشاشة','overlay')+row('fullScreen','الشاشة الكاملة','عشان يطلع والموبايل مقفول','fullscreen')+row('battery','تجاهل توفير البطارية','عشان الموبايل ميقفلوش','battery')+row('mic','الميكروفون','عشان تكلم سمسم','mic');
 $$('#permCard [data-p]').forEach(b=>b.onclick=async()=>{const w=b.dataset.p;if(w==='notifications'&&!st.notifications){await NP.requestNotif().catch(()=>{});setTimeout(renderPerm,1500)}if(w==='mic'){await SRP.requestPermissions().catch(()=>{});renderPerm();return}NP.open({what:w})})}

/* ---------- nav / theme / boot ---------- */
function go(v){$$('.view').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));$$('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));window.scrollTo(0,0);if(v==='cal')renderCal();if(v==='rep')renderRep();if(v==='set')renderSet()}
$('#nav').onclick=e=>{const b=e.target.closest('[data-v]');if(b)go(b.dataset.v)};
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)go(b.dataset.go)});
function curTheme(){const t=S.set.theme;if(t==='light'||t==='dark')return t;const H=new Date().getHours();return H>=6&&H<18?'light':'dark'}
const SUN='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>',MOON='<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
function applyTheme(){const t=curTheme();if(document.documentElement.dataset.theme!==t)document.documentElement.dataset.theme=t;const b=$('#themeBtn');if(b){b.innerHTML=t==='dark'?MOON:SUN;b.title=t==='dark'?'الوضع الليلي':'الوضع النهاري'}
 const m=document.querySelector('meta[name=theme-color]');if(m)m.content=t==='dark'?'#0b1a36':'#2f7fe0'}
$('#themeBtn').onclick=()=>{S.set.theme=curTheme()==='dark'?'light':'dark';save();applyTheme();toast(S.set.theme==='dark'?'الوضع الليلي 🌙':'الوضع النهاري ☀️')};
function wakeBtn(){const b=$('#listenBtn');if(NATIVE||!WebSR){b.hidden=true;return}b.textContent=S.set.wake?'🎧 سامعك':'🎧 يا سمسم';b.onclick=()=>{S.set.wake=!S.set.wake;save();wakeBtn();if(S.set.wake){unlockAudio();startWake();toast('قول "يا سمسم" وبعدها اللي عايزه')}else stopWake()}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopWake();else{startWake();nativeAcks();tick();render()}});
async function boot(){applyTheme();wakeBtn();tick();render();setInterval(tick,1000);
 setTimeout(()=>{$('#splash').classList.add('out');setTimeout(()=>$('#splash').remove(),600)},1300);
 if(NATIVE){try{NP.addListener('ack',a=>{applyAck(a);save();render()});NP.addListener('launch',l=>onLaunch(l));const l=await NP.getLaunch();onLaunch(l);await nativeAcks();
   Capacitor.Plugins.App&&Capacitor.Plugins.App.addListener('resume',()=>nativeAcks());
   const st=await NP.status();if(!st.notifications)NP.requestNotif()}catch(e){}nsched()}
 else if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
 startWake()}
function onLaunch(l){if(!l||!l.act)return;if(l.act==='talk'){go('home');setTimeout(()=>converse(),700)}else if(l.act==='note'){go('home');setTimeout(()=>noteFlow(),700)}else if(l.act==='report'){go('rep');const r=S.reports.find(x=>x.ask);if(r)setTimeout(()=>showReport(r,false),400)}else if(l.key)applyAck(l)}
boot();
