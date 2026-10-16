// net.js — đấu PvP online qua PeerJS (P2P, không cần server riêng)
// Chủ phòng cầm Trắng, khách cầm Đen. Mỗi nước đi gửi full state qua FEN.
const NET = { active: false, peer: null, conn: null, myColor: 'w', room: '', isHost: false, applying: false };

function netStatus(msg) {
  const el = document.getElementById('netStatus');
  if (el) el.textContent = msg;
}

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function destroyNet() {
  try { NET.conn?.close(); } catch {}
  try { NET.peer?.destroy(); } catch {}
  NET.active = false; NET.conn = null; NET.peer = null; NET.room = '';
}

function createRoom() {
  if (typeof Peer === 'undefined') { alert('Chưa tải được PeerJS (cần mạng để load CDN).'); return; }
  destroyNet();
  const code = makeCode();
  NET.room = code; NET.isHost = true; NET.myColor = 'w';
  netStatus('Đang tạo phòng ' + code + '...');
  const peer = new Peer('chess-pvp-' + code);
  NET.peer = peer;
  peer.on('open', () => {
    netStatus('Phòng ' + code + ' — gửi mã cho bạn để vào. Bạn cầm Trắng.');
    document.getElementById('roomCode').value = code;
  });
  peer.on('connection', (conn) => setupConn(conn, true));
  peer.on('error', (e) => netStatus('Lỗi: ' + e.type));
}

function joinRoom(codeRaw) {
  if (typeof Peer === 'undefined') { alert('Chưa tải được PeerJS (cần mạng để load CDN).'); return; }
  const code = (codeRaw || '').trim().toUpperCase();
  if (!code) { alert('Nhập mã phòng!'); return; }
  destroyNet();
  NET.room = code; NET.isHost = false; NET.myColor = 'b';
  netStatus('Đang vào phòng ' + code + '...');
  const peer = new Peer();
  NET.peer = peer;
  peer.on('open', () => {
    const conn = peer.connect('chess-pvp-' + code, { reliable: true });
    setupConn(conn, false);
  });
  peer.on('error', (e) => netStatus('Lỗi: ' + e.type + ' (sai mã phòng?)'));
}

function setupConn(conn, isHost) {
  NET.conn = conn; NET.isHost = isHost;
  NET.myColor = isHost ? 'w' : 'b';
  conn.on('open', () => {
    NET.active = true;
    flipped = (NET.myColor === 'b');
    netStatus(isHost ? 'Đối thủ đã vào! Bạn cầm Trắng.' : 'Đã vào phòng! Bạn cầm Đen.');
    if (isHost) sendState();
    render();
  });
  conn.on('data', (msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'state') applyState(msg);
    if (msg.t === 'reset') { moveTexts = []; historyCaps = []; init(); if (NET.myColor === 'b') flipped = true; render(); }
  });
  conn.on('close', () => { NET.active = false; netStatus('Đối thủ đã thoát.'); });
}

function sendState() {
  if (!NET.active || !NET.conn?.open || NET.applying) return;
  NET.conn.send({ t: 'state', fen: boardToFEN(), moveTexts, historyCaps, lastMove, turn });
}

function applyState(msg) {
  NET.applying = true;
  try {
    // dựng bàn từ FEN nhưng giữ lại lịch sử nước đi
    const keepMoves = msg.moveTexts || [], keepCaps = msg.historyCaps || [];
    fenToBoardSilent(msg.fen);
    moveTexts = keepMoves; historyCaps = keepCaps;
    turn = msg.turn || turn; lastMove = msg.lastMove || null;
    selected = null; legalCache = []; gameOver = false; promoPending = null;
    afterMoveSilent();
  } finally { NET.applying = false; }
}

// dựng bàn từ FEN, không reset status ồn ào (dùng nội bộ cho net)
function fenToBoardSilent(fen) {
  const parts = fen.trim().split(/\s+/);
  const rows = parts[0].split('/');
  const nb = [];
  for (let r = 0; r < 8; r++) {
    const row = [];
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) { for (let i = 0; i < +ch; i++) row.push(null); }
      else row.push({ t: ch.toLowerCase(), c: ch === ch.toUpperCase() ? 'w' : 'b', moved: true });
    }
    nb.push(row);
  }
  board = nb;
  if (board[7][4]?.t === 'k' && board[7][4]?.c === 'w') board[7][4].moved = false;
  if (board[0][4]?.t === 'k' && board[0][4]?.c === 'b') board[0][4].moved = false;
}

function afterMoveSilent() {
  const moves = allLegal(turn);
  const chk = inCheck(turn);
  const st = document.getElementById('status');
  const name = turn === 'w' ? 'Trắng' : 'Đen';
  const mine = turn === NET.myColor ? ' (lượt bạn)' : ' (lượt đối thủ)';
  st.classList.toggle('check', chk && moves.length > 0);
  if (moves.length === 0) {
    gameOver = true;
    st.textContent = chk ? `♔ CHIẾU HẾT! ${turn === 'w' ? 'Đen' : 'Trắng'} thắng!` : '🤝 HÒA!';
  } else {
    st.textContent = (chk ? `⚠️ ${name} bị CHIẾU -` : `Lượt ${name}`) + mine;
  }
  render();
}

function netCanPlay() {
  if (!NET.active) return true;
  return turn === NET.myColor;
}
