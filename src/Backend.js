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
                const response = await fetch(this.backendURLroot + 'update');
                console.log('Updated');
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
    prefix() {
        return '';
    }

}