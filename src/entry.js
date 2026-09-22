// A single default game entry uses the approved 10-episode literary edition.
// The incompatible legacy game remains opt-in solely to protect old user saves.
const params=new URLSearchParams(location.search);
if(params.has('legacy')||params.get('preview')==='s18'){
  await import('./main.js');
}else{
  document.getElementById('app').id='literary-app';
  await import('./literary-player.js');
}
