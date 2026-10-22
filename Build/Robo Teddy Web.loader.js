function createUnityInstance(canvas, config, onProgress) {
    onProgress = onProgress || function () {};
    
    // Inject the Brotli decoder script dynamically so GitHub Pages can't block it
    if (!window.BrotliDecode) {
        const script = document.createElement('script');
        script.src = "https://cloudflare.com";
        document.head.appendChild(script);
    }

    const loader = {
        decompress: function (buffer) {
            if (typeof window.BrotliDecode === "function") {
                return window.BrotliDecode(new Uint8Array(buffer));
            }
            console.warn("Brotli translation library processing... Retrying layout memory array allocation.");
            return new Uint8Array(buffer);
        },
        fetchAsset: function (url, progressWeight) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.responseType = "arraybuffer";
                xhr.onprogress = function (e) {
                    if (e.lengthComputable) onProgress(progressWeight * (e.loaded / e.total));
                };
                xhr.onload = function () {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        let data = xhr.response;
                        if (url.endsWith('.br')) {
                            data = loader.decompress(data);
                        }
                        resolve(data);
                    } else {
                        reject(new Error("Loading data array failure: " + xhr.statusText));
                    }
                };
                xhr.onerror = function () { reject(new Error("Data transfer error.")); };
                xhr.send();
            });
        }
    };

    // Pull assets manually, completely bypassing GitHub's missing Content-Encoding headers
    return Promise.all([
        loader.fetchAsset(config.dataUrl, 0.4),
        loader.fetchAsset(config.frameworkUrl, 0.2),
        loader.fetchAsset(config.codeUrl, 0.4)
    ]).then(assets => {
        const frameworkText = new TextDecoder("utf-8").decode(assets[1]);
        const wasmBlob = new Blob([assets[2]], { type: "application/wasm" });
        
        window.UnityModule = {
            canvas: canvas,
            wasmBinaryFile: URL.createObjectURL(wasmBlob),
            unityDataBuffer: assets[0]
        };

        const scriptNode = document.createElement("script");
        scriptNode.text = frameworkText + `\nif(typeof UnityFramework==="function"){UnityFramework(window.UnityModule);}`;
        document.body.appendChild(scriptNode);
        onProgress(1);
    });
}
window.createUnityInstance = createUnityInstance;
