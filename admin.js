const sb=supabase.createClient(CFG.url,CFG.key),$=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=(m,ok)=>{$('#msg').textContent=m;$('#msg').className='notice'+(ok?' ok':'')};
const show=p=>{$('#login').hidden=p;$('#panel').hidden=!p};
let T=[],P=[],M=[];
async function init(){
 const{data:{session}}=await sb.auth.getSession();if(!session)return show(false);
 const{data}=await sb.from('admin_users').select('user_id').eq('user_id',session.user.id);
 if(!data?.length){await sb.auth.signOut();say('هذا الحساب ليس حساب المشرف.');return show(false)}
 say('تم تسجيل الدخول.',1);show(true);load();
}
$('#loginForm').onsubmit=async e=>{e.preventDefault();const{error}=await sb.auth.signInWithPassword({email:$('#email').value,password:$('#pass').value});error?say('بيانات الدخول غير صحيحة'):init()};
$('#out').onclick=async()=>{await sb.auth.signOut();show(false);say('تم تسجيل الخروج.')};
const run=async(p,ok)=>{const{error}=await p;if(error)say('خطأ: '+error.message);else{say(ok,1);load()}};
async function load(){
 [T,P,M]=(await Promise.all([sb.from('teams').select('*').order('id'),sb.from('players').select('*').order('id'),sb.from('matches').select('*').order('round_number').order('id')])).map(r=>r.data||[]);
 const tn=id=>esc(T.find(t=>t.id==id)?.name||'?');
 $('#teams').innerHTML=T.map(t=>`<li>${esc(t.badge_emoji)} ${esc(t.name)}</li>`).join('')||'<li class="muted">لسه مفيش فرق.</li>';
 $('#pteam').innerHTML=T.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
 $('#matches').innerHTML=M.map(m=>`<tr data-id="${m.id}"><td>${m.round_number}</td><td>${tn(m.home_team_id)} × ${tn(m.away_team_id)}</td><td><input type="number" min="0" class="hs" value="${m.home_score??''}"></td><td><input type="number" min="0" class="as" value="${m.away_score??''}"></td><td><select class="st">${[['upcoming','قادمة'],['live','جارية'],['finished','انتهت']].map(([v,l])=>`<option value="${v}" ${v==m.status?'selected':''}>${l}</option>`).join('')}</select></td><td><input type="checkbox" class="pub" ${m.is_published?'checked':''}></td><td><button class="sv">حفظ</button></td></tr>`).join('');
 $('#smatch').innerHTML=M.map(m=>`<option value="${m.id}">ج${m.round_number}: ${tn(m.home_team_id)} × ${tn(m.away_team_id)}</option>`).join('');
 fillPlayers();
}
function fillPlayers(){const m=M.find(x=>x.id==$('#smatch').value);$('#splayer').innerHTML=P.filter(p=>m&&(p.team_id==m.home_team_id||p.team_id==m.away_team_id)).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}
$('#smatch').onchange=fillPlayers;
$('#teamForm').onsubmit=e=>{e.preventDefault();run(sb.from('teams').insert({name:$('#tname').value.trim(),short_name:$('#tshort').value.trim()||null,badge_emoji:$('#temoji').value.trim()||'⚽'}),'تمت إضافة الفريق');e.target.reset()};
$('#playerForm').onsubmit=e=>{e.preventDefault();run(sb.from('players').insert({team_id:+$('#pteam').value,name:$('#pname').value.trim(),shirt_number:$('#pnum').value?+$('#pnum').value:null,position:$('#ppos').value.trim()||null}),'تمت إضافة اللاعب');e.target.reset()};
$('#gen').onclick=()=>{
 if(T.length!==6)return say('لازم يكون عندك 6 فرق بالظبط.');
 if(M.length&&!confirm('فيه مباريات موجودة بالفعل، والجدول الجديد هيتضاف فوقها. متأكد؟'))return;
 const n=6,rows=[];let a=T.map(t=>t.id);
 for(let r=0;r<n-1;r++){for(let i=0;i<n/2;i++){let h=a[i],w=a[n-1-i];if(i==0&&r%2)[h,w]=[w,h];rows.push({round_number:r+1,home_team_id:h,away_team_id:w},{round_number:r+n,home_team_id:w,away_team_id:h})}a=[a[0],a[n-1],...a.slice(1,n-1)]}
 run(sb.from('matches').insert(rows),'تم إنشاء 30 مباراة (غير منشورة لحد ما تنشرها).');
};
$('#matches').onclick=e=>{if(!e.target.classList.contains('sv'))return;const tr=e.target.closest('tr'),v=c=>tr.querySelector(c).value;
 run(sb.from('matches').update({home_score:v('.hs')===''?null:+v('.hs'),away_score:v('.as')===''?null:+v('.as'),status:v('.st'),is_published:tr.querySelector('.pub').checked}).eq('id',tr.dataset.id),'تم حفظ المباراة')};
$('#statForm').onsubmit=e=>{e.preventDefault();run(sb.from('player_match_stats').upsert({match_id:+$('#smatch').value,player_id:+$('#splayer').value,goals:+$('#sg').value,assists:+$('#sa').value,rating:$('#sr').value===''?null:+$('#sr').value,is_man_of_match:$('#sm').checked},{onConflict:'match_id,player_id'}),'تم حفظ الإحصائيات')};
init();
