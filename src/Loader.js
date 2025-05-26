/** @type Map<string, string> */
const fontFormatTypes = new Map();
fontFormatTypes.set("otf", "opentype");
fontFormatTypes.set("ttf", "truetype");
fontFormatTypes.set("otc", "collection");
fontFormatTypes.set("ttc", "collection");
fontFormatTypes.set("eot", "embedded-opentype");
fontFormatTypes.set("woff", "woff");
fontFormatTypes.set("woff2", "woff2");

/** @type Set<'onStart'|'onLoadStart'|'onLoad'|'onProgress'|'onError'|'onComplete'> */
const hooksList = new Set();
hooksList.add('onStart');
hooksList.add('onLoadStart');
hooksList.add('onLoad');
hooksList.add('onProgress');
hooksList.add('onError');
hooksList.add('onComplete');

const supportedAssetTypes = {
    imageAssetTypes: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
    fontAssetTypes: ['ttf', 'otf', 'otc', 'ttc', 'eot', 'woff', 'woff2'],
    jsonAssetTypes: ['json'],
    textAssetTypes: ['txt'],
    audioAssetTypes: ['mp3', 'ogg', 'wav', 'webm']
};

/** @type Loader | null */
let loader = null;

/**
 * @typedef {object} HandlerRegistry 
 * @property {(cb: function(): void) => HandlerRegistry} add 
 * @property {(cb: function(): void) => HandlerRegistry} remove 
 */

/**
 * @typedef {object} Loader 
 * @property {HandlerRegistry} onStart 
 * @property {HandlerRegistry} onLoadStart 
 * @property {HandlerRegistry} onLoad 
 * @property {HandlerRegistry} onProgress 
 * @property {HandlerRegistry} onError 
 * @property {HandlerRegistry} onComplete 
 * @property {Readonly<Record<string, { url: string; name?: string, data: any }>>} assets 
 * @property {(url: string, name?: string) => Loader} add 
 * @property {(cb?: function(): void) => void} load 
 * @property {function(): void} reset 
 * @property {function(): void} destroy 
 */

export default class Loader {
    #isLoading = false;
    #loadedAssets = 0;
    #assetsToLoad = 0;
    /** @type Array<{ url: string; name?: string }> */
    #sources = [];
    /** @type Map<string, { url: string; name: string, data: any }> */
    #assets = new Map();

    /** @type Map<string, Set<function():void>> */
    #hooks = new Map(Array.from(hooksList, hook => [hook, new Set()]));

    constructor() {
        hooksList.forEach(hook => {
            this[hook] = this.#signal(hook);
        });
    }

    get assets() {
        return Object.fromEntries(this.#assets.entries());
    }

    /**
     * Adds a source object to the loading queue.
     * @param {string} url 
     * @param {string | undefined} name 
     * @returns {Loader}
     */
    add(url, name) {
        if (arguments.length === 1 && typeof(url) === 'object') {
            this.#sources.push(url);
        } else {
            this.#sources.push({ url, name });
        }

        return this;
    }

    /**
     * Initializes the loading action by processing 
     * the sources from the loading queue.
     * @param {() => void} cb 
     * @returns {void}
     */
    load(cb) {
        if (cb) this.onComplete.add(cb);

        if (this.#isLoading === true) return;

        this.#isLoading = true;
        this.#assetsToLoad = this.#sources.length;

        this.#dispatch('onStart');

        const loadingTask = new Promise((resolve, reject) => {
            const loadHandler = (asset, error) => {
                if (error) {
                    reject(error);
                    return;
                }

                this.#loadedAssets++;
                this.#dispatch('onLoad', asset);
                this.#dispatch('onProgress', Number((this.#loadedAssets / this.#assetsToLoad).toFixed(2)));
        
                if (this.#loadedAssets === this.#assetsToLoad) {
                    resolve(this.assets);
                    return;
                }
            }

            this.#sources.forEach(source => {
                let ext = source.url.split('.').pop();

                this.#dispatch('onLoadStart', source.url);

                if (supportedAssetTypes.imageAssetTypes.indexOf(ext) !== -1) {
                    this.#loadImageAsset(source, loadHandler);
                } else if (supportedAssetTypes.fontAssetTypes.indexOf(ext) !== -1) {
                    this.#loadFontAsset(source, loadHandler);
                } else if (supportedAssetTypes.jsonAssetTypes.indexOf(ext) !== -1) {
                    this.#loadJsonAsset(source, loadHandler);
                } else if (supportedAssetTypes.textAssetTypes.indexOf(ext) !== -1) {
                    this.#loadTxtAsset(source, loadHandler);
                } else if (supportedAssetTypes.audioAssetTypes.indexOf(ext) !== -1) {
                    this.#loadSoundAsset(source, loadHandler);
                } else {
                    reject(`File type "${ext}" from source "${source.url}" not recognized.`);
                }
            });
        });

        loadingTask
            .catch(error => {
                // console.error(`Error occurred while loading: \n`, error);
                this.#dispatch('onError', error);
            })
            .then((assets) => {
                // console.log('Assets finished loading.');
                this.#dispatch('onComplete', assets);
                this.#sources = [];
            })
            .finally(() => {
                this.#isLoading = false;
                this.#assetsToLoad = 0;
            });
    }

    reset() {
        this.#isLoading = false;
        this.#assetsToLoad = 0;
        this.#loadedAssets = 0;
        this.#sources = [];
        this.#assets.clear();
    }

    destroy() {
        this.reset();
        loader = null;
    }

    /**
     * Loads an image asset and calls a loading handler.
     * @param {{ url: string; name?: string }} source 
     * @param {(asset: any, error?: any) => void} loadHandler 
     */
    #loadImageAsset(source, loadHandler) {
        let image = new Image();
        image.addEventListener('load', (event) => {
            let { url, name } = source;
            let key = name ?? url;
            this.#assets.set(key, { url: url, name: key, data: event.currentTarget });
            let asset = this.#assets.get(key);
            loadHandler(asset, null);
        }, { once: true });

        image.addEventListener('error', (event) => {
            loadHandler(null, event.error);
        }, { once: true });

        image.src = source?.url;
    }

    /**
     * Loads a font asset and calls a loading handler.
     * @param {{ url: string; name?: string }} source 
     * @param {(asset: any, error?: any) => void} loadHandler 
     */
    #loadFontAsset(source, loadHandler) {
        let [ fontFamilyName, fontFormatExt ] = source.url?.split('/')?.pop()?.split('.');

        if (fontFamilyName == null) {
            let error = { message: 'Invalid source url.', source };
            return loadHandler(null, error);
        }

        let fontFormatType = fontFormatTypes.get(fontFormatExt) ?? '';
        let fontFace = `@font-face { font-family: "${fontFamilyName}"; src: url(${source.url}) ${fontFormatType && `format(${fontFormatType});`} font-display: swap; }`
        let styleElem = document.createElement('style');
        let key = source.name ?? source.url;
        styleElem.appendChild(document.createTextNode(fontFace));
        document.head.appendChild(styleElem);
        let asset = { url: source.url, name: key , data: null };
        loadHandler(asset, null);
    }

    /**
     * Loads a json asset and calls a loading handler.
     * @param {{ url: string; name?: string }} source 
     * @param {(asset: any, error?: any) => void} loadHandler 
     */
    #loadJsonAsset(source, loadHandler) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', source.url, true);
        xhr.responseType = 'text';

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                try {
                    let file = JSON.parse(xhr.response);
                    let key = source.name ?? source.url;
                    this.#assets.set(key, { url: source.url, name: key, data: file });
                    let asset = this.#assets.get(key);

                    if (file.frames) {
                        this.#createTilesetFrames(file, source, loadHandler);
                    } else {
                        loadHandler(asset, null);
                    }
                } catch (error) {
                    loadHandler(null, error);
                }
            } else if (xhr.status >= 400) {
                let error = { message: 'Something went wrong while fetching resource.', source };
                loadHandler(null, error);
            }
        }, { once: true });

        xhr.addEventListener('error', () => {
            let error = { message: 'Something went wrong while fetching resource.', source };
            loadHandler(null, error);
        }, { once: true });

        xhr.send();
    }

    /**
     * Loads a tileset config JSON file and calls a loading handler.
     * @param {object} file 
     * @param {{ url: string, name?: string }} source 
     * @param {(asset: any, error?: any) => void} loadHandler 
     */
    #createTilesetFrames(file, source, loadHandler) {
        // console.log('Loader##createTilesetFrames', file, source);
        let baseUrl = source.url.replace(/[^\/]*$/, '');
        let imageSource = baseUrl + file.meta.image;
        let image = new Image();
        let key = file.meta.image;

        let imageLoadHandler = () => {
            this.#assets.set(key, { url: imageSource, name: key, data: image });
            let asset = this.#assets.get(key);

            Object.keys(file.frames).forEach(frame => {
                // console.log('Loader##createTilesetFrames', frame, frameObj);
                const frameObj = file.frames[frame];
                frameObj.source = image;
                this.#assets.set(frame, { url: baseUrl + frame, name: frame, data: frameObj });
            });

            loadHandler(asset, null);
        };

        image.addEventListener('load', imageLoadHandler, { once: true });
        image.addEventListener('error', function (event) { loadHandler(null, event.error) }, { once: true });
        image.src = imageSource;
    }

    #loadTxtAsset(source, loadHandler) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', source.url, true);
        xhr.responseType = 'text';

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                try {
                    let key = source.name ?? source.url;
                    this.#assets.set(key, { url: source.url, name: key, data: xhr.response });
                    let asset = this.#assets.get(key);

                    loadHandler(asset, null);
                } catch (error) {
                    loadHandler(null, error);
                }
            } else if (xhr.status >= 400) {
                let error = { message: 'Something went wrong while fetching resource.', source };
                loadHandler(null, error);
            } 
        }, { once: true });

        xhr.addEventListener('error', () => {
            let error = { message: 'Something went wrong while fetching resource.', source };
            loadHandler(null, error);
        }, { once: true });

        xhr.send();
    }

    #loadSoundAsset(source, loadHandler) {
        console.log('Loaded sound asset', source);
    }

    #signal(id) {
        const queue = this.#hooks.get(id);
        const obj = {
            add(cb) {
                queue.add(cb);
                return this;
            },
            remove(cb) {
                queue.delete(cb);
                return this;
            }
        };
        return obj;
    }

    #dispatch(id, ...args) {
        this.#hooks.get(id).forEach(cb => cb(...args));
    }

    static getInstance() {
        if (loader instanceof this) {
            return loader;
        }

        loader = new this();
        return loader;
    }
}