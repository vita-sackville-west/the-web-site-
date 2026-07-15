// Supabase Edge Function: send-push
//
// Triggered by a Database Webhook on INSERT into `messages`. Looks up the
// recipient's FCM token and sends a push via the FCM HTTP v1 API, with an
// explicit `apns` block so iOS shows a real system notification (sound +
// badge) even when the app is backgrounded or killed.
//
// Required secrets (set with `supabase secrets set`):
//   FIREBASE_PROJECT_ID       - Firebase project id
//   FIREBASE_SERVICE_ACCOUNT  - full service account JSON, as a single string
//   WEBHOOK_SECRET            - shared secret checked against the
//                               `x-webhook-secret` header set on the DB webhook

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID")!;
const FIREBASE_SERVICE_ACCOUNT = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!);
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = btoa(String.fromCharCode(...buf));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: FIREBASE_SERVICE_ACCOUNT.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encClaim = base64url(new TextEncoder().encode(JSON.stringify(claim)));
  const signingInput = `${encHeader}.${encClaim}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(FIREBASE_SERVICE_ACCOUNT.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const { access_token } = await res.json();
  return access_token;
}

async function sbFetch(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase REST error: ${res.status} ${await res.text()}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const row = payload.record;
  if (!row) return new Response("No record", { status: 400 });

  const matches = await sbFetch(
    `matches?id=eq.${row.match_id}&select=user_a,user_b`,
  );
  const match = matches[0];
  if (!match) return new Response("Match not found", { status: 404 });

  const recipientId = match.user_a === row.sender_id ? match.user_b : match.user_a;

  const users = await sbFetch(
    `users?id=in.(${recipientId},${row.sender_id})&select=id,name,username,push_token`,
  );
  const recipient = users.find((u: any) => u.id === recipientId);
  const sender = users.find((u: any) => u.id === row.sender_id);
  if (!recipient?.push_token) {
    return new Response("Recipient has no push token", { status: 200 });
  }

  const senderName = sender?.name || sender?.username || "Someone";
  const isBlip = row.content === "[BLIP]";
  const title = isBlip ? "Blip" : senderName;
  const body = isBlip ? `${senderName} sent you a blip` : row.content;

  const accessToken = await getAccessToken();
  const fcmRes = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: recipient.push_token,
          notification: { title, body },
          apns: {
            headers: {
              "apns-priority": "10",
              "apns-push-type": "alert",
            },
            payload: {
              aps: {
                alert: { title, body },
                sound: isBlip ? "blip.wav" : "default",
                badge: 1,
              },
            },
          },
          data: { match_id: String(row.match_id), type: isBlip ? "blip" : "message" },
        },
      }),
    },
  );

  if (!fcmRes.ok) {
    const errText = await fcmRes.text();
    console.error("FCM send failed:", fcmRes.status, errText);
    return new Response(errText, { status: 502 });
  }

  return new Response("OK", { status: 200 });
});
