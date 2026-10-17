// ai.js — đối thủ máy: minimax + alpha-beta, 3 cấp độ (1 dễ → 3 khó)
const other = (c) => (c === 'w' ? 'b' : 'w');

const AI_LEVELS = {
  1: { depth: 1, noise: 70 },   // Cấp 1 — Dễ: hay đi linh tinh
  2: { depth: 2, noise: 25 },   // Cấp 2 — Trung bình
  3: { depth: 3, noise: 0 }     // Cấp 3 — Khó: đi chuẩn nhất
};

const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Bảng vị trí (PST) — hàng 0 = hạng 8. Trắng dùng trực tiếp, Đen lật dọc.
const PST = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20
  ]
};

// Sinh nước đi hợp lệ trên bàn tùy ý (không đụng board toàn cục)
function allLegalOn(b, color, ep) {
  const all = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = b[r][c];
    if (!p || p.c !== color) continue;
    for (const m of pseudo(b, r, c, ep)) {
      const nb = applyOn(b, { ...m, promo: 'q' });
      const k = findKing(nb, color);
      if (k && !attacked(nb, k[0], k[1], color === 'w' ? 'b' : 'w')) all.push(m);
    }
  }
  return all;
}

// Đánh giá bàn: điểm (+ = Trắng tốt)
function evalBoard(b) {
  let s = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = b[r][c]; if (!p) continue;
    const idx = (p.c === 'w') ? (r * 8 + c) : ((7 - r) * 8 + c);
    const v = VAL[p.t] + PST[p.t][idx];
    s += (p.c === 'w' ? v : -v);
  }
  return s;
}

function evalFor(color, b) { return color === 'w' ? evalBoard(b) : -evalBoard(b); }

// Sắp xếp: ăn quân + phong cấp đi trước (MVV-LVA) → alpha-beta cắt nhanh
function orderMoves(moves, b) {
  for (const m of moves) {
    const a = b[m.fr][m.fc];
    const victim = b[m.tr][m.tc];
    let sc = 0;
    if (victim) sc = 10 * VAL[victim.t] - VAL[a.t];
    else if (m.ep) sc = 90;
    else if (a.t === 'p' && (m.tr === 0 || m.tr === 7)) sc = 800;
    m._s = sc;
  }
  moves.sort((x, y) => y._s - x._s);
  return moves;
}

let aiNodes = 0;
const AI_NODE_CAP = 250000;

function negamax(b, color, ep, depth, alpha, beta, ply) {
  if (aiNodes > AI_NODE_CAP) return evalFor(color, b);
  aiNodes++;
  const moves = allLegalOn(b, color, ep);
  if (moves.length === 0) {
    const k = findKing(b, color);
    const chk = k && attacked(b, k[0], k[1], color === 'w' ? 'b' : 'w');
    return chk ? -99999 + ply : 0; // bị chiếu hết / hòa hết nước
  }
  if (depth === 0) return quiesce(b, color, ep, alpha, beta, 0);
  orderMoves(moves, b);
  let best = -Infinity;
  for (const m of moves) {
    const nb = applyOn(b, m);
    const nEp = m.double ? [(m.fr + m.tr) / 2, m.fc] : null;
    const sc = -negamax(nb, other(color), nEp, depth - 1, -beta, -alpha, ply + 1);
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// Quiescence: chỉ tìm nước ăn quân ở đáy → tránh "horizon effect"
function quiesce(b, color, ep, alpha, beta, ply) {
  const stand = evalFor(color, b);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (ply >= 5 || aiNodes > AI_NODE_CAP) return alpha;
  const caps = allLegalOn(b, color, ep).filter(m => b[m.fr][m.fc] && (b[m.tr][m.tc] || m.ep));
  orderMoves(caps, b);
  for (const m of caps) {
    const nb = applyOn(b, m);
    const nEp = m.double ? [(m.fr + m.tr) / 2, m.fc] : null;
    const sc = -quiesce(nb, other(color), nEp, -beta, -alpha, ply + 1);
    if (sc >= beta) return beta;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}

// Chọn nước đi cho máy (đúng màu aiColor)
function aiBestMove() {
  const cfg = AI_LEVELS[aiLevel] || AI_LEVELS[3];
  const moves = allLegalOn(board, aiColor, enPassant);
  if (!moves.length) return null;
  orderMoves(moves, board);
  aiNodes = 0;

  const scored = [];
  let alpha = -Infinity;
  for (const m of moves) {
    const nb = applyOn(board, m);
    const nEp = m.double ? [(m.fr + m.tr) / 2, m.fc] : null;
    const sc = -negamax(nb, other(aiColor), nEp, cfg.depth - 1, -Infinity, Infinity, 1);
    scored.push({ m, sc });
    if (sc > alpha) alpha = sc;
  }
  scored.sort((a, b2) => b2.sc - a.sc);

  // Cấp thấp đi ngẫu nhiên trong nhóm gần nhất (noise) cho dễ/chặn lặp)
  const top = scored[0].sc;
  const pool = scored.filter(x => x.sc >= top - cfg.noise);
  const pick = pool[Math.floor(Math.random() * pool.length)];

  const p = board[pick.m.fr][pick.m.fc];
  if (p.t === 'p' && (pick.m.tr === 0 || pick.m.tr === 7)) pick.m.promo = 'q';
  return pick.m;
}

function setNetStatusSafe(msg) { const el = document.getElementById('netStatus'); if (el) el.textContent = msg; }

// Gọi sau khi tới lượt máy
function maybeAiMove() {
  if (mode !== 'ai' || gameOver || editMode) return;
  if (turn !== aiColor || aiThinking) return;
  aiThinking = true;
  const st = document.getElementById('status');
  if (st) st.textContent = '🤖 Máy đang suy nghĩ...';
  setTimeout(() => {
    let m = null;
    try { m = aiBestMove(); } catch (e) { m = null; }
    aiThinking = false;
    if (m && !gameOver) doMove(m);
  }, 50);
}
