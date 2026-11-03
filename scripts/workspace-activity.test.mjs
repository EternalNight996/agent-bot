import assert from 'node:assert/strict'
import test from 'node:test'
import {createWorkspaceState,createTeamDiscovery} from '../lib/client/workspace-state.js'
import {ACTIVITY_IDLE_MS,ACTIVITY_IDLE_TICKS,ACTIVITY_POLL_MS,startActivityPolling} from '../lib/client/activity-monitor.js'

test('restored, closed, updated and newly created teams have distinct discovery semantics',()=>{
 const discover=createTeamDiscovery()
 const a={teamId:'a'},b={teamId:'b'}
 assert.equal(discover([a]),undefined)
 assert.equal(discover([{...a,phase:'running'}]),undefined)
 assert.equal(discover([a,b]),'b')
 assert.equal(discover([a,b]),undefined)
 assert.equal(discover([]),undefined)
})
test('historical cards and selected teams remain bound to their owner',()=>{
 const state=createWorkspaceState();let count=0;const off=state.subscribe(()=>count++)
 const old={teamId:'old',captainSessionId:'',teamName:'Old',members:[]}
 state.remember('a',old)
 state.select('b','new')
 state.remember('a',{...old,teamId:'foreign',captainSessionId:'b'})
 assert.equal(state.getSnapshot().history.size,1)
 assert.equal(state.getSnapshot().history.get('a:old').captainSessionId,'a')
 assert.equal(state.getSnapshot().selected.get('a'),'old')
 assert.equal(state.getSnapshot().selected.get('b'),'new')
 state.status('a','ready');state.status('a','ready')
 assert.equal(count,3)
 off();state.status('a','error');assert.equal(count,3)
})
test('offline, invalid data and recovery report health without erasing the last snapshot',async()=>{
 let tick;let response={ok:false};const statuses=[],snapshots=[]
 const poll=startActivityPolling([],{discoverySessionId:'a',fetchState:async()=>response,
 schedule:fn=>{tick=fn;return 1},cancel:()=>{},onStatus:s=>statuses.push(s),publishSnapshots:s=>snapshots.push(s)})
 await poll.firstTick;assert.deepEqual(statuses,['error']);assert.equal(snapshots.length,0)
 response={ok:true,json:async()=>({invalid:true})};tick();await new Promise(resolve=>setImmediate(resolve));assert.equal(statuses.at(-1),'error')
 response={ok:true,json:async()=>({teams:[]})};tick();await new Promise(resolve=>setImmediate(resolve));assert.equal(statuses.at(-1),'ready');assert.equal(snapshots.length,2)
 poll.stop()
})
test('disposal prevents a late failed request from updating a different session',async()=>{
 let reject;const statuses=[]
 const poll=startActivityPolling([],{discoverySessionId:'a',fetchState:()=>new Promise((_,no)=>reject=no),schedule:()=>1,cancel:()=>{},onStatus:s=>statuses.push(s)})
 poll.stop();reject(new Error('offline'));await poll.firstTick;assert.deepEqual(statuses,[])
})

test('hall token appears whenever the expanded hall is not actually visible',async()=>{
  const {shouldArmHallFallback,setHallSidebarVisible}=await import('../lib/client/hall-nav.js')
  assert.equal(shouldArmHallFallback({collapsed:false,hallVisible:false}),true)
  assert.equal(shouldArmHallFallback({collapsed:false,hallVisible:true}),false)
  assert.equal(shouldArmHallFallback({collapsed:true,hallVisible:false}),false)
  // 收起成 rail 时宿主仍挂载，只是不可见：可见性存储必须在收起/展开之间切换。
  setHallSidebarVisible(false)
  assert.equal(shouldArmHallFallback({collapsed:false,hallVisible:false}),true)
  setHallSidebarVisible(true)
  assert.equal(shouldArmHallFallback({collapsed:false,hallVisible:true}),false)
})
test('elapsed time freezes once tasks stop, end or complete',async()=>{
  const {teamElapsedCounting,teamElapsedMs,formatElapsed}=await import('../lib/client/activity-model.js')
  const running={phase:'running',createdAt:1000,updatedAt:5000,tasks:[{status:'in_progress'}]}
  assert.equal(teamElapsedCounting(running),true)
  assert.equal(teamElapsedMs(running,9000),8000)
  for(const status of ['completed','failed','cancelled']){
    const settled={...running,tasks:[{status}]}
    assert.equal(teamElapsedCounting(settled),false,status)
    assert.equal(teamElapsedMs(settled,9000),4000,status)
  }
  assert.equal(teamElapsedCounting({...running,halted:true}),false)
  assert.equal(teamElapsedMs({...running,halted:true},9000),4000)
  assert.equal(teamElapsedCounting({...running,phase:'staged'}),false)
  assert.equal(teamElapsedCounting({...running,tasks:[]}),true)
  assert.equal(formatElapsed(3723000),'1h 02m 03s')
})
test('an unchanged live payload stops republishing and drops to the quiet cadence',async()=>{
 // Byte-identical polls used to decode, publish and re-render every second.
 const target={key:'k',sessionId:'s',teamId:'a'}
 const body=JSON.stringify({teams:[{teamId:'a',captainSessionId:'s',members:[],tasks:[]}]})
 let tick;const intervals=[];let publishes=0
 const poll=startActivityPolling([target],{
  fetchState:async()=>({ok:true,text:async()=>body,json:async()=>JSON.parse(body)}),
  schedule:(callback,intervalMs)=>{tick=callback;intervals.push(intervalMs);return intervals.length},
  cancel:()=>{},
  publishSnapshots:()=>{publishes+=1},
 })
 await poll.firstTick
 assert.equal(publishes,1,'the first payload publishes once')
 for(let i=0;i<ACTIVITY_IDLE_TICKS+2;i+=1){tick();await new Promise(resolve=>setImmediate(resolve))}
 assert.equal(publishes,1,'unchanged payloads must not re-render subscribers')
 assert.equal(intervals[0],ACTIVITY_POLL_MS,'a demanded team starts on the live cadence')
 assert.equal(intervals.at(-1),ACTIVITY_IDLE_MS,'a quiet team backs off')
 poll.stop()
})

test('a changed payload returns the loop to the live cadence',async()=>{
 const target={key:'k',sessionId:'s',teamId:'a'}
 let payload={teams:[{teamId:'a',captainSessionId:'s',members:[],tasks:[]}]}
 let tick;const intervals=[];let publishes=0
 const poll=startActivityPolling([target],{
  fetchState:async()=>({ok:true,text:async()=>JSON.stringify(payload),json:async()=>payload}),
  schedule:(callback,intervalMs)=>{tick=callback;intervals.push(intervalMs);return intervals.length},
  cancel:()=>{},
  publishSnapshots:()=>{publishes+=1},
 })
 await poll.firstTick
 for(let i=0;i<ACTIVITY_IDLE_TICKS+2;i+=1){tick();await new Promise(resolve=>setImmediate(resolve))}
 assert.equal(intervals.at(-1),ACTIVITY_IDLE_MS)
 payload={teams:[{teamId:'a',captainSessionId:'s',members:[],tasks:[{id:'t1',status:'in_progress'}]}]}
 tick();await new Promise(resolve=>setImmediate(resolve))
 assert.equal(publishes,2,'a real change still publishes')
 assert.equal(intervals.at(-1),ACTIVITY_POLL_MS,'a moving team returns to the live cadence')
 poll.stop()
})

test('a hidden page suspends polling and an active one resumes it',async()=>{
 const listeners=new Set()
 const previous=globalThis.document
 globalThis.document={visibilityState:'visible',addEventListener:(type,listener)=>{if(type==='visibilitychange')listeners.add(listener)},removeEventListener:(type,listener)=>{if(type==='visibilitychange')listeners.delete(listener)}}
 let fetches=0;let tick
 const poll=startActivityPolling([{key:'k',sessionId:'s',teamId:'a'}],{
  fetchState:async()=>{fetches+=1;return{ok:true,json:async()=>({teams:[{teamId:'a',captainSessionId:'s',members:[],tasks:[]}]})}},
  schedule:(callback)=>{tick=callback;return 1},
  cancel:()=>{},
  publishSnapshots:()=>{},
 })
 await poll.firstTick
 assert.equal(fetches,1)
 globalThis.document.visibilityState='hidden'
 for(const listener of listeners)listener()
 tick();await new Promise(resolve=>setImmediate(resolve))
 assert.equal(fetches,1,'a hidden tab must not poll')
 globalThis.document.visibilityState='visible'
 for(const listener of listeners)listener()
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(fetches,2,'returning to the tab refreshes immediately')
 poll.stop()
 assert.equal(listeners.size,0,'disposal removes the visibility listener')
 globalThis.document=previous
})

test('workspace DAG keeps real dependency endpoints aligned with enlarged nodes',async()=>{
 const {compactDagLayout}=await import('../lib/client/activity-model.js')
 const tasks=[{id:'implement',depth:0,dependencies:[]},{id:'review',depth:1,dependencies:['implement']}]
 const layout=compactDagLayout(tasks,{nodeWidth:164,nodeHeight:76,columnGap:36,rowGap:16})
 assert.equal(layout.width,364)
 assert.equal(layout.nodes[1].x,200)
 assert.equal(layout.edges[0].path,'M164 38C178 38,186 38,200 38')
})
