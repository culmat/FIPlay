# House radio: requirements

Draft for review, 2026-10-22. Built from the original request (2026-09-22), the proof of
concept in [README.md](README.md), and the answers given on 2026-10-22. Design lives
elsewhere; this file says what the house radio must do and how we will know it does.

Columns: **Prio** Must / Should / Could. **Source** *asked* (said by the owner),
*derived* (follows from a fact or another requirement), *assumed* (my reading, to
confirm). **Status** met, partly, open, or a question number from the end.

## Why

The Raumfeld app is the only way into the speakers: a guest needs it installed and
paired, and it cannot mix sources or apply any rule. FIPlay proved that a web page can
drive the speakers through PyRaumfeld. The house radio goes further: the speakers play
one stream from the NAS, and everything that decides what is in that stream (a single
queue, discovery across sources, autoplay with taste) lives behind it, where we control
it. FIPlay becomes the house radio's remote; the twelve FIP stations become sources
inside it.

## Decisions already taken

- **One stream.** At home the speakers play the house radio and nothing else. Picking a
  FIP station changes what the house radio plays; it does not point the speakers at
  Radio France. (Away from home FIPlay keeps playing FIP directly on the phone.)
- **One queue** for everyone.
- **Anyone with the QR code** may queue, skip and take over. The WLAN password is the
  gate; guests join the main WLAN.
- **MP3 192 kbit** is the stream format (the speakers start it in four seconds; AAC was
  slow, Ogg FLAC never started).
- **YouTube and the free catalogues** are sources from the start (E5, E6).
- **Autoplay starts with tags** (genre from files, FIP flavours and radio tags as moods),
  history and skips weighting the picks; audio analysis later (D2, D3).
- **Spotify is a take-over only**: guests play from their own Spotify app to "House
  Radio" through Spotify Connect; nothing is logged in on the NAS. Same for Apple Music,
  through AirPlay, if AirPlay can be made to work on this NAS.
- **Away from home, any source that needs no NAS plays on the phone itself**: FIP,
  other internet radios, YouTube. The library and the shared queue are home-only.
- **Music Assistant gets a two-week trial before the engine is chosen.** It covers most
  of this list out of the box (see "Existing apps" below); the trial decides whether its
  gaps are worth building on top of it, or whether Liquidsoap plus our own application is
  the better base. Criteria below.

## The trial (decided 2026-10-22)

Run Music Assistant 2.11 beta on the NAS, next to the proof-of-concept radio, with the
Raumfeld provider, the filesystem provider on the library, Radio Browser, the FIP streams
as custom radios, the Spotify Connect plugin and the Party plugin. Managed like the other
containers (`bun run` script, `.env` keys, no secrets in the repo).

It passes if, after two weeks:

| Criterion | Requirement | Pass when |
| --- | --- | --- |
| T1 | A1, A2 | The zone plays from Music Assistant within 5 s; grouping and volume work from its UI; a speaker started from the Raumfeld app is shown correctly |
| T2 | B1, N3 | Typing in the global search shows library results within about 200 ms on the Celeron, and radios and streaming results alongside |
| T3 | C1, C2, F1, F2 | A guest with the QR code queues, boosts and skips from their phone without login; the household sees the same queue; it is clear what guests cannot do (remove, play now) and whether that matters |
| T4 | D1, D2 | "Don't stop the music" on the library and a radio station as fallback both keep the stream going; how its picks feel against the tags-first idea |
| T5 | N4, G3 | RAM and CPU of the container at rest and while playing stay inside the budget (under 500 MB, under one core average) and the NAS stays responsive; audio analysis of the library finishes in reasonable time or is left off |
| T6 | E2 | Whether FIP's titles can be shown (custom radio with our metadata service, or not at all) |
| T7 | F3 | Spotify Connect take-over works from a guest's phone and the queue resumes afterwards |
| T8 | household UX | The login per device and the UI feel acceptable next to FIPlay |
| T9 | ops | Updates, restarts and a NAS reboot leave it working |

### Trial log

- **2026-10-22, setup.** The Raumfeld provider found no host until the second try (its
  check gives the Connector three seconds). Music Assistant had meanwhile created plain
  DLNA players for the three devices of the "Living" room; playing to those bypasses the
  room. The two that did not merge into the Raumfeld player (Connector, One S) are
  disabled.
- **2026-10-22, T1 multiroom.** With the defaults (FLAC, "smart" sample rate, ICY
  metadata with image) only the Connector played; the One M and One S kept joining and
  dropping out. Baseline: FIP's 192 kbit AAC through PyRaumfeld played on all three within
  seven seconds. What made Music Assistant play on all three, measured per device over
  UPnP: output codec **MP3**, flow sample rate **48 kHz** fixed, ICY metadata
  **disabled**. MP3 alone brought the One M back; the One S joined only once ICY was off.
  Audible sync to be confirmed by ear.

If it passes, the plan becomes: Music Assistant as the engine, FIPlay reduced to the
away-from-home player and the speaker switch, and the gaps (upload from a phone, FIP
titles, direction-driven autoplay with stickiness and weighting, AirPlay) built against
its API. If it fails, the Liquidsoap base stays and the application is ours.

## Who

| Person | Situation | Has |
| --- | --- | --- |
| Household | At home | The app on the phone, speaker control |
| Guest | On the home WLAN | A browser; maybe Spotify or Apple Music; no Raumfeld app, nothing installed |
| Household | Away | The app; FIP plays on the phone; the NAS is unreachable (carrier NAT) |
| Maintainer | Laptop, coding agent | The repo's bun scripts, ssh to the NAS |

## The concerns, in the order a listener meets them

### A. Switch on

| ID | Requirement | Prio | Source | Status |
| --- | --- | --- | --- | --- |
| A1 | One tap puts the house radio on the Teufel speakers (zone or rooms), one tap takes it off. | Must | asked | partly: FIPlay plays any URL on a zone |
| A2 | The app shows at any time whether the speakers are on the house radio, and what is on air. | Must | derived | open; today a speaker on the house stream reads as "not playing" |
| A3 | Several rooms: whatever Raumfeld groups into the zone plays in sync; FIPlay does not sync rooms itself. | Must | constraint | met by Raumfeld |
| A4 | The house radio also plays in the phone's browser (the HTTPS app needs it on its own origin, the speakers need the LAN address). | Should | derived | open |
| A5 | The speakers can be switched on without the app at all, e.g. from a Raumfeld favourite or a station button. | Could | asked (PoC item) | question Q8 |

### B. Discover

| ID | Requirement | Prio | Source | Status |
| --- | --- | --- | --- | --- |
| B1 | One search box with autocomplete over every source at once; results appear while typing, within about 200 ms for the library. | Must | asked ("super fast and easy") | open |
| B2 | A result says where it comes from (library, radio, YouTube, ...) and can be queued now, next, or at the end in one tap. | Must | asked | open |
| B3 | Browsing without typing: recent, history, folders or albums of the library, the radio directory by tag, the FIP flavours. | Should | derived | open |
| B4 | The library index is built from the files' tags (title, artist, album, genre, year) and kept current when files change. | Must | derived | open; 7,400 files, 111 GB, mostly FLAC and MP3 |
| B5 | Search works for guests without any login. | Must | asked | open |

### C. Queue

| ID | Requirement | Prio | Source | Status |
| --- | --- | --- | --- | --- |
| C1 | A single queue, visible to everyone, with what plays now and what comes next. | Must | asked | partly: API only |
| C2 | Queue operations: play now, play next, add at the end, remove, skip the current one. | Must | asked | partly: add and skip in the API |
| C3 | Queued items can be library tracks, uploaded files, YouTube or other resolvable links. Live streams are not queue items (they never end); they are autoplay stations. | Must | derived | open |
| C4 | A queued item that cannot be resolved (dead link, unsupported service) is dropped with a visible reason, never stalls the stream. | Must | derived | partly: Liquidsoap drops after a timeout, silently |
| C5 | When the queue runs empty, playback falls back to autoplay without a gap. | Must | asked | met for FIP as the only autoplay |
| C6 | Tracks crossfade; the stream is gapless. | Should | asked | met for queue items |

### D. Autoplay

| ID | Requirement | Prio | Source | Status |
| --- | --- | --- | --- | --- |
| D1 | Mode "station": one internet radio (a FIP flavour or any other) plays until the queue has something. | Must | asked | met for FIP |
| D2 | Mode "auto": the next track is picked from all available sources by a direction (mood, genre, energy: dance, calm, ...). | Must | asked | open; question Q3 |
| D3 | Stickiness: a control from "stay with this direction" to "a wild medley". | Should | asked | open |
| D4 | Directions are offered, not only typed: the app suggests a few next tracks or directions to go. | Could | asked | open |
| D5 | Picks use the history (what was played, queued, skipped, by whom) and weight people's choices above the algorithm's. | Should | asked | open; question Q6 |
| D6 | Picks avoid repeating a track within a day and an artist within an hour, unless asked. | Should | assumed | open |
| D7 | Tracks from different sources play at a similar loudness. | Should | derived | met: `normalize` in the stream |

### E. Sources

What a source needs to be usable: a way to **find** (search or browse), a way to **play**
(a URL or file the NAS can decode), and **terms** that allow it.

| ID | Source | Find | Play | Prio | Status |
| --- | --- | --- | --- | --- | --- |
| E1 | NAS library (`/share/.../Multimedia/Music`) | own index (B4) | file, read-only mount | Must | open |
| E2 | FIP, the twelve flavours | fixed list, with now-playing from the metadata service | live stream | Must | met |
| E3 | Internet radios beyond FIP | a directory with a free API (radio-browser.info: name, tag, country, with stream URLs) | live stream | Should | open |
| E4 | Files from a phone | the phone's file picker, uploaded through the web page | the uploaded file; kept or discarded, question Q4 | Should | open |
| E5 | YouTube | search needs no login (yt-dlp, or the Data API with a key) | yt-dlp resolves an audio URL the NAS plays; unofficial, breaks when YouTube changes, needs regular yt-dlp updates | Could | question Q2 |
| E6 | Free catalogues: Internet Archive, Jamendo, Bandcamp, podcasts by RSS | each has a free search | direct files or streams | Could | question Q2 |
| E7 | Spotify | the station can only search and play Spotify by itself with a Premium account logged into the NAS through an unofficial client, against Spotify's terms; without that, the guest's own phone plays to the house radio via Spotify Connect and the station only receives audio and titles | audio via librespot into the stream | Should as Connect, Could as a searchable source | question Q1 |
| E8 | Apple Music | no usable playback outside Apple's apps and DRM web player; only the guest's phone can play it, via AirPlay into the house radio | audio via shairport-sync | Could | question Q1 |

A guest's own paid service therefore works as a **take-over** (E7, E8): the phone plays,
the house radio carries the audio and shows the title, and the queue resumes when the
phone stops. It does not become a searchable source for everyone.

### F. Guests and take-over

| ID | Requirement | Prio | Source | Status |
| --- | --- | --- | --- | --- |
| F1 | A guest scans a QR code and is on the queue page: no install, no login. | Must | asked | partly: the About dialog has a QR code to the app |
| F2 | A guest may queue, remove, skip and take over, like everyone. | Must | decided | open |
| F3 | Take-over by Spotify Connect or AirPlay: the device "House Radio" appears in the guest's app; while it plays it has priority; when it stops, the queue or autoplay resumes. | Should | asked | open; AirPlay is the riskiest on this NAS (avahi without dbus) |
| F4 | The queue page shows who is on air during a take-over and from which device. | Should | derived | open |
| F5 | History and weighting (D5) tell people apart by device, without accounts. | Should | derived | question Q6 |

### G. Operations

| ID | Requirement | Prio | Source | Status |
| --- | --- | --- | --- | --- |
| G1 | The radio's containers are managed by bun scripts like `bun run backend`: status, logs, update, restart, with a check before any restart. | Must | derived | open; run by hand today |
| G2 | `bun run nas:status` reports the radio. | Should | derived | open |
| G3 | Everything restarts by itself after a NAS reboot. | Must | derived | met: three weeks unattended |
| G4 | No host name, address, path or secret in the repo. | Must | standing rule | met |
| G5 | The library index rebuilds on its own when files are added. | Should | derived | open |

## Quality

| ID | Requirement | Target | Measured |
| --- | --- | --- | --- |
| N1 | Play command to sound on the speaker | 5 s | 4 s |
| N2 | Source to speaker delay | fine for music, not for lip sync | not measured; several seconds built in, question Q7 |
| N3 | Search response, library | 200 ms | — |
| N4 | NAS cost, all radio containers | under one core average, under 500 MB | Liquidsoap alone: a quarter core, 80 to 170 MB |
| N5 | Reach | home network only | met |

## Constraints

- The Raumfeld zone renderer cannot queue a next URL and drops the connection on pause:
  one continuous stream is the only way to gapless playback.
- Carrier NAT: nothing on the NAS is reachable from outside the home.
- The NAS: Celeron N3160, about 1.9 GB free RAM, avahi without dbus.
- Liquidsoap's `output.harbor` is unmaintained upstream; `output.icecast` is the
  replacement if needed.
- YouTube and Spotify playback on the station side rely on unofficial clients.

## Out of scope (assumed)

Listening away from home; replacing the Raumfeld app or syncing rooms ourselves; Home
Assistant; lossless audio; user accounts.

## Answers to the questions raised on 2026-10-22

### How would Spotify work as a searchable source, and how likely is a suspension?

Two parts are needed and both exist in Music Assistant today; building them ourselves
would copy the same mechanics.

1. **Catalogue search** goes through Spotify's Web API with the household's Premium
   login (OAuth). Since March 2026 Spotify limits a developer app to five users and
   requires the owner's Premium subscription to stay active; search results in that mode
   are capped at ten. For one household that is enough.
2. **Audio** comes from a Spotify Connect engine logged in with the same account, which
   writes the decoded audio into our stream. Two engines exist: **librespot**, the
   reverse-engineered client (works for accounts created before December 2024, breaks when
   Spotify changes things), and **Spotify Soloist**, Spotify's own binary that Music
   Assistant downloads from Spotify after you accept their terms, works with every Premium
   account, and can play lossless.

Risk, as far as it can be known: there is no official Spotify policy on either engine.
librespot's own README says the method is probably forbidden and could get its key
banned. Reports of account suspensions are anecdotal and disputed; one current
librespot-based product says it knows of no ban from normal Premium listening. Music
Assistant's page says Spotify's terms "do not clearly allow" Soloist's use this way and
that it is "at your own risk". A Hacker News thread from September 2026 claims Spotify is
pressuring the projects legally; unverified. **Practical reading:** low but real, and
entirely on the account that is logged in. The mitigation everyone uses is a separate
Premium account for the NAS (a Family-plan member), so a suspension never touches a
personal one.

The alternative that stays inside the terms: **Spotify Jam**. The household's Premium
phone starts a Jam, guests join with any account (free included, in person), add songs
from their own phones, and the audio reaches the house radio through Spotify Connect.
No login on the NAS, but the queue is Spotify's, not ours.

Apple Music: Music Assistant has a provider for it too (subscription needed). Otherwise it
only reaches the house radio by AirPlay from the guest's phone.

### Why would the single user away from home be "FIP only"?

Only because FIP is the one source the phone can reach without the NAS: the library sits
behind carrier NAT. Internet radios and YouTube could play on the phone away from home
too, through a phone-side player, and Music Assistant offers remote access to the NAS
through its relay. So "away" is a scope decision, not a technical limit: see Q10.

### Is this "wetube", and are we reinventing the wheel?

Shared-queue apps exist in numbers: GroupTube, ListenTogether, SongUp, Jukebox
(jukeboxhq, self-hosted, MIT), a YouTube jukebox with QR codes, and Spotify-backed
jukeboxes. All of them play YouTube or Spotify, none plays a local library, and none
drives a Raumfeld speaker. For the combination asked here, two real candidates exist:

| Requirement | Music Assistant 2.11 (beta) | Lyrion Music Server |
| --- | --- | --- |
| A1 speakers | **native Teufel Raumfeld provider**, merged 2026-09-27, in the 2.11 beta; groups become zones; gapless "flow mode" stream; pause is a stop | only through a UPnP bridge, Raumfeld unconfirmed; no gapless on these renderers |
| B1 search over all sources | one global search; the guest page searches as you type | per plugin, not unified |
| C queue | full queue for the household; guests request, boost, and skip if allowed; **no remove, no play-now** for guests | shared queue; Material Skin party mode: add to the end only |
| D autoplay | "Don't stop the music" and Radio Mode from audio similarity (its Sonic Similarity analyses the files, CPU-heavy once); Discover by taste; **no direction by mood, no stickiness control, no explicit history weighting** | "Don't Stop The Music" with LastMix (Last.fm) or Spotty mixes; same gaps |
| E1 library | filesystem provider, tags, artwork | yes |
| E2 FIP | as custom radio URLs; **FIP's titles would be lost** (the streams carry no metadata; our metadata service is FIPlay's) | same |
| E3 radios | Radio Browser provider | plugin |
| E4 upload from phone | no | no |
| E5 YouTube | YouTube Music provider: **needs a paid Google account**, cookie login that expires, a "PO token" helper container, best-effort | plugin, free, best-effort |
| E6 free catalogues | podcasts, SoundCloud; no Internet Archive or Jamendo | podcasts, some plugins |
| E7 Spotify | search and playback with Premium (librespot or Soloist); Spotify Connect take-over plugin | Spotty (librespot) |
| E8 Apple Music | provider with a subscription | no |
| F1 guest QR, no login | Party plugin: QR, guest page, per-guest rate limits, duplicates blocked | party skin, weaker |
| F3 AirPlay take-over | no (it sends AirPlay, does not receive it) | no |
| Household UI | its own web app, **login required** per device (first account is admin) | web UI, no login |
| N4 NAS cost | **2 GB RAM minimum stated**; the NAS has 1.9 GB free; audio analysis is slow on a Celeron | lighter (Perl) |
| Ops | Docker, host networking, one volume; fits `bun run` management | Docker |

So: yes, for the core (speakers, library, radios, queue, guest QR page, Spotify, Apple
Music) the wheel exists and is Music Assistant. What it does not have is exactly the part
of the list that is personal: upload from a phone, FIP's titles, a direction-driven
autoplay with stickiness and people's choices weighted in, guests removing or
front-queueing, AirPlay take-over. Those could be built on top of it (it has a full API and
a plugin system) rather than beside it. What it costs: a login for the household, a RAM
budget the NAS can only just afford, a paid Google account for YouTube, and a dependency
on a fast-moving project (the Raumfeld provider is weeks old and in beta).

## Questions still open, with the default the trial will use

- **Q4.** Files uploaded from a phone: default **played once**, deleted after; keeping
  them is a conscious "add to library" action later.
- **Q6.** Telling people apart by device (a cookie) for history and weighting: default
  **yes**; no names, no accounts.
- **Q7.** Several seconds of delay during a take-over: default **acceptable** for music;
  to be felt during the trial (T7).
- **Q8.** Switching the speakers on without the app: default **try it** during the trial;
  Music Assistant 2.11 offers a speaker's station buttons as sources, which may be the way.
