const express = require('express');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = require('http').createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();
const makeCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();
const cleanName = (name) => String(name || 'Periodista').trim().slice(0, 22) || 'Periodista';

function publicState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    players: [...room.players.values()].map(({ id, name }) => ({ id, name })),
    started: room.started,
    startedAt: room.startedAt,
    solved: room.solved,
    evidence: room.evidence,
    classifications: room.classifications,
    finalWon: room.finalWon
  };
}

function broadcast(room) { io.to(room.code).emit('room:update', publicState(room)); }

io.on('connection', (socket) => {
  socket.on('room:create', ({ name }, done) => {
    let code; do { code = makeCode(); } while (rooms.has(code));
    const room = { code, hostId: socket.id, players: new Map(), started: false, startedAt: null,
      solved: [], evidence: [], classifications: {}, finalWon: false };
    room.players.set(socket.id, { id: socket.id, name: cleanName(name) });
    rooms.set(code, room); socket.join(code); done({ ok: true, state: publicState(room) });
  });

  socket.on('room:join', ({ code, name }, done) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room) return done({ ok: false, error: 'No encontramos esa sala. Revisa el código.' });
    if (room.players.size >= 80) return done({ ok: false, error: 'La sala ya alcanzó su capacidad.' });
    room.players.set(socket.id, { id: socket.id, name: cleanName(name) });
    socket.join(room.code); broadcast(room); done({ ok: true, state: publicState(room) });
  });

  socket.on('game:start', ({ code }, done) => {
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;
    room.started = true; room.startedAt = Date.now(); broadcast(room); done?.({ ok: true });
  });

  socket.on('game:solve', ({ code, puzzle, answer }, done) => {
    const room = rooms.get(code);
    if (!room || !room.started || room.finalWon) return;
    const expected = {
      photo: '2417',
      social: 'FUENTE',
      archive: '3,4,1,2',
      decoder: 'VERIFICA',
      puzzle: 'TITULAR,HECHO,FUENTE,CONTEXTO,EXPLICACION',
      detective: 'MEDIO B',
      relay: 'NORA',
      route: 'RUTA C',
      vault: 'LIA',
      witness: 'IVO'
    };
    const value = String(answer || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (expected[puzzle] !== value) return done?.({ ok: false, message: 'Aún no. Vuelve a mirar las pruebas.' });
    if (!room.solved.includes(puzzle)) {
      room.solved.push(puzzle);
      const labels = {
        photo: 'Contexto',
        social: 'Fuente verificable',
        archive: 'Desfase horario',
        decoder: 'Clave de verificación',
        puzzle: 'Omisión',
        detective: 'Cronología',
        relay: 'Firma de radio',
        route: 'Ruta segura',
        vault: 'Integridad del archivo',
        witness: 'Testimonio consistente'
      };
      room.evidence.push(labels[puzzle]); broadcast(room);
    }
    done?.({ ok: true, message: 'Archivo recuperado.' });
  });

  socket.on('game:classify', ({ code, values }, done) => {
    const room = rooms.get(code);
    const correct = ['hecho', 'manipulacion', 'interpretacion'];
    if (!room || !Array.isArray(values) || values.join(',') !== correct.join(',')) return done?.({ ok: false, message: 'Hay una clasificación que no coincide con la evidencia.' });
    room.classifications = { done: true }; if (!room.evidence.includes('VERIFICA')) room.evidence.push('VERIFICA'); broadcast(room);
    done?.({ ok: true, message: 'La clave VERIFICA fue añadida al expediente.' });
  });

  socket.on('game:final', ({ code, choice }, done) => {
    const room = rooms.get(code);
    if (!room || room.solved.length < 10 || !room.classifications.done) return done?.({ ok: false, message: 'Todavía faltan archivos por recuperar.' });
    if (choice !== 'B') return done?.({ ok: false, message: 'Ese titular añade algo que el informe no demuestra.' });
    room.finalWon = true; broadcast(room); done?.({ ok: true });
  });

  socket.on('disconnect', () => {
    for (const room of rooms.values()) if (room.players.delete(socket.id)) {
      if (room.hostId === socket.id) room.hostId = room.players.keys().next().value || null;
      if (!room.players.size) rooms.delete(room.code); else broadcast(room);
      break;
    }
  });
});

server.listen(port, () => console.log(`La Última Edición en puerto ${port}`));
