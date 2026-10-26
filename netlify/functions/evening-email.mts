/**
 * 5:30 PM New York, weekdays: email every route for tomorrow to the company list.
 * Off until ENABLE_AUTO_DISPATCH=true and CRON_SECRET are set in Netlify.
 * Netlify cron runs in UTC: 21:30 UTC is 5:30 PM EDT (4:30 PM EST in winter; change to 22 then).
 */
export default async () => {
  if (process.env.ENABLE_AUTO_DISPATCH !== "true") return console.log("evening-email: off (ENABLE_AUTO_DISPATCH is not true)");
  const site = (process.env.URL ?? "").replace(/\/$/, "");
  const response = await fetch(`${site}/api/cron/dispatch?step=email`, { method: "POST", headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" } });
  console.log(`evening-email: ${response.status} ${await response.text()}`);
};

export const config = { schedule: "30 21 * * 1-5" };
