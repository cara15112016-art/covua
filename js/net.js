// net.js — đấu PvP online qua PeerJS (P2P). Tối ưu để vào phòng nhanh.
// Pre-kết nối signaling + STUN ngay khi mở trang, nên bấm Tạo/Vào là gần như tức thì.
const NET = { active: false, peer: null, conn: null, myColor: 'w', room: '', isHost: false, applying: false, ready: false, code: '' };

const NET_ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  ],
  iceCandidatePoolSize: 10
};

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
  NET.active = false; NET.conn = null; NET.peer = null; NET.room = ''; NET.ready = false;
}

// Tạo sẵn peer + đăng ký mã phòng ngay khi mở trang (giảm thời gian chờ)
function prewarm() {
  if (typeof Peer === 'undefined') { netStatus('Chưa tải PeerJS (cần mạng).'); return; }
  destroyNet();
  const code = makeCode();
  NET.code = code;
  const peer = new Peer('cv-' + code, { config: NET_ICE, debug: 0 });
  NET.peer = peer;
  netStatus('Đang kết nối máy chủ...');
  peer.on('open', () => {
    NET.ready = true;
    netStatus('Sẵn sàng! Bấm "Tạo phòng" hoặc nhập mã để vào.');
  });
  peer.on('connection', (conn) => setupConn(conn, true));
  peer.on('disconnected', () => { try { peer.reconnect(); } catch {} });
  peer.on('error', (e) => {
    if (e.type === 'unavailable-id') { prewarm(); return; }
    netStatus('Lỗi: ' + e.type);
  });
}

function createRoom() {
  if (typeof Peer === 'undefined') { alert('Chưa tải được PeerJS (cần mạng để load CDN).'); return; }
  if (!NET.peer) { prewarm(); }
  if (!NET.ready) {
    netStatus('Đang kết nối máy chủ, tạo phòng sau 1 giây...');
    setTimeout(createRoom, 1000);
    return;
  }
  NET.isHost = true; NET.myColor = 'w'; NET.room = NET.code;
  document.getElementById('roomCode').value = NET.code;
  netStatus('Phòng ' + NET.code + ' — gửi mã cho bạn. Bạn cầm Trắng. Đang chờ đối thủ...');
}

function joinRoom(codeRaw) {
  if (typeof Peer === 'undefined') { alert('Chưa tải được PeerJS (cần mạng để load CDN).'); return; }
  const code = (codeRaw || '').trim().toUpperCase();
  if (!code) { alert('Nhập mã phòng!'); return; }
  if (!NET.peer) { prewarm(); }
  if (!NET.ready) {
    netStatus('Đang kết nối máy chủ, thử vào lại sau 1 giây...');
    setTimeout(() => joinRoom(code), 1000);
    return;
  }
  NET.isHost = false; NET.myColor = 'b'; NET.room = code;
  netStatus('Đang vào phòng ' + code + '...');
  const conn = NET.peer.connect('cv-' + code, { reliable: true });
  setupConn(conn, false);
  conn.on('error', (err) => { netStatus('Lỗi kết nối: ' + (err?.message || err) + '. Thử lại!'); });
  setTimeout(() => {
    if (!NET.active) netStatus('Vẫn đang kết nối ' + code + '... (đảm bảo bạn là người thứ 2, máy chủ có thể chậm)');
  }, 4000);
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
    const keepMoves = msg.moveTexts || [], keepCaps = msg.historyCaps || [];
    fenToBoardSilent(msg.fen);
    moveTexts = keepMoves; historyCaps = keepCaps;
    turn = msg.turn || turn; lastMove = msg.lastMove || null;
    selected = null; legalCache = []; gameOver = false; promoPending = null;
    afterMoveSilent();
  } finally { NET.applying = false; }
}

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
