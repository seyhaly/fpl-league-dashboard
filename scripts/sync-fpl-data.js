const fs = require('fs');
const path = require('path');

const LEAGUES = ['389585', '390100'];

const REAL_MANAGER_MAP = {
  2019453: { name: "Seyha ly", teamName: "The Red Devil" },
  2067578: { name: "Kun Phaktra", teamName: "The Blue Warriors" },
  2026160: { name: "Piseth Nhim", teamName: "DESSTRo" },
  2026484: { name: "Bora Chhe", teamName: "Bora's Team" },
  2024611: { name: "Vibol Dang", teamName: "The White Emperor" },
  2023789: { name: "Monor Noem", teamName: "NORA FC" },
  2023013: { name: "នរ សិង្ហ កន្សៃ", teamName: "G.O.A.T" },
  145847: { name: "Hokheng Ker", teamName: "Undefeated" }
};

const MONTHS_CONFIG = [
  { name: "August", gws: [1, 2, 3] },
  { name: "September", gws: [4, 5, 6] },
  { name: "October", gws: [7, 8, 9, 10] },
  { name: "November", gws: [11, 12, 13, 14] },
  { name: "December", gws: [15, 16, 17, 18, 19, 20] },
  { name: "January", gws: [21, 22, 23, 24] },
  { name: "February", gws: [25, 26, 27] },
  { name: "March", gws: [28, 29, 30] },
  { name: "April", gws: [31, 32, 33, 34] },
  { name: "May", gws: [35, 36, 37, 38] }
];

async function directFetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timer);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    clearTimeout(timer);
  }
  return null;
}

async function syncAll() {
  console.log('🔄 Starting automated FPL Direct Sync...');

  // 1. Fetch Bootstrap Static
  console.log('📥 Fetching Bootstrap Static...');
  const bsData = await directFetchJson('https://fantasy.premierleague.com/api/bootstrap-static/');
  let detectedGw = 1;
  const eventStatuses = {};
  const teamsMap = {};
  const playersMap = {};

  if (bsData) {
    if (bsData.teams) {
      bsData.teams.forEach(t => {
        teamsMap[t.id] = { id: t.id, name: t.name, short_name: t.short_name, code: t.code };
      });
    }

    if (bsData.elements) {
      bsData.elements.forEach(p => {
        playersMap[p.id] = {
          id: p.id,
          web_name: p.web_name,
          first_name: p.first_name || '',
          second_name: p.second_name || '',
          element_type: p.element_type, // 1: GK, 2: DEF, 3: MID, 4: FWD
          team: teamsMap[p.team]?.short_name || '',
          team_name: teamsMap[p.team]?.name || '',
          team_id: p.team,
          event_points: p.event_points || 0,
          now_cost: p.now_cost ? (p.now_cost / 10).toFixed(1) : '0.0'
        };
      });
    }

    if (bsData.events) {
      bsData.events.forEach(ev => {
        eventStatuses[ev.id] = {
          gw: ev.id,
          finished: ev.finished,
          data_checked: ev.data_checked,
          is_current: ev.is_current,
          is_previous: ev.is_previous,
          is_next: ev.is_next,
          deadline_time: ev.deadline_time,
          bonus_added: ev.finished || ev.data_checked,
          leagues: ev.data_checked ? 'Updated' : 'Updating'
        };
      });

      const activeEv = bsData.events.find(e => e.is_current);
      const nextEv = bsData.events.find(e => e.is_next);
      const prevEv = bsData.events.filter(e => e.finished).pop();

      if (activeEv) detectedGw = activeEv.id;
      else if (prevEv) detectedGw = prevEv.id;
      else if (nextEv) detectedGw = Math.max(1, nextEv.id - 1);
    }
  }

  // 2. Fetch Event Status, Fixtures & Live Event Stats
  console.log(`📥 Fetching Event Status, Fixtures & Live Event Stats for GW${detectedGw}...`);
  const [stData, fixData, liveEventData] = await Promise.all([
    directFetchJson('https://fantasy.premierleague.com/api/event-status/'),
    directFetchJson(`https://fantasy.premierleague.com/api/fixtures/?event=${detectedGw}`),
    directFetchJson(`https://fantasy.premierleague.com/api/event/${detectedGw}/live/`)
  ]);

  if (stData && stData.status) {
    stData.status.forEach(st => {
      if (eventStatuses[st.event]) {
        eventStatuses[st.event].bonus_added = st.bonus_added;
        eventStatuses[st.event].points = st.points;
      }
    });
    if (eventStatuses[detectedGw]) {
      eventStatuses[detectedGw].daily_status = stData.status.filter(s => s.event === detectedGw);
      eventStatuses[detectedGw].leagues = stData.leagues || 'Updated';
    }
  }

  const elStatsMap = {};
  if (liveEventData && liveEventData.elements && Array.isArray(liveEventData.elements)) {
    liveEventData.elements.forEach(el => {
      if (el && el.id && el.stats) {
        elStatsMap[el.id] = el.stats;
      }
    });
  }

  if (fixData && Array.isArray(fixData)) {
    const teamFixMap = {};
    fixData.forEach(f => {
      teamFixMap[f.team_h] = f;
      teamFixMap[f.team_a] = f;
    });

    Object.values(playersMap).forEach(pl => {
      const fix = teamFixMap[pl.team_id] || {};
      const st = elStatsMap[pl.id] || {};

      const fixStarted = fix.started === true;
      const fixFinished = fix.finished === true || (fix.minutes || 0) >= 90;
      const minutesPlayed = st.minutes !== undefined ? st.minutes : 0;
      const playedFlag = st.played === true || minutesPlayed > 0;

      // Determine Opponent & Fixture Difficulty Rating (FDR)
      let oppShort = '-';
      let difficulty = 3;
      if (fix && (fix.team_h || fix.team_a)) {
        const isHome = (pl.team_id === fix.team_h);
        const oppId = isHome ? fix.team_a : fix.team_h;
        difficulty = isHome ? fix.team_h_difficulty : fix.team_a_difficulty;
        const oppTeamObj = teamsMap[oppId] || {};
        oppShort = oppTeamObj.short_name || oppTeamObj.name || `Team #${oppId}`;
      }

      pl.opponent = oppShort;
      pl.opponent_short = oppShort;
      pl.difficulty = difficulty || 3;

      if (st.total_points !== undefined) {
        pl.event_points = st.total_points;
      }
      pl.minutes = minutesPlayed;

      if (!fixStarted) {
        pl.match_status = 'yet_to_play';
        pl.status_label = '⏳ Yet to Play';
      } else if (playedFlag || minutesPlayed > 0) {
        if (fixFinished) {
          pl.match_status = 'played';
          pl.status_label = '✓ Played';
        } else {
          pl.match_status = 'live';
          pl.status_label = `🟢 Live (${fix.minutes || 0}')`;
        }
      } else {
        if (fixFinished) {
          pl.match_status = 'dnp';
          pl.status_label = '✕ DNP (0m)';
        } else {
          pl.match_status = 'live';
          pl.status_label = `🟢 Live (${fix.minutes || 0}')`;
        }
      }
    });
  }

  const outputData = {
    lastUpdated: new Date().toISOString(),
    currentGw: detectedGw,
    eventStatuses: eventStatuses,
    teams: teamsMap,
    players: playersMap,
    squadPicks: {},
    transfersHistory: {},
    leagues: {}
  };

  // Preserve historical gameweek squad picks across new gameweeks
  const outPath = path.join(__dirname, '..', 'live_data.json');
  if (fs.existsSync(outPath)) {
    try {
      const prevData = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
      if (prevData && prevData.squadPicks) {
        outputData.squadPicks = prevData.squadPicks;
      }
    } catch (e) {}
  }

  // 3. Process each league
  for (const leagueId of LEAGUES) {
    console.log(`📥 Syncing League #${leagueId}...`);
    const standingsData = await directFetchJson(`https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`);
    
    let fetchedResults = [];
    let leagueName = leagueId === '390100' ? "Fantasy with Heng" : "Clash of Elite 2026-2027";

    if (standingsData && standingsData.league && standingsData.league.name) {
      leagueName = standingsData.league.name;
    }

    if (standingsData && standingsData.standings && standingsData.standings.results) {
      fetchedResults = standingsData.standings.results;
    } else if (standingsData && standingsData.new_entries && standingsData.new_entries.results) {
      fetchedResults = standingsData.new_entries.results;
    }

    if (fetchedResults.length === 0) {
      console.warn(`⚠️ No standings returned for league #${leagueId}, skipping.`);
      continue;
    }

    const managers = fetchedResults.map(r => {
      const name = REAL_MANAGER_MAP[r.entry]?.name || r.player_name || r.entry_name;
      const teamName = REAL_MANAGER_MAP[r.entry]?.teamName || r.entry_name;
      return {
        id: r.entry,
        name: name,
        teamName: teamName,
        avatar: name.substring(0, 2).toUpperCase()
      };
    });

    // Initialize 38 gameweeks
    const gameweeks = Array.from({ length: 38 }, (_, i) => ({
      gw: i + 1,
      scores: {},
      hits: {},
      transfers: {},
      benchPoints: {},
      captainPoints: {},
      chipsUsed: {},
      seasonTotals: {}
    }));

    // Populate current GW baseline from standings
    fetchedResults.forEach(r => {
      if (gameweeks[detectedGw - 1]) {
        gameweeks[detectedGw - 1].scores[r.entry] = r.event_total !== undefined ? r.event_total : 0;
        gameweeks[detectedGw - 1].seasonTotals[r.entry] = r.total !== undefined ? r.total : (r.event_total || 0);
      }
    });

    // Fetch individual manager details
    console.log(`📥 Fetching detailed history, picks & transfers for ${managers.length} managers in League #${leagueId}...`);
    for (const m of managers) {
      const histData = await directFetchJson(`https://fantasy.premierleague.com/api/entry/${m.id}/history/`);
      const picksData = await directFetchJson(`https://fantasy.premierleague.com/api/entry/${m.id}/event/${detectedGw}/picks/`);
      const transData = await directFetchJson(`https://fantasy.premierleague.com/api/entry/${m.id}/transfers/`);

      if (transData && Array.isArray(transData)) {
        outputData.transfersHistory[String(m.id)] = transData;
      }

      if (picksData) {
        if (!outputData.squadPicks[String(m.id)]) {
          outputData.squadPicks[String(m.id)] = {};
        }
        outputData.squadPicks[String(m.id)][String(detectedGw)] = {
          picks: picksData.picks || [],
          active_chip: picksData.active_chip || null,
          entry_history: picksData.entry_history || {},
          automatic_subs: picksData.automatic_subs || []
        };
      }

      if (histData && histData.current && Array.isArray(histData.current)) {
        histData.current.forEach(h => {
          const gNum = h.event;
          if (gNum >= 1 && gNum <= 38) {
            gameweeks[gNum - 1].scores[m.id] = h.points || 0;
            gameweeks[gNum - 1].hits[m.id] = h.event_transfers_cost || 0;
            gameweeks[gNum - 1].transfers[m.id] = h.event_transfers || 0;
            gameweeks[gNum - 1].benchPoints[m.id] = h.points_on_bench || 0;
            gameweeks[gNum - 1].seasonTotals[m.id] = h.total_points || 0;
          }
        });
      }

      if (histData && histData.chips && Array.isArray(histData.chips)) {
        histData.chips.forEach(c => {
          const gNum = c.event;
          if (gNum >= 1 && gNum <= 38) {
            gameweeks[gNum - 1].chipsUsed[m.id] = c.name;
          }
        });
      }

      if (picksData) {
        const currGwObj = gameweeks[detectedGw - 1];
        if (currGwObj) {
          if (picksData.active_chip) {
            currGwObj.chipsUsed[m.id] = picksData.active_chip;
          }
          if (picksData.entry_history) {
            if (picksData.entry_history.points !== undefined) currGwObj.scores[m.id] = picksData.entry_history.points;
            if (picksData.entry_history.event_transfers_cost !== undefined) currGwObj.hits[m.id] = picksData.entry_history.event_transfers_cost;
            let transCount = picksData.entry_history.event_transfers || 0;
            if (transCount === 0 && transData && Array.isArray(transData)) {
              const gwTrans = transData.filter(t => t.event === detectedGw);
              if (gwTrans.length > 0) transCount = gwTrans.length;
            }
            currGwObj.transfers[m.id] = transCount;
            if (picksData.entry_history.points_on_bench !== undefined) currGwObj.benchPoints[m.id] = picksData.entry_history.points_on_bench;
            if (picksData.entry_history.total_points !== undefined) currGwObj.seasonTotals[m.id] = picksData.entry_history.total_points;
          }
        }
      }
    }

    outputData.leagues[leagueId] = {
      leagueName,
      managers,
      gameweeks,
      months: MONTHS_CONFIG,
      currentGw: detectedGw
    };
  }

  const squadJsPath = path.join(__dirname, '..', 'squadData.js');
  fs.writeFileSync(squadJsPath, `window.FPL_LIVE_STATIC = ${JSON.stringify(outputData)};\n`, 'utf-8');
  fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2), 'utf-8');

  console.log(`✅ Automated FPL sync complete! Saved live data and pre-bundled squadData.js`);
}

syncAll().catch(err => {
  console.error('❌ Direct sync error:', err);
  process.exit(1);
});
