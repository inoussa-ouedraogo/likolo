import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import worker from '../dist/server/index.js';

const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
const path=resolve(process.env.DATABASE_PATH||'data/likolo.sqlite');mkdirSync(dirname(path),{recursive:true});
const sqlite=new DatabaseSync(path);sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
// Fresh installations only. Future schema changes need explicit migrations.
sqlite.exec(readFileSync(new URL('../drizzle/0000_ambitious_boomer.sql',import.meta.url),'utf8').replace('CREATE TABLE `likolo_rooms`','CREATE TABLE IF NOT EXISTS `likolo_rooms`'));
const DB={prepare(sql){return{bind(...args){const statement=sqlite.prepare(sql);return{async first(){return statement.get(...args)??null;},async run(){const result=statement.run(...args);return{meta:{changes:Number(result.changes)}};}};}};}};
const publicOrigin=process.env.PUBLIC_ORIGIN?new URL(process.env.PUBLIC_ORIGIN).origin:null;
const server=http.createServer(async(req,res)=>{
 try{
  if(!req.url?.startsWith('/')||req.url.startsWith('//')){res.writeHead(400);res.end('Bad request');return;}
  if(req.url==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"ok":true}');return;}
  const origin=publicOrigin||new URL('http://'+(req.headers.host||'127.0.0.1:'+port)).origin;
  const chunks=[];let size=0;
  if(!['GET','HEAD'].includes(req.method))for await(const chunk of req.iterator({destroyOnReturn:false})){
   size+=chunk.length;if(size>16000){req.resume();res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);
  }
  const request=new Request(origin+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await worker.fetch(request,{DB});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error('HTTP error:',error.message);if(!res.headersSent)res.writeHead(500,{'Content-Type':'text/plain'});res.end('Erreur du serveur.');}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(port,host,()=>console.log(`Likolo: http://${host}:${server.address().port}`));
let stopping=false;for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{if(stopping)return;stopping=true;server.close(()=>{sqlite.close();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();});
