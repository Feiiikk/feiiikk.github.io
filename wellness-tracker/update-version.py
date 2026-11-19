"""Run after editing any app files and before publishing."""
from pathlib import Path
import hashlib
root = Path(__file__).resolve().parent
files = ['index.html','config.js','pwa.js','session-import.js','manifest.webmanifest','vendor/chart.umd.js','vendor/supabase.js','icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png']
files += [str(f.relative_to(root)) for f in sorted((root/'vendor/ocr').rglob('*')) if f.is_file()]
files += ['sw-template.txt']
digest = hashlib.sha256()
for name in files:
    digest.update(name.encode()); digest.update((root/name).read_bytes())
version = digest.hexdigest()[:16]
(root/'sw.js').write_text((root/'sw-template.txt').read_text().replace('__VERSION__',version))
print('PWA version:', version)
