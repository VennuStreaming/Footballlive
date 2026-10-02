const $=s=>document.querySelector(s);
async function loadMatches(mode="today", btn){
  document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active")); if(btn) btn.classList.add("active");
  $("#status").textContent="Memuat…";
  try{
    const r=await fetch(`/api/matches?mode=${mode}`); const d=await r.json(); renderMatches(d.response||[]);
    $("#status").textContent=`${(d.response||[]).length} pertandingan`;
  }catch(e){$("#status").textContent="Gagal mengambil data pertandingan."}
}
async function searchMatches(){const q=$("#search").value.trim(); if(!q)return loadMatches(); const r=await fetch(`/api/matches?q=${encodeURIComponent(q)}`); const d=await r.json(); renderMatches(d.response||[]); $("#status").textContent=`Hasil pencarian: ${q}`;}
function renderMatches(items){
  const el=$("#matches"); if(!items.length){el.innerHTML='<div class="empty">Belum ada pertandingan pada filter ini.</div>';return}
  el.innerHTML=items.map(x=>{const f=x.fixture||{},t=x.teams||{},g=x.goals||{},s=f.status||{}; return `<a class="match" href="/match.html?id=${f.id}"><div class="match-meta">${t?.home?.name||"Home"} <span>${s.short||""}</span> ${t?.away?.name||"Away"}</div><div class="score">${g.home??"-"} : ${g.away??"-"}</div><div class="muted">${f.date?new Date(f.date).toLocaleString("id-ID"):""}</div></a>`}).join("");
}
async function init(){const me=await fetch("/api/auth/me").then(r=>r.json()).catch(()=>({})); if(me.user) $("#account").innerHTML=`<span class="user">Hi, ${me.user.email}</span> <button class="btn ghost" onclick="logout()">Keluar</button>`; loadMatches();}
async function logout(){await fetch("/api/auth/logout",{method:"POST"});location.reload()}
init();