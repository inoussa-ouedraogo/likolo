import { loadAthleteAssets } from './imported-athlete.mjs';
import { setupAvatar } from './avatar-ui.mjs';
import { Match, MODES } from './match.mjs';
import { LikoloScene } from './scene3d.mjs';
import { icon } from './touch-icons.mjs';
import { BottleHud } from './bottle-hud.mjs';
import { NetPrediction } from './net-prediction.mjs';
import { GameAudio } from './audio.mjs';
await loadAthleteAssets().catch(()=>{document.getElementById('avatar-model-status').hidden=false;});
const $=id=>document.getElementById(id),audio=new GameAudio(),canvas=$('game');
let match=new Match(),game=match.view(),scene,kind='solo',room=null,seat=0,lobby=true,paused=false,menu=false,seq=0,pending=[],networkBusy=false,lastEvent=0,lastResult='',lastStamp=0,sceneTime=0,revision=-1,lastSync=0;
let input={x:0,y:0},joystick={x:0,y:0},aim={x:1,y:0};const keys=new Set(),prediction=new NetPrediction();let roundTrip=0,partyKey='',nextHud=0,lastRender=0,contextAction='gather',syncTimer=null;
const getAvatar=setupAvatar(avatar=>{if(!room)match.avatars=[avatar];});
const descriptions={solo:['SOLO','Au milieu face à deux lanceurs ordinateur.'],duel:['DUEL','Un ami lance avec un ordinateur. L’autre joue au milieu.'],trio:['TRIO','Un au milieu. Deux aux lancers. Trois amis sur le terrain.'],coop:['COOP','Deux au milieu, une bouteille partagée. Deux lanceurs ordinateur.']};
try{scene=new LikoloScene(canvas);}catch(e){console.error('Likolo 3D',e);$('render-error').hidden=false;$('play-button').disabled=true;}
$('retry-render').onclick=()=>location.reload();new ResizeObserver(()=>scene?.fit()).observe(canvas);$('view-button').onclick=()=>{$('view-number').textContent=String((scene?.changeView()??0)+1);};
const bottleHud=new BottleHud($('bottle-hud'));
const clock=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
function message(text,error=false){$('network-status').textContent=text;$('network-status').classList.toggle('error',error);}
function persist(){try{room?sessionStorage.setItem('likolo-room-v1',JSON.stringify(room)):sessionStorage.removeItem('likolo-room-v1');}catch{}}
function clearInput(){keys.clear();joystick={x:0,y:0};input={x:0,y:0};$('joystick-thumb').style.transform='';}
function setLobby(value){lobby=value;$('game-overlay').hidden=!value;$('round-overlay').hidden=true;document.body.classList.toggle('in-match',!value);$('match-hud').hidden=value;$('bottle-hud').hidden=value;$('play-controls').hidden=value;$('gesture-strip').hidden=value;clearInput();scene?.fit();updateLayout();}
function choose(value){if(room)return;kind=value;match=new Match(kind,$('difficulty').value,$('rotate-roles').checked);game=match.view();lastEvent=0;lastResult='';
 document.querySelectorAll('[data-kind]').forEach(b=>{b.classList.toggle('selected',b.dataset.kind===kind);b.setAttribute('aria-pressed',String(b.dataset.kind===kind));});
 $('selected-title').textContent=descriptions[kind][0];$('selected-description').textContent=descriptions[kind][1];
 for(const id of ['join-area','network-field','bluetooth-note'])$(id).hidden=kind==='solo';$('rotation-field').hidden=!['duel','trio'].includes(kind);$('play-button').innerHTML=kind==='solo'?"JOUER <span>↗</span>":'CRÉER <span>+</span>';message('');
}
document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>choose(b.dataset.kind));$('difficulty').onchange=()=>choose(kind);
async function api(action,body={}){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6000);
 try{const started=performance.now();const response=await fetch('/api/rooms/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...room,...body,avatar:getAvatar()}),signal:controller.signal});let data;try{data=await response.json();}catch{throw new Error('Le service multijoueur ne répond pas.');}if(!response.ok)throw Object.assign(new Error(data.error??'Connexion impossible.'),{status:response.status});roundTrip=roundTrip?roundTrip*.7+(performance.now()-started)*.3:performance.now()-started;return data;}finally{clearTimeout(timeout);}
}
function accept(data){
 if(data.revision!=null&&data.revision<revision)return;if(data.revision!=null)revision=data.revision;
 seat=data.seat;room={code:data.code,token:data.token??room?.token};persist();match=Match.restore(data.match);game=match.view(seat);pending=pending.filter(c=>c.seq>data.ack);prediction.install(data.match,seat,pending,data.inputs??{},roundTrip/2000);seq=Math.max(seq,data.ack);lastSync=performance.now();
 $('room-info').hidden=false;$('join-area').hidden=true;$('setup-fields').hidden=true;$('leave-room').hidden=false;$('room-code').textContent=room.code;
 document.querySelectorAll('[data-kind]').forEach(b=>b.disabled=true);kind=data.kind;document.querySelectorAll('[data-kind]').forEach(b=>{b.classList.toggle('selected',b.dataset.kind===kind);b.setAttribute('aria-pressed',String(b.dataset.kind===kind));});$('bluetooth-note').hidden=false;$('selected-title').textContent=descriptions[kind][0];$('selected-description').textContent=descriptions[kind][1];
 const newPartyKey=JSON.stringify(data.players);if(newPartyKey!==partyKey){partyKey=newPartyKey;$('party-list').replaceChildren(...Array.from({length:MODES[kind].count},(_,i)=>{const item=document.createElement('div');item.className='party-slot';const icon=document.createElement('span');icon.textContent=data.players[i]?(data.players[i].online?'●':'○'):'+';const text=document.createElement('b');text.textContent=data.players[i]?data.players[i].name+(i===seat?' · TOI':''):'En attente d’un ami';const sub=document.createElement('small');sub.textContent=data.players[i]?(data.players[i].role[0]==='c'?'AU MILIEU':'LANCEUR '+(+data.players[i].role[1]+1)):'PLACE LIBRE';item.append(icon,text,sub);return item;}));}
 const waiting=match.status==='ready';$('play-button').disabled=waiting&&(!data.host||data.players.length<MODES[kind].count||data.players.some(p=>!p.online));$('play-button').innerHTML=waiting?(data.host?'LANCER LA MANCHE ↗':'EN ATTENTE DU CRÉATEUR'):match.status==='playing'?'REPRENDRE ↗':data.host?'MANCHE SUIVANTE ↗':'EN ATTENTE DU CRÉATEUR';
 if(waiting&&!lobby)setLobby(true);if(match.status==='playing'&&lobby&&!menu)setLobby(false);
 if(!data.players.every(p=>p.online))message('Un joueur est déconnecté. Il peut revenir en rouvrant ce même onglet.');else message(waiting?`${data.players.length} / ${MODES[kind].count} joueurs · code à partager`:'Salon connecté · manche '+match.round);
}
async function sync(){
 if(!room||networkBusy)return;const activeRoom=room;networkBusy=true;const started=performance.now();
 try{const data=await api('sync',{input,commands:pending});if(room!==activeRoom)return;accept(data);$('connection-label').textContent=Math.round(roundTrip)+' ms';}
 catch(e){if(room!==activeRoom)return;$('connection-label').textContent='Connexion…';message(e.message,true);if([403,404].includes(e.status)){room=null;persist();setLobby(true);resetRoomUI();}}
 finally{networkBusy=false;clearTimeout(syncTimer);if(room)syncTimer=setTimeout(sync,Math.max(16,100-(performance.now()-started)));}
}
function wakeSync(){clearTimeout(syncTimer);if(!networkBusy&&room)sync();}
function resetRoomUI(){$('connection-label').textContent='';pending=[];seq=0;seat=0;revision=-1;partyKey='';clearTimeout(syncTimer);$('room-info').hidden=true;$('setup-fields').hidden=false;$('leave-room').hidden=true;$('play-button').disabled=!scene;document.querySelectorAll('[data-kind]').forEach(b=>b.disabled=false);menu=false;choose(kind);}
$('play-button').onclick=async()=>{
 audio.unlock();enterLandscape();if(kind==='solo'){match=new Match('solo',$('difficulty').value,false);match.status='playing';lastEvent=0;lastResult='';paused=false;setLobby(false);return;}
 $('play-button').disabled=true;
 try{if(!room){revision=-1;seq=0;pending=[];lastEvent=0;const data=await api('create',{kind,difficulty:$('difficulty').value,rotate:$('rotate-roles').checked,name:$('player-name').value});accept(data);wakeSync();}
 else if(match.status==='playing'){menu=false;setLobby(false);}else{menu=false;accept(await api('start'));}}
 catch(e){message(e.message,true);$('play-button').disabled=false;}
};
$('join-form').onsubmit=async e=>{e.preventDefault();audio.unlock();enterLandscape();$('join-button').disabled=true;try{revision=-1;seq=0;pending=[];lastEvent=0;const data=await api('join',{code:$('join-code').value,name:$('player-name').value});accept(data);wakeSync();}catch(e){message(e.message,true);}finally{$('join-button').disabled=false;}};
$('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);message('Code copié. Envoie-le à tes amis.');}catch{message('Code : '+room.code);}};
$('leave-room').onclick=async()=>{if(!room)return;try{await api('leave');room=null;persist();resetRoomUI();setLobby(true);}catch(e){message(e.message,true);}};
function act(action){audio.unlock();if(lobby||paused||menu||document.querySelector('dialog[open]'))return;const command={seq:++seq,action,aim:{...aim},height:Number($('shot-height').value)};if(room){pending.push(command);prediction.command(command);wakeSync();}else match.command(0,action,aim,command.height);}
function showRound(pause=false){menu=true;clearInput();$('round-overlay').hidden=false;const ended=['won','lost'].includes(match.status);$('round-kicker').textContent=ended?'MANCHE TERMINÉE':room?'TU RESTES DANS LE SALON':'ON SOUFFLE UN PEU';$('round-title').innerHTML=ended?(match.status==='won'?'OBJECTIF<br>ACCOMPLI !':'TOUCHÉ !'):'LE TERRAIN<br>T’ATTEND.';
 $('round-description').textContent=ended?(match.rotate&&kind!=='coop'&&kind!=='solo'&&match.status==='lost'?'À la prochaine manche, le joueur central échange son poste avec un lanceur humain.':match.status==='won'?`Bouteille remplie puis vidée en ${clock(match.roundTime)}.`:'Saute, couche-toi ou intercepte au prochain essai.'):(room?'La partie continue pour les autres joueurs.':'La manche est en pause.');
 $('resume-button').textContent=ended?(room&&seat!==0?'LE CRÉATEUR RELANCE LA MANCHE':'MANCHE SUIVANTE ↗'):'REPRENDRE ↗';$('resume-button').disabled=ended&&!!room&&seat!==0;
 if(pause&&!room){paused=true;}
}
$('pause-button').onclick=()=>showRound(true);
$('resume-button').onclick=async()=>{enterLandscape();if(['won','lost'].includes(match.status)){if(room){try{accept(await api('start'));}catch(e){$('round-description').textContent=e.message;return;}}else match.nextRound();lastResult='';}paused=false;menu=false;$('round-overlay').hidden=true;};
$('return-lobby').onclick=()=>{menu=true;setLobby(true);if(!room){paused=false;match.status='ready';choose(kind);}};
function modal(id){if(!lobby&&!room)paused=true;clearInput();$(id).showModal();}
$('rules-button').onclick=()=>modal('rules-dialog');$('match-tutorial').onclick=()=>modal('rules-dialog');$('effects-button').onclick=()=>modal('effects-dialog');
for(const [id,dialog] of [['close-rules','rules-dialog'],['rules-done','rules-dialog'],['close-effects','effects-dialog']])$(id).onclick=()=>$(dialog).close();
for(const id of ['rules-dialog','effects-dialog'])$(id).addEventListener('close',()=>{if(!menu)paused=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.updateMusic(false);});
$('music-button').onclick=()=>{audio.musicEnabled=!audio.musicEnabled;audio.unlock();$('music-button').setAttribute('aria-pressed',String(audio.musicEnabled));$('music-button').style.opacity=audio.musicEnabled?'1':'.45';};
$('sound-button').onclick=()=>{audio.enabled=!audio.enabled;audio.unlock();$('sound-button').textContent=audio.enabled?'♪':'♩';$('sound-button').setAttribute('aria-pressed',String(audio.enabled));$('sound-button').setAttribute('aria-label',audio.enabled?'Couper le son':'Activer le son');};
for(const b of document.querySelectorAll('[data-effect]'))b.onclick=()=>{$('effects-dialog').close();audio.unlock();const type=b.dataset.effect;scene?.handleEvent(type,game,true);audio.play(type==='fastShot'?'shot':type,type==='fastShot'?{ball:{tempo:'rapide'}}:game);};
window.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea')||document.querySelector('dialog[open]'))return;const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)&&!lobby)e.preventDefault();if((k==='escape'||k==='p')&&!e.repeat){if(menu&&!lobby)$('resume-button').click();else if(!lobby)showRound(true);return;}keys.add(k);if(e.repeat)return;const map={e:'catch',r:'gather',' ':'pour',f:'right',j:'jump',shift:'jump',c:'prone'};if(map[k])act(map[k]);});
window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(e.key.toLowerCase()==='e')act('release');});
window.addEventListener('blur',()=>{if(keys.has('e'))act('release');clearInput();});document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=canvas.getBoundingClientRect(),p=scene?.worldAt(e.clientX-r.left,e.clientY-r.top),a=game.localActor??game.player;if(p)aim={x:p.x-a.x,y:p.y-a.y};});
const catchButton=$('catch-button');catchButton.onpointerdown=e=>{e.preventDefault();catchButton.setPointerCapture(e.pointerId);act('catch');};catchButton.onpointerup=()=>act('release');catchButton.onpointercancel=()=>act('release');
function activate(button,fn){button.onpointerdown=e=>{e.preventDefault();if(!button.disabled)fn();};button.onclick=e=>{if(e.detail===0&&!button.disabled)fn();};}
for(const [id,action] of [['jump-button','jump'],['prone-button','prone'],['gather-button','gather'],['sand-button','pour'],['bottle-button','right']])activate($(id),()=>act(action));
activate($('interact-button'),()=>act(contextAction));
activate($('height-button'),()=>{const select=$('shot-height');select.selectedIndex=(select.selectedIndex+1)%3;touchHud();});
function pad(element,thumb,update,onDown=()=>{},onUp=()=>{}){let pointer=null;const move=e=>{if(e.pointerId!==pointer)return;const r=element.getBoundingClientRect();let x=(e.clientX-r.left-r.width/2)/(r.width*.33),y=(e.clientY-r.top-r.height/2)/(r.height*.33),n=Math.hypot(x,y);if(n>1){x/=n;y/=n;}if(n<.12)x=y=0;thumb.style.transform=`translate(${x*22}px,${y*22}px)`;update(x,y);};element.onpointerdown=e=>{e.preventDefault();pointer=e.pointerId;element.setPointerCapture(pointer);move(e);onDown();};element.onpointermove=move;const release=e=>{if(e.pointerId!==pointer)return;pointer=null;thumb.style.transform='';update(0,0);onUp();};element.onpointerup=release;element.onpointercancel=release;element.onlostpointercapture=release;}
pad($('joystick'),$('joystick-thumb'),(x,y)=>{joystick={x,y};});pad($('aim-pad'),$('aim-thumb'),(x,y)=>{if(Math.hypot(x,y)>.1)aim=scene?.screenVector(x,y)??{x,y};},()=>act('catch'),()=>act('release'));
function hud(){
 const role=match.role(seat)??'c0',thrower=role[0]==='t',actor=game.localActor??game.player;
 $('role-label').textContent=thrower?'LANCEUR '+(+role[1]+1):kind==='coop'?'AU MILIEU · EN ÉQUIPE':'AU MILIEU';$('round-label').textContent='MANCHE '+match.round;$('timer').textContent=clock(match.roundTime);$('objective-title').textContent=thrower?'Touche le joueur central':match.phase==='empty'?'Vider la bouteille':'Remplir la bouteille';$('phase-copy').textContent=match.phase==='empty'?'Sable restant':'Sable dans la bouteille';$('percentage').textContent=Math.round(match.fill*100)+' %';$('sand-progress').style.width=match.fill*100+'%';
 document.querySelectorAll('.center-action').forEach(e=>e.hidden=thrower);document.querySelector('.thrower-action').hidden=!thrower;
 const held=game.ball.state==='held'&&game.ball.holder===role||(thrower&&game.ball.state==='aiming'&&game.ball.owner===+role[1]);$('catch-label').textContent=held?'Charger / lancer':'Intercepter';$('prone-label').textContent=actor.prone?'Se relever':'Se coucher';$('prone-button').classList.toggle('pressed',!!actor.prone);$('sand-label').textContent=match.phase==='empty'?'Vider':'Verser';
 const unavailable=match.status!=='playing'||paused||menu||lobby;
 $('catch-button').disabled=unavailable||(!thrower&&actor.prone);$('jump-button').disabled=unavailable||!game.onGround();$('prone-button').disabled=unavailable||!game.onGround();
 const busy=unavailable||!!game.action||held||actor.prone||!game.onGround();$('gather-button').disabled=busy||!!game.sandInHand||match.phase==='empty';$('sand-button').disabled=busy||(!game.sandInHand&&match.phase!=='empty')||!match.bottle.upright;$('bottle-button').disabled=busy||match.bottle.upright;
 $('hand-state').textContent=thrower?'Lanceur · visée libre':game.sandInHand?'◒ 1 poignée en main':'◒ Main vide';$('bottle-state').textContent=match.bottle.upright?'↥ Bouteille debout':'⚠ Bouteille tombée';$('gesture-name').textContent=game.action?({gather:'Ramasse le sable…',pour:'Verse une poignée…',empty:'Vide la bouteille…',right:'Redresse la bouteille…'}[game.action.kind]):actor.prone?'Couché · C pour te relever':thrower?'E : intercepter ou charger':game.sandInHand?'Espace : verser':'R : ramasser';$('gesture-progress').style.width=game.actionProgress()*100+'%';
 $('charge-indicator').hidden=actor.chargeStart==null||lobby;$('charge-fill').style.width=game.charge()*100+'%';const b=game.ball;$('ball-caption').textContent=b.state==='loose'?'Balle au sol : les lanceurs récupèrent':b.state==='returning'?'Renvoi : intercepte ou cours ramasser':b.state==='held'?'Balle interceptée':b.state==='flying'?(b.tempo==='rapide'?'ϟ Tir rapide':b.style==='haut'?'Tir haut · couche-toi':'Tir bas · saute'):'Lanceur '+(b.owner+1)+' prépare son tir';
 $('live-notice').textContent='';
 if(room&&performance.now()-lastSync>2500)$('connection-label').textContent='RECONNEXION…';
 if(['won','lost'].includes(match.status)&&lastResult!==String(match.round)+match.status){lastResult=String(match.round)+match.status;setTimeout(()=>{if(['won','lost'].includes(match.status)&&!lobby)showRound();},500);}
 if(match.status==='playing'&&menu&&!lobby&&$('round-kicker').textContent==='MANCHE TERMINÉE'){menu=false;$('round-overlay').hidden=true;lastResult='';}
}
let visualPositions=[],visualBall=null;
function smoothView(g,dt){
 if(!room)return g;const v=Object.create(g),positions=[...g.throwers,...g.centers],f=1-Math.exp(-dt*24);
 visualPositions=positions.map((p,i)=>{let a=visualPositions[i];if(!a||Math.hypot(p.x-a.x,p.y-a.y)>180)a={...p};return {...p,x:a.x+(p.x-a.x)*f,y:a.y+(p.y-a.y)*f};});
 v.throwers=visualPositions.slice(0,2);v.centers=visualPositions.slice(2);v.player=v.centers[g.role[0]==='c'?+g.role[1]:0];v.localActor=g.role[0]==='t'?v.throwers[+g.role[1]]:v.centers[+g.role[1]];Object.assign(v.localActor,g.localActor);
 const b=g.ball;if(!visualBall||visualBall.state!==b.state||Math.hypot(b.x-visualBall.x,b.y-visualBall.y)>180)visualBall={...b};else visualBall={...b,x:visualBall.x+(b.x-visualBall.x)*f,y:visualBall.y+(b.y-visualBall.y)*f,height:visualBall.height+((b.height??1)-visualBall.height)*f};v.ball=visualBall;return v;
}
function frame(stamp){requestAnimationFrame(frame);audio.updateMusic(!document.hidden&&!lobby&&!menu&&!paused&&match.status==='playing'&&$('orientation-hint').hidden&&!document.querySelector('dialog[open]'));const renderStep=lobby?1/24:document.body.classList.contains('touch-layout')?1/45:0;if(stamp-lastRender<renderStep*1000||document.hidden)return;lastRender=stamp;const dt=lastStamp?Math.min((stamp-lastStamp)/1000,.035):0;lastStamp=stamp;sceneTime+=dt;
 const sx=(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')||keys.has('q')?1:0)+joystick.x,sy=(keys.has('arrowdown')||keys.has('s')?1:0)-(keys.has('arrowup')||keys.has('w')||keys.has('z')?1:0)+joystick.y;
 input=lobby||menu||paused||!$('orientation-hint').hidden||document.querySelector('dialog[open]')?{x:0,y:0}:(scene?.screenVector(sx,sy)??{x:sx,y:sy});
 if(!room)match.avatars=[getAvatar()];
 if(!room&&!paused&&!lobby&&!menu&&$('orientation-hint').hidden)match.update(dt,{0:input});if(room&&!lobby&&!menu)prediction.update(dt,input);game=room?(prediction.view()??match.view(seat)):match.view(seat);game.status=match.status;
 if(game.ball.state==='held'&&game.ball.holder===game.role||(game.role?.[0]==='t'&&game.ball.state==='aiming'&&game.ball.owner===+game.role[1])){const a=game.localActor,n=Math.hypot(aim.x,aim.y)||1;game.aimPreview={from:a,to:{x:a.x+aim.x/n*500,y:a.y+aim.y/n*500}};}
 for(const e of match.events)if(e.id>lastEvent){const eventGame=e.thrower!=null?Object.assign(Object.create(game),{player:match.throwers[e.thrower]}):game;scene?.handleEvent(e.type,eventGame);audio.play(e.type,game);lastEvent=e.id;}
 try{scene?.render(smoothView(game,dt),input,sceneTime);}catch(e){console.error('Likolo render',e);scene=null;$('render-error').hidden=false;}
 if(stamp>=nextHud){hud();touchHud();bottleHud.update(game);nextHud=stamp+80;}
}
for(const node of document.querySelectorAll('[data-icon]'))node.innerHTML=icon(node.dataset.icon);
const icons={catch:'catch',jump:'jump',prone:'prone',gather:'gather',sand:'pour',bottle:'right'};
for(const [id,name]of Object.entries(icons)){const button=$(id+'-button');button.querySelector('span').innerHTML=icon(name);button.setAttribute('aria-label',({catch:'Intercepter ou charger le lancer',jump:'Sauter',prone:'Se coucher ou se relever',gather:'Ramasser du sable',sand:'Verser ou vider la bouteille',bottle:'Redresser la bouteille'})[id]);}
$('view-button').innerHTML=icon('view')+'<b id="view-number">1</b>';$('fullscreen-button').innerHTML=icon('fullscreen');$('rotate-fullscreen').innerHTML=icon('fullscreen');$('sound-button').textContent='♪';
let touchIconKey='';
function touchHud(){
 const touch=document.body.classList.contains('touch-layout'),role=match.role(seat)??'c0',thrower=role[0]==='t';
 $('interact-button').hidden=!touch||thrower;$('height-button').hidden=!touch||!thrower;
 const c=game,p=game.localActor??game.player,near=Math.hypot(p.x-500,p.y-340)<=22.15;
 contextAction=!game.bottle.upright&&near?'right':game.phase==='empty'||game.sandInHand?'pour':'gather';
 const key=contextAction+':'+$('shot-height').selectedIndex;
 if(key!==touchIconKey){touchIconKey=key;$('interact-button').querySelector('span').innerHTML=icon(contextAction);$('height-button').querySelector('span').innerHTML=icon('height');$('height-button').dataset.level=String($('shot-height').selectedIndex);}
 const title={gather:'Ramasser du sable',pour:game.phase==='empty'?'Vider la bouteille':'Verser le sable',right:'Redresser la bouteille'}[contextAction];
 $('interact-button').setAttribute('aria-label',title);$('interact-button').disabled=lobby||paused||menu||match.status!=='playing'||!!c.action||!!p.prone||!c.onGround()||(contextAction!=='gather'&&!near)||(game.ball.state==='held'&&game.ball.holder===role);
 $('height-button').setAttribute('aria-label','Hauteur du tir : '+['bas','corps','haut'][$('shot-height').selectedIndex]);
 $('catch-button').setAttribute('aria-label',$('catch-label').textContent);$('prone-button').setAttribute('aria-label',$('prone-label').textContent);$('prone-button').setAttribute('aria-pressed',String(!!p.prone));
 $('interact-button').style.setProperty('--gesture',String(Math.round(c.actionProgress()*100))+'%');
}
function updateLayout(){
 const small=Math.min(innerWidth,innerHeight)<600&&Math.max(innerWidth,innerHeight)<1100,touch=matchMedia('(pointer:coarse)').matches||small;
 document.body.classList.toggle('touch-layout',touch);$('fullscreen-button').setAttribute('aria-label',document.fullscreenElement?'Quitter le plein écran':'Plein écran');
 const portrait=touch&&innerHeight>innerWidth&&!lobby;
 $('orientation-hint').hidden=!portrait;
 if(portrait)clearInput();
 scene?.fit();
}
async function enterLandscape(){
 updateLayout();if(!document.body.classList.contains('touch-layout'))return;
 try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen({navigationUI:'hide'});}catch{}
 try{await screen.orientation?.lock?.('landscape');}catch{}
 updateLayout();
}
$('rotate-back').onclick=()=>$('return-lobby').click();$('fullscreen-button').onclick=()=>{if(document.fullscreenElement){document.exitFullscreen?.().catch(()=>{});try{screen.orientation?.unlock?.();}catch{}}else enterLandscape();};$('rotate-fullscreen').onclick=enterLandscape;
window.addEventListener('resize',updateLayout);document.addEventListener('fullscreenchange',updateLayout);
updateLayout();

choose('solo');requestAnimationFrame(frame);
try{const saved=JSON.parse(sessionStorage.getItem('likolo-room-v1'));if(saved?.code&&saved?.token){room=saved;sync();}}catch{}

for(const kind of ['music','effects']){
 const slider=$(kind+'-volume'),level=$(kind+'-level');
 try{const saved=localStorage.getItem('likolo-volume-'+kind);if(saved!==null&&Number.isFinite(Number(saved)))slider.value=saved;}catch{}
 const apply=()=>{audio.setVolume(kind,Number(slider.value)/100);level.value=slider.value+' %';};apply();
 slider.oninput=()=>{apply();audio.unlock();try{localStorage.setItem('likolo-volume-'+kind,slider.value);}catch{}};
}
