# Primary demo: the everything reel — arrival, reply, reactions, then the
# photo chat with inline images and a real send.
# Runs `--demo` (the looping `full` scenario). Regenerate: vhs demo/hero.tape

Output public/demo/hero.mp4
Output public/demo/hero.webm

Set FontSize 20
Set Width 1600
Set Height 1000
Set Padding 0
Set Theme "Dracula"
Set Shell bash

Hide
Type `export XDG_CONFIG_HOME=$PWD/demo/xdg && beeptui --demo`
Enter
Sleep 4s
Show

# Ada's chat is open; the scripted cycle plays: an arrival (~3s in), a
# threaded reply, a reaction bump.
Sleep 3.5s
Screenshot public/demo/hero.png
Sleep 4s
Sleep 4s

# Over to the photo-heavy chat: thumbnails render inline, one more lands live.
Escape
Sleep 800ms
Type "j"
Sleep 1s
Enter
Sleep 3s

# And a real send.
Tab
Sleep 800ms
Type@45ms "what a day 🏔"
Sleep 600ms
Enter
Sleep 2s

Hide
Type "q"
