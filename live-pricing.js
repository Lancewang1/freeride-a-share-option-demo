/* Same forward/settlement conventions as freeride.ashare_carry.market_factors. */
(function (root) {
  'use strict';
  const finite = (x, name, lo, hi) => {
    if (typeof x !== 'number' || !Number.isFinite(x) || x < lo || x > hi) throw Error(`${name} 无效`);
    return x;
  };
  function cdf(x) {
    const t = 1 / (1 + .2316419 * Math.abs(x));
    const p = Math.exp(-x*x/2)/Math.sqrt(2*Math.PI)*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
    return x >= 0 ? 1-p : p;
  }
  function price(market, p) {
    const s = market.schedule.find(s => s.tenor_months === p.tenor);
    if (!s || s.status !== 'AVAILABLE' || !s.actual_expiry_date || !s.payoff_settlement_date) throw Error('期限或支付日超出已核实交易日历，当前不估值。');
    const spot = finite(p.spot, 'Spot', .0001, 1e7), n = finite(p.notional, '本金', .01, 1e13);
    const k = finite(p.strike_ratio, 'Strike%', .01, 5), v = finite(p.vol, '波动率', 0, 10);
    const r = finite(p.base_rate, '基准利率', -.2, .5);
    const rf = r + finite(p.funding_bps, '融资加点', -2000, 5000)/10000;
    const rd = r + finite(p.discount_bps, '贴现加点', -2000, 5000)/10000;
    const borrow = finite(p.borrow_bps, '借券成本', 0, 5000)/10000;
    const markup = finite(p.markup_bps, '额外商业加点', 0, 5000)/10000;
    const te = finite(s.actual_calendar_days, '到期天数', 1, 1000)/365;
    const tp = finite(s.premium_payment_calendar_days, '权利金天数', 1, 1000)/365;
    const ts = finite(s.payoff_settlement_calendar_days_from_start, '收益支付天数', 1, 1000)/365;
    const tv = finite(s.variance_year_fraction, '方差时间', .00001, 5);
    let q = 0, divForward = 0;
    if (p.dividend_mode === 'yield') q = finite(p.dividend_yield, '股息率', 0, .5);
    else if (p.dividend_mode === 'declared') {
      if (market.dividends.status !== 'FETCHED') throw Error('分红数据未完整取得，请输入股息率情景。');
      const scale = finite(p.dividend_scale, '股息乘数', 0, 5);
      for (const e of market.dividends.future) {
        if (e.ex_date > s.actual_expiry_date) continue;
        if (e.conflict || e.stock_dividend_ratio > 0) throw Error('分红包含送转或冲突记录，需先复核。');
        const start = Date.parse(s.contract_start_date+'T00:00:00Z');
        const tx = (Date.parse(e.ex_date+'T00:00:00Z')-start)/86400000/365;
        const ty = (Date.parse(e.pay_date+'T00:00:00Z')-start)/86400000/365;
        if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx <= 0 || ty < tx) throw Error('分红日期无效');
        divForward += finite(e.amount, '现金分红', 0, 1e5)*scale*Math.exp(rf*(te-ty)-borrow*(te-tx));
      }
    } else throw Error('未知股息模式');
    const growth = Math.exp((rf-borrow-q)*te), F = spot*growth-divForward, K = spot*k;
    if (!(F > 0)) throw Error('现金分红扣减后远期非正，请复核输入。');
    const dp = Math.exp(-rd*tp), ds = Math.exp(-rd*ts), st = v*Math.sqrt(tv);
    if (!['call','put'].includes(p.option_type)) throw Error('期权类型无效');
    const call = p.option_type === 'call';
    let value;
    if (st === 0) value = Math.max(call ? F-K : K-F, 0);
    else {
      const d1 = Math.log(F/K)/st + st/2, d2 = d1-st;
      value = call ? F*cdf(d1)-K*cdf(d2) : K*cdf(-d2)-F*cdf(-d1);
    }
    const model = ds*value/spot/dp;
    return {status:'INDICATIVE_SCENARIO',ticker:market.ticker,as_of:s.contract_start_date,
      snapshot_id:market.snapshot_id,quote_time:market.quote.trade_time,quote_source:market.quote.source,
      inputs:{...p},schedule:{...s},forward:F,strike:K,shares:n/spot,volatility:v,
      premium_df:dp,payoff_df:ds,variance_time:tv,model_offer:model,offer:model+markup,
      premium_cny:(model+markup)*n,pv_cny:(model+markup)*n*dp,
      volatility_status:p.vol_source==='realized'?'HISTORICAL_RV_SCENARIO_NOT_IV':'CLIENT_VOL_ASSUMPTION',
      model_as_of:market.model_state.as_of,model_retrained:false};
  }
  root.LivePricing = {price};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LivePricing;
})(typeof window !== 'undefined' ? window : globalThis);
