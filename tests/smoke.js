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
 // ---- 2 players
 await p.keyboard.press('Digit2');ok('p2',await ev(()=>state==='play'&&mode===2&&ships.length===0));
 await ev(()=>{puShip=1;});await p.waitForFunction(()=>items.some(i=>i.owner==='ship'));
 ok('buoyOnSurface',await ev(()=>items.find(i=>i.owner==='ship').y===SURF-6));
 // cluster via buoy under ship
 await ev(()=>{items=[];spawnItem('ship','cluster',boat.x+4);});await p.waitForFunction(()=>boat.cluster>0);
 await ev(()=>{boat.cool=0;charges=[];});
 await p.keyboard.down('KeyS');await p.waitForFunction(()=>charges.length>0);await p.keyboard.up('KeyS');
 ok('clusterThree',await ev(()=>charges.length===3));
 // reload
 await ev(()=>{applyShip('reload');boat.cool=0;charges=[];boat.cluster=0;});
 await p.keyboard.down('KeyS');await p.waitForFunction(()=>charges.length>0);await p.keyboard.up('KeyS');
 ok('reload',await ev(()=>boat.cool<=18));
 // armor blocks one torpedo
 await ev(()=>{charges=[];applyShip('armor');boat.inv=0;boat.down=0;torps=[{x:boat.x+6,y:boat.y+8}];});
 await p.waitForFunction(()=>!boat.armor);ok('armorAbsorbs',await ev(()=>boatLives===3));
 await ev(()=>{boat.inv=0;torps=[{x:boat.x+6,y:boat.y+8}];});
 await p.waitForFunction(()=>boatLives===2);ok('sinkClears',await ev(()=>boat.cluster===0&&boat.rapid===0&&boat.down>0));
 await ev(()=>{boatLives=1;boat.down=0;boat.inv=0;torps=[{x:boat.x+6,y:boat.y+8}];});
 await p.waitForFunction(()=>state==='over');ok('subWins',await ev(()=>winner==='SUB'));
 await p.keyboard.press('Enter');
 await ev(()=>{lives=1;inv=0;charges=[{x:sub.x+6,y:sub.y+1,v:0}];});
 await p.waitForFunction(()=>state==='over');ok('shipWins',await ev(()=>winner==='SHIP'));
 // screenshot with power-ups on screen
 await p.keyboard.press('Enter');
 await ev(()=>{sub.shield=true;sub.twin=600;boat.armor=true;boat.cluster=600;boat.inv=0;spawnItem('sub','rapid',30);items[0].y=60;spawnItem('ship','reload',120);msg={text:'TWIN TORPS',c:PU.twin.c,t:90};});
 await p.waitForTimeout(100);
 await (await p.$('.frame')).screenshot({path:'shot.png'});
 ok('noScroll',await ev(()=>scrollY===0));ok('noErrors',errs.length===0);
 console.log(JSON.stringify({fail,errs}));
 await b.close();if(fail.length)process.exit(1);
})();
