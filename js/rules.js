// rules.js — luật đi quân cờ vua (nhập thành, bắt tốt qua đường, chiếu)
const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

function findKing(b, color) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = b[r][c];
    if (p && p.t === 'k' && p.c === color) return [r, c];
  }
}

function attacked(b, r, c, by) {
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const p = b[i][j]; if (!p || p.c !== by) continue;
    const dr = r - i, dc = c - j;
    if (p.t === 'p') { const d = by === 'w' ? -1 : 1; if (i + d === r && Math.abs(j - c) === 1) return true; }
    else if (p.t === 'n') { if ((Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2)) return true; }
    else if (p.t === 'k') { if (Math.max(Math.abs(dr), Math.abs(dc)) === 1) return true; }
    else {
      const dirs = p.t === 'r' ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
        : p.t === 'b' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
        : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [a, b2] of dirs) {
        let x = i + a, y = j + b2;
        while (inB(x, y)) { if (x === r && y === c) return true; if (b[x][y]) break; x += a; y += b2; }
      }
    }
  }
  return false;
}

function pseudo(b, r, c, ep) {
  const p = b[r][c]; if (!p) return [];
  const res = []; const dir = p.c === 'w' ? -1 : 1;
  const add = (x, y, extra) => { if (inB(x, y)) res.push({ fr: r, fc: c, tr: x, tc: y, ...(extra || {}) }); };
  if (p.t === 'p') {
    if (inB(r + dir, c) && !b[r + dir][c]) {
      add(r + dir, c);
      if (!p.moved && inB(r + 2 * dir, c) && !b[r + 2 * dir][c]) add(r + 2 * dir, c, { double: true });
    }
    for (const dc of [-1, 1]) { const x = r + dir, y = c + dc; if (inB(x, y) && b[x][y] && b[x][y].c !== p.c) add(x, y); }
    if (ep) { const [er, ec] = ep; if (r + dir === er && Math.abs(c - ec) === 1) add(er, ec, { ep: true }); }
  } else if (p.t === 'n' || p.t === 'k') {
    const d = p.t === 'n'
      ? [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [a, b2] of d) { const x = r + a, y = c + b2; if (inB(x, y) && (!b[x][y] || b[x][y].c !== p.c)) add(x, y); }
    if (p.t === 'k' && !p.moved) {
      const home = p.c === 'w' ? 7 : 0;
      if (r === home && c === 4) {
        for (const side of [0, 1]) {
          const rookC = side === 0 ? 0 : 7;
          const rook = b[home][rookC];
          const empty = side === 0 ? !b[home][1] && !b[home][2] && !b[home][3] : !b[home][5] && !b[home][6];
          if (rook && rook.t === 'r' && rook.c === p.c && !rook.moved && empty) {
            const pass = side === 0 ? [4, 3, 2] : [4, 5, 6];
            if (!attacked(b, home, pass[0], p.c === 'w' ? 'b' : 'w') && !attacked(b, home, pass[1], p.c === 'w' ? 'b' : 'w')) {
              add(home, side === 0 ? 2 : 6, { castle: side === 0 ? 'Q' : 'K' });
            }
          }
        }
      }
    }
  } else {
    const dirs = p.t === 'r' ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
      : p.t === 'b' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [a, b2] of dirs) {
      let x = r + a, y = c + b2;
      while (inB(x, y)) { if (!b[x][y]) add(x, y); else { if (b[x][y].c !== p.c) add(x, y); break; } x += a; y += b2; }
    }
  }
  return res;
}

function applyOn(b, m) {
  const nb = b.map(row => row.map(p => p ? { ...p } : null));
  const p = nb[m.fr][m.fc];
  if (m.ep) nb[m.fr][m.tc] = null;
  if (m.castle) {
    const home = m.fr;
    if (m.castle === 'K') { nb[home][5] = nb[home][7]; nb[home][7] = null; nb[home][5].moved = true; }
    else { nb[home][3] = nb[home][0]; nb[home][0] = null; nb[home][3].moved = true; }
  }
  nb[m.tr][m.tc] = p; nb[m.fr][m.fc] = null; p.moved = true;
  if (p.t === 'p' && (m.tr === 0 || m.tr === 7)) p.t = m.promo || 'q';
  return nb;
}

function legalMoves(r, c) {
  const p = board[r][c]; if (!p) return [];
  return pseudo(board, r, c, enPassant).filter(m => {
    const nb = applyOn(board, { ...m, promo: 'q' });
    const k = findKing(nb, p.c);
    return !attacked(nb, k[0], k[1], p.c === 'w' ? 'b' : 'w');
  });
}

function allLegal(color) {
  const all = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (p && p.c === color) for (const m of legalMoves(r, c)) all.push(m);
  }
  return all;
}

function inCheck(color) {
  const k = findKing(board, color);
  return attacked(board, k[0], k[1], color === 'w' ? 'b' : 'w');
}
