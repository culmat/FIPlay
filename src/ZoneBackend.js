import Backend from './Backend'
export default class ZoneBackEnd extends Backend {
    constructor(backendURL) {
        super(backendURL, 'zone');
    }
}