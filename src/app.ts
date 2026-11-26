import { CATEGORY_CONFIG, DIFFICULTY_LABELS, getItemsForCategory, getOniRankInfo } from './data.ts';
import { byId, bySelector } from './dom.ts';
import { ONI_BONUS_SECONDS, ONI_PENALTY_SECONDS, ONI_TIME_LIMIT, buildOniQuestion, buildStandardCards, computeRemainingSeconds, isBonusCombo } from './game-logic.ts';
import { shuffleInPlace } from './random.ts';
import { createSoundFx } from './sound.ts';
import { createProgressStore, safeLocalStorage } from './storage.ts';
import type { Card, Category, Difficulty } from './types.ts';

const storage = safeLocalStorage();
const progress = createProgressStore(storage);
const SOUND_FX = createSoundFx(storage);

const state = {
    category: 'cell' as Category,
    difficulty: 'easy' as Difficulty,
    score: 0,
    combo: 0,
    maxCombo: 0,
    totalQuestions: 0,
    selectedItemId: null as string | null,
    currentOniStageId: null as string | null,
    items: [] as Card[],
    nextUid: 0,
    timeLeft: ONI_TIME_LIMIT,
    lastTickSecond: -1,
    oniEndTime: 0,
    isPlaying: false,
    justUnlockedOni: false,
    timerInterval: null as ReturnType<typeof setInterval> | null,
    toastTimeout: null as ReturnType<typeof setTimeout> | null,
    returnTimeout: null as ReturnType<typeof setTimeout> | null
};

const els = {
    homeScreen: byId('home-screen'),
    gameScreen: byId('game-screen'),
    mainArea: bySelector('.main'),
    homeDesc: byId('home-desc'),
    earnedTitleBanner: byId('earned-title-banner'),
    ruleOniItem: byId('rule-oni-item'),
    btnOni: byId<HTMLButtonElement>('btn-oni'),
    homeMuteBtn: byId<HTMLButtonElement>('home-mute-btn'),
    gameMuteBtn: byId<HTMLButtonElement>('game-mute-btn'),
    tabScore1: byId('tab-score-1'),
    tabScore2: byId('tab-score-2'),
    categoryTabs: document.querySelectorAll<HTMLButtonElement>('.category-tab'),
    modeButtons: document.querySelectorAll<HTMLButtonElement>('.mode-btn'),
    homeBtn: byId<HTMLButtonElement>('home-btn'),
    modeDisplay: byId('mode-display'),
    trayTitleText: byId('tray-title-text'),
    trayHint: byId('tray-hint'),
    progressContainer: byId('progress-container'),
    timerBadge: byId('timer-badge'),
    timerText: byId('timer-text'),
    comboBadge: byId('combo-badge'),
    scoreText: byId('score-text'),
    progressFill: byId('progress-fill'),
    boardSvg: byId<SVGSVGElement>('board-svg'),
    cardList: byId('card-list'),
    toast: byId('toast'),
    clearOverlay: byId('clear-overlay'),
    clearTitle: byId('clear-title'),
    clearSubtitle: byId('clear-subtitle'),
    clearActions: byId('clear-actions'),
    autoReturnText: byId('auto-return-text'),
    retryBtn: byId<HTMLButtonElement>('retry-btn'),
    overlayHomeBtn: byId<HTMLButtonElement>('overlay-home-btn')
};

function updateTabScores(): void {
    [['cell', els.tabScore1], ['dna', els.tabScore2]].forEach(([c, el]) => {
        const s = progress.getOniBest(c as Category);
        if (s !== null) { (el as HTMLElement).textContent = `👹 ${s}問`; (el as HTMLElement).hidden = false; }
        else (el as HTMLElement).hidden = true;
    });
    const saved = progress.getOniBest(state.category);
    if (saved === null) { els.earnedTitleBanner.hidden = true; return; }
    const r = getOniRankInfo(saved);
    els.earnedTitleBanner.className = `earned-title-banner ${r.className}`;
    els.earnedTitleBanner.textContent = `称号：${r.icon} ${r.title}`;
    els.earnedTitleBanner.hidden = false;
}

function setCategory(cat: Category): void {
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

function renderBoardBackdropSvg(cat: Category): string {
    if (cat === 'cell') {
        return `
        <!-- 解像度スケール矢印バー -->
        <g transform="translate(350, 42)">
            <rect x="-310" y="-22" width="620" height="44" rx="22" fill="#E4F5F1" stroke="#0D9488" stroke-width="1.5" stroke-dasharray="4 4" />
            <text x="0" y="4" text-anchor="middle" font-size="13" font-weight="850" fill="#006B5F">📏 尺度: 肉眼 0.1mm → 光学 0.1μm → 電子 0.1nm</text>
        </g>
        <!-- 原核 vs 真核 フレーム -->
        <g transform="translate(350, 255)">
            <rect x="-315" y="-55" width="630" height="110" rx="20" fill="#F0FDFA" stroke="#99F6E4" stroke-width="2" />
            <text x="-295" y="-32" font-size="12" font-weight="900" fill="#0D9488">🦠 原核生物（核なし・細胞壁） vs 真核生物（核あり・膜系）</text>
        </g>
        <!-- 酵素セクションコンテナ -->
        <g transform="translate(350, 420)">
            <rect x="-315" y="-55" width="630" height="110" rx="20" fill="#FDF4FF" stroke="#F0ABFC" stroke-width="2" />
            <text x="-295" y="-32" font-size="12" font-weight="900" fill="#86198F">🧪 酵素の特徴と代表例（基質特異性・カタラーゼ・ルシフェラーゼ）</text>
        </g>`;
    } else {
        return `
        <!-- シャルガフ二重鎖テーブルグリッド -->
        <g transform="translate(350, 115)">
            <rect x="-315" y="-62" width="630" height="124" rx="20" fill="#FEF3C7" stroke="#FDE68A" stroke-width="2" />
            <text x="-295" y="-38" font-size="12" font-weight="900" fill="#B45309">⚖️ シャルガフの法則: 2本鎖DNA (A=T, G=C) ＆ 片鎖(H)・対鎖(H')の塩基割合</text>
        </g>
        <!-- ゲノム方程式ラベル -->
        <g transform="translate(350, 255)">
            <rect x="-190" y="-36" width="380" height="72" rx="16" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="2" />
            <text x="0" y="-8" text-anchor="middle" font-size="13" font-weight="900" fill="#334155">🧬 ゲノム ＝ 遺伝子領域 ＋ ジャンク領域</text>
            <text x="0" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#64748B">（すべての遺伝情報の1セット）</text>
        </g>
        <!-- 体細胞(2n) vs 生殖細胞(n) フレーム -->
        <g transform="translate(350, 395)">
            <rect x="-315" y="-58" width="630" height="116" rx="20" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="2" />
            <text x="-295" y="-34" font-size="12" font-weight="900" fill="#166534">🧑 体細胞 (2n / DNA量 2x) ⇄ 生殖細胞 (n / DNA量 x・半減)</text>
        </g>`;
    }
}

function renderBoardSvg(oniBlankStageId: string | null): void {
    const items = getItemsForCategory(state.category);
    const backdrop = renderBoardBackdropSvg(state.category);
    const nodes = items.map((s) => {
        const isBlank = oniBlankStageId !== null ? s.stageId === oniBlankStageId : true;
        const cls = oniBlankStageId !== null
            ? (isBlank ? 'stage-node oni-target-blank interactive-target' : 'stage-node solved')
            : 'stage-node interactive-target masked';
        const txt = oniBlankStageId !== null ? (isBlank ? '？' : s.name) : '？';
        return `<g class="${cls}" data-stage="${s.stageId}" tabindex="0" role="button" transform="translate(${s.x}, ${s.y})">
            <g class="stage-visual">
                <rect class="stage-box ${isBlank && oniBlankStageId ? 'oni-focus-box' : ''}" x="-92" y="-38" width="184" height="76" rx="16" fill="#FFFFFF" stroke="#6F7977" stroke-width="2.5" />
                <text x="0" y="-14" text-anchor="middle" font-size="12" font-weight="700" fill="#5B6E82">${s.boxLabel}</text>
                <text class="stage-label" x="0" y="14" text-anchor="middle" font-size="16" font-weight="800" fill="#161D1C">${txt}</text>
            </g>
        </g>`;
    }).join('');
    els.boardSvg.innerHTML = backdrop + nodes;
}

function startGame(difficulty: Difficulty): void {
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

function nextOni(): void {
    const q = buildOniQuestion(state.category, state.currentOniStageId, state.nextUid);
    state.currentOniStageId = q.target.stageId;
    state.nextUid = q.nextUid;
    state.items = q.choices;
    els.trayTitleText.textContent = q.askHint ? '❓ ？の時期・項目はどれ？' : '❓ ？に入る名称は？';
    renderBoardSvg(q.target.stageId);
    renderCards();
}

function renderCards(): void {
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

function attemptPlace(stageId: string): void {
    const idx = state.items.findIndex((i) => i.id === state.selectedItemId);
    if (idx === -1) return;
    const item = state.items[idx]!;
    if (item.stageId === stageId) {
        state.score++;
        SOUND_FX.playCorrect(1);
        showToast(`⭕ 正解！ ${item.name}`);
        const node = els.boardSvg.querySelector<SVGGElement>(`[data-stage="${stageId}"]`);
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

function updateComboBadge(): void {
    if (state.difficulty === 'oni' && state.combo >= 2) {
        els.comboBadge.textContent = `🔥 ${state.combo} COMBO`;
        els.comboBadge.hidden = false;
    } else {
        els.comboBadge.hidden = true;
    }
}

function triggerErrorShake(): void {
    const wrapper = byId('graph-wrapper');
    wrapper.classList.remove('shake-error');
    void wrapper.offsetWidth;
    wrapper.classList.add('shake-error');
}

function createConfetti(): void {
    const container = byId('game-screen');
    const colors = ['#0D9488', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6'];
    for (let i = 0; i < 40; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        const size = Math.floor(Math.random() * 8) + 6;
        const color = colors[Math.floor(Math.random() * colors.length)]!;
        const left = Math.random() * 100;
        const animDuration = Math.random() * 1.5 + 1.5;
        const delay = Math.random() * 0.5;
        el.style.cssText = `position:absolute;top:-10px;left:${left}%;width:${size}px;height:${size}px;background:${color};border-radius:${Math.random() > 0.5 ? '50%' : '2px'};z-index:999;pointer-events:none;animation:confettiFall ${animDuration}s ease-in-out ${delay}s forwards;`;
        container.appendChild(el);
        setTimeout(() => el.remove(), (animDuration + delay) * 1000);
    }
}

function updateOniHud(rem = state.timeLeft * 1000): void {
    els.timerText.textContent = String(state.timeLeft);
    els.scoreText.textContent = `🏆 ${state.score}問`;
    els.progressFill.style.width = `${Math.min(100, (rem / (ONI_TIME_LIMIT * 1000)) * 100)}%`;
}

function showToast(msg: string): void {
    els.toast.innerHTML = msg;
    els.toast.style.backgroundColor = msg.includes('❌') ? 'rgba(239, 68, 68, 0.95)' : 'rgba(13, 148, 136, 0.95)';
    els.toast.classList.add('show');
    if (state.toastTimeout !== null) clearTimeout(state.toastTimeout);
    state.toastTimeout = setTimeout(() => els.toast.classList.remove('show'), 1200);
}

function handleGameClear(): void {
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

function handleOniTimeUp(): void {
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

function stopTimers(): void {
    if (state.timerInterval !== null) clearInterval(state.timerInterval);
    if (state.returnTimeout !== null) clearTimeout(state.returnTimeout);
    state.timerInterval = null; state.returnTimeout = null;
}

function resetToHome(): void {
    stopTimers(); state.isPlaying = false;
    els.clearOverlay.classList.remove('active');
    els.gameScreen.classList.remove('active');
    els.homeScreen.classList.add('active');
    setCategory(state.category);
    state.justUnlockedOni = false;
}

