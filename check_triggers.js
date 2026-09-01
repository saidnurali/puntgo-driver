require('dotenv').config({ path: '/Users/galayriya/Documents/punteats/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// Using anon key, we won't be able to query pg_trigger, but we can query order_alerts and notifications to see if they exist.
// We can also test RLS by inserting into orders if we have a test user, but maybe we can just query the tables.

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking order_alerts...");
  const { data: alerts, error: err1 } = await supabase.from('order_alerts').select('*').limit(1);
  console.log("order_alerts result:", err1 ? err1.message : "Success");

  console.log("Checking notifications...");
  const { data: notifs, error: err2 } = await supabase.from('notifications').select('*').limit(1);
  console.log("notifications result:", err2 ? err2.message : "Success");
}
check();
