export function updateCustomMapStatus(context, message, isError){
  const { customMapStatus } = context;
  if(!customMapStatus) return;
  customMapStatus.textContent = message;
  customMapStatus.classList.toggle('is-error', !!isError);
}

export function clearCustomMapUrls(context){
  if(context.customMapCollisionUrl){
    URL.revokeObjectURL(context.customMapCollisionUrl);
    context.customMapCollisionUrl = '';
  }
  if(context.customMapDisplayUrl){
    URL.revokeObjectURL(context.customMapDisplayUrl);
    context.customMapDisplayUrl = '';
  }
}

export function syncCustomMapFiles(context){
  const collisionFile = context.customCollisionInput && context.customCollisionInput.files ? context.customCollisionInput.files[0] || null : null;
  const displayFile = context.customDisplayInput && context.customDisplayInput.files ? context.customDisplayInput.files[0] || null : null;

  clearCustomMapUrls(context);
  if(collisionFile){
    context.customMapCollisionUrl = URL.createObjectURL(collisionFile);
  }
  if(displayFile){
    context.customMapDisplayUrl = URL.createObjectURL(displayFile);
  }

  if(collisionFile && displayFile){
    updateCustomMapStatus(context, 'Loaded ' + collisionFile.name + ' for collisions and ' + displayFile.name + ' for display.', false);
  } else if(collisionFile){
    updateCustomMapStatus(context, 'Loaded ' + collisionFile.name + '. It will be used for both collisions and display unless you add a second image.', false);
  } else if(displayFile){
    updateCustomMapStatus(context, 'Display image selected. Choose a collision image to finish the custom map.', true);
  } else {
    updateCustomMapStatus(context, 'Select a collision image. A second display image is optional.', false);
  }

  if(context.selectedMapId === context.CUSTOM_MAP_ID){
    if(context.refreshMapPreview) context.refreshMapPreview(context.CUSTOM_MAP_ID);
  }
}
