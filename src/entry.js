// Production entry: the approved ten-episode literary edition is the only
// player exposed by the release shell. Legacy/preview runtimes remain
// developer artifacts and are not selectable through production URL params.
document.getElementById('app').id='literary-app';
await import('./literary-player.js');
