// --- Like テーブルの型 ---
export interface LikeRecord {
    rkey: string;
    subject: string;      // 投稿 URI など
    createdAt: string;    // ISO 形式の日付文字列
}

// --- LikeSubject テーブルの型 ---
export interface LikeSubjectRecord {
    subjectUri: string;   // Likeされた投稿の URI
    rkey: string;         // Like 自体の ID
}

// --- Post テーブルの型 ---
export interface PostRecord {
    rkey: string;
    label: string;        // ラベル名
    condition: string;    // 適用条件 (正規表現など)
    regex?: RegExp;
    appliedTo: 'account' | 'post'; // 適用先
    action?: 'add' | 'remove';     // account の場合のみ
    durationInHours: number;       // ラベルの有効期間
    createdAt: string;             // 作成日時
}

// --- オンメモリストア（配列版） ---
export interface MemoryDB {
    likes: LikeRecord[];           // 配列で保持
    likeSubjects: LikeSubjectRecord[]; // 配列で保持
    posts: PostRecord[];           // 配列で保持
}

// --- 初期化 ---
export const memoryDB: MemoryDB = {
    likes: [],
    likeSubjects: [],
    posts: [],
};
