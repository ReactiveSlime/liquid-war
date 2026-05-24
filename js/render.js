import { teams, colours } from './config.js';

export function draw(canvas, ctx, state){
  const { WIDTH, HEIGHT, dots, mapLoaded, mapCanvas, teamSize } = state;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if(mapLoaded && mapCanvas){
    ctx.drawImage(mapCanvas, 0, 0, canvas.width, canvas.height);
  }

  const sx = canvas.width / WIDTH;
  const sy = canvas.height / HEIGHT;
  const pointSize = Math.max(1, Math.max(sx, sy) + 0.5);
  const outlineSize = pointSize + Math.max(0.75, pointSize * 0.35);
  const halfPoint = pointSize * 0.5;
  const halfOutline = outlineSize * 0.5;
  const centerOffsetX = sx * 0.5;
  const centerOffsetY = sy * 0.5;
  const teamCounts = Array(teams).fill(0);

  let previousTeam = -1;
  for(let i = 0; i < dots.length; i++){
    const d = dots[i];
    teamCounts[d.team]++;
    if(d.team !== previousTeam){
      ctx.fillStyle = colours[d.team];
      previousTeam = d.team;
    }
    const cx = d.x * sx + centerOffsetX;
    const cy = d.y * sy + centerOffsetY;
    ctx.fillRect(cx - halfPoint, cy - halfPoint, pointSize, pointSize);
  }

  const cap = teamSize * teams;
  for(let t = 0; t < teams; t++){
    const count = teamCounts[t];
    const scoreEl = document.getElementById('score-' + t);
    if(scoreEl){
      scoreEl.style.height = Math.max(1, Math.floor((count / cap) * 100)) + '%';
    }
  }
}
