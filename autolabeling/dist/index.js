import { Jetstream } from '@skyware/jetstream';
import 'dotenv/config';
import PQueue from 'p-queue';
import WebSocket from 'ws';
import { applyLabelForUser, applyLabelForPost } from './lib/atcute.js';
import { db, deleteLike, deleteLikeSubject, deletePost, getCursor, setCursor, upsertLike, upsertLikeSubject, upsertPost } from './lib/db.js';
import logger from './lib/logger.js';
import { memoryDB } from './lib/type.js';
import express from 'express';
import path from 'node:path';
import cursorPkg from '../package.json' with { type: 'json' };
const queue = new PQueue({ concurrency: 1 });
const port = parseInt(process.env.PORT || '8080');
const app = express();
app.get('/', (req, res) => res.send('OK'));
const dbPath = process.env.DB_PATH
    ? path.join(process.env.DB_PATH, 'labeling.db')
    : path.join(process.cwd(), 'data', 'labeling.db');
if (process.env.LABELER_DID === 'DUMMY') {
    logger.info(`This service need to more setup. Please go to the following site.`);
    logger.info(`https://label.rito.blue`);
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        logger.info(`You also help following this server's domain.`);
        logger.info(process.env.RAILWAY_PUBLIC_DOMAIN);
    }
}
let cursor = 0;
let prev_time_us = 0;
let cursorUpdateInterval;
// 起動時にオンメモリにロード
function loadMemoryDB() {
    // --- Like ---
    const likeRows = db.prepare('SELECT * FROM like').all();
    memoryDB.likes = likeRows; // 配列としてそのまま格納
    // --- LikeSubject ---
    const likeSubjectRows = db.prepare('SELECT * FROM like_subject').all();
    memoryDB.likeSubjects = likeSubjectRows; // 配列としてそのまま格納
    // --- Post ---
    const postRows = db.prepare('SELECT * FROM post').all();
    memoryDB.posts = postRows; // 配列としてそのまま格納
}
function epochUsToDateTime(cursor) {
    return new Date(cursor / 1000).toISOString();
}
// Like自動ラベル
function handleLikeEvent(rkey, record) {
    // DBに保存
    upsertLike(rkey, record.subject, record.createdAt);
    logger.info(`Upsert Like definition. ${rkey}`);
    // オンメモリに反映
    const idx = memoryDB.likes.findIndex(l => l.rkey === rkey);
    const likeRecord = {
        rkey,
        subject: record.subject,
        createdAt: record.createdAt,
    };
    if (idx >= 0) {
        memoryDB.likes[idx] = likeRecord;
    }
    else {
        memoryDB.likes.push(likeRecord);
    }
}
// Post自動反映
function handlePostEvent(rkey, data) {
    // DB に保存
    upsertPost(rkey, data);
    logger.info(`Upsert Post definition. ${rkey}`);
    // オンメモリに反映
    const idx = memoryDB.posts.findIndex(p => p.rkey === rkey);
    const postRecord = {
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
    }
    else {
        memoryDB.posts.push(postRecord);
    }
}
// 共通処理
function handlePostEventWrapper(event) {
    cursor = event.time_us;
    if (process.env.LABELER_DID === event.did) {
        queue.add(async () => {
            try {
                const record = event.commit.record;
                handlePostEvent(event.commit.rkey, record);
            }
            catch (e) {
                logger.error(e);
            }
        });
    }
}
let jetstream = null;
let reconnectTimer = null;
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
    if (reconnectTimer || connecting || connected)
        return;
    const interval = 15000; // 15秒待つ
    logger.warn(`Scheduling Jetstream reconnect in ${interval / 1000}s...`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startJetstream();
    }, interval);
}
function startJetstream() {
    if (connecting || connected)
        return;
    connecting = true;
    logger.info('Starting Jetstream...');
    try {
        loadMemoryDB();
        try {
            cursor = getCursor();
        }
        catch {
            cursor = Math.floor(Date.now() * 1000);
        }
        logger.info(`Cursor from: ${cursor} (${epochUsToDateTime(cursor)})`);
    }
    catch (err) {
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
        cursor: cursor,
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
    }
    catch (err) {
        connecting = false;
        connected = false;
        logger.error(err, 'Jetstream.start() threw');
        scheduleReconnect();
    }
    // Create / Update 共通化
    jetstream.onCreate('blue.rito.label.auto.post', handlePostEventWrapper);
    jetstream.onUpdate('blue.rito.label.auto.post', handlePostEventWrapper);
    jetstream.onDelete('blue.rito.label.auto.post', (event) => {
        cursor = event.time_us;
        // 自分が作成したラベルのみ処理
        if (process.env.LABELER_DID === event.did) {
            queue.add(async () => {
                try {
                    logger.info(`Delete Post definition. ${event.commit.rkey}`);
                    // DB から削除
                    deletePost(event.commit.rkey);
                    // オンメモリから削除
                    const idx = memoryDB.posts.findIndex(p => p.rkey === event.commit.rkey);
                    if (idx >= 0) {
                        memoryDB.posts.splice(idx, 1)[0];
                    }
                }
                catch (e) {
                    logger.error(e);
                }
            });
        }
    });
    jetstream.onCreate('app.bsky.feed.post', (event) => {
        cursor = event.time_us;
        queue.add(async () => {
            try {
                const text = event.commit.record.text || '';
                for (let postRule of memoryDB.posts) {
                    try {
                        const regex = new RegExp(postRule.condition);
                        if (regex.test(text)) {
                            // ラベルを適用する処理
                            logger.info(`Post matched rule ${postRule.label} for rkey ${postRule.rkey}. action:${postRule.action}`);
                            logger.info(postRule);
                            if (postRule.appliedTo === 'account') {
                                if (!postRule.action)
                                    return;
                                await applyLabelForUser(event.did, [postRule.label], postRule.action, postRule.durationInHours);
                            }
                            else if (postRule.appliedTo === 'post') {
                                const aturi = `at://${event.did}/app.bsky.feed.post/${event.commit.rkey}`;
                                await applyLabelForPost(aturi, event.commit.cid, [postRule.label], 'add', postRule.durationInHours);
                            }
                            // 1件マッチしたらループを抜ける
                            break;
                        }
                    }
                    catch (err) {
                        logger.error(`Failed to test regex for postRule ${postRule.rkey}: ${err}`);
                    }
                }
            }
            catch (e) {
                logger.error(e);
            }
        });
    });
    // --- イベント登録 ---
    jetstream.onCreate('blue.rito.label.auto.like', (event) => {
        cursor = event.time_us;
        if (process.env.LABELER_DID === event.did) {
            queue.add(async () => {
                try {
                    const record = event.commit.record;
                    handleLikeEvent(event.commit.rkey, record);
                }
                catch (e) {
                    logger.error(e);
                }
            });
        }
    });
    jetstream.onUpdate('blue.rito.label.auto.like', (event) => {
        cursor = event.time_us;
        if (process.env.LABELER_DID === event.did) {
            queue.add(async () => {
                try {
                    const record = event.commit.record;
                    handleLikeEvent(event.commit.rkey, record);
                }
                catch (e) {
                    logger.error(e);
                }
            });
        }
    });
    jetstream.onDelete('blue.rito.label.auto.like', (event) => {
        cursor = event.time_us;
        if (process.env.LABELER_DID === event.did) {
            queue.add(async () => {
                try {
                    logger.info(`Delete Like definition. ${event.commit.rkey}`);
                    deleteLike(event.commit.rkey);
                }
                catch (e) {
                    logger.error(e);
                }
            });
        }
    });
    // --- Jetstream Like create ---
    jetstream.onCreate('app.bsky.feed.like', (event) => {
        cursor = event.time_us;
        queue.add(async () => {
            try {
                const likeUri = `at://${event.did}/app.bsky.feed.like/${event.commit.rkey}`;
                const likeSubjectUri = event.commit.record.subject.uri; // Like された投稿の URI
                // memoryDB.likes の投稿に Like がついた場合のみ処理
                const targetPost = memoryDB.likes.find(like => like.subject === likeSubjectUri);
                if (!targetPost)
                    return; // 対象外の投稿なら何もしない
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
                await applyLabelForUser(event.did, [targetPost.rkey], 'add');
            }
            catch (e) {
                logger.error(e);
            }
        });
    });
    // --- Jetstream Like delete ---
    jetstream.onDelete('app.bsky.feed.like', (event) => {
        cursor = event.time_us;
        queue.add(async () => {
            try {
                const likeUri = `at://${event.did}/app.bsky.feed.like/${event.commit.rkey}`;
                // メモリから削除
                const idx = memoryDB.likeSubjects.findIndex(ls => ls.subjectUri === likeUri);
                if (idx >= 0) {
                    const removed = memoryDB.likeSubjects.splice(idx, 1)[0];
                    // DB 側も削除
                    deleteLikeSubject(removed.subjectUri);
                    logger.info(`Bluesky like removed: ${likeUri} -> ${removed.rkey} `);
                    await applyLabelForUser(event.did, [removed.rkey], 'remove');
                }
            }
            catch (e) {
                logger.error(e);
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
            logger.info(`Cursor updated to: ${jetstream.cursor} (${epochUsToDateTime(jetstream.cursor)})`);
            // DB に保存
            try {
                setCursor(jetstream.cursor);
            }
            catch (err) {
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
logger.info('Waiting 10s before starting Jetstream...');
setTimeout(() => {
    startJetstream();
}, 10_000);
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
app.get('/xrpc/blue.rito.label.auto.getServiceStatus', (req, res) => {
    res.json({
        version: cursorPkg.version,
        cursor: new Date(cursor / 1000).toISOString()
    });
});
app.listen(port, () => console.log(`Health check listening on port ${port}`));
