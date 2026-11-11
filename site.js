const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(async()=>{
const host=$('#matches-list');
if(CFG.url.includes('YOUR_')){host.innerHTML='<div class="empty-state"><h3>الموقع لسه متربطش بقاعدة البيانات</h3><p>عدّل ملف config.js.</p></div>';return}
const sb=supabase.createClient(CFG.url,CFG.key);
const [t,m,s,p]=await Promise.all([sb.from('teams').select('*').order('id'),sb.from('matches').select('*').eq('is_published',true).order('round_number').order('kickoff_at'),sb.from('player_match_stats').select('*,players(name,team_id)'),sb.from('players').select('*').order('shirt_number').order('name')]);
const T=t.data||[],M=m.data||[],P=p.data||[],ids=new Set(M.map(x=>x.id)),S=(s.data||[]).filter(x=>ids.has(x.match_id));
const tm=id=>T.find(x=>x.id==id)||{name:'?',badge_emoji:''},nm=id=>esc(tm(id).badge_emoji+' '+tm(id).name);
const playerCard=x=>`<article class="player-card"><div class="player-photo">${x.photo_url?`<img src="${esc(x.photo_url)}" alt="صورة ${esc(x.name)}" loading="lazy" onerror="this.style.display='none'">`:'<span>👤</span>'}</div><div class="player-info"><b>${esc(x.name)}</b><small>${esc(x.position||'لاعب')}</small><div class="player-meta"><span>${x.shirt_number!=null?'#'+esc(x.shirt_number):'بدون رقم'}</span><span>${x.is_substitute?'بديل':'أساسي'}</span></div></div></article>`;
$('#teams-list').innerHTML=T.map(team=>{const players=P.filter(x=>x.team_id==team.id);return `<article class="team-card"><header><div class="team-emblem">${esc(team.badge_emoji||'⚽')}</div><div><h3>${esc(team.name)}</h3><small>${players.length} لاعب</small></div><span class="team-short">${esc(team.short_name||'MFA')}</span></header><div class="public-roster">${players.length?players.map(playerCard).join(''):'<p class="muted roster-empty">لم تتم إضافة لاعبين لهذا الفريق بعد.</p>'}</div></article>`}).join('')||'<div class="empty-state">لم تتم إضافة فرق حتى الآن.</div>';
const rounds={};M.forEach(x=>(rounds[x.round_number]??=[]).push(x));
$('#matches-list').innerHTML=Object.keys(rounds).map(r=>`<div class="round"><h3>الجولة ${r}</h3>${rounds[r].map(x=>{const done=x.status=='finished'&&x.home_score!=null;const d=x.kickoff_at?new Date(x.kickoff_at).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'}):'';return`<div class="mrow"><b>${nm(x.home_team_id)}</b><div><span class="score">${done||x.status=='live'?`${x.home_score??0} - ${x.away_score??0}`:'vs'}</span><span class="when">${x.status=='live'?'جارية الآن':esc(d)}</span></div><b>${nm(x.away_team_id)}</b></div>`}).join('')}</div>`).join('')||'<div class="empty-state"><span>📅</span><h3>جدول المواجهات قريبًا</h3><p>سيتم نشر المباريات بعد اعتمادها.</p></div>';
const R=Object.fromEntries(T.map(x=>[x.id,{id:x.id,p:0,w:0,d:0,l:0,gf:0,ga:0}]));
M.filter(x=>x.status=='finished'&&x.home_score!=null&&x.away_score!=null).forEach(x=>{const h=R[x.home_team_id],a=R[x.away_team_id];if(!h||!a)return;h.p++;a.p++;h.gf+=x.home_score;h.ga+=x.away_score;a.gf+=x.away_score;a.ga+=x.home_score;if(x.home_score>x.away_score){h.w++;a.l++}else if(x.home_score<x.away_score){a.w++;h.l++}else{h.d++;a.d++}});
const rows=Object.values(R).map(r=>({...r,pts:r.w*3+r.d,gd:r.gf-r.ga})).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf);
if(rows.length)$('#table-body').innerHTML=rows.map((r,i)=>`<tr class="${i?'':'first'}"><td>${i+1}</td><td class="tn">${nm(r.id)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('');
const Pstats={};S.forEach(x=>{const k=x.player_id,p=Pstats[k]??={n:x.players?.name,tm:x.players?.team_id,g:0,a:0,rs:0,rc:0};p.g+=x.goals||0;p.a+=x.assists||0;if(x.rating!=null){p.rs+=+x.rating;p.rc++}});
const list=(id,arr,f)=>{const a=arr.slice(0,5);if(a.length)$(id).innerHTML=a.map(p=>`<li>${esc(p.n)} <small class="muted">${esc(tm(p.tm).name)}</small><span>${f(p)}</span></li>`).join('')};
const L=Object.values(Pstats);
list('#lead-goals',L.filter(p=>p.g>0).sort((a,b)=>b.g-a.g),p=>p.g);
list('#lead-assists',L.filter(p=>p.a>0).sort((a,b)=>b.a-a.a),p=>p.a);
list('#lead-rating',L.filter(p=>p.rc).map(p=>({...p,r:p.rs/p.rc})).sort((a,b)=>b.r-a.r),p=>p.r.toFixed(1));
})();