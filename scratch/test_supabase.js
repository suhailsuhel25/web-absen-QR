import { createClient } from '@supabase/supabase-js';

const url = "https://sxgjhivrclawaxqtphge.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4Z2poaXZyY2xhd2F4cXRwaGdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MTA0NzMsImV4cCI6MjA5NTk4NjQ3M30.rd08pRa9ejcXEpthch1Zqf29HQqXeKbOnxFY_HVKxxs";

const supabase = createClient(url, key);

async function test() {
  console.log("Querying profiles...");
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.error("Error fetching profiles:", error);
  } else {
    console.log("Success! Profiles count:", data.length);
    console.log("Profiles:", data);
  }
}

test();
