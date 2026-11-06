/* Original, synthesized soundscape; no external audio or tracking. */
'use strict';
const Soundscape = (() => {
  let ctx = null, master = null, music = null, effects = null, timer = 0, step = 0, scene = 'menu', started = false;
  const musicOn = () => Store.S.set.music !== 0;
  const effectsOn = () => Store.S.set.sfx !== 0;
  function init() {
    if (ctx) return true;
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return false;
    try {
      ctx = new A(); master = ctx.createGain(); master.gain.value = .45; master.connect(ctx.destination);
      music = ctx.createGain(); music.gain.value = .20; music.connect(master);
      effects = ctx.createGain(); effects.gain.value = .48; effects.connect(master);
      return true;
    } catch (_) { ctx = null; return false; }
  }
  function note(freq, duration, volume, wave, target, when) {
    if (!ctx || !target) return;
    const t = Math.max(ctx.currentTime, when || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave || 'sine'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + duration); o.connect(g); g.connect(target);
    o.start(t); o.stop(t + duration + .02); o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  const Hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const tracks = {
    menu:  { bpm: 88, seq: [57,64,69,71, 60,67,72,67, 53,60,65,69, 55,62,67,64], base: [45,48,41,43] },
    game:  { bpm: 104, seq: [60,67,72,67, 57,64,69,64, 53,60,65,60, 55,62,67,62], base: [48,45,41,43] },
    fight: { bpm: 132, seq: [57,64,69,64, 57,65,69,65, 53,60,65,60, 55,62,67,62], base: [45,45,41,43] },
  };
  function schedule() {
    clearInterval(timer); timer = 0;
    if (!ctx || !started || !musicOn() || document.hidden) return;
    const t = tracks[scene] || tracks.menu, interval = 60 / t.bpm / 2 * 1000;
    const beat = () => {
      if (!ctx || ctx.state !== 'running' || document.hidden || !musicOn()) return;
      const i = step++ % 16, when = ctx.currentTime + .025;
      note(Hz(t.seq[i]), .26, .22, 'sine', music, when);
      if (i % 4 === 0) note(Hz(t.base[i / 4]), .70, .24, 'triangle', music, when);
    };
    beat(); timer = setInterval(beat, interval);
  }
  function unlock() {
    if (!musicOn() && !effectsOn()) return;
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!started) { started = true; schedule(); }
    else if (!timer && musicOn()) schedule();
  }
  function setScene(s) { s = tracks[s] ? s : 'menu'; if (scene !== s) { scene = s; step = 0; schedule(); } }
  function update() { if (started) schedule(); }
  function play(name) {
    if (!effectsOn() || !ctx || ctx.state !== 'running' || document.hidden) return;
    const patterns = {
      tap: [[76,.055,.12]], place: [[76,.10,.22],[83,.16,.15,.06]], miss: [[55,.15,.18]],
      hint: [[74,.10,.18],[79,.19,.16,.08]], countdown: [[69,.11,.20]], start: [[72,.12,.18],[79,.20,.20,.09]],
      win: [[72,.15,.22],[76,.15,.22,.12],[79,.15,.22,.24],[84,.35,.24,.36]],
      lose: [[67,.18,.19],[63,.20,.18,.15],[60,.36,.16,.3]],
      skill: [[64,.10,.18],[71,.12,.19,.08],[79,.22,.19,.16]], reward: [[79,.12,.19],[84,.22,.17,.1]],
    };
    for (const [n,d,v,delay] of patterns[name] || []) note(Hz(n), d, v, name === 'miss' ? 'triangle' : 'sine', effects, ctx.currentTime + (delay || 0));
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearInterval(timer); timer = 0; if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
    else if (ctx && started) ctx.resume().then(schedule).catch(() => {});
  });
  document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  document.addEventListener('keydown', unlock, { capture: true });
  return { unlock, setScene, update, play };
})();
