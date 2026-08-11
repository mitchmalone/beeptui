# Feature: inline images — a photo-heavy chat as half-block thumbnails,
# one arriving live, and Open attachment in the ⏎ menu.
# Runs `--demo images` (opens the photo chat). Regenerate: vhs demo/images.tape

Output public/demo/images.mp4
Output public/demo/images.webm

Set FontSize 20
Set Width 1600
Set Height 1000
Set Padding 0
Set Theme "Dracula"
Set Shell bash

Hide
Type `export XDG_CONFIG_HOME=$PWD/demo/xdg && beeptui --demo images`
Enter
Sleep 4s
Show

# Thumbnails fill in; a new photo lands mid-clip.
Sleep 3s
Type "k"
Sleep 900ms
Type "k"
Sleep 900ms
Type "j"
Sleep 900ms
Type "j"
Sleep 1.2s

# The ⏎ menu on an image message offers Open attachment.
Enter
Sleep 2.2s
Escape
Sleep 1.2s

Hide
Type "q"
