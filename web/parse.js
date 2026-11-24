/* ===== سمسم: فهم الكلام المصري واستخراج الوقت والمهمة ===== */
const SM_DAYS=['الحد','الاتنين','التلات','الاربع','الخميس','الجمعه','السبت'];
const SM_MONTHS=['يناير','فبراير','مارس','ابريل','مايو','يونيو','يوليو','اغسطس','سبتمبر','اكتوبر','نوفمبر','ديسمبر'];
function smBase(s){return String(s||'').replace(/[ً-ٰٟـ]/g,'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\s+/g,' ').trim()}
function smNorm(s){return s.replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي')}
const SM_NUMW=[['احداشر|حداشر|احدعشر|احد عشر',11],['اتناشر|اطناشر|اثناعشر|اثنا عشر|اتنعشر',12],['تلتاشر|ثلاثه عشر|تلاتاشر',13],['اربعتاشر|اربعه عشر|اربعطاشر',14],['خمستاشر|خمسه عشر|خمسطاشر',15],['ستاشر|سته عشر',16],['سبعتاشر|سبعه عشر',17],['تمنتاشر|ثمانيه عشر|تمانتاشر',18],['تسعتاشر|تسعه عشر',19],
 ['عشرين|عشرون',20],['تلاتين|ثلاثين|ثلاثون',30],['اربعين|اربعون',40],['خمسين|خمسون',50],['ستين|ستون',60],['تسعين',90],
 ['واحده|واحد|وحده',1],['اتنين|اثنين|اثنان|اتنان',2],['تلاته|ثلاثه|تلات|ثلاث',3],['اربعه|اربع',4],['خمسه|خمس',5],['سته|ست',6],['سبعه|سبع',7],['تمانيه|ثمانيه|تمن|تمانه|ثمان',8],['تسعه|تسع',9],['عشره|عشر',10]];
/* replaces number words by digits while keeping a char map back to the original string */
function smTokenize(orig){const base=smBase(orig);let n=smNorm(base);
 // compound: "خمسه وعشرين" -> 25
 for(const [w,v] of SM_NUMW){const re=new RegExp('(^|\\s)('+w+')(?=\\s|$)','g');n=n.replace(re,(m,a)=>a+'#'+v+'#')}
 n=n.replace(/#(\d)#\s*و\s*#(\d0)#/g,(m,a,b)=>'#'+(+a+ +b)+'#').replace(/#(\d+)#/g,'$1');
 return n}
const SM_UNIT={دقيقه:1,دقايق:1,دقائق:1,دقيقتين:2,د:1,ساعه:60,ساعات:60,ساعتين:120,يوم:1440,ايام:1440,يومين:2880,اسبوع:10080,اسابيع:10080,اسبوعين:20160,شهر:43200};
function smParse(text,nowMs){const now=new Date(nowMs||Date.now());let s=' '+smTokenize(text)+' ';const used=[];let rel=null,day=null,hh=null,mm=0,period=null,rep=null,dayOnly=false;
 const take=(re,fn)=>{const m=s.match(re);if(!m)return false;fn(m);s=s.replace(m[0],' ');return true};
 // repeat
 take(/\sكل\s+يوم\s/,()=>{rep='d'});
 take(/\sكل\s+(?:يوم\s+)?(الحد|الاحد|الاتنين|الاثنين|التلات|الثلاثاء|التلاتاء|الاربع|الاربعاء|الخميس|الجمعه|السبت)\s/,m=>{rep='w';day={wd:smWd(m[1])}});
 // relative amounts
 const relRe=/\s(?:بعد|كمان|خلال|في خلال|جوه|جوا)\s+(?:(\d+)\s*)?(نص|ربع|تلت|ثلث)?\s*(دقيقه|دقايق|دقائق|دقيقتين|ساعه|ساعات|ساعتين|يومين|يوم|ايام|اسبوعين|اسبوع|اسابيع|شهر)(?:\s*(?:و\s*)?(نص|ربع|تلت|ثلث))?(?:\s*و\s*(\d+)\s*(?:دقيقه|دقايق|دقائق))?\s/;
 take(relRe,m=>{const unit=SM_UNIT[m[3]];let q=m[1]?+m[1]:1;if(m[2])q=({نص:.5,ربع:.25,تلت:1/3,ثلث:1/3})[m[2]]*(m[1]?+m[1]:1);
   if(/ساعتين|دقيقتين|يومين|اسبوعين/.test(m[3])&&!m[1])q=1;let mins=q*unit;if(m[4])mins+=({نص:.5,ربع:.25,تلت:1/3,ثلث:1/3})[m[4]]*unit;if(m[5])mins+=+m[5];rel=Math.round(mins)});
 if(rel==null)take(/\s(?:بعد|كمان)\s+(\d+)\s/,m=>{rel=+m[1]}); // "بعد 10" = minutes
 // day words
 if(!day){take(/\sبعد\s+بكر[اه]\s/,()=>{day={off:2}})||take(/\s(?:بكر[اه]|غدا|الصبح بدري بكره)\s/,()=>{day={off:1}})||take(/\s(?:النهارده|انهارده|النهارد|اليوم ده|النهاردا)\s/,()=>{day={off:0}})}
 if(!day)take(/\s(?:يوم\s+)?(الحد|الاحد|الاتنين|الاثنين|التلات|الثلاثاء|التلاتاء|الاربع|الاربعاء|الخميس|الجمعه|السبت)(?:\s+(?:الجاي|الجاية|اللي جاي))?\s/,m=>{day={wd:smWd(m[1])}});
 if(!day)take(new RegExp('\\s(?:يوم\\s+)?(\\d{1,2})\\s+(?:من\\s+)?(?:شهر\\s+)?('+SM_MONTHS.join('|')+')(?:\\s+(\\d{4}))?\\s'),m=>{const mo=SM_MONTHS.indexOf(m[2]);if(+m[1]>=1&&+m[1]<=31)day={d:+m[1],m:mo,y:m[3]?+m[3]:null}});
 if(!day)take(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s/,m=>{if(+m[1]>=1&&+m[1]<=31&&+m[2]>=1&&+m[2]<=12)day={d:+m[1],m:+m[2]-1,y:m[3]?(+m[3]<100?2000+ +m[3]:+m[3]):null}});
 if(!day)take(/\sيوم\s+(\d{1,2})\s/,m=>{day={d:+m[1]}});
 // clock time
 const PER='(الصبح|صباحا|بدري|الفجر|ص|الضهر|الظهر|بعد الضهر|بعد الظهر|العصر|المغرب|بالليل|بليل|الليل|مساء|مساءا|بالمسا|المسا|العشا|م)';
 const tRe=new RegExp('\\s(?:الساعه|ساعه|علي|الساعة)\\s*(\\d{1,2})(?::(\\d{2}))?(?:\\s*(?:و\\s*)?(نص|ربع|تلت|ثلث)|\\s*الا\\s*(ربع|تلت|ثلث|(\\d+)\\s*(?:دقيقه|دقايق)?)|\\s*و\\s*(\\d+)\\s*(?:دقيقه|دقايق|دقائق)?)?(?:\\s+'+PER+')?\\s');
 const t2=new RegExp('\\s(\\d{1,2}):(\\d{2})(?:\\s+'+PER+')?\\s');
 const onT=m=>{hh=+m[1];mm=m[2]?+m[2]:0;if(m[3])mm=({نص:30,ربع:15,تلت:20,ثلث:20})[m[3]];if(m[4]){const sub=m[5]?+m[5]:({ربع:15,تلت:20,ثلث:20})[m[4]];hh=hh-1;mm=60-sub}if(m[6])mm=+m[6];if(m[7])period=smPer(m[7])};
 take(tRe,onT)||take(t2,m=>{hh=+m[1];mm=+m[2];if(m[3])period=smPer(m[3])});
 let dper=null;if(hh==null)take(/\s(الصبح|صباحا|بدري|الضهر|الظهر|العصر|المغرب|بالليل|بليل|المسا|بالمسا)\s/,m=>{dper=m[1]});
 if(hh!=null&&hh>23)hh=null;
 // build date
 let at=null;const base=new Date(now);
 if(rel!=null&&hh==null&&!day){at=new Date(now.getTime()+rel*6e4)}
 else if(hh!=null||day||rel!=null||dper){let d=new Date(now);d.setSeconds(0,0);
  if(day){if(day.off!=null)d.setDate(d.getDate()+day.off);else if(day.wd!=null){let diff=(day.wd-d.getDay()+7)%7;d.setDate(d.getDate()+diff);if(diff===0&&hh==null)dayOnly=true}else if(day.d){if(day.m!=null){d.setMonth(day.m,day.d);if(day.y)d.setFullYear(day.y);else if(d<new Date(now.getFullYear(),now.getMonth(),now.getDate()))d.setFullYear(d.getFullYear()+1)}else{d.setDate(day.d);if(d<new Date(now.getFullYear(),now.getMonth(),now.getDate()))d.setMonth(d.getMonth()+1,day.d)}}}
  if(hh!=null){let H=hh;
   if(period==='am'){if(H===12)H=0}else if(period==='noon'){if(H<11)H+=12}else if(period==='pm'){if(H<12)H+=12}
   d.setHours(H,mm,0,0);
   if(!period&&hh>=1&&hh<=6){d.setHours(hh+12,mm,0,0)}
   else if(!period&&hh>=7&&hh<=11){const alt=new Date(d);alt.setHours(hh+12);const isToday=!day||day.off===0;if(isToday&&d<=now&&alt>now)d=alt}
   if(day&&day.wd!=null&&d<=now)d.setDate(d.getDate()+7);
   if(!day&&d<=now)d.setDate(d.getDate()+1);
  }else{if(rel!=null){d=new Date(d.getTime()+rel*6e4)}else if(dper){d.setHours({الصبح:9,صباحا:9,بدري:7,الضهر:13,الظهر:13,العصر:16,المغرب:18,بالليل:21,بليل:21,المسا:19,بالمسا:19}[dper]||9,0,0,0);if(!day&&d<=now)d.setDate(d.getDate()+1)}else{d.setHours(9,0,0,0);dayOnly=true}}
  at=d}
 // task text = what remains, from the original words
 let rest=s.replace(/\s(?:يا\s+)?سمسم\s/g,' ').replace(/\s(?:لو سمحت|من فضلك|معلش|يا عم|بقي|بقى)\s/g,' ');
 rest=rest.replace(/^\s*(?:و\s*)?(?:ممكن\s+)?(?:تفكرني|فكرني|فكرنى|ذكرني|ذكرنى|نبهني|نبهنى|افتكرلي|سجل|سجلي|اكتب|حط|خليني افتكر|عايزك تفكرني|عاوزك تفكرني)\s+/,' ');
 rest=rest.replace(/^\s*(?:اني|ان|علشان|عشان|لازم|ب\s)\s*/,' ').replace(/^\s*ب(?=\S{3,})/,' ').replace(/\s+/g,' ').trim();
 rest=rest.replace(/^(?:افتكر|متنساش|ماتنساش|عايز|عاوز|محتاج)\s+(?=\S+\s+\S)/,'').replace(/^(?:اني|ان|عشان|علشان)\s+/,'').replace(/\s(?:و|في|علي|الساعه)$/,'').trim();
 const textOut=smRestoreText(text,rest);
 return{at:at?at.getTime():null,text:textOut,rep,dayOnly,hasTime:hh!=null||rel!=null}}
function smPer(p){return/الصبح|صباحا|بدري|الفجر|^ص$/.test(p)?'am':/الضهر|الظهر/.test(p)?'noon':'pm'}
function smWd(w){const m={الحد:0,الاحد:0,الاتنين:1,الاثنين:1,التلات:2,الثلاثاء:2,التلاتاء:2,الاربع:3,الاربعاء:3,الخميس:4,الجمعه:5,السبت:6};return m[w]}
/* map normalized leftover words back to the user's own spelling */
function smRestoreText(orig,rest){if(!rest)return'';const ow=smBase(orig).split(' ');const on=ow.map(w=>smNorm(w));const rw=rest.split(' ');
 let best=-1;for(let i=0;i<=on.length-rw.length;i++){let ok=true;for(let j=0;j<rw.length;j++)if(on[i+j]!==rw[j]){ok=false;break}if(ok){best=i;break}}
 if(best>=0)return ow.slice(best,best+rw.length).join(' ');
 return rest}
if(typeof module!=='undefined')module.exports={smParse,smTokenize};
