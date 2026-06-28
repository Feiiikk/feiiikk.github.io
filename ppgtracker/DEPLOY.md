# Private hosting and sync

## 1. Create Supabase

Create a Supabase project, then run `supabase.sql` in its SQL editor. In Authentication, disable public sign-ups after creating your own account (or keep the SQL email allow-list policy and replace the email there).

Copy `config.example.js` to `config.js` and enter the project URL, publishable anon key, and your email. The anon key is safe in browser code; the row-level security policy is what protects the data. Never use a service-role key here.

## 2. Import existing data

Open the upgraded tracker, sign in, then use **Import** and select a backup exported by the old tracker. The import is validated before replacing your data and is synced after confirmation.

## 3. Publish

Upload this directory to a static host such as Cloudflare Pages, Netlify, Vercel, GitHub Pages, or Firebase Hosting. Ensure `config.js` is included.

For GitHub Pages, upload every file in this folder—including `manifest.webmanifest`, `sw.js`, and `icon.svg`. After publishing, set the exact hosted tracker URL as the Supabase **Site URL** and add it to **Redirect URLs**.

Only the allowed authenticated account can read or update the cloud state. For an additional gate in front of the HTML itself, configure Cloudflare Access for the site hostname and allow only your email address.

## Local and offline behavior

The app always keeps a local cached copy. Changes are usable offline and sync when the next successful cloud save occurs. Export periodic JSON backups even when cloud sync is enabled.

## Install on your devices

- iPhone/iPad: open the hosted tracker in Safari, tap **Share**, then **Add to Home Screen**.
- Android: open it in Chrome and choose **Install app** or **Add to Home screen**.
- Mac: use Safari's **Add to Dock** when available, or keep the tracker bookmarked.
