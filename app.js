// Dial Timer — touch & mouse friendly
(function(){
  const MAX_SECONDS = 60*60; // 60 minutes max
  const dialEl = document.getElementById('dial');
  const display = document.getElementById('timeDisplay');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const decBtn = document.getElementById('decBtn');
  const incBtn = document.getElementById('incBtn');
  const editTimeBtn = document.getElementById('editTimeBtn');
  const presets = document.querySelectorAll('.preset');
  const themeToggle = document.getElementById('themeToggle');

  // create SVG inside dial
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox','0 0 200 200');
  const bgCircle = document.createElementNS(svgNS,'circle');
  bgCircle.setAttribute('cx',100);bgCircle.setAttribute('cy',100);bgCircle.setAttribute('r',88);
  bgCircle.setAttribute('fill','none');bgCircle.setAttribute('stroke','rgba(255,255,255,0.06)');bgCircle.setAttribute('stroke-width',18);
  svg.appendChild(bgCircle);
  const arc = document.createElementNS(svgNS,'circle');
  arc.setAttribute('cx',100);arc.setAttribute('cy',100);arc.setAttribute('r',88);
  arc.setAttribute('fill','none');arc.setAttribute('stroke','url(#g)');arc.setAttribute('stroke-width',18);
  arc.setAttribute('stroke-linecap','round');
  arc.setAttribute('transform','rotate(-90 100 100)');
  arc.setAttribute('stroke-dasharray','0 999');

  // gradient defs
  const defs = document.createElementNS(svgNS,'defs');
  const lin = document.createElementNS(svgNS,'linearGradient');
  lin.setAttribute('id','g');lin.setAttribute('x1','0%');lin.setAttribute('x2','100%');
  const s1 = document.createElementNS(svgNS,'stop');s1.setAttribute('offset','0%');s1.setAttribute('stop-color','#6ee7b7');
  const s2 = document.createElementNS(svgNS,'stop');s2.setAttribute('offset','100%');s2.setAttribute('stop-color','#60a5fa');
  lin.appendChild(s1);lin.appendChild(s2);defs.appendChild(lin);svg.appendChild(defs);
  svg.appendChild(arc);

  // knob indicator
  const knob = document.createElementNS(svgNS,'circle');knob.setAttribute('cx',100);knob.setAttribute('cy',12);knob.setAttribute('r',6);knob.setAttribute('fill','#fff');knob.setAttribute('opacity','0.95');knob.setAttribute('class','knob');svg.appendChild(knob);

  dialEl.appendChild(svg);

  let duration = 0; // seconds
  let remaining = 0;
  let running = false;
  let tickTimer = null;
  let audioCtx = null; // created on first user gesture

  function formatTime(s){
    s = Math.max(0, Math.round(s));
    const m = Math.floor(s/60);
    const sec = s%60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  function clamp(val, min, max){
    return Math.min(max, Math.max(min, val));
  }

  function parseTimeInput(text){
    if(!text) return null;
    const raw = String(text).trim();
    if(!raw) return null;
    if(raw.includes(':')){
      const parts = raw.split(':');
      if(parts.length !== 2) return null;
      const m = parseInt(parts[0], 10);
      const s = parseInt(parts[1], 10);
      if(Number.isNaN(m) || Number.isNaN(s)) return null;
      return (m * 60) + s;
    }
    const m = parseFloat(raw);
    if(Number.isNaN(m)) return null;
    return Math.round(m * 60);
  }

  function stopTimer(){
    running = false;
    clearInterval(tickTimer);
  }

  function setExactDuration(seconds){
    const next = clamp(seconds, 0, MAX_SECONDS);
    duration = next;
    remaining = 0;
    stopTimer();
    updateDisplay();
  }

  function openEditTime(){
    const current = (running || remaining > 0) ? remaining : duration;
    const input = prompt('Enter time (mm:ss or minutes)', formatTime(current));
    if(input === null) return;
    const seconds = parseTimeInput(input);
    if(seconds === null){
      alert('Invalid time. Use mm:ss or minutes.');
      return;
    }
    setExactDuration(seconds);
  }

  function applyDelta(delta){
    if(running || remaining > 0){
      let nextRemaining = clamp(remaining + delta, 0, MAX_SECONDS);
      let nextDuration = clamp(duration + delta, 0, MAX_SECONDS);
      nextDuration = Math.max(nextDuration, nextRemaining);
      remaining = nextRemaining;
      duration = nextDuration;
      if(running && remaining === 0){
        stopTimer();
      }
      updateDisplay();
      return;
    }
    duration = clamp(duration + delta, 0, MAX_SECONDS);
    updateDisplay();
  }

  function startTimer(){
    if(running) return;
    if(!duration && remaining === 0) return;
    // ensure AudioContext created on user gesture to satisfy autoplay policies
    try{ if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){/*ignore*/}
    if(remaining === 0) remaining = duration;
    if(remaining === 0) return;
    running = true;
    tickTimer = setInterval(()=>{
      if(remaining <= 0){
        stopTimer();
        remaining = 0;
        updateDisplay();
        beep();
        return;
      }
      remaining -= 1;
      updateDisplay();
    },1000);
  }

  function pauseTimer(){
    if(!running) return;
    stopTimer();
    updateDisplay();
  }

  function resetTimer(){
    stopTimer();
    remaining = 0;
    updateDisplay();
  }

  function updateStartState(){
    const disabled = (duration === 0);
    startBtn.disabled = disabled;
    startBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }

  // ensure dial has ARIA atoms
  dialEl.setAttribute('aria-valuemin','0');
  dialEl.setAttribute('aria-valuemax', String(MAX_SECONDS));

  function updateDisplay(){
    // Show remaining while running/paused, otherwise show set duration
    const valueToShow = (running || remaining > 0) ? remaining : duration;
    display.textContent = formatTime(valueToShow);

    const frac = (duration && (running || remaining > 0)) ? ((duration - valueToShow) / duration) : 0;
    const dash = Math.max(0, Math.min(1, frac)) * (2*Math.PI*88);
    arc.setAttribute('stroke-dasharray', `${dash} ${2*Math.PI*88}`);
    // rotate knob
    const angle = (frac*360||0) - 90;
    const r = 88;
    const cx = 100 + Math.cos((angle+90)*Math.PI/180) * (r);
    const cy = 100 + Math.sin((angle+90)*Math.PI/180) * (r);
    knob.setAttribute('cx', cx);
    knob.setAttribute('cy', cy);

    // ARIA updates
    dialEl.setAttribute('aria-valuenow', String(valueToShow));
    dialEl.setAttribute('aria-valuetext', formatTime(valueToShow));

    updateStartState();
  }

  function setDurationFromAngle(angle){
    // angle in radians from center (0 = to the right); convert to fraction (0..1) with top as 0
    // map full circle to MAX_SECONDS
    // we want 0 at top. Convert: frac = ((angle + Math.PI/2) / (2*Math.PI)) mod 1
    const frac = ((angle + Math.PI/2) / (2*Math.PI));
    const norm = ((frac % 1) + 1) % 1; // 0..1
    duration = Math.round(norm * MAX_SECONDS);
    // enforce minimum of 1 second
    if(duration < 1) duration = 1;
    remaining = 0;
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

  // keyboard support: left/right to +/- 1 minute, up/down +/- 5 seconds
  dialEl.addEventListener('keydown', (e)=>{
    if(e.key === 'ArrowRight') { applyDelta(60); }
    if(e.key === 'ArrowLeft') { applyDelta(-60); }
    if(e.key === 'ArrowUp') { applyDelta(5); }
    if(e.key === 'ArrowDown') { applyDelta(-5); }
    if(e.key === '+' || e.key === '=') { e.preventDefault(); applyDelta(5); }
    if(e.key === '-' || e.key === '_') { e.preventDefault(); applyDelta(-5); }
  });

  document.addEventListener('keydown', (e)=>{
    const active = document.activeElement;
    const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
    if(isInput) return;
    if(e.code === 'Space' || e.key === ' '){
      e.preventDefault();
      if(running) pauseTimer();
      else startTimer();
    }
    if(e.key === '+' || e.key === '='){
      e.preventDefault();
      applyDelta(5);
    }
    if(e.key === '-' || e.key === '_'){
      e.preventDefault();
      applyDelta(-5);
    }
  });

  // controls
  startBtn.addEventListener('click', startTimer);
  pauseBtn.addEventListener('click', pauseTimer);
  resetBtn.addEventListener('click', resetTimer);
  decBtn.addEventListener('click', ()=>applyDelta(-30));
  incBtn.addEventListener('click', ()=>applyDelta(30));
  editTimeBtn.addEventListener('click', openEditTime);
  display.addEventListener('click', openEditTime);
  display.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      openEditTime();
    }
  });
  presets.forEach(btn=>btn.addEventListener('click', (e)=>{
    const text = e.target.textContent.trim();
    const minutes = parseInt(text.replace('m',''))||0;
    duration = minutes*60; remaining=0; updateDisplay();
  }));

  // beep using WebAudio
  function beep(){
    try{
      if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type='sine';o.frequency.value=880;g.gain.value=0.001; // soft
      o.connect(g);g.connect(audioCtx.destination);
      o.start();g.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6);
      o.stop(audioCtx.currentTime + 0.65);
    }catch(err){console.warn('audio failed',err)}
  }

  // theme toggle
  themeToggle.addEventListener('change',(e)=>{
    if(e.target.checked) document.documentElement.classList.add('light');
    else document.documentElement.classList.remove('light');
  });

  // initial display update
  updateDisplay();
})();
