const params = new URLSearchParams(location.search); const concept = (params.get('concept') || 'a').toLowerCase();
const app = document.querySelector('#app'); app.className = `concept-${['a','b','c'].includes(concept) ? concept : 'a'}`;
const labels = {a:'Cinematic Romance',b:'Editorial Romance',c:'Boutique Visual Novel'}; document.querySelector('#conceptLabel').textContent = labels[concept] || labels.a;
function show(name){ document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.dataset.screen===name)); }
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));
document.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.toggle)));
document.querySelector('.game').addEventListener('dblclick',()=>show('choices'));
document.querySelectorAll('.choice-list button').forEach(b=>b.addEventListener('click',()=>{b.classList.add('selected'); setTimeout(()=>show('game'),260)}));
