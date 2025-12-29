import { CommitCreateEvent, CommitUpdateEvent, CommitDeleteEvent, Jetstream } from '@skyware/jetstream';
import WebSocket from 'ws';
import { getCursor, setCursor, upsertLike, deleteLike, db, upsertLikeSubject, deleteLikeSubject, upsertPost, deletePost } from '@/lib/db';
import { memoryDB, LikeRecord, PostRecord, LikeSubjectRecord } from '@/lib/type';
import logger from '@/lib/logger';
import PQueue from 'p-queue';
import type { } from '@/lexicons'
import 'dotenv/config'
import { BlueRitoLabelAutoLikeSettings, BlueRitoLabelAutoLike, BlueRitoLabelAutoPost } from '@/lexicons/index';
const queue = new PQueue({ concurrency: 1 });

let cursor = 0;
let prev_time_us = 0
let cursorUpdateInterval: NodeJS.Timeout;
try {
    cursor = getCursor(); // DB から取得
} catch (error) {
    cursor = Math.floor(Date.now() * 1000); // DB 取得失敗時は現在時刻
}

logger.info(`Cursor from: ${cursor} (${epochUsToDateTime(cursor)})`)

// 起動時にオンメモリにロード
function loadMemoryDB() {
    // --- Like ---
    const likeRows = db.prepare('SELECT * FROM like').all() as LikeRecord[];
    memoryDB.likes = likeRows; // 配列としてそのまま格納

    // --- LikeSubject ---
    const likeSubjectRows = db.prepare('SELECT * FROM like_subject').all() as LikeSubjectRecord[];
    memoryDB.likeSubjects = likeSubjectRows; // 配列としてそのまま格納

    // --- Post ---
    const postRows = db.prepare('SELECT * FROM post').all() as PostRecord[];
    memoryDB.posts = postRows; // 配列としてそのまま格納
}

// 起動時に呼び出し
loadMemoryDB();

function epochUsToDateTime(cursor: number): string {
    return new Date(cursor / 1000).toISOString();
}

const jetstream = new Jetstream({
    wantedCollections: ['app.bsky.feed.post', 'app.bsky.feed.like', 'blue.rito.label.auto.like', 'blue.rito.label.auto.post', 'blue.rito.label.auto.random'],
    endpoint: process.env.JETSREAM_URL || 'wss://jetstream2.us-west.bsky.network/subscribe',
    cursor: cursor,
    ws: WebSocket,
});

const intervalMs = Number(process.env.CURSOR_UPDATE_INTERVAL) || 10000;

cursorUpdateInterval = setInterval(() => {
    if (jetstream.cursor) {
        logger.info(`Cursor updated to: ${jetstream.cursor} (${epochUsToDateTime(jetstream.cursor)})`);

        // DB に保存
        try {
            setCursor(jetstream.cursor);
        } catch (err) {
            logger.error('Failed to save cursor to DB');
        }

        if (prev_time_us === jetstream.cursor) {
            logger.info(`The time_us has not changed since the last check, reconnecting.`);
            jetstream.close();
        }
        prev_time_us = jetstream.cursor;
    }
}, intervalMs);

jetstream.onCreate('app.bsky.feed.post', (event: CommitCreateEvent<'app.bsky.feed.post'>) => {
    cursor = event.time_us
    queue.add(async () => {
        if (event.commit.record.text && memoryDB.posts.length > 0) {
            for (let obj of memoryDB.posts) {
                const regex = new RegExp(obj.condition); // 文字列を正規表現に変換
                if (regex.test(event.commit.record.text)) {
                    // ラベルを貼る
                }
            }

        }
    })
});

// --- Jetstream Like create ---
jetstream.onCreate('app.bsky.feed.like', (event: CommitCreateEvent<'app.bsky.feed.like'>) => {
    cursor = event.time_us;
    queue.add(async () => {
        const likeUri = `at://${event.did}/app.bsky.feed.like/${event.commit.rkey}`;
        const likeSubjectUri = (event.commit.record as any).subject.uri; // Like された投稿の URI

        // memoryDB.likes の投稿に Like がついた場合のみ処理
        const targetPost = memoryDB.likes.find(like => like.subject === likeSubjectUri);
        if (!targetPost) return; // 対象外の投稿なら何もしない

        // DB に保存
        upsertLikeSubject(likeUri, targetPost.rkey);

        // メモリに反映
        const existing = memoryDB.likeSubjects.find(ls => ls.subjectUri === likeUri);
        if (!existing) {
            memoryDB.likeSubjects.push({
                subjectUri: likeUri,
                rkey: targetPost.rkey
            });
        }

        logger.info(`Bluesky like create detected for tracked post: ${likeSubjectUri} -> ${targetPost.rkey}`);
    });
});

// --- Jetstream Like delete ---
jetstream.onDelete('app.bsky.feed.like', (event: CommitDeleteEvent<'app.bsky.feed.like'>) => {
    cursor = event.time_us;
    queue.add(async () => {
        const likeUri = `at://${event.did}/app.bsky.feed.like/${event.commit.rkey}`;

        // メモリから削除
        const idx = memoryDB.likeSubjects.findIndex(ls => ls.subjectUri === likeUri);
        if (idx >= 0) {
            const removed = memoryDB.likeSubjects.splice(idx, 1)[0];
            console.log(removed)

            // DB 側も削除
            deleteLikeSubject(removed.subjectUri);

            logger.info(`Bluesky like removed: ${likeUri} -> ${removed.rkey} `);
        }
    });
});

// Like自動ラベル
function handleLikeEvent(rkey: string, record: { subject: string; createdAt: string }) {
    // DBに保存
    upsertLike(rkey, record.subject, record.createdAt);

    logger.info(`Upsert Like def. ${rkey}`)

    // オンメモリに反映
    const idx = memoryDB.likes.findIndex(l => l.rkey === rkey);
    const likeRecord = {
        rkey,
        subject: record.subject,
        createdAt: record.createdAt,
    };
    if (idx >= 0) {
        memoryDB.likes[idx] = likeRecord;
    } else {
        memoryDB.likes.push(likeRecord);
    }
}

// --- イベント登録 ---
jetstream.onCreate('blue.rito.label.auto.like', (event: CommitCreateEvent<'blue.rito.label.auto.like'>) => {
    cursor = event.time_us;
    if (process.env.LABELER_DID === event.did) {
        queue.add(async () => {
            const record = event.commit.record as unknown as { subject: string; createdAt: string; $type: string };
            handleLikeEvent(event.commit.rkey, record);
        });
    }
});

jetstream.onUpdate('blue.rito.label.auto.like', (event: CommitUpdateEvent<'blue.rito.label.auto.like'>) => {
    cursor = event.time_us;
    if (process.env.LABELER_DID === event.did) {
        queue.add(async () => {
            const record = event.commit.record as unknown as { subject: string; createdAt: string; $type: string };
            handleLikeEvent(event.commit.rkey, record);
        });
    }
});

jetstream.onDelete('blue.rito.label.auto.like', (event: CommitDeleteEvent<'blue.rito.label.auto.like'>) => {
    cursor = event.time_us;

    if (process.env.LABELER_DID === event.did) {
        queue.add(async () => {
            logger.info(`Delete Like def. ${event.commit.rkey}`)
            deleteLike(event.commit.rkey);
        });
    }
});

// Post自動反映
export function handlePostEvent(rkey: string, data: {
  tid: string;
  label: string;
  condition: string;
  appliedTo: 'account' | 'post';
  action?: 'add' | 'remove';
  durationInHours: number;
  createdAt: string;
}) {
  // DB に保存
  upsertPost(rkey, data);
  logger.info(`Upsert Post def. ${rkey}`);

  // オンメモリに反映
  const idx = memoryDB.posts.findIndex(p => p.rkey === rkey);
  const postRecord: PostRecord = {
    rkey,
    label: data.label,
    condition: data.condition,
    appliedTo: data.appliedTo,
    action: data.action,
    durationInHours: data.durationInHours,
    createdAt: data.createdAt,
  };

  if (idx >= 0) {
    memoryDB.posts[idx] = postRecord;
  } else {
    memoryDB.posts.push(postRecord);
  }
}

// 共通処理
function handlePostEventWrapper(event: CommitCreateEvent<'blue.rito.label.auto.post'> | CommitUpdateEvent<'blue.rito.label.auto.post'>) {
    cursor = event.time_us;

    if (process.env.LABELER_DID === event.did) {
        queue.add(async () => {
            const record = event.commit.record as unknown as {
                tid: string;
                label: string;
                condition: string;
                appliedTo: 'account' | 'post';
                action?: 'add' | 'remove';
                durationInHours: number;
                createdAt: string;
            };
            handlePostEvent(event.commit.rkey, record);
        });
    }
}

// Create / Update 共通化
jetstream.onCreate('blue.rito.label.auto.post', handlePostEventWrapper);
jetstream.onUpdate('blue.rito.label.auto.post', handlePostEventWrapper);

jetstream.onDelete('blue.rito.label.auto.post', (event: CommitDeleteEvent<'blue.rito.label.auto.post'>) => {
    cursor = event.time_us;

    // 自分が作成したラベルのみ処理
    if (process.env.LABELER_DID === event.did) {
        queue.add(async () => {
            logger.info(`Delete Post def. ${event.commit.rkey}`);

            // DB から削除
            deletePost(event.commit.rkey);

            // オンメモリから削除
            const idx = memoryDB.posts.findIndex(p => p.rkey === event.commit.rkey);
            if (idx >= 0) {
                memoryDB.posts.splice(idx, 1)[0];
            }
        });
    }
});

jetstream.onCreate('app.bsky.feed.post', (event: CommitCreateEvent<'app.bsky.feed.post'>) => {
    cursor = event.time_us;

    queue.add(async () => {
        const text = event.commit.record.text || '';

        for (let postRule of memoryDB.posts) {
            try {
                const regex = new RegExp(postRule.condition);
                if (regex.test(text)) {
                    // ラベルを適用する処理
                    logger.info(`Post matched rule ${postRule.label} for rkey ${postRule.rkey}`);
                    
                    // DB に保存
                    upsertPost(postRule.rkey, postRule);

                    // メモリ上の更新も必要ならここで

                    // 1件マッチしたらループを抜ける
                    break;
                }
            } catch (err) {
                logger.error(`Failed to test regex for postRule ${postRule.rkey}: ${err}`);
            }
        }
    });
});


jetstream.on('close', () => {
    clearInterval(cursorUpdateInterval);
    logger.warn(`Jetstream connection closed.`);
    process.exit(1);
});

jetstream.on('error', (error) => {
    logger.error(`Jetstream error: ${error.message}`);
    jetstream.close();
    process.exit(1);
});

jetstream.start();