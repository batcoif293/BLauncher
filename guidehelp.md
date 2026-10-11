## Writing guide files

The Store reads its list of games from a **guide file**. A guide file is a plain text file (save it as `.json` or `.txt`) with one entry per line. It does **not** need to be valid JSON.

To use one, open **Store** in Batcoif Launcher and choose the file. It is saved, so you only need to load it again when it changes (use **Replace guide file**).

### Example

```
V0.3 Batcoif
Portal 2-https://example.com/portal2-true-false-PG
Some Game-www.example.com/download-false-true-R18
Plain Game-https://example.com/plain-true-false
soon
Hollow Knight 2-A big sequel is on the way-true
Spicy Title-Description goes here-false-R18
```

### File layout

1. **Line 1: version.** Any text up to 40 characters, such as `V0.3 Batcoif`. It is shown under the **Replace guide file** button and in **Settings**.
2. **Available games.** One game per line.
3. **`soon`.** A line containing only the word `soon` starts the coming-soon section. Every line after it is a coming-soon title.

### Available games

```
Name-link-laptop ready-Batcoif exclusive-rating
```

| Field | Values |
|---|---|
| Name | Any text. Dashes are allowed. |
| Link | Must start with `https://`, `http://` or `www.` |
| Laptop ready | `true` or `false` |
| Batcoif exclusive | `true` or `false` |
| Rating | Optional. Defaults to `PG`. |

The **Download** button opens the link in the user's default browser.

### Coming soon

```
Name-description-Batcoif exclusive-rating
```

- The rating is optional and defaults to `PG`.
- The name is everything before the first dash, so **names here can't contain dashes**. Descriptions can.
- Titles stay in the order you write them, so put what's coming next first.

### Ratings

- Use any short code, such as `G`, `PG`, `M` or `R18`.
- `R18`, `R18+`, `18` and `18+` count as adult. Adult titles are hidden until the user turns on **Unlock 18+ content** in **Settings**.
- Available games are sorted A to Z automatically (adult titles are grouped after the rest), so their order in the file doesn't matter.

### Tips

- `true` and `false` are not case-sensitive.
- Blank lines are ignored, and lines starting with `//` or `#` are comments.
- A line the launcher can't read is skipped. It tells you how many were skipped when the file loads.
- A guide with no version line still works, as long as its first line is a game.
