document.addEventListener("DOMContentLoaded", () => {
    const nameInput = document.getElementById('FileName');
    const convertBtn = document.getElementById('convert_btn');
    const data = sessionStorage.getItem('uploaded_file');

    if (!data) {
        alert("No uploaded .paint file found. Please go back and upload one first.");
        window.location.href = "../index.html";
        return;
    }

    convertBtn.addEventListener('click', async () => {
        try {
            const fileName = (nameInput.value.trim() || "converted") + ".png";
            const file = dataURLtoFile(data, "temp.paint");
            const arrayBuffer = await file.arrayBuffer();

            const { pixels, canvasType } = parsePaintFile(arrayBuffer);
            if (!pixels || pixels.length === 0) throw new Error("No pixels found in file.");

            const { width, height } = canvasTypeToDimensions(canvasType, pixels.length);
            console.log(`Decoded: ${width}×${height}, ${pixels.length} pixels`);

            const blob = await paintPixelsToPNG(pixels, width, height);
            downloadBlob(blob, fileName);

        } catch (err) {
            console.error("Conversion error:", err);
            alert("Conversion failed:\n" + err.message + "\n\nCheck console for details.");
        }
    });
});

function dataURLtoFile(dataurl, filename) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
}

// Minimal NBT-style reader for your .paint files
function parsePaintFile(buffer) {
    const dv = new DataView(buffer);
    let offset = 0;
    let pixels = [];
    let canvasType = 0;

    function readByte() { return dv.getUint8(offset++); }
    function readShort() { const v = dv.getUint16(offset, false); offset += 2; return v; }
    function readInt() { const v = dv.getInt32(offset, false); offset += 4; return v; }
    function readString() {
        const len = readShort();
        let s = "";
        for (let i = 0; i < len; i++) s += String.fromCharCode(readByte());
        return s;
    }

    // Root tag (compound) — skip its type and name
    readByte(); // TAG_Compound = 0x0A
    readString(); // usually empty string ""

    while (offset < dv.byteLength) {
        const tagType = readByte();
        if (tagType === 0) break; // TAG_End
        const name = readString();

        switch (tagType) {
            case 1: // TAG_Byte
                const byteVal = readByte();
                if (name === "ct") canvasType = byteVal;
                break;
            case 3: // TAG_Int
                const intVal = readInt();
                if (name === "ct") canvasType = intVal;
                break;
            case 9: // TAG_List
                const listType = readByte(); // element type (should be int)
                const listLen = readInt();
                if (name === "pixels") {
                    pixels = [];
                    for (let i = 0; i < listLen; i++) {
                        pixels.push(readInt());
                    }
                } else {
                    // skip other lists
                    const skipSize = listLen * (listType === 3 ? 4 : 1);
                    offset += skipSize;
                }
                break;
            case 8: // TAG_String
                const _str = readString();
                break;
            case 11: // TAG_Int_Array
                const intArrayLen = readInt(); // length of array
                if (name === "pixels") {
                    pixels = [];
                    for (let i = 0; i < intArrayLen; i++) {
                        pixels.push(readInt());
                    }
                } else {
                    offset += intArrayLen * 4; // skip other int arrays
                }
                break;
            default:
                // skip unknown tags
                console.warn("Unknown tag type:", tagType, "name:", name);
                break;
        }
    }

    return { pixels, canvasType };
}

function canvasTypeToDimensions(ct, pixelCount) {
    switch (ct) {
        case 0: return { width: 16, height: 16 }; // SMALL
        case 1: return { width: 32, height: 32 }; // LARGE
        case 2: return { width: 32, height: 16 }; // LONG
        case 3: return { width: 16, height: 32 }; // TALL
        default:
            // fallback guess
            if (pixelCount === 256) return { width: 16, height: 16 };
            if (pixelCount === 512) return { width: 16, height: 32 };
            if (pixelCount === 1024) return { width: 32, height: 32 };
            return { width: Math.sqrt(pixelCount), height: Math.sqrt(pixelCount) };
    }
}

async function paintPixelsToPNG(pixels, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let i = 0; i < pixels.length; i++) {
        let color = pixels[i];
        if (color < 0) color = 0x100000000 + color;
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;
        const idx = i * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, "image/png"));
}

function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
