import { Client, CredentialManager, ok } from '@atcute/client';
import type { } from '@atcute/ozone';
import 'dotenv/config'
import { ResourceUri } from '@atcute/lexicons/syntax'
import logger from './logger.js';
const manager = new CredentialManager({ service: process.env.PDS_AUTH_ENDPOINT || 'https://bsky.social' });

const rpc = new Client({
    handler: manager,
    proxy: {
        serviceId: "#atproto_labeler",
        did: process.env.LABELER_DID! as `did:${string}:${string}`
    }
});

export async function applyLabelForUser(target: string, label: string[], type: "add" | "remove", durationInHours?: number) {
    if (!manager.session) {
        await manager.login({ identifier: process.env.LABELER_DID || '', password: process.env.LABELER_APP_PASSWORD || '' });
    }

    const subject = {
        $type: 'com.atproto.admin.defs#repoRef',
        did: target as `did:${string}:${string}`,
    } as const;

    const event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel';
        createLabelVals: string[];
        negateLabelVals: string[];
        durationInHours?: number;
    } = {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: [],
        negateLabelVals: [],
    };

    if (type === "add") {
        event.createLabelVals = label
    } else if (type === "remove") {
        event.negateLabelVals = label

    }
    // durationInHours が 0 でも null でもないときだけ追加
    if (durationInHours != null && durationInHours !== 0) {
        event.durationInHours = durationInHours;
    }

    try {
        await rpc.post('tools.ozone.moderation.emitEvent', {
            input: {
                createdBy: process.env.LABELER_DID! as `did:${string}:${string}`,
                subject,
                event,
            },
        });

    } catch (e) {
        logger.error("applyLabelForUser failed.")
        logger.error(e)
    }
}


export async function applyLabelForPost(uri: string, cid: string, label: string[], type: "add" | "remove", durationInHours?: number) {
    if (!manager.session) {
        await manager.login({ identifier: process.env.LABELER_DID || '', password: process.env.LABELER_APP_PASSWORD || '' });
    }

    const subject: {
        $type: 'com.atproto.repo.strongRef';
        uri: ResourceUri;
        cid: string;
    } = {
        $type: 'com.atproto.repo.strongRef',
        uri: uri as ResourceUri, // ← ここで string を ResourceUri にキャスト
        cid,
    };

    const event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel';
        createLabelVals: string[];
        negateLabelVals: string[];
        durationInHours?: number;
    } = {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: [],
        negateLabelVals: [],
    };

    if (type === "add") {
        event.createLabelVals = label
    } else if (type === "remove") {
        event.negateLabelVals = label

    }

    // durationInHours が 0 でも null でもないときだけ追加
    if (durationInHours != null && durationInHours !== 0) {
        event.durationInHours = durationInHours;
    }

    try {
        await rpc.post('tools.ozone.moderation.emitEvent', {
            input: {
                createdBy: process.env.LABELER_DID! as `did:${string}:${string}`,
                subject,
                event,
            },
        });

    } catch (e) {
        logger.error("applyLabelForPost failed.")
        logger.error(e)
    }
}
