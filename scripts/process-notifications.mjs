const baseUrl = process.env.SKUDA_APP_URL?.trim().replace(/\/+$/, "");
const secret = process.env.NOTIFICATION_WORKER_SECRET;

if (!baseUrl || !secret) {
  console.error(
    "Missing required environment variables: SKUDA_APP_URL and NOTIFICATION_WORKER_SECRET.",
  );
  process.exit(1);
}

let endpoint;

try {
  endpoint = new URL("/api/internal/notifications/process", baseUrl);
} catch {
  console.error("SKUDA_APP_URL must be a valid absolute URL.");
  process.exit(1);
}

if (!["http:", "https:"].includes(endpoint.protocol)) {
  console.error("SKUDA_APP_URL must use HTTP or HTTPS.");
  process.exit(1);
}

try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });

  const body = await response.text();

  if (!response.ok) {
    console.error(`Notification worker failed with HTTP ${response.status}.`);
    if (body) console.error(body.slice(0, 2000));
    process.exit(1);
  }

  try {
    console.log(JSON.stringify(JSON.parse(body), null, 2));
  } catch {
    console.log(body || "Notification worker completed.");
  }
} catch (error) {
  console.error(
    `Notification worker request failed: ${
      error instanceof Error ? error.message : "Unknown error"
    }`,
  );
  process.exit(1);
}
