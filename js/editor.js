// editor.js — xếp cờ bằng kéo-thả, bàn trống (không dùng thế có sẵn)
const PALETTE = [['K'], ['Q'], ['R'], ['B'], ['N'], ['P'], ['k'], ['q'], ['r'], ['b'], ['n'], ['p'], ['x']];

function buildPalette() {
  const pal = document.getElementById('palette'); pal.innerHTML = '';
  PALETTE.forEach(([ch]) => {
    const s = document.createElement('span');
    if (ch === 'x') { s.textContent = '🧽'; s.title = 'Xóa ô - kéo vào bàn để xóa'; }
    else { const isW = ch === ch.toUpperCase(); s.textContent = PIECES[ch.toLowerCase()]; s.className = isW ? 'w' : 'b'; }
    if (ch === paletteSel) s.classList.add('sel');
    s.draggable = true;
    s.ondragstart = (e) => { e.dataTransfer.setData('text/plain', 'palette:' + ch); paletteSel = ch; buildPalette(); };
    s.onclick = () => { paletteSel = ch; buildPalette(); };
    pal.appendChild(s);
  });
}

function makePiece(t, color, r, c) {
  const p = { t, c: color, moved: true };
  if (t === 'k' && ((color === 'w' && r === 7 && c === 4) || (color === 'b' && r === 0 && c === 4))) p.moved = false;
  if (t === 'r' && ((color === 'w' && r === 7 && (c === 0 || c === 7)) || (color === 'b' && r === 0 && (c === 0 || c === 7)))) p.moved = false;
  return p;
}

function placePiece(r, c) {
  if (paletteSel === 'x') { board[r][c] = null; }
  else {
    const isW = paletteSel === paletteSel.toUpperCase();
    if (paletteSel.toLowerCase() === 'p' && (r === 0 || r === 7)) return;
    board[r][c] = makePiece(paletteSel.toLowerCase(), isW ? 'w' : 'b', r, c);
  }
  render();
}

function dropPiece(data, r, c) {
  if (!data) return;
  if (data.startsWith('board:')) {
    const [fr, fc] = data.slice(6).split(',').map(Number);
    if (fr === r && fc === c) return;
    board[r][c] = board[fr][fc]; board[fr][fc] = null;
    if (board[r][c] && board[r][c].t === 'p' && (r === 0 || r === 7)) board[r][c] = null;
    render(); return;
  }
  if (data.startsWith('palette:')) {
    const ch = data.slice(8);
    if (ch === 'x') { board[r][c] = null; }
    else {
      const isW = ch === ch.toUpperCase();
      if (ch.toLowerCase() === 'p' && (r === 0 || r === 7)) { alert('Tốt không được ở hàng cuối!'); return; }
      board[r][c] = makePiece(ch.toLowerCase(), isW ? 'w' : 'b', r, c);
    }
    render(); return;
  }
}
