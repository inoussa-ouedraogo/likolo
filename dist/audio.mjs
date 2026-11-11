export class GameAudio {
  constructor(){this.enabled=true;this.context=null;this.master=null;this.noiseBuffer=null;this.effectsVolume=.4;this.musicVolume=.38;this.effectsBus=null;this.musicEnabled=true;this.musicBus=null;this.musicStep=0;this.nextBeat=0;}
  setVolume(kind,value){
    const n=Number(value);if(!Number.isFinite(n))return;
    const key=kind==='music'?'musicVolume':'effectsVolume';this[key]=Math.max(0,Math.min(1,n));
    if(this.context&&this.effectsBus)this.effectsBus.gain.setTargetAtTime(this.effectsVolume,this.context.currentTime,.03);
  }
  updateMusic(active){
    const c=this.context;if(!c||!this.master)return;
    if(!this.musicBus){this.musicBus=c.createGain();this.musicBus.gain.value=0;this.musicBus.connect(this.master);}
    const playing=active&&this.enabled&&this.musicEnabled;
    this.musicBus.gain.setTargetAtTime(playing?this.musicVolume:0,c.currentTime,.06);
    if(!playing){this.nextBeat=0;return;}
    if(!this.nextBeat||this.nextBeat<c.currentTime-.2)this.nextBeat=c.currentTime+.025;
    // Original 104 BPM groove: bass drum, syncopated hand drums, shaker and plucked notes.
    const step=60/104/4;
    while(this.nextBeat<c.currentTime+.14){
      const n=this.musicStep++%32,delay=Math.max(0,this.nextBeat-c.currentTime),bus=this.musicBus;
      if(n%8===0||n%16===6)this.tone(115,.16,42,delay,'sine',.55,bus);
      if([3,7,10,14].includes(n%16))this.tone(n%2?230:310,.09,110,delay,'sine',.27,bus);
      if(n%2===0||n%8===7)this.noise(.035,6500,n%4===2?.09:.045,delay,'highpass',bus);
      if(n%8===4)this.noise(.07,1500,.12,delay,'bandpass',bus);
      const notes={0:220,6:330,11:392,16:196,22:294,27:330,30:440};
      if(notes[n]){this.tone(notes[n],.24,notes[n],delay,'sine',.22,bus);this.tone(notes[n]*2,.07,notes[n]*2,delay,'sine',.07,bus);}
      this.nextBeat+=step;
    }
  }
  async unlock(){
    if(!this.enabled)return;
    try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;this.context??=new Audio();
      if(!this.master){this.master=this.context.createGain();this.master.gain.value=.5;this.master.connect(this.context.destination);this.effectsBus=this.context.createGain();this.effectsBus.gain.value=this.effectsVolume;this.effectsBus.connect(this.master);
        this.noiseBuffer=this.context.createBuffer(1,this.context.sampleRate*.8,this.context.sampleRate);const data=this.noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}
      await this.context.resume();
    }catch{this.enabled=false;}
  }
  tone(frequency,duration=.12,end=frequency,delay=0,wave='sine',volume=.4,bus=this.effectsBus||this.master){
    const c=this.context;if(!this.enabled||!c||!this.master)return;
    const o=c.createOscillator(),g=c.createGain(),at=c.currentTime+delay;o.type=wave;o.frequency.setValueAtTime(frequency,at);o.frequency.exponentialRampToValueAtTime(Math.max(25,end),at+duration);
    g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(volume,at+.009);g.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(g).connect(bus);o.start(at);o.stop(at+duration+.02);
  }
  noise(duration=.15,frequency=1200,volume=.5,delay=0,type='lowpass',bus=this.effectsBus||this.master){
    const c=this.context;if(!this.enabled||!c||!this.noiseBuffer)return;
    const n=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),at=c.currentTime+delay;n.buffer=this.noiseBuffer;f.type=type;f.frequency.value=frequency;
    g.gain.setValueAtTime(volume,at);g.gain.exponentialRampToValueAtTime(.0001,at+duration);n.connect(f).connect(g).connect(bus);n.start(at);n.stop(at+duration);
  }
  play(event,game={}){
    if(!this.enabled||!this.context)return;
    if(event==='lose'){this.noise(.38,650,.85);this.tone(110,.36,35,0,'triangle',.65);}
    else if(event==='catch'){this.tone(650,.13,1100,0,'sine');this.tone(980,.23,1450,.06,'sine',.24);this.noise(.09,3200,.2);}
    else if(event==='bottleHit'){this.tone(1050,.13,720,0,'triangle',.32);this.noise(.07,2500,.12);}
    else if(event==='topple'){for(const [f,t]of[[720,0],[510,.065],[345,.12]])this.tone(f,.11,f*.8,t,'triangle',.42);this.noise(.13,1500,.16);}
    else if(event==='right'){this.tone(390,.14,640);this.tone(780,.2,980,.07,'sine',.28);}
    else if(event==='shot'){const fast=game.ball?.tempo==='rapide';this.noise(fast?.21:.13,fast?3800:850,fast?.65:.24);if(fast)this.tone(240,.2,1000,0,'sawtooth',.2);else this.tone(190,.13,100,0,'triangle',.25);}
    else if(event==='throw'){this.noise(.28,2100,.5);this.tone(170,.22,560,0,'triangle',.26);}
    else if(event==='pour'){this.noise(.16,4300,.25,0,'highpass');this.tone(850,.08,680,0,'sine',.16);}
    else if(event==='gather'){this.noise(.13,1400,.16);}
    else if(event==='jump'){this.noise(.16,950,.16);this.tone(180,.15,340,0,'sine',.18);}
    else if(event==='land'){this.noise(.09,450,.15);}
    else if(event==='feint'){this.tone(240,.06,160,0,'triangle',.18);}
    else if(event==='prepare'){this.tone(game.ball?.plan?.tempo==='rapide'?760:420,.07,520,0,'sine',.18);}
    else if(event==='full'||event==='win'){for(const [i,f]of[440,554,659,880].entries())this.tone(f,event==='win'?.42:.2,f,i*.09,'sine',.32);}
    else if(event==='jumpDodge'){this.tone(620,.18,1100,0,'sine',.22);}
  }
}
