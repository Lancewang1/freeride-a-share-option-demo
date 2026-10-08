'use strict';
const $=id=>document.getElementById(id);
const DATA_LABELS={market:'Market Context',model:'模型估计',realized:'历史 realized（P 测度）'};
const SOURCE_NOTES={market:'原始卖价反解的等效 IV，已包含商业影响',model:'第二层预测的卖价等效 IV，1–4M；尚非当日自动更新模型',realized:'历史收益计算的 RV；按 strike 展平，不能解释为风险中性 IV'};
const fmtPct=v=>v==null?'—':(v*100).toFixed(2)+'%';
const fmtNum=(v,n=4)=>v==null?'—':Number(v).toLocaleString('zh-CN',{maximumFractionDigits:n});
const escapeText=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current='000166', chartMode='surface';
window.lastPricing=null;
$('tickers').innerHTML=Object.keys(DATA).map(t=>`<option value="${t}"></option>`).join('');
$('tenor').innerHTML=MONTHS.map(m=>`<option value="${m}">${m}M</option>`).join('');
$('strike').innerHTML=K.map((k,i)=>`<option value="${i}" ${i===3?'selected':''}>${Math.round(k*100)}% spot</option>`).join('');
$('evidence').textContent=JSON.stringify({as_of:'2026-08-13',source_sha256:META.source?.sha256,conventions:META.conventions,cny_curve:META.cny_curve,dividend_reference_sha256:META.dividend_reference_sha256,model_status:'FROZEN_2026_08_13_NO_LIVE_RETRAINING',realized_status:'HISTORICAL_RV_NOT_IV'},null,2);
function item(){return DATA[current];}
function layer(source){if(source==='market')return item().iv;const l=SURFACE_LAYERS[current]||{};return l[source==='model'?'model':'realized']||Array(42).fill(null);}
function scheduleFor(m){return META.schedule.find(s=>s.calendar_exchange===item().exchange&&s.tenor_months===m);}
function invalidate(message){window.lastPricing=null;$('export').disabled=true;$('pricing-result').innerHTML=`<div class="big">待计算</div><p>${escapeText(message)}</p>`;$('pricing-note').textContent='';}
function color(v,min,max){if(v==null)return '#f1f4f5';const z=max===min?.5:(v-min)/(max-min);return `hsl(${165-125*Math.max(0,Math.min(1,z))} 48% ${91-28*Math.max(0,Math.min(1,z))}%)`;}
function surfaceTable(source,min,max){
  const vals=layer(source);let h=`<div class="surface-card"><h3>${DATA_LABELS[source]}</h3><div class="source-note">${SOURCE_NOTES[source]}</div><div class="surface-wrap"><table class="surface"><thead><tr><th>期限 / K</th>${K.map(k=>`<th>${Math.round(k*100)}C</th>`).join('')}</tr></thead><tbody>`;
  for(const m of MONTHS){h+=`<tr><th>${m}M</th>`;K.forEach((k,i)=>{const v=vals[(m-1)*7+i],selected=+$('tenor').value===m&&+$('strike').value===i&&$('volSource').value===source;h+=`<td><button class="${v==null?'pending ':''}${selected?'selected':''}" style="background:${color(v,min,max)}" data-source="${source}" data-m="${m}" data-k="${i}" title="${DATA_LABELS[source]} · ${m}M ${Math.round(k*100)}C">${fmtPct(v)}</button></td>`;});h+='</tr>';}
  return h+'</tbody></table></div></div>';
}
function renderCharts(){
  if(!window.Plotly){$('stock-surface-chart').textContent='三维绘图库未载入，请使用下方节点表。';return;}
  const source=$('surfaceSource').value, vals=layer(source), colors={market:'#176b61',model:'#366db0',realized:'#c78b27'};
  const z=MONTHS.map(m=>K.map((_,i)=>vals[(m-1)*7+i]==null?null:100*vals[(m-1)*7+i]));
  const all=['market','model','realized'].flatMap(layer).filter(Number.isFinite), min=Math.min(...all)*100,max=Math.max(...all)*100;
  const trace={type:chartMode,x:K.map(k=>k*100),y:MONTHS,z,connectgaps:false,colorscale:'Viridis',cmin:min,cmax:max,zmin:min,zmax:max,colorbar:{title:{text:'波动率 %'},len:.7},hovertemplate:'K/S₀ %{x}%<br>期限 %{y}M<br>波动率 %{z:.2f}%<extra>'+DATA_LABELS[source]+'</extra>'};
  const layout={height:390,margin:{l:45,r:20,t:15,b:35},paper_bgcolor:'#fff',font:{family:'Segoe UI, Microsoft YaHei',color:'#223b4a'},uirevision:current,
    scene:{xaxis:{title:{text:'K / S₀ (%)'}},yaxis:{title:{text:'期限 (月)'},tickvals:MONTHS},zaxis:{title:{text:'波动率 (%)'},range:[min*.9,max*1.05]},camera:{eye:{x:1.5,y:-1.8,z:1.1}}},xaxis:{title:{text:'K / S₀ (%)'}},yaxis:{title:{text:'期限 (月)'},tickvals:MONTHS}};
  const config={responsive:true,displaylogo:false};
  Plotly.react('stock-surface-chart',[trace],layout,config).catch(()=>{$('chart-note').textContent='三维显示不可用，可切换热力图或使用下方节点表。';});
  const m=+$('tenor').value;
  Plotly.react('stock-smile-chart',['market','model','realized'].map(src=>({type:'scatter',mode:'lines+markers',name:DATA_LABELS[src],x:K.map(k=>k*100),y:K.map((_,i)=>{const v=layer(src)[(m-1)*7+i];return v==null?null:v*100;}),connectgaps:false,line:{color:colors[src]},hovertemplate:'K/S₀ %{x}%<br>%{y:.2f}%<extra>%{fullData.name}</extra>'})),{...layout,margin:{l:55,r:15,t:20,b:70},yaxis:{title:{text:'波动率 (%)'}},legend:{orientation:'h',y:-.2},title:{text:`${m}M · 三来源对照`,font:{size:14}}},config).catch(()=>{});
  $('chart-note').textContent=`${current} · 2026-08-13 · ${DATA_LABELS[source]}。${SOURCE_NOTES[source]}。曲面连接已有节点以辅助观察；空白节点不插补。`;
  const chart=$('stock-surface-chart');chart.removeAllListeners?.('plotly_click');chart.on('plotly_click',event=>{const point=event.points?.[0];if(!point||point.z==null)return;const ki=K.findIndex(k=>Math.abs(k*100-point.x)<1e-6),m=Number(point.y);if(ki<0||!MONTHS.includes(m))return;selectNode(source,m,ki);});
}
function renderSurface(){
  const all=['market','model','realized'],values=all.flatMap(layer).filter(Number.isFinite),min=Math.min(...values),max=Math.max(...values);
  $('surface-grid').innerHTML=all.map(src=>surfaceTable(src,min,max)).join('');
  $('surface-range').textContent=values.length?`三来源共用色阶 ${fmtPct(min)} – ${fmtPct(max)}`:'';
  $('surface-note').textContent=all.map(src=>`${DATA_LABELS[src]} ${layer(src).filter(Number.isFinite).length}/42 节点`).join(' · ')+`。${item().pending_dividends||0} 项分红计划待确认。`;
  renderCharts();
}
function renderAsset(){
  $('asset-state').textContent=`${current} · ${item().exchange} · 2026-08-13 收盘参考 ${item().close??'缺失'} CNY`;
  $('asset-metrics').innerHTML=['market','model','realized'].map(src=>`<div class="metric"><span>${DATA_LABELS[src]} · ATM 1M</span><b>${fmtPct(layer(src)[3])}</b></div>`).join('')+`<div class="metric"><span>已公告分红</span><b>${item().dividends.length} 笔</b></div>`;
  const ss=MONTHS.map(scheduleFor);
  $('calendar-state').textContent=`${item().exchange} · ${ss[0].calendar_version} · 权利金 T+1 ${ss[0].premium_payment_date}`;
  $('schedule').innerHTML='<thead><tr><th>期限</th><th>未调整到期</th><th>实际到期</th><th>交易日数</th><th>方差时间</th><th>收益支付日</th></tr></thead><tbody>'+ss.map(s=>`<tr><th>${s.tenor_months}M</th><td>${s.unadjusted_expiry_date}</td><td>${s.actual_expiry_date||'待日历'}</td><td>${s.trading_days_to_expiry??'—'}</td><td>${s.variance_year_fraction?.toFixed(8)??'—'}</td><td>${s.payoff_settlement_date||'待日历'}</td></tr>`).join('')+'</tbody>';
  $('dividends').innerHTML='<thead><tr><th>实施公告日</th><th>除息日</th><th>派息日</th><th>CNY/股</th></tr></thead><tbody>'+item().dividends.map(e=>`<tr><td>${e.announcement_date}</td><td>${e.ex_date}</td><td>${e.pay_date}</td><td>${Number(e.amount).toFixed(6)}</td></tr>`).join('')+'</tbody>';
}
function numberInput(id){return $(id).value.trim()===''?NaN:Number($(id).value);}
function price(){
  invalidate('请检查当前输入。');
  try{
    if($('ticker').value.trim()!==current||!DATA[current])throw Error('请加载有效股票代码。');
    const m=+$('tenor').value,ki=+$('strike').value,source=$('volSource').value,override=$('volOverride').value.trim()!=='';
    const vol=override?numberInput('volOverride')/100:layer(source)[(m-1)*7+ki];
    if(vol==null)throw Error('所选来源在该节点没有可用波动率，请选择已覆盖节点。');
    const pvOverride=$('dividendOverride').value.trim()!=='';
    const params={spot:numberInput('spot'),notional:numberInput('notional'),tenor:m,strike_ratio:K[ki],option_type:$('optionType').value,
      vol,vol_source:override?'manual':source,base_rate:$('baseRate').value.trim()===''?null:numberInput('baseRate')/100,
      funding_bps:numberInput('fundingSpread'),discount_bps:numberInput('discountSpread'),borrow_bps:numberInput('borrowCost'),markup_bps:numberInput('markup'),
      dividend_mode:pvOverride?'pv':'declared',dividend_pv:pvOverride?numberInput('dividendOverride'):null,dividend_scale:numberInput('dividendScale')};
    const market={ticker:current,snapshot_id:META.source?.sha256,quote:{source:'MARKET_CONTEXT_20260813',trade_time:'2026-08-13T15:00:00+08:00'},model_state:{as_of:'2026-08-13'},rate_curve:META.cny_curve,
      schedule:MONTHS.map(m=>{const s=scheduleFor(m);return {...s,status:s.actual_expiry_date&&s.payoff_settlement_date?'AVAILABLE':'PENDING_CALENDAR_COVERAGE'};}),dividends:{status:'FETCHED',future:item().dividends}};
    const r=LivePricing.price(market,params),observed=item().values[(m-1)*7+ki],label=override?'客户波动率覆盖':DATA_LABELS[source];
    const volatilityStatus=override?'CLIENT_VOL_ASSUMPTION':source==='realized'?'HISTORICAL_RV_SCENARIO_NOT_IV':source==='model'?'MODEL_OFFER_EQUIVALENT_IV':'MARKET_CONTEXT_OFFER_EQUIVALENT_IV';
    const comparable=params.option_type==='call';
    window.lastPricing={...r,source:label,volatility_status:volatilityStatus,tenor_months:m,strike_ratio:K[ki],spot:params.spot,notional:params.notional,offer_ratio:r.offer,forward_ratio:r.forward/params.spot,
      market_context_offer_ratio:comparable?observed:null,market_context_premium_cny:comparable&&observed!=null?observed*params.notional:null,
      market_context_comparison:'Original call offer under the original carry and spot; changes are client scenarios'};
    $('pricing-result').innerHTML=`<div class="big">${r.premium_cny.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})} CNY</div><p>情景卖价 <b>${(r.offer*100).toFixed(4)}%</b> · ${label}</p><dl>`+
      [['使用波动率',fmtPct(vol)],['固定行权价 / 股数',fmtNum(r.strike)+' / '+fmtNum(r.shares)],['Market Context 原认购卖价',comparable?fmtPct(observed):'认沽无原始报价对照'],['Forward / spot',(r.forward/params.spot).toFixed(6)],['到期观察日',r.schedule.actual_expiry_date],['权利金支付日',r.schedule.premium_payment_date],['收益支付日',r.schedule.payoff_settlement_date],['BUS/252 方差时间',r.variance_time.toFixed(8)],['基准 / 融资率',fmtPct(r.reference_rate_at_expiry)+' / '+fmtPct(r.funding_rate_at_expiry)],['现值 CNY',fmtNum(r.pv_cny,2)]].map(([a,b])=>`<dt>${a}</dt><dd>${b}</dd>`).join('')+'</dl>';
    $('pricing-note').textContent=`现金分红 PV ${r.dividend_pv_per_share.toFixed(6)} CNY/股 · premium DF ${r.premium_df.toFixed(8)} · payoff DF ${r.payoff_df.toFixed(8)}。${params.base_rate===null?'采用 2026-08-13 国债参考曲线代理':'采用客户平坦利率'}；${override?'使用客户覆盖波动率':SOURCE_NOTES[source]}。额外商业加点 ${params.markup_bps} bp。`;
    $('export').disabled=false;
  }catch(error){invalidate(error.message);}
}
function loadTicker(){
  const ticker=$('ticker').value.trim();
  if(!Object.hasOwn(DATA,ticker)){$('asset-state').textContent='数据集中没有该代码，请选择有效股票代码。';invalidate('无效标的；当前不能报价或导出。');return;}
  current=ticker;$('spot').value=item().close??'';$('volOverride').value='';$('dividendOverride').value='';
  renderAsset();renderSurface();price();
}
function selectNode(source,m,ki){$('tenor').value=m;$('strike').value=ki;$('volSource').value=source;$('surfaceSource').value=source;$('volOverride').value='';renderSurface();price();}
function resetAssumptions(){
  if(!Object.hasOwn(DATA,$('ticker').value.trim())){invalidate('请先加载有效股票代码。');return;}
  const defaults={notional:1000000,tenor:'1',strike:'3',optionType:'call',baseRate:'',fundingSpread:150,discountSpread:0,borrowCost:0,dividendScale:1,dividendOverride:'',volSource:'market',surfaceSource:'market',volOverride:'',markup:0};
  Object.entries(defaults).forEach(([id,value])=>$(id).value=value);loadTicker();
}
$('show').onclick=loadTicker;$('ticker').onkeydown=e=>{if(e.key==='Enter')loadTicker();};$('ticker').onchange=loadTicker;
$('ticker').oninput=()=>{invalidate('标的已修改，请加载后重新计算。');$('asset-state').textContent='标的待加载，下方图表保留上一次已加载代码。';};
$('calculate').onclick=price;$('reset').onclick=resetAssumptions;
['spot','notional','baseRate','fundingSpread','discountSpread','borrowCost','dividendScale','dividendOverride','volOverride','markup'].forEach(id=>$(id).addEventListener('input',price));
['tenor','strike','optionType','volSource'].forEach(id=>$(id).addEventListener('change',()=>{if(id==='volSource'){$('surfaceSource').value=$('volSource').value;$('volOverride').value='';}renderSurface();price();}));
$('surfaceSource').onchange=()=>{$('volSource').value=$('surfaceSource').value;$('volOverride').value='';renderSurface();price();};
['surface','heatmap'].forEach(mode=>$('view-'+mode).onclick=()=>{chartMode=mode;['surface','heatmap'].forEach(x=>$('view-'+x).setAttribute('aria-pressed',String(x===mode)));renderCharts();});
$('surface-grid').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;selectNode(b.dataset.source,+b.dataset.m,+b.dataset.k);$('pricer').scrollIntoView({behavior:'smooth',block:'start'});};
$('export').onclick=()=>{
  if(!window.lastPricing)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify({pricing:window.lastPricing,provenance:{as_of:'2026-08-13',source_sha256:META.source?.sha256,curve:META.cny_curve,dividend_reference_sha256:META.dividend_reference_sha256}},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`MARKET_CONTEXT_${current}_pricing.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
loadTicker();
