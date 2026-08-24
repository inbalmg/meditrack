# MediTrack Clinic — logo 4a

Files
- meditrack-mark.svg — the mark alone (200x200, works on any background)
- meditrack-logo-on-dark.svg — mark + wordmark for dark backgrounds
- meditrack-logo-on-light.svg — mark + wordmark for light backgrounds
- MediTrackLogo.jsx — React components: <MediTrackMark size /> and <MediTrackLogo size tone="dark|light" />

Colors
- gradient: #5FE3D1 -> #0D8FA2
- accent (CLINIC): #2DD4BF on dark, #0F9488 on light
- wordmark: #FFFFFF on dark, #0B2A2B on light

Type
- Poppins 600 for "MediTrack", Poppins 500 + 0.4em tracking for "CLINIC"

Notes
- The cross, the header line and the binder rings are negative space (mask), so the
  mark is transparent where it reads as white. Never place it on a busy photo.
- Minimum size 24px. Below that use the mark without the header line.
- The .svg files embed the wordmark as <text> and need Poppins installed/loaded.
  For a font-independent asset, convert the text to outlines or use the JSX version.
