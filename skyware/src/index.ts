import { LabelerServer } from "@skyware/labeler";
import path from 'node:path';
import 'dotenv/config';

const port = parseInt(process.env.PORT || '8080');

const dbPath = process.env.DB_PATH
    ? path.join(process.env.DB_PATH, 'skyware.db') // DB_PATH がある場合
    : path.join(process.cwd(), 'data', 'skyware.db'); // ない場合はカレントディレクトリ/data/skyware.db

    const server = new LabelerServer({
    did: process.env.LABELER_DID || '',
    signingKey: process.env.LABELER_SIGNED_SEC_KEY || '',
    dbPath: dbPath
});

console.log(dbPath)

server.start(
    { port, host: '0.0.0.0' }, 
    (error, address) => {
        if (error) {
            console.error("Failed to start server:", error);
        } else {
            console.log(`Labeler server running at ${address}`);
        }
    }
);