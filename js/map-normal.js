import { RANDOM_MAP_ID } from './config.js';

export function pickRandomMapId(mapCount){
  return (Math.random() * mapCount) | 0;
}

/** Turn lobby "Random" (-1) into a concrete built-in map index shared by all clients. */
export function resolveMapId(mapId, mapCount){
  return mapId === RANDOM_MAP_ID ? pickRandomMapId(mapCount) : mapId;
}

export function buildMapUrl(mapId, kind){
  if(mapId === RANDOM_MAP_ID){
    return 'maps/random-map.png';
  }
  return 'maps/' + mapId + '-' + kind + '.png';
}

export function loadImage(url){
  return new Promise(function(resolve, reject){
    const img = new Image();
    img.onload = function(){ resolve(img); };
    img.onerror = function(){ reject(new Error('Failed to load ' + url)); };
    img.src = url;
  });
}

export function loadFirstAvailable(urls){
  let index = 0;
  function next(){
    if(index >= urls.length) return Promise.reject(new Error('No map image found'));
    const url = urls[index++];
    return loadImage(url).then(function(img){
      return { img: img, url: url };
    }).catch(next);
  }
  return next();
}

export function clearMap(context){
  const { mapCanvas, mapCtx, mapMaskCanvas, mapMaskCtx, WIDTH, HEIGHT } = context;
  mapCanvas.width = WIDTH;
  mapCanvas.height = HEIGHT;
  mapCtx.clearRect(0,0,WIDTH,HEIGHT);
  mapMaskCanvas.width = WIDTH;
  mapMaskCanvas.height = HEIGHT;
  mapMaskCtx.clearRect(0,0,WIDTH,HEIGHT);
  context.mapWalls = Array.from({length:WIDTH}, ()=> Array(HEIGHT).fill(false));
  context.mapLoaded = false;
}

export function refreshMapPreview(mapId, context){
  const { mapPreview, customMapCollisionUrl, customMapDisplayUrl } = context;
  if(!mapPreview) return;
  const CUSTOM_MAP_ID = context.CUSTOM_MAP_ID || 46;
  const RANDOM_MAP_ID = -1;
  if(mapId === CUSTOM_MAP_ID){
    const previewUrl = customMapDisplayUrl || customMapCollisionUrl;
    if(previewUrl){
      mapPreview.src = previewUrl;
    } else {
      mapPreview.removeAttribute('src');
    }
    return;
  }
  const previewId = mapId === RANDOM_MAP_ID ? RANDOM_MAP_ID : mapId;
  const previewCandidates = [
    buildMapUrl(previewId, 'image'),
    buildMapUrl(previewId, 'map')
  ];
  loadFirstAvailable(previewCandidates).then(function(previewData){
    mapPreview.src = previewData.url;
  }).catch(function(){
    mapPreview.removeAttribute('src');
  });
}

export function loadMapById(mapId, context, cb){
  const token = ++context.mapLoadToken;
  const chosenMapId = resolveMapId(mapId, context.MAP_COUNT || 46);
  context.currentMapId = chosenMapId;

  let collisionCandidates = [];
  let textureCandidates = [];

  const CUSTOM_MAP_ID = context.CUSTOM_MAP_ID || (context.MAP_COUNT || 46);

  if(mapId === CUSTOM_MAP_ID){
    if(!context.customMapCollisionUrl){
      clearMap(context);
      if(cb) cb();
      return;
    }
    collisionCandidates = [context.customMapCollisionUrl];
    textureCandidates = [context.customMapDisplayUrl || context.customMapCollisionUrl];
    context.currentMapId = CUSTOM_MAP_ID;
  } else {
    const blankCollisionUrl = 'maps/blank-map.png';
    collisionCandidates = [
      buildMapUrl(chosenMapId, 'map'),
      blankCollisionUrl
    ];
    textureCandidates = [
      buildMapUrl(chosenMapId, 'image'),
      buildMapUrl(chosenMapId, 'map')
    ];
  }

  loadFirstAvailable(collisionCandidates).then(function(collisionData){
    if(token !== context.mapLoadToken) return;

    const collisionImg = collisionData.img;

    context.mapMaskCanvas.width = collisionImg.width;
    context.mapMaskCanvas.height = collisionImg.height;
    context.mapMaskCtx.clearRect(0, 0, collisionImg.width, collisionImg.height);
    context.mapMaskCtx.drawImage(collisionImg, 0, 0);

    const data = context.mapMaskCtx.getImageData(0, 0, collisionImg.width, collisionImg.height).data;
    context.mapWalls = Array.from({length:context.WIDTH}, function(){ return Array(context.HEIGHT).fill(false); });
    for(let y = 0; y < context.HEIGHT; y++){
      const srcY = Math.min(collisionImg.height - 1, Math.floor((y / context.HEIGHT) * collisionImg.height));
      for(let x = 0; x < context.WIDTH; x++){
        const srcX = Math.min(collisionImg.width - 1, Math.floor((x / context.WIDTH) * collisionImg.width));
        const index = (srcY * collisionImg.width + srcX) * 4;
        if(data[index + 3] > 3) context.mapWalls[x][y] = true;
      }
    }

    return loadFirstAvailable(textureCandidates).catch(function(){
      return { img: collisionImg, url: collisionData.url };
    }).then(function(textureData){
      if(token !== context.mapLoadToken) return;
      const textureImg = textureData.img;
      context.mapCanvas.width = context.WIDTH;
      context.mapCanvas.height = context.HEIGHT;
      context.mapCtx.clearRect(0, 0, context.WIDTH, context.HEIGHT);
      context.mapCtx.drawImage(textureImg, 0, 0, context.WIDTH, context.HEIGHT);
      context.mapLoaded = true;
      if(cb) cb();
    });
  }).catch(function(){
    clearMap(context);
    if(cb) cb();
  });
}
