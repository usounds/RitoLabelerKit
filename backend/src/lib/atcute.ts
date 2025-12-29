import { Client, CredentialManager, ok } from '@atcute/client';
import type { } from '@atcute/ozone';
import 'dotenv/config'

const manager = new CredentialManager({ service: process.env.PDS_AUTH_ENDPOINT || 'https://bsky.social' });

const rpc = new Client({
    handler: manager,
    proxy: {
        serviceId: "#atproto_labeler",
        did: process.env.LABELER_DID! as `did:${string}:${string}`
    }
});

export async function applyLabelForUser(target: string, label: string[], appliedTo?: number) {
    if (!manager.session) {
        await manager.login({ identifier: process.env.LABELER_DID || '', password: process.env.LABELER_APP_PASSWORD || '' });
    }

    const subject = {
        $type: 'com.atproto.admin.defs#repoRef',
        did: target as `did:${string}:${string}`,
    } as const;

    const response = await rpc.post('tools.ozone.moderation.emitEvent', {
        input: {
            createdBy: process.env.LABELER_DID! as `did:${string}:${string}`,
            subject: subject,
            event: {
                $type: 'tools.ozone.moderation.defs#modEventLabel',
                createLabelVals: label,
                negateLabelVals: [],
            },
        },
    });
}

export async function removeLabelForUser(target: string, label: string[]) {
    if (!manager.session) {
        await manager.login({ identifier: process.env.LABELER_DID || '', password: process.env.LABELER_APP_PASSWORD || '' });
    }

    const subject = {
        $type: 'com.atproto.admin.defs#repoRef',
        did: target as `did:${string}:${string}`,
    } as const;

    const response = await rpc.post('tools.ozone.moderation.emitEvent', {
        input: {
            createdBy: process.env.LABELER_DID! as `did:${string}:${string}`,
            subject: subject,
            event: {
                $type: 'tools.ozone.moderation.defs#modEventLabel',
                createLabelVals: [],
                negateLabelVals: label,
            },
        },
    });
}