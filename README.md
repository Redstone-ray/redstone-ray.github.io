# richardding — personal site

The portfolio of Richard Ding: mechatronics, fluids, rockets, and a few toys.

It is a static site: plain HTML, CSS and JavaScript, with no build step, no
framework and no npm packages. What is in this folder is exactly what gets
served. It works from GitHub Pages, any static host, or a local web server.

## What's where

```
index.html              the page: header, hero, work, about, toys, cv, footer, project view
404.html                "pushed out of the ring" page (root-absolute links, see below)
assets/
  css/site.css          all styles; design tokens live at the top in :root
  js/data.js            ALL content: text, projects, CV, links  ← edit this
  js/site.js            renders the page from data.js, grid, project view,
                        routing, theme toggle, clock; mounts the toys
  js/fx/                the interactive toys, one file each:
    fingering.js          hero: grow a fluid flower (viscous fingering)
    rocket.js             "Hit the apogee" airbrake game
    plunger.js            "Beat the plunger" reaction game
    sumo.js               "Stay in the ring" (also on 404.html)
    goose.js              the goose
    scent.js              the Aroma LCD in the footer (changes the accent colour)
    thermal.js            thermal-camera mode on the portrait
  media/<project>/      images (*.webp + 720px *-sm.webp), videos (*.mp4 + *-poster.webp),
                        illustrations (concept-*.svg, animated ones with a *-still.svg twin)
  favicon.svg
  og.jpg                social preview image (1200×630), referenced from index.html
.nojekyll               tells GitHub Pages not to run Jekyll
CNAME.example           rename to CNAME to use a custom domain
```

Each toy is optional. If one fails to load or throws, `site.js` logs a warning
and the rest of the page carries on.

## Editing content

Almost everything is in **`assets/js/data.js`**. You shouldn't need to touch the HTML for routine updates.

- **Hero, about text, facts, degree dates, CV, links**: edit `window.SITE`.
  Words wrapped in `<em>` in the hero headline become accent-coloured italics.
- **Projects**: edit `window.PROJECTS`. Each project has a `slug` (used in the
  URL, e.g. `#/work/liquafilm`), a one-sentence `caption` for its tile, a
  `cover`, and a `gallery`. Gallery items can be an `image`, a `video`, or a
  `compare` (a before/after slider). Set `wide: true` to make an image span
  the full width. Set `hidden: true` to hide a project without deleting it.
- **Grid order**: edit `window.LAYOUT`. Each inner array is one row on desktop.
  Tiles in a row share a height, and their widths follow each cover's `aspect`.
  Projects not listed in LAYOUT are appended at the end, three per row.
- **Animated SVG covers**: give the cover a `still` (a frozen copy). Visitors who
  prefer reduced motion, or who press **pause motion**, get the still instead.
- **Media from elsewhere**: `src` can be a full `https://` URL instead of a path
  under `assets/media/`. Such images get no `-sm` twin.
- **Publications**: set `cv.publications.show` to `true` once they're public.

`index.html` also holds static copies of the hero and about text. They're there
for search engines and for visitors without JavaScript, and `site.js`
overwrites them from `data.js` on load. If you change those words in
`data.js`, update the copies too. The same goes for the `<noscript>` project
list and the meta description.

### Adding images

- Export a `.webp` (up to about 1600 px wide), plus a 720 px wide twin named
  `<name>-sm.webp` in the same folder. Tiles pick between the two automatically.
  If a `-sm` is missing the page falls back to the full image, but it logs a
  404 first, so either add the twin or put the folder in `NO_SMALL` at the top
  of `site.js`.
- Videos: H.264 `.mp4`, muted and short, plus a `-poster.webp` for the first frame.
  They autoplay only while on screen, and never for visitors who prefer reduced motion.
- Illustrations: `.svg` drawn on the site's paper colour (`#f4f2ee`), with `width` and
  `height` on the root `<svg>` so the page knows their shape. They are shown at any
  size on a plate of the same paper, so they read as one sheet. The labelled diagrams
  carry larger phone labels inside the file (an `@media` rule, which inside an image
  sees the image's own width). A very wide diagram can also have a tall twin for
  phones: set `srcNarrow` and `aspectNarrow` on its gallery entry (the plunger
  timeline does).
- In a project's gallery, images are shown at up to 1.25× their own size. A small
  image gets a smaller figure (caption included) rather than being stretched.

## Unpublished work: illustrations, not lab media

The Harvard projects (viscous fingering and Liquafilm, Aizenberg Lab) and the Cornell
plunger (Thorne Lab) are unpublished. Their pages show **no** lab photos, videos,
renders or data. Everything there was made for this site instead: vector illustrations
(`concept-*.svg`) and frames and video from the site's own fluid simulation
(`blooms/sim-*`, made with `js/fx/fingering.js`, the same code as the hero). The
captions and project text say so. Keep it that way until the work is published, and
check with the lab before adding anything real.

The ball-joint page uses Musashi Americas' own Suspension Sense™ figures from their
[announcement](https://musashiamericas.com/2026/01/12/introducing-suspension-sense-technology/),
credited in each caption. They are **hotlinked**: the page loads them straight from
`musashiamericas.com`. If you'd rather not depend on their server (or they ask you not
to), save copies into `assets/media/musashi/` (a `.webp` plus a 720 px `-sm.webp`
each) and switch the five URLs in `data.js` to those paths.

## Previewing locally

Use a local server rather than opening the file directly, so video and the
project routes behave the way they will in production:

```sh
cd "personal site"
python3 -m http.server 8000
# then open http://localhost:8000
```

To test the 404 page, open `http://localhost:8000/404.html`. Python's server
doesn't serve it automatically for missing paths, but GitHub Pages does.

## Deploying to GitHub Pages

The site is meant for the user-site repository **`Redstone-ray/redstone-ray.github.io`**,
which GitHub serves at `https://redstone-ray.github.io/`. That repository currently
holds an older site: it is a fork of `amphineko/reactiveneko`, its default branch is
`master`, and that branch has a `CNAME` (richardding.ca) and a `.env` file.

1. **Recommended: start a clean repository.** On GitHub, rename or delete the old
   fork, then create a new **public** repository (not a fork) named
   `redstone-ray.github.io`. Leave it empty (no README, licence or .gitignore).
2. Push this folder to it (`git init` is already done here):

   ```sh
   git remote add origin https://github.com/Redstone-ray/redstone-ray.github.io.git
   git add .
   git commit -m "Personal site"
   git push -u origin main
   ```

3. On GitHub, go to **Settings → Pages → Build and deployment**. Choose
   **Deploy from a branch**, then branch **`main`**, folder **`/ (root)`**, and save.
   After a minute or two the site is live at `https://redstone-ray.github.io/`.
4. **If you keep the old fork instead:** delete every old file, including `CNAME`,
   `.env`, `_next/` and `.well-known/`, before pushing this folder to `main`. Then make
   `main` the default branch and delete the `master` and `site-two` branches. Treat
   anything that was ever in `.env` as public, and rotate it if it was a secret.

Deploy with `git push` only. Never upload this folder's `.git` directory to a static
host (FTP, rsync, drag-and-drop): it can hold old, unreachable copies of files that
were removed from the site. If you ever do upload by hand, first run
`git reflog expire --expire-unreachable=now --all && git gc --prune=now`.

`404.html` uses root-absolute paths (`/assets/...`) because GitHub Pages
serves it for every missing URL at any depth. That only works when the site is
at the root of a domain, which is true for both the user site and a custom domain.

## Custom domain: richardding.ca (optional)

`richardding.ca` currently uses Bluehost's nameservers (`ns1.bluehost.com`,
`ns2.bluehost.com`) and points at a Bluehost server (`A 66.235.200.147`). Move the
DNS first, and add the `CNAME` file only after that.

1. Manage the DNS at Bluehost (**Domains → DNS**), or move the nameservers to
   Cloudflare first and do the same steps there.
2. Delete the existing `@` A record (`66.235.200.147`), any `@` AAAA records, and the
   `www` CNAME that points to `richardding.ca`. Keep any MX and TXT records if you
   use email on the domain.
3. Add these records:

   | Type  | Name | Content                 |
   |-------|------|-------------------------|
   | A     | @    | 185.199.108.153         |
   | A     | @    | 185.199.109.153         |
   | A     | @    | 185.199.110.153         |
   | A     | @    | 185.199.111.153         |
   | AAAA  | @    | 2606:50c0:8000::153     |
   | AAAA  | @    | 2606:50c0:8001::153     |
   | AAAA  | @    | 2606:50c0:8002::153     |
   | AAAA  | @    | 2606:50c0:8003::153     |
   | CNAME | www  | redstone-ray.github.io  |

4. Turn off Bluehost's CDN for the domain, so these records are answered as-is.
5. In your GitHub **account** settings, under **Pages → Verified domains**, verify
   `richardding.ca`. This stops anyone else's repository from claiming it.
6. Rename `CNAME.example` to `CNAME` (it contains `richardding.ca`), commit and push.
   Then in the repository's **Settings → Pages → Custom domain**, check that it shows
   `richardding.ca`. Once the DNS check passes and the certificate is issued
   (anywhere from minutes to about a day), tick **Enforce HTTPS**.
7. Update the absolute URLs in `index.html` (the canonical link, `og:url`,
   `og:image`, `twitter:image` and the JSON-LD `url`) from `redstone-ray.github.io`
   to `richardding.ca`.

If you use Cloudflare, staying **DNS only** (grey cloud) is recommended. If you turn
the proxy on later, set SSL/TLS to **Full (strict)**.

## Before you publish: checklist

- [ ] Confirm every lab and employer is happy with what's shown: the descriptions of the
      unpublished Aizenberg Lab work (and Raphael Kay for Liquafilm) and the Thorne Lab
      plunger, the compression-sleeve photos (Waterloo Microfluidics Lab), and Musashi's
      hotlinked Suspension Sense images.
- [ ] Check every fact in `data.js`: titles, dates, award years, "Research Fellow".
- [ ] Make sure there's no phone number or home address anywhere, including image EXIF.
- [ ] Check the links: GitHub, LinkedIn, the lab profile, the SEAS article.
- [ ] If you move to the custom domain, update the canonical link and the meta tags.
- [ ] Open the site on a phone. Try the toys and the project pages, then
      press Back to make sure it closes a project.
- [ ] Turn on "reduce motion" in your OS and reload. Nothing should autoplay.
- [ ] Try both themes (the **fill / drain** switch in the header) and the
      **pause motion** switch in the hero.

## Notes

- **No tracking.** The only outside requests are Google Fonts and Musashi's image
  server (for the ball-joint tile and page, see above), which sees a visitor's IP
  address like any image host would.
- **Saved in the browser:** your theme choice (`rd-theme`), the motion switch
  (`rd-motion`), plus small conveniences from the toys, like best scores and the
  chosen scent. Nothing is sent anywhere.
- **Accessibility:** the page respects `prefers-reduced-motion`, and the
  **pause motion** switch (hero and footer) stops the blooms, videos and reel for
  everyone else. Every toy can be played from the keyboard. Project views trap
  focus, Esc closes them, and the browser's Back button closes them too.
