export default class BrowserPlayer {
    constructor() {
        this.audio = new Audio();
    }
    setVolume(volume) {
        this.audio.volume = volume / 100;
    }

    playURL(url) {
        // Only reassign for a different stream: setting src again drops the
        // connection and buffers from scratch. Play either way, because
        // returning early here left a paused player paused.
        if (this.audio.src !== url) {
            this.audio.src = url;
        }
        this.play();
    }

    play() {
        if (!this.audio.paused) {
            return;
        }
        this.audio.play().catch(error => {
            // Switching an output off while its stream is still opening rejects
            // the play that is now obsolete. That is the outcome we asked for,
            // not a failure worth shouting about.
            if (error.name === 'AbortError') return;
            console.error('Error playing audio:', error);
        });
    }

    pause() {
        this.audio.pause();
    }

}