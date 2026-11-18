/* ==========================================================================
   法律服务工具箱 · 计算器与官网直达
   --------------------------------------------------------------------------
   每个计算器都是「字段 + 公式 + 依据」三段式：
     fields  可改的参数
     calc    纯函数，输入对象 → 输出行
     basis   现行有效的法规 / 司法解释名称与条款（写到条，不写「相关规定」）
   数字只作参考，页面底部已把边界写清楚。
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };
  function n(v, d) { var x = parseFloat(v); return isFinite(x) ? x : (d || 0); }
  function money(x) {
    if (!isFinite(x)) x = 0;
    return "¥" + x.toLocaleString("zh-CN", { maximumFractionDigits: 2, minimumFractionDigits: x === Math.round(x) ? 0 : 2 });
  }
  function pct(x) { return (Math.round(x * 100) / 100) + "%"; }
  function days(x) { return Math.round(x) + " 天"; }
  function dstr(d) {
    return d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日";
  }

  /* ---------------- 分段累计 ---------------- */
  function brackets(amount, steps) {
    /* steps: [[上限, 费率], ...] 最后一档上限为 Infinity */
    var fee = 0, lo = 0;
    for (var i = 0; i < steps.length; i++) {
      var hi = steps[i][0], rate = steps[i][1];
      if (amount <= lo) break;
      var seg = Math.min(amount, hi) - lo;
      fee += seg * rate;
      lo = hi;
    }
    return fee;
  }

  /* ======================================================================
     计算器
     ====================================================================== */
  var CALCS = [

    /* 01 诉讼费 */
    {
      id: "court-fee", name: "诉讼费（受理费）", en: "COURT ACCEPTANCE FEE",
      desc: "财产案件分段累计，简易程序与调解结案可减半",
      fields: [
        { k: "type", label: "案件类型", type: "sel", v: "prop", opts: [["prop", "财产案件（按标的额）"], ["divorce", "离婚案件"], ["labor", "劳动争议"], ["admin", "行政案件"], ["person", "人格权案件"]] },
        { k: "amount", label: "诉讼标的额", type: "num", v: 500000, unit: "元" },
        { k: "half", label: "收费方式", type: "sel", v: "1", opts: [["1", "全额（普通程序）"], ["0.5", "减半（简易程序 / 调解 / 撤诉）"]] }
      ],
      calc: function (v) {
        var rows = [], fee = 0, note = "";
        if (v.type === "prop") {
          fee = brackets(v.amount, [[1e4, 0], [1e5, .025], [2e5, .02], [5e5, .015], [1e6, .01],
            [2e6, .009], [5e6, .008], [1e7, .007], [2e7, .006], [Infinity, .005]]);
          fee = +fee + 50;                        /* 不超过 1 万元的部分，每件 50 元 */
          note = "50 元起步 + 各档累加";
        } else if (v.type === "divorce") {
          fee = 300;
          var extra = Math.max(0, v.amount - 2e5) * .005;
          fee += extra;
          note = extra > 0 ? "每件 300 元 + 超过 20 万元部分按 0.5% 计" : "每件 50–300 元，此处按上限计";
        } else if (v.type === "labor") {
          fee = 10; note = "劳动争议每件 10 元";
        } else if (v.type === "admin") {
          fee = 50; note = "行政案件每件 50 元（商标、专利、海事行政案件 100 元）";
        } else {
          fee = 500; note = "人格权案件每件 100–500 元，此处按上限计";
        }
        var pay = fee * v.half;
        rows.push({ label: "应交受理费", value: money(pay), big: true, note: note });
        if (v.half === 0.5) rows.push({ label: "（全额标准）", value: money(fee), note: "减半后为应交数" });
        if (v.type === "prop" && v.amount > 2e7) rows.push({ label: "提示", value: "标的额超过 2000 万元", note: "超过部分按 0.5% 累计，另需考虑鉴定、评估、保全等费用" });
        return rows;
      },
      formula:
        "不超过 1 万元：每件 50 元\n" +
        "1 万–10 万：2.5%　｜　10 万–20 万：2%　｜　20 万–50 万：1.5%\n" +
        "50 万–100 万：1%　｜　100 万–200 万：0.9%　｜　200 万–500 万：0.8%\n" +
        "500 万–1000 万：0.7%　｜　1000 万–2000 万：0.6%　｜　2000 万以上：0.5%\n" +
        "各档分段累加（不是全额乘一个比例）",
      basis: [
        ["《诉讼费用交纳办法》（国务院令第 481 号）第十三条第（一）项", "财产案件按争议价额分段累计交纳；离婚案件每件 50–300 元，涉财产分割总额超过 20 万元的部分按 0.5% 交纳；劳动争议每件 10 元；行政案件每件 50 元（商标、专利、海事行政案件 100 元）。"],
        ["同办法第十五条、第十六条", "以调解方式结案或当事人申请撤诉的，减半交纳；适用简易程序审理的案件减半交纳。"],
        ["同办法第二十条", "案件受理费由原告、有独立请求权的第三人、上诉人预交。"]
      ],
      tips: "立案时按「诉讼请求金额」预交，判决后由败诉方负担（部分胜诉按比例分担）。所以诉请写多少，直接决定先垫多少钱——请求过高又多交费，是这个环节最常见的浪费。"
    },

    /* 02 保全费 */
    {
      id: "preserve-fee", name: "财产保全费", en: "PRESERVATION FEE",
      desc: "按保全财产数额分段计算，最高 5000 元",
      fields: [{ k: "amount", label: "申请保全的财产数额", type: "num", v: 1000000, unit: "元" }],
      calc: function (v) {
        var a = v.amount, fee;
        if (a <= 1000) fee = 30;
        else if (a <= 1e5) fee = 30 + (a - 1000) * .01;
        else fee = 30 + 99000 * .01 + (a - 1e5) * .005;
        var cap = Math.min(fee, 5000);
        return [
          { label: "应交保全费", value: money(cap), big: true, note: fee > 5000 ? "已触及 5000 元上限（原算 " + money(fee) + "）" : "" },
          { label: "另需提供", value: "担保", note: "现金、保函或财产担保，比例由法院确定" }
        ];
      },
      formula:
        "不超过 1000 元：每件 30 元\n" +
        "1000 元–10 万元部分：1%\n" +
        "超过 10 万元部分：0.5%\n" +
        "合计最高不超过 5000 元",
      basis: [
        ["《诉讼费用交纳办法》第十四条第（一）项", "申请保全措施的，财产数额不超过 1000 元或不涉及财产数额的，每件交纳 30 元；超过 1000 元至 10 万元的部分，按 1% 交纳；超过 10 万元的部分，按 0.5% 交纳。但当事人申请保全措施交纳的费用最多不超过 5000 元。"],
        ["《民事诉讼法》第一百零三条、第一百零四条", "诉中与诉前保全的申请条件、担保要求与解除规则。"]
      ],
      tips: "保全费按「实际查封到的财产价值」而非诉请金额计算；申请时往往先按预估填，最终以法院核定为准。保全错误造成损失的，申请人要赔——担保就是为这个准备的。"
    },

    /* 03 借款利息 */
    {
      id: "loan-interest", name: "借款利息与上限", en: "LOAN INTEREST",
      desc: "期内利息、逾期利息，以及一年期 LPR 四倍的天花板",
      fields: [
        { k: "principal", label: "借款本金", type: "num", v: 200000, unit: "元" },
        { k: "rate", label: "约定年利率", type: "num", v: 18, unit: "%" },
        { k: "days", label: "计息天数", type: "num", v: 365, unit: "天" },
        { k: "lpr", label: "一年期 LPR（合同成立时）", type: "num", v: 3.0, unit: "%" }
      ],
      calc: function (v) {
        var cap = v.lpr * 4;
        var byAgreed = v.principal * v.rate / 100 / 365 * v.days;
        var byCap = v.principal * Math.min(v.rate, cap) / 100 / 365 * v.days;
        var rows = [
          { label: "按约定利率计算的利息", value: money(byAgreed), note: "本金 × 年利率 ÷ 365 × 天数" },
          { label: "司法保护上限（4 倍 LPR）", value: pct(cap), note: "本例 " + v.lpr + "% × 4" }
        ];
        if (v.rate > cap) {
          rows.push({ label: "超过上限，可获支持", value: money(byCap), big: true, note: "超出部分不受保护，约定无效" });
          rows.push({ label: "不受保护部分", value: money(byAgreed - byCap), note: "已支付的可主张返还或抵扣本金" });
        } else {
          rows.push({ label: "可主张利息", value: money(byAgreed), big: true, note: "未超过上限，按约定计算" });
        }
        return rows;
      },
      formula:
        "期内利息 = 本金 × 年利率 ÷ 365 × 天数\n" +
        "司法保护上限：年利率 ≤ 合同成立时一年期 LPR 的 4 倍\n" +
        "逾期利息 = 本金 × 逾期利率 ÷ 365 × 逾期天数（同样受 4 倍 LPR 限制）",
      basis: [
        ["《民法典》第六百七十条", "借款的利息不得预先在本金中扣除。预先扣除的，应当按照实际借款数额返还借款并计算利息（俗称「砍头息」）。"],
        ["《民法典》第六百七十四条、第六百七十六条", "借款人应按约定期限支付利息；未按期返还借款的，应按约定或国家有关规定支付逾期利息。"],
        ["《最高人民法院关于审理民间借贷案件适用法律若干问题的规定》（2020 年修正）第二十五条", "出借人请求借款人按照合同约定利率支付利息的，人民法院应予支持，但双方约定的利率超过合同成立时一年期贷款市场报价利率四倍的除外。"],
        ["同规定第二十八条", "既约定逾期利率又约定违约金的，出借人可以选择主张，但总计不得超过合同成立时一年期 LPR 四倍。"]
      ],
      tips: "LPR 每月 20 日由全国银行间同业拆借中心公布，取值时点看「合同成立时」而不是起诉时。2020 年 8 月 20 日之前成立的借贷，按当时的「两线三区」规则分段计算，不能一刀切。"
    },

    /* 04 违约金 */
    {
      id: "penalty", name: "违约金与「过高」判断", en: "LIQUIDATED DAMAGES",
      desc: "按日万分比 / 合同比例 / 固定额，并与实际损失比对",
      fields: [
        { k: "mode", label: "约定方式", type: "sel", v: "day", opts: [["day", "按日万分之几"], ["pct", "按合同总额百分比"], ["fix", "固定金额"]] },
        { k: "amount", label: "合同金额 / 基数", type: "num", v: 1000000, unit: "元" },
        { k: "rate", label: "比例（万分之 / %）", type: "num", v: 5, unit: "见左" },
        { k: "days", label: "逾期天数", type: "num", v: 90, unit: "天" },
        { k: "loss", label: "实际损失（可留空）", type: "num", v: 0, unit: "元" }
      ],
      calc: function (v) {
        var fee = 0;
        if (v.mode === "day") fee = v.amount * (v.rate / 10000) * v.days;
        else if (v.mode === "pct") fee = v.amount * v.rate / 100;
        else fee = v.rate;   /* 固定金额时，rate 直接当金额用 */
        var rows = [{ label: "违约金", value: money(fee), big: true }];
        if (v.loss > 0) {
          var capRef = v.loss * 1.3;
          rows.push({ label: "损失 × 1.3（参考线）", value: money(capRef), note: "一般超过此线可能被认定「过分高于损失」" });
          rows.push({
            label: "判断", value: fee > capRef ? "可能被酌减" : "通常在合理范围",
            note: fee > capRef ? "超出 " + pct((fee / v.loss - 1) * 100) + "，可请求调整" : "低于损失 1.3 倍，较易获全额支持"
          });
        } else {
          rows.push({ label: "提示", value: "填入实际损失可作比对", note: "没有损失数据时，法院仍会结合履行情况、过错程度裁量" });
        }
        return rows;
      },
      formula:
        "按日计算：违约金 = 基数 × 日万分比 × 逾期天数\n" +
        "按比例：违约金 = 合同金额 × 约定百分比\n" +
        "调整参考：约定违约金超过实际损失 30% 的，一般可认定「过分高于造成的损失」",
      basis: [
        ["《民法典》第五百八十五条", "当事人可以约定违约金；约定的违约金低于造成的损失的，可以请求增加；过分高于造成的损失的，可以请求适当减少。"],
        ["《最高人民法院关于适用〈民法典〉合同编通则若干问题的解释》（法释〔2023〕13 号）第六十五条", "认定违约金是否过分高于损失，一般以违约造成的损失为基础，兼顾合同履行情况、当事人过错程度、履约背景等，按照公平原则和诚信原则衡量；约定违约金超过造成损失的百分之三十的，一般可以认定为「过分高于造成的损失」。"],
        ["《民法典》第五百八十四条", "损失赔偿额应相当于因违约造成的损失，包括合同履行后可以获得的利益，但不得超过违约方订立合同时预见或应当预见的损失。"]
      ],
      tips: "起草时把违约金写成「日万分之五」比「合同总额 20%」更容易被支持：前者与实际占用资金的时间挂钩，后者容易被认为与损失脱节。真到诉讼，主张违约金和主张损失赔偿通常只能择一（或补足差额）。"
    },

    /* 05 经济补偿金 */
    {
      id: "severance", name: "经济补偿金（N）", en: "SEVERANCE",
      desc: "每满一年一个月工资，三倍社平封顶、年限最多 12 年",
      fields: [
        { k: "wage", label: "离职前 12 个月平均工资", type: "num", v: 12000, unit: "元/月" },
        { k: "years", label: "本单位工作年限", type: "num", v: 3.5, unit: "年" },
        { k: "avg", label: "当地上年度职工月平均工资", type: "num", v: 8000, unit: "元（可留空）" }
      ],
      calc: function (v) {
        var years = v.years, months;
        var whole = Math.floor(years), frac = years - whole;
        if (frac >= 0.5) months = whole + 1;
        else if (frac > 0) months = whole + 0.5;
        else months = whole;
        var base = v.wage, capped = false, cappedYears = false;
        if (v.avg > 0 && v.wage > v.avg * 3) {
          base = v.avg * 3; capped = true;
          if (months > 12) { months = 12; cappedYears = true; }
        }
        return [
          { label: "折算补偿月数 N", value: months + " 个月", note: "满 1 年计 1 个月；6 个月以上不满 1 年按 1 年；不满 6 个月计半个月" },
          { label: "计算基数", value: money(base), note: capped ? "高于当地社平 3 倍，按 3 倍封顶" : "按离职前 12 个月平均应得工资" },
          { label: "经济补偿金", value: money(base * months), big: true, note: cappedYears ? "年限同时受 12 年上限限制" : "" }
        ];
      },
      formula:
        "经济补偿 = 工作年限折算月数 N × 月工资\n" +
        "月工资 = 劳动合同解除前 12 个月的平均应得工资\n" +
        "月工资高于当地上年度职工月平均工资 3 倍的：按 3 倍计，且年限最高 12 年",
      basis: [
        ["《劳动合同法》第四十七条", "经济补偿按劳动者在本单位工作的年限，每满一年支付一个月工资的标准向劳动者支付。六个月以上不满一年的，按一年计算；不满六个月的，向劳动者支付半个月工资的经济补偿。劳动者月工资高于用人单位所在直辖市、设区的市级人民政府公布的本地区上年度职工月平均工资三倍的，按职工月平均工资三倍的数额支付，支付年限最高不超过十二年。"],
        ["《劳动合同法实施条例》第二十七条", "经济补偿的月工资按照劳动者应得工资计算，包括计时工资或者计件工资以及奖金、津贴和补贴等货币性收入。"],
        ["《劳动合同法》第四十六条", "列举应当支付经济补偿的七种情形（协商一致由用人单位提出、无过失性辞退、经济性裁员等）。"]
      ],
      tips: "「应得工资」是税前、含奖金补贴的应发数，不是到手数。工作年限从入职之日起算，含试用期；关联企业轮转、单位合并分立的年限通常连续计算。"
    },

    /* 06 违法解除赔偿金 */
    {
      id: "double", name: "违法解除赔偿金（2N）", en: "UNLAWFUL DISMISSAL",
      desc: "经济补偿标准的二倍，与 N 不并用",
      fields: [
        { k: "wage", label: "离职前 12 个月平均工资", type: "num", v: 12000, unit: "元/月" },
        { k: "years", label: "本单位工作年限", type: "num", v: 3.5, unit: "年" },
        { k: "avg", label: "当地上年度职工月平均工资", type: "num", v: 8000, unit: "元" }
      ],
      calc: function (v) {
        var whole = Math.floor(v.years), frac = v.years - whole, months;
        if (frac >= 0.5) months = whole + 1; else if (frac > 0) months = whole + 0.5; else months = whole;
        var base = v.wage;
        if (v.avg > 0 && v.wage > v.avg * 3) { base = v.avg * 3; if (months > 12) months = 12; }
        return [
          { label: "月数 2N", value: (months * 2) + " 个月", note: "N = " + months + " 个月" },
          { label: "赔偿金", value: money(base * months * 2), big: true, note: "经济补偿标准的二倍" },
          { label: "注意", value: "与 N 不并用", note: "主张 2N 后不能再要求 N；也可选择要求继续履行合同" }
        ];
      },
      formula: "赔偿金 = 经济补偿标准（N）× 2\n即：2 × 折算月数 × 月工资基数",
      basis: [
        ["《劳动合同法》第八十七条", "用人单位违反本法规定解除或者终止劳动合同的，应当依照本法第四十七条规定的经济补偿标准的二倍向劳动者支付赔偿金。"],
        ["《劳动合同法》第四十八条", "用人单位违法解除或终止劳动合同，劳动者要求继续履行的，用人单位应当继续履行；劳动者不要求继续履行或合同已不能继续履行的，用人单位应依照第八十七条支付赔偿金。"],
        ["《劳动合同法实施条例》第二十五条", "用人单位违反规定解除或终止劳动合同，已依照第八十七条支付赔偿金的，不再支付经济补偿。"]
      ],
      tips: "2N 与 N 是二选一，不是叠加。若仲裁请求写成「2N + 代通知金」，多出的部分会被驳回——代通知金只在合法解除但未提前 30 日通知（第四十条三种情形）时才适用。"
    },

    /* 07 工伤 */
    {
      id: "work-injury", name: "工伤待遇", en: "WORK-RELATED INJURY",
      desc: "伤残补助金、工亡补助金、丧葬补助金、停工留薪期工资",
      fields: [
        { k: "type", label: "待遇项目", type: "sel", v: "disability", opts: [["disability", "一次性伤残补助金"], ["death", "一次性工亡补助金"], ["funeral", "丧葬补助金"], ["leave", "停工留薪期工资"]] },
        { k: "wage", label: "本人工资（月）／月社平", type: "num", v: 8000, unit: "元" },
        { k: "level", label: "伤残等级（1–10）", type: "num", v: 9 },
        { k: "income", label: "上年度全国城镇居民人均可支配收入（2024 年）", type: "num", v: 54188, unit: "元" },
        { k: "months", label: "停工留薪期", type: "num", v: 3, unit: "月" }
      ],
      calc: function (v) {
        var rows = [];
        if (v.type === "disability") {
          var map = { 1: 27, 2: 25, 3: 23, 4: 21, 5: 18, 6: 16, 7: 13, 8: 11, 9: 9, 10: 7 };
          var lv = Math.min(10, Math.max(1, Math.round(v.level)));
          var m = map[lv];
          rows.push({ label: lv + " 级 · 计发月数", value: m + " 个月", note: "本人工资为工伤前 12 个月平均月缴费工资" });
          rows.push({ label: "一次性伤残补助金", value: money(v.wage * m), big: true });
          if (lv >= 5) rows.push({ label: "另可主张", value: "一次性工伤医疗补助金 + 伤残就业补助金", note: "标准由各省规定，解除或终止劳动关系时支付" });
        } else if (v.type === "death") {
          rows.push({ label: "一次性工亡补助金", value: money(v.income * 20), big: true, note: "上年度全国城镇居民人均可支配收入 × 20" });
          rows.push({ label: "另有", value: "丧葬补助金 + 供养亲属抚恤金", note: "抚恤金按本人工资的一定比例按月发给" });
        } else if (v.type === "funeral") {
          rows.push({ label: "丧葬补助金", value: money(v.wage * 6), big: true, note: "统筹地区上年度职工月平均工资 × 6" });
        } else {
          rows.push({ label: "停工留薪期工资", value: money(v.wage * v.months), big: true, note: "原工资福利待遇不变，由单位按月支付" });
        }
        return rows;
      },
      formula:
        "一次性伤残补助金 = 本人工资 × 计发月数\n" +
        "  一级 27｜二级 25｜三级 23｜四级 21｜五级 18｜六级 16\n" +
        "  七级 13｜八级 11｜九级 9｜十级 7（个月）\n" +
        "一次性工亡补助金 = 上年度全国城镇居民人均可支配收入 × 20\n" +
        "丧葬补助金 = 统筹地区上年度职工月平均工资 × 6",
      basis: [
        ["《工伤保险条例》第三十五条至第三十七条", "一至四级、五至六级、七至十级伤残的一次性伤残补助金计发月数，以及一次性工伤医疗补助金、伤残就业补助金的支付规则。"],
        ["《工伤保险条例》第三十三条", "停工留薪期内，原工资福利待遇不变，由所在单位按月支付；停工留薪期一般不超过 12 个月，伤情严重经确认可延长。"],
        ["《工伤保险条例》第三十九条", "职工因工死亡，其近亲属从工伤保险基金领取丧葬补助金（6 个月的统筹地区上年度职工月平均工资）、供养亲属抚恤金和一次性工亡补助金（上一年度全国城镇居民人均可支配收入的 20 倍）。"],
        ["《工伤保险条例》第十七条", "单位应在事故伤害发生之日起 30 日内提出工伤认定申请；单位未提出的，职工或其近亲属、工会组织可在 1 年内直接申请。"]
      ],
      tips: "工伤待遇的前提是「认定工伤」+「劳动能力鉴定」，两条都不能跳。单位没缴工伤保险的，全部待遇由单位承担——这时候保全和执行的功夫比算数更重要。"
    },

    /* 08 人身损害 */
    {
      id: "personal-injury", name: "人身损害赔偿", en: "PERSONAL INJURY",
      desc: "残疾赔偿金、死亡赔偿金（城乡统一口径）",
      fields: [
        { k: "type", label: "项目", type: "sel", v: "disability", opts: [["disability", "残疾赔偿金"], ["death", "死亡赔偿金"]] },
        { k: "income", label: "上年度城镇居民人均可支配收入", type: "num", v: 60000, unit: "元（按省）" },
        { k: "age", label: "受害人年龄", type: "num", v: 40, unit: "岁" },
        { k: "level", label: "伤残等级（1–10）", type: "num", v: 9 }
      ],
      calc: function (v) {
        var years = v.age <= 60 ? 20 : (v.age < 75 ? 20 - (v.age - 60) : 5);
        var coef = v.type === "death" ? 1 : (11 - Math.min(10, Math.max(1, Math.round(v.level)))) / 10;
        var amt = v.income * years * coef;
        return [
          { label: "赔偿年限", value: years + " 年", note: v.age <= 60 ? "60 周岁以下按 20 年" : (v.age < 75 ? "60 周岁以上每增 1 岁减 1 年" : "75 周岁以上按 5 年") },
          { label: "伤残系数", value: pct(coef * 100), note: v.type === "death" ? "死亡按 100%" : "一级 100%，每降一级减 10%" },
          { label: v.type === "death" ? "死亡赔偿金" : "残疾赔偿金", value: money(amt), big: true },
          { label: "另可主张", value: "医疗费 · 误工费 · 护理费 · 营养费 · 住院伙食补助费 · 交通费 · 精神损害抚慰金", note: "按实际发生与票据计算，需举证" }
        ];
      },
      formula:
        "残疾赔偿金 = 城镇居民人均可支配收入 × 赔偿年限 × 伤残系数\n" +
        "死亡赔偿金 = 城镇居民人均可支配收入 × 赔偿年限\n" +
        "赔偿年限：60 周岁以下 20 年；60–74 周岁递减；75 周岁以上 5 年\n" +
        "伤残系数：一级 100%，二级 90% …… 十级 10%",
      basis: [
        ["《民法典》第一千一百七十九条", "侵害他人造成人身损害的，应当赔偿医疗费、护理费、交通费、营养费、住院伙食补助费等为治疗和康复支出的合理费用，以及因误工减少的收入。造成残疾的，还应当赔偿辅助器具费和残疾赔偿金；造成死亡的，还应当赔偿丧葬费和死亡赔偿金。"],
        ["《最高人民法院关于审理人身损害赔偿案件适用法律若干问题的解释》（2022 年修正）第十二条、第十五条", "残疾赔偿金、死亡赔偿金按照受诉法院所在地上一年度城镇居民人均可支配收入标准，按二十年计算；六十周岁以上的，年龄每增加一岁减少一年；七十五周岁以上的，按五年计算。"],
        ["同解释第七条、第八条、第九条", "误工费按误工时间和收入状况确定；护理费按护理人员收入状况和护理人数、护理期限确定；交通费按实际发生计算。"],
        ["《民法典》第一千一百八十三条", "侵害自然人人身权益造成严重精神损害的，被侵权人有权请求精神损害赔偿。"]
      ],
      tips: "2022 年起人身损害赔偿标准城乡统一，不再分农村、城镇两个口径，但「受诉法院所在地」仍决定用哪个省的统计数据——管辖地选得好不好，直接影响这一项。"
    },

    /* 09 养老金 */
    {
      id: "pension", name: "职工基本养老金", en: "PENSION",
      desc: "基础养老金 + 个人账户养老金",
      fields: [
        { k: "avg", label: "全省上年度在岗职工月平均工资", type: "num", v: 8000, unit: "元" },
        { k: "index", label: "本人指数化月平均缴费工资", type: "num", v: 9000, unit: "元" },
        { k: "years", label: "累计缴费年限", type: "num", v: 25, unit: "年" },
        { k: "balance", label: "个人账户储存额", type: "num", v: 180000, unit: "元" },
        { k: "age", label: "退休年龄", type: "sel", v: "60", opts: [["60", "60 岁（计发月数 139）"], ["55", "55 岁（170）"], ["50", "50 岁（195）"]] }
      ],
      calc: function (v) {
        var base = (v.avg + v.index) / 2 * v.years * .01;
        var m = { "60": 139, "55": 170, "50": 195 }[v.age];
        var acct = v.balance / m;
        return [
          { label: "基础养老金", value: money(base) + " / 月", note: "（社平 + 指数化工资）÷ 2 × 缴费年限 × 1%" },
          { label: "个人账户养老金", value: money(acct) + " / 月", note: "储存额 ÷ " + m + " 个月" },
          { label: "合计", value: money(base + acct) + " / 月", big: true }
        ];
      },
      formula:
        "基础养老金 =（全省上年度在岗职工月平均工资 + 本人指数化月平均缴费工资）÷ 2 × 缴费年限 × 1%\n" +
        "个人账户养老金 = 个人账户储存额 ÷ 计发月数\n" +
        "计发月数：60 岁 139｜55 岁 170｜50 岁 195",
      basis: [
        ["《社会保险法》第十五条", "基本养老金由统筹养老金和个人账户养老金组成。基本养老金根据个人累计缴费年限、缴费工资、当地职工平均工资、个人账户金额、城镇人口平均预期寿命等因素确定。"],
        ["《国务院关于完善企业职工基本养老保险制度的决定》（国发〔2005〕38 号）", "确立「社会统筹与个人账户相结合」的计发办法：基础养老金月标准以当地上年度在岗职工月平均工资和本人指数化月平均缴费工资的平均值为基数，缴费每满 1 年发给 1%；个人账户养老金月标准为个人账户储存额除以计发月数。"],
        ["《社会保险法》第十六条", "累计缴费满十五年的，按月领取基本养老金；不足十五年的，可以缴费至满十五年，或转入城乡居民基本养老保险。"]
      ],
      tips: "这是「城镇职工」的口径。城乡居民养老保险的算法不同（基础养老金为固定额 + 个人账户储存额 ÷ 139），不能混用。另外，过渡性养老金、地方性补贴不在此列，实际到手往往高于此数。"
    },

    /* 10 律师费 */
    {
      id: "lawyer-fee", name: "律师服务费", en: "LEGAL FEE",
      desc: "按标的比例估算，风险代理不超过 30%",
      fields: [
        { k: "mode", label: "收费方式", type: "sel", v: "prop", opts: [["prop", "按标的额比例（分段累进）"], ["risk", "风险代理"]] },
        { k: "amount", label: "争议标的额", type: "num", v: 1000000, unit: "元" },
        { k: "rate", label: "风险代理比例", type: "num", v: 20, unit: "%" }
      ],
      calc: function (v) {
        if (v.mode === "risk") {
          var fee = v.amount * Math.min(v.rate, 30) / 100;
          return [
            { label: "风险代理费（上限内）", value: money(fee), big: true, note: "按实际回款的 " + Math.min(v.rate, 30) + "%" },
            { label: "法定上限", value: "30%", note: v.rate > 30 ? "约定超过 30% 的部分不受保护" : "未超过上限" },
            { label: "禁止风险代理的案件", value: "婚姻继承 · 请求给付赡养费抚养费扶养费抚恤金救济金社会保险待遇 · 请求支付劳动报酬 · 刑事 · 行政 · 国家赔偿 · 群体性诉讼", note: "这些案件只能按普通方式收费" }
          ];
        }
        var fee = brackets(v.amount, [[1e5, .08], [1e6, .06], [5e6, .04], [1e7, .02], [Infinity, .01]]);
        return [
          { label: "参考律师费（中值口径）", value: money(fee), big: true, note: "分段累进，仅为估算" },
          { label: "实际区间", value: money(fee * .7) + " – " + money(fee * 1.3), note: "各省政府指导价不同，上下浮动常见" },
          { label: "另计", value: "差旅 · 鉴定 · 公证 · 保全担保", note: "通常由委托人另行承担" }
        ];
      },
      formula:
        "分段累进（参考中值）：10 万以下 8%｜10–100 万 6%｜100–500 万 4%｜500–1000 万 2%｜1000 万以上 1%\n" +
        "风险代理：不超过标的额（或实际回款）的 30%\n" +
        "实际收费以省级政府指导价与双方合同为准",
      basis: [
        ["《律师服务收费管理办法》（发改价格〔2006〕611 号）第四条、第十三条", "律师服务收费实行政府指导价和市场调节价；实行风险代理收费的，最高收费金额不得高于收费合同约定标的额的 30%。"],
        ["《关于进一步规范律师服务收费的意见》（发改价格〔2021〕1441 号）", "进一步明确风险代理适用范围与比例上限，禁止在婚姻继承、请求给付赡养费抚养费扶养费抚恤金救济金社会保险待遇、请求支付劳动报酬、刑事、行政、国家赔偿及群体性诉讼等案件中实行风险代理。"],
        ["《律师法》第四十条、第四十七条", "禁止以不正当手段承揽业务、私自收费等行为及相应责任。"]
      ],
      tips: "律师费原则上由委托人自行承担，只有在合同约定或法律特别规定（如知识产权侵权、担保追偿等）时才可向对方主张。谈判时把「律师费由违约方承担」写进合同，比事后争要有用得多。"
    },

    /* 11 加班费 */
    {
      id: "overtime", name: "加班费", en: "OVERTIME PAY",
      desc: "工作日 1.5 倍、休息日 2 倍、法定节假日 3 倍",
      fields: [
        { k: "wage", label: "月工资（加班费基数）", type: "num", v: 8000, unit: "元" },
        { k: "h", label: "工作日延时加班", type: "num", v: 20, unit: "小时" },
        { k: "rest", label: "休息日加班（未安排补休）", type: "num", v: 4, unit: "天" },
        { k: "holiday", label: "法定节假日加班", type: "num", v: 2, unit: "天" }
      ],
      calc: function (v) {
        var hourly = v.wage / 21.75 / 8;
        var a = hourly * 1.5 * v.h;
        var b = hourly * 2 * v.rest * 8;
        var c = hourly * 3 * v.holiday * 8;
        return [
          { label: "小时工资", value: money(hourly), note: "月工资 ÷ 21.75 ÷ 8" },
          { label: "工作日延时（1.5 倍）", value: money(a) },
          { label: "休息日（2 倍，且不能补休）", value: money(b) },
          { label: "法定节假日（3 倍）", value: money(c), note: "节假日加班不能用补休替代" },
          { label: "合计", value: money(a + b + c), big: true }
        ];
      },
      formula:
        "小时工资 = 月工资 ÷ 21.75 ÷ 8\n" +
        "工作日延时 = 小时工资 × 150% × 小时数\n" +
        "休息日 = 小时工资 × 200% × 小时数（不能安排补休时）\n" +
        "法定节假日 = 小时工资 × 300% × 小时数",
      basis: [
        ["《劳动法》第四十四条", "安排延长工作时间的，支付不低于工资的 150% 的工资报酬；休息日安排工作又不能安排补休的，支付不低于 200%；法定休假日安排工作的，支付不低于 300%。"],
        ["《劳动法》第三十六条、第四十一条", "日工作时间不超过 8 小时、平均每周不超过 44 小时；延长工作时间一般每日不超过 1 小时，特殊原因每日不超过 3 小时、每月不超过 36 小时。"],
        ["《劳动和社会保障部关于职工全年月平均工作时间和工资折算问题的通知》（劳社部发〔2008〕3 号）", "月计薪天数为 21.75 天。"],
        ["《最高人民法院关于审理劳动争议案件适用法律问题的解释（一）》第四十二条", "劳动者主张加班费的，应当就加班事实的存在承担举证责任；但有证据证明用人单位掌握加班事实存在的证据，用人单位不提供的，由用人单位承担不利后果。"]
      ],
      tips: "加班费的难点从来不是算，而是证。考勤记录、排班表、工作群消息、门禁数据都算证据；能证明单位掌握考勤而不提供的，举证责任会转移给单位。"
    },

    /* 12 迟延履行利息 */
    {
      id: "delay-interest", name: "迟延履行利息（执行）", en: "DELAYED PERFORMANCE",
      desc: "判决生效后不履行，按日万分之一点七五加倍计息",
      fields: [
        { k: "amount", label: "未清偿的金钱债务", type: "num", v: 500000, unit: "元" },
        { k: "days", label: "迟延履行期间", type: "num", v: 180, unit: "天" }
      ],
      calc: function (v) {
        var x = v.amount * 0.000175 * v.days;
        return [
          { label: "加倍部分债务利息", value: money(x), big: true, note: "未清偿金额 × 日万分之一点七五 × 天数" },
          { label: "另计", value: "一般债务利息", note: "判决书确定的一般利息照常计算，不因加倍部分而免除" }
        ];
      },
      formula: "加倍部分债务利息 = 未清偿金钱债务 × 日万分之一点七五 × 迟延履行期间",
      basis: [
        ["《民事诉讼法》第二百六十四条", "被执行人未按判决、裁定和其他法律文书指定的期间履行给付金钱义务的，应当加倍支付迟延履行期间的债务利息。"],
        ["《最高人民法院关于执行程序中计算迟延履行期间的债务利息适用法律若干问题的解释》（法释〔2014〕8 号）第一条、第二条", "加倍部分债务利息 = 债务人尚未清偿的生效法律文书确定的除一般债务利息之外的金钱债务 × 日万分之一点七五 × 迟延履行期间；一般债务利息按生效法律文书确定的方法计算。"]
      ],
      tips: "这笔钱不是惩罚性罚款，是对拖延的补偿，申请执行时一并主张即可，不需要另行起诉。执行款不足清偿时，按「实现债权的费用 → 一般债务利息 → 本金 → 加倍部分」的顺序抵充。"
    }
  ];

  /* ======================================================================
     官网直达
     ====================================================================== */
  var LINKS = [
    {
      t: "查法条与规范性文件", d: "要引用条文，先拿到现行有效文本", items: [
        ["国家法律法规数据库", "https://flk.npc.gov.cn", "全国人大", "宪法、法律、行政法规、地方性法规、司法解释"],
        ["国务院政策文件库", "https://www.gov.cn/zhengce/zhengcewenjianku/", "中国政府网", "国务院文件、部门规范性文件"],
        ["行政法规库", "https://www.gov.cn/zhengce/xingzhengfagui/", "中国政府网", "现行有效行政法规全文"],
        ["外交部条约数据库", "https://treaty.mfa.gov.cn", "外交部", "中外双边条约、协定及生效状态"],
        ["司法部", "https://www.moj.gov.cn", "司法部", "规章、法律援助、公证与仲裁管理"],
        ["最高人民法院", "https://www.court.gov.cn", "最高法", "司法解释、指导意见、新闻发布会"],
        ["最高人民检察院", "https://www.spp.gov.cn", "最高检", "检察解释、指导性案例、典型案例"]
      ]
    },
    {
      t: "查案例与裁判观点", d: "类案检索，先看官方库", items: [
        ["人民法院案例库", "https://rmfyalk.court.gov.cn", "最高法", "入库参考案例，权威性最高"],
        ["中国裁判文书网", "https://wenshu.court.gov.cn", "最高法", "生效裁判文书全文检索"],
        ["中国庭审公开网", "https://tingshen.court.gov.cn", "最高法", "庭审直播与回放"],
        ["人民法院公告网", "https://rmfygg.court.gov.cn", "最高法", "送达、破产、拍卖等公告"],
        ["中国审判流程信息公开网", "https://splcgk.court.gov.cn", "最高法", "案件流程节点查询（当事人）"],
        ["中国法院网", "https://www.chinacourt.org", "最高法", "法院系统新闻与案例综述"]
      ]
    },
    {
      t: "查企业、信用与执行", d: "交易前查对手，诉讼后查履行能力", items: [
        ["国家企业信用信息公示系统", "https://www.gsxt.gov.cn", "市场监管总局", "工商登记、股权、行政处罚、年报"],
        ["信用中国", "https://www.creditchina.gov.cn", "国家公共信用中心", "失信名单、行政处罚、信用修复"],
        ["中国执行信息公开网", "http://zxgk.court.gov.cn", "最高法", "被执行人、失信名单、限制消费、终本案件"],
        ["人民法院诉讼资产网", "https://www.rmfysszc.gov.cn", "最高法", "司法拍卖与变卖资产"],
        ["人民法院在线服务", "https://ssfw.court.gov.cn", "最高法", "网上立案、缴费、阅卷、送达（同名小程序）"],
        ["国家知识产权局", "https://www.cnipa.gov.cn", "知识产权局", "商标、专利检索与法律状态"]
      ]
    },
    {
      t: "涉外与跨境", d: "跨境交易与争议的官方与机构入口", items: [
        ["商务部", "https://www.mofcom.gov.cn", "商务部", "对外贸易、外商投资、贸易救济"],
        ["海关总署", "http://www.customs.gov.cn", "海关总署", "通关、归类、原产地、监管条件"],
        ["国家外汇管理局", "https://www.safe.gov.cn", "外汇局", "跨境收付、外债、资本项目政策"],
        ["国际商事法庭（CICC）", "https://cicc.court.gov.cn", "最高法", "国际商事争端解决机制与专家委员会"],
        ["中国国际经济贸易仲裁委员会", "http://www.cietac.org", "贸仲", "涉外仲裁规则、示范条款、案件查询"],
        ["上海国际经济贸易仲裁委员会", "http://www.shiac.org", "上仲", "涉外仲裁与调解"],
        ["中国海事仲裁委员会", "http://www.cmac.org.cn", "海仲", "海事海商仲裁"],
        ["香港国际仲裁中心", "https://www.hkiac.org", "HKIAC", "亚洲常用仲裁机构规则"],
        ["新加坡国际仲裁中心", "https://www.siac.org.sg", "SIAC", "规则与费用计算器"],
        ["国际商会仲裁院", "https://iccwbo.org", "ICC", "ICC 仲裁规则与案件管理"],
        ["联合国国际贸易法委员会", "https://uncitral.un.org", "UNCITRAL", "CISG、纽约公约、示范法文本"]
      ]
    },
    {
      t: "数据、社保与办事", d: "算赔偿、算待遇要用的统计口径", items: [
        ["国家统计局", "https://www.stats.gov.cn", "统计局", "人均可支配收入、消费支出、年度公报"],
        ["人力资源和社会保障部", "https://www.mohrss.gov.cn", "人社部", "社保、工伤、劳动关系政策"],
        ["国家税务总局", "https://www.chinatax.gov.cn", "税务总局", "个税、社保费、税收政策"],
        ["中国法律服务网（12348）", "https://www.12348.gov.cn", "司法部", "公共法律服务、法律援助申请"],
        ["中国政府网", "https://www.gov.cn", "国务院", "政策全文、办事指南、国务院常务会议"]
      ]
    }
  ];

  /* ======================================================================
     实务小工具
     ====================================================================== */
  var MINIS = [
    {
      id: "limitation", t: "诉讼时效届满日", d: "普通民事 3 年，劳动仲裁 1 年，最长 20 年。",
      fields: [
        { k: "kind", label: "类型", type: "sel", v: "3", opts: [["3", "普通民事（3 年）"], ["1", "劳动仲裁（1 年）"], ["20", "最长保护期（20 年）"]] },
        { k: "start", label: "起算日", type: "date", v: "" }
      ],
      calc: function (v) {
        var s = v.start ? new Date(v.start) : new Date();
        var e = new Date(s.getTime());
        e.setFullYear(e.getFullYear() + parseInt(v.kind, 10));
        return [{ label: "届满日", value: dstr(e), big: true, note: "从「知道或应当知道权利受损及义务人之日」起算" }];
      },
      basis: "《民法典》第一百八十八条：向人民法院请求保护民事权利的诉讼时效期间为三年；自权利受到损害之日起超过二十年的，人民法院不予保护。第一百九十五条：提起诉讼、当事人一方提出要求或同意履行义务，时效中断。"
    },
    {
      id: "appeal", t: "上诉期与答辩期", d: "民事判决 15 日、裁定 10 日；答辩期 15 日。",
      fields: [{ k: "date", label: "送达 / 收到之日", type: "date", v: "" }],
      calc: function (v) {
        var s = v.date ? new Date(v.date) : new Date();
        function add(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
        return [
          { label: "民事判决上诉期届满", value: dstr(add(s, 15)), big: true, note: "自送达之日起 15 日内" },
          { label: "民事裁定上诉期届满", value: dstr(add(s, 10)), note: "自送达之日起 10 日内" },
          { label: "被告答辩期届满", value: dstr(add(s, 15)), note: "涉外案件为 30 日" }
        ];
      },
      basis: "《民事诉讼法》第一百七十一条（判决 15 日、裁定 10 日上诉期）、第一百二十八条（答辩期 15 日，涉外 30 日）。期间届满的最后一日是法定休假日的，以休假日后的第一日为届满日。"
    },
    {
      id: "annual", t: "年休假天数", d: "累计工作满 1 年 5 天，满 10 年 10 天，满 20 年 15 天。",
      fields: [{ k: "years", label: "累计工作年限", type: "num", v: 6, unit: "年" }],
      calc: function (v) {
        var d = v.years >= 20 ? 15 : (v.years >= 10 ? 10 : (v.years >= 1 ? 5 : 0));
        return [
          { label: "全年应享年休假", value: d + " 天", big: true, note: "按累计工作年限（含在前单位）" },
          { label: "未安排的补偿", value: "日工资 × 300% × 天数", note: "其中含正常工作期间的工资，故另付 200%" }
        ];
      },
      basis: "《职工带薪年休假条例》第三条、第五条；《企业职工带薪年休假实施办法》第十条（未安排年休假应按日工资收入的 300% 支付，含正常工作期间工资）。"
    }
  ];

  /* ======================================================================
     文书骨架
     ====================================================================== */
  var DOCS = [
    {
      t: "民事起诉状", d: "一审 · 给付之诉",
      body:
        "民事起诉状\n\n" +
        "原告：×××，男/女，××××年××月××日出生，××族，住××省××市××区××路××号，公民身份号码××××，联系电话×××。\n" +
        "被告：×××（同上格式；法人写明名称、住所地、统一社会信用代码、法定代表人及职务）。\n\n" +
        "诉讼请求\n" +
        "一、判令被告向原告支付货款人民币×××元；\n" +
        "二、判令被告支付逾期付款违约金（以×××元为基数，自××××年××月××日起按日万分之五计算至实际清偿之日止，暂计至起诉之日为×××元）；\n" +
        "三、判令被告承担本案诉讼费用。\n\n" +
        "事实与理由\n" +
        "一、双方于××××年××月××日签订《××合同》，约定……（写明合同主体、标的、价款、履行期限与关键条款）。\n" +
        "二、原告已按约履行……（写明交付、验收、付款节点，附证据编号）。\n" +
        "三、被告自××××年××月××日起未再付款，经原告多次催告仍未履行（附催款函及送达凭证）。\n" +
        "四、依据《民法典》第五百七十七条、第五百八十五条……（写明请求权基础）。\n\n" +
        "此致\n" +
        "××市××区人民法院\n\n" +
        "具状人：×××\n" +
        "××××年××月××日\n\n" +
        "附：1. 本状副本×份；2. 证据目录及证据材料×份；3. 原告身份证明、被告主体信息各一份。\n\n" +
        "【写作提示】\n" +
        "· 诉讼请求要「可执行」：金额、起止时间、计算方式写清楚，不要只写「赔偿损失」。\n" +
        "· 管辖先确定：合同履行地、被告住所地，或合同约定的管辖法院（约定不得违反级别管辖与专属管辖）。\n" +
        "· 请求金额决定诉讼费预交额；请求过高又多交费，是立案环节最常见的浪费。"
    },
    {
      t: "律师函 / 催告函", d: "诉前固定主张、中断时效",
      body:
        "律 师 函\n\n" +
        "致：×××（收件人名称、地址）\n\n" +
        "本律师受×××（委托人）委托，就贵方拖欠货款/违约一事，郑重函告如下：\n\n" +
        "一、基本事实\n" +
        "××××年××月××日，委托人与贵方签订《××合同》，约定……；委托人已于××××年××月××日履行完毕交付义务，贵方应于××××年××月××日前支付款项×××元。截至本函发出之日，贵方尚欠×××元。\n\n" +
        "二、法律意见\n" +
        "依据《民法典》第五百七十七条、第五百八十五条及合同第×条约定，贵方已构成违约，应承担继续履行、支付违约金及赔偿损失的责任。\n\n" +
        "三、函告事项\n" +
        "请贵方于收到本函之日起七日内：\n" +
        "1. 支付所欠款项人民币×××元；\n" +
        "2. 支付逾期违约金人民币×××元（暂计至××××年××月××日，此后按日万分之五续计）；\n" +
        "3. 与本律师联系确认还款安排。\n" +
        "逾期未处理的，委托人将依法提起诉讼并申请财产保全，由此产生的诉讼费、保全费、律师费及贵方商誉影响，均由贵方承担。\n\n" +
        "特此函告。\n\n" +
        "××律师事务所　律师：×××\n" +
        "联系电话：×××　地址：×××\n" +
        "××××年××月××日\n\n" +
        "【写作提示】\n" +
        "· 用 EMS 寄送并在快递单「内件品名」写「律师函」，保留面单与签收记录——这既是主张权利，也是时效中断的证据。\n" +
        "· 金额与期限要具体到可执行，不要写「尽快」「妥善处理」这类无法证明的话。"
    },
    {
      t: "劳动仲裁申请书", d: "仲裁前置 · 请求分项列明",
      body:
        "劳动人事争议仲裁申请书\n\n" +
        "申请人：×××，男/女，××××年××月××日出生，住×××，公民身份号码×××，电话×××。\n" +
        "被申请人：××公司，住所地×××，统一社会信用代码×××，法定代表人×××。\n\n" +
        "仲裁请求\n" +
        "一、请求裁决被申请人支付违法解除劳动合同赔偿金×××元（月工资×××元 × ×个月 × 2）；\n" +
        "二、请求裁决被申请人支付××××年××月至××××年××月工资×××元；\n" +
        "三、请求裁决被申请人支付未休年休假工资×××元；\n" +
        "四、请求裁决被申请人为申请人补缴××××年××月至××××年××月社会保险。\n\n" +
        "事实与理由\n" +
        "申请人于××××年××月××日入职被申请人处，任××岗位，月工资×××元，双方签订期限自××××年××月××日至××××年××月××日的劳动合同。\n" +
        "××××年××月××日，被申请人以「××」为由解除劳动合同，未提前三十日通知，亦未支付任何补偿。申请人认为，该解除缺乏事实与法律依据，属于违法解除。\n" +
        "依据《劳动合同法》第四十七条、第八十七条……（逐项对应请求写依据）。\n\n" +
        "此致\n" +
        "××市××区劳动人事争议仲裁委员会\n\n" +
        "申请人：×××\n" +
        "××××年××月××日\n\n" +
        "附：1. 仲裁申请书副本×份；2. 身份证复印件；3. 劳动合同、工资流水、社保记录、解除通知、考勤记录等证据×份。\n\n" +
        "【写作提示】\n" +
        "· 劳动仲裁时效为 1 年，自知道或应当知道权利被侵害之日起算；劳动关系存续期间因拖欠劳动报酬发生争议的，不受 1 年限制，但劳动关系终止的应自终止之日起 1 年内提出。\n" +
        "· 请求分项写，一项一条，方便裁决书逐项支持或驳回，也方便后续起诉时对应。"
    },
    {
      t: "证据清单", d: "按「待证事实」组织，不按时间堆",
      body:
        "证 据 清 单\n\n" +
        "案号：（××××）××民初××号　　当事人：原告×××\n\n" +
        "序号｜证据名称｜页数｜形式｜证明目的\n" +
        "1｜《××合同》原件｜8｜书证｜证明双方建立合同关系及价款、履行期限约定\n" +
        "2｜送货单及签收记录｜5｜书证｜证明原告已按约交付并经验收\n" +
        "3｜银行流水（××账户）｜3｜书证｜证明被告仅支付首期款×××元，尚欠×××元\n" +
        "4｜催款函及 EMS 面单、签收记录｜4｜书证｜证明原告已催告，被告逾期未付；时效中断\n" +
        "5｜微信聊天记录（原始载体当庭出示）｜6｜电子数据｜证明被告对欠款金额予以确认\n" +
        "6｜企业信用信息公示报告｜2｜书证｜证明被告主体资格及经营状态\n\n" +
        "提交人：×××　　××××年××月××日\n\n" +
        "【写作提示】\n" +
        "· 证明目的只写「这份证据能证明的那个事实」，一句话说完，不要写论证。\n" +
        "· 电子数据要保留原始载体（手机、电脑），截图之外最好做一次公证或可信时间戳。\n" +
        "· 一组证据对应一个争点，按争点排序；法官看的是逻辑，不是厚度。"
    }
  ];

  /* ======================================================================
     渲染
     ====================================================================== */
  function fieldHtml(f) {
    var id = "f_" + f.k + "_" + Math.random().toString(36).slice(2, 6);
    if (f.type === "sel") {
      return '<div class="t-field"><label for="' + id + '">' + esc(f.label) + "</label>" +
        '<select id="' + id + '" data-k="' + f.k + '">' +
        f.opts.map(function (o) {
          return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(f.v) ? " selected" : "") + ">" + esc(o[1]) + "</option>";
        }).join("") + "</select></div>";
    }
    var type = f.type === "date" ? "date" : "number";
    return '<div class="t-field"><label for="' + id + '">' + esc(f.label) +
      (f.unit ? '<span class="unit">' + esc(f.unit) + "</span>" : "") + "</label>" +
      '<input id="' + id + '" data-k="' + f.k + '" type="' + type + '" value="' + esc(f.v) + '"' +
      (type === "number" ? ' step="any"' : "") + "></div>";
  }

  function readFields(box, calc) {
    var v = {};
    calc.fields.forEach(function (f) {
      var el = box.querySelector('[data-k="' + f.k + '"]');
      var raw = el ? el.value : f.v;
      v[f.k] = f.type === "num" ? n(raw) : raw;
    });
    return v;
  }

  function outHtml(rows) {
    return rows.map(function (r) {
      return '<div class="t-out-row"><span>' + esc(r.label) + (r.note ? "<i>" + esc(r.note) + "</i>" : "") +
        "</span><b" + (r.big ? ' class="big"' : "") + ">" + esc(r.value) + "</b></div>";
    }).join("");
  }

  function buildCalcs() {
    var box = $("#cal-list");
    box.innerHTML = CALCS.map(function (c, i) {
      return '<article class="t-cal' + (i === 0 ? " is-open" : "") + '" data-id="' + c.id + '">' +
        '<div class="t-cal-head" data-toggle>' +
        '<span class="t-cal-no">' + ("0" + (i + 1)).slice(-2) + "</span>" +
        "<h3>" + esc(c.name) + "</h3><p>" + esc(c.desc) + "</p>" +
        '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>' +
        "</div>" +
        '<div class="t-cal-body">' +
        '<div class="t-fields">' + c.fields.map(fieldHtml).join("") + "</div>" +
        '<div class="t-out"></div>' +
        '<div class="t-formula">' + esc(c.formula) + "</div>" +
        '<dl class="t-basis">' +
        c.basis.map(function (b, j) {
          return "<dt>" + (j + 1) + ". " + esc(b[0]) + "</dt><dd>" + esc(b[1]) + "</dd>";
        }).join("") +
        "</dl>" +
        (c.tips ? '<div class="t-note" style="margin-top:14px">' + esc(c.tips) + "</div>" : "") +
        "</div></article>";
    }).join("");

    CALCS.forEach(function (c) {
      var card = box.querySelector('[data-id="' + c.id + '"]');
      refresh(card, c);
      card.addEventListener("input", function () { refresh(card, c); });
      card.addEventListener("change", function () { refresh(card, c); });
    });
  }

  function refresh(card, c) {
    var out = card.querySelector(".t-out");
    try {
      out.innerHTML = outHtml(c.calc(readFields(card.querySelector(".t-fields"), c)));
    } catch (e) {
      out.innerHTML = '<div class="t-out-row"><span>输入有误，请检查参数</span></div>';
    }
  }

  function buildLinks() {
    $("#link-box").innerHTML = LINKS.map(function (g) {
      return '<article class="t-link-group"><h3>' + esc(g.t) + "</h3><p>" + esc(g.d) + "</p><ul>" +
        g.items.map(function (it) {
          return '<li><a href="' + esc(it[1]) + '" target="_blank" rel="noopener noreferrer">' +
            "<b>" + esc(it[0]) + "</b><span>" + esc(it[3]) + "</span><i>" + esc(it[2]) + " ↗</i></a></li>";
        }).join("") + "</ul></article>";
    }).join("");
  }

  function buildMinis() {
    var box = $("#mini-box");
    box.innerHTML = MINIS.map(function (m) {
      return '<article class="t-mini-card" data-id="' + m.id + '"><h3>' + esc(m.t) + "</h3>" +
        '<p class="d">' + esc(m.d) + "</p>" +
        '<div class="t-fields">' + m.fields.map(fieldHtml).join("") + "</div>" +
        '<div class="t-out"></div>' +
        '<div class="t-basis" style="margin-top:12px">' + esc(m.basis) + "</div></article>";
    }).join("");
    MINIS.forEach(function (m) {
      var card = box.querySelector('[data-id="' + m.id + '"]');
      refresh(card, m);
      card.addEventListener("input", function () { refresh(card, m); });
      card.addEventListener("change", function () { refresh(card, m); });
    });
  }

  function buildDocs() {
    $("#doc-box").innerHTML = DOCS.map(function (d, i) {
      return '<article class="t-doc' + (i === 0 ? " is-open" : "") + '">' +
        '<div class="t-doc-head" data-toggle><h3>' + esc(d.t) + "</h3><span>" + esc(d.d) + "</span>" +
        '<button class="t-copy" type="button" data-copy="' + i + '">复制全文</button></div>' +
        '<div class="t-doc-body"><pre>' + esc(d.body) + "</pre></div></article>";
    }).join("");
  }

  function bind() {
    document.addEventListener("click", function (e) {
      var tab = e.target.closest("[data-jump]");
      if (tab) {
        e.preventDefault();
        var el = document.querySelector(tab.dataset.jump);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        document.querySelectorAll(".t-hero-tab").forEach(function (x) { x.classList.remove("is-on"); });
        tab.classList.add("is-on");
        return;
      }
      var head = e.target.closest("[data-toggle]");
      if (head) {
        var card = head.parentNode;
        card.classList.toggle("is-open");
        return;
      }
      var cp = e.target.closest("[data-copy]");
      if (cp) {
        var d = DOCS[+cp.dataset.copy];
        var done = function () { cp.textContent = "已复制"; setTimeout(function () { cp.textContent = "复制全文"; }, 1600); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(d.body).then(done, done);
        } else {
          var ta = document.createElement("textarea");
          ta.value = d.body; document.body.appendChild(ta); ta.select();
          try { document.execCommand("copy"); } catch (err) { }
          ta.remove(); done();
        }
      }
    });
  }

  buildCalcs();
  buildLinks();
  buildMinis();
  buildDocs();
  bind();

  // 带锚点直达（分享链接 / 站内跳转）时，等区块生成后重新定位
  var hashJump = function () {
    if (!location.hash || location.hash.length < 2) return;
    var t = document.querySelector(location.hash);
    if (!t) return;
    var y = t.getBoundingClientRect().top + (window.pageYOffset || 0) - 72;
    var root = document.documentElement, prev = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, y > 0 ? y : 0);
    root.style.scrollBehavior = prev;
  };
  if (location.hash && location.hash.length > 1) {
    [100, 400, 1000].forEach(function (ms) { setTimeout(hashJump, ms); });
  }
  window.addEventListener("hashchange", function () { setTimeout(hashJump, 60); });
})();

/* 全站增强引导器（留言直达/访问统计/返回顶部/文章分享） */
(function () {
  if (window.__FJ_ENHANCE_LOADED__) return;
  window.__FJ_ENHANCE_LOADED__ = true;
  var sc = document.createElement("script");
  var self = document.currentScript && document.currentScript.src;
  var base = self && /\/assets\//.test(self) ? self.slice(0, self.lastIndexOf("/") + 1) : "assets/";
  sc.src = base + "enhance.js?v=1";
  sc.async = false;
  document.head.appendChild(sc);
})();
