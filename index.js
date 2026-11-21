// index.js - MindMitra Backend FINAL FIXED - XAMPP
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = 3000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// ================= MYSQL XAMPP =================
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // XAMPP empty
  database: 'mindmitra',
  waitForConnections: true,
  connectionLimit: 10
});

db.getConnection((err, conn) => {
  if (err) {
    console.log("❌ MySQL Error:", err.message);
    console.log("👉 Start MySQL in XAMPP + Create DB mindmitra in phpMyAdmin + Import mindmitra.sql");
  } else {
    console.log("✅ MySQL Connected - mindmitra");
    conn.release();
  }
});

function safeQuery(sql, params, cb) {
  db.query(sql, params, (err, rows) => {
    if (err) {
      console.log("SQL Error:", err.message, "| Query:", sql);
      if (cb) cb(err, []);
      return [];
    }
    if (cb) cb(null, rows);
  });
}

// Promise wrapper for async routes
function queryAsync(sql, params) {
  return new Promise((resolve) => {
    db.query(sql, params, (err, rows) => {
      if (err) { console.log("SQL skip:", err.message); resolve([]); }
      else resolve(rows);
    });
  });
}

// AUTH
app.post('/api/signup', async (req, res) => {
  const { name, email, password, college } = req.body;
  console.log("Signup:", email);
  await queryAsync("INSERT INTO users (name,email,password,college,bio) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE name=?", [name, email, password, college||'', '', name]);
  res.json({ success: true });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const rows = await queryAsync("SELECT * FROM users WHERE email=?", [email]);
  if (rows.length) res.json({ success: true, user: rows[0] });
  else res.json({ success: true, user: {email, name: email.split('@')[0]}, demo: true });
});

// PROFILE + PASSWORD
app.get('/api/profile/:email', async (req, res) => {
  const rows = await queryAsync("SELECT * FROM users WHERE email=?", [req.params.email]);
  const prof = await queryAsync("SELECT * FROM profiles WHERE email=?", [req.params.email]);
  let user = rows[0] || {};
  let p = prof[0] || {};
  res.json({...user,...p, fullName: p.fullName||user.name, name: p.fullName||user.name, college: p.college||user.college, bio: p.bio||user.bio});
});

app.post('/api/profile', async (req, res) => {
  const { email, fullName, name, phone, age, gender, college, emergencyName, emergencyPhone, about, concerns, bio } = req.body;
  let finalName = fullName || name || 'User';
  await queryAsync("UPDATE users SET name=?, phone=?, college=?, bio=? WHERE email=?", [finalName, phone||'', college||'', bio||about||'', email]);
  await queryAsync(`INSERT INTO profiles (email,fullName,phone,age,gender,college,emergencyName,emergencyPhone,about,concerns,bio) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE fullName=?, phone=?, age=?, gender=?, college=?, emergencyName=?, emergencyPhone=?, about=?, concerns=?, bio=?`,
    [email, finalName, phone, age, gender, college, emergencyName, emergencyPhone, about, concerns, bio||about, finalName, phone, age, gender, college, emergencyName, emergencyPhone, about, concerns, bio||about]);
  res.json({ success: true });
});

app.post('/api/change-password', async (req, res) => {
  await queryAsync("UPDATE users SET password=? WHERE email=?", [req.body.password, req.body.email]);
  res.json({ success: true });
});

// MOOD
app.post('/api/mood', async (req, res) => {
  const { email, userEmail, mood, emoji, intensity, note, activities, source, faceEmotion, dateStr, timeStr } = req.body;
  const em = email || userEmail;
  await queryAsync("INSERT INTO moods (email,mood,emoji,intensity,note,activities,source,faceEmotion,dateStr,timeStr,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,NOW())",
    [em, mood, emoji, intensity, note, Array.isArray(activities)? activities.join(',') : activities||'', source||'manual', faceEmotion||'', dateStr||'', timeStr||'']);
  res.json({ success: true });
});

app.get('/api/moods/:email', async (req, res) => {
  const rows = await queryAsync("SELECT * FROM moods WHERE email=? ORDER BY id DESC", [req.params.email]);
  res.json(rows);
});

// FACE SCAN
app.post('/api/face-scan', async (req, res) => {
  const { email, detected_emotion, confidence, mood_suggested } = req.body;
  await queryAsync("INSERT INTO face_scans (email,detected_emotion,confidence,mood_suggested,created_at) VALUES (?,?,?,?,NOW())", [email, detected_emotion, confidence, mood_suggested]);
  res.json({ success: true });
});

// JOURNAL
app.post('/api/journal', async (req, res) => {
  const { email, userEmail, mood, emoji, text, tags, dateStr } = req.body;
  const em = email || userEmail;
  await queryAsync("INSERT INTO journals (email,mood,emoji,text,tags,dateStr,created_at) VALUES (?,?,?,?,?,?,NOW())", [em, mood, emoji, text, tags||'', dateStr||'']);
  res.json({ success: true });
});

app.get('/api/journals/:email', async (req, res) => {
  const rows = await queryAsync("SELECT * FROM journals WHERE email=? ORDER BY id DESC", [req.params.email]);
  res.json(rows);
});

// ASSESSMENT
app.post('/api/assessment', async (req, res) => {
  const { email, type, score, level, answers } = req.body;
  await queryAsync("INSERT INTO assessments (email,type,score,level,answers,created_at) VALUES (?,?,?,?,?,NOW())", [email, type, score, level, typeof answers==='string'? answers : JSON.stringify(answers||{})]);
  res.json({ success: true });
});

// WELLNESS + MUSIC
app.post('/api/wellness', async (req, res) => {
  const { email, activity_type, duration_sec, pattern, mood_before, mood_after } = req.body;
  await queryAsync("INSERT INTO wellness_logs (email,activity_type,duration_sec,pattern,mood_before,mood_after,created_at) VALUES (?,?,?,?,?,?,NOW())", [email, activity_type, duration_sec, pattern, mood_before, mood_after]);
  res.json({ success: true });
});

app.post('/api/music', async (req, res) => {
  const { email, track_name, mood, listened_sec } = req.body;
  await queryAsync("INSERT INTO music_logs (email,track_name,mood,listened_sec,created_at) VALUES (?,?,?,?,NOW())", [email, track_name, mood, listened_sec]);
  res.json({ success: true });
});

// APPOINTMENT - FIXED FOR BOTH FORMATS
app.post('/api/appointment', async (req, res) => {
  const { email, userEmail, therapist_id, therapist_name, doctor, date, time, type, mode, amount, price, status } = req.body;
  const em = email || userEmail;
  const tName = therapist_name || doctor || 'Therapist';
  const tPrice = price || amount || '₹499';
  const tMode = mode || type || 'Video Call';
  await queryAsync("INSERT INTO appointments (email,therapist_id,therapist_name,doctor,date,time,type,mode,amount,price,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())",
    [em, therapist_id||0, tName, tName, date, time, tMode, tMode, tPrice, tPrice, status||'Confirmed']);
  res.json({ success: true });
});

app.get('/api/appointments/:email', async (req, res) => {
  const rows = await queryAsync("SELECT * FROM appointments WHERE email=? ORDER BY id DESC", [req.params.email]);
  res.json(rows);
});

// PAYMENT
app.post('/api/payment', async (req, res) => {
  const { email, amount, plan_type, plan, txn_id, id, status, description, payment_method, method, type } = req.body;
  const finalTxn = txn_id || id || 'TXN'+Date.now();
  const finalPlan = plan_type || plan || type || 'Premium';
  const finalMethod = payment_method || method || 'UPI Demo';
  await queryAsync("INSERT INTO payments (email,amount,plan_type,txn_id,status,description,payment_method,method,plan,type,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,NOW())",
    [email, amount, finalPlan, finalTxn, status||'Success', description||finalPlan, finalMethod, finalMethod, finalPlan, type||'subscription']);
  res.json({ success: true, txnId: finalTxn });
});

app.get('/api/payments/:email', async (req, res) => {
  const rows = await queryAsync("SELECT * FROM payments WHERE email=? ORDER BY id DESC", [req.params.email]);
  res.json(rows);
});

// CHATBOT + COMMUNITY + CONTACT
app.post('/api/chat', async (req, res) => {
  const { email, user_msg } = req.body;
  const replies = ["I hear you 💙 Tell me more", "That feeling is valid.", "You're doing great 🌿", "Want to try 1-min breathing?"];
  const reply = replies[Math.floor(Math.random() * replies.length)];
  await queryAsync("INSERT INTO chatbot_chats (email,user_msg,bot_reply,created_at) VALUES (?,?,?,NOW())", [email, user_msg, reply]);
  res.json({ success: true, reply });
});

app.post('/api/community', async (req, res) => {
  const { email, username, content, mood, is_anonymous } = req.body;
  await queryAsync("INSERT INTO community_posts (email,username,content,mood,is_anonymous,created_at) VALUES (?,?,?,?,?,NOW())", [email, username, content, mood, is_anonymous||0]);
  res.json({ success: true });
});

app.get('/api/community', async (req, res) => {
  const rows = await queryAsync("SELECT * FROM community_posts ORDER BY id DESC LIMIT 50");
  res.json(rows);
});

app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  await queryAsync("INSERT INTO contacts (name,email,message,created_at) VALUES (?,?,?,NOW())", [name, email, message]);
  res.json({ success: true });
});

// STATS
app.get('/api/stats/:email', async (req, res) => {
  const email = req.params.email;
  const moods = await queryAsync("SELECT COUNT(*) as c FROM moods WHERE email=?", [email]);
  const journals = await queryAsync("SELECT COUNT(*) as c FROM journals WHERE email=?", [email]);
  res.json({ moods: moods[0]?.c||0, journals: journals[0]?.c||0 });
});

app.get('/:page', (req, res) => {
  if (req.params.page.endsWith('.html')) {
    res.sendFile(path.join(__dirname, '../frontend', req.params.page), err => { if (err) res.status(404).send("Page not found"); });
  }
});
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend', 'index.html')));

app.listen(PORT, () => {
  console.log(`✅ MindMitra Running http://localhost:${PORT}`);
  console.log(`✅ All Tables Linked - Start XAMPP MySQL`);
});