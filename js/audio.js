// audio.js - ES module
const MENU_SOUND_SRC = 'audio/menu.mp3';
const WIN_SOUND_SRC = 'audio/win.mp3';
const LOSE_SOUND_SRC = 'audio/lose.mp3';
const MENU_SELECTOR = '#startScreen button, #startScreen a, #pauseOverlay button, #gameOverOverlay button, .actions .btn';
const CLICK_DELAY_MS = 120;
let menuAudio = null;
let winAudio = null;
let loseAudio = null;

function createAudio(src){
  const audio = new Audio(src);
  audio.preload = 'auto';
  return audio;
}

function getMenuAudio(){
  if(!menuAudio){
    menuAudio = createAudio(MENU_SOUND_SRC);
  }
  return menuAudio;
}

function getOutcomeAudio(won){
  if(won){
    if(!winAudio){
      winAudio = createAudio(WIN_SOUND_SRC);
    }
    return winAudio;
  }
  if(!loseAudio){
    loseAudio = createAudio(LOSE_SOUND_SRC);
  }
  return loseAudio;
}

function playAudio(audio){
  try {
    audio.currentTime = 0;
  } catch (error) {
    // Ignore timing errors from browsers that have not loaded the clip yet.
  }
  const playback = audio.play();
  if(playback && typeof playback.catch === 'function'){
    playback.catch(function(){});
  }
}

export function playMenuSound(){
  playAudio(getMenuAudio());
}

export function playOutcomeSound(won){
  playAudio(getOutcomeAudio(!!won));
}

function shouldIgnoreClick(event){
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function handleClick(event){
  if(shouldIgnoreClick(event) || event.defaultPrevented) return;
  const target = event.target.closest(MENU_SELECTOR);
  if(!target) return;

  playMenuSound();

  if(target.tagName === 'A' && target.getAttribute('href')){
    const targetAttr = target.getAttribute('target');
    if(targetAttr === '_blank'){
      return;
    }
    event.preventDefault();
    window.setTimeout(function(){
      window.location.href = target.href;
    }, CLICK_DELAY_MS);
  }
}

export function init(){
  document.addEventListener('click', handleClick, true);
}

// Keep previous behavior: auto-init when loaded directly in a page
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
