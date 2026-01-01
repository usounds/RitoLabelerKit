import { NextResponse } from 'next/server';

export async function GET() {

  return NextResponse.json({
    // Must be a URL that will be exposing this metadata
    client_id: `https://${process.env.NEXT_PUBLIC_URL}/api/client-metadata.json`,
    client_name: `Rito Label Kit`,
    client_uri: `https://${process.env.NEXT_PUBLIC_URL}`,
    tos_uri: `https://${process.env.NEXT_PUBLIC_URL}/tos`,
    policy_uri: `https://${process.env.NEXT_PUBLIC_URL}/policy`,
    redirect_uris: [`https://${process.env.NEXT_PUBLIC_URL}/ja/callback`,`https://${process.env.NEXT_PUBLIC_URL}/en/callback`],
    grant_types: [`authorization_code`, `refresh_token`],
    scope: `atproto transition:generic identity:*`,
    response_types: [`code`],
    application_type: `web`,
    token_endpoint_auth_method: "none",
    dpop_bound_access_tokens: true,
  });
}