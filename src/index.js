const upload_rect = document.getElementById('upload_rect');

['dragover', 'dragleave', 'drop'].forEach(evtName => {
    upload_rect.addEventListener(evtName, e => e.preventDefault());
    upload_rect.addEventListener(evtName, e => e.stopPropagation());
});

upload_rect.addEventListener('dragover', () => {
    upload_rect.classList.add('dragover');
});

upload_rect.addEventListener('dragleave', () => {
    upload_rect.classList.remove('dragover');
});

upload_rect.addEventListener('drop', e => {
    upload_rect.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.type !== "image/png") {
        alert("Please drop a .png file!");
        return;
    }

    const image_url = URL.createObjectURL(file);
    const img = new Image();

    img.onerror = () => {
        alert("Error loading image. Make sure it’s a valid PNG file.");
        URL.revokeObjectURL(image_url);
    };

    img.onload = async () => {
        const { width, height } = img;
        const valid_sizes = [
            [16, 16],
            [16, 32],
            [32, 16],
            [32, 32]
        ];

        const is_valid = valid_sizes.some(([w, h]) => w === width && h === height);

        if (!is_valid) {
            alert(`Invalid image size: ${width}x${height}. Allowed sizes are 16x16, 16x32, 32x16, or 32x32.`);
            URL.revokeObjectURL(image_url);
            return;
        }

        const base64_img = await toBase64(file);
        sessionStorage.setItem('uploaded_image', base64_img)

        console.log(`File stored: ${file.name}, size ${width}x${height}`);
        //prev.src = image_url;
        window.location.href = "pages/convert_png.html";
    }

    img.src = image_url;
});

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}