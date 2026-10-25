# Multiroom playback: what the measurements showed

The "Living" Raumfeld room has three Wi-Fi devices: a Connector, which is also the
Raumfeld host and relays the room's stream to the others, a One M and a One S. During
the first Music Assistant evening (2026-10-22) mostly one of them played, and two never
played in time. This file records the measurements from that evening to the next night.
It covers what caused the dropouts, which bitrate the room carries, and how song titles
and artwork reach the speakers.

## In short

- **Cause:** the dropouts came from 2.4 GHz Wi-Fi. With all three devices on the
  repeater's 5 GHz radio, every stream tried played on all three for 6 to 10 minutes
  without a gap. That includes plain FIP, Music Assistant's MP3, AAC and FLAC, and even
  1.5 Mbit WAV. Music Assistant's host disconnects stopped too.
- **Bitrate:**
  - Music Assistant: FLAC, which is lossless and well inside what the room carries.
  - FIPlay: FIP's own 192 kbit AAC, the best its source offers.
- **Song titles:**
  - Music Assistant: ICY "basic" brings them back to the Raumfeld app. The cover stays the
    first song's. ICY "full", the provider's default, never updated the title.
  - FIPlay: it started FIP without any metadata, so the Raumfeld app had nothing to
    show. Since 2026-10-23 it sends the station's name and the FIPlay icon, through
    PyRaumfeld's `play` route. Per-song FIP titles need the house radio's stream.
- **Music Assistant is left on** FLAC, 48 kHz, flow mode, ICY "basic". The speakers are
  stopped, as they were before the measurements.

## Method

- Every 10 s, `GetTransportInfo` over UPnP on each device and on the room's zone
  renderer, found through the host's `/listDevices`. A device counts as "out" in a sample
  when it is not `PLAYING`. Seen were `NO_MEDIA_PRESENT`, `TRANSITIONING` and transport
  status `buffer underrun`.
- Once a minute, the zone's `GetPositionInfo` track metadata (title, artist, album art).
  That is what the Raumfeld app has to show from.
- Per run: Music Assistant's log and `docker stats`. Its settings were switched through its
  websocket API (`config/players/save`, then `player_queues/play_media`).
- Each run is 10 minutes (60 samples) or 6 minutes (36). The first sample of a run, taken
  while the stream starts, is left out.
- Limits:
  - A transport state says whether a device plays, not whether it is in time with the
    others. Sync is still for the ear.
  - A dropout shorter than 10 s can fall between two samples.

## The network was the cause

The FRITZ!Box mesh had all three devices on 2.4 GHz: the Connector and the One M on the
repeater (37 and 71 Mbit/s link rate), the One S on the box (86). Moved to the repeater's
5 GHz radio they link at 135 (Connector), 150 (One M) and 866 (One S), and the repeater's
backhaul runs at 534.

Plain FIP (192 kbit AAC) started through PyRaumfeld, as FIPlay does:

| Network | Music Assistant | Connector out | One M out | One S out |
| --- | --- | --- | --- | --- |
| 2.4 GHz | running, idle | 0 / 59 | 15 / 59 | 15 / 59 |
| 2.4 GHz | stopped | 0 / 59 | 0 / 59 | 33 / 59 |
| 5 GHz | stopped | 0 / 59 | 0 / 59 | 0 / 59 |
| 5 GHz | running, idle | 0 / 60 | 0 / 60 | 0 / 60 |

On 2.4 GHz the host was also too slow for Music Assistant:
- Every ten minutes a burst of "Long-polling timed out" appeared, and three to four minutes
  later "host connection lost - pausing".
- Each disconnect marks the room unavailable and rebuilds the whole host connection.

On 5 GHz the long polls still expire every five and a half minutes. That is their normal
idle timeout, and the host answers each one: 92 expiries and no disconnect in the two hours
of these runs. Whether Music Assistant's reconnects knocked the One M out on their own,
on top of the slow link, no longer matters.

## Bitrate

All on 5 GHz, the same FIP programme each time (Music Assistant played FIP's stream as a
radio item, ICY metadata off):

| Stream | Bitrate | Out (any device) | Music Assistant CPU, RAM |
| --- | --- | --- | --- |
| FIP direct, started with a DIDL title (as FIPlay could) | 192 kbit AAC | 0 / 35 | idle |
| Liquidsoap house mount | 192 kbit MP3 | 0 / 35 | idle |
| Music Assistant MP3 | 320 kbit | 0 / 59 | 37 %, 249 MB |
| Music Assistant AAC | 256 kbit | 0 / 59 | 30 %, 263 MB |
| Music Assistant FLAC 48 kHz/16 | variable, roughly 0.7–1 Mbit (estimate) | 0 / 59 | 30 %, 269 MB |
| Music Assistant WAV 48 kHz/16 | 1536 kbit | 0 / 35 | 40 %, 242 MB |

(CPU is of one core of the Celeron N3160. The library scan was running at the same time.)

- **Music Assistant:** FLAC. It is lossless, and it plays on all three devices with
  room to spare, since even uncompressed WAV did. The flow stream for library playback
  goes out at 24 bit (48 kHz/24 FLAC, an estimated 1.5–2 Mbit). That is roughly the WAV
  run's load, and the metadata runs below played it without a dropout.
- **FIPlay:** keep `fip-hifi.aac`. 192 kbit AAC is the best Radio France offers on
  Icecast, and a higher bitrate further down the chain adds nothing.
- **House radio (Liquidsoap):** MP3 192 works.
  - The proof of concept found Ogg FLAC does not start on the Raumfeld.
  - Music Assistant's FLAC is native FLAC (ffmpeg), not Ogg, and plays. So a lossless
    mount would be `%ffmpeg(format="flac", %audio(codec="flac"))`; untested.
  - For a radio fallback, lossless is pointless: FIP arrives as 192 kbit AAC. It only
    pays for the library.

## Song titles and artwork

What the zone reports as the current track, per way of starting a stream:

| Started by | Zone's title | Artwork | Follows the songs |
| --- | --- | --- | --- |
| FIPlay until 2026-10-23 (PyRaumfeld `play/<url>`, no DIDL) | empty | none | no |
| The same URL with a DIDL item, as FIPlay now does (`?title=FIP%20Jazz&art=…`) | "FIP Jazz" | the FIPlay icon | no |
| Liquidsoap mount, no DIDL, ICY titles in the stream | empty | none | no |
| Music Assistant, radio item | the item's name ("fip-hifi.aac") | Music Assistant logo | no |
| Liquidsoap mount with a DIDL item ("House radio", logo) | ICY title, "Artist - Title" | the logo | title only |
| Music Assistant flow stream, ICY off | first track's title, artist, album | first track's cover | no |
| Music Assistant flow stream, ICY basic | ICY title, "Artist - Title" | first track's artist, album and cover stay | title only |
| Music Assistant flow stream, ICY full | first track's title | first track's cover | no |
| Music Assistant, flow mode off | each song's title, artist, album | each song's cover | yes |

Why FIP showed nothing:
- Radio France's Icecast streams carry no ICY metadata at all.
- PyRaumfeld's `play/<url>` route called `zone.play(uri)` with empty metadata, although
  the library takes a `meta` argument. It now builds a broadcast item from `?title=` and
  `?art=`.

How the Raumfeld host handles metadata:
- It takes title, artist, album and cover from the DIDL-Lite item the stream was started
  with.
- After that it changes only the title, from the stream's ICY `StreamTitle`. It does so
  only when the stream was started as a broadcast item (`object.item.audioItem.audioBroadcast`):
  the bare Liquidsoap mount sent titles and the zone ignored them.
- Artist, album and cover never change while a stream runs.

On a queue of four tracks from four albums, ICY "basic" gave the right title for each
song under the first song's artist and cover. ICY "full" never updated the title, in 8
and 10 minutes of playback, while Music Assistant's queue moved through the tracks on
time. All three devices stayed `PLAYING` either way.

Upstream measured a One S re-requesting the flow stream every ~39 s with "full" and
starting the song over. Whether that happened here is for the ear. Either way "full" buys
nothing on a Raumfeld and costs the title.

With flow mode off, Music Assistant starts every song as a stream of its own, with its own
DIDL item. Title, artist, album and cover then follow each song, and all three devices
played the four songs. The cost:
- At each of the three song changes, all three devices were `TRANSITIONING` in one sample.
  The sampling ran every 5 s for this run, so each gap is a few seconds.
- There are no crossfades or gapless albums, and every song makes the room re-join the
  stream.

What this means:

- **Music Assistant:** flow mode on with ICY "basic", as it is now set.
  - The song title is back. The cover and artist line in the Raumfeld app stay those of
    the first song.
  - Music Assistant's own UI and FIPlay show the right cover regardless.
  - Flow mode off gives full metadata in the Raumfeld app, at the price of a gap between
    songs. It is a per-player setting, so it can be tried for a party and switched back.
- **FIPlay, station name and cover:** done, with no stream change.
  - FIPlay sends the station's name and the app icon when it starts a station.
  - PyRaumfeld passes them to the zone as a broadcast item. Verified on the zone from
    the deployed app.
  - What the Raumfeld app makes of them has not been looked at yet.
  - Resuming a paused station keeps whatever the zone already held, so a station started
    before this change shows its name only after the next station change.
- **FIPlay, FIP's song titles in the Raumfeld app:** only through a stream that carries
  ICY titles and is started as a broadcast item. That means the house radio: Liquidsoap
  puts the FIP titles into its mount, and the zone shows them. The cover stays whatever
  the DIDL item named.

The Liquidsoap mount sent a flickering title: 17 ICY titles in seven minutes for three
songs. The FIP feed swings between the song, the "Le direct" placeholder and the
previous song around every change, and `house.liq` passed each swing on. Fixed in
`house.liq` with FIPlay's rules: a placeholder does not replace a song still running, and
a song that started no later than the one shown is old news. The fix is not deployed to
the NAS yet.

## Station switching

Switching FIP stations felt slower through Music Assistant than through FIPlay. Measured
on 2026-10-25 with `bun scripts/switch-timing.ts direct|ma`:
- The script alternates FIP Jazz and FIP Rock, six switches, with the room already playing.
- It polls the zone and the three devices every 250 ms, and counts until all four are
  `PLAYING` again on the new stream.
- The first switch of each run is left out of the median.

| Started by | Zone takes the new stream | All playing (median) |
| --- | --- | --- |
| FIPlay (PyRaumfeld `play/<url>`, then `play`) | 0.3 s | **3.1 s** (2.8–3.6) |
| Music Assistant, as it was | 2.1 s | **4.5 s** (4.1–4.8) |
| Music Assistant, radio volume normalization fixed instead of dynamic | 2.0 s | 5.0 s (no gain) |
| Music Assistant, UPnP actions cached in the Raumfeld provider | 1.3 s | **3.2 s** (3.1–4.3) |

- **The room itself** needs about 2.5 s to re-join any new stream, whoever sends it.
  That part is the same for both ways.
- **Where Music Assistant lost the time**, from its debug log, per switch:
  - About 0.2 s from the request until the old stream is stopped.
  - Stream details in 20–30 ms.
  - About 0.9 s to open FIP's Icecast stream and decode the first chunk.
  - About 1.0 s from "Starting playback on Living" until the host requests the stream.
- **The 1.0 s** was three UPnP actions in a row: `Stop`, `SetAVTransportURI`, `Play`.
  Before each one, hassfeld's `get_dlna_action` built the device again, reading the zone
  renderer's device description and every service description.
  - The provider now keeps the action per description URL. Each action is one request.
  - It drops the kept action when the renderer cannot be reached, for example after it
    came back on another port.
  - Branch `raumfeld-upnp-cache` in `culmat/server`, deployed on the NAS.
- **Not the cause:**
  - Music Assistant's paced FLAC output. The room re-joins Music Assistant's stream a
    little faster than FIP's own.
  - Volume normalization.
  - Flow mode and ICY. Neither applies to radio, which Music Assistant always streams one
    item at a time.
- **Seen on the side:**
  - Music Assistant decoded FIP's 48 kHz AAC to 44.1 kHz, then resampled to 48 kHz for the
    FLAC. The FIP provider gave no sample rate, and the model's default is 44.1 kHz.
    - All 13 hifi mounts are 48 kHz (ffprobe, 2026-10-25). The provider now says so:
      branch `fip-sample-rate` in `culmat/server` for upstream, and `fip-provider` on the
      NAS.
    - Music Assistant now stays at 48 kHz from decode to FLAC. This saves quality and CPU,
      not time.
  - Twice in about 30 switches, the room did not play again within 45 s. Once it was
    before both fixes and once after. The host had fetched the new stream, and Music
    Assistant logged nothing unusual. Not understood yet.

## Feedback for Music Assistant

The Raumfeld provider (`music_assistant/providers/raumfeld/` in music-assistant/server,
code owner @Simanias, stage "experimental") is four weeks old. It had about fifteen merged
pull requests in that time, and nothing in it changed between 2.11.0b6 and `dev` on
2026-10-22.

Status on 2026-10-23:
- Item 1 went upstream as server#7171.
- Item 2 is fixed by server#7166, which the code owner verified on a single One S.
- Item 3 went upstream as support#6851. The code owner confirmed it and is working on a
  fix.

1. **Host check gives up after 3 s.**
   - What happens:
     - Setup failed once with "no Raumfeld host found" and passed on the retry.
     - The supervisor runs the same check every 30 s (`provider.py:250-278`), and one
       failure tears the connection down and marks every room unavailable.
   - The cause: `async_host_is_valid` in hassfeld 0.3.14 uses its own `ClientTimeout(total=3)`
     (`hassfeld/__init__.py:106-121`), so the 10 s around it in `setup_flow.py:28` never
     applies.
   - Evidence: on the slow 2.4 GHz link this happened about every ten minutes, each time
     three to four minutes after a burst of long-poll timeouts; on 5 GHz not once in two
     hours.
   - Worth an issue with a small PR: a 10 s check through Music Assistant's shared HTTP
     session, and a disconnect only after two or three failures in a row.
2. **ICY "full" and the 256 KB write size.**
   - Already known upstream. In the thread of server#7147, the code owner measured that
     with "full" a One S re-requests the flow stream every ~39 s, and with "basic" it does
     not.
   - The cause is the write size, which follows the metadata interval
     (`streams/controller.py:1470,1548`).
   - The maintainers plan to decouple the two centrally, so no new issue is needed. Our
     runs are a data point for that PR when it appears. On a three-device room on 5 GHz
     with FLAC 48 kHz/24:
     - "full" dropped no device, but the zone's title stayed on the first song for 8 and
       10 minutes while the queue moved on.
     - "basic" updated the title at every song.
     - On 2.4 GHz the One S joined only once ICY was switched from "full" to off.
   - Arguably the Raumfeld default should be "basic" until that lands
     (`raumfeld/constants.py:89`, `provider.py:744-761`). The provider's own comment calls
     the ICY title "the only way the Raumfeld app can follow the queue", and "full" loses
     it.
3. **A room with several speakers leaves DLNA duplicates.**
   - The Raumfeld player exposes only the room's first renderer (`player.py:237-248`,
     hassfeld `room["renderer"][0]`), and a native player links only one DLNA output.
   - So the One M merged, while the Connector and One S stayed separate DLNA players
     ("Connector Living", "Speaker Living").
   - Playing to one of those goes around the host, which still owns the room. That is how
     the first attempt played the host's own queue instead.
   - The docs (`player-support/raumfeld.md:25` on the docs repo's `beta` branch) say the
     devices "do not show up twice".
   - Worth a bug report plus a docs correction. The fix (all renderer IDs per room from
     the host's zone config, then hide the extras as server#6563 does for zone renderers)
     is for the code owner to shape.
4. **Memory.** 530 MB after an evening of use, 200–390 MB through these runs. Not
   Raumfeld-specific; support#6799 is the open report if it keeps growing.

Local forks for any of this: `culmat/server`, `culmat/hassfeld` and
`culmat/music-assistant.io`, cloned next to this repository.
