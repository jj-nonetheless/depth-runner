// Stand-in for the claude.ai `room` capability: tabs of one browser share presence over a BroadcastChannel.
(()=>{
 const me=Math.random().toString(36).slice(2,10),bc=new BroadcastChannel('mockroom'),rooms=new Map();
 function mk(name){
  const peers=new Map([[me,{}]]),hs=new Set();let pend=false,prev=[];
  const snap=()=>[...peers].map(([peer,presence])=>Object.freeze({peer,presence,isMe:peer===me,sameTab:peer===me,by:null,kind:'viewer',guest:false,updatedAt:Date.now()}));
  const notify=()=>{if(pend)return;pend=true;setTimeout(()=>{pend=false;const now=snap(),a=new Set(prev.map(p=>p.peer)),b=new Set(now.map(p=>p.peer));
    const ch={peers:now,joined:now.filter(p=>!a.has(p.peer)),left:prev.filter(p=>!b.has(p.peer)),updated:now};prev=now;hs.forEach(h=>h(ch));},16);};
  return {name,_peers:peers,_notify:notify,
   presence(patch){const cur={...peers.get(me)};for(const k in patch){if(patch[k]===null)delete cur[k];else cur[k]=patch[k];}
     if(JSON.stringify(cur).length>4096)return Promise.reject({code:'invalid_argument'});
     peers.set(me,cur);bc.postMessage({t:'p',room:name,peer:me,presence:cur});notify();return Promise.resolve();},
   peers:snap,onPeers(h){hs.add(h);notify();return()=>hs.delete(h);},
   emit:()=>Promise.resolve(),on:()=>()=>{},connected:()=>true,onConnection(h){setTimeout(()=>h(true));return()=>{};},
   leave(){bc.postMessage({t:'l',room:name,peer:me});rooms.delete(name);hs.clear();return Promise.resolve();},
   join(n){let r=rooms.get(n);if(!r){r=mk(n);rooms.set(n,r);bc.postMessage({t:'hello',room:n,peer:me});}return Promise.resolve(r);}};
 }
 const lobby=mk('lobby');rooms.set('lobby',lobby);
 bc.onmessage=({data:m})=>{const r=rooms.get(m.room);if(!r)return;
  if(m.t==='p'){r._peers.set(m.peer,m.presence);r._notify();}
  else if(m.t==='l'){r._peers.delete(m.peer);r._notify();}
  else if(m.t==='hello'){if(!r._peers.has(m.peer))r._peers.set(m.peer,{});r._notify();bc.postMessage({t:'p',room:m.room,peer:me,presence:r._peers.get(me)});}};
 bc.postMessage({t:'hello',room:'lobby',peer:me});
 window.__maxPresence=0;
 window.claude={use:n=>Promise.resolve(n==='room'?lobby:null)};
})();
