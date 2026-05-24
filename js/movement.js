// Movement helpers exported as an ES module
export function turnClockwise(dx, dy) {
  if(dx === 0) {
    return dy === 1 ? {x: 1, y: 0} : {x: -1, y: 0};
  }
  if(dy === 0) {
    return dx === 1 ? {x: 0, y: -1} : {x: 0, y: 1};
  }
  if(dx === 1) {
    return dy === 1 ? {x: 0, y: 0} : {x: 1, y: 0};
  }
  if(dx === -1) {
    return dy === 1 ? {x: 0, y: 0} : {x: -1, y: 0};
  }
  return {x: 0, y: 0};
}

export function turnAnticlockwise(dx, dy) {
  if(dx === 0) {
    return dy === 1 ? {x: -1, y: 0} : {x: 1, y: 0};
  }
  if(dy === 0) {
    return dx === 1 ? {x: 0, y: 1} : {x: 0, y: -1};
  }
  if(dx === 1) {
    return dy === 1 ? {x: 0, y: 0} : {x: 0, y: 1};
  }
  if(dx === -1) {
    return dy === 1 ? {x: 0, y: 0} : {x: 0, y: -1};
  }
  return {x: 0, y: 0};
}

export function canMoveTo(context, x, y) {
  const { inBounds, mapWalls } = context;
  return inBounds(x, y) && (!mapWalls || !mapWalls[x][y]);
}

export function isSpawnOpen(context, x, y){
  const { field } = context;
  return canMoveTo(context, x, y) && !field[x][y];
}

export function findNearestOpenSpot(context, x, y){
  const { WIDTH, HEIGHT, inBounds, field } = context;
  const startX = Math.max(0, Math.min(WIDTH - 1, x | 0));
  const startY = Math.max(0, Math.min(HEIGHT - 1, y | 0));

  if(isSpawnOpen(context, startX, startY)){
    return { x: startX, y: startY };
  }

  const maxRadius = Math.max(WIDTH, HEIGHT);
  for(let radius = 1; radius < maxRadius; radius++){
    const minX = startX - radius;
    const maxX = startX + radius;
    const minY = startY - radius;
    const maxY = startY + radius;

    for(let scanX = minX; scanX <= maxX; scanX++){
      if(inBounds(scanX, minY) && isSpawnOpen(context, scanX, minY)) return { x: scanX, y: minY };
      if(inBounds(scanX, maxY) && isSpawnOpen(context, scanX, maxY)) return { x: scanX, y: maxY };
    }
    for(let scanY = minY + 1; scanY <= maxY - 1; scanY++){
      if(inBounds(minX, scanY) && isSpawnOpen(context, minX, scanY)) return { x: minX, y: scanY };
      if(inBounds(maxX, scanY) && isSpawnOpen(context, maxX, scanY)) return { x: maxX, y: scanY };
    }
  }

  for(let scanY = 0; scanY < HEIGHT; scanY++){
    for(let scanX = 0; scanX < WIDTH; scanX++){
      if(isSpawnOpen(context, scanX, scanY)) return { x: scanX, y: scanY };
    }
  }

  return { x: startX, y: startY };
}

export function moveDotToward(d, p, context){
  const { field, DOT_MAX_HEALTH } = context;
  const currentX = d.x;
  const currentY = d.y;
  
  let playerX = p.x;
  let playerY = p.y;
  let diffX = playerX - currentX;
  let diffY = playerY - currentY;
  let dist = Math.sqrt(diffX * diffX + diffY * diffY);
  
  if(p.positions) {
    for(let i = 1; i < p.positions.length; i++) {
      const nextPlayerX = p.positions[i].x;
      const nextPlayerY = p.positions[i].y;
      const nextDiffX = nextPlayerX - currentX;
      const nextDiffY = nextPlayerY - currentY;
      const nextDist = Math.sqrt(nextDiffX * nextDiffX + nextDiffY * nextDiffY);
      if(nextDist < dist) {
        playerX = nextPlayerX;
        playerY = nextPlayerY;
        dist = nextDist;
        diffX = nextDiffX;
        diffY = nextDiffY;
      }
    }
  }
  
  if(diffY === 0) diffY = 1;
  if(diffX === 0) diffX = 1;
  
  const absDiffX = Math.abs(diffX);
  const absDiffY = Math.abs(diffY);
  const xy = 10 * absDiffX / absDiffY;
  const yx = 10 * absDiffY / absDiffX;
  const sum = absDiffX + absDiffY + 1 + 1;
  const randomInt = Math.floor(Math.random() * 10);
  const r = sum * randomInt / 10.0;
  
  let dx = 0, dy = 0;
  
  if(r < absDiffX) {
    dx = diffX > 0 ? 1 : -1;
    if(r < (absDiffX / xy)) {
      dy = diffY > 0 ? 1 : -1;
    }
  } else if(r < (absDiffX + absDiffY)) {
    dy = diffY > 0 ? 1 : -1;
    if(r < (absDiffX + absDiffY / yx)) {
      dx = diffX > 0 ? 1 : -1;
    }
  } else if(r < (absDiffX + absDiffY + 1)) {
    dx = diffX > 0 ? -1 : 1;
    if(r < (absDiffX + absDiffY + 1 / xy)) {
      dy = diffY > 0 ? -1 : 1;
    }
  } else {
    dy = diffY > 0 ? -1 : 1;
    if(r < (absDiffX + absDiffY + 1 + 1 / yx)) {
      dx = diffX > 0 ? -1 : 1;
    }
  }
  
  let nx = d.x + dx, ny = d.y + dy;
  if(canMoveTo(context, nx, ny) && !field[nx][ny]) {
    field[d.x][d.y] = null;
    field[nx][ny] = d;
    d.x = nx;
    d.y = ny;
    return;
  }
  
  const d2 = randomInt % 2 === 1 ? turnClockwise(dx, dy) : turnAnticlockwise(dx, dy);
  nx = d.x + d2.x;
  ny = d.y + d2.y;
  if(canMoveTo(context, nx, ny) && !field[nx][ny]) {
    field[d.x][d.y] = null;
    field[nx][ny] = d;
    d.x = nx;
    d.y = ny;
    return;
  }
  
  const d3 = randomInt % 2 === 0 ? turnClockwise(dx, dy) : turnAnticlockwise(dx, dy);
  nx = d.x + d3.x;
  ny = d.y + d3.y;
  if(canMoveTo(context, nx, ny) && !field[nx][ny]) {
    field[d.x][d.y] = null;
    field[nx][ny] = d;
    d.x = nx;
    d.y = ny;
    return;
  }
  
  nx = d.x + dx;
  ny = d.y + dy;
  if(canMoveTo(context, nx, ny) && field[nx][ny] && field[nx][ny].team !== d.team) {
    const other = field[nx][ny];
    other.health--;
    if(other.health <= 0) {
      other.team = d.team;
      other.health = 5;
    }
    return;
  }
  
  nx = d.x + d2.x;
  ny = d.y + d2.y;
  if(canMoveTo(context, nx, ny) && field[nx][ny] && field[nx][ny].team !== d.team) {
    const other = field[nx][ny];
    other.health--;
    if(other.health <= 0) {
      other.team = d.team;
      other.health = 5;
    }
    return;
  }
  
  nx = d.x + dx;
  ny = d.y + dy;
  if(canMoveTo(context, nx, ny) && field[nx][ny] && field[nx][ny].team === d.team) {
    if(field[nx][ny].health < DOT_MAX_HEALTH) {
      if(Math.random() < 0.05) {
        field[nx][ny].health++;
      }
    }
    return;
  }
}

export function step(context){
  const { dots, players, selectedTeam, teams } = context;
  for(let d of dots){
    moveDotToward(d, players[d.team], context);
  }
  for(let i=0;i<teams;i++){
    if(i === selectedTeam) continue;
    const p = players[i];
    if(!p.ai) continue;
    if(Math.random()<0.02 || !p.target) p.target = {x:Math.random()*context.WIDTH|0,y:Math.random()*context.HEIGHT|0};
    p.x += Math.sign(p.target.x - p.x) * (Math.random()<0.4?1:0);
    p.y += Math.sign(p.target.y - p.y) * (Math.random()<0.4?1:0);
  }
}

export function getNearestDot(context, team, px, py){
  let nearest = null; let best = Infinity;
  const { dots, WIDTH, HEIGHT } = context;
  for(let i=0;i<dots.length;i++){
    const d = dots[i];
    if(d.team === team) continue;
    const dx = d.x - px, dy = d.y - py;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist < best){ best = dist; nearest = d; }
  }
  if(nearest){
    const jitterX = (Math.floor(Math.random()*11) - 5);
    const jitterY = (Math.floor(Math.random()*11) - 5);
    const nx = Math.max(0, Math.min(WIDTH-1, nearest.x + jitterX));
    const ny = Math.max(0, Math.min(HEIGHT-1, nearest.y + jitterY));
    return {x:nx,y:ny};
  }
  return {x:px,y:py};
}
