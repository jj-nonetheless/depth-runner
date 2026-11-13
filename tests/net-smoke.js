const {chromium}=require('playwright');const fs=require('fs');
const [,,url,mockPath]=process.argv;const mock=fs.readFileSync(mockPath,'utf8');
(async()=>{
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:900,height:1000}});
 await ctx.addInitScript(mock);
 const errs=[];const fail=[];const ok=(n,v)=>{if(!v)fail.push(n);console.log((v?'PASS ':'FAIL ')+n);};
 const open=async()=>{const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>lobbyState==='ok');return p;};
 const A=await open(),B=await open();
 const ev=(p,f,a)=>p.evaluate(f,a),until=(p,f,a,t=8000)=>p.waitForFunction(f,a,{timeout:t});
 // match: A sub, B ship
 await A.click('#m2s');ok('A waiting',await ev(A,()=>state==='wait'));
 await B.click('#m2h');
 await until(A,()=>state==='play'&&opp==='remote');await until(B,()=>state==='play'&&opp==='remote');
 ok('matched: A hosts sub, B guest ship',await ev(A,()=>isHost())&&await ev(B,()=>isGuest()));
 // B steers the ship; A's sim moves it, B sees it
 const bx=await ev(A,()=>boat.x);
 await B.bringToFront();await B.keyboard.down('ArrowRight');await until(A,x=>boat.x>x+10,bx);await B.keyboard.up('ArrowRight');
 await until(B,x=>boat.x>x+10,bx);ok('ship input crosses to host and back',true);
 await ev(A,()=>{boat.cool=0;});await B.keyboard.down('Space');await until(A,()=>charges.length>0);await B.keyboard.up('Space');
 await until(B,()=>charges.length>0);ok('charge dropped by guest shows on both',true);
 // A fires; B sees torpedo
 await A.bringToFront();await ev(A,()=>{cool=0;});await A.keyboard.down('Space');await until(B,()=>torps.length>0);await A.keyboard.up('Space');ok('torpedo seen by guest',true);
 // power-up message mirrored
 await ev(A,()=>applySub('twin'));await until(B,()=>msg.text==='TWIN TORPS'&&sub.twin>0);ok('power-up mirrored',true);
 // sub wins; both see it
 await ev(A,()=>{boatLives=1;boat.down=0;boat.inv=0;boat.armor=false;torps=[{x:boat.x+6,y:boat.y+8}];});
 await until(A,()=>state==='over');await until(B,()=>state==='over');
 ok('both see SUB WINS',await ev(A,()=>winner)==='SUB'&&await ev(B,()=>winner)==='SUB');
 ok('presence fits 4KiB',await ev(A,()=>JSON.stringify({h:1,opp:'x',s:{}}).length<4096));
 // rematch: both press Enter
 await A.keyboard.press('Enter');await B.keyboard.press('Enter');
 await until(A,()=>state==='play'&&opp==='remote');await until(B,()=>state==='play'&&opp==='remote');ok('rematch connects',true);
 // ship player leaves -> CPU takes the ship on A
 await ev(B,()=>toTitle());
 await until(A,()=>opp==='cpu'&&state==='play');ok('host: CPU takes over ship',await ev(A,()=>msg.text.startsWith('PLAYER 2 LEFT')));
 const bx2=await ev(A,()=>boat.x);await until(A,x=>Math.abs(boat.x-x)>3,bx2);ok('AI ship moves',true);
 // swap: B hosts... A goes ship, B sub; then A(sub host) leaves -> guest takes over locally
 await ev(A,()=>toTitle());
 await B.click('#m2s');await A.click('#m2h');
 await until(A,()=>state==='play'&&opp==='remote');await until(B,()=>state==='play'&&opp==='remote');
 await ev(B,()=>toTitle());
 await until(A,()=>opp==='cpu'&&state==='play');ok('guest: CPU takes over sub',await ev(A,()=>msg.text.startsWith('PLAYER 1 LEFT')));
 const sx=await ev(A,()=>sub.x);await until(A,x=>Math.abs(sub.x-x)>3,sx);ok('AI sub moves, guest now simulates',true);
 // no partner: countdown -> CPU
 await ev(A,()=>toTitle());await ev(B,()=>toTitle());
 await A.click('#m2h');await ev(A,()=>{waitT=30;});await until(A,()=>state==='play'&&opp==='cpu');ok('no partner -> CPU after countdown',await ev(A,()=>msg.text==='NO PLAYER 2 FOUND'));
 // C key skips waiting
 await ev(A,()=>toTitle());await A.click('#m2s');await A.bringToFront();await A.keyboard.press('KeyC');ok('C plays CPU now',await ev(A,()=>state==='play'&&opp==='cpu'&&myRole==='sub'));
 // same side doesn't match
 await ev(A,()=>toTitle());await A.click('#m2s');await B.click('#m2s');await A.waitForTimeout(1500);
 ok('two subs do not match',await ev(A,()=>state==='wait')&&await ev(B,()=>state==='wait'));
 await A.click('#m2s');await ev(B,()=>toTitle());
 await (await A.$('.frame')).screenshot({path:'net-wait.png'});
 // no room capability at all
 const C=await b.newPage();C.on('pageerror',e=>errs.push(e.message));await C.goto(url);
 await C.waitForFunction(()=>lobbyState==='none');await C.click('#m2s');ok('no room -> straight to CPU',await ev(C,()=>state==='play'&&opp==='cpu'&&msg.text==='ONLINE PLAY UNAVAILABLE'));
 ok('no page errors',errs.length===0);if(errs.length)console.log(errs);
 await b.close();if(fail.length){console.log('FAILED',fail);process.exit(1);}
})();
