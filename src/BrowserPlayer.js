import { net } from './net';

export default class BrowserPlayer {
    /** onError is told when a stream that was playing dies, e.g. the WLAN dropped. */
    constructor({ onError } = {}) {
        this.audio = new Audio();
        if (onError) this.audio.addEventListener('error', () => onError(this.audio.error));
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
        return this.play();
    }

    /** Resolves once playing; rejects when it cannot, so the caller can say so. */
    play() {
        if (!this.audio.paused) {
            return Promise.resolve();
        }
        // A live stream has nothing to play from without a network; do not
        // leave the element trying, and do not leave the button saying so.
        if (!net.online) return Promise.reject(new Error('No connection'));
        return this.audio.play().catch(error => {
            // Switching an output off while its stream is still opening rejects
            // the play that is now obsolete. That is the outcome we asked for,
            // not a failure worth shouting about.
            if (error.name === 'AbortError') return;
            throw error;
        });
    }

    pause() {
        this.audio.pause();
    }

}