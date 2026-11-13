const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:900,height:900}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.argv[2]);await p.waitForFunction(()=>typeof state!=='undefined');
 const r={};
 // 1 player
 r.title=await p.evaluate(()=>state);
 await p.keyboard.press('Enter');r.p1=await p.evaluate(()=>({state,mode}));
 await p.keyboard.down('Space');await p.waitForFunction(()=>torps.length>0);await p.keyboard.up('Space');
 const x0=await p.evaluate(()=>sub.x);await p.keyboard.down('ArrowLeft');await p.waitForFunction(x=>sub.x<x-5,x0);await p.keyboard.up('ArrowLeft');
 await p.evaluate(()=>{lives=1;inv=0;charges.push({x:sub.x+6,y:sub.y+1,v:0});});
 await p.waitForFunction(()=>state==='over');
 // 2 players
 await p.keyboard.press('Digit2');r.p2=await p.evaluate(()=>({state,mode,ships:ships.length,boatLives}));
 await p.evaluate(()=>{boat.cool=0;});
 await p.keyboard.down('KeyS');await p.waitForFunction(()=>charges.length>0);await p.keyboard.up('KeyS');
 const bx=await p.evaluate(()=>boat.x);await p.keyboard.down('KeyD');await p.waitForFunction(x=>boat.x>x+5,bx);await p.keyboard.up('KeyD');
 r.aDidNotMoveSub=await p.evaluate(x=>sub.x===74,0);
 await p.evaluate(()=>{boat.inv=0;boat.down=0;torps.push({x:boat.x+6,y:boat.y+8});});
 await p.waitForFunction(()=>boatLives===2);r.boatDown=await p.evaluate(()=>boat.down>0);
 await p.evaluate(()=>{boatLives=1;boat.down=0;boat.inv=0;torps.push({x:boat.x+6,y:boat.y+8});});
 await p.waitForFunction(()=>state==='over');r.win1=await p.evaluate(()=>winner);
 await p.keyboard.press('Enter');
 await p.evaluate(()=>{lives=1;inv=0;charges.push({x:sub.x+6,y:sub.y+1,v:0});});
 await p.waitForFunction(()=>state==='over');r.win2=await p.evaluate(()=>winner);
 await p.screenshot({path:'shot.png'});
 r.scrollY=await p.evaluate(()=>scrollY);r.errs=errs;
 console.log(JSON.stringify(r));
 await b.close();
 const ok=!errs.length&&r.title==='title'&&r.p1.state==='play'&&r.p2.mode===2&&r.p2.ships===0&&r.aDidNotMoveSub&&r.boatDown&&r.win1==='SUB'&&r.win2==='SHIP';
 if(!ok)process.exit(1);
})();
