function clampi(v, lo, hi){
  return v < lo ? lo : (v > hi ? hi : v);
}

/**
 * Map screen coordinates to game grid (0..WIDTH-1, 0..HEIGHT-1).
 * In portrait we rotate the whole play stack with CSS; getBoundingClientRect() is then
 * an axis-aligned box around the rotated canvas, so we invert the 90deg rotation around
 * the canvas center before normalizing.
 */
export function clientToGameGrid(clientX, clientY, canvas, playSessionEl, WIDTH, HEIGHT){
  const rect = canvas.getBoundingClientRect();
  const rw = Math.max(1e-6, rect.width);
  const rh = Math.max(1e-6, rect.height);
  const cw = Math.max(1, canvas.clientWidth);
  const ch = Math.max(1, canvas.clientHeight);
  let gx;
  let gy;

  if(playSessionEl && playSessionEl.classList.contains('is-portrait')){
    const cx = rect.left + rw * 0.5;
    const cy = rect.top + rh * 0.5;
    const du = clientX - cx;
    const dv = clientY - cy;
    const dlx = dv;
    const dly = -du;
    const lx = cw * 0.5 + dlx;
    const ly = ch * 0.5 + dly;
    gx = (lx / cw) * WIDTH;
    gy = (ly / ch) * HEIGHT;
  } else {
    gx = ((clientX - rect.left) / rw) * WIDTH;
    gy = ((clientY - rect.top) / rh) * HEIGHT;
  }

  return {
    x: clampi(Math.floor(gx), 0, WIDTH - 1),
    y: clampi(Math.floor(gy), 0, HEIGHT - 1)
  };
}

export function initPointerInput(canvas, playSessionEl, state, options){
  const opts = options || {};
  let lastNetworkSendMs = 0;
  const NETWORK_SEND_MS = 50;

  function applyPointerToPlayer(clientX, clientY){
    if(!state.players.length) return;
    const p = clientToGameGrid(clientX, clientY, canvas, playSessionEl, state.WIDTH, state.HEIGHT);
    state.players[state.selectedTeam].x = p.x;
    state.players[state.selectedTeam].y = p.y;

    if(
      state.running
      && state.isMultiplayer
      && typeof opts.onPlayerMove === 'function'
    ){
      const now = performance.now();
      if(now - lastNetworkSendMs >= NETWORK_SEND_MS){
        lastNetworkSendMs = now;
        opts.onPlayerMove({
          x: p.x,
          y: p.y,
          team: state.selectedTeam
        });
      }
    }
  }

  canvas.addEventListener('mousemove', function(e){
    applyPointerToPlayer(e.clientX, e.clientY);
  });

  canvas.addEventListener('touchstart', function(ev){
    if(ev.touches.length !== 1) return;
    ev.preventDefault();
    const t = ev.touches[0];
    applyPointerToPlayer(t.clientX, t.clientY);
  }, { passive: false });

  canvas.addEventListener('touchmove', function(ev){
    ev.preventDefault();
    const t = ev.touches[0];
    applyPointerToPlayer(t.clientX, t.clientY);
  }, { passive: false });
}
