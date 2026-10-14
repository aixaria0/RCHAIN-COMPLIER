const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

const BASE={
  height:'184273',hash:'0x7f4a…91c2',agreement:'1.00',quorum:'YES',status:'PASS',state:'pass',
  title:'Observed finalized block is consistent across the available evidence paths.',
  detail:'7 / 7 invariants satisfied',divergence:'NONE',faultNode:null,faultEdges:[],invariant:null,check:null,
  witness:'No failure witness. Activate an adversarial case to expose the first violated boundary.',
  mutation:'No mutation. Four synthetic observations agree on finalized height, block hash, identity, provenance, and canonical evidence.',
  active:{height:'184273',hash:'0x7f4a…91c2',agreement:'1.00',reachable:'4 / 4',justification:'present',canonical:'true',proposer:'distinct'},
};

const CASES={
  BASELINE:BASE,
  A:{...BASE,status:'FAIL',state:'fail',title:'One node reports a different finalized height. The claim must stop at the first cross-node inconsistency.',detail:'I-01 violated · critical',divergence:'NODE OBSERVATION / HEIGHT',faultNode:'observation',faultEdges:['e-block-obs','e-obs-verify'],invariant:'I-01 · Finalized height consistency',check:'finalized_block_cross_check',witness:'Expected 184273. synthetic-node-C reported 184274. Cross-node height agreement becomes false.',mutation:'node C last_finalized_block_number = 184274',agreement:'0.75',active:{height:'184273 / 184274',hash:'0x7f4a…91c2',agreement:'0.75',reachable:'4 / 4',justification:'present',canonical:'true',proposer:'distinct'}},
  B:{...BASE,status:'FAIL',state:'fail',title:'A block hash diverges at the same height. Matching heights cannot hide conflicting state identity.',detail:'I-02 violated · critical',divergence:'BLOCK EVIDENCE / HASH',faultNode:'block',faultEdges:['e-trace-block','e-block-obs'],invariant:'I-02 · Block hash consistency',check:'finalized_block_state',witness:'Expected 0x7f4a…91c2. synthetic-node-D reported 0x3e91…44ab at the same finalized height.',mutation:'node D block_hash = 0x3e91…44ab',agreement:'0.75',active:{height:'184273',hash:'0x7f4a…91c2 / 0x3e91…44ab',agreement:'0.75',reachable:'4 / 4',justification:'present',canonical:'true',proposer:'distinct'}},
  C:{...BASE,status:'FAIL',state:'fail',title:'The block claim loses its canonical payload. Agreement without retrievable evidence is insufficient.',detail:'I-03 violated · critical',divergence:'BLOCK EVIDENCE / AVAILABILITY',faultNode:'block',faultEdges:['e-trace-block','e-block-obs'],invariant:'I-03 · Canonical evidence consistency',check:'finalized_block_state',witness:'synthetic-node-B has full_block_available = false. The canonical payload cannot be independently compared.',mutation:'node B full_block_available = false',active:{height:'184273',hash:'0x7f4a…91c2',agreement:'1.00',reachable:'4 / 4',justification:'present',canonical:'block unavailable',proposer:'distinct'}},
  D:{...BASE,status:'WARN',state:'warn',title:'One observer disappears mid-window. The evidence basis narrows; absence is not promoted into contradiction.',detail:'I-04 warning · evidence narrowed',divergence:'NODE OBSERVATION / REACHABILITY',faultNode:'observation',faultEdges:['e-event-obs','e-block-obs'],invariant:'I-04 · Observation integrity',check:'reachability',witness:'synthetic-node-D became unreachable. Verification continues only over the reduced observation set.',mutation:'node D reachable = false; http_status = UNAVAILABLE',agreement:'0.75',quorum:'YES / NARROWED',active:{height:'184273',hash:'0x7f4a…91c2',agreement:'0.75',reachable:'3 / 4',justification:'present on reachable set',canonical:'true on reachable set',proposer:'3 observed'}},
  E:{...BASE,status:'FAIL',state:'fail',title:'A justification set disappears. The observation may exist, but its provenance chain no longer satisfies the declared invariant.',detail:'I-06 violated · provenance incomplete',divergence:'NODE OBSERVATION / JUSTIFICATION',faultNode:'observation',faultEdges:['e-block-obs','e-obs-verify'],invariant:'I-06 · Evidence provenance present',check:'observation_integrity',witness:'synthetic-node-A has justification_present = false and justification_count = 0.',mutation:'node A justification_present = false',active:{height:'184273',hash:'0x7f4a…91c2',agreement:'1.00',reachable:'4 / 4',justification:'missing on node A',canonical:'true',proposer:'distinct'}},
  F:{...BASE,status:'FAIL',state:'fail',title:'Two observations advertise the same proposer identity. Evidence count must not silently become validator count.',detail:'I-05 violated · identity collision',divergence:'NODE OBSERVATION / IDENTITY',faultNode:'observation',faultEdges:['e-event-obs','e-obs-verify'],invariant:'I-05 · Node identity consistency',check:'node_identity',witness:'synthetic-node-C reuses proposer val_0b42. Observed stake may be double-counted.',mutation:'node C proposer = val_0b42 (duplicate)',active:{height:'184273',hash:'0x7f4a…91c2',agreement:'1.00',reachable:'4 / 4',justification:'present',canonical:'true',proposer:'duplicate val_0b42'}},
  G:{...BASE,status:'FAIL',state:'fail',title:'The justification payload exists but cannot be parsed. Presence is not equivalent to usable provenance.',detail:'I-06 violated · malformed evidence',divergence:'NODE OBSERVATION / STRUCTURE',faultNode:'observation',faultEdges:['e-block-obs','e-obs-verify'],invariant:'I-06 · Evidence provenance present',check:'observation_integrity',witness:'synthetic-node-B has malformed_justification = true. The provenance payload fails structural validation.',mutation:'node B malformed_justification = true',active:{height:'184273',hash:'0x7f4a…91c2',agreement:'1.00',reachable:'4 / 4',justification:'malformed on node B',canonical:'true',proposer:'distinct'}},
  H:{...BASE,status:'FAIL',state:'fail',title:'Canonical evidence disagrees with the observed parent relationship. The stronger block claim is rejected at the evidence boundary.',detail:'I-03 violated · canonical mismatch',divergence:'BLOCK EVIDENCE / CANONICALITY',faultNode:'block',faultEdges:['e-trace-block','e-block-obs'],invariant:'I-03 · Canonical evidence consistency',check:'finalized_block_state',witness:'synthetic-node-A has canonical_consistent = false. Observed parent evidence does not bind to the canonical block path.',mutation:'node A canonical_consistent = false',active:{height:'184273',hash:'0x7f4a…91c2',agreement:'1.00',reachable:'4 / 4',justification:'present',canonical:'false on node A',proposer:'distinct'}},
};

const INVARIANTS=[
  ['I-01','Finalized height consistency','CRITICAL','reachable observations report the same finalized height'],
  ['I-02','Block hash consistency','CRITICAL','reachable observations report the same block hash'],
  ['I-03','Canonical evidence consistency','CRITICAL','full block payload is retrievable and canonical evidence agrees'],
  ['I-04','Observation integrity','WARNING','observation set is reachable with intact probe integrity'],
  ['I-05','Node identity consistency','CRITICAL','distinct proposer identities share one network and shard'],
  ['I-06','Evidence provenance present','WARNING','signature and parseable justification set accompany each observation'],
  ['I-07','Synthetic fixture classification','INFO','all displayed values remain explicitly synthetic'],
];

const CHECKS=[
  ['reachability','Reachability','WARNING','RNodeObservation'],
  ['finalized_block_cross_check','Finalized height cross-check','CRITICAL','CrossNodeReport'],
  ['finalized_block_state','Finalized block state','CRITICAL','FinalizedBlockEvidence'],
  ['node_identity','Node identity','CRITICAL','NetworkStatus'],
  ['observation_integrity','Observation integrity','WARNING','CasperEvidenceReport'],
  ['canonical_evidence','Canonical evidence','CRITICAL','FinalizedBlockEvidence'],
  ['fixture_classification','Fixture classification','INFO','Fixture'],
];

const NODES={
  event:{cls:'SOURCE EVENT',type:'EventEnvelope',id:'evt.synthetic.finality',time:'T+000ms',fields:[['claim','cross-node finalized block consistency'],['target','synthetic-rchain-node'],['network','synthetic-testnet'],['shard','root']]},
  rho:{cls:'DERIVED ARTIFACT',type:'RholangProcess',id:'proc.finality.observe',time:'T+012ms',fields:[['source','EventEnvelope'],['operation','observe + normalize'],['provenance_ref','evt.synthetic.finality'],['classification','DERIVED']]},
  trace:{cls:'DERIVED ARTIFACT',type:'ExecutionTrace',id:'trace.7f4a.184273',time:'T+041ms',fields:[['steps','deterministic'],['input_count','4 observations'],['normalization','canonical ordering'],['classification','DERIVED']]},
  block:{cls:'OBSERVED EVIDENCE',type:'FinalizedBlockEvidence',id:'block.184273',time:'T+083ms',fields:[['height','184273'],['hash','0x7f4a…91c2'],['parent','0x1c08…2f11'],['payload','available']]},
  observation:{cls:'OBSERVED EVIDENCE',type:'RNodeObservation[]',id:'obs.synthetic.4',time:'T+116ms',fields:[['observers','4'],['reachable','4 / 4'],['agreement','1.00'],['justification','present']]},
  verification:{cls:'VERIFICATION RESULT',type:'VerificationReport',id:'verify.synthetic.finality',time:'T+144ms',fields:[['status','PASS'],['invariants','7 / 7'],['claim_scope','observed synthetic evidence'],['casper_finality','NOT CLAIMED']]},
};

const EDGES=[
  ['EventEnvelope','DERIVES','RholangProcess','EventEnvelope','deploy_id','evt.synthetic.finality'],
  ['RholangProcess','EXECUTES','ExecutionTrace','RholangProcess','process_digest','sha256:2f3a…c911'],
  ['ExecutionTrace','BINDS','FinalizedBlockEvidence','ExecutionTrace','output_hash','0x7f4a…91c2'],
  ['FinalizedBlockEvidence','OBSERVED AS','RNodeObservation[]','FinalizedBlockEvidence','block_hash','0x7f4a…91c2'],
  ['RNodeObservation[]','COMPARES','CrossNodeReport','RNodeObservation','agreement_ratio','1.00'],
  ['CrossNodeReport','SUPPORTS','VerificationReport','VerificationCheck','status','PASS'],
];

const CAUSAL=[
  ['01','SOURCE EVENT','evt.synthetic.finality','bounded synthetic claim'],['02','RHOLANG PROCESS','proc.finality.observe','derived execution input'],['03','EXECUTION TRACE','trace.7f4a.184273','deterministic normalized trace'],['04','RCHAIN BLOCK','block.184273','observed block evidence'],['05','NODE OBSERVATIONS','obs.synthetic.4','four synthetic observation paths'],['06','VERIFICATION','verify.synthetic.finality','invariants + checks + witness'],
];

let activeCase='BASELINE', activeNode='event', activeMode='claim', activeEdge=0;

function statusClass(s){return s==='PASS'?'pass':s==='WARN'?'warn':'fail'}
function caseData(){return CASES[activeCase]}
function brokenInvariant(id,c){if(!c.invariant)return false;return c.invariant.startsWith(id)}

function renderCase(id,{replay=false}={}){
  if(!CASES[id])id='BASELINE'; activeCase=id; const c=CASES[id];
  $$('.case').forEach(b=>b.classList.toggle('active',b.dataset.case===id));
  $('#caseCounter').textContent=id==='BASELINE'?'00 / 08':`${id} / 08`;
  $('#caseTitle').textContent=c.title; $('#verdict').textContent=c.status; $('#verdictDetail').textContent=c.detail;
  $('.verdict-chip').dataset.state=c.state; $('#firstDivergence').textContent=`FIRST DIVERGENCE / ${c.divergence}`;
  $('#commonHeight').textContent=c.active.height; $('#agreement').textContent=c.agreement; $('#quorum').textContent=c.quorum;
  $('#claimSummary').textContent=id==='BASELINE'?'The baseline claim is accepted only because all seven declared invariants remain within the synthetic evidence boundary.':`Mutation ${id}: ${c.mutation}. The final verdict is constrained by ${c.invariant}.`;
  $('#witnessInvariant').textContent=c.invariant||'NONE'; $('#witnessText').textContent=c.witness; $('#witnessBox').classList.toggle('active',id!=='BASELINE');
  renderFaults(c,replay); renderInvariants(c); renderChecks(c); renderReplay(c); renderCausal(c); renderEvidence(c);
  const node=c.faultNode||activeNode||'event'; selectNode(node,c);
  const u=new URL(location.href); if(id==='BASELINE')u.searchParams.delete('case'); else u.searchParams.set('case',id); history.replaceState(null,'',u);
}

function renderFaults(c,replay){
  $$('.trace-node,.trace-edge').forEach(el=>el.classList.remove('fault','active'));
  if(c.faultNode)$(`.n-${c.faultNode}`)?.classList.add('fault');
  c.faultEdges.forEach(k=>$(`.${k}`)?.classList.add('fault'));
  if(replay&&!reduceMotion){const stage=$('#causalStage');stage.classList.remove('replaying');void stage.offsetWidth;stage.classList.add('replaying');setTimeout(()=>stage.classList.remove('replaying'),1500)}
}

function renderInvariants(c){
  $('#invariantGrid').innerHTML=INVARIANTS.map(([id,name,severity,detail])=>{
    const broken=brokenInvariant(id,c); const warn=activeCase==='D'&&id==='I-04'; const st=broken?(warn?'WARN':'FAIL'):'PASS';
    return `<article class="inv ${broken?'broken':''}"><div class="inv-top"><span class="inv-id">${id}</span><span class="status ${statusClass(st)}">${st}</span></div><h3>${name}</h3><p>${detail}</p><p style="margin-top:8px;color:var(--dim)">${severity}</p></article>`
  }).join('');
}

function checkStatus(id,c){if(!c.check)return 'PASS'; if(id===c.check)return c.status; if(activeCase==='D'&&id==='canonical_evidence')return 'UNAVAILABLE'; return 'PASS'}
function checkMessage(id,c){const base={reachability:'all four synthetic observers reachable',finalized_block_cross_check:'reachable nodes agree on finalized height',finalized_block_state:'height, hash and canonical block evidence agree',node_identity:'proposer identities remain distinct',observation_integrity:'signatures and justification sets are structurally usable',canonical_evidence:'full block payload and parent relationship are available',fixture_classification:'all values remain labelled synthetic'}; if(id===c.check)return c.witness; if(activeCase==='D'&&id==='canonical_evidence')return 'canonical comparison narrowed to the reachable observation set'; return base[id]}
function renderChecks(c){
  $('#checkRows').innerHTML=CHECKS.map(([id,name,severity,source])=>{const s=checkStatus(id,c);return `<div class="check-row"><span>${name}</span><span class="status ${statusClass(s==='UNAVAILABLE'?'WARN':s)}">${s}</span><span class="severity">${severity}</span><span>${checkMessage(id,c)}</span><span>${source}</span></div>`}).join('');
}

function renderCausal(c){
  $('#causalLedger').innerHTML=CAUSAL.map(([n,type,id,desc],i)=>{const key=['event','rho','trace','block','observation','verification'][i];const fault=key===c.faultNode;return `<article class="ledger-node ${fault?'fault':''}"><small>${n} / ${fault?'FIRST DIVERGENCE':'PROVENANCE'}</small><b>${type}</b><span>${id}</span><span style="margin-top:8px;color:var(--dim)">${fault?c.witness:desc}</span></article>`}).join('');
}

function renderEvidence(c){
  const edges=EDGES.map(e=>[...e]); edges[4][5]=c.agreement; edges[5][5]=c.status;
  $('#edgeList').innerHTML=edges.map((e,i)=>`<button class="edge ${i===activeEdge?'active':''}" data-edge="${i}"><b>${e[0]}</b><span>${e[1]}</span><em>${e[2]}</em></button>`).join('');
  $$('.edge').forEach(b=>b.addEventListener('click',()=>{activeEdge=+b.dataset.edge;renderEvidence(c)}));
  const e=edges[activeEdge]||edges[0]; $('#edgeRelation').textContent=e[1]; $('#edgeFields').innerHTML=`<div><dt>from</dt><dd>${e[0]}</dd></div><div><dt>to</dt><dd>${e[2]}</dd></div><div><dt>source</dt><dd>${e[3]}</dd></div><div><dt>field</dt><dd>${e[4]}</dd></div><div><dt>value</dt><dd>${e[5]}</dd></div>`;
}

function renderReplay(c){
  $('#replayVerdict').textContent=c.status; $('#activeReplay').dataset.state=c.state;
  const a=c.active; $('#replayFields').innerHTML=`<div><dt>height</dt><dd>${a.height}</dd></div><div><dt>hash</dt><dd>${a.hash}</dd></div><div><dt>agreement</dt><dd>${a.agreement}</dd></div><div><dt>status</dt><dd>${c.status}</dd></div>`;
  const rows=[['height','184273',a.height],['hash','0x7f4a…91c2',a.hash],['agreement','1.00',a.agreement],['reachable','4 / 4',a.reachable],['justification','present',a.justification],['canonical','true',a.canonical],['proposer identity','distinct',a.proposer],['verification','PASS',c.status]];
  $('#diffRows').innerHTML=rows.map(r=>`<div class="diff-row ${r[1]!==r[2]?'changed':''}"><span>${r[0]}</span><span>${r[1]}</span><span>${r[2]}</span></div>`).join('');
}

function nodeForCase(key,c){
  const n=JSON.parse(JSON.stringify(NODES[key]));
  if(key==='block'){n.fields=n.fields.map(([k,v])=>[k,k==='height'?c.active.height:k==='hash'?c.active.hash:k==='payload'?(activeCase==='C'?'UNAVAILABLE':'available'):v])}
  if(key==='observation'){n.fields=[['observers','4'],['reachable',c.active.reachable],['agreement',c.active.agreement],['justification',c.active.justification],['proposer identity',c.active.proposer]]}
  if(key==='verification'){n.fields=[['status',c.status],['first_divergence',c.divergence],['claim_scope','observed synthetic evidence'],['casper_finality','NOT CLAIMED']]}
  return n;
}
function selectNode(key,c=caseData()){
  activeNode=key; const n=nodeForCase(key,c); $$('.trace-node,.node-label').forEach(el=>el.classList.toggle('active',el.dataset.node===key));
  $('#nodeClass').textContent=n.cls; $('#nodeType').textContent=n.type; $('#nodeIdentifier').textContent=n.id; $('#nodeTime').textContent=n.time;
  $('#nodeFields').innerHTML=n.fields.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}
$$('.trace-node,.node-label').forEach(el=>el.addEventListener('click',()=>selectNode(el.dataset.node)));

function setMode(mode){
  if(!['claim','causality','evidence','replay'].includes(mode))mode='claim'; activeMode=mode;
  $$('.mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode)); $$('.mode-pane').forEach(p=>p.classList.toggle('active',p.dataset.pane===mode));
  const u=new URL(location.href); if(mode==='claim')u.searchParams.delete('mode'); else u.searchParams.set('mode',mode); history.replaceState(null,'',u);
}
$$('.mode').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$$('.case').forEach(b=>b.addEventListener('click',()=>renderCase(b.dataset.case)));
$('#replayBtn')?.addEventListener('click',()=>renderCase(activeCase,{replay:true}));

const params=new URLSearchParams(location.search); const initialCase=params.get('case')||'BASELINE'; const initialMode=params.get('mode')||'claim';
setMode(initialMode); renderCase(initialCase);

if(!reduceMotion){
  let lastX=0,lastY=0; addEventListener('pointermove',e=>{const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;document.documentElement.style.setProperty('--tilt-x',Math.max(-1,Math.min(1,dx/80)));document.documentElement.style.setProperty('--tilt-y',Math.max(-1,Math.min(1,dy/80)))},{passive:true});
}
