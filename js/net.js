// net.js — đấu PvP online qua Trystero (P2P tin cậy, không cần server riêng).
// Dùng torrent + WebRTC, kết nối nhanh, xuyên NAT bằng STUN/TURN.
// Chủ phòng cầm Trắng, khách cầm Đen.
let trystero = null;
const NET = { active: false, room: null, myColor: 'w', code: '', isHost: false, applying: false, ready: false };

const NET_ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};

const NET_CFG = { appId: 'covua-pvp-2026', rtcConfig: NET_ICE };

function netStatus(msg) {
  const el = document.getElementById('netStatus');
  if (el) el.textContent = msg;
}

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Tải thư viện Trystero qua CDN (ESM) khi trang mở
function prewarm() {
  if (trystero) { NET.ready = true; netStatus('Sẵn sàng! Bấm "Tạo phòng" hoặc nhập mã để vào.'); return; }
  netStatus('Đang tải kết nối...');
  import('https://esm.sh/trystero').then((m) => {
    trystero = m; NET.ready = true;
    netStatus('Sẵn sàng! Bấm "Tạo phòng" hoặc nhập mã để vào.');
  }).catch(() => { netStatus('Không tải được thư viện online (kiểm tra mạng).'); });
}

function destroyNet() {
  try { NET.room?.leave(); } catch {}
  NET.active = false; NET.room = null; NET.code = '';
}

function ensureReady(after) {
  if (!trystero) { prewarm(); }
  if (!NET.ready) { setTimeout(after, 800); return false; }
  return true;
}

function createRoom() {
  if (!ensureReady(createRoom)) return;
  destroyNet();
  const code = makeCode();
  NET.code = code; NET.isHost = true; NET.myColor = 'w';
  document.getElementById('roomCode').value = code;
  netStatus('Phòng ' + code + ' — gửi mã cho bạn. Bạn cầm Trắng. Đang chờ đối thủ...');
  startRoom(code);
}

function joinRoom(codeRaw) {
  const code = (codeRaw || '').trim().toUpperCase();
  if (!code) { alert('Nhập mã phòng!'); return; }
  if (!ensureReady(() => joinRoom(code))) return;
  destroyNet();
  NET.code = code; NET.isHost = false; NET.myColor = 'b';
  netStatus('Đang vào phòng ' + code + '...');
  startRoom(code);
}

function startRoom(code) {
  const room = trystero.joinRoom(NET_CFG, code);
  NET.room = room;

  const [sendState, getState] = room.action('state');
  const [sendReset, getReset] = room.action('reset');

  getState((msg) => applyState(msg));
  getReset(() => { moveTexts = []; historyCaps = []; init(); if (NET.myColor === 'b') flipped = true; render(); });

  room.onPeerJoin(() => {
    NET.active = true;
    flipped = (NET.myColor === 'b');
    netStatus(NET.isHost ? 'Đối thủ đã vào! Bạn cầm Trắng.' : 'Đã vào phòng! Bạn cầm Đen.');
    if (NET.isHost) {
      sendState({ fen: boardToFEN(), moveTexts, historyCaps, lastMove, turn });
    }
    render();
  });

  room.onPeerLeave(() => { NET.active = false; netStatus('Đối thủ đã thoát.'); });

  // Gửi trạng thái tới mọi peer (ở 2 người là 1)
  NET._send = sendState;
  NET._sendReset = sendReset;
}

function sendState() {
  if (!NET.active || NET.applying || !NET._send) return;
  NET._send({ fen: boardToFEN(), moveTexts, historyCaps, lastMove, turn });
}

function sendReset() {
  if (!NET._sendReset) return;
  NET._sendReset({});
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
