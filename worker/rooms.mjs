import { cleanAvatar } from '../dist/avatar.mjs';
import { Match, MODES } from '../dist/match.mjs';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const modes=new Set(['duel','trio','coop']);
const finite=(v,limit=1)=>Number.isFinite(v)?Math.max(-limit,Math.min(limit,v)):0;
const cleanInput=v=>({x:finite(v?.x),y:finite(v?.y)});
const id=()=>crypto.randomUUID().replaceAll('-','');
const name=v=>String(v??'Joueur').trim().slice(0,18)||'Joueur';
const output=(room,seat,now)=>({code:room.code,seat,host:seat===0,players:room.players.map((p,i)=>({name:p.name,seat:i,online:now-p.seen<8000,role:room.match.roles[i]})),kind:room.match.kind,rotate:room.match.rotate,match:room.match,inputs:Object.fromEntries(room.players.map((p,i)=>[i,now-p.seen<700?p.input:{x:0,y:0}])),ack:room.players[seat]?.seq??0});
export async function rooms(request,env){
 try{
  if(request.method!=='POST')throw fail('Utilise une requête POST.',405);
  const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)throw fail('Origine non autorisée.',403);
  if(Number(request.headers.get('Content-Length')||0)>16000)throw fail('Requête trop volumineuse.',413);
  const raw=await request.text();if(raw.length>16000)throw fail('Requête trop volumineuse.',413);let body;try{body=JSON.parse(raw);}catch{throw fail('Requête invalide.');}
  if(!body||typeof body!=='object')throw fail('Requête invalide.');
  const path=new URL(request.url).pathname,now=Date.now();
  if(path==='/api/rooms/create'){
   if(!modes.has(body.kind))throw fail('Choisis un mode multijoueur.');
   const code=Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join(''),token=id();
   const match=new Match(body.kind,body.difficulty,body.rotate!==false);
   match.avatars=[cleanAvatar(body.avatar)];
   const room={code,match,players:[{avatar:cleanAvatar(body.avatar),name:name(body.name),token,seen:now,input:{x:0,y:0},seq:0}],last:now};
   await env.DB.prepare('DELETE FROM likolo_rooms WHERE expires < ?').bind(now).run();
   await env.DB.prepare('INSERT INTO likolo_rooms (code,data,revision,expires) VALUES (?,?,0,?)').bind(code,JSON.stringify(room),now+3600000).run();
   return reply({...output(room,0,now),token});
  }
  const code=String(body.code??'').toUpperCase().replace(/\s/g,'');if(!/^[A-Z2-9]{8}$/.test(code))throw fail('Le code contient 8 caractères.');
  for(let attempt=0;attempt<7;attempt++){
   const row=await env.DB.prepare('SELECT data,revision,expires FROM likolo_rooms WHERE code = ?').bind(code).first();
   if(!row||row.expires<now)throw fail('Salon introuvable ou expiré.',404);
   const room=JSON.parse(row.data);let seat=room.players.findIndex(p=>p.token===body.token),newToken;
   if(path==='/api/rooms/join'&&seat<0){
    if(room.match.status!=='ready')throw fail('La partie a déjà commencé.',409);
    if(room.players.length>=MODES[room.match.kind].count)throw fail('Le salon est complet.',409);
    seat=room.players.length;newToken=id();room.players.push({avatar:cleanAvatar(body.avatar),name:name(body.name),token:newToken,seen:now,input:{x:0,y:0},seq:0});
   }
   if(seat<0)throw fail('Reconnecte-toi au salon avec ton code.',403);
   if(path==='/api/rooms/leave'){
    if(seat===0){await env.DB.prepare('DELETE FROM likolo_rooms WHERE code = ? AND revision = ?').bind(code,row.revision).run();return reply({left:true});}
    room.players.splice(seat,1);room.match=new Match(room.match.kind,room.match.mode,room.match.rotate);room.last=now;
    const left=await env.DB.prepare('UPDATE likolo_rooms SET data = ?, revision = revision + 1 WHERE code = ? AND revision = ?').bind(JSON.stringify(room),code,row.revision).run();if(left.meta.changes)return reply({left:true});continue;
   }
   const p=room.players[seat];
   const match=Match.restore(room.match);
   const elapsed=Math.min(.8,Math.max(0,(now-room.last)/1000)),steps=Math.ceil(elapsed/.025),inputs=Object.fromEntries(room.players.map((p,i)=>[i,now-p.seen<700?p.input:{x:0,y:0}]));
   for(let i=0;i<steps;i++)match.update(elapsed/steps,inputs);
   room.last=now;p.seen=now;p.input=cleanInput(body.input);
   if(path==='/api/rooms/start'){
    if(seat!==0)throw fail('Seul le créateur peut lancer la manche.',403);
    if(room.players.length<MODES[match.kind].count||room.players.some(p=>now-p.seen>15000))throw fail('Attends que tous les joueurs soient connectés.',409);
    if(match.status==='ready')match.status='playing';else if(['won','lost'].includes(match.status))match.nextRound();else throw fail('La manche est déjà en cours.',409);
   }else if(path==='/api/rooms/sync'){
    const commands=Array.isArray(body.commands)?body.commands.slice(0,20):[];
    for(const command of commands){
     if(!Number.isSafeInteger(command.seq)||command.seq<=p.seq)continue;
     if(command.seq>p.seq+50)throw fail('Séquence de commandes invalide.');
     if(['catch','release','jump','prone','gather','pour','right'].includes(command.action))match.command(seat,command.action,{x:finite(command.aim?.x,1000),y:finite(command.aim?.y,1000)},clampHeight(command.height));
     p.seq=command.seq;
    }
   }else if(path!=='/api/rooms/join')throw fail('Route inconnue.',404);
   p.avatar=cleanAvatar(body.avatar??p.avatar);match.avatars=room.players.map(player=>cleanAvatar(player.avatar));room.match=match;
   const result=await env.DB.prepare('UPDATE likolo_rooms SET data = ?, revision = revision + 1, expires = ? WHERE code = ? AND revision = ?').bind(JSON.stringify(room),now+3600000,code,row.revision).run();
   if(result.meta.changes)return reply({...output(room,seat,now),revision:row.revision+1,...(newToken?{token:newToken}:{})});
  }
  return reply({error:'Salon occupé. Réessaie.'},409);
 }catch(error){if(!error.status)console.error('Room API',error);return reply({error:error.status?error.message:'Connexion au salon indisponible. Réessaie.'},error.status||503);}
}
const clampHeight=v=>Number.isFinite(v)?Math.max(.25,Math.min(2.2,v)):.9;
