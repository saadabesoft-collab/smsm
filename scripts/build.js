const fs=require('fs'),path=require('path');
const W=p=>path.join(__dirname,'..','web',p),D=p=>path.join(__dirname,'..','dist',p);
fs.rmSync(D(''),{recursive:true,force:true});fs.mkdirSync(D('fonts'),{recursive:true});
let html=fs.readFileSync(W('app.html'),'utf8');
const parse=fs.readFileSync(W('parse.js'),'utf8').replace(/if\(typeof module[^\n]*/,'');
html=html.replace('<script>/*PARSE*/</script>',()=>'<script>'+parse+'</script>').replace('<script>/*APP*/</script>',()=>'<script>'+fs.readFileSync(W('app.js'),'utf8')+'</script>');
const vdir=W('voice');const clips=fs.existsSync(vdir)?fs.readdirSync(vdir).filter(f=>f.endsWith('.mp3')).map(f=>f.slice(0,-4)):[];
if(clips.length){fs.mkdirSync(D('voice'),{recursive:true});for(const f of clips)fs.copyFileSync(path.join(vdir,f+'.mp3'),D('voice/'+f+'.mp3'))}
html=html.replace('<script>'+parse,()=>'<script>window.SM_CLIPS='+JSON.stringify(clips)+';'+parse);
fs.writeFileSync(D('index.html'),html);
for(const f of ['icon.svg','icon-192.png','icon-512.png','manifest.webmanifest','sw.js'])if(fs.existsSync(W(f)))fs.copyFileSync(W(f),D(f));
for(const f of fs.readdirSync(W('fonts')))fs.copyFileSync(W('fonts/'+f),D('fonts/'+f));
console.log('built',(html.length/1024).toFixed(0)+'KB');
