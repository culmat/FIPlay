#!/usr/bin/env liquidsoap
# The house radio: one continuous stream the speakers play, with everything
# else behind it. Priority, highest first: AirPlay, Spotify Connect, the
# request queue, then FIP as the fallback that never runs out.
#
# Proof-of-concept version: the receivers are not running yet, so their FIFOs
# stay silent and FIP plays. See radio/README.md for the measured results.

settings.log.level := 3
settings.log.stdout := true
settings.harbor.bind_addrs := ["0.0.0.0"]
settings.server.telnet := false

port = 8000
fip_url = environment.get("FIP_STREAM_URL", default="https://icecast.radiofrance.fr/fip-hifi.aac")
meta_base = environment.get("FIP_METADATA_URL", default="http://127.0.0.1:8082")
meta_url = "#{meta_base}/api/metadata/fip"

# --- what is playing, for /api/now ------------------------------------------
now_source = ref("fip")
now = ref({title = "", artist = "", artwork = "", start = 0., stop = 0.})

# --- sources, lowest priority first -----------------------------------------
fip = mksafe(input.http(id="fip", fip_url))

queue = request.queue(id="queue")
music = crossfade(queue)

# Live inputs: raw PCM the receivers write to a FIFO. Opening a FIFO blocks
# until a writer arrives, so `cat` simply waits; a session ending gives EOF
# and the process is restarted. `blank.strip` hides the input while nothing
# but silence flows, which is what hands playback back to the queue or FIP.
def live(name) =
  raw = input.external.rawaudio(id=name, channels=2, samplerate=44100, "cat /run/radio/#{name}")
  blank.strip(id="#{name}_gate", max_blank=3., min_noise=0.5, raw)
end
airplay = live("airplay")
spotify = live("spotify")

# A transition runs when the fallback switches child; that is how the API
# learns which source is on air. The audio passes through untouched.
def note(name) =
  fun (_, b) -> begin
    now_source := name
    log.important("on air: #{name}")
    b
  end
end
radio = fallback(id="radio", track_sensitive=false,
  transitions=[note("airplay"), note("spotify"), note("queue"), note("fip")],
  [airplay, spotify, music, fip])
radio = normalize(radio)

# --- now playing --------------------------------------------------------------
# Metadata from files and live inputs comes with the stream. FIP's comes from
# the metadata service below, which already sets `now` with the studio's
# times, so its own inserted metadata is not recorded a second time here.
def remember(m) =
  if m["house_source"] != "fip" and m["title"] != "" then
    dur = m["duration"]
    stop = if dur != "" then time() + float_of_string(default=0., dur) else 0. end
    now := {title = m["title"], artist = m["artist"], artwork = m["artwork"], start = time(), stop = stop}
  end
end
radio.on_metadata(synchronous=false, remember)

# While FIP is on air, ask the NAS metadata service what it plays and push the
# title into the stream as well, so a client that reads ICY metadata (the
# Raumfeld app, perhaps) can show it.
def poll_fip() =
  if now_source() == "fip" then
    try
      r = http.get(timeout=5., meta_url)
      let json.parse (j : {
        now: {
          firstLine: {title: string},
          secondLine: {title: string},
          visuals: {card: {src: string}},
          startTime: int?,
          endTime: int?
        }
      }) = r
      title = j.now.firstLine.title
      if title != "" and title != now().title then
        artist = j.now.secondLine.title
        artwork = j.now.visuals.card.src
        start = float_of_int(j.now.startTime ?? 0)
        stop = float_of_int(j.now.endTime ?? 0)
        now := {title = title, artist = artist, artwork = artwork, start = start, stop = stop}
        radio.insert_metadata([("house_source", "fip"), ("title", title), ("artist", artist), ("artwork", artwork)])
        log.important("fip: #{title} / #{artist}")
      end
    catch err do
      log.important("fip metadata: #{error.message(err)}")
    end
  end
end
thread.run(every=10., fast=false, poll_fip)

# --- JSON API -----------------------------------------------------------------
# CORS is for `bun dev` on another origin; behind the same-origin proxy it is idle.
harbor.http.middleware.register(harbor.http.middleware.cors(origin="*"))

def queue_items() =
  list.map(fun (r) -> begin
    m = request.metadata(r)
    {uri = request.uri(r), title = m["title"], artist = m["artist"]}
  end, queue.queue())
end

def now_json() =
  n = now()
  s = now_source()
  {source = s, live = (s == "airplay" or s == "spotify"),
   title = n.title, artist = n.artist, artwork = n.artwork,
   startTime = int_of_float(n.start), endTime = int_of_float(n.stop),
   queue = queue_items()}
end

harbor.http.register(port=port, method="GET", "/api/now", fun (_, res) -> res.json(now_json()))
harbor.http.register(port=port, method="GET", "/api/queue", fun (_, res) -> res.json({queue = queue_items()}))
harbor.http.register(port=port, method="GET", "/api/health", fun (_, res) ->
  res.json({ok = true, uptime = int_of_float(time.up()), source = now_source()}))

harbor.http.register(port=port, method="POST", "/api/queue", fun (req, res) -> begin
  uri =
    try
      let json.parse (body : {uri: string}) = req.body()
      body.uri
    catch _ do
      ""
    end
  if uri == "" then
    res.status_code(400)
    res.json({error = "uri required"})
  else
    queue.push.uri(uri)
    res.status_code(201)
    res.json({ok = true, length = queue.length()})
  end
end)

harbor.http.register(port=port, method="POST", "/api/skip", fun (_, res) -> begin
  if now_source() == "queue" then queue.skip() end
  res.json({ok = true})
end)

# --- outputs ------------------------------------------------------------------
# MP3 is what the speakers start within seconds (see radio/README.md). AAC
# started too but took ten; Ogg FLAC never did. Each encoder costs about a
# tenth of a core on the NAS, so only the one that is used runs.
output.harbor(id="house_mp3", port=port, mount="/house.mp3", %mp3(bitrate=192), radio)
# output.harbor(id="house_aac", port=port, mount="/house.aac",
#   %ffmpeg(format="adts", %audio(codec="aac", b="192k")), radio)
# output.harbor(id="house_flac", port=port, mount="/house.flac", %ogg(%flac), radio)
