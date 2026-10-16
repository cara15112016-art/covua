// fen.js — đọc / ghi thế cờ dạng FEN
function boardToFEN() {
  const rows = [];
  for (let r = 0; r < 8; r++) {
    let e = 0, s = '';
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) e++;
      else { if (e > 0) { s += e; e = 0; } s += p.c === 'w' ? p.t.toUpperCase() : p.t; }
    }
    if (e > 0) s += e;
    rows.push(s);
  }
  return rows.join('/') + ' ' + turn + ' - - 0 1';
}

function fenToBoard(fen) {
  try {
    const parts = fen.trim().split(/\s+/);
    const rows = parts[0].split('/');
    if (rows.length !== 8) throw 'FEN sai';
    const nb = [];
    for (let r = 0; r < 8; r++) {
      const row = [];
      for (const ch of rows[r]) {
        if (/\d/.test(ch)) { for (let i = 0; i < +ch; i++) row.push(null); }
        else if (/[prnbqkPRNBQK]/.test(ch)) row.push({ t: ch.toLowerCase(), c: ch === ch.toUpperCase() ? 'w' : 'b', moved: true });
        else throw 'ký tự lạ';
      }
      if (row.length !== 8) throw 'mỗi hàng phải 8 ô';
      nb.push(row);
    }
    let wk = 0, bk = 0;
    nb.flat().forEach(p => { if (p && p.t === 'k') p.c === 'w' ? wk++ : bk++; });
    if (wk !== 1 || bk !== 1) throw 'cần đúng 1 vua trắng và 1 vua đen';
    board = nb; turn = (parts[1] === 'b') ? 'b' : 'w';
    document.getElementById('sideToMove').value = turn;
    moveTexts = []; historyCaps = []; history = [];
    lastMove = null; enPassant = null; selected = null; legalCache = []; gameOver = false; promoPending = null;
    if (board[7][4]?.t === 'k' && board[7][4]?.c === 'w') board[7][4].moved = false;
    if (board[0][4]?.t === 'k' && board[0][4]?.c === 'b') board[0][4].moved = false;
    for (const c of [0, 7]) {
      if (board[7][c]?.t === 'r' && board[7][c]?.c === 'w') board[7][c].moved = false;
      if (board[0][c]?.t === 'r' && board[0][c]?.c === 'b') board[0][c].moved = false;
    }
    render();
    document.getElementById('status').textContent = `Đã nạp thế cờ - Lượt ${turn === 'w' ? 'Trắng' : 'Đen'} đi`;
    return true;
  } catch (e) { alert('FEN không hợp lệ: ' + e); return false; }
}
