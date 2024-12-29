export default class BrowserPlayer {
    constructor() {
        this.audio = new Audio();
    }
    setVolume(volume) {
        this.audio.volume = volume / 100;
    }

    playURL(url) {
        if (this.audio.src == url) {
            return;
        }
        this.audio.src = url;
        this.play();
    }

    play() {
        if (!this.audio.paused) {
            return;
        }
        this.audio.play().catch(error => {
            console.error('Error playing audio:', error);
        });
    }

    pause() {
        this.audio.pause();
    }

}