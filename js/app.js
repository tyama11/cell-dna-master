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
        <!-- Top: 分解能の限界スケール (x=16, y=10, w=668, h=155) -->
        <g transform="translate(16, 10)">
            <rect width="668" height="155" rx="16" fill="#F0FDFA" stroke="#99F6E4" stroke-width="2" />
            <text x="24" y="28" font-size="13" font-weight="900" fill="#0D9488">分解能の限界スケール</text>
            <g transform="translate(40, 85)">
                <line x1="0" y1="0" x2="588" y2="0" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/>
                <circle cx="0" cy="0" r="6" fill="#0D9488"/>
                <text x="0" y="-14" text-anchor="middle" font-size="11" font-weight="800" fill="#0F766E">1mm</text>
                <text x="0" y="22" text-anchor="middle" font-size="10" font-weight="700" fill="#64748B">肉眼</text>

                <circle cx="196" cy="0" r="6" fill="#0D9488"/>
                <text x="196" y="-14" text-anchor="middle" font-size="11" font-weight="800" fill="#0F766E">0.1mm</text>

                <circle cx="392" cy="0" r="6" fill="#0D9488"/>
                <text x="392" y="-14" text-anchor="middle" font-size="11" font-weight="800" fill="#0F766E">0.1μm</text>
                <text x="392" y="22" text-anchor="middle" font-size="10" font-weight="700" fill="#64748B">光学顕微鏡</text>

                <circle cx="588" cy="0" r="6" fill="#0D9488"/>
                <text x="588" y="-14" text-anchor="middle" font-size="11" font-weight="800" fill="#0F766E">0.1nm</text>
                <text x="588" y="22" text-anchor="middle" font-size="10" font-weight="700" fill="#64748B">電子顕微鏡</text>

                <!-- Arrow markers -->
                <path d="M578 -5 L588 0 L578 5" fill="none" stroke="#0D9488" stroke-width="2" stroke-linecap="round"/>
            </g>
        </g>
        <!-- Middle: 原核生物 vs 真核生物 (x=16, y=175, w=668, h=165) -->
        <g transform="translate(16, 175)">
            <rect width="668" height="165" rx="16" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2" />
            <text x="24" y="28" font-size="13" font-weight="900" fill="#334155">原核生物 vs 真核生物</text>
            <!-- E. coli diagram left -->
            <g transform="translate(160, 95)">
                <rect x="-110" y="-45" width="200" height="75" rx="20" fill="#E2E8F0" stroke="#94A3B8" stroke-width="2"/>
                <text x="0" y="-20" text-anchor="middle" font-size="11" font-weight="800" fill="#1E293B">大腸菌（細胞壁あり・核なし）</text>
                <circle cx="-40" cy="5" r="16" fill="none" stroke="#0F172A" stroke-width="2" stroke-dasharray="3 3"/>
                <text x="-40" y="9" text-anchor="middle" font-size="10" font-weight="700" fill="#0F172A">環状DNA</text>
            </g>
            <!-- Eukaryote diagram right -->
            <g transform="translate(480, 95)">
                <rect x="-110" y="-45" width="200" height="75" rx="20" fill="#FEF3C7" stroke="#FCD34D" stroke-width="2"/>
                <text x="0" y="-20" text-anchor="middle" font-size="11" font-weight="800" fill="#92400E">真核生物（核あり・膜系）</text>
                <circle cx="-35" cy="5" r="18" fill="#FDE68A" stroke="#D97706" stroke-width="2"/>
                <text x="-35" y="9" text-anchor="middle" font-size="10" font-weight="700" fill="#92400E">核</text>
            </g>
        </g>
        <!-- Bottom: 酵素の特徴と代表酵素 (x=16, y=350, w=668, h=175) -->
        <g transform="translate(16, 350)">
            <rect width="668" height="175" rx="16" fill="#FDF4FF" stroke="#F0ABFC" stroke-width="2" />
            <text x="24" y="28" font-size="13" font-weight="900" fill="#86198F">酵素の特徴と代表酵素</text>
            <!-- Lock and Key icon schematic -->
            <g transform="translate(334, 100)">
                <path d="M-50 -20 C-50 -35 -20 -35 -20 -20 L-20 -5 L-35 -5 L-35 25 L-5 25 L-5 -5 L-20 -5" fill="none" stroke="#D946EF" stroke-width="3" stroke-linecap="round"/>
                <text x="-27" y="12" font-size="14">🔑</text>
                <text x="40" y="5" font-size="12" font-weight="800" fill="#A21CAF">基質特異性 ＆ カタラーゼ / ルシフェラーゼ</text>
            </g>
        </g>`;
    } else {
        return `
        <!-- Top-left: シャルガフの法則（塩基割合表） (x=16, y=10, w=410, h=265) -->
        <g transform="translate(16, 10)">
            <rect width="410" height="265" rx="16" fill="#FEF3C7" stroke="#FDE68A" stroke-width="2" />
            <text x="20" y="26" font-size="12" font-weight="900" fill="#B45309">シャルガフの法則（塩基割合表）</text>
            <!-- Table grid -->
            <g transform="translate(20, 45)">
                <rect x="0" y="0" width="370" height="200" rx="8" fill="#FFFBEB" stroke="#FCD34D" stroke-width="1.5"/>
                <line x1="0" y1="36" x2="370" y2="36" stroke="#FCD34D" stroke-width="1"/>
                <line x1="90" y1="0" x2="90" y2="200" stroke="#FCD34D" stroke-width="1"/>
                <line x1="160" y1="0" x2="160" y2="200" stroke="#FCD34D" stroke-width="1"/>
                <line x1="230" y1="0" x2="230" y2="200" stroke="#FCD34D" stroke-width="1"/>
                <line x1="300" y1="0" x2="300" y2="200" stroke="#FCD34D" stroke-width="1"/>
                <text x="45" y="24" text-anchor="middle" font-size="11" font-weight="800" fill="#92400E">鎖</text>
                <text x="125" y="24" text-anchor="middle" font-size="11" font-weight="800" fill="#92400E">A</text>
                <text x="195" y="24" text-anchor="middle" font-size="11" font-weight="800" fill="#92400E">T</text>
                <text x="265" y="24" text-anchor="middle" font-size="11" font-weight="800" fill="#92400E">C</text>
                <text x="335" y="24" text-anchor="middle" font-size="11" font-weight="800" fill="#92400E">G</text>

                <text x="45" y="75" text-anchor="middle" font-size="11" font-weight="700" fill="#78350F">H 鎖</text>
                <text x="125" y="75" text-anchor="middle" font-size="11" fill="#78350F">0.30</text>
                <text x="195" y="75" text-anchor="middle" font-size="11" fill="#78350F">0.20</text>
                <text x="265" y="75" text-anchor="middle" font-size="11" fill="#78350F">0.10</text>
                <text x="335" y="75" text-anchor="middle" font-size="11" fill="#78350F">0.40</text>

                <text x="45" y="120" text-anchor="middle" font-size="11" font-weight="700" fill="#78350F">H' 鎖</text>
                <text x="125" y="120" text-anchor="middle" font-size="11" fill="#78350F">0.20</text>
                <text x="195" y="120" text-anchor="middle" font-size="11" fill="#78350F">0.30</text>
                <text x="265" y="120" text-anchor="middle" font-size="11" fill="#78350F">0.40</text>
                <text x="335" y="120" text-anchor="middle" font-size="11" fill="#78350F">0.10</text>

                <text x="45" y="165" text-anchor="middle" font-size="11" font-weight="700" fill="#92400E">2本鎖</text>
                <text x="125" y="165" text-anchor="middle" font-size="11" font-weight="800" fill="#B45309">0.25</text>
                <text x="195" y="165" text-anchor="middle" font-size="11" font-weight="800" fill="#B45309">0.25</text>
                <text x="265" y="165" text-anchor="middle" font-size="11" font-weight="800" fill="#B45309">0.25</text>
                <text x="335" y="165" text-anchor="middle" font-size="11" font-weight="800" fill="#B45309">0.25</text>
            </g>
        </g>
        <!-- Top-right: 細胞周期とDNA量 (x=438, y=10, w=246, h=265) -->
        <g transform="translate(438, 10)">
            <rect width="246" height="265" rx="16" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="2" />
            <text x="20" y="26" font-size="12" font-weight="900" fill="#166534">細胞周期とDNA量</text>
            <!-- Step curve axes -->
            <g transform="translate(30, 50)">
                <line x1="0" y1="170" x2="190" y2="170" stroke="#166534" stroke-width="1.5"/>
                <line x1="0" y1="170" x2="0" y2="20" stroke="#166534" stroke-width="1.5"/>
                <!-- Curve G1 -> S -> G2 -> M -->
                <path d="M10 130 L60 130 L110 50 L150 50 L180 130" fill="none" stroke="#22C55E" stroke-width="3" stroke-linecap="round"/>
                <text x="35" y="150" font-size="10" font-weight="700" fill="#15803D">G1</text>
                <text x="85" y="100" font-size="10" font-weight="700" fill="#15803D">S</text>
                <text x="130" y="40" font-size="10" font-weight="700" fill="#15803D">G2</text>
                <text x="165" y="100" font-size="10" font-weight="700" fill="#15803D">M</text>
            </g>
        </g>
        <!-- Bottom: ゲノム構成 ＆ ヒト体細胞(2n) vs 生殖細胞(n) (x=16, y=288, w=668, h=238) -->
        <g transform="translate(16, 288)">
            <rect width="668" height="238" rx="16" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2" />
            <text x="24" y="26" font-size="13" font-weight="900" fill="#334155">ゲノム構成 ＆ ヒト体細胞(2n) vs 生殖細胞(n)比較表</text>
            <!-- Comparison Grid -->
            <g transform="translate(30, 45)">
                <rect x="0" y="0" width="608" height="170" rx="10" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
                <line x1="0" y1="40" x2="608" y2="40" stroke="#CBD5E1" stroke-width="1.5"/>
                <line x1="180" y1="0" x2="180" y2="170" stroke="#CBD5E1" stroke-width="1.5"/>
                <line x1="394" y1="0" x2="394" y2="170" stroke="#CBD5E1" stroke-width="1.5"/>
                <text x="90" y="26" text-anchor="middle" font-size="11" font-weight="800" fill="#475569">項目</text>
                <text x="287" y="26" text-anchor="middle" font-size="11" font-weight="800" fill="#0D9488">体細胞 (2n)</text>
                <text x="501" y="26" text-anchor="middle" font-size="11" font-weight="800" fill="#166534">生殖細胞 (n)</text>

                <text x="20" y="75" font-size="11" font-weight="700" fill="#334155">染色体セット</text>
                <text x="287" y="75" text-anchor="middle" font-size="11" fill="#0F766E">2組（相同染色体ペアあり）</text>
                <text x="501" y="75" text-anchor="middle" font-size="11" fill="#15803D">1組（半減）</text>

                <text x="20" y="115" font-size="11" font-weight="700" fill="#334155">DNA量 (ヒト)</text>
                <text x="287" y="115" text-anchor="middle" font-size="11" fill="#0F766E">6.0 × 10⁻¹² g (2x)</text>
                <text x="501" y="115" text-anchor="middle" font-size="11" fill="#15803D">3.0 × 10⁻¹² g (x)</text>

                <text x="20" y="155" font-size="11" font-weight="700" fill="#334155">ゲノムの定義</text>
                <text x="394" y="155" text-anchor="middle" font-size="11" font-weight="700" fill="#334155">生殖細胞がもつ1セットの遺伝情報全体</text>
            </g>
        </g>`;
    }
}

function renderBoardSvg(oniBlankStageId               )       {
    const items = getItemsForCategory(state.category);
    const backdrop = renderBoardBackdropSvg(state.category);
    const isEasy = state.difficulty === 'easy';
    const isOni = state.difficulty === 'oni';

    // Normal mode numbered blanks sequence counter
    let normalBlankIndex = 1;

    const nodes = items.map((s) => {
        const isBlank = oniBlankStageId !== null ? s.stageId === oniBlankStageId : !isEasy;
        const cls = oniBlankStageId !== null
            ? (isBlank ? 'stage-node oni-target-blank interactive-target' : 'stage-node solved')
            : (isEasy ? 'stage-node interactive-target' : 'stage-node interactive-target masked');

        let txt = '？';
        if (oniBlankStageId !== null) {
            txt = isBlank ? '？' : s.name;
        } else {
            if (isEasy) {
                txt = s.name;
            } else {
                // Normal mode: hide boxLabel on unfilled boxes and show numbered blanks 【 1 】, 【 2 】...
                txt = `【 ${normalBlankIndex++} 】`;
            }
        }

        const displayBoxLabel = (isEasy || oniBlankStageId !== null || !isBlank) ? s.boxLabel : '';

        return `<g class="${cls}" data-stage="${s.stageId}" tabindex="0" role="button" transform="translate(${s.x}, ${s.y})">
            <g class="stage-visual">
                <rect class="stage-box ${isBlank && (oniBlankStageId || !isEasy) ? 'oni-focus-box' : ''}" x="-92" y="-38" width="184" height="76" rx="16" fill="#FFFFFF" stroke="#6F7977" stroke-width="2.5" />
                <text x="0" y="-14" text-anchor="middle" font-size="12" font-weight="700" fill="#5B6E82">${displayBoxLabel}</text>
                <text class="stage-label" x="0" y="14" text-anchor="middle" font-size="15" font-weight="800" fill="#161D1C">${txt}</text>
            </g>
        </g>`;
    }).join('');
    els.boardSvg.innerHTML = backdrop + nodes;
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



//# sourceURL=app.ts