import glob, os
from faster_whisper import WhisperModel
m = WhisperModel("medium", device="cpu", compute_type="int8")
for f in sorted(glob.glob("tools/raw/*.mp3")):
    segs, _ = m.transcribe(f, language="ar", beam_size=5, vad_filter=False)
    print("CLIP", os.path.basename(f), "|", " ".join(s.text.strip() for s in segs), flush=True)
