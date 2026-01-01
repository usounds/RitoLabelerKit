import { Client, CredentialManager } from '@atcute/client';
import 'dotenv/config';
import logger from './logger.js';
const manager = new CredentialManager({ service: process.env.PDS_AUTH_ENDPOINT || 'https://bsky.social' });
const rpc = new Client({
    handler: manager,
    proxy: {
        serviceId: "#atproto_labeler",
        did: process.env.LABELER_DID
    }
});
export async function applyLabelForUser(target, label, type, durationInHours) {
    if (!manager.session) {
        await manager.login({ identifier: process.env.LABELER_DID || '', password: process.env.LABELER_APP_PASSWORD || '' });
    }
    const subject = {
        $type: 'com.atproto.admin.defs#repoRef',
        did: target,
    };
    const event = {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: [],
        negateLabelVals: [],
    };
    if (type === "add") {
        event.createLabelVals = label;
    }
    else if (type === "remove") {
        event.negateLabelVals = label;
    }
    // durationInHours が 0 でも null でもないときだけ追加
    if (durationInHours != null && durationInHours !== 0) {
        event.durationInHours = durationInHours;
    }
    try {
        const resukt = await rpc.post('tools.ozone.moderation.emitEvent', {
            input: {
                createdBy: process.env.LABELER_DID,
                subject,
                event,
            },
        });
    }
    catch (e) {
        logger.error("applyLabelForUser failed.");
        logger.error(e);
    }
}
export async function applyLabelForPost(uri, cid, label, type, durationInHours) {
    if (!manager.session) {
        await manager.login({ identifier: process.env.LABELER_DID || '', password: process.env.LABELER_APP_PASSWORD || '' });
    }
    const subject = {
        $type: 'com.atproto.repo.strongRef',
        uri: uri, // ← ここで string を ResourceUri にキャスト
        cid,
    };
    const event = {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: [],
        negateLabelVals: [],
    };
    if (type === "add") {
        event.createLabelVals = label;
    }
    else if (type === "remove") {
        event.negateLabelVals = label;
    }
    // durationInHours が 0 でも null でもないときだけ追加
    if (durationInHours != null && durationInHours !== 0) {
        event.durationInHours = durationInHours;
    }
    try {
        const result = await rpc.post('tools.ozone.moderation.emitEvent', {
            input: {
                createdBy: process.env.LABELER_DID,
                subject,
                event,
            },
        });
    }
    catch (e) {
        logger.error("applyLabelForPost failed.");
        logger.error(e);
    }
}
