const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://bftsfgoenlgflhpfrqgf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdHNmZ29lbmxnZmxocGZycWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MTM5NzQsImV4cCI6MjEwMDE4OTk3NH0.2LSDT2ZD_yFtjTWINJa72KKiZSH0fw-hERTUX08YeQ4";

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking order_alerts reading (RLS anon)...");
  const { data: alerts, error: err1 } = await supabase.from('order_alerts').select('id').limit(1);
  console.log("order_alerts read:", err1 ? err1.message : "Success");

  console.log("Checking notifications reading (RLS anon)...");
  const { data: notifs, error: err2 } = await supabase.from('notifications').select('id').limit(1);
  console.log("notifications read:", err2 ? err2.message : "Success");
}
check();
