const socket = io();
let state = null, current = 'headline', selectedOrder = [], headlineMarks = new Set(), photoClues = new Set(), socialChecks = new Set();
let avatar = '🔎';
const $ = (s) => document.querySelector(s);
const rooms = [
  ['headline', '01', 'El titular'], ['photo', '02', 'La fotografía'], ['social', '03', 'La red social'], ['archive', '04', 'Archivo roto'], ['decoder', '05', 'Mesa de cifrado'],
  ['puzzle', '06', 'El rompecabezas'], ['detective', '07', 'El detective'], ['classify', '08', 'Verdad o engaño'], ['final', '∞', 'La edición']
];
const messages = [
  '“Tenemos una hora. No desperdicien ni un clic.”', '“Ese titular tiene potencial. ¿Seguro que quieren comprobar la fuente?”',
  '“El contexto puede esperar. La tendencia no.”', '“Tres millones de personas esperan una historia. Publiquen ya.”', '“Una cifra sin contexto siempre parece más grande.”'
];

function toast(text) { const el = $('#toast'); el.textContent = text; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 3500); }
function name() { return `${avatar} ${$('#player-name').value.trim() || 'Periodista'}`; }
document.querySelectorAll('.avatar').forEach(btn => btn.onclick = () => { avatar = btn.dataset.avatar; document.querySelectorAll('.avatar').forEach(x => x.classList.toggle('active', x === btn)); });
function enterRoom(next) { state = next; $('#landing').hidden = true; $('#lobby').hidden = false; drawLobby(); }

$('#create-room').onclick = () => socket.emit('room:create', { name: name() }, (r) => r.ok && enterRoom(r.state));
$('#join-room').onclick = () => {
  const code = $('#join-code').value.trim().toUpperCase();
  if (code.length !== 4) return $('#landing-error').textContent = 'Escribe el código de cuatro caracteres.';
  socket.emit('room:join', { code, name: name() }, (r) => r.ok ? enterRoom(r.state) : $('#landing-error').textContent = r.error);
};
$('#join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#join-room').click(); });
$('#copy-code').onclick = async () => { await navigator.clipboard.writeText(state.code); toast('Código copiado'); };
$('#start-game').onclick = () => socket.emit('game:start', { code: state.code });

socket.on('room:update', (next) => { state = next; if (state.started) showGame(); else drawLobby(); drawGame(); });

function drawLobby() {
  $('#room-code').textContent = state.code; $('#player-count').textContent = state.players.length;
  $('#player-list').innerHTML = state.players.map(p => `<span class="player">${escapeHtml(p.name)}${p.id === state.hostId ? ' · anfitrión' : ''}</span>`).join('');
  const host = socket.id === state.hostId; $('#start-game').hidden = !host; $('#host-note').hidden = host;
}
function showGame() { $('#lobby').hidden = true; $('#game').hidden = false; tick(); }
function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function solved(id) { return state.solved.includes(id); }
function isUnlocked(id, i) {
  if (id === 'classify') return state.solved.length >= 7;
  if (id === 'final') return state.solved.length >= 7 && state.classifications.done;
  return i === 0 || solved(rooms[i - 1][0]);
}
function drawGame() {
  if (!state?.started) return;
  $('#progress').textContent = `${state.solved.length + (state.classifications.done ? 1 : 0)} / 8`;
  $('#room-nav').innerHTML = rooms.map(([id, no, title], i) => `<button class="${current === id ? 'active ' : ''}${!isUnlocked(id, i) ? 'locked' : ''}" data-room="${id}">${solved(id) || (id === 'classify' && state.classifications.done) ? '✓' : no} · ${title}</button>`).join('');
  $('#room-nav').querySelectorAll('button').forEach(b => b.onclick = () => { const i = rooms.findIndex(r => r[0] === b.dataset.room); if (!isUnlocked(b.dataset.room, i)) return toast('Primero recuperen el archivo anterior.'); current = b.dataset.room; drawGame(); });
  $('#evidence-list').innerHTML = state.evidence.map(e => `<span class="tag">${e}</span>`).join('') || '<span class="tag">Sin pruebas</span>';
  if (state.finalWon) return sceneWin();
  renderScene();
}
function header(no, title, intro) { return `<div class="scene-header"><small>ARCHIVO ${no}</small><h2>${title}</h2></div>${intro ? `<p class="brief">${intro}</p>` : ''}`; }
function submitPuzzle(id, answer) { socket.emit('game:solve', { code: state.code, puzzle: id, answer }, (r) => { toast(r.message); if (r.ok) setTimeout(() => { const ix = rooms.findIndex(x => x[0] === id); current = rooms[ix + 1][0]; drawGame(); }, 600); }); }
function inputPuzzle(id, placeholder) { return `<div class="answer-row"><input id="answer" placeholder="${placeholder}" autocomplete="off"><button id="submit">Validar</button></div>`; }
function renderScene() {
  const scene = $('#scene');
  if (solved(current)) { scene.innerHTML = header('RECUPERADO', rooms.find(r => r[0] === current)?.[2] || '') + `<div class="paper"><h3>Archivo seguro</h3><p>Esta evidencia ya está en el expediente. Continúen con la siguiente sala.</p></div>`; return; }
  if (current === 'headline') scene.innerHTML = header('01', 'El titular', 'No basta con hallar una palabra. Identifica los dos cambios que convierten una hipótesis en alarma. Hay una pista señuelo.') + `<article class="paper"><small class="eyebrow">ALERTA CLIMÁTICA · 23:21</small><div class="headline">CIENTÍFICOS <span class="scan-word" data-headline="confirm">CONFIRMAN</span> QUE EL PLANETA <span class="scan-word" data-headline="bait">PODRÍA</span> SER INHABITABLE EN <span class="scan-word" data-headline="date">10 AÑOS</span></div><p>El informe modela un escenario hipotético de riesgo alto. No presenta una predicción ni una fecha confirmada.</p><div class="source-line">FUENTE ORIGINAL: Informe de escenarios climáticos, sección 4.2</div><div class="clue" id="headline-clue">Marca los dos elementos que el informe no puede sostener.</div></article>`;
  if (current === 'photo') scene.innerHTML = header('02', 'La fotografía', 'Primero recopila tres metadatos. Solo entonces podrás decidir qué imagen corresponde al caso. Atención: una fecha está manipulada.') + `<div class="photo-grid"><div class="photo choice-photo" data-photo="wrong"><b>Imagen A</b><span class="hotspot" data-clue="a-date" style="top:42%;left:47%">17 JUL 2017</span><span class="hotspot" data-clue="a-place" style="top:18%;right:12%">PUERTO NORTE</span></div><div class="photo two choice-photo" data-photo="right"><b>Imagen B</b><span class="hotspot" data-clue="b-date" style="top:40%;left:45%">24 JUL 2024</span><span class="hotspot" data-clue="b-place" style="bottom:29%;right:14%">BARRIO CENTRAL</span></div></div><div class="clue" id="photo-clue">Caso: evacuación preventiva en Barrio Central, el 24 de julio de 2024. Metadatos encontrados: 0 / 3.</div>`;
  if (current === 'social') scene.innerHTML = header('03', 'La red social', 'Audita el rastro de las tres publicaciones. Necesitas abrir las tres fichas antes de decidir cuál se sostiene.') + `<div class="post play-post" data-post="viral"><b>@alerta_ahora</b><p>🔥 ¡INCREÍBLE! Nadie está hablando de esto.</p><small>12.4 mil compartidos · enlace sin autor</small></div><div class="post play-post" data-post="capture"><b>@datos_sin_filtro</b><p>😱 Esto demuestra que los medios nos están mintiendo.</p><small>8.1 mil compartidos · captura recortada</small></div><div class="post verified play-post" data-post="source"><b>@observatorio_publico ✓</b><p>Los datos publicados muestran una variación mensual. Consulta la metodología completa.</p><small>Enlace al informe original · institución identificable · 08:14</small></div><div class="clue" id="social-clue">Fichas auditadas: 0 / 3. No elijan hasta completar el rastreo.</div>`;
  if (current === 'archive') scene.innerHTML = header('04', 'Archivo roto', 'Cuatro fragmentos llegaron fuera de orden. Arrástralos mentalmente: anota los números según la cronología de publicación.') + `<div class="click-game"><button class="play-card">1 · 09:47<br><small>Publicación viral replica el titular.</small></button><button class="play-card">2 · 10:21<br><small>El titular ya fue modificado.</small></button><button class="play-card">3 · 08:14<br><small>La fuente primaria publica sus datos.</small></button><button class="play-card">4 · 08:32<br><small>Medio A resume el informe.</small></button></div><div class="clue">Escribe los números en orden temporal, separados por comas.</div>${inputPuzzle('archive','Ej. 3,1,4,2')}`;
  if (current === 'decoder') scene.innerHTML = header('05', 'Mesa de cifrado', 'El editor dejó una clave con letras desplazadas una posición: WFSJGJDB. Retrocede cada letra una posición en el alfabeto.') + `<div class="paper"><div class="headline">WFSJGJDB</div><div class="clue">Esta contraseña abre el expediente. Es una palabra que describe la acción responsable antes de compartir.</div>${inputPuzzle('decoder','Clave descifrada')}</div>`;
  if (current === 'puzzle') scene.innerHTML = header('04', 'El rompecabezas de la noticia', 'Construye una pieza informativa antes de ponerle un titular. Pulsa las tarjetas en el orden adecuado.') + `<div class="paper"><p>El orden ético evita que el titular distorsione la evidencia.</p><div id="order" class="order-slots"></div><div class="clue">Pista: primero se nombra el tema, luego se cuenta el hecho, se identifica su fuente, se aporta contexto y se explica.</div><button id="check-order" class="primary">Validar secuencia</button></div>`;
  if (current === 'detective') scene.innerHTML = header('05', 'El detective digital', 'Reconstruye cómo viajó la información. El último cambio alteró el sentido de la nota.') + `<div class="paper"><div class="timeline"><div><b>08:14</b> Fuente original publica el informe.</div><div><b>08:32</b> Medio A resume los datos sin cambiar el sentido.</div><div><b>09:05</b> Medio B añade “confirman” a su titular.</div><div><b>09:47</b> La publicación viral copia el titular de Medio B.</div></div><div class="clue">¿Qué medio modificó el titular?</div>${inputPuzzle('detective','Ej. Medio A')}</div>`;
  if (current === 'classify') scene.innerHTML = header('06', '¿Verdad o engaño?', 'Clasifica cada frase según lo que realmente permite afirmar la evidencia.') + `<div class="classify"><div class="statement"><p>“El 70 % de estudiantes encuestados prefirió la opción A.”</p>${select('s1')}</div><div class="statement"><p>“Los estudiantes claramente odian la opción B.”</p>${select('s2')}</div><div class="statement"><p>“La preferencia por A podría explicar parte del resultado.”</p>${select('s3')}</div></div><button id="check-classify" class="primary">Recuperar clave</button>`;
  if (current === 'final') scene.innerHTML = header('FINAL', 'La edición', 'Han recuperado el expediente. Ahora decidan qué titular respeta la información disponible.') + `<div class="paper"><small class="eyebrow">INFORME ORIGINAL</small><h3>Expertos analizan los datos preliminares de una investigación en curso</h3><p>El estudio no permite todavía confirmar causas ni anticipar resultados definitivos.</p></div><div class="final-options" style="margin-top:18px"><button class="choice" data-choice="A">A. ¡ESCÁNDALO TOTAL! Los datos lo prueban todo</button><button class="choice" data-choice="B">B. Expertos analizan datos preliminares de una investigación en curso</button><button class="choice" data-choice="C">C. Nadie quiere que sepas lo que ocurre</button><button class="choice" data-choice="D">D. Esto demuestra una verdad oculta</button></div>`;
  bindScene();
}
function select(id) { return `<select id="${id}"><option value="">Clasificar…</option><option value="hecho">Hecho</option><option value="interpretacion">Interpretación</option><option value="manipulacion">Manipulación</option></select>`; }
function bindScene() {
  document.querySelectorAll('[data-headline]').forEach(el => el.onclick = () => { const key = el.dataset.headline; if (key === 'bait') return toast('“Podría” mantiene la hipótesis. No es una exageración.'); headlineMarks.add(key); el.classList.add('selected'); $('#headline-clue').textContent = `Elementos detectados: ${headlineMarks.size} / 2.`; if (headlineMarks.size === 2) submitPuzzle('headline', 'CONFIRMAN'); });
  document.querySelectorAll('[data-clue]').forEach(el => el.onclick = (e) => { e.stopPropagation(); photoClues.add(el.dataset.clue); el.style.background = '#edbd48'; $('#photo-clue').textContent = `Caso: evacuación preventiva en Barrio Central, 24 de julio de 2024. Metadatos encontrados: ${photoClues.size} / 3.`; });
  document.querySelectorAll('[data-photo]').forEach(el => el.onclick = () => { if (photoClues.size < 3) return toast('Aún faltan metadatos. Examinen ambas imágenes.'); if (el.dataset.photo === 'right') { el.classList.add('selected'); submitPuzzle('photo', '2417'); } else toast('Esa imagen pertenece a otro año y a otro lugar.'); });
  document.querySelectorAll('[data-post]').forEach(el => el.onclick = () => { const type = el.dataset.post; socialChecks.add(type); el.classList.add('selected'); const notes = {viral:'El enlace termina en una página sin autor ni documento.',capture:'La captura no permite comprobar fecha, autor ni origen.',source:'El enlace lleva a la metodología y al informe original.'}; $('#social-clue').textContent = `${notes[type]} Fichas auditadas: ${socialChecks.size} / 3.`; if (socialChecks.size === 3 && socialChecks.has('source')) submitPuzzle('social', 'FUENTE'); });
  const input = $('#answer'), submit = $('#submit'); if (submit) { submit.onclick = () => submitPuzzle(current, input.value); input.onkeydown = e => { if (e.key === 'Enter') submit.click(); }; }
  if (current === 'puzzle') { const cards = [['TITULAR','Titular'],['HECHO','Hecho'],['FUENTE','Fuente'],['CONTEXTO','Contexto'],['EXPLICACION','Explicación']]; const holder = $('#order'); const render = () => holder.innerHTML = cards.map(([v,t]) => `<button class="${selectedOrder.includes(v)?'selected':''}" data-v="${v}">${selectedOrder.indexOf(v) >= 0 ? selectedOrder.indexOf(v)+1+'. ' : ''}${t}</button>`).join(''); render(); holder.onclick = e => { const v=e.target.dataset.v;if(!v)return; selectedOrder.includes(v)?selectedOrder=selectedOrder.filter(x=>x!==v):selectedOrder.push(v);render();}; $('#check-order').onclick=()=>submitPuzzle('puzzle',selectedOrder.join(',')); }
  if (current === 'classify') $('#check-classify').onclick = () => socket.emit('game:classify', { code: state.code, values: [$('#s1').value,$('#s2').value,$('#s3').value] }, r => { toast(r.message); if(r.ok){current='final';drawGame();} });
  document.querySelectorAll('.choice').forEach(b => b.onclick = () => socket.emit('game:final', { code: state.code, choice: b.dataset.choice }, r => toast(r.message || (r.ok ? 'Edición reconstruida.' : ''))));
}
function sceneWin() { $('#scene').innerHTML = `<section class="win"><small class="eyebrow">SISTEMA DESBLOQUEADO</small><h2>La edición fue recuperada.</h2><p>La noticia nunca fue completamente falsa. El problema era todo aquello que faltaba.</p><strong>¿Cuántos clics vale la verdad?</strong><p style="font:13px 'DM Mono';margin-top:35px">EQUIPO: ${state.players.length} PERIODISTAS · EVIDENCIAS: ${state.evidence.length}</p></section>`; }
function tick() { if (!state?.started || state.finalWon) return; const left = Math.max(0, 3600000 - (Date.now() - state.startedAt)); const min = String(Math.floor(left / 60000)).padStart(2, '0'), sec = String(Math.floor(left % 60000 / 1000)).padStart(2, '0'); $('#timer').textContent = `${min}:${sec}`; if (!left) toast('El sistema se bloqueó. Puedes crear otra sala para reiniciar.'); else setTimeout(tick, 500); }
setInterval(() => { if (state?.started && !state.finalWon) $('#editor-text').textContent = messages[Math.floor(Math.random()*messages.length)]; }, 16000);
