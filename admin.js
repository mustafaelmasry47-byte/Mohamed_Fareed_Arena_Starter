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
 $('#matches').innerHTML=M.map(m=>`<tr data-id="${m.id}"><td>${m.round_number}</td><td>${esc(teamName(m.home_team_id))} × ${esc(teamName(m.away_team_id))}</td><td><input type="datetime-local" class="kickoff" value="${m.kickoff_at?new Date(m.kickoff_at).toLocaleString("sv-SE").replace(" ","T").slice(0,16):""}"></td><td><input type="number" min="0" class="hs" value="${m.home_score??''}"></td><td><input type="number" min="0" class="as" value="${m.away_score??''}"></td><td><select class="st">${[['upcoming','قادمة'],['live','جارية'],['finished','انتهت']].map(([v,l])=>`<option value="${v}" ${v==m.status?'selected':''}>${l}</option>`).join('')}</select></td><td><input type="checkbox" class="pub" ${m.is_published?'checked':''}></td><td><button class="sv">حفظ</button></td></tr>`).join('');
 $('#smatch').innerHTML=M.map(m=>`<option value="${m.id}">ج${m.round_number}: ${esc(teamName(m.home_team_id))} × ${esc(teamName(m.away_team_id))}</option>`).join('');fillPlayers();
 await loadLeaderOverrides();
 if(selectedTeam&&T.some(t=>t.id===selectedTeam))renderRoster();else if(selectedTeam){selectedTeam=null;showTeams()}
 return{};
}
function teamName(id){return T.find(t=>t.id==id)?.name||'بدون فريق'}
function fillPlayers(){const m=M.find(x=>x.id==$('#smatch').value);$('#splayer').innerHTML=P.filter(p=>m&&(p.team_id==m.home_team_id||p.team_id==m.away_team_id)).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}
$('#smatch').onchange=fillPlayers;
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
$('#gen').onclick=()=>{if(T.length!==6)return say('لازم يكون عندك 6 فرق بالظبط.');if(M.length&&!confirm('فيه مباريات موجودة بالفعل، والجدول الجديد هيتضاف فوقها. متأكد؟'))return;const n=6,rows=[];let a=T.map(t=>t.id);for(let r=0;r<n-1;r++){for(let i=0;i<n/2;i++){let h=a[i],w=a[n-1-i];if(i===0&&r%2)[h,w]=[w,h];rows.push({round_number:r+1,home_team_id:h,away_team_id:w},{round_number:r+n,home_team_id:w,away_team_id:h})}a=[a[0],a[n-1],...a.slice(1,n-1)]}sb.from('matches').insert(rows).then(async({error})=>{if(error)say(error.message);else{say('تم إنشاء 30 مباراة غير منشورة.',1);await refresh()}})};
$('#matches').onclick=e=>{if(!e.target.classList.contains('sv'))return;const tr=e.target.closest('tr'),v=c=>tr.querySelector(c).value;sb.from('matches').update({kickoff_at:v('.kickoff')?new Date(v('.kickoff')).toISOString():null,home_score:v('.hs')===''?null:+v('.hs'),away_score:v('.as')===''?null:+v('.as'),status:v('.st'),is_published:tr.querySelector('.pub').checked}).eq('id',tr.dataset.id).then(async({error})=>{if(error)say(error.message);else{say('تم حفظ المباراة.',1);await refresh()}})};

async function loadLeaderOverrides(){
 const {data,error}=await sb.from('leader_overrides').select('*');
 if(error){say('نفّذ ملف sql/leader-overrides.sql في Supabase أولًا: '+error.message);return}
 leaderOverrides=data||[];
 $('#leaderOverrides').innerHTML=P.map(p=>{const o=leaderOverrides.find(x=>x.player_id===p.id)||{};return '<tr data-player="'+p.id+'"><td>'+esc(p.name)+'</td><td>'+esc(teamName(p.team_id))+'</td><td><input class="ov-goals" type="number" min="0" placeholder="تلقائي" value="'+(o.goals_override??'')+'" style="width:85px"></td><td><input class="ov-assists" type="number" min="0" placeholder="تلقائي" value="'+(o.assists_override??'')+'" style="width:85px"></td><td><input class="ov-rating" type="number" min="0" max="10" step="0.1" placeholder="تلقائي" value="'+(o.rating_override??'')+'" style="width:85px"></td><td><button type="button" class="save-leader-override">حفظ</button> <button type="button" class="reset-leader-override danger">مسح</button></td></tr>'}).join('')||'<tr><td colspan="6">لا يوجد لاعبون مسجلون.</td></tr>';
}
$('#leaderOverrides').onclick=async e=>{
 const tr=e.target.closest('tr[data-player]');if(!tr)return;const player_id=Number(tr.dataset.player);
 if(e.target.closest('.save-leader-override')){
  const val=sel=>tr.querySelector(sel).value===''?null:Number(tr.querySelector(sel).value);
  const row={player_id,goals_override:val('.ov-goals'),assists_override:val('.ov-assists'),rating_override:val('.ov-rating'),updated_at:new Date().toISOString()};
  if(row.goals_override!==null&&(!Number.isInteger(row.goals_override)||row.goals_override<0))return say('عدد الأهداف لازم يكون صفر أو أكبر.');
  if(row.assists_override!==null&&(!Number.isInteger(row.assists_override)||row.assists_override<0))return say('عدد الأسيست لازم يكون صفر أو أكبر.');
  if(row.rating_override!==null&&(row.rating_override<0||row.rating_override>10))return say('التقييم لازم يكون من 0 إلى 10.');
  const {error}=await sb.from('leader_overrides').upsert(row,{onConflict:'player_id'});
  if(error)say('تعذر حفظ التعديل: '+error.message);else{say('تم تعديل أرقام المتصدرين.',1);await loadLeaderOverrides()}
 }
 if(e.target.closest('.reset-leader-override')){
  if(!confirm('ترجع أرقام اللاعب دي للحساب التلقائي؟'))return;
  const {error}=await sb.from('leader_overrides').delete().eq('player_id',player_id);
  if(error)say(error.message);else{say('تمت إعادة أرقام اللاعب للحساب التلقائي.',1);await loadLeaderOverrides()}
 }
};
$('#clearLeaderOverrides').onclick=async()=>{
 if(!confirm('متأكد؟ سيتم مسح كل التعديلات اليدوية وإرجاع ترتيب المتصدرين للأرقام المحسوبة من المباريات.'))return;
 const {error}=await sb.from('leader_overrides').delete().neq('player_id',0);
 if(error)say('تعذر مسح التعديلات: '+error.message);else{say('تم مسح كل التعديلات اليدوية.',1);await loadLeaderOverrides()}
};
async function loadAwards(){
 const {data,error}=await sb.from('tournament_awards').select('*').eq('id',1).maybeSingle();
 if(error){say('تأكد من إعداد جدول الجوائز في Supabase: '+error.message);return}
 $('#awardMonth').value=data?.award_month||'';
 $('#monthlyPlayer').innerHTML='<option value="">اختار اللاعب</option>'+P.map(p=>'<option value="'+p.id+'">'+esc(p.name)+' — '+esc(teamName(p.team_id))+'</option>').join('');
 $('#monthlyPlayer').value=data?.monthly_player_id||'';
}
$('#clearMonthly').onclick=async()=>{
 if(!confirm('متأكد إنك عايز تمسح لقب أفضل لاعب في الأسبوع؟ هيختفي من الموقع العام، لكن بيانات اللاعب وإحصائياته هتفضل زي ما هي.'))return;
 const{error}=await sb.from('tournament_awards').upsert({id:1,monthly_player_id:null,award_month:null,updated_at:new Date().toISOString()},{onConflict:'id'});
 if(error)say('تعذر مسح لاعب الأسبوع: '+error.message);else{$('#monthlyPlayer').value='';$('#awardMonth').value='';say('تم مسح اختيار أفضل لاعب في الأسبوع.',1)}
};
$('#saveMonthly').onclick=async()=>{
 const week=$('#awardMonth').value,player=$('#monthlyPlayer').value;
 if(!week||!player)return say('اختار بداية الأسبوع واللاعب الفائز.');
 const{error}=await sb.from('tournament_awards').upsert({id:1,monthly_player_id:Number(player),award_month:week,updated_at:new Date().toISOString()},{onConflict:'id'});
 if(error)say('تعذر اعتماد اللاعب: '+error.message);else say('تم اعتماد أفضل لاعب في الأسبوع يدويًا.',1);
};

$('#statForm').onsubmit=e=>{e.preventDefault();sb.from('player_match_stats').upsert({match_id:+$('#smatch').value,player_id:+$('#splayer').value,goals:+$('#sg').value,assists:+$('#sa').value,rating:$('#sr').value===''?null:+$('#sr').value,is_man_of_match:$('#sm').checked},{onConflict:'match_id,player_id'}).then(({error})=>say(error?'خطأ: '+error.message:'تم حفظ الإحصائيات.',!error))};
init().then(loadAwards);