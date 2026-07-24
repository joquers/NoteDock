// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Gio._promisify(
    Gio.File.prototype,
    'load_contents_async',
    'load_contents_finish'
);

Gio._promisify(
    Gio.File.prototype,
    'replace_contents_bytes_async',
    'replace_contents_finish'
);

export const MAX_NOTE_LENGTH = 4000;

export class NoteStore {
    constructor() {
        this._directoryPath = GLib.build_filenamev([
            GLib.get_user_data_dir(),
            'notedock',
        ]);

        this._file = Gio.File.new_for_path(GLib.build_filenamev([
            this._directoryPath,
            'note.txt',
        ]));
    }

    get path() {
        return this._file.get_path();
    }

    async load(cancellable = null) {
        try {
            const [contents] = await this._file.load_contents_async(cancellable);
            return new TextDecoder('utf-8')
                .decode(contents)
                .slice(0, MAX_NOTE_LENGTH);
        } catch (error) {
            if (error.matches?.(
                Gio.io_error_quark(),
                Gio.IOErrorEnum.NOT_FOUND
            )) {
                return '';
            }

            throw error;
        }
    }

    async save(note, cancellable = null) {
        if (typeof note !== 'string')
            throw new TypeError('QuickNote content must be a string');

        const result = GLib.mkdir_with_parents(this._directoryPath, 0o700);
        if (result !== 0)
            throw new Error('Could not create the QuickNote data directory');

        const normalized = note.slice(0, MAX_NOTE_LENGTH);
        const bytes = new GLib.Bytes(
            new TextEncoder().encode(normalized)
        );

        await this._file.replace_contents_bytes_async(
            bytes,
            null,
            true,
            Gio.FileCreateFlags.PRIVATE |
                Gio.FileCreateFlags.REPLACE_DESTINATION,
            cancellable
        );
    }
}
