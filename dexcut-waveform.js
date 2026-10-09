/* DEX//CUT waveform and visual time editor. Browser-native; no uploads or dependencies. */
(() => {
  'use strict';

  const COUNT = 480;
  const MAX_DECODE_BYTES = 24 * 1024 * 1024;
  const MAX_DECODE_SECONDS = 240;
  const MODES = { ending: 'ending', clip: 'range', gif: 'range', picture: 'point' };
  const cache = new WeakMap();
  const surfaces = new Set();
  let source = null;
  let editor = null;
  let sheetResult = null;
  let hubResult = null;
  let current = null;
  let editorConfig = null;

  const byId = id => document.getElementById(id);
  const clamp = (n, a, b) => Math.min(b, Math.max(a, Number.isFinite(n) ? n : a));
  const tenths = n => Math.round(n * 10) / 10;
  const num = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  function clock(seconds) {
    if (!Number.isFinite(seconds)) return '--:--';
    const t = Math.max(0, seconds);
    const h = Math.floor(t / 3600);
    const m = Math.floor(t % 3600 / 60);
    const s = (t % 60).toFixed(1).padStart(4, '0');
    return (h ? String(h) + ':' + String(m).padStart(2, '0') : String(m)) + ':' + s;
  }
  function modeLength(mode) { return mode === 'gif' ? 20 : mode === 'ending' ? 600 : 3600; }
  function minLength(duration) { return Math.min(1, duration); }

  function realPeaks(buffer) {
    const channelCount = Math.min(buffer.numberOfChannels, 2);
    const data = [];
    for (let ch = 0; ch < channelCount; ch++) data.push(buffer.getChannelData(ch));
    const result = new Float32Array(COUNT);
    for (let x = 0; x < COUNT; x++) {
      const start = Math.floor(x * buffer.length / COUNT);
      const end = Math.max(start + 1, Math.floor((x + 1) * buffer.length / COUNT));
      const stride = Math.max(1, Math.ceil((end - start) / 320));
      let peak = 0;
      for (let k = start; k < end; k += stride) {
        for (let ch = 0; ch < data.length; ch++) peak = Math.max(peak, Math.abs(data[ch][k] || 0));
      }
      result[x] = Math.min(1, peak);
    }
    return result;
  }

  function decodePeaks(file) {
    if (cache.has(file)) return cache.get(file);
    const promise = (async () => {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || file.size > MAX_DECODE_BYTES) return null;
      let context;
      try {
        context = new AC();
        const buffer = await context.decodeAudioData(await file.arrayBuffer());
        return realPeaks(buffer);
      } catch (_) {
        return null; // Some video containers and audio codecs cannot be decoded by Web Audio.
      } finally {
        if (context) context.close().catch(() => {});
      }
    })();
    cache.set(file, promise);
    return promise;
  }

  function bounds(s) {
    const d = s.duration;
    const v = s.values || {};
    if (s.mode === 'point') {
      const at = clamp(num(v.time, 1), 0, d);
      return { start: at, end: at };
    }
    if (s.mode === 'ending') {
      return { start: Math.max(0, d - clamp(num(v.seconds, 10), 0, modeLength(s.mode))), end: d };
    }
    if (s.mode === 'range') {
      const start = clamp(num(v.start, 0), 0, d);
      const end = clamp(start + clamp(num(v.length, s.job === 'gif' ? 4 : 10), 0, modeLength(s.job)), start, d);
      return { start, end };
    }
    return { start: 0, end: d };
  }

  function notify(s, update) {
    if (!s.values || !s.fields) return;
    for (const [key, value] of Object.entries(update)) {
      s.values[key] = tenths(value);
      const input = s.fields.querySelector('[data-key="' + key + '"]');
      if (input && input.value !== String(s.values[key])) {
        input.value = String(s.values[key]);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    updateVisual(s);
  }

  function choose(s, first, last) {
    const d = s.duration;
    if (!(d > 0)) return;
    if (s.mode === 'point') {
      notify(s, { time: clamp(first, 0, d) });
    } else if (s.mode === 'ending') {
      notify(s, { seconds: clamp(d - clamp(first, 0, d), minLength(d), Math.min(d, 600)) });
    } else if (s.mode === 'range') {
      const low = clamp(Math.min(first, last), 0, d);
      const max = Math.min(d, modeLength(s.job));
      const span = clamp(Math.abs(last - first), minLength(d), max);
      const start = clamp(low, 0, d - span);
      notify(s, { start, length: span });
    }
  }

  function timestampPosition(s, clientX) {
    const r = s.track.getBoundingClientRect();
    return r.width > 0 ? clamp((clientX - r.left) / r.width, 0, 1) * s.duration : 0;
  }

  function playtime(s, selection) {
    if (s.destroyed || !(s.duration > 0)) return;
    if (!s.media.paused) { s.media.pause(); return; }
    for (const other of surfaces) if (other !== s) other.media.pause();
    const b = bounds(s);
    s.stopAt = selection && s.mode !== 'none' && s.mode !== 'point' ? b.end : null;
    const jump = selection && s.mode !== 'none' ? b.start : s.media.currentTime;
    if (jump >= s.duration - .05) s.media.currentTime = 0;
    else if (selection) s.media.currentTime = jump;
    const result = s.media.play();
    if (result && result.catch) result.catch(() => { s.status.textContent = 'Playback unavailable for this codec'; });
  }

  function updateVisual(s) {
    if (s.destroyed) return;
    const d = s.duration;
    const b = bounds(s);
    const set = (el, value) => { if (el) el.textContent = value; };
    set(s.elapsed, clock(s.media.currentTime));
    set(s.total, clock(d || NaN));
    set(s.startText, s.mode === 'point' ? 'MOMENT ' + clock(b.start) : 'IN ' + clock(b.start));
    set(s.endText, 'OUT ' + clock(b.end));
    set(s.lengthText, 'LENGTH ' + clock(b.end - b.start));
    const positive = d > 0;
    s.track.classList.toggle('dc-ready', positive);
    const px = t => positive ? (t / d * 100) + '%' : '0%';
    s.playhead.style.left = px(s.media.currentTime || 0);
    s.selection.style.left = px(b.start);
    s.selection.style.width = s.mode === 'point' ? '0%' : positive ? Math.max(0, (b.end - b.start) / d * 100) + '%' : '0%';
    if (s.startHandle) s.startHandle.style.left = 'clamp(23px,' + px(b.start) + ',calc(100% - 23px))';
    if (s.endHandle) s.endHandle.style.left = 'clamp(23px,' + px(b.end) + ',calc(100% - 23px))';
    s.previewButton.textContent = s.media.paused ? (s.mode === 'none' ? 'Play / pause' : 'Preview selection') : 'Pause playback';
    draw(s);
  }

  function draw(s) {
    if (s.destroyed) return;
    const width = Math.round(s.canvas.getBoundingClientRect().width);
    if (width < 1) return;
    const height = 98;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    const wantWidth = Math.max(1, Math.round(width * scale));
    if (s.canvas.width !== wantWidth || s.canvas.height !== Math.round(height * scale)) {
      s.canvas.width = wantWidth;
      s.canvas.height = Math.round(height * scale);
    }
    const ctx = s.canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(176,177,191,.12)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const x = Math.round(width * i / 8) + .5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(178,180,192,.26)';
    ctx.beginPath(); ctx.moveTo(0, height / 2 + .5); ctx.lineTo(width, height / 2 + .5); ctx.stroke();
    const peaks = s.peaks || s.live;
    const played = s.duration > 0 ? clamp((s.media.currentTime || 0) / s.duration, 0, 1) : 0;
    for (let i = 0; i < COUNT; i++) {
      const amplitude = peaks[i];
      if (!(amplitude > 0)) continue;
      const x = i / COUNT * width;
      const h = Math.max(1, amplitude * height * .44);
      ctx.fillStyle = i / COUNT <= played ? '#ff665c' : '#8795ad';
      ctx.fillRect(x, height / 2 - h, Math.max(1, width / COUNT + .4), h * 2);
    }
  }

  async function startCapture(s) {
    if (s.analyser || s.destroyed) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      if (ctx.state !== 'running') await ctx.resume();
      if (ctx.state !== 'running') { await ctx.close(); return; }
      if (s.destroyed) { await ctx.close(); return; }
      const source = ctx.createMediaElementSource(s.media);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      s.context = ctx;
      s.analyser = analyser;
      s.sample = new Uint8Array(analyser.fftSize);
      await ctx.resume();
    } catch (_) {
      // Playback and manual time editing still work if a browser blocks audio analysis.
      if (s.context) s.context.close().catch(() => {});
      s.context = null;
      s.analyser = null;
    }
  }

  function paintFrame(s) {
    if (s.destroyed || s.media.paused) return;
    if (s.analyser && s.duration > 0) {
      s.analyser.getByteTimeDomainData(s.sample);
      let sum = 0;
      for (let i = 0; i < s.sample.length; i++) {
        const v = (s.sample[i] - 128) / 128;
        sum += v * v;
      }
      const bucket = Math.min(COUNT - 1, Math.floor(s.media.currentTime / s.duration * COUNT));
      if (bucket >= 0) s.live[bucket] = Math.max(s.live[bucket], Math.min(1, Math.sqrt(sum / s.sample.length) * 3.4));
      if (!s.peaks) s.status.textContent = 'Live signal · builds during playback';
    }
    updateVisual(s);
    s.frame = requestAnimationFrame(() => paintFrame(s));
  }

  function attachPointer(s) {
    if (s.mode === 'none' || s.mode === 'point') {
      s.track.addEventListener('pointerdown', e => {
        if (!(s.duration > 0) || e.target.closest('.dc-handle')) return;
        const at = timestampPosition(s, e.clientX);
        if (s.mode === 'point') choose(s, at, at);
        s.media.currentTime = at;
        updateVisual(s);
      });
    } else {
      let gesture = null;
      s.track.addEventListener('pointerdown', e => {
        if (!(s.duration > 0) || e.target.closest('.dc-handle')) return;
        gesture = { at: timestampPosition(s, e.clientX), x: e.clientX, dragged: false };
        s.track.setPointerCapture(e.pointerId);
      });
      s.track.addEventListener('pointermove', e => {
        if (!gesture) return;
        if (Math.abs(e.clientX - gesture.x) >= 7) gesture.dragged = true;
        if (gesture.dragged) choose(s, gesture.at, timestampPosition(s, e.clientX));
      });
      const finish = e => {
        if (!gesture) return;
        if (!gesture.dragged) s.media.currentTime = timestampPosition(s, e.clientX);
        gesture = null;
        updateVisual(s);
      };
      s.track.addEventListener('pointerup', finish);
      s.track.addEventListener('pointercancel', () => { gesture = null; });
    }
    for (const [part, handle] of [['start', s.startHandle], ['end', s.endHandle]]) {
      if (!handle) continue;
      let dragging = false;
      handle.addEventListener('pointerdown', e => {
        if (!(s.duration > 0)) return;
        dragging = true; handle.setPointerCapture(e.pointerId); e.stopPropagation(); e.preventDefault();
      });
      handle.addEventListener('pointermove', e => {
        if (!dragging) return;
        const b = bounds(s);
        const at = timestampPosition(s, e.clientX);
        choose(s, part === 'start' ? at : b.start, part === 'end' ? at : b.end);
      });
      const stop = () => { dragging = false; };
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
      handle.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const b = bounds(s);
        const before = part === 'start' ? b.start : b.end;
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? s.duration : before + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : .1);
        choose(s, part === 'start' ? next : b.start, part === 'end' ? next : b.end);
      });
    }
  }

  function makeSurface(host, options) {
    if (!host || !options.file || !options.url) return null;
    const s = {
      host, file: options.file, url: options.url, mode: options.mode || 'none',
      job: options.job || '', values: options.values || null, fields: options.fields || null,
      duration: 0, peaks: null, live: new Float32Array(COUNT), frame: 0,
      context: null, analyser: null, destroyed: false, stopAt: null, media: null
    };
    const wrap = document.createElement('section');
    wrap.className = 'dc-timeline dc-timeline--' + (options.kind || 'source');
    wrap.innerHTML =
      '<div class="dc-wave-head"><span class="dc-wave-title"></span><span class="dc-wave-status" role="status"></span></div>' +
      '<div class="dc-media-slot"></div>' +
      '<div class="dc-wave-track" aria-label="Media waveform timeline: tap to seek, or drag to select a range">' +
      '<canvas class="dc-wave-canvas" aria-hidden="true"></canvas><div class="dc-wave-selection" aria-hidden="true"></div>' +
      '<span class="dc-wave-playhead" aria-hidden="true"></span>' +
      '<button type="button" class="dc-handle dc-handle--start" aria-label="Move selection start" title="Drag or use arrow keys">I</button>' +
      '<button type="button" class="dc-handle dc-handle--end" aria-label="Move selection end" title="Drag or use arrow keys">O</button></div>' +
      '<div class="dc-wave-readout"><span class="dc-wave-elapsed"></span><span class="dc-wave-total"></span></div>' +
      '<div class="dc-wave-selection-info"><span class="dc-wave-start"></span><span class="dc-wave-end"></span><span class="dc-wave-length"></span></div>' +
      '<div class="dc-wave-actions"><button type="button" class="dc-wave-preview"></button>' +
      '<button type="button" class="dc-wave-in">Set in</button><button type="button" class="dc-wave-out">Set out</button>' +
      '<button type="button" class="dc-wave-reset">Reset selection</button></div>';
    const q = selector => wrap.querySelector(selector);
    s.wrap = wrap;
    s.track = q('.dc-wave-track');
    s.canvas = q('.dc-wave-canvas');
    s.selection = q('.dc-wave-selection');
    s.playhead = q('.dc-wave-playhead');
    s.startHandle = q('.dc-handle--start');
    s.endHandle = q('.dc-handle--end');
    s.status = q('.dc-wave-status');
    s.elapsed = q('.dc-wave-elapsed'); s.total = q('.dc-wave-total');
    s.startText = q('.dc-wave-start'); s.endText = q('.dc-wave-end'); s.lengthText = q('.dc-wave-length');
    s.previewButton = q('.dc-wave-preview');
    const title = q('.dc-wave-title');
    title.textContent = options.kind === 'tool' ? 'VISUAL EDITOR / ' + (options.job || '').toUpperCase() :
      options.kind === 'result' ? 'RESULT / AUDIO MAP' : 'SOURCE / AUDIO MAP';
    s.status.textContent = 'Reading media duration';
    s.media = options.media || document.createElement(/^(video)\//.test(options.file.type) || /\.(mp4|mov|m4v|mkv|webm|avi)$/i.test(options.file.name) ? 'video' : 'audio');
    if (!options.media) {
      s.media.controls = true;
      s.media.preload = 'metadata';
      s.media.playsInline = true;
      s.media.src = options.url;
      s.media.setAttribute('aria-label', options.kind === 'tool' ? 'Source preview for selecting a time range' : 'Source media preview');
      q('.dc-media-slot').appendChild(s.media);
    } else q('.dc-media-slot').remove();
    s.track.setAttribute('role', 'group');

    if (s.mode === 'none') {
      s.selection.classList.add('hidden');
      s.startHandle.remove(); s.endHandle.remove();
      s.startHandle = null; s.endHandle = null;
      q('.dc-wave-selection-info').remove();
      q('.dc-wave-in').remove(); q('.dc-wave-out').remove(); q('.dc-wave-reset').remove();
    } else if (s.mode === 'point') {
      s.endHandle.remove(); s.endHandle = null;
      q('.dc-wave-end').remove(); q('.dc-wave-length').remove();
      q('.dc-wave-in').textContent = 'Set moment';
      q('.dc-wave-out').remove();
    } else if (s.mode === 'ending') {
      s.endHandle.remove(); s.endHandle = null;
      q('.dc-wave-out').remove();
      q('.dc-wave-in').textContent = 'Set beginning';
    }
    host.replaceChildren(wrap);
    surfaces.add(s);
    s.onMetadata = () => {
      const d = s.media.duration;
      if (Number.isFinite(d) && d > 0) {
        s.duration = d;
        if (s.values) {
          const b = bounds(s);
          if (s.mode === 'point') notify(s, { time: b.start });
          if (s.mode === 'ending') notify(s, { seconds: b.end - b.start });
          if (s.mode === 'range') notify(s, { start: b.start, length: b.end - b.start });
        }
        if (s.file.size > MAX_DECODE_BYTES || d > MAX_DECODE_SECONDS) {
          s.status.textContent = 'Live signal only · large file';
        } else {
          s.status.textContent = 'Analyzing local audio';
          decodePeaks(s.file).then(peaks => {
            if (s.destroyed) return;
            s.peaks = peaks;
            s.status.textContent = peaks ? 'Decoded waveform' : 'Play to collect a live waveform';
            draw(s);
          });
        }
      } else s.status.textContent = 'Duration unavailable · enter times manually';
      updateVisual(s);
    };
    s.onError = () => { s.status.textContent = 'Preview unsupported for this codec; numeric tools remain available'; };
    s.onPlay = () => {
      for (const other of surfaces) if (other !== s) other.media.pause();
      startCapture(s);
      cancelAnimationFrame(s.frame);
      s.frame = requestAnimationFrame(() => paintFrame(s));
      updateVisual(s);
    };
    s.onPause = () => { cancelAnimationFrame(s.frame); updateVisual(s); };
    s.onTime = () => {
      if (s.stopAt !== null && s.media.currentTime >= s.stopAt - .04) {
        s.stopAt = null; s.media.pause();
      }
      updateVisual(s);
    };
    s.media.addEventListener('loadedmetadata', s.onMetadata);
    s.media.addEventListener('error', s.onError);
    s.media.addEventListener('play', s.onPlay);
    s.media.addEventListener('pause', s.onPause);
    s.media.addEventListener('timeupdate', s.onTime);
    s.media.addEventListener('seeked', s.onTime);

    s.previewButton.addEventListener('click', () => playtime(s, true));
    const inButton = q('.dc-wave-in');
    const outButton = q('.dc-wave-out');
    const resetButton = q('.dc-wave-reset');
    if (inButton) inButton.addEventListener('click', () => {
      const b = bounds(s);
      choose(s, s.media.currentTime, s.mode === 'range' ? b.end : s.media.currentTime);
    });
    if (outButton) outButton.addEventListener('click', () => {
      const b = bounds(s);
      choose(s, b.start, s.media.currentTime);
    });
    if (resetButton) resetButton.addEventListener('click', () => {
      if (s.mode === 'point') choose(s, 0, 0);
      else if (s.mode === 'ending') choose(s, Math.max(0, s.duration - 10), s.duration);
      else choose(s, 0, Math.min(s.duration, s.job === 'gif' ? 4 : 10));
    });
    attachPointer(s);
    s.onFields = () => updateVisual(s);
    if (s.fields) s.fields.addEventListener('input', s.onFields);
    if ('ResizeObserver' in window) {
      s.observer = new ResizeObserver(() => updateVisual(s));
      s.observer.observe(s.track);
    } else {
      s.onResize = () => updateVisual(s);
      window.addEventListener('resize', s.onResize);
    }
    if (s.media.readyState >= 1) s.onMetadata();
    updateVisual(s);
    return s;
  }

  function destroy(s) {
    if (!s || s.destroyed) return;
    s.destroyed = true;
    cancelAnimationFrame(s.frame);
    surfaces.delete(s);
    s.media.pause();
    s.media.removeEventListener('loadedmetadata', s.onMetadata);
    s.media.removeEventListener('error', s.onError);
    s.media.removeEventListener('play', s.onPlay);
    s.media.removeEventListener('pause', s.onPause);
    s.media.removeEventListener('timeupdate', s.onTime);
    s.media.removeEventListener('seeked', s.onTime);
    if (s.fields) s.fields.removeEventListener('input', s.onFields);
    if (s.observer) s.observer.disconnect();
    if (s.onResize) window.removeEventListener('resize', s.onResize);
    if (s.context) s.context.close().catch(() => {});
    s.host.replaceChildren();
    if (!s.media.isConnected) s.media.removeAttribute('src');
  }

  function setSource(file, url) {
    destroy(source); destroy(editor);
    current = file && url ? { file, url } : null;
    source = current ? makeSurface(byId('sourceTimeline'), { ...current, kind: 'source' }) : null;
    if (editorConfig) edit(editorConfig.job, editorConfig.values, editorConfig.fields);
  }
  function edit(job, values, fields) {
    destroy(editor);
    editorConfig = job && values ? { job, values, fields } : null;
    const host = byId('toolTimeline');
    if (!host) return;
    host.classList.toggle('hidden', !current);
    editor = current ? makeSurface(host, {
      ...current, kind: 'tool', mode: MODES[job.id] || 'none',
      job: job.id, values, fields
    }) : null;
  }
  function clearTool() {
    editorConfig = null;
    destroy(editor); editor = null;
    byId('toolTimeline')?.classList.add('hidden');
  }
  function setResults(file, url) {
    destroy(sheetResult); destroy(hubResult);
    if (!file || !url || !/^(video|audio)\//.test(file.type)) return;
    const sheetMedia = byId('sheetPreview')?.querySelector('video,audio');
    const hubMedia = byId('hubPreview')?.querySelector('video,audio');
    sheetResult = makeSurface(byId('sheetResultTimeline'), { file, url, media: sheetMedia, kind: 'result' });
    hubResult = makeSurface(byId('hubResultTimeline'), { file, url, media: hubMedia, kind: 'result' });
  }
  function clearSheet() { destroy(sheetResult); sheetResult = null; }
  function pauseAll() { for (const surface of surfaces) { surface.stopAt = null; surface.media.pause(); } }
  function shutdown() {
    clearTool();
    destroy(source); destroy(sheetResult); destroy(hubResult);
    source = sheetResult = hubResult = null; current = null;
  }
  window.DexCutWaveform = { setSource, edit, clearTool, setResults, clearSheet, pauseAll, shutdown };
})();
