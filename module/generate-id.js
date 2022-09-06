
export function generateId() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return btoa(String.fromCharCode(...arr)).replace(/[+\/=]/g, '').slice(0, 16);
}
