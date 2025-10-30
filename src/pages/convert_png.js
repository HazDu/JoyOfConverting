

document.addEventListener("DOMContentLoaded", () => {
    const prev = document.getElementById('prev');
    const data = sessionStorage.getItem('uploaded_image');

    if (data && prev) {
       prev.src = data;
    } else {
       console.warn("No uploaded image found in sessionStorage.");
       console.log(prev)
    }
});