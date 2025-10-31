document.addEventListener("DOMContentLoaded", () => {
    const prev = document.getElementById('prev');
    const convertBtn = document.getElementById('convert_btn');
    const authorInput = document.getElementById('author_input');
    const titleInput = document.getElementById('title_input');
    const data = sessionStorage.getItem('uploaded_file');

    if (!data) {
        alert("No uploaded image found. Please go back and upload a PNG first.");
        window.location.href = "../index.html";
        return;
    }

    // Show preview
    if (prev) prev.src = data;

    // Convert button click
    convertBtn.addEventListener('click', async () => {
        const author = authorInput.value.trim() || 'Unknown';
        const title = titleInput.value.trim() || 'Untitled';
        const file = dataURLtoFile(data, `${title}.png`);

        try {
            const converter = new SimplePaintConverter();
            await converter.convertSingleImage(file, title, author);
        } catch (err) {
            console.error(err);
            alert("Error converting image: " + err.message);
        }
    });
});

// Helper: convert Base64 back into a File object
function dataURLtoFile(dataurl, filename) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
}

// --- Simplified converter class (no canvasType select) ---
class SimplePaintConverter {
    constructor() {
        this.ROOT_UUID = "d21c6ea1-88c9-45b9-9703-050064de4df1";
        this.CANVAS_GEN = 1;
        this.CANVAS_VER = 2;
    }

    async convertSingleImage(file, title, author) {
        const { width, height } = await this.getImageDimensions(file);

        const sizeToType = {
            "16x16": 0,
            "32x32": 1,
            "32x16": 2,
            "16x32": 3
        };
        const typeKey = `${width}x${height}`;
        const ct = sizeToType[typeKey];

        if (ct === undefined) throw new Error(`Invalid image size: ${width}x${height}`);

        const pixelData = await this.extractPixelData(file, width, height);
        const paintData = this.createPaintData(pixelData, title, author, ct);

        const filename = title.replace(/\s+/g, '_') + '.paint';
        this.downloadPaintFile(paintData, filename);
    }

    getImageDimensions(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    extractPixelData(file, width, height) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = width;
                canvas.height = height;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, width, height);
                const pixels = [];
                for (let i = 0; i < imageData.data.length; i += 4) {
                    const r = imageData.data[i];
                    const g = imageData.data[i + 1];
                    const b = imageData.data[i + 2];
                    pixels.push(this.rgbToHex(r, g, b));
                }
                resolve(pixels);
                URL.revokeObjectURL(img.src);
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    rgbToHex(r, g, b) {
        return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }

    hexToSignedInt(hex) {
        const value = parseInt('ff' + hex, 16);
        return value > 0x7FFFFFFF ? value - 0x100000000 : value;
    }

    createPaintData(pixels, title, author, ct) {
        const timestamp = Math.floor(Date.now() / 1000);
        const name = `${this.ROOT_UUID}_${timestamp}`;
        const pixelInts = pixels.map(hex => this.hexToSignedInt(hex));

        return {
            "": {
                generation: 1,
                ct,
                pixels: pixelInts,
                v: this.CANVAS_VER,
                author,
                name,
                title
            }
        };
    }

    downloadPaintFile(data, filename) {
        const buffer = this.writeNBTData(data);
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }

    writeNBTData(data) {
        const compound = data[""];
        const estimatedSize = 4 * compound.pixels.length + 512;
        const buffer = new ArrayBuffer(estimatedSize);
        const view = new DataView(buffer);
        let offset = 0;

        const writeString = (str) => {
            const enc = new TextEncoder();
            const bytes = enc.encode(str);
            view.setUint16(offset, bytes.length, false);
            offset += 2;
            for (let b of bytes) view.setUint8(offset++, b);
        };

        const ensure = (bytes) => {
            if (offset + bytes > buffer.byteLength) throw new Error("Buffer too small!");
        };

        // TAG_Compound (root)
        ensure(1);
        view.setUint8(offset++, 10);
        writeString("");

        // generation
        view.setUint8(offset++, 3);
        writeString("generation");
        view.setInt32(offset, compound.generation, false);
        offset += 4;

        // ct
        view.setUint8(offset++, 1);
        writeString("ct");
        view.setInt8(offset++, compound.ct);

        // pixels
        view.setUint8(offset++, 11);
        writeString("pixels");
        view.setInt32(offset, compound.pixels.length, false);
        offset += 4;
        for (let p of compound.pixels) {
            view.setInt32(offset, p, false);
            offset += 4;
        }

        // v
        view.setUint8(offset++, 3);
        writeString("v");
        view.setInt32(offset, compound.v, false);
        offset += 4;

        // author
        view.setUint8(offset++, 8);
        writeString("author");
        writeString(compound.author);

        // name
        view.setUint8(offset++, 8);
        writeString("name");
        writeString(compound.name);

        // title
        view.setUint8(offset++, 8);
        writeString("title");
        writeString(compound.title);

        // End
        view.setUint8(offset++, 0);
        return buffer.slice(0, offset);
    }
}
