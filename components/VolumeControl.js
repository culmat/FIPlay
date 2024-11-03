function setVolume(percentage) {
    console.log('Setting volume to', percentage);
}

export default {
    view: () => {
        return m('div', { class: 'volume-slider' }, [
            m('input', {
                type: 'range',
                min: 0,
                max: 100,
                value: volume,
                oninput: (e) => {
                    volume = e.target.value;
                    setVolume(volume);
                }
            })
        ]);
    }
};