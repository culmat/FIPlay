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
    async list() {
        try {
            const response = await fetch(this.listPathURL);
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
                await fetch(this.backendURLroot + 'update');
                console.debug('Backend rescan finished');
            } catch (error) {
                console.error('Error :', error);
                throw error;
            }
        }
        return this;
    }
    async getVolume(udn) {
        try {
            const response = await fetch(this.backendURL + udn + '/volume');
            return (await response.json()).data;
        } catch (error) {
            console.error('Error getting volume:', error);
            throw error;
        }
    }
    async setVolume(udn, volume) {
        try {
            const response = await fetch(this.backendURL + udn + '/volume/' + volume);
            return (await response.json()).data;
        } catch (error) {
            console.error('Error setting volume:', error);
            throw error;
        }
    }

    async playURL(udn, url) {
        try {
            if (url == null && this.url == null) {
                throw new Error('URL is null');
            }
            url = url || this.url;
            this.url = url;
            const response = await fetch(this.backendURL + udn + '/play/' + url);
            return (await response.json()).data;
        } catch (error) {
            console.error('Error playing:', error);
            throw error;
        }
    }

    async play(udn) {
        try {
            const response = await fetch(this.backendURL + udn + '/play');
            return (await response.json()).data;
        } catch (error) {
            console.error('Error playing:', error);
            throw error;
        }
    }

    async pause(udn) {
        try {
            const response = await fetch(this.backendURL + udn + '/pause');
            return (await response.json()).data;
        } catch (error) {
            console.error('Error pausing:', error);
            throw error;
        }
    }

    async stop(udn) {
        try {
            const response = await fetch(this.backendURL + udn + '/stop');
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
    async currentURL(udn) {
        try {
            const response = await fetch(this.backendURL + udn + '/media_info');
            if (!response.ok) return null;
            const info = (await response.json()).data;
            return (info && info[0] && info[0].CurrentURI) || null;
        } catch (error) {
            console.debug('Could not read what is playing:', error);
            return null;
        }
    }

    /** 'PLAYING', 'PAUSED_PLAYBACK', 'STOPPED', or null when unavailable. */
    async transportState(udn) {
        try {
            const response = await fetch(this.backendURL + udn + '/transport_info');
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