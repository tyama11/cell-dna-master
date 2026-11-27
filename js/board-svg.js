                                           

export const BOARD_VIEWBOX = { width: 700, height: 540 }         ;
export const STAGE_BOX_HEIGHT = 60;

export function getStageBoxWidth(name        )         {
    return name.length >= 14 ? 236 : (name.length >= 12 ? 216 : 180);
}

export function getStageLabelFontSize(txt        )         {
    return txt.length >= 15 ? 11 : (txt.length >= 12 ? 12 : 14);
}

export function renderBoardBackdropSvg(cat          )         {
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


//# sourceURL=board-svg.ts