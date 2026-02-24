// Dial Timer — touch & mouse friendly (improved: accessibility, storage, touch targets)
(function(){
  const MAX_SECONDS = 60*60; // 60 minutes max
  const dialEl = document.getElementById('dial');
  const display = document.getElementById('timeDisplay');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const presets = document.querySelectorAll('.preset');
  const themeToggle = document.getElementById('themeToggle');

  // create SVG inside dial
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox','0 0 200 200');
  svg.setAttribute('role','img');
  svg.setAttribute('aria-hidden','true');

  const bgCircle = document.createElementNS(svgNS,'circle');
  bgCircle.setAttribute('cx',100);bgCircle.setAttribute('cy',100);bgCircle.setAttribute('r',88);
  bgCircle.setAttribute('fill','none');bgCircle.setAttribute('stroke','rgba(255,255,255,0.08)');bgCircle.setAttribute('stroke-width',22);
  svg.appendChild(bgCircle);

  const arc = document.createElementNS(svgNS,'circle');
  arc.setAttribute('cx',100);arc.setAttribute('cy',100);arc.setAttribute('r',88);
  arc.setAttribute('fill','none');arc.setAttribute('stroke','url(#g)');arc.setAttribute('stroke-width',22);
  arc.setAttribute('stroke-linecap','round');
  arc.setAttribute('transform','rotate(-90 100 100)');
  arc.setAttribute('stroke-dasharray','0 552');
  arc.style.transition = 'stroke-dasharray 220ms linear';

  // gradient defs
  const defs = document.createElementNS(svgNS,'defs');
  const lin = document.createElementNS(svgNS,'linearGradient');
  lin.setAttribute('id','g');lin.setAttribute('x1','0%');lin.setAttribute('x2','100%');
  const s1 = document.createElementNS(svgNS,'stop');s1.setAttribute('offset','0%');s1.setAttribute('stop-color','#6ee7b7');
  const s2 = document.createElementNS(svgNS,'stop');s2.setAttribute('offset','100%');s2.setAttribute('stop-color','#60a5fa');
  lin.appendChild(s1);lin.appendChild(s2);defs.appendChild(lin);svg.appendChild(defs);
  svg.appendChild(arc);

  // knob indicator (bigger for touch)
  const knob = document.createElementNS(svgNS,'circle');knob.setAttribute('cx',100);knob.setAttribute('cy',12);knob.setAttribute('r',14);knob.setAttribute('fill','#fff');knob.setAttribute('opacity','0.98');knob.setAttribute('class','knob');svg.appendChild(knob);

  dialEl.appendChild(svg);

  // ARIA slider attributes
  dialEl.setAttribute('role','slider');
  dialEl.setAttribute('aria-valuemin','0');
  dialEl.setAttribute('aria-valuemax',String(MAX_SECONDS));
  dialEl.setAttribute('tabindex','0');

  let duration = 0; // seconds
  let remaining = 0;
  let running = false;
  let tickTimer = null;

  function formatTime(s){
    s = Math.max(0, Math.round(s));
    const m = Math.floor(s/60);
    const sec = s%60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  function saveState(){
    try{
      const st = {duration,remaining,running,ts:Date.now()};
      localStorage.setItem('dial-timer-state', JSON.stringify(st));
    }catch(e){/*ignore*/}
  }
  function loadState(){
    try{
      const raw = localStorage.getItem('dial-timer-state');
      if(!raw) return;
      const st = JSON.parse(raw);
      if(typeof st.duration === 'number') duration = Math.min(MAX_SECONDS, Math.max(0, st.duration));
      if(typeof st.remaining === 'number') remaining = Math.max(0, Math.min(duration, st.remaining));
      if(typeof st.running === 'boolean') running = st.running;
    }catch(e){/*ignore*/}
  }

  function updateDisplay(){
    display.textContent = formatTime(remaining || duration);
    const frac = (duration ? ((duration - (remaining || 0)) / duration) : 0);
    const circumference = 2*Math.PI*88;
    const dash = Math.max(0, Math.min(1, frac)) * circumference;
    arc.setAttribute('stroke-dasharray', `${dash} ${circumference}`);
    // rotate knob to the end of the arc
    const angle = (frac*360||0) - 90;
    const r = 88;
    // compute knob position relative to viewbox (0..200)
    const cx = 100 + Math.cos((angle+90)*Math.PI/180) * (r);
    const cy = 100 + Math.sin((angle+90)*Math.PI/180) * (r);
    knob.setAttribute('cx', cx);
    knob.setAttribute('cy', cy);

    // aria
    dialEl.setAttribute('aria-valuenow', String(duration));
    dialEl.setAttribute('aria-valuetext', formatTime(duration));

    // buttons state
    startBtn.disabled = running || duration <= 0;
    pauseBtn.disabled = !running;

    // visual running class
    document.querySelector('.dial-card').classList.toggle('running', running);
  }

  function setDurationFromAngle(angle){
    const frac = ((angle + Math.PI/2) / (2*Math.PI));
    const norm = ((frac % 1) + 1) % 1; // 0..1
    duration = Math.round(norm * MAX_SECONDS);
    if(duration < 1) duration = 1;
    remaining = 0;
    saveState();
    updateDisplay();
  }

  function getPointerAngle(evt){
    const rect = svg.getBoundingClientRect();
    const x = (evt.clientX !== undefined ? evt.clientX : (evt.touches && evt.touches[0].clientX)) - rect.left;
    const y = (evt.clientY !== undefined ? evt.clientY : (evt.touches && evt.touches[0].clientY)) - rect.top;
    const cx = rect.width/2;
    const cy = rect.height/2;
    const dx = x - cx;
    const dy = y - cy;
    return Math.atan2(dy, dx);
  }

  let dragging = false;
  function onPointerDown(e){
    e.preventDefault();
    dragging = true;
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    const a = getPointerAngle(e);
    setDurationFromAngle(a);
  }
  function onPointerMove(e){
    if(!dragging) return;
    const a = getPointerAngle(e);
    setDurationFromAngle(a);
  }
  function onPointerUp(e){
    dragging = false;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  }

  svg.addEventListener('pointerdown', onPointerDown, {passive:false});
  svg.addEventListener('touchstart', function(e){e.preventDefault()}, {passive:false});

  // keyboard support
  dialEl.addEventListener('keydown', (e)=>{
    if(e.key === 'ArrowRight') { duration = Math.min(MAX_SECONDS, duration + 60); saveState(); updateDisplay(); }
    if(e.key === 'ArrowLeft') { duration = Math.max(1, duration - 60); saveState(); updateDisplay(); }
    if(e.key === 'ArrowUp') { duration = Math.min(MAX_SECONDS, duration + 5); saveState(); updateDisplay(); }
    if(e.key === 'ArrowDown') { duration = Math.max(1, duration - 5); saveState(); updateDisplay(); }
  });

  // controls
  function startTimer(){
    if(running) return;
    if(!duration) return;
    if(remaining === 0) remaining = duration;
    running = true;
    saveState();
    tickTimer = setInterval(()=>{
      if(remaining <= 0){ clearInterval(tickTimer); running=false; remaining=0; updateDisplay(); beep(); saveState(); return; }
      remaining -= 1; updateDisplay(); saveState();
    },1000);
  }
  startBtn.addEventListener('click', startTimer);
  pauseBtn.addEventListener('click', ()=>{
    if(!running) return;
    running=false;clearInterval(tickTimer);saveState();updateDisplay();
  });
  resetBtn.addEventListener('click', ()=>{
    running=false;clearInterval(tickTimer);remaining=0;duration=0;saveState();updateDisplay();
  });
  presets.forEach(btn=>btn.addEventListener('click', (e)=>{
    const text = e.target.textContent.trim();
    const minutes = parseInt(text.replace('m',''))||0;
    duration = Math.min(MAX_SECONDS, minutes*60); remaining=0; saveState(); updateDisplay();
  }));

  // beep using WebAudio
  function beep(){
    try{
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type='sine';o.frequency.value=880;g.gain.value=0.001;
      o.connect(g);g.connect(ctx.destination);
      o.start();g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      o.stop(ctx.currentTime + 0.65);
    }catch(err){console.warn('audio failed',err)}
  }

  // theme persistence
  function saveTheme(isLight){
    try{ localStorage.setItem('dial-timer-theme', isLight ? 'light' : 'dark'); }catch(e){}
  }
  function loadTheme(){
    try{
      const t = localStorage.getItem('dial-timer-theme');
      if(t === 'light'){
        document.documentElement.classList.add('light');
        themeToggle.checked = true;
      }else{
        document.documentElement.classList.remove('light');
        themeToggle.checked = false;
      }
    }catch(e){}
  }
  themeToggle.addEventListener('change',(e)=>{
    if(e.target.checked) { document.documentElement.classList.add('light'); saveTheme(true); }
    else { document.documentElement.classList.remove('light'); saveTheme(false); }
  });

  // save state on unload
  window.addEventListener('beforeunload', saveState);

  // load stored theme and state
  loadTheme();
  loadState();
  updateDisplay();

  // if was running, do NOT auto-resume; just show saved remaining
})();
