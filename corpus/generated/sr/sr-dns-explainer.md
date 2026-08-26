---
provenance: generated
subject: dns-explainer
format: explainer
language: sr
model: claude-opus-5
generated: 2026-08-26
words: 1070
prompt: Napiši blog post koji objašnjava šta je DNS.
---

# DNS: internet imenik bez kojeg ništa ne bi radilo

Kada u pretraživač upišeš `wikipedia.org`, u roku od nekoliko milisekundi tvoj računar zna na koji tačno server na svetu treba da se obrati. Kako? Zahvaljujući sistemu koji radi tiho u pozadini svakog klika — DNS-u.

## Šta je DNS?

**DNS (Domain Name System)** je sistem koji prevodi ljudima razumljiva imena domena (npr. `example.com`) u numeričke IP adrese koje mašine koriste za komunikaciju (npr. `93.184.216.34` ili IPv6 `2606:2800:220:1:248:1893:25c8:1946`).

Najčešća analogija je telefonski imenik: ti pamtiš ime osobe, a imenik ti daje broj. DNS radi istu stvar, samo za internet — i to nekoliko triliona puta dnevno.

**Zašto je to potrebno?** Zato što su IP adrese nepraktične za pamćenje, ali i zato što se **menjaju**. Sajt može promeniti hosting provajdera i dobiti novu IP adresu, a ti ćeš i dalje kucati istu adresu u pretraživač. DNS je sloj apstrakcije koji odvaja *ime* od *lokacije*.

## Anatomija domena

Domeni su hijerarhijski i čitaju se **zdesna nalevo**:

```
blog.primer.co.rs.
│    │      │  │  └── root (korenska zona, tačka na kraju — obično nevidljiva)
│    │      │  └───── TLD (Top-Level Domain): .rs
│    │      └──────── domen drugog nivoa: .co
│    └─────────────── domen: primer
└──────────────────── subdomen (host): blog
```

Ta hijerarhija nije kozmetička — ona određuje **ko je odgovoran za koji deo imena**. Korenska zona zna gde su `.rs` serveri, `.rs` serveri znaju gde su serveri za `primer.co.rs`, a ti serveri znaju konkretne IP adrese.

## Kako izgleda jedan DNS upit, korak po korak

Recimo da prvi put otvaraš `blog.primer.rs`.

1. **Provera keša.** Pretraživač gleda svoj keš, pa operativni sistem svoj. Ako je odgovor tu — gotovo, nema mreže.
2. **Rekurzivni resolver.** Ako nije, upit ide ka *rekurzivnom resolveru* — obično onom tvog internet provajdera, ili javnom kao što su `1.1.1.1` (Cloudflare) ili `8.8.8.8` (Google). Njegov posao je da odradi sav prljav posao umesto tebe.
3. **Root serveri.** Resolver pita jedan od 13 logičkih grupa root servera: „Gde je `.rs`?“ Odgovor: „Ne znam IP za taj sajt, ali evo ti adrese `.rs` name servera.“
4. **TLD serveri.** Resolver pita `.rs` servere: „Gde je `primer.rs`?“ Odgovor: „Evo ti autoritativnih name servera za taj domen.“
5. **Autoritativni server.** Resolver pita njega i konačno dobija: `blog.primer.rs → 203.0.113.10`.
6. **Odgovor i keširanje.** Resolver vraća IP tvom računaru i pamti odgovor određeno vreme (TTL), da sledeći put ne mora sve iznova.

Ceo lanac se odigra tipično za 20–100 ms, a najčešće se ni ne odigra u celosti — jer keš pokriva veliku većinu upita.

## Ključni tipovi DNS zapisa

DNS ne služi samo za IP adrese. U zoni domena čuvaju se razni **zapisi (records)**:

| Tip | Čemu služi |
|---|---|
| **A** | Mapira ime na IPv4 adresu |
| **AAAA** | Mapira ime na IPv6 adresu |
| **CNAME** | Alias — „ovo ime je isto što i ono ime“ |
| **MX** | Mail serveri za domen (kuda ide e-pošta) |
| **TXT** | Slobodan tekst; koristi se za SPF, DKIM, verifikaciju vlasništva |
| **NS** | Koji serveri su autoritativni za zonu |
| **SOA** | Osnovni podaci o zoni (primarni server, serijski broj...) |
| **PTR** | Reverzni upit: IP → ime |
| **SRV** | Lokacija servisa (host + port), npr. za VoIP, XMPP |
| **CAA** | Ko sme da izdaje SSL/TLS sertifikate za domen |

## TTL i keširanje: zašto promene „ne rade odmah“

Svaki zapis ima **TTL (Time To Live)** — broj sekundi koliko resolveri smeju da ga pamte. TTL od 3600 znači da neki resolver u svetu može još sat vremena da servira staru vrednost, čak i kad si ti već promenio zapis.

**Praktičan savet:** pre planirane migracije servera, spusti TTL na 300 sekundi (5 minuta) barem 24–48 sata unapred. Kada migracija prođe i sve radi, vrati TTL na normalnu vrednost. To je razlika između propagacije koja traje minute i one koja traje dan.

> Termin „DNS propagacija“ je zapravo pogrešan naziv — ništa se ne „propagira“. Samo ističu kešovi, jedan po jedan.

## DNS i bezbednost

Originalni DNS iz 1980-ih je dizajniran bez ikakve zaštite: upiti idu u čistom tekstu preko UDP-a i nema načina da proveriš da li je odgovor autentičan. Odatle napadi kao **DNS spoofing / cache poisoning** (ubacivanje lažnog odgovora u keš resolvera) i **DNS hijacking**.

Rešenja koja se danas koriste:

- **DNSSEC** — kriptografski potpisuje DNS zapise, pa resolver može da proveri da odgovor nije falsifikovan. Ne šifruje saobraćaj, samo garantuje autentičnost.
- **DoH (DNS over HTTPS)** i **DoT (DNS over TLS)** — šifruju upite između tebe i resolvera, pa tvoj provajder (ili neko na javnom Wi-Fi-ju) ne vidi koje domene posećuješ.
- **CAA zapisi** — sprečavaju da neko izda sertifikat za tvoj domen kod pogrešnog CA.
- **SPF, DKIM, DMARC** (TXT zapisi) — zaštita e-pošte od lažiranja pošiljaoca.

## Šta još DNS radi „u pozadini“

DNS nije samo prevodilac — on je i **alat za upravljanje saobraćajem**:

- **Load balancing:** više A zapisa za isto ime → saobraćaj se raspoređuje na više servera.
- **CDN i geolokacija:** resolver dobija različit odgovor u zavisnosti od toga odakle pita, pa te šalje na najbliži server.
- **Failover:** ako server padne, promena DNS zapisa preusmerava korisnike na rezervni.
- **Blokiranje sadržaja:** DNS filteri (npr. Pi-hole, NextDNS) blokiraju reklame i tragače tako što na njihove domene odgovaraju „ne postoji“.

## Kako sam da proveriš DNS

Na Linuxu/macOS-u:

```bash
dig primer.rs A            # IPv4 adresa
dig primer.rs MX +short    # mail serveri
dig primer.rs NS           # autoritativni serveri
dig +trace primer.rs       # ceo put od root-a nadole
dig @1.1.1.1 primer.rs     # pitaj konkretan resolver
```

Na Windowsu:

```
nslookup primer.rs
nslookup -type=MX primer.rs
```

Korisno kada nešto ne radi: `dig +trace` ti pokazuje **gde se lanac prekida**, a poređenje odgovora sa dva različita resolvera (`@1.1.1.1` vs `@8.8.8.8`) otkriva da li je problem u kešu ili u samoj zoni.

## Najčešći problemi

- **`NXDOMAIN`** — domen ne postoji (ili je istekao, ili je greška u kucanju).
- **`SERVFAIL`** — resolver nije uspeo da dobije odgovor; često znak neispravnog DNSSEC-a ili nedostupnih name servera.
- **Sajt radi kod tebe, a ne kod kolege** — skoro uvek keš, tj. različiti TTL-ovi.
- **Domen radi, ali mejlovi ne dolaze** — A zapis je u redu, MX zapis nije.
- **„Nema interneta“ a ping na IP radi** — klasičan simptom pokvarenog resolvera.

Brz test: `ping 1.1.1.1` radi, a `ping google.com` ne radi → problem je u DNS-u, ne u mreži.

## Zaključak

DNS je jedan od onih sistema koji su tako dobro dizajnirani da ih uopšte ne primećuješ — dok ne prestanu da rade. Onda odjednom „ceo internet je pao“, a u stvari je pao samo jedan sloj prevođenja imena u brojeve.

Ako iz ovog teksta zapamtiš tri stvari, neka to budu ove:

1. DNS prevodi imena u IP adrese kroz hijerarhiju delegiranih zona.
2. Keš i TTL objašnjavaju gotovo svako „ali ja sam već promenio zapis“.
3. Osnovni DNS nema ugrađenu bezbednost — DNSSEC i DoH/DoT su tu da to isprave.

Sledeći put kada otvoriš neki sajt, znaćeš da se pre prvog bajta sadržaja odigrao mali, tihi razgovor između nekoliko servera raspoređenih po planeti.
