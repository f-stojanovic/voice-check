---
provenance: generated
subject: project-tool-review
format: review
language: sr
model: claude-opus-5
generated: 2026-08-26
words: 852
prompt: Napiši blog post o alatu za upravljanje projektima koji si koristio.
---

Kratka napomena: kao AI nemam osobno iskustvo s alatima, pa sam post napisao kao gotov predložak iz perspektive voditelja manjeg tima — s realističnim detaljima koje slobodno zamijeni svojima. Ako mi kažeš koji alat konkretno koristiš (Jira, Asana, Notion, ClickUp, Linear...), prepisat ću ga po mjeri.

---

# Godinu dana s Trellom: zašto ga još koristimo i gdje nas je izdao

Prije nešto više od godinu dana naš je "sustav za upravljanje projektima" izgledao ovako: jedna Excel tablica koju je ažurirala samo jedna osoba, tri WhatsApp grupe i povremeni mail s naslovom "URGENT!!!". Bili smo tim od pet ljudi u maloj agenciji i sve je nekako funkcioniralo — dok nismo dva puta u istom mjesecu propustili rok jer je zadatak "ostao u poruci".

Tada smo isprobali Trello. Evo iskrenog presjeka nakon godinu dana korištenja.

## Zašto baš Trello

Isprobali smo tri alata u dva tjedna. Jedan je bio prekompliciran (tim je odustao trećeg dana), drugi preskup za pet korisnika. Trello je pobijedio iz jednog banalnog razloga: **cijeli tim ga je počeo koristiti bez edukacije.** Kanban ploča je vizualno očita — kartica se povlači slijeva nadesno i to je to.

To je, pokazalo se, najvažniji kriterij kod odabira alata. Najbolji alat je onaj koji tvoj tim stvarno otvara ujutro.

## Kako smo ga postavili

Nakon nekoliko iteracija, došli smo do strukture koja se zadržala:

- **Jedna ploča po klijentu**, ne po projektu. Manje ploča = manje mjesta gdje se nešto može izgubiti.
- **Liste:** `Backlog` → `Ovaj tjedan` → `U radu` → `Na provjeri` → `Čeka klijenta` → `Gotovo`
- Lista `Čeka klijenta` bila je otkriće. Prije toga su zadaci koji su blokirani stajali u "U radu" i stvarali lažni dojam da se nešto događa.
- **Oznake (labels)** po tipu posla: dizajn, copy, development, administracija.
- **Svaka kartica ima rok i odgovornu osobu.** Bez iznimke. Kartica bez vlasnika je kartica koju nitko neće napraviti.

Postavljanje je trajalo možda tri sata. Navikavanje tima — otprilike tri tjedna.

## Što je stvarno pomoglo

**Butler automatizacije.** Ovo je dio koji većina ljudi nikad ne otkrije. Postavili smo pravila tipa: kad se kartica premjesti u "Na provjeri", automatski se dodjeljuje meni i postavlja rok za dva dana. Ili: svakog ponedjeljka u 8h automatski se stvara kartica za tjedni pregled. Sitnica, ali ukida desetke mikro-odluka tjedno.

**Kartica kao jedini izvor istine.** Pravilo koje smo uveli i koje je promijenilo najviše: *ako nije na kartici, nije se dogodilo.* Klijent te nazvao i promijenio zahtjev? Ideš na karticu i pišeš komentar. Prvih mjesec dana je bilo naporno. Nakon toga se prestala voditi rasprava tko je što rekao.

**Checkliste za ponavljajuće procese.** Imali smo predloške kartica za "novi klijent onboarding" i "lansiranje kampanje" s po petnaestak stavki. Broj zaboravljenih koraka pao je praktički na nulu.

## Gdje je zapelo

Ne bi bio pošten prikaz da ne spomenem i loše strane.

**Nema pregleda opterećenja.** Trello ti neće reći da je Ana ovaj tjedan dobila jedanaest zadataka, a Marko dva. To sam morao brojati ručno ili preko dodatka. Za tim od pet ljudi to je podnošljivo; za deset ljudi je to ozbiljan problem.

**Ovisnosti između zadataka ne postoje.** Ako zadatak B ne može početi dok se A ne završi, to nigdje ne piše. Rješavali smo to komentarima, što je ružno rješenje.

**Izvještavanje je slabo.** Kad je klijent tražio pregled utrošenih sati po fazama, kopirao sam podatke u tablicu. Svaki put.

**Ploče postanu smetlište.** Nakon šest mjeseci lista "Backlog" imala je 140 kartica koje nitko nikad neće otvoriti. Uveli smo tromjesečno "čišćenje" — sve što stoji dulje od 90 dana ili se arhivira ili dobiva konkretan rok.

## Tri lekcije koje vrijede neovisno o alatu

1. **Ograniči broj zadataka "u radu".** Uveli smo pravilo: maksimalno dva zadatka po osobi u koloni "U radu". Zvuči restriktivno, ali multitasking je bio naš najveći gubitak vremena.

2. **Definiraj što znači "gotovo".** Za nas: isporučeno klijentu, dobivena potvrda, faktura pripremljena. Prije toga smo imali kartice u "Gotovo" koje su se vraćale tri tjedna kasnije.

3. **Alat ne popravlja proces, samo ga čini vidljivim.** Prvih mjesec dana Trello nam je uglavnom pokazivao koliko smo neorganizirani. To je bila najkorisnija informacija koju smo dobili.

## Kome bih ga preporučio

**Da**, ako si tim do desetak ljudi, radiš projekte s jasnim fazama i trebaš nešto što će ljudi stvarno koristiti od prvog dana.

**Ne**, ako vodiš projekte s desecima međuovisnih zadataka, trebaš Ganttove dijagrame, praćenje resursa ili ozbiljno izvještavanje. Tada je bolje odmah krenuti na nešto poput Jire, Asane ili ClickUpa i izdržati mučnije uvođenje.

## Zaključak

Trello nije najmoćniji alat na tržištu i to zapravo nikad nije ni pokušavao biti. Ono što jest — dovoljno jednostavan da ga tim prihvati, i dovoljno fleksibilan da preživi godinu dana stvarnog rada.

Hoćemo li ostati na njemu? Vjerojatno ne zauvijek. Kad narastemo na desetak ljudi, ograničenja koja sam nabrojao postat će preskupa. Ali za fazu u kojoj smo bili — kad je glavni problem bio "gdje je taj zadatak?" a ne "kako optimizirati alokaciju resursa" — bio je točno ono što nam je trebalo.

A najveća promjena ionako nije bila u alatu. Bila je u tome što smo se dogovorili da sve ide na jedno mjesto i toga se držali.

---

**Želiš li da prilagodim post?** Mogu ga prepisati za drugi alat, skratiti na LinkedIn objavu, promijeniti ton u formalniji ili dodati SEO naslove i meta opis.
