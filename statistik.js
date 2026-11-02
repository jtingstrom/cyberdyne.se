/* =====================================================================
   CYBERDYNE SPEL – GEMENSAM BESÖKSSTATISTIK (Statcounter)
   Ett enda Statcounter-projekt för hela www.cyberdyne.se. Statcounter
   visar per sida vilka spel som används, så ett projekt räcker.
   Utan kakor (sc_client_storage = "disabled").
   Varje sida laddar den här filen sist i <body>:
     <script src="/statistik.js"></script>
   Byt projekt eller inställningar bara här.
   ===================================================================== */
(function () {
  'use strict';
  if (!/(^|\.)cyberdyne\.se$/.test(location.hostname)) return; // räkna inte tester på egen dator
  window.sc_project = 13361654;
  window.sc_invisible = 1;
  window.sc_security = '9d62ecd1';
  window.sc_client_storage = 'disabled';
  var s = document.createElement('script');
  s.src = 'https://www.statcounter.com/counter/counter.js';
  s.async = true;
  document.body.appendChild(s);
})();
