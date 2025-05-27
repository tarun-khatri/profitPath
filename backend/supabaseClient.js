// backend/supabaseClient.js
// Modular Supabase client initialization

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test Supabase connection on startup
(async () => {
  const { error } = await supabase.from('tokens').select('*').limit(1);
  if (error && error.message.includes('does not exist')) {
    console.log('✅ Supabase connected, but tokens table does not exist yet.');
  } else if (error) {
    console.log('❌ Supabase connection failed:', error.message);
  } else {
    console.log('✅ Supabase connected successfully!');
  }
})();

module.exports = { supabase, app, PORT };
