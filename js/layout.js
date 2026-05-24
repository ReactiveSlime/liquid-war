export function updatePlayLayout(playSessionEl){
  if(!playSessionEl) return;
  const portrait = window.innerHeight > window.innerWidth;
  playSessionEl.classList.toggle('is-portrait', portrait);
  playSessionEl.classList.toggle('is-landscape', !portrait);
}

export function resize(canvas){
  const w = Math.max(1, Math.floor(canvas.clientWidth));
  const h = Math.max(1, Math.floor(canvas.clientHeight));
  canvas.width = w;
  canvas.height = h;
}

export function setPlaySessionActive(playSessionEl, active){
  if(!playSessionEl) return;
  playSessionEl.classList.toggle('is-active', active);
  playSessionEl.setAttribute('aria-hidden', active ? 'false' : 'true');
}

export function setGameHudVisible(uiEl, visible){
  if(!uiEl) return;
  uiEl.classList.toggle('is-visible', visible);
}

export function bindLayoutObservers(canvas, playMain, playSessionEl, onLayout){
  if(typeof ResizeObserver !== 'undefined' && playMain){
    new ResizeObserver(function(){ onLayout(); }).observe(playMain);
  }

  window.addEventListener('orientationchange', function(){
    setTimeout(function(){
      updatePlayLayout(playSessionEl);
      onLayout();
    }, 250);
  });
}
