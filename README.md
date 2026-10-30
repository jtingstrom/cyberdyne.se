# Cyberdyne Spel

Gratis lärospel för mellanstadiet på **https://www.cyberdyne.se**. Allt ligger i det här repot (`cyberdyne.se`) och publiceras med GitHub Pages. Ett konto gäller i alla spel.

## Översikt

| Spel | Adress | Mapp | Spelnamn i databasen | Topplista | Status |
|---|---|---|---|---|---|
| Kristallgruvan | www.cyberdyne.se/kristallgruvan/ | `kristallgruvan/` | `kristallgruvan` | ja | i drift |
| Kodknäckaren | www.cyberdyne.se/kodknackaren/ | `kodknackaren/` | – (ingen inloggning, statistik sparas i webbläsaren) | nej | i drift |

| Del | Var | Kommentar |
|---|---|---|
| Portalens startsida | `index.html`, `portal.js`, `spel.json` | Ett nytt spel läggs till i `spel.json` |
| Gemensam inloggning | `konto/konto.js`, `konto/config.js` | Används av portalen och alla spel med topplista |
| Gemensam stil | `stil.css` | Genereras av `bygg.py`, ändra inte för hand |
| Databas | `databas/cyberdyne.sql` | Supabase, ett projekt för alla spel |
| Pulsjobb | `.github/workflows/supabase-puls.yml` | Håller Supabase vaket varje dag |
| Domän | `CNAME` | `www.cyberdyne.se` |
| Besöksstatistik | Statcounter, projekt 13361654 | Utan kakor |
| Kontakt | info@tingstrom.se | |

**Hemligheter skrivs aldrig i repot**, eftersom det är publikt. Det gäller lärarlösenordet, databaslösenordet och Supabase-nyckeln som heter "secret". De sparas i en lösenordshanterare. Den publika nyckeln i `konto/config.js` får synas.

## Mappar

```
/                      portalen (www.cyberdyne.se)
├── index.html         startsidan
├── om.html            Om-sidan (länkas i sidfoten, ändras direkt)
├── portal.js          inloggning, spellista och gemensam topplista
├── spel.json          listan över spel
├── stil.css           gemensam stil (byggs)
├── bygg.py            bygger färdiga filer från källkoden
├── konto/             gemensam inloggning
├── kristallgruvan/    spelet + lärarsida + föräldrasida
│   └── kalla/         källkoden till Kristallgruvan
├── kodknackaren/      Kodknäckaren, en fristående fil (ändras direkt, inget bygge)
├── databas/           SQL för Supabase
└── .github/workflows/ pulsjobbet
```

## Ändra något

1. Ändra i källkoden, till exempel `kristallgruvan/kalla/game.js`.
2. Kör `python3 bygg.py` från rotmappen. Det skapar `kristallgruvan/index.html`, `larare.html`, `foraldrar.html` och `stil.css`.
3. Gör en commit med både källkoden och de byggda filerna. GitHub Pages publicerar efter någon minut.

Portalens egna filer (`index.html`, `portal.js`, `spel.json`) ändras direkt, utan bygge.

## Lägga till ett nytt spel

1. Skapa en mapp, till exempel `ordjakten/`, med spelets `index.html`.
2. Lägg till spelet i `spel.json` med `"status": "klar"`. Kortet syns då direkt på startsidan.
   Har spelet egna sidor för lärare eller föräldrar, lägg till `"lankar": [{ "text": "För lärare", "adress": "ordjakten/larare.html" }]`. Länkarna visas på spelets kort.
3. Om spelet ska ha inloggning och topplista:
   - Ladda in `<script src="../konto/config.js"></script>` och `<script src="../konto/konto.js"></script>`.
   - `CyberKonto.session()` ger den inloggade spelaren. Inloggningen delas automatiskt med portalen.
   - Spara med `CyberKonto.rpc('save_game', { p_token, p_spel: 'ordjakten', p_grade, p_state, p_add_points, p_best, p_answers })`.
   - Läs med `CyberKonto.rpc('load_game', { p_token, p_spel: 'ordjakten' })`.
   - Topplistan hämtas med `CyberKonto.rpc('get_leaderboard', { p_spel: 'ordjakten', p_kind: 'week' | 'best' | 'total', p_token })`.
   - Spelnamnet får bara innehålla små bokstäver a–z, siffror och bindestreck. **Ingen ny SQL behövs.**
4. Skicka med svar i `p_answers` (`{area, skill, level, ok, q, given, correct}`), så kan lärarsidan visa statistik för spelet. Det sparas utan namn.
5. Lägg till en rad i översiktstabellen ovan.

## Databasen (Supabase)

Projekt: `bvpjitpyzfzkijkqzfru` (Europa). Hela databasen beskrivs i `databas/cyberdyne.sql`. Filen kan köras igen utan att data försvinner.

| Tabell | Innehåll | Kopplad till barnet? |
|---|---|---|
| `konton` | smeknamn, lösenord (krypterat), årskurs, dold | ja |
| `konto_sessioner` | inloggningar (90 dagar) | ja |
| `spelstatus` | framsteg och poäng per konto och spel | ja |
| `answer_stats`, `mistakes` | statistik för lärare, per spel | **nej** |
| `teacher_config`, `teacher_sessions` | lärarlösenord och inloggningar | nej |

Ingen kan läsa tabellerna direkt. Allt går via funktionerna i SQL-filen. De gamla tabellerna `players` och `player_sessions` från Kristallgruvan version 2 finns kvar som säkerhetskopia och används inte längre. De kan tas bort när allt fungerat ett tag.

### Vanliga uppgifter (SQL Editor i Supabase)

```sql
-- sätta eller byta lärarlösenord (minst 8 tecken)
select public.set_teacher_password('nytt-lärarlösenord');

-- dölja ett testkonto från topplistor och statistik (false = visa igen)
update konton set hidden = true where lower(name) = lower('Testare');

-- ta bort ett olämpligt konto (raderar allt i alla spel)
delete from konton where lower(name) = lower('Fultnamn');

-- se Kristallgruvan-kristaller per spelare
select k.name, (s.state->>'crystals')::int as kristaller
from konton k join spelstatus s on s.konto_id = k.id and s.spel = 'kristallgruvan'
order by kristaller desc;

-- ge kristaller (låt spelaren vara utloggad)
update spelstatus set state = jsonb_set(state, '{crystals}', to_jsonb(100))
where spel = 'kristallgruvan' and konto_id = (select id from konton where lower(name) = lower('Snorlax'));
```

## Domän och DNS

| Namn | Typ | Värde |
|---|---|---|
| `www` | CNAME | `jtingstrom.github.io` |
| `@` | A | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| `matte` | CNAME | `jtingstrom.github.io` (gamla adressen, skickar vidare till /kristallgruvan/) |

Den gamla adressen matte.cyberdyne.se ligger kvar i ett separat repo (det gamla Kristallgruvan-repot) som bara skickar besökare vidare hit.

GitHub Pages: repo-inställningar → **Pages** → Custom domain `www.cyberdyne.se`, **Enforce HTTPS**.

## Ändringslogg

| Datum | Ändring |
|---|---|
| 2026-10-30 | Nördlig bytte namn till Kodknäckaren och flyttade till `kodknackaren/`. Den gamla adressen är borttagen. |
| 2026-10-30 | Nördlig har samma design som Kristallgruvan (färger, typsnitt, stenblock). |
| 2026-10-29 | Om-sida (`om.html`), länkad i sidfoten vid kontaktadressen. |
| 2026-10-29 | Länkarna för lärare och föräldrar flyttade från sidfoten till Kristallgruvans kort (`lankar` i `spel.json`). |
| 2026-10-29 | Nördlig tillagt i `nordlig/` och på startsidan. |
| 2026-10-29 | Lärarhandledningen (`kristallgruvan/lararhandledning.pdf`) länkas från lärarsidan, även före inloggning. |
| 2026-10-29 | Portalen skapad. Gemensam inloggning (databas v3). Kristallgruvan flyttad från matte.cyberdyne.se. |
