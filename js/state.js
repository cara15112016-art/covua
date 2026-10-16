// state.js — biến dùng chung cho toàn bộ game
const PIECES = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

let board, turn, selected, legalCache, history, lastMove, enPassant, flipped, gameOver, promoPending;
let moveTexts = [], historyCaps = [];
let editMode = false, paletteSel = 'K';

function init() {
  board = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
  ].map(row => row.map(c => c ? { t: c.toLowerCase(), c: c === c.toUpperCase() ? 'w' : 'b', moved: false } : null));
  turn = 'w'; selected = null; legalCache = []; history = [];
  lastMove = null; enPassant = null; flipped = false; gameOver = false; promoPending = null;
  render();
}
