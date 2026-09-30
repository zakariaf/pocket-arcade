Shared references for the check-parity fixtures (never a suite of their own).
probe-en / probe-fa: the research probe screen (a slice of Toybox Home: Lilita One, Rubik, Vazirmatn,
3 pt ink borders, radius 14, hard shadows) as an HTML replica, rendered with the parity Chrome flags.
lineSiege/light-en/s4-home: the committed Toybox reference of Home (light, English, Line Siege), in the
standard reference layout so run-parity.mjs can use this folder as --reference.
lineSiege/light-en/s10-statistics: the committed tall Statistics reference (full scroll height, banner at
the end of the page), used by the scrolled-capture fixtures (tall-*, bad-tall-*).
lineSiege/light-en/s11-settings: the committed tall Settings reference as re-rendered on 2026-09-30 (the footer's
version line without the mockup's old 6 px flex gap), used by the real S11 captures (good/s11-settings-*, bad-*).
lineSiege/light-en/s6-pause, s11-settings--no-music: the Pause base reference and the no-music Settings variant,
used by the board-mask fixtures (good/s6-pause-board-*, bad-board-*) and the reference-variant fixture.
