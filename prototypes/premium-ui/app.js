const params = new URLSearchParams(location.search); const concept = (params.get('concept') || 'a').toLowerCase();
const type = ['1','2','3'].includes(params.get('type')) ? params.get('type') : '1';
const app = document.querySelector('#app'); app.className = `concept-${['a','b','c'].includes(concept) ? concept : 'a'} type-${type}`;
const labels = {a:'Cinematic Romance',b:'Editorial Romance',c:'Boutique Visual Novel'}; const typeLabels = {1:'Cormorant · Manrope',2:'EB Garamond · Manrope',3:'Literata · Manrope'};
document.querySelector('#conceptLabel').textContent = `${labels[concept] || labels.a} · ${typeLabels[type]}`;
function show(name){ document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.dataset.screen===name)); }
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));
document.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.toggle)));
document.querySelector('.game').addEventListener('dblclick',()=>show('choices'));
document.querySelectorAll('.choice-list button').forEach(b=>b.addEventListener('click',()=>{b.classList.add('selected'); setTimeout(()=>show('game'),260)}));
const size = document.querySelector('input[type="range"]'); size.addEventListener('input',()=>{app.style.setProperty('--text-scale', String(0.92 + Number(size.value) * 0.12)); size.nextElementSibling.textContent = ['','Маленький','Средний','Крупный'][size.value];});
