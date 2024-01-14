import { KVSystem } from './lib/kv'
import { CryptoSystem } from './lib/crypto'
import { DriveFiles, DRIVE_SCOPE, GoogleSystem } from './lib/google'
import { redirect, findCookie } from './lib/http'
import { EnvSystem } from './lib/env'

function redirectToLogin(
  { oauthURL }: GoogleSystem,
  url: URL,
  additionalHeader?: HeadersInit,
): Response {
  const client_id = url.searchParams.get("client_id")
  if (!client_id) {
    return new Response("missing client_id", {status: 400})
  }
  const client_secret = url.searchParams.get("client_secret")
  if (!client_secret) {
    return new Response("missing client_secret", {status: 400})
  }

  const scope = url.searchParams.get("scope")
  if (!scope) {
    return new Response("missing scope", {status: 400})
  }

  const redidirectURI = url.origin + `/auth/${client_id}/${client_secret}`
  return redirect(
    oauthURL({
      client_id: client_id,
      redirect_uri: redidirectURI,
      response_type: 'code',
      scope: scope,
      // state: encodeURIComponent(url.search),
      prompt: 'consent',
      access_type: 'offline',
    }),
    additionalHeader,
  )
}

const MILLIS = 1000

export default function (
  kv: KVSystem,
  google: GoogleSystem,
  env: EnvSystem,
  crypto: CryptoSystem,
): (event: FetchEvent) => Promise<Response> {
  const { remove, get, save } = kv
  const { tokenExchange, removeToken, listDriveFiles } = google
  const { isLocal, now } = env
  const { generateAuth } = crypto

  return async function handleRequest(event: FetchEvent): Promise<Response> {
    const request = event.request

    const cfURL = new URL(request.url)
    const url = isLocal
      ? new URL('http://127.0.0.1:8787' + cfURL.pathname + cfURL.search)
      : cfURL

    if (url.pathname.startsWith('/auth/')) {
      const [,,client_id,client_secret] = url.pathname.split('/')
      const error = url.searchParams.get('error')
      if (error !== null)
        return new Response(`Google OAuth error: [${error}]`, { status: 400 })

      const code = url.searchParams.get('code')
      if (code === null)
        return new Response(`Bad auth callback (no 'code')`, { status: 400 })

      const tokenResponse = await tokenExchange(client_id, client_secret, url, code)
      // const newAuth = generateAuth()
      // const expiration = now() + tokenResponse.expires_in * MILLIS
      // await save(
      //   newAuth,
      //   tokenResponse.access_token,
      //   Math.floor(expiration / MILLIS),
      // )
      if (!tokenResponse.refresh_token) {
        return new Response(`Error: got no refresh_token! raw resp: ${tokenResponse}`, {status: 500})
      }

      return new Response(`${tokenResponse.refresh_token}`)
    }

    return redirectToLogin(google, url)
  }
}
