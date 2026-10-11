**open source game launcher**
_By Batcoif_

Why use BLauncher?
- it tracks playtime for anygame
- it will soon have an accessible store
- loads 3x faster than steam
- incredibly lite

current version: V0.4
In development: V0.5SW
Planned release: 9/10/2026

**Installation instructions**
1 - choose your desired version
2 - run EXE
3 - _(0.5+ only)_ install guide Json from here or www.isaacspoons.wordpress.com

**DISCLAIMER**
SOME ai has been used in this project, but alot is handmade.


Writing guide files

A guide file is a plain text file saved as .json or .txt, with one entry per line. It doesn’t need to be valid JSON.

Layout
V0.3 Batcoif
Portal 2-https://example.com/portal2-true-false-PG
Some Game-www.example.com/dl-false-true-R18
Plain Game-https://example.com/plain-true-false
soon
Hollow Knight 2-A big sequel is on the way-true
Spicy Title-Description goes here-false-R18
Line 1 is the version, shown under “Replace guide file”. It can be any text, up to 40 characters.
Available games come next, one per line.
A line that says only soon starts the coming-soon section. Every line after it is a coming-soon title.
Available games

Name-link-laptop ready-Batcoif exclusive-rating

Field	Values
Name	Any text. Dashes are fine.
Link	Must start with https://, http:// or www.
Laptop ready	true or false
Batcoif exclusive	true or false
Rating	Optional. Defaults to PG.
Coming soon

Name-description-Batcoif exclusive-rating

The rating is optional and defaults to PG.
Names can’t contain dashes here. The name is everything before the first dash. The description can contain dashes.
Titles keep the order you write them, so put what’s coming next first.
Ratings
Use any short code, like G, PG, M or R18.
R18, R18+, 18 and 18+ count as adult. Those titles are hidden until the user unlocks 18+ content in Settings.
Available games are sorted A to Z automatically, so their order in the file doesn’t matter.
Good to know
true and false are not case-sensitive.
Blank lines are ignored. Lines starting with // or # are comments.
A line the app can’t read is skipped, and the app shows how many were skipped when the file loads.
Users need to load the file again with “Replace guide file” to see updates.
A guide file with no version line still works, as long as the first line is a game.
