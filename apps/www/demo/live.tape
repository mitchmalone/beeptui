# Feature: live arrivals — messages land while you read, scroll held.
# Runs `--demo live` (a looping scripted cycle). Regenerate: vhs demo/live.tape

Output public/demo/live.mp4
Output public/demo/live.webm

Set FontSize 20
Set Width 1600
Set Height 1000
Set Padding 0
Set Theme "Dracula"
Set Shell bash

Hide
Type `export XDG_CONFIG_HOME=$PWD/demo/xdg && beeptui --demo live`
Enter
Sleep 4s
Show

# Two scripted arrivals land (~3s apart); nothing flickers, nothing scrolls away.
Sleep 11s

Hide
Type "q"
