export default class BackendPlayer {
    constructor(backend, udn) {
        this.backend = backend;
        this.udn = udn;
    }
    setVolume(volume) {
        return this.backend.setVolume(this.udn, volume);
    }

    async playURL(url) {
        await this.backend.playURL(this.udn, url);
        await this.play();
    }

    play() {
        return this.backend.play(this.udn);
    }

    pause() {
        return this.backend.pause(this.udn);
    }

}