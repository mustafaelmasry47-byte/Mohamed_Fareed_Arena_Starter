const sb=supabase.createClient(CFG.url,CFG.key),$=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BUCKET='player-photos',MAX_PLAYERS=15,MAX_IMAGE=4*1024*1024;
const say=(m,ok)=>{$('#msg').textContent=m;$('#msg').className='notice'+(ok?' ok':'')};
const show=p=>{$('#login').hidden=p;$('#panel').hidden=!p};
let T=[],P=[],M=[],selectedTeam=null,editingPlayer=null,leaderOverrides=[];
async function init(){const{data:{session}}=await sb.auth.getSession();if(!session)return show(false);const{data,error}=await sb.from('admin_users').select('user_id').eq('user_id',session.user.id);if(error||!data?.length){await sb.auth.signOut();say('هذا الحساب ليس حساب المشرف.');return show(false)}say('تم تسجيل الدخول.',1);show(true);await load()}
$('#loginForm').onsubmit=async e=>{e.preventDefault();const{error}=await sb.auth.signInWithPassword({email:$('#email').value,password:$('#pass').value});if(error)say('بيانات الدخول غير صحيحة');else{await init();await loadAwards()}};
$('#out').onclick=async()=>{await sb.auth.signOut();show(false);say('تم تسجيل الخروج.')};
async function refresh(){const{error}=await load();if(error)say('خطأ في تحميل البيانات: '+error.message)}
async function load(){
 const res=await Promise.all([sb.from('teams').select('*').order('id'),sb.from('players').select('*').order('shirt_number').order('id'),sb.from('matches').select('*').order('round_number').order('id')]);
 const err=res.find(x=>x.error)?.error;if(err)return{error:err};
 [T,P,M]=res.map(x=>x.data||[]);
 $('#teams').innerHTML=T.map(t=>{const count=P.filter(p=>p.team_id===t.id).length;return `<article class="admin-team-card"><div class="team-emblem">${esc(t.badge_emoji||'⚽')}</div><div class="admin-card-copy"><b>${esc(t.name)}</b><small>${count} من 15 لاعب</small></div><button type="button" class="open-roster" data-id="${t.id}">فتح القائمة ←</button><div class="card-actions"><button type="button" class="edit-team" data-id="${t.id}">تعديل</button><button type="button" class="delete-team danger" data-id="${t.id}">حذف</button></div></article>`}).join('')||'<p class="muted">لسه مفيش فرق. أضف أول فريق من النموذج.</p>';
 $('#editTeam').innerHTML=T.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
 $('#matches').innerHTML=M.map(m=>`<tr data-id="${m.id}"><td>${m.round_number}</td><td>${esc(teamName(m.home_team_id))} × ${esc(teamName(m.away_team_id))}</td><td><input type="datetime-local" class="kickoff" value="${m.kickoff_at?new Date(m.kickoff_at).toLocaleString("sv-SE").replace(" ","T").slice(0,16):""}"></td><td><input type="number" min="0" class="hs" value="${m.home_score??''}"></td><td><input type="number" min="0" class="as" value="${m.away_score??''}"></td><td><select class="st">${[['upcoming','قادمة'],['live','جارية'],['finished','انتهت']].map(([v,l])=>`<option value="${v}" ${v==m.status?'selected':''}>${l}</option>`).join('')}</select></td><td><input type="checkbox" class="pub" ${m.is_published?'checked':''}></td><td><button class="sv">حفظ</button> <button type="button" class="notes-toggle">تفاصيل الفريقين</button></td></tr><tr class="match-notes-row" data-id="${m.id}" hidden><td colspan="8"><div class="match-notes-editor"><label>🟦 تفاصيل ${esc(teamName(m.home_team_id))} (المضيف)<textarea class="home-details" rows="3" placeholder="اكتب تفاصيل الفريق المضيف...">${esc(m.home_details||'')}</textarea></label><label>🟥 تفاصيل ${esc(teamName(m.away_team_id))} (الضيف)<textarea class="away-details" rows="3" placeholder="اكتب تفاصيل الفريق الضيف...">${esc(m.away_details||'')}</textarea></label></div><div class="match-notes-actions"><small class="muted">اكتب تفاصيل كل فريق، ثم احفظ.</small><button type="button" class="notes-save">حفظ التفاصيل</button></div></td></tr>`).join('');
 $('#smatch').innerHTML=M.map(m=>`<option value="${m.id}">ج${m.round_number}: ${esc(teamName(m.home_team_id))} × ${esc(teamName(m.away_team_id))}</option>`).join('');fillPlayers();
 await loadLeaderOverrides();
 if(selectedTeam&&T.some(t=>t.id===selectedTeam))renderRoster();else if(selectedTeam){selectedTeam=null;showTeams()}
 return{};
}
function teamName(id){return T.find(t=>t.id==id)?.name||'بدون فريق'}
function fillPlayers(){const m=M.find(x=>x.id==$('#smatch').value);$('#splayer').innerHTML=P.filter(p=>m&&(p.team_id==m.home_team_id||p.team_id==m.away_team_id)).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');if(!$('#splayer').options.length)$('#splayer').innerHTML='<option value="">لا يوجد لاعبون في الفريقين</option>'}
async function loadPlayerStat(){const matchId=Number($('#smatch').value),playerId=Number($('#splayer').value);if(!matchId||!playerId){$('#sg').value=0;$('#sa').value=0;$('#sr').value='';$('#sm').checked=false;return}const{data,error}=await sb.from('player_match_stats').select('*').eq('match_id',matchId).eq('player_id',playerId).maybeSingle();if(error){say('تعذر تحميل إحصائيات اللاعب: '+error.message);return}$('#sg').value=data?.goals??0;$('#sa').value=data?.assists??0;$('#sr').value=data?.rating??'';$('#sm').checked=!!data?.is_man_of_match}
$('#smatch').onchange=()=>{fillPlayers();loadPlayerStat()};
$('#splayer').onchange=loadPlayerStat;
function showView(id){document.querySelectorAll('.admin-view').forEach(x=>x.hidden=x.id!==id);document.querySelectorAll('.admin-tab').forEach(x=>x.classList.toggle('active',x.dataset.view===id));$('#team-detail').hidden=true}
document.querySelectorAll('.admin-tab').forEach(b=>b.onclick=()=>showView(b.dataset.view));
function showTeams(){showView('teams-view');$('#team-detail').hidden=true}
function openTeam(id){selectedTeam=Number(id);showView('teams-view');$('#teams-view').hidden=true;$('#team-detail').hidden=false;renderRoster()}
function renderRoster(){const team=T.find(t=>t.id===selectedTeam);if(!team){showTeams();return}const players=P.filter(p=>p.team_id===selectedTeam);$('#selectedTeamName').textContent=team.badge_emoji+' '+team.name;$('#rosterCount').textContent=players.length;$('#rosterProgress').style.width=(players.length/MAX_PLAYERS*100)+'%';const full=players.length>=MAX_PLAYERS;$('#playerForm').querySelector('button').disabled=full;$('#playerForm').querySelector('button').textContent=full?'القائمة اكتملت (15/15)':'＋ إضافة اللاعب';$('#playerForm').hidden=full;$('#teamPlayers').innerHTML=players.map(p=>`<article class="admin-player-card"><div class="admin-player-photo">${p.photo_url?`<img src="${esc(p.photo_url)}" alt="">`:'👤'}</div><div class="admin-player-copy"><b>${esc(p.name)}</b><small>${esc(p.position||'المركز غير محدد')}</small><div class="player-meta"><span>${p.shirt_number!=null?'#'+p.shirt_number:'بدون رقم'}</span><span class="${p.is_substitute?'sub-tag':'starter-tag'}">${p.is_substitute?'بديل':'أساسي'}</span></div></div><div class="card-actions"><button type="button" class="edit-player" data-id="${p.id}">تعديل</button><button type="button" class="delete-player danger" data-id="${p.id}">حذف</button></div></article>`).join('')||'<p class="muted">القائمة لسه فاضية. أضف أول لاعب للفريق.</p>'}
$('#teams').onclick=async e=>{const id=Number(e.target.dataset.id);if(e.target.closest('.open-roster'))return openTeam(id);const team=T.find(t=>t.id===id);if(e.target.closest('.edit-team')){const name=prompt('اسم الفريق:',team.name);if(name===null)return;const short=prompt('اختصار الفريق:',team.short_name||'');if(short===null)return;const emoji=prompt('رمز الفريق:',team.badge_emoji||'⚽');if(emoji===null)return;const{error}=await sb.from('teams').update({name:name.trim(),short_name:short.trim()||null,badge_emoji:emoji.trim()||'⚽'}).eq('id',id);if(error)say(error.message);else{say('تم تعديل الفريق.',1);await refresh()}}if(e.target.closest('.delete-team')){const used=M.some(m=>m.home_team_id===id||m.away_team_id===id);if(used)return say('مينفعش تمسح فريق مرتبط بمباريات. عدّل المباريات الأول.');if(!confirm('متأكد إنك عايز تمسح الفريق؟'))return;const{error}=await sb.from('teams').delete().eq('id',id);if(error)say(error.message);else{say('تم حذف الفريق.',1);await refresh()}}};
$('#backTeams').onclick=()=>{selectedTeam=null;showTeams()};
async function uploadPhoto(file,teamId){if(!file)return null;if(!file.type.startsWith('image/'))throw Error('اختار ملف صورة فقط.');if(file.size>MAX_IMAGE)throw Error('حجم الصورة لازم يكون أقل من 4 ميجابايت.');const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';const path=teamId+'/'+crypto.randomUUID()+'.'+ext;const{error}=await sb.storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(error)throw Error('رفع الصورة فشل: '+error.message+' — تأكد من تنفيذ إعداد مساحة الصور مرة واحدة.');return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}
$('#playerForm').onsubmit=async e=>{e.preventDefault();const teamPlayers=P.filter(p=>p.team_id===selectedTeam);if(teamPlayers.length>=MAX_PLAYERS)return say('الفريق وصل للحد الأقصى: 15 لاعب.');const btn=$('#addPlayerBtn');btn.disabled=true;try{const photo=await uploadPhoto($('#pphoto').files[0],selectedTeam);const{error}=await sb.from('players').insert({team_id:selectedTeam,name:$('#pname').value.trim(),shirt_number:$('#pnum').value?+$('#pnum').value:null,position:$('#ppos').value.trim()||null,is_substitute:$('#psub').checked,photo_url:photo});if(error)throw error;say('تمت إضافة اللاعب للقائمة.',1);e.target.reset();await refresh()}catch(err){say(err.message||'حصل خطأ أثناء إضافة اللاعب.')}finally{btn.disabled=false}};
$('#teamPlayers').onclick=async e=>{const id=Number(e.target.dataset.id),p=P.find(x=>x.id===id);if(!p)return;if(e.target.closest('.edit-player')){editingPlayer=p;$('#editName').value=p.name;$('#editNumber').value=p.shirt_number??'';$('#editPosition').value=p.position||'';$('#editTeam').value=p.team_id;$('#editSub').checked=!!p.is_substitute;$('#editPhoto').value='';$('#removePhoto').checked=false;$('#playerDialog').showModal()}if(e.target.closest('.delete-player')){if(!confirm('متأكد من حذف '+p.name+' من القائمة؟ سيتم حذف إحصائياته المرتبطة أيضًا.'))return;const{error}=await sb.from('players').delete().eq('id',id);if(error)say('تعذر حذف اللاعب: '+error.message);else{say('تم حذف اللاعب من القائمة.',1);await refresh()}}};
function closeDialog(){$('#playerDialog').close();editingPlayer=null}
$('#closePlayerDialog').onclick=closeDialog;$('#cancelEdit').onclick=closeDialog;
$('#editPlayerForm').onsubmit=async e=>{e.preventDefault();if(!editingPlayer)return;const btn=e.submitter;btn.disabled=true;try{const newTeam=Number($('#editTeam').value),targetCount=P.filter(x=>x.team_id===newTeam&&x.id!==editingPlayer.id).length;if(targetCount>=MAX_PLAYERS)throw Error('الفريق المختار مكتمل. الحد الأقصى 15 لاعب.');let photo=editingPlayer.photo_url;if($('#removePhoto').checked)photo=null;const file=$('#editPhoto').files[0];if(file)photo=await uploadPhoto(file,newTeam);const{error}=await sb.from('players').update({team_id:newTeam,name:$('#editName').value.trim(),shirt_number:$('#editNumber').value===''?null:Number($('#editNumber').value),position:$('#editPosition').value.trim()||null,is_substitute:$('#editSub').checked,photo_url:photo}).eq('id',editingPlayer.id);if(error)throw error;closeDialog();say('تم تحديث بيانات اللاعب.',1);await refresh()}catch(err){say(err.message||'تعذر تعديل اللاعب.')}finally{btn.disabled=false}};
$('#teamForm').onsubmit=async e=>{e.preventDefault();const{error}=await sb.from('teams').insert({name:$('#tname').value.trim(),short_name:$('#tshort').value.trim()||null,badge_emoji:$('#temoji').value.trim()||'⚽'});if(error)say('تعذرت إضافة الفريق: '+error.message);else{say('تمت إضافة الفريق.',1);e.target.reset();await refresh()}};
$('#gen').onclick=async()=>{if(T.length!==6)return say('لازم يكون عندك 6 فرق بالظبط.');if(M.length)return say('فيه مباريات موجودة بالفعل. احذف/أرشف جدول الدوري القديم أولًا قبل إنشاء جدول جديد؛ لن نضيف مباريات مكررة.');const btn=$('#gen');btn.disabled=true;try{const n=6,rows=[];let a=T.map(t=>t.id);for(let r=0;r<n-1;r++){for(let i=0;i<n/2;i++){let h=a[i],w=a[n-1-i];if(i===0&&r%2)[h,w]=[w,h];rows.push({round_number:r+1,home_team_id:h,away_team_id:w},{round_number:r+n,home_team_id:w,away_team_id:h})}a=[a[0],a[n-1],...a.slice(1,n-1)]}const{error}=await sb.from('matches').insert(rows);if(error)throw error;say('تم إنشاء 30 مباراة غير منشورة.',1);await refresh()}catch(err){say('تعذر إنشاء الجدول: '+err.message)}finally{btn.disabled=false}};
$('#matches').onclick=async e=>{const toggle=e.target.closest('.notes-toggle');if(toggle){const row=toggle.closest('tr'),notes=row.nextElementSibling;notes.hidden=!notes.hidden;toggle.textContent=notes.hidden?'تفاصيل الفريقين':'إغلاق التفاصيل';return}const notesSave=e.target.closest('.notes-save');if(notesSave){const notes=notesSave.closest('.match-notes-row');notesSave.disabled=true;const update={home_details:notes.querySelector('.home-details').value.trim()||null,away_details:notes.querySelector('.away-details').value.trim()||null};const{error}=await sb.from('matches').update(update).eq('id',notes.dataset.id);notesSave.disabled=false;if(error)say('تعذر حفظ التفاصيل: '+error.message);else{say('تم حفظ تفاصيل الفريقين.',1);await refresh()}return}if(!e.target.classList.contains('sv'))return;const tr=e.target.closest('tr'),v=c=>tr.querySelector(c).value;const update={kickoff_at:v('.kickoff')?new Date(v('.kickoff')).toISOString():null,home_score:v('.hs')===''?null:+v('.hs'),away_score:v('.as')===''?null:+v('.as'),status:v('.st'),is_published:tr.querySelector('.pub').checked};const btn=e.target;btn.disabled=true;const{error}=await sb.from('matches').update(update).eq('id',tr.dataset.id);btn.disabled=false;if(error)say('تعذر حفظ المباراة: '+error.message);else{say('تم حفظ بيانات المباراة.',1);await refresh()}};

function derivedStats(playerId){
 const rows=window.__unused||[];
 return {goals:0,assists:0,rating:''};
}
async function loadLeaderOverrides(){
 const {data,error}=await sb.from('leader_overrides').select('*');
 if(error){say('تعذر تحميل المتصدرين: '+error.message);return}
 leaderOverrides=data||[];
 $('#leaderOverrides').innerHTML=P.map(p=>{
  const o=leaderOverrides.find(x=>Number(x.player_id)===Number(p.id))||{};
  return '<tr data-player-id="'+p.id+'"><td>'+esc(p.name)+'</td><td>'+esc(teamName(p.team_id))+'</td><td><input class="ov-goals" type="number" min="0" step="1" placeholder="محسوب" value="'+(o.goals_override??'')+'"></td><td><input class="ov-assists" type="number" min="0" step="1" placeholder="محسوب" value="'+(o.assists_override??'')+'"></td><td><input class="ov-rating" type="number" min="0" max="10" step="0.1" placeholder="محسوب" value="'+(o.rating_override??'')+'"></td><td><button type="button" class="save-leader-row">حفظ أرقام اللاعب</button></td></tr>';
 }).join('')||'<tr><td colspan="6">أضف اللاعبين أولًا من قسم الفرق.</td></tr>';
}
$('#leaderOverrides').onclick=async e=>{
 const btn=e.target.closest('.save-leader-row');if(!btn)return;
 const tr=btn.closest('tr'),id=Number(tr.dataset.playerId);
 const read=sel=>{const v=tr.querySelector(sel).value.trim();return v===''?null:Number(v)};
 const goals=read('.ov-goals'),assists=read('.ov-assists'),rating=read('.ov-rating');
 if([goals,assists].some(v=>v!==null&&(!Number.isInteger(v)||v<0))||rating!==null&&(!Number.isFinite(rating)||rating<0||rating>10))return say('راجع الأرقام: الأهداف والأسيست أعداد صحيحة، والتقييم من 0 إلى 10.');
 btn.disabled=true;
 const {error}=await sb.from('leader_overrides').upsert({player_id:id,goals_override:goals,assists_override:assists,rating_override:rating,updated_at:new Date().toISOString()},{onConflict:'player_id'});
 btn.disabled=false;
 if(error)say('تعذر حفظ أرقام اللاعب: '+error.message);else{say('تم حفظ أرقام '+(P.find(p=>Number(p.id)===id)?.name||'اللاعب')+'.',1);await loadLeaderOverrides()}
};
$('#clearLeaderOverrides').onclick=async()=>{
 if(!confirm('مسح كل الأرقام اليدوية والرجوع لإحصائيات المباريات؟'))return;
 const {error}=await sb.from('leader_overrides').delete().neq('player_id',0);
 if(error)say('تعذر مسح الأرقام: '+error.message);else{say('تم مسح التعديلات اليدوية.',1);await loadLeaderOverrides()}
};
async function loadAwards(){
 const [playersResult,awardsResult]=await Promise.all([
  sb.from('players').select('*').order('name'),
  sb.from('weekly_awards').select('*').order('week_number')
 ]);
 if(playersResult.error||awardsResult.error){say('تعذر تحميل سجل لاعب الأسبوع: '+(playersResult.error||awardsResult.error).message);return}
 const players=playersResult.data||[],awards=awardsResult.data||[];
 $('#weeklyPlayer').innerHTML='<option value="">اختار اللاعب الفائز</option>'+players.map(p=>'<option value="'+p.id+'">'+esc(p.name)+' — '+esc(teamName(p.team_id))+'</option>').join('');
 $('#weeklyAwardsAdmin').innerHTML=awards.map(a=>{
  const p=players.find(x=>Number(x.id)===Number(a.player_id));
  return '<article class="weekly-admin-row"><b>الأسبوع '+a.week_number+'</b><span>'+(p?esc(p.name):'لاعب غير موجود')+'</span><button type="button" class="delete-week-award" data-week="'+a.week_number+'">حذف</button></article>';
 }).join('')||'<p class="muted">لسه مفيش فائزين مسجلين.</p>';
}
$('#saveWeeklyAward').onclick=async()=>{
 const week=Number($('#weeklyNumber').value),playerId=Number($('#weeklyPlayer').value);
 if(!Number.isInteger(week)||week<1||week>30)return say('اكتب رقم أسبوع صحيح من 1 إلى 30.');
 if(!playerId)return say('اختار اللاعب الفائز الأول.');
 const {error}=await sb.from('weekly_awards').upsert({week_number:week,player_id:playerId,updated_at:new Date().toISOString()},{onConflict:'week_number'});
 if(error)say('تعذر حفظ لاعب الأسبوع: '+error.message);else{say('تم اعتماد فائز الأسبوع '+week+'.',1);await loadAwards();$('#weeklyNumber').value='';$('#weeklyPlayer').value=''}
};
$('#weeklyAwardsAdmin').onclick=async e=>{
 const btn=e.target.closest('.delete-week-award');if(!btn)return;
 const week=Number(btn.dataset.week);if(!confirm('حذف الفائز المسجل للأسبوع '+week+'؟'))return;
 const {error}=await sb.from('weekly_awards').delete().eq('week_number',week);
 if(error)say('تعذر حذف الفائز: '+error.message);else{say('تم حذف فائز الأسبوع '+week+'.',1);await loadAwards()}
};

init().then(loadAwards);