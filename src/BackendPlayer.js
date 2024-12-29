export default class BackendPlayer {
    constructor(backend, udn) {
        this.backend = backend;
        this.udn = udn;
    }
    setVolume(volume) {
        this.backend.setVolume(this.udn, volume);
    }

    playURL(url) {
        this.backend.playURL(this.udn, url);
        this.play();
    }

    play() {
        this.backend.play(this.udn);
    }

    pause() {
        this.backend.pause(this.udn);
    }

}