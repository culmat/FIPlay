# House radio

A Liquidsoap stream on the NAS that the Raumfeld speakers play, with the queue, the
local library, FIP as the fallback and the guest inputs behind it. `house.liq` is the
station; this file records what the proof of concept measured on 2026-09-28.

## How it runs (by hand, until `bun run radio` exists)

```sh
ssh <nas> 'mkdir -p /share/fiplay-radio'
rsync -rlt radio/ <nas>:/share/fiplay-radio/
ssh <nas> '
  D=/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker
  "$D" volume create fiplay-radio-run
  "$D" run --rm -v fiplay-radio-run:/run/radio alpine sh -c "cd /run/radio && mkfifo airplay spotify"
  "$D" run -d --name liquidsoap --network host --restart unless-stopped \
    -v /share/fiplay-radio:/radio:ro -v <music share>:/music:ro -v fiplay-radio-run:/run/radio \
    -e FIP_METADATA_URL=http://127.0.0.1:<metadata port> \
    savonet/liquidsoap:v2.4.x-latest /radio/house.liq'
```

Host networking, so the script reaches the metadata service on loopback and the
receivers (later) can advertise themselves. Stop it with `docker stop liquidsoap`.

Syntax check before every change, on the same image:

```sh
docker run --rm -v "$PWD/radio:/radio:ro" savonet/liquidsoap:v2.4.x-latest liquidsoap --check /radio/house.liq
```

## What the proof of concept found

Image `savonet/liquidsoap:v2.4.x-latest` = Liquidsoap 2.4.6, amd64, ffmpeg included.

| Check | Result |
| --- | --- |
| `GET /api/health`, `/api/now` | Answer in 40 ms; `/now` carries the FIP title, artist, artwork and studio times from the NAS metadata service |
| `POST /api/queue` without a URI | 400 `{"error":"uri required"}` |
| `POST /api/queue` with a URL, `POST /api/skip` | 201 with the queue length; skip 200 |
| `/house.mp3` on the "Living" zone (`%mp3(bitrate=192)`) | **PLAYING within 4 s** |
| `/house.aac` (`%ffmpeg(format="adts", aac 192k)`) | TRANSITIONING at 4 s, PLAYING at 12 s |
| `/house.flac` (`%ogg(%flac)`) | still TRANSITIONING after 12 s; did not start |
| ICY metadata | `icy-metaint: 8192` offered to clients that ask; whether the Raumfeld app shows the title is not verified yet (needs eyes on the app while the mount plays) |
| CPU on the Celeron N3160 | 34 % of one core with three encoders, 20 % with MP3 alone (FIP AAC decode, normalize, two silence gates and one encoder) |
| RAM | about 170 MB |
| Latency | not measured by ear yet. Built in: 2 s `input.http` buffer plus the 64 KB `burst` a new listener receives at once, about 2.7 s at 192 kbit, plus whatever the speaker buffers for any stream. Knobs: `burst` and `buffer` on `output.harbor`, `buffer` on `input.http` |

Decision: MP3 192 kbit is the mount; the AAC and FLAC outputs stay in the script,
commented out.

## Things learned

- A live stream URL pushed to the queue never resolves (`request.queue` waits for the
  whole file, 29 s, then gives up). The queue is for files and finite media; another
  webradio would be a second `input.http` in the fallback list.
- The CORS middleware adds `Access-Control-Allow-Origin: *` to answers but did not answer
  the `OPTIONS` preflight (404). Behind the same-origin proxy that never matters; for
  `bun dev` on another origin an `OPTIONS` handler is needed for the `POST` routes.
- In 2.4 `insert_metadata` and `on_metadata` are methods on the source
  (`radio.insert_metadata([...])`, `radio.on_metadata(synchronous=false, f)`), and
  `json.parse` is the typed `let json.parse (x : {...}) = string` form.
- Wrapping the queue (`crossfade(queue)`) hides its `push`/`queue` methods, so the queue
  keeps its own name and the crossfaded source goes into the fallback.
- Liquidsoap logs that `output.harbor` "has not been updated in a long while" and suggests
  Icecast. It works; if it ever misbehaves, `output.icecast` into an Icecast container is
  the drop-in replacement.
- Putting the zone back on FIP needed the play command twice: the first left it in
  TRANSITIONING for over fifteen seconds. The app's rescan-and-retry path exists for that.
- The receivers' FIFOs must exist before the script starts; `cat` on a missing path exits
  and is not restarted (`restart_on_error=false`), which is the right behaviour.

## Next

Increment 1 of the plan: generic stations in FIPlay with a browser URL and a speaker URL,
then the `/radio/` proxy in `nas:https` so the phone plays the mount over HTTPS.
