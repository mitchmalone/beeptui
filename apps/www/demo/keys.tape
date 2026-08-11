# Feature: everything is a keystroke — help overlay, fuzzy chat filter, message search.
# Regenerate: vhs demo/keys.tape   (from the repo root)

Output public/demo/keys.mp4
Output public/demo/keys.webm

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

# Help overlay.
Sleep 1.5s
Type "?"
Sleep 3s
Escape
Sleep 1s

# Fuzzy chat filter.
Type "/"
Sleep 800ms
Type@120ms "grace"
Sleep 2s
Escape
Sleep 800ms

# Message search (from the inbox, so the scope is all chats).
Escape
Sleep 800ms
Type "S"
Sleep 800ms
Type@120ms "launch"
Sleep 800ms
Enter
Sleep 2.5s
Escape
Sleep 1.5s

Hide
Type "q"
