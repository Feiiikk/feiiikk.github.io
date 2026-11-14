"""Run after editing any app files and before publishing."""
from pathlib import Path
import hashlib
root = Path(__file__).resolve().parent
files = ['index.html','config.js','pwa.js','manifest.webmanifest','vendor/chart.umd.js','vendor/supabase.js','icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png']
digest = hashlib.sha256()
for name in files:
    digest.update(name.encode()); digest.update((root/name).read_bytes())
version = digest.hexdigest()[:16]
(root/'sw.js').write_text((root/'sw-template.txt').read_text().replace('__VERSION__',version))
print('PWA version:', version)
