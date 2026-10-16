// main.js — gắn nút bấm + khởi động game
document.getElementById('undo').onclick = () => {
  if (typeof NET !== 'undefined' && NET.active) { alert('Online: không undo, đánh tiếp!'); return; }
  if (promoPending) return;
  const h = history.pop(); if (!h) return;
  const s = JSON.parse(h);
  board = s.board.map(row => row.map(p => p ? { ...p } : null));
  turn = s.turn; enPassant = s.enPassant; lastMove = s.lastMove;
  moveTexts = s.moveTexts || moveTexts.slice(0, -1); historyCaps = s.historyCaps || [];
  gameOver = false; selected = null; legalCache = []; render();
  document.getElementById('status').textContent = `Lượt ${turn === 'w' ? 'Trắng' : 'Đen'} đi`;
  document.getElementById('status').classList.remove('check');
};

document.getElementById('flip').onclick = () => { flipped = !flipped; render(); };

document.getElementById('reset').onclick = () => {
  moveTexts = []; historyCaps = []; init();
  document.getElementById('status').textContent = 'Lượt Trắng đi';
  document.getElementById('status').classList.remove('check');
  if (typeof NET !== 'undefined' && NET.active && NET.conn?.open) NET.conn.send({ t: 'reset' });
};

document.getElementById('editMode').onclick = (ev) => {
  editMode = !editMode;
  ev.target.textContent = 'Xếp cờ: ' + (editMode ? 'BẬT' : 'TẮT');
  ev.target.style.background = editMode ? '#f08c00' : '';
  if (editMode) {
    gameOver = true; selected = null; legalCache = [];
    board = Array.from({ length: 8 }, () => Array(8).fill(null));
    lastMove = null; moveTexts = []; historyCaps = []; history = [];
    document.getElementById('status').textContent = '🛠 KÉO quân từ khung vào bàn (hoặc chạm để chọn rồi chạm vào ô). Chuột phải vào quân để xóa.';
  } else {
    gameOver = false;
    document.getElementById('status').textContent = `Lượt ${turn === 'w' ? 'Trắng' : 'Đen'} đi`;
  }
  render();
};

document.getElementById('clearBoard').onclick = () => { board = Array.from({ length: 8 }, () => Array(8).fill(null)); render(); };

document.getElementById('startPos').onclick = () => {
  moveTexts = []; historyCaps = []; init();
  if (editMode) document.getElementById('editMode').click();
};

document.getElementById('playHere').onclick = () => {
  turn = document.getElementById('sideToMove').value;
  let wk = 0, bk = 0;
  board.flat().forEach(p => { if (p && p.t === 'k') p.c === 'w' ? wk++ : bk++; });
  if (wk !== 1 || bk !== 1) { alert('Cần đúng 1 vua trắng và 1 vua đen mới chơi được!'); return; }
  moveTexts = []; historyCaps = []; history = [];
  lastMove = null; enPassant = null; selected = null; legalCache = [];
  if (editMode) document.getElementById('editMode').click();
  else { gameOver = false; afterMove(); render(); }
  document.getElementById('status').textContent = `Bắt đầu từ thế cờ tự tạo - Lượt ${turn === 'w' ? 'Trắng' : 'Đen'} đi`;
};

document.getElementById('loadFen').onclick = () => { const f = document.getElementById('fen').value; if (f) fenToBoard(f); };
document.getElementById('fen').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.value) fenToBoard(e.target.value); });
document.getElementById('copyFen').onclick = async () => {
  const f = boardToFEN();
  try { await navigator.clipboard.writeText(f); alert('Đã copy FEN:\n' + f); }
  catch { document.getElementById('fen').value = f; }
};
document.getElementById('sideToMove').onchange = (e) => { turn = e.target.value; };

// Online PvP
document.getElementById('createRoom').onclick = () => { createRoom(); };
document.getElementById('joinRoom').onclick = () => { joinRoom(document.getElementById('roomCode').value); };
document.getElementById('roomCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(e.target.value); });
document.getElementById('leaveRoom').onclick = () => {
  if (typeof NET !== 'undefined' && NET.conn?.open) NET.conn.send({ t: 'reset' });
  destroyNet(); flipped = false;
  moveTexts = []; historyCaps = []; init();
  netStatus('Đã rời phòng (chơi 2 người tại chỗ).');
};

buildPalette();
init();
