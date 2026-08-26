---
provenance: generated
subject: dns-explainer
format: explainer
language: sr
model: claude-opus-5
generated: 2026-08-26
words: 1036
prompt: Napiši blog post koji objašnjava šta je DNS. Piši na srpskom jeziku, ekavicom.
---

# Šta je DNS? Objašnjenje „telefonskog imenika" interneta

Kada u pregledaču ukucate `wikipedia.org` i pritisnete Enter, stranica se učita za manje od sekunde. Deluje jednostavno — ali iza te sekunde krije se jedan od najvažnijih sistema na internetu: **DNS**.

U ovom tekstu objasnićemo šta je DNS, zašto postoji, kako tačno funkcioniše i zašto je bitan i za obične korisnike i za one koji prave sajtove.

---

## Osnovna ideja: računari ne razumeju imena

Internet zapravo ne zna šta je „wikipedia.org". Računari međusobno komuniciraju preko **IP adresa** — numeričkih oznaka poput:

- `208.80.154.224` (IPv4)
- `2620:0:861:ed1a::1` (IPv6)

Problem je očigledan: ljudi pamte imena, a ne nizove brojeva. Zamislite da svakom prijatelju morate da diktirate IP adresu umesto naziva sajta.

**DNS (Domain Name System)** rešava upravo taj problem. To je globalni sistem koji **prevodi ljudima razumljiva imena domena u IP adrese** koje mašine koriste.

> Najčešća analogija: DNS je telefonski imenik interneta. Vi znate ime, a imenik vam daje broj.

Analogija je korisna, ali nepotpuna — DNS nije jedna velika knjiga na jednom mestu. On je **distribuirana, hijerarhijska baza podataka** raspoređena na milione servera širom sveta. Upravo zbog toga je izuzetno otporan: ne postoji jedno mesto čijim padom bi ceo internet prestao da radi.

---

## Anatomija jednog domena

Pre nego što objasnimo proces, pogledajmo kako je ime domena strukturirano. Uzmimo primer `blog.primer.co.rs`:

| Deo | Naziv | Objašnjenje |
|---|---|---|
| `.` (nevidljiva tačka na kraju) | Root (koren) | Vrh hijerarhije |
| `rs` | TLD (Top-Level Domain) | Domen najvišeg nivoa |
| `co.rs` | Domen drugog nivoa | |
| `primer` | Domen koji ste registrovali | |
| `blog` | Subdomen (poddomen) | |

Čita se **zdesna nalevo** — od najopštijeg ka najkonkretnijem. To je ključno za razumevanje kako DNS pretraga funkcioniše.

---

## Kako DNS radi korak po korak

Recimo da prvi put posećujete `primer.rs`. Evo šta se dešava „ispod haube":

### 1. Provera keša
Vaš računar prvo gleda da li već zna odgovor — u kešu pregledača, kešu operativnog sistema i u lokalnoj `hosts` datoteci. Ako zna, priča se tu završava.

### 2. Rekurzivni resolver
Ako ne zna, upit ide **rekurzivnom DNS serveru** (engl. *resolver*). To je obično server vašeg internet provajdera ili javni servis poput Google-ovog `8.8.8.8` ili Cloudflare-ovog `1.1.1.1`. Ovaj server je „istražitelj" koji radi posao umesto vas.

### 3. Root serveri
Ako ni resolver nema odgovor u kešu, obraća se jednom od **root servera**. Root server ne zna IP adresu sajta, ali zna nešto korisno: „Za sve što se završava na `.rs`, pitaj ove servere."

### 4. TLD serveri
Resolver zatim pita **TLD server** za `.rs`. Ni on ne zna konačan odgovor, ali zna ko ga zna: „Za domen `primer.rs`, autoritativni serveri su `ns1.hosting.rs` i `ns2.hosting.rs`."

### 5. Autoritativni server
Konačno, resolver pita **autoritativni name server** — server koji zaista čuva zapise za taj domen. On odgovara: „`primer.rs` = `93.184.216.34`".

### 6. Odgovor i keširanje
Resolver vraća IP adresu vašem računaru i **pamti je** neko vreme, kako sledeći put ne bi ponavljao ceo postupak. Pregledač se zatim povezuje na tu IP adresu i učitava sajt.

Ceo ovaj lanac obično traje **između 20 i 200 milisekundi**. Kada je odgovor keširan — praktično trenutno.

---

## Najvažniji tipovi DNS zapisa

DNS ne služi samo za IP adrese. Zona jednog domena sadrži različite vrste zapisa:

**A** — povezuje domen sa IPv4 adresom.
`primer.rs → 93.184.216.34`

**AAAA** — isto to, ali za IPv6 adresu.

**CNAME** — alijas, pokazuje na drugo ime.
`www.primer.rs → primer.rs`

**MX** — određuje koji server prima e-poštu za domen. Bez ispravnog MX zapisa, mejlovi ne stižu.

**TXT** — proizvoljan tekst. Danas se najčešće koristi za potvrdu vlasništva nad domenom i za bezbednost e-pošte (SPF, DKIM, DMARC).

**NS** — navodi autoritativne name servere za domen.

**SOA** — „lična karta" zone: ko je administrator, koji je serijski broj zone, koliko dugo važe podaci.

**PTR** — obrnuta pretraga: od IP adrese ka imenu. Bitno za reputaciju mejl servera.

---

## TTL i zašto promene „ne rade odmah"

Svaki DNS zapis ima **TTL (Time To Live)** — vreme u sekundama koliko serveri smeju da čuvaju odgovor u kešu.

Ako je TTL postavljen na `3600`, to znači da će keširani odgovor važiti sat vremena. Zato kada promenite hosting i prebacite domen na novu IP adresu, deo posetilaca odmah vidi novi sajt, a deo još satima ili čak do 48 sati vidi stari. To se popularno naziva **propagacija DNS-a**.

> **Praktičan savet:** ako planirate selidbu sajta, spustite TTL na 300 sekundi bar 24 sata *pre* promene. Kada se sve slegne, vratite ga na višu vrednost.

---

## Bezbednost: gde DNS zaostaje i šta se radi

DNS je osmišljen sedamdesetih i osamdesetih godina, u vreme kada je internet bio mala akademska mreža puna poverenja. Zbog toga je originalni protokol:

- **nešifrovan** — svako na putu (provajder, vlasnik javnog Wi-Fi-ja) može da vidi koje sajtove posećujete;
- **neautentifikovan** — napadač može da podmetne lažan odgovor.

Odatle poznati napadi kao što su **DNS spoofing** i **trovanje keša** (*cache poisoning*), gde vas napadač preusmerava na lažni sajt iako ste ukucali ispravnu adresu.

Rešenja koja se danas koriste:

- **DNSSEC** — kriptografski potpisuje DNS zapise, čime se potvrđuje da odgovor nije falsifikovan.
- **DoH (DNS over HTTPS)** i **DoT (DNS over TLS)** — šifruju sam DNS saobraćaj, tako da niko usput ne vidi vaše upite. Moderni pregledači i operativni sistemi ih već podržavaju.

---

## Alati za dijagnostiku

Ako želite da vidite DNS na delu, isprobajte ove komande:

```bash
# Linux / macOS
dig primer.rs
dig primer.rs MX
dig @1.1.1.1 primer.rs +trace

# Windows
nslookup primer.rs
nslookup -type=mx primer.rs

# Čišćenje lokalnog DNS keša
ipconfig /flushdns          # Windows
sudo dscacheutil -flushcache # macOS
```

Opcija `+trace` je posebno poučna — pokazuje ceo put od root servera do autoritativnog odgovora.

---

## Česti problemi i kako ih prepoznati

**„DNS_PROBE_FINISHED_NXDOMAIN"** — domen ne postoji ili je istekao. Proverite registraciju i da li ste tačno ukucali ime.

**Sajt radi bez `www`, ali ne i sa `www`** — nedostaje A ili CNAME zapis za `www` poddomen.

**Mejlovi ne stižu, a sajt radi** — problem je gotovo sigurno u MX zapisima, ne u A zapisu.

**Sajt radi kod vas, kod drugih ne** — verovatno propagacija još traje ili je vaš računar zapamtio stari zapis.

---

## Zaključak

DNS je jedan od onih sistema koje primetimo tek kada prestanu da rade. Radi tiho, milijardama puta dnevno, i omogućava da se internet koristi pomoću imena umesto brojeva.

Ako pravite ili održavate sajt, razumevanje DNS-a nije luksuz nego neophodnost — od izbora hostinga i podešavanja mejlova, preko preusmeravanja, do zaštite domena. A ako ste samo korisnik, dovoljno je da znate: iza svakog kliknutog linka stoji nevidljiv, sekundarni razgovor između nekoliko servera koji za delić sekunde odgovore na jedno jedino pitanje — *„Gde tačno da idem?"*
