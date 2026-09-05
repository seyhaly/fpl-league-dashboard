#!/usr/bin/env python3
import json
import os
import sys
import urllib.request
from datetime import datetime

LEAGUES = ['389585', '390100']

REAL_MANAGER_MAP = {
    2019453: {"name": "Seyha ly", "teamName": "The Red Devil"},
    2067578: {"name": "Kun Phaktra", "teamName": "The Blue Warriors"},
    2026160: {"name": "Piseth Nhim", "teamName": "DESSTRo"},
    2026484: {"name": "Bora Chhe", "teamName": "Bora's Team"},
    2024611: {"name": "Vibol Dang", "teamName": "The White Emperor"},
    2023789: {"name": "Monor Noem", "teamName": "NORA FC"},
    2023013: {"name": "នរ សិង្ហ កន្សៃ", "teamName": "G.O.A.T"},
    145847: {"name": "Hokheng Ker", "teamName": "Undefeated"}
}

MONTHS_CONFIG = [
    {"name": "August", "gws": [1, 2]},
    {"name": "September", "gws": [3, 4, 5]},
    {"name": "October", "gws": [6, 7, 8, 9]},
    {"name": "November", "gws": [10, 11, 12]},
    {"name": "December", "gws": [13, 14, 15, 16, 17, 18]},
    {"name": "January", "gws": [19, 20, 21, 22, 23]},
    {"name": "February", "gws": [24, 25, 26, 27]},
    {"name": "March", "gws": [28, 29, 30]},
    {"name": "April", "gws": [31, 32, 33]},
    {"name": "May", "gws": [34, 35, 36, 37, 38]}
]

def compute_months_from_events(events):
    from datetime import datetime
    month_dict = {}
    for ev in events:
        gw_id = ev.get('id')
        dl = ev.get('deadline_time')
        if not gw_id or not dl:
            continue
        try:
            dt = datetime.fromisoformat(dl.replace('Z', '+00:00'))
            m_name = dt.strftime('%B')
            m_key = (dt.year, dt.month, m_name)
            if m_key not in month_dict:
                month_dict[m_key] = []
            month_dict[m_key].append(gw_id)
        except Exception:
            continue
    
    if month_dict:
        res = []
        for (year, m_num, m_name), gws in sorted(month_dict.items()):
            res.append({"name": m_name, "gws": gws})
        return res
    return MONTHS_CONFIG

def fetch_json(url, timeout=10):
    try:
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"⚠️ Fetch failed for {url}: {e}", file=sys.stderr)
    return None

def main():
    print("🔄 Starting automated FPL Direct Python Sync...")
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    live_data_path = os.path.join(base_dir, 'live_data.json')
    squad_data_path = os.path.join(base_dir, 'squadData.js')

    # 1. Fetch Bootstrap Static
    print("📥 Fetching Bootstrap Static...")
    bs_data = fetch_json('https://fantasy.premierleague.com/api/bootstrap-static/')
    if not bs_data:
        print("❌ Could not fetch bootstrap-static", file=sys.stderr)
        sys.exit(1)

    detected_gw = 1
    calculated_months = compute_months_from_events(bs_data.get('events', []))
    event_statuses = {}
    teams_map = {}
    players_map = {}

    if 'teams' in bs_data:
        for t in bs_data['teams']:
            teams_map[str(t['id'])] = {
                'id': t['id'],
                'name': t['name'],
                'short_name': t['short_name'],
                'code': t['code']
            }

    if 'elements' in bs_data:
        for p in bs_data['elements']:
            team_obj = teams_map.get(str(p['team']), {})
            players_map[str(p['id'])] = {
                'id': p['id'],
                'web_name': p.get('web_name', ''),
                'first_name': p.get('first_name', ''),
                'second_name': p.get('second_name', ''),
                'element_type': p.get('element_type', 1),
                'team': team_obj.get('short_name', ''),
                'team_name': team_obj.get('name', ''),
                'team_id': p.get('team'),
                'event_points': p.get('event_points', 0),
                'now_cost': f"{p.get('now_cost', 0) / 10:.1f}"
            }

    if 'events' in bs_data:
        for ev in bs_data['events']:
            event_statuses[str(ev['id'])] = {
                'gw': ev['id'],
                'finished': ev.get('finished', False),
                'data_checked': ev.get('data_checked', False),
                'is_current': ev.get('is_current', False),
                'is_previous': ev.get('is_previous', False),
                'is_next': ev.get('is_next', False),
                'deadline_time': ev.get('deadline_time', ''),
                'bonus_added': ev.get('finished', False) or ev.get('data_checked', False),
                'leagues': 'Updated' if ev.get('data_checked') else 'Updating'
            }

        active_ev = next((e for e in bs_data['events'] if e.get('is_current')), None)
        next_ev = next((e for e in bs_data['events'] if e.get('is_next')), None)
        prev_evs = [e for e in bs_data['events'] if e.get('finished')]
        prev_ev = prev_evs[-1] if prev_evs else None

        if active_ev:
            detected_gw = active_ev['id']
        elif prev_ev:
            detected_gw = prev_ev['id']
        elif next_ev:
            detected_gw = max(1, next_ev['id'] - 1)

    # 2. Fetch Event Status, Fixtures & Live Event Stats
    print(f"📥 Fetching Event Status, Fixtures & Live Event Stats for GW{detected_gw}...")
    st_data = fetch_json('https://fantasy.premierleague.com/api/event-status/')
    fix_data = fetch_json(f'https://fantasy.premierleague.com/api/fixtures/?event={detected_gw}')
    live_event_data = fetch_json(f'https://fantasy.premierleague.com/api/event/{detected_gw}/live/')

    if st_data and 'status' in st_data:
        for st in st_data['status']:
            ev_id = str(st.get('event'))
            if ev_id in event_statuses:
                event_statuses[ev_id]['bonus_added'] = st.get('bonus_added', False)
                event_statuses[ev_id]['points'] = st.get('points', '')
        if str(detected_gw) in event_statuses:
            event_statuses[str(detected_gw)]['daily_status'] = [s for s in st_data['status'] if s.get('event') == detected_gw]
            event_statuses[str(detected_gw)]['leagues'] = st_data.get('leagues', 'Updated')

    el_stats_map = {}
    if live_event_data and 'elements' in live_event_data and isinstance(live_event_data['elements'], list):
        for el in live_event_data['elements']:
            if el and 'id' in el and 'stats' in el:
                el_stats_map[str(el['id'])] = el['stats']

    if fix_data and isinstance(fix_data, list):
        team_fix_map = {}
        for f in fix_data:
            team_fix_map[f.get('team_h')] = f
            team_fix_map[f.get('team_a')] = f

        for pl_id, pl in players_map.items():
            team_id = pl.get('team_id')
            fix = team_fix_map.get(team_id, {})
            st = el_stats_map.get(pl_id, {})

            fix_started = fix.get('started') is True
            fix_finished = fix.get('finished') is True or fix.get('minutes', 0) >= 90
            minutes_played = st.get('minutes', pl.get('minutes', 0))
            played_flag = st.get('played') is True or minutes_played > 0

            # Determine Opponent & Fixture Difficulty Rating (FDR)
            opp_short = '-'
            difficulty = 3
            if fix and (fix.get('team_h') or fix.get('team_a')):
                is_home = (team_id == fix.get('team_h'))
                opp_id = fix.get('team_a') if is_home else fix.get('team_h')
                difficulty = fix.get('team_h_difficulty') if is_home else fix.get('team_a_difficulty')
                opp_team_obj = teams_map.get(str(opp_id), {})
                opp_short = opp_team_obj.get('short_name') or opp_team_obj.get('name') or f"Team #{opp_id}"
            
            pl['opponent'] = opp_short
            pl['opponent_short'] = opp_short
            pl['difficulty'] = difficulty or 3

            if 'total_points' in st:
                pl['event_points'] = st['total_points']
            pl['minutes'] = minutes_played

            if not fix_started:
                pl['match_status'] = 'yet_to_play'
                pl['status_label'] = '⏳ Yet to Play'
            elif played_flag or minutes_played > 0:
                if fix_finished:
                    pl['match_status'] = 'played'
                    pl['status_label'] = '✓ Played'
                else:
                    pl['match_status'] = 'live'
                    pl['status_label'] = f"🟢 Live ({fix.get('minutes', 0)}')"
            else:
                if fix_finished:
                    pl['match_status'] = 'dnp'
                    pl['status_label'] = '✕ DNP (0m)'
                else:
                    pl['match_status'] = 'live'
                    pl['status_label'] = f"🟢 Live ({fix.get('minutes', 0)}')"

    # 2.5 Fetch historical and live event player points for all gameweeks
    print(f"📥 Fetching Player points for GW1 to GW{detected_gw}...")
    player_gw_points = {}
    for g in range(1, detected_gw + 1):
        live_g_data = fetch_json(f'https://fantasy.premierleague.com/api/event/{g}/live/')
        if live_g_data and 'elements' in live_g_data and isinstance(live_g_data['elements'], list):
            player_gw_points[str(g)] = {
                str(el['id']): el.get('stats', {}).get('total_points', 0)
                for el in live_g_data['elements'] if el and 'id' in el and 'stats' in el
            }

    output_data = {
        "lastUpdated": datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        "currentGw": detected_gw,
        "eventStatuses": event_statuses,
        "teams": teams_map,
        "players": players_map,
        "playerGwPoints": player_gw_points,
        "squadPicks": {},
        "transfersHistory": {},
        "leagues": {}
    }

    # Load existing squad picks history if available
    if os.path.exists(live_data_path):
        try:
            with open(live_data_path, 'r', encoding='utf-8') as f:
                prev_data = json.load(f)
                if prev_data and 'squadPicks' in prev_data:
                    output_data['squadPicks'] = prev_data['squadPicks']
        except Exception:
            pass

    # 3. Process each league
    for league_id in LEAGUES:
        print(f"📥 Syncing League #{league_id}...")
        standings_data = fetch_json(f'https://fantasy.premierleague.com/api/leagues-classic/{league_id}/standings/')
        
        fetched_results = []
        league_name = "Fantasy with Heng" if league_id == '390100' else "Clash of Elite 2026-2027"

        if standings_data:
            if 'league' in standings_data and 'name' in standings_data['league']:
                league_name = standings_data['league']['name']
            if 'standings' in standings_data and 'results' in standings_data['standings'] and standings_data['standings']['results']:
                fetched_results = standings_data['standings']['results']
            elif 'new_entries' in standings_data and 'results' in standings_data['new_entries'] and standings_data['new_entries']['results']:
                fetched_results = standings_data['new_entries']['results']

        if not fetched_results:
            print(f"⚠️ No standings results for league #{league_id}")
            continue

        managers = []
        for r in fetched_results:
            entry_id = r['entry']
            real_m = REAL_MANAGER_MAP.get(entry_id, {})
            name = real_m.get('name') or r.get('player_name') or r.get('entry_name')
            team_name = real_m.get('teamName') or r.get('entry_name')
            avatar = name[:2].upper()
            managers.append({
                'id': entry_id,
                'name': name,
                'teamName': team_name,
                'avatar': avatar
            })

        gameweeks = [
            {
                'gw': i + 1,
                'scores': {},
                'hits': {},
                'transfers': {},
                'benchPoints': {},
                'captainPoints': {},
                'chipsUsed': {},
                'seasonTotals': {}
            }
            for i in range(38)
        ]

        # Populate current GW baseline from standings
        for r in fetched_results:
            entry_id = r['entry']
            gameweeks[detected_gw - 1]['scores'][entry_id] = r.get('event_total', 0)
            gameweeks[detected_gw - 1]['seasonTotals'][entry_id] = r.get('total', r.get('event_total', 0))

        # Fetch individual manager history and squad picks
        print(f"📥 Fetching details for {len(managers)} managers in League #{league_id}...")
        for m in managers:
            m_id = m['id']
            hist_data = fetch_json(f'https://fantasy.premierleague.com/api/entry/{m_id}/history/')
            trans_data = fetch_json(f'https://fantasy.premierleague.com/api/entry/{m_id}/transfers/')

            if trans_data and isinstance(trans_data, list):
                output_data['transfersHistory'][str(m_id)] = trans_data

            if str(m_id) not in output_data['squadPicks']:
                output_data['squadPicks'][str(m_id)] = {}

            # Ensure all gameweeks 1..detected_gw have squad picks
            for g in range(1, detected_gw + 1):
                gw_str = str(g)
                # Fetch picks if missing or if it is the current active gameweek
                if gw_str not in output_data['squadPicks'][str(m_id)] or g == detected_gw:
                    picks_data = fetch_json(f'https://fantasy.premierleague.com/api/entry/{m_id}/event/{g}/picks/')
                    if picks_data:
                        output_data['squadPicks'][str(m_id)][gw_str] = {
                            'picks': picks_data.get('picks', []),
                            'active_chip': picks_data.get('active_chip', None),
                            'entry_history': picks_data.get('entry_history', {}),
                            'automatic_subs': picks_data.get('automatic_subs', [])
                        }

                squad_for_g = output_data['squadPicks'][str(m_id)].get(gw_str, {})
                picks_list = squad_for_g.get('picks', [])
                cap_pick = next((p for p in picks_list if p.get('is_captain')), None)
                if cap_pick:
                    cap_id = str(cap_pick.get('element'))
                    mult = cap_pick.get('multiplier', 2)
                    cap_pts = player_gw_points.get(gw_str, {}).get(cap_id, 0) * mult
                    gameweeks[g - 1]['captainPoints'][m_id] = cap_pts

            if hist_data and 'current' in hist_data and isinstance(hist_data['current'], list):
                for h in hist_data['current']:
                    g_num = h.get('event', 1)
                    if 1 <= g_num <= 38:
                        gameweeks[g_num - 1]['scores'][m_id] = h.get('points', 0)
                        gameweeks[g_num - 1]['hits'][m_id] = h.get('event_transfers_cost', 0)
                        gameweeks[g_num - 1]['transfers'][m_id] = h.get('event_transfers', 0)
                        gameweeks[g_num - 1]['benchPoints'][m_id] = h.get('points_on_bench', 0)
                        gameweeks[g_num - 1]['seasonTotals'][m_id] = h.get('total_points', 0)

            if hist_data and 'chips' in hist_data and isinstance(hist_data['chips'], list):
                for c in hist_data['chips']:
                    g_num = c.get('event', 1)
                    if 1 <= g_num <= 38:
                        gameweeks[g_num - 1]['chipsUsed'][m_id] = c.get('name')

            # Populate latest active gameweek chips and entry history overrides
            curr_squad = output_data['squadPicks'][str(m_id)].get(str(detected_gw), {})
            if curr_squad:
                curr_gw_obj = gameweeks[detected_gw - 1]
                if curr_squad.get('active_chip'):
                    curr_gw_obj['chipsUsed'][m_id] = curr_squad['active_chip']
                entry_hist = curr_squad.get('entry_history', {})
                if 'points' in entry_hist and entry_hist['points'] is not None:
                    curr_gw_obj['scores'][m_id] = entry_hist['points']
                if 'event_transfers_cost' in entry_hist and entry_hist['event_transfers_cost'] is not None:
                    curr_gw_obj['hits'][m_id] = entry_hist['event_transfers_cost']
                trans_count = entry_hist.get('event_transfers', 0)
                if trans_count == 0 and trans_data and isinstance(trans_data, list):
                    gw_trans = [t for t in trans_data if t.get('event') == detected_gw]
                    if gw_trans:
                        trans_count = len(gw_trans)
                curr_gw_obj['transfers'][m_id] = trans_count
                if 'points_on_bench' in entry_hist and entry_hist['points_on_bench'] is not None:
                    curr_gw_obj['benchPoints'][m_id] = entry_hist['points_on_bench']
                if 'total_points' in entry_hist and entry_hist['total_points'] is not None:
                    curr_gw_obj['seasonTotals'][m_id] = entry_hist['total_points']

        output_data['leagues'][league_id] = {
            'leagueName': league_name,
            'managers': managers,
            'gameweeks': gameweeks,
            'months': calculated_months,
            'currentGw': detected_gw
        }

    with open(live_data_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    with open(squad_data_path, 'w', encoding='utf-8') as f:
        f.write(f"window.FPL_LIVE_STATIC = {json.dumps(output_data, ensure_ascii=False)};\n")

    print("✅ Automated FPL sync complete! Saved live_data.json and squadData.js successfully.")

if __name__ == '__main__':
    main()
