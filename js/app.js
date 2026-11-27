import { CATEGORY_CONFIG, DIFFICULTY_LABELS, getItemsForCategory, getOniRankInfo } from './data.js';
import { byId, bySelector } from './dom.js';
import { ONI_BONUS_SECONDS, ONI_PENALTY_SECONDS, ONI_TIME_LIMIT, buildOniQuestion, buildStandardCards, computeRemainingSeconds, isBonusCombo } from './game-logic.js';
import { shuffleInPlace } from './random.js';
import { createSoundFx } from './sound.js';
import { createProgressStore, safeLocalStorage } from './storage.js';
                                                             

const storage = safeLocalStorage();
const progress = createProgressStore(storage);
const SOUND_FX = createSoundFx(storage);

const state = {
    category: 'cell'            ,
    difficulty: 'easy'              ,
    score: 0,
    combo: 0,
    maxCombo: 0,
    totalQuestions: 0,
    selectedItemId: null                 ,
    currentOniStageId: null                 ,
    items: []          ,
    nextUid: 0,
    timeLeft: ONI_TIME_LIMIT,
    lastTickSecond: -1,
    oniEndTime: 0,
    isPlaying: false,
    justUnlockedOni: false,
    timerInterval: null                                         ,
    toastTimeout: null                                        ,
    returnTimeout: null                                        
};

const els = {
    homeScreen: byId('home-screen'),
    gameScreen: byId('game-screen'),
    mainArea: bySelector('.main'),
    homeDesc: byId('home-desc'),
    earnedTitleBanner: byId('earned-title-banner'),
    ruleOniItem: byId('rule-oni-item'),
    btnOni: byId                   ('btn-oni'),
    homeMuteBtn: byId                   ('home-mute-btn'),
    gameMuteBtn: byId                   ('game-mute-btn'),
    tabScore1: byId('tab-score-1'),
    tabScore2: byId('tab-score-2'),
    categoryTabs: document.querySelectorAll                   ('.category-tab'),
    modeButtons: document.querySelectorAll                   ('.mode-btn'),
    homeBtn: byId                   ('home-btn'),
    modeDisplay: byId('mode-display'),
    trayTitleText: byId('tray-title-text'),
    trayHint: byId('tray-hint'),
    progressContainer: byId('progress-container'),
    timerBadge: byId('timer-badge'),
    timerText: byId('timer-text'),
    comboBadge: byId('combo-badge'),
    scoreText: byId('score-text'),
    progressFill: byId('progress-fill'),
    boardSvg: byId               ('board-svg'),
    cardList: byId('card-list'),
    toast: byId('toast'),
    clearOverlay: byId('clear-overlay'),
    clearTitle: byId('clear-title'),
    clearSubtitle: byId('clear-subtitle'),
    clearActions: byId('clear-actions'),
    autoReturnText: byId('auto-return-text'),
    retryBtn: byId                   ('retry-btn'),
    overlayHomeBtn: byId                   ('overlay-home-btn')
};

function syncMute()       {
    const m = SOUND_FX.isMuted();
    els.homeMuteBtn.textContent = m ? '🔇 音OFF' : '🔊 音ON';
    els.gameMuteBtn.textContent = m ? '🔇' : '🔊';
}

function init()       {
    els.categoryTabs.forEach((tab) => tab.addEventListener('click', () => {
        SOUND_FX.playTap();
        const cat = tab.dataset['category']            ;
        setCategory(cat);
    }));
    els.modeButtons.forEach((btn) => btn.addEventListener('click', () => {
        SOUND_FX.playTap();
        startGame(btn.dataset['difficulty']              );
    }));
    els.homeBtn.addEventListener('click', () => { SOUND_FX.playTap(); resetToHome(); });
    els.overlayHomeBtn.addEventListener('click', () => { SOUND_FX.playTap(); resetToHome(); });
    els.retryBtn.addEventListener('click', () => { SOUND_FX.playTap(); els.clearOverlay.classList.remove('active'); startGame(state.difficulty); });
    const mute = () => { SOUND_FX.toggleMute(); syncMute(); };
    els.homeMuteBtn.addEventListener('click', mute);
    els.gameMuteBtn.addEventListener('click', mute);
    syncMute();

    els.boardSvg.addEventListener('click', (e) => {
        if (!state.isPlaying || state.difficulty === 'oni' || !state.selectedItemId) return;
        const node = (e.target                  )?.closest             ('.stage-node.interactive-target');
        if (node) attemptPlace(node.dataset['stage'] ?? '');
    });
    els.boardSvg.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && state.isPlaying && state.difficulty !== 'oni') {
            const node = (e.target                  )?.closest             ('.stage-node.interactive-target');
            if (node) { e.preventDefault(); attemptPlace(node.dataset['stage'] ?? ''); }
        }
    });
    document.addEventListener('keydown', (e) => {
        if (!els.gameScreen.classList.contains('active') || !state.isPlaying) return;
        if (state.difficulty === 'oni' && /^[1-9]$/.test(e.key)) {
            const t = els.cardList.querySelectorAll             ('.bio-card')[Number(e.key) - 1];
            if (t) { e.preventDefault(); t.click(); }
        } else if (e.key === 'Escape' && state.selectedItemId) {
            state.selectedItemId = null; renderCards();
        }
    });
    setCategory('cell');
    updateTabScores();
}

function updateTabScores()       {
    [['cell', els.tabScore1], ['dna', els.tabScore2]].forEach(([c, el]) => {
        const s = progress.getOniBest(c            );
        if (s !== null) { (el               ).textContent = `👹 ${s}問`; (el               ).hidden = false; }
        else (el               ).hidden = true;
    });
    const saved = progress.getOniBest(state.category);
    if (saved === null) { els.earnedTitleBanner.hidden = true; return; }
    const r = getOniRankInfo(saved);
    els.earnedTitleBanner.className = `earned-title-banner ${r.className}`;
    els.earnedTitleBanner.textContent = `称号：${r.icon} ${r.title}`;
    els.earnedTitleBanner.hidden = false;
}

function setCategory(cat          )       {
    state.category = cat;
    els.categoryTabs.forEach((tab) => {
        const a = tab.dataset['category'] === cat;
        tab.classList.toggle('active', a);
        tab.setAttribute('aria-selected', String(a));
    });
    els.homeDesc.textContent = CATEGORY_CONFIG[cat].description;
    const unlocked = progress.isOniUnlocked(cat);
    els.ruleOniItem.hidden = !unlocked;
    els.btnOni.hidden = !unlocked;
    updateTabScores();
}

function renderBoardBackdropSvg(cat          )         {
    if (cat === 'cell') {
        return `
        <!-- Top: 分解能の限界スケール (x=16, y=10, w=668, h=162) -->
        <g transform="translate(16, 10)">
            <rect width="668" height="162" rx="16" fill="#F0FDFA" stroke="#99F6E4" stroke-width="2" />
            <text x="16" y="22" font-size="13" font-weight="900" fill="#0D9488">分解能の限界スケール（大きい → 小さい）</text>
            <line x1="54" y1="48" x2="614" y2="48" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/>
            <path d="M604 43 L614 48 L604 53" fill="none" stroke="#0D9488" stroke-width="2" stroke-linecap="round"/>
            <text x="40" y="44" text-anchor="middle" font-size="10" font-weight="800" fill="#0F766E">大きい</text>
            <text x="628" y="44" text-anchor="middle" font-size="10" font-weight="800" fill="#0F766E">小さい</text>
            <circle cx="109" cy="48" r="5" fill="#0D9488"/>
            <line x1="109" y1="53" x2="109" y2="78" stroke="#0D9488" stroke-width="1.5" stroke-dasharray="3 3"/>
            <circle cx="334" cy="48" r="5" fill="#0D9488"/>
            <line x1="334" y1="53" x2="334" y2="78" stroke="#0D9488" stroke-width="1.5" stroke-dasharray="3 3"/>
            <circle cx="559" cy="48" r="5" fill="#0D9488"/>
            <line x1="559" y1="53" x2="559" y2="78" stroke="#0D9488" stroke-width="1.5" stroke-dasharray="3 3"/>
        </g>
        <!-- Middle: 原核生物 vs 真核生物 (x=16, y=182, w=668, h=168) -->
        <g transform="translate(16, 182)">
            <rect width="668" height="168" rx="16" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2" />
            <text x="16" y="22" font-size="13" font-weight="900" fill="#334155">原核生物 vs 真核生物（細胞のつくり）</text>
            <!-- Left: E. coli schematic -->
            <rect x="20" y="53" width="90" height="80" rx="16" fill="#E2E8F0" stroke="#94A3B8" stroke-width="2"/>
            <circle cx="65" cy="93" r="18" fill="none" stroke="#0F172A" stroke-width="2" stroke-dasharray="4 3"/>
            <text x="65" y="152" text-anchor="middle" font-size="10" font-weight="700" fill="#334155">核なし・環状DNA</text>
            <path d="M114 93 L128 93" stroke="#475569" stroke-width="2" marker-end="url(#arrow)"/>
            <!-- Right: Eukaryote schematic -->
            <rect x="352" y="53" width="90" height="80" rx="16" fill="#FEF3C7" stroke="#FCD34D" stroke-width="2"/>
            <circle cx="397" cy="93" r="20" fill="#FDE68A" stroke="#D97706" stroke-width="2"/>
            <text x="397" y="97" text-anchor="middle" font-size="10" font-weight="800" fill="#92400E">核</text>
            <text x="397" y="152" text-anchor="middle" font-size="10" font-weight="700" fill="#92400E">核あり・膜系</text>
            <path d="M446 93 L460 93" stroke="#475569" stroke-width="2" marker-end="url(#arrow)"/>
        </g>
        <!-- Bottom: 酵素の特徴と代表酵素 (x=16, y=360, w=668, h=170) -->
        <g transform="translate(16, 360)">
            <rect width="668" height="170" rx="16" fill="#FDF4FF" stroke="#F0ABFC" stroke-width="2" />
            <text x="16" y="22" font-size="13" font-weight="900" fill="#86198F">酵素の特徴と代表酵素（化学反応の触媒）</text>
            <text x="109" y="56" text-anchor="middle" font-size="11" font-weight="700" fill="#A21CAF">特定の基質にのみ働く性質</text>
            <text x="334" y="56" text-anchor="middle" font-size="11" font-weight="700" fill="#A21CAF">過酸化水素を分解する酵素</text>
            <text x="559" y="56" text-anchor="middle" font-size="11" font-weight="700" fill="#A21CAF">ATPでホタルを光らせる酵素</text>
        </g>`;
    } else {
        return `
        <!-- Top: シャルガフの法則とDNA塩基割合表 (x=16, y=10, w=668, h=175) -->
        <g transform="translate(16, 10)">
            <rect width="668" height="175" rx="16" fill="#FEF3C7" stroke="#FDE68A" stroke-width="2" />
            <text x="16" y="22" font-size="13" font-weight="900" fill="#B45309">シャルガフの法則とDNA塩基割合表</text>
            <g transform="translate(229, 34)">
                <rect x="0" y="0" width="210" height="126" rx="8" fill="#FFFBEB" stroke="#FCD34D" stroke-width="1.5"/>
                <line x1="0" y1="30" x2="210" y2="30" stroke="#FCD34D" stroke-width="1"/>
                <line x1="0" y1="62" x2="210" y2="62" stroke="#FCD34D" stroke-width="1"/>
                <line x1="0" y1="94" x2="210" y2="94" stroke="#FCD34D" stroke-width="1"/>
                <line x1="50" y1="0" x2="50" y2="126" stroke="#FCD34D" stroke-width="1"/>
                <line x1="90" y1="0" x2="90" y2="126" stroke="#FCD34D" stroke-width="1"/>
                <line x1="130" y1="0" x2="130" y2="126" stroke="#FCD34D" stroke-width="1"/>
                <line x1="170" y1="0" x2="170" y2="126" stroke="#FCD34D" stroke-width="1"/>
                <text x="25" y="20" text-anchor="middle" font-size="10" font-weight="800" fill="#92400E">鎖</text>
                <text x="70" y="20" text-anchor="middle" font-size="10" font-weight="800" fill="#92400E">A</text>
                <text x="110" y="20" text-anchor="middle" font-size="10" font-weight="800" fill="#92400E">T</text>
                <text x="150" y="20" text-anchor="middle" font-size="10" font-weight="800" fill="#92400E">C</text>
                <text x="190" y="20" text-anchor="middle" font-size="10" font-weight="800" fill="#92400E">G</text>
                <text x="25" y="50" text-anchor="middle" font-size="10" font-weight="700" fill="#78350F">H鎖</text>
                <text x="70" y="50" text-anchor="middle" font-size="10" fill="#78350F">30%</text>
                <text x="110" y="50" text-anchor="middle" font-size="10" fill="#78350F">?</text>
                <text x="150" y="50" text-anchor="middle" font-size="10" fill="#78350F">?</text>
                <text x="190" y="50" text-anchor="middle" font-size="10" fill="#78350F">?</text>
                <text x="25" y="82" text-anchor="middle" font-size="10" font-weight="700" fill="#78350F">H'鎖</text>
                <text x="70" y="82" text-anchor="middle" font-size="10" fill="#78350F">?</text>
                <text x="110" y="82" text-anchor="middle" font-size="10" fill="#78350F">30%</text>
                <text x="150" y="82" text-anchor="middle" font-size="10" fill="#78350F">?</text>
                <text x="190" y="82" text-anchor="middle" font-size="10" fill="#78350F">?</text>
                <text x="25" y="114" text-anchor="middle" font-size="10" font-weight="700" fill="#92400E">2本鎖</text>
                <text x="130" y="114" text-anchor="middle" font-size="10" font-weight="700" fill="#B45309">相補対で等量</text>
            </g>
            <path d="M226 102 L204 102" stroke="#475569" stroke-width="2" marker-end="url(#arrow)"/>
            <path d="M442 102 L464 102" stroke="#475569" stroke-width="2" marker-end="url(#arrow)"/>
        </g>
        <!-- Middle: 細胞周期のDNA量変化 ＆ ゲノムの構成 (x=16, y=195, w=668, h=150) -->
        <g transform="translate(16, 195)">
            <rect width="668" height="150" rx="16" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="2" />
            <text x="16" y="22" font-size="13" font-weight="900" fill="#166534">細胞周期のDNA量変化 ＆ ゲノムの構成</text>
            <line x1="40" y1="130" x2="244" y2="130" stroke="#166534" stroke-width="1.5"/>
            <line x1="40" y1="130" x2="40" y2="40" stroke="#166534" stroke-width="1.5"/>
            <path d="M48 112 L92 112 L138 56 L186 56 L224 112" fill="none" stroke="#22C55E" stroke-width="3" stroke-linecap="round"/>
            <text x="70" y="126" font-size="10" font-weight="700" fill="#15803D">G1</text>
            <text x="116" y="88" font-size="10" font-weight="700" fill="#15803D">S</text>
            <text x="162" y="50" font-size="10" font-weight="700" fill="#15803D">G2</text>
            <text x="208" y="88" font-size="10" font-weight="700" fill="#15803D">M</text>
            <text x="469" y="53" text-anchor="middle" font-size="11" font-weight="700" fill="#166534">DNA全体（必要部分＋不要部分）</text>
        </g>
        <!-- Bottom: ヒトの体細胞と生殖細胞の比較 (x=16, y=355, w=668, h=175) -->
        <g transform="translate(16, 355)">
            <rect width="668" height="175" rx="16" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2" />
            <text x="16" y="22" font-size="13" font-weight="900" fill="#334155">ヒトの体細胞と生殖細胞の比較</text>
            <rect x="20" y="37" width="300" height="124" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>
            <text x="170" y="61" text-anchor="middle" font-size="11" font-weight="800" fill="#0D9488">染色体46本・ゲノム2組・DNA量 2x</text>
            <rect x="348" y="37" width="300" height="124" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>
            <text x="498" y="61" text-anchor="middle" font-size="11" font-weight="800" fill="#166534">染色体23本・ゲノム1組・DNA量 1x</text>
        </g>`;
    }
}

function renderBoardSvg(oniBlankStageId               )       {
    const items = getItemsForCategory(state.category);
    const backdrop = renderBoardBackdropSvg(state.category);
    const isEasy = state.difficulty === 'easy';

    // Normal mode numbered blanks sequence counter
    let normalBlankIndex = 1;

    const nodes = items.map((s) => {
        const isBlank = oniBlankStageId !== null ? s.stageId === oniBlankStageId : true;
        const cls = oniBlankStageId !== null
            ? (isBlank ? 'stage-node oni-target-blank interactive-target' : 'stage-node solved')
            : 'stage-node interactive-target masked';

        let txt = '？';
        if (oniBlankStageId !== null) {
            txt = isBlank ? '？' : s.name;
        } else if (!isEasy) {
            txt = `【 ${normalBlankIndex++} 】`;
        }

        const displayBoxLabel = (isEasy || (oniBlankStageId !== null && !isBlank)) ? s.boxLabel : '';
        const boxW = s.name.length >= 14 ? 236 : (s.name.length >= 12 ? 216 : 180);
        const halfW = boxW / 2;
        const labelFontSize = txt.length >= 15 ? 11 : (txt.length >= 12 ? 12 : 14);
        const boxLabelSvg = displayBoxLabel ? `<text x="0" y="-10" text-anchor="middle" font-size="11" font-weight="700" fill="#5B6E82">${displayBoxLabel}</text>` : '';
        const yOffset = displayBoxLabel ? 12 : 5;

        return `<g class="${cls}" data-stage="${s.stageId}" tabindex="0" role="button" transform="translate(${s.x}, ${s.y})">
            <g class="stage-visual">
                <rect class="stage-box ${isBlank && (oniBlankStageId || !isEasy) ? 'oni-focus-box' : ''}" x="${-halfW}" y="-30" width="${boxW}" height="60" rx="14" fill="#FFFFFF" stroke="#6F7977" stroke-width="2.5" />
                ${boxLabelSvg}
                <text class="stage-label" x="0" y="${yOffset}" text-anchor="middle" font-size="${labelFontSize}" font-weight="800" fill="#161D1C">${txt}</text>
            </g>
        </g>`;
    }).join('');
    els.boardSvg.innerHTML = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker></defs>${backdrop}${nodes}`;
}

function startGame(difficulty            )       {
    stopTimers();
    state.difficulty = difficulty;
    state.score = 0; state.combo = 0; state.maxCombo = 0;
    state.selectedItemId = null; state.currentOniStageId = null;
    state.timeLeft = ONI_TIME_LIMIT; state.lastTickSecond = -1; state.isPlaying = true;

    const isOni = difficulty === 'oni';
    els.progressContainer.classList.toggle('oni-active', isOni);
    els.timerBadge.hidden = !isOni;
    els.scoreText.hidden = !isOni;
    els.progressFill.classList.toggle('timer-fill', isOni);
    els.modeDisplay.textContent = `${CATEGORY_CONFIG[state.category].label} / ${DIFFICULTY_LABELS[difficulty]}`;

    if (isOni) {
        els.trayTitleText.textContent = '❓ ？に入るのは？';
        els.trayHint.textContent = '👆クリック または 1・2・3キーで回答';
        nextOni();
        updateOniHud();
        state.oniEndTime = Date.now() + ONI_TIME_LIMIT * 1000;
        state.timerInterval = setInterval(() => {
            const rem = Math.max(0, state.oniEndTime - Date.now());
            state.timeLeft = computeRemainingSeconds(state.oniEndTime, Date.now());
            if (state.timeLeft <= 10 && state.timeLeft > 0 && state.timeLeft !== state.lastTickSecond) {
                state.lastTickSecond = state.timeLeft; SOUND_FX.playTick();
            }
            updateOniHud(rem);
            if (rem <= 0) { stopTimers(); handleOniTimeUp(); }
        }, 100);
    } else {
        els.trayTitleText.textContent = CATEGORY_CONFIG[state.category].trayTitle;
        els.trayHint.textContent = '👆カードを選んで図の枠をクリック';
        renderBoardSvg(null);
        const built = buildStandardCards(state.category, state.nextUid);
        state.nextUid = built.nextUid;
        state.items = shuffleInPlace(built.items);
        state.totalQuestions = state.items.length;
        els.progressFill.style.width = '0%';
        renderCards();
    }
    els.homeScreen.classList.remove('active');
    els.gameScreen.classList.add('active');
}

function nextOni()       {
    const q = buildOniQuestion(state.category, state.currentOniStageId, state.nextUid);
    state.currentOniStageId = q.target.stageId;
    state.nextUid = q.nextUid;
    state.items = q.choices;
    els.trayTitleText.textContent = q.askHint ? '❓ ？の時期・項目はどれ？' : '❓ ？に入る名称は？';
    renderBoardSvg(q.target.stageId);
    renderCards();
}

function renderCards()       {
    els.cardList.innerHTML = '';
    const isOni = state.difficulty === 'oni';
    const isEasy = state.difficulty === 'easy';
    els.cardList.classList.toggle('oni-choices', isOni);
    state.items.forEach((item, idx) => {
        const card = document.createElement('div');
        const sel = state.selectedItemId === item.id;
        card.className = `bio-card${sel ? ' selected' : ''}`;
        card.tabIndex = 0;
        const iconHtml = isEasy ? `<div class="feature-icon">${item.emoji}</div>` : '';
        const hintHtml = item.hint && !isOni ? `<div class="hint">${item.hint}</div>` : '';
        card.innerHTML = `${iconHtml}<div class="info"><div class="name">${item.name}</div>${hintHtml}</div>`;
        if (isOni && idx < 9) card.insertAdjacentHTML('afterbegin', `<span class="key-badge">${idx + 1}</span>`);
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } });
        card.addEventListener('click', () => {
            if (!state.isPlaying) return;
            if (isOni) {
                if (item.stageId === state.currentOniStageId) {
                    state.score++; state.combo++; state.maxCombo = Math.max(state.maxCombo, state.combo);
                    if (isBonusCombo(state.combo)) { state.oniEndTime += ONI_BONUS_SECONDS * 1000; SOUND_FX.playBonus(); showToast(`🔥 ${state.combo}連続！ +3秒！`); }
                    else { SOUND_FX.playCorrect(state.combo); showToast('⭕ 正解！'); }
                    updateOniHud(); nextOni();
                } else {
                    state.combo = 0; SOUND_FX.playWrong(); triggerErrorShake(); state.oniEndTime -= ONI_PENALTY_SECONDS * 1000;
                    showToast(`❌ ミス！ -${ONI_PENALTY_SECONDS}秒`);
                    const rem = Math.max(0, state.oniEndTime - Date.now());
                    if (rem <= 0) { stopTimers(); handleOniTimeUp(); } else { updateOniHud(rem); nextOni(); }
                }
                return;
            }
            SOUND_FX.playTap();
            state.selectedItemId = sel ? null : item.id;
            renderCards();
        });
        els.cardList.appendChild(card);
    });
}

function attemptPlace(stageId        )       {
    const idx = state.items.findIndex((i) => i.id === state.selectedItemId);
    if (idx === -1) return;
    const item = state.items[idx] ;
    if (item.stageId === stageId) {
        state.score++;
        SOUND_FX.playCorrect(1);
        showToast(`⭕ 正解！ ${item.name}`);
        const node = els.boardSvg.querySelector             (`[data-stage="${stageId}"]`);
        if (node) {
            node.classList.remove('masked', 'interactive-target');
            node.classList.add('solved');
            const lbl = node.querySelector('.stage-label');
            if (lbl) lbl.textContent = item.name;
        }
        state.items.splice(idx, 1);
        state.selectedItemId = null;
        els.progressFill.style.width = `${(state.score / state.totalQuestions) * 100}%`;
        renderCards();
        if (state.score >= state.totalQuestions) {
            createConfetti();
            handleGameClear();
        }
    } else {
        SOUND_FX.playWrong();
        triggerErrorShake();
        showToast('❌ 違うみたい…');
        state.selectedItemId = null;
        renderCards();
    }
}

function updateComboBadge()       {
    if (state.difficulty === 'oni' && state.combo >= 2) {
        els.comboBadge.textContent = `🔥 ${state.combo} COMBO`;
        els.comboBadge.hidden = false;
    } else {
        els.comboBadge.hidden = true;
    }
}

function triggerErrorShake()       {
    const wrapper = byId('graph-wrapper');
    wrapper.classList.remove('shake-error');
    void wrapper.offsetWidth;
    wrapper.classList.add('shake-error');
}

function createConfetti()       {
    const container = byId('game-screen');
    const colors = ['#0D9488', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6'];
    for (let i = 0; i < 40; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        const size = Math.floor(Math.random() * 8) + 6;
        const color = colors[Math.floor(Math.random() * colors.length)] ;
        const left = Math.random() * 100;
        const animDuration = Math.random() * 1.5 + 1.5;
        const delay = Math.random() * 0.5;
        el.style.cssText = `position:absolute;top:-10px;left:${left}%;width:${size}px;height:${size}px;background:${color};border-radius:${Math.random() > 0.5 ? '50%' : '2px'};z-index:999;pointer-events:none;animation:confettiFall ${animDuration}s ease-in-out ${delay}s forwards;`;
        container.appendChild(el);
        setTimeout(() => el.remove(), (animDuration + delay) * 1000);
    }
}

function updateOniHud(rem = state.timeLeft * 1000)       {
    els.timerText.textContent = String(state.timeLeft);
    els.scoreText.textContent = `🏆 ${state.score}問`;
    els.progressFill.style.width = `${Math.min(100, (rem / (ONI_TIME_LIMIT * 1000)) * 100)}%`;
}

function showToast(msg        )       {
    els.toast.innerHTML = msg;
    els.toast.style.backgroundColor = msg.includes('❌') ? 'rgba(239, 68, 68, 0.95)' : 'rgba(13, 148, 136, 0.95)';
    els.toast.classList.add('show');
    if (state.toastTimeout !== null) clearTimeout(state.toastTimeout);
    state.toastTimeout = setTimeout(() => els.toast.classList.remove('show'), 1200);
}

function handleGameClear()       {
    state.isPlaying = false;
    let unlockedNow = false;
    const k = state.category;
    if (state.difficulty === 'normal' && !progress.isOniUnlocked(k)) {
        progress.unlockOni(k); state.justUnlockedOni = true; unlockedNow = true;
    }
    SOUND_FX.playClear(unlockedNow);
    els.clearTitle.innerHTML = '🎊 素晴らしい！ 🎊';
    els.clearSubtitle.innerHTML = unlockedNow ? 'すべてマスターしました！<div class="unlock-message">どこかでとびらがひらいたようだ…！</div>' : 'すべてマスターしました！';
    els.clearActions.hidden = true; els.autoReturnText.hidden = false;
    els.clearOverlay.classList.add('active');
    state.returnTimeout = setTimeout(resetToHome, unlockedNow ? 4500 : 3000);
}

function handleOniTimeUp()       {
    state.isPlaying = false;
    const k = state.category;
    const prev = progress.getOniBest(k) ?? -1;
    const best = Math.max(prev, state.score);
    if (state.score > prev) progress.setOniBest(k, best);
    updateTabScores();
    const r = getOniRankInfo(state.score);
    SOUND_FX.playTimeUp(r.rank === 'S' || r.rank === 'A');
    els.clearTitle.innerHTML = '⏱️ タイムアップ！';
    els.clearSubtitle.innerHTML = `<div class="rank-showcase ${r.className}"><span class="rank-letter">${r.rank}</span><span class="rank-title-text">${r.icon} ${r.title}</span></div><div style="font-size:40px;font-weight:900;color:var(--primary);">${state.score}問正解！</div><div>ベスト記録：<b>${best} 問</b></div>`;
    els.clearActions.hidden = false; els.autoReturnText.hidden = true;
    els.clearOverlay.classList.add('active');
}

function stopTimers()       {
    if (state.timerInterval !== null) clearInterval(state.timerInterval);
    if (state.returnTimeout !== null) clearTimeout(state.returnTimeout);
    state.timerInterval = null; state.returnTimeout = null;
}

function resetToHome()       {
    stopTimers(); state.isPlaying = false;
    els.clearOverlay.classList.remove('active');
    els.gameScreen.classList.remove('active');
    els.homeScreen.classList.add('active');
    setCategory(state.category);
    state.justUnlockedOni = false;
}

init();


//# sourceURL=app.ts