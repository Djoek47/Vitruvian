# Planet Kosmos (display face)

The Faberland wordmark is set in **Planet Kosmos**. The app loads it from this folder when present:

* `planet-kosmos.woff2` (preferred), `planet-kosmos.woff`, `planet-kosmos.otf` or `planet-kosmos.ttf`

Font binaries are **git-ignored**: this repository is public, so committing a commercially licensed font would make it downloadable by anyone. Two ways to ship it:

1. **GitHub Pages:** add a repository secret `PLANET_KOSMOS_URL` pointing to a private download of the licensed `.woff2`. The Pages workflow fetches it at build time.
2. **Local / dev:** drop the file here.

Until it is present, Chakra Petch (OFL) is used with a synthetic slant. Check that your license covers **web embedding**, since a web app serves the font file to every visitor.
