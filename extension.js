// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {MAX_NOTE_LENGTH, NoteStore} from './noteStore.js';

const SAVE_DELAY_MS = 500;

export default class NoteDockExtension extends Extension {
    enable() {
        this._destroyed = false;
        this._saveSourceId = 0;
        this._focusSourceId = 0;
        this._saveGeneration = 0;
        this._saveQueue = Promise.resolve();
        this._loading = true;
        this._store = new NoteStore();
        this._cancellable = new Gio.Cancellable();

        this._buildIndicator();
        this._loadNote();
    }

    disable() {
        this._destroyed = true;

        if (this._saveSourceId) {
            GLib.source_remove(this._saveSourceId);
            this._saveSourceId = 0;
        }

        if (this._focusSourceId) {
            GLib.source_remove(this._focusSourceId);
            this._focusSourceId = 0;
        }

        this._cancellable?.cancel();
        this._cancellable = null;

        this._indicator?.destroy();
        this._indicator = null;
        this._editor = null;
        this._statusLabel = null;
        this._countLabel = null;
        this._noteDot = null;
        this._store = null;
        this._saveQueue = null;
    }

    _buildIndicator() {
        this._indicator = new PanelMenu.Button(
            0.0,
            this.metadata.name,
            false
        );

        const panelBox = new St.BoxLayout({
            style_class: 'panel-status-menu-box',
        });

        panelBox.add_child(new St.Icon({
            icon_name: 'document-edit-symbolic',
            style_class: 'system-status-icon',
        }));

        this._noteDot = new St.Label({
            text: '•',
            style_class: 'notedock-panel-dot',
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });
        panelBox.add_child(this._noteDot);

        this._indicator.add_child(panelBox);
        this._indicator.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._focusEditor();
        });

        Main.panel.addToStatusArea(this.uuid, this._indicator);

        const menuItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });

        const root = new St.BoxLayout({
            vertical: true,
            style_class: 'notedock-root',
        });
        menuItem.add_child(root);

        const header = new St.BoxLayout({
            style_class: 'notedock-header',
            x_expand: true,
        });

        header.add_child(new St.Label({
            text: 'NoteDock',
            style_class: 'notedock-title',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        }));

        this._countLabel = new St.Label({
            text: `0 / ${MAX_NOTE_LENGTH}`,
            style_class: 'notedock-count',
            y_align: Clutter.ActorAlign.CENTER,
        });
        header.add_child(this._countLabel);
        root.add_child(header);

        this._editor = new St.Entry({
            hint_text: 'Write a quick note…',
            style_class: 'notedock-editor',
            can_focus: true,
            track_hover: true,
            x_expand: true,
        });

        const clutterText = this._editor.clutter_text;
        clutterText.set_single_line_mode(false);
        clutterText.set_line_wrap(true);
        clutterText.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        clutterText.set_activatable(false);
        clutterText.set_selectable(true);
        clutterText.set_max_length(MAX_NOTE_LENGTH);
        clutterText.connect('text-changed', () => this._onTextChanged());

        root.add_child(this._editor);

        const footer = new St.BoxLayout({
            style_class: 'notedock-footer',
            x_expand: true,
        });

        this._statusLabel = new St.Label({
            text: 'Loading…',
            style_class: 'notedock-status',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        footer.add_child(this._statusLabel);

        const copyButton = this._createButton(
            'Copy',
            'edit-copy-symbolic',
            () => this._copyNote()
        );
        footer.add_child(copyButton);

        const pasteButton = this._createButton(
            'Paste',
            'edit-paste-symbolic',
            () => this._pasteNote()
        );
        footer.add_child(pasteButton);

        const clearButton = this._createButton(
            'Clear',
            'edit-clear-all-symbolic',
            () => this._clearNote()
        );
        footer.add_child(clearButton);

        root.add_child(footer);
        this._indicator.menu.addMenuItem(menuItem);
    }

    _createButton(label, iconName, callback) {
        const button = new St.Button({
            style_class: 'notedock-button',
            can_focus: true,
            reactive: true,
            track_hover: true,
            accessible_name: label,
        });

        const content = new St.BoxLayout({
            style_class: 'notedock-button-content',
        });
        content.add_child(new St.Icon({
            icon_name: iconName,
            icon_size: 16,
        }));
        content.add_child(new St.Label({
            text: label,
            y_align: Clutter.ActorAlign.CENTER,
        }));
        button.set_child(content);
        button.connect('clicked', callback);

        return button;
    }

    async _loadNote() {
        try {
            const note = await this._store.load(this._cancellable);
            if (this._destroyed)
                return;

            this._editor.set_text(note);
            this._statusLabel.set_text(note ? 'Saved locally' : 'Empty note');
        } catch (error) {
            if (this._destroyed || error.matches?.(
                Gio.io_error_quark(),
                Gio.IOErrorEnum.CANCELLED
            )) {
                return;
            }

            console.error(`NoteDock: failed to load note: ${error.message}`);
            this._statusLabel.set_text('Could not load note');
            this._statusLabel.add_style_class_name('notedock-status-error');
        } finally {
            this._loading = false;
            this._updateUi();
        }
    }

    _onTextChanged() {
        this._updateUi();

        if (this._loading || this._destroyed)
            return;

        this._statusLabel.remove_style_class_name('notedock-status-error');
        this._statusLabel.set_text('Unsaved changes');
        this._scheduleSave();
    }

    _scheduleSave() {
        if (this._saveSourceId)
            GLib.source_remove(this._saveSourceId);

        this._saveSourceId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            SAVE_DELAY_MS,
            () => {
                this._saveSourceId = 0;
                this._saveCurrentNote();
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _saveCurrentNote() {
        if (this._destroyed)
            return;

        const generation = ++this._saveGeneration;
        const note = this._editor.get_text();
        this._statusLabel.set_text('Saving…');

        this._saveQueue = this._saveQueue.then(async () => {
            if (this._destroyed)
                return;

            try {
                await this._store.save(note, this._cancellable);
                if (this._destroyed || generation !== this._saveGeneration)
                    return;

                this._statusLabel.remove_style_class_name(
                    'notedock-status-error'
                );
                this._statusLabel.set_text(
                    note ? 'Saved locally' : 'Empty note'
                );
            } catch (error) {
                if (this._destroyed || error.matches?.(
                    Gio.io_error_quark(),
                    Gio.IOErrorEnum.CANCELLED
                )) {
                    return;
                }

                console.error(
                    `NoteDock: failed to save note: ${error.message}`
                );
                this._statusLabel.set_text('Could not save note');
                this._statusLabel.add_style_class_name(
                    'notedock-status-error'
                );
            }
        });
    }

    _copyNote() {
        const note = this._editor.get_text();
        if (!note) {
            this._statusLabel.set_text('Nothing to copy');
            return;
        }

        St.Clipboard.get_default().set_text(
            St.ClipboardType.CLIPBOARD,
            note
        );
        this._statusLabel.set_text('Copied to clipboard');
    }

    _clearNote() {
        if (!this._editor.get_text()) {
            this._statusLabel.set_text('Note is already empty');
            return;
        }

        this._editor.set_text('');
        this._focusEditor();
    }

    _focusEditor() {
        if (this._focusSourceId)
            GLib.source_remove(this._focusSourceId);

        this._focusSourceId = GLib.idle_add(
            GLib.PRIORITY_DEFAULT_IDLE,
            () => {
                this._focusSourceId = 0;

                if (this._destroyed || !this._editor)
                    return GLib.SOURCE_REMOVE;

                this._editor.grab_key_focus();
                const text = this._editor.get_text();
                this._editor.clutter_text.set_cursor_position(text.length);
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _updateUi() {
        if (!this._editor)
            return;

        const note = this._editor.get_text();
        this._countLabel.set_text(`${note.length} / ${MAX_NOTE_LENGTH}`);
        this._noteDot.visible = note.trim().length > 0;
    }
}
