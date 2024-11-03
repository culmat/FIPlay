let playingStation = null;

function play(url) {
    if (playingStation) {
        playingStation.pause();
    }
    playingStation = new Audio(url);
    playingStation.play();
}

function stop() {
    if (playingStation) {
        playingStation.pause();
        playingStation = null;
    }
}

export default {
    view: ({ attrs: { station, currentStation } }) => {
        return m('div', { class: 'column is-one-third' }, [
            m('div', { class: 'card' }, [
                m('div', { class: 'card-image' }, [
                    m('figure', { class: 'image is-4by3' }, [
                        m('img', { src: station.logo.src, alt: station.name })
                    ])
                ]),
                m('div', { class: 'card-content' }, [
                    m('p', { class: 'title is-4' }, station.name),
                    m('p', { class: 'subtitle is-6' }, station.live.now.firstLine),
                    m('button', {
                        class: 'button is-primary',
                        onclick: () => {
                            if (currentStation === station) {
                                stop();
                                currentStation = null;
                            } else {
                                play(station.streams.live[0].url);
                                currentStation = station;
                            }
                        }
                    }, currentStation === station ? 'Pause' : 'Play')
                ])
            ])
        ]);
    }
};