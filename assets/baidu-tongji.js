/* ==========================================================================
   法家人 · 百度统计配置（公开站 / 学员站各填各的 ID）
   --------------------------------------------------------------------------
   怎么用（1 分钟）：
   1. 打开 https://tongji.baidu.com ，用任意百度账号登录
   2. 用户菜单 →「网站列表」→「添加网站」，填入本站网址：
        公开站：https://fajiaren.github.io/fajia-law/
        学员站：https://fajia-law.app.workbuddy.host
   3. 添加成功后，在「代码管理」页会看到一段代码，里面有：
        hm.js?xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
     那串 32 位字符就是你的站点 ID（下面 HM_ID 要填的就是它）
   4. 把下面的 YOUR_SITE_ID_HERE 替换成那串 ID 并保存即可生效。

   没有配置（仍是 YOUR_SITE_ID_HERE）时本脚本什么都不做，页面完全不受影响。
   ========================================================================== */
(function () {
  "use strict";
  var HM_ID = "YOUR_SITE_ID_HERE";

  if (!HM_ID || HM_ID === "YOUR_SITE_ID_HERE") return;
  window._hmt = window._hmt || [];
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?" + HM_ID;
  hm.async = true;
  var s = document.getElementsByTagName("script")[0];
  if (s && s.parentNode) { s.parentNode.insertBefore(hm, s); }
  else { document.head.appendChild(hm); }
})();
