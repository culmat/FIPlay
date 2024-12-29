import Backend from './Backend'
export default class RoomBackEnd extends Backend {
    constructor(backendURL) {
        super(backendURL, 'room');
        this.volume = -1;
    }

    async getVolume(udn) {
        if (this.volume < 0) {
            super.setVolume(udn, '-100');
            this.volume = 0;
            await this.setVolume(udn, 40);
        }
        return this.volume;
    }

    async setVolume(udn, volume) {
        const diff = Math.abs(this.volume - volume);
        const sign = this.volume < volume ? '+' : '-';
        await super.setVolume(udn, sign + diff);
        this.volume = volume;
    }

    async play(udn) {
        await super.playURL(udn);
        await super.play(udn);
    }

    async pause(udn) {
        await super.stop(udn);
    }


}