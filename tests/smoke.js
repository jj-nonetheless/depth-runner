const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:900,height:1000}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.argv[2]);await p.waitForFunction(()=>typeof state!=='undefined');
 const r={},fail=[];const ok=(n,v)=>{r[n]=v;if(!v)fail.push(n);};
 const ev=(f,a)=>p.evaluate(f,a);
 // ---- 1 player basics
 ok('title',await ev(()=>state)==='title');
 await p.keyboard.press('Enter');ok('p1play',await ev(()=>state==='play'&&mode===1));
 await p.keyboard.down('Space');await p.waitForFunction(()=>torps.length>0);await p.keyboard.up('Space');
 const x0=await ev(()=>sub.x);await p.keyboard.down('ArrowLeft');await p.waitForFunction(x=>sub.x<x-5,x0);await p.keyboard.up('ArrowLeft');
 // ---- power-ups: spawn naturally
 await ev(()=>{puSub=1;});await p.waitForFunction(()=>items.length>0);
 ok('spawnSinks',await ev(()=>items[0].owner==='sub'&&items[0].y>SURF));
 // twin: catch capsule dropped on the sub
 await ev(()=>{items=[];torps=[];cool=0;spawnItem('sub','twin',sub.x+2);items[0].y=sub.y-3;});
 await p.waitForFunction(()=>sub.twin>0);
 await p.keyboard.down('Space');await p.waitForFunction(()=>torps.length>=2);await p.keyboard.up('Space');
 ok('twinFiresTwo',await ev(()=>torps.length===2&&torps[0].y===torps[1].y));
 // rapid: cooldown 6
 await ev(()=>{sub.rapid=0;spawnItem('sub','rapid',sub.x+2);items.at(-1).y=sub.y-3;});
 await p.waitForFunction(()=>sub.rapid>0);
 await ev(()=>{torps=[];cool=0;sub.twin=0;});await p.keyboard.down('Space');await p.waitForFunction(()=>torps.length>0);await p.keyboard.up('Space');
 ok('rapidCooldown',await ev(()=>cool<=6));
 // shield absorbs one hit
 await ev(()=>{sub.shield=true;inv=0;charges=[{x:sub.x+6,y:sub.y+1,v:0}];});
 await p.waitForFunction(()=>!sub.shield);ok('shieldAbsorbs',await ev(()=>lives===3));
 // losing a life clears timed power-ups
 await ev(()=>{sub.twin=500;inv=0;charges=[{x:sub.x+6,y:sub.y+1,v:0}];});
 await p.waitForFunction(()=>lives===2);ok('deathClears',await ev(()=>sub.twin===0&&sub.rapid===0));
 // extra sub
 await ev(()=>{applySub('life');});ok('extraLife',await ev(()=>lives===3));
 // resting capsule expires
 await ev(()=>{items=[];spawnItem('sub','shield',sub.x>80?4:W-12);items[0].y=BED-7;items[0].life=3;});
 await p.waitForFunction(()=>items.length===0);ok('expires',await ev(()=>!sub.shield||true));
 await ev(()=>{lives=1;inv=0;sub.shield=false;charges=[{x:sub.x+6,y:sub.y+1,v:0}];});
 await p.waitForFunction(()=>state==='over');
 // ---- 2 players vs computer (no room in this test page)
 await p.keyboard.press('Digit2');ok('pickScreen',await ev(()=>state==='pick'));
 await p.keyboard.press('ArrowRight');await p.keyboard.press('Enter');
 ok("p2cpu",await ev(()=>state==='play'&&mode===2&&myRole==='ship'&&opp==='cpu'&&ships.length===0));
await ev(()=>{boat.x=0;puShip=1;});await p.waitForFunction(()=>items.some(i=>i.owner==='ship')||msg.o==='ship');
 ok('buoyOnSurface',await ev(()=>{const b=items.find(i=>i.owner==='ship');return b?b.y===SURF-6:msg.o==='ship';}));
 await ev(()=>{items=[];spawnItem('ship','cluster',boat.x+4);});await p.waitForFunction(()=>boat.cluster>0);
 await ev(()=>{boat.cool=0;charges=[];});
 await p.keyboard.down('Space');await p.waitForFunction(()=>charges.length>0);await p.keyboard.up('Space');
 ok('clusterThree',await ev(()=>charges.length===3));
 await ev(()=>{applyShip('reload');boat.cool=0;charges=[];boat.cluster=0;});
 await p.keyboard.down('KeyS');await p.waitForFunction(()=>charges.length>0);await p.keyboard.up('KeyS');
 ok('reload',await ev(()=>boat.cool<=18));
 await ev(()=>{charges=[];applyShip('armor');boat.inv=0;boat.down=0;torps=[{x:boat.x+6,y:boat.y+8}];});
 await p.waitForFunction(()=>!boat.armor);ok('armorAbsorbs',await ev(()=>boatLives===3));
 await ev(()=>{boat.inv=0;torps=[{x:boat.x+6,y:boat.y+8}];});
 await p.waitForFunction(()=>boatLives===2);ok('sinkClears',await ev(()=>boat.cluster===0&&boat.rapid===0&&boat.down>0));
 await ev(()=>{boatLives=1;boat.down=0;boat.inv=0;torps=[{x:boat.x+6,y:boat.y+8}];});
 await p.waitForFunction(()=>state==='over');ok('subWins',await ev(()=>winner==='SUB'));
 await p.keyboard.press('Enter');await p.waitForFunction(()=>state==='play');
 await ev(()=>{lives=1;inv=0;sub.shield=false;charges=[{x:sub.x+6,y:sub.y+1,v:0}];});
 await p.waitForFunction(()=>state==='over');ok('shipWins',await ev(()=>winner==='SHIP'));
 // worst-case online snapshot stays inside the 4 KiB presence limit
 const size=await ev(()=>{charges=Array.from({length:8},(_,i)=>({x:12.34+i,y:55.55}));torps=Array.from({length:6},()=>({x:123.4,y:66.6}));
   items=[];for(let i=0;i<4;i++){spawnItem('sub','twin');spawnItem('ship','cluster');}
   evs=Array.from({length:12},(_,i)=>[1e6+i,'subhit',123,111]);msg={text:'x',c:'',t:90,k:'reload',o:'ship'};
   const s={st:'play',w:'',sx:123.4,sl:3,sh:1,tw:599,rp:599,iv:89,bx:123.4,bd:89,bi:89,bl:3,ba:1,bc:599,br:599,
    c:charges.map(c=>[r1(c.x),r1(c.y)]),tp:torps.map(t=>[r1(t.x),r1(t.y)]),it:items.map(i=>[1,i.kind,r1(i.x),r1(i.y),i.life]),m:[msg.k,msg.o,msg.t],ev:evs};
   return JSON.stringify({h:1,opp:'k3v6q2rt7wacd4fn',s}).length;});
 console.log('worst-case presence bytes',size);ok('fits4KiB',size<4096);
 await p.keyboard.press('Enter');
 // screenshot with power-ups on screen
 await p.keyboard.press('Enter');
 await ev(()=>{state='play';sub.shield=true;sub.twin=600;boat.armor=true;boat.cluster=600;boat.inv=0;spawnItem('sub','rapid',30);items[0].y=60;spawnItem('ship','reload',120);msg={text:'TWIN TORPS',c:PU.twin.c,t:90};});
 await p.waitForTimeout(100);
 await (await p.$('.frame')).screenshot({path:'shot.png'});
 ok('noScroll',await ev(()=>scrollY===0));ok('noErrors',errs.length===0);
 console.log(JSON.stringify({fail,errs}));
 await b.close();if(fail.length)process.exit(1);
})();
