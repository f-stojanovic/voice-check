---
provenance: generated
subject: dns-explainer
format: explainer
language: en
model: claude-opus-5
generated: 2026-08-26
words: 1356
prompt: Write a blog post explaining what DNS is.
---

# DNS Explained: The Internet's Address Book

Every time you type a web address into your browser, a small miracle of coordination happens in a few dozen milliseconds. Your computer has no idea where `example.com` actually lives. It needs to ask. The system it asks is called DNS — the Domain Name System — and it's one of the oldest and most essential pieces of infrastructure on the internet.

Here's how it works, and why it matters.

## The Problem DNS Solves

Computers on the internet find each other using IP addresses: numeric labels like `93.184.216.34` (IPv4) or `2606:2800:220:1:248:1893:25c8:1946` (IPv6). Routers understand these numbers. Humans, famously, do not.

In the early days of the ARPANET, this was manageable. A single file called `HOSTS.TXT` mapped every hostname on the network to its address, and administrators downloaded updated copies from a machine at Stanford Research Institute. That worked when the network had a few hundred hosts. It fell apart quickly as the network grew — the file got large, updates were slow, and everyone had to agree on a single authority for naming.

In 1983, Paul Mockapetris designed DNS as the replacement. Instead of one central file, DNS distributes the job across a hierarchy of servers, each responsible for a small slice of the namespace. No single machine knows everything, and no single machine has to.

## Reading a Domain Name Backwards

Domain names are hierarchical, and the hierarchy reads right to left:

```
www.example.com.
 │      │     │ │
 │      │     │ └── root (usually invisible)
 │      │     └──── top-level domain (TLD)
 │      └────────── second-level domain
 └───────────────── subdomain / hostname
```

That trailing dot after `.com` is real, though browsers hide it. It represents the DNS root — the top of the tree. Everything below it is delegated downward: the root delegates `.com` to Verisign, Verisign delegates `example.com` to whoever registered it, and that registrant controls everything beneath, like `www.example.com` or `mail.example.com`.

This delegation model is the whole trick. Each level only needs to know who to ask next.

## Anatomy of a Lookup

Suppose you've never visited `example.com` before and you type it into your browser. Roughly this happens:

**1. Local caches get checked first.** Your browser has a cache. Your operating system has a cache. There may be entries in your `hosts` file. If any of them has the answer, the process stops here.

**2. Your device asks a recursive resolver.** This is usually run by your ISP, or by a public provider like Cloudflare (`1.1.1.1`) or Google (`8.8.8.8`). The resolver does the legwork on your behalf. If it has a cached answer, it returns it immediately.

**3. The resolver asks a root server.** There are 13 root server *addresses* (labeled A through M), served by hundreds of physical machines worldwide via anycast routing. The root doesn't know about `example.com`, but it knows who handles `.com`, and it says so.

**4. The resolver asks a `.com` TLD server.** This server doesn't know the IP address either, but it knows which nameservers are authoritative for `example.com`. It hands back that referral.

**5. The resolver asks the authoritative nameserver.** This one actually holds the records for the domain. It returns the answer: `93.184.216.34`.

**6. The resolver caches and replies.** Your browser opens a TCP connection to that IP and requests the page.

Four queries, and each step narrows the search. In practice, steps 3 and 4 are almost always skipped because the resolver already has the root and TLD information cached — those answers change rarely and are held for a long time.

## Record Types

DNS isn't only for mapping names to IP addresses. A zone (the set of records for a domain) can contain many record types:

| Type | Purpose |
|---|---|
| **A** | Maps a name to an IPv4 address |
| **AAAA** | Maps a name to an IPv6 address |
| **CNAME** | Alias pointing one name at another name |
| **MX** | Mail servers for the domain, with priority values |
| **TXT** | Arbitrary text — used for SPF, DKIM, domain verification |
| **NS** | Which nameservers are authoritative for this zone |
| **SOA** | Administrative metadata about the zone |
| **PTR** | Reverse lookup: IP address → name |
| **SRV** | Locates services (host and port) for protocols like SIP or XMPP |
| **CAA** | Specifies which certificate authorities may issue certs for the domain |

TXT records deserve a mention because of how much has been bolted onto them. Email authentication — SPF, DKIM, DMARC — all lives in TXT records. So does the "add this string to your DNS to prove you own this domain" verification that dozens of services use.

## Caching and TTL

Every DNS record carries a **TTL** (time to live), measured in seconds. It tells resolvers how long they may cache the answer before checking again.

TTLs are a tradeoff. A long TTL (say, 86400 — one day) means fewer queries, faster responses, and less load on your nameservers. A short TTL (300 — five minutes) means changes propagate quickly, but at the cost of more traffic.

This is the source of a common frustration: you update a DNS record, but some people still hit the old server. Nothing is broken; resolvers around the world are just still holding cached copies until the TTL expires. The standard practice before a planned migration is to lower the TTL a day or two in advance, make the change, then raise it back.

There's also **negative caching** — resolvers cache the *absence* of a record too, governed by a value in the SOA record. If you query a name that doesn't exist and then create it, you may still get "not found" for a while.

## Where DNS Breaks

A few failure modes come up constantly:

- **Stale caches.** As above. Clear your local resolver cache or wait out the TTL.
- **Missing glue records.** If your nameserver is `ns1.example.com` and it's authoritative for `example.com`, you have a chicken-and-egg problem. Glue records — A records stored at the parent zone — break the loop.
- **CNAME at the apex.** The DNS spec doesn't allow a CNAME to coexist with other records at the root of a domain, which makes `example.com` (no `www`) tricky to point at a CDN. Providers work around this with nonstandard "ALIAS" or "ANAME" records.
- **Split-horizon confusion.** Some networks return different answers internally than externally. Great for security, confusing to debug.

The tools to investigate are `dig` (or `nslookup` on Windows). `dig example.com A +trace` walks the entire delegation chain and shows each step — the fastest way to see where a lookup is going wrong.

## Privacy and Security

DNS was designed in a more trusting era, and it shows. Classic DNS queries travel in plaintext over UDP port 53. Anyone on the path — your ISP, a coffee-shop network operator — can see every domain you look up, and in principle can tamper with the answers.

Several efforts have addressed this:

**DNSSEC** adds cryptographic signatures to DNS records, letting a resolver verify that an answer genuinely came from the authoritative source and wasn't forged in transit. It doesn't encrypt anything — it's about authenticity, not privacy. Adoption has been slow and uneven.

**DNS over HTTPS (DoH)** and **DNS over TLS (DoT)** encrypt the connection between you and your resolver. Your ISP can no longer read your queries. This is now built into major browsers and operating systems, though it's been controversial — it shifts visibility (and trust) from your network operator to whichever resolver you've chosen.

**Oblivious DoH** goes further, using a relay so that the resolver sees the query but not who asked it.

## Why It Matters

DNS is invisible when it works, which makes it easy to forget how much depends on it. It's the layer that makes the web navigable by humans. It's how email finds its destination. It's how load balancers steer traffic between data centers, how CDNs route you to a nearby edge server, and how services fail over during an outage.

It's also a frequent culprit when things go wrong. Several of the largest internet outages of the past decade traced back to DNS misconfiguration — including the 2021 Facebook outage, where a bad routing update withdrew the routes to their own nameservers, making their entire domain unresolvable for six hours.

There's a well-worn sysadmin joke about this: *It's not DNS. There's no way it's DNS. It was DNS.*

It's a joke because it's true more often than anyone would like — and it's true because DNS sits underneath nearly everything else.
