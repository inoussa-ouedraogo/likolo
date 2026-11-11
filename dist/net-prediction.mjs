import { Match } from './match.mjs';
// Rendering predicts locally; room snapshots alone decide scores and round endings.
export class NetPrediction {
 constructor(){this.match=null;this.seat=0;this.inputs={};}
 install(snapshot,seat,pending=[],inputs={},latency=0){
  this.match=Match.restore(structuredClone(snapshot));this.seat=seat;this.inputs=structuredClone(inputs);
  for(const c of pending)this.match.command(seat,c.action,c.aim,c.height);
  let left=Math.min(.12,Math.max(0,latency));while(left>0){const dt=Math.min(.025,left);this.match.update(dt,this.inputs);left-=dt;}
 }
 command(c){this.match?.command(this.seat,c.action,c.aim,c.height);}
 update(dt,input){if(!this.match)return;this.inputs[this.seat]=input;this.match.update(dt,this.inputs);}
 view(){return this.match?.view(this.seat);}
}
