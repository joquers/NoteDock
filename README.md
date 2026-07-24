# NoteDock

NoteDock is a lightweight GNOME Shell extension that keeps one private,multiline note directly in the top panel.

## Features

· Native GNOME Shell panel popup  
· One multiline note  
· Automatic local saving after typing stops  
· Copy the full note to the clipboard  
· Clear the note  
· Character counter  
· Small panel dot when the note contains text  
· No telemetry, account, cloud service, GTK window, or WebKit dependency  

The note is stored locally at:  

~/.local/share/notedock/note.txt  

## Requirements  

GNOME Shell 50  

Only Shell versions that have been tested should be added to metadata.json  

Install for development

chmod +x install.sh  
./install.sh  
gnome-extensions enable notedock@joquers.github.io  

On GNOME 50, use a nested development session:

dbus-run-session gnome-shell --devkit --wayland

View Shell errors with:

journalctl -f -o cat /usr/bin/gnome-shell

## Future Features

· Optional keyboard shortcut
· Confirm before clearing
· Configurable panel position
· Optional Markdown preview
· Export/import

## Support NoteDock

If NoteDock is useful to you, you can support its development with a Bitcoin donation:

Donate with Bitcoin

bc1qmwgj2v7q3jzdtyfskqttephcdszc4qffluu42m

## License

Copyright © 2026 Oswaldo J. Silva. NoteDock is licensed under GPL-3.0-or-later. See LICENSE
