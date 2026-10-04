'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const local = ['127.0.0.1','localhost'].includes(location.hostname) && location.pathname.startsWith('/stock-demo/');
  const escape = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = (x,n=2) => x == null ? '—' : Number(x).toLocaleString('zh-CN',{minimumFractionDigits:n,maximumFractionDigits:n});
  let snapshot=null, result=null, endpoint='', mode=local?'local':'published', revision=0, controller=null, busy=false, userSpot=false;
  function stale(message='参数或行情已变化，请重新计算。') {
    result=null; $('exportPrice').disabled=true;
    $('result').innerHTML=`<span class="big">等待计算</span><p>${escape(message)}</p>`;
  }
  function validate(m) {
    if (!m || m.schema_version!==1 || !/^\d{6}$/.test(m.ticker) || !/^[0-9a-f]{64}$/.test(m.snapshot_id||'') ||
        !m.quote || !Number.isFinite(m.quote.price) || m.quote.price<=0 || !['TUSHARE_DAILY','TUSHARE_RT_K'].includes(m.quote.source) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(m.quote.trade_date) || !Number.isFinite(Date.parse(m.quote.trade_time)) ||
        !Number.isFinite(Date.parse(m.fetched_at)) || !Array.isArray(m.schedule) || m.schedule.length!==6 ||
        !Array.isArray(m.realized?.nodes) || m.realized.nodes.length!==6 || !m.feed ||
        !m.dividends || !Array.isArray(m.dividends.future) || !Array.isArray(m.dividends.pending) || !m.model_state) throw Error('行情快照格式不正确。');
    if (m.schedule.some(s=>s.contract_start_date!==m.quote.trade_date)) throw Error('行情与合约日期不一致。');
    if (m.realized.nodes.some(n=>n.value!==null && (!Number.isFinite(n.value)||n.value<0))) throw Error('波动率数据无效。');
    return m;
  }
  function table(headers, rows) {
    return '<thead><tr>'+headers.map(x=>`<th>${escape(x)}</th>`).join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>`<td>${escape(x??'—')}</td>`).join('')+'</tr>').join('')+'</tbody>';
  }
  function labels() {
    if (!snapshot) return;
    const m=snapshot, age=(Date.now()-Date.parse(m.quote.trade_time))/1000;
    const live=['local','remote'].includes(mode) && m.quote.is_realtime && age>=0 && age<=120;
    const kind=live?'盘中实时':m.quote.source==='TUSHARE_DAILY'?'最新可用收盘':'已存盘中快照';
    $('connection').textContent=mode==='published'?'GitHub Pages · 已发布快照；刷新读取最近一次发布的数据。':mode==='imported'?'客户导入快照 · 不自动刷新。':`${mode==='local'?'本地':'已连接'} Tushare 服务 · ${kind}`;
    $('feedStatus').textContent=`${m.ts_code} · ${kind} · 行情时间 ${m.quote.trade_time} · 抓取 ${m.fetched_at}${m.feed.rt_k_status==='ACCESS_DENIED'?' · 盘中 rt_k 未开通（40203），当前使用日线':''}${m.feed.daily_lagging?' · 个股日线落后于最新完整交易日':''}`;
    if (result && result.quote_source==='TUSHARE_RT_K' && !live) stale('盘中报价已过时，请刷新行情后重新计算。');
  }
  function draw() {
    const m=snapshot; labels();
    const rv=m.realized.nodes[0].value;
    $('metrics').innerHTML=[['现货 CNY',number(m.quote.price,4)],['行情日期',m.quote.trade_date],['21 日 realized',rv==null?'—':number(rv*100)+'%'],['模型曲面日期',m.model_state.as_of]].map(([name,value])=>`<div class="metric"><span>${escape(name)}</span><b>${escape(value)}</b></div>`).join('');
    const maximum=Math.max(.01,...m.realized.nodes.map(n=>n.value??0));
    $('rv').innerHTML=m.realized.nodes.map(n=>`<div class="barcol"><span class="rvnumber">${n.value==null?'—':number(n.value*100)+'%'}</span><div class="bar" style="height:${n.value==null?0:100*n.value/maximum}px"></div>${n.lookback_observations} 个观测</div>`).join('');
    $('rvNote').textContent=`历史截至 ${m.realized.as_of} · ${m.realized.observations} 个日线观测 · 复权收盘价对数收益、样本标准差 × √252；窗口分别为 21/42/63/84/105/126 个观测。停牌期间不补造日收益。`;
    $('scenarioDate').textContent=`情景起点：${m.quote.trade_date}（行情日）；${m.quote.is_realtime?'盘中 spot / 收盘方差时钟近似':'收盘情景'}。原始 Market Context 日期仍为 2026-08-13。`;
    $('schedule').innerHTML=table(['期限','起点','到期','权利金日','收益支付日','交易日数','状态'],m.schedule.map(s=>[s.tenor_months+'M',s.contract_start_date,s.actual_expiry_date,s.premium_payment_date,s.payoff_settlement_date,s.trading_days_to_expiry,s.status==='AVAILABLE'?'可计算':'待日历']));
    $('divStatus').textContent=m.dividends.status==='FETCHED'?`截至 ${m.quote.trade_date} 已公告未来实施计划 ${m.dividends.future.length} 笔；待实施/待补字段 ${m.dividends.pending.length} 项。未公告未来分红仍未知。`:'分红接口未完整取得数据，需明确输入客户股息率。';
    $('dividends').innerHTML=table(['公告日','除息日','派息日','现金 CNY/股'],m.dividends.future.map(e=>[e.announcement_date,e.ex_date,e.pay_date,number(e.amount,6)]));
    $('provenance').textContent=JSON.stringify({snapshot_id:m.snapshot_id,quote:m.quote,fetched_at:m.fetched_at,feed:m.feed,history:m.history,realized_method:m.realized.method,model_state:m.model_state,rate_state:m.rate_state,pricing_convention:m.pricing_convention},null,2);
    $('downloadMarket').disabled=false;
  }
  function updateVol() {
    const rv=$('volSource').value==='realized'; $('vol').disabled=rv; $('vol').required=!rv;
    if (rv) $('vol').value=snapshot?.realized.nodes.find(n=>n.tenor_months===+$('tenor').value)?.value==null?'':(snapshot.realized.nodes.find(n=>n.tenor_months===+$('tenor').value).value*100).toFixed(6);
  }
  function accept(m, nextMode) {
    const changedStock=snapshot?.ticker!==m.ticker;
    snapshot=validate(m); mode=nextMode;
    if (!userSpot || changedStock) { $('spot').value=m.quote.price; userSpot=false; }
    draw(); updateVol(); stale('行情已更新，确认参数后重新计算。');
  }
  async function refresh() {
    const input=$('ticker').value.trim().toUpperCase();
    if (!/^\d{6}(\.(SH|SZ))?$/.test(input)) { $('error').textContent='请输入六位沪深 A 股代码。'; return; }
    const rev=++revision; controller?.abort(); controller=new AbortController();
    busy=true; $('refresh').disabled=true; $('error').textContent=''; stale('正在刷新行情…');
    const timeout=setTimeout(()=>controller?.abort(),110000);
    try {
      const connected=endpoint!==''||local;
      const url=connected?`${endpoint}/api/market/ashare-live?ticker=${encodeURIComponent(input)}`:`latest-market-context.json?v=${Date.now()}`;
      const response=await fetch(url,{cache:'no-store',credentials:'omit',signal:controller.signal});
      const data=await response.json();
      if (!response.ok) throw Error(data.error||'行情读取失败');
      const m=connected?data:data.tickers?.[input.slice(0,6)];
      if (!m) throw Error('该代码尚未发布快照。使用本地行情服务或导入该股票的行情 JSON。');
      if (rev!==revision) return;
      if (m.ticker!==input.slice(0,6) || (input.includes('.') && m.ts_code!==input)) throw Error('返回标的与请求不一致。');
      accept(m,connected?(endpoint?'remote':'local'):'published');
    } catch(e) {
      if (rev!==revision) return;
      $('error').textContent=e.name==='AbortError'?'行情请求超时，请重试。':e.message;
      snapshot=null; result=null; $('downloadMarket').disabled=true; $('exportPrice').disabled=true;
      for (const id of ['metrics','rv','schedule','dividends','provenance','feedStatus','rvNote','divStatus','scenarioDate']) $(id).textContent='';
      $('connection').textContent='本次行情不可用；旧数据不用于估值。'; stale('行情读取失败，当前不估值。');
    } finally {
      clearTimeout(timeout);
      if (rev===revision) {busy=false;$('refresh').disabled=false;}
    }
  }
  function download(object,name) {
    const url=URL.createObjectURL(new Blob([JSON.stringify(object,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('refresh').onclick=refresh;
  $('ticker').oninput=()=>{
    revision++;controller?.abort();busy=false;$('refresh').disabled=false;snapshot=null;userSpot=false;
    $('downloadMarket').disabled=true;$('connection').textContent='标的已修改，请刷新。';
    for(const id of ['metrics','rv','schedule','dividends','provenance','feedStatus','rvNote','divStatus','scenarioDate'])$(id).textContent='';
    stale('标的已修改，请刷新行情。');
  };
  $('ticker').onkeydown=e=>{if(e.key==='Enter')refresh();};
  $('connect').onclick=()=>{
    try {
      const input=$('endpoint').value.trim();
      if(input){const url=new URL(input);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('请输入 HTTPS 后台域名，不包含密钥、路径或查询参数。');endpoint=url.origin;}else endpoint='';
      refresh();
    } catch(e){$('error').textContent=e.message;}
  };
  $('downloadMarket').onclick=()=>{if(snapshot)download(snapshot,`MARKET_CONTEXT_${snapshot.ticker}_${snapshot.quote.trade_date}.json`);};
  $('importMarket').onchange=async e=>{
    try {
      const f=e.target.files[0];if(!f)return;if(f.size>2000000)throw Error('快照文件过大。');
      const m=validate(JSON.parse(await f.text()));revision++;controller?.abort();busy=false;$('refresh').disabled=false;
      $('ticker').value=m.ticker;$('auto').checked=false;userSpot=false;accept(m,'imported');$('error').textContent='';
    } catch(err){$('error').textContent=err.message;}
  };
  $('pricingForm').oninput=e=>{if(e.target.id==='spot')userSpot=true;stale();};
  $('volSource').onchange=()=>{if($('volSource').value==='manual')$('vol').value='';updateVol();stale();};
  $('tenor').onchange=()=>{updateVol();stale();};
  $('divMode').onchange=()=>{
    const yieldMode=$('divMode').value==='yield';$('yieldField').hidden=!yieldMode;$('scaleField').hidden=yieldMode;
    $('divYield').required=yieldMode;$('divScale').required=!yieldMode;stale();
  };
  $('resetSpot').onclick=()=>{if(snapshot){$('spot').value=snapshot.quote.price;userSpot=false;stale();}};
  $('pricingForm').onsubmit=e=>{
    e.preventDefault();result=null;$('exportPrice').disabled=true;
    try {
      if(!snapshot || busy || snapshot.ticker!==$('ticker').value.slice(0,6))throw Error('请先刷新当前标的行情。');
      if(snapshot.quote.is_realtime && (Date.now()-Date.parse(snapshot.quote.trade_time))/1000>120 && ['local','remote'].includes(mode))throw Error('盘中报价已过时，请刷新。');
      const v=id=>$(id).value.trim()===''?NaN:Number($(id).value);
      const inputs={spot:v('spot'),notional:v('notional'),tenor:v('tenor'),strike_ratio:v('strike')/100,
        option_type:$('optionType').value,vol_source:$('volSource').value,
        vol:$('volSource').value==='realized'?snapshot.realized.nodes.find(n=>n.tenor_months===v('tenor'))?.value:v('vol')/100,
        base_rate:v('baseRate')/100,funding_bps:v('funding'),discount_bps:v('discount'),borrow_bps:v('borrow'),markup_bps:v('markup'),
        dividend_mode:$('divMode').value,dividend_scale:v('divScale'),dividend_yield:$('divMode').value==='yield'?v('divYield')/100:0};
      const r=LivePricing.price(snapshot,inputs);result=r;
      $('result').innerHTML=`<span class="big">${number(r.premium_cny)} CNY</span><p>情景卖价 ${number(r.offer*100,4)}% · ${inputs.vol_source==='realized'?'历史 RV 情景':'客户 IV 假设'}</p><dl>${[['估值起点',r.as_of],['实际到期',r.schedule.actual_expiry_date],['权利金支付日',r.schedule.premium_payment_date],['收益支付日',r.schedule.payoff_settlement_date],['使用波动率',number(r.volatility*100,4)+'%'],['Forward',number(r.forward,6)],['行权价 / 股数',number(r.strike,4)+' / '+number(r.shares,4)],['BUS/252 方差时间',number(r.variance_time,8)],['权利金 DF',number(r.premium_df,8)],['收益 DF',number(r.payoff_df,8)],['现值 CNY',number(r.pv_cny)]].map(([a,b])=>`<dt>${escape(a)}</dt><dd>${escape(b)}</dd>`).join('')}</dl>`;
      $('exportPrice').disabled=false;
    } catch(err){stale(err.message);}
  };
  $('exportPrice').onclick=()=>{if(result)download({pricing:result,market_snapshot:snapshot},`MARKET_CONTEXT_${snapshot.ticker}_valuation.json`);};
  setInterval(()=>{labels();if($('auto').checked&&!busy&&!document.hidden&&mode!=='imported')refresh();},30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)labels();});
  refresh();
})();
