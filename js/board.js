// board.js — vẽ bàn cờ + xử lý nước đi + chiếu / hết cờ
function notation(m, piece, cap) {
  const f = c => 'abcdefgh'[c], r = r => 8 - r;
  if (m.castle) return m.castle === 'K' ? 'O-O' : 'O-O-O';
  let s = '';
  if (piece.t !== 'p') s += piece.t.toUpperCase();
  else if (cap) s += f(m.fc);
  if (cap) s += 'x';
  s += f(m.tc) + r(m.tr);
  if (m.promo) s += '=' + m.promo.toUpperCase();
  return s;
}

function doMove(m) {
  const p = board[m.fr][m.fc];
  const cap = !!board[m.tr][m.tc] || !!m.ep;
  if (cap) {
    const victim = m.ep ? { t: 'p', c: turn === 'w' ? 'b' : 'w' } : board[m.tr][m.tc];
    historyCaps.push(PIECES[victim.t]);
  }
  history.push(JSON.stringify({ board, turn, enPassant, lastMove, moveTexts: [...moveTexts], historyCaps: [...historyCaps] }));
  const pieceCopy = { ...p };
  if (p.t === 'p' && (m.tr === 0 || m.tr === 7) && !m.promo) { promoPending = { m, pieceCopy, cap }; showPromo(p.c); return; }
  board = applyOn(board, m);
  finishMove(m, notation(m, pieceCopy, cap));
}

function finishMove(m, txt) {
  const opp = turn === 'w' ? 'b' : 'w';
  const k = findKing(board, opp);
  if (k && attacked(board, k[0], k[1], turn)) txt += allLegal(opp).length === 0 ? '#' : '+';
  moveTexts.push(txt);
  enPassant = m.double ? [(m.fr + m.tr) / 2, m.fc] : null;
  lastMove = m; selected = null; legalCache = [];
  turn = opp; afterMove();
  if (typeof NET !== 'undefined' && NET.active && !NET.applying) sendState();
}

function afterMove() {
  const moves = allLegal(turn);
  const chk = inCheck(turn);
  const st = document.getElementById('status');
  const name = turn === 'w' ? 'Trắng' : 'Đen';
  st.classList.toggle('check', chk && moves.length > 0);
  if (moves.length === 0) {
    gameOver = true;
    if (chk) { st.textContent = `♔ CHIẾU HẾT! ${turn === 'w' ? 'Đen' : 'Trắng'} thắng!`; st.classList.add('check'); }
    else st.textContent = '🤝 HÒA (hết nước đi hợp lệ - stalemate)!';
  } else {
    let mine = (typeof NET !== 'undefined' && NET.active) ? (turn === NET.myColor ? ' (lượt bạn)' : ' (lượt đối thủ)') : '';
    if (mode === 'ai') mine = turn === aiColor ? ' (lượt máy)' : ' (lượt bạn)';
    st.textContent = (chk ? `⚠️ ${name} đang bị CHIẾU - ` : `Lượt ${name}`) + mine;
  }
  render();
  if (mode === 'ai') maybeAiMove();
}

function showPromo(color) {
  const box = document.getElementById('promo'); box.style.display = 'flex';
  const ch = document.getElementById('promoChoices'); ch.innerHTML = '';
  for (const t of ['q', 'r', 'b', 'n']) {
    const s = document.createElement('span'); s.textContent = PIECES[t];
    s.onclick = () => {
      box.style.display = 'none';
      const { m, pieceCopy, cap } = promoPending; promoPending = null;
      const mm = { ...m, promo: t };
      board = applyOn(board, mm);
      finishMove(mm, notation(mm, pieceCopy, cap));
    };
    ch.appendChild(s);
  }
}

function onClick(r, c) {
  if (editMode) { placePiece(r, c); return; }
  if (gameOver || promoPending) return;
  if (mode === 'ai' && (turn === aiColor || aiThinking)) return; // lượt máy: không cho bấm
  if (typeof NET !== 'undefined' && NET.active && turn !== NET.myColor) return; // khóa: chỉ đi quân mình online
  const p = board[r][c];
  if (selected) {
    const m = legalCache.find(m => m.tr === r && m.tc === c);
    if (m) { doMove(m); return; }
  }
  if (p && p.c === turn) {
    if (typeof NET !== 'undefined' && NET.active && p.c !== NET.myColor) return; // không được chọn quân đối thủ
    selected = [r, c]; legalCache = legalMoves(r, c);
  }
  else { selected = null; legalCache = []; }
  render();
  if (!gameOver) {
    const chk = inCheck(turn);
    document.getElementById('status').textContent = (chk ? `⚠️ ${turn === 'w' ? 'Trắng' : 'Đen'} đang bị CHIẾU - ` : `Lượt ${turn === 'w' ? 'Trắng' : 'Đen'} đi`);
    document.getElementById('status').classList.toggle('check', chk);
  }
}

function render() {
  const bd = document.getElementById('board'); bd.innerHTML = '';
  for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 8; dc++) {
    const r = flipped ? 7 - dr : dr, c = flipped ? 7 - dc : dc;
    const d = document.createElement('div');
    d.className = 'sq ' + (((r + c) % 2 === 0) ? 'light' : 'dark');
    if (selected && selected[0] === r && selected[1] === c) d.classList.add('selected');
    if (lastMove && ((lastMove.fr === r && lastMove.fc === c) || (lastMove.tr === r && lastMove.tc === c))) d.classList.add('lastmove');
    const p = board[r][c];
    if (p) {
      const s = document.createElement('span'); s.className = 'pc ' + p.c; s.textContent = PIECES[p.t];
      if (editMode) {
        s.draggable = true; s.style.cursor = 'grab';
        s.ondragstart = (e) => { e.dataTransfer.setData('text/plain', 'board:' + r + ',' + c); };
      }
      d.appendChild(s);
    }
    if (selected && legalCache.some(m => m.tr === r && m.tc === c)) {
      const dot = document.createElement('div');
      if (board[r][c] || legalCache.find(m => m.tr === r && m.tc === c)?.ep) dot.className = 'cap';
      else dot.className = 'dot';
      d.appendChild(dot);
    }
    if (dc === 0) { const cr = document.createElement('span'); cr.className = 'coord rank'; cr.textContent = 8 - r; d.appendChild(cr); }
    if (dr === 7) { const cf = document.createElement('span'); cf.className = 'coord file'; cf.textContent = 'abcdefgh'[c]; d.appendChild(cf); }
    d.onclick = () => onClick(r, c);
    if (editMode) {
      d.ondragover = (e) => { e.preventDefault(); d.style.outline = '3px dashed #20c997'; d.style.outlineOffset = '-3px'; };
      d.ondragleave = () => { d.style.outline = ''; };
      d.ondrop = (e) => { e.preventDefault(); d.style.outline = ''; dropPiece(e.dataTransfer.getData('text/plain'), r, c); };
      d.oncontextmenu = (e) => { e.preventDefault(); board[r][c] = null; render(); };
    }
    bd.appendChild(d);
  }
  let html = '';
  for (let i = 0; i < moveTexts.length; i += 2) html += `<div>${i / 2 + 1}. ${moveTexts[i]} ${moveTexts[i + 1] || ''}</div>`;
  const mv = document.getElementById('moves');
  mv.innerHTML = html; mv.scrollTop = mv.scrollHeight;
  document.getElementById('count').textContent = Math.ceil(moveTexts.length / 2);
  document.getElementById('captured').textContent = historyCaps.join(' ') || '—';
}
