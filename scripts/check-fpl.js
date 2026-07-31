const fs = require('fs');
const path = require('path');

let demoData;
try {
  demoData = require('../demoData.js');
} catch (e) {
  demoData = null;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL;
const FPL_LEAGUE_ID = process.env.FPL_LEAGUE_ID || 'demo';

if (!RESEND_API_KEY || !NOTIFICATION_EMAIL) {
  console.error('❌ Missing RESEND_API_KEY or NOTIFICATION_EMAIL environment variables.');
  process.exit(1);
}

async function run() {
  console.log(`🔍 Checking FPL status for League: ${FPL_LEAGUE_ID}...`);

  let leagueName = "Clash of Elite Fantasy League (Demo)";
  let managers = [];
  let currentGw = 10;
  let gameweeks = [];
  let isDemoMode = false;

  // Try fetching live FPL API if numeric league ID
  if (/^\d+$/.test(FPL_LEAGUE_ID.trim())) {
    try {
      const resp = await fetch(`https://fantasy.premierleague.com/api/leagues-classic/${FPL_LEAGUE_ID.trim()}/standings/`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.standings && data.standings.results && data.standings.results.length > 0) {
          leagueName = data.league?.name || `League #${FPL_LEAGUE_ID}`;
          managers = data.standings.results.map(r => ({
            id: r.entry,
            name: r.player_name,
            teamName: r.entry_name
          }));

          // Fetch static bootstrap for current GW
          const bootResp = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
          if (bootResp.ok) {
            const bootData = await bootResp.json();
            const currentEvent = bootData.events.find(e => e.is_current) || bootData.events.find(e => e.is_next);
            if (currentEvent) currentGw = currentEvent.id;
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch live FPL API, falling back to Demo dataset:', err.message);
    }
  }

  // Fallback to Demo Data if no live managers found (e.g. pre-season or join code like 8d70fl)
  if (managers.length === 0 && demoData) {
    console.log('📌 Using Demo League dataset for email preview...');
    isDemoMode = true;
    leagueName = demoData.leagueName || "Clash of Elite Fantasy League";
    managers = demoData.managers;
    currentGw = 10;
    gameweeks = demoData.gameweeks;
  }

  if (managers.length === 0) {
    console.error('❌ No manager data available to send email.');
    process.exit(1);
  }

  // Compute Gameweek Standings & Payouts for currentGw
  const gwData = gameweeks.find(g => g.gw === currentGw) || gameweeks[gameweeks.length - 1];
  const entryFee = 3.00;
  const total = managers.length;
  const splitSize = Math.floor(total / 2);
  const hasNeutral = total % 2 === 1;
  const neutralRank = hasNeutral ? splitSize + 1 : null;

  let standings = managers.map(m => {
    const gross = gwData && gwData.scores ? (gwData.scores[m.id] || 0) : 0;
    const hit = gwData && gwData.hits ? (gwData.hits[m.id] || 0) : 0;
    const net = gross - hit;
    return { ...m, gross, hit, net };
  });

  standings.sort((a, b) => b.net - a.net);

  standings = standings.map((m, idx) => {
    const rank = idx + 1;
    let payout = 0;
    let badgeHtml = '';

    if (rank <= splitSize) {
      payout = entryFee;
      badgeHtml = `<span style="color:#10b981;font-weight:bold;">+$${payout}.00</span>`;
    } else if (hasNeutral && rank === neutralRank) {
      payout = 0;
      badgeHtml = `<span style="color:#94a3b8;font-weight:bold;">$0.00</span>`;
    } else {
      payout = -entryFee;
      badgeHtml = `<span style="color:#ef4444;font-weight:bold;">-$${Math.abs(payout)}.00</span>`;
    }
    return { ...m, rank, payout, badgeHtml };
  });

  const winnerName = standings[0] ? standings[0].name : "N/A";
  const topScore = standings[0] ? standings[0].net : 0;

  // Build HTML Email Template
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #e2e8f0; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #131b2e; border-radius: 12px; padding: 24px; border: 1px solid #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #1e293b; }
        .title { color: #04f5ff; font-size: 22px; font-weight: 800; margin: 0 0 6px 0; }
        .subtitle { color: #94a3b8; font-size: 14px; margin: 0; }
        .banner { background: linear-gradient(135deg, #0ea5e9, #6366f1); border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; color: #ffffff; }
        .banner-icon { font-size: 28px; margin-bottom: 4px; }
        .banner-title { font-size: 12px; font-weight: bold; letter-spacing: 1px; opacity: 0.9; }
        .banner-name { font-size: 20px; font-weight: 900; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #0f172a; color: #94a3b8; font-size: 11px; text-transform: uppercase; padding: 10px; text-align: left; }
        td { padding: 12px 10px; border-bottom: 1px solid #1e293b; font-size: 14px; }
        .rank { font-weight: bold; text-align: center; width: 30px; }
        .manager-name { font-weight: bold; color: #f8fafc; }
        .team-name { font-size: 12px; color: #64748b; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #64748b; }
        .demo-tag { background: #eab308; color: #000; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${isDemoMode ? '<div class="demo-tag">DEMO PREVIEW DATA</div><br>' : ''}
          <h1 class="title">${leagueName}</h1>
          <p class="subtitle">Gameweek ${currentGw} Official Results & Payout Summary</p>
        </div>

        <div class="banner">
          <div class="banner-icon">🏆</div>
          <div class="banner-title">GAMEWEEK ${currentGw} WINNER</div>
          <div class="banner-name">${winnerName} (${topScore} pts)</div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="rank">Pos</th>
              <th>Manager & Team</th>
              <th class="text-center">Net Pts</th>
              <th class="text-right">Payout</th>
            </tr>
          </thead>
          <tbody>
            ${standings.map(m => `
              <tr>
                <td class="rank">${m.rank}</td>
                <td>
                  <div class="manager-name">${m.name}</div>
                  <div class="team-name">${m.teamName}</div>
                </td>
                <td class="text-center" style="font-weight:bold;color:#04f5ff;">${m.net}</td>
                <td class="text-right">${m.badgeHtml}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Sent automatically by FPL Private League Dashboard Notifier.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Send Email via Resend API
  console.log(`📧 Sending email notification to ${NOTIFICATION_EMAIL}...`);
  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'FPL Dashboard <onboarding@resend.dev>',
      to: [NOTIFICATION_EMAIL],
      subject: `🏆 Gameweek ${currentGw} Results: ${leagueName}`,
      html: emailHtml
    })
  });

  if (resendResp.ok) {
    const resData = await resendResp.json();
    console.log('✅ Email sent successfully! ID:', resData.id);
  } else {
    const errText = await resendResp.text();
    console.error('❌ Failed to send email via Resend:', errText);
    process.exit(1);
  }
}

run();
