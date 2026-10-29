# Kristallgruvan

Mattespel för åk 3–6 med uppgifter upp till åk 7–8. Nivån anpassar sig per område efter varje elev.

| | |
|---|---|
| Spelet | https://www.cyberdyne.se/kristallgruvan/ |
| Lärarsidan | https://www.cyberdyne.se/kristallgruvan/larare.html |
| Föräldrasidan | https://www.cyberdyne.se/kristallgruvan/foraldrar.html |
| Spelnamn i databasen | `kristallgruvan` |
| Gamla adressen | matte.cyberdyne.se skickar vidare hit |

## Källkod (`kalla/`)

| Fil | Innehåll |
|---|---|
| `questions.js` | Uppgiftsmotorn: 11 områden, 6 nivåer, 151 mallar, rättning |
| `engine.js` | Spelregler: nivåer, kristaller, ägg, varelser, svit, medaljer, butik |
| `game.js` | Spelets gränssnitt: hem, gruvtur, vagnrace, boss, samling, bas, butik |
| `public-store.js` | Sparar framsteg och poäng via `../konto/konto.js` |
| `public-app.js` | Inloggning, topplista och Mitt konto |
| `teacher.js` | Lärarsidan |
| `page.html`, `extra.css`, `digits.css` | Stil, typsnitt och pixelsiffror |
| `parents-body.html` | Föräldrasidans innehåll |
| `statcounter.html` | Besöksräknaren (utan kakor) |
| `make_digits.py` | Bygger `digits.css`, siffertypsnittet |
| `familjeversion/` | Den ursprungliga familjeversionen med kartläggning (claude.ai) |

Bygg från repots rotmapp med `python3 bygg.py`.

## Hur spelet fungerar

- **Nivåer:** varje område går upp vid 8 rätt av de 10 senaste svaren och ner om det går tungt. En runda innehåller ungefär 70 % uppgifter på nivån, 20 % repetition och 10 % utmaning.
- **Belöningar:** 3 kristaller per rätt svar och 5 för att avsluta en runda. Dagskistan ger 20. Efter 20 minuter om dagen ges halva belöningen.
- **Topplistepoäng:** nivå × 10 per rätt svar, och 5 extra vid tre rätt i rad. Veckobossen ger 100 och vagnracet 5 per rätt.
- **Varelser:** 33 stycken. Ett ägg kläcks efter 10 + 2 × antalet ägda varelser rätta svar, max 40. Varelserna utvecklas vid 20 och 60 rätta svar i sitt område.

## Ändringslogg

| Datum | Ändring |
|---|---|
| 2026-10-29 | Flyttad till portalen, gemensamt konto (databas v3) |
| 2026-10-23 | Föräldrasida, tydligare pixelsiffror, köpknappar |
| 2026-10-22 | Version 2: lösenord, lärarsida med anonym statistik, Statcounter |
| 2026-10-21 | Publik version med topplista på GitHub Pages och Supabase |
