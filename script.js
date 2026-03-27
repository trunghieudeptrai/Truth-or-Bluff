const SUITS = ['♠️', '♣️', '♦️', '♥️'];
const SUIT_ICONS = {
  '♠️': 'image/Bich.svg',
  '♣️': 'image/Chuon.svg',
  '♦️': 'image/Tep.svg',
  '♥️': 'image/Co.svg'
};
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const RULES = {
  '♠️': { name: 'Sự Thật', desc: 'Số lá bài tùy ý. Người thua bị Phạt 1 Ly và phải trả lời thành thật 1 câu hỏi từ đối phương.', reqDrink: true, exactQty: 0, minQty: 0 },
  '♣️': { name: 'Hành Động', desc: 'Số lá bài tùy ý. Người thua bị Phạt 1 Ly và phải thực hiện 1 thử thách (Dare) từ đối phương.', reqDrink: true, exactQty: 0, minQty: 0 },
  '♦️': { name: 'Tàn Sát', desc: 'Số lá bài được ra là ĐÚNG 1 LÁ. Người thua bị Phạt 2 Ly và phải nhận xét thật lòng về người được chỉ định.', reqDrink: true, exactQty: 1, minQty: 0 },
  '♥️': { name: 'Rủi Ro', desc: 'Số lá bài ra TỐI THIỂU 2 LÁ. Người thua bị Phạt 2 Ly và phải chịu một hình phạt bất kỳ do cả hội biểu quyết.', reqDrink: true, exactQty: 0, minQty: 2 }
};

function getCardImage(card) {
  if (card.isJoker) {
    return card.suit === 'joker_red' ? 'image/card/Joker card red.png' : 'image/card/Joker card black.png';
  }
  const suitMap = { '♠️':'spades', '♣️':'clubs', '♦️':'diamonds', '♥️':'hearts' };
  return `image/card/${card.rank}_${suitMap[card.suit]}.png`;
}

// Application State
let isHost = false;
let myPeerId = null;
let myName = '';
let peer = null;
let connections = []; // Clients store 1 (to host). Host stores many (to clients).

// Host-Only Game Engine State
let hostState = {
  deck: [],
  players: [], // { id, name, conn, hand[], eliminated }
  status: 'lobby', // lobby, round, arena
  ruleSuit: null,
  currentPlayerIdx: 0,
  previousAction: null,
  challengeResult: null
};

// Client-Side UI View State
let clientState = {
  status: 'home'
};

let currentRoundRule = null;

let selectedHandIndices = [];
let isSpectatorViewingCards = false;

// DOM Element Map
const els = {
  screens: {
    home: document.getElementById('home-screen'),
    lobby: document.getElementById('lobby-screen'),
    round: document.getElementById('round-screen'),
    arena: document.getElementById('game-arena')
  },
  home: {
    name: document.getElementById('my-name-input'),
    btnCreate: document.getElementById('btn-create-room'),
    roomInput: document.getElementById('room-code-input'),
    btnJoin: document.getElementById('btn-join-room'),
    status: document.getElementById('connection-status')
  },
  lobby: {
    codeHost: document.getElementById('display-room-code'),
    count: document.getElementById('player-count'),
    list: document.getElementById('lobby-player-list'),
    btnStart: document.getElementById('btn-start-game'),
    waitHostMsg: document.getElementById('wait-host-msg')
  },
  round: {
    pickedName: document.getElementById('round-picked-name'),
    pickedDesc: document.getElementById('round-picked-desc'),
    btnContinue: document.getElementById('btn-round-continue'),
    waitMsg: document.getElementById('wait-round-msg')
  },
  joker: {
    targetModal: document.getElementById('joker-target-modal'),
    targetList: document.getElementById('joker-target-list'),
    btnCancelTarget: document.getElementById('btn-cancel-joker'),
    viewModal: document.getElementById('joker-view-modal'),
    targetName: document.getElementById('joker-target-name'),
    targetCards: document.getElementById('joker-target-cards'),
    btnCloseView: document.getElementById('btn-close-joker-view')
  },
  arena: {
    ruleIcon: document.getElementById('arena-rule-icon'),
    ruleName: document.getElementById('arena-rule-name'),
    ruleDesc: document.getElementById('arena-rule-desc'),
    playerName: document.getElementById('arena-player-name'),
    competitors: document.getElementById('competitors-list'),
    
    prevBox: document.getElementById('previous-action'),
    prevPlayer: document.getElementById('prev-player-name'),
    prevQty: document.getElementById('prev-qty'),
    prevValue: document.getElementById('prev-value'),
    prevRuleName: document.getElementById('prev-rule-name'),
    reactBtns: document.getElementById('reaction-buttons'),
    btnDoubt: document.getElementById('btn-doubt'),
    btnPass: document.getElementById('btn-pass'),
    
    handCards: document.getElementById('hand-cards'),
    handBox: document.getElementById('player-hand-container'),
    elimMsg: document.getElementById('eliminated-msg'),
    
    playForm: document.getElementById('play-action-form'),
    selectedQty: document.getElementById('selected-qty'),
    autoClaimText: document.getElementById('auto-claim-text'),
    btnPlay: document.getElementById('btn-play-cards')
  },
  modal: {
    container: document.getElementById('challenge-modal'),
    contentBox: document.getElementById('modal-alert-content'),
    alertPlayerName: document.getElementById('alert-player-name'),
    title: document.getElementById('challenge-verdict-title'),
    revealedCards: document.getElementById('revealed-cards'),
    verdictSub: document.getElementById('challenge-sub-verdict'),
    punishment: document.getElementById('punishment-text'),
    hostActions: document.getElementById('host-modal-actions'),
    btnNextRound: document.getElementById('btn-next-round'),
    clientWait: document.getElementById('client-wait-actions')
  }
};
els.globalQuit = document.getElementById('btn-quit-global');

function switchScreen(id) {
  Object.values(els.screens).forEach(s => s.classList.remove('active'));
  els.screens[id].classList.add('active');
  if (els.globalQuit) {
    if (id === 'home') els.globalQuit.classList.add('hidden');
    else els.globalQuit.classList.remove('hidden');
  }
}

// ============== PEERJS NETWORKING ==============
function initApp() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) els.home.roomInput.value = roomParam;

  els.home.btnCreate.addEventListener('click', () => setupPeer(true));
  els.home.btnJoin.addEventListener('click', () => setupPeer(false));
  els.globalQuit.addEventListener('click', () => {
    if (confirm('Bạn có chắc chắn muốn thoát khỏi phòng chơi này?')) {
      location.reload();
    }
  });

  // Host UI Listeners
  els.lobby.btnStart.addEventListener('click', () => hostStartGame());
  els.round.btnContinue.addEventListener('click', () => { hostState.status = 'arena'; broadcastState(); });
  els.modal.btnNextRound.addEventListener('click', () => hostResolveChallenge());

  // Action UI Listeners (Send signals to Host)
  els.arena.btnPlay.addEventListener('click', onPlayClick);
  els.arena.btnDoubt.addEventListener('click', () => sendAction({ type: 'doubt' }));
  els.arena.btnPass.addEventListener('click', () => sendAction({ type: 'pass' }));
  document.getElementById('btn-view-cards').addEventListener('click', () => {
    isSpectatorViewingCards = !isSpectatorViewingCards;
    renderClientUI(clientState);
  });
  
  // Rules Modal Actions
  document.getElementById('btn-show-rules').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.add('active');
  });
  document.getElementById('btn-close-rules').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.remove('active');
  });

  els.joker.btnCancelTarget.addEventListener('click', () => els.joker.targetModal.classList.remove('active'));
  els.joker.btnCloseView.addEventListener('click', () => els.joker.viewModal.classList.remove('active'));
}

async function setupPeer(creatingHost) {
  myName = els.home.name.value.trim() || 'Người Ẩn Danh';
  isHost = creatingHost;
  const roomCode = els.home.roomInput.value.trim().toLowerCase();

  if (!isHost && !roomCode) {
    els.home.status.textContent = 'Vui lòng nhập Mã Phòng!';
    return;
  }

  els.home.status.textContent = 'Đang lấy dữ liệu server tốc độ cao...';
  
  let iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ];

  try {
    const response = await fetch("https://truthorbluff.metered.live/api/v1/turn/credentials?apiKey=2a47af70a75a5141d75d1239e574c5ecc4ae");
    const meteredIceServers = await response.json();
    iceServers = iceServers.concat(meteredIceServers);
  } catch (err) {
    console.error("Lỗi lấy TURN server, tiếp tục với STUN dự phòng:", err);
  }

  els.home.status.textContent = 'Đang kết nối server...';
  
  const peerConfig = {
    config: {
      iceServers: iceServers
    }
  };
  if (isHost) {
    peer = new Peer(Math.random().toString(36).substring(2, 7), peerConfig);
  } else {
    peer = new Peer(peerConfig);
  }

  peer.on('open', (id) => {
    myPeerId = id;
    if (isHost) {
      window.history.pushState({}, '', '?room=' + myPeerId);
      els.home.status.textContent = 'Phòng đã tạo! Đang khởi tạo...';
      hostState.players.push({ id: myPeerId, name: myName, conn: null, hand: [], eliminated: false });
      
      els.lobby.codeHost.textContent = myPeerId;
      els.lobby.btnStart.classList.remove('hidden');
      els.lobby.waitHostMsg.classList.add('hidden');
      switchScreen('lobby');
      updateLobbyUI();

      // Listen for clients
      peer.on('connection', (conn) => {
        setupHostConnection(conn);
      });
    } else {
      els.home.status.textContent = 'Đang ghép phòng...';
      const conn = peer.connect(roomCode, { metadata: { name: myName } });
      connections.push(conn);
      setupClientConnection(conn);
    }
  });

  peer.on('error', (err) => {
    els.home.status.textContent = 'Lỗi kết nối: ' + err.type;
  });
}

// --- HOST NETWORKING LOGIC ---
function setupHostConnection(conn) {
  conn.on('open', () => {
    // Check limit
    if (hostState.players.length >= 10 || hostState.status !== 'lobby') {
      conn.send({ type: 'error', msg: 'Phòng đã đầy hoặc đang chơi!' });
      setTimeout(() => conn.close(), 1000);
      return;
    }

    connections.push(conn);
    const pName = conn.metadata?.name || 'Vô Danh';
    hostState.players.push({ id: conn.peer, name: pName, conn: conn, hand: [], eliminated: false });
    
    updateLobbyUI();
    broadcastState();

    conn.on('data', (data) => {
      handleClientAction(conn.peer, data);
    });

    conn.on('close', () => {
      handleClientDisconnect(conn.peer);
    });
  });
}

function handleClientDisconnect(peerId) {
  connections = connections.filter(c => c.peer !== peerId);
  if (hostState.status === 'lobby') {
    hostState.players = hostState.players.filter(p => p.id !== peerId);
    updateLobbyUI();
    broadcastState();
  } else {
    // If playing, mark them eliminated
    const p = hostState.players.find(x => x.id === peerId);
    if(p) {
      p.eliminated = true;
      if (hostState.players[hostState.currentPlayerIdx]?.id === peerId) {
        hostNextTurn();
      }
      broadcastState();
    }
  }
}

function updateLobbyUI() {
  els.lobby.list.innerHTML = '';
  hostState.players.forEach(p => {
    els.lobby.list.innerHTML += `<li><span>${p.name} ${p.id===myPeerId?'(Host)':''}</span></li>`;
  });
  els.lobby.count.textContent = hostState.players.length;
}

// --- SANITIZE & BROADCAST (HOST) ---
function broadcastState() {
  // Extract public info everyone sees
  const publicPlayers = hostState.players.map(p => ({
    id: p.id,
    name: p.name,
    cardCount: p.hand.length,
    eliminated: p.eliminated
  }));

  const rule = hostState.ruleSuit ? RULES[hostState.ruleSuit] : null;
  const currentP = hostState.players[hostState.currentPlayerIdx];
  const isBlackJokerActive = hostState.players.some(p => !p.eliminated && p.hand.some(c => c.suit === 'joker_black'));

  hostState.players.forEach(p => {
    const statePacket = {
      status: hostState.status,
      players: publicPlayers,
      myHand: p.hand, // only send this player's hand
      ruleSuit: hostState.ruleSuit,
      ruleObj: rule,
      currentPlayerId: currentP ? currentP.id : null,
      previousAction: hostState.previousAction ? {
        id: hostState.players[hostState.previousAction.idx].id,
        qty: hostState.previousAction.cardsPlayed.length,
        claimValue: hostState.previousAction.claimValue
      } : null,
      challengeResult: hostState.challengeResult,
      isBlackJokerActive: isBlackJokerActive
    };

    if (p.id === myPeerId) {
      renderClientUI(statePacket);
    } else if (p.conn && p.conn.open) {
      p.conn.send({ type: 'state', state: statePacket });
    }
  });
}

// --- CLIENT NETWORKING LOGIC ---
function setupClientConnection(conn) {
  conn.on('open', () => {
    els.home.status.textContent = 'Đã vào phòng!';
    els.lobby.codeHost.textContent = conn.peer;
    els.lobby.btnStart.classList.add('hidden');
    els.lobby.waitHostMsg.classList.remove('hidden');
    switchScreen('lobby');
  });

  conn.on('data', (data) => {
    if (data.type === 'state') {
      renderClientUI(data.state);
    } else if (data.type === 'error') {
      alert(data.msg);
      location.reload();
    } else if (data.type === 'joker_vision_response') {
      clientHandleData(data);
    } else if (data.type === 'system_toast') {
      alert(data.msg);
    }
  });

  conn.on('close', () => {
    alert('Chủ phòng đã ngắt kết nối!');
    location.reload();
  });
}

function sendAction(actionData) {
  if (isHost) {
    handleClientAction(myPeerId, actionData);
  } else {
    if (connections[0] && connections[0].open) {
      connections[0].send(actionData);
    }
  }
}

// ============== HOST GAME ENGINE ==============

function buildDeck() {
  hostState.deck = [];
  SUITS.forEach(suit => {
    RANKS.forEach(rank => {
      hostState.deck.push({ suit, rank, isWild: ['J', 'Q', 'K'].includes(rank) });
    });
  });
  // Add 2 Jokers which act as ultimate wildcards
  hostState.deck.push({ suit: 'joker_red', rank: 'Joker', isWild: true, isJoker: true });
  hostState.deck.push({ suit: 'joker_black', rank: 'Joker', isWild: true, isJoker: true });
  
  // Shuffle
  for (let i = hostState.deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [hostState.deck[i], hostState.deck[j]] = [hostState.deck[j], hostState.deck[i]];
  }
}

function hostStartGame() {
  if (hostState.players.length < 2) return alert('Cần ít nhất 2 người chơi!');
  buildDeck();
  
  hostState.players.forEach(p => { p.hand = []; p.eliminated = false; });
  for (let i = 0; i < 5; i++) {
    hostState.players.forEach(p => p.hand.push(hostState.deck.pop()));
  }

  hostState.currentPlayerIdx = 0;
  hostStartNewRound();
}

function hostStartNewRound() {
  hostState.previousAction = null;
  hostState.challengeResult = null;

  const active = hostState.players.filter(p => !p.eliminated);
  if (active.length <= 1) {
    alert(`Ván đấu kết thúc!\nNgười Thua Cuộc (Chót) gọi tên: ${active[0]?.name || 'Không có ai'}.\nTrò chơi sẽ tự động xào bài bắt đầu ván mới cho tất cả mọi người!`);
    hostStartGame();
    return;
  }

  // Tự động random chất mà không phụ thuộc vào nọc bài
  const randomSuit = SUITS[Math.floor(Math.random() * SUITS.length)];
  hostState.ruleSuit = randomSuit;
  hostState.status = 'round';
  
  // Re-deal 5 fresh cards to all active players for the new round
  buildDeck();
  hostState.players.forEach(p => {
    if (!p.eliminated) {
      p.hand = [];
      for(let i=0; i<5 && hostState.deck.length > 0; i++) {
        p.hand.push(hostState.deck.pop());
      }
    }
  });

  broadcastState();
}

function hostNextTurn() {
  let limit = 0;
  do {
    hostState.currentPlayerIdx = (hostState.currentPlayerIdx + 1) % hostState.players.length;
    limit++;
  } while (hostState.players[hostState.currentPlayerIdx].eliminated && limit < 15);
}

function handleClientAction(clientId, data) {
  // Verify it's their turn unless it's an asynchronous thing
  const cp = hostState.players[hostState.currentPlayerIdx];
  if (cp.id !== clientId) return; // Ignore spoofing

  if (data.type === 'play_cards') {
    // Extracted cards array of indices
    const toRemove = [...data.cardIndices].sort((a,b) => b-a);
    const played = [];
    toRemove.forEach(idx => {
      played.push(cp.hand[idx]);
      cp.hand.splice(idx, 1);
    });

    // Check Black Joker sneaky push
    if (played.length === 2 && played.some(c => c.suit === 'joker_black')) {
      const accompanyingCard = played.find(c => c.suit !== 'joker_black');
      const opponents = hostState.players.filter(p => !p.eliminated && p.id !== cp.id);
      if (opponents.length > 0 && accompanyingCard) {
        const targetOpponent = opponents[Math.floor(Math.random() * opponents.length)];
        targetOpponent.hand.push(accompanyingCard); // Push to array
        
        if (targetOpponent.conn && targetOpponent.conn.open) {
          targetOpponent.conn.send({ type: 'system_toast', msg: '🃏 Ai đó vừa lén nhét 1 lá bài vào tay bạn!' });
        } else if (targetOpponent.id === myPeerId) {
          alert('🃏 Ai đó vừa lén nhét 1 lá bài vào tay bạn!');
        }
      }
    }

    if (data.jokerTargetId && played.length === 1 && played[0].suit === 'joker_red') {
      const targetP = hostState.players.find(p => p.id === data.jokerTargetId && !p.eliminated);
      if (targetP) {
        const responseData = {
          type: 'joker_vision_response',
          targetName: targetP.name,
          hand: targetP.hand
        };
        // Send securely ONLY to the player who played Joker Red
        if (cp.id === myPeerId) {
          clientHandleData(responseData);
        } else if (cp.conn && cp.conn.open) {
          cp.conn.send(responseData);
        }
      }
    }

    hostState.previousAction = {
      idx: hostState.currentPlayerIdx,
      cardsPlayed: played,
      claimValue: data.claimValue
    };
    
    if (cp.hand.length === 0) {
      hostNextTurn();
    } else {
      hostNextTurn();
    }
    broadcastState();
  } 
  else if (data.type === 'pass') {
    hostState.previousAction = null;
    broadcastState();
  }
  else if (data.type === 'doubt') {
    hostEvaluateChallenge(clientId);
  }
}

function hostEvaluateChallenge(challengerId) {
  const challengerIdx = hostState.currentPlayerIdx;
  const defenderIdx = hostState.previousAction.idx;
  
  const challenger = hostState.players[challengerIdx];
  const defender = hostState.players[defenderIdx];
  
  const cards = hostState.previousAction.cardsPlayed;
  const claimed = hostState.previousAction.claimValue;
  
  let isTruth = true;
  cards.forEach(c => {
    if (c.suit !== claimed && !c.isWild) isTruth = false;
  });

  const rule = RULES[hostState.ruleSuit];
  let loser, verdictTitle, verdictSub, isCorrectDoubt;
  
  const hasBlackJoker = cards.some(c => c.suit === 'joker_black');
  
  if (hasBlackJoker) {
    isTruth = false; // Always fail if Black Joker is caught
    loser = defender;
    isCorrectDoubt = true;
    verdictTitle = "BẮT QUẢ TANG!";
    verdictSub = `<span style="color: #4ade80;">${challenger.name}</span> đã phát hiện <span style="color: #ff4757;">${defender.name} đánh lén Joker Đen!</span>`;
  } else if (isTruth) {
    loser = challenger;
    isCorrectDoubt = false;
    verdictTitle = "NGHI NGỜ SAI!";
    verdictSub = `<span style="color: #ff4757;">${challenger.name}</span> nghi ngờ OAN cho <span style="color: #4ade80;">${defender.name} (Nói Thật)</span>!`;
  } else {
    loser = defender;
    isCorrectDoubt = true;
    verdictTitle = "NGHI NGỜ ĐÚNG!";
    verdictSub = `<span style="color: #4ade80;">${challenger.name}</span> đã lật tẩy <span style="color: #ff4757;">${defender.name} (Nói Dối)</span>!`;
  }

  let punishmentHtml = `<strong>Phạt ${loser.name}:</strong><br/><span style="color: #fff;">${rule.desc}</span>`;
  if (hasBlackJoker) {
    punishmentHtml = `<strong>Hình phạt đặc biệt cho Joker Đen:</strong><br/><span style="color: #ff4757; font-size: 1.3rem;">BỊ PHẠT ĐÚNG 3 LY!</span>`;
  }

  const winner = (loser.id === challenger.id) ? defender : challenger;

  hostState.challengeResult = {
    loserId: loser.id,
    winnerId: winner.id,
    defenderName: defender.name,
    challengerName: challenger.name,
    cards: cards,
    verdictTitle: verdictTitle,
    verdictSub: verdictSub,
    isCorrectDoubt: isCorrectDoubt,
    punishmentHtml: punishmentHtml
  };

  broadcastState();
}

function hostResolveChallenge() {
  if (!hostState.challengeResult) return;
  hostState.challengeResult = null;
  hostNextTurn(); // Advance properly
  hostStartNewRound();
}


// ============== CLIENT UI RENDERER ==============

function renderClientUI(state) {
  const { status, players, myHand, ruleSuit, ruleObj, currentPlayerId, previousAction, challengeResult, isBlackJokerActive } = state;
  clientState = state; // Save local cache

  // Ensure modal closes correctly when a new action or round starts
  if (!challengeResult) {
    els.modal.container.classList.remove('active');
    selectedHandIndices = [];
  }

  // 1. LOBBY STATE
  if (status === 'lobby') {
    els.lobby.list.innerHTML = '';
    players.forEach(p => {
      els.lobby.list.innerHTML += `<li><span>${p.name} ${p.id===myPeerId?'(Bạn)':''}</span></li>`;
    });
    els.lobby.count.textContent = players.length;
    // Host buttons handled in PeerJS setup, just insure screen is active
    if (document.querySelector('.screen.active') !== els.screens.lobby) switchScreen('lobby');
    return;
  }

  // 2. ROUND STATE
  if (status === 'round') {
    switchScreen('round');

    const PNG_ICONS = {
      '♠️': 'image/su that.png',
      '♣️': 'image/hanh dong.png',
      '♦️': 'image/tan sat.png',
      '♥️': 'image/rui ro.png'
    };

    if (currentRoundRule !== ruleSuit) {
      currentRoundRule = ruleSuit;
      
      els.round.btnContinue.classList.add('hidden');
      els.round.waitMsg.classList.add('hidden');
      els.round.pickedName.classList.add('hidden');
      els.round.pickedDesc.classList.add('hidden');
      
      playRouletteAnimation(ruleSuit, PNG_ICONS, () => {
         els.round.pickedName.innerHTML = `<img src="${PNG_ICONS[ruleSuit]}" style="height: 0.85em; width: auto; margin-right: 15px; vertical-align: middle; position: relative; bottom: 4px;" alt="suit icon" />${ruleObj.name}`;
         els.round.pickedDesc.textContent = ruleObj.desc;
         
         els.round.pickedName.className = 'neon-title-arena';
         if (ruleSuit === '♠️') els.round.pickedName.classList.add('theme-blue');
         else if (ruleSuit === '♣️') els.round.pickedName.classList.add('theme-green');
         else if (ruleSuit === '♦️') els.round.pickedName.classList.add('theme-red');
         else if (ruleSuit === '♥️') els.round.pickedName.classList.add('theme-purple');
         
         els.round.pickedName.classList.remove('hidden');
         els.round.pickedDesc.classList.remove('hidden');
         
         if (isHost) els.round.btnContinue.classList.remove('hidden');
         else els.round.waitMsg.classList.remove('hidden');
      });
    }
    return;
  } else {
    currentRoundRule = null;
  }

  // 3. ARENA STATE
  if (status === 'arena') {
    switchScreen('arena');

    // Rule Info
    // Rule Info
    const PNG_ICONS = {
      '♠️': 'image/su that.png',
      '♣️': 'image/hanh dong.png',
      '♦️': 'image/tan sat.png',
      '♥️': 'image/rui ro.png'
    };
    els.arena.ruleIcon.innerHTML = `<img src="${SUIT_ICONS[ruleSuit]}" class="suit-img-small" />`;
    els.arena.ruleName.innerHTML = `<img src="${PNG_ICONS[ruleSuit]}" style="height: 0.85em; width: auto; margin-right: 15px; vertical-align: middle; position: relative; bottom: 4px;" alt="suit icon" />${ruleObj.name}`;
    els.arena.ruleDesc.textContent = ruleObj.desc;
    
    // Set theme color
    els.arena.ruleName.className = 'neon-title-arena';
    document.body.className = '';
    if (ruleSuit === '♠️') { els.arena.ruleName.classList.add('theme-blue'); document.body.className = 'theme-blue'; }
    else if (ruleSuit === '♣️') { els.arena.ruleName.classList.add('theme-green'); document.body.className = 'theme-green'; }
    else if (ruleSuit === '♦️') { els.arena.ruleName.classList.add('theme-red'); document.body.className = 'theme-red'; }
    else if (ruleSuit === '♥️') { els.arena.ruleName.classList.add('theme-purple'); document.body.className = 'theme-purple'; }

    // Current Player
    const activeP = players.find(p => p.id === currentPlayerId);
    const isMyTurn = (currentPlayerId === myPeerId);
    if (isMyTurn) isSpectatorViewingCards = false;
    
    let displayName = activeP ? activeP.name : '---';
    if (isBlackJokerActive && activeP) displayName = '?????';
    if (isMyTurn) displayName += ' (BẠN)';
    
    els.arena.playerName.textContent = displayName;

    // Render Competitors
    els.arena.competitors.innerHTML = '';
    let me = null;
    players.forEach(p => {
      if (p.id === myPeerId) me = p;
      const c = document.createElement('div');
      
      const isActiveTurn = p.id === currentPlayerId;
      const highlightClass = isActiveTurn && !isBlackJokerActive ? 'active-turn' : '';
      
      let badgeName = p.name;
      if (isBlackJokerActive) badgeName = '?????';
      if (p.id === myPeerId) badgeName += ' (BẠN)';
      
      c.className = `competitor-badge ${p.eliminated ? 'eliminated' : ''} ${highlightClass}`;
      c.innerHTML = `<span>${badgeName}</span> <span class="card-count">${p.cardCount} lá</span>`;
      els.arena.competitors.appendChild(c);
    });

    // Render My Hand
    els.arena.handCards.innerHTML = '';
    if (me && me.eliminated) {
      els.arena.elimMsg.classList.remove('hidden');
      els.arena.handCards.classList.add('hidden');
    } else {
      els.arena.elimMsg.classList.add('hidden');
      els.arena.handCards.classList.remove('hidden');
      myHand.forEach((card, i) => {
        const d = document.createElement('div');
        const isRed = ['♦️','♥️', 'joker_red'].includes(card.suit);
        
        if (!isMyTurn && !isSpectatorViewingCards) {
          let themeCard = '';
          if (ruleSuit === '♠️') themeCard = 'card-blue';
          else if (ruleSuit === '♣️') themeCard = 'card-green';
          else if (ruleSuit === '♦️') themeCard = 'card-red';
          else if (ruleSuit === '♥️') themeCard = 'card-purple';
          d.className = `playing-card card-back ${themeCard}`;
          d.innerHTML = ``;
        } else {
          d.className = `playing-card ${isRed ? 'red' : 'black'} ${selectedHandIndices.includes(i) ? 'selected' : ''}`;
          d.style.backgroundImage = `url('${getCardImage(card)}')`;
          d.style.backgroundSize = 'cover';
          d.style.backgroundPosition = 'center';
          d.innerHTML = ``;
        }
        // Can only click if it's my turn
        d.onclick = () => {
          if (!isMyTurn) return; 
          toggleSelectCard(i, d);
        };
        els.arena.handCards.appendChild(d);
      });
    }

    // Previous Action & Reaction Box
    const suitNamesMap = { '♠️':'BÍCH', '♣️':'CHUỒN', '♦️':'RÔ', '♥️':'CƠ' };
    if (previousAction) {
      els.arena.prevBox.classList.remove('hidden');
      const prevP = players.find(p => p.id === previousAction.id);
      let prevName = prevP ? prevP.name.toUpperCase() : 'AI ĐÓ';
      if (isBlackJokerActive) prevName = '?????';
      
      const qty = previousAction.qty;
      
      els.arena.prevPlayer.textContent = prevName;
      els.arena.prevQty.textContent = qty;
      els.arena.prevValue.innerHTML = `<img src="${SUIT_ICONS[previousAction.claimValue]}" class="suit-img-small" style="vertical-align: middle;" />`;
      els.arena.prevRuleName.textContent = ruleObj.name;
      
      document.getElementById('arena-current-claim').innerHTML = `<span style="line-height:1.2;">${qty} LÁ ${suitNamesMap[previousAction.claimValue]}</span>`;
      els.arena.btnDoubt.disabled = false;
      els.arena.btnDoubt.style.opacity = '1';
    } else {
      els.arena.prevBox.classList.add('hidden');
      
      document.getElementById('arena-current-claim').textContent = 'CHƯA ĐÁNH';
      els.arena.btnDoubt.disabled = true;
      els.arena.btnDoubt.style.opacity = '0.5';
    }

    // Toggle correct button wrapper based on whether it is my turn or not
    if (isMyTurn && !me.eliminated) {
      document.getElementById('active-player-actions').classList.remove('hidden');
      document.getElementById('spectator-actions').classList.add('hidden');
      validatePlayButton();
    } else {
      document.getElementById('active-player-actions').classList.add('hidden');
      document.getElementById('spectator-actions').classList.remove('hidden');
    }

    // Modal Challenge handling
    if (challengeResult) {
      els.modal.revealedCards.innerHTML = '';
      challengeResult.cards.forEach(c => {
        const isRed = ['♦️','♥️', 'joker_red'].includes(c.suit);
        els.modal.revealedCards.innerHTML += `
        <div class="playing-card ${isRed?'red':''}" style="background-image: url('${getCardImage(c)}'); background-size: cover; background-position: center;">
        </div>`;
      });
      
      // Challenge Status
      els.modal.container.classList.add('active');
      
      const isLoser = challengeResult.loserId === myPeerId;
      const isWinner = challengeResult.winnerId === myPeerId;
      
      // Strip any aggressive inline styles from previous iterations
      if (els.modal.contentBox) els.modal.contentBox.style.borderColor = '';
      if (els.modal.title) {
        els.modal.title.style.color = '';
        els.modal.title.style.borderBottomColor = '';
        els.modal.title.style.textShadow = '';
      }
      const tagEl = els.modal.alertPlayerName.parentElement;
      if (tagEl) {
        tagEl.style.borderColor = '';
        tagEl.style.color = '';
      }
      if (els.modal.btnNextRound) {
        els.modal.btnNextRound.style.backgroundColor = '';
        els.modal.btnNextRound.style.color = '';
        els.modal.btnNextRound.style.boxShadow = '';
      }
      
      // Assign native CSS themes
      els.modal.contentBox.className = 'modal-alert-content'; // Default Green Native
      if (isLoser) {
        els.modal.contentBox.classList.add('theme-red');
      } else if (isWinner) {
        // Keeps default green
      } else {
        els.modal.contentBox.classList.add('theme-blue');
      }

      els.modal.alertPlayerName.textContent = challengeResult.challengerName.toUpperCase();
      els.modal.title.textContent = challengeResult.verdictTitle;
      els.modal.verdictSub.innerHTML = challengeResult.verdictSub;
      
      els.modal.punishment.innerHTML = challengeResult.punishmentHtml;

      if (isHost) {
        els.modal.hostActions.classList.remove('hidden');
        els.modal.clientWait.classList.add('hidden');
        els.modal.btnNextRound.classList.remove('hidden');
      } else {
        els.modal.hostActions.classList.add('hidden');
        els.modal.clientWait.classList.remove('hidden');
      }

      els.modal.container.classList.add('active');
    } else {
      els.modal.container.classList.remove('active');
      selectedHandIndices = []; // Clear local selections when new round/turn starts safely
    }
  }
}

// UI Interaction Helpers
function toggleSelectCard(idx, el) {
  const pos = selectedHandIndices.indexOf(idx);
  if (pos > -1) {
    selectedHandIndices.splice(pos, 1);
    el.classList.remove('selected');
  } else {
    selectedHandIndices.push(idx);
    el.classList.add('selected');
  }
  els.arena.selectedQty.textContent = selectedHandIndices.length;
  if (clientState.ruleObj) {
    els.arena.autoClaimText.innerHTML = `${selectedHandIndices.length} lá <img src="${SUIT_ICONS[clientState.ruleSuit]}" class="suit-img-small" style="vertical-align: middle;" />`;
  }
  validatePlayButton();
}

function validatePlayButton() {
  const rule = clientState.ruleObj;
  if(!rule) return;
  let isValid = selectedHandIndices.length > 0;
  
  if (rule.exactQty > 0 && selectedHandIndices.length !== rule.exactQty) isValid = false;
  if (rule.minQty > 0 && selectedHandIndices.length < rule.minQty) isValid = false;

  els.arena.btnPlay.disabled = !isValid;
  if(!isValid && selectedHandIndices.length > 0) {
    els.arena.btnPlay.innerHTML = rule.exactQty ? `Vui lòng chọn ĐÚNG ${rule.exactQty} lá` : `Chọn TỐI THIỂU ${rule.minQty} lá`;
  } else {
    els.arena.btnPlay.innerHTML = 'RA BÀI <img src="image/tabler_play-card-filled.svg" alt="card" style="width: 18px; vertical-align: middle; margin-left: 5px; opacity: ' + (isValid ? '1' : '0.5') + '">';
  }
}

function onPlayClick() {
  if (selectedHandIndices.length === 0) return;
  const selectedCards = selectedHandIndices.map(i => clientState.myHand[i]);
  
  // Joker Constraints Validation
  const hasRedJoker = selectedCards.some(c => c.suit === 'joker_red');
  const hasBlackJoker = selectedCards.some(c => c.suit === 'joker_black');
  
  if (hasRedJoker) {
    if (selectedCards.length > 1) {
      alert("Joker Đỏ chỉ được hạ duy nhất 1 lá, KHÔNG kẹp chung với bài khác!");
      return; 
    }
    // Cannot be the last card check
    if (clientState.myHand.length === 1) {
      alert("Joker Đỏ KHÔNG ĐƯỢC dùng làm lá bài cuối cùng để về đích!");
      return;
    }
    openJokerTargetModal();
    return;
  }
  
  if (hasBlackJoker) {
    if (selectedCards.length !== 2) {
      alert("Joker Đen chỉ có thể dùng kèm với ĐÚNG 1 lá bài khác!");
      return; 
    }
  }

  sendPlayAction(null);
}

function sendPlayAction(targetId) {
  const data = {
    type: 'play_cards',
    cardIndices: selectedHandIndices,
    claimValue: clientState.ruleSuit,
    jokerTargetId: targetId
  };
  sendAction(data);
  selectedHandIndices = []; // Optimistically clear
  els.joker.targetModal.classList.remove('active');
}

function openJokerTargetModal() {
  els.joker.targetList.innerHTML = '';
  // Populate all other active players
  const validTargets = clientState.players.filter(p => p.id !== myPeerId && !p.eliminated);
  if (validTargets.length === 0) {
    alert("Không còn ai để xem bài!");
    sendPlayAction(null); // Just play it without targeting
    return;
  }
  
  validTargets.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'btn-neon w-100';
    btn.textContent = clientState.isBlackJokerActive ? `????? (${p.cardCount} lá)` : p.name;
    btn.onclick = () => sendPlayAction(p.id);
    els.joker.targetList.appendChild(btn);
  });
  
  els.joker.targetModal.classList.add('active');
}

function playRouletteAnimation(targetSuit, iconsMap, callback) {
  const track = document.getElementById('roulette-track');
  track.innerHTML = '';
  track.style.transition = 'none';
  
  const suits = ['♠️','♣️','♦️','♥️'];
  const NUM_GEMS = 25;
  const TARGET_IDX = 20;
  
  let gemsHtml = '';
  for(let i = 0; i < NUM_GEMS; i++) {
    let suit = suits[Math.floor(Math.random() * suits.length)];
    if (i === TARGET_IDX) suit = targetSuit; 
    
    gemsHtml += `<div class="gem-wrapper" id="gem-${i}"><img src="${iconsMap[suit]}" class="gem-icon" /></div>`;
  }
  track.innerHTML = gemsHtml;
  
  const ITEM_SIZE = 140; // 120 width + 20 gap
  track.style.transform = `translateX(-60px)`;
  track.offsetHeight; // force reflow
  
  track.style.transition = 'transform 3.5s cubic-bezier(0.15, 0.85, 0.1, 1)';
  const targetOffset = -(TARGET_IDX * ITEM_SIZE + 60);
  track.style.transform = `translateX(${targetOffset}px)`;
  
  setTimeout(() => {
    document.getElementById(`gem-${TARGET_IDX}`).classList.add('active');
    
    const targetImg = document.querySelector(`#gem-${TARGET_IDX} .gem-icon`);
    if (targetSuit === '♠️') targetImg.style.filter = 'drop-shadow(0 0 30px #00d2ff) brightness(1.2)';
    else if (targetSuit === '♣️') targetImg.style.filter = 'drop-shadow(0 0 30px #4ade80) brightness(1.2)';
    else if (targetSuit === '♦️') targetImg.style.filter = 'drop-shadow(0 0 30px #ff4757) brightness(1.2)';
    else if (targetSuit === '♥️') targetImg.style.filter = 'drop-shadow(0 0 30px #c56cf0) brightness(1.2)';
    
    setTimeout(callback, 500);
  }, 3500);
}

function clientHandleData(data) {
  if (data.type === 'joker_vision_response') {
    els.joker.targetName.textContent = data.targetName.toUpperCase();
    els.joker.targetCards.innerHTML = '';
    
    // Render the cards face up
    data.hand.forEach(c => {
      const isRed = ['♦️','♥️', 'joker_red'].includes(c.suit);
      els.joker.targetCards.innerHTML += `
      <div class="playing-card ${isRed?'red':''}" style="background-image: url('${getCardImage(c)}'); background-size: cover; background-position: center; width: 60px; height: 84px; display: inline-flex; margin-right: -15px;">
      </div>`;
    });
    
    els.joker.viewModal.classList.add('active');
  }
}

initApp();
