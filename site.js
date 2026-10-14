document.documentElement.classList.add('js');

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const scenarios = {
  baseline: {
    name: 'BASELINE', state: 'pass', verdict: 'PASS', divergence: 'NONE',
    boundary: 'TASK-BOUND / LOCAL', root: 'a8f2…9c71',
    reason: 'two non-submitter identities reproduced the bounded claim',
    faults: [], edges: [],
    events: [
      ['01','TASK','bounded workload + reviewer policy pinned','ok'],
      ['02','IDENTITY','three process identities opened from durable state','ok'],
      ['03','REVIEW-01','registered deterministic verifier reproduced claim','ok'],
      ['04','REVIEW-02','independent receipt agrees within declared scope','ok'],
      ['05','PACKAGE','canonical evidence root verified and replayable','ok'],
    ],
  },
  equivocation: {
    name: 'EQUIVOCATION', state: 'blocked', verdict: 'BLOCKED', divergence: 'CBC LINEAGE',
    boundary: 'INTEGRATION / PINNED', root: '41be…e302',
    reason: 'conflicting latest-message lineage blocks the stronger finality claim',
    faults: ['.reviewer-a'], edges: ['.edge-c'],
    events: [
      ['01','TASK','RChain witness declaration accepted as bounded input','ok'],
      ['02','REPLAY','pinned integration path loaded','ok'],
      ['03','CBC','conflicting latest-message lineage observed','warn'],
      ['04','FINALITY','claim cannot cross the finality boundary','warn'],
      ['05','REPORT','BLOCKED preserved; contradiction is not hidden','warn'],
    ],
  },
  partition: {
    name: 'NETWORK PARTITION', state: 'blocked', verdict: 'BLOCKED', divergence: 'WITNESS INCOMPLETE',
    boundary: 'OBSERVATION ONLY', root: '7c19…0aa4',
    reason: 'one review path lacks sufficient observation evidence; absence is not negation',
    faults: ['.reviewer-b'], edges: ['.edge-b','.edge-d'],
    events: [
      ['01','TASK','bounded task and trust context accepted','ok'],
      ['02','REVIEW-01','first independent reproduction completed','ok'],
      ['03','NETWORK','second observation path becomes incomplete','warn'],
      ['04','QUORUM','required independent evidence is unavailable','warn'],
      ['05','REPORT','BLOCKED returned instead of manufacturing certainty','warn'],
    ],
  },
  tamper: {
    name: 'TAMPERED PACKAGE', state: 'fail', verdict: 'FAIL', divergence: 'PACKAGE ROOT',
    boundary: 'SIGNATURE ≠ TRUST', root: 'd911…FAIL',
    reason: 'package bytes no longer bind to the signed evidence root',
    faults: ['.package-node'], edges: ['.edge-e','.edge-f'],
    events: [
      ['01','TASK','review context loaded from trusted local pins','ok'],
      ['02','RECEIPTS','reviewer signatures remain individually valid','ok'],
      ['03','PACKAGE','canonical package bytes differ from signed root','fail'],
      ['04','VERIFY','integrity check rejects the mutated package','fail'],
      ['05','REPORT','FAIL emitted before semantic claim evaluation','fail'],
    ],
  },
};

let eventTimers = [];
let activeScenario = 'baseline';

function clearEventTimers(){ eventTimers.forEach(clearTimeout); eventTimers = []; }

function appendEvent(evt, index){
  const log = $('#eventLog');
  const li = document.createElement('li');
  li.innerHTML = `<span>${evt[0]}</span><span class="event-state ${evt[3]}">${evt[1]}</span><span>${evt[2]}</span>`;
  li.style.opacity = '0';
  li.style.transform = 'translateY(4px)';
  log.append(li);
  requestAnimationFrame(() => {
    li.style.transition = 'opacity .28s ease, transform .28s ease';
    li.style.opacity = '1';
    li.style.transform = 'none';
  });
  $('#scenarioStep').textContent = `STEP ${String(index + 1).padStart(2,'0')}/05`;
}

function setScenario(key, animate = true){
  activeScenario = key;
  const s = scenarios[key];
  $$('.scenario').forEach(btn => btn.classList.toggle('active', btn.dataset.scenario === key));
  const stage = $('.lab-stage');
  stage.dataset.state = s.state;
  $('#scenarioName').textContent = s.name;
  $('#labVerdict').textContent = s.verdict;
  $('#labDivergence').textContent = s.divergence;
  $('#labBoundary').textContent = s.boundary;
  $('#labRoot').textContent = s.root;
  $('#heroVerdict').textContent = s.verdict;
  $('#heroDivergence').textContent = s.divergence;
  $('#heroReason').textContent = s.reason;
  $('.console-verdict > div:first-child strong').style.color = s.state === 'pass' ? 'var(--green)' : s.state === 'blocked' ? 'var(--amber)' : 'var(--red)';

  $$('.map-node,.net-edge', stage).forEach(el => el.classList.remove('fault'));
  s.faults.forEach(sel => $(sel, stage)?.classList.add('fault'));
  s.edges.forEach(sel => $(sel, stage)?.classList.add('fault'));

  clearEventTimers();
  const log = $('#eventLog');
  log.innerHTML = '';
  $('#eventCount').textContent = `${s.events.length} EVENTS`;
  $('#scenarioStep').textContent = 'STEP 00/05';
  if (!animate || reduceMotion) {
    s.events.forEach((evt, i) => appendEvent(evt, i));
  } else {
    s.events.forEach((evt, i) => {
      eventTimers.push(setTimeout(() => appendEvent(evt, i), 110 + i * 190));
    });
  }
}

$$('.scenario').forEach(btn => btn.addEventListener('click', () => setScenario(btn.dataset.scenario)));
$('#replayScenario')?.addEventListener('click', () => setScenario(activeScenario, true));
setScenario('baseline', false);

function updateClock(){
  const d = new Date();
  $('#consoleClock').textContent = d.toISOString().slice(11,19) + 'Z';
}
updateClock(); setInterval(updateClock, 1000);

function updateScroll(){
  const max = document.documentElement.scrollHeight - innerHeight;
  const pct = max > 0 ? Math.min(100, (scrollY / max) * 100) : 0;
  document.documentElement.style.setProperty('--scroll', pct + '%');
  $('.topbar')?.classList.toggle('scrolled', scrollY > 16);
}
addEventListener('scroll', updateScroll, {passive:true}); updateScroll();

if (matchMedia('(pointer:fine)').matches) {
  addEventListener('pointermove', e => {
    document.documentElement.style.setProperty('--mx', e.clientX + 'px');
    document.documentElement.style.setProperty('--my', e.clientY + 'px');
  }, {passive:true});
}

const revealEls = $$('.reveal');
if (!reduceMotion && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, {threshold:.08, rootMargin:'0px 0px -5%'});
  revealEls.forEach(el => observer.observe(el));
} else {
  revealEls.forEach(el => el.classList.add('in'));
}

function initCausalField(){
  const canvas = $('#causalField');
  if (!canvas || reduceMotion) return;
  const ctx = canvas.getContext('2d', {alpha:true});
  let w = innerWidth, h = innerHeight, dpr = 1, nodes = [], edges = [], last = 0;
  const seed = n => { const x = Math.sin(n * 999.127) * 43758.5453123; return x - Math.floor(x); };
  const mobile = () => innerWidth < 700;

  function rebuild(){
    w = innerWidth; h = innerHeight; dpr = Math.min(devicePixelRatio || 1, mobile() ? 1.1 : 1.5);
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const count = mobile() ? 16 : w < 1100 ? 26 : 38;
    nodes = Array.from({length:count}, (_,i) => ({
      x: seed(i + 3) * w,
      y: (.05 + seed(i + 53) * .9) * h,
      r: i % 9 === 0 ? 1.9 : 1.05,
      phase: seed(i + 101) * Math.PI * 2,
    }));
    edges = [];
    const limit = mobile() ? 155 : w < 1100 ? 190 : 235;
    for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i],b=nodes[j],dist=Math.hypot(a.x-b.x,a.y-b.y);
      if(dist<limit && edges.length < count * 3) edges.push({a,b,dist,limit});
    }
  }

  function draw(ts){
    requestAnimationFrame(draw);
    if(ts-last < 34) return; last=ts;
    ctx.clearRect(0,0,w,h);
    const cx = w*(.55 + .12*Math.sin(ts/8300));
    const cy = h*(.34 + .08*Math.cos(ts/7100));
    const wave = ((ts%9000)/9000) * Math.hypot(w,h)*.8;
    for(const e of edges){
      const midx=(e.a.x+e.b.x)/2, midy=(e.a.y+e.b.y)/2;
      const d=Math.hypot(midx-cx,midy-cy);
      const active=Math.abs(d-wave)<95;
      const alpha=(1-e.dist/e.limit)*(active?.10:.035);
      ctx.strokeStyle=active?`rgba(186,255,92,${alpha+.035})`:`rgba(154,176,164,${alpha})`;
      ctx.lineWidth=active?.65:.42;
      ctx.beginPath();ctx.moveTo(e.a.x,e.a.y);ctx.lineTo(e.b.x,e.b.y);ctx.stroke();
    }
    for(const n of nodes){
      const d=Math.hypot(n.x-cx,n.y-cy),active=Math.abs(d-wave)<75;
      const breathe=.5+.5*Math.sin(ts/850+n.phase);
      ctx.fillStyle=active?`rgba(186,255,92,${.19+.20*breathe})`:`rgba(196,215,204,${.055+.035*breathe})`;
      ctx.beginPath();ctx.arc(n.x,n.y,n.r+(active?.7:0),0,Math.PI*2);ctx.fill();
    }
  }
  let resizeTimer;
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(rebuild,120)},{passive:true});
  rebuild(); requestAnimationFrame(draw);
}
initCausalField();
