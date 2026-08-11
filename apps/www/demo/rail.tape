# Feature: the network rail — one inbox, cycle network scope with ].
# Regenerate: vhs demo/rail.tape   (from the repo root)

Output public/demo/rail.mp4
Output public/demo/rail.webm

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

# All networks, then cycle the scope: WhatsApp → Slack → Telegram → Signal → All.
Sleep 2s
Type "]"
Sleep 1.6s
Type "]"
Sleep 1.6s
Type "]"
Sleep 1.6s
Type "]"
Sleep 1.6s
Type "]"
Sleep 2.5s

Hide
Type "q"
