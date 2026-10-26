/**
 * 5:00 PM New York, weekdays: text each driver tomorrow's route.
 * Off until ENABLE_AUTO_DISPATCH=true and CRON_SECRET are set in Netlify.
 * Netlify cron runs in UTC: 21:00 UTC is 5 PM EDT (4 PM EST in winter; change to 22 then).
 */
export default async () => {
  if (process.env.ENABLE_AUTO_DISPATCH !== "true") return console.log("evening-texts: off (ENABLE_AUTO_DISPATCH is not true)");
  const site = (process.env.URL ?? "").replace(/\/$/, "");
  const response = await fetch(`${site}/api/cron/dispatch?step=texts`, { method: "POST", headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" } });
  console.log(`evening-texts: ${response.status} ${await response.text()}`);
};

export const config = { schedule: "0 21 * * 1-5" };
