// lib/zoom/client.ts
//
// ⚠️ SERVER-ONLY. Uses ZOOM_CLIENT_SECRET — never import this into a
// Client Component or any file bundled for the browser.
//
// Implements Zoom's Server-to-Server OAuth (account_credentials grant):
// https://developers.zoom.us/docs/internal-apps/s2s-oauth/
//
// Flow:
// 1. POST https://zoom.us/oauth/token?grant_type=account_credentials&account_id=...
// with `Authorization: Basic base64(client_id:client_secret)`
// -> { access_token, expires_in } (expires_in is always 3600 seconds;
// there is no refresh token for this grant type — just request a
// new token when the cached one is close to expiry)
// 2. POST https://api.zoom.us/v2/users/{userId}/meetings
// with `Authorization: Bearer <access_token>`
// (userId = ZOOM_HOST_EMAIL — S2S apps cannot use the "me" shortcut)

const ZOOM_OAUTH_URL = 'https://zoom.us/oauth/token'
const ZOOM_API_BASE = 'https://api.zoom.us/v2'

// Module-level cache. Survives across requests within the same warm
// serverless instance, which is exactly what we want — Zoom explicitly
// asks integrators not to mint a fresh token on every single API call.
// Worst case on a cold start is one extra token request, which is fine.
let cachedToken: { value: string; expiresAtMs: number } | null = null

class ZoomConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ZoomConfigError'
  }
}

export class ZoomApiError extends Error {
  status: number
  zoomCode?: number
  constructor(message: string, status: number, zoomCode?: number) {
    super(message)
    this.name = 'ZoomApiError'
    this.status = status
    this.zoomCode = zoomCode
  }
}

function readZoomEnv() {
  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET
  const hostEmail = process.env.ZOOM_HOST_EMAIL

  const missing = [
    !accountId && 'ZOOM_ACCOUNT_ID',
    !clientId && 'ZOOM_CLIENT_ID',
    !clientSecret && 'ZOOM_CLIENT_SECRET',
    !hostEmail && 'ZOOM_HOST_EMAIL',
  ].filter(Boolean)

  if (missing.length > 0) {
    throw new ZoomConfigError(
      `Missing Zoom environment variable(s): ${missing.join(', ')}. Set them in .env.local and in your Vercel project settings.`
    )
  }

  return { accountId: accountId!, clientId: clientId!, clientSecret: clientSecret!, hostEmail: hostEmail! }
}

/** * Returns a valid Zoom access token, reusing the cached one until 2 minutes * before it expires. Throws ZoomConfigError if env vars are missing, or * ZoomApiError if Zoom rejects the credentials. */
async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAtMs - now > 2 * 60 * 1000) {
    return cachedToken.value
  }

  const { accountId, clientId, clientSecret } = readZoomEnv()
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  let response: Response
  try {
    response = await fetch(
      `${ZOOM_OAUTH_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )
  } catch (networkErr) {
    throw new ZoomApiError(
      `Could not reach Zoom's authentication server (network error). ${ networkErr instanceof Error ? networkErr.message : '' }`,
      0
    )
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new ZoomApiError(
      `Zoom rejected the OAuth token request (HTTP ${response.status}). Double-check ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET, and confirm the Server-to-Server app is Activated in the Zoom Marketplace. Zoom said: ${body}`,
      response.status
    )
  }

  const json = (await response.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    value: json.access_token,
    expiresAtMs: now + json.expires_in * 1000,
  }
  return json.access_token
}

export interface CreateMeetingParams {
  topic: string
  /** ISO 8601 UTC datetime, e.g. 2026-07-04T08:00:00Z */
  startTimeIso: string
  durationMinutes: number
  agenda?: string
  /** Omit for a one-off meeting. Provide to create a Zoom "recurring * meeting with fixed time" (type 8) — occurrences share one stable * join_url/start_url, which is what lets us treat a weekly booking as * a single ongoing class rather than a new meeting every week. */
  recurrence?: {
    pattern: 'weekly' | 'biweekly'
    /** 0=Sunday..6=Saturday (JS Date convention — converted to Zoom's * 1=Sunday..7=Saturday convention internally). */
    dayOfWeek: number
    /** ISO date 'YYYY-MM-DD' the recurrence should stop on. */
    endDate: string
  }
}

export interface ZoomMeetingResult {
  id: number
  joinUrl: string
  startUrl: string
  password: string | null
}

/** * Creates a scheduled (or recurring, fixed-time) Zoom meeting under the * ZOOM_HOST_EMAIL account. Throws ZoomConfigError (missing env) or * ZoomApiError (Zoom rejected the request) — callers are expected to * catch these and roll back whatever booking record depended on the * meeting existing. */
export async function createZoomMeeting(params: CreateMeetingParams): Promise<ZoomMeetingResult> {
  const { hostEmail } = readZoomEnv()
  const token = await getAccessToken()

  const requestBody: Record<string, unknown> = {
    topic: params.topic,
    type: params.recurrence ? 8 : 2, // 8 = recurring w/ fixed time, 2 = single scheduled meeting
    // Must be a correct absolute UTC instant (see cairoWallTimeToUtcIso). Zoom documents
    // `yyyy-MM-ddTHH:mm:ssZ`, so drop the milliseconds that toISOString() adds.
    start_time: params.startTimeIso.replace(/\.\d{3}Z$/, 'Z'),
    duration: params.durationMinutes,
    timezone: 'Africa/Cairo', // display only — Zoom shows invitees this local time; the instant itself is fixed by start_time above
    agenda: params.agenda ?? '',
    settings: {
      host_video: true,
      participant_video: false,
      join_before_host: false,
      waiting_room: true,
      mute_upon_entry: true,
      approval_type: 2, // no registration required
      audio: 'both',
    },
  }

  if (params.recurrence) {
    requestBody.recurrence = {
      type: 2, // weekly
      repeat_interval: params.recurrence.pattern === 'biweekly' ? 2 : 1,
      weekly_days: String(params.recurrence.dayOfWeek + 1), // Zoom: Sunday=1..Saturday=7
      end_date_time: `${params.recurrence.endDate}T23:59:00Z`,
    }
  }

  let response: Response
  try {
    response = await fetch(
      `${ZOOM_API_BASE}/users/${encodeURIComponent(hostEmail)}/meetings`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    )
  } catch (networkErr) {
    throw new ZoomApiError(
      `Could not reach Zoom's API server (network error). ${ networkErr instanceof Error ? networkErr.message : '' }`,
      0
    )
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const zoomCode = body?.code as number | undefined
    const zoomMessage = body?.message as string | undefined

    if (response.status === 401) {
      // Token was rejected outright — drop the cache so the next attempt
      // fetches a fresh one instead of retrying with the same bad token.
      cachedToken = null
    }

    throw new ZoomApiError(
      zoomMessage
        ? `Zoom API error: ${zoomMessage}`
        : `Zoom API returned HTTP ${response.status} while creating the meeting.`,
      response.status,
      zoomCode
    )
  }

  const json = await response.json()
  return {
    id: json.id,
    joinUrl: json.join_url,
    startUrl: json.start_url,
    password: json.password ?? null,
  }
}

// ---------------------------------------------------------------------------
// Host ("start") links
// ---------------------------------------------------------------------------
// We deliberately do NOT store start_url in the database any more:
//  * it is the HOST link — anyone who can read it can run the meeting, and
//    RLS can only hide rows, not columns, so a student could read it;
//  * Zoom start URLs carry a short-lived token, so a stored copy goes stale.
// Instead the teacher opens /api/bookings/start, which calls this to fetch a
// fresh one and redirects to it.

async function zoomRequest(path: string, method: 'GET' | 'DELETE', retried = false): Promise<Response> {
  const token = await getAccessToken()
  let response: Response
  try {
    response = await fetch(`${ZOOM_API_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
  } catch (networkErr) {
    throw new ZoomApiError(
      `Could not reach Zoom's API server (network error). ${networkErr instanceof Error ? networkErr.message : ''}`,
      0
    )
  }
  if (response.status === 401 && !retried) {
    cachedToken = null // stale token — mint a new one and retry once
    return zoomRequest(path, method, true)
  }
  return response
}

/** Returns a fresh host start URL for an existing meeting. */
export async function getZoomStartUrl(meetingId: string): Promise<string> {
  const response = await zoomRequest(`/meetings/${encodeURIComponent(meetingId)}`, 'GET')
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ZoomApiError(
      body?.message ? `Zoom API error: ${body.message}` : `Zoom API returned HTTP ${response.status} while reading the meeting.`,
      response.status,
      body?.code
    )
  }
  const json = await response.json()
  if (!json.start_url) throw new ZoomApiError('Zoom did not return a start_url for this meeting.', 502)
  return json.start_url as string
}

/** Deletes a meeting. A meeting that is already gone (404) counts as success. */
export async function deleteZoomMeeting(meetingId: string): Promise<void> {
  const response = await zoomRequest(`/meetings/${encodeURIComponent(meetingId)}`, 'DELETE')
  if (response.ok || response.status === 404) return
  const body = await response.json().catch(() => null)
  throw new ZoomApiError(
    body?.message ? `Zoom API error: ${body.message}` : `Zoom API returned HTTP ${response.status} while deleting the meeting.`,
    response.status,
    body?.code
  )
}
