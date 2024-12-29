import Backend from './Backend'
export default class ZoneBackEnd extends Backend {
    constructor(backendURL) {
        super(backendURL, 'zone');
    }

    async getVolume(udn) {
        return await super.getVolume(udn) / 100;
    }

    async setVolume(udn, volume) {
        await super.setVolume(udn, Math.round(volume * 100));
    }
}