                                                                            

export const TAB1_ITEMS                       = [
    { stageId: 'n1', name: '0.1mm', emoji: '🔍', hint: '肉眼の限界（最小目盛りの10分の1）', x: 120, y: 95, boxLabel: '肉眼の限界' },
    { stageId: 'n2', name: '0.1μm', emoji: '🔬', hint: '光学顕微鏡の限界（単位が1つ変わる）', x: 350, y: 95, boxLabel: '光学顕微鏡' },
    { stageId: 'n3', name: '0.1nm', emoji: '⚛️', hint: '電子顕微鏡の限界（単位が1つ変わる）', x: 580, y: 95, boxLabel: '電子顕微鏡' },
    { stageId: 'n4', name: '細菌類（原核）', emoji: '🦠', hint: '大腸菌・乳酸菌など（核なし・細胞壁あり）', x: 175, y: 255, boxLabel: '〜菌の仲間' },
    { stageId: 'n5', name: '菌類（真核）', emoji: '🍄', hint: '酵母菌・アオカビなど（核あり）', x: 525, y: 255, boxLabel: 'カビ・キノコ' },
    { stageId: 'n6', name: '基質特異性', emoji: '🔑', hint: '酵素が特定の物質にのみ働く性質', x: 120, y: 420, boxLabel: '酵素の特徴①' },
    { stageId: 'n7', name: 'カタラーゼ', emoji: '🫧', hint: '過酸化水素を分解（酸化マンガンと対比）', x: 350, y: 420, boxLabel: '代表酵素' },
    { stageId: 'n8', name: 'ルシフェラーゼ', emoji: '✨', hint: 'ATPを使ってホタルなどを光らせる酵素', x: 580, y: 420, boxLabel: '発光酵素' }
];

export const TAB2_ITEMS                       = [
    { stageId: 'd1', name: 'A＝T, G＝C', emoji: '⚖️', hint: '2本鎖DNAで相補的に結合する塩基対', x: 175, y: 115, boxLabel: 'シャルガフの法則' },
    { stageId: 'd2', name: 'H鎖のA=0.15', emoji: '📊', hint: 'H鎖にAが30%なら2本鎖全体では15%', x: 525, y: 115, boxLabel: '片鎖の割合' },
    { stageId: 'd3', name: 'ゲノム＝遺伝子＋ジャンク', emoji: '🧬', hint: '必要な遺伝子部分と不要な部分の合計', x: 350, y: 255, boxLabel: 'ゲノムの構成' },
    { stageId: 'd4', name: '体細胞（2n）', emoji: '🧑', hint: '生殖細胞の2倍のDNA量・染色体数をもつ', x: 175, y: 395, boxLabel: '体細胞' },
    { stageId: 'd5', name: '生殖細胞（n）', emoji: '🥚', hint: 'ゲノム1セット分（体細胞の半分のDNA量）', x: 525, y: 395, boxLabel: '生殖細胞' }
];

export const CATEGORY_CONFIG                                                                                        = {
    'cell': {
        label: '🦠 原核・真核 ＆ 酵素で覚える',
        description: '顕微鏡の限界・原核生物と真核生物・酵素の特徴を正しい枠に当てはめよう！',
        trayTitle: '🦠 細胞・酵素カード'
    },
    'dna': {
        label: '🧬 DNA塩基表 ＆ ゲノムで覚える',
        description: 'DNA塩基割合表（シャルガフの法則）・体細胞と生殖細胞・DNA量変化をマスターしよう！',
        trayTitle: '🧬 DNA・ゲノムカード'
    }
};

export const DIFFICULTY_LABELS                                       = {
    easy: '🔰 かんたん',
    normal: '🧪 ふつう',
    oni: '👹 おに (60秒TA)'
};

export function getItemsForCategory(cat          )                       {
    return cat === 'cell' ? TAB1_ITEMS : TAB2_ITEMS;
}

export function getOniRankInfo(score        )           {
    if (score >= 20) return { rank: 'S', icon: '👑', title: '細胞・酵素・DNAの神', className: 'rank-s' };
    if (score >= 14) return { rank: 'A', icon: '🔬', title: '熟練研究者', className: 'rank-a' };
    if (score >= 8) return { rank: 'B', icon: '🧪', title: '一人前ラボ員', className: 'rank-b' };
    return { rank: 'C', icon: '🌱', title: '見習い観察者', className: 'rank-c' };
}


//# sourceURL=data.ts