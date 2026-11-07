import { net, timeoutSignal } from './net';

// A backend that is out of reach would otherwise hold every request until the
// browser's own connect timeout, most of a minute on a phone. The first /zones
// after a cold start takes about 15 s, so leave room for that; a rescan
// (/update) walks the whole Raumfeld network and takes about 45.
const TIMEOUT_MS = 20000;
const RESCAN_TIMEOUT_MS = 60000;

/** The query that hands PyRaumfeld a stream's description, after the stream URL in the path. */
function describedBy(url, meta) {
    const params = new URLSearchParams(Object.entries(meta || {}).filter(([, v]) => v)).toString();
    return params ? (url.includes('?') ? '&' : '?') + params : '';
}

export default class Backend {
    constructor(backendURL, path) {
        this.backendURLroot = backendURL.endsWith('/') ? backendURL : backendURL + '/';
        if (path == 'room') {
            this.listPathURL = this.backendURLroot + 'unassignedRooms'
        } else if (path == 'zone') {
            this.listPathURL = this.backendURLroot + 'zones'
        } else {
            throw new Error('Invalid path. Expected room or zone but got ' + path);
        }
        this.backendURL = this.backendURLroot + path + '/';
    }
    request(url, timeoutMs = TIMEOUT_MS) {
        // Without any network there is nothing to wait for.
        if (!net.online) return Promise.reject(new Error('No connection'));
        return fetch(url, { signal: timeoutSignal(timeoutMs) });
    }
    async list() {
        try {
            const response = await this.request(this.listPathURL);
            return (await response.json()).data;
        } catch (error) {
            console.error('Error :', error);
            throw error;
        }
    }
    async update() {
        if (!Backend.updated) {
            Backend.updated = true;
            try {
                await this.request(this.backendURLroot + 'update', RESCAN_TIMEOUT_MS);
                console.debug('Backend rescan finished');
            } catch (error) {
                console.error('Error :', error);
                throw error;
            }
        }
        return this;
    }
    /**
     * Ask the backend to look for the speakers again, and give it a moment.
     *
     * Raumfeld devices restart their control service when their network
     * connection is renegotiated, and come back on a different port. The
     * backend then keeps a dead address until it rescans, and every command
     * fails with a 500. Unlike update(), this runs every time it is asked.
     */
    async rescan() {
        try {
            await this.request(this.backendURLroot + 'update', RESCAN_TIMEOUT_MS);
        } catch (error) {
            console.debug('Backend rescan request failed:', error);
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    async getVolume(udn) {
        try {
            const response = await this.request(this.backendURL + udn + '/volume');
            return (await response.json()).data;
        } catch (error) {
            console.error('Error getting volume:', error);
            throw error;
        }
    }
    async setVolume(udn, volume) {
        try {
            const response = await this.request(this.backendURL + udn + '/volume/' + volume);
            return (await response.json()).data;
        } catch (error) {
            console.error('Error setting volume:', error);
            throw error;
        }
    }

    /** `meta` ({ title, artist, album, art, id }) is what the Raumfeld app shows for the stream. */
    async playURL(udn, url, meta) {
        try {
            if (url == null && this.url == null) {
                throw new Error('URL is null');
            }
            if (url) this.meta = meta;
            url = url || this.url;
            this.url = url;
            const response = await this.request(this.backendURL + udn + '/play/' + url + describedBy(url, this.meta));
            return (await response.json()).data;
        } catch (error) {
            console.error('Error playing:', error);
            throw error;
        }
    }

    /**
     * Change what a zone shows for the stream it plays, without interrupting it.
     *
     * Zones only: PyRaumfeld offers it for zones, as Music Assistant uses it. A
     * PyRaumfeld without the route answers 404, and is then not asked again.
     */
    async bend(udn, url, meta) {
        if (this.cannotBend) return;
        const response = await this.request(this.backendURL + udn + '/bend/' + url + describedBy(url, meta));
        if (response.status === 404) {
            this.cannotBend = true;
            console.debug('This PyRaumfeld cannot change what a zone shows; it needs the bend route');
            return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }

    async play(udn) {
        try {
            const response = await this.request(this.backendURL + udn + '/play');
            return (await response.json()).data;
        } catch (error) {
            console.error('Error playing:', error);
            throw error;
        }
    }

    async pause(udn) {
        try {
            const response = await this.request(this.backendURL + udn + '/pause');
            return (await response.json()).data;
        } catch (error) {
            console.error('Error pausing:', error);
            throw error;
        }
    }

    async stop(udn) {
        try {
            const response = await this.request(this.backendURL + udn + '/stop');
            return (await response.json()).data;
        } catch (error) {
            console.error('Error pausing:', error);
            throw error;
        }
    }

    /**
     * What the renderer currently holds, or null when it cannot say.
     *
     * Only zones answer these; rooms have no such endpoint. Both are optional
     * for the app, so a failure is reported and swallowed rather than thrown.
     */
    /**
     * The stream a speaker holds, and the item id, title and album it is described
     * with, or nulls.
     */
    async currentMedia(udn) {
        const none = { url: null, id: null, title: null, album: null };
        try {
            const response = await this.request(this.backendURL + udn + '/media_info');
            if (!response.ok) return none;
            const info = (await response.json()).data?.[0];
            const meta = info?.CurrentURIMetaData;
            const doc = meta ? new DOMParser().parseFromString(meta, 'text/xml') : null;
            const text = (ns, tag) => doc?.getElementsByTagNameNS(ns, tag)[0]?.textContent || null;
            const item = doc?.getElementsByTagNameNS('urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/', 'item')[0];
            return {
                url: info?.CurrentURI || null,
                id: item?.getAttribute('id') || null,
                title: text('http://purl.org/dc/elements/1.1/', 'title'),
                album: text('urn:schemas-upnp-org:metadata-1-0/upnp/', 'album'),
            };
        } catch (error) {
            console.debug('Could not read what is playing:', error);
            return none;
        }
    }

    /** 'PLAYING', 'PAUSED_PLAYBACK', 'STOPPED', or null when unavailable. */
    async transportState(udn) {
        try {
            const response = await this.request(this.backendURL + udn + '/transport_info');
            if (!response.ok) return null;
            const state = (await response.json()).data;
            return (state && state[0]) || null;
        } catch (error) {
            console.debug('Could not read the transport state:', error);
            return null;
        }
    }

    prefix() {
        return '';
    }

}