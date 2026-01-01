import { CommitCreateEvent, CommitDeleteEvent, CommitUpdateEvent, Jetstream } from '@skyware/jetstream';
import 'dotenv/config';
import PQueue from 'p-queue';
import WebSocket from 'ws';
import type { } from './lexicons/index.js';
import { applyLabelForUser, applyLabelForPost } from './lib/atcute.js';
import { db, deleteLike, deleteLikeSubject, deletePost, getCursor, setCursor, upsertLike, upsertLikeSubject, upsertPost } from './lib/db.js';
import logger from './lib/logger.js';
import { LikeRecord, LikeSubjectRecord, memoryDB, PostRecord } from './lib/type.js';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';

import cursorPkg from '../package.json' with { type: 'json' };

// キュー設定
const queue = new PQueue({ concurrency: 1 });
const QUEUE_WARN = 2000;
const QUEUE_DROP = 20000;
let warned = false;
let overflowed = false;

// キューの閾値
function enqueue(task: () => Promise<void>) {
  // DROP 超過
  if (queue.size > QUEUE_DROP) {
    if (!overflowed) {
      logger.error(`Queue overflow: size=${queue.size}, dropping tasks`);
      overflowed = true;
    }
    return;
  } else {
    // 回復したらリセット
    overflowed = false;
  }

  // WARN 超過
  if (queue.size > QUEUE_WARN) {
    if (!warned) {
      logger.warn(`Queue growing: size=${queue.size}`);
      warned = true;
    }
  } else {
    // 回復したらリセット
    warned = false;
  }

  queue.add(task).catch(err => {
    logger.error(err, 'Queue task failed');
  });
}


const port = parseInt(process.env.PORT || '8080');


if (process.env.LABELER_DID === 'DUMMY') {
    logger.info(`This service need to more setup. Please go to the following site.`)
    logger.info(`https://label.rito.blue`)
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        logger.info(`You also help following this server's domain.`)
        logger.info(process.env.RAILWAY_PUBLIC_DOMAIN)
    }
}

let jetstreamCursor = 0;
let queueCursor = 0;
let prev_time_us = 0
let cursorUpdateInterval: NodeJS.Timeout;
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


function epochUsToDateTime(cursor: number): string {
    return new Date(cursor / 1000).toISOString();
}


// Like自動ラベル
function handleLikeEvent(rkey: string, record: { subject: string; createdAt: string }) {
    // DBに保存
    upsertLike(rkey, record.subject, record.createdAt);

    logger.info(`Upsert Like definition. ${rkey}`)

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

// Post自動反映
function handlePostEvent(rkey: string, data: {
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
    logger.info(`Upsert Post definition. ${rkey}`);

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
    jetstreamCursor = event.time_us;

    if (process.env.LABELER_DID === event.did) {
        enqueue(async () => {
            try {
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
            } catch (e) {
                logger.error(e)

            }
        });
    }
}
let jetstream: Jetstream | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let connecting = false;
let connected = false;
const intervalMs = Number(process.env.CURSOR_UPDATE_INTERVAL) || 30000;

function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

function scheduleReconnect() {
    if (reconnectTimer || connecting || connected) return;

    const interval = 15000; // 15秒待つ
    logger.warn(`Scheduling Jetstream reconnect in ${interval / 1000}s...`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startJetstream();
    }, interval);
}


function startJetstream() {
    if (connecting || connected) return;

    connecting = true;
    logger.info('Starting Jetstream...');

    try {
        loadMemoryDB();

        try {
            jetstreamCursor = getCursor();
        } catch {
            jetstreamCursor = Math.floor(Date.now() * 1000);
        }

        logger.info(`cursor loaded from db : "${epochUsToDateTime(jetstreamCursor)}"`);

    } catch (err) {
        connecting = false;
        logger.error(err, 'Startup preparation failed');
        scheduleReconnect();
        return;
    }

    // 新しいインスタンスを作成
    jetstream = new Jetstream({
        wantedCollections: [
            'app.bsky.feed.post',
            'app.bsky.feed.like',
            'blue.rito.label.auto.like',
            'blue.rito.label.auto.post',
            'blue.rito.label.auto.random'
        ],
        endpoint: process.env.JETSREAM_URL || 'wss://jetstream2.us-west.bsky.network/subscribe',
        cursor: jetstreamCursor,
        ws: WebSocket,
    });

    // 接続成功
    jetstream.on('connected', () => {
        connecting = false;
        connected = true;
        logger.info('Jetstream connected');
    });

    // 切断時
    jetstream.on('closed', () => {
        connecting = false;
        connected = false;
        logger.warn('Jetstream connection closed');
        scheduleReconnect();
    });

    // エラー時
    jetstream.on('error', (err) => {
        connecting = false;
        connected = false;
        logger.error(err, 'Jetstream error:');
        scheduleReconnect();
    });

    try {
        jetstream.start();
    } catch (err) {
        connecting = false;
        connected = false;
        logger.error(err, 'Jetstream.start() threw');
        scheduleReconnect();
    }
    // Create / Update 共通化
    jetstream.onCreate('blue.rito.label.auto.post', handlePostEventWrapper);
    jetstream.onUpdate('blue.rito.label.auto.post', handlePostEventWrapper);

    jetstream.onDelete('blue.rito.label.auto.post', (event: CommitDeleteEvent<'blue.rito.label.auto.post'>) => {
        jetstreamCursor = event.time_us;

        // 自分が作成したラベルのみ処理
        if (process.env.LABELER_DID === event.did) {
            enqueue(async () => {
                try {
                    logger.info(`Delete Post definition. ${event.commit.rkey}`);

                    // DB から削除
                    deletePost(event.commit.rkey);

                    // オンメモリから削除
                    const idx = memoryDB.posts.findIndex(p => p.rkey === event.commit.rkey);
                    if (idx >= 0) {
                        memoryDB.posts.splice(idx, 1)[0];
                    }
                } catch (e) {
                    logger.error(e)

                }
            });
        }
    });

    jetstream.onCreate('app.bsky.feed.post', (event: CommitCreateEvent<'app.bsky.feed.post'>) => {
        jetstreamCursor = event.time_us;

        enqueue(async () => {
            try {
                const text = event.commit.record.text || '';

                for (let postRule of memoryDB.posts) {
                    try {
                        const regex = new RegExp(postRule.condition);
                        if (regex.test(text)) {
                            // ラベルを適用する処理
                            logger.info(`Post matched rule ${postRule.label} for rkey ${postRule.rkey}. action:${postRule.action}`);
                            if (postRule.appliedTo === 'account') {
                                if (!postRule.action) return
                                await applyLabelForUser(event.did, [postRule.label], postRule.action, postRule.durationInHours)
                            } else if (postRule.appliedTo === 'post') {
                                const aturi = `at://${event.did}/app.bsky.feed.post/${event.commit.rkey}`
                                await applyLabelForPost(aturi, event.commit.cid, [postRule.label], 'add', postRule.durationInHours)
                            }

                            // 1件マッチしたらループを抜ける
                            break;
                        }
                    } catch (err) {
                        logger.error(`Failed to test regex for postRule ${postRule.rkey}: ${err}`);
                    }
                }

            } catch (e) {
                logger.error(e)

            }
        });
    });


    // --- イベント登録 ---
    jetstream.onCreate('blue.rito.label.auto.like', (event: CommitCreateEvent<'blue.rito.label.auto.like'>) => {
        jetstreamCursor = event.time_us;
        if (process.env.LABELER_DID === event.did) {
            enqueue(async () => {
                try {
                    const record = event.commit.record as unknown as { subject: string; createdAt: string; $type: string };
                    handleLikeEvent(event.commit.rkey, record);
                } catch (e) {
                    logger.error(e)

                }
            });


        }
    });

    jetstream.onUpdate('blue.rito.label.auto.like', (event: CommitUpdateEvent<'blue.rito.label.auto.like'>) => {
        jetstreamCursor = event.time_us;
        if (process.env.LABELER_DID === event.did) {
            enqueue(async () => {
                try {
                    const record = event.commit.record as unknown as { subject: string; createdAt: string; $type: string };
                    handleLikeEvent(event.commit.rkey, record);
                } catch (e) {
                    logger.error(e)

                }
            });
        }
    });

    jetstream.onDelete('blue.rito.label.auto.like', (event: CommitDeleteEvent<'blue.rito.label.auto.like'>) => {
        jetstreamCursor = event.time_us;

        if (process.env.LABELER_DID === event.did) {
            enqueue(async () => {
                try {
                    logger.info(`Delete Like definition. ${event.commit.rkey}`)
                    deleteLike(event.commit.rkey);
                    const idx = memoryDB.likes.findIndex(l => l.rkey === event.commit.rkey);
                    if (idx >= 0) memoryDB.likes.splice(idx, 1);
                } catch (e) {
                    logger.error(e)

                }
            });
        }
    });


    // --- Jetstream Like create ---
    jetstream.onCreate('app.bsky.feed.like', (event: CommitCreateEvent<'app.bsky.feed.like'>) => {
        jetstreamCursor = event.time_us;
        enqueue(async () => {
            try {
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
                await applyLabelForUser(event.did, [targetPost.rkey], 'add')
            } catch (e) {
                logger.error(e)

            }
        });
    });

    // --- Jetstream Like delete ---
    jetstream.onDelete('app.bsky.feed.like', (event: CommitDeleteEvent<'app.bsky.feed.like'>) => {
        jetstreamCursor = event.time_us;
        enqueue(async () => {
            try {
                const likeUri = `at://${event.did}/app.bsky.feed.like/${event.commit.rkey}`;

                queueCursor = event.time_us

                // メモリから削除
                const idx = memoryDB.likeSubjects.findIndex(ls => ls.subjectUri === likeUri);
                if (idx >= 0) {
                    const removed = memoryDB.likeSubjects.splice(idx, 1)[0];

                    // DB 側も削除
                    deleteLikeSubject(removed.subjectUri);

                    logger.info(`Bluesky like removed: ${likeUri} -> ${removed.rkey} `);
                    await applyLabelForUser(event.did, [removed.rkey], 'remove')
                }
            } catch (e) {
                logger.error(e)

            }
        });
    });


    jetstream.on('open', () => {
        connecting = false;
        connected = true;
        clearReconnectTimer();
        logger.info('Jetstream connected');
    });

    cursorUpdateInterval = setInterval(() => {
        if (jetstream?.cursor) {
            logger.info(
                `jetstreamCursor=${jetstreamCursor} jetstreamCursorISO="${epochUsToDateTime(jetstreamCursor)}" queueCursor=${queueCursor} queueCursorISO="${epochUsToDateTime(queueCursor)}" size=${queue.size} pending=${queue.pending}`
            );

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
}


// 起動
logger.info('Waiting 3s before starting Jetstream...');
setTimeout(() => {
    startJetstream();
}, 3_000);

process.on('uncaughtException', err => {
    logger.fatal(err, 'uncaughtException');
});

process.on('unhandledRejection', err => {
    logger.fatal(err, 'unhandledRejection');
});

process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    process.exit(0);
});


// xrpc endpoint
const app = new Hono();
app.get('/', c => c.text('OK'));


app.get('/xrpc/blue.rito.label.auto.getServiceStatus', (c) => {
  return c.json({
    version: cursorPkg.version,
    jetstreamCursor: new Date(jetstreamCursor / 1000).toISOString(),
    queueCursor: new Date(queueCursor / 1000).toISOString(),
  });
});

serve({
  fetch: app.fetch,
  port,
});