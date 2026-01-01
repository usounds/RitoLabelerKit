import { configureOAuth } from '@atcute/oauth-browser-client';
import {
  CompositeDidDocumentResolver,
  LocalActorResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  XrpcHandleResolver
} from '@atcute/identity-resolver';

export function initOAuth(locale?: string) {
  configureOAuth({
    metadata: {
      client_id: `https://${process.env.NEXT_PUBLIC_URL}/api/client-metadata.json`,
      redirect_uri: `https://${process.env.NEXT_PUBLIC_URL}/${locale || ''}/callback`,
    },
    identityResolver: identityResolver,
  });
}


export function isPlcOrWebDid(
  did: string
): did is `did:plc:${string}` | `did:web:${string}` {
  return did.startsWith("did:plc:") || did.startsWith("did:web:");
}

export const handleResolver = new XrpcHandleResolver({ serviceUrl: 'https://public.api.bsky.app' })

export const didDocumentResolver = new CompositeDidDocumentResolver({
  methods: {
    plc: new PlcDidDocumentResolver(),
    web: new WebDidDocumentResolver(),
  },
})

export const identityResolver = new LocalActorResolver({
  handleResolver: handleResolver,
  didDocumentResolver: didDocumentResolver,
});