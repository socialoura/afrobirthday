# Bundled storefront fonts

DM Sans and Space Grotesk are bundled here so production builds do not fetch
Google Fonts CSS. Some valid Google responses use extensionless font URLs with
query parameters, which Next.js 16.1.6 cannot parse reliably.

Original, unmodified variable TrueType files from the Google Fonts repository:

- DM Sans: https://github.com/google/fonts/blob/main/ofl/dmsans/DMSans%5Bopsz%2Cwght%5D.ttf
- Space Grotesk: https://github.com/google/fonts/blob/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf

Both fonts are distributed under the SIL Open Font License 1.1; the respective
copyright notices and licenses are included alongside the files.

`RootDocument.tsx` keeps the existing CSS variables, normal style, swap display,
and the 400–700 weight range. Run `node scripts/check-fonts.mjs` to validate the
local font files and guard against reintroducing a build-time Google dependency.
