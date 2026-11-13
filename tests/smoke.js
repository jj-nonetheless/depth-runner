const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:900,height:900}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.argv[2]);await p.waitForFunction(()=>typeof state!=='undefined');
 const s0=await p.evaluate(()=>state);
 await p.keyboard.press('Enter');
 const s1=await p.evaluate(()=>state);
 await p.keyboard.down('Space');await p.waitForFunction(()=>torps.length>0||score>0);
 await p.keyboard.up('Space');
 const x0=await p.evaluate(()=>sub.x);await p.keyboard.down('ArrowLeft');await p.waitForFunction(x=>sub.x<x-5,x0);await p.keyboard.up('ArrowLeft');
 await p.evaluate(()=>{lives=1;inv=0;charges.push({x:sub.x+6,y:sub.y+1,v:0});});
 await p.waitForFunction(()=>state==='over');
 await p.keyboard.press('Enter');const s2=await p.evaluate(()=>({state,lives,score}));
 const scrollY=await p.evaluate(()=>scrollY);
 console.log(JSON.stringify({s0,s1,s2,scrollY,errs}));
 await b.close(); if(errs.length||s0!=='title'||s1!=='play'||s2.state!=='play'||s2.lives!==3)process.exit(1);
})();
