# Kako sam tražio grešku u indeksu

Prošle nedelje mi je jedan upit počeo da traje četiri sekunde umesto
osamdeset milisekundi. Ništa se nije promenilo u kodu. Promenili su se podaci.

Prvo sam pogledao plan izvršavanja. Postgres je prestao da koristi indeks nad
kolonom `status` i prešao na sekvencijalno čitanje cele tabele. To se dešava
kada planer proceni da će vratiti preveliki deo redova. Statistika je bila
stara nedelju dana, a u međuvremenu je uvezeno dva miliona novih redova u
kojima je skoro svaki imao isti status.

Pokrenuo sam `ANALYZE` nad tabelom. Upit se vratio na osamdeset milisekundi.

Tu se priča obično završava, ali mene je zanimalo zašto se statistika nije
osvežila sama. Autovacuum ima prag: pokreće se kada se promeni dovoljan
procenat redova. Podrazumevano je dvadeset odsto. Tabela je već imala
šezdeset miliona redova, pa dva miliona novih nije bilo ni blizu praga.
Prag koji je razuman za malu tabelu postaje besmislen za veliku.

Rešenje nije bilo elegantno. Spustio sam prag samo za tu tabelu i dodao
eksplicitni `ANALYZE` na kraj skripte koja radi uvoz. Dva podešavanja umesto
jednog, ali oba rade ono što treba.

Ono što me je iznenadilo je koliko je dugo problem bio nevidljiv. Upit je
usporavao postepeno, nedelju za nedeljom, i niko nije primetio dok nije
prešao prag ljudskog strpljenja. Nemamo alarm na trajanje upita, samo na
greške. Upit koji radi sporo nije greška, pa niko nije bio obavešten.

Dodao sam merenje. Sada beležimo trajanje za deset najčešćih upita i
poredimo sa prošlom nedeljom. Nije savršeno. Ako se svi upiti uspore
istovremeno, poređenje sa prošlom nedeljom neće ništa reći. Ali za ovaj
slučaj bi bilo dovoljno.

Ključna reč u celoj priči je „postepeno". Sistemi retko otkažu odjednom.
Češće se kvare polako, u granicama koje niko nije definisao kao granice.
Alarm koji čeka da nešto pukne propušta upravo tu vrstu kvara.

Sledeći put ću prvo pogledati statistiku, pa tek onda kod. Kod je bio isti
mesec dana. Podaci nisu.
